#!/usr/bin/env node
/**
 * Testa a demonstração estática do jogo 3D (dist-jogo3d/, gerada por npx vite build -c vite.jogo3d.config.ts):
 * serve a pasta com um servidor estático simples (python3 -m http.server numa porta livre), abre no navegador
 * headless (desenho por software), confere que carrega sem erro no console e sem pedido falhando, aperta
 * "Entrar 10" e "Entrar 1", acompanha a fila andando e pede a árvore brilhando e o trenó pela barra.
 *
 * Uso: node tools/testar-jogo3d-estatico.cjs [pasta das fotos]   (padrão /tmp/jogo3d-estatico)
 * Saída: o andamento da fila, o console, as falhas de rede e três fotos (fila.png, arvore.png, depois.png).
 * Não precisa do laboratório. Leva uns 3 a 10 minutos por software.
 */
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const net = require('net');
const path = require('path');
const fs = require('fs');
const OUT = path.resolve(process.argv[2] || '/tmp/jogo3d-estatico');
fs.mkdirSync(OUT, { recursive: true });
const PASTA = path.resolve(__dirname, '..', 'dist-jogo3d');
if (!fs.existsSync(path.join(PASTA, 'index.html'))) { console.error('falta dist-jogo3d/index.html: rode npx vite build -c vite.jogo3d.config.ts'); process.exit(1); }
const portaLivre = () => new Promise((ok) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => ok(p)); }); });
(async () => {
  const porta = await portaLivre();
  const srv = spawn('python3', ['-m', 'http.server', String(porta), '--bind', '127.0.0.1', '--directory', PASTA], { stdio: ['ignore', 'ignore', 'pipe'] });
  const pedidos = []; const falhas = []; const consoleMsgs = [];
  srv.stderr.on('data', (d) => { for (const l of String(d).split('\n')) if (/"GET /.test(l)) pedidos.push(l.replace(/^.*"GET (\S+).*" (\d+).*$/, '$2 $1')); });
  await new Promise((r) => setTimeout(r, 800));
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try {
    const page = await (await browser.newContext({ viewport: { width: 300, height: 600 } })).newPage();
    page.setDefaultTimeout(900000);
    page.on('console', (m) => { const t = m.text(); if (/GPU stall|KHR_parallel_shader_compile/.test(t)) return; consoleMsgs.push(`${m.type()}: ${t.slice(0, 300)}`); });
    page.on('pageerror', (e) => consoleMsgs.push(`pageerror: ${e.message}`));
    page.on('requestfailed', (r) => falhas.push(`${r.url()} ${r.failure() && r.failure().errorText}`));
    page.on('response', (r) => { if (r.status() >= 400) falhas.push(`${r.status()} ${r.url()}`); });
    const t0 = Date.now();
    await page.goto(`http://127.0.0.1:${porta}/`, { waitUntil: 'load', timeout: 900000 });
    await page.waitForFunction(() => window.__jogo3d && (window.__jogo3d.pronto || window.__jogo3d.erro), null, { timeout: 900000 });
    console.log('carregou em', ((Date.now() - t0) / 1000).toFixed(0), 's; erro:', await page.evaluate(() => window.__jogo3d.erro || 'nenhum'));
    const barra = await page.evaluate(() => { const b = document.getElementById('demo'); return { visivel: !!b && !b.hidden, botoes: [...document.querySelectorAll('#demo button')].map((x) => x.textContent.trim()) }; });
    console.log('barra:', JSON.stringify(barra));
    const info = () => page.evaluate(() => { const i = window.__jogo3d.info(); return { t: i.t, fila: i.fila, naTela: i.naTela, atendido: i.atendido, fase: i.fase, atendidos: i.atendidos }; });
    console.log('antes:', JSON.stringify(await info()));
    await page.evaluate(() => { document.querySelector('#demo [data-acao="dez"]').click(); document.querySelector('#demo [data-acao="um"]').click(); });
    for (let k = 0; k < 6; k++) { await page.evaluate(() => window.__jogo3d.avancar(5)); console.log(`+${(k + 1) * 5}s de jogo:`, JSON.stringify(await info())); }
    await page.screenshot({ path: `${OUT}/fila.png` });
    await page.evaluate(() => document.querySelector('#demo [data-acao="TREE_SPARKLE"]').click());
    await page.evaluate(() => window.__jogo3d.avancar(1.5));
    await page.waitForTimeout(4000);
    await page.screenshot({ path: `${OUT}/arvore.png` });
    await page.evaluate(() => document.querySelector('#demo [data-acao="SLEIGH_PASS"]').click());
    await page.evaluate(() => window.__jogo3d.avancar(7));
    await page.waitForTimeout(4000);
    await page.screenshot({ path: `${OUT}/depois.png` });
    console.log('depois:', JSON.stringify(await info()));
  } finally {
    await browser.close();
    srv.kill();
  }
  console.log('console:', consoleMsgs.length ? '\n  ' + consoleMsgs.join('\n  ') : 'nada');
  console.log('falhas de rede:', falhas.length ? '\n  ' + falhas.join('\n  ') : 'nenhuma');
  const status = {}; for (const p of pedidos) { const s = p.split(' ')[0]; status[s] = (status[s] || 0) + 1; }
  console.log('pedidos ao servidor estático por status:', JSON.stringify(status), 'porta', porta);
  console.log('fotos em', OUT);
  if (falhas.length || consoleMsgs.some((m) => /^(error|warning|pageerror)/.test(m))) process.exitCode = 1;
})().catch((e) => { console.error(e); process.exitCode = 1; });
