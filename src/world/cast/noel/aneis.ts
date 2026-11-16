/**
 * Anéis e tufos: as peças que se repetem no Noel (barra, aba do gorro, punhos, aros dos óculos, fivela,
 * mechas da barba). Devolvem a função P(u, v) para o Acumulador.
 */
import * as THREE from 'three';
import { Caminho } from './malha';

const C0 = new THREE.Vector3();
const C1 = new THREE.Vector3();
const C2 = new THREE.Vector3();
const TT = new THREE.Vector3();
const NN = new THREE.Vector3();
const BB = new THREE.Vector3();

/**
 * Tubo fechado em volta de uma curva fechada `curva(t)` (t de 0 a 1). `fora(t)` dá a direção "para fora"
 * (a normal do tubo em u = 0). `raio(u, t)` devolve [raio para fora, raio na outra direção].
 * u corre em volta da seção; v (aqui t) corre ao longo da curva.
 */
export function anel(
  curva: (t: number, out: THREE.Vector3) => void,
  fora: (t: number, p: THREE.Vector3, out: THREE.Vector3) => void,
  raio: (u: number, t: number) => readonly [number, number],
  /** Expoente da seção (1 = elipse; menor = retângulo de cantos chanfrados, como a moldura da fivela). */
  expoente = 1,
) {
  const pot = (x: number) => (expoente === 1 ? x : Math.sign(x) * Math.pow(Math.abs(x), expoente));
  return (u: number, v: number, out: THREE.Vector3) => {
    const t = v % 1;
    const e = 1e-3;
    curva(t, C0);
    curva((t + e) % 1, C1);
    curva((t - e + 1) % 1, C2);
    TT.subVectors(C1, C2).normalize();
    fora(t, C0, NN);
    NN.sub(TT.clone().multiplyScalar(NN.dot(TT))).normalize();
    BB.crossVectors(TT, NN).normalize();
    const [r1, r2] = raio(u, t);
    const a = u * Math.PI * 2;
    out.copy(C0)
      .addScaledVector(NN, pot(Math.cos(a)) * r1)
      .addScaledVector(BB, pot(Math.sin(a)) * r2);
  };
}

/** Mecha (tufo de barba, bigode, sobrancelha): tubo afilado com ponta redonda, um pouco achatado. */
export interface Mecha {
  caminho: Caminho;
  /** Raio na raiz (largura) e achatamento (espessura / largura). */
  raio: number;
  achatar: number;
  /** Direção "para fora" da mecha (onde fica a face achatada), para orientar a seção. */
  fora: THREE.Vector3;
  /** Afinamento da ponta (0 = cilíndrica, 1 = ponta fina). */
  afinar?: number;
  /** Onde a mecha é mais grossa (0 a 1). */
  barriga?: number;
}

const MP = new THREE.Vector3();
const MT = new THREE.Vector3();
const MS = new THREE.Vector3();
const MB = new THREE.Vector3();

/** P(u, v) de uma mecha: v = 0 na raiz (fechada), v = 1 na ponta (fechada, arredondada). */
export function mecha(m: Mecha, ruido?: (u: number, v: number) => number) {
  const af = m.afinar ?? 0.8;
  const bar = m.barriga ?? 0.35;
  return (u: number, vBruto: number, out: THREE.Vector3) => {
    // mais anéis perto das duas pontas (onde a curvatura é maior): espaçamento em cosseno
    const v = 0.5 - 0.5 * Math.cos(Math.PI * vBruto);
    m.caminho.em(v, MP, MT);
    // lado achatado orientado por `fora`
    MB.copy(m.fora).addScaledVector(MT, -m.fora.dot(MT)).normalize();
    MS.crossVectors(MT, MB).normalize();
    // perfil: nasce redondo, engorda até `bar`, afina para a ponta e fecha em calota
    const subida = Math.sin(Math.min(1, v / Math.max(0.05, bar)) * Math.PI * 0.5);
    const descida = 1 - af * Math.pow(Math.max(0, (v - bar) / (1 - bar)), 1.6);
    // ponta fechada em calota redonda (macia), não em bico
    const fecho = Math.sqrt(Math.max(0, 1 - Math.pow(Math.max(0, (v - 0.82) / 0.18), 2)));
    const inicio = Math.sqrt(Math.max(0, Math.min(1, v / 0.06)));
    let r = m.raio * (0.55 + 0.45 * subida) * descida * fecho * inicio;
    if (ruido) r *= 1 + ruido(u, v);
    const a = u * Math.PI * 2;
    out.copy(MP)
      .addScaledVector(MS, Math.cos(a) * r)
      .addScaledVector(MB, Math.sin(a) * r * m.achatar);
  };
}
