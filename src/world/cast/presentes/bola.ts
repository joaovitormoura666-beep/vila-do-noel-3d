/**
 * BOLA DE NATAL: bola de vidro soprado laqueada em vermelho profundo, pintada à mão (flocos creme e
 * pontinhos dourados), com uma faixa dourada em relevo no equador (dois fios trançados entre dois
 * filetes), capacete de latão canelado com a argola de arame e um laço de cetim verde.
 * Duas malhas: a bola com o metal (a estampa só pinta a bola; o metal lê a cor do vértice) e o cetim.
 */
import * as THREE from 'three';
import { elipsoide, Molde, quadros, torno, tubo } from './malha';
import { ACAB, argola, COR, laco } from './pecas';
import { USO_ESTAMPA, V_BRANCO } from './texturas';
import { div, type Moldar } from './tipos';

const R = 0.1;

export const moldarBola: Moldar = (q) => {
  const bola = new Molde();
  // corpo: esfera (um nada achatada), laca brilhante; v de baixo (0) a cima (1)
  bola.adicionar({
    nu: div(q, 46, 24),
    nv: div(q, 30, 16),
    ponto: elipsoide(new THREE.Vector3(0, 0, 0), R, R * 0.97, R),
    uv: (u, v) => [u, v * USO_ESTAMPA],
    cor: () => [1, 1, 1],
    // laca: verniz cheio; o vidro aparece no reflexo nítido
    acab: () => [0, 0.22, 1, 0],
  });

  const ouro = COR.ouro;
  const branco = (): readonly [number, number] => [0.5, V_BRANCO];
  // faixa em relevo no equador: dois fios trançados entre dois filetes lisos
  const raioNa = (y: number) => Math.sqrt(Math.max(0, R * R - (y / 0.97) * (y / 0.97)));
  const voltas = div(q, 84, 48);
  const fio = (y0: number, onda: number, fase: number, r: number) => {
    const q0 = quadros((t, out) => {
      const a = t * Math.PI * 2;
      const y = y0 + Math.sin(a * 14 + fase) * onda;
      const rr = raioNa(y) + r * 0.45;
      out.set(Math.sin(a) * rr, y, Math.cos(a) * rr);
    }, voltas);
    bola.adicionar({ nu: onda > 0 ? 6 : 5, nv: onda > 0 ? voltas : Math.round(voltas * 0.6), ponto: tubo(q0, () => [r, r]), uv: branco, cor: () => ouro, acab: () => ACAB.ouro });
  };
  fio(0, 0.0045, 0, 0.0032);
  fio(0, 0.0045, Math.PI, 0.0032);
  fio(0.0125, 0, 0, 0.0021);
  fio(-0.0125, 0, 0, 0.0021);

  // capacete canelado: aba que abraça o vidro, corpo com caneluras e tampo abaulado
  const yBase = R * 0.97 - 0.008;
  const perfil = (v: number): readonly [number, number] => {
    if (v < 0.15) return [0.028 - v * 0.02, yBase - 0.004 + v * 0.03];
    if (v < 0.7) return [0.0255, yBase + 0.0005 + (v - 0.15) * 0.038];
    const a = ((v - 0.7) / 0.3) * Math.PI * 0.5;
    return [0.0255 * Math.cos(a) + 0.0005, yBase + 0.021 + Math.sin(a) * 0.006];
  };
  bola.adicionar({
    nu: div(q, 36, 20),
    nv: div(q, 11, 8),
    ponto: torno(perfil, (u, v) => (v > 0.12 && v < 0.75 ? Math.pow(Math.abs(Math.cos(u * Math.PI * 18)), 0.6) * 0.06 - 0.03 : 0)),
    uv: branco,
    cor: (_u, v) => (v < 0.15 ? [ouro[0] * 0.85, ouro[1] * 0.85, ouro[2] * 0.85] : ouro),
    acab: () => ACAB.ouroGasto,
  });
  // argola de arame no topo
  argola(bola, new THREE.Vector3(0, yBase + 0.036, 0), 0.0095, 0.0016, ouro, ACAB.ouro, 0, q.k, [0.5, V_BRANCO]);

  // laço de cetim verde na frente do capacete
  const fita = new Molde();
  laco(
    fita,
    { largura: 0.075, fita: 0.016, pontas: 0.7, queda: 0.4, cheio: 0.3, inclina: 0.4, ladrilho: 0.08, k: q.k },
    3,
    new THREE.Matrix4().makeTranslation(0, yBase + 0.016, 0.026),
    COR.verdeClaro,
    [0, 0.38, 0, 0],
  );

  return {
    partes: [
      { nome: 'bola', material: 'bola', molde: bola },
      { nome: 'fita', material: 'cetim', molde: fita },
    ],
  };
};
