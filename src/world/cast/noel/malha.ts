/**
 * Construtor de malhas esculpidas do Noel.
 *
 * Cada peça é uma SUPERFÍCIE PARAMÉTRICA P(u, v) (u em volta, v ao longo). Daí saem a grade de vértices,
 * as normais por diferenças finitas (lisas na costura e nos polos), as coordenadas de textura em metros,
 * a cor de vértice e os pesos de pele (quais ossos movem cada vértice). As peças de um mesmo material se
 * acumulam em uma geometria só, presa ao esqueleto: uma chamada de desenho por material.
 */
import * as THREE from 'three';

/** Pares [índice do osso, peso]. Normalizados no fim (no máximo 4 por vértice). */
export type Pesos = ReadonlyArray<readonly [number, number]>;
export type Cor = readonly [number, number, number];

export interface Superficie {
  /** Divisões em volta (u) e ao longo (v). */
  nu: number;
  nv: number;
  /** O ponto da superfície em (u, v), ambos de 0 a 1. Escreve em `out`. */
  ponto(u: number, v: number, out: THREE.Vector3): void;
  /** Ossos que movem o ponto. */
  pesos(u: number, v: number, p: THREE.Vector3): Pesos;
  /** Cor de vértice (linear). Padrão branco. */
  cor?(u: number, v: number, p: THREE.Vector3): Cor;
  /** Coordenadas de textura; padrão: metros medidos na própria superfície. */
  uv?(u: number, v: number): readonly [number, number];
  /** u fecha em volta (padrão true). */
  fechadoU?: boolean;
  /** Força a orientação das normais (sem a votação de dentro e fora). */
  orientar?: 1 | -1;
  /** Só para o pelo: [comprimento do pelo em metros, esticamento dos fios ao longo de v, semente] por vértice. */
  pelo?(u: number, v: number, p: THREE.Vector3): readonly [number, number, number];
  /**
   * Só para o pelo em cascas: a peça entra só na casca de baixo (a superfície fofa), sem as cascas de
   * cima. Para o que nunca aparece de perto (o lado da barra encostado na poltrona): economiza triângulos.
   */
  soBase?: boolean;
}

const P = new THREE.Vector3();
const A = new THREE.Vector3();
const B = new THREE.Vector3();
const C = new THREE.Vector3();
const D = new THREE.Vector3();
const DU = new THREE.Vector3();
const DV = new THREE.Vector3();
const N = new THREE.Vector3();

export class Acumulador {
  pos: number[] = [];
  nor: number[] = [];
  uv: number[] = [];
  cor: number[] = [];
  ossos: number[] = [];
  pesos: number[] = [];
  pelo: number[] = [];
  idx: number[] = [];
  /** Índices que só entram na casca de baixo (veja Superficie.soBase). */
  idxBase: number[] = [];

  get vertices() {
    return this.pos.length / 3;
  }
  /** Triângulos de uma camada (todas as peças). */
  get triangulos() {
    return (this.idx.length + this.idxBase.length) / 3;
  }
  /** Triângulos que se repetem em cada casca de cima. */
  get triangulosPorCasca() {
    return this.idx.length / 3;
  }

  private pele(w: Pesos) {
    const lista = w
      .filter((x) => x[1] > 1e-4)
      .slice()
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
    let soma = 0;
    for (const x of lista) soma += x[1];
    if (soma <= 0) {
      this.ossos.push(0, 0, 0, 0);
      this.pesos.push(1, 0, 0, 0);
      return;
    }
    for (let k = 0; k < 4; k++) {
      const x = lista[k];
      this.ossos.push(x ? x[0] : 0);
      this.pesos.push(x ? x[1] / soma : 0);
    }
  }

  adicionar(s: Superficie): void {
    const fechado = s.fechadoU ?? true;
    const nu = s.nu;
    const nv = s.nv;
    const cols = fechado ? nu + 1 : nu + 1;
    const base = this.vertices;
    const du = 0.25 / nu;
    const dv = 0.25 / nv;

    // comprimentos médios em u e em v (para UV em metros)
    let lu = 0;
    let lv = 0;
    {
      const passos = 24;
      for (let i = 0; i < passos; i++) {
        s.ponto(i / passos, 0.5, A);
        s.ponto((i + 1) / passos, 0.5, B);
        lu += A.distanceTo(B);
        s.ponto(0.5, i / passos, A);
        s.ponto(0.5, (i + 1) / passos, B);
        lv += A.distanceTo(B);
      }
    }

    const normais: THREE.Vector3[] = [];
    const pontos: THREE.Vector3[] = [];
    const degenerado: boolean[] = [];
    for (let j = 0; j <= nv; j++) {
      const v = j / nv;
      for (let i = 0; i < cols; i++) {
        const u = i / nu;
        s.ponto(u, v, P);
        pontos.push(P.clone());
        // diferenças finitas
        const ua = fechado ? u - du : Math.max(0, u - du);
        const ub = fechado ? u + du : Math.min(1, u + du);
        s.ponto(ua, v, A);
        s.ponto(ub, v, B);
        DU.subVectors(B, A);
        s.ponto(u, Math.max(0, v - dv), C);
        s.ponto(u, Math.min(1, v + dv), D);
        DV.subVectors(D, C);
        N.crossVectors(DU, DV);
        const len = N.length();
        const ref = Math.max(1e-12, DU.length() * DV.length());
        degenerado.push(len / ref < 1e-3);
        normais.push(len > 0 ? N.clone().divideScalar(len) : new THREE.Vector3(0, 1, 0));
      }
    }
    // linhas degeneradas (polos): média das normais da linha vizinha
    for (let j = 0; j <= nv; j++) {
      const linha = j * cols;
      let todos = true;
      for (let i = 0; i < cols; i++) if (!degenerado[linha + i]) todos = false;
      if (!todos) continue;
      const viz = (j === 0 ? 1 : j === nv ? nv - 1 : j + 1) * cols;
      const m = new THREE.Vector3();
      for (let i = 0; i < nu; i++) m.add(normais[viz + i]);
      if (m.lengthSq() < 1e-10) {
        // vizinha também simétrica: usa a direção do eixo (do vizinho ao polo)
        m.copy(pontos[linha]).sub(pontos[viz]);
      }
      m.normalize();
      for (let i = 0; i < cols; i++) normais[linha + i].copy(m);
    }
    // orientação: votação (as normais apontam para fora do centroide)
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
        const c = s.cor ? s.cor(u, v, p) : ([1, 1, 1] as const);
        this.cor.push(c[0], c[1], c[2]);
        this.pele(s.pesos(u, v, p));
        if (s.pelo) {
          const f = s.pelo(u, v, p);
          this.pelo.push(f[0], f[1], f[2], 0);
        } else this.pelo.push(0, 1, 0, 0);
      }
    }
    const destino = s.soBase ? this.idxBase : this.idx;
    for (let j = 0; j < nv; j++)
      for (let i = 0; i < nu; i++) {
        const a = base + j * cols + i;
        const b = a + 1;
        const c = a + cols;
        const d = c + 1;
        if (sinal > 0) destino.push(a, b, d, a, d, c);
        else destino.push(a, d, b, a, c, d);
      }
  }

  /**
   * Geometria pronta (com atributos de pele). `camadas` > 1 replica tudo em cascas para o pelo (os índices
   * ficam em ordem de casca: o drawRange corta as de cima; as peças `soBase` só entram na casca 0, logo
   * no começo). `comPelo` grava o atributo do pelo mesmo com uma camada só.
   */
  geometria(camadas = 1, comPelo = false): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    const nvert = this.vertices;
    const rep = <T extends number[]>(arr: T, n: number) => {
      const out = new Float32Array(arr.length * n);
      for (let k = 0; k < n; k++) out.set(arr, k * arr.length);
      return out;
    };
    g.setAttribute('position', new THREE.BufferAttribute(rep(this.pos, camadas), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(rep(this.nor, camadas), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(rep(this.uv, camadas), 2));
    g.setAttribute('color', new THREE.BufferAttribute(rep(this.cor, camadas), 3));
    const ossos = new Uint16Array(this.ossos.length * camadas);
    for (let k = 0; k < camadas; k++) ossos.set(this.ossos, k * this.ossos.length);
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(ossos, 4));
    g.setAttribute('skinWeight', new THREE.BufferAttribute(rep(this.pesos, camadas), 4));
    if (camadas > 1 || comPelo) {
      const pelo = rep(this.pelo, camadas);
      for (let k = 0; k < camadas; k++) for (let i = 0; i < nvert; i++) pelo[(k * nvert + i) * 4 + 3] = k;
      g.setAttribute('pelo', new THREE.BufferAttribute(pelo, 4));
    }
    const total = nvert * camadas;
    const Idx = total > 65535 ? Uint32Array : Uint16Array;
    const nb = this.idxBase.length;
    const idx = new Idx(nb + this.idx.length * camadas);
    idx.set(this.idxBase, 0);
    for (let k = 0; k < camadas; k++) for (let i = 0; i < this.idx.length; i++) idx[nb + k * this.idx.length + i] = this.idx[i] + k * nvert;
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeBoundingSphere();
    return g;
  }
}

/* ------------------------------------------------------------------ caminhos e tubos */

/**
 * Caminho suave por pontos de controle (Catmull-Rom centrípeta), amostrado por comprimento de arco,
 * com referenciais por transporte paralelo (ou com um eixo lateral fixo, para peças planas como a bota).
 */
export class Caminho {
  readonly pts: THREE.Vector3[] = [];
  readonly tan: THREE.Vector3[] = [];
  readonly nrm: THREE.Vector3[] = [];
  readonly bin: THREE.Vector3[] = [];
  readonly comprimento: number;
  private readonly n: number;

  constructor(controle: THREE.Vector3[], opts: { amostras?: number; lateral?: THREE.Vector3; normalInicial?: THREE.Vector3 } = {}) {
    const curva = new THREE.CatmullRomCurve3(controle, false, 'centripetal');
    const n = opts.amostras ?? 64;
    this.n = n;
    const pts = curva.getSpacedPoints(n);
    this.pts.push(...pts);
    for (let i = 0; i <= n; i++) {
      const a = pts[Math.max(0, i - 1)];
      const b = pts[Math.min(n, i + 1)];
      this.tan.push(b.clone().sub(a).normalize());
    }
    if (opts.lateral) {
      const l = opts.lateral.clone().normalize();
      for (let i = 0; i <= n; i++) {
        const t = this.tan[i];
        const nn = new THREE.Vector3().crossVectors(l, t).normalize();
        this.nrm.push(nn);
        this.bin.push(new THREE.Vector3().crossVectors(t, nn).normalize());
      }
    } else {
      // transporte paralelo a partir de uma normal inicial
      const t0 = this.tan[0];
      let n0 = opts.normalInicial ? opts.normalInicial.clone() : Math.abs(t0.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
      n0 = n0.sub(t0.clone().multiplyScalar(n0.dot(t0))).normalize();
      this.nrm.push(n0);
      this.bin.push(new THREE.Vector3().crossVectors(t0, n0).normalize());
      for (let i = 1; i <= n; i++) {
        const q = new THREE.Quaternion().setFromUnitVectors(this.tan[i - 1], this.tan[i]);
        const ni = this.nrm[i - 1].clone().applyQuaternion(q);
        ni.sub(this.tan[i].clone().multiplyScalar(ni.dot(this.tan[i]))).normalize();
        this.nrm.push(ni);
        this.bin.push(new THREE.Vector3().crossVectors(this.tan[i], ni).normalize());
      }
    }
    let L = 0;
    for (let i = 0; i < n; i++) L += pts[i].distanceTo(pts[i + 1]);
    this.comprimento = L;
  }

  /** Interpola o referencial em v (0 a 1). */
  em(v: number, ponto: THREE.Vector3, t?: THREE.Vector3, nn?: THREE.Vector3, b?: THREE.Vector3) {
    const x = Math.min(Math.max(v, 0), 1) * this.n;
    const i = Math.min(this.n - 1, Math.floor(x));
    const f = x - i;
    ponto.copy(this.pts[i]).lerp(this.pts[i + 1], f);
    if (t) t.copy(this.tan[i]).lerp(this.tan[i + 1], f).normalize();
    if (nn) nn.copy(this.nrm[i]).lerp(this.nrm[i + 1], f).normalize();
    if (b) b.copy(this.bin[i]).lerp(this.bin[i + 1], f).normalize();
  }
}

const TC = new THREE.Vector3();
const TT = new THREE.Vector3();
const TN = new THREE.Vector3();
const TB = new THREE.Vector3();

/**
 * Tubo ao longo de um caminho. `raio(u, v)` devolve [raio na direção da normal, raio na da binormal].
 * Com `pontas`, as extremidades fecham em calota redonda (o raio vai a zero pelo perfil de uma esfera).
 */
export function tubo(
  caminho: Caminho,
  raio: (u: number, v: number) => readonly [number, number],
  opts: { pontas?: [boolean, boolean]; calota?: number; deformar?: (p: THREE.Vector3, u: number, v: number, centro: THREE.Vector3) => void } = {},
) {
  const [ini, fim] = opts.pontas ?? [true, true];
  const cal = opts.calota ?? 0.12;
  return (u: number, v: number, out: THREE.Vector3) => {
    // as calotas ocupam as pontas do intervalo de v
    let vv = v;
    let fator = 1;
    let avanco = 0;
    if (ini && v < cal) {
      const a = (1 - v / cal) * (Math.PI / 2);
      fator = Math.cos(a);
      avanco = -Math.sin(a);
      vv = 0;
    } else if (fim && v > 1 - cal) {
      const a = ((v - (1 - cal)) / cal) * (Math.PI / 2);
      fator = Math.cos(a);
      avanco = Math.sin(a);
      vv = 1;
    } else {
      const a0 = ini ? cal : 0;
      const a1 = fim ? 1 - cal : 1;
      vv = (v - a0) / (a1 - a0);
    }
    caminho.em(vv, TC, TT, TN, TB);
    const [r1, r2] = raio(u, vv);
    const ang = u * Math.PI * 2;
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    out.copy(TC)
      .addScaledVector(TN, c * r1 * fator)
      .addScaledVector(TB, s * r2 * fator)
      .addScaledVector(TT, avanco * Math.min(r1, r2));
    if (opts.deformar) opts.deformar(out, u, vv, TC);
  };
}

/** Elipsoide com raio deformável: `raio(dir)` multiplica os raios base na direção `dir` (unitária). */
export function elipsoide(centro: THREE.Vector3, raios: THREE.Vector3, opts: { base?: THREE.Quaternion; deformar?: (dir: THREE.Vector3, u: number, v: number) => number } = {}) {
  const dir = new THREE.Vector3();
  return (u: number, v: number, out: THREE.Vector3) => {
    const th = u * Math.PI * 2;
    const ph = v * Math.PI;
    dir.set(Math.sin(ph) * Math.sin(th), Math.cos(ph), Math.sin(ph) * Math.cos(th));
    const k = opts.deformar ? opts.deformar(dir, u, v) : 1;
    out.set(dir.x * raios.x * k, dir.y * raios.y * k, dir.z * raios.z * k);
    if (opts.base) out.applyQuaternion(opts.base);
    out.add(centro);
  };
}
