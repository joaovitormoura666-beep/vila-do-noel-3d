import { createHmac } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, isAbsolute, resolve } from 'node:path';
import { isLoopbackHost, parseOriginList, weakSecret } from './security.js';

/*
 * Configuração do servidor, toda vinda de variáveis de ambiente (ou do arquivo .env).
 * Sem nada configurado, o servidor roda como sempre rodou: no próprio computador
 * (127.0.0.1:3000), servindo a tela do jogo e o painel, sem senha.
 * Os nomes e o significado de cada variável estão em deploy/backend/.env.example.
 */

// Definidos pelo empacotador (deploy/empacotar-backend.mjs) no servidor de um arquivo só.
declare const __VILA_PACOTE__: boolean | undefined;
declare const __VILA_VERSAO__: string | undefined;

const here = dirname(fileURLToPath(import.meta.url));

/** true quando roda o servidor empacotado (pacotes/backend), pensado para a VM. */
export const EMPACOTADO = typeof __VILA_PACOTE__ !== 'undefined' && __VILA_PACOTE__ === true;

/** Pasta base: a raiz do projeto (rodando com tsx) ou a pasta do servidor empacotado. */
export const ROOT = EMPACOTADO ? here : resolve(here, '..');

/** Hosts de fotos de perfil aceitos pelo proxy de avatar quando o servidor está na internet. */
export const DEFAULT_AVATAR_HOSTS = ['tiktokcdn.com', 'tiktokcdn-us.com', 'tiktokcdn-eu.com', 'ibyteimg.com', 'byteimg.com', 'muscdn.com'];

export interface ServerLimits {
  /** Tamanho máximo de uma mensagem do WebSocket (bytes). */
  wsMaxBytes: number;
  /** Tamanho máximo do corpo de uma requisição HTTP (bytes). */
  httpMaxBytes: number;
  /** Conexões WebSocket abertas ao mesmo tempo, no total e por endereço. */
  maxConnections: number;
  maxConnectionsPerIp: number;
  /** Telas do jogo conectadas ao mesmo tempo. */
  maxScreens: number;
  /** Mensagens por segundo por conexão (com uma folga de `msgBurst`). */
  msgsPerSec: number;
  msgBurst: number;
  /** Foto de perfil: tamanho máximo, tempo máximo e downloads simultâneos. */
  avatarMaxBytes: number;
  avatarTimeoutMs: number;
  avatarConcurrent: number;
  /** Downloads de foto ao mesmo tempo vindos de um mesmo endereço. */
  avatarConcurrentPerIp: number;
}

export interface ServerConfig {
  port: number;
  host: string;
  /**
   * Servidor exposto (VM / internet): HOST fora do computador, alguma origem de fora
   * em ORIGENS_PERMITIDAS ou o servidor empacotado. Nesse caso a senha é obrigatória.
   */
  exposed: boolean;
  allowedOrigins: string[];
  /** Senha do painel (TOKEN_ADMIN). null = sem senha (só no modo local). */
  adminToken: string | null;
  /** Senha extra só para POST /api/evento (TOKEN_EVENTOS), opcional. */
  eventsToken: string | null;
  /**
   * Chave da tela do jogo (OBS). Quando o painel tem senha, a tela também precisa de uma
   * chave, que vai no endereço do OBS (?tela=...). Vem de TOKEN_TELA ou, se ele não estiver
   * definido, é calculada a partir do TOKEN_ADMIN (sempre a mesma enquanto a senha não mudar).
   * O painel mostra o endereço pronto. null = a tela conecta sem chave (modo local).
   */
  screenKey: string | null;
  /** A chave da tela veio do TOKEN_TELA (true) ou foi calculada do TOKEN_ADMIN (false). */
  screenKeyFromEnv: boolean;
  dataDir: string;
  settingsFile: string;
  serveFront: boolean;
  frontDir: string;
  /** Hosts aceitos pelo proxy de fotos ('*' = qualquer site público). */
  avatarHosts: string[] | '*';
  /** Endereços de proxy reverso em quem se confia para X-Forwarded-For ('loopback' = 127.0.0.1 e ::1). */
  trustedProxies: string[];
  limits: ServerLimits;
  version: string;
  /** Abrir o painel no navegador ao iniciar (usado pelo iniciar.bat). */
  openBrowser: boolean;
}

export interface ConfigResult {
  config: ServerConfig;
  /** Problemas que impedem o servidor de subir. */
  errors: string[];
  /** Avisos: o servidor sobe, mas algo provavelmente está errado. */
  warnings: string[];
}

const TRUE = /^(1|true|sim|s|yes|y|on|ligado)$/i;
const FALSE = /^(0|false|nao|não|n|no|off|desligado)$/i;

function bool(v: string | undefined, fallback: boolean): boolean {
  if (v === undefined || v.trim() === '') return fallback;
  if (TRUE.test(v.trim())) return true;
  if (FALSE.test(v.trim())) return false;
  return fallback;
}

function int(v: string | undefined, fallback: number, min: number, max: number): number {
  const n = Number(v);
  if (v === undefined || v.trim() === '' || !Number.isFinite(n)) return fallback;
  return Math.round(Math.min(max, Math.max(min, n)));
}

function readVersion(root: string): string {
  if (typeof __VILA_VERSAO__ !== 'undefined' && __VILA_VERSAO__) return __VILA_VERSAO__;
  try {
    const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as { version?: unknown };
    return typeof pkg.version === 'string' ? pkg.version : '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/** Monta a configuração a partir das variáveis de ambiente. Não tem efeitos colaterais. */
export function readConfig(env: NodeJS.ProcessEnv = process.env, root = ROOT, packaged = EMPACOTADO): ConfigResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const host = (env.HOST ?? '').trim() || '127.0.0.1';
  const portRaw = (env.PORT ?? '').trim();
  const port = portRaw === '' ? 3000 : Number(portRaw);
  if (!Number.isInteger(port) || port < 0 || port > 65535) errors.push(`PORT="${portRaw}" não é uma porta válida (use um número entre 1 e 65535, ex.: 3000).`);

  const { origins, invalid } = parseOriginList(env.ORIGENS_PERMITIDAS);
  if (invalid.length) {
    errors.push(
      `ORIGENS_PERMITIDAS tem endereços que não entendi: ${invalid.join(', ')}. ` +
        'Escreva cada um completo, com https:// e sem caminho no fim (ex.: https://vila-do-noel.pages.dev), separados por vírgula.',
    );
  }
  const publicOrigin = origins.some((o) => !isLoopbackHost(o.replace(/^https?:\/\/(\*\.)?/, '').replace(/:\d+$/, '').replace(/^\[|\]$/g, '')));
  const exposed = packaged || !isLoopbackHost(host) || publicOrigin;

  const adminToken = (env.TOKEN_ADMIN ?? '').trim() || null;
  const eventsToken = (env.TOKEN_EVENTOS ?? '').trim() || null;
  if (exposed && !adminToken) {
    errors.push(
      'TOKEN_ADMIN não está definido. Com o servidor acessível pela internet, o painel precisa de uma senha, ' +
        'senão qualquer pessoa poderia mudar as configurações e mandar eventos falsos. ' +
        'Crie uma senha longa (ex.: rode "openssl rand -hex 24" na VM) e coloque no arquivo .env como TOKEN_ADMIN=...',
    );
  }
  const screenRaw = (env.TOKEN_TELA ?? '').trim() || null;
  if (exposed) {
    for (const [name, value] of [['TOKEN_ADMIN', adminToken], ['TOKEN_EVENTOS', eventsToken], ['TOKEN_TELA', screenRaw]] as const) {
      if (!value) continue;
      const weak = weakSecret(value);
      if (/troque|exemplo|changeme/i.test(value)) {
        errors.push(`${name} ainda está com o valor de exemplo do .env.example. Troque por uma senha só sua (ex.: gerada com "openssl rand -hex 24").`);
      } else if (weak) errors.push(`${name} ${weak}. Gere uma senha aleatória com "openssl rand -hex 24" e cole no .env.`);
    }
  }
  if (adminToken && screenRaw && screenRaw === adminToken) {
    errors.push('TOKEN_TELA não pode ser igual ao TOKEN_ADMIN: a chave da tela vai no endereço do OBS e não deve abrir o painel.');
  }
  // a chave da tela só existe quando o painel tem senha (no modo local de sempre, nenhuma das duas)
  const screenKey = adminToken ? (screenRaw ?? createHmac('sha256', adminToken).update('vila-do-noel/chave-da-tela').digest('hex').slice(0, 32)) : null;

  const dataRaw = (env.DATA_DIR ?? '').trim();
  const dataDir = dataRaw ? (isAbsolute(dataRaw) ? dataRaw : resolve(root, dataRaw)) : resolve(root, 'data');
  const frontRaw = (env.PASTA_FRONT ?? '').trim();
  const frontDir = frontRaw ? (isAbsolute(frontRaw) ? frontRaw : resolve(root, frontRaw)) : resolve(root, 'dist');
  // No computador o servidor continua servindo o jogo e o painel; na VM o front fica na Cloudflare.
  const serveFront = bool(env.SERVIR_FRONT, !exposed);
  if (serveFront && exposed && !existsSync(frontDir)) warnings.push(`SERVIR_FRONT está ligado, mas a pasta ${frontRaw || 'dist'} não existe.`);
  if (exposed && origins.length === 0 && !serveFront) {
    warnings.push(
      'ORIGENS_PERMITIDAS está vazio: nenhuma página de fora (ex.: a Cloudflare) vai conseguir se conectar. ' +
        'Coloque o endereço do front, ex.: ORIGENS_PERMITIDAS=https://vila-do-noel.pages.dev',
    );
  }

  const hostsRaw = (env.AVATAR_HOSTS_PERMITIDOS ?? '').trim();
  const avatarHosts: string[] | '*' =
    hostsRaw === '*'
      ? '*'
      : hostsRaw
        ? hostsRaw.split(/[\s,;]+/).map((h) => h.trim().toLowerCase().replace(/^\*?\./, '')).filter(Boolean)
        : exposed
          ? DEFAULT_AVATAR_HOSTS
          : '*'; // no computador, como sempre foi: qualquer site público com https

  const proxiesRaw = (env.PROXY_CONFIAVEL ?? '').trim();
  const trustedProxies = proxiesRaw ? proxiesRaw.split(/[\s,;]+/).filter(Boolean) : ['loopback'];

  const limits: ServerLimits = {
    wsMaxBytes: int(env.LIMITE_MENSAGEM_WS, 32 * 1024, 1024, 1024 * 1024),
    httpMaxBytes: int(env.LIMITE_CORPO_HTTP, 16 * 1024, 1024, 1024 * 1024),
    maxConnections: int(env.MAX_CONEXOES, 50, 2, 10_000),
    maxConnectionsPerIp: int(env.MAX_CONEXOES_POR_IP, 12, 1, 10_000),
    maxScreens: int(env.MAX_TELAS, 4, 1, 100),
    msgsPerSec: int(env.MENSAGENS_POR_SEGUNDO, 20, 1, 1000),
    msgBurst: int(env.MENSAGENS_RAJADA, 60, 1, 10_000),
    avatarMaxBytes: int(env.AVATAR_TAMANHO_MAXIMO, 2_000_000, 10_000, 20_000_000),
    avatarTimeoutMs: int(env.AVATAR_TEMPO_MAXIMO_MS, 6000, 500, 60_000),
    avatarConcurrent: int(env.AVATAR_SIMULTANEOS, 16, 1, 200),
    avatarConcurrentPerIp: int(env.AVATAR_SIMULTANEOS_POR_IP, 4, 1, 200),
  };

  return {
    config: {
      port: Number.isInteger(port) ? port : 3000,
      host,
      exposed,
      allowedOrigins: origins,
      adminToken,
      eventsToken,
      screenKey,
      screenKeyFromEnv: Boolean(adminToken && screenRaw),
      dataDir,
      settingsFile: resolve(dataDir, 'configuracoes.json'),
      serveFront,
      frontDir,
      avatarHosts,
      trustedProxies,
      limits,
      version: readVersion(root),
      openBrowser: env.VILA_ABRIR === '1',
    },
    errors,
    warnings,
  };
}
