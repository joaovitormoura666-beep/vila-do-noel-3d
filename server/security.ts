import { createHash, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { BlockList, isIP } from 'node:net';

/**
 * Peças de segurança do servidor, sem estado global: origens permitidas, comparação
 * da senha do painel, limites de ritmo e o endereço de quem está conectando.
 * Tudo aqui é testável sem subir o servidor (veja tests/seguranca.test.ts).
 */

/** true para endereços que só aceitam conexões do próprio computador. */
export function isLoopbackHost(host: string): boolean {
  const h = host.trim().toLowerCase().replace(/^\[|\]$/g, '');
  return h === 'localhost' || h === '::1' || /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h) || h === '::ffff:127.0.0.1';
}

/** Faixas que o proxy de fotos nunca pode acessar (rede interna, reservadas, documentação, tradução de endereços). */
const BLOCKED_V4: Array<[string, number]> = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10], // CGNAT
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 3], // multicast e reservados (224.0.0.0 até 255.255.255.255)
];
const BLOCKED_V6: Array<[string, number]> = [
  ['::', 96], // inclui :: e ::1 e o antigo "IPv4 compatível" (::a.b.c.d)
  ['::ffff:0:0', 96], // IPv4 dentro de IPv6 (conferido também como IPv4 abaixo)
  ['64:ff9b::', 96], // NAT64
  ['64:ff9b:1::', 48],
  ['100::', 64], // descarte
  ['2001::', 23], // Teredo, ORCHID e outros reservados da IANA
  ['2001:db8::', 32], // documentação
  ['2002::', 16], // 6to4 (embute um IPv4)
  ['fc00::', 7], // rede privada (ULA)
  ['fe80::', 10], // link-local
  ['fec0::', 10], // site-local antigo
  ['ff00::', 8], // multicast
];

// Duas listas separadas: o BlockList do Node confere um IPv4 também contra as faixas IPv6
// "::ffff:..." (ele converte), e a faixa ::ffff:0:0/96 bloquearia todo IPv4.
let lists: { v4: BlockList; v6: BlockList } | null = null;
function privateRanges() {
  if (lists) return lists;
  const v4 = new BlockList();
  const v6 = new BlockList();
  for (const [net, prefix] of BLOCKED_V4) v4.addSubnet(net, prefix, 'ipv4');
  for (const [net, prefix] of BLOCKED_V6) v6.addSubnet(net, prefix, 'ipv6');
  lists = { v4, v6 };
  return lists;
}

/**
 * Se o IPv6 carrega um IPv4 dentro (::ffff:7f00:1, ::127.0.0.1, 64:ff9b::a00:1...), devolve esse IPv4.
 * O analisador de URL escreve [::ffff:127.0.0.1] como [::ffff:7f00:1]; os dois casos são tratados.
 */
function embeddedIpv4(v6: string): string | null {
  const dotted = /^(?:::(?:ffff(?::0)?:)?|64:ff9b::)(\d{1,3}(?:\.\d{1,3}){3})$/.exec(v6);
  if (dotted && isIP(dotted[1]) === 4) return dotted[1];
  const hex = /^(?:::(?:ffff(?::0)?:)?|64:ff9b::)([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(v6);
  if (!hex) return null;
  const hi = parseInt(hex[1], 16);
  const lo = parseInt(hex[2], 16);
  return `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;
}

/** Endereço IP de rede interna ou reservado (não pode ser alvo do proxy de fotos). */
export function isPrivateIp(ip: string): boolean {
  const a = ip.trim().toLowerCase().replace(/^\[|\]$/g, '').replace(/%.*$/, '');
  const kind = isIP(a);
  if (kind === 0) return true; // não é um IP válido: trata como proibido
  const { v4: list4, v6: list6 } = privateRanges();
  if (kind === 4) return list4.check(a, 'ipv4');
  const v4 = embeddedIpv4(a);
  if (v4 && list4.check(v4, 'ipv4')) return true;
  return list6.check(a, 'ipv6');
}

/**
 * Chave usada nos limites por endereço. No IPv6 cada casa ou servidor recebe um bloco
 * inteiro (/64) de endereços; contar cada um separado deixaria um só visitante parecer milhares.
 */
export function ipKey(ip: string): string {
  const a = ip.trim().toLowerCase().replace(/^::ffff:/, '');
  if (isIP(a) !== 6) return a;
  const [head, tail = ''] = a.split('::');
  const left = head ? head.split(':') : [];
  const right = tail ? tail.split(':') : [];
  const groups = a.includes('::') ? [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill('0'), ...right] : left;
  return `${groups
    .slice(0, 4)
    .map((g) => (parseInt(g, 16) || 0).toString(16))
    .join(':')}::/64`;
}

/* ---------- origens ---------- */

const DEFAULT_PORT: Record<string, string> = { 'http:': '80', 'https:': '443' };

/**
 * Deixa uma origem no formato `https://site.com` ou `http://localhost:5173`
 * (minúsculas, sem barra no fim, sem a porta padrão). Aceita o curinga `https://*.site.com`.
 * Devolve null quando não é uma origem válida.
 */
export function normalizeOrigin(raw: string): string | null {
  const s = raw.trim().toLowerCase().replace(/\/+$/, '');
  if (!s || s === 'null') return null;
  const m = /^(https?):\/\/(\*\.)?([a-z0-9.-]+|\[[0-9a-f:.]+\])(?::(\d{1,5}))?$/.exec(s);
  if (!m) return null;
  const [, scheme, wildcard = '', host, port] = m;
  if (host.startsWith('.') || host.endsWith('.') || host.includes('..')) return null;
  const portPart = port && port !== DEFAULT_PORT[`${scheme}:`] ? `:${port}` : '';
  return `${scheme}://${wildcard}${host}${portPart}`;
}

/** Lê a lista ORIGENS_PERMITIDAS (separada por vírgula, espaço ou quebra de linha). */
export function parseOriginList(raw: string | undefined): { origins: string[]; invalid: string[] } {
  const origins: string[] = [];
  const invalid: string[] = [];
  for (const item of String(raw ?? '').split(/[\s,;]+/)) {
    if (!item) continue;
    const o = normalizeOrigin(item);
    if (o) {
      if (!origins.includes(o)) origins.push(o);
    } else invalid.push(item);
  }
  return { origins, invalid };
}

/** Confere uma origem (já normalizada) contra um item da lista, que pode ter o curinga `*.`. */
export function originMatches(origin: string, pattern: string): boolean {
  if (!pattern.includes('://*.')) return origin === pattern;
  const [scheme, rest] = pattern.split('://*.');
  const [suffixHost, suffixPort = ''] = splitHostPort(rest);
  if (!origin.startsWith(`${scheme}://`)) return false;
  const [host, port = ''] = splitHostPort(origin.slice(scheme.length + 3));
  return port === suffixPort && host.endsWith(`.${suffixHost}`) && host.length > suffixHost.length + 1;
}

function splitHostPort(hostPort: string): [string, string?] {
  const m = /^(\[[^\]]+\]|[^:]+)(?::(\d+))?$/.exec(hostPort);
  return m ? [m[1], m[2]] : [hostPort];
}

/** Tira a porta padrão do cabeçalho Host (`site.com:443` vira `site.com`). */
function normalizeHostHeader(host: string): string {
  return host.trim().toLowerCase().replace(/:(80|443)$/, '');
}

/**
 * O cabeçalho Host aponta para o próprio computador (localhost, 127.x ou [::1], com qualquer porta)?
 * No modo local só esses nomes são aceitos: assim um site que use "DNS rebinding" (um nome
 * dele que passa a apontar para 127.0.0.1) ou um proxy reverso esquecido na frente do
 * servidor não conseguem falar com o painel sem senha.
 */
export function isLoopbackHostHeader(hostHeader: string | undefined): boolean {
  if (!hostHeader) return false;
  const [host] = splitHostPort(hostHeader.trim().toLowerCase());
  return isLoopbackHost(host.replace(/\.$/, ''));
}

export type OriginCheck =
  /** Nenhum cabeçalho Origin (ferramentas de linha de comando, integrações). */
  | 'ausente'
  /** A página é servida pelo próprio servidor (modo local). */
  | 'mesma'
  /** Está na lista ORIGENS_PERMITIDAS (ou é do próprio computador, no modo local). */
  | 'permitida'
  | 'recusada';

export interface OriginPolicy {
  allowed: string[];
  /** Modo local: aceita também páginas do próprio computador (ex.: o Vite em localhost:5173). */
  local: boolean;
  /**
   * Aceitar a página servida pelo próprio servidor (Origin igual ao Host)? Vale no modo local
   * (onde o Host já é conferido) e quando o servidor também serve as páginas (SERVIR_FRONT=1).
   * Padrão: igual a `local`.
   */
  sameHost?: boolean;
}

/**
 * Classifica o cabeçalho Origin de uma requisição.
 * Navegadores sempre mandam Origin no WebSocket e nas chamadas de outro site, e uma
 * página não consegue falsificá-lo: é isso que impede um site qualquer de comandar o jogo.
 */
export function checkOrigin(origin: string | undefined, hostHeader: string | undefined, policy: OriginPolicy): OriginCheck {
  if (origin === undefined || origin === '') return 'ausente';
  const o = normalizeOrigin(origin);
  if (!o || o.includes('://*.')) return 'recusada';
  const originHost = o.replace(/^https?:\/\//, '');
  const sameHost = policy.sameHost ?? policy.local;
  // no modo local o "mesmo endereço" só vale para o próprio computador (proteção contra DNS rebinding)
  if (sameHost && hostHeader && originHost === normalizeHostHeader(hostHeader) && (!policy.local || isLoopbackHostHeader(hostHeader))) {
    return 'mesma';
  }
  if (policy.local && isLoopbackHost(splitHostPort(originHost)[0])) return 'permitida';
  return policy.allowed.some((p) => originMatches(o, p)) ? 'permitida' : 'recusada';
}

/* ---------- senha do painel ---------- */

/** Compara a senha recebida com a esperada em tempo constante (não revela quantos caracteres acertou). */
export function tokensMatch(given: unknown, expected: string): boolean {
  if (typeof given !== 'string' || given.length === 0 || expected.length === 0) return false;
  const a = createHash('sha256').update(given, 'utf8').digest();
  const b = createHash('sha256').update(expected, 'utf8').digest();
  return timingSafeEqual(a, b);
}

/**
 * Senha enviada numa requisição HTTP. Pelo cabeçalho (`Authorization: Bearer <senha>` ou
 * `X-Token`) vale qualquer senha; no endereço (`?token=`) só a senha dos eventos
 * (TOKEN_EVENTOS), porque endereços acabam em históricos e registros de outras ferramentas.
 */
export function requestToken(req: IncomingMessage, url: URL): { token: string | null; fromQuery: boolean } {
  const auth = req.headers.authorization;
  if (typeof auth === 'string') {
    const m = /^Bearer\s+(.+)$/i.exec(auth.trim());
    if (m) return { token: m[1].trim(), fromQuery: false };
  }
  const header = req.headers['x-token'];
  if (typeof header === 'string' && header) return { token: header.trim(), fromQuery: false };
  const q = url.searchParams.get('token');
  return { token: q, fromQuery: q !== null };
}

/**
 * Senha fraca demais para um servidor na internet: curta, com poucos caracteres
 * diferentes ou só repetição (ex.: "aaaaaaaaaaaaaaaa", "abcdabcdabcdabcd").
 * Devolve o motivo, ou null quando a senha serve.
 */
export function weakSecret(value: string): string | null {
  if (value.length < 16) return `é curto demais (${value.length} caracteres). Use pelo menos 16; o ideal é 32 ou mais`;
  if (new Set(value).size < 8) return 'tem poucos caracteres diferentes (parece repetição)';
  if (/^(.{1,8})\1+$/.test(value)) return 'é só um pedaço repetido várias vezes';
  if (/^(0123456789|abcdefghij|1234567890|qwertyuiop)/i.test(value)) return 'é uma sequência fácil de adivinhar';
  return null;
}

/* ---------- limites ---------- */

/** Balde de fichas: permite `burst` mensagens de uma vez e repõe `perSecond` por segundo. */
export class TokenBucket {
  private tokens: number;
  private last: number;

  constructor(
    private readonly perSecond: number,
    private readonly burst: number,
    now = Date.now(),
  ) {
    this.tokens = burst;
    this.last = now;
  }

  take(now = Date.now()): boolean {
    this.tokens = Math.min(this.burst, this.tokens + ((now - this.last) / 1000) * this.perSecond);
    this.last = now;
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }
}

/** Bloqueia por um tempo quem erra a senha muitas vezes seguidas. */
export class FailureLimiter {
  private entries = new Map<string, { count: number; first: number; blockedUntil: number }>();

  constructor(
    private readonly maxFailures = 8,
    private readonly windowMs = 10 * 60_000,
    private readonly blockMs = 10 * 60_000,
  ) {}

  /** Milissegundos que ainda faltam de bloqueio (0 = liberado). */
  blockedFor(key: string, now = Date.now()): number {
    const e = this.entries.get(key);
    return e && e.blockedUntil > now ? e.blockedUntil - now : 0;
  }

  fail(key: string, now = Date.now()) {
    let e = this.entries.get(key);
    if (!e || now - e.first > this.windowMs) e = { count: 0, first: now, blockedUntil: 0 };
    e.count++;
    if (e.count >= this.maxFailures) e.blockedUntil = now + this.blockMs;
    this.entries.delete(key);
    this.entries.set(key, e);
    if (this.entries.size > 5000) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
  }

  reset(key: string) {
    this.entries.delete(key);
  }
}

/**
 * Endereço de quem fez a requisição. Atrás de um proxy reverso (Caddy) todas as conexões
 * chegam do próprio proxy; nesse caso vale o último endereço de X-Forwarded-For, que é o
 * que o proxy acrescentou (os anteriores podem ter sido inventados pelo visitante).
 */
export function clientIp(req: IncomingMessage, trustedProxies: string[]): string {
  const remote = (req.socket.remoteAddress ?? '').replace(/^::ffff:/, '');
  const trusted = trustedProxies.includes(remote) || (trustedProxies.includes('loopback') && isLoopbackHost(remote));
  const fwd = req.headers['x-forwarded-for'];
  if (trusted && typeof fwd === 'string' && fwd.trim()) {
    const parts = fwd.split(',').map((p) => p.trim()).filter(Boolean);
    const last = parts[parts.length - 1];
    if (last && isIP(last.replace(/^::ffff:/, ''))) return last.replace(/^::ffff:/, '');
  }
  return remote || 'desconhecido';
}

/** Cabeçalhos de segurança enviados em todas as respostas. */
export const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'SAMEORIGIN',
  'Cross-Origin-Resource-Policy': 'cross-origin',
};

/** Política extra para as respostas da API (JSON e imagens): nada de scripts nem molduras. */
export const API_CSP = "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'";
