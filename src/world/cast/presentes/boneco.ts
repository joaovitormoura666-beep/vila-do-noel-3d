/**
 * BONECO DE NEVE: três bolas de neve compactada à mão (irregulares, com a emenda marcada onde uma assenta
 * na outra e a neve com grão e brilho de cristal), olhos e sorriso de pedrinhas de carvão, nariz de
 * cenoura com anéis, botões de carvão, bracinhos de graveto com forquilha, gorro de tricô vermelho com
 * barra dobrada e pompom, cachecol de tricô verde com listras creme e franjas.
 * Três malhas: neve, tricô (gorro e cachecol) e os "achados" (carvão, cenoura, gravetos).
 */
import * as THREE from 'three';
import { type Cor, elipsoide, Molde, quadros, tubo } from './malha';
import { COR, esfera, ruido } from './pecas';
import { div, type Moldar } from './tipos';
import { criarSorteio } from '../noel/util';

const BOLAS = [
  { c: new THREE.Vector3(0, 0.1, 0), r: 0.105 },
  { c: new THREE.Vector3(0.004, 0.245, 0.004), r: 0.079 },
  { c: new THREE.Vector3(-0.003, 0.365, 0.008), r: 0.066 },
];
const NEVE: Cor = [0.66, 0.7, 0.78];

export const moldarBoneco: Moldar = (q) => {
  const neve = new Molde();
  BOLAS.forEach((b, i) => {
    neve.adicionar({
      nu: div(q, 30, 16),
      nv: div(q, 20, 12),
      ponto: elipsoide(b.c, b.r, b.r * 0.94, b.r, (_u, v, d) => {
        // neve apertada à mão: calombos largos e o fundo assentado
        let k = ruido(d.x * 3 + i, d.y * 3, d.z * 3, 11) * 0.06 + ruido(d.x * 9, d.y * 9 + i, d.z * 9, 12) * 0.018;
        if (v < 0.2) k -= (0.2 - v) * 0.25;
        return k;
      }),
      cor(_u, _v, p) {
        // emenda: escurece onde as bolas se encostam (oclusão) e um azulado nas sombras de baixo
        let s = 1;
        for (let j = 0; j < BOLAS.length; j++) {
          if (j === i) continue;
          const d = p.distanceTo(BOLAS[j].c) - BOLAS[j].r;
          s = Math.min(s, 0.55 + 0.45 * THREE.MathUtils.smoothstep(d, -0.005, 0.035));
        }
        const baixo = THREE.MathUtils.smoothstep(p.y - b.c.y, -b.r, b.r * 0.5);
        return [NEVE[0] * s * (0.92 + 0.08 * baixo), NEVE[1] * s * (0.94 + 0.06 * baixo), NEVE[2] * s];
      },
      acab: () => [0, 0.78, 0.15, 0],
    });
  });

  /* ------------------------------------------------------------------ achados */
  const achados = new Molde();
  const s = criarSorteio(41);
  const carvao: Cor = [0.035, 0.03, 0.03];
  const pedrinha = (p: THREE.Vector3, r: number) =>
    achados.adicionar({
      nu: div(q, 8, 6),
      nv: div(q, 6, 5),
      ponto: elipsoide(p, r, r * 0.85, r * 0.7, (_u, _v, d) => ruido(d.x * 4 + p.x * 50, d.y * 4, d.z * 4, 3) * 0.25),
      cor: () => carvao,
      acab: () => [0, 0.55, 0.3, 0],
    });
  const cabeca = BOLAS[2];
  const naCabeca = (az: number, el: number, fora = 0) => {
    const d = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
    return cabeca.c.clone().addScaledVector(d, cabeca.r * 0.97 + fora);
  };
  pedrinha(naCabeca(-0.36, 0.22), 0.0085);
  pedrinha(naCabeca(0.36, 0.22), 0.0085);
  for (let k = 0; k < 5; k++) {
    const a = -0.5 + k * 0.25;
    pedrinha(naCabeca(a, -0.3 - Math.cos(a * 2.2) * 0.12), 0.005 + s() * 0.0015);
  }
  // botões no corpo do meio
  for (let k = 0; k < 3; k++) {
    const el = 0.42 - k * 0.38;
    const d = new THREE.Vector3(0.05 * (k - 1), Math.sin(el), Math.cos(el)).normalize();
    pedrinha(BOLAS[1].c.clone().addScaledVector(d, BOLAS[1].r * 0.97), 0.0095);
  }
  // nariz de cenoura: cone torto com anéis, laranja vivo
  const base = naCabeca(0, 0.02, -0.006);
  const nq = quadros((t, out) => out.set(base.x + t * t * 0.006, base.y - t * 0.006, base.z + t * 0.07), 16);
  const laranja: Cor = [0.85, 0.27, 0.035];
  achados.adicionar({
    nu: div(q, 12, 8),
    nv: 16,
    ponto: tubo(nq, (_u, v) => {
      const r = 0.012 * (1 - v * 0.92) * (1 + Math.sin(v * 38) * 0.05);
      return [r, r];
    }),
    cor: (_u, v) => [laranja[0] * (0.85 + 0.2 * v), laranja[1] * (0.85 + 0.2 * v), laranja[2]],
    acab: () => [0, 0.5, 0.35, 0],
  });
  // gravetos: galho com uma forquilha e dois dedinhos, saindo do corpo do meio
  const marrom: Cor = [0.13, 0.075, 0.04];
  const graveto = (pts: THREE.Vector3[], r0: number) => {
    const curva = new THREE.CatmullRomCurve3(pts);
    const gq = quadros((t, out) => curva.getPoint(t, out), 14);
    achados.adicionar({
      nu: 5,
      nv: 10,
      ponto: tubo(gq, (_u, v) => [r0 * (1 - v * 0.65), r0 * (1 - v * 0.65)], undefined, 0.04),
      cor: () => marrom,
      acab: () => [0, 0.85, 0, 0],
    });
  };
  for (const lado of [-1, 1]) {
    const o = BOLAS[1].c.clone().add(new THREE.Vector3(lado * BOLAS[1].r * 0.85, 0.01, 0));
    const meio = o.clone().add(new THREE.Vector3(lado * 0.07, 0.035 + (lado > 0 ? 0.02 : -0.01), 0.01));
    const ponta = o.clone().add(new THREE.Vector3(lado * 0.13, 0.085 + (lado > 0 ? 0.03 : -0.005), 0.015));
    graveto([o, meio, ponta], 0.0045);
    graveto([meio, meio.clone().add(new THREE.Vector3(lado * 0.025, 0.045, -0.005))], 0.0028);
    graveto([ponta.clone().lerp(meio, 0.3), ponta.clone().add(new THREE.Vector3(lado * 0.03, -0.004, 0.01))], 0.002);
  }

  /* -------------------------------------------------------------------- tricô */
  const trico = new Molde();
  // gorro: copa mole com a ponta caída para o lado e barra dobrada canelada
  const topoCab = cabeca.c.clone();
  const ver = COR.vermelho;
  const gq = quadros((t, out) => {
    out.set(topoCab.x - Math.sin(t * 1.4) * t * 0.045, topoCab.y + 0.042 + t * 0.075 - t * t * 0.03, topoCab.z - t * 0.012);
  }, 20);
  trico.adicionar({
    nu: div(q, 22, 12),
    nv: 16,
    ponto: tubo(gq, (u, v) => {
      const r = 0.058 * Math.pow(1 - v, 0.75) * (1 + Math.sin(u * Math.PI * 2 * 3 + v * 4) * 0.025 * (1 - v)) + 0.004;
      return [r, r * 0.97];
    }),
    cor: (_u, v) => [ver[0] * (0.8 + 0.2 * v), ver[1] * (0.8 + 0.2 * v), ver[2] * (0.8 + 0.2 * v)],
  });
  // barra dobrada: anel grosso canelado em volta da testa
  trico.adicionar({
    nu: div(q, 30, 16),
    nv: 5,
    ponto(u, v, out) {
      const a = u * Math.PI * 2;
      const canelado = 1 + Math.pow(Math.abs(Math.cos(a * 14)), 0.5) * 0.04;
      const ang = v * Math.PI * 2;
      const R = 0.058 * canelado + Math.cos(ang) * 0.0075;
      out.set(topoCab.x + Math.sin(a) * R, topoCab.y + 0.04 + Math.sin(ang) * 0.011, topoCab.z + Math.cos(a) * R);
    },
    cor: () => [ver[0] * 0.92, ver[1] * 0.92, ver[2] * 0.92],
  });
  // pompom creme na ponta caída
  const ponta = gq.pontos[gq.pontos.length - 1];
  esfera(trico, ponta.clone().add(new THREE.Vector3(-0.01, -0.005, 0)), 0.021, div(q, 16, 8), div(q, 12, 6), COR.creme);

  // cachecol verde com listras creme: volta no pescoço e duas pontas caídas com franja
  const pescoco = BOLAS[1].c.clone().lerp(cabeca.c, 0.6);
  const verde = COR.verdeClaro;
  const listra = (s: number): Cor => (Math.sin(s * 95) > 0.55 ? COR.creme : verde);
  trico.adicionar({
    nu: div(q, 30, 16),
    nv: 6,
    ponto(u, v, out) {
      const a = u * Math.PI * 2;
      const ang = v * Math.PI * 2;
      const R = 0.064 + Math.cos(ang) * 0.011 + Math.sin(a * 3) * 0.002;
      out.set(pescoco.x + Math.sin(a) * R, pescoco.y + Math.sin(ang) * 0.016 - Math.cos(a) * 0.006, pescoco.z + Math.cos(a) * R);
    },
    cor: (u) => listra(u * 0.4),
  });
  for (const [dx, cai, gira] of [
    [0.03, 0.12, 0.15],
    [0.055, 0.09, -0.25],
  ] as const) {
    const o = pescoco.clone().add(new THREE.Vector3(dx, -0.004, 0.058));
    const cq = quadros((t, out) => out.set(o.x + t * 0.025 + Math.sin(t * 3) * 0.006, o.y - t * cai, o.z + Math.sin(t * Math.PI) * 0.02 + t * 0.012), 12, new THREE.Vector3(0, 0, 1));
    trico.adicionar({
      nu: 8,
      nv: 12,
      ponto: tubo(cq, (u, v) => [0.0045 + Math.abs(Math.sin(u * Math.PI * 2)) * 0.0005, 0.017 * (1 + v * 0.1)], () => gira),
      cor: (_u, v) => listra(v * 0.11 + dx),
    });
    // franja: fiozinhos na ponta
    const fim = cq.pontos[cq.pontos.length - 1];
    for (let f = 0; f < 4; f++) {
      const x0 = fim.x + (f - 1.5) * 0.0075 * Math.cos(gira);
      const fq = quadros((t, out) => out.set(x0 + t * 0.002 * (f - 2), fim.y - t * 0.018, fim.z + (f - 2) * 0.0065 * Math.sin(gira) + t * 0.002), 4);
      trico.adicionar({ nu: 5, nv: 4, ponto: tubo(fq, () => [0.0018, 0.0018], undefined, 0.2), cor: () => verde });
    }
  }

  return {
    partes: [
      { nome: 'neve', material: 'neve', molde: neve },
      { nome: 'trico', material: 'trico', molde: trico },
      { nome: 'achados', material: 'madeira', molde: achados },
    ],
  };
};
