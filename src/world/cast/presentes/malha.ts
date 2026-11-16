/**
 * Construtor de malhas dos presentes.
 *
 * Cada peça é uma SUPERFÍCIE PARAMÉTRICA P(u, v) (u em volta, v ao longo), como no Noel: daí saem a grade
 * de vértices, as normais por diferenças finitas, as UV em metros, a cor de vértice e o ACABAMENTO por
 * vértice (metal, rugosidade, verniz e brilho próprio, lidos pelo material "pintura", veja materiais.ts).
 * As peças de um mesmo material se acumulam em um Molde e viram UMA geometria: uma chamada de desenho por
 * material. Para a pelúcia em cascas, o Molde repete a malha uma vez por casca (atributo `pelo`).
 */
import * as THREE from 'three';

export type Cor = readonly [number, number, number];
/** Acabamento por vértice: [metal 0..1, rugosidade 0..1, verniz (clearcoat) 0..1, brilho próprio 0..1]. */
export type Acab = readonly [number, number, number, number];

export const FOSCO: Acab = [0, 0.85, 0, 0];

export interface Superficie {
  nu: number;
  nv: number;
  /** Ponto da superfície em (u, v), ambos de 0 a 1. */
  ponto(u: number, v: number, out: THREE.Vector3): void;
  /** Cor de vértice (linear). Padrão: a cor do Molde. */
  cor?(u: number, v: number, p: THREE.Vector3): Cor;
  /** Acabamento por vértice. Padrão: o acabamento do Molde. */
  acab?(u: number, v: number, p: THREE.Vector3): Acab;
  /** UV; padrão: metros medidos na própria superfície. */
  uv?(u: number, v: number): readonly [number, number];
  /** u fecha em volta (padrão true). */
  fechadoU?: boolean;
  /** Força a orientação das normais (sem a votação de dentro e fora). */
  orientar?: 1 | -1;
  /** Só pelúcia: [comprimento do pelo em metros, esticamento dos fios ao longo de v, semente]. */
  pelo?(u: number, v: number, p: THREE.Vector3): readonly [number, number, number];
}

const P = new THREE.Vector3();
const A = new THREE.Vector3();
const B = new THREE.Vector3();
const C = new THREE.Vector3();
const D = new THREE.Vector3();
const DU = new THREE.Vector3();
const DV = new THREE.Vector3();
const N = new THREE.Vector3();
const M3 = new THREE.Matrix3();

export class Molde {
  pos: number[] = [];
  nor: number[] = [];
  uv: number[] = [];
  cor: number[] = [];
  acab: number[] = [];
  pelo: number[] = [];
  idx: number[] = [];
  /** Cor e acabamento usados quando a peça não diz os seus. */
  corPadrao: Cor = [1, 1, 1];
  acabPadrao: Acab = FOSCO;

  get vertices() {
    return this.pos.length / 3;
  }
  get triangulos() {
    return this.idx.length / 3;
  }

  /** Muda a cor e o acabamento das próximas peças. */
  tinta(cor: Cor, acab: Acab = this.acabPadrao): this {
    this.corPadrao = cor;
    this.acabPadrao = acab;
    return this;
  }

  vertice(p: THREE.Vector3, n: THREE.Vector3, u: number, v: number, cor: Cor = this.corPadrao, acab: Acab = this.acabPadrao): number {
    this.pos.push(p.x, p.y, p.z);
    this.nor.push(n.x, n.y, n.z);
    this.uv.push(u, v);
    this.cor.push(cor[0], cor[1], cor[2]);
    this.acab.push(acab[0], acab[1], acab[2], acab[3]);
    this.pelo.push(0, 1, 0, 0);
    return this.vertices - 1;
  }

  adicionar(s: Superficie): this {
    const fechado = s.fechadoU ?? true;
    const { nu, nv } = s;
    const cols = nu + 1;
    const base = this.vertices;
    const du = 0.25 / nu;
    const dv = 0.25 / nv;
    let lu = 0;
    let lv = 0;
    if (!s.uv) {
      const passos = 16;
      for (let i = 0; i < passos; i++) {
        s.ponto(i / passos, 0.5, A);
        s.ponto((i + 1) / passos, 0.5, B);
        lu += A.distanceTo(B);
        s.ponto(0.5, i / passos, A);
        s.ponto(0.5, (i + 1) / passos, B);
        lv += A.distanceTo(B);
      }
    }
    const pontos: THREE.Vector3[] = [];
    const normais: THREE.Vector3[] = [];
    const degenerado: boolean[] = [];
    for (let j = 0; j <= nv; j++) {
      const v = j / nv;
      for (let i = 0; i < cols; i++) {
        const u = i / nu;
        s.ponto(u, v, P);
        pontos.push(P.clone());
        s.ponto(fechado ? u - du : Math.max(0, u - du), v, A);
        s.ponto(fechado ? u + du : Math.min(1, u + du), v, B);
        DU.subVectors(B, A);
        s.ponto(u, Math.max(0, v - dv), C);
        s.ponto(u, Math.min(1, v + dv), D);
        DV.subVectors(D, C);
        N.crossVectors(DU, DV);
        const len = N.length();
        degenerado.push(len / Math.max(1e-14, DU.length() * DV.length()) < 1e-3);
        normais.push(len > 0 ? N.clone().divideScalar(len) : new THREE.Vector3(0, 1, 0));
      }
    }
    // polos (linhas degeneradas): a normal é a média da linha vizinha, ou a direção do eixo
    for (let j = 0; j <= nv; j++) {
      const linha = j * cols;
      let todos = true;
      for (let i = 0; i < cols; i++) if (!degenerado[linha + i]) todos = false;
      if (!todos) continue;
      const viz = (j === 0 ? 1 : j === nv ? nv - 1 : j + 1) * cols;
      const m = new THREE.Vector3();
      for (let i = 0; i < nu; i++) m.add(normais[viz + i]);
      if (m.lengthSq() < 1e-10) m.copy(pontos[linha]).sub(pontos[viz]);
      m.normalize();
      for (let i = 0; i < cols; i++) normais[linha + i].copy(m);
    }
    let sinal = s.orientar ?? 0;
    if (!sinal) {
      const centro = new THREE.Vector3();
      for (const p of pontos) centro.add(p);
      centro.divideScalar(pontos.length);
      let voto = 0;
      for (let k = 0; k < pontos.length; k++) voto += Math.sign(normais[k].dot(A.subVectors(pontos[k], centro)));
      sinal = voto >= 0 ? 1 : -1;
    }
    for (let j = 0; j <= nv; j++) {
      const v = j / nv;
      for (let i = 0; i < cols; i++) {
        const u = i / nu;
        const k = j * cols + i;
        const p = pontos[k];
        const n = normais[k].multiplyScalar(sinal);
        this.pos.push(p.x, p.y, p.z);
        this.nor.push(n.x, n.y, n.z);
        const t = s.uv ? s.uv(u, v) : ([u * lu, v * lv] as const);
        this.uv.push(t[0], t[1]);
        const c = s.cor ? s.cor(u, v, p) : this.corPadrao;
        this.cor.push(c[0], c[1], c[2]);
        const a = s.acab ? s.acab(u, v, p) : this.acabPadrao;
        this.acab.push(a[0], a[1], a[2], a[3]);
        if (s.pelo) {
          const f = s.pelo(u, v, p);
          this.pelo.push(f[0], f[1], f[2], 0);
        } else this.pelo.push(0, 1, 0, 0);
      }
    }
    for (let j = 0; j < nv; j++)
      for (let i = 0; i < nu; i++) {
        const a = base + j * cols + i;
        const b = a + 1;
        const c = a + cols;
        const d = c + 1;
        if (sinal > 0) this.idx.push(a, b, d, a, d, c);
        else this.idx.push(a, d, b, a, c, d);
      }
    return this;
  }

  /** Junta uma geometria pronta (transformada), com cor e acabamento únicos (e UV fixa, se dada). */
  juntar(g: THREE.BufferGeometry, m?: THREE.Matrix4, cor: Cor = this.corPadrao, acab: Acab = this.acabPadrao, uvFixo?: readonly [number, number]): this {
    const base = this.vertices;
    const p = g.getAttribute('position');
    const n = g.getAttribute('normal');
    const t = g.getAttribute('uv');
    const c = g.getAttribute('color');
    if (m) M3.getNormalMatrix(m);
    for (let i = 0; i < p.count; i++) {
      P.fromBufferAttribute(p, i);
      if (m) P.applyMatrix4(m);
      this.pos.push(P.x, P.y, P.z);
      N.fromBufferAttribute(n, i);
      if (m) N.applyMatrix3(M3).normalize();
      this.nor.push(N.x, N.y, N.z);
      if (uvFixo) this.uv.push(uvFixo[0], uvFixo[1]);
      else this.uv.push(t ? t.getX(i) : 0, t ? t.getY(i) : 0);
      if (c) this.cor.push(c.getX(i) * cor[0], c.getY(i) * cor[1], c.getZ(i) * cor[2]);
      else this.cor.push(cor[0], cor[1], cor[2]);
      this.acab.push(acab[0], acab[1], acab[2], acab[3]);
      this.pelo.push(0, 1, 0, 0);
    }
    const ind = g.getIndex();
    if (ind) for (let i = 0; i < ind.count; i++) this.idx.push(ind.getX(i) + base);
    else for (let i = 0; i < p.count; i++) this.idx.push(i + base);
    return this;
  }

  /** Junta outro Molde inteiro (com as cores e acabamentos dele), transformado. */
  absorver(o: Molde, m?: THREE.Matrix4): this {
    const base = this.vertices;
    if (m) M3.getNormalMatrix(m);
    for (let i = 0; i < o.vertices; i++) {
      P.fromArray(o.pos, i * 3);
      N.fromArray(o.nor, i * 3);
      if (m) {
        P.applyMatrix4(m);
        N.applyMatrix3(M3).normalize();
      }
      this.pos.push(P.x, P.y, P.z);
      this.nor.push(N.x, N.y, N.z);
    }
    this.uv.push(...o.uv);
    this.cor.push(...o.cor);
    this.acab.push(...o.acab);
    this.pelo.push(...o.pelo);
    for (const k of o.idx) this.idx.push(k + base);
    return this;
  }

  /** Aplica uma transformação a tudo o que já foi moldado. */
  transformar(m: THREE.Matrix4): this {
    M3.getNormalMatrix(m);
    for (let i = 0; i < this.vertices; i++) {
      P.fromArray(this.pos, i * 3).applyMatrix4(m);
      P.toArray(this.pos, i * 3);
      N.fromArray(this.nor, i * 3).applyMatrix3(M3).normalize();
      N.toArray(this.nor, i * 3);
    }
    return this;
  }

  /** Escurece a cor dos vértices por uma função da posição (oclusão pintada). */
  sombrear(f: (p: THREE.Vector3) => number): this {
    for (let i = 0; i < this.vertices; i++) {
      P.fromArray(this.pos, i * 3);
      const s = f(P);
      this.cor[i * 3] *= s;
      this.cor[i * 3 + 1] *= s;
      this.cor[i * 3 + 2] *= s;
    }
    return this;
  }

  /** Caixa envolvente do que já foi moldado. */
  caixa(out = new THREE.Box3()): THREE.Box3 {
    out.makeEmpty();
    for (let i = 0; i < this.vertices; i++) out.expandByPoint(P.fromArray(this.pos, i * 3));
    return out;
  }

  /**
   * A geometria final (posição, normal, uv, color, acab). Com `cascas` > 1, a malha se repete uma vez por
   * casca, com o número da casca no atributo `pelo.w` (o material da pelúcia empurra cada casca pela normal).
   */
  geometria(cascas = 0): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    const n = Math.max(1, cascas);
    const nv = this.vertices;
    const rep = (src: number[], k: number) => {
      const out = new Float32Array(src.length * n);
      for (let c = 0; c < n; c++) out.set(src, c * src.length);
      return new THREE.Float32BufferAttribute(out, k);
    };
    g.setAttribute('position', rep(this.pos, 3));
    g.setAttribute('normal', rep(this.nor, 3));
    g.setAttribute('uv', rep(this.uv, 2));
    g.setAttribute('color', rep(this.cor, 3));
    if (cascas > 0) {
      const pelo = new Float32Array(this.pelo.length * n);
      for (let c = 0; c < n; c++)
        for (let i = 0; i < nv; i++) {
          pelo[(c * nv + i) * 4] = this.pelo[i * 4];
          pelo[(c * nv + i) * 4 + 1] = this.pelo[i * 4 + 1];
          pelo[(c * nv + i) * 4 + 2] = this.pelo[i * 4 + 2];
          pelo[(c * nv + i) * 4 + 3] = c;
        }
      g.setAttribute('pelo', new THREE.Float32BufferAttribute(pelo, 4));
    } else g.setAttribute('acab', new THREE.Float32BufferAttribute(this.acab, 4));
    const idx: number[] = [];
    for (let c = 0; c < n; c++) for (const k of this.idx) idx.push(k + c * nv);
    g.setIndex(nv * n > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

/* ------------------------------------------------------------------ formas prontas */

/**
 * Torno: superfície de revolução em volta de Y. `perfil(v)` devolve [raio, altura] (v de 0 a 1, de baixo
 * para cima ou ao contrário, tanto faz); `ruido(u, v)` opcional multiplica o raio (1 + ruido).
 */
export function torno(perfil: (v: number) => readonly [number, number], ruido?: (u: number, v: number) => number): Superficie['ponto'] {
  return (u, v, out) => {
    const [r0, y] = perfil(v);
    const r = r0 * (1 + (ruido ? ruido(u, v) : 0));
    const a = u * Math.PI * 2;
    out.set(Math.sin(a) * r, y, Math.cos(a) * r);
  };
}

/** Quadros de transporte paralelo ao longo de uma curva amostrada (para tubos sem torção). */
export interface Quadros {
  pontos: THREE.Vector3[];
  tangentes: THREE.Vector3[];
  normais: THREE.Vector3[];
  binormais: THREE.Vector3[];
  /** Comprimento acumulado até cada amostra. */
  comp: number[];
}

export function quadros(curva: (t: number, out: THREE.Vector3) => void, amostras: number, normalInicial?: THREE.Vector3): Quadros {
  const pontos: THREE.Vector3[] = [];
  for (let i = 0; i <= amostras; i++) {
    const p = new THREE.Vector3();
    curva(i / amostras, p);
    pontos.push(p);
  }
  const tangentes = pontos.map((_, i) => new THREE.Vector3().subVectors(pontos[Math.min(amostras, i + 1)], pontos[Math.max(0, i - 1)]).normalize());
  const normais: THREE.Vector3[] = [];
  const binormais: THREE.Vector3[] = [];
  const comp: number[] = [0];
  for (let i = 0; i <= amostras; i++) {
    const t = tangentes[i];
    const n = new THREE.Vector3();
    if (i === 0) {
      n.copy(normalInicial ?? (Math.abs(t.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)));
      n.addScaledVector(t, -n.dot(t)).normalize();
    } else {
      n.copy(normais[i - 1]).addScaledVector(t, -normais[i - 1].dot(t)).normalize();
      comp.push(comp[i - 1] + pontos[i].distanceTo(pontos[i - 1]));
    }
    normais.push(n);
    binormais.push(new THREE.Vector3().crossVectors(t, n).normalize());
  }
  return { pontos, tangentes, normais, binormais, comp };
}

/** Interpola os quadros em t (0 a 1). */
function noQuadro(q: Quadros, t: number, p: THREE.Vector3, n: THREE.Vector3, b: THREE.Vector3) {
  const k = q.pontos.length - 1;
  const f = Math.min(k - 1e-6, Math.max(0, t * k));
  const i = Math.floor(f);
  const w = f - i;
  p.lerpVectors(q.pontos[i], q.pontos[i + 1], w);
  n.lerpVectors(q.normais[i], q.normais[i + 1], w).normalize();
  b.lerpVectors(q.binormais[i], q.binormais[i + 1], w).normalize();
}

const QP = new THREE.Vector3();
const QN = new THREE.Vector3();
const QB = new THREE.Vector3();

/**
 * Tubo varrido ao longo de quadros. `raio(u, v)` devolve [raio na normal, raio na binormal]; `torcao(v)`
 * gira a seção (radianos). Pontas fechadas em calota quando `tampas` (o raio cai a zero nas pontas).
 */
export function tubo(q: Quadros, raio: (u: number, v: number) => readonly [number, number], torcao?: (v: number) => number, tampas = 0): Superficie['ponto'] {
  return (u, v, out) => {
    noQuadro(q, v, QP, QN, QB);
    let [r1, r2] = raio(u, v);
    if (tampas > 0) {
      const f = Math.min(1, Math.min(v, 1 - v) / tampas);
      const k = Math.sqrt(Math.max(0, 1 - (1 - f) * (1 - f)));
      r1 *= k;
      r2 *= k;
    }
    const a = u * Math.PI * 2 + (torcao ? torcao(v) : 0);
    out.copy(QP).addScaledVector(QN, Math.cos(a) * r1).addScaledVector(QB, Math.sin(a) * r2);
  };
}

/** Elipsoide deformável: centro, raios e uma deformação radial opcional (1 + d). u em volta de Y, v de baixo (0) a cima (1). */
export function elipsoide(c: THREE.Vector3, rx: number, ry: number, rz: number, deform?: (u: number, v: number, dir: THREE.Vector3) => number): Superficie['ponto'] {
  const dir = new THREE.Vector3();
  return (u, v, out) => {
    const th = u * Math.PI * 2;
    const ph = (v - 0.5) * Math.PI;
    dir.set(Math.sin(th) * Math.cos(ph), Math.sin(ph), Math.cos(th) * Math.cos(ph));
    const k = 1 + (deform ? deform(u, v, dir) : 0);
    out.set(c.x + dir.x * rx * k, c.y + dir.y * ry * k, c.z + dir.z * rz * k);
  };
}

/** Converte uma cor sRGB (#rrggbb) para a cor linear de vértice. */
export function linear(hex: string, mult = 1): Cor {
  const c = new THREE.Color(hex);
  return [c.r * mult, c.g * mult, c.b * mult];
}

/** Mistura duas cores. */
export function mistura(a: Cor, b: Cor, t: number): Cor {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

export function escala(a: Cor, k: number): Cor {
  return [a[0] * k, a[1] * k, a[2] * k];
}
