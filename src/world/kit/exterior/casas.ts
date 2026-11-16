/**
 * Construções da vila: casas de telhado íngreme com manto de neve, igrejinha, lampiões, cercas e a ponte.
 * Tudo é acumulado em poucas malhas (uma por material). As casas são construídas em metros reais e entram
 * no mundo pela matriz de cada uma (posição no terreno, giro e a escala da vila).
 */
import * as THREE from 'three';
import type { Relevo } from './relevo';
import type { MapaLuz } from './terreno';
import { Malha, type CorVertice, type Rng, faixa, fbm, matrizTRS } from './util';

export interface Malhas {
  reboco: Malha;
  /** Tábuas escuras: paredes de madeira, telhados, caixilhos, cercas, postes. */
  tabuas: Malha;
  pedra: Malha;
  /** Mantos de neve dos telhados, peitoris, cercas, galhos. */
  neve: Malha;
  /** Vidraças (emissivas): uv = célula do atlas; aCor.r = acesa (0 ou 1); aCor.g = fase da tremulação. */
  vidros: Malha;
}

export interface Halo {
  pos: THREE.Vector3;
  raio: number;
  forca: number;
}
export interface Fumaca {
  pos: THREE.Vector3;
  escala: number;
}
export interface Lampiao {
  pos: THREE.Vector3;
  forca: number;
}

export interface Obra {
  m: Malhas;
  relevo: Relevo;
  luz: MapaLuz;
  rng: Rng;
  halos: Halo[];
  fumacas: Fumaca[];
  lampioes: Lampiao[];
}

/** Ladrilho real (m) de cada textura. */
const LAD = { reboco: 2, tabuas: 2, pedra: 1.7 } as const;
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const ESCURO: CorVertice = { r: 0.5, g: 0.5, b: 0.52 };

/* ------------------------------------------------------------------ neve */

/** Monte de neve alongado (peitoril, mourão, tampa de chaminé). Centro da base em (0, 0, 0) da matriz corrente. */
function monteNeve(neve: Malha, larg: number, prof: number, alt: number, semente: number, quente = 0, fino = false) {
  const nu = fino ? 8 : 5;
  const nv = fino ? 6 : 3;
  neve.grade(
    nu,
    nv,
    (i, j, out) => {
      const u = i / (nu - 1);
      const v = j / (nv - 1);
      const borda = i === 0 || j === 0 || i === nu - 1 || j === nv - 1;
      // domo de ombros redondos: sobe depressa na borda e achata em cima
      const du = Math.sin(Math.PI * (0.1 + u * 0.8));
      const dv = Math.sin(Math.PI * (0.1 + v * 0.8));
      const domo = borda ? 0 : Math.pow(du * dv, 0.45);
      const h = alt * domo * (0.75 + 0.5 * fbm(u * 3 + semente, v * 2 + semente * 0.7, 2));
      const incha = borda ? 1 : 1.06;
      out.set((u - 0.5) * larg * incha * (1 + 0.05 * Math.sin(v * 9 + semente)), h - (borda ? 0.02 : 0), (v - 0.5) * prof * incha);
      return { quente: quente * (0.4 + 0.6 * v), ...(borda ? { r: 0.78, g: 0.8, b: 0.86 } : {}) };
    },
    0.9,
  );
}

/**
 * Punhado de neve em cima de um mourão: domo baixo e torto, tombado para o lado do vento, com a borda quebrada
 * que escorre um pouco pelas faces do mourão. Centro da base em (0, 0, 0) da matriz corrente; `larg` = diâmetro.
 */
function tampaNeve(neve: Malha, larg: number, alt: number, semente: number, fino: boolean) {
  const nr = fino ? 6 : 4;
  const na = fino ? 10 : 6;
  const tomb = 0.12 + 0.18 * fbm(semente, 1.3, 1);
  neve.grade(
    nr,
    na + 1,
    (i, j, out) => {
      const fr = i / (nr - 1);
      const ang = (j / na) * Math.PI * 2;
      const R = larg * 0.5 * (0.85 + 0.35 * fbm(Math.cos(ang) + semente, Math.sin(ang) + semente * 0.3, 2));
      const r = fr * R;
      const h = alt * Math.pow(Math.max(0, 1 - fr * fr), 0.7) * (0.7 + 0.6 * fbm(r * 14 + semente, ang * 0.7, 2));
      const escorre = fr > 0.82 ? -(fr - 0.82) * larg * (0.5 + 0.8 * fbm(ang * 2 + semente, 4.1, 2)) : 0;
      out.set(Math.cos(ang) * r + tomb * larg * (1 - fr), h + escorre - 0.012, Math.sin(ang) * r);
      return fr > 0.95 ? { r: 0.76, g: 0.8, b: 0.88 } : undefined;
    },
    0.9,
  );
}

/**
 * Manto de neve de um telhado de duas águas: uma superfície própria, grossa e arredondada, com a borda irregular
 * pendendo sobre o beiral. Eixo da cumeeira em X; A e B = meia largura e meio vão do telhado já com beirais;
 * hr = altura da cumeeira; tan = inclinação.
 */
function mantoTelhado(neve: Malha, A: number, B: number, hr: number, tan: number, semente: number, simples = false) {
  const us = simples ? [-1, -0.97, -0.86, -0.4, 0.4, 0.86, 0.97, 1] : [-1, -0.985, -0.94, -0.8, -0.5, -0.17, 0.17, 0.5, 0.8, 0.94, 0.985, 1];
  const vs = simples ? [-1, -0.97, -0.86, -0.45, -0.1, 0.1, 0.45, 0.86, 0.97, 1] : [-1, -0.985, -0.94, -0.8, -0.55, -0.28, -0.08, 0, 0.08, 0.28, 0.55, 0.8, 0.94, 0.985, 1];
  const raio = simples ? 0.22 : 0.34;
  const c = simples ? 0.2 : 0.34;
  neve.grade(
    us.length,
    vs.length,
    (i, j, out) => {
      const u = us[i];
      const v = vs[j];
      const ang = Math.atan2(v * B, u * A);
      const lingua = 0.05 + 0.2 * fbm(ang * 2.6 + semente, semente * 1.3, 2);
      const X = u * (A + lingua * 0.6);
      const Z = v * (B + lingua);
      const e = Math.min((1 - Math.abs(u)) * (A + lingua * 0.6), (1 - Math.abs(v)) * (B + lingua));
      const f = e >= raio ? 1 : Math.sqrt(Math.max(0, 1 - (1 - e / raio) * (1 - e / raio)));
      const az = Math.abs(Z);
      const plano = hr - az * tan;
      const crista = (az - (Math.sqrt(az * az + c * c) - c)) * tan; // arredonda a cumeeira
      const esp = (0.16 + 0.5 * fbm(X * 0.5 + semente, Z * 0.5 - semente, 3) + 0.14 * fbm(X * 1.7 - semente, Z * 1.7, 2)) * (0.75 + 0.6 * Math.abs(v)) * (simples ? 0.55 : 1);
      // a última fileira desce um pouco abaixo da aba do telhado: lábio grosso
      const y = e <= 1e-6 ? plano - 0.12 : plano + (crista + esp) * f;
      out.set(X, y, Z);
      return e <= 1e-6 ? { r: 0.62, g: 0.66, b: 0.74 } : f < 0.9 ? { r: 0.86, g: 0.88, b: 0.92 } : undefined;
    },
    1.3,
  );
}

/* ---------------------------------------------------------------- janelas */

interface JanelaOpc {
  acesa: boolean;
  /** Célula do atlas de vidraças (0 a 3). */
  celula?: number;
  venezianas?: boolean;
  /** Arco ogival no alto (igreja). */
  arco?: boolean;
  semNeve?: boolean;
  /** Força da luz do cômodo (0 a 1). Sorteada se não for dada. */
  forca?: number;
}

/** Janela com caixilho, travessas, peitoril e neve no peitoril. A matriz corrente tem +z para fora da parede, origem no centro da janela. */
function janela(o: Obra, M: THREE.Matrix4, w: number, h: number, opc: JanelaOpc) {
  const { tabuas, vidros, neve } = o.m;
  const fase = o.rng();
  const cel = opc.celula ?? (opc.acesa ? Math.floor(o.rng() * 2) : 2);
  const u0 = cel / 4 + 0.004;
  const u1 = (cel + 1) / 4 - 0.004;
  // cada cômodo aceso tem a sua força e o seu matiz (mel, âmbar, um ou outro com cortina avermelhada ou esverdeada)
  const forcaJ = opc.forca ?? 0.35 + 0.65 * Math.pow(o.rng(), 0.8);
  const sorteMatiz = o.rng();
  const matiz = sorteMatiz < 0.08 ? 0.9 : sorteMatiz < 0.16 ? 0.62 : sorteMatiz * 0.4;
  const cv: CorVertice = { r: opc.acesa ? 1 : 0, g: fase, b: forcaJ, quente: matiz };
  vidros.definir(M);
  if (opc.arco) {
    // retângulo + ogiva, em leque a partir do centro
    const hb = h * 0.62;
    const pts: Array<[number, number]> = [
      [-w / 2, -h / 2],
      [w / 2, -h / 2],
      [w / 2, -h / 2 + hb],
    ];
    for (let k = 1; k <= 4; k++) {
      const a = (k / 4) * (Math.PI / 2);
      pts.push([w / 2 - (w / 2) * (1 - Math.cos(a)) * 1.0, -h / 2 + hb + (h - hb) * Math.sin(a)]);
    }
    for (let k = 3; k >= 0; k--) {
      const a = (k / 4) * (Math.PI / 2);
      pts.push([-w / 2 + (w / 2) * (1 - Math.cos(a)), -h / 2 + hb + (h - hb) * Math.sin(a)]);
    }
    const uvDe = (x: number, y: number): [number, number] => [u0 + (x / w + 0.5) * (u1 - u0), y / h + 0.5];
    const c0 = vidros.v(0, 0, 0.02, 0, 0, 1, ...uvDe(0, 0), cv);
    const ids = pts.map(([x, y]) => vidros.v(x, y, 0.02, 0, 0, 1, ...uvDe(x, y), cv));
    for (let k = 0; k < ids.length; k++) vidros.tri(c0, ids[k], ids[(k + 1) % ids.length]);
  } else {
    const a = vidros.v(-w / 2, -h / 2, 0.02, 0, 0, 1, u0, 0, cv);
    const b = vidros.v(w / 2, -h / 2, 0.02, 0, 0, 1, u1, 0, cv);
    const c = vidros.v(w / 2, h / 2, 0.02, 0, 0, 1, u1, 1, cv);
    const d = vidros.v(-w / 2, h / 2, 0.02, 0, 0, 1, u0, 1, cv);
    vidros.tri(a, b, c);
    vidros.tri(a, c, d);
  }
  // caixilho: a face de dentro recebe um pouco da luz do cômodo
  tabuas.definir(M);
  const q = opc.acesa ? 0.22 : 0;
  const cx: CorVertice = { r: 0.62, g: 0.6, b: 0.6, quente: q };
  const esp = 0.1;
  // moldura: quatro tábuas chatas um pouco à frente da parede (a esta distância a espessura não se lê)
  const zf = 0.055;
  const borda = (x0: number, y0: number, x1: number, y1: number) => tabuas.face(V(x0, y0, zf), V(x1, y0, zf), V(x1, y1, zf), V(x0, y1, zf), LAD.tabuas, cx, x0, y0);
  if (!opc.arco) {
    borda(-w / 2 - esp * 1.3, h / 2, w / 2 + esp * 1.3, h / 2 + esp * 1.25);
    borda(-w / 2 - esp, -h / 2, -w / 2, h / 2);
    borda(w / 2, -h / 2, w / 2 + esp, h / 2);
  } else {
    borda(-w / 2 - esp, -h / 2, -w / 2, h * 0.12);
    borda(w / 2, -h / 2, w / 2 + esp, h * 0.12);
    tabuas.caixa(0, 0, 0.035, 0.05, h * 0.94, 0.03, LAD.tabuas, { ...ESCURO, quente: q * 0.5 }, { semBase: true, semTopo: true });
  }
  // peitoril
  tabuas.caixa(0, -h / 2 - 0.045, 0.1, w + 0.34, 0.09, 0.24, LAD.tabuas, { r: 0.7, g: 0.68, b: 0.68, quente: q });
  if (opc.venezianas) {
    const cvz: CorVertice = { r: 0.5, g: 0.56, b: 0.62 };
    tabuas.caixa(-w / 2 - esp - w * 0.26, 0, 0.03, w * 0.5, h * 1.02, 0.045, 0.9, cvz);
    tabuas.caixa(w / 2 + esp + w * 0.26, 0, 0.03, w * 0.5, h * 1.02, 0.045, 0.9, cvz);
  }
  if (!opc.semNeve) {
    neve.definir(M.clone().multiply(new THREE.Matrix4().makeTranslation(0, -h / 2, 0.12)));
    monteNeve(neve, w + 0.3, 0.22, 0.11, fase * 20, opc.acesa ? 0.55 : 0);
  }
  if (opc.acesa) {
    const centro = V(0, 0, 0.1).applyMatrix4(M);
    const escala = new THREE.Vector3().setFromMatrixScale(M).x;
    // halo pequeno, do tamanho da janela: o transbordo fica por conta do brilho do palco
    o.halos.push({ pos: centro, raio: Math.max(w, h) * 0.8 * escala, forca: 0.32 * forcaJ });
    // poça de luz na neve em frente à parede, só para fachadas que olham para a sala (as de trás não se veem)
    const fora = V(0, 0, 1).transformDirection(M);
    const pe = V(0, -h / 2, 0).applyMatrix4(M);
    const [x, D] = o.relevo.projetoDe(pe);
    o.relevo.desgirarDir(fora, D);
    const paraSala = (-x * fora.x + D * fora.z) / (Math.hypot(x, D) || 1);
    const s = o.relevo.escala(D);
    const chaoY = o.relevo.alturaProjeto(x, D) * s;
    const altura = Math.max(0.2, pe.y - chaoY) / escala; // altura real do peitoril acima da neve
    if (altura < 4.2 && paraSala > 0.05) {
      // o terreno que sobe atrás da casa encurta a poça
      const alcance = ((1.4 + altura * 0.9) * escala) / s;
      o.luz.pocaJanela(x, D, fora.x, -fora.z, alcance, ((w * 0.9 + 0.2) * escala) / s, 0.5 * forcaJ);
    }
  }
}

/** Porta de tábuas com moldura, degrau com neve e uma lanterna ao lado. */
function porta(o: Obra, M: THREE.Matrix4, w: number, h: number) {
  const { tabuas, vidros, neve, pedra } = o.m;
  tabuas.definir(M);
  const cm: CorVertice = { r: 0.6, g: 0.58, b: 0.58, quente: 0.1 };
  tabuas.caixa(0, 0, 0.02, w, h, 0.05, 0.8, { r: 0.42, g: 0.36, b: 0.34, quente: 0.16 });
  tabuas.caixa(0, h / 2 + 0.07, 0.06, w + 0.34, 0.14, 0.14, LAD.tabuas, cm);
  tabuas.caixa(-w / 2 - 0.07, 0, 0.055, 0.14, h, 0.12, LAD.tabuas, cm);
  tabuas.caixa(w / 2 + 0.07, 0, 0.055, 0.14, h, 0.12, LAD.tabuas, cm);
  pedra.definir(M);
  pedra.caixa(0, -h / 2 - 0.1, 0.35, w + 0.7, 0.2, 0.7, LAD.pedra);
  neve.definir(M.clone().multiply(new THREE.Matrix4().makeTranslation(0, -h / 2, 0.42)));
  monteNeve(neve, w + 0.8, 0.6, 0.12, o.rng() * 30, 0.5);
  // lanterna de parede
  const lx = w / 2 + 0.42;
  const ly = h / 2 - 0.25;
  tabuas.caixa(lx, ly + 0.2, 0.1, 0.05, 0.05, 0.2, 1, ESCURO);
  tabuas.caixa(lx, ly + 0.17, 0.2, 0.2, 0.04, 0.2, 1, ESCURO);
  vidros.definir(M);
  const cv: CorVertice = { r: 1, g: o.rng(), b: 0.6 };
  const u0 = 0.754;
  const u1 = 0.996;
  for (const [ax, az, bx, bz] of [
    [-0.07, 0.27, 0.07, 0.27],
    [0.07, 0.27, 0.07, 0.13],
    [-0.07, 0.13, -0.07, 0.27],
  ] as const) {
    const a = vidros.v(lx + ax, ly - 0.05, az, 0, 0, 1, u0, 0, cv);
    const b = vidros.v(lx + bx, ly - 0.05, bz, 0, 0, 1, u1, 0, cv);
    const c = vidros.v(lx + bx, ly + 0.15, bz, 0, 0, 1, u1, 1, cv);
    const d = vidros.v(lx + ax, ly + 0.15, az, 0, 0, 1, u0, 1, cv);
    vidros.tri(a, b, c);
    vidros.tri(a, c, d);
  }
  const escala = new THREE.Vector3().setFromMatrixScale(M).x;
  const pos = V(lx, ly + 0.05, 0.25).applyMatrix4(M);
  o.halos.push({ pos, raio: 1.5 * escala, forca: 0.75 });
  const fora = V(0, 0, 1).transformDirection(M);
  const pe = V(lx * 0.5, -h / 2, 0.2).applyMatrix4(M);
  const [x, D] = o.relevo.projetoDe(pe);
  o.relevo.desgirarDir(fora, D);
  const s = o.relevo.escala(D);
  o.luz.pocaJanela(x, D, fora.x, -fora.z, (3.4 * escala) / s, (1.7 * escala) / s, 0.62);
}

/* ------------------------------------------------------------------ casas */

type Parede = 'reboco' | 'tabuas' | 'pedra';

interface CorpoSpec {
  /** Comprimento ao longo da cumeeira (X local) e vão (Z local), altura das paredes, inclinação em graus. */
  w: number;
  d: number;
  h: number;
  inclin: number;
  parede: Parede;
  cor: CorVertice;
  /** Quais paredes recebem janelas: frente (+z), fundo (-z), direita (+x), esquerda (-x). */
  janelas?: { frente?: boolean; fundo?: boolean; direita?: boolean; esquerda?: boolean };
  /** Parede e posição (ao longo dela, em metros a partir do centro) da porta. */
  porta?: { parede: 'frente' | 'direita' | 'esquerda'; pos: number };
  venezianas?: boolean;
  /** Chance de cada janela estar acesa. */
  acesas?: number;
  enxaimel?: boolean;
  /** Corpo pequeno pousado no telhado (trapeira): sem embasamento, janelinha única no oitão. */
  trapeira?: boolean;
}

/** Um corpo de casa: paredes, madeiramento, telhado com espessura e beirais, manto de neve, janelas. Devolve a altura da cumeeira. */
function corpo(o: Obra, M: THREE.Matrix4, sp: CorpoSpec): number {
  const { m, rng } = o;
  const a = sp.w / 2;
  const b = sp.d / 2;
  const h = sp.h;
  const tan = Math.tan((sp.inclin * Math.PI) / 180);
  const hr = h + b * tan;
  const parede = m[sp.parede];
  const lad = LAD[sp.parede];
  const base: CorVertice = { r: (sp.cor.r ?? 1) * 0.72, g: (sp.cor.g ?? 1) * 0.74, b: (sp.cor.b ?? 1) * 0.8 };
  const topo = sp.cor;
  const du = rng() * 3;

  // embasamento de pedra, enterrado o bastante para cobrir o desnível do terreno
  if (!sp.trapeira) {
    m.pedra.definir(M);
    m.pedra.caixa(0, -0.9, 0, sp.w + 0.24, 2.6, sp.d + 0.24, LAD.pedra, { r: 0.8, g: 0.8, b: 0.85 }, { semBase: true });
  }

  parede.definir(M);
  parede.face(V(-a, 0, b), V(a, 0, b), V(a, h, b), V(-a, h, b), lad, base, du, 0, topo);
  parede.face(V(a, 0, -b), V(-a, 0, -b), V(-a, h, -b), V(a, h, -b), lad, base, du + 1.3, 0, topo);
  for (const sx of [-1, 1]) {
    parede.face(V(sx * a, 0, sx * b), V(sx * a, 0, -sx * b), V(sx * a, h, -sx * b), V(sx * a, h, sx * b), lad, base, du + 2.1 + sx, 0, topo);
    parede.triFace(V(sx * a, h, sx * b), V(sx * a, h, -sx * b), V(sx * a, hr, 0), lad, topo, du + 2.1 + sx, h / lad);
  }

  // madeiramento aparente
  const mad = m.tabuas;
  mad.definir(M);
  const cm: CorVertice = sp.parede === 'tabuas' ? { r: 0.85, g: 0.85, b: 0.9 } : { r: 0.5, g: 0.46, b: 0.46 };
  if (sp.parede !== 'pedra' && !sp.trapeira) {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) mad.caixa(sx * (a + 0.01), h / 2, sz * (b + 0.01), 0.22, h, 0.22, LAD.tabuas, cm, { semBase: true });
    for (const sz of [-1, 1]) mad.caixa(0, 0.14, sz * (b + 0.035), sp.w, 0.22, 0.09, LAD.tabuas, cm);
    for (const sx of [-1, 1]) {
      mad.caixa(sx * (a + 0.035), h - 0.02, 0, 0.09, 0.22, sp.d, LAD.tabuas, cm);
      mad.caixa(sx * (a + 0.035), 0.14, 0, 0.09, 0.22, sp.d, LAD.tabuas, cm);
    }
    if (sp.enxaimel) {
      const hg = hr - h;
      for (const sx of [-1, 1]) {
        mad.caixa(sx * (a + 0.035), h + hg * 0.46, 0, 0.09, hg * 0.92, 0.18, LAD.tabuas, cm);
        mad.caixa(sx * (a + 0.035), h + hg * 0.42, 0, 0.09, 0.16, sp.d * 0.56, LAD.tabuas, cm);
      }
      if (h > 4.4) {
        for (const sz of [-1, 1]) mad.caixa(0, h * 0.52, sz * (b + 0.035), sp.w, 0.2, 0.09, LAD.tabuas, cm);
        for (const sx of [-1, 1]) mad.caixa(sx * (a + 0.035), h * 0.52, 0, 0.09, 0.2, sp.d, LAD.tabuas, cm);
      }
    }
  }

  // telhado: duas águas com espessura, beiral e aba no oitão
  const og = sp.trapeira ? 0.22 : 0.42;
  const oe = sp.trapeira ? 0.26 : 0.55;
  const A = a + og;
  const B = b + oe;
  const esp = 0.2;
  const sobe = 0.16; // a face de cima passa acima do topo da parede
  const ct: CorVertice = { r: 0.42, g: 0.4, b: 0.42 };
  const cos = 1 / Math.sqrt(1 + tan * tan);
  for (const sz of [-1, 1]) {
    const nrm = V(0, cos, sz * tan * cos); // normal da água
    const r1 = V(-A, hr + sobe, 0);
    const r2 = V(A, hr + sobe, 0);
    const e1 = V(-A, hr + sobe - B * tan, sz * B);
    const e2 = V(A, hr + sobe - B * tan, sz * B);
    const bx = (p: THREE.Vector3) => p.clone().addScaledVector(nrm, -esp);
    mad.face(r1, r2, e2, e1, LAD.tabuas, ct);
    mad.face(bx(r1), bx(r2), bx(e2), bx(e1), LAD.tabuas, { r: 0.3, g: 0.3, b: 0.33 });
    mad.face(e1, e2, bx(e2), bx(e1), LAD.tabuas, ct);
    mad.face(r1, e1, bx(e1), bx(r1), LAD.tabuas, ct);
    mad.face(r2, e2, bx(e2), bx(r2), LAD.tabuas, ct);
  }
  m.neve.definir(M);
  mantoTelhado(m.neve, A, B, hr + sobe + 0.01, tan, rng() * 50, !!sp.trapeira);

  // janelas e porta
  const jan = sp.janelas ?? { frente: true, direita: true, esquerda: true };
  const pAcesa = sp.acesas ?? 0.7;
  const lados: Array<{ nome: 'frente' | 'fundo' | 'direita' | 'esquerda'; rot: number; comp: number; dist: number; oitao: boolean }> = [
    { nome: 'frente', rot: 0, comp: sp.w, dist: b, oitao: false },
    { nome: 'fundo', rot: Math.PI, comp: sp.w, dist: b, oitao: false },
    { nome: 'direita', rot: Math.PI / 2, comp: sp.d, dist: a, oitao: true },
    { nome: 'esquerda', rot: -Math.PI / 2, comp: sp.d, dist: a, oitao: true },
  ];
  for (const L of lados) {
    const temPorta = sp.porta?.parede === L.nome;
    if (!jan[L.nome] && !temPorta) continue;
    const Mp = M.clone().multiply(new THREE.Matrix4().makeRotationY(L.rot)).multiply(new THREE.Matrix4().makeTranslation(0, 0, L.dist));
    if (sp.trapeira) {
      janela(o, Mp.clone().multiply(new THREE.Matrix4().makeTranslation(0, h * 0.62, 0)), 0.78, 0.95, { acesa: rng() < pAcesa, semNeve: false });
      continue;
    }
    const n = Math.max(1, Math.floor((L.comp - 1.0) / 2.5));
    const util = L.comp - 1.5;
    const andares = h > 4.6 ? 2 : 1;
    const jw = faixa(rng, 0.95, 1.12);
    const jh = faixa(rng, 1.3, 1.5);
    let idxPorta = -1;
    if (temPorta) {
      // a porta toma o lugar da janela mais próxima da posição pedida
      let melhor = 1e9;
      for (let i = 0; i < n; i++) {
        const x = n === 1 ? 0 : -util / 2 + (util * i) / (n - 1);
        if (Math.abs(x - sp.porta!.pos) < melhor) {
          melhor = Math.abs(x - sp.porta!.pos);
          idxPorta = i;
        }
      }
    }
    for (let andar = 0; andar < andares; andar++) {
      for (let i = 0; i < n; i++) {
        const x = n === 1 ? 0 : -util / 2 + (util * i) / (n - 1);
        if (andar === 0 && i === idxPorta) {
          porta(o, Mp.clone().multiply(new THREE.Matrix4().makeTranslation(x, 1.3, 0)), 1.05, 2.1);
          continue;
        }
        if (!jan[L.nome]) continue;
        const y = andar === 0 ? 1.05 + jh / 2 + (andares === 2 ? 0 : 0.1) : h - 0.5 - jh / 2;
        janela(o, Mp.clone().multiply(new THREE.Matrix4().makeTranslation(x, y, 0)), jw, jh, { acesa: rng() < pAcesa, venezianas: sp.venezianas });
      }
    }
    // janelinha do sótão no oitão
    if (L.oitao && jan[L.nome] && hr - h > 2.3) {
      janela(o, Mp.clone().multiply(new THREE.Matrix4().makeTranslation(0, h + (hr - h) * 0.36, 0)), 0.72, 0.9, { acesa: rng() < pAcesa * 0.75 });
    }
  }
  return hr + sobe;
}

/** Chaminé de pedra com tampa, neve em cima e ponto de saída da fumaça. (x, z) no local da casa; yTopo = altura do topo. */
function chamine(o: Obra, M: THREE.Matrix4, x: number, z: number, yBase: number, yTopo: number) {
  const { pedra, neve, tabuas } = o.m;
  pedra.definir(M);
  const c: CorVertice = { r: 0.82, g: 0.8, b: 0.82 };
  pedra.caixa(x, (yBase + yTopo) / 2, z, 0.74, yTopo - yBase, 0.74, LAD.pedra, c, { afina: 0.94, semBase: true });
  pedra.caixa(x, yTopo + 0.07, z, 0.9, 0.14, 0.9, LAD.pedra, c);
  tabuas.definir(M);
  tabuas.caixa(x, yTopo + 0.3, z, 0.32, 0.34, 0.32, 1, { r: 0.3, g: 0.26, b: 0.26 }, { afina: 0.8, semBase: true });
  neve.definir(M.clone().multiply(new THREE.Matrix4().makeTranslation(x - 0.2, yTopo + 0.14, z + 0.16)));
  monteNeve(neve, 0.5, 0.56, 0.16, x * 3 + z);
  const escala = new THREE.Vector3().setFromMatrixScale(M).x;
  o.fumacas.push({ pos: V(x, yTopo + 0.5, z).applyMatrix4(M), escala });
}

export interface CasaSpec {
  /** Posição (coordenadas de projeto) e giro em Y. */
  x: number;
  D: number;
  rot: number;
  w: number;
  d: number;
  h: number;
  inclin: number;
  parede: Parede;
  /** Tinta das paredes (multiplica a textura). */
  cor?: [number, number, number];
  /** Ala em cruz saindo da frente: largura, quanto avança, posição ao longo da frente. */
  ala?: { w: number; avanco: number; pos: number; h?: number };
  /** Anexo mais baixo encostado em um oitão (lado -1 ou 1). */
  anexo?: { w: number; d: number; h: number; lado: -1 | 1 };
  chamines?: Array<[number, number]>;
  /** Trapeiras na água da frente: posições ao longo da cumeeira. */
  trapeiras?: number[];
  venezianas?: boolean;
  enxaimel?: boolean;
  acesas?: number;
  portaNa?: 'frente' | 'ala' | 'nenhuma';
}

export function construirCasa(o: Obra, sp: CasaSpec) {
  const { relevo } = o;
  const esc = relevo.escalaVila(sp.D);
  const s = relevo.escala(sp.D);
  const raio = (Math.hypot(sp.w, sp.d + (sp.ala?.avanco ?? 0)) * 0.5 * esc) / s;
  const yProj = relevo.aplainar({ x: sp.x, D: sp.D, raio });
  const M = relevo.posicionar(sp.x, sp.D, yProj * s + 0.12 * esc, sp.rot, esc);
  const cor: CorVertice = { r: sp.cor?.[0] ?? 1, g: sp.cor?.[1] ?? 1, b: sp.cor?.[2] ?? 1 };
  const portaNa = sp.portaNa ?? (sp.ala ? 'ala' : 'frente');
  const hr = corpo(o, M, {
    w: sp.w,
    d: sp.d,
    h: sp.h,
    inclin: sp.inclin,
    parede: sp.parede,
    cor,
    venezianas: sp.venezianas,
    enxaimel: sp.enxaimel,
    acesas: sp.acesas,
    porta: portaNa === 'frente' ? { parede: 'frente', pos: sp.ala ? -sp.ala.pos : faixa(o.rng, -1.5, 1.5) } : undefined,
  });
  if (sp.ala) {
    // ala em cruz: um corpo girado 90 graus, com a empena para a frente
    const al = sp.ala;
    const Ma = M.clone().multiply(new THREE.Matrix4().makeTranslation(al.pos, 0, sp.d / 2 + al.avanco / 2 - 0.6)).multiply(new THREE.Matrix4().makeRotationY(Math.PI / 2));
    corpo(o, Ma, {
      w: al.avanco + 1.2,
      d: al.w,
      h: al.h ?? sp.h,
      inclin: sp.inclin + 2,
      parede: sp.parede,
      cor,
      venezianas: sp.venezianas,
      enxaimel: sp.enxaimel,
      acesas: sp.acesas,
      // depois do giro: a "esquerda" local do corpo da ala olha para a frente da casa
      janelas: { frente: true, fundo: true, esquerda: portaNa !== 'ala' },
      porta: portaNa === 'ala' ? { parede: 'esquerda', pos: 0 } : undefined,
    });
  }
  if (sp.anexo) {
    const an = sp.anexo;
    const Mx = M.clone().multiply(new THREE.Matrix4().makeTranslation(an.lado * (sp.w / 2 + an.w / 2 - 0.25), 0, (sp.d - an.d) * -0.25));
    corpo(o, Mx, { w: an.w, d: an.d, h: an.h, inclin: sp.inclin - 6, parede: sp.parede === 'pedra' ? 'tabuas' : sp.parede, cor, acesas: (sp.acesas ?? 0.7) * 0.6, janelas: { frente: true, direita: an.lado > 0, esquerda: an.lado < 0 } });
  }
  for (const px of sp.trapeiras ?? []) {
    // trapeira: corpinho de duas águas saindo do telhado, com a empena no prumo da parede da frente
    const Mt = M.clone().multiply(new THREE.Matrix4().makeTranslation(px, sp.h - 0.25, sp.d / 2 - 1.0)).multiply(new THREE.Matrix4().makeRotationY(Math.PI / 2));
    corpo(o, Mt, { w: 2.3, d: 1.7, h: 1.35, inclin: 50, parede: sp.parede, cor, acesas: 0.85, trapeira: true, janelas: { esquerda: true } });
  }
  const tan = Math.tan((sp.inclin * Math.PI) / 180);
  for (const [cx, cz] of sp.chamines ?? [[sp.w * 0.24, -0.5]]) {
    const yTelhado = hr - Math.abs(cz) * tan;
    chamine(o, M, cx, cz, yTelhado - 1.2, Math.max(hr + 0.75, yTelhado + 1.5));
  }
  // sombra de contato pintada na neve, em volta da casa
  const dir = relevo.desgirarDir(V(1, 0, 0).transformDirection(M), sp.D);
  o.luz.oclusao(sp.x, sp.D, dir.x, -dir.z, ((sp.w / 2 + 1.3) * esc) / s, ((sp.d / 2 + 1.3 + (sp.ala?.avanco ?? 0) * 0.5) * esc) / s, 0.75);
}

/* ----------------------------------------------------------------- igreja */

export function construirIgreja(o: Obra, x: number, D: number, rot: number) {
  const { relevo, m, rng } = o;
  const esc = relevo.escalaVila(D);
  const s = relevo.escala(D);
  const yProj = relevo.aplainar({ x, D, raio: (9 * esc) / s });
  const M = relevo.posicionar(x, D, yProj * s + 0.1 * esc, rot, esc);
  const cor: CorVertice = { r: 1.0, g: 0.98, b: 0.95 };
  // nave: cumeeira ao longo de X local; a torre fica na ponta +X (a composição gira a igreja para a torre olhar a vila)
  const nw = 12;
  const nd = 7.2;
  const nh = 5.2;
  const inclin = 58;
  const tan = Math.tan((inclin * Math.PI) / 180);
  const a = nw / 2;
  const b = nd / 2;
  const hr = nh + b * tan;
  m.pedra.definir(M);
  m.pedra.caixa(0, -0.8, 0, nw + 0.3, 2.6, nd + 0.3, LAD.pedra, { r: 0.8, g: 0.8, b: 0.85 }, { semBase: true });
  const par = m.reboco;
  par.definir(M);
  const base: CorVertice = { r: 0.72, g: 0.73, b: 0.78 };
  for (const sz of [-1, 1]) par.face(V(-sz * a, 0, sz * b), V(sz * a, 0, sz * b), V(sz * a, nh, sz * b), V(-sz * a, nh, sz * b), LAD.reboco, base, sz, 0, cor);
  for (const sx of [-1, 1]) {
    par.face(V(sx * a, 0, sx * b), V(sx * a, 0, -sx * b), V(sx * a, nh, -sx * b), V(sx * a, nh, sx * b), LAD.reboco, base, 3 + sx, 0, cor);
    par.triFace(V(sx * a, nh, sx * b), V(sx * a, nh, -sx * b), V(sx * a, hr, 0), LAD.reboco, cor, 3 + sx, nh / LAD.reboco);
  }
  // contrafortes de pedra entre as janelas
  for (const sz of [-1, 1]) for (const px of [-4.2, -1.4, 1.4, 4.2]) m.pedra.caixa(px + 1.4, nh * 0.42, sz * (b + 0.22), 0.5, nh * 0.84, 0.5, LAD.pedra, undefined, { afina: 0.7, semBase: true });
  // telhado
  const mad = m.tabuas;
  mad.definir(M);
  const A = a + 0.35;
  const B = b + 0.5;
  const cos = 1 / Math.sqrt(1 + tan * tan);
  const ct: CorVertice = { r: 0.4, g: 0.4, b: 0.44 };
  for (const sz of [-1, 1]) {
    const nrm = V(0, cos, sz * tan * cos);
    const r1 = V(-A, hr + 0.16, 0);
    const r2 = V(A, hr + 0.16, 0);
    const e1 = V(-A, hr + 0.16 - B * tan, sz * B);
    const e2 = V(A, hr + 0.16 - B * tan, sz * B);
    const bx = (p: THREE.Vector3) => p.clone().addScaledVector(nrm, -0.22);
    mad.face(r1, r2, e2, e1, LAD.tabuas, ct);
    mad.face(bx(r1), bx(r2), bx(e2), bx(e1), LAD.tabuas, { r: 0.3, g: 0.3, b: 0.33 });
    mad.face(e1, e2, bx(e2), bx(e1), LAD.tabuas, ct);
    mad.face(r1, e1, bx(e1), bx(r1), LAD.tabuas, ct);
    mad.face(r2, e2, bx(e2), bx(r2), LAD.tabuas, ct);
  }
  m.neve.definir(M);
  mantoTelhado(m.neve, A, B, hr + 0.17, tan, 77.7);
  // janelas ogivais ao longo da nave
  for (const sz of [-1, 1]) {
    for (const px of [-2.8, 0, 2.8]) {
      const Mj = M.clone()
        .multiply(new THREE.Matrix4().makeRotationY(sz > 0 ? 0 : Math.PI))
        .multiply(new THREE.Matrix4().makeTranslation(px * sz, 2.9, b));
      janela(o, Mj, 0.95, 2.7, { acesa: true, arco: true, celula: 1 });
    }
  }
  // torre na ponta +X
  const tw = 3.7;
  const th = 11.5;
  const tx = a + tw / 2 - 0.5;
  m.pedra.caixa(tx, -0.8, 0, tw + 0.4, 2.8, tw + 0.4, LAD.pedra, { r: 0.8, g: 0.8, b: 0.85 }, { semBase: true });
  par.definir(M);
  const Mt = M.clone().multiply(new THREE.Matrix4().makeTranslation(tx, 0, 0));
  par.definir(Mt);
  par.caixa(0, th / 2, 0, tw, th, tw, LAD.reboco, base, { semBase: true, semTopo: true, cTopo: cor, afina: 0.95 });
  m.pedra.definir(Mt);
  // cunhais e cornijas de pedra
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) m.pedra.caixa(sx * tw * 0.485, th * 0.5, sz * tw * 0.485, 0.42, th, 0.42, LAD.pedra, undefined, { semBase: true, afina: 0.93 });
  m.pedra.caixa(0, th * 0.66, 0, tw + 0.16, 0.26, tw + 0.16, LAD.pedra);
  m.pedra.caixa(0, th + 0.12, 0, tw + 0.3, 0.3, tw + 0.3, LAD.pedra);
  // aberturas do campanário (escuras, com um resto de luz) nas quatro faces
  for (let k = 0; k < 4; k++) {
    const Mj = Mt.clone()
      .multiply(new THREE.Matrix4().makeRotationY((k * Math.PI) / 2))
      .multiply(new THREE.Matrix4().makeTranslation(0, th * 0.83, tw * 0.482));
    janela(o, Mj, 0.9, 2.0, { acesa: false, arco: true, celula: 2, semNeve: true });
  }
  // portal e óculo na face da frente da torre (+X da igreja)
  const Mf = Mt.clone().multiply(new THREE.Matrix4().makeRotationY(Math.PI / 2));
  janela(o, Mf.clone().multiply(new THREE.Matrix4().makeTranslation(0, 1.75, tw * 0.5)), 1.5, 3.1, { acesa: true, arco: true, celula: 0, semNeve: true });
  janela(o, Mf.clone().multiply(new THREE.Matrix4().makeTranslation(0, 6.0, tw * 0.49)), 0.9, 1.5, { acesa: true, arco: true, celula: 1 });
  // flecha: base alargada e agulha íngreme, de tábuas com neve pousada (o material das tábuas tem "poeira" de neve)
  mad.definir(Mt);
  const y0 = th + 0.27;
  const r0 = tw * 0.56;
  const r1 = tw * 0.3;
  const y1 = y0 + 1.5;
  const y2 = y0 + 8.4;
  const cf: CorVertice = { r: 0.45, g: 0.46, b: 0.52 };
  for (let k = 0; k < 4; k++) {
    const c0 = [
      [-1, 1],
      [1, 1],
      [1, -1],
      [-1, -1],
    ][k];
    const c1 = [
      [1, 1],
      [1, -1],
      [-1, -1],
      [-1, 1],
    ][k];
    mad.face(V(c0[0] * r0, y0, c0[1] * r0), V(c1[0] * r0, y0, c1[1] * r0), V(c1[0] * r1, y1, c1[1] * r1), V(c0[0] * r1, y1, c0[1] * r1), 1.2, cf);
    mad.triFace(V(c0[0] * r1, y1, c0[1] * r1), V(c1[0] * r1, y1, c1[1] * r1), V(0, y2, 0), 1.2, cf);
  }
  // cruz no alto
  mad.caixa(0, y2 + 0.5, 0, 0.1, 1.3, 0.1, 1, ESCURO);
  mad.caixa(0, y2 + 0.72, 0, 0.62, 0.1, 0.1, 1, ESCURO);
  // neve na base da flecha
  for (let k = 0; k < 4; k++) {
    const Mn = Mt.clone()
      .multiply(new THREE.Matrix4().makeRotationY((k * Math.PI) / 2))
      .multiply(new THREE.Matrix4().makeTranslation(0, y0 + 0.02, r0 * 0.86));
    m.neve.definir(Mn);
    monteNeve(m.neve, tw * 1.05, 0.9, 0.34, k * 7.3 + rng());
  }
  const dir = relevo.desgirarDir(V(1, 0, 0).transformDirection(M), D);
  o.luz.oclusao(x + (dir.x * 1.2 * esc) / s, D - (dir.z * 1.2 * esc) / s, dir.x, -dir.z, ((a + tw + 1.2) * esc) / s, ((b + 1.6) * esc) / s, 0.75);
}

/* --------------------------------------------------------------- lampiões */

/**
 * Lampião de rua de ferro fundido: base torneada, fuste que afina, colarinho, braço redondo, lanterna sextavada
 * com caixilho fino, chapéu em telhado de seis águas com remate, e um punhado de neve torto no chapéu.
 * `altura` real em metros; `esc` = escala do mundo.
 */
export function construirLampiao(o: Obra, x: number, D: number, altura: number, esc: number, forca = 1) {
  const { relevo, m } = o;
  const p = relevo.chao(x, D);
  const M = matrizTRS(p.x, p.y - 0.05 * esc, p.z, x * 1.7 + D, esc);
  const mad = m.tabuas;
  mad.definir(M);
  const c: CorVertice = { r: 0.2, g: 0.21, b: 0.25 };
  const fino = esc > 0.6;
  const ld = fino ? 10 : 6;
  const yl = altura - 0.62; // base da lanterna
  // poste inteiro em um perfil só
  mad.torno(
    [
      [0.16, 0],
      [0.16, 0.07],
      [0.12, 0.1],
      [0.105, 0.36],
      [0.085, 0.42],
      [0.09, 0.46],
      [0.062, 0.5],
      [0.052, yl * 0.45],
      [0.042, yl - 0.2],
      [0.06, yl - 0.16],
      [0.064, yl - 0.12],
      [0.05, yl - 0.1],
      [0.09, yl - 0.04],
      [0.11, yl],
    ],
    ld,
    1,
    c,
  );
  // braço de apoio da escada do acendedor: barra redonda com as pontas viradas
  if (fino) {
    const yb = yl * 0.8;
    mad.tubo([V(-0.27, yb + 0.06, 0), V(-0.25, yb, 0), V(0.25, yb, 0), V(0.27, yb + 0.06, 0)], [0.016, 0.018, 0.018, 0.016], 6, 1, c, true);
  }
  // lanterna sextavada: vidros inclinados (mais largos em cima) e montantes finos
  const b0 = 0.105;
  const b1 = 0.17;
  const y0 = yl;
  const y1 = yl + 0.42;
  m.vidros.definir(M);
  const cv: CorVertice = { r: 1, g: Math.abs(x * 0.37 + D * 0.11) % 1, b: 0.62, quente: 0.3 };
  const canto = (k: number, r: number, y: number) => V(Math.cos((k / 6) * Math.PI * 2) * r, y, Math.sin((k / 6) * Math.PI * 2) * r);
  for (let k = 0; k < 6; k++) {
    const a0 = canto(k, b0, y0);
    const a1 = canto(k + 1, b0, y0);
    const c1 = canto(k + 1, b1, y1);
    const c0 = canto(k, b1, y1);
    const ia = m.vidros.v(a0.x, a0.y, a0.z, 0, 0, 1, 0.754, 0, cv);
    const ib = m.vidros.v(a1.x, a1.y, a1.z, 0, 0, 1, 0.996, 0, cv);
    const ic = m.vidros.v(c1.x, c1.y, c1.z, 0, 0, 1, 0.996, 1, cv);
    const id = m.vidros.v(c0.x, c0.y, c0.z, 0, 0, 1, 0.754, 1, cv);
    m.vidros.tri(ia, ib, ic);
    m.vidros.tri(ia, ic, id);
    if (fino) mad.tubo([canto(k, b0 * 1.04, y0), canto(k, b1 * 1.04, y1)], [0.009, 0.009], 4, 1, c, false);
  }
  // aro de baixo e de cima da lanterna, chapéu de seis águas com beiral e remate
  const yc = y1;
  mad.torno([[b0 + 0.01, y0 - 0.02], [b0 + 0.025, y0], [b0 + 0.012, y0 + 0.025]], 6, 1, c, 0, false);
  mad.torno(
    [
      [b1 - 0.01, yc - 0.02],
      [b1 + 0.07, yc + 0.01],
      [b1 + 0.075, yc + 0.035],
      [b1 * 0.55, yc + 0.13],
      [0.035, yc + 0.22],
      [0.045, yc + 0.25],
      [0.028, yc + 0.29],
      [0.0, yc + 0.32],
    ],
    6,
    1,
    c,
    0,
    false,
  );
  // neve no chapéu: camada fina que acompanha as águas, mais grossa em volta do remate e do lado do vento, com a borda quebrada
  const sem = x * 3.1 + D;
  const telhado = (r: number) => (r < 0.035 ? yc + 0.22 : r < b1 * 0.55 ? yc + 0.22 - ((r - 0.035) / (b1 * 0.55 - 0.035)) * 0.09 : yc + 0.13 - ((r - b1 * 0.55) / (b1 + 0.075 - b1 * 0.55)) * 0.095);
  m.neve.definir(M);
  const nn = fino ? 8 : 5;
  m.neve.grade(
    nn,
    fino ? 10 : 6,
    (i, j, out) => {
      const fr = i / (nn - 1);
      const ang = (j / (fino ? 9 : 5)) * Math.PI * 2;
      const borda = (b1 + 0.07) * (0.86 + 0.22 * fbm(Math.cos(ang) * 1.3 + sem, Math.sin(ang) * 1.3, 2));
      const r = fr * borda;
      const vento = 1 + 0.45 * Math.cos(ang - 0.6);
      const esp = (0.022 + 0.05 * Math.pow(1 - fr, 1.5)) * vento * (0.7 + 0.6 * fbm(r * 9 + sem, ang, 2));
      const fim = i === nn - 1;
      out.set(Math.cos(ang) * r, telhado(r) + (fim ? -0.012 : esp), Math.sin(ang) * r);
      return fim ? { r: 0.74, g: 0.78, b: 0.86, quente: 0.15 } : { quente: 0.08 };
    },
    0.9,
  );
  const pos = V(0, yl + 0.2, 0).applyMatrix4(M);
  o.halos.push({ pos, raio: 0.9 * esc * (0.8 + 0.4 * forca), forca: 0.55 * forca });
  o.lampioes.push({ pos, forca: 0.42 * esc * forca });
  const s = relevo.escala(D);
  o.luz.pocaLampiao(x, D, (3.0 * esc * (0.7 + 0.3 * forca)) / s, 0.5 * forca);
  o.luz.oclusao(x, D, 1, 0, (0.4 * esc) / s, (0.4 * esc) / s, 0.5);
}

/* ------------------------------------------------------------------ cercas */

/** Viga entre dois pontos do mundo (a matriz corrente da malha é ignorada). `alt` = lado vertical, `esp` = lado horizontal. */
function viga(malha: Malha, p0: THREE.Vector3, p1: THREE.Vector3, alt: number, esp: number, ladrilho: number, c?: CorVertice) {
  const dir = new THREE.Vector3().subVectors(p1, p0);
  const comp = dir.length();
  dir.normalize();
  const lado = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
  const cima = new THREE.Vector3().crossVectors(lado, dir);
  const M = new THREE.Matrix4().makeBasis(dir, cima, lado).setPosition(p0.x + dir.x * comp * 0.5, p0.y + dir.y * comp * 0.5, p0.z + dir.z * comp * 0.5);
  malha.definir(M);
  malha.caixa(0, 0, 0, comp, alt, esp, ladrilho, c);
}

/**
 * Cerca ao longo de uma linha de pontos de projeto [x, D]. 'ripas' = cerca de jardim (mourões, duas réguas e ripas
 * pontudas); 'varas' = cerca rústica de mourões e duas varas. Leva um cordão irregular de neve por cima.
 */
export function construirCerca(o: Obra, linha: ReadonlyArray<readonly [number, number]>, estilo: 'ripas' | 'varas', esc: number, vao?: [number, number]) {
  const { relevo, m, rng } = o;
  const mad = m.tabuas;
  const passo = (estilo === 'ripas' ? 1.9 : 2.3) * esc;
  // amostra a linha em pontos igualmente espaçados (em planta)
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < linha.length - 1; i++) {
    const [ax, ad] = linha[i];
    const [bx, bd] = linha[i + 1];
    const n = Math.max(1, Math.round(Math.hypot(bx - ax, bd - ad) / passo));
    for (let k = 0; k < n; k++) pts.push([ax + ((bx - ax) * k) / n, ad + ((bd - ad) * k) / n]);
  }
  pts.push([linha[linha.length - 1][0], linha[linha.length - 1][1]]);
  const hCerca = (estilo === 'ripas' ? 0.86 : 0.95) * esc;
  const cm: CorVertice = { r: 0.58, g: 0.56, b: 0.58 };
  const chao = pts.map(([x, D]) => relevo.chao(x, D));
  const noVao = (x: number) => !!vao && x > vao[0] && x < vao[1];
  for (let i = 0; i < pts.length; i++) {
    const p = chao[i];
    if (noVao(pts[i][0])) continue;
    // mourão levemente torto, mais alto que as ripas, com neve em cima
    const hm = hCerca * (1.14 + 0.1 * rng());
    const M = matrizTRS(p.x, p.y - 0.1 * esc, p.z, rng() * 0.5, esc).multiply(new THREE.Matrix4().makeRotationZ((rng() - 0.5) * 0.07));
    mad.definir(M);
    const lm = estilo === 'ripas' ? 0.13 : 0.15;
    mad.caixa(0, hm / esc / 2, 0, lm, hm / esc + 0.1, lm, 1, cm, { afina: 0.86, semBase: true, du: rng() * 5, dv: rng() * 5 });
    m.neve.definir(M.clone().multiply(new THREE.Matrix4().makeTranslation(0, hm / esc + 0.05, 0)));
    tampaNeve(m.neve, lm * (1.5 + 0.7 * rng()), 0.05 + 0.1 * rng(), i * 3.1 + rng() * 7, esc > 0.6);
    const [x, D] = pts[i];
    o.luz.oclusao(x, D, 1, 0, 0.3 * esc, 0.3 * esc, 0.35);
  }
  for (let i = 0; i < pts.length - 1; i++) {
    const a = chao[i];
    const b = chao[i + 1];
    const xm = (pts[i][0] + pts[i + 1][0]) / 2;
    if (noVao(xm) || noVao(pts[i][0]) || noVao(pts[i + 1][0])) continue;
    const up = (h: number, p: THREE.Vector3) => new THREE.Vector3(p.x, p.y + h, p.z);
    const dir = new THREE.Vector3().subVectors(b, a);
    const comp = dir.length();
    dir.normalize();
    const lado = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
    if (estilo === 'ripas') {
      for (const h of [0.24, 0.6]) viga(mad, up(h * esc, a).addScaledVector(lado, 0.035 * esc), up(h * esc, b).addScaledVector(lado, 0.035 * esc), 0.07 * esc, 0.035 * esc, 1, cm);
      const n = Math.max(2, Math.round(comp / (0.19 * esc)));
      for (let k = 1; k < n; k++) {
        const t = k / n;
        if (rng() < 0.035) continue; // uma ou outra ripa faltando
        const hr = hCerca * (0.94 + 0.12 * rng());
        const px = a.x + dir.x * comp * t;
        const py = a.y + dir.y * comp * t;
        const pz = a.z + dir.z * comp * t;
        const M = new THREE.Matrix4()
          .makeBasis(new THREE.Vector3(dir.x, 0, dir.z).normalize(), new THREE.Vector3(0, 1, 0), lado)
          .setPosition(px, py, pz)
          .multiply(new THREE.Matrix4().makeRotationZ((rng() - 0.5) * 0.07));
        mad.definir(M);
        const cr: CorVertice = { r: 0.5 + 0.14 * rng(), g: 0.52, b: 0.56 };
        const larg = (0.062 + 0.018 * rng()) * esc;
        // cada ripa pega um trecho diferente da madeira (senão os nós se repetem em faixa ao longo da cerca)
        const du = rng() * 7;
        const dv = rng() * 7;
        mad.caixa(0, hr * 0.44, 0, larg, hr * 0.88, 0.022 * esc, 1.5, cr, { semBase: true, semTopo: true, du, dv });
        mad.caixa(0, hr * 0.94, 0, larg, hr * 0.12, 0.022 * esc, 1.5, cr, { afina: 0.12, semBase: true, semTopo: true, du, dv: dv + hr * 0.88 / 1.5 });
      }
    } else {
      for (const h of [0.36, 0.78]) {
        const ja = (rng() - 0.5) * 0.06 * esc;
        const jb = (rng() - 0.5) * 0.06 * esc;
        viga(mad, up(h * esc + ja, a), up(h * esc + jb, b), 0.09 * esc, 0.06 * esc, 1, cm);
      }
    }
    // cordão de neve por cima: irregular, some onde caiu; nas ripas, as pontas furam a neve
    const yTopo = estilo === 'ripas' ? hCerca * 0.88 : 0.83 * esc;
    const nu = Math.max(4, Math.round(comp / (0.16 * esc)));
    const semente = i * 5.7 + rng() * 9;
    const larguraNeve = (estilo === 'ripas' ? 0.2 : 0.15) * esc;
    const nvC = esc > 0.6 ? 5 : 4;
    m.neve.definir(new THREE.Matrix4());
    m.neve.grade(
      nu + 1,
      nvC,
      (iu, iv, out) => {
        const t = iu / nu;
        const v = iv / (nvC - 1);
        const g = Math.max(0, fbm(t * comp * 1.6 + semente, semente, 2) - 0.36) * 2.4;
        const arco = Math.pow(Math.sin(Math.PI * (0.06 + v * 0.88)), 0.6);
        const alt = (0.012 + 0.22 * g) * esc * arco;
        const lateral = (v - 0.5) * larguraNeve * (0.75 + 0.5 * g);
        const bordaV = iv === 0 || iv === nvC - 1;
        out.set(a.x + dir.x * comp * t + lado.x * lateral, a.y + dir.y * comp * t + yTopo + (bordaV ? -0.02 * esc : alt), a.z + dir.z * comp * t + lado.z * lateral);
        return bordaV ? { r: 0.78, g: 0.8, b: 0.86 } : undefined;
      },
      0.9,
    );
  }
  // sombra de contato ao longo da cerca
  for (let i = 0; i < pts.length - 1; i += 1) {
    if (noVao(pts[i][0])) continue;
    const [x, D] = pts[i];
    const [x2, D2] = pts[i + 1];
    o.luz.oclusao((x + x2) / 2, (D + D2) / 2, x2 - x, D2 - D, Math.hypot(x2 - x, D2 - D) * 0.7, 0.28 * esc, 0.28);
  }
}

/* ------------------------------------------------------------------ ponte */

/** Ponte de pedra em arco sobre o riacho, com parapeitos e neve. (x, D) = centro; `ang` = direção do tabuleiro em planta. */
export function construirPonte(o: Obra, x: number, D: number, ang: number) {
  const { relevo, m } = o;
  const esc = relevo.escalaVila(D);
  const s = relevo.escala(D);
  const yA = relevo.alturaProjeto(x + Math.sin(ang) * 2.6, D - Math.cos(ang) * 2.6);
  const yB = relevo.alturaProjeto(x - Math.sin(ang) * 2.6, D + Math.cos(ang) * 2.6);
  const y0 = Math.min(yA, yB) * s;
  // X local = ao longo do tabuleiro
  const M = relevo.posicionar(x, D, y0, ang + Math.PI / 2, esc);
  const meio = 5.0;
  const larg = 3.0;
  const n = 12;
  const topo = (t: number) => 0.35 + 1.0 * (1 - t * t) * (1 - 0.25 * t * t);
  const arco = (xx: number) => (Math.abs(xx) < 3.0 ? -0.9 + 1.75 * Math.sqrt(1 - (xx / 3.0) * (xx / 3.0)) : -3);
  const pedra = m.pedra;
  pedra.definir(M);
  const c: CorVertice = { r: 0.85, g: 0.85, b: 0.9 };
  for (let i = 0; i < n; i++) {
    const xa = -meio + (2 * meio * i) / n;
    const xb = -meio + (2 * meio * (i + 1)) / n;
    const ta = topo(xa / meio);
    const tb = topo(xb / meio);
    const ba = Math.max(arco(xa), -2.2);
    const bb = Math.max(arco(xb), -2.2);
    for (const sz of [-1, 1]) {
      const z = (sz * larg) / 2;
      pedra.face(V(xa, ba, z), V(xb, bb, z), V(xb, tb, z), V(xa, ta, z), LAD.pedra, c, xa / LAD.pedra, 0);
      // parapeito
      pedra.face(V(xa, ta, z), V(xb, tb, z), V(xb, tb + 0.62, z), V(xa, ta + 0.62, z), LAD.pedra, c, xa / LAD.pedra, 0.5);
      pedra.face(V(xa, ta, z - sz * 0.3), V(xb, tb, z - sz * 0.3), V(xb, tb + 0.62, z - sz * 0.3), V(xa, ta + 0.62, z - sz * 0.3), LAD.pedra, c, xa / LAD.pedra, 0.5);
      pedra.face(V(xa, ta + 0.62, z), V(xb, tb + 0.62, z), V(xb, tb + 0.62, z - sz * 0.3), V(xa, ta + 0.62, z - sz * 0.3), LAD.pedra, c);
    }
    // intradorso do arco (escuro) e tabuleiro
    pedra.face(V(xa, ba, -larg / 2), V(xb, bb, -larg / 2), V(xb, bb, larg / 2), V(xa, ba, larg / 2), LAD.pedra, { r: 0.4, g: 0.42, b: 0.5 });
    pedra.face(V(xa, ta, -larg / 2), V(xb, tb, -larg / 2), V(xb, tb, larg / 2), V(xa, ta, larg / 2), LAD.pedra, c);
  }
  // neve no tabuleiro e nos parapeitos
  m.neve.definir(M);
  m.neve.grade(
    n + 1,
    4,
    (i, j, out) => {
      const xx = -meio + (2 * meio * i) / n;
      const v = j / 3;
      out.set(xx, topo(xx / meio) + 0.05 + 0.08 * Math.sin(Math.PI * v) * (0.6 + 0.8 * fbm(xx, v * 3, 2)), (v - 0.5) * (larg - 0.62));
    },
    1.3,
  );
  for (const sz of [-1, 1]) {
    m.neve.grade(
      n * 2 + 1,
      4,
      (i, j, out) => {
        const xx = -meio + (meio * i) / n;
        const v = j / 3;
        const g = 0.5 + 0.9 * fbm(xx * 1.3 + sz * 9, 4.2, 2);
        out.set(xx, topo(xx / meio) + 0.62 + 0.16 * g * Math.sin(Math.PI * v) - (j === 0 || j === 3 ? 0.03 : 0), sz * (larg / 2 - 0.15) + (v - 0.5) * 0.4);
      },
      1.1,
    );
  }
  o.luz.oclusao(x, D, Math.sin(ang), -Math.cos(ang), (meio * esc * 1.1) / s, (larg * esc * 0.9) / s, 0.6);
}
