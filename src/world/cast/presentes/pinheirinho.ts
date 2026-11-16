/**
 * PINHEIRINHO: abeto de mesa num vaso de cerâmica vermelha esmaltada com filete creme e terra escura. A
 * copa é feita dos MESMOS ramos de abeto da árvore da sala (leques assados agulha por agulha, atlas 3 x 3,
 * em cartões recortados com borda suave), em andares que diminuem para cima, inclinados e torcidos para
 * lerem cheios de qualquer ângulo, mais escuros por dentro. Enfeitado com bolinhas vermelhas e douradas e
 * uma estrelinha de latão na ponta.
 * Duas malhas: a folhagem (cartões) e o resto (vaso, terra, tronco, bolinhas e estrela).
 */
import * as THREE from 'three';
import { type Cor, Molde, quadros, torno, tubo } from './malha';
import { ACAB, COR, esfera, ruido } from './pecas';
import { div, type Moldar } from './tipos';
import { criarSorteio } from '../noel/util';

const VASO_ALTURA = 0.085;
const BASE_COPA = 0.1;
const TOPO = 0.4;

/** Cartão de um ramo: faixa com 3 trechos ao longo, vergando; `celula` escolhe o ramo do atlas. */
function ramo(m: Molde, base: THREE.Vector3, frente: THREE.Vector3, cima: THREE.Vector3, comp: number, larg: number, celula: number, verga: number, corBase: Cor, corPonta: Cor) {
  const col = celula % 3;
  const lin = Math.floor(celula / 3);
  const u0 = col / 3 + 0.02;
  const u1 = (col + 1) / 3 - 0.02;
  const v0 = 1 - (lin + 1) / 3 + 0.01;
  const v1 = 1 - lin / 3 - 0.01;
  const lado = new THREE.Vector3().crossVectors(frente, cima).normalize();
  const normal = new THREE.Vector3().crossVectors(lado, frente).normalize();
  const n = 4;
  const p = new THREE.Vector3();
  const ini = m.vertices;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const cor: Cor = [corBase[0] + (corPonta[0] - corBase[0]) * t, corBase[1] + (corPonta[1] - corBase[1]) * t, corBase[2] + (corPonta[2] - corBase[2]) * t];
    for (const s of [-1, 1]) {
      p.copy(base)
        .addScaledVector(frente, comp * t)
        .addScaledVector(normal, -verga * comp * t * t)
        .addScaledVector(lado, s * larg * 0.5 * (0.75 + 0.25 * Math.sin(Math.PI * Math.min(1, t * 1.3))))
        // o leque é um nada abaulado (as bordas descem)
        .addScaledVector(normal, -0.08 * larg * (1 - t * 0.5));
      m.vertice(p, normal, s < 0 ? u0 : u1, v0 + (v1 - v0) * t, cor, [0, 0.75, 0, 0]);
    }
  }
  for (let i = 0; i < n; i++) {
    const a = ini + i * 2;
    m.idx.push(a, a + 1, a + 3, a, a + 3, a + 2);
  }
}

export const moldarPinheirinho: Moldar = (q) => {
  const folhas = new Molde();
  const r = criarSorteio(57);
  const andares = Math.max(6, Math.round(10 * Math.sqrt(q.k)));
  const cima = new THREE.Vector3();
  const frente = new THREE.Vector3();
  const escuro: Cor = [0.32, 0.36, 0.3];
  const claro: Cor = [1.0, 1.02, 0.92];
  for (let k = 0; k < andares; k++) {
    const f = k / (andares - 1);
    const y = BASE_COPA + f * (TOPO - BASE_COPA - 0.06);
    const raio = 0.145 * Math.pow(1 - f, 0.9) + 0.025;
    const n = Math.max(5, Math.round((7 + raio * 70) * Math.sqrt(q.k)));
    const giro = r() * Math.PI * 2;
    const luz = 0.55 + 0.45 * f; // os de baixo ficam mais escuros
    for (let i = 0; i < n; i++) {
      const a = giro + (i / n) * Math.PI * 2 + (r() - 0.5) * 0.4;
      const sobe = 0.25 + 0.35 * r() + f * 0.25;
      frente.set(Math.sin(a) * Math.cos(sobe), Math.sin(sobe), Math.cos(a) * Math.cos(sobe)).normalize();
      // torção: alguns leques ficam de pé (aparecem de lado), outros deitados
      const torcao = (r() - 0.5) * 1.6;
      cima.set(0, 1, 0).addScaledVector(frente, -frente.y).normalize().applyAxisAngle(frente, torcao);
      const base = new THREE.Vector3(Math.sin(a) * 0.008, y + (r() - 0.5) * 0.02, Math.cos(a) * 0.008);
      const comp = raio * (1.05 + r() * 0.2);
      const celula = [0, 1, 2, 3, 6, 7][Math.floor(r() * 6)];
      ramo(folhas, base, frente, cima, comp, comp * 0.8, celula, 0.25 + r() * 0.2, [escuro[0] * luz, escuro[1] * luz, escuro[2] * luz], [claro[0] * luz, claro[1] * luz, claro[2] * luz]);
    }
  }
  // ponta: dois ramos estreitos de pé e o miolo escuro cruzado (fecha a vista do tronco)
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI;
    frente.set(Math.sin(a) * 0.15, 1, Math.cos(a) * 0.15).normalize();
    cima.set(Math.cos(a), 0, -Math.sin(a));
    ramo(folhas, new THREE.Vector3(0, TOPO - 0.085, 0), frente, cima, 0.09, 0.05, 4 + (i % 2), 0.05, escuro, claro);
  }
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI + 0.3;
    frente.set(0, 1, 0);
    cima.set(Math.cos(a), 0, -Math.sin(a));
    ramo(folhas, new THREE.Vector3(0, BASE_COPA - 0.01, 0), frente, cima, TOPO - BASE_COPA - 0.06, 0.12, 8, 0, [0.2, 0.22, 0.18], [0.45, 0.48, 0.4]);
  }

  /* ----------------------------------------------------------- vaso e enfeites */
  const resto = new Molde();
  const vermelho = COR.vermelho;
  resto.adicionar({
    nu: div(q, 40, 18),
    nv: div(q, 22, 10),
    ponto: torno((v) => {
      // fundo, parede cônica, boca virada (rolo) e o lado de dentro até a terra
      if (v < 0.12) return [0.05 * (v / 0.12), 0.002];
      if (v < 0.7) {
        const t = (v - 0.12) / 0.58;
        return [0.05 + t * 0.018, t * (VASO_ALTURA - 0.012)];
      }
      if (v < 0.9) {
        const a = ((v - 0.7) / 0.2) * Math.PI;
        return [0.068 + Math.sin(a) * 0.008, VASO_ALTURA - 0.012 + (1 - Math.cos(a)) * 0.006];
      }
      return [0.068 - ((v - 0.9) / 0.1) * 0.006, VASO_ALTURA - 0.004 - ((v - 0.9) / 0.1) * 0.01];
    }),
    cor(_u, v) {
      const t = (v - 0.12) / 0.58;
      // filete creme pintado na parede
      if (v > 0.12 && v < 0.7 && t > 0.62 && t < 0.72) return COR.creme;
      return v >= 0.9 ? [vermelho[0] * 0.5, vermelho[1] * 0.5, vermelho[2] * 0.5] : vermelho;
    },
    acab: () => ACAB.esmalte,
  });
  // terra escura com torrões
  resto.adicionar({
    nu: div(q, 24, 12),
    nv: 4,
    ponto(u, v, out) {
      const a = u * Math.PI * 2;
      const rr = 0.063 * v;
      out.set(Math.sin(a) * rr, VASO_ALTURA - 0.012 + (1 - v) * 0.006 + ruido(Math.sin(a) * rr * 80, 0, Math.cos(a) * rr * 80, 3) * 0.003, Math.cos(a) * rr);
    },
    cor: () => [0.05, 0.03, 0.02],
    acab: () => ACAB.rugoso,
  });
  // tronco
  const tq = quadros((t, out) => out.set(0, VASO_ALTURA - 0.015 + t * 0.12, 0), 4);
  resto.adicionar({ nu: 8, nv: 4, ponto: tubo(tq, (_u, v) => [0.009 - v * 0.004, 0.009 - v * 0.004]), cor: () => [0.12, 0.06, 0.03], acab: () => ACAB.rugoso });
  // bolinhas penduradas nas pontas dos andares
  const sb = criarSorteio(77);
  const bolas = Math.round(11 * Math.sqrt(q.k)) + 3;
  for (let i = 0; i < bolas; i++) {
    const f = 0.06 + (i / bolas) * 0.8;
    const y = BASE_COPA + f * (TOPO - BASE_COPA - 0.07);
    const raio = (0.145 * Math.pow(1 - f, 0.9) + 0.025) * 0.92;
    const a = i * 2.39996 + sb() * 0.3;
    const ouro = i % 3 === 1;
    esfera(resto, new THREE.Vector3(Math.sin(a) * raio, y - 0.012, Math.cos(a) * raio), 0.0105 + sb() * 0.003, div(q, 12, 8), div(q, 8, 6), ouro ? COR.ouro : [0.5, 0.03, 0.04], ouro ? ACAB.ouro : ACAB.laca);
  }
  // estrela de latão na ponta (plana, com chanfro)
  const forma = new THREE.Shape();
  for (let i = 0; i <= 10; i++) {
    const a = Math.PI / 2 + (i / 10) * Math.PI * 2;
    const rr = i % 2 === 0 ? 0.03 : 0.013;
    if (i === 0) forma.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    else forma.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  const estrela = new THREE.ExtrudeGeometry(forma, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2, curveSegments: 4 });
  // latão mais escuro e áspero que o das bolinhas: a estrela pega o foco de frente e não pode estourar
  resto.juntar(estrela, new THREE.Matrix4().makeTranslation(0, TOPO + 0.005, -0.002), [COR.ouro[0] * 0.62, COR.ouro[1] * 0.62, COR.ouro[2] * 0.62], [1, 0.62, 0, 0]);
  estrela.dispose();

  return {
    partes: [
      { nome: 'folhagem', material: 'folhagem', molde: folhas, sombra: true },
      { nome: 'vaso', material: 'esmalte', molde: resto },
    ],
  };
};
