/**
 * ESTRELA DOURADA: estrela de cinco pontas lapidada em latão escovado, como as de enfeite de mesa feitas
 * à mão: cada braço tem uma aresta viva do centro até a ponta (as faces pegam a luz de jeitos diferentes,
 * é isso que faz ela ler como metal, não como plástico), a borda tem espessura chanfrada e as pontas são
 * levemente arredondadas. Um laço de cetim vermelho enfeita a ponta de cima.
 * Duas malhas: metal e cetim.
 */
import * as THREE from 'three';
import { Molde } from './malha';
import { ACAB, COR, laco } from './pecas';
import { div, type Moldar } from './tipos';
import { fbm3 } from '../noel/util';

const PONTAS = 5;
const RE = 0.17; // raio das pontas
const RI = 0.075; // raio dos cantos de dentro
const ALTURA = 0.052; // altura do centro (de cada lado)
const BORDA = 0.009; // meia espessura da borda

/** Contorno da estrela em t (0 a 1, uma volta): ponto no plano XY. As pontas são arredondadas. */
function contorno(t: number, out: THREE.Vector2) {
  const seg = t * PONTAS * 2;
  const i = Math.floor(seg) % (PONTAS * 2);
  const f = seg - Math.floor(seg);
  const ang = (k: number) => Math.PI / 2 + (k / (PONTAS * 2)) * Math.PI * 2;
  const raio = (k: number) => (k % 2 === 0 ? RE : RI);
  const ax = Math.cos(ang(i)) * raio(i);
  const ay = Math.sin(ang(i)) * raio(i);
  const bx = Math.cos(ang(i + 1)) * raio(i + 1);
  const by = Math.sin(ang(i + 1)) * raio(i + 1);
  out.set(ax + (bx - ax) * f, ay + (by - ay) * f);
  // arredonda a ponta: perto do vértice externo, puxa o ponto para dentro em curva
  const dPonta = i % 2 === 0 ? f : 1 - f; // distância (em fração do lado) até a ponta
  if (dPonta < 0.08) {
    const k = 1 - dPonta / 0.08;
    out.multiplyScalar(1 - 0.045 * k * k);
  }
}

export const moldarEstrela: Moldar = (q) => {
  const metal = new Molde().tinta(COR.ouro, ACAB.ouro);
  const nu = div(q, 120, 60); // em volta (múltiplo de 10 ajuda as arestas a caírem em vértices)
  const nuArestas = Math.round(nu / 10) * 10;
  const C = new THREE.Vector2();
  // v: 0 = centro da frente, 0,45 = borda da frente, 0,55 = borda de trás, 1 = centro de trás
  metal.adicionar({
    nu: nuArestas,
    nv: div(q, 22, 12),
    ponto(u, v, out) {
      contorno(u, C);
      if (v <= 0.45) {
        const s = v / 0.45;
        // faces planas do centro à borda, com um nada de abaulado
        const z = BORDA + (ALTURA - BORDA) * (1 - s) + Math.sin(Math.PI * s) * 0.002;
        out.set(C.x * s, C.y * s, z);
      } else if (v >= 0.55) {
        const s = (1 - v) / 0.45;
        const z = BORDA + (ALTURA - BORDA) * (1 - s) + Math.sin(Math.PI * s) * 0.002;
        out.set(C.x * s, C.y * s, -z);
      } else {
        // borda chanfrada e arredondada: meia volta de raio BORDA para fora
        const a = ((v - 0.45) / 0.1) * Math.PI;
        const fora = Math.sin(a) * BORDA * 0.7;
        const len = C.length();
        const k = (len + fora) / len;
        out.set(C.x * k, C.y * k, Math.cos(a) * BORDA);
      }
      // marteladas: o metal trabalhado à mão não é perfeito
      const n = fbm3(out.x * 40, out.y * 40, out.z * 40, 2, 7) * 0.0012;
      out.z += out.z > 0 ? n : -n;
    },
    cor(u, v) {
      // vales (cantos de dentro) um pouco mais escuros; a borda gasta um pouco mais clara
      const vale = 0.5 + 0.5 * Math.cos(u * PONTAS * Math.PI * 2); // 1 nas pontas, 0 nos cantos de dentro
      const s = v <= 0.45 ? v / 0.45 : v >= 0.55 ? (1 - v) / 0.45 : 1;
      const k = 0.82 + 0.18 * vale * (0.4 + 0.6 * s);
      return [COR.ouro[0] * k, COR.ouro[1] * k, COR.ouro[2] * k];
    },
    acab(u, v) {
      const s = v <= 0.45 ? v / 0.45 : v >= 0.55 ? (1 - v) / 0.45 : 1;
      // centro mais polido (onde se pega), borda mais fosca
      return [1, 0.36 + 0.1 * s + 0.3 * Math.max(0, 1 - s * 5) + 0.04 * Math.sin(u * 37), 0, 0];
    },
    uv: (u, v) => [u * 1.2, v * 0.4],
  });

  // laço de cetim vermelho na ponta de cima (sem alça: a estrela fica grande no cubo de 1 m)
  const fita = new Molde();
  const topo = RE * 0.9;
  laco(
    fita,
    { largura: 0.1, fita: 0.02, pontas: 0.75, queda: 0.4, cheio: 0.35, inclina: 0.45, ladrilho: 0.08, k: q.k },
    7,
    new THREE.Matrix4().makeTranslation(0, topo + 0.004, BORDA + 0.006),
    COR.vermelho,
    [0, 0.36, 0, 0],
  );

  return {
    partes: [
      { nome: 'metal', material: 'metal', molde: metal },
      { nome: 'fita', material: 'cetim', molde: fita },
    ],
  };
};
