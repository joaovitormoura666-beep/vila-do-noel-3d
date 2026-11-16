/**
 * Mapa de ambiente gerado da própria sala (PMREM), com o fogo e as luzes acesos: é o que faz o piso
 * encerado, o latão e o vidro refletirem o fogo, a árvore e o recorte azul da janela.
 */
import * as THREE from 'three';
import { PLANTA } from './ajustes';

export function gerarAmbiente(renderer: THREE.WebGLRenderer, raiz: THREE.Group, centro: THREE.Vector3): THREE.WebGLRenderTarget {
  const cena = new THREE.Scene();
  cena.background = new THREE.Color('#0d0705');
  const pai = raiz.parent;
  cena.add(raiz);
  // a sala é cortada do lado da câmera: dois painéis escuros e quentes fecham esse lado só para os reflexos
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#3a2114').multiplyScalar(0.55), side: THREE.DoubleSide });
  const geo = new THREE.PlaneGeometry(40, 9);
  const p1 = new THREE.Mesh(geo, mat);
  p1.position.set(-PLANTA.comprimentoJ, 4.5, 8);
  p1.rotation.y = Math.PI / 2;
  const p2 = new THREE.Mesh(geo, mat);
  p2.position.set(-8, 4.5, PLANTA.comprimentoL + 3);
  cena.add(p1, p2);
  cena.updateMatrixWorld(true);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const alvo = pmrem.fromScene(cena, 0.015, 0.1, 400, { position: centro, size: 256 });
  pmrem.dispose();
  cena.remove(raiz, p1, p2);
  if (pai) pai.add(raiz);
  geo.dispose();
  mat.dispose();
  return alvo;
}
