/**
 * Âncoras do jogo na sala B: lugar do Noel, área de entrega, ponto da revelação, fila e saída.
 * A fila é pensada no espaço da tela: `naTela(sx, d)` converte "metros para a direita da tela" e
 * "metros para o fundo" (negativo = para perto da câmera), medidos a partir do canto da sala, em
 * coordenadas de piso. Assim os trechos da fila correm paralelos à tela, um atrás do outro.
 */
import * as THREE from 'three';
import type { VillageAnchors } from '../contracts';
import { CAMERA, LUGARES } from './ajustes';

const a = (CAMERA.angulo * Math.PI) / 180;

/** Ponto do piso a `sx` metros para a direita da tela e `d` metros para o fundo, a partir do canto. */
export function naTela(sx: number, d: number): THREE.Vector3 {
  return new THREE.Vector3(sx * Math.cos(a) + d * Math.sin(a), 0, sx * Math.sin(a) - d * Math.cos(a));
}

/** Direção (no piso) de um ponto para a câmera. */
const paraCamera = new THREE.Vector3(-Math.sin(a), 0, Math.cos(a));

export function criarAncoras(): VillageAnchors {
  const noel = new THREE.Vector3(LUGARES.noel.x, 0, LUGARES.noel.z);
  const entrega = new THREE.Vector3(LUGARES.entrega.x, 0, LUGARES.entrega.z);
  // o Noel fica de três quartos: meio virado para o visitante, meio para a câmera
  const paraVisitante = entrega.clone().sub(noel).normalize();
  const frenteNoel = paraVisitante.clone().multiplyScalar(0.5).addScaledVector(paraCamera, 0.5).normalize();
  const paraNoel = noel.clone().sub(entrega).normalize();
  // o visitante olha para o Noel, com um resto de rosto para a câmera
  const frenteVisitante = paraNoel.clone().multiplyScalar(0.8).addScaledVector(paraCamera, 0.2).normalize();

  // fila: entra por baixo e pela esquerda (fora da tela), faz três trechos paralelos à tela e sobe até a entrega
  const fila = [
    naTela(-5.4, -12.9),
    naTela(-3.6, -12.75),
    naTela(-0.2, -12.5),
    naTela(0.62, -11.65),
    naTela(-0.1, -10.8),
    naTela(-2.5, -10.65),
    naTela(-3.2, -9.85),
    naTela(-2.5, -9.05),
    naTela(-0.9, -8.85),
    naTela(-0.55, -7.75),
    entrega.clone(),
  ];
  // saída: para a esquerda e para o fundo, passando pelo luar junto da janela, por trás da fila
  const saida = [entrega.clone(), naTela(-2.7, -5.7), naTela(-4.3, -5.5), naTela(-6.6, -6.4)];

  return {
    santa: { position: noel, yaw: Math.atan2(frenteNoel.x, frenteNoel.z) },
    delivery: { position: entrega, yaw: Math.atan2(frenteVisitante.x, frenteVisitante.z) },
    reveal: new THREE.Vector3((noel.x + entrega.x) / 2, LUGARES.revelacaoY, (noel.z + entrega.z) / 2),
    queuePath: fila,
    exitPath: saida,
    queueSpacing: LUGARES.espacoFila,
    frontGap: LUGARES.folgaFrente,
  };
}
