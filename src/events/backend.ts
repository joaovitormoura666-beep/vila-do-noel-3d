/**
 * Onde está o back-end (servidor Node com o WebSocket e as rotas /api).
 *
 * - No computador (npm start / iniciar.bat) o servidor serve as próprias páginas: o
 *   back-end é a mesma origem da página e nada precisa ser configurado.
 * - Com o front na Cloudflare e o back-end numa VM, o endereço vem do arquivo
 *   `config.json` publicado junto com as páginas: { "backend": "https://api.seu-dominio.com.br" }.
 *   Ele é lido ao abrir a página, então trocar o servidor não exige compilar de novo.
 * - Para testes, `?servidor=https://outro-endereco` no fim do endereço vale mais que o config.json.
 *
 * Toda página do front (tela do jogo 2D, futura tela 3D, painel) deve chegar ao servidor
 * só por aqui: `loadBackend()`, `apiUrl()` e `avatarSrc()`. Nada de "/api" ou location.host fixos.
 */

export interface BackendInfo {
  /** Endereço base do back-end, sem barra no fim (ex.: https://api.site.com). '' = mesma origem da página. */
  base: string;
  /** Endereço do WebSocket (wss:// quando o back-end é https). */
  ws: string;
  /** De onde veio o endereço: do link (?servidor=), do config.json ou da própria página. */
  from: 'link' | 'config' | 'pagina';
  /** Algo que a pessoa precisa corrigir (texto para mostrar no painel). */
  problem?: string;
  /**
   * O config.json está com erro de digitação: não adianta tentar conectar (a página só
   * conectaria nela mesma, na Cloudflare). A conexão espera o arquivo ser corrigido.
   */
  fatal?: boolean;
}

/** O pedaço de `location` que a resolução usa (permite testar sem navegador). */
export interface PageLocation {
  protocol: string;
  host: string;
  origin: string;
  search: string;
}

const PLACEHOLDER = /seu-dominio/i;

/**
 * Decide o endereço do back-end a partir do conteúdo do config.json (ou null quando não
 * existe) e do endereço da página. Função pura: não faz nenhuma requisição.
 */
export function resolveBackend(configJson: unknown, page: PageLocation): BackendInfo {
  const samePage = (problem?: string): BackendInfo => ({
    base: '',
    ws: `${page.protocol === 'https:' ? 'wss' : 'ws'}://${page.host}/ws`,
    from: 'pagina',
    ...(problem ? { problem } : {}),
  });

  let raw = '';
  let from: BackendInfo['from'] = 'pagina';
  const fromLink = new URLSearchParams(page.search).get('servidor')?.trim();
  if (fromLink) {
    raw = fromLink;
    from = 'link';
  } else if (configJson && typeof configJson === 'object') {
    const value = (configJson as Record<string, unknown>).backend;
    if (typeof value === 'string' && value.trim()) {
      raw = value.trim();
      from = 'config';
    }
  }
  if (!raw) return samePage();

  const where = from === 'link' ? 'no endereço (?servidor=)' : 'no config.json';
  // quem escreve só "api.site.com" quer dizer https://api.site.com
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `${page.protocol === 'http:' ? 'http' : 'https'}://${raw}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return samePage(`O endereço do servidor ${where} não é válido: "${raw}". Use algo como https://api.seu-dominio.com.br`);
  }
  if (!/^([a-z0-9-]+\.)*[a-z0-9-]+$|^\[[0-9a-f:.]+\]$/i.test(url.hostname)) {
    return samePage(`O endereço do servidor ${where} não é válido: "${raw}". Use algo como https://api.seu-dominio.com.br`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return samePage(`O endereço do servidor ${where} precisa começar com https:// (está "${raw}").`);
  }

  // aceita quem colou o endereço com /ws ou /api no fim
  const path = url.pathname.replace(/\/+$/, '').replace(/\/(ws|api)$/i, '');
  const base = `${url.origin}${path}`;
  if (url.origin === page.origin && path === '') return { ...samePage(), from };

  const info: BackendInfo = { base, ws: `${url.protocol === 'https:' ? 'wss' : 'ws'}://${url.host}${path}/ws`, from };
  const loopback = /^(localhost|127\.\d+\.\d+\.\d+|\[::1\])$/i.test(url.hostname);
  if (PLACEHOLDER.test(url.hostname)) {
    info.problem = `O ${where === 'no config.json' ? 'config.json' : 'endereço'} ainda está com o servidor de exemplo (${url.host}). Troque pelo endereço do seu back-end.`;
  } else if (page.protocol === 'https:' && url.protocol === 'http:' && !loopback) {
    info.problem = `Esta página está em https, então o servidor também precisa estar em https (o endereço ${where} é ${base}). Ative o HTTPS na VM (Caddy) e use https://.`;
  }
  return info;
}

/**
 * Chave da tela do jogo, tirada do endereço da página: `?tela=CHAVE` ou `#tela=CHAVE`.
 * O painel mostra o endereço do OBS já com ela. Função pura (recebe location.search e location.hash).
 */
export function screenKeyFrom(search: string, hash: string): string | null {
  const fromQuery = new URLSearchParams(search).get('tela')?.trim();
  if (fromQuery) return fromQuery;
  const fromHash = new URLSearchParams(hash.replace(/^#/, '')).get('tela')?.trim();
  return fromHash || null;
}

/** Endereço completo de uma rota do back-end (ex.: apiUrl(info, '/api/saude')). */
export function apiUrl(info: BackendInfo, path: string): string {
  return `${info.base}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * Endereço para carregar uma foto de perfil:
 * - fotos de outros sites passam pelo proxy do back-end (o WebGL exige CORS);
 * - fotos fictícias do simulador ("/api/avatar-sim/...") vêm do back-end;
 * - data: e blob: ficam como estão.
 */
export function avatarSrc(info: BackendInfo, url: string): string {
  if (/^https?:\/\//i.test(url)) return apiUrl(info, `/api/avatar?url=${encodeURIComponent(url)}`);
  if (url.startsWith('/api/')) return apiUrl(info, url);
  return url;
}

/* ---------- uso no navegador ---------- */

let current: BackendInfo | null = null;
let pending: Promise<BackendInfo> | null = null;

function pageLocation(): PageLocation {
  return { protocol: location.protocol, host: location.host, origin: location.origin, search: location.search };
}

/**
 * Lê o config.json (sem cache do navegador) e guarda o resultado. Se a leitura falhar por
 * falta de rede (ex.: o OBS abriu antes da internet), a próxima tentativa de conexão lê de novo.
 */
export function loadBackend(): Promise<BackendInfo> {
  pending ??= (async () => {
    let json: unknown = null;
    let answered = false;
    let broken = false;
    try {
      const ctrl = new AbortController();
      const timer = window.setTimeout(() => ctrl.abort(), 4000);
      const res = await fetch(new URL('config.json', document.baseURI), { cache: 'no-store', signal: ctrl.signal });
      window.clearTimeout(timer);
      answered = true;
      // sem config.json (modo local) a resposta é 404; no Vite pode vir uma página HTML
      if (res.ok && (res.headers.get('content-type') ?? '').includes('json')) {
        const text = await res.text();
        try {
          json = JSON.parse(text);
        } catch {
          broken = true;
        }
      }
    } catch {
      /* sem resposta: usa a própria página por enquanto */
    }
    const info = resolveBackend(json, pageLocation());
    if (broken) {
      info.problem =
        'O config.json tem um erro de digitação e não pôde ser lido. Confira as aspas e as vírgulas (o modelo é { "backend": "https://api.seu-dominio.com.br" }), envie de novo para a Cloudflare e recarregue esta página.';
      info.fatal = true;
    }
    if (info.problem) console.warn(`[servidor] ${info.problem}`);
    // sem resposta ou com o arquivo quebrado: a próxima tentativa lê o config.json de novo
    if (!answered || broken) pending = null;
    current = info;
    return info;
  })();
  return pending;
}

/** Endereço já resolvido (antes de loadBackend terminar, a própria página). */
export function backendNow(): BackendInfo {
  return current ?? resolveBackend(null, pageLocation());
}

export interface HealthCheck {
  /** O servidor respondeu. */
  online: boolean;
  /** O servidor aceita esta página (null = não soube dizer). */
  originAllowed: boolean | null;
  version?: string;
}

/** Pergunta ao back-end se ele está no ar e se aceita esta página (usado para explicar falhas). */
export async function checkHealth(info: BackendInfo): Promise<HealthCheck> {
  try {
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(apiUrl(info, '/api/saude'), { cache: 'no-store', signal: ctrl.signal });
    window.clearTimeout(timer);
    if (!res.ok) return { online: false, originAllowed: null };
    const body = (await res.json()) as { origemPermitida?: unknown; versao?: unknown };
    return {
      online: true,
      originAllowed: typeof body.origemPermitida === 'boolean' ? body.origemPermitida : null,
      version: typeof body.versao === 'string' ? body.versao : undefined,
    };
  } catch {
    return { online: false, originAllowed: null };
  }
}
