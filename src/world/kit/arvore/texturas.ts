/**
 * Texturas feitas por código (determinísticas): relevo de papel amassado e de metal batido, e as estampas
 * dos papéis de presente. São pequenas e ficam só na memória (nada é baixado).
 */
import * as THREE from 'three';
import { criarSorteio } from './util';

/** Ruído de valor em grade que fecha nas bordas (ladrilhável), de 0 a 1. */
function ruidoLadrilho(tam: number, celulas: number, semente: number): Float32Array {
  const r = criarSorteio(semente);
  const grade = new Float32Array(celulas * celulas);
  for (let i = 0; i < grade.length; i++) grade[i] = r();
  const out = new Float32Array(tam * tam);
  const s = (t: number) => t * t * (3 - 2 * t);
  for (let y = 0; y < tam; y++)
    for (let x = 0; x < tam; x++) {
      const fx = (x / tam) * celulas;
      const fy = (y / tam) * celulas;
      const x0 = Math.floor(fx);
      const y0 = Math.floor(fy);
      const tx = s(fx - x0);
      const ty = s(fy - y0);
      const g = (ix: number, iy: number) => grade[(iy % celulas) * celulas + (ix % celulas)];
      const a = g(x0, y0) + (g(x0 + 1, y0) - g(x0, y0)) * tx;
      const b = g(x0, y0 + 1) + (g(x0 + 1, y0 + 1) - g(x0, y0 + 1)) * tx;
      out[y * tam + x] = a + (b - a) * ty;
    }
  return out;
}

/** Converte um mapa de alturas ladrilhável em mapa de normal (padrão OpenGL). */
function normalDeAlturas(alturas: Float32Array, tam: number, forca: number): THREE.DataTexture {
  const dados = new Uint8Array(tam * tam * 4);
  const h = (x: number, y: number) => alturas[((y + tam) % tam) * tam + ((x + tam) % tam)];
  for (let y = 0; y < tam; y++)
    for (let x = 0; x < tam; x++) {
      const dx = (h(x + 1, y) - h(x - 1, y)) * forca;
      const dy = (h(x, y + 1) - h(x, y - 1)) * forca;
      const l = Math.hypot(dx, dy, 1);
      const i = (y * tam + x) * 4;
      dados[i] = Math.round((-dx / l) * 127.5 + 127.5);
      dados[i + 1] = Math.round((-dy / l) * 127.5 + 127.5);
      dados[i + 2] = Math.round((1 / l) * 127.5 + 127.5);
      dados[i + 3] = 255;
    }
  const t = new THREE.DataTexture(dados, tam, tam, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

/**
 * Papel de embrulho: vincos retos e finos (o papel foi dobrado e alisado), algumas dobras longas e a fibra
 * miúda do papel. Nada de relevo em nuvem: papel é liso entre um vinco e outro.
 */
export function normalDePapel(): THREE.DataTexture {
  const tam = 256;
  const r = criarSorteio(31);
  const fino = ruidoLadrilho(tam, 110, 13);
  const largo = ruidoLadrilho(tam, 3, 11);
  const alturas = new Float32Array(tam * tam);
  for (let i = 0; i < alturas.length; i++) alturas[i] = fino[i] * 0.05 + largo[i] * 0.25;
  // cada vinco é um segmento reto com perfil em V; os longos atravessam o ladrilho quase inteiro
  const vincos: Array<{ x: number; y: number; dx: number; dy: number; comp: number; fundo: number; meia: number }> = [];
  for (let i = 0; i < 26; i++) {
    const a = r() * Math.PI;
    const longo = i < 4;
    vincos.push({ x: r() * tam, y: r() * tam, dx: Math.cos(a), dy: Math.sin(a), comp: longo ? 150 + r() * 80 : 22 + r() * 70, fundo: (longo ? 0.5 : 0.28) * (r() < 0.5 ? 1 : -1) * (0.6 + 0.4 * r()), meia: longo ? 2.2 : 1.4 });
  }
  for (let y = 0; y < tam; y++)
    for (let x = 0; x < tam; x++) {
      let h = 0;
      for (const v of vincos) {
        // distância ao segmento, com a volta do ladrilho
        let px = x - v.x;
        let py = y - v.y;
        px -= Math.round(px / tam) * tam;
        py -= Math.round(py / tam) * tam;
        const t = px * v.dx + py * v.dy;
        if (t < 0 || t > v.comp) continue;
        const d = Math.abs(px * v.dy - py * v.dx);
        if (d > v.meia) continue;
        // o vinco morre nas pontas
        const ponta = Math.min(1, Math.min(t, v.comp - t) / 12);
        h += v.fundo * (1 - d / v.meia) * ponta;
      }
      alturas[y * tam + x] += h;
    }
  return normalDeAlturas(alturas, tam, 1.5);
}

/** Pelúcia: grão miúdo e irregular, para a barra da saia não ler como plástico liso. */
export function normalDePelucia(): THREE.DataTexture {
  const tam = 128;
  const a = ruidoLadrilho(tam, 64, 51);
  const b = ruidoLadrilho(tam, 24, 52);
  const c = ruidoLadrilho(tam, 9, 53);
  const alturas = new Float32Array(tam * tam);
  for (let i = 0; i < alturas.length; i++) alturas[i] = a[i] * 0.5 + b[i] * 0.7 + c[i] * 0.5;
  return normalDeAlturas(alturas, tam, 3.2);
}

/** Rugosidade do latão envelhecido: mais polido nas partes gastas, mais fosco nas covinhas (canal verde). */
export function rugosidadeDeMetal(): THREE.DataTexture {
  const tam = 128;
  const a = ruidoLadrilho(tam, 7, 61);
  const b = ruidoLadrilho(tam, 29, 62);
  const dados = new Uint8Array(tam * tam * 4);
  for (let i = 0; i < tam * tam; i++) {
    const v = 0.24 + 0.2 * a[i] + 0.06 * b[i];
    dados[i * 4] = 255;
    dados[i * 4 + 1] = Math.round(v * 255);
    dados[i * 4 + 2] = 255;
    dados[i * 4 + 3] = 255;
  }
  const t = new THREE.DataTexture(dados, tam, tam, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

/** Mancha redonda e macia (branco no meio, preto na borda), para halos e sombra de contato. */
export function manchaRedonda(tam = 64, expoente = 2): THREE.DataTexture {
  const dados = new Uint8Array(tam * tam * 4);
  for (let y = 0; y < tam; y++)
    for (let x = 0; x < tam; x++) {
      const dx = (x + 0.5) / tam - 0.5;
      const dy = (y + 0.5) / tam - 0.5;
      const d = Math.min(1, Math.hypot(dx, dy) * 2);
      const v = Math.pow(1 - d * d, expoente);
      const i = (y * tam + x) * 4;
      dados[i] = dados[i + 1] = dados[i + 2] = Math.round(v * 255);
      dados[i + 3] = 255;
    }
  const t = new THREE.DataTexture(dados, tam, tam, THREE.RGBAFormat);
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

/** Metal batido à mão: covinhas largas e rasas. */
export function normalDeMetalBatido(): THREE.DataTexture {
  const tam = 128;
  const a = ruidoLadrilho(tam, 9, 21);
  const b = ruidoLadrilho(tam, 23, 22);
  const alturas = new Float32Array(tam * tam);
  for (let i = 0; i < alturas.length; i++) alturas[i] = a[i] + b[i] * 0.35;
  return normalDeAlturas(alturas, tam, 1.6);
}

export type Estampa = 'liso' | 'listras' | 'bolinhas' | 'kraft' | 'xadrez';

/** Estampa de papel de presente em uma tela de 256 px (um ladrilho de cerca de 12 cm). */
function telaDePapel(estampa: Estampa, fundo: string, figura: string, semente: number): HTMLCanvasElement {
  const tam = 256;
  const tela = document.createElement('canvas');
  tela.width = tela.height = tam;
  const c = tela.getContext('2d', { willReadFrequently: true })!;
  const r = criarSorteio(semente);
  c.fillStyle = fundo;
  c.fillRect(0, 0, tam, tam);
  if (estampa === 'listras') {
    c.fillStyle = figura;
    // listras finas em pares, como papel de embrulho antigo
    for (let x = 0; x < tam; x += 64) {
      c.fillRect(x + 8, 0, 14, tam);
      c.fillRect(x + 30, 0, 4, tam);
    }
  } else if (estampa === 'bolinhas') {
    c.fillStyle = figura;
    for (let j = 0; j < 4; j++)
      for (let i = 0; i < 4; i++) {
        const x = i * 64 + (j % 2 ? 32 : 0) + 16;
        const y = j * 64 + 32;
        c.beginPath();
        c.arc(x, y, 9, 0, Math.PI * 2);
        c.fill();
        if (x + 9 > tam) {
          c.beginPath();
          c.arc(x - tam, y, 9, 0, Math.PI * 2);
          c.fill();
        }
      }
  } else if (estampa === 'xadrez') {
    c.globalAlpha = 0.55;
    c.fillStyle = figura;
    for (let i = 0; i < tam; i += 64) {
      c.fillRect(i, 0, 26, tam);
      c.fillRect(0, i, tam, 26);
    }
    c.globalAlpha = 1;
  }
  // manchas leves de tinta e fibras, para a cor não ficar chapada
  const img = c.getImageData(0, 0, tam, tam);
  const largo = ruidoLadrilho(tam, 6, semente + 3);
  const fibra = ruidoLadrilho(tam, 80, semente + 4);
  const forca = estampa === 'kraft' ? 0.1 : 0.06;
  for (let i = 0; i < tam * tam; i++) {
    const v = 1 + (largo[i] - 0.5) * forca + (fibra[i] - 0.5) * forca * 1.2;
    img.data[i * 4] = Math.min(255, img.data[i * 4] * v);
    img.data[i * 4 + 1] = Math.min(255, img.data[i * 4 + 1] * v);
    img.data[i * 4 + 2] = Math.min(255, img.data[i * 4 + 2] * v);
  }
  c.putImageData(img, 0, 0);
  if (estampa === 'kraft' && figura !== '#000000') {
    // carimbo artesanal: estrelinhas claras em grade desencontrada, com tinta falhada
    c.fillStyle = figura;
    for (let j = 0; j < 2; j++)
      for (let i = 0; i < 2; i++) {
        const cx = i * 128 + (j % 2 ? 64 : 0) + 40 + (r() - 0.5) * 10;
        const cy = j * 128 + 64 + (r() - 0.5) * 10;
        const giro = r() * 1.2;
        c.globalAlpha = 0.55 + 0.3 * r();
        for (const dx of [0, -tam, tam]) {
          c.beginPath();
          for (let p = 0; p < 10; p++) {
            const a = giro + (p / 10) * Math.PI * 2;
            const rr = p % 2 === 0 ? 13 : 5.4;
            c.lineTo(cx + dx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
          }
          c.closePath();
          c.fill();
        }
      }
    c.globalAlpha = 1;
  }
  if (estampa === 'kraft') {
    // fibras escuras soltas do papel pardo
    c.strokeStyle = 'rgba(70,45,25,0.25)';
    c.lineWidth = 1;
    for (let i = 0; i < 90; i++) {
      const x = r() * tam;
      const y = r() * tam;
      const a = r() * Math.PI;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + Math.cos(a) * 7, y + Math.sin(a) * 7);
      c.stroke();
    }
  }
  return tela;
}

export interface PapelDef {
  estampa: Estampa;
  fundo: string;
  figura: string;
}

/**
 * Todos os papéis de presente em UMA textura em camadas (uma camada por papel, cada uma ladrilhável):
 * os presentes viram uma malha só, e cada um escolhe a sua camada por atributo de vértice.
 */
export function papeisDePresente(papeis: PapelDef[], semente: number): THREE.DataArrayTexture {
  const tam = 256;
  const dados = new Uint8Array(tam * tam * 4 * papeis.length);
  papeis.forEach((p, i) => {
    const tela = telaDePapel(p.estampa, p.fundo, p.figura, semente + i * 7);
    dados.set(tela.getContext('2d')!.getImageData(0, 0, tam, tam).data, i * tam * tam * 4);
  });
  const t = new THREE.DataArrayTexture(dados, tam, tam, papeis.length);
  t.format = THREE.RGBAFormat;
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}
