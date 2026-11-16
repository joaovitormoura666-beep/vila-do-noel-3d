/**
 * Texturas desenhadas por código (sem arquivo): a máscara dos fios da pelúcia e o papel dos presentes.
 * Tudo com sorteio de semente: sai igual em toda foto.
 */
import * as THREE from 'three';
import { criarSorteio, fbm3 } from './util';

/**
 * Máscara dos fios para o pelo em cascas, em TUFOS: a pelúcia de luxo não é um gramado de fios soltos,
 * é feita de tufinhos (6 a 10 fios que se juntam e afinam para a ponta). Cada tufo tem uma altura; os
 * fios do meio do tufo são mais altos e os da borda mais baixos, e cada fio é um cone (afina na ponta).
 * O valor é a altura do fio naquele ponto (0 a 1): a casca na altura h só desenha onde a máscara passa
 * de h. Entre os tufos há penugem baixa. Ladrilha sem costura.
 */
export function mascaraDePelo(tam = 256, tufos = 150, semente = 11): THREE.DataTexture {
  const dados = new Float32Array(tam * tam);
  const sorteio = criarSorteio(semente);
  const pinta = (cx: number, cy: number, r: number, h: number, ponta: number) => {
    const r2 = r * r;
    const x0 = Math.floor(cx - r);
    const x1 = Math.ceil(cx + r);
    const y0 = Math.floor(cy - r);
    const y1 = Math.ceil(cy + r);
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        const d2 = (dx * dx + dy * dy) / r2;
        if (d2 >= 1) continue;
        const val = h * Math.pow(1 - Math.sqrt(d2), ponta);
        const ix = ((x % tam) + tam) % tam;
        const iy = ((y % tam) + tam) % tam;
        const i = iy * tam + ix;
        if (val > dados[i]) dados[i] = val;
      }
  };
  // penugem baixa entre os tufos
  for (let k = 0; k < 2600; k++) pinta(sorteio() * tam, sorteio() * tam, 1.2 + sorteio() * 0.8, 0.12 + 0.25 * sorteio(), 0.8);
  for (let k = 0; k < tufos; k++) {
    const cx = sorteio() * tam;
    const cy = sorteio() * tam;
    // a altura dos tufos varia em manchas (a pelúcia assenta em ondas)
    const mancha = 0.5 + 0.5 * fbm3((cx / tam) * 5, (cy / tam) * 5, 0.5, 2, 3);
    const H = (0.55 + 0.45 * Math.pow(sorteio(), 0.5)) * (0.6 + 0.4 * mancha);
    const rc = 9 + sorteio() * 6;
    const n = 7 + Math.floor(sorteio() * 5);
    for (let j = 0; j < n; j++) {
      const a = sorteio() * Math.PI * 2;
      const d = Math.sqrt(sorteio()) * rc * 0.75;
      const h = H * (1 - 0.45 * (d / rc)) * (0.85 + 0.15 * sorteio());
      pinta(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 2.2 + sorteio() * 1.4, h, 0.65);
    }
  }
  const bytes = new Uint8Array(tam * tam * 4);
  for (let i = 0; i < tam * tam; i++) {
    const v = Math.round(Math.min(1, dados[i]) * 255);
    bytes[i * 4] = v;
    bytes[i * 4 + 1] = v;
    bytes[i * 4 + 2] = v;
    bytes[i * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(bytes, tam, tam, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Papel de presente em atlas 2 x 2 (cada quadrante um papel): listras vermelhas e creme, verde com
 * bolinhas douradas, dourado com losangos, azul-noite com estrelinhas. A cor vai pronta no mapa (sRGB).
 */
export function papelDePresente(tam = 256): THREE.DataTexture {
  const bytes = new Uint8Array(tam * tam * 4);
  const meio = tam / 2;
  const put = (x: number, y: number, c: readonly [number, number, number]) => {
    const i = (y * tam + x) * 4;
    bytes[i] = c[0];
    bytes[i + 1] = c[1];
    bytes[i + 2] = c[2];
    bytes[i + 3] = 255;
  };
  const vermelho = [168, 22, 34] as const;
  const creme = [240, 228, 205] as const;
  const verde = [24, 82, 58] as const;
  const dourado = [214, 168, 82] as const;
  const azul = [28, 42, 78] as const;
  const ouroClaro = [236, 204, 128] as const;
  for (let y = 0; y < tam; y++)
    for (let x = 0; x < tam; x++) {
      const qx = x < meio ? 0 : 1;
      const qy = y < meio ? 0 : 1;
      const lx = (x % meio) / meio;
      const ly = (y % meio) / meio;
      let c: readonly [number, number, number];
      if (qx === 0 && qy === 0) {
        // listras diagonais
        const f = (lx + ly) * 6;
        c = f - Math.floor(f) < 0.5 ? vermelho : creme;
      } else if (qx === 1 && qy === 0) {
        // bolinhas
        const gx = lx * 5 - Math.floor(lx * 5) - 0.5;
        const gy = ly * 5 - Math.floor(ly * 5) - 0.5;
        c = gx * gx + gy * gy < 0.06 ? dourado : verde;
      } else if (qx === 0 && qy === 1) {
        // losangos
        const gx = Math.abs(lx * 4 - Math.floor(lx * 4) - 0.5);
        const gy = Math.abs(ly * 4 - Math.floor(ly * 4) - 0.5);
        c = gx + gy < 0.32 ? ouroClaro : gx + gy < 0.38 ? creme : dourado;
      } else {
        // estrelinhas (cruzes finas)
        const gx = Math.abs(lx * 4 - Math.floor(lx * 4) - 0.5);
        const gy = Math.abs(ly * 4 - Math.floor(ly * 4) - 0.5);
        c = (gx < 0.04 && gy < 0.2) || (gy < 0.04 && gx < 0.2) ? ouroClaro : azul;
      }
      put(x, y, c);
    }
  const tex = new THREE.DataTexture(bytes, tam, tam, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Fios penteados das mechas (barba, bigode, sobrancelhas): fios finos (2 a 4 px) correndo ao longo de v,
 * cada um ondulando um pouco, com alturas sorteadas. Devolve o mapa de cor (variação clara/escura dos
 * fios, sutil) e o mapa de NORMAL (o relevo fino dos fios), os dois ladrilháveis. Com a anisotropia do
 * material, o brilho corre ao longo dos fios.
 */
export function texturaDeFios(tam = 256, fios = 70, semente = 5): { cor: THREE.DataTexture; normal: THREE.DataTexture } {
  const h = new Float32Array(tam * tam);
  const sorteio = criarSorteio(semente);
  for (let k = 0; k < fios; k++) {
    const x0 = sorteio() * tam;
    const amp = 0.45 + 0.55 * sorteio();
    const larg = 1.0 + sorteio() * 1.0;
    const ond = 1 + Math.floor(sorteio() * 2);
    const fase = sorteio() * Math.PI * 2;
    const desvio = 1.5 + sorteio() * 2.5;
    for (let y = 0; y < tam; y++) {
      const cx = x0 + desvio * Math.sin((y / tam) * Math.PI * 2 * ond + fase);
      // o fio some e reaparece de leve ao longo do comprimento (fios que se cruzam)
      const a = amp * (0.75 + 0.25 * Math.sin((y / tam) * Math.PI * 2 * (ond + 1) + fase * 1.7));
      for (let dx = -4; dx <= 4; dx++) {
        const x = Math.floor(cx) + dx;
        const d = (x + 0.5 - cx) / larg;
        const val = a * Math.exp(-d * d);
        const ix = ((x % tam) + tam) % tam;
        const i = y * tam + ix;
        h[i] = Math.max(h[i], val);
      }
    }
  }
  const cor = new Uint8Array(tam * tam * 4);
  const nor = new Uint8Array(tam * tam * 4);
  const H = (x: number, y: number) => h[(((y % tam) + tam) % tam) * tam + (((x % tam) + tam) % tam)];
  const forca = 2.2;
  for (let y = 0; y < tam; y++)
    for (let x = 0; x < tam; x++) {
      const i = (y * tam + x) * 4;
      const v = h[y * tam + x];
      const c = Math.round((0.84 + 0.16 * v) * 255);
      cor[i] = c;
      cor[i + 1] = c;
      cor[i + 2] = c;
      cor[i + 3] = 255;
      const nx = -(H(x + 1, y) - H(x - 1, y)) * forca;
      const ny = -(H(x, y + 1) - H(x, y - 1)) * forca * 0.3;
      const l = Math.hypot(nx, ny, 1);
      nor[i] = Math.round(((nx / l) * 0.5 + 0.5) * 255);
      nor[i + 1] = Math.round(((ny / l) * 0.5 + 0.5) * 255);
      nor[i + 2] = Math.round(((1 / l) * 0.5 + 0.5) * 255);
      nor[i + 3] = 255;
    }
  const fazer = (b: Uint8Array) => {
    const tex = new THREE.DataTexture(b, tam, tam, THREE.RGBAFormat);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    tex.colorSpace = THREE.NoColorSpace;
    tex.anisotropy = 4;
    tex.needsUpdate = true;
    return tex;
  };
  return { cor: fazer(cor), normal: fazer(nor) };
}
