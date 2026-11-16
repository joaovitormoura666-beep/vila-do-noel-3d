#!/usr/bin/env node
/**
 * Grava um vídeo vertical (9:16) do jogo 3D quadro a quadro, por software (SwiftShader), sem depender da
 * velocidade da máquina: a página abre em ?manual=1 e a simulação anda exatamente 1/fps por quadro
 * (window.__jogo3d.avancar), então o vídeo sai liso e sempre igual, mesmo que cada quadro leve 10 s para desenhar.
 *
 * Uso (com o laboratório ligado em http://127.0.0.1:5180, npm run lab):
 *   node tools/gravar-jogo3d.cjs --plano                       só simula (segundos) e mostra a linha do tempo
 *   node tools/gravar-jogo3d.cjs --medir 4                     mede quanto custa um quadro nesta máquina
 *   node tools/gravar-jogo3d.cjs                               grava, monta o MP4 e a capa (padrões abaixo)
 *   node tools/gravar-jogo3d.cjs --largura 720 --fps 30 --duracao 32 --processos 4 --saida lab/fotos/x/video.mp4
 *
 * Opções:
 *   --fps 24              quadros por segundo (padrão 24)
 *   --duracao 26          segundos de vídeo (padrão 26)
 *   --largura 1080        largura do vídeo; a altura é 16:9 dela (1080 → 1920; 720 → 1280)
 *   --resolucao3d 1       resolução interna do 3D em relação a 1080x1920 (parâmetro pr do jogo). Padrão: largura/1080.
 *                         Os textos (nomes, balão, título) são HTML e saem sempre na largura do vídeo.
 *   --q alta              nível de qualidade (alta, media ou baixa)
 *   --fila 4              visitantes que já começam nos lugares da fila
 *   --semente vila        semente da simulação (nomes, presentes, frases)
 *   --roteiro "0.3:entrar,2:entrar,11:efeito=SLEIGH_PASS"
 *                         acontecimentos no tempo do vídeo: entrar (um visitante novo, andando desde a porta),
 *                         entrar=3 (três), efeito=ID (TREE_SPARKLE, FIREPLACE_MAGIC, SLEIGH_PASS, MAGICAL_NIGHT)
 *   --param chave=valor   parâmetro extra no endereço do jogo (pode repetir; ex.: --param presente=globo)
 *   --processos 4         navegadores em paralelo, cada um com uma faixa de quadros (o SwiftShader já usa vários
 *                         núcleos: em 4 CPUs, 4 processos rendem só uns 15% a mais que 1)
 *   --quadros pasta       onde ficam os quadros (padrão /tmp/jogo3d-video/quadros). Quadros já gravados são
 *                         pulados: dá para interromper e continuar depois com o mesmo comando
 *   --saida arquivo.mp4   vídeo final (padrão lab/fotos/jogo3d/video/vila-3d-fluxo.mp4); a capa sai como capa.jpg
 *                         na mesma pasta, no instante da revelação do primeiro presente (ou --capa segundos)
 *   --sem-audio           não gera a trilha (música de caixinha e efeitos sonoros do próprio jogo, renderizados
 *                         offline num OfflineAudioContext com os instantes registrados na simulação)
 *   --so-montar           não desenha: só junta os quadros que já existem, a trilha e a capa
 *   --crf 18              qualidade do H.264 (menor = melhor; 18 a 20)
 *   --timeout 300         limite, em segundos, de cada passo no navegador (carregar, desenhar um quadro)
 *   --previa 1,4.5,9      só fotografa estes instantes do vídeo (com o roteiro aplicado) em <quadros>/previa-t*.png,
 *                         para conferir a composição antes da gravação longa (use com --largura 540)
 *   --jpg                 quadros em JPEG 95 em vez de PNG
 *
 * Interno: --faixa a:b grava só os quadros a até b-1 (é como o processo principal chama os outros).
 *
 * Por que o jogo sai igual em todos os processos: tudo no modo manual vem de semente e de dt (sem relógio, sem
 * Math.random, sem voz). Cada processo simula sem desenhar até o primeiro quadro da sua faixa (rápido: 1 s de jogo
 * leva uns 70 ms) e só então começa a fotografar.
 */
const path = require('path');
const fs = require('fs');
const { spawn, execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const BASE = process.env.LAB_URL || 'http://127.0.0.1:5180';
const ROTEIRO_PADRAO = '0.4:entrar,1.6:entrar,3:entrar,4.6:entrar,7.5:entrar,10.6:efeito=TREE_SPARKLE,14:entrar,17:entrar';

function parseArgs(argv) {
  const a = {
    fps: 24, duracao: 26, largura: 1080, resolucao3d: null, q: 'alta', fila: 4, semente: 'vila', roteiro: ROTEIRO_PADRAO,
    params: [], processos: 4, quadros: '/tmp/jogo3d-video/quadros', saida: 'lab/fotos/jogo3d/video/vila-3d-fluxo.mp4',
    capa: null, audio: true, soMontar: false, plano: false, medir: 0, crf: 18, timeout: 300, faixa: null, jpg: false, previa: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    const next = () => {
      const n = argv[++i];
      if (n === undefined) throw new Error(`faltou o valor de ${v}`);
      return n;
    };
    if (v === '--fps') a.fps = Number(next());
    else if (v === '--duracao') a.duracao = Number(next());
    else if (v === '--largura') a.largura = Number(next());
    else if (v === '--resolucao3d') a.resolucao3d = Number(next());
    else if (v === '--q') a.q = next();
    else if (v === '--fila') a.fila = Number(next());
    else if (v === '--semente') a.semente = next();
    else if (v === '--roteiro') a.roteiro = next();
    else if (v === '--param') a.params.push(next());
    else if (v === '--processos') a.processos = Number(next());
    else if (v === '--quadros') a.quadros = next();
    else if (v === '--saida') a.saida = next();
    else if (v === '--capa') a.capa = Number(next());
    else if (v === '--sem-audio') a.audio = false;
    else if (v === '--so-montar') a.soMontar = true;
    else if (v === '--plano') a.plano = true;
    else if (v === '--medir') a.medir = Number(next());
    else if (v === '--crf') a.crf = Number(next());
    else if (v === '--timeout') a.timeout = Number(next());
    else if (v === '--jpg') a.jpg = true;
    else if (v === '--previa') a.previa = next().split(',').map(Number);
    else if (v === '--faixa') a.faixa = next().split(':').map(Number);
    else throw new Error(`opção desconhecida: ${v}`);
  }
  for (const k of ['fps', 'duracao', 'largura', 'fila', 'processos', 'crf', 'timeout']) {
    if (!Number.isFinite(a[k]) || a[k] < 0) throw new Error(`--${k} precisa de um número`);
  }
  if (a.largura % 2) throw new Error('--largura precisa ser par (o H.264 exige)');
  if (a.resolucao3d == null) a.resolucao3d = a.largura / 1080;
  a.altura = Math.round((a.largura * 16) / 9 / 2) * 2;
  a.total = Math.round(a.duracao * a.fps);
  a.eventos = lerRoteiro(a.roteiro);
  return a;
}

/** "0.4:entrar,10:efeito=SLEIGH_PASS" → [{ t: 0.4, acao: 'entrar', valor: 1 }, ...] em ordem de tempo. */
function lerRoteiro(texto) {
  const lista = [];
  for (const item of String(texto || '').split(',').map((s) => s.trim()).filter(Boolean)) {
    const m = /^([\d.]+):(entrar|efeito)(?:=(.+))?$/.exec(item);
    if (!m) throw new Error(`item do roteiro não entendido: ${item}`);
    lista.push({ t: Number(m[1]), acao: m[2], valor: m[2] === 'entrar' ? Number(m[3] || 1) : m[3] });
  }
  return lista.sort((x, y) => x.t - y.t);
}

function urlDoJogo(a) {
  const qs = new URLSearchParams();
  qs.set('manual', '1');
  qs.set('obs', '');
  qs.set('limpar', '');
  qs.set('q', a.q);
  qs.set('pr', String(a.resolucao3d));
  qs.set('fila', String(a.fila));
  qs.set('semente', a.semente);
  for (const p of a.params) {
    const i = p.indexOf('=');
    qs.set(i < 0 ? p : p.slice(0, i), i < 0 ? '1' : p.slice(i + 1));
  }
  return `${BASE}/jogo3d.html?${qs.toString().replace(/=(&|$)/g, '$1')}`;
}

function log(...m) {
  console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...m);
}

/** Abre o jogo num navegador novo e espera ficar pronto. */
async function abrirJogo(a, comAudioLog) {
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: a.largura, height: a.altura }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.setDefaultTimeout(a.timeout * 1000);
  const erros = [];
  page.on('console', (m) => {
    const tx = m.text();
    if (/GPU stall due to ReadPixels|KHR_parallel_shader_compile/.test(tx)) return; // ruído do desenho por software
    if (m.type() === 'error' || m.type() === 'warning') erros.push(`${m.type()}: ${tx.slice(0, 300)}`);
  });
  page.on('pageerror', (e) => erros.push(`pageerror: ${String(e.message || e).slice(0, 300)}`));
  await page.goto(urlDoJogo(a), { waitUntil: 'load', timeout: a.timeout * 1000 });
  await page.waitForFunction(() => window.__jogo3d && (window.__jogo3d.pronto || window.__jogo3d.erro), null, { timeout: a.timeout * 1000 });
  const erro = await page.evaluate(() => window.__jogo3d.erro || null);
  if (erro) throw new Error(`o jogo não abriu: ${erro}`);
  // registro dos efeitos sonoros no tempo do vídeo (o modo manual é mudo: só anota, para a trilha offline)
  await page.evaluate((anotar) => {
    window.__grav = { t: 0, sons: [] };
    const sfx = window.__vila3d && window.__vila3d.audio && window.__vila3d.audio.sfx;
    if (anotar && sfx) sfx.play = (nome) => window.__grav.sons.push([window.__grav.t, nome]);
  }, !!comAudioLog);
  return { browser, page, erros };
}

/**
 * Leva a simulação até o quadro k (o estado no instante k/fps), aplicando o roteiro no caminho.
 * `feito` guarda quantos eventos já foram aplicados e em que quadro a página está.
 */
async function irAte(page, a, estado, k) {
  const dt = 1 / a.fps;
  while (estado.quadro < k) {
    const prox = estado.quadro + 1;
    const tProx = prox / a.fps;
    // eventos com instante antes do próximo quadro entram agora (antes de andar)
    const ev = [];
    while (estado.ev < a.eventos.length && a.eventos[estado.ev].t < tProx - 1e-9) ev.push(a.eventos[estado.ev++]);
    await page.evaluate(
      ({ ev, dt, t }) => {
        window.__grav.t = t;
        for (const e of ev) {
          if (e.acao === 'entrar') window.__jogo3d.entrar(e.valor);
          else window.__jogo3d.efeito(e.valor);
        }
        window.__jogo3d.avancar(dt);
      },
      { ev, dt, t: tProx },
    );
    estado.quadro = prox;
  }
}

/** Eventos de t <= 0 entram antes do quadro 0. */
async function prepararInicio(page, a, estado) {
  const ev = [];
  while (estado.ev < a.eventos.length && a.eventos[estado.ev].t <= 1e-9) ev.push(a.eventos[estado.ev++]);
  if (ev.length)
    await page.evaluate((ev) => {
      for (const e of ev) e.acao === 'entrar' ? window.__jogo3d.entrar(e.valor) : window.__jogo3d.efeito(e.valor);
    }, ev);
}

function nomeQuadro(a, k) {
  return path.join(a.quadros, `q${String(k).padStart(5, '0')}.${a.jpg ? 'jpg' : 'png'}`);
}

/** Processo de uma faixa: simula até o início e fotografa cada quadro. */
async function gravarFaixa(a) {
  const [ini, fim] = a.faixa;
  fs.mkdirSync(a.quadros, { recursive: true });
  const faltam = [];
  for (let k = ini; k < fim; k++) if (!fs.existsSync(nomeQuadro(a, k))) faltam.push(k);
  if (!faltam.length) return log(`faixa ${ini}-${fim - 1}: nada a fazer`);
  const t0 = Date.now();
  const { browser, page, erros } = await abrirJogo(a, false);
  log(`faixa ${ini}-${fim - 1}: jogo aberto em ${((Date.now() - t0) / 1000).toFixed(0)} s, ${faltam.length} quadros a gravar`);
  try {
    const estado = { quadro: 0, ev: 0 };
    await prepararInicio(page, a, estado);
    let feitos = 0;
    let tq = Date.now();
    for (const k of faltam) {
      await irAte(page, a, estado, k);
      await page.evaluate(() => window.__jogo3d.frame(0));
      const destino = nomeQuadro(a, k);
      const tmp = destino.replace(/(\.\w+)$/, '.tmp$1');
      await page.screenshot({ path: tmp, animations: 'disabled', ...(a.jpg ? { type: 'jpeg', quality: 95 } : {}) });
      fs.renameSync(tmp, destino);
      feitos++;
      if (feitos % 10 === 0 || feitos === faltam.length) {
        const s = (Date.now() - tq) / 1000 / feitos;
        log(`faixa ${ini}-${fim - 1}: ${feitos}/${faltam.length} (${s.toFixed(1)} s por quadro neste processo)`);
      }
    }
    if (erros.length) log(`faixa ${ini}-${fim - 1}: console:\n  ${erros.slice(0, 10).join('\n  ')}`);
  } finally {
    await browser.close();
  }
}

/** Simulação sem desenho do vídeo inteiro: linha do tempo, sons e instante da capa. */
async function planejar(a) {
  const { browser, page, erros } = await abrirJogo(a, true);
  try {
    const estado = { quadro: 0, ev: 0 };
    await prepararInicio(page, a, estado);
    const linhas = [];
    let anterior = '';
    let capa = null;
    for (let k = 0; k <= a.total; k++) {
      await irAte(page, a, estado, k);
      const i = await page.evaluate(() => {
        const r = window.__jogo3d.info();
        return { t: r.t, fase: r.fase, atendido: r.atendido, fila: r.fila, naTela: r.naTela, presente: r.presente, atendidos: r.atendidos };
      });
      const resumo = `${i.fase || '-'} | atendido ${i.atendido || '-'} | fila ${i.fila} | na tela ${i.naTela} | ${i.presente || ''}`;
      if (resumo !== anterior) linhas.push({ quadro: k, t: +(k / a.fps).toFixed(2), ...i });
      if (capa == null && i.fase === 'revelacao') capa = k + Math.round(a.fps * 0.9);
      anterior = resumo;
    }
    const sons = await page.evaluate(() => window.__grav.sons);
    return { linhas, sons, capa, erros };
  } finally {
    await browser.close();
  }
}

/** Fotografa só alguns instantes, com o roteiro aplicado. */
async function previa(a) {
  fs.mkdirSync(a.quadros, { recursive: true });
  const { browser, page, erros } = await abrirJogo(a, false);
  try {
    const estado = { quadro: 0, ev: 0 };
    await prepararInicio(page, a, estado);
    for (const t of [...a.previa].sort((x, y) => x - y)) {
      await irAte(page, a, estado, Math.round(t * a.fps));
      const info = await page.evaluate(() => window.__jogo3d.frame(0));
      const arq = path.join(a.quadros, `previa-t${String(t).replace('.', '_')}.png`);
      await page.screenshot({ path: arq, animations: 'disabled' });
      log(`${arq}: ${info.fase || '-'} | ${info.drawCalls} desenhos | ${Math.round(info.triangles / 1000)} mil triângulos | ${info.programs} programas`);
    }
    if (erros.length) log(`console:\n  ${erros.join('\n  ')}`);
  } finally {
    await browser.close();
  }
}

/** Mede o custo de n quadros num processo só. */
async function medir(a) {
  const t0 = Date.now();
  const { browser, page } = await abrirJogo(a, false);
  log(`jogo aberto em ${((Date.now() - t0) / 1000).toFixed(1)} s (${a.largura}x${a.altura}, 3D em ${Math.round(1080 * a.resolucao3d)}x${Math.round(1920 * a.resolucao3d)}, ${a.q})`);
  try {
    const estado = { quadro: 0, ev: 0 };
    await prepararInicio(page, a, estado);
    const ms = [];
    for (let k = 0; k < a.medir; k++) {
      await irAte(page, a, estado, Math.round(a.fps * 3) + k);
      const t = Date.now();
      await page.evaluate(() => window.__jogo3d.frame(0));
      await page.screenshot({ path: path.join('/tmp', `gravar-jogo3d-medida.${a.jpg ? 'jpg' : 'png'}`), animations: 'disabled', ...(a.jpg ? { type: 'jpeg', quality: 95 } : {}) });
      ms.push(Date.now() - t);
    }
    const media = ms.slice(1).reduce((s, x) => s + x, 0) / Math.max(1, ms.length - 1);
    log(`quadros: ${ms.join(', ')} ms; média sem o primeiro: ${(media / 1000).toFixed(1)} s`);
    log(`estimativa com 1 processo: ${((a.total * media) / 3600000).toFixed(2)} h para ${a.total} quadros`);
  } finally {
    await browser.close();
  }
}

/** Trilha offline: a caixinha de música e os efeitos sonoros do próprio jogo, nos instantes da simulação. */
async function renderizarAudio(a, sons, destinoWav) {
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  try {
    const page = await (await browser.newContext()).newPage();
    page.setDefaultTimeout(a.timeout * 1000);
    // qualquer endereço do laboratório serve: só precisamos da mesma origem para importar os módulos do jogo
    await page.goto(`${BASE}/src/audio/manifest.ts`);
    const b64 = await page.evaluate(
      async ({ sons, duracao }) => {
        const manifesto = await import('/src/audio/manifest.ts');
        manifesto.semListaDoServidor(); // sem servidor: a música é a caixinha sintetizada (sem arquivo do dono)
        const { Music } = await import('/src/audio/music.ts');
        const { Sfx } = await import('/src/audio/sfx.ts');
        const { DEFAULT_SETTINGS } = await import('/shared/types.ts');
        const taxa = 48000;
        const off = new OfflineAudioContext(2, Math.ceil(taxa * duracao), taxa);
        // o mesmo encadeamento do AudioManager: música e efeitos → volume geral → limitador
        const lim = off.createDynamicsCompressor();
        lim.threshold.value = -10;
        lim.ratio.value = 6;
        lim.connect(off.destination);
        const vol = DEFAULT_SETTINGS.volumes;
        const geral = off.createGain();
        geral.gain.value = vol.master;
        geral.connect(lim);
        const gMusica = off.createGain();
        gMusica.gain.value = vol.music;
        gMusica.connect(geral);
        const gSfx = off.createGain();
        gSfx.gain.value = vol.sfx;
        gSfx.connect(geral);
        // relógio controlado: as classes do jogo leem ctx.currentTime e ctx.state; o resto passa direto para o
        // contexto offline. Primeiro a música agenda os compassos com o próprio agendador dela, em tempo real (o
        // relógio é o tempo decorrido, como numa live); depois cada efeito sonoro é tocado no instante do vídeo
        // em que a simulação o pediu.
        const t0 = performance.now();
        let fixo = null;
        const relogio = new Proxy(off, {
          get(alvo, prop) {
            if (prop === 'currentTime') return fixo ?? (performance.now() - t0) / 1000;
            if (prop === 'state') return 'running';
            const v = Reflect.get(alvo, prop, alvo);
            return typeof v === 'function' ? v.bind(alvo) : v;
          },
        });
        const musica = new Music(relogio, gMusica);
        const sfx = new Sfx(relogio, gSfx);
        await musica.start();
        await new Promise((ok) => setTimeout(ok, (duracao + 0.5) * 1000));
        musica.stop();
        for (const [t, nome] of sons) {
          fixo = t;
          sfx.play(nome);
        }
        const buf = await off.startRendering();
        // WAV 16 bits estéreo
        const n = buf.length;
        const dados = new DataView(new ArrayBuffer(44 + n * 4));
        const esc = (o, s) => [...s].forEach((c, i) => dados.setUint8(o + i, c.charCodeAt(0)));
        esc(0, 'RIFF');
        dados.setUint32(4, 36 + n * 4, true);
        esc(8, 'WAVEfmt ');
        dados.setUint32(16, 16, true);
        dados.setUint16(20, 1, true);
        dados.setUint16(22, 2, true);
        dados.setUint32(24, taxa, true);
        dados.setUint32(28, taxa * 4, true);
        dados.setUint16(32, 4, true);
        dados.setUint16(34, 16, true);
        esc(36, 'data');
        dados.setUint32(40, n * 4, true);
        const L = buf.getChannelData(0);
        const R = buf.getChannelData(1);
        // entrada e saída suaves (0,4 s e 1 s) para o vídeo não começar nem acabar num estalo
        for (let i = 0; i < n; i++) {
          const ganho = Math.min(1, i / (taxa * 0.4), (n - i) / (taxa * 1));
          dados.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i] * ganho)) * 32767, true);
          dados.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i] * ganho)) * 32767, true);
        }
        const bytes = new Uint8Array(dados.buffer);
        let s = '';
        for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
        return btoa(s);
      },
      { sons, duracao: a.total / a.fps },
    );
    fs.writeFileSync(destinoWav, Buffer.from(b64, 'base64'));
  } finally {
    await browser.close();
  }
}

/** Junta os quadros (e a trilha) num MP4 H.264 yuv420p com faststart, e tira a capa. */
function montar(a, wav, capa) {
  const saida = path.resolve(ROOT, a.saida);
  fs.mkdirSync(path.dirname(saida), { recursive: true });
  const ext = a.jpg ? 'jpg' : 'png';
  const faltando = [];
  for (let k = 0; k < a.total; k++) if (!fs.existsSync(nomeQuadro(a, k))) faltando.push(k);
  if (faltando.length) throw new Error(`faltam ${faltando.length} quadros (o primeiro é o ${faltando[0]}): rode de novo sem --so-montar`);
  const args = ['-y', '-loglevel', 'error', '-framerate', String(a.fps), '-i', path.join(a.quadros, `q%05d.${ext}`)];
  if (wav) args.push('-i', wav);
  args.push('-frames:v', String(a.total), '-c:v', 'libx264', '-preset', 'slow', '-crf', String(a.crf), '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-tune', 'animation');
  args.push('-vf', `scale=${a.largura}:${a.altura}:flags=lanczos`, '-r', String(a.fps));
  if (wav) args.push('-c:a', 'aac', '-b:a', '192k', '-shortest');
  args.push('-movflags', '+faststart', saida);
  log('montando', path.relative(ROOT, saida));
  execFileSync('ffmpeg', args, { stdio: 'inherit' });
  const k = Math.max(0, Math.min(a.total - 1, a.capa != null ? Math.round(a.capa * a.fps) : capa ?? Math.round(a.total / 2)));
  const capaJpg = path.join(path.dirname(saida), 'capa.jpg');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', nomeQuadro(a, k), '-q:v', '2', capaJpg], { stdio: 'inherit' });
  log(`capa: quadro ${k} (${(k / a.fps).toFixed(2)} s) → ${path.relative(ROOT, capaJpg)}`);
  return saida;
}

function rodarProcesso(a, faixa) {
  const args = [__filename, ...process.argv.slice(2).filter((x, i, arr) => x !== '--faixa' && arr[i - 1] !== '--faixa'), '--faixa', `${faixa[0]}:${faixa[1]}`];
  return new Promise((ok, falha) => {
    const p = spawn(process.execPath, args, { stdio: 'inherit' });
    p.on('exit', (c) => (c === 0 ? ok() : falha(new Error(`a faixa ${faixa[0]}-${faixa[1] - 1} terminou com código ${c}`))));
  });
}

async function main() {
  const a = parseArgs(process.argv.slice(2));
  if (a.faixa) return gravarFaixa(a);
  if (a.medir > 0) return medir(a);
  if (a.previa) return previa(a);

  log(`${a.largura}x${a.altura}, ${a.fps} quadros/s, ${a.duracao} s = ${a.total} quadros, qualidade ${a.q}, 3D em ${Math.round(1080 * a.resolucao3d)}x${Math.round(1920 * a.resolucao3d)}`);
  log(`roteiro: fila inicial ${a.fila}; ${a.eventos.map((e) => `${e.t}s ${e.acao}${e.acao === 'entrar' ? (e.valor > 1 ? `=${e.valor}` : '') : `=${e.valor}`}`).join(', ')}`);
  fs.mkdirSync(a.quadros, { recursive: true });
  const planoArq = path.join(a.quadros, 'plano.json');
  log('simulando sem desenhar (linha do tempo e sons)...');
  const plano = await planejar(a);
  fs.writeFileSync(planoArq, JSON.stringify(plano, null, 1));
  for (const l of plano.linhas) log(`  ${l.t.toFixed(2).padStart(6)} s  ${l.fase || '-'} | atendido ${l.atendido || '-'} | fila ${l.fila} | na tela ${l.naTela} ${l.presente ? '| ' + l.presente : ''}`);
  log(`  sons: ${plano.sons.map(([t, n]) => `${t.toFixed(2)} ${n}`).join(', ')}`);
  if (plano.erros.length) log(`  console: ${plano.erros.join(' / ')}`);
  if (a.plano) return;

  if (!a.soMontar) {
    const p = Math.max(1, Math.min(a.processos, a.total));
    const faixas = [];
    for (let i = 0; i < p; i++) faixas.push([Math.floor((a.total * i) / p), Math.floor((a.total * (i + 1)) / p)]);
    const t0 = Date.now();
    await Promise.all(faixas.map((f) => rodarProcesso(a, f)));
    log(`quadros prontos em ${((Date.now() - t0) / 60000).toFixed(1)} min`);
  }
  let wav = null;
  if (a.audio) {
    wav = path.join(a.quadros, 'trilha.wav');
    log('renderizando a trilha offline...');
    await renderizarAudio(a, plano.sons, wav);
  }
  const saida = montar(a, wav, plano.capa);
  const st = fs.statSync(saida);
  log(`pronto: ${path.relative(ROOT, saida)} (${(st.size / 1048576).toFixed(1)} MB)`);
}

main().catch((err) => {
  console.error(String(err && err.stack ? err.stack : err));
  process.exitCode = 1;
});
