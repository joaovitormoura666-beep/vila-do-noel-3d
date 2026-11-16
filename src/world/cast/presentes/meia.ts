/**
 * MEIA NATALINA: meia de tricô de lã (cada ponto com a sua cor, em jacquard: faixa verde com pinheirinhos
 * creme, flocos no meio da perna, calcanhar e biqueira verdes; o relevo de meia-malha casa ponto a ponto
 * com a cor), forma de pano mole (achatada, perna um pouco torta, pé cheio e caído), punho de pelúcia
 * branca em cascas, alça de cetim para pendurar e um guizo de latão costurado no punho.
 * Quatro malhas: tricô, pelúcia, cetim e o guizo.
 */
import * as THREE from 'three';
import { Molde, quadros, tubo } from './malha';
import { ACAB, COR, esfera, fitaPlana, laco, ruido } from './pecas';
import { MEIA_CARREIRAS, MEIA_COLUNAS } from './texturas';
import { div, type Moldar } from './tipos';

/** Linha do meio da meia: desce pela perna e vira no pé para +X. t = 0 no punho, 1 no bico. */
function linha(t: number, out: THREE.Vector3) {
  const perna = 0.62;
  if (t <= perna) {
    const s = t / perna;
    out.set(-0.012 * Math.sin(s * Math.PI), 0.15 - s * 0.24, 0);
    return;
  }
  // calcanhar: curva de 90 graus; depois o pé vai para +X e cai um pouco
  const s = (t - perna) / (1 - perna);
  const R = 0.065;
  const a = Math.min(1, s / 0.45) * (Math.PI / 2);
  const cx = R;
  const cy = -0.09;
  if (s <= 0.45) {
    out.set(cx - Math.cos(a) * R, cy - Math.sin(a) * R, 0);
    return;
  }
  const f = (s - 0.45) / 0.55;
  out.set(cx + f * 0.1, cy - R - f * 0.008, 0);
}

export const moldarMeia: Moldar = (q) => {
  const trico = new Molde();
  const nv = div(q, 48, 24);
  const lq = quadros(linha, nv, new THREE.Vector3(-1, 0, 0));
  // u = 0,5 atrás (lado do calcanhar). A seção é larga (x) e achatada (z), com barriga no meio do pé
  trico.adicionar({
    nu: div(q, 32, 16),
    nv,
    ponto: tubo(
      lq,
      (u, v) => {
        const a = u * Math.PI * 2;
        const largura = 0.062 * (1 + 0.12 * Math.sin(Math.PI * Math.min(1, v * 1.4))) * (v > 0.6 ? 1.06 : 1);
        // pé: calcanhar cheio e bico redondo (o fecho faz a calota)
        const fecho = v > 0.86 ? Math.sqrt(Math.max(0, 1 - ((v - 0.86) / 0.14) ** 2)) : 1;
        const rug = 1 + ruido(Math.cos(a) * 2, Math.sin(a) * 2, v * 9, 4) * 0.035;
        return [largura * fecho * rug, 0.026 * (1 + 0.25 * Math.sin(Math.PI * v)) * Math.max(0.35, fecho) * rug];
      },
      () => Math.PI,
    ),
    // u = coluna, v = carreira (a textura sobe com v: 1 no punho)
    uv: (u, v) => [u, 1 - v],
    cor: (_u, v) => {
      const k = 0.88 + 0.12 * Math.sin(Math.PI * Math.min(1, v * 1.2));
      return [k, k, k];
    },
  });
  // a alça: tira de tricô? não: fita de cetim (abaixo)

  /* ----------------------------------------------------------------- punho */
  const pelo = new Molde();
  const topo = lq.pontos[0];
  pelo.adicionar({
    nu: div(q, 28, 14),
    nv: div(q, 8, 6),
    ponto(u, v, out) {
      const a = u * Math.PI * 2;
      const ang = v * Math.PI * 2;
      // anel grosso e mole (seção de gota), um pouco mais largo que a perna
      const rx = 0.071 + Math.cos(ang) * 0.012;
      const rz = 0.036 + Math.cos(ang) * 0.012;
      const onda = 1 + ruido(Math.cos(a) * 2, Math.sin(a) * 2, v * 3, 8) * 0.06;
      out.set(topo.x + Math.cos(a) * rx * onda, topo.y - 0.018 + Math.sin(ang) * 0.034 + Math.sin(a * 3) * 0.002, topo.z + Math.sin(a) * rz * onda);
    },
    cor: (_u, _v, p) => {
      const k = 0.86 + 0.08 * ruido(p.x * 40, p.y * 40, p.z * 40, 6);
      return [0.86 * k, 0.84 * k, 0.8 * k];
    },
    pelo: (_u, _v, p) => [0.0085, 1, (p.x * 13) % 1],
  });

  /* ------------------------------------------------------------ alça e guizo */
  const fita = new Molde();
  const caminho: THREE.Vector3[] = [];
  const lado: THREE.Vector3[] = [];
  const n = div(q, 24, 12);
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI;
    caminho.push(new THREE.Vector3(topo.x - 0.07 + Math.cos(a) * -0.02 + 0.02, topo.y + 0.01 + Math.sin(a) * 0.05, -0.004));
    lado.push(new THREE.Vector3(0, 0, 1));
  }
  fitaPlana(fita, caminho, lado, 0.014, COR.verdeClaro, ACAB.fosco, 0.06);
  laco(fita, { largura: 0.07, fita: 0.014, pontas: 0.7, queda: 0.4, cheio: 0.3, inclina: 0.45, ladrilho: 0.06, k: q.k }, 29, new THREE.Matrix4().makeTranslation(0.03, topo.y - 0.02, 0.052), COR.verdeClaro);

  const guizo = new Molde();
  const pg = new THREE.Vector3(0.03, topo.y - 0.04, 0.052);
  esfera(guizo, pg, 0.012, div(q, 16, 10), div(q, 12, 8), COR.ouro, ACAB.ouro);
  // fenda do guizo (riscado escuro) e a argolinha
  guizo.adicionar({
    nu: 8,
    nv: 6,
    ponto(u, v, out) {
      const a = u * Math.PI * 2;
      out.set(pg.x + Math.cos(a) * 0.0012, pg.y - 0.004 + (v - 0.5) * 0.002, pg.z + 0.0118 + Math.sin(a) * 0.0006);
      out.x += (v - 0.5) * 0.012;
    },
    cor: () => [0.05, 0.04, 0.02],
    acab: () => [1, 0.6, 0, 0],
  });

  return {
    partes: [
      { nome: 'trico', material: 'meia', molde: trico },
      { nome: 'punho', material: 'pelucia', molde: pelo, cascas: true },
      { nome: 'fita', material: 'cetim', molde: fita },
      { nome: 'guizo', material: 'metal', molde: guizo },
    ],
  };
};

export { MEIA_CARREIRAS, MEIA_COLUNAS };
