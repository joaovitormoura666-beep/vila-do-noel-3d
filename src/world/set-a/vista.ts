/**
 * A vista da janela. A câmera da sala fica longe (uns 21 m) e mais alta que o meio do vão: através da
 * janela ela enxerga só um cone estreito (cerca de 7 graus de largura por 10 de altura), quase todo
 * abaixo do horizonte. Com o diorama do kit simplesmente encostado na parede, esse cone mostra só o
 * jardim, sem a vila nem a lua.
 *
 * Por isso o exterior é tratado como um fundo de cinema: a peça inteira é girada e afastada (movimento
 * rígido, sem escala) de modo que a câmera real veja exatamente o que veria um "olho virtual" colocado
 * dentro do diorama (VISTA.olho, em coordenadas da peça) olhando na direção VISTA.azimute / elevacao,
 * e que essa direção caia no centro do vão. Tudo o mais (névoa, halos, neve) continua coerente, porque
 * a peça faz as contas no espaço dela.
 */
import * as THREE from 'three';
import { VISTA } from './ajustes';

const GRAU = Math.PI / 180;

/** Direção unitária de um azimute (0 = em frente, negativo = esquerda) e elevação, em graus, com -Z à frente. */
function direcao(azimute: number, elevacao: number): THREE.Vector3 {
  const az = azimute * GRAU;
  const el = elevacao * GRAU;
  return new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
}

/** Base ortonormal de quem olha na direção `d` com a cabeça em pé (sem rolar). */
function baseDoOlhar(d: THREE.Vector3): THREE.Matrix4 {
  const frente = d.clone().normalize();
  const lado = new THREE.Vector3().crossVectors(frente, new THREE.Vector3(0, 1, 0)).normalize();
  const cima = new THREE.Vector3().crossVectors(lado, frente);
  return new THREE.Matrix4().makeBasis(lado, cima, frente.clone().negate());
}

export interface Vista {
  /** Direção (mundo) para onde a lua aparece, vista pela câmera através da janela. */
  paraLua: THREE.Vector3;
}

/**
 * Posiciona `raiz` (o exterior do kit) para a câmera em `camera` ver, pelo vão centrado em `centroDoVao`,
 * a vista escolhida em VISTA. `direcaoLua` é exterior.luar.direcaoLua (espaço da peça).
 */
export function apontarExterior(raiz: THREE.Object3D, camera: THREE.Vector3, centroDoVao: THREE.Vector3, direcaoLua: THREE.Vector3): Vista {
  const olho = new THREE.Vector3(...VISTA.olho);
  const local = baseDoOlhar(direcao(VISTA.azimute, VISTA.elevacao));
  const mundo = baseDoOlhar(centroDoVao.clone().sub(camera));
  // R leva as direções da peça para o mundo: R = mundo · local⁻¹ (bases ortonormais: a inversa é a transposta)
  const R = mundo.multiply(local.transpose());
  raiz.quaternion.setFromRotationMatrix(R);
  raiz.position.copy(camera).sub(olho.applyMatrix4(R));
  raiz.updateMatrixWorld(true);
  // a lua fica a `profundidade` metros da origem da peça; daqui sai a direção em que a câmera a vê
  const lua = direcaoLua.clone().normalize().multiplyScalar(VISTA.profundidade);
  const paraLua = raiz.localToWorld(lua).sub(camera).normalize();
  return { paraLua };
}
