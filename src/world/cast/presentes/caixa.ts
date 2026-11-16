/**
 * CAIXA DE PRESENTE: caixa de papelão forrada com papel de presente (padrão original verde-pinheiro com
 * estrelinhas douradas e pontinhos de neve, veja texturas.ts), quinas arredondadas, borda com espessura e
 * o fundo de dentro em sombra; tampa que encaixa por fora (um nada maior), fita de cetim vermelho PLANA em
 * cruz (com as bordas dobradas, como fita de verdade) e um laço volumoso duplo em cima.
 *
 * Medidas reais: 42 x 42 cm de base, corpo de 30 cm, tampa de 7,5 cm (encaixa 6 cm no corpo); com o laço,
 * cerca de 46 cm de altura. Origem no centro da base. A TAMPA tem o pivô no CENTRO DE CIMA DO CORPO
 * (y = alturaCorpo): é ali que fica o grupo `lid`; as malhas da tampa estão em volta desse ponto.
 * Quatro malhas: papel e fita do corpo, papel e fita da tampa. Geometria compartilhada por nível.
 */
import * as THREE from 'three';
import type { Level } from '../../contracts';
import { type Cor, Molde } from './malha';
import type { NomeMaterial } from './materiais';
import { COR, fitaPlana, laco } from './pecas';
import { div, type Qualidade } from './tipos';

const LADO = 0.42;
const ALTURA = 0.3;
const TAMPA = 0.075;
const ENCAIXE = 0.06;
const FOLGA = 0.007; // a tampa é maior que o corpo
const PAREDE = 0.005; // espessura do papelão
const CANTO = 0.012; // raio das quinas verticais
const LADRILHO = 0.16; // o papel repete a cada 16 cm
const FITA = 0.05;

/** Ponto do contorno de um quadrado de cantos arredondados (meia medida `meia`, raio `rc`), u de 0 a 1, começando no meio da frente (+Z). */
function quadrado(u: number, meia: number, rc: number, out: THREE.Vector2) {
  const reto = 2 * (meia - rc);
  const arco = (Math.PI / 2) * rc;
  const total = 4 * (reto + arco);
  let s = ((((u % 1) + 1) % 1) * total + reto / 2) % total;
  const m = meia - rc;
  // quatro lados (ponto de partida e direção) e quatro cantos (centro e ângulo inicial), em volta
  const retos: Array<[number, number, number, number]> = [
    [-m, meia, 1, 0],
    [meia, m, 0, -1],
    [m, -meia, -1, 0],
    [-meia, -m, 0, 1],
  ];
  const cantos: Array<[number, number]> = [
    [1, 1],
    [1, -1],
    [-1, -1],
    [-1, 1],
  ];
  for (let k = 0; k < 4; k++) {
    if (s <= reto) {
      const [x0, z0, dx, dz] = retos[k];
      out.set(x0 + dx * s, z0 + dz * s);
      return;
    }
    s -= reto;
    if (s <= arco) {
      const [sx, sz] = cantos[k];
      const a = Math.PI / 2 - (k * Math.PI) / 2 - s / Math.max(rc, 1e-6);
      out.set(sx * m + Math.cos(a) * rc, sz * m + Math.sin(a) * rc);
      return;
    }
    s -= arco;
  }
  out.set(-m, meia);
}

interface Trecho {
  /** Meia medida e altura em cada ponto do perfil (t de 0 a 1 dentro do trecho). */
  f(t: number): readonly [number, number];
  peso: number;
  cor: number;
  /** Trecho deitado (tampo, fundo): o papel é projetado de cima, sem anéis concêntricos. */
  plano?: boolean;
}

/**
 * Casca de caixa por um perfil (meia medida, altura) que percorre fundo, parede, borda, parede de dentro
 * e fundo de dentro. u corre em volta (quadrado de cantos arredondados).
 */
function casca(m: Molde, trechos: Trecho[], nu: number, nv: number, rc: number, semente: number) {
  const pesoTotal = trechos.reduce((a, t) => a + t.peso, 0);
  const V2 = new THREE.Vector2();
  const em = (v: number) => {
    let x = v * pesoTotal;
    for (const t of trechos) {
      if (x <= t.peso + 1e-9) return { t, f: t.peso > 0 ? x / t.peso : 0 };
      x -= t.peso;
    }
    const ult = trechos[trechos.length - 1];
    return { t: ult, f: 1 };
  };
  m.adicionar({
    nu,
    nv,
    ponto(u, v, out) {
      const { t, f } = em(v);
      const [meia, y] = t.f(f);
      const escala = meia <= 0 ? 0 : 1;
      quadrado(u, Math.max(meia, 1e-4), Math.min(rc, Math.max(meia, 1e-4)), V2);
      // pequenas ondulações do papel colado (o papelão não é perfeito)
      const onda = Math.sin(u * 47 + semente) * Math.sin(y * 31) * 0.0006;
      out.set(V2.x * escala * (1 + onda), y, V2.y * escala * (1 + onda));
    },
    uv(u, v) {
      const { t, f } = em(v);
      const [meia, y] = t.f(f);
      if (t.plano) {
        quadrado(u, Math.max(meia, 1e-4), Math.min(rc, Math.max(meia, 1e-4)), V2);
        return [V2.x / LADRILHO + 0.31, V2.y / LADRILHO + 0.17];
      }
      // nas paredes: u pelo perímetro, v pela altura
      return [(u * 8 * meia) / LADRILHO, y / LADRILHO];
    },
    cor(_u, v) {
      const { t } = em(v);
      return [t.cor, t.cor, t.cor];
    },
  });
}

interface MalhaCaixa {
  nome: string;
  material: NomeMaterial;
  geo: THREE.BufferGeometry;
}

export interface CaixaPronta {
  corpo: MalhaCaixa[];
  tampa: MalhaCaixa[];
  lado: number;
  alturaCorpo: number;
  alturaTotal: number;
}

const cache = new Map<Level, CaixaPronta>();

/** Libera a geometria das caixas (fim do jogo). */
export function liberarCaixas() {
  for (const c of cache.values()) for (const m of [...c.corpo, ...c.tampa]) m.geo.dispose();
  cache.clear();
}

const VERMELHO_FITA: Cor = COR.vermelho;

export function moldarCaixa(q: Qualidade): CaixaPronta {
  const pronta = cache.get(q.nivel);
  if (pronta) return pronta;
  const a = LADO / 2;
  const rb = 0.006; // arredondado das quinas de baixo e de cima
  const nu = div(q, 96, 40);

  /* ------------------------------------------------------------------ corpo */
  const papelCorpo = new Molde();
  const arco = (cx: number, cy: number, r: number, a0: number, a1: number) => (t: number) => {
    const ang = a0 + (a1 - a0) * t;
    return [cx + Math.cos(ang) * r, cy + Math.sin(ang) * r] as const;
  };
  casca(
    papelCorpo,
    [
      { f: (t) => [(a - rb) * t, 0], peso: 0.5, cor: 0.8, plano: true },
      { f: arco(a - rb, rb, rb, -Math.PI / 2, 0), peso: 0.12, cor: 0.95 },
      { f: (t) => [a, rb + (ALTURA - rb - PAREDE / 2) * t], peso: 1.2, cor: 1 },
      { f: arco(a - PAREDE / 2, ALTURA - PAREDE / 2, PAREDE / 2, 0, Math.PI), peso: 0.1, cor: 0.9 },
      { f: (t) => [a - PAREDE, ALTURA - PAREDE / 2 - (ALTURA - PAREDE / 2 - 0.006) * t], peso: 1.0, cor: 0.42 },
      { f: (t) => [(a - PAREDE) * (1 - t), 0.006], peso: 0.5, cor: 0.3, plano: true },
    ],
    nu,
    div(q, 40, 20),
    CANTO,
    1,
  );
  // escurece o fundo de dentro em direção aos cantos (a luz não chega lá)
  papelCorpo.sombrear((p) => (p.y < ALTURA - 0.01 && Math.max(Math.abs(p.x), Math.abs(p.z)) < a - PAREDE * 0.5 ? 0.75 + 0.25 * (p.y / ALTURA) : 1));

  // fitas do corpo: quatro tiras verticais no meio de cada lado (continuam as da tampa)
  const fitaCorpo = new Molde();
  const n = div(q, 10, 4);
  for (const [dx, dz] of [
    [0, 1],
    [1, 0],
    [0, -1],
    [-1, 0],
  ] as const) {
    const caminho: THREE.Vector3[] = [];
    const lado: THREE.Vector3[] = [];
    const ladoDir = new THREE.Vector3(dz, 0, -dx);
    for (let i = 0; i <= n; i++) {
      const y = 0.003 + ((ALTURA - 0.004) * i) / n;
      caminho.push(new THREE.Vector3(dx * (a + 0.0016), y, dz * (a + 0.0016)));
      lado.push(ladoDir);
    }
    // por baixo, a fita dobra para o fundo
    caminho.unshift(new THREE.Vector3(dx * (a - 0.02), -0.0012, dz * (a - 0.02)));
    lado.unshift(ladoDir);
    fitaPlana(fitaCorpo, caminho, lado, FITA, VERMELHO_FITA, [0, 0.36, 0, 0], 0.14);
  }

  /* ------------------------------------------------------------------ tampa */
  const papelTampa = new Molde();
  const at = a + FOLGA;
  const topo = TAMPA - ENCAIXE; // o tampo fica acima da borda do corpo
  const baixo = -ENCAIXE;
  casca(
    papelTampa,
    [
      { f: (t) => [(at - rb) * (1 - t), topo], peso: 0.5, cor: 1, plano: true },
      { f: arco(at - rb, topo - rb, rb, Math.PI / 2, 0), peso: 0.12, cor: 1 },
      { f: (t) => [at, topo - rb - (topo - rb - baixo - PAREDE / 2) * t], peso: 0.5, cor: 1 },
      { f: arco(at - PAREDE / 2, baixo + PAREDE / 2, PAREDE / 2, 0, -Math.PI), peso: 0.1, cor: 0.85 },
      { f: (t) => [at - PAREDE, baixo + PAREDE / 2 + (topo - PAREDE - baixo - PAREDE / 2) * t], peso: 0.5, cor: 0.45 },
      { f: (t) => [(at - PAREDE) * t, topo - PAREDE], peso: 0.5, cor: 0.35, plano: true },
    ],
    nu,
    div(q, 28, 14),
    CANTO + FOLGA,
    2,
  );

  // fita da tampa: duas voltas em cruz que sobem pelas laterais e passam por cima
  const fitaTampa = new Molde();
  const volta = (eixo: 'x' | 'z') => {
    const caminho: THREE.Vector3[] = [];
    const lado: THREE.Vector3[] = [];
    const ladoDir = eixo === 'x' ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
    const pt = (s: number, y: number) => (eixo === 'x' ? new THREE.Vector3(s, y, 0) : new THREE.Vector3(0, y, s));
    const m = at + 0.0018;
    const yt = topo + 0.0018;
    const rc = rb + 0.0018;
    const por = (s: number, y: number) => {
      caminho.push(pt(s, y));
      lado.push(ladoDir);
    };
    for (let i = 0; i <= 3; i++) por(-m, baixo + 0.001 + ((yt - rc - baixo) * i) / 3);
    for (let i = 1; i <= 4; i++) {
      const ang = (i / 4) * (Math.PI / 2);
      por(-m + rc - rc * Math.cos(ang), yt - rc + rc * Math.sin(ang));
    }
    for (let i = 1; i <= 7; i++) por(-m + rc + ((2 * m - 2 * rc) * i) / 8, yt + (eixo === 'z' ? 0.0012 : 0));
    for (let i = 0; i <= 4; i++) {
      const ang = (i / 4) * (Math.PI / 2);
      por(m - rc + rc * Math.sin(ang), yt - rc + rc * Math.cos(ang));
    }
    for (let i = 1; i <= 3; i++) por(m, yt - rc - ((yt - rc - baixo - 0.001) * i) / 3);
    fitaPlana(fitaTampa, caminho, lado, FITA, VERMELHO_FITA, [0, 0.36, 0, 0], 0.14);
  };
  volta('x');
  volta('z');
  // laço volumoso, duplo, deitado para trás sobre o cruzamento (mostra a face larga das alças)
  laco(
    fitaTampa,
    { largura: 0.3, fita: FITA * 1.25, pontas: 0.5, queda: 0.15, duplo: true, cheio: 0.55, inclina: 0.5, ladrilho: 0.14, k: q.k },
    17,
    new THREE.Matrix4().makeTranslation(0, topo + 0.01, 0.004).multiply(new THREE.Matrix4().makeRotationY(0.18)).multiply(new THREE.Matrix4().makeRotationX(-0.62)),
    VERMELHO_FITA,
    [0, 0.36, 0, 0],
  );

  const altLaco = fitaTampa.caixa().max.y;
  const caixa: CaixaPronta = {
    corpo: [
      { nome: 'papel', material: 'papel', geo: papelCorpo.geometria() },
      { nome: 'fita', material: 'cetim', geo: fitaCorpo.geometria() },
    ],
    tampa: [
      { nome: 'papel-tampa', material: 'papel', geo: papelTampa.geometria() },
      { nome: 'fita-tampa', material: 'cetim', geo: fitaTampa.geometria() },
    ],
    lado: LADO,
    alturaCorpo: ALTURA,
    alturaTotal: ALTURA + altLaco,
  };
  cache.set(q.nivel, caixa);
  return caixa;
}
