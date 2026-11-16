/**
 * Texturas dos presentes, todas desenhadas por código (nada baixado, nada protegido): relevos (normal) de
 * tricô, cetim, massa de biscoito, neve e esmalte, e as estampas pintadas à mão (bola, bengala, caneca,
 * meia e o papel da caixa), sempre na paleta do jogo. Sorteio com semente: saem iguais em toda foto.
 * São criadas uma vez (cache do módulo) e compartilhadas por todas as cópias.
 */
import * as THREE from 'three';
import { criarSorteio } from '../noel/util';

/** Ruído de valor em grade que fecha nas bordas (ladrilhável), de 0 a 1. */
export function ruidoLadrilho(tam: number, celulas: number, semente: number, celulasY = celulas): Float32Array {
  const r = criarSorteio(semente);
  const grade = new Float32Array(celulas * celulasY);
  for (let i = 0; i < grade.length; i++) grade[i] = r();
  const out = new Float32Array(tam * tam);
  const s = (t: number) => t * t * (3 - 2 * t);
  for (let y = 0; y < tam; y++)
    for (let x = 0; x < tam; x++) {
      const fx = (x / tam) * celulas;
      const fy = (y / tam) * celulasY;
      const x0 = Math.floor(fx);
      const y0 = Math.floor(fy);
      const tx = s(fx - x0);
      const ty = s(fy - y0);
      const g = (ix: number, iy: number) => grade[(iy % celulasY) * celulas + (ix % celulas)];
      const a = g(x0, y0) + (g(x0 + 1, y0) - g(x0, y0)) * tx;
      const b = g(x0, y0 + 1) + (g(x0 + 1, y0 + 1) - g(x0, y0 + 1)) * tx;
      out[y * tam + x] = a + (b - a) * ty;
    }
  return out;
}

function dados(bytes: Uint8Array, tam: number, srgb: boolean, alturaPx = tam): THREE.DataTexture {
  const t = new THREE.DataTexture(bytes, tam, alturaPx, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 4;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.needsUpdate = true;
  return t;
}

/** Converte um mapa de alturas ladrilhável em mapa de normal (padrão OpenGL). */
export function normalDeAlturas(alt: Float32Array, tam: number, forca: number, forcaY = forca): THREE.DataTexture {
  const b = new Uint8Array(tam * tam * 4);
  const h = (x: number, y: number) => alt[((y + tam) % tam) * tam + ((x + tam) % tam)];
  for (let y = 0; y < tam; y++)
    for (let x = 0; x < tam; x++) {
      const dx = (h(x + 1, y) - h(x - 1, y)) * forca;
      const dy = (h(x, y + 1) - h(x, y - 1)) * forcaY;
      const l = Math.hypot(dx, dy, 1);
      const i = (y * tam + x) * 4;
      b[i] = Math.round((-dx / l) * 127.5 + 127.5);
      b[i + 1] = Math.round((-dy / l) * 127.5 + 127.5);
      b[i + 2] = Math.round((1 / l) * 127.5 + 127.5);
      b[i + 3] = 255;
    }
  return dados(b, tam, false);
}

function telaParaTextura(tela: HTMLCanvasElement, srgb = true): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(tela);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.needsUpdate = true;
  return t;
}

/** Mancha de pincel: variação leve de tom (a tinta nunca é chapada). Multiplica os pixels da tela. */
function manchar(c: CanvasRenderingContext2D, w: number, h: number, forca: number, semente: number) {
  const img = c.getImageData(0, 0, w, h);
  const tam = 256;
  const largo = ruidoLadrilho(tam, 5, semente);
  const fino = ruidoLadrilho(tam, 60, semente + 1);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const k = Math.floor((y / h) * tam) * tam + Math.floor((x / w) * tam);
      const v = 1 + (largo[k] - 0.5) * forca + (fino[k] - 0.5) * forca * 0.6;
      const i = (y * w + x) * 4;
      img.data[i] = Math.min(255, img.data[i] * v);
      img.data[i + 1] = Math.min(255, img.data[i + 1] * v);
      img.data[i + 2] = Math.min(255, img.data[i + 2] * v);
    }
  c.putImageData(img, 0, 0);
}

/** Floco de neve desenhado a pincel (seis braços com raminhos), centrado em (x, y). */
function floco(c: CanvasRenderingContext2D, x: number, y: number, r: number, giro: number, espessura: number) {
  c.save();
  c.translate(x, y);
  c.rotate(giro);
  c.lineCap = 'round';
  c.lineWidth = espessura;
  for (let k = 0; k < 6; k++) {
    c.rotate(Math.PI / 3);
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(0, -r);
    c.moveTo(0, -r * 0.55);
    c.lineTo(-r * 0.22, -r * 0.75);
    c.moveTo(0, -r * 0.55);
    c.lineTo(r * 0.22, -r * 0.75);
    c.stroke();
  }
  c.beginPath();
  c.arc(0, 0, espessura * 0.9, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

const cache = new Map<string, THREE.Texture>();
function guardado<T extends THREE.Texture>(chave: string, fazer: () => T): T {
  let t = cache.get(chave);
  if (!t) {
    t = fazer();
    cache.set(chave, t);
  }
  return t as T;
}

/** Descarta todas as texturas do cache (fim do jogo). */
export function liberarTexturas() {
  for (const t of cache.values()) t.dispose();
  cache.clear();
}

/* ---------------------------------------------------------------------- relevos */

/** Metal trabalhado à mão: covinhas largas e rasas e um escovado fino em uma direção (ladrilho ~6 cm). */
export function normalMetal(): THREE.DataTexture {
  return guardado('metal', () => {
    const tam = 256;
    const a = ruidoLadrilho(tam, 9, 21);
    const b = ruidoLadrilho(tam, 23, 22);
    const escova = ruidoLadrilho(tam, 2, 23, 160);
    const alt = new Float32Array(tam * tam);
    for (let i = 0; i < alt.length; i++) alt[i] = a[i] * 0.8 + b[i] * 0.3 + escova[i] * 0.22;
    return normalDeAlturas(alt, tam, 1.4);
  });
}

/** Esmalte de cerâmica e laca: ondulação muito suave da camada de tinta (pinceladas). */
export function normalEsmalte(): THREE.DataTexture {
  return guardado('esmalte', () => {
    const tam = 256;
    const a = ruidoLadrilho(tam, 6, 31);
    const b = ruidoLadrilho(tam, 3, 32, 18);
    const alt = new Float32Array(tam * tam);
    for (let i = 0; i < alt.length; i++) alt[i] = a[i] * 0.6 + b[i] * 0.5;
    return normalDeAlturas(alt, tam, 0.9);
  });
}

/** Madeira pintada: o veio aparece por baixo da tinta (linhas compridas em V). */
export function normalMadeira(): THREE.DataTexture {
  return guardado('madeira', () => {
    const tam = 256;
    const veio = ruidoLadrilho(tam, 3, 41, 64);
    const largo = ruidoLadrilho(tam, 4, 42);
    const alt = new Float32Array(tam * tam);
    for (let y = 0; y < tam; y++)
      for (let x = 0; x < tam; x++) {
        const i = y * tam + x;
        const anel = Math.sin((x / tam) * Math.PI * 2 * 7 + largo[i] * 5 + veio[i] * 2.5);
        alt[i] = anel * 0.35 + veio[i] * 0.5;
      }
    return normalDeAlturas(alt, tam, 0.9);
  });
}

/**
 * Meia-malha de tricô: cada ponto é um "V" de duas pernas inclinadas, com altura e inclinação sorteadas.
 * Ladrilho de 8 x 8 pontos; repetir a textura com (colunas / 8, carreiras / 8).
 */
export function normalTrico(): THREE.DataTexture {
  return guardado('trico', () => {
    const tam = 256;
    const pontos = 8;
    const r = criarSorteio(77);
    const var1: number[] = [];
    for (let i = 0; i < pontos * pontos; i++) var1.push(0.85 + 0.3 * r());
    const alt = new Float32Array(tam * tam);
    const fibra = ruidoLadrilho(tam, 64, 78);
    for (let y = 0; y < tam; y++)
      for (let x = 0; x < tam; x++) {
        const px = (x / tam) * pontos;
        const py = (y / tam) * pontos;
        const ix = Math.floor(px);
        const iy = Math.floor(py);
        const u = px - ix;
        const v = py - iy;
        const k = var1[iy * pontos + ix];
        const perna = (cx: number, inc: number) => {
          const dx = u - cx - (v - 0.5) * inc;
          const d = Math.pow(dx / 0.21, 2) + Math.pow((v - 0.5) / 0.6, 2);
          return Math.max(0, 1 - d);
        };
        alt[y * tam + x] = Math.sqrt(Math.max(perna(0.27, -0.4), perna(0.73, 0.4))) * k + fibra[y * tam + x] * 0.12;
      }
    return normalDeAlturas(alt, tam, 2.6);
  });
}

/** Cetim: trama finíssima ao longo da fita e um leve ondulado. */
export function normalCetim(): THREE.DataTexture {
  return guardado('cetim', () => {
    const tam = 128;
    const trama = ruidoLadrilho(tam, 2, 51, 96);
    const onda = ruidoLadrilho(tam, 3, 52);
    const alt = new Float32Array(tam * tam);
    for (let i = 0; i < alt.length; i++) alt[i] = trama[i] * 0.25 + onda[i] * 0.6;
    return normalDeAlturas(alt, tam, 1.2);
  });
}

/** Massa de biscoito assada: grumos, poros e rachadinhas rasas (ladrilho ~5 cm). */
export function normalMassa(): THREE.DataTexture {
  return guardado('massa', () => {
    const tam = 256;
    const a = ruidoLadrilho(tam, 7, 61);
    const b = ruidoLadrilho(tam, 22, 62);
    const c = ruidoLadrilho(tam, 70, 63);
    const r = criarSorteio(64);
    const alt = new Float32Array(tam * tam);
    for (let i = 0; i < alt.length; i++) alt[i] = a[i] * 0.7 + b[i] * 0.45 + c[i] * 0.2;
    // poros: covinhas pequenas e redondas
    for (let k = 0; k < 160; k++) {
      const cx = r() * tam;
      const cy = r() * tam;
      const rr = 1.5 + r() * 3;
      for (let y = Math.floor(cy - rr); y <= cy + rr; y++)
        for (let x = Math.floor(cx - rr); x <= cx + rr; x++) {
          const d = Math.hypot(x - cx, y - cy) / rr;
          if (d >= 1) continue;
          const i = (((y % tam) + tam) % tam) * tam + (((x % tam) + tam) % tam);
          alt[i] -= 0.35 * (1 - d * d);
        }
    }
    return normalDeAlturas(alt, tam, 2.2);
  });
}

/** Neve compactada: grão miúdo e irregular com cristais. */
export function normalNeve(): THREE.DataTexture {
  return guardado('neve', () => {
    const tam = 256;
    const a = ruidoLadrilho(tam, 12, 71);
    const b = ruidoLadrilho(tam, 48, 72);
    const c = ruidoLadrilho(tam, 110, 73);
    const alt = new Float32Array(tam * tam);
    for (let i = 0; i < alt.length; i++) alt[i] = a[i] * 0.6 + b[i] * 0.5 + c[i] * 0.4;
    return normalDeAlturas(alt, tam, 2.4);
  });
}

/** Feltro e lã batida: fibras curtas emaranhadas. */
export function normalFeltro(): THREE.DataTexture {
  return guardado('feltro', () => {
    const tam = 128;
    const a = ruidoLadrilho(tam, 40, 81);
    const b = ruidoLadrilho(tam, 12, 82);
    const alt = new Float32Array(tam * tam);
    for (let i = 0; i < alt.length; i++) alt[i] = a[i] * 0.6 + b[i] * 0.4;
    return normalDeAlturas(alt, tam, 2.0);
  });
}

/* --------------------------------------------------------------------- estampas */

/** Fração da altura das estampas (bola, caneca) usada pela pintura; acima disso a tela é branca. */
export const USO_ESTAMPA = 0.92;
/** V das peças que, na mesma malha, não levam estampa (ficam só com a cor do vértice). */
export const V_BRANCO = 0.985;

const VERMELHO = '#B62835';
const DOURADO = '#E8BC65';
const NEVE = '#F7F4EF';

/**
 * Bengala doce: listras em espiral pintadas no açúcar (larga vermelha, fina verde, entre elas o branco
 * leitoso), com o tom do açúcar levemente manchado. u = em volta, v = ao longo; a espiral nasce de
 * desenhar as listras inclinadas: repetir com (1, comprimento / passo).
 */
export function mapaBengala(): THREE.CanvasTexture {
  return guardado('bengala', () => {
    const w = 256;
    const h = 256;
    const tela = document.createElement('canvas');
    tela.width = w;
    tela.height = h;
    const c = tela.getContext('2d', { willReadFrequently: true })!;
    c.fillStyle = '#d6cab6';
    c.fillRect(0, 0, w, h);
    // listras inclinadas (uma volta completa em u desce uma listra inteira em v: a espiral fecha sem costura)
    const faixa = (desloc: number, largura: number, cor: string) => {
      c.fillStyle = cor;
      for (const dy of [-h, 0, h]) {
        c.beginPath();
        c.moveTo(0, desloc + dy);
        c.lineTo(w, desloc + dy + h);
        c.lineTo(w, desloc + dy + h + largura);
        c.lineTo(0, desloc + dy + largura);
        c.closePath();
        c.fill();
      }
    };
    faixa(20, 92, '#b3202f');
    faixa(140, 16, '#2a6a4c');
    faixa(170, 8, '#c23a44');
    manchar(c, w, h, 0.1, 91);
    return telaParaTextura(tela);
  });
}

/**
 * Bola de Natal: laca vermelho-escura pintada à mão com flocos creme e pontinhos dourados em duas
 * fileiras (acima e abaixo da faixa dourada em relevo, que é geometria). u = em volta, v = de baixo a cima.
 */
export function mapaBola(): THREE.CanvasTexture {
  return guardado('bola', () => {
    const w = 1024;
    const h = 512;
    const tela = document.createElement('canvas');
    tela.width = w;
    tela.height = h;
    const c = tela.getContext('2d', { willReadFrequently: true })!;
    // a bola usa v de 0 a USO; a faixa de cima (v > USO) é branca: as peças douradas da mesma malha
    // (capacete, faixa em relevo) leem a cor só do vértice
    const Y = (v: number) => h - v * USO_ESTAMPA * h;
    const g = c.createLinearGradient(0, Y(1), 0, Y(0));
    g.addColorStop(0, '#5e0d16');
    g.addColorStop(0.5, '#a51f2e');
    g.addColorStop(1, '#5e0d16');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, w, Math.ceil(Y(1)) - 2);
    const r = criarSorteio(101);
    c.strokeStyle = NEVE;
    c.fillStyle = NEVE;
    const n = 6;
    for (let k = 0; k < n; k++) {
      const x = ((k + 0.5) / n) * w;
      // flocos alternados acima e abaixo da faixa
      const cima = k % 2 === 0;
      const y = Y(cima ? 0.7 : 0.3);
      c.globalAlpha = 0.92;
      floco(c, x, y, 30 + r() * 6, r() * 0.5, 5);
      // trio de pontinhos dourados do outro lado
      c.fillStyle = DOURADO;
      const y2 = Y(cima ? 0.31 : 0.69);
      for (const [dx, dy, rr] of [
        [0, 0, 7],
        [-22, 12, 4.5],
        [22, 12, 4.5],
      ] as const) {
        c.beginPath();
        c.arc(x + dx, y2 + (cima ? dy : -dy), rr, 0, Math.PI * 2);
        c.fill();
      }
      c.fillStyle = NEVE;
    }
    c.globalAlpha = 1;
    // filetes finos creme acompanhando a faixa dourada
    c.strokeStyle = 'rgba(247,244,239,0.75)';
    c.lineWidth = 3;
    for (const v of [0.43, 0.57]) {
      c.beginPath();
      for (let x = 0; x <= w; x += 8) c.lineTo(x, Y(v) + Math.sin((x / w) * Math.PI * 2 * 12) * 4);
      c.stroke();
    }
    manchar(c, w, h, 0.08, 102);
    const t = telaParaTextura(tela);
    t.wrapT = THREE.ClampToEdgeWrapping;
    return t;
  });
}

/**
 * Caneca: esmalte vermelho com flocos e pontos creme pintados à mão, filete creme perto da boca e da base.
 * u = em volta (uma volta = largura inteira), v = de baixo (0) a cima (1) do corpo.
 */
export function mapaCaneca(): THREE.CanvasTexture {
  return guardado('caneca', () => {
    const w = 1024;
    const h = 384;
    const tela = document.createElement('canvas');
    tela.width = w;
    tela.height = h;
    const c = tela.getContext('2d', { willReadFrequently: true })!;
    const Y = (v: number) => h - v * USO_ESTAMPA * h;
    c.fillStyle = VERMELHO;
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, w, Math.ceil(Y(1)) - 2);
    const r = criarSorteio(111);
    c.strokeStyle = NEVE;
    c.fillStyle = NEVE;
    // flocos em duas fileiras desencontradas
    for (let k = 0; k < 7; k++) {
      const x = ((k + 0.5) / 7) * w;
      const y = Y(k % 2 ? 0.6 : 0.38) + (r() - 0.5) * 12;
      floco(c, x, y, 34 + r() * 8, r(), 5.5);
      for (let j = 0; j < 4; j++) {
        c.beginPath();
        c.arc(x + 60 + r() * 40, y + (r() - 0.5) * 110, 3 + r() * 3, 0, Math.PI * 2);
        c.fill();
      }
    }
    // filetes: creme largo perto da boca e fino perto da base
    c.fillRect(0, Y(0.9), w, 10);
    c.fillRect(0, Y(0.1), w, 6);
    manchar(c, w, h, 0.1, 112);
    const t = telaParaTextura(tela);
    t.wrapT = THREE.ClampToEdgeWrapping;
    return t;
  });
}

/**
 * Meia de tricô: cada pixel é um ponto (colunas em volta, carreiras ao longo), desenhado em jacquard:
 * vermelho de base, faixa verde com pinheirinhos creme logo abaixo do punho, flocos creme no meio,
 * calcanhar e biqueira verdes. u = em volta (0,5 = atrás), v = do punho (1) ao bico (0).
 * Usa filtro "mais próximo" para cada ponto ficar com a sua cor, como no tricô de verdade.
 */
export const MEIA_COLUNAS = 48;
export const MEIA_CARREIRAS = 96;
export function mapaMeia(): THREE.DataTexture {
  return guardado('meia', () => {
    const W = MEIA_COLUNAS;
    const H = MEIA_CARREIRAS;
    const b = new Uint8Array(W * H * 4);
    const cor = (hex: string) => {
      const n = parseInt(hex.slice(1), 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
    };
    const vermelho = cor('#a8202e');
    const verde = cor('#1d5a42');
    const creme = cor('#efe6d6');
    const r = criarSorteio(121);
    const pinheiro = ['...#...', '..###..', '.#####.', '..###..', '.#####.', '#######', '...#...'];
    const flocoP = ['#.#.#', '.###.', '##.##', '.###.', '#.#.#'];
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const v = y / (H - 1); // 0 = bico, 1 = punho (a textura sobe com v)
        let c: readonly [number, number, number] = vermelho;
        // faixa verde com pinheirinhos (carreiras perto do punho)
        const yf = H - 1 - y; // contado a partir do punho
        // as primeiras ~12 carreiras ficam escondidas sob o punho de pelúcia
        if (yf >= 13 && yf <= 24) {
          c = verde;
          if (yf === 13 || yf === 24) c = creme;
          const px = x % 8;
          const py = yf - 15;
          if (py >= 0 && py < 7 && px < 7 && pinheiro[py][px] === '#') c = creme;
        }
        // fileira de pontinhos
        if (yf === 28 && x % 4 === 1) c = creme;
        // flocos espalhados no meio da perna
        if (yf >= 33 && yf < 65) {
          const cx = Math.floor(x / 12);
          const cy = Math.floor((yf - 33) / 16);
          const ox = x - cx * 12 - ((cy % 2) * 6 + 3);
          const oy = yf - 33 - cy * 16 - 5;
          if (ox >= 0 && ox < 5 && oy >= 0 && oy < 5 && flocoP[oy][ox] === '#') c = creme;
        }
        // calcanhar (atrás, na dobra) e biqueira
        const atras = Math.abs(x / W - 0.5) < 0.24;
        if (atras && v > 0.2 && v < 0.33) c = verde;
        if (v < 0.11) c = verde;
        if ((atras && (Math.abs(v - 0.2) < 0.006 || Math.abs(v - 0.33) < 0.006)) || Math.abs(v - 0.11) < 0.006) c = creme;
        const k = 0.94 + 0.12 * r();
        const i = (y * W + x) * 4;
        b[i] = Math.min(255, c[0] * k);
        b[i + 1] = Math.min(255, c[1] * k);
        b[i + 2] = Math.min(255, c[2] * k);
        b[i + 3] = 255;
      }
    const t = new THREE.DataTexture(b, W, H, THREE.RGBAFormat);
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.ClampToEdgeWrapping;
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true;
    return t;
  });
}

/**
 * Papel da caixa de presente (padrão original): vermelho #B62835 com estrelinhas douradas de quatro pontas
 * desenhadas a pincel, pontinhos de neve e um losango fino dourado ligando tudo. Ladrilho de ~14 cm.
 */
export function mapaPapelCaixa(): THREE.CanvasTexture {
  return guardado('papel-caixa', () => {
    const tam = 512;
    const tela = document.createElement('canvas');
    tela.width = tela.height = tam;
    const c = tela.getContext('2d', { willReadFrequently: true })!;
    // vermelho da paleta (contrasta com a árvore verde atrás da entrega), com um véu mais escuro em
    // diagonal para o papel não ficar chapado
    c.fillStyle = VERMELHO;
    c.fillRect(0, 0, tam, tam);
    const veu = c.createLinearGradient(0, 0, tam, tam);
    veu.addColorStop(0, 'rgba(90,10,20,0.0)');
    veu.addColorStop(0.5, 'rgba(90,10,20,0.16)');
    veu.addColorStop(1, 'rgba(90,10,20,0.0)');
    c.fillStyle = veu;
    c.fillRect(0, 0, tam, tam);
    const r = criarSorteio(131);
    // treliça fina em losango (linha dourada falhada)
    c.strokeStyle = 'rgba(232,188,101,0.38)';
    c.lineWidth = 2;
    for (let k = -2; k <= 2; k++) {
      for (const s of [1, -1]) {
        c.beginPath();
        for (let x = -tam; x <= 2 * tam; x += 12) {
          const y = s * x + k * tam * 0.5 + (s < 0 ? tam : 0);
          c.lineTo(x, y + Math.sin(x * 0.05) * 1.2);
        }
        c.stroke();
      }
    }
    // estrelas de quatro pontas nos cruzamentos e meio das células
    const estrela = (x: number, y: number, rr: number, cor: string) => {
      c.fillStyle = cor;
      for (const dx of [-tam, 0, tam])
        for (const dy of [-tam, 0, tam]) {
          c.beginPath();
          for (let p = 0; p < 8; p++) {
            const a = (p / 8) * Math.PI * 2 + 0.1;
            const raio = p % 2 === 0 ? rr : rr * 0.28;
            c.lineTo(x + dx + Math.cos(a) * raio, y + dy + Math.sin(a) * raio);
          }
          c.closePath();
          c.fill();
        }
    };
    for (let j = 0; j < 4; j++)
      for (let i = 0; i < 4; i++) {
        const x = (i + (j % 2) * 0.5) * (tam / 4) + (tam / 8) * 0;
        const y = j * (tam / 4);
        estrela(x + (r() - 0.5) * 4, y + (r() - 0.5) * 4, 20 + r() * 4, DOURADO);
        // pontinhos de neve em volta
        c.fillStyle = NEVE;
        for (let p = 0; p < 3; p++) {
          const a = r() * Math.PI * 2;
          const d = 38 + r() * 14;
          c.beginPath();
          c.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, 2.4 + r() * 1.6, 0, Math.PI * 2);
          c.fill();
        }
      }
    manchar(c, tam, tam, 0.12, 132);
    return telaParaTextura(tela);
  });
}

/** Ponto de luz macio (para os flocos do globo e o vapor). */
export function manchaMacia(): THREE.DataTexture {
  return guardado('mancha', () => {
    const tam = 64;
    const b = new Uint8Array(tam * tam * 4);
    for (let y = 0; y < tam; y++)
      for (let x = 0; x < tam; x++) {
        const d = Math.min(1, Math.hypot((x + 0.5) / tam - 0.5, (y + 0.5) / tam - 0.5) * 2);
        const v = Math.pow(1 - d * d, 2);
        const i = (y * tam + x) * 4;
        b[i] = b[i + 1] = b[i + 2] = 255;
        b[i + 3] = Math.round(v * 255);
      }
    const t = dados(b, tam, false);
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    return t;
  });
}
