/**
 * Madeira e ferro da lareira: a viga lavrada do console, a lenha rachada (casca com textura real,
 * faces de racha com a fibra ao comprido, topos com anéis), os cães de ferro fundido e o leito de
 * cinzas com carvões angulosos. Também o remendo de shader que queima a madeira: carvão em "pele
 * de jacaré" (blocos quase pretos separados por frestas) com a brasa acesa só nas frestas,
 * pulsando com ruído lento, em cima do material PBR comum.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { blocoIrregular, normaisSuaves, type Cor3 } from './pedra';
import { criarRng, fbm3, ruido3, GLSL_CELULAR, GLSL_RUIDO } from './ruido';

const ss = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** Copia para uma geometria nova só os triângulos [inicio, inicio + quantos) do índice, com os atributos pedidos. */
function recortar(geo: THREE.BufferGeometry, inicio: number, quantos: number, atributos: string[]): THREE.BufferGeometry {
  const idx = geo.getIndex()!;
  const mapa = new Map<number, number>();
  const novoIdx: number[] = [];
  for (let i = inicio; i < inicio + quantos; i++) {
    const v = idx.getX(i);
    let nv = mapa.get(v);
    if (nv === undefined) {
      nv = mapa.size;
      mapa.set(v, nv);
    }
    novoIdx.push(nv);
  }
  const out = new THREE.BufferGeometry();
  for (const nome of atributos) {
    const a = geo.getAttribute(nome) as THREE.BufferAttribute;
    const dados = new Float32Array(mapa.size * a.itemSize);
    for (const [v, nv] of mapa) for (let k = 0; k < a.itemSize; k++) dados[nv * a.itemSize + k] = a.array[v * a.itemSize + k];
    out.setAttribute(nome, new THREE.BufferAttribute(dados, a.itemSize));
  }
  out.setIndex(novoIdx);
  return out;
}

/* ------------------------------------------------------------------ viga */

export interface VigaOpcoes {
  comprimento: number;
  altura: number;
  espessura: number;
  semente: number;
  /** Tamanho do segmento ao longo do comprimento, em metros. */
  passo?: number;
  pintar?: (p: THREE.Vector3, cor: Cor3) => void;
}

/**
 * Viga grossa lavrada a enxó: seção quase retangular com quinas gastas de raio variável, as
 * conchas rasas que o enxó deixa (cristas onde uma batida encontra a outra), uma fenda de secagem
 * ao longo da face da frente, leve empeno e topos cortados tortos. Centrada na origem, comprimento
 * em X, frente em +Z. Devolve o corpo (UV com o veio ao comprido; atributo aGasto: 0 na aresta
 * polida pelo toque) e os dois topos à parte (UV para a textura de anéis; aQueima zerado, para
 * poderem ir na mesma malha dos topos da lenha).
 */
export function vigaLavrada(o: VigaOpcoes): { corpo: THREE.BufferGeometry; topos: THREE.BufferGeometry } {
  const { comprimento: L, altura: A, espessura: E } = o;
  const sem = o.semente * 2.71 + 1.1;
  const passo = o.passo ?? 0.04;
  const nL = Math.max(8, Math.round(L / passo));
  const nA = Math.max(4, Math.round(A / Math.max(0.034, passo * 0.9)));
  const nE = Math.max(5, Math.round(E / Math.max(0.04, passo)));
  const geo = new THREE.BoxGeometry(1, 1, 1, nL, nA, nE);
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const uv = geo.getAttribute('uv') as THREE.BufferAttribute;
  const n = pos.count;
  const cores = new Float32Array(n * 3);
  const gasto = new Float32Array(n);
  const queima = new Float32Array(n * 2);
  const chaves = new Int32Array(n);
  const porFace = [(nE + 1) * (nA + 1), (nE + 1) * (nA + 1), (nL + 1) * (nE + 1), (nL + 1) * (nE + 1), (nL + 1) * (nA + 1), (nL + 1) * (nA + 1)];
  const p = new THREE.Vector3();
  const cor: Cor3 = [1, 1, 1];
  // fenda de secagem: corre pela face da frente, um pouco ondulada, e some nas duas pontas
  const jFenda = Math.max(2, Math.min(nA - 2, Math.round(nA * 0.62)));
  const fendaX0 = -0.36 + 0.1 * fbm3(sem, 1, 1, 1);
  const fendaX1 = 0.08 + 0.2 * fbm3(sem, 2, 2, 1);
  const fendaY = (ux: number) => 0.13 + 0.05 * Math.sin(ux * 9 + sem) + 0.03 * Math.sin(ux * 23 + sem * 2);
  const fendaForca = (ux: number) => ss(fendaX0, fendaX0 + 0.08, ux) * (1 - ss(fendaX1 - 0.1, fendaX1, ux));
  let face = 0;
  let naFace = 0;
  for (let i = 0; i < n; i++) {
    if (naFace >= porFace[face]) {
      face++;
      naFace = 0;
    }
    naFace++;
    const ux = pos.getX(i);
    let uy = pos.getY(i);
    const uz = pos.getZ(i);
    chaves[i] = Math.round((ux + 0.5) * nL) + Math.round((uy + 0.5) * nA) * 1024 + Math.round((uz + 0.5) * nE) * 65536;
    // três fiadas da malha se juntam em cima da fenda para o corte sair fino (um V de 2 cm)
    const j = Math.round((uy + 0.5) * nA);
    const forcaFenda = fendaForca(ux);
    if (Math.abs(j - jFenda) <= 1) uy += (fendaY(ux) + (j - jFenda) * (0.011 / A) - uy) * Math.min(1, forcaFenda * 3);
    const x = ux * L;
    // quinas gastas: o raio muda ao longo da viga e de quina para quina; perto dos topos a quina é mais comida
    const quina = (uy > 0 ? 1 : 3) + (uz > 0 ? 0 : 5);
    const gastoQuina = fbm3(x * 1.3 + sem, quina * 3.7, sem * 0.3, 2);
    const ponta = Math.max(0, (Math.abs(ux) - 0.45) / 0.05);
    const r = Math.min(0.014 + 0.05 * Math.max(0, gastoQuina - 0.3) + 0.03 * ponta * (0.4 + fbm3(quina * 2.2, sem, ux * 5, 1)), 0.4 * Math.min(A, E));
    let qy = uy * A;
    let qz = uz * E;
    let qx = x;
    const hy = A / 2 - r;
    const hz = E / 2 - r;
    const rTopo = 0.022;
    const hx = L / 2 - rTopo;
    const iy = Math.max(-hy, Math.min(hy, qy));
    const iz = Math.max(-hz, Math.min(hz, qz));
    const ix = Math.max(-hx, Math.min(hx, qx));
    let vx = qx - ix;
    let vy = qy - iy;
    let vz = qz - iz;
    const vl = Math.hypot(vx, vy, vz) || 1;
    vx /= vl;
    vy /= vl;
    vz /= vl;
    qx = ix + vx * rTopo;
    qy = iy + vy * r;
    qz = iz + vz * r;
    // conchas do enxó: cada batida tira uma lasca rasa; entre uma e outra fica uma crista
    const concha = 1 - Math.abs(ruido3(x * 8.5 + sem, uy * A * 8 + face * 9.1, uz * E * 8) * 2 - 1);
    const onda = fbm3(x * 1.1 - sem, uy * 1.5 + face, uz * 1.5, 2) - 0.5;
    const talhe = -0.012 * (1 - concha) + 0.014 * onda;
    qy += vy * talhe;
    qz += vz * talhe;
    // a fenda propriamente dita: a fiada do meio afunda
    let naFenda = 0;
    if (face === 4 && j === jFenda) {
      naFenda = forcaFenda;
      qz -= 0.016 * naFenda * (0.6 + 0.8 * fbm3(x * 6, sem, 1, 1));
    }
    // topos cortados tortos (com a marca irregular do serrote) e leve empeno da peça
    if (Math.abs(ux) > 0.499) qx += (fbm3(qy * 9 + sem, qz * 9, ux * 3, 2) - 0.5) * 0.026 + qz * 0.06 * Math.sign(ux) * (fbm3(sem, 2.2, ux) - 0.3) + qy * 0.04 * (fbm3(sem, ux, 7.7) - 0.5);
    const meio = 1 - 2 * ux * (2 * ux);
    qy += -0.008 * meio + 0.006 * Math.sin(ux * 5.1 + sem);
    qz += 0.012 * Math.sin(ux * 3.3 + sem * 1.7) * 0.5;
    p.set(qx, qy, qz);
    pos.setXYZ(i, qx, qy, qz);
    // UV: nas faces longas o veio corre ao longo de X, bem esticado e com começo diferente em cada face
    // (a textura não se repete à vista); nos topos, o corte fica perto do miolo da textura de anéis
    if (face < 2) {
      const lado = 1.55 * Math.max(A, E);
      uv.setXY(i, 0.5 + qz / lado + 0.04, 0.5 + qy / lado - 0.03);
    } else {
      const larguraFace = face < 4 ? E : A;
      uv.setXY(i, (uv.getY(i) * larguraFace) / 0.5 + face * 0.37 + sem, (uv.getX(i) * L) / 2.4 + face * 0.29 + sem * 0.13);
    }
    // cor: manchas largas ao longo da peça (quebram a repetição), quinas gastas mais claras, fenda e topos escuros
    const mancha = 0.72 + 0.56 * fbm3(x * 1.7 + sem, uy * 1.3 + face * 2.0, uz * 1.3, 2);
    const naQuina = Math.abs(uy) > 0.49 && Math.abs(uz) > 0.49 ? 1.2 : 1;
    const topo = face < 2 ? 0.78 : 1;
    const k = mancha * naQuina * topo * (1 - 0.72 * naFenda) * (0.9 + 0.1 * concha);
    cor[0] = k;
    cor[1] = k * 0.97;
    cor[2] = k * 0.93;
    o.pintar?.(p, cor);
    cores[i * 3] = cor[0];
    cores[i * 3 + 1] = cor[1];
    cores[i * 3 + 2] = cor[2];
    // cera e toque: a aresta da frente do tampo e as quinas são mais polidas; o fundo das conchas, fosco
    const frenteDoTampo = uy > 0.49 && uz > 0.2 ? 1 : 0;
    gasto[i] = Math.max(0, Math.min(1, (naQuina > 1 ? 0.15 : 0.55 + 0.45 * (1 - concha)) - 0.4 * frenteDoTampo + naFenda));
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cores, 3));
  geo.setAttribute('aGasto', new THREE.BufferAttribute(gasto, 1));
  geo.setAttribute('aQueima', new THREE.BufferAttribute(queima, 2));
  geo.setAttribute('aFibra', new THREE.BufferAttribute(new Float32Array(geo.getAttribute('position').count * 3), 3));
  normaisSuaves(geo, chaves, Math.cos((48 * Math.PI) / 180));
  const g = geo.groups;
  const fimTopos = g[1].start + g[1].count;
  const topos = recortar(geo, 0, fimTopos, ['position', 'normal', 'uv', 'color', 'aQueima', 'aFibra']);
  const corpo = recortar(geo, fimTopos, geo.getIndex()!.count - fimTopos, ['position', 'normal', 'uv', 'color', 'aGasto']);
  geo.dispose();
  return { corpo, topos };
}

/* ----------------------------------------------------------------- lenha */

export interface AchaDef {
  /** Raio da tora de onde a acha foi rachada. */
  raio: number;
  comprimento: number;
  /** Abertura da cunha, em radianos: 2π = tora roliça; π = meia tora; π/2 = um quarto. */
  abertura: number;
  /** Posição do centro da acha (o centro de massa da seção, no meio do comprimento). */
  posicao: THREE.Vector3;
  /** Rotação (o eixo nasce em X; a casca nasce virada para +Y, as faces de racha para baixo). */
  rotacao: THREE.Euler;
  /** 0 = madeira sã; 1 = toda carbonizada (soma com o que o fogo queima por estar perto). */
  carvao: number;
  /** 0 = apagada; 1 = em brasa viva. */
  brasa: number;
  semente: number;
}

/** Onde o fogo queima: centro e alcance (meios eixos) do coração da fogueira. */
export interface ZonaDoFogo {
  centro: THREE.Vector3;
  alcance: THREE.Vector3;
}

export interface Acha {
  casca: THREE.BufferGeometry;
  /** Faces de racha (vazia na tora roliça). */
  lenho: THREE.BufferGeometry | null;
  topos: THREE.BufferGeometry;
  /** Para o fogo saber de onde nascer: eixo, meia largura vista de cima e altura do dorso acima do eixo. */
  segmento: { a: THREE.Vector3; b: THREE.Vector3; raio: number; alto: number };
}

/**
 * Uma acha de lenha rachada: seção em cunha (casca só no arco de fora, duas faces de racha
 * fibrosas e levemente torcidas, quina viva entre a casca e a racha), eixo um pouco torto, pontas
 * serradas tortas com chanfro. Devolve as partes já no lugar, com cor por vértice e o atributo
 * aQueima (x = carvão, y = brasa): queima pela distância ao coração do fogo e pela altura, não
 * pela direção da face, para o carvão aparecer do lado de quem olha.
 */
export function criarAcha(def: AchaDef, zona: ZonaDoFogo, segmentos = 14): Acha {
  const sem = def.semente * 3.17 + 0.7;
  const inteira = def.abertura > 6.2;
  const alfa = def.abertura / 2;
  const R = def.raio;
  const Lc = def.comprimento;
  const cy = inteira ? 0 : (2 * R * Math.sin(alfa)) / (3 * alfa); // do miolo ao centro de massa da cunha
  const nArc = Math.max(4, Math.round((segmentos * def.abertura) / (Math.PI * 2)) + (inteira ? 0 : 2));
  const nL = Math.max(5, Math.round(segmentos * 0.8));
  const nF = 5;
  const m = new THREE.Matrix4().compose(def.posicao, new THREE.Quaternion().setFromEuler(def.rotacao), new THREE.Vector3(1, 1, 1));
  const torcer = (fbm3(sem, 4, 2, 1) - 0.5) * 0.5;
  const curva = (fbm3(sem, 5, 9, 1) - 0.5) * 0.05;
  const inclY = [(fbm3(sem + 1, 3, 4, 1) - 0.5) * 0.45, (fbm3(sem - 1, 3, 4, 1) - 0.5) * 0.45];
  const inclZ = [(fbm3(sem - 1, 8, 1, 1) - 0.5) * 0.45, (fbm3(sem + 1, 8, 1, 1) - 0.5) * 0.45];
  // posições das fiadas ao longo do comprimento: a segunda e a penúltima ficam a 1,4 cm da ponta (chanfro)
  const sDe = (j: number) => (j === 0 ? 0 : j === nL ? 1 : 0.014 / Lc + ((j - 1) / (nL - 2)) * (1 - 0.028 / Lc));
  const ponto = new THREE.Vector3();

  /** Ponto da seção: ângulo a partir de +Y, fração do raio (0 = miolo, 1 = casca) e posição ao longo (0..1). Devolve [x, y, z] locais. */
  const secao = (theta: number, rho: number, j: number, ladoFace: number): [number, number, number] => {
    const s = sDe(j);
    const th = theta + torcer * (s - 0.5);
    const cs = Math.cos(th);
    const sn = Math.sin(th);
    const calombo = fbm3(cs * 1.4 + sem, sn * 1.4 - sem, s * Lc * 5.0, 2) - 0.5;
    const sulco = Math.abs(ruido3(cs * 4.5 + sem, sn * 4.5, s * Lc * 2.2) * 2 - 1);
    const rr = R * (1 + 0.2 * calombo - 0.05 * (1 - sulco)) * (1 - 0.05 * Math.abs(s - 0.5) * 2);
    let y = cs * rr * rho;
    let z = sn * rr * rho;
    if (ladoFace !== 0) {
      // face de racha: fibras arrancadas ao comprido (cristas finas no sentido do raio, longas no do eixo)
      const fibra = (fbm3(rho * R * 55 + sem, s * Lc * 2.2, ladoFace * 3.1, 2) - 0.5) * 0.014 + (fbm3(rho * R * 14, s * Lc * 1.6, sem + ladoFace, 2) - 0.5) * 0.03;
      const k = Math.min(1, rho * 2.5);
      y += -sn * ladoFace * fibra * k;
      z += cs * ladoFace * fibra * k;
    }
    // chanfro das pontas: a última fiada encolhe um pouco para o centro
    if (j === 0 || j === nL) {
      const enc = 1 - 0.008 / Math.max(0.03, R * 0.6);
      y = (y - cy) * enc + cy;
      z *= enc;
    }
    y += -cy + curva * Math.sin(s * Math.PI);
    const lado = j === 0 ? 0 : 1;
    const x = j === 0 || j === nL ? (lado ? 1 : -1) * (Lc / 2) + inclY[lado] * y + inclZ[lado] * z : (s - 0.5) * Lc;
    return [x, y, z];
  };

  const queimar = (p: THREE.Vector3): [number, number] => {
    const dx = (p.x - zona.centro.x) / zona.alcance.x;
    const dy = (p.y - zona.centro.y) / zona.alcance.y;
    const dz = (p.z - zona.centro.z) / zona.alcance.z;
    const dist = Math.hypot(dx, dy, dz);
    const perto = 1 - ss(0.4, 1.05, dist);
    const manchas = fbm3(p.x * 6 + sem, p.y * 6, p.z * 6, 2);
    const carv = Math.min(1, def.carvao * (0.55 + 0.9 * manchas) + perto * 1.1);
    // arde mais por baixo e por dentro da pilha, onde o calor se guarda
    const guardado = 0.55 + 0.45 * ss(0.15, -0.5, dy);
    return [carv, Math.min(1, def.brasa * (0.12 + 0.88 * perto * perto) * guardado * (0.6 + 0.8 * manchas))];
  };

  interface Parte {
    pos: number[];
    uvs: number[];
    cores: number[];
    queima: number[];
    fibra: number[];
    idx: number[];
  }
  const nova = (): Parte => ({ pos: [], uvs: [], cores: [], queima: [], fibra: [], idx: [] });
  const vert = (parte: Parte, q: [number, number, number], u: number, v: number, tom = 1) => {
    ponto.set(q[0], q[1], q[2]).applyMatrix4(m);
    parte.pos.push(ponto.x, ponto.y, ponto.z);
    parte.uvs.push(u, v);
    // manchas largas e veios escuros ao comprido (o desenho acompanha a fibra, não o espaço)
    const veio = fbm3(q[1] * 38 + sem, q[2] * 38, q[0] * 2.4, 2);
    const c = tom * (0.8 + 0.34 * fbm3(ponto.x * 4 + sem, ponto.y * 4, ponto.z * 4, 2)) * (0.72 + 0.5 * veio);
    parte.cores.push(c, c * (0.97 + 0.03 * veio), c * (0.92 + 0.08 * veio));
    const qm = queimar(ponto);
    parte.queima.push(qm[0], qm[1]);
    // coordenadas do carvão: as da própria acha, encolhidas ao comprido (os blocos saem alongados na fibra)
    parte.fibra.push(q[0] * 0.3 + sem * 1.7, q[1] + sem, q[2]);
    return parte.pos.length / 3 - 1;
  };
  const fechar = (parte: Parte): THREE.BufferGeometry => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(parte.pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(parte.uvs, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(parte.cores, 3));
    g.setAttribute('aQueima', new THREE.Float32BufferAttribute(parte.queima, 2));
    g.setAttribute('aFibra', new THREE.Float32BufferAttribute(parte.fibra, 3));
    g.setIndex(parte.idx);
    g.computeVertexNormals();
    return g;
  };
  const grade = (parte: Parte, ids: number[], colunas: number, linhas: number, inverter: boolean) => {
    for (let j = 0; j < linhas; j++)
      for (let i = 0; i < colunas; i++) {
        const a = ids[j * (colunas + 1) + i];
        const b = ids[j * (colunas + 1) + i + 1];
        const c = ids[(j + 1) * (colunas + 1) + i];
        const d = ids[(j + 1) * (colunas + 1) + i + 1];
        if (inverter) parte.idx.push(a, c, b, b, c, d);
        else parte.idx.push(a, b, c, b, d, c);
      }
  };
  const thetaDe = (i: number) => (inteira ? (i / nArc) * Math.PI * 2 : -alfa + (i / nArc) * def.abertura);

  // casca: o arco de fora
  const casca = nova();
  {
    const ids: number[] = [];
    const arco = R * def.abertura;
    for (let j = 0; j <= nL; j++)
      for (let i = 0; i <= nArc; i++) {
        const naBorda = !inteira && (i === 0 || i === nArc);
        const q = secao(thetaDe(i), 1, j, naBorda ? (i === 0 ? -1 : 1) : 0);
        ids.push(vert(casca, q, ((i / nArc) * arco) / 0.5 + sem, (sDe(j) * Lc) / 0.5 + sem * 0.3));
      }
    // visto de fora, com o eixo em +X e o ângulo crescendo de +Y para +Z
    grade(casca, ids, nArc, nL, true);
  }
  const geoCasca = fechar(casca);
  if (inteira) {
    // a costura da tora roliça (primeira e última coluna) recebe a mesma normal
    const nAttr = geoCasca.getAttribute('normal') as THREE.BufferAttribute;
    for (let j = 0; j <= nL; j++) {
      const a = j * (nArc + 1);
      const b = a + nArc;
      ponto.set(nAttr.getX(a) + nAttr.getX(b), nAttr.getY(a) + nAttr.getY(b), nAttr.getZ(a) + nAttr.getZ(b)).normalize();
      nAttr.setXYZ(a, ponto.x, ponto.y, ponto.z);
      nAttr.setXYZ(b, ponto.x, ponto.y, ponto.z);
    }
  }

  // faces de racha: do miolo até a casca, com a fibra ao comprido (a textura tem o veio na vertical)
  let geoLenho: THREE.BufferGeometry | null = null;
  if (!inteira) {
    const lenho = nova();
    for (const lado of [-1, 1]) {
      const ids: number[] = [];
      for (let j = 0; j <= nL; j++)
        for (let k = 0; k <= nF; k++) {
          const q = secao(lado * alfa, k / nF, j, lado);
          ids.push(vert(lenho, q, ((k / nF) * R) / 0.42 + sem + lado, (sDe(j) * Lc) / 0.8 + sem * 0.7, 1));
        }
      grade(lenho, ids, nF, nL, lado < 0);
    }
    geoLenho = fechar(lenho);
  }

  // topos: do contorno para dentro, em dois anéis, com a UV centrada no miolo (textura de anéis)
  const topos = nova();
  for (const j of [0, nL]) {
    const contorno: Array<[number, number, number]> = [];
    if (inteira) for (let i = 0; i < nArc; i++) contorno.push(secao(thetaDe(i), 1, j, 0));
    else {
      for (let i = 0; i <= nArc; i++) contorno.push(secao(thetaDe(i), 1, j, i === 0 ? -1 : i === nArc ? 1 : 0));
      for (let k = nF - 1; k >= 1; k--) contorno.push(secao(alfa, k / nF, j, 1));
      contorno.push(secao(0, 0, j, 0));
      for (let k = 1; k <= nF - 1; k++) contorno.push(secao(-alfa, k / nF, j, -1));
    }
    const miolo = secao(0, 0, j, 0);
    let cx = 0;
    let cyy = 0;
    let cz = 0;
    for (const q of contorno) {
      cx += q[0] / contorno.length;
      cyy += q[1] / contorno.length;
      cz += q[2] / contorno.length;
    }
    const giro = fbm3(sem, j, 3, 1) * 6.28;
    const uvDe = (q: [number, number, number]): [number, number] => {
      const dy = (q[1] - miolo[1]) / R;
      const dz = (q[2] - miolo[2]) / R;
      return [0.5 + (dy * Math.cos(giro) - dz * Math.sin(giro)) * 0.47, 0.5 + (dy * Math.sin(giro) + dz * Math.cos(giro)) * 0.47];
    };
    const fora = j === 0 ? -1 : 1;
    const nC = contorno.length;
    const anelFora: number[] = [];
    const anelDentro: number[] = [];
    for (const q of contorno) anelFora.push(vert(topos, q, ...uvDe(q)));
    for (let i = 0; i < nC; i++) {
      const q = contorno[i];
      // o miolo do corte fica um nada para fora e irregular (marca do serrote)
      const r: [number, number, number] = [cx + (q[0] - cx) * 0.5 + fora * (0.004 + 0.006 * fbm3(i * 1.3, sem, j, 1)), cyy + (q[1] - cyy) * 0.5, cz + (q[2] - cz) * 0.5];
      anelDentro.push(vert(topos, r, ...uvDe(r)));
    }
    const centro: [number, number, number] = [cx + fora * 0.006, cyy, cz];
    const ic = vert(topos, centro, ...uvDe(centro));
    for (let i = 0; i < nC; i++) {
      const i2 = (i + 1) % nC;
      const tri = (a: number, b: number, c: number) => (j === 0 ? topos.idx.push(a, b, c) : topos.idx.push(a, c, b));
      tri(anelFora[i], anelFora[i2], anelDentro[i]);
      tri(anelFora[i2], anelDentro[i2], anelDentro[i]);
      tri(anelDentro[i], anelDentro[i2], ic);
    }
  }

  // eixo, meia largura vista de cima e altura do dorso, medidos na seção do meio já no lugar
  const a = new THREE.Vector3(-Lc / 2, 0, 0).applyMatrix4(m);
  const b = new THREE.Vector3(Lc / 2, 0, 0).applyMatrix4(m);
  const eixoX = b.x - a.x;
  const eixoZ = b.z - a.z;
  const eixoL = Math.hypot(eixoX, eixoZ) || 1;
  const meioY = (a.y + b.y) / 2;
  const jm = Math.round(nL / 2);
  let meiaLargura = 0.02;
  let dorso = 0.02;
  const medir = (q: [number, number, number]) => {
    ponto.set(0, q[1], q[2]).applyMatrix4(m);
    meiaLargura = Math.max(meiaLargura, Math.abs(((ponto.x - (a.x + b.x) / 2) * -eixoZ + (ponto.z - (a.z + b.z) / 2) * eixoX) / eixoL));
    dorso = Math.max(dorso, ponto.y - meioY);
  };
  for (let i = 0; i <= nArc; i++) medir(secao(thetaDe(i), 1, jm, 0));
  if (!inteira) medir(secao(0, 0, jm, 0));
  return { casca: geoCasca, lenho: geoLenho, topos: fechar(topos), segmento: { a, b, raio: meiaLargura, alto: dorso } };
}

/** Textura do topo da lenha e da viga: anéis de crescimento, cerne mais escuro e poucas rachas radiais finas. Sem contorno de casca. */
export function criarTexturaAneis(semente: number, tamanho = 256): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = tamanho;
  const g = canvas.getContext('2d')!;
  const img = g.createImageData(tamanho, tamanho);
  const rng = criarRng(semente);
  const rachas: Array<{ ang: number; larg: number; de: number; ate: number }> = [];
  for (let i = 0; i < 4; i++) rachas.push({ ang: rng() * Math.PI * 2, larg: 0.012 + rng() * 0.02, de: 0.02 + rng() * 0.2, ate: 0.55 + rng() * 0.5 });
  for (let y = 0; y < tamanho; y++)
    for (let x = 0; x < tamanho; x++) {
      const u = x / tamanho;
      const v = y / tamanho;
      const dx = u - 0.5;
      const dy = v - 0.5;
      const ang = Math.atan2(dy, dx);
      const torto = 1 + 0.08 * (fbm3(Math.cos(ang) * 1.5 + semente, Math.sin(ang) * 1.5, 3.3, 2) - 0.5);
      const r = Math.hypot(dx, dy) * 2 * torto; // 0 no miolo, perto de 1 na casca
      const anel = 0.5 + 0.5 * Math.sin(r * 64 + fbm3(u * 6, v * 6, semente, 2) * 5);
      const fino = fbm3(u * 46, v * 46, semente + 2, 2);
      let cr = 0.7;
      let cg = 0.54;
      let cb = 0.34;
      const cerne = 1 - Math.min(1, r / 0.5);
      cr -= 0.14 * cerne;
      cg -= 0.15 * cerne;
      cb -= 0.12 * cerne;
      const escuro = 0.8 + 0.2 * anel * anel;
      const grao = 0.9 + 0.2 * fino;
      cr *= escuro * grao;
      cg *= escuro * grao;
      cb *= escuro * grao;
      // rachas de secagem: finas, nascem perto do miolo e abrem um pouco para fora
      for (const k of rachas) {
        let d = Math.abs(ang - k.ang - 0.25 * (fbm3(r * 5, k.ang, semente, 1) - 0.5));
        if (d > Math.PI) d = Math.PI * 2 - d;
        const dist = d * r; // distância ao risco, em fração do raio
        const dentro = r > k.de && r < k.ate ? Math.max(0, 1 - dist / (k.larg * (0.25 + 0.75 * (r - k.de)))) : 0;
        const f = 1 - 0.7 * Math.min(1, dentro * 1.6);
        cr *= f;
        cg *= f;
        cb *= f;
      }
      // alburno um pouco mais claro e, bem na borda, só um escurecido (a casca é outra malha)
      const borda = Math.min(1, Math.max(0, (r - 0.9) / 0.1));
      const f = 1 + 0.06 * Math.min(1, Math.max(0, (r - 0.6) / 0.3)) - 0.3 * borda;
      const o = (y * tamanho + x) * 4;
      img.data[o] = Math.round(Math.min(1, cr * f) * 255);
      img.data[o + 1] = Math.round(Math.min(1, cg * f) * 255);
      img.data[o + 2] = Math.round(Math.min(1, cb * f) * 255);
      img.data[o + 3] = 255;
    }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/* ------------------------------------------------------------ cães de ferro */

/**
 * Par de cães de lareira em ferro fundido: coluna torneada com pinha no alto, pés em arco e a
 * barra que segura as toras, com um pé atrás. `xs` são as posições em X; a frente fica em zFrente.
 */
export function criarCaesDeFerro(xs: number[], y0: number, zFrente: number, zTras: number, alturaColuna = 0.46, seg = 14): THREE.BufferGeometry {
  const partes: THREE.BufferGeometry[] = [];
  const limpar = (g: THREE.BufferGeometry) => {
    const s = g.index ? g : g.toNonIndexed();
    for (const nome of Object.keys(s.attributes)) if (nome !== 'position' && nome !== 'normal' && nome !== 'uv') s.deleteAttribute(nome);
    return s;
  };
  const yBarra = 0.125;
  for (const x of xs) {
    // coluna torneada (perfil girado): base, anel, bojo, pescoço e pinha
    const h = alturaColuna;
    const perfil: Array<[number, number]> = [
      [0.0, 0.0],
      [0.03, 0.0],
      [0.034, 0.012],
      [0.026, 0.03],
      [0.019, 0.06],
      [0.018, 0.2],
      [0.03, 0.225],
      [0.03, 0.24],
      [0.018, 0.26],
      [0.015, 0.33],
      [0.024, 0.35],
      [0.016, 0.365],
      [0.03, 0.39],
      [0.036, 0.415],
      [0.03, 0.44],
      [0.013, 0.458],
      [0.0, 0.462],
    ];
    const lathe = new THREE.LatheGeometry(
      perfil.map(([r, yy]) => new THREE.Vector2(r, (yy / 0.462) * h)),
      seg,
    );
    lathe.translate(x, y0 + 0.1, zFrente);
    partes.push(limpar(lathe));
    // pés em arco, abrindo para os lados
    const arco = new THREE.CatmullRomCurve3([
      new THREE.Vector3(x - 0.13, y0 + 0.008, zFrente),
      new THREE.Vector3(x - 0.105, y0 + 0.07, zFrente),
      new THREE.Vector3(x - 0.05, y0 + 0.115, zFrente),
      new THREE.Vector3(x, y0 + 0.125, zFrente),
      new THREE.Vector3(x + 0.05, y0 + 0.115, zFrente),
      new THREE.Vector3(x + 0.105, y0 + 0.07, zFrente),
      new THREE.Vector3(x + 0.13, y0 + 0.008, zFrente),
    ]);
    partes.push(limpar(new THREE.TubeGeometry(arco, 20, 0.015, Math.max(5, Math.round(seg * 0.5)), false)));
    for (const lado of [-1, 1]) {
      const sapata = new THREE.SphereGeometry(0.024, 8, 6);
      sapata.scale(1.25, 0.5, 1.1);
      sapata.translate(x + lado * 0.132, y0 + 0.01, zFrente);
      partes.push(limpar(sapata));
    }
    // barra para trás (levemente arqueada) e pé traseiro
    const barra = new THREE.CatmullRomCurve3([
      new THREE.Vector3(x, y0 + yBarra, zFrente),
      new THREE.Vector3(x, y0 + yBarra - 0.006, (zFrente + zTras) / 2),
      new THREE.Vector3(x, y0 + yBarra, zTras + 0.02),
      new THREE.Vector3(x, y0 + yBarra - 0.05, zTras),
      new THREE.Vector3(x, y0 + 0.004, zTras - 0.012),
    ]);
    const tubo = new THREE.TubeGeometry(barra, 24, 0.0135, 4, false);
    partes.push(limpar(tubo));
  }
  const junto = mergeGeometries(partes, false)!;
  for (const g of partes) g.dispose();
  return junto;
}

/* ------------------------------------------------------- cinzas e carvões */

/**
 * Leito do fogo, em uma malha só: um monte de cinza clara e fria com relevo, de borda irregular que
 * se desfaz sobre a laje, com a camada de brasa viva no miolo (sob as barras dos cães), e por cima
 * carvões partidos: blocos angulosos de 2 a 6 cm, de quinas vivas. aQueima diz ao material onde é
 * carvão e onde arde. `corLaje` é a cor (de vértice) para onde a cinza some na borda.
 */
export function criarLeito(centro: THREE.Vector3, largura: number, fundura: number, semente: number, detalhe = 1, corLaje: Cor3 = [0.12, 0.11, 0.1]): THREE.BufferGeometry {
  const rng = criarRng(semente);
  const nx = Math.round(64 * detalhe);
  const nz = Math.round(36 * detalhe);
  const pos: number[] = [];
  const cores: number[] = [];
  const queima: number[] = [];
  const uvs: number[] = [];
  const idx: number[] = [];
  const fora: boolean[] = [];
  /** Altura do monte e a distância normalizada ao centro (1 = borda). */
  const monte = (x: number, z: number): [number, number] => {
    const u = (x - centro.x) / (largura / 2);
    const v = (z - centro.z) / (fundura / 2);
    const borda = fbm3(x * 4.2 + semente, 1.1, z * 4.2, 2) + 0.35 * (fbm3(x * 13, semente, z * 13, 2) - 0.5);
    const rr = Math.hypot(u, v) / (0.72 + 0.42 * borda);
    const cheio = Math.max(0, 1 - rr * rr);
    // montes largos, calombos de punho e torrões pequenos (cinza que caiu em pedaços)
    const largo = fbm3(x * 5.5, semente + 3, z * 5.5, 2);
    const medio = fbm3(x * 17, semente, z * 17, 2);
    const torrao = Math.max(0, fbm3(x * 41, semente + 9, z * 41, 2) - 0.52);
    const h = Math.sqrt(cheio) * (0.014 + 0.05 * largo + 0.026 * (medio - 0.5)) + Math.min(1, cheio * 3) * torrao * 0.05 - 0.005 * ss(0.8, 1.15, rr);
    return [h, rr];
  };
  for (let j = 0; j <= nz; j++)
    for (let i = 0; i <= nx; i++) {
      const x = centro.x + (i / nx - 0.5) * largura * 1.25;
      const z = centro.z + (j / nz - 0.5) * fundura * 1.25;
      const [h, rr] = monte(x, z);
      fora.push(rr > 1.18);
      pos.push(x, centro.y + h, z);
      uvs.push(i / nx, j / nz);
      // cinza cinzenta, quente, com carvão moído misturado (malhada, nunca lisa); some na cor da laje pela borda
      const moido = ss(0.42, 0.62, fbm3(x * 15, 3, z * 15, 2));
      const tom = (0.15 + 0.13 * fbm3(x * 7, 3, z * 7, 2) + 0.1 * (fbm3(x * 37, 7, z * 37, 2) - 0.5)) * (1 - 0.62 * moido);
      const some = ss(0.72, 1.12, rr + 0.25 * (fbm3(x * 19, 5, z * 19, 2) - 0.5));
      cores.push(tom * (1 - some) + corLaje[0] * some, tom * 0.93 * (1 - some) + corLaje[1] * some, tom * 0.84 * (1 - some) + corLaje[2] * some);
      // o miolo, sob as barras, é brasa viva debaixo de uma casca de cinza
      const miolo = 1 - ss(0.25, 0.7, rr + 0.3 * (fbm3(x * 8, 9, z * 8, 2) - 0.5));
      // em volta do miolo a cinza vem misturada com carvão moído e recebe a claridade das brasas
      const volta = 1 - ss(0.45, 1.1, rr);
      queima.push(Math.max(miolo * 0.95, 0.27 * volta), miolo * (0.55 + 0.45 * fbm3(x * 5, 2, z * 5, 1)));
    }
  for (let j = 0; j < nz; j++)
    for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i;
      const b = a + 1;
      const c = a + nx + 1;
      const d = c + 1;
      if (fora[a] && fora[b] && fora[c] && fora[d]) continue;
      idx.push(a, c, b, b, c, d);
    }
  const cinza = new THREE.BufferGeometry();
  cinza.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  cinza.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  cinza.setAttribute('color', new THREE.Float32BufferAttribute(cores, 3));
  cinza.setAttribute('aQueima', new THREE.Float32BufferAttribute(queima, 2));
  cinza.setIndex(idx);
  cinza.computeVertexNormals();

  // carvões partidos: hexaedros bem irregulares, de quinas vivas e cantos lascados; muitos miúdos, poucos graúdos
  const partes: THREE.BufferGeometry[] = [cinza];
  const total = Math.round(150 * detalhe);
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const mat = new THREE.Matrix4();
  const um = new THREE.Vector3(1, 1, 1);
  const lugar = new THREE.Vector3();
  for (let k = 0; k < total; k++) {
    // mais juntos no miolo; alguns rolaram para a frente
    const ang = rng() * Math.PI * 2;
    const dist = Math.pow(rng(), 0.7) * 0.92;
    let x = centro.x + Math.cos(ang) * dist * (largura / 2) * 0.9;
    let z = centro.z + Math.sin(ang) * dist * (fundura / 2) * 0.9;
    if (rng() < 0.2) z = centro.z + (fundura / 2) * (0.55 + rng() * 0.55);
    if (rng() < 0.1) x = centro.x + (rng() < 0.5 ? -1 : 1) * (largura / 2) * (0.75 + rng() * 0.3);
    const [h, rr] = monte(x, z);
    const tam = 0.014 + Math.pow(rng(), 2.2) * 0.05;
    const sx = tam * (0.7 + rng() * 0.8);
    const sy = tam * (0.45 + rng() * 0.5);
    const sz = tam * (0.6 + rng() * 0.7);
    const cantos: THREE.Vector3[] = [];
    for (let c = 0; c < 8; c++) {
      cantos.push(new THREE.Vector3(((c & 1 ? 1 : -1) * sx) / 2 + (rng() - 0.5) * sx * 0.5, ((c & 2 ? 1 : -1) * sy) / 2 + (rng() - 0.5) * sy * 0.5, ((c & 4 ? 1 : -1) * sz) / 2 + (rng() - 0.5) * sz * 0.5));
    }
    const bloco = blocoIrregular({ cantos, semente: rng() * 1000, raio: 0.0035, relevo: 0.0025, quebra: 1, lascas: 0.55, passo: 1, maxSeg: 1, ladrilho: 0.3, cor: [0.9, 0.9, 0.9] });
    e.set(rng() * 0.9 - 0.45, rng() * Math.PI * 2, rng() * 0.9 - 0.45);
    lugar.set(x, centro.y + Math.max(0, h) + sy * 0.3, z);
    bloco.applyMatrix4(mat.compose(lugar, q.setFromEuler(e), um));
    bloco.deleteAttribute('aGasto');
    const nV = bloco.getAttribute('position').count;
    // os do miolo ardem; os da borda já apagaram (carvão preto ou coberto de cinza)
    const aceso = rr < 0.75 ? 0.5 + rng() * 0.5 : rng() < 0.3 ? rng() * 0.5 : 0;
    const qm = new Float32Array(nV * 2);
    for (let i = 0; i < nV; i++) {
      qm[i * 2] = 1;
      qm[i * 2 + 1] = aceso;
    }
    bloco.setAttribute('aQueima', new THREE.BufferAttribute(qm, 2));
    partes.push(bloco);
  }
  const junto = mergeGeometries(partes, false)!;
  for (const g of partes) g.dispose();
  // sem fibra: os blocos de carvão seguem a própria posição
  junto.setAttribute('aFibra', (junto.getAttribute('position') as THREE.BufferAttribute).clone());
  return junto;
}

/* ------------------------------------------------------- queima no material */

export interface UniformesBrasa {
  uTempo: { value: number };
  uBrasa: { value: number };
}

export interface QueimaOpcoes {
  /** Células de carvão por metro (30 dá blocos de uns 3 cm). */
  escala?: number;
  /** Saturação da cor da textura (1 = como é; 0,55 tira o vermelho da casca sob a luz do fogo). */
  saturacao?: number;
  /** Quanto de cinza clara assenta por cima do carvão (0 a 1). */
  cinza?: number;
  /** Relevo de grão miúdo em toda a superfície, mesmo onde não queimou (para o monte de cinza não ficar liso). */
  grao?: number;
  /** Claridade da brasa vizinha devolvida pela superfície perto do miolo (a cinza junto das brasas fica quente). */
  luzDaBrasa?: number;
}

/**
 * Queima um material PBR comum conforme o atributo aQueima (x = carvão, y = brasa). Onde há carvão,
 * a superfície vira "pele de jacaré": blocos quase pretos alongados no sentido da fibra (as células
 * usam o atributo aFibra, que nas achas vem encolhido ao comprido), levemente acetinados, separados
 * por frestas, com relevo de verdade na luz (a normal acompanha os blocos). A cinza assenta em
 * manchas moles (ruído contínuo, não bloco a bloco), mais por cima. A divisa entre madeira e carvão
 * é irregular, com uma faixa chamuscada. Onde há brasa, o corpo dos blocos cora em vermelho fundo,
 * as frestas acendem em laranja com um halo, e tudo respira com ruído lento (cada pedaço no seu
 * ritmo). Os uniformes são compartilhados.
 */
export function queimarMaterial(material: THREE.MeshStandardMaterial, uniformes: UniformesBrasa, o: QueimaOpcoes = {}): void {
  const escala = (o.escala ?? 30).toFixed(1);
  const sat = (o.saturacao ?? 1).toFixed(2);
  const cinza = (o.cinza ?? 0.6).toFixed(2);
  const grao = (o.grao ?? 0).toFixed(2);
  const luzDaBrasa = (o.luzDaBrasa ?? 0).toFixed(3);
  // cinza malhada: grão miúdo e pontos de carvão moído (só onde pedem grão)
  const malhado = (o.grao ?? 0) > 0 ? 'diffuseColor.rgb *= (0.5 + 1.0 * lrFbm3(vPosBrasa * 43.0 + 3.1)) * (0.55 + 0.9 * lrFbm3(vPosBrasa * 120.0));' : '';
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTempo = uniformes.uTempo;
    shader.uniforms.uBrasa = uniformes.uBrasa;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nattribute vec2 aQueima;\nattribute vec3 aFibra;\nvarying vec2 vQueima;\nvarying vec3 vPosBrasa;\nvarying vec3 vFibra;\nvarying float vCimaBrasa;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\nvQueima = aQueima;\nvPosBrasa = position;\nvFibra = aFibra;\nvCimaBrasa = normal.y;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform float uTempo;\nuniform float uBrasa;\nvarying vec2 vQueima;\nvarying vec3 vPosBrasa;\nvarying vec3 vFibra;\nvarying float vCimaBrasa;\n${GLSL_RUIDO}\n${GLSL_CELULAR}`)
      .replace(
        '#include <color_fragment>',
        /* glsl */ `#include <color_fragment>
        diffuseColor.rgb = mix(vec3(dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11))), diffuseColor.rgb, ${sat});
        ${malhado}
        // blocos de carvão: células tortas (o domínio é empurrado por ruído), alongadas na fibra
        vec3 lrPf = vFibra * ${escala};
        vec3 lrPc = lrPf + (vec3(lrRuido3(lrPf * 0.36), lrRuido3(lrPf * 0.36 + 7.3), lrRuido3(lrPf * 0.36 + 13.1)) - 0.5) * 0.85;
        vec3 lrCel = lrCelular(lrPc);
        float lrDiv = lrCel.y - lrCel.x; // pequeno na divisa entre dois blocos
        // frestas de largura desigual: umas são fio de cabelo, outras abrem
        float lrAbre = lrRuido3(lrPf * 0.23 + 4.7);
        float lrFresta = 1.0 - smoothstep(0.0, 0.018 + 0.1 * lrAbre * lrAbre, lrDiv);
        float lrMancha = lrFbm3(vPosBrasa * 9.0);
        float lrFina = lrFbm3(vPosBrasa * 43.0 + 3.1);
        float lrQ = vQueima.x * 1.35 + (lrMancha - 0.5) * 0.8;
        float lrCarv = smoothstep(0.42, 0.6, lrQ);
        // madeira chamuscada antes do carvão
        diffuseColor.rgb *= mix(1.0, 0.2, smoothstep(0.06, 0.46, lrQ));
        vec3 lrCorCarvao = vec3(0.018, 0.016, 0.015) * (0.82 + 0.22 * lrCel.z + 0.3 * (lrFina - 0.5)) * (1.0 - 0.5 * lrFresta);
        diffuseColor.rgb = mix(diffuseColor.rgb, lrCorCarvao, lrCarv);
        // brasa: cada pedaço respira no seu ritmo, com um sopro lento passando pela pilha
        float lrLento = lrRuido3(vPosBrasa * 5.0 + vec3(0.0, uTempo * 0.31, uTempo * 0.2));
        float lrSopro = lrRuido3(vec3(vPosBrasa.x * 2.1 + uTempo * 0.45, vPosBrasa.z * 2.1, uTempo * 0.8));
        float lrArde = clamp(vQueima.y * (0.35 + 0.8 * lrLento) * (0.75 + 0.5 * lrSopro) * 1.25, 0.0, 1.0) * lrCarv;
        // cinza: poeira clara em manchas moles, mais por cima, quase nada onde arde forte
        float lrCinza = lrCarv * smoothstep(0.44, 0.8, lrMancha * 0.62 + lrFina * 0.42 + lrCel.z * 0.1) * smoothstep(-0.35, 0.7, vCimaBrasa) * ${cinza} * (1.0 - 0.75 * lrArde);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.17, 0.158, 0.146) * (0.75 + 0.5 * lrFina), lrCinza * (1.0 - 0.3 * lrFresta));
        // onde arde: manchas largas em que a face dos blocos fica incandescente (cada bloco num tom, a
        // cinza apaga pedaços), e por dentro delas as frestas mais claras
        float lrOnde = smoothstep(0.36, 0.64, lrFbm3(vPosBrasa * 11.0 + 31.7) + (lrArde - 0.5) * 0.6);
        float lrQuente = lrArde * lrOnde * (0.5 + 0.75 * lrCel.z) * (1.0 - 0.8 * lrCinza) * (0.7 + 0.6 * lrFina);
        float lrCorpo = smoothstep(0.16, 0.8, lrQuente);
        // nem toda fresta acende: trechos dela ficam escuros (a brasa corre por pedaços, não contorna cada bloco)
        float lrTrecho = smoothstep(0.38, 0.62, lrRuido3(lrPf * 0.55 + 11.0));
        float lrVeio = lrFresta * smoothstep(0.08, 0.4, lrArde) * lrOnde * lrTrecho;`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        /* glsl */ `#include <roughnessmap_fragment>
        // carvão: levemente acetinado (o brilho prateado da madeira queimada); cinza: fosca
        roughnessFactor = mix(roughnessFactor, 0.8 + 0.15 * lrCel.z, lrCarv);
        roughnessFactor = mix(roughnessFactor, 1.0, lrCinza);`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        /* glsl */ `#include <normal_fragment_maps>
        {
          // relevo dos blocos de carvão (a normal dobra para dentro das frestas) e grão miúdo da cinza
          float lrAlt = smoothstep(0.0, 0.18, lrDiv) * lrCarv + lrFina * (0.35 * lrCarv + ${grao}) + lrMancha * ${grao} * 1.5;
          vec3 lrSx = dFdx(-vViewPosition);
          vec3 lrSy = dFdy(-vViewPosition);
          vec3 lrR1 = cross(lrSy, normal);
          vec3 lrR2 = cross(normal, lrSx);
          float lrDet = dot(lrSx, lrR1);
          vec3 lrGrad = sign(lrDet) * (dFdx(lrAlt) * lrR1 + dFdy(lrAlt) * lrR2) * 0.0045;
          normal = normalize(abs(lrDet) * normal - lrGrad);
        }`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        /* glsl */ `#include <emissivemap_fragment>
        // valores contidos e saturados: vermelho fundo no corpo que arde pouco, laranja no que arde muito,
        // amarelo-laranja só nas frestas do miolo
        // o corpo dos blocos só cora (vermelho fundo, escuro); a claridade mora nas frestas, com um halo
        // estreito que vaza para a beira dos blocos vizinhos
        float lrHalo = (1.0 - smoothstep(0.0, 0.09 + 0.12 * lrAbre, lrDiv)) * smoothstep(0.08, 0.4, lrArde) * lrOnde * (0.3 + 0.7 * lrTrecho);
        vec3 lrCorBrasa = mix(vec3(0.4, 0.022, 0.001), vec3(0.85, 0.12, 0.008), smoothstep(0.4, 1.0, lrCorpo)) * lrCorpo * 0.32
          + vec3(0.9, 0.16, 0.012) * lrHalo * 0.22
          + vec3(1.0, 0.3, 0.035) * lrVeio * (0.3 + 0.7 * smoothstep(0.4, 1.0, lrArde));
        // claridade das brasas vizinhas na cinza e nos carvões apagados
        lrCorBrasa += diffuseColor.rgb * vec3(1.0, 0.36, 0.08) * (${luzDaBrasa} * smoothstep(-0.15, 0.7, lrQ));
        totalEmissiveRadiance += lrCorBrasa * uBrasa;`,
      );
  };
  material.customProgramCacheKey = () => `lareira-queima-${escala}-${sat}-${cinza}-${grao}-${luzDaBrasa}`;
}
