/**
 * Modelagem dos gnomos: esculpe cada peça como superfície paramétrica na pose de ligação e a acumula
 * no material certo, com os pesos de pele. Medidas em metros; pés em y = 0; frente = +Z.
 *
 * Ordem: tronco (suéter de tricô com barra canelada e jacquard), pernas e botas de couro, braços e
 * luvas (ou mãos de quatro dedos), cabeça (bochechas, nariz, orelhas, olhos com pálpebras),
 * sobrancelhas, barba em mechas sobre um miolo, bigode, gorro mole com aba enrolada e ponta,
 * acessórios (cachecol, colete, avental, cinto, raminho de azevinho, sino, lanterninha, tranças).
 */
import * as THREE from 'three';
import type { Aparencia, Rgb } from './aparencia';
import { escalarRgb, hex, misturarRgb } from './aparencia';
import { O } from './esqueleto';
import type { NomeMaterial } from './materiais';
import { MATERIAIS } from './materiais';
import { Acumulador, Canal, type Cor4, type Pesos, pontoElipsoide, tampa, Trilho } from './malha';
import { TRICO_CARREIRAS, TRICO_PONTOS } from './texturas';
import { criarSorteio, fbm3, limitar, misturar, ruido3, sino, suave } from './util';

/** Ladrilho de tricô grosso em metros (16 pontos x 20 carreiras): gorro, aba e cachecol. */
const PONTO = 0.0125;
const CARREIRA = 0.0105;
const TRICO_W = TRICO_PONTOS * PONTO;
const TRICO_H = TRICO_CARREIRAS * CARREIRA;
/** Ladrilho do tricô fino (suéter, mangas e luvas): ponto com 60% do tamanho do grosso. */
const FINO = 0.6;
const TRICO_WF = TRICO_W * FINO;
const TRICO_HF = TRICO_H * FINO;
/** Faixa do ladrilho (em v) que tem o motivo em jacquard. */
const MOTIVO_V0 = 3.5 / TRICO_CARREIRAS;

/** Peças lógicas: cada uma grava em um dos quatro acumuladores (materiais) com o seu `tipo`. */
type Pecas = Record<'pele' | 'olhos' | 'trico' | 'feltro' | 'barba' | 'cartoes' | 'couro' | 'metal' | 'brilho', Canal>;

export interface Modelo {
  acc: Record<NomeMaterial, Acumulador>;
  /** Posição de ligação de cada osso, no espaço da raiz. */
  ossos: THREE.Vector3[];
  /** Ponto da etiqueta (espaço da raiz, pose de ligação). */
  etiqueta: THREE.Vector3;
  /** Ponto do presente (espaço da raiz). */
  presente: THREE.Vector3;
  /** Altura total (pé à ponta do gorro). */
  altura: number;
  /** Medidas úteis para a animação. */
  info: {
    olhoR: number;
    gorroForma: string;
    curvaGorro: THREE.Vector3; // direção para onde o gorro dobra (espaço da raiz)
    maoRepouso: THREE.Vector3; // alvo da mão E parada
    alcance: number; // ombro ao centro da mão
    temBarba: boolean;
    temTrancas: boolean;
    temCachecol: boolean;
  };
}

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
// rascunhos reaproveitados dentro das funções de ponto (que nunca se chamam umas às outras)
const _P = V();
const _T = V();
const _N = V();
const _B = V();
const _D = V();
const _K = V();
const cor4 = (c: Rgb, a = 0): Cor4 => [c[0], c[1], c[2], a];

/** Interpolação cúbica (Catmull-Rom) por pontos (x crescente). */
function perfil(pontos: Array<[number, number]>): (x: number) => number {
  return (x: number) => {
    const n = pontos.length;
    if (x <= pontos[0][0]) return pontos[0][1];
    if (x >= pontos[n - 1][0]) return pontos[n - 1][1];
    let i = 0;
    while (i < n - 2 && x > pontos[i + 1][0]) i++;
    const [x0, y0] = pontos[i];
    const [x1, y1] = pontos[i + 1];
    const yA = pontos[Math.max(0, i - 1)][1];
    const xA = pontos[Math.max(0, i - 1)][0];
    const yB = pontos[Math.min(n - 1, i + 2)][1];
    const xB = pontos[Math.min(n - 1, i + 2)][0];
    const h = x1 - x0;
    const m0 = ((y1 - yA) / Math.max(1e-6, x1 - xA)) * h;
    const m1 = ((yB - y0) / Math.max(1e-6, xB - x0)) * h;
    const t = (x - x0) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * y0 + (t3 - 2 * t2 + t) * m0 + (-2 * t3 + 3 * t2) * y1 + (t3 - t2) * m1;
  };
}

/** Bézier cúbica. */
function bezier(p0: THREE.Vector3, p1: THREE.Vector3, p2: THREE.Vector3, p3: THREE.Vector3) {
  return (t: number, out: THREE.Vector3) => {
    const s = 1 - t;
    out.set(0, 0, 0)
      .addScaledVector(p0, s * s * s)
      .addScaledVector(p1, 3 * s * s * t)
      .addScaledVector(p2, 3 * s * t * t)
      .addScaledVector(p3, t * t * t);
  };
}

/** Mistura suave entre ossos por um parâmetro: lista de [osso, posição]. */
function pesosAo(longo: Array<[number, number]>, x: number): Pesos {
  if (x <= longo[0][1]) return [[longo[0][0], 1]];
  const n = longo.length;
  if (x >= longo[n - 1][1]) return [[longo[n - 1][0], 1]];
  for (let i = 0; i < n - 1; i++) {
    const [a, xa] = longo[i];
    const [b, xb] = longo[i + 1];
    if (x <= xb) {
      const t = suave(xa, xb, x);
      return [
        [a, 1 - t],
        [b, t],
      ];
    }
  }
  return [[longo[n - 1][0], 1]];
}

export function modelar(ap: Aparencia, detalhe: number): Modelo {
  const fis = Object.fromEntries(MATERIAIS.map((k) => [k, new Acumulador()])) as Record<NomeMaterial, Acumulador>;
  const acc: Pecas = {
    pele: new Canal(fis.pele, 0),
    olhos: new Canal(fis.pele, 1),
    trico: new Canal(fis.tecido, 0),
    feltro: new Canal(fis.tecido, 1),
    barba: new Canal(fis.barba, 0),
    cartoes: new Canal(fis.barba, 1),
    couro: new Canal(fis.duro, 0),
    metal: new Canal(fis.duro, 1),
    brilho: new Canal(fis.duro, 2),
  };
  const p = ap.p;
  const R = p.cabecaR;
  const s = criarSorteio(ap.semente ^ 0x5bd1e995);
  // divisões: o mínimo também encolhe com o detalhe (o nível baixo precisa chegar a ~2,5 mil triângulos)
  const n = (x: number, min = 4) => Math.max(3, Math.round(min * Math.min(1, detalhe / 0.82)), Math.round(x * detalhe));
  const ossos: THREE.Vector3[] = [];
  const cur = p.curvatura;

  /* ------------------------------------------------------------------ medidas */
  const topo = p.pescoco + 0.035; // onde o suéter fecha no pescoço
  const B = p.barriga;
  const r0 = p.saia ? B * 1.16 : B * 0.86;
  const rOmbro = p.ombroX + 0.05;
  const raioY = perfil([
    [p.barra, r0],
    [p.barra + (p.barrigaY - p.barra) * 0.45, p.saia ? B * 1.04 : B * 0.985],
    [p.barrigaY, B],
    [p.barrigaY + (p.ombroY - p.barrigaY) * 0.5, B * 0.86 + rOmbro * 0.1],
    [p.ombroY - 0.02, rOmbro + 0.02],
    [p.ombroY + 0.035, rOmbro * 0.72],
    [topo, 0.07],
  ]);
  /** Inclinação do tronco para a frente (vovô): desloca z conforme a altura. */
  const inclinar = (y: number) => cur * Math.max(0, y - p.barrigaY) * 0.9;
  /** Raio do tronco em (y, ângulo a partir da frente). */
  const raioTronco = (y: number, a: number) => {
    const c = Math.cos(a);
    return raioY(y) * (1 + 0.075 * Math.max(0, c) ** 2 * sino(y - p.barrigaY, 0.13) - 0.04 * Math.max(0, -c));
  };
  const pontoTronco = (y: number, a: number, extra: number, out: THREE.Vector3) => {
    const r = raioTronco(y, a) + extra;
    return out.set(Math.sin(a) * r * 1.04, y, Math.cos(a) * r * 0.94 + inclinar(y));
  };

  // centro da cabeça (o vovô projeta a cabeça para a frente)
  const H = V(0, p.cabecaY, 0.01 + inclinar(p.cabecaY) * 0.9);

  /* ------------------------------------------------------------------- ossos */
  const lado = [1, -1] as const;
  ossos[O.RAIZ] = V(0, 0, 0);
  ossos[O.QUADRIL] = V(0, p.quadril, 0);
  ossos[O.BARRIGA] = V(0, p.barrigaY, 0);
  ossos[O.PEITO] = V(0, p.ombroY - 0.04, inclinar(p.ombroY - 0.04));
  ossos[O.CABECA] = V(0, p.pescoco, inclinar(p.pescoco));
  const ombro = (sx: number) => V(sx * p.ombroX, p.ombroY, inclinar(p.ombroY));
  ossos[O.BRACO_E] = ombro(1);
  ossos[O.BRACO_D] = ombro(-1);
  ossos[O.ANTE_E] = ombro(1).add(V(p.braco * 0.52, 0, 0));
  ossos[O.ANTE_D] = ombro(-1).add(V(-p.braco * 0.52, 0, 0));
  ossos[O.MAO_E] = ombro(1).add(V(p.braco, 0, 0));
  ossos[O.MAO_D] = ombro(-1).add(V(-p.braco, 0, 0));
  const tornozelo = 0.075 * p.bota;
  for (const sx of lado) {
    const e = sx > 0;
    ossos[e ? O.COXA_E : O.COXA_D] = V(sx * p.pernaX, p.quadril, 0);
    ossos[e ? O.CANELA_E : O.CANELA_D] = V(sx * p.pernaX, (p.quadril + tornozelo) / 2, 0.004);
    ossos[e ? O.PE_E : O.PE_D] = V(sx * p.pernaX, tornozelo, 0);
  }

  /* ------------------------------------------------------------------- tronco */
  const corSueter = ap.roupa.sueter;
  {
    const nu = n(32, 12);
    const voltasU = Math.max(2, Math.round((2 * Math.PI * B * 1.02) / TRICO_WF));
    // faixa de jacquard logo acima da barra (aparece dos lados e atrás; na frente a barba cobre)
    const faixa0 = p.barra + 0.035;
    const faixa1 = faixa0 + TRICO_HF * (1 - MOTIVO_V0 * 0.9);
    const yIni = p.barra;
    const vb = 0.06;
    const vAltura = (v: number) => (v < vb ? yIni : yIni + ((v - vb) / (1 - vb)) * (topo - yIni));
    const vDeY = (y: number) => vb + ((y - yIni) / (topo - yIni)) * (1 - vb);
    const nv = n(22, 10);
    const vs: number[] = [];
    for (let j = 0; j <= nv; j++) vs.push(j === 0 ? 0 : vb + ((j - 1) / (nv - 1)) * (1 - vb));
    if (ap.roupa.sueterMotivo) {
      for (const y of [faixa0, faixa1]) vs.push(vDeY(y), vDeY(y));
      vs.sort((a, b) => a - b);
    }
    acc.trico.adicionar({
      nu,
      nv,
      vs,
      ponto(u, v, out) {
        const a = u * Math.PI * 2;
        if (v < vb) {
          // fundo fechado (por dentro da barra, entre as pernas)
          const k = v / vb;
          const y = yIni + 0.03 * (1 - k);
          return void pontoTronco(y, a, 0, out).setX(out.x * k).setZ((out.z - inclinar(y)) * k + inclinar(y));
        }
        const y = vAltura(v);
        // fecha arredondado no pescoço
        const fecho = y > topo - 0.03 ? Math.sqrt(Math.max(0, 1 - ((y - (topo - 0.03)) / 0.03) ** 2)) : 1;
        const ondula = 0.004 * fbm3(Math.cos(a) * 3, y * 9, Math.sin(a) * 3, 2, 11);
        pontoTronco(y, a, ondula, out);
        out.x *= fecho;
        out.z = (out.z - inclinar(y)) * fecho + inclinar(y);
      },
      uv(u, v) {
        const y = vAltura(v);
        const vy = ap.roupa.sueterMotivo && y >= faixa0 && y <= faixa1 ? MOTIVO_V0 + (y - faixa0) / TRICO_HF : y / TRICO_HF;
        return [u * voltasU, vy];
      },
      cor(_u, v) {
        const y = vAltura(v);
        const dentro = ap.roupa.sueterMotivo && y > faixa0 && y < faixa1 ? 1 : 0;
        // escurece um pouco embaixo (sombra de contato) e debaixo dos braços
        const k = 0.86 + 0.14 * suave(p.barra, p.barra + 0.08, y);
        return cor4(escalarRgb(corSueter, k), dentro);
      },
      pesos(_u, v) {
        const y = vAltura(v);
        return pesosAo(
          [
            [O.QUADRIL, p.quadril + 0.02],
            [O.BARRIGA, p.barrigaY + 0.04],
            [O.PEITO, p.ombroY - 0.06],
          ],
          y,
        );
      },
    });
    // barra canelada (um rolo de tricô em volta da barra)
    const corBarra = ap.roupa.barra;
    const altB = p.saia ? 0.028 : 0.034;
    const espB = 0.014;
    acc.trico.adicionar({
      nu: n(30, 10),
      nv: n(5, 4),
      ponto(u, v, out) {
        const a = u * Math.PI * 2;
        const f = v * Math.PI * 2;
        const y = p.barra + altB * 0.45 + Math.sin(f) * altB * 0.5;
        const base = raioTronco(p.barra + 0.01, a) + 0.002;
        const r = base + Math.cos(f) * espB * 0.6 + espB * 0.35;
        out.set(Math.sin(a) * r * 1.04, y, Math.cos(a) * r * 0.94 + inclinar(y));
      },
      uv: (u, v) => [u * voltasU * 2.5, 12.5 / TRICO_CARREIRAS + v * 0.3],
      cor: () => cor4(corBarra),
      pesos: () => [[O.QUADRIL, 1]],
    });
  }

  /* ------------------------------------------------------- pernas e botas */
  for (const sx of lado) {
    const e = sx > 0;
    const coxa = e ? O.COXA_E : O.COXA_D;
    const canela = e ? O.CANELA_E : O.CANELA_D;
    const pe = e ? O.PE_E : O.PE_D;
    const x0 = sx * p.pernaX;
    const yTopo = p.quadril + 0.04;
    const yBase = tornozelo + 0.03;
    // calça de feltro (tubo curto, um pouco franzido no tornozelo)
    acc.feltro.adicionar({
      nu: n(10, 6),
      nv: n(5, 3),
      ponto(u, v, out) {
        const a = u * Math.PI * 2;
        const y = yTopo + (yBase - yTopo) * v;
        const r = 0.052 * (1 + 0.08 * Math.sin(Math.PI * v)) * (1 + 0.04 * Math.sin(a * 5 + v * 9));
        out.set(x0 + Math.sin(a) * r, y, Math.cos(a) * r);
      },
      uv: (u, v) => [u * 1.5, v * 0.6],
      cor: () => cor4(ap.roupa.calca),
      pesos: (_u, v) => pesosAo(
        [
          [coxa, 0.25],
          [canela, 0.7],
        ],
        v,
      ),
    });
    // cano da bota (couro), com a borda dobrada
    const kb = p.bota;
    const corBota = escalarRgb(ap.roupa.botas, 1.7);
    acc.couro.adicionar({
      nu: n(14, 8),
      nv: n(8, 4),
      ponto(u, v, out) {
        const a = u * Math.PI * 2;
        // v: 0 = dentro da borda, 0.25 = borda dobrada, 1 = pé
        let y: number;
        let r: number;
        if (v < 0.3) {
          const k = v / 0.3;
          const f = k * Math.PI;
          y = (0.155 - 0.012 * Math.sin(f) + 0.02 * (1 - Math.cos(f)) * 0.5 - 0.03 * k) * kb;
          r = (0.05 + 0.016 * Math.sin(f)) * kb;
          if (k < 0.5) r = (0.048 + 0.016 * Math.sin(f)) * kb;
        } else {
          const k = (v - 0.3) / 0.7;
          y = (0.125 - k * 0.1) * kb;
          r = (0.056 + 0.006 * k) * kb;
        }
        r *= 1 + 0.05 * Math.sin(a * 3 + 1 + v * 4) * (v < 0.3 ? 1 : 0.3);
        out.set(x0 + Math.sin(a) * r, y, Math.cos(a) * r + 0.005);
      },
      uv: (u, v) => [u * 0.9 * kb, v * 0.3],
      cor: (_u, v) => cor4(escalarRgb(corBota, v < 0.3 ? 0.85 : 1)),
      pesos: () => [[pe, 1]],
    });
    // pé da bota: grande, de bico redondo um pouco virado para cima, sola mais escura
    const giro = sx * 0.16;
    acc.couro.adicionar({
      nu: n(18, 10),
      nv: n(11, 6),
      ponto(u, v, out) {
        pontoElipsoide(u, v, out);
        const lx = out.x;
        const ly = out.y;
        const lz = out.z;
        const frente = Math.max(0, lz);
        let x = lx * 0.064 * (1 + 0.18 * frente);
        let y = ly * 0.052 + 0.048;
        let z = lz * 0.112 + 0.035;
        // achata a sola
        if (y < 0.012) y = 0.012 - (0.012 - y) * 0.12;
        // bico arrebitado
        y += 0.5 * Math.max(0, z - 0.08) ** 2 * 9;
        // o calcanhar é mais estreito
        x *= 1 - 0.12 * Math.max(0, -lz);
        x *= kb;
        y *= kb;
        z *= kb;
        // gira para fora (pés abertos)
        const c = Math.cos(giro);
        const sn = Math.sin(giro);
        out.set(x0 + x * c + z * sn, y, -x * sn + z * c);
      },
      uv: (u, v) => [u * 1.4, v * 0.8],
      cor(_u, _v, q) {
        const sola = q.y < 0.02 * kb ? 0.32 : 1;
        const bico = 1 + 0.18 * suave(0.06, 0.13, q.z) * (q.y > 0.03 ? 1 : 0);
        return cor4(escalarRgb(corBota, sola * bico));
      },
      pesos: () => [[pe, 1]],
    });
  }

  /* ------------------------------------------------------- braços e mãos */
  const corLuva = ap.roupa.luvas;
  // pele um pouco mais clara e menos saturada que a da aparência: o rosado do frio faz o resto
  const lumPele = 0.2126 * ap.pele[0] + 0.7152 * ap.pele[1] + 0.0722 * ap.pele[2];
  const corPele: Rgb = escalarRgb(misturarRgb(ap.pele, [lumPele, lumPele, lumPele], 0.22), 1.07);
  /** Rosado do frio: mais vermelho e menos verde (o sangue sob a pele), não uma tinta por cima. */
  const rosar = (c: Rgb, k: number): Rgb => [c[0] * (1 + 0.42 * k), c[1] * (1 - 0.24 * k), c[2] * (1 - 0.2 * k)];
  for (const sx of lado) {
    const e = sx > 0;
    const braco = e ? O.BRACO_E : O.BRACO_D;
    const ante = e ? O.ANTE_E : O.ANTE_D;
    const mao = e ? O.MAO_E : O.MAO_D;
    const S = ombro(sx);
    const x0 = S.x - sx * 0.035;
    const x1 = S.x + sx * p.braco;
    // manga: fofa, mais larga perto do cotovelo, franzida no punho, com rugas no cotovelo
    acc.trico.adicionar({
      nu: n(12, 8),
      nv: n(12, 6),
      ponto(u, v, out) {
        const a = u * Math.PI * 2;
        const x = x0 + (x1 - x0) * v;
        // folga de manga: bojo no cotovelo, franzido no punho, rugas de compressão na dobra
        let r = 0.07 * (1 + 0.1 * Math.sin(Math.PI * Math.min(1, v * 1.1)) + 0.13 * sino(v - 0.5, 0.16) - 0.14 * suave(0.85, 1, v));
        r *= 1 + 0.05 * sino(v - 0.52, 0.1) * Math.sin(v * 46 + Math.sin(a * 2) * 1.5) * (0.6 + 0.4 * Math.cos(a)) + 0.03 * Math.sin(a * 3 + v * 9) * sino(v - 0.2, 0.2);
        r *= tampa(v, 0.1, 0.06);
        out.set(x, S.y + Math.cos(a) * r, S.z + Math.sin(a) * r);
      },
      uv: (u, v) => [u * 4, (v * p.braco) / TRICO_HF],
      cor: (_u, v) => cor4(escalarRgb(corSueter, 0.9 + 0.1 * v)),
      pesos: (_u, v) => pesosAo(
        [
          [braco, 0.38],
          [ante, 0.66],
        ],
        v,
      ),
    });
    // punho canelado
    const corPunho = ap.roupa.barra;
    acc.trico.adicionar({
      nu: n(12, 8),
      nv: n(4, 4),
      ponto(u, v, out) {
        const a = u * Math.PI * 2;
        const f = v * Math.PI * 2;
        const x = x1 - sx * 0.02 + sx * Math.sin(f) * 0.02;
        const r = 0.056 + Math.cos(f) * 0.008;
        out.set(x, S.y + Math.cos(a) * r, S.z + Math.sin(a) * r);
      },
      uv: (u, v) => [u * 3, 12.5 / TRICO_CARREIRAS + v * 0.2],
      cor: () => cor4(corPunho),
      pesos: () => [[ante, 1]],
    });
    const M = V(x1 + sx * 0.012, S.y, S.z); // punho
    const dedos = e ? O.DEDOS_E : O.DEDOS_D;
    const kM = 1.5; // mãos grandes de desenho animado
    ossos[dedos] = V(M.x + sx * 0.05 * kM, M.y, M.z);
    /** Peso dos dedos: a partir dos nós dos dedos, o osso DEDOS dobra a ponta da mão. */
    const pesoDedos = (q: THREE.Vector3): Pesos => pesosAo(
      [
        [mao, 0.04 * kM],
        [dedos, 0.065 * kM],
      ],
      (q.x - M.x) * sx,
    );
    if (corLuva) {
      // luva de feltro: palma fofa, ponta que fecha (osso dos dedos), polegar separado e punho canelado
      acc.feltro.adicionar({
        nu: n(14, 8),
        nv: n(10, 5),
        ponto(u, v, out) {
          pontoElipsoide(u, v, out);
          const lx = out.y;
          const ly = out.x;
          const lz = out.z;
          const ponta = Math.max(0, lx);
          out.set(M.x + sx * (lx * 0.058 + 0.05) * kM, M.y + (ly * 0.03 * (1 - 0.25 * ponta) - 0.003) * kM, M.z + lz * 0.044 * (1 - 0.1 * ponta) * kM);
        },
        uv: (u, v) => [u * 1.6, v * 0.8],
        cor: (_u, _v, q) => cor4(escalarRgb(corLuva, 0.82 + 0.18 * suave(-0.02, 0.03, q.y - M.y))),
        pesos: (_u, _v, q) => pesoDedos(q),
      });
      const dPol = V(sx * 0.45, 0.1, 0.89).normalize();
      const cPol = V(M.x + sx * 0.028 * kM, M.y - 0.002, M.z + 0.03 * kM);
      const tPol = new Trilho((t, o) => o.copy(cPol).addScaledVector(dPol, t * 0.04 * kM).add(V(sx * t * t * 0.012, 0, 0)), 6, V(0, 1, 0));
      acc.feltro.adicionar({
        nu: n(8, 5),
        nv: n(6, 4),
        ponto(u, v, out) {
          const P = _P;
          const T = _T;
          const N = _N;
          const Bn = _B;
          tPol.em(v, P, T, N, Bn);
          const a = u * Math.PI * 2;
          const r = 0.016 * kM * tampa(v, 0, 0.45) * (1 - 0.15 * v);
          out.copy(P).addScaledVector(N, Math.cos(a) * r * 0.85).addScaledVector(Bn, Math.sin(a) * r);
        },
        uv: (u, v) => [u * 0.6, v * 0.4],
        cor: () => cor4(escalarRgb(corLuva, 0.92)),
        pesos: () => [[mao, 1]],
      });
      // punho canelado da luva (tricô de outra cor, cobrindo a ponta da manga)
      const corPunhoL = misturarRgb(corLuva, ap.roupa.barra, 0.5);
      acc.trico.adicionar({
        nu: n(16, 8),
        nv: n(4, 3),
        ponto(u, v, out) {
          const a = u * Math.PI * 2;
          const x = M.x - sx * 0.02 + sx * v * 0.04;
          const r = (0.043 + 0.0035 * Math.cos(a * 12)) * (1 + 0.06 * Math.sin(Math.PI * v)) * tampa(v, 0.15, 0.15) + 0.003;
          out.set(x, M.y + Math.cos(a) * r, M.z + Math.sin(a) * r);
        },
        uv: (u, v) => [u * 3, 12.5 / TRICO_CARREIRAS + v * 0.2],
        cor: () => cor4(corPunhoL),
        pesos: () => [[mao, 1]],
      });
    } else {
      // mão nua: palma gorda, três dedos que afinam (dobram pelo osso dos dedos) e polegar oposto
      const peleMao = rosar(corPele, 0.35);
      acc.pele.adicionar({
        nu: n(12, 8),
        nv: n(8, 5),
        ponto(u, v, out) {
          pontoElipsoide(u, v, out);
          const lx = out.y;
          const ly = out.x;
          const lz = out.z;
          out.set(M.x + sx * (lx * 0.034 + 0.03) * kM, M.y + ly * 0.02 * kM, M.z + lz * 0.036 * kM);
        },
        cor: () => cor4(peleMao),
        pesos: (_u, _v, q) => pesoDedos(q),
      });
      for (let d = 0; d < 4; d++) {
        const polegar = d === 3;
        const z = polegar ? 0.03 : (d - 1) * 0.021;
        const ini = polegar ? V(M.x + sx * 0.022 * kM, M.y - 0.003, M.z + 0.026 * kM) : V(M.x + sx * 0.056 * kM, M.y + 0.002, M.z + z * kM * 0.9);
        const dir = polegar ? V(sx * 0.5, -0.05, 0.86).normalize() : V(sx, -0.1, z * 2).normalize();
        const comp = (polegar ? 0.03 : 0.037 - Math.abs(d - 1) * 0.004) * kM;
        const trilho = new Trilho((t, o) => o.copy(ini).addScaledVector(dir, t * comp).add(V(0, -t * t * 0.01, 0)), 6, V(0, 1, 0));
        acc.pele.adicionar({
          nu: n(7, 5),
          nv: n(6, 3),
          ponto(u, v, out) {
            const r = (polegar ? 0.0125 : 0.0112) * kM * (1 - 0.3 * v) * tampa(v, 0, 0.35);
            const P = _P;
            const T = _T;
            const N = _N;
            const Bn = _B;
            trilho.em(v, P, T, N, Bn);
            const a = u * Math.PI * 2;
            out.copy(P).addScaledVector(N, Math.cos(a) * r * 0.85).addScaledVector(Bn, Math.sin(a) * r);
          },
          cor: (_u, v) => cor4(rosar(peleMao, 0.25 * v)),
          pesos: (_u, _v, q) => (polegar ? [[mao, 1]] : pesoDedos(q)),
        });
      }
    }
  }

  /* ---------------------------------------------------------------- cabeça */
  // plano da aba do gorro (inclinado: na frente acima das sobrancelhas, atrás na nuca)
  const g = ap.gorro;
  const touca = g.forma === 'touca';
  const yFrenteG = H.y + R * (touca ? 0.56 : 0.5);
  const yTrasG = H.y - R * (touca ? 0.24 : 0.34);
  const zFrenteG = H.z + R * 0.88;
  const zTrasG = H.z - R * 0.86;
  const inclinaGorro = Math.atan2(yFrenteG - yTrasG, zFrenteG - zTrasG);
  const baseG = V(0, (yFrenteG + yTrasG) / 2, (zFrenteG + zTrasG) / 2);
  const rotG = new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), -inclinaGorro);
  const normalAba = V(0, 1, 0).applyQuaternion(rotG);
  const temBarbaCheia = ap.barba.forma !== 'nenhuma' && ap.barba.forma !== 'curta';
  const olhoR = R * 0.205;
  const olhoC = (sx: number) => {
    const x = sx * R * 0.33;
    const y = -0.03 * R;
    const z = R * 0.95 * Math.sqrt(1 - (0.33 / 1.0) ** 2 - 0.03 ** 2) - olhoR * 0.42;
    return V(x, y, z).add(H);
  };
  // maçãs do rosto altas e para fora (empurradas pelo sorriso)
  const bochechas = [V(R * 0.48, -R * 0.24, R * 0.75).add(H), V(-R * 0.48, -R * 0.24, R * 0.75).add(H)];
  const narizC = V(0, -R * 0.24, R * 0.98).add(H);
  const rn = R * 0.3 * p.nariz;
  const orelhaC = (sx: number) => V(sx * R * 0.95, -R * 0.2, -R * 0.05).add(H);
  /** Cor da pele com o rosado do frio nas bochechas e no nariz, e a sombra da órbita e da aba. */
  const corRosto = (q: THREE.Vector3): Cor4 => {
    let k = 0;
    for (const b of bochechas) k = Math.max(k, Math.exp(-q.distanceToSquared(b) / (R * R * 0.11)));
    k = Math.max(k, 0.6 * Math.exp(-q.distanceToSquared(narizC) / (R * R * 0.09)));
    let c = rosar(corPele, 0.95 * k);
    // oclusão: anel da órbita em volta dos olhos e a faixa logo abaixo da aba do gorro
    let oc = 1;
    for (const sx of lado) {
      const d = q.distanceTo(olhoC(sx));
      oc *= 1 - 0.16 * Math.exp(-(((d - olhoR * 1.18) / (olhoR * 0.32)) ** 2));
    }
    const sobAba = V().subVectors(q, baseG).dot(normalAba);
    oc *= 1 - 0.3 * suave(-R * 0.22, 0, sobAba);
    c = escalarRgb(rosar(c, 0.25 * (1 - oc)), oc);
    return cor4(c);
  };
  ossos[O.OLHO_E] = olhoC(1);
  ossos[O.OLHO_D] = olhoC(-1);
  ossos[O.PALP_E] = olhoC(1);
  ossos[O.PALP_D] = olhoC(-1);
  ossos[O.PINF_E] = olhoC(1);
  ossos[O.PINF_D] = olhoC(-1);
  acc.pele.adicionar({
    nu: n(30, 14),
    nv: n(22, 10),
    ponto(u, v, out) {
      pontoElipsoide(u, v, out);
      const d = out.clone();
      out.set(d.x * R, d.y * R * 1.0, d.z * R * 0.95).add(H);
      // bochechas fartas (calombos suaves ao longo da normal) e queixo
      for (const b of bochechas) out.addScaledVector(d, R * 0.15 * Math.exp(-out.distanceToSquared(b) / (R * R * 0.075)));
      // queixo um pouco para a frente (fica sob a barba)
      out.z += R * 0.06 * Math.max(0, -d.y) * Math.max(0, d.z);
      // achata a nuca
      if (d.z < 0) out.z -= R * 0.05 * -d.z;
    },
    uv: (u, v) => [u * 3, v * 2],
    cor: (_u, _v, q) => corRosto(q),
    pesos: () => [[O.CABECA, 1]],
  });
  // nariz grande e redondo, em forma de pera (mais gordo embaixo)
  acc.pele.adicionar({
    nu: n(16, 10),
    nv: n(12, 6),
    ponto(u, v, out) {
      pontoElipsoide(u, v, out);
      const d = out.clone();
      const cima = Math.max(0, d.y);
      const baixo = Math.max(0, -d.y);
      out.set(d.x * rn * (1.08 - 0.32 * cima + 0.06 * baixo), d.y * rn * 0.95, d.z * rn * (0.92 - 0.25 * cima));
      // ponte: a parte de cima entra no rosto
      out.z -= rn * 0.55 * cima * cima;
      out.y += rn * 0.25 * cima;
      out.add(narizC);
    },
    uv: (u, v) => [u * 2, v],
    cor(_u, _v, q) {
      const ponta = Math.exp(-q.distanceToSquared(V(0, narizC.y - rn * 0.1, narizC.z + rn * 0.5)) / (rn * rn * 1.4));
      // a ponta do nariz é a parte mais rosada e deixa passar um pouco de luz
      return cor4(rosar(corPele, 0.55 + 0.6 * ponta), 0.35 + 0.3 * ponta);
    },
    pesos: () => [[O.CABECA, 1]],
  });
  // orelhas: pontudinhas, em concha, viradas um pouco para trás
  for (const sx of lado) {
    const c = orelhaC(sx);
    acc.pele.adicionar({
      nu: n(10, 8),
      nv: n(8, 5),
      ponto(u, v, out) {
        pontoElipsoide(u, v, out);
        const d = out.clone();
        // local: espessura em x, altura em y, largura em z
        let x = d.x * R * 0.16;
        let y = d.y * R * 0.32;
        let z = d.z * R * 0.22;
        const cima = Math.max(0, d.y);
        z *= 1 - 0.55 * cima;
        y += R * 0.08 * cima * cima;
        z -= R * 0.06 * cima * cima;
        // concha: o lado de fora afunda no meio
        if (d.x * sx > 0) x -= sx * R * 0.1 * Math.exp(-(d.y * d.y + d.z * d.z) / 0.35);
        out.set(c.x + x * sx * sx + sx * R * 0.04, c.y + y, c.z + z);
        // gira para trás
        const ang = 0.35;
        const rz = out.z - c.z;
        const rx = out.x - c.x;
        out.x = c.x + rx * Math.cos(ang) + sx * rz * Math.sin(ang) * 0.4;
        out.z = c.z + rz * Math.cos(ang) - Math.abs(rx) * Math.sin(ang) * 0.6;
      },
      cor: (_u, v) => cor4(rosar(corPele, 0.75 + 0.3 * v), 1),
      pesos: () => [[O.CABECA, 1]],
    });
  }
  // olhos: globo com a íris do atlas (projeção frontal)
  const quad = ap.iris;
  for (const sx of lado) {
    const c = olhoC(sx);
    const osso = sx > 0 ? O.OLHO_E : O.OLHO_D;
    acc.olhos.adicionar({
      nu: n(14, 10),
      nv: n(10, 8),
      ponto(u, v, out) {
        pontoElipsoide(u, v, out);
        out.multiplyScalar(olhoR).add(c);
      },
      uv(_u, _v, q) {
        let lx = (q.x - c.x) / olhoR;
        let ly = (q.y - c.y) / olhoR;
        if (q.z < c.z) {
          const l = Math.hypot(lx, ly) || 1;
          lx = (lx / l) * 0.99;
          ly = (ly / l) * 0.99;
        }
        const ox = (quad % 2) * 0.5;
        const oy = Math.floor(quad / 2) * 0.5;
        return [ox + (lx * 0.5 + 0.5) * 0.5, oy + (ly * 0.5 + 0.5) * 0.5];
      },
      pesos: () => [[osso, 1]],
    });
    // pálpebras: calotas de pele que encostam no globo; a de cima desce ao piscar
    const alfa = THREE.MathUtils.degToRad(80);
    const beta = THREE.MathUtils.degToRad(52);
    const corPalp = rosar(corPele, 0.3);
    const corCilio = misturarRgb(escalarRgb(corPele, 0.2), [0.018, 0.011, 0.009], 0.7);
    for (const cima of [true, false]) {
      const lim = cima ? alfa : beta;
      acc.pele.adicionar({
        nu: n(16, 10),
        nv: n(6, 4),
        ponto(u, v, out) {
          const th = u * Math.PI * 2;
          const ph = v * lim;
          const borda = suave(0.7, 1, v);
          // a de cima tem espessura (borda arredondada); a de baixo é fina e colada ao globo
          const rr = olhoR * (cima ? 1.12 - 0.09 * borda * borda : 1.05 - 0.035 * borda * borda);
          const sp = Math.sin(ph);
          const y = Math.cos(ph) * rr;
          out.set(Math.sin(th) * sp * rr, cima ? y : -y, Math.cos(th) * sp * rr).add(c);
        },
        cor(_u, v) {
          const k = suave(0.8, 0.97, v);
          return cor4(cima ? misturarRgb(corPalp, corCilio, 0.65 * k) : escalarRgb(rosar(corPele, 0.2), 1 + 0.06 * k));
        },
        pesos: () => [[cima ? (sx > 0 ? O.PALP_E : O.PALP_D) : sx > 0 ? O.PINF_E : O.PINF_D, 1]],
      });
    }
    // linha de cílios: um fio escuro na borda da pálpebra de cima, com o canto de fora virando para cima
    {
      const borda = (t: number, o: THREE.Vector3) => {
        const th = misturar(-1.75, 1.75, t);
        const fora = Math.max(0, -th * sx) / 1.75; // canto de fora (lado da orelha)
        const ph = alfa - 0.02 - 0.12 * fora * fora;
        const rr = olhoR * (1.035 + 0.06 * fora * fora);
        o.set(Math.sin(th) * Math.sin(ph) * rr, Math.cos(ph) * rr + olhoR * 0.1 * fora ** 3, Math.cos(th) * Math.sin(ph) * rr).add(c);
      };
      const tri = new Trilho(borda, 16, V(0, 1, 0));
      acc.pele.adicionar({
        nu: n(5, 4),
        nv: n(14, 8),
        ponto(u, v, out) {
          const P = _P;
          const T = _T;
          const N = _N;
          const Bn = _B;
          tri.em(v, P, T, N, Bn);
          const a = u * Math.PI * 2;
          const r = olhoR * 0.07 * (0.6 + 0.4 * Math.sin(Math.PI * v)) * tampa(v, 0.08, 0.08);
          out.copy(P).addScaledVector(N, Math.cos(a) * r).addScaledVector(Bn, Math.sin(a) * r * 0.6);
        },
        cor: () => cor4(corCilio),
        pesos: () => [[sx > 0 ? O.PALP_E : O.PALP_D, 1]],
      });
    }
  }
  // boca: sorriso entreaberto (fundo escuro com língua) e lábio de baixo; abre na alegria (osso BOCA).
  // Nos barbados aparece entre o bigode e a barba, como no Noel.
  {
    // nos barbados a boca fica por cima da barba (que nasce no rosto), logo abaixo do bigode
    const yBoca = H.y - R * (temBarbaCheia ? 0.6 : 0.58);
    const frenteBoca = temBarbaCheia ? R * 0.19 : ap.barba.forma === 'curta' ? R * 0.12 : 0;
    ossos[O.BOCA] = V(0, yBoca - R * 0.06, H.z + R * 0.8);
    const naCara = (x: number, y: number, extra: number, o: THREE.Vector3) => {
      const rel = (y - H.y) / R;
      const z = H.z + R * 0.95 * Math.sqrt(Math.max(0.03, 1 - (x / R) ** 2 - rel * rel)) + R * 0.06 * Math.max(0, -rel) + extra + frenteBoca * (1 - 0.6 * (x / R) ** 2);
      return o.set(x, y, z);
    };
    const largB = R * 0.26;
    // borda de cima (presa à cabeça) e de baixo (presa à boca), as duas sorrindo
    const cimaB = (x: number) => yBoca + R * 0.07 * (x / largB) ** 2;
    const baixoB = (x: number) => yBoca - R * 0.075 * (1 - (x / largB) ** 2) + R * 0.07 * (x / largB) ** 2;
    acc.pele.adicionar({
      nu: n(12, 6),
      nv: n(4, 3),
      fechadoU: false,
      orientar: 1,
      ponto(u, v, out) {
        const x = (u * 2 - 1) * largB;
        const y = misturar(cimaB(x), baixoB(x), v);
        naCara(x, y, R * (0.012 - 0.02 * Math.sin(Math.PI * v) * (1 - Math.abs(u * 2 - 1))), out);
      },
      cor(u, v) {
        const meio = 1 - Math.abs(u * 2 - 1);
        // fundo escuro em cima, língua rosada embaixo
        return cor4(misturarRgb(hex('#3a0f12'), hex('#b4545a'), suave(0.45, 0.95, v) * meio));
      },
      pesos: (_u, v) => [
        [O.CABECA, 1 - v],
        [O.BOCA, v],
      ],
    });
    // lábio de baixo
    const tri = new Trilho((t, o) => {
      const x = (t * 2 - 1) * largB * 1.02;
      naCara(x, baixoB(x) - R * 0.012, R * 0.012, o);
    }, 12, V(0, 0, 1));
    acc.pele.adicionar({
      nu: n(7, 5),
      nv: n(12, 6),
      ponto(u, v, out) {
        const P = _P;
        const T = _T;
        const N = _N;
        const Bn = _B;
        tri.em(v, P, T, N, Bn);
        const a = u * Math.PI * 2;
        const r = R * 0.05 * tampa(v, 0.3, 0.3);
        out.copy(P).addScaledVector(N, Math.cos(a) * r * 0.6).addScaledVector(Bn, Math.sin(a) * r);
      },
      cor: () => cor4(rosar(corPele, 1.4)),
      pesos: (_u, v) => [
        [O.BOCA, 0.4 + 0.6 * Math.sin(Math.PI * v)],
        [O.CABECA, 0.6 - 0.6 * Math.sin(Math.PI * v)],
      ],
    });
  }
  /* --------------------------------------------------------- sobrancelhas */
  {
    const corS = ap.sobrancelha;
    for (const sx of lado) {
      const osso = sx > 0 ? O.SOBR_E : O.SOBR_D;
      const c = olhoC(sx);
      ossos[osso] = V(c.x, c.y + R * 0.3, c.z + R * 0.1);
      // arco simpático: o meio mais alto, a ponta de dentro um pouco acima da de fora (nunca descendo
      // para o nariz, que lê como cara brava)
      const fios = ap.corpo === 'gnoma' ? 1 : 3;
      for (let k = 0; k < fios; k++) {
        const dy = (k - 1) * R * 0.035;
        const ini = V(sx * R * (0.1 + k * 0.03), c.y + R * 0.3 + dy, 0);
        const fim = V(sx * R * (0.66 + k * 0.03), c.y + R * (0.24 - k * 0.01) + dy, 0);
        const meio = V(sx * R * 0.38, c.y + R * 0.43 + dy, 0);
        const sobre = (o: THREE.Vector3) => {
          const zz = H.z + R * 0.95 * Math.sqrt(Math.max(0.02, 1 - (o.x / R) ** 2 - ((o.y - H.y) / R) ** 2));
          o.z = zz + R * 0.11;
          return o;
        };
        const curva = bezier(sobre(ini.clone()), sobre(meio.clone().lerp(ini, 0.3)), sobre(meio.clone().lerp(fim, 0.3)), sobre(fim.clone()));
        const trilho = new Trilho(curva, 10, V(0, 0, 1));
        const grossura = (ap.corpo === 'gnoma' ? 0.06 : 0.13 - k * 0.015) * R;
        acc.barba.adicionar({
          nu: n(6, 5),
          nv: n(6, 4),
          ponto(u, v, out) {
            const P = _P;
            const T = _T;
            const N = _N;
            const Bn = _B;
            trilho.em(v, P, T, N, Bn);
            const a = u * Math.PI * 2;
            const r = grossura * (1 - 0.55 * v ** 1.5) * tampa(v, 0.25, 0.3);
            out.copy(P).addScaledVector(N, Math.cos(a) * r * 0.7).addScaledVector(Bn, Math.sin(a) * r);
          },
          uv: (u, v) => [u, v * 0.5],
          cor: (_u, v) => cor4(escalarRgb(corS, 0.82 + 0.18 * v + k * 0.04)),
          pesos: () => [[osso, 1]],
        });
      }
    }
  }

  /* ----------------------------------------------------------------- barba */
  const temBarba = ap.barba.forma !== 'nenhuma';
  const corBarba = ap.barba.cor;
  const bigodeC = V(0, H.y - R * 0.38, H.z + R * 0.98);
  ossos[O.BIGODE] = bigodeC.clone();
  ossos[O.BARBA0] = V(0, H.y - R * 0.62, H.z + R * 0.7);
  if (temBarba) {
    const forma = ap.barba.forma;
    const curta = forma === 'curta';
    const comp = ap.barba.comprimento * (curta ? 0.15 : forma === 'trancada' ? 0.16 : 0.24) * (R / 0.135);
    const yRaizFrente = H.y - R * 0.5;
    const yFundo = yRaizFrente - comp;
    ossos[O.BARBA1] = V(0, misturar(yRaizFrente, yFundo, 0.55), 0);
    const largura0 = 1.5; // ângulo da raiz (até perto das orelhas)
    const largura1 = forma === 'larga' ? 1.0 : forma === 'bifurcada' ? 0.85 : curta ? 1.1 : 0.72;
    /** Altura do fim da mecha na posição s (-1..1), conforme o formato. */
    const fundo = (sx: number) => {
      const a = Math.abs(sx);
      if (forma === 'larga') return yFundo + comp * (0.12 * a ** 4 + 0.03 * Math.sin(sx * 9));
      if (forma === 'bifurcada') return yFundo + comp * (0.55 * (a - 0.42) ** 2 * 2.2 + 0.22 * sino(sx, 0.15));
      if (curta) return yFundo + comp * 0.3 * a * a;
      return yFundo + comp * 0.6 * a ** 1.6;
    };
    /** Raiz da barba: sobe para as costeletas e abre um vão no meio para a boca aparecer. */
    const raizY = (sx: number) => H.y - R * (0.5 + 0.16 * sino(sx, 0.27)) + R * 0.32 * Math.abs(sx) ** 1.8;
    /** Volume da barba sobre o peito (fina: ela pousa, não faz travesseiro). */
    const espessura = (t: number) => (curta ? 0.02 : 0.03) * (R / 0.135) * suave(-0.05, 0.3, t) * (1 - 0.45 * Math.min(1, t));
    /** Folha guia: posição da barba em (s, t), encostada no rosto e depois no peito. */
    const folha = (sx: number, t: number, extra: number, out: THREE.Vector3) => {
      const a0 = sx * largura0;
      const yr = raizY(sx);
      const y1 = fundo(sx);
      const tt = Math.min(1, t);
      const y = misturar(yr, y1, tt) - (t > 1 ? (t - 1) * comp : 0);
      const ang = misturar(a0, sx * largura1, suave(0, 0.75, tt));
      const rel = (yr - H.y) / R;
      const rCab = R * 0.97 * Math.sqrt(Math.max(0.05, 1 - rel * rel)) + R * 0.05;
      // a barba curta abraça o queixo e a mandíbula (segue a cabeça, não desce para o peito)
      const relY = limitar((y - H.y) / R, -0.97, 0.97);
      const rTr = curta ? R * 0.98 * Math.sqrt(1 - relY * relY) + R * 0.1 * Math.max(0, -relY) : raioTronco(y, ang);
      const rr = Math.max(misturar(rCab, rTr, suave(0, 0.45, tt)), rTr + 0.004) + espessura(t) * 0.2 + extra;
      const cz = curta ? H.z : misturar(H.z, inclinar(y), suave(0, 0.45, tt));
      return out.set(Math.sin(ang) * rr * 1.03, y, Math.cos(ang) * rr * 0.96 + cz);
    };
    const normalFolha = (sx: number, t: number, out: THREE.Vector3) => {
      const a = V();
      const b = V();
      folha(sx, t, 0, a);
      folha(sx, t, 0.01, b);
      return out.subVectors(b, a).normalize();
    };
    const pesosBarba = (q: THREE.Vector3): Pesos =>
      pesosAo(
        [
          [O.CABECA, -(yRaizFrente + R * 0.05)],
          [O.BARBA0, -(yRaizFrente - comp * 0.3)],
          [O.BARBA1, -(yRaizFrente - comp * 0.85)],
        ],
        -q.y,
      );
    // A barba é UM volume esculpido (como nos longas de animação): uma massa macia que nasce no rosto e
    // pousa no peito, com gomos largos (tufos) que se separam para a ponta, a barra recortada em
    // cachos redondos e sulcos finos de fio; a oclusão nos sulcos e na raiz vem da cor de vértice.
    const nLob = forma === 'larga' ? 7 : curta ? 7 : forma === 'bifurcada' ? 6 : 5;
    const faseL = s() * 6.28;
    const faseR = s() * 6.28;
    /** Tufo: 1 no meio de um gomo, 0 no vão entre dois. */
    const lobo = (sx: number, t: number) => 0.5 + 0.5 * Math.cos(Math.PI * sx * nLob + faseL * 0.15 + 0.45 * Math.sin(t * 2.6 + sx * 3 + faseL));
    /** Sulcos finos de fio (só na cor e um pouco no relevo). */
    const sulco = (sx: number, t: number) => 0.5 + 0.5 * Math.cos(Math.PI * sx * nLob * 3.2 + 1.4 * Math.sin(t * 4.5 + sx * 6 + faseR));
    const ponta = misturarRgb(corBarba, hex('#efe3c8'), 0.22);
    const thMax = (curta ? 0.03 : 0.04) * (R / 0.135);
    const nuB = n(68, 24);
    const nvB = n(18, 8);
    /** Ponto da barba: u em volta (frente: sx de -1 a 1; atrás: encostada no peito), v da raiz à barra. */
    const pontoBarba = (u: number, v: number, out: THREE.Vector3) => {
      const a = u * Math.PI * 2;
      const sx = Math.sin(a) * 0.985;
      const prof = Math.cos(a);
      const lb = lobo(sx, v);
      // os gomos descem mais que os vãos: a barra fica recortada em cachos redondos
      const t = v * (1 + (curta ? 0.16 : 0.12) * Math.pow(lb, 1.6) * suave(0.2, 0.9, v));
      const base = _K;
      folha(sx, t, 0, base);
      const nn = _N;
      normalFolha(sx, Math.min(1.1, t), nn);
      const separa = suave(0.15, 0.75, v);
      const th = thMax * suave(-0.05, 0.25, v) * (1 - 0.35 * v) * (0.72 + 0.42 * lb * separa + 0.28 * (1 - separa)) * (1 - 0.3 * sx * sx) * tampa(v, 0, 0.2);
      const frente = Math.max(0, prof) ** 0.55;
      const sulcoP = 1 - 0.1 * (1 - sulco(sx, v)) * separa;
      out.copy(base).addScaledVector(nn, prof > 0 ? th * frente * sulcoP : th * 0.12 * prof - 0.002);
      // os cachos da barra enrolam para dentro
      out.addScaledVector(nn, -0.01 * suave(0.82, 1, v) * lb);
    };
    acc.barba.adicionar({
      nu: nuB,
      nv: nvB,
      ponto: pontoBarba,
      uv(u, v) {
        const sx = Math.sin(u * Math.PI * 2);
        return [sx * 2.4 + 0.5, v * comp * 5];
      },
      cor(u, v) {
        const a = u * Math.PI * 2;
        const sx = Math.sin(a) * 0.985;
        const prof = Math.cos(a);
        const lb = lobo(sx, v);
        const sep = suave(0.15, 0.75, v);
        // oclusão: entre os gomos, nos sulcos, na raiz e atrás (contra o peito)
        const oc = (1 - 0.3 * (1 - lb) * sep) * (0.86 + 0.14 * sulco(sx, v)) * (0.72 + 0.28 * suave(0, 0.3, v)) * (prof > 0 ? 1 : 0.6);
        return cor4(escalarRgb(misturarRgb(corBarba, ponta, suave(0.65, 1, v) * lb), oc));
      },
      pesos: (_u, _v, q) => pesosBarba(q),
    });
    // barba trançada: uma trança no meio com argola de latão
    if (forma === 'trancada') {
      const ini = V();
      folha(0, 0.45, 0, ini);
      const nn = V();
      normalFolha(0, 0.45, nn);
      ini.addScaledVector(nn, espessura(0.45) * 0.6);
      const fim = V();
      folha(0, 1.35, 0, fim);
      normalFolha(0, 1.0, nn);
      fim.addScaledVector(nn, 0.03);
      const trilho = new Trilho((t, o) => o.lerpVectors(ini, fim, t).addScaledVector(nn, Math.sin(Math.PI * t) * 0.012), 16, nn);
      acc.barba.adicionar({
        nu: n(10, 6),
        nv: n(36, 12),
        ponto(u, v, out) {
          const P = _P;
          const T = _T;
          const N = _N;
          const Bn = _B;
          trilho.em(v, P, T, N, Bn);
          const a = u * Math.PI * 2;
          const gomo = Math.abs(Math.sin(v * Math.PI * 7));
          const r = 0.022 * (R / 0.135) * (0.72 + 0.32 * gomo) * (1 - 0.35 * v) * tampa(v, 0.05, 0.12);
          const zig = Math.sin(v * Math.PI * 7) * 0.004;
          out.copy(P).addScaledVector(Bn, zig).addScaledVector(N, Math.cos(a) * r * 0.8).addScaledVector(Bn, Math.sin(a) * r);
        },
        uv: (u, v) => [u, v * 3],
        cor: (_u, v) => cor4(escalarRgb(corBarba, 0.85 + 0.15 * Math.abs(Math.sin(v * Math.PI * 7)))),
        pesos: (_u, _v, q) => pesosBarba(q),
      });
      // argola
      const anel = new THREE.TorusGeometry(0.017 * (R / 0.135), 0.005, 6, n(14, 8));
      const pos = V().lerpVectors(ini, fim, 0.8);
      const m = new THREE.Matrix4().makeRotationX(Math.PI / 2).setPosition(pos);
      acc.metal.adicionarGeometria(anel, m, cor4(hex('#E8BC65')), pesosBarba(pos));
      anel.dispose();
    }
    // bigode: mechas grossas saindo de baixo do nariz
    if (ap.barba.bigode !== 'nenhum') {
      const tipo = ap.barba.bigode;
      for (const sx of lado)
        for (let k = 0; k < 3; k++) {
          const raiz = V(sx * R * (0.05 + k * 0.03), bigodeC.y + R * 0.03 - k * R * 0.05, 0);
          let meio: THREE.Vector3;
          let fim: THREE.Vector3;
          if (tipo === 'guidao') {
            meio = V(sx * R * 0.45, bigodeC.y - R * 0.16, 0);
            fim = V(sx * R * (0.78 - k * 0.1), bigodeC.y + R * (0.06 - k * 0.08), 0);
          } else if (tipo === 'morsa') {
            meio = V(sx * R * 0.36, bigodeC.y - R * 0.22, 0);
            fim = V(sx * R * (0.55 - k * 0.08), bigodeC.y - R * (0.58 - k * 0.1), 0);
          } else {
            meio = V(sx * R * 0.38, bigodeC.y - R * 0.12, 0);
            fim = V(sx * R * (0.62 - k * 0.08), bigodeC.y - R * (0.32 - k * 0.06), 0);
          }
          const frente = (o: THREE.Vector3, extra: number) => {
            const rel = (o.y - H.y) / R;
            o.z = H.z + R * 0.97 * Math.sqrt(Math.max(0.05, 1 - (o.x / R) ** 2 - rel * rel)) + extra;
            return o;
          };
          const p0 = frente(raiz.clone(), R * 0.2);
          const p3 = frente(fim.clone(), R * 0.2 - k * R * 0.03);
          const p1 = frente(raiz.clone().lerp(meio, 0.6), R * 0.3);
          const p2 = frente(meio.clone().lerp(fim, 0.5), R * 0.27);
          if (tipo === 'guidao') p2.y -= R * 0.06;
          const trilho = new Trilho(bezier(p0, p1, p2, p3), 12, V(0, 0, 1));
          const grosso = R * (tipo === 'cheio' ? 0.25 : tipo === 'morsa' ? 0.24 : 0.2) * [1, 0.8, 0.62][k];
          acc.barba.adicionar({
            nu: n(7, 6),
            nv: n(9, 5),
            ponto(u, v, out) {
              const P = _P;
              const T = _T;
              const N = _N;
              const Bn = _B;
              trilho.em(v, P, T, N, Bn);
              const a = u * Math.PI * 2;
              const w = grosso * (1 - 0.6 * v ** 1.6) * tampa(v, 0.22, 0.2) * (1 + 0.15 * Math.sin(Math.PI * v));
              out.copy(P).addScaledVector(N, Math.cos(a) * w * 0.6).addScaledVector(Bn, Math.sin(a) * w * 0.72);
            },
            uv: (u, v) => [u * 0.6 + k * 0.3, v * 0.8],
            cor: (_u, v) => cor4(escalarRgb(corBarba, (1.0 + 0.1 * v) * [1.06, 0.95, 0.88][k])),
            pesos: () => [[O.BIGODE, 1]],
          });
        }
    }
  } else {
    ossos[O.BARBA1] = V(0, H.y - R * 1.2, H.z + R * 0.5);
  }

  /* ------------------------------------------------------------- tranças */
  ossos[O.TRANCA_E] = V(R * 0.8, H.y - R * 0.35, H.z - R * 0.2);
  ossos[O.TRANCA_D] = V(-R * 0.8, H.y - R * 0.35, H.z - R * 0.2);
  if (ap.cabelo.trancas) {
    const corC = ap.cabelo.cor;
    for (const sx of lado) {
      const osso = sx > 0 ? O.TRANCA_E : O.TRANCA_D;
      const p0 = V(sx * R * 0.82, H.y + R * 0.05, H.z - R * 0.32);
      const p1 = V(sx * R * 1.08, H.y - R * 0.45, H.z - R * 0.1);
      const p2 = V(sx * (rOmbro + 0.02), p.ombroY + 0.04, inclinar(p.ombroY) + 0.05);
      const fimY = p.ombroY - 0.13;
      const p3 = V(sx * (raioTronco(fimY, 0.9) * 0.9), fimY, raioTronco(fimY, 0.9) * 0.62 + 0.03);
      const trilho = new Trilho(bezier(p0, p1, p2, p3), 20, V(sx, 0, 0));
      acc.barba.adicionar({
        nu: n(10, 6),
        nv: n(40, 14),
        ponto(u, v, out) {
          const P = _P;
          const T = _T;
          const N = _N;
          const Bn = _B;
          trilho.em(v, P, T, N, Bn);
          const a = u * Math.PI * 2;
          const gomo = Math.abs(Math.sin(v * Math.PI * 9));
          const r = 0.024 * (0.7 + 0.35 * gomo) * (1 - 0.3 * v) * tampa(v, 0.06, 0.05);
          const zig = Math.sin(v * Math.PI * 9) * 0.005;
          out.copy(P).addScaledVector(Bn, zig).addScaledVector(N, Math.cos(a) * r).addScaledVector(Bn, Math.sin(a) * r * 0.9);
        },
        uv: (u, v) => [u, v * 4],
        cor: (_u, v) => cor4(escalarRgb(corC, 0.8 + 0.2 * Math.abs(Math.sin(v * Math.PI * 9)))),
        pesos: (_u, v) => pesosAo(
          [
            [O.CABECA, 0.2],
            [osso, 0.55],
          ],
          v,
        ),
      });
      // pincel da ponta e laço de feltro
      const ponta = V();
      const T = V();
      const N = V();
      const Bn = V();
      trilho.em(1, ponta, T, N, Bn);
      const trilho2 = new Trilho((t, o) => o.copy(ponta).addScaledVector(T, t * 0.05).addScaledVector(N, t * t * 0.01), 6, N);
      acc.barba.adicionar({
        nu: n(8, 5),
        nv: n(6, 3),
        ponto(u, v, out) {
          const P = _P;
          const T2 = _T;
          const N2 = _N;
          const B2 = _B;
          trilho2.em(v, P, T2, N2, B2);
          const a = u * Math.PI * 2;
          const r = 0.02 * Math.sin(Math.PI * (0.25 + 0.75 * v)) * (1 + 0.25 * Math.sin(a * 5));
          out.copy(P).addScaledVector(N2, Math.cos(a) * r).addScaledVector(B2, Math.sin(a) * r);
        },
        uv: (u, v) => [u, v],
        cor: () => cor4(escalarRgb(corC, 0.95)),
        pesos: () => [[osso, 1]],
      });
      const corLaco = ap.gorro.cor[0] > 0.3 && ap.gorro.cor[1] < 0.1 ? hex('#174D3B') : hex('#B62835');
      for (const lb of [-1, 1]) {
        const c = ponta.clone().addScaledVector(Bn, lb * 0.018).addScaledVector(T, -0.006);
        const g = new THREE.SphereGeometry(1, n(10, 6), n(8, 4));
        const m = new THREE.Matrix4().compose(c, new THREE.Quaternion().setFromUnitVectors(V(1, 0, 0), Bn.clone().multiplyScalar(lb)), V(0.017, 0.011, 0.007));
        acc.feltro.adicionarGeometria(g, m, cor4(corLaco), [[osso, 1]]);
        g.dispose();
      }
    }
    // franja curtinha saindo de baixo do gorro
    if (ap.cabelo.franja) {
      for (let k = 0; k < 4; k++) {
        const x = (k - 1.5) * R * 0.22;
        const ini = V(x, H.y + R * 0.42, 0);
        const fim = V(x * 1.15 + R * 0.05, H.y + R * 0.27, 0);
        const sobre = (o: THREE.Vector3, ex: number) => {
          const rel = (o.y - H.y) / R;
          o.z = H.z + R * 0.95 * Math.sqrt(Math.max(0.05, 1 - (o.x / R) ** 2 - rel * rel)) + ex;
          return o;
        };
        const tri = new Trilho((t, o) => sobre(o.lerpVectors(ini, fim, t), R * (0.03 + 0.04 * Math.sin(Math.PI * t))), 6, V(0, 0, 1));
        acc.barba.adicionar({
          nu: n(7, 5),
          nv: n(6, 3),
          ponto(u, v, out) {
            const P = _P;
            const T = _T;
            const N = _N;
            const Bn = _B;
            tri.em(v, P, T, N, Bn);
            const a = u * Math.PI * 2;
            const w = R * 0.16 * (1 - v ** 1.5);
            out.copy(P).addScaledVector(N, Math.cos(a) * w * 0.25).addScaledVector(Bn, Math.sin(a) * w * 0.5);
          },
          uv: (u, v) => [u * 0.5, v * 0.3],
          cor: () => cor4(ap.cabelo.cor),
          pesos: () => [[O.CABECA, 1]],
        });
      }
    }
  }

  /* ------------------------------------------------------------------ gorro */
  // O gorro ENGOLE a cabeça: o plano da aba é inclinado, na frente logo acima das sobrancelhas e atrás
  // na nuca. O pano sobe da aba com um bojo (cai por cima da aba, como lã mole) e afina até a ponta,
  // que dobra para um lado. Seis ossos ao longo dele (G0 na aba, G1 a G5 no pano) deixam a mola dobrar
  // o gorro em vários pontos.
  // metade da inclinação desfeita no alto (o gorro não deita para trás inteiro)
  const rotAlto = new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), -inclinaGorro * 0.45);
  const rb = R * 1.05;
  const L = g.comprimento * (R / 0.135);
  const sd = g.lado;
  const ctrl: Record<string, THREE.Vector3[]> = {
    mole: [V(0, 0, 0), V(0, 0.42 * L, 0), V(sd * 0.12 * L, 0.9 * L, -0.02 * L), V(sd * 0.52 * L, 0.74 * L, 0.04 * L)],
    pontudo: [V(0, 0, 0), V(0, 0.46 * L, 0), V(sd * 0.15 * L, 0.72 * L, -0.03 * L), V(sd * 0.02 * L, 1.0 * L, -0.1 * L)],
    caido: [V(0, 0, 0), V(0, 0.48 * L, -0.02 * L), V(sd * 0.18 * L, 0.9 * L, -0.18 * L), V(sd * 0.5 * L, 0.55 * L, -0.3 * L)],
    touca: [V(0, 0, 0), V(0, 0.5 * L, 0), V(sd * 0.1 * L, 0.84 * L, -0.06 * L), V(sd * 0.24 * L, 0.92 * L, -0.12 * L)],
  };
  const cg = ctrl[g.forma].map((q, i) => q.clone().applyQuaternion(i < 2 ? rotG : rotAlto).add(baseG));
  const curvaG = bezier(cg[0], cg[1], cg[2], cg[3]);
  const trilhoG = new Trilho(curvaG, 48, V(0, 0, 1).applyQuaternion(rotG));
  // ossos do gorro ao longo da curva
  const tOssos = [0, 0.15, 0.35, 0.55, 0.72, 0.88];
  const ossosG = [O.G0, O.G1, O.G2, O.G3, O.G4, O.G5];
  ossosG.forEach((o, i) => {
    const q = V();
    curvaG(tOssos[i], q);
    ossos[o] = q;
  });
  const pesosG = (t: number): Pesos =>
    pesosAo(
      [
        [O.G0, 0.1],
        [O.G1, 0.2],
        [O.G1, 0.3],
        [O.G2, 0.4],
        [O.G2, 0.5],
        [O.G3, 0.6],
        [O.G3, 0.68],
        [O.G4, 0.76],
        [O.G4, 0.84],
        [O.G5, 0.92],
      ],
      t,
    );
  const curvaturaG = (t: number, out = V()) => {
    const a = Math.max(0, Math.min(trilhoG.tangentes.length - 1, Math.round(t * (trilhoG.tangentes.length - 1))));
    const b = Math.min(trilhoG.tangentes.length - 1, a + 2);
    const c = Math.max(0, a - 2);
    return out.subVectors(trilhoG.tangentes[b], trilhoG.tangentes[c]);
  };
  const arcoEmT = (t: number) => {
    const f = limitar(t, 0, 1) * (trilhoG.comprimentos.length - 1);
    const i = Math.min(trilhoG.comprimentos.length - 2, Math.floor(f));
    return misturar(trilhoG.comprimentos[i], trilhoG.comprimentos[i + 1], f - i);
  };
  const tEmArco = (a: number) => {
    const cs = trilhoG.comprimentos;
    for (let i = 0; i < cs.length - 1; i++) if (a <= cs[i + 1]) return (i + (a - cs[i]) / Math.max(1e-6, cs[i + 1] - cs[i])) / (cs.length - 1);
    return 1;
  };
  // bojo logo acima da aba: o pano sobra e cai por cima dela (medido em metros, vale para todo comprimento)
  const raioG = (t: number) => {
    const arco = arcoEmT(t);
    const bojo = 1 + (touca ? 0.1 : 0.17) * suave(0, 0.025, arco) * (1 - suave(0.05, touca ? 0.16 : 0.2, arco));
    const afina = touca ? Math.sqrt(Math.max(0, 1 - t ** 2.4)) : (1 - t) ** 0.92;
    return Math.max(rb * bojo * afina, 0.006 * (1 - t)) * tampa(t, 0, touca ? 0 : 0.03);
  };
  const feltroG = g.padrao === 'feltro';
  const accG = feltroG ? acc.feltro : acc.trico;
  const voltasG = Math.max(2, Math.round((2 * Math.PI * rb) / TRICO_W));
  const listras = g.padrao === 'listras';
  const jacq = g.padrao === 'jacquard';
  const largListra = touca ? 0.045 : 0.06;
  // amostras ao longo do gorro (com costuras de cor nas listras e no jacquard)
  const nvG = n(touca ? 20 : 34, 12);
  const vsG: number[] = [];
  for (let j = 0; j <= nvG; j++) vsG.push(j / nvG);
  const jacq0 = 0.04;
  const jacq1 = jacq0 + TRICO_H * 0.62;
  if (listras) for (let a = 0.03 + largListra; a < trilhoG.total * 0.9; a += largListra) vsG.push(tEmArco(a), tEmArco(a));
  if (jacq) vsG.push(tEmArco(jacq0), tEmArco(jacq0), tEmArco(jacq1), tEmArco(jacq1));
  vsG.sort((a, b) => a - b);
  const fase1 = s() * 6.28;
  const fase2 = s() * 6.28;
  const fase3 = s() * 6.28;
  const maxCurv = Math.max(...[0.2, 0.4, 0.6, 0.8].map((t) => curvaturaG(t).length())) + 1e-6;
  accG.adicionar({
    nu: n(26, 12),
    nv: nvG,
    vs: vsG,
    ponto(u, v, out) {
      const P = _P;
      const T = _T;
      const N = _N;
      const Bn = _B;
      trilhoG.em(v, P, T, N, Bn);
      const a = u * Math.PI * 2;
      const dir = _D.set(0, 0, 0).addScaledVector(N, Math.cos(a)).addScaledVector(Bn, Math.sin(a));
      let r = raioG(v);
      // dobras compridas e frouxas do pano mole (mais fortes no meio do gorro)
      const meio = Math.sin(Math.PI * Math.min(1, v * 1.15));
      r *= 1 + 0.085 * Math.sin(3 * a + fase1 + v * 3.2) * meio + 0.04 * Math.sin(5 * a + fase2 + v * 6) * suave(0.08, 0.45, v) + 0.03 * fbm3(Math.cos(a) * 2, v * 5, Math.sin(a) * 2, 2, fase3);
      // rugas de compressão do lado de dentro da curva
      const k = curvaturaG(v, _K);
      const kl = k.length() / maxCurv;
      if (kl > 0.1) {
        const dentro = Math.max(0, dir.dot(k.normalize()));
        const arco = arcoEmT(v);
        r *= 1 - 0.17 * kl * dentro * dentro * (0.5 + 0.5 * Math.sin((arco / 0.028) * Math.PI * 2 + Math.sin(a * 3) * 0.8));
      }
      out.copy(P).addScaledVector(dir, r);
    },
    uv(u, v) {
      const arco = arcoEmT(v);
      const vv = jacq && arco >= jacq0 && arco <= jacq1 ? MOTIVO_V0 + (arco - jacq0) / TRICO_H : arco / TRICO_H;
      return feltroG ? [u * 6, arco * 6] : [u * voltasG, vv];
    },
    cor(_u, v) {
      const arco = arcoEmT(Math.min(1, Math.max(0, v)));
      let c = g.cor;
      let alfa = 0;
      if (listras && arco > 0.03 && Math.floor((arco - 0.03) / largListra) % 2 === 1) c = g.cor2;
      if (jacq && arco > jacq0 && arco < jacq1) alfa = 1;
      // sombra suave logo acima da aba (o pano dobra por cima)
      const k = 0.8 + 0.2 * suave(0, 0.07, arco);
      return cor4(escalarRgb(c, k), alfa);
    },
    pesos: (_u, v) => pesosG(v),
  });
  // aba enrolada que acompanha o crânio (ou dobrada larga, na touca), irregular na altura e na grossura
  {
    const altA = touca ? R * 0.5 : feltroG ? R * 0.2 : R * 0.3;
    const espA = touca ? R * 0.1 : feltroG ? R * 0.07 : R * 0.13;
    const corA = touca && !listras ? g.cor2 : g.cor;
    const up = V(0, 1, 0).applyQuaternion(rotG);
    const fx = V(1, 0, 0).applyQuaternion(rotG);
    const fz = V(0, 0, 1).applyQuaternion(rotG);
    const ondaA = s() * 50;
    const vsA: number[] = [];
    const nvA = n(8, 5);
    for (let j = 0; j <= nvA; j++) vsA.push(j / nvA);
    accG.adicionar({
      nu: n(30, 12),
      nv: nvA,
      vs: vsA,
      ponto(u, v, out) {
        const a = u * Math.PI * 2;
        const f = v * Math.PI * 2;
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        const irreg = fbm3(ca * 1.6 + ondaA, sa * 1.6, 0, 2, 3);
        const grossa = espA * (1 + 0.22 * fbm3(ca * 2.2, sa * 2.2, ondaA, 2, 4));
        // um pouco mais larga nos lados (cobre o alto das orelhas)
        const rx = rb * 1.02 + grossa * 0.5 + grossa * 0.55 * Math.cos(f);
        const rz = rb * 0.99 + grossa * 0.5 + grossa * 0.55 * Math.cos(f);
        const yy = (touca ? altA * 0.35 : altA * 0.1) + Math.sin(f) * altA * 0.5 + R * 0.045 * irreg;
        out.copy(baseG).addScaledVector(fx, sa * rx).addScaledVector(fz, ca * rz).addScaledVector(up, yy);
      },
      uv: (u, v) => (feltroG ? [u * 4, v * 0.25] : [u * voltasG * 2.2, 12.5 / TRICO_CARREIRAS + v * 0.25]),
      cor: (_u, v) => cor4(escalarRgb(corA, 0.84 + 0.14 * Math.sin(Math.PI * v))),
      pesos: () => [[O.G0, 1]],
    });
  }
  // cabelo saindo de baixo da aba: um volume macio que vai de uma costeleta à outra por trás, com a
  // barra recortada em cachos (como a barba) e a ponta virando para fora por cima da gola
  {
    const corCab = ap.cabelo.cor;
    const pontaCab = misturarRgb(corCab, hex('#efe3c8'), 0.2);
    const nLobC = 7;
    const faseC = s() * 6.28;
    const loboC = (x: number) => 0.5 + 0.5 * Math.cos(Math.PI * x * nLobC + faseC);
    const compC = R * (ap.cabelo.trancas ? 0.32 : 0.56);
    const thC = R * 0.2;
    /** Ponto da cabeça na altura y e no ângulo a (a = 0 é a frente), empurrado `fora` metros. */
    const naCabeca = (a: number, y: number, fora: number, o: THREE.Vector3) => {
      const rel = limitar((y - H.y) / R, -0.92, 0.95);
      const rh = Math.max(R * 0.97 * Math.sqrt(1 - rel * rel), R * 0.42) + fora;
      const nuca = Math.cos(a) < 0 ? 1 - 0.05 * -Math.cos(a) : 1;
      return o.set(H.x + Math.sin(a) * rh, y, H.z + Math.cos(a) * rh * 0.95 * nuca);
    };
    /** Altura da aba no ângulo a (o plano inclinado do gorro). */
    const alturaAba = (a: number) => {
      const z = H.z + Math.cos(a) * R;
      // ponto do plano: baseG + direção na frente; y varia linearmente com z
      return baseG.y + (z - baseG.z) * Math.tan(inclinaGorro);
    };
    acc.barba.adicionar({
      nu: n(14, 8),
      nv: n(26, 10),
      ponto(u, v, out) {
        // v ao longo da faixa (de uma costeleta à outra); u em volta da seção (fora/dentro, cima/baixo)
        const x = v * 2 - 1;
        const a = Math.PI + x * Math.PI * 0.6;
        const c = u * Math.PI * 2;
        const lb = loboC(x);
        const costeleta = suave(0.6, 0.95, Math.abs(x));
        const comp = compC * (0.75 + 0.35 * lb) * (1 - 0.25 * costeleta);
        const yTopo = alturaAba(a) + R * 0.02;
        // seção: de cima (presa sob a aba) até a barra; t = 0 em cima, 1 embaixo
        const t = 0.5 - 0.5 * Math.cos(c);
        const lado = Math.sin(c); // > 0 fora, < 0 junto à cabeça
        const y = yTopo - comp * t;
        const vira = suave(0.3, 1, t) * R * 0.24;
        const grossura = thC * Math.sin(Math.PI * Math.min(1, t * 1.05)) ** 0.7 * (0.8 + 0.3 * lb) * tampa(v, 0.08, 0.08);
        naCabeca(a, y, Math.max(0, lado) * grossura + vira - 0.003, out);
      },
      uv: (u, v) => [v * 6, u * 0.6],
      cor(u, v) {
        const x = v * 2 - 1;
        const t = 0.5 - 0.5 * Math.cos(u * Math.PI * 2);
        const lb = loboC(x);
        const oc = (0.62 + 0.38 * suave(0, 0.35, t)) * (0.82 + 0.18 * lb) * (Math.sin(u * Math.PI * 2) > 0 ? 1 : 0.7);
        return cor4(escalarRgb(misturarRgb(corCab, pontaCab, suave(0.6, 1, t)), oc));
      },
      pesos: () => [[O.CABECA, 1]],
    });
  }
  // ponta: pompom de lã, sino de latão ou nada
  const pontaG = V();
  curvaG(1, pontaG);
  const tanG = trilhoG.tangentes[trilhoG.tangentes.length - 1].clone();
  if (g.ponta === 'pompom') {
    const rp = (touca ? 0.06 : 0.045) * (R / 0.135);
    const c = pontaG.clone().addScaledVector(tanG, rp * 0.45);
    const sp = s() * 50;
    acc.barba.adicionar({
      nu: n(14, 10),
      nv: n(10, 8),
      ponto(u, v, out) {
        pontoElipsoide(u, v, out);
        const d = out.clone();
        const tufo = 0.2 * fbm3(d.x * 3 + sp, d.y * 3, d.z * 3, 3, 5) + 0.14 * Math.abs(ruido3(d.x * 9 + sp, d.y * 9, d.z * 9, 6));
        out.copy(c).addScaledVector(d, rp * (1 + tufo));
      },
      uv: (u, v) => [u * 3, v * 1.5],
      cor: (_u, _v, q) => cor4(escalarRgb(g.corPonta, 0.85 + 0.15 * Math.min(1, q.distanceTo(c) / rp))),
      pesos: () => [[O.G5, 1]],
    });
  } else if (g.ponta === 'sino') {
    const sinoG = new THREE.LatheGeometry(
      [V(0.0, 0.03), V(0.006, 0.03), V(0.01, 0.025), V(0.013, 0.012), V(0.02, 0.0), V(0.021, -0.003), V(0.0, -0.002)].map((q) => new THREE.Vector2(q.x, q.y)),
      n(16, 8),
    );
    const baixo = V(0, -1, 0);
    const c = pontaG.clone().addScaledVector(tanG, 0.004).addScaledVector(baixo, 0.03);
    const m = new THREE.Matrix4().compose(c, new THREE.Quaternion(), V(1, 1, 1).multiplyScalar(R / 0.135));
    acc.metal.adicionarGeometria(sinoG, m, cor4(hex('#E8BC65')), [[O.G5, 1]]);
    sinoG.dispose();
    const badalo = new THREE.SphereGeometry(0.007, 8, 6);
    acc.metal.adicionarGeometria(badalo, new THREE.Matrix4().setPosition(c.clone().add(V(0, -0.004, 0))), cor4(hex('#8c6a3a')), [[O.G5, 1]]);
    badalo.dispose();
  }
  // raminho de azevinho de feltro preso do lado do gorro
  if (g.raminho) {
    const ang = -sd * 0.75;
    const up = V(0, 1, 0).applyQuaternion(rotG);
    const fx = V(1, 0, 0).applyQuaternion(rotG);
    const fz = V(0, 0, 1).applyQuaternion(rotG);
    const radial = V().addScaledVector(fx, Math.sin(ang)).addScaledVector(fz, Math.cos(ang)).normalize();
    const alturaR = touca ? R * 0.55 : R * 0.42;
    const c = baseG.clone().addScaledVector(up, alturaR).addScaledVector(radial, raioG(0.1) + 0.012);
    const tang = V().crossVectors(up, radial).normalize();
    const verde = hex('#1f5a35');
    for (let f = 0; f < 3; f++) {
      const aa = (f - 1) * 0.95 + 0.35;
      const dir = V().addScaledVector(up, Math.cos(aa)).addScaledVector(tang, Math.sin(aa)).normalize();
      const lat = V().crossVectors(radial, dir).normalize();
      acc.feltro.adicionar({
        nu: n(8, 4),
        nv: n(10, 5),
        fechadoU: false,
        duplaFace: true,
        ponto(u, v, out) {
          const x = u * 2 - 1;
          const w = 0.016 * Math.sin(Math.PI * v) ** 0.8 * (1 + 0.3 * Math.max(0, Math.sin(v * Math.PI * 5)));
          out.copy(c)
            .addScaledVector(dir, v * 0.048)
            .addScaledVector(lat, x * w)
            .addScaledVector(radial, 0.006 * Math.sin(Math.PI * v) - 0.006 * x * x + 0.004);
        },
        uv: (u, v) => [u * 0.2, v * 0.3],
        cor: (u) => cor4(escalarRgb(verde, 0.85 + 0.25 * Math.abs(u * 2 - 1))),
        pesos: () => [[O.G0, 1]],
        orientar: 1,
      });
    }
    for (let b = 0; b < 3; b++) {
      const bola = new THREE.SphereGeometry(0.0095, n(10, 6), n(8, 4));
      const pos = c.clone().addScaledVector(radial, 0.012).addScaledVector(tang, (b - 1) * 0.012).addScaledVector(up, (b % 2) * 0.01 - 0.003);
      acc.feltro.adicionarGeometria(bola, new THREE.Matrix4().setPosition(pos), cor4(hex('#a3121f')), [[O.G0, 1]]);
      bola.dispose();
    }
  }

  /* ------------------------------------------------------------ acessórios */
  // cinto de couro com fivela de latão
  if (ap.roupa.cinto) {
    const yC = p.barrigaY + 0.035;
    const corCinto = escalarRgb(hex('#7a4a30'), 1.3);
    acc.couro.adicionar({
      nu: n(44, 14),
      nv: n(5, 3),
      ponto(u, v, out) {
        const a = u * Math.PI * 2;
        const f = v * Math.PI * 2;
        const y = yC + Math.sin(f) * 0.019;
        const r = raioTronco(y, a) + (ap.roupa.colete ? 0.019 : 0.004) + Math.max(0, Math.cos(f)) * 0.006;
        out.set(Math.sin(a) * r * 1.04, y, Math.cos(a) * r * 0.94 + inclinar(y));
      },
      uv: (u, v) => [u * 6, v * 0.15],
      cor: () => cor4(corCinto),
      pesos: () => [[O.BARRIGA, 1]],
    });
    const f = new THREE.TorusGeometry(0.024, 0.0055, 6, 4);
    const posF = V(0, yC, (raioTronco(yC, 0) + (ap.roupa.colete ? 0.015 : 0)) * 0.94 + 0.012 + inclinar(yC));
    const m = new THREE.Matrix4().compose(posF, new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), Math.PI / 4), V(1.15, 0.85, 1));
    acc.metal.adicionarGeometria(f, m, cor4(hex('#E8BC65')), [[O.BARRIGA, 1]]);
    f.dispose();
  }
  // colete de feltro aberto na frente: UV pelo comprimento do arco (o feltro não estica), cava recuada
  // e debrum de cor em volta da abertura e da barra (a borda tem espessura)
  if (ap.roupa.colete) {
    const corC = ap.roupa.colete;
    const corDebrum = misturarRgb(ap.roupa.barra, hex('#E8BC65'), 0.25);
    const y0 = p.barra + 0.05;
    const y1 = p.ombroY + 0.02;
    const abre = 0.42;
    const vao = Math.PI * 2 - 2 * abre;
    const pontoColete = (u: number, v: number, extra: number, out: THREE.Vector3) => {
      const a = abre + u * vao;
      const y = y0 + (y1 - y0) * v;
      const cava = suave(0.6, 1, v) * sino(Math.abs(Math.sin(a)) - 1, 0.35);
      const ex = 0.012 + 0.003 * Math.sin(a * 5 + v * 3) - cava * 0.02 + extra;
      return pontoTronco(y, a, ex, out);
    };
    acc.feltro.adicionar({
      nu: n(26, 10),
      nv: n(10, 5),
      fechadoU: false,
      duplaFace: true,
      orientar: 1,
      ponto: (u, v, out) => void pontoColete(u, v, 0, out),
      uv(u, v) {
        const y = y0 + (y1 - y0) * v;
        return [(u * vao * raioY(y)) / 0.09, y / 0.09];
      },
      cor: (u, v) => cor4(escalarRgb(corC, (0.86 + 0.14 * Math.sin(Math.PI * u)) * (0.85 + 0.15 * suave(0, 0.2, v)))),
      pesos: (_u, v) => pesosAo(
        [
          [O.BARRIGA, 0.35],
          [O.PEITO, 0.85],
        ],
        v,
      ),
    });
    // debrum: um rolinho de feltro na frente (dos dois lados) e na barra
    const debruns: Array<(t: number, o: THREE.Vector3) => void> = [
      (t, o) => void pontoColete(0.004, t, 0.003, o),
      (t, o) => void pontoColete(0.996, t, 0.003, o),
      (t, o) => void pontoColete(t, 0.004, 0.003, o),
    ];
    for (const caminho of debruns) {
      const tri = new Trilho(caminho, 24, V(0, 0, 1));
      acc.feltro.adicionar({
        nu: 5,
        nv: n(24, 10),
        ponto(u, v, out) {
          const P = _P;
          const T = _T;
          const N = _N;
          const Bn = _B;
          tri.em(v, P, T, N, Bn);
          const a = u * Math.PI * 2;
          out.copy(P).addScaledVector(N, Math.cos(a) * 0.0055).addScaledVector(Bn, Math.sin(a) * 0.0055);
        },
        uv: (u, v) => [u * 0.3, v * 4],
        cor: () => cor4(corDebrum),
        pesos: (_u, _v, q) => pesosAo(
          [
            [O.BARRIGA, p.barrigaY + 0.05],
            [O.PEITO, p.ombroY - 0.02],
          ],
          q.y,
        ),
      });
    }
    if (ap.roupa.botoes)
      for (let b = 0; b < 3; b++) {
        const y = misturar(y0 + 0.04, p.barrigaY + 0.08, b / 2);
        const pos = V();
        pontoTronco(y, abre + 0.06, 0.017, pos);
        const bot = new THREE.SphereGeometry(0.009, 8, 6);
        acc.metal.adicionarGeometria(bot, new THREE.Matrix4().compose(pos, new THREE.Quaternion(), V(1, 1, 0.5)), cor4(hex('#d9b060')), [[O.BARRIGA, 1]]);
        bot.dispose();
      }
  }
  // avental de lona crua: uma placa fina que pousa na barriga e cai reta embaixo dela, com ondas na
  // barra, pesponto na borda e bolso
  if (ap.roupa.avental) {
    const y0 = p.barra + 0.02;
    const y1 = p.barrigaY + 0.07;
    const tomA = hex('#c9ab82');
    const costura = hex('#4a3020');
    const larg = 0.55; // meia abertura em radianos
    const zMax = raioTronco(p.barrigaY, 0) * 0.94 + inclinar(p.barrigaY);
    acc.feltro.adicionar({
      nu: n(16, 8),
      nv: n(12, 6),
      fechadoU: false,
      duplaFace: true,
      orientar: 1,
      ponto(u, v, out) {
        const x = u * 2 - 1;
        const y = y1 + (y0 - y1) * v;
        const a = x * larg * (1 - 0.15 * v);
        pontoTronco(Math.max(y, p.barra + 0.015), a, 0.02, out);
        out.y = y;
        // abaixo da barriga o couro cai reto (não acompanha o corpo para dentro) e ondula na barra
        if (y < p.barrigaY) {
          const queda = Math.cos(a) * zMax * 0.98 + 0.02;
          out.z = Math.max(out.z, misturar(out.z, queda, suave(p.barrigaY, p.barra + 0.05, y)));
        }
        // caimento: pregas largas que nascem na cintura e abrem para a barra
        out.z += 0.006 * Math.sin(x * Math.PI * 3 + 0.7) * suave(0.1, 1, v) + 0.004 * Math.sin(x * Math.PI * 5.5 + 2) * suave(0.6, 1, v);
        out.y += 0.006 * Math.cos(x * Math.PI * 2.5 + 0.7) * suave(0.85, 1, v);
      },
      uv: (u, v) => [u * 3, v * 2.2],
      cor(u, v) {
        const x = Math.abs(u * 2 - 1);
        const borda = suave(0.84, 0.9, x) * (1 - suave(0.95, 1, x)) + suave(0.86, 0.9, v) * (1 - suave(0.96, 1, v));
        const bolso = v > 0.35 && v < 0.62 && x < 0.5 ? 0.86 : 1;
        const linhaBolso = Math.abs(v - 0.35) < 0.018 && x < 0.5 ? 1 : 0;
        const desgaste = 0.9 + 0.1 * fbm3(u * 6, v * 6, 3, 2, 21);
        return cor4(misturarRgb(escalarRgb(tomA, bolso * desgaste), costura, Math.max(borda * 0.55, linhaBolso * 0.7)));
      },
      pesos: (_u, v) => pesosAo(
        [
          [O.BARRIGA, 0.15],
          [O.QUADRIL, 0.95],
        ],
        v,
      ),
    });
  }
  // cachecol listrado em volta do pescoço, com uma ponta caída nas costas
  ossos[O.CACHECOL] = V(0, p.pescoco - 0.01, inclinar(p.pescoco) - 0.05);
  const temCachecol = !!ap.roupa.cachecol || ap.corpo === 'gnoma';
  if (temCachecol) {
    const cc = ap.roupa.cachecol ?? { cor: ap.gorro.cor2, cor2: ap.gorro.cor };
    // assenta no ombro, abaixo do queixo (não cobre a boca)
    const yN = p.pescoco - 0.032;
    const rN = raioY(yN) + 0.012;
    const zN = inclinar(yN);
    const larguraL = 0.05;
    const nvC = n(28, 14);
    const vsC: number[] = [];
    for (let j = 0; j <= nvC; j++) vsC.push(j / nvC);
    const nl = 10;
    for (let l = 1; l < nl; l++) vsC.push(l / nl, l / nl);
    vsC.sort((a, b) => a - b);
    acc.trico.adicionar({
      nu: n(7, 5),
      nv: nvC,
      vs: vsC,
      ponto(u, v, out) {
        const a = v * Math.PI * 2;
        const f = u * Math.PI * 2;
        const rr = rN + 0.018 + Math.cos(f) * 0.019 + 0.005 * Math.sin(a * 3);
        const yy = yN + Math.sin(f) * larguraL * 0.5 - 0.022 * Math.max(0, Math.cos(a));
        out.set(Math.sin(a) * rr * 1.05, yy, Math.cos(a) * rr * 0.95 + zN);
      },
      // as colunas de pontos seguem o comprimento do cachecol
      uv: (u, v) => [u * 0.8, (v * Math.PI * 2 * (rN + 0.02)) / TRICO_H],
      cor: (_u, v) => cor4(Math.floor(v * nl) % 2 ? cc.cor2 : cc.cor),
      pesos: () => [[O.PEITO, 1]],
    });
    // ponta pendurada atrás, de lado
    const ladoC = -g.lado;
    const raiz = V(ladoC * rN * 0.7, yN - 0.01, -rN * 0.75 + zN);
    const fimY = p.barrigaY + 0.02;
    const fim = V(ladoC * (raioTronco(fimY, 2.2) * 0.75), fimY, -raioTronco(fimY, 2.2) * 0.72 - 0.02 + inclinar(fimY));
    const trilhoC = new Trilho(bezier(raiz, V(ladoC * 0.14, p.ombroY, -raioTronco(p.ombroY, 2.4) - 0.03), V(ladoC * 0.16, misturar(p.ombroY, fimY, 0.6), -raioTronco(misturar(p.ombroY, fimY, 0.6), 2.4) - 0.03), fim), 16, V(0, 0, -1));
    ossos[O.CACHECOL] = raiz.clone();
    const nvT = n(16, 6);
    const vsT: number[] = [];
    for (let j = 0; j <= nvT; j++) vsT.push(j / nvT);
    for (const l of [0.2, 0.4, 0.6, 0.8]) vsT.push(l, l);
    vsT.sort((a, b) => a - b);
    acc.trico.adicionar({
      nu: n(8, 5),
      nv: nvT,
      vs: vsT,
      ponto(u, v, out) {
        const P = _P;
        const T = _T;
        const N = _N;
        const Bn = _B;
        trilhoC.em(v, P, T, N, Bn);
        const a = u * Math.PI * 2;
        out.copy(P).addScaledVector(N, Math.cos(a) * 0.009).addScaledVector(Bn, Math.sin(a) * 0.03);
      },
      uv: (u, v) => [u * 1.5, (v * trilhoC.total) / TRICO_H],
      cor: (_u, v) => cor4(Math.floor(v * 5) % 2 ? cc.cor2 : cc.cor),
      pesos: (_u, v) => pesosAo(
        [
          [O.PEITO, 0.05],
          [O.CACHECOL, 0.35],
        ],
        v,
      ),
    });
    // franja na ponta
    const pf = V();
    const T = V();
    const N = V();
    const Bn = V();
    trilhoC.em(1, pf, T, N, Bn);
    for (let f = 0; f < 5; f++) {
      const ini = pf.clone().addScaledVector(Bn, (f - 2) * 0.012);
      const tri = new Trilho((t, o) => o.copy(ini).addScaledVector(T, t * 0.035).addScaledVector(Bn, (f - 2) * 0.003 * t), 4, N);
      acc.trico.adicionar({
        nu: 5,
        nv: 3,
        ponto(u, v, out) {
          const P = _P;
          const T2 = _T;
          const N2 = _N;
          const B2 = _B;
          tri.em(v, P, T2, N2, B2);
          const a = u * Math.PI * 2;
          const r = 0.004 * (1 - 0.5 * v);
          out.copy(P).addScaledVector(N2, Math.cos(a) * r).addScaledVector(B2, Math.sin(a) * r);
        },
        uv: (u, v) => [u * 0.1, v * 0.2],
        cor: () => cor4(cc.cor),
        pesos: () => [[O.CACHECOL, 1]],
      });
    }
  }
  // lanterninha presa no cinto, do lado
  if (ap.lanterna) {
    const yL = p.barrigaY - 0.02;
    const xL = -(raioTronco(yL, Math.PI / 2) * 1.04 + 0.03);
    const c = V(xL, yL, 0.03);
    const corpoL = new THREE.CylinderGeometry(0.022, 0.022, 0.045, 8, 1, true);
    acc.brilho.adicionarGeometria(corpoL, new THREE.Matrix4().setPosition(c), cor4([1, 1, 1]), [[O.QUADRIL, 1]]);
    corpoL.dispose();
    const tampaL = new THREE.ConeGeometry(0.03, 0.025, 8);
    acc.metal.adicionarGeometria(tampaL, new THREE.Matrix4().setPosition(c.clone().add(V(0, 0.035, 0))), cor4(hex('#2b2b2b')), [[O.QUADRIL, 1]]);
    tampaL.dispose();
    const baseL = new THREE.CylinderGeometry(0.027, 0.025, 0.01, 8);
    acc.metal.adicionarGeometria(baseL, new THREE.Matrix4().setPosition(c.clone().add(V(0, -0.027, 0))), cor4(hex('#2b2b2b')), [[O.QUADRIL, 1]]);
    baseL.dispose();
    for (let b = 0; b < 4; b++) {
      const barra = new THREE.CylinderGeometry(0.003, 0.003, 0.05, 4);
      const a = (b / 4) * Math.PI * 2 + Math.PI / 4;
      acc.metal.adicionarGeometria(barra, new THREE.Matrix4().setPosition(c.clone().add(V(Math.sin(a) * 0.023, 0, Math.cos(a) * 0.023))), cor4(hex('#2b2b2b')), [[O.QUADRIL, 1]]);
      barra.dispose();
    }
    const alca = new THREE.TorusGeometry(0.012, 0.002, 4, 10, Math.PI);
    acc.metal.adicionarGeometria(alca, new THREE.Matrix4().setPosition(c.clone().add(V(0, 0.047, 0))), cor4(hex('#2b2b2b')), [[O.QUADRIL, 1]]);
    alca.dispose();
  }

  /* --------------------------------------------------------- âncoras e medidas */
  let topoY = 0;
  let topoX = 0;
  let topoZ = 0;
  for (const nome of ['tecido', 'barba', 'duro'] as const) {
    const a = fis[nome];
    for (let i = 0; i < a.pos.length; i += 3)
      if (a.pos[i + 1] > topoY) {
        topoY = a.pos[i + 1];
        topoX = a.pos[i];
        topoZ = a.pos[i + 2];
      }
  }
  const altura = topoY;
  // etiqueta: logo acima do ponto mais alto do gorro (no eixo da cabeça, para não balançar com a ponta)
  const etiqueta = V(topoX * 0.5, Math.min(topoY, H.y + R + 0.42) + 0.035, topoZ * 0.3);
  const alcance = p.braco + 0.06;
  // o presente assenta sobre o gorro amassado, logo acima da cabeça; as mãos o seguram pelos lados
  const presente = V(0, H.y + R + (touca ? 0.27 : 0.23), H.z + 0.05);
  const curvaDir = V(cg[3].x - cg[0].x, 0, cg[3].z - cg[0].z);
  return {
    acc: fis,
    ossos,
    etiqueta,
    presente,
    altura,
    info: {
      olhoR,
      gorroForma: g.forma,
      curvaGorro: curvaDir.lengthSq() > 1e-6 ? curvaDir.normalize() : V(sd, 0, 0),
      maoRepouso: V(B * 0.95 + 0.035, p.barrigaY - 0.03, B * 0.3 + 0.03 + inclinar(p.barrigaY)),
      alcance,
      temBarba,
      temTrancas: ap.cabelo.trancas,
      temCachecol,
    },
  };
}
