/**
 * Alvenaria da lareira: pedras modeladas uma a uma (blocos irregulares, com arestas quebradas) e a
 * "pele" de pedra bruta do corpo e do peito da chaminé, com o relevo do mapa de deslocamento
 * aplicado na malha (no processador, uma vez só, na montagem). Assim o contorno contra o fundo é
 * irregular de verdade, a sombra e a oclusão de ambiente enxergam o relevo e não há custo por quadro.
 */
import * as THREE from 'three';
import { criarRng, fbm3 } from './ruido';

export type Cor3 = [number, number, number];

/** Oito cantos de uma caixa alinhada aos eixos. Índice = ix + 2*iy + 4*iz. */
export function caixaCantos(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): THREE.Vector3[] {
  const c: THREE.Vector3[] = [];
  for (let iz = 0; iz < 2; iz++) for (let iy = 0; iy < 2; iy++) for (let ix = 0; ix < 2; ix++) c.push(new THREE.Vector3(ix ? x1 : x0, iy ? y1 : y0, iz ? z1 : z0));
  return c;
}

export interface BlocoOpcoes {
  /** Oito cantos do bloco (hexaedro qualquer). Índice = ix + 2*iy + 4*iz. */
  cantos: THREE.Vector3[];
  semente: number;
  /** Largura do chanfro das arestas, em metros (o quanto cada aresta é comida varia ao longo dela). */
  raio?: number;
  /** Chanfro por direção: arestas paralelas a x, a y e a z do bloco. Tem precedência sobre `raio`. */
  raios?: [number, number, number];
  /** Tamanho aproximado de cada segmento da malha, em metros. */
  passo?: number;
  maxSeg?: number;
  /** Amplitude do relevo talhado (metros). */
  relevo?: number;
  /** Quanto as arestas são mordidas além do chanfro (0 a 1). */
  quebra?: number;
  /** Chance de cada canto ser cortado por um plano (lasca), de 0 a 1. Padrão 0,3. */
  lascas?: number;
  /** Tamanho real do ladrilho da textura, em metros, para a escala das UV. */
  ladrilho?: number;
  cor?: Cor3;
  /** Ajuste de cor por vértice (fuligem, limo, desgaste), aplicado depois do tom base. */
  pintar?: (p: THREE.Vector3, cor: Cor3) => void;
  /** Deformação comum a toda a alvenaria (tira o prumo perfeito). */
  entortar?: (p: THREE.Vector3) => void;
  /** Dá forma ao bloco antes do relevo (ex.: perfil curvo). `f` são as frações 0..1 dentro do bloco em x, y e z. */
  moldar?: (p: THREE.Vector3, f: THREE.Vector3) => void;
}

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();

/**
 * Recalcula as normais juntando os vértices que ocupam o mesmo lugar (as faces da caixa não
 * compartilham vértices). Com `cosVinco`, só entram na média as faces que fazem menos que esse
 * ângulo com a face do próprio vértice: superfícies curvas ficam suaves e as quinas de verdade
 * (chanfro pequeno, lasca) ficam vivas e pegam o brilho fino da luz rasante.
 */
export function normaisSuaves(geo: THREE.BufferGeometry, chaves: Int32Array, cosVinco = -2) {
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const idx = geo.getIndex()!;
  const nTri = idx.count / 3;
  const triN = new Float32Array(nTri * 3);
  const propria = new Float32Array(pos.count * 3);
  const grupos = new Map<number, number[]>();
  for (let t = 0; t < nTri; t++) {
    const ia = idx.getX(t * 3);
    const ib = idx.getX(t * 3 + 1);
    const ic = idx.getX(t * 3 + 2);
    _a.fromBufferAttribute(pos, ia);
    _b.fromBufferAttribute(pos, ib);
    _c.fromBufferAttribute(pos, ic);
    _b.sub(_a);
    _c.sub(_a);
    _b.cross(_c); // normal da face, com o tamanho proporcional à área
    triN[t * 3] = _b.x;
    triN[t * 3 + 1] = _b.y;
    triN[t * 3 + 2] = _b.z;
    for (const v of [ia, ib, ic]) {
      propria[v * 3] += _b.x;
      propria[v * 3 + 1] += _b.y;
      propria[v * 3 + 2] += _b.z;
      const g = grupos.get(chaves[v]);
      if (g) g.push(t);
      else grupos.set(chaves[v], [t]);
    }
  }
  const nor = new Float32Array(pos.count * 3);
  for (let v = 0; v < pos.count; v++) {
    const px = propria[v * 3];
    const py = propria[v * 3 + 1];
    const pz = propria[v * 3 + 2];
    const pl = Math.hypot(px, py, pz) || 1;
    let sx = 0;
    let sy = 0;
    let sz = 0;
    for (const t of grupos.get(chaves[v]) ?? []) {
      const tx = triN[t * 3];
      const ty = triN[t * 3 + 1];
      const tz = triN[t * 3 + 2];
      const tl = Math.hypot(tx, ty, tz) || 1;
      if ((tx * px + ty * py + tz * pz) / (tl * pl) < cosVinco) continue;
      sx += tx;
      sy += ty;
      sz += tz;
    }
    const l = Math.hypot(sx, sy, sz);
    if (l > 0) {
      nor[v * 3] = sx / l;
      nor[v * 3 + 1] = sy / l;
      nor[v * 3 + 2] = sz / l;
    } else {
      nor[v * 3] = px / pl;
      nor[v * 3 + 1] = py / pl;
      nor[v * 3 + 2] = pz / pl;
    }
  }
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
}

const COS_VINCO = Math.cos((50 * Math.PI) / 180);

/**
 * Uma pedra lavrada: caixa subdividida levada para dentro do hexaedro dado. Cada aresta ganha um
 * chanfro estreito (uma fileira de vértices a `raio` da aresta), comido em quantidade diferente ao
 * longo dela; alguns cantos são cortados por um plano (lasca); as faces ficam quase planas, com
 * ondulação larga e rasa. As normais são suaves dentro da face e vivas nas quinas. UV em escala
 * real por face (pelo comprimento verdadeiro das arestas de cada face) e o atributo aGasto
 * (0 na aresta gasta, 1 no meio da face) para o material variar a rugosidade.
 */
export function blocoIrregular(o: BlocoOpcoes): THREE.BufferGeometry {
  const c = o.cantos;
  const passo = o.passo ?? 0.05;
  const maxSeg = o.maxSeg ?? 12;
  const relevo = o.relevo ?? 0.012;
  const quebra = o.quebra ?? 0.6;
  const ladrilho = o.ladrilho ?? 1.5;
  const sem = o.semente * 1.618 + 3.3;
  const sorteio = criarRng(Math.floor(o.semente * 7919) + 13);
  const media = (i0: number, i1: number, j0: number, j1: number, k0: number, k1: number, l0: number, l1: number) =>
    _a.copy(c[i1]).sub(c[i0]).add(_b.copy(c[j1]).sub(c[j0])).add(_b.copy(c[k1]).sub(c[k0])).add(_b.copy(c[l1]).sub(c[l0])).multiplyScalar(0.25).clone();
  const ex = media(0, 1, 2, 3, 4, 5, 6, 7);
  const ey = media(0, 2, 1, 3, 4, 6, 5, 7);
  const ez = media(0, 4, 1, 5, 2, 6, 3, 7);
  const dx = ex.length();
  const dy = ey.length();
  const dz = ez.length();
  ex.normalize();
  ey.normalize();
  ez.normalize();
  const menor = Math.min(dx, dy, dz);
  const lim = 0.36 * menor;
  const rBase = o.raio ?? 0.02;
  const rX = Math.min(o.raios?.[0] ?? rBase, lim);
  const rY = Math.min(o.raios?.[1] ?? rBase, lim);
  const rZ = Math.min(o.raios?.[2] ?? rBase, lim);
  // a fileira de vértices do chanfro fica a esta fração da aresta, em cada eixo
  const rhoX = Math.min(0.3, Math.max(rY, rZ) / dx);
  const rhoY = Math.min(0.3, Math.max(rX, rZ) / dy);
  const rhoZ = Math.min(0.3, Math.max(rX, rY) / dz);
  const seg = (d: number) => Math.max(3, Math.min(maxSeg, Math.round(d / passo)) + 2);
  const nx = seg(dx);
  const ny = seg(dy);
  const nz = seg(dz);
  const geo = new THREE.BoxGeometry(1, 1, 1, nx, ny, nz);
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const uv = geo.getAttribute('uv') as THREE.BufferAttribute;
  const n = pos.count;
  const cores = new Float32Array(n * 3);
  const gasto = new Float32Array(n);
  const chaves = new Int32Array(n);
  const corBase = o.cor ?? [1, 1, 1];
  const p = new THREE.Vector3();
  const f = new THREE.Vector3();
  const cor: Cor3 = [1, 1, 1];
  // quantos vértices cada face da caixa tem, na ordem em que o three as monta (+x, -x, +y, -y, +z, -z)
  const porFace = [(nz + 1) * (ny + 1), (nz + 1) * (ny + 1), (nx + 1) * (nz + 1), (nx + 1) * (nz + 1), (nx + 1) * (ny + 1), (nx + 1) * (ny + 1)];
  // escala das UV pelo comprimento real das arestas de cada face (depois de entortado o hexaedro)
  const comp = (i: number, j: number, k: number, l: number) => (c[i].distanceTo(c[j]) + c[k].distanceTo(c[l])) / 2;
  const escalaU = [comp(1, 5, 3, 7), comp(0, 4, 2, 6), comp(2, 3, 6, 7), comp(0, 1, 4, 5), comp(4, 5, 6, 7), comp(0, 1, 2, 3)];
  const escalaV = [comp(1, 3, 5, 7), comp(0, 2, 4, 6), comp(2, 6, 3, 7), comp(0, 4, 1, 5), comp(4, 6, 5, 7), comp(0, 2, 1, 3)];
  const offU = fbm3(sem, 1.3, 7.7, 1) * 7.3;
  const offV = fbm3(2.1, sem, 4.4, 1) * 5.9;
  // lascas: cantos cortados por um plano inclinado
  const centro = new THREE.Vector3();
  for (const q of c) centro.addScaledVector(q, 1 / 8);
  const lascas: Array<{ canto: THREE.Vector3; n: THREE.Vector3; fundo: number } | null> = [];
  for (let k = 0; k < 8; k++) {
    if (sorteio() >= (o.lascas ?? 0.3)) {
      lascas.push(null);
      continue;
    }
    const nrm = c[k].clone().sub(centro);
    nrm.set(nrm.x / dx, nrm.y / dy, nrm.z / dz).normalize();
    nrm.x += (sorteio() - 0.5) * 0.7;
    nrm.y += (sorteio() - 0.5) * 0.7;
    nrm.z += (sorteio() - 0.5) * 0.7;
    nrm.normalize();
    lascas.push({ canto: c[k], n: nrm, fundo: Math.min(0.3 * menor, 0.016 + sorteio() * 0.03) });
  }
  const remap = (u: number, nSeg: number, rho: number) => {
    const i = Math.round((u + 0.5) * nSeg);
    if (i <= 0) return -0.5;
    if (i >= nSeg) return 0.5;
    return -0.5 + rho + ((i - 1) / (nSeg - 2)) * (1 - 2 * rho);
  };
  let face = 0;
  let naFace = 0;
  for (let i = 0; i < n; i++) {
    if (naFace >= porFace[face]) {
      face++;
      naFace = 0;
    }
    naFace++;
    const gx = pos.getX(i);
    const gy = pos.getY(i);
    const gz = pos.getZ(i);
    chaves[i] = Math.round((gx + 0.5) * nx) + Math.round((gy + 0.5) * ny) * 64 + Math.round((gz + 0.5) * nz) * 4096;
    const ux = remap(gx, nx, rhoX);
    const uy = remap(gy, ny, rhoY);
    const uz = remap(gz, nz, rhoZ);
    const bx = Math.abs(gx) > 0.499 ? 1 : 0;
    const by = Math.abs(gy) > 0.499 ? 1 : 0;
    const bz = Math.abs(gz) > 0.499 ? 1 : 0;
    const borda = bx + by + bz; // 1 = face, 2 = aresta, 3 = canto
    // chanfro desta aresta, comido em quantidade diferente ao longo dela (de quase vivo a bem gasto)
    const wX = by * bz;
    const wY = bx * bz;
    const wZ = bx * by;
    const wS = wX + wY + wZ;
    const rAresta = wS > 0 ? (wX * rX + wY * rY + wZ * rZ) / wS : 0;
    const come = Math.min(1, 0.22 + 1.15 * fbm3(ux * 2.9 + sem, uy * 2.9 - sem, uz * 2.9 + sem * 0.3, 2));
    const r = rAresta * come;
    // caixa de arestas chanfradas, em medidas reais
    let qx = ux * dx;
    let qy = uy * dy;
    let qz = uz * dz;
    const ix = Math.max(-(dx / 2 - r), Math.min(dx / 2 - r, qx));
    const iy = Math.max(-(dy / 2 - r), Math.min(dy / 2 - r, qy));
    const iz = Math.max(-(dz / 2 - r), Math.min(dz / 2 - r, qz));
    let vx = qx - ix;
    let vy = qy - iy;
    let vz = qz - iz;
    let vl = Math.hypot(vx, vy, vz);
    if (vl < 1e-9) {
      // face: a direção de saída é a normal da própria face
      vx = bx * Math.sign(gx);
      vy = by * Math.sign(gy);
      vz = bz * Math.sign(gz);
      vl = Math.hypot(vx, vy, vz) || 1;
    }
    vx /= vl;
    vy /= vl;
    vz /= vl;
    if (borda >= 2) {
      qx = ix + vx * r;
      qy = iy + vy * r;
      qz = iz + vz * r;
    }
    // para dentro do hexaedro (interpolação trilinear dos oito cantos)
    const a = qx / dx + 0.5;
    const b = qy / dy + 0.5;
    const d = qz / dz + 0.5;
    p.set(0, 0, 0);
    for (let k = 0; k < 8; k++) {
      const w = (k & 1 ? a : 1 - a) * (k & 2 ? b : 1 - b) * (k & 4 ? d : 1 - d);
      p.addScaledVector(c[k], w);
    }
    if (o.moldar) o.moldar(p, f.set(a, b, d));
    // lascas: tudo que passa do plano de corte é trazido para ele
    for (const l of lascas) {
      if (!l) continue;
      const t = (p.x - l.canto.x) * l.n.x + (p.y - l.canto.y) * l.n.y + (p.z - l.canto.z) * l.n.z + l.fundo;
      if (t > 0) p.addScaledVector(l.n, -t);
    }
    // relevo: faces quase planas, com ondulação larga e rasa; nas arestas, pedaços mordidos
    const largo = fbm3(p.x * 2.6 + sem, p.y * 2.6 - sem, p.z * 2.6 + sem * 0.5, 2) - 0.5;
    const medio = fbm3(p.x * 9 + sem, p.y * 9, p.z * 9 - sem, 2) - 0.5;
    const mordida = borda >= 2 ? Math.max(0, fbm3(p.x * 8 - sem, p.y * 8 + sem, p.z * 8, 2) - 0.42) * (borda === 3 ? 3.2 : 2.4) * quebra : 0;
    const desl = relevo * (largo * 1.1 + medio * 0.5) - mordida * rAresta;
    p.addScaledVector(ex, vx * desl).addScaledVector(ey, vy * desl).addScaledVector(ez, vz * desl);
    o.entortar?.(p);
    pos.setXYZ(i, p.x, p.y, p.z);
    const u0 = face < 2 ? uz + 0.5 : ux + 0.5;
    const v0 = face === 2 || face === 3 ? uz + 0.5 : uy + 0.5;
    uv.setXY(i, (u0 * escalaU[face]) / ladrilho + offU, (v0 * escalaV[face]) / ladrilho + offV);
    // cor: tom do bloco, manchas largas e arestas um pouco mais claras (gasto)
    const mancha = 0.86 + 0.28 * fbm3(p.x * 1.7 + sem * 2, p.y * 1.7, p.z * 1.7, 2);
    const claro = borda >= 2 ? 1.07 : 1;
    const fundo = 1 - Math.max(0, -largo) * 0.4;
    cor[0] = corBase[0] * mancha * claro * fundo;
    cor[1] = corBase[1] * mancha * claro * fundo;
    cor[2] = corBase[2] * mancha * claro * fundo;
    o.pintar?.(p, cor);
    cores[i * 3] = cor[0];
    cores[i * 3 + 1] = cor[1];
    cores[i * 3 + 2] = cor[2];
    gasto[i] = borda >= 2 ? 0.1 : 0.55 + 0.45 * Math.min(1, Math.max(0, 0.5 - largo * 2.5));
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cores, 3));
  geo.setAttribute('aGasto', new THREE.BufferAttribute(gasto, 1));
  normaisSuaves(geo, chaves, COS_VINCO);
  geo.clearGroups();
  return geo;
}

/**
 * Faz o material ler o atributo aGasto: onde ele é baixo (aresta gasta, topo de pedra polido pelo
 * uso) a rugosidade do mapa é multiplicada por `minimo`; onde é 1, fica como no mapa. É o que dá o
 * brilho fino nas quinas sob a luz rasante, em vez de tudo fosco por igual.
 */
export function variarRugosidade(material: THREE.MeshStandardMaterial, minimo = 0.72): void {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aGasto;\nvarying float vGasto;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGasto = aGasto;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vGasto;')
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\nroughnessFactor *= mix(${minimo.toFixed(3)}, 1.0, clamp(vGasto, 0.0, 1.0));`);
  };
  material.customProgramCacheKey = () => `lareira-gasto-${minimo}`;
}

/** Leitor de um mapa de alturas (imagem em tons de cinza) com repetição e interpolação. Devolve 0 a 1. */
export function criarAmostrador(imagem: CanvasImageSource, tamanho = 256): (u: number, v: number) => number {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = tamanho;
  const g = canvas.getContext('2d', { willReadFrequently: true })!;
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.drawImage(imagem, 0, 0, tamanho, tamanho);
  const dados = g.getImageData(0, 0, tamanho, tamanho).data;
  const ler = (x: number, y: number) => dados[(((y % tamanho) + tamanho) % tamanho) * tamanho * 4 + (((x % tamanho) + tamanho) % tamanho) * 4] / 255;
  return (u, v) => {
    const x = (u - Math.floor(u)) * tamanho - 0.5;
    const y = (1 - (v - Math.floor(v))) * tamanho - 0.5; // a textura é carregada com o V invertido
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const a = ler(x0, y0) + (ler(x0 + 1, y0) - ler(x0, y0)) * fx;
    const b = ler(x0, y0 + 1) + (ler(x0 + 1, y0 + 1) - ler(x0, y0 + 1)) * fx;
    return a + (b - a) * fy;
  };
}

export interface PeleOpcoes {
  altura: number;
  /** Meia largura e profundidade (avanço a partir da parede) em cada altura. */
  meiaLargura: (y: number) => number;
  profundidade: (y: number) => number;
  /** Raio das quinas verticais. */
  raio: number;
  /** Tamanho do segmento da malha, em metros. */
  passo: number;
  /** Tamanho real do ladrilho da textura. */
  ladrilho: number;
  /** Altura do relevo (0 a 1) em cada ponto da textura. */
  altura01: (u: number, v: number) => number;
  /** Amplitude do relevo, em metros, e o nível que fica no prumo (0 a 1). */
  amplitude: number;
  nivel?: number;
  /** true onde a pele é aberta (a boca). Recebe o x e o y do centro do quadrado, só na face da frente. */
  furo?: (x: number, y: number) => boolean;
  /** Multiplica o relevo (0 a 1), para a pele não atravessar as pedras modeladas por cima. */
  atenuar?: (x: number, y: number, naFrente: boolean) => number;
  pintar?: (p: THREE.Vector3, cor: Cor3, altura: number) => void;
  entortar?: (p: THREE.Vector3) => void;
  deslocU?: number;
  deslocV?: number;
  /** Acima desta altura as fiadas da malha podem ser mais espaçadas (onde quase não chega luz). */
  passoAlto?: { aPartirDe: number; passo: number };
}

/**
 * Pele de pedra em U (lado, frente, lado; as costas ficam na parede), subindo do piso ao teto e
 * acompanhando o perfil dado. Cada vértice é empurrado para fora conforme o mapa de alturas.
 */
export function peleDePedra(o: PeleOpcoes): THREE.BufferGeometry {
  const H = o.altura;
  const r = o.raio;
  const hwMax = Math.max(o.meiaLargura(0), o.meiaLargura(H * 0.5), o.meiaLargura(H));
  const dMax = Math.max(o.profundidade(0), o.profundidade(H * 0.5), o.profundidade(H));
  const nLado = Math.max(2, Math.ceil((dMax - r) / o.passo));
  const nArco = Math.max(3, Math.ceil(((Math.PI * r) / 2 / o.passo) * 1.4));
  const nFrente = Math.max(4, Math.ceil((2 * hwMax - 2 * r) / o.passo));
  const cols = 2 * nLado + 2 * nArco + nFrente;
  // alturas das fiadas: passo fino embaixo e, se pedido, mais largo no alto
  const ys: number[] = [0];
  {
    const corte = o.passoAlto ? Math.min(H, o.passoAlto.aPartirDe) : H;
    const n1 = Math.max(2, Math.ceil(corte / o.passo));
    for (let j = 1; j <= n1; j++) ys.push((corte * j) / n1);
    if (o.passoAlto && corte < H) {
      const n2 = Math.max(1, Math.ceil((H - corte) / o.passoAlto.passo));
      for (let j = 1; j <= n2; j++) ys.push(corte + ((H - corte) * j) / n2);
    }
  }
  const rows = ys.length - 1;
  const n = (cols + 1) * (rows + 1);
  const gasto = new Float32Array(n);
  const pos = new Float32Array(n * 3);
  const nor = new Float32Array(n * 3);
  const uv = new Float32Array(n * 2);
  const cores = new Float32Array(n * 3);
  const xs = new Float32Array(n); // x nominal (antes do relevo), para decidir o furo
  const frente = new Uint8Array(n);
  const nivel = o.nivel ?? 0.5;
  const p = new THREE.Vector3();
  const cor: Cor3 = [1, 1, 1];
  const arco = (Math.PI * r) / 2;
  for (let j = 0; j <= rows; j++) {
    const y = ys[j];
    const hw = o.meiaLargura(y);
    const d = o.profundidade(y);
    for (let i = 0; i <= cols; i++) {
      let x: number;
      let z: number;
      let nx: number;
      let nz: number;
      let s: number; // distância ao longo da pele a partir do centro da frente (negativa à esquerda)
      let k = i;
      let naFrente = false;
      if (k <= nLado) {
        const t = k / nLado;
        x = -hw;
        z = t * (d - r);
        nx = -1;
        nz = 0;
        s = -(hw - r) - arco - (d - r - z);
      } else if ((k -= nLado) <= nArco) {
        const ang = (k / nArco) * (Math.PI / 2);
        x = -hw + r - r * Math.cos(ang);
        z = d - r + r * Math.sin(ang);
        nx = -Math.cos(ang);
        nz = Math.sin(ang);
        s = -(hw - r) - arco * (1 - k / nArco);
      } else if ((k -= nArco) <= nFrente) {
        const t = k / nFrente;
        x = (-1 + 2 * t) * (hw - r);
        z = d;
        nx = 0;
        nz = 1;
        s = x;
        naFrente = true;
      } else if ((k -= nFrente) <= nArco) {
        const ang = (k / nArco) * (Math.PI / 2);
        x = hw - r + r * Math.sin(ang);
        z = d - r + r * Math.cos(ang);
        nx = Math.sin(ang);
        nz = Math.cos(ang);
        s = hw - r + arco * (k / nArco);
      } else {
        k -= nArco;
        const t = k / nLado;
        x = hw;
        z = (1 - t) * (d - r);
        nx = 1;
        nz = 0;
        s = hw - r + arco + (d - r - z);
      }
      const v = j * (cols + 1) + i;
      const u0 = s / o.ladrilho + (o.deslocU ?? 0);
      const v0 = y / o.ladrilho + (o.deslocV ?? 0);
      const h = o.altura01(u0, v0);
      const at = o.atenuar ? o.atenuar(x, y, naFrente) : 1;
      const desl = (h - nivel) * o.amplitude * at;
      p.set(x + nx * desl, y, z + nz * desl);
      o.entortar?.(p);
      pos[v * 3] = p.x;
      pos[v * 3 + 1] = p.y;
      pos[v * 3 + 2] = p.z;
      nor[v * 3] = nx;
      nor[v * 3 + 1] = 0;
      nor[v * 3 + 2] = nz;
      uv[v * 2] = u0;
      uv[v * 2 + 1] = v0;
      xs[v] = x;
      frente[v] = naFrente ? 1 : 0;
      // juntas (partes fundas do relevo) mais escuras, como sujeira e sombra acumuladas
      // juntas (partes fundas do relevo): argamassa de cal suja, um pouco mais fria, não um buraco preto
      const naJunta = 1 - Math.min(1, Math.max(0, (h - 0.1) / 0.36));
      const mancha = 0.9 + 0.2 * fbm3(p.x * 0.9 + 3.1, p.y * 0.9, p.z * 0.9 + 9.2, 2);
      // umas pedras mais frias e cinzentas, outras mais ocres (manchas do tamanho de uma pedra)
      const matiz = (fbm3(u0 * 5.3 + 1.7, v0 * 5.3 + 4.1, 2.2, 2) - 0.5) * 0.3 * (1 - naJunta);
      const tom = (1 - 0.24 * naJunta) * mancha;
      cor[0] = tom * (1 + matiz) * (1 - 0.03 * naJunta);
      cor[1] = tom;
      cor[2] = tom * (1 - matiz) * (1 + 0.05 * naJunta);
      // topo das pedras salientes: polido pelo tempo; junta: fosca
      gasto[v] = 1 - 0.75 * Math.min(1, Math.max(0, (h - 0.55) / 0.3));
      o.pintar?.(p, cor, h);
      cores[v * 3] = cor[0];
      cores[v * 3 + 1] = cor[1];
      cores[v * 3 + 2] = cor[2];
    }
  }
  const indices: number[] = [];
  for (let j = 0; j < rows; j++) {
    const yc = (ys[j] + ys[j + 1]) / 2;
    for (let i = 0; i < cols; i++) {
      const a = j * (cols + 1) + i;
      const b = a + 1;
      const c2 = a + cols + 1;
      const d2 = c2 + 1;
      if (o.furo && frente[a] && frente[b] && o.furo((xs[a] + xs[b]) / 2, yc)) continue;
      indices.push(a, b, d2, a, d2, c2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.BufferAttribute(cores, 3));
  geo.setAttribute('aGasto', new THREE.BufferAttribute(gasto, 1));
  geo.setIndex(indices);
  // normais: mistura da normal do perfil (lisa) com a da malha em relevo, para a luz rasante
  // desenhar o volume das pedras sem dobrar o efeito do mapa de normais
  const lisa = nor.slice();
  geo.computeVertexNormals();
  const real = geo.getAttribute('normal') as THREE.BufferAttribute;
  for (let v = 0; v < n; v++) {
    const mx = lisa[v * 3] * 0.55 + real.getX(v) * 0.45;
    const my = lisa[v * 3 + 1] * 0.55 + real.getY(v) * 0.45;
    const mz = lisa[v * 3 + 2] * 0.55 + real.getZ(v) * 0.45;
    const l = Math.hypot(mx, my, mz) || 1;
    real.setXYZ(v, mx / l, my / l, mz / l);
  }
  return geo;
}
