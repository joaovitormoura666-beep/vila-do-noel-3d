/**
 * URSINHO DE PELÚCIA: ursinho sentado, de pelúcia caramelo em cascas (a mesma técnica do pelo do Noel:
 * tufos que afinam para a ponta, raiz mais escura), com focinho e palmilhas creme de pelo curto, orelhas
 * redondas com o miolo claro, olhos de botão de vidro preto, nariz bordado e a boca em ponto atrás, e um
 * laço de cetim vermelho no pescoço. Corpo de pera, cabeça grande, braços e pernas gordinhos para a
 * frente, como se estivesse esperando um abraço.
 * Três malhas: pelúcia (em cascas, uma chamada de desenho), detalhes (olhos, nariz, boca e palmilhas) e cetim.
 */
import * as THREE from 'three';
import { type Cor, elipsoide, Molde, quadros, tubo } from './malha';
import { COR, esfera, laco, ruido } from './pecas';
import { div, type Moldar } from './tipos';

const CARAMELO: Cor = [0.42, 0.2, 0.075];
const CREME: Cor = [0.78, 0.6, 0.38];
const ESCURO: Cor = [0.05, 0.025, 0.018];

const CABECA = new THREE.Vector3(0, 0.272, 0.012);
const FOCINHO = new THREE.Vector3(0, 0.25, 0.078);

export const moldarUrsinho: Moldar = (q) => {
  const pelo = new Molde();
  const peloDe = (comp: number) => (_u: number, _v: number, p: THREE.Vector3) => [comp, 1, (p.x * 31 + p.y * 17) % 1] as const;
  const tonalidade = (base: Cor) => (_u: number, _v: number, p: THREE.Vector3): Cor => {
    // manchas de tom (pelúcia penteada em ondas) e a parte de baixo mais escura
    const k = 0.9 + 0.12 * ruido(p.x * 25, p.y * 25, p.z * 25, 2) + 0.08 * THREE.MathUtils.smoothstep(p.y, 0, 0.3);
    return [base[0] * k, base[1] * k, base[2] * k];
  };

  // corpo de pera
  pelo.adicionar({
    nu: div(q, 13, 10),
    nv: div(q, 10, 8),
    ponto: elipsoide(new THREE.Vector3(0, 0.115, 0.004), 0.084, 0.098, 0.074, (_u, v, d) => (1 - v) * 0.12 - 0.06 + (d.z > 0 ? d.z * 0.05 * (1 - v) : 0)),
    cor: tonalidade(CARAMELO),
    pelo: peloDe(0.0075),
  });
  // cabeça (bochechas largas)
  pelo.adicionar({
    nu: div(q, 16, 10),
    nv: div(q, 11, 8),
    ponto: elipsoide(CABECA, 0.084, 0.074, 0.074, (_u, v, d) => Math.abs(d.x) * 0.05 * Math.sin(Math.PI * v) - Math.max(0, d.z) * 0.02),
    cor: tonalidade(CARAMELO),
    pelo: peloDe(0.0068),
  });
  // focinho creme, pelo curto
  pelo.adicionar({
    nu: div(q, 9, 8),
    nv: div(q, 6, 6),
    ponto: elipsoide(FOCINHO, 0.037, 0.029, 0.03),
    cor: tonalidade(CREME),
    pelo: peloDe(0.0032),
  });
  // orelhas: discos grossos, de frente, com o miolo creme
  for (const s of [-1, 1]) {
    const c = new THREE.Vector3(s * 0.063, 0.333, -0.004);
    pelo.adicionar({
      nu: div(q, 8, 6),
      nv: div(q, 6, 5),
      ponto: elipsoide(c, 0.03, 0.028, 0.013, (_u, _v, d) => -Math.max(0, d.z) * 0.35 * (1 - Math.abs(d.y))),
      cor(_u, _v, p) {
        const miolo = p.z > c.z && Math.hypot(p.x - c.x, p.y - c.y) < 0.018;
        return miolo ? CREME : tonalidade(CARAMELO)(0, 0, p);
      },
      pelo: (_u, _v, p) => [p.z > c.z && Math.hypot(p.x - c.x, p.y - c.y) < 0.018 ? 0.003 : 0.006, 1, 0.3],
    });
  }
  // braços e pernas: tubos gordinhos com a ponta redonda
  const membro = (pts: THREE.Vector3[], r0: number, r1: number) => {
    const curva = new THREE.CatmullRomCurve3(pts);
    const mq = quadros((t, out) => curva.getPoint(t, out), 12);
    pelo.adicionar({
      nu: div(q, 8, 6),
      nv: div(q, 7, 5),
      ponto: tubo(mq, (_u, v) => {
        const r = r0 + (r1 - r0) * v;
        return [r, r];
      }, undefined, 0.3),
      cor: tonalidade(CARAMELO),
      pelo: peloDe(0.0068),
    });
  };
  for (const s of [-1, 1]) {
    membro([new THREE.Vector3(s * 0.058, 0.18, 0.012), new THREE.Vector3(s * 0.092, 0.13, 0.045), new THREE.Vector3(s * 0.098, 0.088, 0.082)], 0.027, 0.025);
    membro([new THREE.Vector3(s * 0.045, 0.06, 0.02), new THREE.Vector3(s * 0.058, 0.045, 0.08), new THREE.Vector3(s * 0.066, 0.042, 0.135)], 0.034, 0.036);
  }

  /* ---------------------------------------------------------------- detalhes */
  const det = new Molde();
  // olhos de botão: vidro preto com verniz
  for (const s of [-1, 1]) esfera(det, new THREE.Vector3(s * 0.03, 0.288, 0.074), 0.0105, div(q, 12, 8), div(q, 8, 6), [0.012, 0.01, 0.01], [0, 0.12, 1, 0], [1, 1, 0.7]);
  // nariz bordado: triângulo arredondado escuro, fosco acetinado (linha de bordar)
  det.adicionar({
    nu: div(q, 14, 8),
    nv: div(q, 8, 6),
    ponto: elipsoide(new THREE.Vector3(0, 0.262, 0.105), 0.0145, 0.0095, 0.008, (_u, _v, d) => (d.y > 0 ? 0.15 : -0.25 * Math.abs(d.y))),
    cor: () => ESCURO,
    acab: () => [0, 0.55, 0.2, 0],
  });
  // boca em ponto atrás: um "Y" de linha escura
  const linha = (pts: THREE.Vector3[]) => {
    const curva = new THREE.CatmullRomCurve3(pts);
    const lq = quadros((t, out) => curva.getPoint(t, out), 8);
    det.adicionar({ nu: 5, nv: 8, ponto: tubo(lq, () => [0.0016, 0.0016], undefined, 0.08), cor: () => ESCURO, acab: () => [0, 0.7, 0, 0] });
  };
  linha([new THREE.Vector3(0, 0.254, 0.106), new THREE.Vector3(0, 0.243, 0.106)]);
  for (const s of [-1, 1]) linha([new THREE.Vector3(0, 0.243, 0.106), new THREE.Vector3(s * 0.008, 0.237, 0.103), new THREE.Vector3(s * 0.016, 0.24, 0.097)]);
  // palmilhas dos pés: feltro creme, ovais, viradas para a frente
  for (const s of [-1, 1]) {
    const c = new THREE.Vector3(s * 0.066, 0.042, 0.135 + 0.036 * 0.98);
    det.adicionar({
      nu: div(q, 12, 8),
      nv: 4,
      fechadoU: true,
      ponto(u, v, out) {
        const a = u * Math.PI * 2;
        const r = v;
        out.set(c.x + Math.sin(a) * 0.024 * r, c.y + Math.cos(a) * 0.028 * r, c.z + 0.004 * (1 - r * r) - 0.006 * r * r);
      },
      cor: () => [CREME[0] * 0.9, CREME[1] * 0.9, CREME[2] * 0.9],
      acab: () => [0, 0.95, 0, 0],
      orientar: 1,
    });
  }

  /* -------------------------------------------------------------------- laço */
  const fita = new Molde();
  const pescoco = new THREE.Vector3(0, 0.203, 0.008);
  const nq = quadros((t, out) => {
    const a = t * Math.PI * 2;
    out.set(pescoco.x + Math.sin(a) * 0.05, pescoco.y + Math.cos(a) * 0.005, pescoco.z + Math.cos(a) * 0.047);
  }, 32);
  fita.adicionar({ nu: 5, nv: 18, ponto: tubo(nq, (u) => [0.003, 0.009 * (0.8 + 0.2 * Math.abs(Math.cos(u * Math.PI * 2)))]), cor: () => COR.vermelho });
  laco(
    fita,
    { largura: 0.1, fita: 0.02, pontas: 0.8, queda: 0.4, cheio: 0.45, inclina: 0.5, ladrilho: 0.08, duplo: true, k: q.k * 0.85 },
    23,
    new THREE.Matrix4().makeTranslation(0.016, pescoco.y - 0.002, pescoco.z + 0.05).multiply(new THREE.Matrix4().makeRotationZ(-0.15)).multiply(new THREE.Matrix4().makeRotationY(0.25)),
    COR.vermelho,
  );

  return {
    partes: [
      { nome: 'pelucia', material: 'pelucia', molde: pelo, cascas: true },
      { nome: 'detalhes', material: 'esmalte', molde: det },
      { nome: 'fita', material: 'cetim', molde: fita },
    ],
  };
};
