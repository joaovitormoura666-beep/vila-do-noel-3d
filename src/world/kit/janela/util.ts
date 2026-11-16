/**
 * Utilidades comuns da janela e dos tecidos: sorteio com semente (a peça sai igual em toda execução),
 * ruído suave e pequenas ajudas de geometria. Nada aqui usa relógio nem Math.random.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export type Sorteio = () => number;

/** Gerador determinístico (mulberry32): devolve números de 0 a 1. */
export function criarSorteio(semente: number): Sorteio {
  let a = (semente | 0) + 0x6d2b79f5;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const entre = (r: Sorteio, a: number, b: number) => a + (b - a) * r();
export const limitar = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
export const misturar = (a: number, b: number, t: number) => a + (b - a) * t;

export const suave = (a: number, b: number, x: number) => {
  const t = limitar((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Número de 0 a 1 que depende só de dois inteiros e de um sal. */
export function acaso2(i: number, j: number, sal = 0): number {
  let h = (i * 374761393 + j * 668265263 + sal * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Ruído de valor em duas dimensões, suave, de -1 a 1. */
export function ruido2(x: number, y: number, sal = 0): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const a = acaso2(xi, yi, sal);
  const b = acaso2(xi + 1, yi, sal);
  const c = acaso2(xi, yi + 1, sal);
  const d = acaso2(xi + 1, yi + 1, sal);
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1;
}

/** Ruído em oitavas (fractal), de -1 a 1 aproximadamente. */
export function fbm2(x: number, y: number, oitavas = 3, sal = 0): number {
  let amp = 0.5;
  let soma = 0;
  let norma = 0;
  for (let o = 0; o < oitavas; o++) {
    soma += ruido2(x, y, sal + o * 17) * amp;
    norma += amp;
    x = x * 2.03 + 11.7;
    y = y * 2.03 + 5.3;
    amp *= 0.5;
  }
  return soma / norma;
}

/**
 * Junta geometrias em uma só (uma chamada de desenho). Converte tudo para não indexado e mantém só
 * posição, normal, uv e, se pedido, cor: assim primitivas do three e malhas próprias se misturam.
 */
export function juntar(geos: THREE.BufferGeometry[], comCor = false): THREE.BufferGeometry {
  const prontas = geos.map((g) => {
    const n = g.index ? g.toNonIndexed() : g;
    if (n !== g) g.dispose();
    for (const nome of Object.keys(n.attributes)) {
      if (nome !== 'position' && nome !== 'normal' && nome !== 'uv' && !(comCor && nome === 'color')) n.deleteAttribute(nome);
    }
    if (!n.getAttribute('uv')) n.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n.getAttribute('position').count * 2), 2));
    if (comCor && !n.getAttribute('color')) {
      const cor = new Float32Array(n.getAttribute('position').count * 3).fill(1);
      n.setAttribute('color', new THREE.Float32BufferAttribute(cor, 3));
    }
    return n;
  });
  const junta = mergeGeometries(prontas, false);
  for (const g of prontas) g.dispose();
  if (!junta) throw new Error('falha ao juntar geometrias');
  return junta;
}

/** Pinta todos os vértices de uma geometria com uma cor (para juntar peças de cores diferentes em um material só). */
export function pintar(g: THREE.BufferGeometry, cor: THREE.ColorRepresentation, forca = 1): THREE.BufferGeometry {
  const c = new THREE.Color(cor).multiplyScalar(forca);
  const n = g.getAttribute('position').count;
  const dados = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) dados.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new THREE.Float32BufferAttribute(dados, 3));
  return g;
}

/** Multiplica as UV de uma geometria (para acertar o tamanho real do ladrilho) e desloca. */
export function escalarUv(g: THREE.BufferGeometry, su: number, sv: number, du = 0, dv = 0): THREE.BufferGeometry {
  const uv = g.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su + du, uv.getY(i) * sv + dv);
  return g;
}

/** Conta malhas visíveis e triângulos de uma peça (cada malha é uma chamada de desenho na passada principal). */
export function contarPeca(raiz: THREE.Object3D): { malhas: number; triangulos: number; lista: string } {
  const linhas: string[] = [];
  let total = 0;
  let malhas = 0;
  raiz.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.visible) return;
    const g = m.geometry;
    const tri = (g.index ? g.index.count : g.getAttribute('position').count) / 3;
    total += tri;
    malhas++;
    linhas.push(`${m.name || '?'}=${Math.round(tri)}`);
  });
  return { malhas, triangulos: Math.round(total), lista: linhas.join(', ') };
}
