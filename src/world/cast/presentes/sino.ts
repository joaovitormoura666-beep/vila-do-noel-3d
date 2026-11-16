/**
 * SINO DOURADO: sino de latão fundido e escovado, com a boca larga e a borda grossa arredondada, cintura
 * fina, ombro e coroa; dois frisos em relevo; o lado de dentro em bronze escuro e áspero (a luz não entra;
 * não reflete o ambiente como espelho) e o badalo de ferro pendurado aparecendo pela boca.
 * Num jogo com halo atrás do presente, use root.userData.fatorHalo (0,5 para o sino; veja index.ts). Na coroa, a argola e um laço de cetim vermelho com duas folhas de
 * azevinho e bagas.
 *
 * ANIMAÇÃO (userData.update): o sino balança devagar em volta da argola e o badalo atrasa e bate na borda.
 * Quatro malhas: sino, badalo (gira à parte), cetim e folhas.
 */
import * as THREE from 'three';
import { Molde, torno } from './malha';
import { ACAB, argola, bagas, COR, esfera, folhaAzevinho, laco } from './pecas';
import { div, type Moldar } from './tipos';
import { chaves, fbm3 } from '../noel/util';

// perfil de fora (altura -> raio), da boca (y = 0) até a coroa
const RAIO_FORA = chaves([0, 0.01, 0.025, 0.06, 0.11, 0.16, 0.2, 0.225, 0.24], [0.128, 0.13, 0.118, 0.095, 0.078, 0.072, 0.068, 0.055, 0.0]);
const ESPESSURA = 0.007;
const TOPO = 0.24;

export const moldarSino: Moldar = (q) => {
  const sino = new Molde().tinta(COR.ouro, ACAB.ouro);
  // um só perfil fechado: de fora, da coroa até a boca; volta pela borda grossa; de dentro, até o teto
  const perfil = (v: number): readonly [number, number] => {
    if (v < 0.5) {
      const y = TOPO * (1 - v / 0.5);
      let r = RAIO_FORA(y);
      // frisos em relevo
      r += 0.0025 * Math.exp(-(((y - 0.045) / 0.004) ** 2)) + 0.002 * Math.exp(-(((y - 0.175) / 0.0035) ** 2));
      return [r, y];
    }
    if (v < 0.6) {
      // borda: meia volta grossa para dentro
      const a = ((v - 0.5) / 0.1) * Math.PI;
      const r0 = RAIO_FORA(0) - ESPESSURA * 0.5;
      return [r0 + Math.cos(a) * ESPESSURA * 0.75, -Math.sin(a) * ESPESSURA * 0.9];
    }
    const y = ((v - 0.6) / 0.4) * (TOPO - 0.03);
    return [Math.max(0, RAIO_FORA(y) - ESPESSURA - (y / TOPO) * 0.004) * (v > 0.995 ? 0 : 1), y];
  };
  sino.adicionar({
    nu: div(q, 44, 24),
    nv: div(q, 42, 24),
    ponto: torno(perfil, (u, v) => (v < 0.5 ? fbm3(u * 9, v * 6, 0.5, 2, 3) * 0.004 : 0)),
    cor(_u, v) {
      // DENTRO: bronze sombreado, bem mais escuro (2ª rodada: na sala a boca do sino refletia o ambiente
      // inteiro e acendia como uma lâmpada; o reflexo de ambiente não sabe que ali é uma cavidade, então
      // a sombra precisa estar na cor). Fica um pouco mais claro só na borda, onde a luz ainda entra.
      if (v > 0.6) {
        const fundo = (v - 0.6) / 0.4; // 0 na borda, 1 no teto de dentro
        const k = 0.36 * (1 - fundo) + 0.1 * fundo;
        return [COR.ouro[0] * k * 0.85, COR.ouro[1] * k * 0.78, COR.ouro[2] * k * 0.7];
      }
      // fora: latão; a saia de baixo (onde bate a luz da entrega de frente) um pouco mais escura e mais
      // fosca, para o realce se espalhar em vez de virar um ponto branco-amarelado
      const saia = Math.min(1, Math.max(0, (v - 0.3) / 0.2));
      const k = 0.84 - 0.2 * saia;
      return [COR.ouro[0] * k, COR.ouro[1] * k * 0.98, COR.ouro[2] * k * 0.94];
    },
    // dentro bem mais áspero (bronze fundido, sem polimento) e só meio metálico: não espelha o ambiente
    acab: (u, v) => (v > 0.6 ? [0.55, 0.9, 0, 0] : [1, 0.52 + 0.18 * Math.min(1, Math.max(0, (v - 0.3) / 0.2)) + 0.05 * Math.sin(u * 40 + v * 7), 0, 0]),
    uv: (u, v) => [u * 0.7, v * 0.5],
  });
  // coroa e argola
  argola(sino, new THREE.Vector3(0, TOPO + 0.012, 0), 0.016, 0.0042, COR.ouro, ACAB.ouroGasto, Math.PI / 2, q.k);
  esfera(sino, new THREE.Vector3(0, TOPO - 0.004, 0), 0.016, div(q, 14, 8), div(q, 10, 6), COR.ouro, ACAB.ouroGasto, [1, 0.5, 1]);

  // badalo: haste e bola, presos no teto de dentro (pivô)
  const pivoBadalo = new THREE.Vector3(0, TOPO - 0.03, 0);
  // badalo de ferro escurecido (fica dentro da sombra do sino; antes era latão claro e acendia na boca)
  const badalo = new Molde().tinta([COR.ouro[0] * 0.3, COR.ouro[1] * 0.26, COR.ouro[2] * 0.22], [0.8, 0.7, 0, 0]);
  const haste = new THREE.CylinderGeometry(0.0035, 0.0035, 0.2, 8, 1);
  badalo.juntar(haste, new THREE.Matrix4().makeTranslation(0, pivoBadalo.y - 0.1, 0));
  haste.dispose();
  esfera(badalo, new THREE.Vector3(0, pivoBadalo.y - 0.212, 0), 0.024, div(q, 18, 10), div(q, 12, 8));

  // laço de cetim vermelho na coroa e o azevinho
  const fita = new Molde();
  laco(
    fita,
    { largura: 0.13, fita: 0.024, pontas: 0.75, queda: 0.4, cheio: 0.4, inclina: 0.45, ladrilho: 0.08, duplo: true, k: q.k },
    19,
    new THREE.Matrix4().makeTranslation(0, TOPO - 0.012, 0.05).multiply(new THREE.Matrix4().makeRotationX(-0.25)),
    COR.vermelho,
  );
  const folhas = new Molde();
  folhaAzevinho(folhas, new THREE.Matrix4().makeTranslation(0.012, TOPO - 0.005, 0.045).multiply(new THREE.Matrix4().makeRotationZ(0.3)).multiply(new THREE.Matrix4().makeRotationY(-0.4)), 0.075, COR.verde, 7);
  folhaAzevinho(folhas, new THREE.Matrix4().makeTranslation(-0.012, TOPO - 0.005, 0.045).multiply(new THREE.Matrix4().makeRotationZ(Math.PI - 0.15)).multiply(new THREE.Matrix4().makeRotationY(0.4)), 0.07, COR.verde, 8);
  bagas(folhas, new THREE.Vector3(0, TOPO + 0.006, 0.062), 0.008, 3, 9, q.k);

  const pivoSino = new THREE.Vector3(0, TOPO + 0.02, 0);
  return {
    partes: [
      { nome: 'sino', material: 'metal', molde: sino, pivo: pivoSino },
      { nome: 'badalo', material: 'metal', molde: badalo, pivo: pivoBadalo, mae: 'sino' },
      { nome: 'fita', material: 'cetim', molde: fita, pivo: pivoSino, mae: 'sino' },
      { nome: 'folhas', material: 'esmalte', molde: folhas, pivo: pivoSino, mae: 'sino' },
    ],
    animar(pecas) {
      const corpo = pecas.get('sino')!;
      const bad = pecas.get('badalo')!;
      return (_dt, t) => {
        // balanço: duas frequências somadas (não é um metrônomo)
        const a = Math.sin(t * 2.1) * 0.13 + Math.sin(t * 3.7 + 1.3) * 0.03;
        corpo.rotation.z = a;
        corpo.rotation.x = Math.sin(t * 1.6 + 0.5) * 0.04;
        // o badalo atrasa e passa do ponto, limitado pela borda (bate e volta)
        const b = Math.sin(t * 2.1 - 1.2) * 0.3;
        bad.rotation.z = Math.max(-0.17, Math.min(0.17, -a * 0.8 + b * 0.4));
      };
    },
  };
};
