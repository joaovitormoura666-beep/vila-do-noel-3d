import { createServer, STATUS_CODES, type IncomingMessage, type ServerResponse } from 'node:http';
import { existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Duplex } from 'node:stream';
import { WebSocketServer, type WebSocket } from 'ws';
import type { DenyReason } from '../shared/types.js';
import { ROOT, type ServerConfig } from './config.js';
import { EventHub } from './EventHub.js';
import { SettingsStore, TikTokConfigStore } from './settingsStore.js';
import { SimulatorSource } from './integrations/SimulatorSource.js';
import { TikTokSource, type FabricaConector } from './integrations/TikTokSource.js';
import type { TikTokPanelInfo } from '../shared/tiktok.js';
import { proxyAvatar, simulatedAvatarSvg } from './avatars.js';
import { parseExternalEvent } from './rules.js';
import { serveStatic } from './static.js';
import {
  API_CSP,
  SECURITY_HEADERS,
  FailureLimiter,
  checkOrigin,
  clientIp,
  ipKey,
  isLoopbackHostHeader,
  requestToken,
  tokensMatch,
  type OriginCheck,
} from './security.js';

/**
 * Servidor HTTP + WebSocket da Vila do Noel, montado a partir de uma configuração.
 * server/index.ts usa este módulo para subir o servidor de verdade; os testes usam
 * para subir um servidor temporário numa porta qualquer.
 *
 * Rotas:
 *   GET  /api/saude          verificação (sem senha): { ok, versao, tempoNoArSeg }
 *   GET  /api/estado         contadores (com a senha, quando o servidor exige)
 *   GET  /api/audio          lista de áudios opcionais (public/audio)
 *   GET  /api/avatar?url=    foto de perfil repassada (só hosts permitidos)
 *   GET  /api/avatar-sim/x   foto fictícia do simulador
 *   POST /api/evento         entrada de eventos da live (com a senha, quando o servidor exige)
 *   WS   /ws                 tela do jogo e painel
 *
 * Fontes de eventos: o simulador do painel, a entrada /api/evento e a leitura da live do
 * TikTok (server/integrations/TikTokSource.ts), ligada e desligada pelo painel.
 */
export interface VilaServer {
  readonly config: ServerConfig;
  readonly hub: EventHub;
  readonly settings: SettingsStore;
  readonly tiktok: TikTokSource;
  readonly tiktokConfig: TikTokConfigStore;
  listen(): Promise<AddressInfo>;
  close(): Promise<void>;
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function json(res: ServerResponse, status: number, body: unknown) {
  if (res.headersSent) {
    res.end();
    return;
  }
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function text(res: ServerResponse, status: number, body: string, type = 'text/plain; charset=utf-8') {
  if (res.headersSent) {
    res.end();
    return;
  }
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}

function readBody(req: IncomingMessage, limit: number): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    const declared = Number(req.headers['content-length'] ?? 0);
    if (declared > limit) {
      reject(new HttpError(413, 'corpo grande demais'));
      return;
    }
    let size = 0;
    const chunks: Buffer[] = [];
    const onData = (c: Buffer) => {
      size += c.length;
      if (size > limit) {
        req.off('data', onData);
        reject(new HttpError(413, 'corpo grande demais'));
        return;
      }
      chunks.push(c);
    };
    req.on('data', onData);
    req.on('end', () => resolvePromise(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function formatUptime(sec: number): string {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return d > 0 ? `${d}d ${h}h ${m}min` : h > 0 ? `${h}h ${m}min` : `${m}min ${sec % 60}s`;
}

function rejectUpgrade(socket: Duplex, status: number, message: string) {
  const body = `${message}\n`;
  socket.end(
    `HTTP/1.1 ${status} ${STATUS_CODES[status] ?? ''}\r\nConnection: close\r\nContent-Type: text/plain; charset=utf-8\r\n` +
      `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`,
  );
  socket.destroy();
}

export interface VilaServerDeps {
  /** Troca a biblioteca do TikTok por um conector falso (usado nos testes). */
  tiktokFactory?: FabricaConector;
}

export function createVilaServer(config: ServerConfig, deps: VilaServerDeps = {}): VilaServer {
  const settings = new SettingsStore(config.settingsFile);
  const simulator = new SimulatorSource();
  // a configuração do TikTok fica à parte (data/tiktok.json): a chave do Euler Stream não vai para a tela do jogo
  const tiktokConfig = new TikTokConfigStore(join(config.dataDir, 'tiktok.json'), config.tiktok);
  const tiktok = new TikTokSource({
    fabrica: deps.tiktokFactory,
    aoMudar: () => hub.pushTikTok(tiktokInfo()),
    registrar: (nivel, texto) => hub.addLog(nivel, texto),
  });
  const tiktokInfo = (): TikTokPanelInfo => ({ status: tiktok.status, contadores: tiktok.contadores, config: tiktokConfig.publicConfig() });
  const failures = new FailureLimiter();
  const originPolicy = { allowed: config.allowedOrigins, local: !config.exposed, sameHost: !config.exposed || config.serveFront };
  const startedAt = Date.now();

  /**
   * Confere uma senha contra as aceitas, com limite de tentativas erradas por endereço.
   * Cada entrada (painel, tela do jogo, eventos) conta as falhas à parte: errar a senha do
   * painel não bloqueia a ferramenta de eventos da live que usa a mesma internet, e vice-versa.
   */
  function checkToken(channel: string, token: unknown, ip: string, accepted: Array<string | null>): DenyReason | null {
    const valid = accepted.filter((t): t is string => Boolean(t));
    if (valid.length === 0) return null; // nenhuma senha configurada: modo local de sempre
    const key = `${channel}|${ipKey(ip)}`;
    if (failures.blockedFor(key) > 0) return 'bloqueado';
    if (typeof token !== 'string' || token === '') return 'token_ausente';
    if (valid.some((t) => tokensMatch(token, t))) {
      failures.reset(key);
      return null;
    }
    failures.fail(key);
    if (failures.blockedFor(key) > 0) {
      console.warn(`[senha] tentativas erradas demais (${channel}) de ${ip}: bloqueado por 10 minutos`);
      return 'bloqueado';
    }
    return 'token_invalido';
  }
  const checkAdmin = (token: unknown, ip: string) => checkToken('painel', token, ip, [config.adminToken]);
  const checkGame = (token: unknown, ip: string) => checkToken('tela', token, ip, [config.screenKey]);
  /** Eventos: pelo cabeçalho vale TOKEN_ADMIN ou TOKEN_EVENTOS; no endereço (?token=), só TOKEN_EVENTOS. */
  const checkEvents = (t: { token: string | null; fromQuery: boolean }, ip: string) =>
    checkToken('eventos', t.token, ip, t.fromQuery ? [config.eventsToken] : [config.adminToken, config.eventsToken]);

  const hub = new EventHub(settings, simulator, {
    authorizePanel: config.adminToken ? checkAdmin : undefined,
    authorizeGame: config.screenKey ? checkGame : undefined,
    screenKey: config.screenKey,
    maxScreens: config.limits.maxScreens,
    requiresToken: Boolean(config.adminToken),
    msgsPerSec: config.limits.msgsPerSec,
    msgBurst: config.limits.msgBurst,
    tiktokInfo,
    onTikTokConfig: (msg) => {
      const erro = tiktokConfig.update({ usuario: msg.usuario, ligado: msg.ligado, chave: msg.chave });
      if (erro) {
        hub.addLog('erro', erro);
        hub.pushTikTok(tiktokInfo());
        return;
      }
      if (!tiktokConfig.lastSaveOk) {
        hub.addLog('erro', 'O servidor não conseguiu gravar a configuração do TikTok (data/tiktok.json). Ela vale até o servidor reiniciar.');
      }
      if (msg.chave !== undefined) {
        hub.addLog('info', msg.chave ? 'Chave do Euler Stream salva no servidor' : 'Chave do Euler Stream apagada do painel');
      }
      tiktok.configurar(tiktokConfig.get(), msg.ligado === true);
      hub.pushTikTok(tiktokInfo());
    },
    onQueueAccepted: (source) => {
      if (source === 'tiktok') tiktok.contarEntradaNaFila();
    },
    onGiftEffect: (source) => {
      if (source === 'tiktok') tiktok.contarEfeito();
    },
  });
  simulator.start((ev) => hub.ingest(ev));
  tiktok.start((ev) => hub.ingest(ev));
  // liga sozinho se o painel (ou o .env) deixou ligado da última vez
  tiktok.configurar(tiktokConfig.get());

  /** Áudios opcionais (música licenciada e frases gravadas) que acompanham o front. */
  function listOptionalAudio() {
    const base = [join(config.frontDir, 'audio'), resolve(ROOT, 'public', 'audio')].find((d) => existsSync(d));
    const list = (dir: string) => {
      try {
        return base ? readdirSync(join(base, dir)) : [];
      } catch {
        return [];
      }
    };
    const musica = list('musica').find((f) => /^fundo\.(mp3|ogg|wav)$/i.test(f)) ?? null;
    const vozes = list('voz')
      .filter((f) => /\.mp3$/i.test(f))
      .map((f) => f.replace(/\.mp3$/i, ''));
    return { musica, vozes };
  }

  function denyHttp(res: ServerResponse, reason: DenyReason) {
    if (reason === 'bloqueado') {
      res.setHeader('Retry-After', '600');
      return json(res, 429, { ok: false, erro: 'tentativas erradas demais; espere alguns minutos' });
    }
    res.setHeader('WWW-Authenticate', 'Bearer');
    return json(res, 401, { ok: false, erro: reason === 'token_ausente' ? 'falta a senha (token)' : 'senha (token) errada' });
  }

  let lastHostWarning = 0;
  /**
   * Modo local (sem senha): só aceita pedidos endereçados ao próprio computador
   * (Host = localhost, 127.x ou [::1]). Bloqueia o "DNS rebinding" e o caso de alguém colocar
   * este servidor atrás de um proxy na internet sem configurar a senha.
   */
  function foreignHostInLocalMode(req: IncomingMessage): boolean {
    if (config.exposed || isLoopbackHostHeader(req.headers.host)) return false;
    if (Date.now() - lastHostWarning > 60_000) {
      lastHostWarning = Date.now();
      console.warn(
        `[seguranca] pedido recusado: endereço "${String(req.headers.host ?? '').slice(0, 80)}" não é deste computador. ` +
          'Sem TOKEN_ADMIN o servidor só atende localhost. Para usar pela internet (proxy, VM), defina TOKEN_ADMIN e ORIGENS_PERMITIDAS no .env.',
      );
    }
    return true;
  }

  async function handleApi(req: IncomingMessage, res: ServerResponse, url: URL, ip: string) {
    const path = url.pathname;
    const method = req.method ?? 'GET';
    if (foreignHostInLocalMode(req)) return json(res, 403, { ok: false, erro: 'endereço não permitido' });
    const origin = typeof req.headers.origin === 'string' ? req.headers.origin : undefined;
    const originCheck: OriginCheck = checkOrigin(origin, req.headers.host, originPolicy);
    const originOk = originCheck === 'mesma' || originCheck === 'permitida';
    res.setHeader('Content-Security-Policy', API_CSP);

    // Verificação pública: qualquer página pode consultar (o painel usa para explicar problemas).
    if (path === '/api/saude') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      if (method === 'OPTIONS') return text(res, 204, '');
      if (method !== 'GET' && method !== 'HEAD') return json(res, 405, { ok: false, erro: 'método não permitido' });
      const sec = Math.floor((Date.now() - startedAt) / 1000);
      return json(res, 200, {
        ok: true,
        servico: 'vila-do-noel',
        versao: config.version,
        noArDesde: new Date(startedAt).toISOString(),
        tempoNoArSeg: sec,
        tempoNoAr: formatUptime(sec),
        // diz à página que perguntou se ela tem permissão de conectar (ORIGENS_PERMITIDAS)
        origemPermitida: origin ? originOk : null,
      });
    }

    // CORS: só as origens permitidas recebem permissão de ler as respostas.
    if (origin && originOk) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }
    if (method === 'OPTIONS') {
      if (!originOk && originCheck !== 'ausente') return json(res, 403, { ok: false, erro: 'origem não permitida' });
      res.writeHead(204, {
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Token',
        'Access-Control-Max-Age': '600',
      });
      return res.end();
    }

    if (path === '/api/evento') {
      if (method !== 'POST') return json(res, 405, { ok: false, erro: 'use POST' });
      if (originCheck === 'recusada') return json(res, 403, { ok: false, erro: 'origem não permitida' });
      const sent = requestToken(req, url);
      if (sent.fromQuery && config.adminToken && !config.eventsToken) {
        // a senha do painel não vai no endereço (acabaria em históricos e registros)
        return json(res, 401, {
          ok: false,
          erro: 'a senha no endereço (?token=) só vale com TOKEN_EVENTOS; mande a senha no cabeçalho Authorization: Bearer ou crie TOKEN_EVENTOS no .env',
        });
      }
      const denied = checkEvents(sent, ip);
      if (denied) return denyHttp(res, denied);
      let body: unknown;
      try {
        body = JSON.parse(await readBody(req, config.limits.httpMaxBytes));
      } catch (err) {
        if (err instanceof HttpError) {
          res.setHeader('Connection', 'close');
          return json(res, err.status, { ok: false, erro: err.message });
        }
        return json(res, 400, { ok: false, erro: 'JSON inválido' });
      }
      const ev = parseExternalEvent(body, 'webhook');
      if (!ev) return json(res, 400, { ok: false, erro: 'evento inválido' });
      hub.ingest(ev);
      return json(res, 200, { ok: true });
    }

    if (method !== 'GET' && method !== 'HEAD') return json(res, 405, { ok: false, erro: 'método não permitido' });

    if (path === '/api/estado') {
      // só pelo cabeçalho: a senha do painel não vai no endereço
      const sent = requestToken(req, url);
      const denied = checkAdmin(sent.fromQuery ? null : sent.token, ip);
      if (denied) return denyHttp(res, denied);
      return json(res, 200, hub.stats());
    }

    if (path === '/api/audio') return json(res, 200, listOptionalAudio());

    if (path.startsWith('/api/avatar-sim/')) {
      let seed: string;
      try {
        seed = decodeURIComponent(path.slice('/api/avatar-sim/'.length)).replace(/\.svg$/, '');
      } catch {
        return text(res, 400, 'endereço inválido');
      }
      res.writeHead(200, { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=3600' });
      return res.end(simulatedAvatarSvg(seed.slice(0, 200)));
    }

    if (path === '/api/avatar') {
      // páginas de outros sites não usam o proxy de fotos (com Origin: conferido; sem Origin, no
      // modo local, o navegador ainda diz de onde veio o pedido em Sec-Fetch-Site)
      if (originCheck === 'recusada') return text(res, 403, 'origem não permitida');
      if (!config.exposed && originCheck === 'ausente' && req.headers['sec-fetch-site'] === 'cross-site') return text(res, 403, 'origem não permitida');
      return proxyAvatar(res, url.searchParams.get('url'), ipKey(ip), {
        hosts: config.avatarHosts,
        maxBytes: config.limits.avatarMaxBytes,
        timeoutMs: config.limits.avatarTimeoutMs,
        maxConcurrent: config.limits.avatarConcurrent,
        maxConcurrentPerIp: config.limits.avatarConcurrentPerIp,
      });
    }

    return json(res, 404, { ok: false, erro: 'rota não encontrada' });
  }

  const server = createServer(async (req, res) => {
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v);
    let url: URL;
    try {
      // a base é fixa: o cabeçalho Host vem de fora e não deve influenciar o caminho
      url = new URL(req.url ?? '/', 'http://servidor.local');
    } catch {
      return text(res, 400, 'Endereço inválido.');
    }
    const path = url.pathname;
    try {
      if (path.startsWith('/api/')) return await handleApi(req, res, url, clientIp(req, config.trustedProxies));

      if (req.method !== 'GET' && req.method !== 'HEAD') return text(res, 405, 'Método não permitido.');

      if (config.serveFront) {
        if (existsSync(config.frontDir) && serveStatic(config.frontDir, path, res)) return;
        // as páginas procuram um config.json; servidas daqui, o back-end é este mesmo servidor
        if (path === '/config.json') return json(res, 200, { backend: '' });
        return text(
          res,
          404,
          existsSync(config.frontDir)
            ? 'Página não encontrada.'
            : 'O jogo ainda não foi compilado. Rode "npm start" (ou "npm run dev" e abra http://localhost:5173).',
        );
      }
      if (path === '/') return text(res, 200, 'Vila do Noel Live: back-end no ar. Verificação: /api/saude\n');
      return text(res, 404, 'Página não encontrada.');
    } catch (err) {
      // a mensagem detalhada fica só no registro do servidor; quem pediu recebe um erro genérico
      console.warn('[http]', (err as Error).message);
      return json(res, 500, { ok: false, erro: 'erro interno' });
    }
  });
  // conexões lentas de propósito não seguram o servidor
  server.requestTimeout = 20_000;
  server.headersTimeout = 10_000;
  server.maxHeadersCount = 60;

  /* ---------- WebSocket ---------- */

  const wss = new WebSocketServer({ noServer: true, maxPayload: config.limits.wsMaxBytes, perMessageDeflate: false });
  const perIp = new Map<string, number>();
  const alive = new WeakMap<WebSocket, boolean>();

  server.on('upgrade', (req, socket, head) => {
    socket.on('error', () => socket.destroy());
    let path = '';
    try {
      path = new URL(req.url ?? '/', 'http://servidor.local').pathname;
    } catch {
      /* cai no 404 */
    }
    if (path !== '/ws') return rejectUpgrade(socket, 404, 'rota não encontrada');
    if (foreignHostInLocalMode(req)) return rejectUpgrade(socket, 403, 'endereço não permitido');
    const origin = typeof req.headers.origin === 'string' ? req.headers.origin : undefined;
    const check = checkOrigin(origin, req.headers.host, originPolicy);
    // sem Origin só no modo local: navegadores sempre mandam, então na internet a ausência é suspeita
    const ok = check === 'mesma' || check === 'permitida' || (check === 'ausente' && !config.exposed);
    if (!ok) {
      console.warn(`[ws] conexão recusada: origem ${origin ?? '(nenhuma)'} fora de ORIGENS_PERMITIDAS`);
      return rejectUpgrade(socket, 403, 'origem não permitida');
    }
    // o limite por endereço agrupa o IPv6 por /64 (um mesmo visitante tem milhares de endereços)
    const ip = clientIp(req, config.trustedProxies);
    const key = ipKey(ip);
    if ((perIp.get(key) ?? 0) >= config.limits.maxConnectionsPerIp) return rejectUpgrade(socket, 429, 'conexões demais deste endereço');
    // lotado: quem ainda não se identificou dá lugar (o painel e a tela se identificam na hora)
    if (hub.connectionCount() >= config.limits.maxConnections && !hub.evictOldestPending()) {
      return rejectUpgrade(socket, 503, 'conexões demais');
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      perIp.set(key, (perIp.get(key) ?? 0) + 1);
      alive.set(ws, true);
      ws.on('pong', () => alive.set(ws, true));
      ws.on('close', () => {
        const n = (perIp.get(key) ?? 1) - 1;
        if (n <= 0) perIp.delete(key);
        else perIp.set(key, n);
      });
      hub.attach(ws, { ip });
    });
  });

  // Conexões que caíram sem avisar (Wi-Fi, VM reiniciada) são limpas; o ping também mantém
  // o proxy reverso e a Cloudflare sem fechar a conexão por inatividade.
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (alive.get(ws) === false) {
        ws.terminate();
        continue;
      }
      alive.set(ws, false);
      ws.ping();
    }
  }, 30_000);
  heartbeat.unref();

  return {
    config,
    hub,
    settings,
    tiktok,
    tiktokConfig,
    listen() {
      return new Promise<AddressInfo>((resolvePromise, reject) => {
        const onError = (err: Error) => reject(err);
        server.once('error', onError);
        server.listen(config.port, config.host, () => {
          server.off('error', onError);
          resolvePromise(server.address() as AddressInfo);
        });
      });
    },
    close() {
      clearInterval(heartbeat);
      simulator.stop();
      tiktok.stop();
      hub.closeAll();
      wss.close();
      return new Promise<void>((resolvePromise) => {
        server.close(() => resolvePromise());
        server.closeAllConnections();
      });
    },
  };
}
