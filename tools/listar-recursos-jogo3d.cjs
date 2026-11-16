#!/usr/bin/env node
/**
 * Descobre quais arquivos de public/ o jogo 3D realmente carrega e grava a lista em vite.jogo3d.recursos.json
 * (na raiz do projeto). A construção da demonstração estática (npx vite build -c vite.jogo3d.config.ts) copia
 * só o que está nessa lista, mais o public/assets/CREDITOS.md, em vez do acervo inteiro.
 *
 * Uso (com o laboratório ligado em http://127.0.0.1:5180, npm run lab):
 *   node tools/listar-recursos-jogo3d.cjs              abre o jogo em demonstração nos três níveis de qualidade,
 *                                                       pede os quatro efeitos e alguns visitantes, e anota cada
 *                                                       pedido a /assets/ e /audio/
 *   node tools/listar-recursos-jogo3d.cjs --conferir   só compara com a lista gravada (não grava nada)
 *
 * Rode de novo sempre que a arte do jogo passar a usar outro modelo ou textura: um recurso que falta na lista
 * aparece como erro 404 no console da demonstração estática.
 */
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const BASE = process.env.LAB_URL || 'http://127.0.0.1:5180';
const DESTINO = path.join(ROOT, 'vite.jogo3d.recursos.json');
const conferir = process.argv.includes('--conferir');

async function coletar(nivel) {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const achados = new Set();
  try {
    const page = await (await browser.newContext({ viewport: { width: 540, height: 960 } })).newPage();
    page.setDefaultTimeout(600000);
    page.on('request', (r) => {
      const u = new URL(r.url());
      if (u.origin !== BASE) return;
      const p = decodeURIComponent(u.pathname);
      if (/^\/(assets|audio)\//.test(p)) achados.add(p.slice(1));
    });
    await page.goto(`${BASE}/jogo3d.html?demo=1&limpar&q=${nivel}&pr=0.3`, { waitUntil: 'load', timeout: 600000 });
    await page.waitForFunction(() => window.__jogo3d && (window.__jogo3d.pronto || window.__jogo3d.erro), null, { timeout: 600000 });
    const erro = await page.evaluate(() => window.__jogo3d.erro || null);
    if (erro) throw new Error(`o jogo não abriu (${nivel}): ${erro}`);
    // efeitos, visitantes e alguns segundos de jogo: qualquer carga sob demanda aparece aqui
    await page.evaluate(() => {
      for (const e of ['TREE_SPARKLE', 'FIREPLACE_MAGIC', 'SLEIGH_PASS', 'MAGICAL_NIGHT']) window.__jogo3d.efeito(e);
      window.__jogo3d.entrar(3);
      window.__jogo3d.avancar(20);
    });
    await page.waitForTimeout(3000);
  } finally {
    await browser.close();
  }
  return achados;
}

async function main() {
  const todos = new Set();
  for (const nivel of ['alta', 'media', 'baixa']) {
    const t0 = Date.now();
    const achados = await coletar(nivel);
    console.log(`${nivel}: ${achados.size} arquivos (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
    for (const a of achados) todos.add(a);
  }
  const lista = [...todos].sort();
  const faltam = lista.filter((p) => !fs.existsSync(path.join(ROOT, 'public', p)));
  if (faltam.length) console.log(`pedidos que não existem em public/ (o jogo trata a falta sozinho): ${faltam.join(', ')}`);
  const existentes = lista.filter((p) => !faltam.includes(p));
  if (conferir) {
    const gravada = fs.existsSync(DESTINO) ? JSON.parse(fs.readFileSync(DESTINO, 'utf8')).arquivos : [];
    const novos = existentes.filter((p) => !gravada.includes(p));
    const sobrando = gravada.filter((p) => !existentes.includes(p));
    console.log(novos.length || sobrando.length ? `diferenças: faltam na lista ${JSON.stringify(novos)}; sobram ${JSON.stringify(sobrando)}` : 'a lista gravada está em dia');
    return;
  }
  const bytes = existentes.reduce((s, p) => s + fs.statSync(path.join(ROOT, 'public', p)).size, 0);
  fs.writeFileSync(
    DESTINO,
    `${JSON.stringify(
      {
        sobre: 'Arquivos de public/ que o jogo 3D carrega (gerado por tools/listar-recursos-jogo3d.cjs). Usado por vite.jogo3d.config.ts.',
        gerado: new Date().toISOString(),
        arquivos: existentes,
      },
      null,
      2,
    )}\n`,
  );
  console.log(`${existentes.length} arquivos, ${(bytes / 1048576).toFixed(1)} MB → ${path.relative(ROOT, DESTINO)}`);
}

main().catch((err) => {
  console.error(String(err && err.stack ? err.stack : err));
  process.exitCode = 1;
});
