#!/usr/bin/env node
/**
 * Fotografa uma cena do laboratório 3D (renderização por software, sem placa de vídeo).
 *
 * Uso:
 *   node tools/shot.cjs <cena> [opções]        cenas: sala (só o cenário), vila (jogo montado) ou estudio (personagens e presentes)
 *   node tools/shot.cjs jogo3d.html [opções]   outra página da raiz do projeto (o jogo 3D, com --param manual=1)
 *
 * Opções:
 *   --t 6                 instante da foto em segundos (padrão 6). Aceita lista: --t 2,6,12
 *   --out arquivo.png     destino (padrão lab/fotos/<cena>.png). Com vários instantes vira arquivo-t2.png etc.
 *   --half                rascunho rápido em 540x960 (4x menos pixels)
 *   --estado revelacao    momento a mostrar na vila (padrão: fila)
 *   --q baixa             nível de qualidade (alta, media ou baixa; padrão alta)
 *   --clip x,y,l,a        recorta uma região, em pixels de projeto (tela de 1080x1920)
 *   --mini                grava também uma miniatura 270x480 (arquivo-mini.png): como aparece pequeno no celular
 *   --guias               desenha por cima as zonas da tela da live (título, área de jogo, chat)
 *   --param chave=valor   parâmetro extra no endereço (pode repetir). Veja a lista em lab/LEIA-ME.md
 *   --bench 12            mede o tempo médio de 12 quadros por software (só serve para comparar entre versões)
 *   --timeout 90          limite, em segundos, de cada passo da captura (congelar, fotografar). Padrão 30 (o do
 *                         Playwright); aumente quando a máquina estiver carregada e a foto estourar o tempo
 *
 * Saída: uma linha JSON com os números do quadro e os erros do console.
 * O servidor do laboratório precisa estar no ar em http://127.0.0.1:5180 (npm run lab).
 */
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const BASE = process.env.LAB_URL || 'http://127.0.0.1:5180';

function parseArgs(argv) {
  const a = { folder: null, t: [6], out: null, half: false, estado: null, q: null, clip: null, mini: false, guias: false, params: [], bench: 0, timeout: 0 };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    const next = () => {
      const n = argv[++i];
      if (n === undefined) throw new Error(`faltou o valor de ${v}`);
      return n;
    };
    if (v === '--t') a.t = next().split(',').map(Number);
    else if (v === '--out') a.out = next();
    else if (v === '--half') a.half = true;
    else if (v === '--estado') a.estado = next();
    else if (v === '--q') a.q = next();
    else if (v === '--clip') a.clip = next().split(',').map(Number);
    else if (v === '--mini') a.mini = true;
    else if (v === '--guias') a.guias = true;
    else if (v === '--param') a.params.push(next());
    else if (v === '--bench') a.bench = Number(next());
    else if (v === '--timeout') a.timeout = Number(next());
    else if (v.startsWith('--')) throw new Error(`opção desconhecida: ${v}`);
    else if (!a.folder) a.folder = v.replace(/\/+$/, '');
    else throw new Error(`argumento sobrando: ${v}`);
  }
  if (!a.folder) throw new Error('informe a cena, por exemplo: node tools/shot.cjs vila');
  if (a.t.some((n) => !Number.isFinite(n) || n < 0)) throw new Error('--t precisa de números (segundos)');
  if (!Number.isFinite(a.timeout) || a.timeout < 0) throw new Error('--timeout precisa de um número de segundos');
  if (a.clip && (a.clip.length !== 4 || a.clip.some((n) => !Number.isFinite(n)))) throw new Error('--clip precisa de x,y,largura,altura');
  return a;
}

const GUIDES_JS = `(() => {
  const o = document.querySelector('.overlay');
  if (!o || o.querySelector('.guias-lab')) return;
  const g = document.createElement('div');
  g.className = 'guias-lab';
  g.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:9999;font:600 22px system-ui;color:#fff';
  const box = (x, y, w, h, color, text) => {
    const d = document.createElement('div');
    d.style.cssText = 'position:absolute;left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:' + h + 'px;box-sizing:border-box;border:3px dashed ' + color + ';';
    const s = document.createElement('span');
    s.textContent = text;
    s.style.cssText = 'position:absolute;left:6px;top:4px;background:' + color + ';padding:2px 8px;border-radius:6px;color:#000';
    d.append(s);
    g.append(d);
  };
  box(0, 0, 1080, 190, '#ff5d5d', 'barra do TikTok (não usar)');
  box(0, 190, 1080, 230, '#ffd166', 'título');
  box(60, 430, 960, 1050, '#06d6a0', 'área de jogo: Noel, entrega e fila');
  box(0, 1480, 1080, 440, '#ff5d5d', 'chat e botões do TikTok cobrem aqui (só cenário)');
  o.append(g);
})()`;

async function main() {
  const a = parseArgs(process.argv.slice(2));
  const scale = a.half ? 0.5 : 1;
  const pagina = /\.html$/i.test(a.folder);
  const out = path.resolve(ROOT, a.out || path.join('lab', 'fotos', `${a.folder.replace(/\.html$/i, '')}.png`));
  fs.mkdirSync(path.dirname(out), { recursive: true });

  const qs = new URLSearchParams();
  qs.set('pr', String(scale));
  if (a.estado) qs.set('estado', a.estado);
  if (a.q) qs.set('q', a.q);
  for (const p of a.params) {
    const i = p.indexOf('=');
    qs.set(i < 0 ? p : p.slice(0, i), i < 0 ? '1' : p.slice(i + 1));
  }
  const url = pagina ? `${BASE}/${a.folder.replace(/^\/+/, '')}?${qs}` : `${BASE}/lab/index.html?cena=${a.folder}&${qs}`;

  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const result = { ok: false, url, shots: [], console: [] };
  try {
    const ctx = await browser.newContext({ viewport: { width: 1080 * scale, height: 1920 * scale }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    if (a.timeout > 0) page.setDefaultTimeout(a.timeout * 1000);
    page.on('console', (m) => {
      const type = m.type();
      const text = m.text();
      if (/GPU stall due to ReadPixels/.test(text)) return; // ruído da própria captura
      if (type === 'error' || type === 'warning') result.console.push(`${type}: ${text.slice(0, 600)}`);
    });
    page.on('pageerror', (e) => result.console.push(`pageerror: ${String(e.message || e).slice(0, 600)}`));

    const started = Date.now();
    let state = null;
    // O servidor pode recarregar a página uma vez ao preparar um módulo novo: por isso o laço de espera.
    for (let attempt = 0; attempt < 4 && !state; attempt++) {
      try {
        if (attempt === 0) await page.goto(url, { waitUntil: 'load', timeout: 120000 });
        await page.waitForFunction(() => window.__proto && (window.__proto.ready || window.__proto.error), null, { timeout: 150000 });
        state = await page.evaluate(() => ({ ready: !!window.__proto.ready, error: window.__proto.error || null }));
      } catch (err) {
        const msg = String(err && err.message ? err.message : err);
        if (/Execution context was destroyed|navigation|Target closed/i.test(msg) && attempt < 3) continue;
        throw err;
      }
    }
    result.loadMs = Date.now() - started;
    if (!state || state.error) {
      result.error = state ? state.error : 'a página não ficou pronta';
      console.log(JSON.stringify(result));
      process.exitCode = 1;
      return;
    }

    for (const t of a.t) {
      const t0 = Date.now();
      const info = await page.evaluate((tt) => window.__proto.freeze(tt), t);
      const freezeMs = Date.now() - t0;
      if (a.guias) await page.evaluate(GUIDES_JS);
      await page.waitForTimeout(120);
      const file = a.t.length > 1 ? out.replace(/\.png$/i, `-t${String(t).replace('.', '_')}.png`) : out;
      const clip = a.clip ? { x: a.clip[0] * scale, y: a.clip[1] * scale, width: a.clip[2] * scale, height: a.clip[3] * scale } : undefined;
      await page.screenshot({ path: file, clip });
      const shot = { file: path.relative(ROOT, file), freezeMs, ...info };
      if (a.mini && !a.clip) {
        const mini = file.replace(/\.png$/i, '-mini.png');
        await page.setViewportSize({ width: 270, height: 480 });
        await page.waitForTimeout(150);
        await page.screenshot({ path: mini });
        await page.setViewportSize({ width: 1080 * scale, height: 1920 * scale });
        await page.waitForTimeout(100);
        shot.mini = path.relative(ROOT, mini);
      }
      result.shots.push(shot);
    }
    if (a.bench > 0) result.softwareMsPerFrame = Math.round((await page.evaluate((n) => window.__proto.benchmark(n), a.bench)) * 10) / 10;
    result.ok = true;
    console.log(JSON.stringify(result));
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.log(JSON.stringify({ ok: false, error: String(err && err.stack ? err.stack : err) }));
  process.exitCode = 1;
});
