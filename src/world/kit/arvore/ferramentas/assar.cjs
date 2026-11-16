#!/usr/bin/env node
/**
 * Ferramenta de preparação da árvore (não vai para o jogo). Abre assar.html no servidor do laboratório
 * (http://127.0.0.1:5180), que modela os ramos de abeto com agulhas em geometria, e:
 *   node assar.cjs ver <saida.png> [tam]   folha de contato com todas as variantes iluminadas (para olhar)
 *   node assar.cjs atlas                   assa as nove variantes e grava o atlas 3x3 (2048 px) em
 *                                          public/assets/arvore/ramo_cor.webp (cor + recorte) e
 *                                          public/assets/arvore/ramo_normal.webp (normal em RG, altura em B)
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const sharp = require('sharp');

const RAIZ = path.resolve(__dirname, '../../../../..');
const LADO = 2048;
const GRADE = 3;

async function abrir() {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1100, height: 1100 } });
  page.on('console', (m) => { if (m.type() === 'error') console.error('console:', m.text().slice(0, 300)); });
  page.on('pageerror', (e) => console.error('erro da página:', String(e.message).slice(0, 300)));
  await page.goto('http://127.0.0.1:5180/src/world/kit/arvore/ferramentas/assar.html', { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => window.__assar && (window.__assar.pronto || window.__assar.erro), null, { timeout: 240000 });
  const erro = await page.evaluate(() => window.__assar.erro);
  if (erro) throw new Error(erro);
  const variantes = await page.evaluate(() => window.__assar.variantes);
  const foto = async (pedido) => Buffer.from((await page.evaluate((p) => window.__assar.foto(p), pedido)).split(',')[1], 'base64');
  return { browser, foto, variantes };
}

/** Folha de contato com as variantes iluminadas de cima. */
async function ver(saida, tam = 512) {
  const { browser, foto, variantes } = await abrir();
  try {
    const pecas = [];
    for (let i = 0; i < variantes; i++) pecas.push({ input: await foto({ modo: 'ver', variante: i, tam }), left: (i % GRADE) * tam, top: Math.floor(i / GRADE) * tam });
    await sharp({ create: { width: tam * GRADE, height: tam * Math.ceil(variantes / GRADE), channels: 3, background: '#30343c' } }).composite(pecas).png().toFile(saida);
    console.log(saida);
  } finally {
    await browser.close();
  }
}

/** Espalha a cor dos pixels opacos para dentro dos transparentes (evita halo escuro nas bordas e nos mipmaps). */
function dilatar(dados, canais, alfa, w, h, passadas) {
  const cheio = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) cheio[i] = alfa[i] > 40 ? 1 : 0;
  for (let p = 0; p < passadas; p++) {
    const novo = [];
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (cheio[i]) continue;
        let r = 0, g = 0, b = 0, n = 0;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx, yy = y + dy;
            if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
            const j = yy * w + xx;
            if (!cheio[j]) continue;
            r += dados[j * canais]; g += dados[j * canais + 1]; b += dados[j * canais + 2]; n++;
          }
        if (n) novo.push(i, r / n, g / n, b / n);
      }
    for (let k = 0; k < novo.length; k += 4) {
      const i = novo[k];
      dados[i * canais] = novo[k + 1]; dados[i * canais + 1] = novo[k + 2]; dados[i * canais + 2] = novo[k + 3];
      cheio[i] = 1;
    }
  }
}

/** Média da altura em volta de cada pixel (só onde há ramo), em um quadrado de raio `raio`, repetida três vezes. */
function borrar(a, alfa, w, h, raio) {
  let v = new Float32Array(w * h);
  let p = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    p[i] = alfa[i] > 40 ? 1 : 0;
    v[i] = (a[i * 4] / 255) * p[i];
  }
  const passada = (src, dx, dy) => {
    const out = new Float32Array(w * h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        let soma = 0;
        for (let k = -raio; k <= raio; k++) {
          const xx = x + dx * k, yy = y + dy * k;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          soma += src[yy * w + xx];
        }
        out[y * w + x] = soma;
      }
    return out;
  };
  for (let n = 0; n < 2; n++) {
    v = passada(passada(v, 1, 0), 0, 1);
    p = passada(passada(p, 1, 0), 0, 1);
  }
  const out = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) out[i] = p[i] > 0 ? v[i] / p[i] : 0;
  return out;
}

async function atlas() {
  const { browser, foto, variantes } = await abrir();
  const destino = path.join(RAIZ, 'public', 'assets', 'arvore');
  fs.mkdirSync(destino, { recursive: true });
  const cor = Buffer.alloc(LADO * LADO * 4);
  const nor = Buffer.alloc(LADO * LADO * 3, 128);
  const coberturas = [];
  try {
    for (let k = 0; k < Math.min(variantes, GRADE * GRADE); k++) {
      const x0 = Math.round(((k % GRADE) * LADO) / GRADE);
      const y0 = Math.round((Math.floor(k / GRADE) * LADO) / GRADE);
      const cel = Math.round((((k % GRADE) + 1) * LADO) / GRADE) - x0;
      const celY = Math.round(((Math.floor(k / GRADE) + 1) * LADO) / GRADE) - y0;
      // fotografa com três vezes mais pixels e reduz: bordas das agulhas suaves, sem serrilhado
      const ler = async (modo) => sharp(await foto({ modo, variante: k, tam: cel * 3 })).resize(cel, celY, { kernel: 'lanczos3' }).ensureAlpha().raw().toBuffer();
      const c = await ler('cor');
      const n = await ler('normal');
      const a = await ler('altura');
      const alfa = new Uint8Array(cel * celY);
      let cheios = 0;
      for (let i = 0; i < cel * celY; i++) {
        alfa[i] = c[i * 4 + 3];
        if (alfa[i] > 107) cheios++;
      }
      coberturas.push(Math.round((cheios / (cel * celY)) * 100));
      // oclusão assada na cor: as partes baixas do ramo e os vãos entre as agulhas (onde a altura fica abaixo
      // da média em volta) escurecem; as cristas clareiam um pouco. É o que dá profundidade ao leque.
      const media = borrar(a, alfa, cel, celY, 5);
      for (let i = 0; i < cel * celY; i++) {
        const h = a[i * 4] / 255;
        const fundo = 0.6 + 0.4 * Math.min(1, Math.max(0, (h - 0.25) / 0.4));
        const dif = h - media[i];
        const vao = dif < 0 ? 1 - 0.55 * Math.min(1, -dif / 0.06) : 1 + 0.14 * Math.min(1, dif / 0.05);
        const f = fundo * vao;
        c[i * 4] = Math.min(255, c[i * 4] * f); c[i * 4 + 1] = Math.min(255, c[i * 4 + 1] * f); c[i * 4 + 2] = Math.min(255, c[i * 4 + 2] * f);
      }
      dilatar(c, 4, alfa, cel, celY, 40);
      dilatar(n, 4, alfa, cel, celY, 40);
      dilatar(a, 4, alfa, cel, celY, 40);
      for (let y = 0; y < celY; y++)
        for (let x = 0; x < cel; x++) {
          const i = (y * cel + x) * 4;
          const j = (y0 + y) * LADO + x0 + x;
          cor[j * 4] = c[i]; cor[j * 4 + 1] = c[i + 1]; cor[j * 4 + 2] = c[i + 2]; cor[j * 4 + 3] = alfa[y * cel + x];
          // normal: x e y no vermelho e no verde; no azul vai a altura (claro = agulha de cima, escuro = de baixo)
          nor[j * 3] = n[i]; nor[j * 3 + 1] = n[i + 1]; nor[j * 3 + 2] = a[i];
        }
      console.log('ramo', k, 'assado; cobertura', coberturas[k] + '%');
    }
  } finally {
    await browser.close();
  }
  const fCor = path.join(destino, 'ramo_cor.webp');
  const fNor = path.join(destino, 'ramo_normal.webp');
  await sharp(cor, { raw: { width: LADO, height: LADO, channels: 4 } }).webp({ quality: 86, alphaQuality: 92, effort: 6 }).toFile(fCor);
  await sharp(nor, { raw: { width: LADO, height: LADO, channels: 3 } }).webp({ quality: 84, effort: 6 }).toFile(fNor);
  // cópia em PNG só para conferir no laboratório (não é embarcada)
  const conf = path.join(RAIZ, 'lab', 'fotos', 'kit-arvore', 'assar');
  fs.mkdirSync(conf, { recursive: true });
  await sharp(cor, { raw: { width: LADO, height: LADO, channels: 4 } }).resize(1536).flatten({ background: '#30343c' }).png().toFile(path.join(conf, 'atlas-cor.png'));
  await sharp(nor, { raw: { width: LADO, height: LADO, channels: 3 } }).resize(1024).png().toFile(path.join(conf, 'atlas-normal.png'));
  for (const f of [fCor, fNor]) console.log(path.relative(RAIZ, f), Math.round(fs.statSync(f).size / 1024), 'kB');
}

const [cmd, a, b] = process.argv.slice(2);
const tabela = { ver: () => ver(a, b ? Number(b) : 512), atlas };
if (!tabela[cmd]) {
  console.log('uso: node assar.cjs ver <saida.png> [tam] | atlas');
  process.exit(1);
}
tabela[cmd]().catch((e) => { console.error(e); process.exit(1); });
