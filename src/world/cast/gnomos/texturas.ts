/**
 * Texturas desenhadas por código (síncronas, com semente fixa) para os gnomos:
 *   tricô    ponto de meia em "V" com fios torcidos; canal R = sombra do ponto, canal G = máscara do
 *            motivo natalino (flocos e pontinhos em jacquard), relevo em mapa de normais;
 *   feltro   fibras emaranhadas (normal) com leve variação de tom;
 *   fios     mechas de barba: fios finos ao longo de v (cor e normal), para o brilho anisotrópico;
 *   olhos    atlas 2x2 com quatro íris (azul, verde, castanho, mel), pupila e brilho pintado;
 *   poros    relevo miúdo da pele (normal), para a pele não parecer plástico.
 * Tudo é DataTexture (não precisa de canvas), gerado uma vez e compartilhado por todos os gnomos.
 */
import * as THREE from 'three';
import { criarSorteio, fbm3, limitar, ruido3, suave } from './util';

export interface TexturasGnomo {
  tricoCor: THREE.DataTexture;
  tricoNormal: THREE.DataTexture;
  feltroCor: THREE.DataTexture;
  feltroNormal: THREE.DataTexture;
  fiosCor: THREE.DataTexture;
  fiosNormal: THREE.DataTexture;
  olhos: THREE.DataTexture;
  porosNormal: THREE.DataTexture;
  /** Fios soltos com alfa (cartões no contorno da barba). */
  cartoes: THREE.DataTexture;
  dispose(): void;
}

/** Tamanho do ladrilho de tricô: 16 pontos de largura por 20 carreiras. */
export const TRICO_PONTOS = 16;
export const TRICO_CARREIRAS = 20;

function textura(dados: Uint8Array, w: number, h: number, cor: boolean): THREE.DataTexture {
  const t = new THREE.DataTexture(dados, w, h, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 8;
  t.colorSpace = cor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.needsUpdate = true;
  return t;
}

/** Mapa de normais a partir de um mapa de altura (com repetição nas bordas). */
function normalDeAltura(alt: Float32Array, w: number, h: number, forca: number): Uint8Array {
  const out = new Uint8Array(w * h * 4);
  const at = (x: number, y: number) => alt[((y + h) % h) * w + ((x + w) % w)];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const dx = (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x - 1, y) - at(x - 1, y + 1)) * forca;
      const dy = (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1)) * forca;
      // DataTexture não inverte Y: a linha 0 é v = 0. A normal em espaço tangente usa +v para cima.
      let nx = -dx;
      let ny = -dy;
      let nz = 1;
      const l = Math.hypot(nx, ny, nz);
      nx /= l;
      ny /= l;
      nz /= l;
      const i = (y * w + x) * 4;
      out[i] = Math.round((nx * 0.5 + 0.5) * 255);
      out[i + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      out[i + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      out[i + 3] = 255;
    }
  return out;
}

/* ---------------------------------------------------------------------------- tricô */

/** Motivo em jacquard (8 carreiras de 16 pontos), lido de cima para baixo. '#' = ponto na cor do motivo. */
const MOTIVO = [
  '#...#...#...#...',
  '................',
  '...#.......#....',
  '.#.#.#...#.#.#..',
  '..###.....###...',
  '#######.#######.',
  '..###.....###...',
  '.#.#.#...#.#.#..',
  '...#.......#....',
  '................',
  '..#...#...#...#.',
];
/** Primeira carreira (de baixo) do motivo dentro do ladrilho. */
const MOTIVO_BASE = 4;

function gerarTrico(): { cor: Uint8Array; normal: Uint8Array; w: number; h: number } {
  const w = 512;
  const h = 640;
  const cw = w / TRICO_PONTOS; // 32 px por ponto
  const ch = h / TRICO_CARREIRAS; // 32 px por carreira
  const alt = new Float32Array(w * h);
  const sombra = new Float32Array(w * h);
  const mascara = new Uint8Array(w * h);
  const sorteio = criarSorteio(91);
  // pequena irregularidade por ponto (pontos mais frouxos, mais apertados)
  const jit = Array.from({ length: TRICO_PONTOS * TRICO_CARREIRAS }, () => [sorteio() - 0.5, sorteio() - 0.5, sorteio(), 0.85 + sorteio() * 0.3, 0.88 + sorteio() * 0.24]);
  // cada carreira desliza um pouco de lado (o fio puxa), para as colunas não ficarem retas demais
  const desliza = Array.from({ length: TRICO_CARREIRAS }, (_, r) => 0.16 * Math.sin(r * 1.7) + (sorteio() - 0.5) * 0.18);
  const motivo = (col: number, row: number) => {
    const r = row - MOTIVO_BASE;
    if (r < 0 || r >= MOTIVO.length) return false;
    const linha = MOTIVO[MOTIVO.length - 1 - r];
    return linha[col % 16] === '#';
  };
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let melhor = 0;
      let dono = -1;
      // cada ponto (V) tem duas pernas inclinadas; a perna desce da borda de cima até o meio de baixo
      // e invade um pouco a carreira de baixo (os pontos se encaixam).
      const row0 = Math.floor(y / ch);
      for (let dr = 0; dr <= 1; dr++) {
        const row = (row0 + dr) % TRICO_CARREIRAS;
        const col0 = Math.floor(x / cw);
        for (let dc = -1; dc <= 1; dc++) {
          const col = (col0 + dc + TRICO_PONTOS) % TRICO_PONTOS;
          const j = jit[row * TRICO_PONTOS + col];
          // coordenadas locais do ponto: lx de -1 a 1 na largura, ly de 0 (baixo) a 1 (cima)
          let px = x - (col0 + dc) * cw - cw / 2 - desliza[row] * cw;
          if (px < -w / 2) px += w;
          if (px > w / 2) px -= w;
          const py = y - (row0 + dr) * ch;
          const lx = px / (cw / 2);
          const ly = py / ch;
          for (const lado of [-1, 1]) {
            // eixo da perna: de (lado*0.55, 1.05) até (lado*0.05, -0.35)
            const ax = lado * (0.56 + j[0] * 0.08);
            const ay = 1.08;
            const bx = lado * 0.04;
            const by = -0.38 + j[1] * 0.06;
            const vx = bx - ax;
            const vy = by - ay;
            const len2 = vx * vx + vy * vy;
            const t = limitar(((lx - ax) * vx + (ly - ay) * vy) / len2, 0, 1);
            const qx = ax + vx * t - lx;
            const qy = ay + vy * t - ly;
            // distância perpendicular, com a perna em forma de grão (mais gorda no meio)
            const larg = 0.36 * (0.75 + 0.35 * Math.sin(Math.PI * t)) * (0.95 + j[2] * 0.1);
            const d = Math.hypot(qx, qy * 0.8) / larg;
            if (d < 1) {
              // fio torcido: listras diagonais ao longo da perna
              const torcao = 0.12 * Math.sin((t * 5.5 + (lx * lado) * 1.8) * Math.PI * 2);
              const hgt = Math.sqrt(1 - d * d) * (0.85 + 0.15 * Math.sin(Math.PI * t)) + torcao * (1 - d);
              // a perna de cima de uma carreira passa por cima da de baixo
              const z = hgt * j[3] + (dr === 0 ? 0.08 : 0);
              if (z > melhor) {
                melhor = z;
                dono = row * TRICO_PONTOS + col;
              }
            }
          }
        }
      }
      // penugem (fibras soltas)
      const fiapo = 0.05 * fbm3(x * 0.21, y * 0.21, 0, 2, 7) + 0.03 * ruido3(x * 0.9, y * 0.35, 1, 9);
      const i = y * w + x;
      alt[i] = melhor + fiapo;
      sombra[i] = dono < 0 ? 0.3 : (0.6 + 0.4 * suave(0, 0.75, melhor) + fiapo * 1.2) * jit[dono][4];
      if (dono >= 0) mascara[i] = motivo(dono % TRICO_PONTOS, Math.floor(dono / TRICO_PONTOS)) ? 255 : 0;
    }
  const cor = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    cor[i * 4] = Math.round(limitar(sombra[i], 0, 1) * 255);
    cor[i * 4 + 1] = mascara[i];
    cor[i * 4 + 2] = 0;
    cor[i * 4 + 3] = 255;
  }
  return { cor, normal: normalDeAltura(alt, w, h, 1.6), w, h };
}

/* --------------------------------------------------------------------------- feltro */

function gerarFeltro(): { cor: Uint8Array; normal: Uint8Array; w: number; h: number } {
  const w = 256;
  const h = 256;
  const alt = new Float32Array(w * h);
  const cor = new Uint8Array(w * h * 4);
  // ruído periódico: amostra em um toro para o ladrilho não ter emenda
  const per = (x: number, y: number, f: number, s: number) => {
    const a = (x / w) * Math.PI * 2;
    const b = (y / h) * Math.PI * 2;
    return fbm3(Math.cos(a) * f, Math.sin(a) * f, Math.cos(b) * f + Math.sin(b) * f * 0.7 + 3, 4, s) * 0.6 + fbm3(Math.sin(b) * f, Math.cos(b) * f, Math.cos(a) * f * 0.5, 3, s + 5) * 0.4;
  };
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const a = per(x, y, 3, 1);
      const b = per(x, y, 9, 2);
      const fibra = Math.abs(per(x, y, 14, 3));
      const v = a * 0.12 + b * 0.38 + (0.25 - fibra) * 0.7;
      alt[y * w + x] = v;
      const c = Math.round(limitar(0.86 + v * 0.18, 0, 1) * 255);
      const i = (y * w + x) * 4;
      cor[i] = cor[i + 1] = cor[i + 2] = c;
      cor[i + 3] = 255;
    }
  return { cor, normal: normalDeAltura(alt, w, h, 1.2), w, h };
}

/* ----------------------------------------------------------------------------- fios */

function gerarFios(): { cor: Uint8Array; normal: Uint8Array; w: number; h: number } {
  const w = 256;
  const h = 512;
  const alt = new Float32Array(w * h);
  const tom = new Float32Array(w * h).fill(0);
  const sorteio = criarSorteio(23);
  // fios: cada um é uma linha ondulada quase vertical, com espessura e brilho próprios
  const fios = Array.from({ length: 220 }, () => ({ x: sorteio() * w, larg: 0.7 + sorteio() * 1.6, onda: 2 + sorteio() * 4, fase: sorteio() * 6.28, brilho: 0.55 + sorteio() * 0.45, ciclos: 1 + Math.floor(sorteio() * 2) }));
  for (const f of fios)
    for (let y = 0; y < h; y++) {
      const cx = f.x + Math.sin((y / h) * Math.PI * 2 * f.ciclos + f.fase) * f.onda;
      const x0 = Math.floor(cx - f.larg - 1);
      const x1 = Math.ceil(cx + f.larg + 1);
      for (let x = x0; x <= x1; x++) {
        const d = Math.abs(x + 0.5 - cx) / f.larg;
        if (d >= 1) continue;
        const xx = ((x % w) + w) % w;
        const i = y * w + xx;
        const z = Math.sqrt(1 - d * d) * (0.6 + 0.4 * f.brilho);
        if (z > alt[i]) {
          alt[i] = z;
          tom[i] = f.brilho;
        }
      }
    }
  const cor = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const fundo = alt[i] === 0;
      const c = fundo ? 0.74 : 0.8 + 0.2 * tom[i] * (0.7 + 0.3 * alt[i]);
      cor[i * 4] = cor[i * 4 + 1] = cor[i * 4 + 2] = Math.round(limitar(c, 0, 1) * 255);
      cor[i * 4 + 3] = 255;
    }
  return { cor, normal: normalDeAltura(alt, w, h, 0.9), w, h };
}

/* ----------------------------------------------------------------------------- olhos */

/** Cores das íris do atlas (quadrantes 0..3). */
export const IRIS = ['#3f78b8', '#4f8a47', '#6b3f1f', '#a0702c'];

function gerarOlhos(): { cor: Uint8Array; w: number; h: number } {
  const w = 512;
  const h = 512;
  const cor = new Uint8Array(w * h * 4);
  const meio = w / 2;
  for (let q = 0; q < 4; q++) {
    const iris = new THREE.Color(IRIS[q]);
    const ox = (q % 2) * meio;
    const oy = Math.floor(q / 2) * meio;
    for (let y = 0; y < meio; y++)
      for (let x = 0; x < meio; x++) {
        // coordenadas -1..1 no quadrante (a projeção frontal do globo)
        const lx = ((x + 0.5) / meio) * 2 - 1;
        const ly = ((y + 0.5) / meio) * 2 - 1;
        const r = Math.hypot(lx, ly);
        const ang = Math.atan2(ly, lx);
        // esclera: branco quente, um pouco rosado e mais escuro para as bordas
        let cr = 0.93 - 0.12 * suave(0.55, 1, r);
        let cg = 0.9 - 0.16 * suave(0.55, 1, r);
        let cb = 0.86 - 0.16 * suave(0.55, 1, r);
        const RI = 0.6;
        const RP = 0.26;
        if (r < RI + 0.02) {
          // íris: fibras radiais, anel escuro na borda, colarinho claro perto da pupila
          const fibras = 0.75 + 0.25 * ruido3(ang * 9, r * 6, q, 4) + 0.12 * Math.sin(ang * 40 + r * 8);
          const borda = 1 - 0.55 * suave(RI - 0.1, RI, r);
          const colar = 1 + 0.45 * Math.exp(-Math.pow((r - RP - 0.07) / 0.05, 2));
          const k = fibras * borda * colar;
          const ir = iris.r * k;
          const ig = iris.g * k;
          const ib = iris.b * k;
          const m = suave(RI + 0.02, RI - 0.01, r);
          cr = cr * (1 - m) + ir * m;
          cg = cg * (1 - m) + ig * m;
          cb = cb * (1 - m) + ib * m;
          const pm = suave(RP + 0.015, RP - 0.01, r);
          cr *= 1 - 0.96 * pm;
          cg *= 1 - 0.96 * pm;
          cb *= 1 - 0.96 * pm;
        }
        // brilho pintado (janela de luz) em cima, à esquerda, e um menor embaixo
        const b1 = suave(0.14, 0.09, Math.hypot(lx + 0.2, ly - 0.24));
        const b2 = suave(0.06, 0.035, Math.hypot(lx - 0.2, ly + 0.2));
        const b = Math.max(b1, b2 * 0.8);
        cr = cr * (1 - b) + b;
        cg = cg * (1 - b) + b;
        cb = cb * (1 - b) + b;
        const i = ((oy + y) * w + ox + x) * 4;
        // grava em sRGB
        cor[i] = Math.round(Math.pow(limitar(cr, 0, 1), 1 / 2.2) * 255);
        cor[i + 1] = Math.round(Math.pow(limitar(cg, 0, 1), 1 / 2.2) * 255);
        cor[i + 2] = Math.round(Math.pow(limitar(cb, 0, 1), 1 / 2.2) * 255);
        cor[i + 3] = 255;
      }
  }
  return { cor, w, h };
}

/* ----------------------------------------------------------------------------- poros */

function gerarPoros(): { normal: Uint8Array; w: number; h: number } {
  const w = 256;
  const h = 256;
  const alt = new Float32Array(w * h);
  const per = (x: number, y: number, f: number, s: number) => {
    const a = (x / w) * Math.PI * 2;
    const b = (y / h) * Math.PI * 2;
    return fbm3(Math.cos(a) * f + Math.cos(b) * f * 0.3, Math.sin(a) * f, Math.sin(b) * f + 2, 3, s);
  };
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) alt[y * w + x] = per(x, y, 6, 3) * 0.6 - Math.max(0, per(x, y, 22, 8)) * 0.8;
  return { normal: normalDeAltura(alt, w, h, 0.7), w, h };
}

/* --------------------------------------------------------------------------- cartões */

/**
 * Fios soltos para os cartões do contorno da barba: em u, tufos de fios ondulados que nascem em v = 0
 * e acabam em alturas diferentes (a ponta de cada fio afina). Alfa = 1 no fio; R = tom do fio.
 */
function gerarCartoes(): { cor: Uint8Array; w: number; h: number } {
  const w = 128;
  const h = 256;
  const cor = new Uint8Array(w * h * 4);
  const sorteio = criarSorteio(57);
  const fios = Array.from({ length: 70 }, () => ({ x: sorteio() * w, fim: 0.45 + sorteio() * 0.55, larg: 0.8 + sorteio() * 1.1, onda: 1.5 + sorteio() * 4, fase: sorteio() * 6.28, tom: 0.6 + sorteio() * 0.4, curva: (sorteio() - 0.5) * 18 }));
  for (const f of fios)
    for (let y = 0; y < h; y++) {
      const v = y / h;
      if (v > f.fim) break;
      const afina = 1 - suave(f.fim * 0.6, f.fim, v);
      const cx = f.x + Math.sin(v * Math.PI * 2 + f.fase) * f.onda + f.curva * v * v;
      const lg = f.larg * (0.35 + 0.65 * afina);
      for (let x = Math.floor(cx - lg - 1); x <= Math.ceil(cx + lg + 1); x++) {
        const d = Math.abs(x + 0.5 - cx) / lg;
        if (d >= 1) continue;
        const xx = ((x % w) + w) % w;
        const i = (y * w + xx) * 4;
        const a = Math.round((1 - d * d) * 255);
        if (a > cor[i + 3]) {
          cor[i] = cor[i + 1] = cor[i + 2] = Math.round(f.tom * 255);
          cor[i + 3] = a;
        }
      }
    }
  return { cor, w, h };
}

let cache: TexturasGnomo | null = null;
let usuarios = 0;

/** Texturas compartilhadas (geradas na primeira chamada). Chame `soltar()` quando não precisar mais. */
export function pegarTexturas(): TexturasGnomo {
  usuarios++;
  if (cache) return cache;
  const tr = gerarTrico();
  const fe = gerarFeltro();
  const fi = gerarFios();
  const ol = gerarOlhos();
  const po = gerarPoros();
  const ca = gerarCartoes();
  const lista = [
    textura(tr.cor, tr.w, tr.h, false),
    textura(tr.normal, tr.w, tr.h, false),
    textura(fe.cor, fe.w, fe.h, true),
    textura(fe.normal, fe.w, fe.h, false),
    textura(fi.cor, fi.w, fi.h, true),
    textura(fi.normal, fi.w, fi.h, false),
    textura(ol.cor, ol.w, ol.h, true),
    textura(po.normal, po.w, po.h, false),
    textura(ca.cor, ca.w, ca.h, false),
  ];
  const [tricoCor, tricoNormal, feltroCor, feltroNormal, fiosCor, fiosNormal, olhos, porosNormal, cartoes] = lista;
  cartoes.wrapT = THREE.ClampToEdgeWrapping;
  olhos.wrapS = olhos.wrapT = THREE.ClampToEdgeWrapping;
  cache = {
    tricoCor,
    tricoNormal,
    feltroCor,
    feltroNormal,
    fiosCor,
    fiosNormal,
    olhos,
    porosNormal,
    cartoes,
    dispose() {
      for (const t of lista) t.dispose();
    },
  };
  return cache;
}

export function soltarTexturas(): void {
  usuarios = Math.max(0, usuarios - 1);
  if (usuarios === 0 && cache) {
    cache.dispose();
    cache = null;
  }
}
