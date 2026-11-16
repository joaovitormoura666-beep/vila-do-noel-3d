/**
 * Servidor de arquivos estáticos mínimo para a pasta `dist` (as páginas compiladas), usado no modo local
 * (npm start, iniciar.bat) e, na VM, só quando SERVIR_FRONT está ligado.
 *
 * O que ele entrega:
 * - `/` é a tela principal da live (o jogo 3D); `/classico` a versão 2D; `/painel` o painel; `/sala` a sala 3D;
 * - os modelos 3D (.glb), as texturas (.jpg, .webp) e os áudios com o tipo certo (Content-Type);
 * - cache: o código compilado em `/app/` tem um código de versão no nome e fica guardado por um ano; o resto (páginas,
 *   modelos, texturas, áudios) é conferido a cada carga com ETag/Last-Modified e volta "304 Não modificado" quando
 *   não mudou. Assim uma atualização do projeto aparece na hora, sem baixar de novo o que é igual.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';

export const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.ktx2': 'image/ktx2',
  '.hdr': 'image/vnd.radiance',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.bin': 'application/octet-stream',
  '.wasm': 'application/wasm',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

/** Endereços curtos das páginas (o mesmo que a Cloudflare Pages faz sozinha, sem o ".html"). */
const PAGINAS: Record<string, string> = {
  '/': '/index.html',
  '': '/index.html',
  '/painel': '/painel.html',
  '/sala': '/demo-sala.html',
  '/classico': '/classico.html',
  '/jogo3d': '/jogo3d.html',
};

/** Código compilado pelo Vite: o nome muda a cada versão, então pode ficar guardado por um ano. */
const IMUTAVEL = /^\/app\//;

/**
 * Entrega um arquivo de `root` para o endereço `urlPath`. Devolve false quando não há arquivo (quem chamou responde
 * o 404). Com o pedido (o 4º argumento ou o res.req do Node), responde 304 quando o navegador já tem a versão atual.
 */
export function serveStatic(root: string, urlPath: string, res: ServerResponse, pedido?: IncomingMessage): boolean {
  // o ServerResponse do Node guarda o pedido em res.req (quem chama não precisa passar)
  const req: IncomingMessage | undefined = pedido ?? (res as ServerResponse & { req?: IncomingMessage }).req;
  let rel: string;
  try {
    rel = decodeURIComponent(urlPath.split('?')[0]);
  } catch {
    return false; // endereço malformado (ex.: "%E0")
  }
  if (rel.includes('\0')) return false;
  rel = PAGINAS[rel] ?? rel;
  const base = resolve(root);
  const file = normalize(join(base, rel));
  if (file !== base && !file.startsWith(base + sep)) return false;
  if (!existsSync(file)) return false;
  const st = statSync(file);
  if (!st.isFile()) return false;
  const ext = extname(file).toLowerCase();
  const etag = `W/"${st.size.toString(16)}-${Math.floor(st.mtimeMs).toString(16)}"`;
  const modificado = new Date(Math.floor(st.mtimeMs / 1000) * 1000).toUTCString();
  const headers: Record<string, string | number> = {
    'Content-Type': MIME[ext] ?? 'application/octet-stream',
    'Cache-Control': IMUTAVEL.test(rel) ? 'public, max-age=31536000, immutable' : 'no-cache',
    ETag: etag,
    'Last-Modified': modificado,
  };
  if (req && naoMudou(req, etag, st.mtimeMs)) {
    res.writeHead(304, headers);
    res.end();
    return true;
  }
  headers['Content-Length'] = st.size;
  res.writeHead(200, headers);
  if (req?.method === 'HEAD') {
    res.end();
    return true;
  }
  createReadStream(file)
    .on('error', () => res.destroy())
    .pipe(res);
  return true;
}

/** O navegador já tem esta versão? (If-None-Match vale mais que If-Modified-Since, como manda o HTTP.) */
function naoMudou(req: IncomingMessage, etag: string, mtimeMs: number): boolean {
  const inm = req.headers['if-none-match'];
  if (typeof inm === 'string') return inm.split(',').some((t) => t.trim() === etag || t.trim() === '*');
  const ims = req.headers['if-modified-since'];
  if (typeof ims === 'string') {
    const quando = Date.parse(ims);
    return Number.isFinite(quando) && Math.floor(mtimeMs / 1000) * 1000 <= quando;
  }
  return false;
}
