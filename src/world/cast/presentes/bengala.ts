/**
 * BENGALA DOCE: bala de açúcar puxada à mão, com o gancho clássico, listras em espiral (larga vermelha,
 * fina verde, filete vermelho) sobre o branco leitoso, superfície de açúcar brilhante e levemente
 * irregular (o diâmetro varia um nada, a espiral não é perfeita). Um laço de cetim verde amarrado logo
 * abaixo da curva, com duas folhas de azevinho e três bagas.
 * Três malhas: o doce, o cetim e as folhas com as bagas.
 */
import * as THREE from 'three';
import { Molde, quadros, tubo } from './malha';
import { bagas, COR, folhaAzevinho, laco } from './pecas';
import { div, type Moldar } from './tipos';
import { fbm3 } from '../noel/util';

const RAIO = 0.017;
const ALTO = 0.3; // comprimento da haste reta
const CURVA = 0.062; // raio do gancho
const PASSO = 0.07; // uma listra completa a cada 7 cm

/** Eixo da bengala: haste de baixo para cima, depois o gancho virando para +X e descendo um pouco. */
function eixo(t: number, out: THREE.Vector3) {
  const lHaste = ALTO;
  const lCurva = Math.PI * CURVA;
  const lPonta = 0.045;
  const total = lHaste + lCurva + lPonta;
  let s = t * total;
  if (s <= lHaste) {
    // a haste não é perfeitamente reta (doce puxado à mão)
    out.set(Math.sin(s * 9) * 0.0015, s, 0);
    return;
  }
  s -= lHaste;
  if (s <= lCurva) {
    const a = s / CURVA; // 0 a π
    out.set(CURVA - Math.cos(a) * CURVA, lHaste + Math.sin(a) * CURVA, 0);
    return;
  }
  s -= lCurva;
  out.set(2 * CURVA + s * 0.08, lHaste - s, 0);
}

export const moldarBengala: Moldar = (q) => {
  const doce = new Molde();
  const nv = div(q, 110, 50);
  const q0 = quadros(eixo, nv, new THREE.Vector3(0, 0, 1));
  const comp = q0.comp[q0.comp.length - 1];
  doce.adicionar({
    nu: div(q, 16, 10),
    nv,
    ponto: tubo(
      q0,
      (u, v) => {
        const r = RAIO * (1 + fbm3(v * 14, u * 2, 0.3, 2, 5) * 0.035);
        return [r, r];
      },
      undefined,
      0.012,
    ),
    // u em volta, v ao longo (em passos de listra): a textura inclinada vira espiral
    uv: (u, v) => [u, (v * comp) / PASSO],
    cor: () => [1, 1, 1],
    // açúcar vitrificado: verniz alto, rugosidade baixa variando
    acab: (u, v) => [0, 0.34 + 0.08 * fbm3(u * 4, v * 30, 1.7, 2, 9), 0.35, 0],
  });

  // laço de cetim verde logo abaixo da curva, amarrado em volta da haste
  const fita = new Molde();
  const yLaco = ALTO - 0.035;
  // a volta da fita apertando a haste
  const anelQ = quadros((t, out) => {
    const a = t * Math.PI * 2;
    out.set(Math.sin(a) * (RAIO + 0.0012), yLaco + Math.sin(a * 2) * 0.0015, Math.cos(a) * (RAIO + 0.0012));
  }, 24);
  fita.adicionar({ nu: 8, nv: 24, ponto: tubo(anelQ, (u) => [0.0016, 0.006 * (0.85 + 0.15 * Math.cos(u * Math.PI * 2))]), cor: () => COR.verdeClaro });
  laco(
    fita,
    { largura: 0.11, fita: 0.022, pontas: 0.8, queda: 0.45, cheio: 0.45, inclina: 0.45, ladrilho: 0.08, k: q.k },
    11,
    new THREE.Matrix4().makeTranslation(0, yLaco, RAIO + 0.004).multiply(new THREE.Matrix4().makeRotationX(-0.2)),
    COR.verdeClaro,
  );

  // folhas de azevinho e bagas, saindo de trás do laço
  const folhas = new Molde();
  const base = new THREE.Vector3(0.004, yLaco + 0.008, RAIO * 0.3);
  folhaAzevinho(folhas, new THREE.Matrix4().makeTranslation(base.x, base.y, base.z).multiply(new THREE.Matrix4().makeRotationZ(0.55)).multiply(new THREE.Matrix4().makeRotationX(0.2)), 0.058, COR.verde, 3);
  folhaAzevinho(folhas, new THREE.Matrix4().makeTranslation(-base.x, base.y, base.z).multiply(new THREE.Matrix4().makeRotationZ(Math.PI - 0.35)).multiply(new THREE.Matrix4().makeRotationX(-0.25)), 0.052, COR.verde, 4);
  bagas(folhas, new THREE.Vector3(0.002, yLaco + 0.02, RAIO + 0.004), 0.0075, 3, 5, q.k);

  return {
    partes: [
      { nome: 'doce', material: 'bengala', molde: doce },
      { nome: 'fita', material: 'cetim', molde: fita },
      { nome: 'folhas', material: 'esmalte', molde: folhas },
    ],
  };
};
