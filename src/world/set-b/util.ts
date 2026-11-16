/**
 * Ferramentas de geometria da sala B: sorteio com semente, peças de madeira com arestas chanfradas
 * (vigas, pilares, tábuas, rodapés), fusão de geometrias e ajuste de UV em metros.
 * Nada aqui depende do kit: a sala usa as peças do kit só pelas funções públicas delas.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export type Sorteio = () => number;

/** Gerador com semente (mulberry32): a sala sai igual em toda montagem. */
export function criarSorteio(semente: number): Sorteio {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const entre = (r: Sorteio, a: number, b: number) => a + (b - a) * r();

/** Ruído de valor 2D barato e determinístico (para manchas largas de cor). */
function acaso2(i: number, j: number): number {
  const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
export function ruido2(x: number, y: number): number {
  const i = Math.floor(x);
  const j = Math.floor(y);
  const fx = x - i;
  const fy = y - j;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const a = acaso2(i, j);
  const b = acaso2(i + 1, j);
  const c = acaso2(i, j + 1);
  const d = acaso2(i + 1, j + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export interface OpcoesBarra {
  /** Chanfro das quatro quinas, em metros. Padrão 0,012. */
  chanfro?: number;
  /** Vetor "para cima" da seção (a altura da peça fica nessa direção). Padrão +Y; para peças verticais use +Z ou +X. */
  cima?: THREE.Vector3;
  /** Quantas faixas (tábuas, toras) a textura tem por ladrilho, lado a lado em U. Cada face larga usa uma faixa inteira. */
  faixas?: number;
  /** Comprimento real do ladrilho ao longo da peça (V), em metros. */
  ladrilho?: number;
  /** Tom da peça (cor de vértice), 1 = cor da textura. */
  tom?: number;
  /** Irregularidade da seção ao longo do comprimento (madeira lavrada), em metros. Padrão 0. */
  lavrado?: number;
  /** Sem as tampas das pontas (quando ficam embutidas). */
  semTampas?: boolean;
  /** Escurece as duas pontas (sujeira de encontro). 0 a 1. */
  pontasEscuras?: number;
}

/**
 * Peça de madeira reta de a até b, com seção retangular (largura x altura) de quinas chanfradas.
 * As faces são tiras separadas (o chanfro pega um fio de luz), lisas ao longo do comprimento.
 * UV: V corre ao longo da peça em metros / ladrilho; U ocupa uma faixa da textura por face.
 */
export function barra(a: THREE.Vector3, b: THREE.Vector3, largura: number, altura: number, r: Sorteio, o: OpcoesBarra = {}): THREE.BufferGeometry {
  const c = Math.min(o.chanfro ?? 0.012, largura * 0.45, altura * 0.45);
  const faixas = o.faixas ?? 7;
  const ladrilho = o.ladrilho ?? 1.25;
  const tom = o.tom ?? 1;
  const eixo = new THREE.Vector3().subVectors(b, a);
  const comp = eixo.length();
  eixo.normalize();
  let cima = (o.cima ?? new THREE.Vector3(0, 1, 0)).clone();
  if (Math.abs(cima.dot(eixo)) > 0.98) cima = new THREE.Vector3(0, 0, 1);
  const lado = new THREE.Vector3().crossVectors(cima, eixo).normalize();
  cima = new THREE.Vector3().crossVectors(eixo, lado).normalize();
  const hw = largura / 2;
  const hh = altura / 2;
  // contorno da seção (sentido anti-horário visto de quem olha contra o eixo): 8 pontos
  const sec: Array<[number, number]> = [
    [-hw + c, hh],
    [hw - c, hh],
    [hw, hh - c],
    [hw, -hh + c],
    [hw - c, -hh],
    [-hw + c, -hh],
    [-hw, -hh + c],
    [-hw, hh - c],
  ];
  const passos = o.lavrado ? Math.max(2, Math.round(comp / 0.45)) : 1;
  const pos: number[] = [];
  const uv: number[] = [];
  const cor: number[] = [];
  const idx: number[] = [];
  const v0 = r() * 3;
  const fase = r() * 50;
  const desvio = (k: number, i: number, eixoK: number) => (o.lavrado ? (ruido2(fase + k * 7.3 + eixoK * 3.1, i * 0.9) - 0.5) * 2 * o.lavrado : 0);
  const ponto = (k: number, i: number, out: THREE.Vector3) => {
    const s = (i / passos) * comp;
    const [x, y] = sec[k];
    out.copy(a).addScaledVector(eixo, s).addScaledVector(lado, x + desvio(k, i, 0)).addScaledVector(cima, y + desvio(k, i, 1));
    return out;
  };
  const p = new THREE.Vector3();
  for (let f = 0; f < 8; f++) {
    const k0 = f;
    const k1 = (f + 1) % 8;
    const larga = f % 2 === 0; // faces pares são as faces largas; ímpares, os chanfros
    const faixa = Math.floor(r() * faixas);
    const u0 = (faixa + (larga ? 0.06 : 0.42)) / faixas;
    const u1 = (faixa + (larga ? 0.94 : 0.58)) / faixas;
    const base = pos.length / 3;
    for (let i = 0; i <= passos; i++) {
      const s = (i / passos) * comp;
      const ponta = o.pontasEscuras ? 1 - o.pontasEscuras * Math.max(0, 1 - Math.min(s, comp - s) / 0.35) : 1;
      const t = tom * ponta;
      ponto(k0, i, p);
      pos.push(p.x, p.y, p.z);
      uv.push(u0, v0 + s / ladrilho);
      cor.push(t, t, t);
      ponto(k1, i, p);
      pos.push(p.x, p.y, p.z);
      uv.push(u1, v0 + s / ladrilho);
      cor.push(t, t, t);
    }
    for (let i = 0; i < passos; i++) {
      const q = base + i * 2;
      idx.push(q, q + 1, q + 3, q, q + 3, q + 2);
    }
  }
  if (!o.semTampas) {
    for (const fim of [0, passos]) {
      const base = pos.length / 3;
      const faixa = Math.floor(r() * faixas);
      for (let k = 0; k < 8; k++) {
        ponto(k, fim, p);
        pos.push(p.x, p.y, p.z);
        uv.push((faixa + 0.5 + (sec[k][0] / largura) * 0.8) / faixas, v0 + sec[k][1] / ladrilho);
        cor.push(tom * 0.8, tom * 0.8, tom * 0.8);
      }
      for (let k = 1; k < 7; k++) {
        if (fim === 0) idx.push(base, base + k, base + k + 1);
        else idx.push(base, base + k + 1, base + k);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cor, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Funde geometrias de mesmo material (todas precisam ter os mesmos atributos). Descarta as partes. */
export function juntar(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const prontas = geos.map((g) => {
    if (!g.getAttribute('color')) {
      const n = g.getAttribute('position').count;
      g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(n * 3).fill(1), 3));
    }
    return g;
  });
  const junta = mergeGeometries(prontas, false);
  for (const g of prontas) g.dispose();
  if (!junta) throw new Error('sala B: não foi possível fundir as geometrias');
  return junta;
}

/** Multiplica e desloca as UV (para pôr a textura em metros / ladrilho). */
export function escalarUv(g: THREE.BufferGeometry, su: number, sv: number, du = 0, dv = 0): THREE.BufferGeometry {
  const uv = g.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su + du, uv.getY(i) * sv + dv);
  uv.needsUpdate = true;
  return g;
}

/** Pinta a geometria com cor de vértice calculada por posição (manchas, sujeira de rodapé, escurecimento do alto). */
export function tingir(g: THREE.BufferGeometry, tomEm: (x: number, y: number, z: number) => number): THREE.BufferGeometry {
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const cor = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const t = tomEm(pos.getX(i), pos.getY(i), pos.getZ(i));
    cor[i * 3] = cor[i * 3 + 1] = cor[i * 3 + 2] = t;
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(cor, 3));
  return g;
}

/** Conta malhas visíveis e triângulos de um grupo (para o relatório). */
export function contar(raiz: THREE.Object3D): { malhas: number; triangulos: number } {
  let malhas = 0;
  let triangulos = 0;
  raiz.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.visible) return;
    malhas++;
    const g = m.geometry;
    const n = g.index ? g.index.count : g.getAttribute('position').count;
    const inst = (m as THREE.InstancedMesh).isInstancedMesh ? (m as THREE.InstancedMesh).count : 1;
    triangulos += (n / 3) * inst;
  });
  return { malhas, triangulos: Math.round(triangulos) };
}
