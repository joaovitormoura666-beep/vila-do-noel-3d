/**
 * TRENZINHO DE BRINQUEDO: locomotiva a vapor de madeira torneada e pintada à mão (vermelho, verde-pinheiro
 * e creme, tinta acetinada com o veio aparecendo por baixo), cintas e domo de latão, chaminé em balão
 * preta com a boca dourada, cabine com janelas emolduradas, telhado curvo, limpa-trilhos, farol com a
 * lente acesa (fraca) e seis rodas vermelhas com cubo dourado, ligadas pelas bielas.
 *
 * ANIMAÇÃO (userData.update): as rodas giram (como se rodasse no lugar), as bielas acompanham e a
 * locomotiva balança de leve no ritmo. Nada é alocado por quadro (matrizes reaproveitadas).
 * Três malhas: corpo, rodas (instanciadas, 6) e bielas (instanciadas, 2). De frente para +X.
 */
import * as THREE from 'three';
import { type Acab, type Cor, Molde, quadros, torno, tubo } from './malha';
import { ACAB, COR, esfera, superelipsoide } from './pecas';
import { div, type Moldar } from './tipos';

const VERMELHO: Cor = [0.47, 0.022, 0.034];
const VERDE: Cor = [0.01, 0.075, 0.045];
const CREME: Cor = [0.55, 0.45, 0.32];
const PRETO: Cor = [0.025, 0.022, 0.022];
const TINTA: Acab = [0, 0.55, 0.28, 0];

const RODA = 0.033;
const RODAS_X = [-0.085, -0.012, 0.062];
const BITOLA = 0.052; // meia distância entre as rodas de um lado e do outro
const MANIVELA = 0.014;

export const moldarTrenzinho: Moldar = (q) => {
  const corpo = new Molde();
  const caixa = (c: THREE.Vector3, rx: number, ry: number, rz: number, e: number, cor: Cor, acab = TINTA, nu = 16, nv = 10) =>
    corpo.adicionar({ nu: div(q, nu, 10), nv: div(q, nv, 8), ponto: superelipsoide(c, rx, ry, rz, e), cor: () => cor, acab: () => acab });

  // chassi verde e o para-choque vermelho na frente
  caixa(new THREE.Vector3(0, 0.05, 0), 0.135, 0.015, 0.044, 0.22, VERDE);
  caixa(new THREE.Vector3(0.14, 0.05, 0), 0.008, 0.016, 0.05, 0.3, VERMELHO);
  // caldeira vermelha: cilindro deitado ao longo de X, de nariz arredondado
  const cq = quadros((t, out) => out.set(-0.035 + t * 0.16, 0.103, 0), 12);
  corpo.adicionar({
    nu: div(q, 22, 12),
    nv: 10,
    ponto: tubo(cq, () => [0.043, 0.043], undefined, 0.06),
    cor: (_u, v) => (v > 0.94 ? PRETO : VERMELHO),
    acab: (_u, v) => (v > 0.94 ? [0, 0.6, 0.2, 0] : TINTA),
  });
  // cintas de latão em volta da caldeira
  for (const x of [-0.005, 0.045, 0.095]) {
    const anel = new THREE.TorusGeometry(0.0445, 0.0035, 5, div(q, 24, 14));
    corpo.juntar(anel, new THREE.Matrix4().makeRotationY(Math.PI / 2).setPosition(x, 0.103, 0), COR.ouro, ACAB.ouro);
    anel.dispose();
  }
  // aro dourado da frente
  {
    const anel = new THREE.TorusGeometry(0.03, 0.003, 5, div(q, 22, 12));
    corpo.juntar(anel, new THREE.Matrix4().makeRotationY(Math.PI / 2).setPosition(0.124, 0.103, 0), COR.ouro, ACAB.ouro);
    anel.dispose();
  }
  // chaminé em balão
  const chamine = new THREE.Vector3(0.09, 0.14, 0);
  corpo.adicionar({
    nu: div(q, 20, 10),
    nv: 12,
    ponto(u, v, out) {
      const a = u * Math.PI * 2;
      const y = v * 0.062;
      let r = 0.0125 + Math.pow(v, 2.2) * 0.012;
      if (v > 0.9) r += (v - 0.9) * 0.05;
      if (v > 0.98) r *= 0.8;
      out.set(chamine.x + Math.sin(a) * r, chamine.y + y, chamine.z + Math.cos(a) * r);
    },
    cor: (_u, v) => (v > 0.88 ? COR.ouro : PRETO),
    acab: (_u, v) => (v > 0.88 ? ACAB.ouro : [0, 0.55, 0.3, 0]),
  });
  // domo de latão e o apito
  esfera(corpo, new THREE.Vector3(0.035, 0.143, 0), 0.019, div(q, 16, 10), div(q, 10, 8), COR.ouro, ACAB.ouro, [1, 0.8, 1]);
  esfera(corpo, new THREE.Vector3(-0.012, 0.15, 0), 0.007, 10, 8, COR.ouro, ACAB.ouro, [1, 1.6, 1]);
  // farol: caixinha preta com a lente acesa
  caixa(new THREE.Vector3(0.118, 0.155, 0), 0.012, 0.012, 0.012, 0.3, PRETO, [0, 0.5, 0.3, 0], 12, 10);
  esfera(corpo, new THREE.Vector3(0.131, 0.155, 0), 0.0085, 12, 8, [1, 0.72, 0.38], [0, 0.2, 1, 0.55], [0.5, 1, 1]);
  // limpa-trilhos: cunha vermelha com frisos
  corpo.adicionar({
    nu: 4,
    nv: 6,
    fechadoU: false,
    ponto(u, v, out) {
      const z = (v - 0.5) * 0.09;
      const x = 0.148 + u * 0.03 * (1 - Math.abs(v - 0.5) * 1.3);
      out.set(x, 0.055 - u * 0.035, z);
    },
    cor: () => VERMELHO,
    acab: () => TINTA,
    orientar: 1,
  });
  // cabine verde com janelas emolduradas e telhado vermelho curvo
  const cabine = new THREE.Vector3(-0.085, 0.118, 0);
  caixa(cabine, 0.048, 0.055, 0.05, 0.14, VERDE, TINTA, 22, 16);
  for (const [dx, dz, sx, sz] of [
    [0, 0.0505, 0.017, 0.0012],
    [0, -0.0505, 0.017, 0.0012],
    [0.0485, 0, 0.0012, 0.02],
  ] as const) {
    const c = cabine.clone().add(new THREE.Vector3(dx, 0.018, dz));
    caixa(c, sx + (sx > 0.01 ? 0.004 : 0.0006), 0.021, sz + (sz > 0.01 ? 0.004 : 0.0006), 0.2, CREME, TINTA, 8, 6);
    caixa(c.clone().add(new THREE.Vector3(Math.sign(dx) * 0.0012, 0, Math.sign(dz) * 0.0012)), sx, 0.016, sz, 0.2, [0.015, 0.012, 0.01], [0, 0.35, 0.5, 0], 8, 6);
  }
  corpo.adicionar({
    nu: div(q, 18, 10),
    nv: div(q, 10, 8),
    ponto: superelipsoide(new THREE.Vector3(-0.087, 0.18, 0), 0.06, 0.008, 0.062, 0.2),
    cor: () => VERMELHO,
    acab: () => TINTA,
  });
  // o telhado arqueia (abaixa nas laterais)
  for (let i = corpo.vertices - (div(q, 18, 10) + 1) * (div(q, 10, 8) + 1); i < corpo.vertices; i++) {
    const z = corpo.pos[i * 3 + 2];
    corpo.pos[i * 3 + 1] -= (z / 0.062) ** 2 * 0.012;
  }
  // degrau e vigas: filete creme ao longo do chassi
  caixa(new THREE.Vector3(0, 0.066, 0.0445), 0.13, 0.0025, 0.0015, 0.3, CREME, TINTA, 10, 4);
  caixa(new THREE.Vector3(0, 0.066, -0.0445), 0.13, 0.0025, 0.0015, 0.3, CREME, TINTA, 10, 4);

  /* -------------------------------------------------------------------- rodas */
  const roda = new Molde();
  // perfil em volta do eixo (aqui Y; a instância deita a roda): calota dourada, raio vermelho, aro escuro
  roda.adicionar({
    nu: div(q, 14, 12),
    nv: div(q, 10, 9),
    ponto: torno((v) => {
      // de fora (+Y) para dentro: cubo, face, aro, banda de rodagem, face de trás
      if (v < 0.15) return [0.008 * (v / 0.15), 0.0105];
      if (v < 0.25) return [0.008 + (v - 0.15) * 0.06, 0.0105 - (v - 0.15) * 0.04];
      if (v < 0.55) return [0.014 + ((v - 0.25) / 0.3) * (RODA - 0.018), 0.0065];
      if (v < 0.65) return [RODA - 0.004 + (v - 0.55) * 0.04, 0.0065 - (v - 0.55) * 0.02];
      if (v < 0.85) return [RODA, 0.0045 - ((v - 0.65) / 0.2) * 0.009];
      return [RODA * (1 - (v - 0.85) / 0.15), -0.0045];
    }, (u, v) => (v > 0.3 && v < 0.5 ? Math.max(0, Math.cos(u * Math.PI * 12)) * 0.0 : 0)),
    cor: (_u, v) => (v < 0.25 ? COR.ouro : v > 0.6 && v < 0.85 ? PRETO : VERMELHO),
    acab: (_u, v) => (v < 0.25 ? ACAB.ouroGasto : v > 0.6 && v < 0.85 ? [0, 0.7, 0, 0] : TINTA),
  });
  // pino da manivela (dourado) na face
  esfera(roda, new THREE.Vector3(MANIVELA, 0.009, 0), 0.0035, 6, 4, COR.ouro, ACAB.ouro);
  const instRodas: THREE.Matrix4[] = [];
  const posRodas: THREE.Vector3[] = [];
  for (const lado of [1, -1])
    for (const x of RODAS_X) {
      const p = new THREE.Vector3(x, RODA, lado * BITOLA);
      posRodas.push(p);
      // deita a roda: o eixo Y do perfil vira Z (para fora do lado)
      instRodas.push(new THREE.Matrix4().makeRotationX(lado * (Math.PI / 2)).setPosition(p));
    }

  /* ------------------------------------------------------------------- bielas */
  const biela = new Molde();
  const comprimento = RODAS_X[2] - RODAS_X[0];
  biela.adicionar({
    nu: 8,
    nv: 6,
    ponto: superelipsoide(new THREE.Vector3(0, 0, 0), comprimento / 2 + 0.006, 0.0035, 0.0018, 0.3),
    cor: () => [COR.ouro[0] * 0.7, COR.ouro[1] * 0.7, COR.ouro[2] * 0.7],
    acab: () => ACAB.ouroGasto,
  });
  const instBielas = [1, -1].map((lado) => new THREE.Matrix4().makeTranslation((RODAS_X[0] + RODAS_X[2]) / 2 + MANIVELA, RODA, lado * (BITOLA + 0.0125)));

  return {
    partes: [
      { nome: 'corpo', material: 'madeira', molde: corpo, pivo: new THREE.Vector3(0, RODA, 0) },
      { nome: 'rodas', material: 'madeira', molde: roda, instancias: instRodas },
      { nome: 'bielas', material: 'metal', molde: biela, instancias: instBielas },
    ],
    animar(pecas) {
      const corpoVivo = pecas.get('corpo')!;
      const rodas = pecas.get('rodas') as THREE.InstancedMesh;
      const bielas = pecas.get('bielas') as THREE.InstancedMesh;
      const M = new THREE.Matrix4();
      const R = new THREE.Matrix4();
      const yBase = corpoVivo.position.y;
      return (_dt, t) => {
        const a = -t * 3.2; // a locomotiva "anda" para +X: as rodas giram no sentido horário visto de +Z
        for (let i = 0; i < posRodas.length; i++) {
          const lado = i < 3 ? 1 : -1;
          R.makeRotationZ(a);
          M.makeRotationX(lado * (Math.PI / 2));
          M.premultiply(R).setPosition(posRodas[i]);
          rodas.setMatrixAt(i, M);
        }
        rodas.instanceMatrix.needsUpdate = true;
        // biela: cada ponto dela descreve o círculo da manivela (translada sem girar)
        const dx = Math.cos(a) * MANIVELA;
        const dy = Math.sin(a) * MANIVELA;
        for (let k = 0; k < 2; k++) {
          M.makeTranslation((RODAS_X[0] + RODAS_X[2]) / 2 + dx, RODA + dy, (k === 0 ? 1 : -1) * (BITOLA + 0.0125));
          bielas.setMatrixAt(k, M);
        }
        bielas.instanceMatrix.needsUpdate = true;
        // balanço do corpo no ritmo das rodas
        corpoVivo.position.y = yBase + Math.abs(Math.sin(a)) * 0.0012;
        corpoVivo.rotation.z = Math.sin(a * 2) * 0.006;
      };
    },
  };
};
