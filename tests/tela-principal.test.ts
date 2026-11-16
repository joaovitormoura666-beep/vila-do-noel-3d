/**
 * Tela principal da live: o jogo 3D em / (index.html), a versão clássica 2D em /classico.html, e o servidor de
 * arquivos do modo local (server/static.ts) entregando páginas, modelos e texturas com o tipo e o cache certos.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { serveStatic } from '../server/static';

const RAIZ = resolve(__dirname, '..');
const ler = (f: string) => readFileSync(join(RAIZ, f), 'utf8');
/** O corpo da página (sem o comentário do topo e o título), para comparar index.html e jogo3d.html. */
const corpo = (html: string) => html.slice(html.indexOf('<body>'));

describe('páginas da tela da live', () => {
  it('index.html é o jogo 3D e jogo3d.html é a mesma página', () => {
    const index = ler('index.html');
    const jogo3d = ler('jogo3d.html');
    expect(index).toContain('src="/src/jogo3d/main.ts"');
    for (const id of ['palco', 'carregando', 'som', 'demo']) expect(index).toContain(`id="${id}"`);
    expect(corpo(jogo3d)).toBe(corpo(index));
  });

  it('a versão clássica (2D) continua em classico.html', () => {
    const classico = ler('classico.html');
    expect(classico).toContain('src="/src/main.ts"');
    expect(classico).toContain('id="jogo"');
  });

  it('a construção (vite.config.ts) inclui o 3D, o 2D clássico e o painel', () => {
    const cfg = ler('vite.config.ts');
    for (const f of ['index.html', 'jogo3d.html', 'classico.html', 'painel.html']) expect(cfg).toContain(`'${f}'`);
  });
});

describe('servidor de arquivos do modo local (server/static.ts)', () => {
  let pasta = '';
  let servidor: Server;
  let base = '';

  beforeAll(async () => {
    pasta = mkdtempSync(join(tmpdir(), 'vila-static-'));
    for (const d of ['app', 'assets/modelos', 'assets/texturas']) mkdirSync(join(pasta, d), { recursive: true });
    writeFileSync(join(pasta, 'index.html'), '<!doctype html><title>3D</title>');
    writeFileSync(join(pasta, 'classico.html'), '<!doctype html><title>2D</title>');
    writeFileSync(join(pasta, 'jogo3d.html'), '<!doctype html><title>3D</title>');
    writeFileSync(join(pasta, 'app', 'main-abc123.js'), 'console.log(1)');
    writeFileSync(join(pasta, 'assets', 'modelos', 'poltrona.glb'), Buffer.from('glTF\x02\x00\x00\x00'));
    writeFileSync(join(pasta, 'assets', 'texturas', 'tijolo.jpg'), Buffer.from([0xff, 0xd8, 0xff]));
    writeFileSync(join(pasta, 'assets', 'texturas', 'ramo.webp'), Buffer.from('RIFF'));
    servidor = createServer((req, res) => {
      const caminho = new URL(req.url ?? '/', 'http://x').pathname;
      if (!serveStatic(pasta, caminho, res)) {
        res.writeHead(404);
        res.end();
      }
    });
    await new Promise<void>((ok) => servidor.listen(0, '127.0.0.1', ok));
    const end = servidor.address();
    base = `http://127.0.0.1:${typeof end === 'object' && end ? end.port : 0}`;
  });

  afterAll(async () => {
    await new Promise<void>((ok) => servidor.close(() => ok()));
    rmSync(pasta, { recursive: true, force: true });
  });

  it('/ entrega a tela 3D; /classico e /jogo3d também funcionam sem o .html', async () => {
    expect(await (await fetch(`${base}/`)).text()).toContain('3D');
    expect(await (await fetch(`${base}/?obs`)).text()).toContain('3D');
    expect(await (await fetch(`${base}/classico`)).text()).toContain('2D');
    expect(await (await fetch(`${base}/classico.html`)).text()).toContain('2D');
    expect((await fetch(`${base}/jogo3d`)).status).toBe(200);
  });

  it('modelos e texturas saem com o tipo certo', async () => {
    const tipo = async (p: string) => (await fetch(`${base}${p}`)).headers.get('content-type');
    expect(await tipo('/assets/modelos/poltrona.glb')).toBe('model/gltf-binary');
    expect(await tipo('/assets/texturas/tijolo.jpg')).toBe('image/jpeg');
    expect(await tipo('/assets/texturas/ramo.webp')).toBe('image/webp');
    expect(await tipo('/app/main-abc123.js')).toMatch(/^text\/javascript/);
    expect(await tipo('/')).toMatch(/^text\/html/);
  });

  it('código com versão no nome fica em cache; o resto é conferido e volta 304 quando não mudou', async () => {
    const js = await fetch(`${base}/app/main-abc123.js`);
    expect(js.headers.get('cache-control')).toContain('immutable');
    const glb = await fetch(`${base}/assets/modelos/poltrona.glb`);
    expect(glb.headers.get('cache-control')).toBe('no-cache');
    const etag = glb.headers.get('etag');
    expect(etag).toBeTruthy();
    const deNovo = await fetch(`${base}/assets/modelos/poltrona.glb`, { headers: { 'If-None-Match': etag ?? '' } });
    expect(deNovo.status).toBe(304);
    expect((await fetch(`${base}/index.html`)).headers.get('cache-control')).toBe('no-cache');
  });

  it('não sai da pasta nem aceita endereço malformado', async () => {
    expect((await fetch(`${base}/..%2f..%2fetc%2fpasswd`)).status).toBe(404);
    expect((await fetch(`${base}/%E0`)).status).toBe(404);
    expect((await fetch(`${base}/nao-existe.glb`)).status).toBe(404);
  });
});
