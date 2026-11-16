import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { request as httpRequest } from 'node:http';
import { createVilaServer, type VilaServer } from '../server/app';
import { readConfig } from '../server/config';
import type { ToClient, ToServer } from '../shared/types';

/**
 * Sobe um servidor de verdade (numa porta livre, com dados numa pasta temporária),
 * configurado como na VM: com senha do painel e uma origem permitida.
 */
const TOKEN = 'senha-de-teste-0123456789';
const FRONT = 'https://vila-teste.pages.dev';

const EVENTOS = 'senha-so-dos-eventos-123';

interface Running {
  app: VilaServer;
  base: string;
  dir: string;
}

/** Sobe um servidor temporário. `packaged` = como o servidor empacotado da VM. */
async function startServer(env: Record<string, string>, packaged = true): Promise<Running> {
  const dir = mkdtempSync(join(tmpdir(), 'vila-teste-'));
  const { config, errors } = readConfig({ HOST: '127.0.0.1', PORT: '0', DATA_DIR: dir, ...env }, dir, packaged);
  expect(errors).toEqual([]);
  const app = createVilaServer(config);
  const addr = await app.listen();
  return { app, base: `127.0.0.1:${addr.port}`, dir };
}

async function stopServer(r: Running) {
  await r.app.close();
  rmSync(r.dir, { recursive: true, force: true });
}

let main: Running;
let app: VilaServer;
let base = '';
/** Chave da tela do jogo que o servidor principal exige (vem no welcome do painel). */
let screenKey = '';

beforeAll(async () => {
  main = await startServer({ TOKEN_ADMIN: TOKEN, TOKEN_EVENTOS: EVENTOS, ORIGENS_PERMITIDAS: FRONT });
  app = main.app;
  base = main.base;
  screenKey = app.config.screenKey ?? '';
  expect(screenKey).toMatch(/^[0-9a-f]{32}$/);
});

afterAll(async () => {
  await stopServer(main);
});

interface Peer {
  ws: WebSocket;
  messages: ToClient[];
  send(msg: ToServer): void;
  /** Espera uma mensagem que satisfaça o filtro. */
  next(pred: (m: ToClient) => boolean, ms?: number): Promise<ToClient>;
  closed: Promise<number>;
}

/** `origin` vazio = conexão sem o cabeçalho Origin (como uma ferramenta fora do navegador). */
function connect(origin = FRONT, at = base, headers: Record<string, string> = {}): Promise<Peer> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://${at}/ws`, { ...(origin ? { origin } : {}), headers });
    const messages: ToClient[] = [];
    const waiters: Array<{ pred: (m: ToClient) => boolean; done: (m: ToClient) => void }> = [];
    ws.on('message', (data) => {
      const msg = JSON.parse(String(data)) as ToClient;
      messages.push(msg);
      for (const w of [...waiters]) if (w.pred(msg)) {
        waiters.splice(waiters.indexOf(w), 1);
        w.done(msg);
      }
    });
    const closed = new Promise<number>((r) => ws.on('close', (code) => r(code)));
    ws.on('open', () =>
      resolve({
        ws,
        messages,
        closed,
        send: (msg) => ws.send(JSON.stringify(msg)),
        next: (pred, ms = 2000) =>
          new Promise((res, rej) => {
            const found = messages.find(pred);
            if (found) return res(found);
            const t = setTimeout(() => rej(new Error('mensagem não chegou')), ms);
            waiters.push({ pred, done: (m) => (clearTimeout(t), res(m)) });
          }),
      }),
    );
    ws.on('error', reject);
  });
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('autenticação do painel', () => {
  it('sem senha: recusa e fecha a conexão', async () => {
    const p = await connect();
    p.send({ t: 'hello', role: 'panel' });
    expect(await p.next((m) => m.t === 'denied')).toEqual({ t: 'denied', reason: 'token_ausente' });
    expect(await p.closed).toBe(4001);
    expect(p.messages.some((m) => m.t === 'settings' || m.t === 'logHistory')).toBe(false);
  });

  it('senha errada: recusa e fecha a conexão', async () => {
    const p = await connect();
    p.send({ t: 'hello', role: 'panel', token: 'senha-errada-000000000' });
    expect(await p.next((m) => m.t === 'denied')).toEqual({ t: 'denied', reason: 'token_invalido' });
    expect(await p.closed).toBe(4001);
  });

  it('a senha dos eventos não abre o painel', async () => {
    const p = await connect();
    p.send({ t: 'hello', role: 'panel', token: 'senha-so-dos-eventos-123' });
    expect(await p.next((m) => m.t === 'denied')).toMatchObject({ reason: 'token_invalido' });
  });

  it('senha certa: entra, recebe configurações e pode mudá-las', async () => {
    const p = await connect();
    p.send({ t: 'hello', role: 'panel', token: TOKEN });
    // o painel recebe a chave da tela para montar o endereço do OBS
    expect(await p.next((m) => m.t === 'welcome')).toEqual({ t: 'welcome', role: 'panel', requiresToken: true, screenKey });
    await p.next((m) => m.t === 'settings');
    await p.next((m) => m.t === 'logHistory');
    p.send({ t: 'settings', patch: { speed: 2 } });
    const s = await p.next((m) => m.t === 'settings' && m.settings.speed === 2);
    expect(s.t).toBe('settings');
    expect(app.settings.get().speed).toBe(2);
    p.send({ t: 'settings', patch: { speed: 1 } });
    await p.next((m) => m.t === 'settings' && m.settings.speed === 1);
    p.ws.close();
  });

  it('tela do jogo sem a chave da tela ou com a chave errada: recusada', async () => {
    const semChave = await connect();
    semChave.send({ t: 'hello', role: 'game' });
    expect(await semChave.next((m) => m.t === 'denied')).toEqual({ t: 'denied', reason: 'token_ausente' });
    expect(await semChave.closed).toBe(4001);
    const errada = await connect();
    errada.send({ t: 'hello', role: 'game', token: 'f'.repeat(32) });
    expect(await errada.next((m) => m.t === 'denied')).toEqual({ t: 'denied', reason: 'token_invalido' });
    // a senha do painel também não serve como chave da tela
    const comSenha = await connect();
    comSenha.send({ t: 'hello', role: 'game', token: TOKEN });
    expect(await comSenha.next((m) => m.t === 'denied')).toMatchObject({ reason: 'token_invalido' });
  });

  it('tela do jogo com a chave: recebe dados e não consegue comandar nada', async () => {
    const panel = await connect();
    panel.send({ t: 'hello', role: 'panel', token: TOKEN });
    await panel.next((m) => m.t === 'welcome');

    const game = await connect();
    game.send({ t: 'hello', role: 'game', token: screenKey });
    // a tela não recebe a chave nem nada do painel
    expect(await game.next((m) => m.t === 'welcome')).toEqual({ t: 'welcome', role: 'game', requiresToken: true });
    await game.next((m) => m.t === 'settings');

    const before = JSON.stringify(app.settings.get());
    game.send({ t: 'settings', patch: { speed: 3, paused: true } });
    game.send({ t: 'resetSettings' });
    game.send({ t: 'command', cmd: 'clear' });
    game.send({ t: 'simulate', kind: 'rosa', count: 5 });
    // tentar virar painel depois de entrar como jogo também não funciona
    game.send({ t: 'hello', role: 'panel', token: TOKEN });
    game.send({ t: 'settings', patch: { speed: 3 } });
    await wait(400);
    expect(JSON.stringify(app.settings.get())).toBe(before);
    expect(game.messages.some((m) => m.t === 'participant' || m.t === 'command' || m.t === 'logHistory')).toBe(false);

    // o painel, com a senha, comanda: o jogo recebe
    panel.send({ t: 'command', cmd: 'skip' });
    expect(await game.next((m) => m.t === 'command')).toEqual({ t: 'command', cmd: 'skip' });
    panel.send({ t: 'simulate', kind: 'rosa' });
    expect((await game.next((m) => m.t === 'participant')).t).toBe('participant');

    // o estado que o jogo informa chega ao painel, já conferido
    game.send({ t: 'status', status: { fps: 9999, quality: 'xyz', queueLength: -5, current: 'Luna', served: 3 } as never });
    const st = await panel.next((m) => m.t === 'status' && m.status !== null && m.status.served === 3);
    expect(st).toMatchObject({ status: { fps: 1000, quality: 'alta', queueLength: 0, current: 'Luna' } });
    panel.ws.close();
    game.ws.close();
  });

  it('recusa WebSocket de uma página que não está em ORIGENS_PERMITIDAS ou sem Origin', async () => {
    await expect(connect('https://site-malicioso.com')).rejects.toThrow(/403/);
    await expect(connect('')).rejects.toThrow(/403/);
  });

  it('desliga quem manda mensagens grandes demais', async () => {
    const p = await connect();
    p.ws.send('x'.repeat(64 * 1024));
    expect(await p.closed).toBe(1009);
  });
});

describe('rotas HTTP', () => {
  const http = (path: string, init: RequestInit = {}) => fetch(`http://${base}${path}`, init);
  const evento = JSON.stringify({ type: 'gift', userId: 'u-http', nickname: 'Maria', giftName: 'Rosa' });

  it('GET /api/saude responde sem senha e diz se a origem é aceita', async () => {
    const r = await http('/api/saude', { headers: { Origin: FRONT } });
    expect(r.status).toBe(200);
    const body = (await r.json()) as Record<string, unknown>;
    expect(body).toMatchObject({ ok: true, origemPermitida: true });
    expect(typeof body.versao).toBe('string');
    expect(typeof body.tempoNoArSeg).toBe('number');
    const r2 = await http('/api/saude', { headers: { Origin: 'https://outro.com' } });
    expect(await r2.json()).toMatchObject({ origemPermitida: false });
  });

  it('POST /api/evento exige a senha', async () => {
    const post = (headers: Record<string, string>, query = '') =>
      http(`/api/evento${query}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: evento });
    expect((await post({})).status).toBe(401);
    expect((await post({ Authorization: 'Bearer senha-errada-xxxxxxxx' })).status).toBe(401);
    expect((await post({ Authorization: `Bearer ${TOKEN}` })).status).toBe(200);
    expect((await post({}, `?token=${EVENTOS}`)).status).toBe(200);
    // a senha do painel não vale no endereço (?token=): só no cabeçalho
    expect((await post({}, `?token=${TOKEN}`)).status).toBe(401);
    expect((await post({ Authorization: `Bearer ${TOKEN}`, Origin: 'https://site-malicioso.com' })).status).toBe(403);
  });

  it('limita o tamanho do corpo', async () => {
    const r = await http('/api/evento', {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'chat', userId: 'u', comment: 'x'.repeat(40_000) }),
    });
    expect(r.status).toBe(413);
  });

  it('responde ao CORS (OPTIONS) só para as origens permitidas', async () => {
    const ok = await http('/api/evento', { method: 'OPTIONS', headers: { Origin: FRONT, 'Access-Control-Request-Method': 'POST' } });
    expect(ok.status).toBe(204);
    expect(ok.headers.get('access-control-allow-origin')).toBe(FRONT);
    expect(ok.headers.get('access-control-allow-headers')).toMatch(/Authorization/);
    const bad = await http('/api/evento', { method: 'OPTIONS', headers: { Origin: 'https://site-malicioso.com' } });
    expect(bad.status).toBe(403);
    const audio = await http('/api/audio', { headers: { Origin: FRONT } });
    expect(audio.headers.get('access-control-allow-origin')).toBe(FRONT);
    expect(audio.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('não serve as páginas na VM e não mostra caminhos internos em erros', async () => {
    const root = await http('/');
    expect(await root.text()).toMatch(/back-end no ar/);
    const r = await http('/api/nao-existe');
    expect(r.status).toBe(404);
    const t = await http('/api/avatar-sim/%E0%A4%A.svg');
    expect(await t.text()).not.toMatch(/\/home|\/tmp|node_modules/);
    const est = await http('/api/estado');
    expect(est.status).toBe(401);
    expect((await http(`/api/estado?token=${TOKEN}`)).status).toBe(401);
    expect((await http('/api/estado', { headers: { Authorization: `Bearer ${TOKEN}` } })).status).toBe(200);
  });

  it('o proxy de avatar recusa hosts fora da lista', async () => {
    const r = await http(`/api/avatar?url=${encodeURIComponent('https://example.com/foto.jpg')}`);
    expect(r.status).toBe(404);
    const r2 = await http(`/api/avatar?url=${encodeURIComponent('http://169.254.169.254/latest/meta-data')}`);
    expect(r2.status).toBe(404);
  });
});

describe('proteções contra telas falsas e bloqueios', () => {
  let r: Running;
  let key = '';
  beforeAll(async () => {
    r = await startServer({ TOKEN_ADMIN: TOKEN, TOKEN_EVENTOS: EVENTOS, ORIGENS_PERMITIDAS: FRONT, MAX_TELAS: '2', MAX_CONEXOES: '5', MAX_CONEXOES_POR_IP: '50' });
    key = r.app.config.screenKey ?? '';
  });
  afterAll(async () => {
    await stopServer(r);
  });

  it('limita o número de telas do jogo e o painel mostra só a mais antiga', async () => {
    const panel = await connect(FRONT, r.base);
    panel.send({ t: 'hello', role: 'panel', token: TOKEN });
    await panel.next((m) => m.t === 'welcome');
    const g1 = await connect(FRONT, r.base);
    g1.send({ t: 'hello', role: 'game', token: key });
    await g1.next((m) => m.t === 'welcome');
    const g2 = await connect(FRONT, r.base);
    g2.send({ t: 'hello', role: 'game', token: key });
    await g2.next((m) => m.t === 'welcome');
    const g3 = await connect(FRONT, r.base);
    g3.send({ t: 'hello', role: 'game', token: key });
    expect(await g3.next((m) => m.t === 'denied')).toEqual({ t: 'denied', reason: 'telas_demais' });

    // o estado de uma tela que não é a principal é ignorado
    g2.send({ t: 'status', status: { fps: 1, quality: 'baixa', current: 'Falsa', served: 777 } as never });
    g1.send({ t: 'status', status: { fps: 60, quality: 'alta', current: 'Luna', served: 5 } as never });
    const st = await panel.next((m) => m.t === 'status' && m.status !== null && m.status.served === 5);
    expect(st).toMatchObject({ status: { current: 'Luna' }, games: 2 });
    expect(panel.messages.some((m) => m.t === 'status' && m.status?.served === 777)).toBe(false);

    // uma tela não consegue inundar o registro do painel
    const before = panel.messages.filter((m) => m.t === 'log').length;
    for (let i = 0; i < 400; i++) g2.send({ t: 'delivered', nickname: `n${i}`, gift: 'x' });
    await wait(400);
    const logs = panel.messages.filter((m) => m.t === 'log').length - before;
    expect(logs).toBeLessThanOrEqual(160);
    for (const p of [panel, g1, g2]) p.ws.close();
    await wait(100);
  });

  it('conexões sem identificação dão lugar ao painel quando o servidor lota', async () => {
    const idle: Peer[] = [];
    for (let i = 0; i < 5; i++) idle.push(await connect(FRONT, r.base));
    // lotado só com conexões que não mandaram hello: o painel ainda entra
    const panel = await connect(FRONT, r.base);
    panel.send({ t: 'hello', role: 'panel', token: TOKEN });
    expect((await panel.next((m) => m.t === 'welcome')).t).toBe('welcome');
    expect(await idle[0].closed).toBe(1006);
    for (const p of [...idle, panel]) p.ws.close();
    await wait(100);
  });

  it('errar a senha do painel não bloqueia a entrada de eventos da live', async () => {
    for (let i = 0; i < 9; i++) {
      const p = await connect(FRONT, r.base);
      p.send({ t: 'hello', role: 'panel', token: `errada-${i}-xxxxxxxxxxxx` });
      await p.closed;
    }
    const p = await connect(FRONT, r.base);
    p.send({ t: 'hello', role: 'panel', token: TOKEN });
    expect(await p.next((m) => m.t === 'denied')).toEqual({ t: 'denied', reason: 'bloqueado' });
    const ev = await fetch(`http://${r.base}/api/evento`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${EVENTOS}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'gift', userId: 'u-bloq', nickname: 'Ana', giftName: 'Rosa' }),
    });
    expect(ev.status).toBe(200);
    // e a tela do jogo continua conectando
    const g = await connect(FRONT, r.base);
    g.send({ t: 'hello', role: 'game', token: key });
    expect((await g.next((m) => m.t === 'welcome')).t).toBe('welcome');
    g.ws.close();
  });
});

describe('modo local (sem senha, no próprio computador)', () => {
  let r: Running;
  beforeAll(async () => {
    r = await startServer({}, false);
  });
  afterAll(async () => {
    await stopServer(r);
  });

  /** GET com um cabeçalho Host escolhido (como faria um site com DNS rebinding). */
  const getWithHost = (path: string, host: string) =>
    new Promise<number>((resolve, reject) => {
      const [hostname, port] = r.base.split(':');
      const req = httpRequest({ hostname, port: Number(port), path, headers: { Host: host, Origin: `http://${host}` } }, (res) => {
        res.resume();
        resolve(res.statusCode ?? 0);
      });
      req.on('error', reject);
      req.end();
    });

  it('o painel e a tela continuam entrando sem senha nem chave', async () => {
    const panel = await connect(`http://${r.base}`, r.base);
    panel.send({ t: 'hello', role: 'panel' });
    expect(await panel.next((m) => m.t === 'welcome')).toEqual({ t: 'welcome', role: 'panel', requiresToken: false });
    const game = await connect(`http://${r.base}`, r.base);
    game.send({ t: 'hello', role: 'game' });
    expect((await game.next((m) => m.t === 'welcome')).t).toBe('welcome');
    panel.ws.close();
    game.ws.close();
  });

  it('recusa um nome de fora que aponta para este computador (DNS rebinding)', async () => {
    const port = r.base.split(':')[1];
    expect(await getWithHost('/api/estado', `127.0.0.1:${port}`)).toBe(200);
    expect(await getWithHost('/api/estado', `localhost:${port}`)).toBe(200);
    expect(await getWithHost('/api/estado', `evil.example:${port}`)).toBe(403);
    await expect(connect(`http://evil.example:${port}`, r.base, { Host: `evil.example:${port}` })).rejects.toThrow(/403/);
    // um proxy reverso na frente (Host da internet) também não passa sem senha
    expect(await getWithHost('/api/saude', 'api.meusite.com.br')).toBe(403);
  });
});
