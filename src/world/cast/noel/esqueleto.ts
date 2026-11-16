/**
 * Esqueleto do Noel (THREE.Bone), na pose de ligação: SENTADO, braços abertos para baixo e para a frente
 * (pose em "A"), pernas dobradas sobre o assento. Todos os ossos nascem sem rotação: o eixo de cada osso,
 * no espaço do próprio osso, é a direção até o filho na pose de ligação (é o que o IK usa).
 *
 * Nomes: E = esquerda DELE (+X), D = direita dele (-X).
 */
import * as THREE from 'three';
import { CORPO, DY, JOELHO_Y, PUFE } from './medidas';

export interface DadosBraco {
  ombro: THREE.Vector3;
  cotovelo: THREE.Vector3;
  pulso: THREE.Vector3;
  /** Direção do braço na pose de ligação (ombro → pulso). */
  eixo: THREE.Vector3;
  /** Normal da palma na pose de ligação (para baixo). */
  palma: THREE.Vector3;
  /** Lado do polegar (para a frente). */
  polegar: THREE.Vector3;
  /** Normal do plano de dobra do cotovelo na pose de ligação. */
  dobra: THREE.Vector3;
}

export interface DadosPerna {
  quadril: THREE.Vector3;
  joelho: THREE.Vector3;
  tornozelo: THREE.Vector3;
}

export interface Esqueleto {
  ossos: THREE.Bone[];
  /** Índice do osso pelo nome. */
  i: Record<string, number>;
  /** Osso pelo nome. */
  o: Record<string, THREE.Bone>;
  /** Posição absoluta (espaço do corpo) de cada osso na ligação. */
  p: Record<string, THREE.Vector3>;
  braco: { E: DadosBraco; D: DadosBraco };
  perna: { E: DadosPerna; D: DadosPerna };
  /** Pontos do gorro (base → ponta) na ligação. */
  gorro: THREE.Vector3[];
  /** Centro dos olhos (E e D). */
  olho: { E: THREE.Vector3; D: THREE.Vector3 };
}

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export function dadosBraco(lado: 1 | -1): DadosBraco {
  const ombro = v(lado * CORPO.ombro.x, CORPO.ombro.y, CORPO.ombro.z);
  const eixo = v(lado * 0.74, -0.56, 0.36).normalize();
  const cotovelo = ombro.clone().addScaledVector(eixo, CORPO.braco);
  const pulso = cotovelo.clone().addScaledVector(eixo, CORPO.antebraco);
  const baixo = v(0, -1, 0);
  const palma = baixo.clone().sub(eixo.clone().multiplyScalar(baixo.dot(eixo))).normalize();
  let polegar = new THREE.Vector3().crossVectors(eixo, palma).normalize();
  if (polegar.z < 0) polegar.negate();
  const dobra = new THREE.Vector3().crossVectors(eixo, palma).normalize();
  return { ombro, cotovelo, pulso, eixo, palma, polegar, dobra };
}

export function dadosPerna(lado: 1 | -1): DadosPerna {
  return {
    quadril: v(lado * CORPO.quadril.x, CORPO.quadril.y, CORPO.quadril.z),
    joelho: v(lado * 0.265, JOELHO_Y, 0.5),
    // tornozelo logo acima do pufe: canela curta, bota apoiada no tampo
    tornozelo: v(lado * CORPO.pe, PUFE.altura + 0.115, 0.64),
  };
}

/**
 * Pontos do gorro: da base (dentro da aba) até o pompom. Gorro curto e mole, como na referência: sobe
 * pouco, dobra logo e a ponta cai para a esquerda dele e um pouco para trás, com o pompom pendurado
 * perto da orelha, quase na altura da aba.
 */
export function pontosDoGorro(): THREE.Vector3[] {
  const c = CORPO.cabeca;
  return [
    v(c.x, c.y + 0.155, c.z - 0.005),
    v(c.x + 0.005, c.y + 0.255, c.z - 0.03),
    v(c.x + 0.07, c.y + 0.315, c.z - 0.065),
    v(c.x + 0.175, c.y + 0.31, c.z - 0.1),
    v(c.x + 0.26, c.y + 0.24, c.z - 0.125),
    v(c.x + 0.295, c.y + 0.15, c.z - 0.13),
  ];
}

export function criarEsqueleto(): Esqueleto {
  const c = CORPO.cabeca;
  const E = dadosBraco(1);
  const D = dadosBraco(-1);
  const pE = dadosPerna(1);
  const pD = dadosPerna(-1);
  const g = pontosDoGorro();
  // olhos maiores e mais juntos que antes (como na referência): esferas que giram no próprio osso
  const olhoE = v(0.069, c.y + 0.014, c.z + 0.182);
  const olhoD = v(-0.069, c.y + 0.014, c.z + 0.182);

  // [nome, pai, posição absoluta]
  const defs: Array<[string, string | null, THREE.Vector3]> = [
    ['raiz', null, v(0, 0, 0)],
    ['quadril', 'raiz', v(0, 0.95 + DY, -0.14)],
    ['coluna', 'quadril', v(0, 1.13 + DY, -0.14)],
    ['barriga', 'coluna', v(0, 1.16 + DY, 0.12)],
    ['peito', 'coluna', v(0, 1.4 + DY, -0.17)],
    ['pescoco', 'peito', v(0, 1.64 + DY, -0.16)],
    ['cabeca', 'pescoco', v(0, c.y - 0.08, c.z - 0.02)],
    ['queixo', 'cabeca', v(0, c.y - 0.07, c.z + 0.02)],
    ['barba', 'peito', v(0, c.y - 0.32, c.z + 0.2)],
    ['palpebraE', 'cabeca', olhoE.clone()],
    ['palpebraD', 'cabeca', olhoD.clone()],
    ['olhoE', 'cabeca', olhoE.clone()],
    ['olhoD', 'cabeca', olhoD.clone()],
    ['sobrancelhaE', 'cabeca', v(0.08, c.y + 0.085, c.z + 0.2)],
    ['sobrancelhaD', 'cabeca', v(-0.08, c.y + 0.085, c.z + 0.2)],
    ['gorro1', 'cabeca', g[1].clone()],
    ['gorro2', 'gorro1', g[2].clone()],
    ['gorro3', 'gorro2', g[3].clone()],
    ['gorro4', 'gorro3', g[4].clone()],
    ['claviculaE', 'peito', v(0.11, CORPO.ombro.y - 0.02, CORPO.ombro.z)],
    ['bracoE', 'claviculaE', E.ombro.clone()],
    ['antebracoE', 'bracoE', E.cotovelo.clone()],
    ['maoE', 'antebracoE', E.pulso.clone()],
    ['dedosE', 'maoE', E.pulso.clone().addScaledVector(E.eixo, 0.125)],
    ['polegarE', 'maoE', E.pulso.clone().addScaledVector(E.eixo, 0.04).addScaledVector(E.polegar, 0.04)],
    ['claviculaD', 'peito', v(-0.11, CORPO.ombro.y - 0.02, CORPO.ombro.z)],
    ['bracoD', 'claviculaD', D.ombro.clone()],
    ['antebracoD', 'bracoD', D.cotovelo.clone()],
    ['maoD', 'antebracoD', D.pulso.clone()],
    ['dedosD', 'maoD', D.pulso.clone().addScaledVector(D.eixo, 0.125)],
    ['polegarD', 'maoD', D.pulso.clone().addScaledVector(D.eixo, 0.04).addScaledVector(D.polegar, 0.04)],
    ['coxaE', 'quadril', pE.quadril.clone()],
    ['canelaE', 'coxaE', pE.joelho.clone()],
    ['peE', 'canelaE', pE.tornozelo.clone()],
    ['coxaD', 'quadril', pD.quadril.clone()],
    ['canelaD', 'coxaD', pD.joelho.clone()],
    ['peD', 'canelaD', pD.tornozelo.clone()],
  ];
  const ossos: THREE.Bone[] = [];
  const i: Record<string, number> = {};
  const o: Record<string, THREE.Bone> = {};
  const p: Record<string, THREE.Vector3> = {};
  for (const [nome, pai, pos] of defs) {
    const b = new THREE.Bone();
    b.name = nome;
    p[nome] = pos;
    if (pai) {
      b.position.copy(pos).sub(p[pai]);
      o[pai].add(b);
    } else b.position.copy(pos);
    i[nome] = ossos.length;
    ossos.push(b);
    o[nome] = b;
  }
  return { ossos, i, o, p, braco: { E, D }, perna: { E: pE, D: pD }, gorro: g, olho: { E: olhoE, D: olhoD } };
}
