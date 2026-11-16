/**
 * Ferramentas comuns do exterior: gerador com semente, ruído determinístico e um acumulador de malha
 * (posições, normais, UV e cor por vértice) para juntar muita geometria estática em poucas chamadas de desenho.
 */
import * as THREE from 'three';

export type Rng = () => number;

/** Gerador pseudoaleatório com semente (mulberry32): a mesma semente dá sempre a mesma vila. */
export function criarRng(semente: number): Rng {
  let a = (semente * 2654435761) >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const faixa = (r: Rng, a: number, b: number) => a + (b - a) * r();
export const mistura = (a: number, b: number, t: number) => a + (b - a) * t;
export const limitar = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
export function suave(a: number, b: number, x: number): number {
  const t = limitar((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

function hash2(ix: number, iy: number): number {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Ruído de valor em 2D, de 0 a 1, contínuo. */
export function ruido2(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy);
  const b = hash2(ix + 1, iy);
  const c = hash2(ix, iy + 1);
  const d = hash2(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

/** Soma de oitavas de ruído, de 0 a 1. */
export function fbm(x: number, y: number, oitavas = 4): number {
  let amp = 0.5;
  let soma = 0;
  let norma = 0;
  for (let i = 0; i < oitavas; i++) {
    soma += amp * ruido2(x, y);
    norma += amp;
    x = x * 2.03 + 17.1;
    y = y * 2.03 + 9.7;
    amp *= 0.5;
  }
  return soma / norma;
}

/** Interpolação suave (Catmull-Rom) por uma lista de pontos [x, y] com x crescente. */
export function curva(pontos: ReadonlyArray<readonly [number, number]>, x: number): number {
  const n = pontos.length;
  if (x <= pontos[0][0]) return pontos[0][1];
  if (x >= pontos[n - 1][0]) return pontos[n - 1][1];
  let i = 0;
  while (i < n - 2 && x > pontos[i + 1][0]) i++;
  const p0 = pontos[Math.max(0, i - 1)];
  const p1 = pontos[i];
  const p2 = pontos[i + 1];
  const p3 = pontos[Math.min(n - 1, i + 2)];
  const t = (x - p1[0]) / (p2[0] - p1[0]);
  // tangentes de diferenças finitas (pontos com espaçamento desigual)
  const m1 = ((p2[1] - p0[1]) / (p2[0] - p0[0])) * (p2[0] - p1[0]);
  const m2 = ((p3[1] - p1[1]) / (p3[0] - p1[0])) * (p2[0] - p1[0]);
  const t2 = t * t;
  const t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * p1[1] + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * p2[1] + (t3 - t2) * m2;
}

const _p = new THREE.Vector3();
const _n = new THREE.Vector3();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();

export interface CorVertice {
  /** Multiplicador de cor (oclusão pintada, variação). */
  r?: number;
  g?: number;
  b?: number;
  /** Quanto de luz quente local este vértice recebe (janela, lampião), de 0 a 1 ou mais. */
  quente?: number;
}

/**
 * Acumulador de malha. Os vértices entram já transformados pela matriz corrente (`definir`), de modo que
 * tudo o que usa o mesmo material vira uma geometria só. Faces planas têm a normal calculada pela ordem
 * dos cantos; superfícies curvas usam `suavizar`. Os materiais do exterior desenham os dois lados e viram a
 * normal para o lado de quem olha (pela normal geométrica do fragmento), então o sentido dos cantos é livre.
 */
export class Malha {
  readonly pos: number[] = [];
  readonly nor: number[] = [];
  readonly uv: number[] = [];
  readonly cor: number[] = [];
  readonly idx: number[] = [];
  private readonly mat = new THREE.Matrix4();
  private readonly matN = new THREE.Matrix3();

  get vertices(): number {
    return this.pos.length / 3;
  }
  get triangulos(): number {
    return this.idx.length / 3;
  }

  /** Define a transformação aplicada aos próximos vértices. */
  definir(m: THREE.Matrix4): this {
    this.mat.copy(m);
    this.matN.getNormalMatrix(m);
    return this;
  }
  get matriz(): THREE.Matrix4 {
    return this.mat;
  }

  v(x: number, y: number, z: number, nx: number, ny: number, nz: number, u: number, vv: number, c?: CorVertice): number {
    _p.set(x, y, z).applyMatrix4(this.mat);
    _n.set(nx, ny, nz).applyMatrix3(this.matN).normalize();
    this.pos.push(_p.x, _p.y, _p.z);
    this.nor.push(_n.x, _n.y, _n.z);
    this.uv.push(u, vv);
    this.cor.push(c?.r ?? 1, c?.g ?? 1, c?.b ?? 1, c?.quente ?? 0);
    return this.pos.length / 3 - 1;
  }

  tri(a: number, b: number, c: number) {
    this.idx.push(a, b, c);
  }

  /**
   * Face plana de quatro cantos (em volta, em qualquer sentido). A UV é plana: u ao longo de p0->p1, v ao longo
   * de p0->p3, em metros divididos por `ladrilho` (tamanho real do ladrilho da textura), com deslocamento `du`, `dv`.
   */
  face(p0: THREE.Vector3, p1: THREE.Vector3, p2: THREE.Vector3, p3: THREE.Vector3, ladrilho = 1, c?: CorVertice, du = 0, dv = 0, c2?: CorVertice) {
    _a.subVectors(p1, p0);
    _b.subVectors(p3, p0);
    _c.crossVectors(_a, _b).normalize();
    const lu = _a.length() / ladrilho;
    const lv = _b.length() / ladrilho;
    // c vale para os cantos de baixo (p0, p1); c2, se dado, para os de cima (p3, p2): degradê barato
    const i0 = this.v(p0.x, p0.y, p0.z, _c.x, _c.y, _c.z, du, dv, c);
    const i1 = this.v(p1.x, p1.y, p1.z, _c.x, _c.y, _c.z, du + lu, dv, c);
    const i2 = this.v(p2.x, p2.y, p2.z, _c.x, _c.y, _c.z, du + lu, dv + lv, c2 ?? c);
    const i3 = this.v(p3.x, p3.y, p3.z, _c.x, _c.y, _c.z, du, dv + lv, c2 ?? c);
    this.idx.push(i0, i1, i2, i0, i2, i3);
  }

  /** Triângulo plano com UV plana (u ao longo de p0->p1). */
  triFace(p0: THREE.Vector3, p1: THREE.Vector3, p2: THREE.Vector3, ladrilho = 1, c?: CorVertice, du = 0, dv = 0) {
    _a.subVectors(p1, p0);
    _b.subVectors(p2, p0);
    _c.crossVectors(_a, _b).normalize();
    const lu = _a.length();
    const eu = _a.clone().normalize();
    const ev = new THREE.Vector3().crossVectors(_c, eu);
    const u2 = _b.dot(eu);
    const v2 = _b.dot(ev);
    const i0 = this.v(p0.x, p0.y, p0.z, _c.x, _c.y, _c.z, du, dv, c);
    const i1 = this.v(p1.x, p1.y, p1.z, _c.x, _c.y, _c.z, du + lu / ladrilho, dv, c);
    const i2 = this.v(p2.x, p2.y, p2.z, _c.x, _c.y, _c.z, du + u2 / ladrilho, dv + Math.abs(v2) / ladrilho, c);
    this.idx.push(i0, i1, i2);
  }

  /**
   * Caixa alinhada aos eixos da transformação corrente, centrada em (cx, cy, cz). `afina` estreita o topo
   * (1 = reto), para postes e mourões não ficarem com cara de bloco.
   */
  caixa(cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, ladrilho = 1, c?: CorVertice, opts: { afina?: number; semBase?: boolean; semTopo?: boolean; cTopo?: CorVertice; du?: number; dv?: number } = {}) {
    const hx = sx / 2;
    const hy = sy / 2;
    const hz = sz / 2;
    const f = opts.afina ?? 1;
    const P = (x: number, y: number, z: number) => new THREE.Vector3(cx + x * hx * (y > 0 ? f : 1), cy + y * hy, cz + z * hz * (y > 0 ? f : 1));
    const ct = opts.cTopo ?? c;
    // deslocamento da textura: peças repetidas (ripas, mourões) não podem mostrar o mesmo trecho da madeira
    const du = (cx + cz) * 0.37 + (opts.du ?? 0);
    const dv = cy - hy + (opts.dv ?? 0);
    this.face(P(-1, -1, 1), P(1, -1, 1), P(1, 1, 1), P(-1, 1, 1), ladrilho, c, du, dv, ct); // +z
    this.face(P(1, -1, -1), P(-1, -1, -1), P(-1, 1, -1), P(1, 1, -1), ladrilho, c, du + 0.31, dv, ct); // -z
    this.face(P(1, -1, 1), P(1, -1, -1), P(1, 1, -1), P(1, 1, 1), ladrilho, c, du + 0.57, dv, ct); // +x
    this.face(P(-1, -1, -1), P(-1, -1, 1), P(-1, 1, 1), P(-1, 1, -1), ladrilho, c, du + 0.83, dv, ct); // -x
    if (!opts.semTopo) this.face(P(-1, 1, 1), P(1, 1, 1), P(1, 1, -1), P(-1, 1, -1), ladrilho, ct, du, cz);
    if (!opts.semBase) this.face(P(-1, -1, -1), P(1, -1, -1), P(1, -1, 1), P(-1, -1, 1), ladrilho, c, du, cz);
  }

  /** Recalcula as normais dos vértices a partir de `v0`, somando as normais dos triângulos a partir de `t0` (superfície lisa). */
  suavizar(v0: number, t0: number) {
    const pos = this.pos;
    const nor = this.nor;
    for (let i = v0 * 3; i < nor.length; i++) nor[i] = 0;
    for (let i = t0 * 3; i < this.idx.length; i += 3) {
      const ia = this.idx[i];
      const ib = this.idx[i + 1];
      const ic = this.idx[i + 2];
      _a.set(pos[ib * 3] - pos[ia * 3], pos[ib * 3 + 1] - pos[ia * 3 + 1], pos[ib * 3 + 2] - pos[ia * 3 + 2]);
      _b.set(pos[ic * 3] - pos[ia * 3], pos[ic * 3 + 1] - pos[ia * 3 + 1], pos[ic * 3 + 2] - pos[ia * 3 + 2]);
      _c.crossVectors(_a, _b);
      for (const k of [ia, ib, ic]) {
        if (k < v0) continue;
        nor[k * 3] += _c.x;
        nor[k * 3 + 1] += _c.y;
        nor[k * 3 + 2] += _c.z;
      }
    }
    for (let i = v0 * 3; i < nor.length; i += 3) {
      const l = Math.hypot(nor[i], nor[i + 1], nor[i + 2]) || 1;
      nor[i] /= l;
      nor[i + 1] /= l;
      nor[i + 2] /= l;
    }
  }

  /**
   * Grade lisa (nu x nv vértices) a partir de uma função de posição já no espaço local da transformação corrente.
   * `fn` devolve a posição e, opcionalmente, cor. As normais saem suaves. UV = (u, v) vezes `uvEscala`, ou posição xz
   * quando `uvPlano` é dado (em metros / ladrilho, no espaço final), para a neve não esticar.
   */
  grade(nu: number, nv: number, fn: (i: number, j: number, out: THREE.Vector3) => CorVertice | void, uvPlano = 1) {
    const v0 = this.vertices;
    const t0 = this.triangulos;
    const tmp = new THREE.Vector3();
    for (let j = 0; j < nv; j++) {
      for (let i = 0; i < nu; i++) {
        const c = fn(i, j, tmp) || undefined;
        const k = this.v(tmp.x, tmp.y, tmp.z, 0, 1, 0, 0, 0, c);
        // UV plana no espaço final (depois da transformação), para todas as neves terem o mesmo grão
        this.uv[k * 2] = (this.pos[k * 3] + this.pos[k * 3 + 1] * 0.35) / uvPlano;
        this.uv[k * 2 + 1] = (this.pos[k * 3 + 2] + this.pos[k * 3 + 1] * 0.35) / uvPlano;
      }
    }
    for (let j = 0; j < nv - 1; j++) {
      for (let i = 0; i < nu - 1; i++) {
        const a = v0 + j * nu + i;
        this.idx.push(a, a + nu, a + 1, a + 1, a + nu, a + nu + 1);
      }
    }
    this.suavizar(v0, t0);
  }

  /**
   * Tubo ao longo de pontos (no espaço da transformação corrente) com raio por ponto. Lados poucos para galhos
   * finos. UV: u em volta, v pelo comprimento, em ladrilhos.
   */
  tubo(pontos: THREE.Vector3[], raios: number[], lados: number, ladrilho = 1, c?: CorVertice, fechaPonta = true) {
    const v0 = this.vertices;
    const n = pontos.length;
    const tan = new THREE.Vector3();
    const ref = new THREE.Vector3(0.31, 0.2, 0.93).normalize();
    const e1 = new THREE.Vector3();
    const e2 = new THREE.Vector3();
    let comp = 0;
    const voltas = Math.max(1, Math.round((2 * Math.PI * raios[0]) / ladrilho));
    for (let i = 0; i < n; i++) {
      if (i < n - 1) tan.subVectors(pontos[i + 1], pontos[i]);
      if (i > 0) tan.add(_a.subVectors(pontos[i], pontos[i - 1]));
      tan.normalize();
      // transporte paralelo aproximado: reprojeta a referência anterior no plano normal
      e1.copy(ref).addScaledVector(tan, -ref.dot(tan));
      if (e1.lengthSq() < 1e-6) e1.set(1, 0, 0).addScaledVector(tan, -tan.x);
      e1.normalize();
      e2.crossVectors(tan, e1);
      ref.copy(e1);
      if (i > 0) comp += pontos[i].distanceTo(pontos[i - 1]);
      for (let k = 0; k <= lados; k++) {
        const a = (k / lados) * Math.PI * 2;
        const cx = Math.cos(a);
        const sx = Math.sin(a);
        const r = raios[i];
        this.v(
          pontos[i].x + (e1.x * cx + e2.x * sx) * r,
          pontos[i].y + (e1.y * cx + e2.y * sx) * r,
          pontos[i].z + (e1.z * cx + e2.z * sx) * r,
          e1.x * cx + e2.x * sx,
          e1.y * cx + e2.y * sx,
          e1.z * cx + e2.z * sx,
          (k / lados) * voltas,
          comp / ladrilho,
          c,
        );
      }
    }
    const linha = lados + 1;
    for (let i = 0; i < n - 1; i++) {
      for (let k = 0; k < lados; k++) {
        const a = v0 + i * linha + k;
        this.idx.push(a, a + linha, a + 1, a + 1, a + linha, a + linha + 1);
      }
    }
    if (fechaPonta) {
      const p = pontos[n - 1];
      const centro = this.v(p.x, p.y, p.z, tan.x, tan.y, tan.z, 0.5, comp / ladrilho, c);
      const base = v0 + (n - 1) * linha;
      for (let k = 0; k < lados; k++) this.idx.push(base + k, centro, base + k + 1);
    }
  }

  /**
   * Sólido de revolução em volta do eixo Y local: `perfil` = pontos [raio, altura] de baixo para cima. Normais lisas
   * (ferro fundido, colunas, vasos). `lados` pequeno (6) dá uma peça sextavada.
   */
  torno(perfil: ReadonlyArray<readonly [number, number]>, lados: number, ladrilho = 1, c?: CorVertice, giro = 0, liso = true) {
    const v0 = this.vertices;
    const t0 = this.triangulos;
    let comp = 0;
    for (let j = 0; j < perfil.length; j++) {
      if (j > 0) comp += Math.hypot(perfil[j][0] - perfil[j - 1][0], perfil[j][1] - perfil[j - 1][1]);
      for (let k = 0; k <= lados; k++) {
        const a = giro + (k / lados) * Math.PI * 2;
        const [r, y] = perfil[j];
        this.v(Math.cos(a) * r, y, Math.sin(a) * r, Math.cos(a), 0, Math.sin(a), k / lados, comp / ladrilho, c);
      }
    }
    const linha = lados + 1;
    for (let j = 0; j < perfil.length - 1; j++) {
      for (let k = 0; k < lados; k++) {
        const a = v0 + j * linha + k;
        this.idx.push(a, a + linha, a + 1, a + 1, a + linha, a + linha + 1);
      }
    }
    if (liso) this.suavizar(v0, t0);
  }

  /** Junta outra malha (já transformada) nesta. */
  juntar(o: Malha) {
    const base = this.vertices;
    for (const x of o.pos) this.pos.push(x);
    for (const x of o.nor) this.nor.push(x);
    for (const x of o.uv) this.uv.push(x);
    for (const x of o.cor) this.cor.push(x);
    for (const i of o.idx) this.idx.push(i + base);
  }

  geometria(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('aCor', new THREE.Float32BufferAttribute(this.cor, 4));
    g.setIndex(this.vertices > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    return g;
  }
}

/** Matriz de posição + rotação em Y + escala uniforme. */
export function matrizTRS(x: number, y: number, z: number, rotY: number, escala = 1): THREE.Matrix4 {
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY), new THREE.Vector3(escala, escala, escala));
}
