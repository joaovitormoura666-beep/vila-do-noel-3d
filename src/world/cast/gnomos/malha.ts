/**
 * Construtor de malhas esculpidas para os gnomos.
 *
 * Toda peça é uma SUPERFÍCIE PARAMÉTRICA: uma função P(u, v) que devolve um ponto (u em volta, v ao
 * longo). Daí saem a grade de vértices, as normais por diferenças finitas (lisas mesmo na costura),
 * as coordenadas de textura, a cor de vértice e os pesos de pele (quais ossos movem cada vértice).
 * As peças de um mesmo material se acumulam em uma geometria só, presa ao esqueleto do gnomo:
 * uma chamada de desenho por material.
 */
import * as THREE from 'three';

/** Pares [índice do osso, peso]. Os pesos são normalizados no fim (no máximo 4 ossos por vértice). */
export type Pesos = ReadonlyArray<readonly [number, number]>;
export type Cor4 = readonly [number, number, number, number];

export interface Superficie {
  /** Divisões em volta (u) e ao longo (v). */
  nu: number;
  nv: number;
  /** O ponto da superfície em (u, v), ambos de 0 a 1. Escreve em `out`. */
  ponto(u: number, v: number, out: THREE.Vector3): void;
  /** Coordenadas de textura. Padrão: (u, v). */
  uv?(u: number, v: number, p: THREE.Vector3): readonly [number, number];
  /** Cor de vértice (r, g, b em linear; a = máscara de motivo do tricô). Padrão branco. */
  cor?(u: number, v: number, p: THREE.Vector3): Cor4;
  /** Ossos que movem o ponto (no espaço da pose de ligação). */
  pesos(u: number, v: number, p: THREE.Vector3): Pesos;
  /**
   * Amostras de v explícitas (para listras nítidas: repita um valor para criar uma costura de cor;
   * a primeira cópia pega a cor de baixo e a segunda a de cima).
   */
  vs?: readonly number[];
  /** u fecha em volta (padrão true). Se false, a superfície é um retalho aberto. */
  fechadoU?: boolean;
  /** Força a orientação (sem a votação automática de dentro e fora). */
  orientar?: 1 | -1;
  /** Peça de dupla face (retalhos finos): gera as duas faces. */
  duplaFace?: boolean;
}

const P = new THREE.Vector3();
const A = new THREE.Vector3();
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
  idx: number[] = [];
  /** Variante do material de cada vértice (atributo `tipo`: tricô ou feltro, pele ou olho...). */
  tipo: number[] = [];
  /** Tipo gravado nos próximos vértices. */
  tipoAtual = 0;

  get vertices() {
    return this.pos.length / 3;
  }
  get triangulos() {
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
    for (let k = 0; k < 4; k++) {
      const x = lista[k];
      this.ossos.push(x ? x[0] : 0);
      this.pesos.push(x ? x[1] / soma : 0);
    }
  }

  adicionar(s: Superficie): void {
    const fechado = s.fechadoU ?? true;
    const nu = s.nu;
    const vs = s.vs ?? Array.from({ length: s.nv + 1 }, (_, j) => j / s.nv);
    const colunas = nu + 1;
    const base = this.vertices;
    const e = 1e-3;
    const ponto = (u: number, v: number, out: THREE.Vector3) => s.ponto(fechado ? ((u % 1) + 1) % 1 : THREE.MathUtils.clamp(u, 0, 1), THREE.MathUtils.clamp(v, 0, 1), out);
    // centro da peça, para a votação de orientação
    let cx = 0;
    let cy = 0;
    let cz = 0;
    const normais: number[] = [];
    const posicoes: number[] = [];
    let votos = 0;
    for (let j = 0; j < vs.length; j++) {
      const v = vs[j];
      // amostra repetida = costura de cor: a cor sai do lado de baixo (primeira) e de cima (segunda)
      const lado = j > 0 && vs[j - 1] === v ? 1e-4 : j < vs.length - 1 && vs[j + 1] === v ? -1e-4 : 0;
      for (let i = 0; i < colunas; i++) {
        const u = i / nu;
        ponto(u, v, P);
        // normal por diferenças finitas de um lado só (perto dos polos, afasta um pouco para dentro)
        let vv = v;
        D.copy(P);
        for (let tent = 0; tent < 4; tent++) {
          ponto(u + e, vv, A);
          DU.subVectors(A, D);
          if (DU.lengthSq() > 1e-16) break;
          vv = v < 0.5 ? vv + 0.004 : vv - 0.004;
          ponto(u, vv, D);
        }
        if (v + e <= 1) {
          ponto(u, v + e, C);
          DV.subVectors(C, P);
        } else {
          ponto(u, v - e, C);
          DV.subVectors(P, C);
        }
        N.crossVectors(DU, DV);
        if (N.lengthSq() < 1e-24) N.set(0, 1, 0);
        N.normalize();
        posicoes.push(P.x, P.y, P.z);
        normais.push(N.x, N.y, N.z);
        cx += P.x;
        cy += P.y;
        cz += P.z;
        const t = s.uv ? s.uv(u, v, P) : ([u, v] as const);
        this.uv.push(t[0], t[1]);
        const c = s.cor ? s.cor(u, v + lado, P) : ([1, 1, 1, 0] as const);
        this.cor.push(c[0], c[1], c[2], c[3]);
        this.tipo.push(this.tipoAtual);
        this.pele(s.pesos(u, v, P));
      }
    }
    const n = posicoes.length / 3;
    cx /= n;
    cy /= n;
    cz /= n;
    for (let k = 0; k < n; k++) votos += Math.sign((posicoes[k * 3] - cx) * normais[k * 3] + (posicoes[k * 3 + 1] - cy) * normais[k * 3 + 1] + (posicoes[k * 3 + 2] - cz) * normais[k * 3 + 2]);
    const sinal = s.orientar ?? (votos < 0 ? -1 : 1);
    for (let k = 0; k < n; k++) {
      this.pos.push(posicoes[k * 3], posicoes[k * 3 + 1], posicoes[k * 3 + 2]);
      this.nor.push(normais[k * 3] * sinal, normais[k * 3 + 1] * sinal, normais[k * 3 + 2] * sinal);
    }
    for (let j = 0; j < vs.length - 1; j++) {
      if (vs[j] === vs[j + 1]) continue; // costura de cor: sem triângulos de área zero
      for (let i = 0; i < nu; i++) {
        const a = base + j * colunas + i;
        const b = a + 1;
        const d = a + colunas;
        const c = d + 1;
        if (sinal > 0) this.idx.push(a, b, d, b, c, d);
        else this.idx.push(a, d, b, b, d, c);
      }
    }
    if (s.duplaFace) {
      // segunda face: mesmos vértices com normais invertidas
      const base2 = this.vertices;
      for (let k = 0; k < n; k++) {
        this.pos.push(posicoes[k * 3], posicoes[k * 3 + 1], posicoes[k * 3 + 2]);
        this.nor.push(-normais[k * 3] * sinal, -normais[k * 3 + 1] * sinal, -normais[k * 3 + 2] * sinal);
        const o = base + k;
        this.uv.push(this.uv[o * 2], this.uv[o * 2 + 1]);
        this.cor.push(this.cor[o * 4], this.cor[o * 4 + 1], this.cor[o * 4 + 2], this.cor[o * 4 + 3]);
        this.tipo.push(this.tipo[o]);
        for (let q = 0; q < 4; q++) {
          this.ossos.push(this.ossos[o * 4 + q]);
          this.pesos.push(this.pesos[o * 4 + q]);
        }
      }
      for (let j = 0; j < vs.length - 1; j++) {
        if (vs[j] === vs[j + 1]) continue;
        for (let i = 0; i < nu; i++) {
          const a = base2 + j * colunas + i;
          const b = a + 1;
          const d = a + colunas;
          const c = d + 1;
          if (sinal > 0) this.idx.push(a, d, b, b, d, c);
          else this.idx.push(a, b, d, b, c, d);
        }
      }
    }
  }

  /** Acrescenta uma geometria pronta do three (indexada ou não), transformada, com cor e pesos fixos. */
  adicionarGeometria(geo: THREE.BufferGeometry, matriz: THREE.Matrix4, cor: Cor4, pesos: Pesos | ((p: THREE.Vector3) => Pesos)): void {
    const g = geo.index ? geo : geo;
    const pos = g.getAttribute('position');
    const nor = g.getAttribute('normal');
    const uv = g.getAttribute('uv');
    const base = this.vertices;
    const nm = new THREE.Matrix3().getNormalMatrix(matriz);
    for (let i = 0; i < pos.count; i++) {
      P.fromBufferAttribute(pos, i).applyMatrix4(matriz);
      N.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize();
      this.pos.push(P.x, P.y, P.z);
      this.nor.push(N.x, N.y, N.z);
      this.uv.push(uv ? uv.getX(i) : 0, uv ? uv.getY(i) : 0);
      this.cor.push(cor[0], cor[1], cor[2], cor[3]);
      this.tipo.push(this.tipoAtual);
      this.pele(typeof pesos === 'function' ? pesos(P) : pesos);
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) this.idx.push(base + g.index.getX(i));
    else for (let i = 0; i < pos.count; i++) this.idx.push(base + i);
  }

  /** `tangentes` = gera o atributo tangent (para o brilho anisotrópico dos fios), sem NaN nas pontas degeneradas. */
  paraGeometria(tangentes = false): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.cor, 4));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.ossos, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.pesos, 4));
    g.setAttribute('tipo', new THREE.Float32BufferAttribute(this.tipo, 1));
    g.setIndex(this.vertices > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    if (tangentes) {
      g.computeTangents();
      const t = g.getAttribute('tangent') as THREE.BufferAttribute;
      const nor = g.getAttribute('normal');
      for (let i = 0; i < t.count; i++) {
        const x = t.getX(i);
        const y = t.getY(i);
        const z = t.getZ(i);
        const l = Math.hypot(x, y, z);
        if (!Number.isFinite(l) || l < 1e-6) {
          // tangente perpendicular à normal (qualquer uma serve num ponto degenerado)
          const nx = nor.getX(i);
          const ny = nor.getY(i);
          const nz = nor.getZ(i);
          const ax = Math.abs(nx) < 0.9 ? 1 : 0;
          const ay = 1 - ax;
          let tx = ay * nz;
          let ty = -ax * nz;
          let tz = ax * ny - ay * nx;
          const m = Math.hypot(tx, ty, tz) || 1;
          tx /= m;
          ty /= m;
          tz /= m;
          t.setXYZW(i, tx, ty, tz, 1);
        } else if (!Number.isFinite(t.getW(i))) t.setW(i, 1);
      }
    }
    g.computeBoundingSphere();
    return g;
  }
}

/**
 * Canal lógico de um acumulador: as peças de tricô e de feltro vão para o mesmo acumulador (o mesmo
 * material, uma chamada de desenho), cada uma marcada com o seu `tipo`.
 */
export class Canal {
  constructor(
    readonly acc: Acumulador,
    readonly tipo: number,
  ) {}
  adicionar(s: Superficie): void {
    this.acc.tipoAtual = this.tipo;
    this.acc.adicionar(s);
  }
  adicionarGeometria(geo: THREE.BufferGeometry, matriz: THREE.Matrix4, cor: Cor4, pesos: Pesos | ((p: THREE.Vector3) => Pesos)): void {
    this.acc.tipoAtual = this.tipo;
    this.acc.adicionarGeometria(geo, matriz, cor, pesos);
  }
}

/**
 * Junta vários acumuladores em uma geometria só de posição e pele (o corpo que projeta sombra).
 * Os cartões de fios (tipo 1 do acumulador `semCartoes`) ficam de fora.
 */
export function geometriaDeSombra(accs: Acumulador[], semCartoes: Acumulador | null): THREE.BufferGeometry {
  const pos: number[] = [];
  const ossos: number[] = [];
  const pesos: number[] = [];
  const idx: number[] = [];
  for (const a of accs) {
    const base = pos.length / 3;
    for (let i = 0; i < a.pos.length; i++) pos.push(a.pos[i]);
    for (let i = 0; i < a.ossos.length; i++) ossos.push(a.ossos[i]);
    for (let i = 0; i < a.pesos.length; i++) pesos.push(a.pesos[i]);
    // cartões de fios (tipo 1 na barba) não projetam: os outros já fazem a silhueta
    for (let i = 0; i < a.idx.length; i += 3) {
      if (a === semCartoes && a.tipo[a.idx[i]] > 0.5) continue;
      idx.push(base + a.idx[i], base + a.idx[i + 1], base + a.idx[i + 2]);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(ossos, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(pesos, 4));
  g.setIndex(pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
  return g;
}

/* ------------------------------------------------------------------ formas paramétricas */

/** Referencial ao longo de uma curva (transporte paralelo), para varrer tubos sem torção. */
export class Trilho {
  pontos: THREE.Vector3[] = [];
  tangentes: THREE.Vector3[] = [];
  normais: THREE.Vector3[] = [];
  binormais: THREE.Vector3[] = [];
  comprimentos: number[] = [];
  total = 0;

  /** `curva(t)` de 0 a 1; `amostras` pontos; `normalInicial` aponta o "u = 0" do começo. */
  constructor(curva: (t: number, out: THREE.Vector3) => void, amostras: number, normalInicial: THREE.Vector3) {
    for (let i = 0; i <= amostras; i++) {
      const p = new THREE.Vector3();
      curva(i / amostras, p);
      this.pontos.push(p);
    }
    for (let i = 0; i <= amostras; i++) {
      const a = this.pontos[Math.max(0, i - 1)];
      const b = this.pontos[Math.min(amostras, i + 1)];
      this.tangentes.push(b.clone().sub(a).normalize());
      this.comprimentos.push(i === 0 ? 0 : this.comprimentos[i - 1] + this.pontos[i].distanceTo(this.pontos[i - 1]));
    }
    this.total = this.comprimentos[amostras];
    let n = normalInicial.clone().sub(this.tangentes[0].clone().multiplyScalar(normalInicial.dot(this.tangentes[0]))).normalize();
    for (let i = 0; i <= amostras; i++) {
      if (i > 0) {
        const t0 = this.tangentes[i - 1];
        const t1 = this.tangentes[i];
        const q = new THREE.Quaternion().setFromUnitVectors(t0, t1);
        n = n.clone().applyQuaternion(q);
        n.sub(t1.clone().multiplyScalar(n.dot(t1))).normalize();
      }
      this.normais.push(n.clone());
      this.binormais.push(new THREE.Vector3().crossVectors(this.tangentes[i], n).normalize());
    }
  }

  /** Interpola o referencial em t (0 a 1). */
  em(t: number, p: THREE.Vector3, tg: THREE.Vector3, nr: THREE.Vector3, bn: THREE.Vector3): void {
    const n = this.pontos.length - 1;
    const f = THREE.MathUtils.clamp(t, 0, 1) * n;
    const i = Math.min(n - 1, Math.floor(f));
    const k = f - i;
    p.lerpVectors(this.pontos[i], this.pontos[i + 1], k);
    tg.lerpVectors(this.tangentes[i], this.tangentes[i + 1], k).normalize();
    nr.lerpVectors(this.normais[i], this.normais[i + 1], k).normalize();
    bn.lerpVectors(this.binormais[i], this.binormais[i + 1], k).normalize();
  }
}

const TP = new THREE.Vector3();
const TT = new THREE.Vector3();
const TN = new THREE.Vector3();
const TB = new THREE.Vector3();

/**
 * Tubo varrido ao longo de um trilho. `raio(u, v)` dá a distância ao eixo (u em volta, v ao longo) e pode
 * achatar, enrugar ou afinar; `tampas` arredonda as pontas (raio indo a zero com perfil de semiesfera).
 */
export function pontoTubo(trilho: Trilho, raio: (u: number, v: number) => number, u: number, v: number, out: THREE.Vector3, achatar = 1): void {
  trilho.em(v, TP, TT, TN, TB);
  const a = u * Math.PI * 2;
  const r = raio(u, v);
  out.copy(TP)
    .addScaledVector(TN, Math.cos(a) * r)
    .addScaledVector(TB, Math.sin(a) * r * achatar);
}

/** Perfil de ponta arredondada: multiplica o raio perto de v = 0 e v = 1 (semiesfera). */
export function tampa(v: number, inicio: number, fim: number): number {
  let k = 1;
  if (inicio > 0 && v < inicio) k *= Math.sqrt(Math.max(0, 1 - Math.pow(1 - v / inicio, 2)));
  if (fim > 0 && v > 1 - fim) k *= Math.sqrt(Math.max(0, 1 - Math.pow((v - (1 - fim)) / fim, 2)));
  return k;
}

/** Ponto de um elipsoide (u em volta de Y, v do polo de baixo ao de cima). */
export function pontoElipsoide(u: number, v: number, out: THREE.Vector3): THREE.Vector3 {
  const th = u * Math.PI * 2;
  const ph = v * Math.PI;
  const s = Math.sin(ph);
  return out.set(Math.sin(th) * s, -Math.cos(ph), Math.cos(th) * s);
}
