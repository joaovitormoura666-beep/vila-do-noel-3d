import { lookup as dnsLookup, type LookupAddress, type LookupOptions } from 'node:dns';
import { request, type RequestOptions } from 'node:https';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { isIP } from 'node:net';
import { isPrivateIp } from './security.js';

export { simulatedAvatarSvg } from '../shared/simAvatar.js';

/** Só fotos comuns. SVG fica de fora de propósito (pode conter código). */
const ALLOWED_TYPES = /^image\/(jpeg|png|webp|gif|avif)(;|$)/i;
const MAX_REDIRECTS = 3;

export interface AvatarProxyOptions {
  /** Hosts aceitos (o próprio host ou qualquer subdomínio dele). '*' = qualquer site público. */
  hosts: string[] | '*';
  maxBytes: number;
  timeoutMs: number;
  /** Downloads ao mesmo tempo, no total. Acima disso responde "ocupado". */
  maxConcurrent: number;
  /** Downloads ao mesmo tempo vindos de um mesmo endereço. */
  maxConcurrentPerIp: number;
}

let running = 0;
const runningPerIp = new Map<string, number>();

/* ---------- fotos já baixadas (memória) ---------- */

/** A mesma pessoa aparece várias vezes na live: a foto baixada fica guardada por alguns minutos. */
const CACHE_TTL_MS = 10 * 60_000;
const CACHE_MAX_ITEMS = 400;
const CACHE_MAX_BYTES = 40 * 1024 * 1024;
const cache = new Map<string, { type: string; body: Buffer; at: number }>();
let cacheBytes = 0;

function cacheGet(key: string) {
  const hit = cache.get(key);
  if (!hit) return null;
  cache.delete(key);
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cacheBytes -= hit.body.length;
    return null;
  }
  cache.set(key, hit); // vai para o fim (mais recente)
  return hit;
}

function cachePut(key: string, type: string, body: Buffer) {
  const old = cache.get(key);
  if (old) {
    cache.delete(key);
    cacheBytes -= old.body.length;
  }
  cache.set(key, { type, body, at: Date.now() });
  cacheBytes += body.length;
  while (cache.size > CACHE_MAX_ITEMS || cacheBytes > CACHE_MAX_BYTES) {
    const first = cache.keys().next().value;
    if (first === undefined) break;
    cacheBytes -= cache.get(first)?.body.length ?? 0;
    cache.delete(first);
  }
}

/* ---------- conferência do endereço ---------- */

export function hostAllowed(hostname: string, hosts: string[] | '*'): boolean {
  const h = hostname.toLowerCase().replace(/\.$/, '');
  if (hosts === '*') return true;
  return hosts.some((allowed) => h === allowed || h.endsWith(`.${allowed}`));
}

/**
 * Confere um endereço antes de baixar: https, porta padrão, host permitido e fora da rede interna.
 * O IP de um nome (ex.: p16.tiktokcdn.com) é conferido na hora de conectar (veja safeLookup),
 * para um nome que muda de IP entre a conferência e a conexão não escapar.
 */
export function checkAvatarUrl(raw: string, hosts: string[] | '*'): URL {
  const url = new URL(raw);
  if (url.protocol !== 'https:') throw new Error('só https');
  if (url.username || url.password) throw new Error('endereço com usuário');
  if (url.port && url.port !== '443') throw new Error('porta não permitida');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.localhost')) {
    throw new Error('host interno');
  }
  if (isIP(host)) {
    if (hosts !== '*' || isPrivateIp(host)) throw new Error('ip não permitido');
  } else if (!hostAllowed(host, hosts)) {
    throw new Error('host não permitido');
  }
  return url;
}

type LookupCallback = (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void;

/**
 * Consulta de DNS usada na própria conexão: se o nome apontar para a rede interna
 * (ex.: um domínio que resolve para 127.0.0.1 ou 169.254.169.254), a conexão nem é aberta.
 */
export function safeLookup(hostname: string, options: LookupOptions, callback: LookupCallback) {
  dnsLookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, '');
    const list = (Array.isArray(addresses) ? addresses : []) as LookupAddress[];
    if (!list.length || list.some((a) => isPrivateIp(a.address))) {
      const e: NodeJS.ErrnoException = new Error('host aponta para rede interna');
      e.code = 'EPRIVATE';
      return callback(e, '');
    }
    if (options.all) return callback(null, list);
    return callback(null, list[0].address, list[0].family);
  });
}

/** Um pedido GET com tempo limite total, sem seguir redirecionamentos sozinho. */
function get(url: URL, signal: AbortSignal): Promise<IncomingMessage> {
  return new Promise((resolvePromise, reject) => {
    const opts: RequestOptions = {
      method: 'GET',
      headers: { Accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif;q=0.9', 'User-Agent': 'vila-do-noel-avatar/1.0' },
      lookup: safeLookup as RequestOptions['lookup'],
      signal,
      maxHeaderSize: 16 * 1024,
    };
    const req = request(url, opts, resolvePromise);
    req.on('error', reject);
    req.end();
  });
}

/** Lê a imagem aos poucos e desiste assim que passar do limite (não confia no content-length). */
function readLimited(res: IncomingMessage, maxBytes: number): Promise<Buffer> {
  return new Promise((resolvePromise, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    res.on('data', (c: Buffer) => {
      size += c.length;
      if (size > maxBytes) {
        res.destroy();
        reject(new Error('imagem grande demais'));
        return;
      }
      chunks.push(c);
    });
    res.on('end', () => resolvePromise(Buffer.concat(chunks)));
    res.on('error', reject);
    res.on('close', () => {
      if (!res.complete) reject(new Error('interrompido'));
    });
  });
}

/**
 * Repassa uma foto de perfil externa pelo servidor.
 * Necessário porque o navegador bloqueia (CORS) o uso de imagens de outros
 * domínios dentro do WebGL. Para não virar um "proxy aberto" na internet:
 * só https, só hosts permitidos, só imagens, tamanho e tempo limitados,
 * redirecionamentos conferidos um a um, IP conferido na hora da conexão e
 * poucos downloads ao mesmo tempo (no total e por endereço).
 */
export async function proxyAvatar(res: ServerResponse, rawUrl: string | null, ip: string, opts: AvatarProxyOptions) {
  if (!rawUrl || rawUrl.length > 2000) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('avatar indisponível');
    return;
  }
  const cached = cacheGet(rawUrl);
  if (cached) {
    res.writeHead(200, { 'Content-Type': cached.type, 'Cache-Control': 'public, max-age=3600' });
    res.end(cached.body);
    return;
  }
  const mine = runningPerIp.get(ip) ?? 0;
  if (running >= opts.maxConcurrent || mine >= opts.maxConcurrentPerIp) {
    res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8', 'Retry-After': '2' });
    res.end('ocupado');
    return;
  }
  running++;
  runningPerIp.set(ip, mine + 1);
  const ctrl = new AbortController();
  // limite de tempo para o download inteiro (conexão + cabeçalhos + imagem)
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs);
  // se a tela do jogo desistir da imagem (ex.: recarregou), cancela o download
  res.on('close', () => {
    if (!res.writableEnded) ctrl.abort();
  });
  try {
    let url = checkAvatarUrl(rawUrl, opts.hosts);
    let upstream: IncomingMessage | null = null;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      upstream = await get(url, ctrl.signal);
      const status = upstream.statusCode ?? 0;
      if (status >= 300 && status < 400) {
        const next = upstream.headers.location;
        upstream.resume();
        upstream.destroy();
        if (!next || hop === MAX_REDIRECTS) throw new Error('redirecionamentos demais');
        url = checkAvatarUrl(new URL(next, url).href, opts.hosts);
        upstream = null;
        continue;
      }
      break;
    }
    if (!upstream) throw new Error('sem resposta');
    const type = String(upstream.headers['content-type'] ?? '');
    const status = upstream.statusCode ?? 0;
    if (status < 200 || status >= 300 || !ALLOWED_TYPES.test(type)) {
      upstream.destroy();
      throw new Error('resposta inválida');
    }
    if (Number(upstream.headers['content-length'] ?? 0) > opts.maxBytes) {
      upstream.destroy();
      throw new Error('imagem grande demais');
    }
    const body = await readLimited(upstream, opts.maxBytes);
    const cleanType = type.split(';')[0].trim().toLowerCase();
    cachePut(rawUrl, cleanType, body);
    res.writeHead(200, { 'Content-Type': cleanType, 'Cache-Control': 'public, max-age=3600' });
    res.end(body);
  } catch {
    ctrl.abort();
    if (!res.headersSent) res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('avatar indisponível');
  } finally {
    clearTimeout(timer);
    running--;
    const n = (runningPerIp.get(ip) ?? 1) - 1;
    if (n <= 0) runningPerIp.delete(ip);
    else runningPerIp.set(ip, n);
  }
}
