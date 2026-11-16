import type { ServerResponse } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

/** Servidor de arquivos estáticos mínimo para a pasta `dist` (jogo compilado). */
export function serveStatic(root: string, urlPath: string, res: ServerResponse): boolean {
  let rel: string;
  try {
    rel = decodeURIComponent(urlPath.split('?')[0]);
  } catch {
    return false; // endereço malformado (ex.: "%E0")
  }
  if (rel.includes('\0')) return false;
  if (rel === '/' || rel === '') rel = '/index.html';
  if (rel === '/painel') rel = '/painel.html';
  if (rel === '/sala') rel = '/demo-sala.html';
  const base = resolve(root);
  const file = normalize(join(base, rel));
  if (file !== base && !file.startsWith(base + sep)) return false;
  if (!existsSync(file) || !statSync(file).isFile()) return false;
  const ext = extname(file).toLowerCase();
  res.writeHead(200, {
    'Content-Type': MIME[ext] ?? 'application/octet-stream',
    'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=86400',
  });
  createReadStream(file).pipe(res);
  return true;
}
