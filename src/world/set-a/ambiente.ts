/**
 * Ambiente de reflexos gerado da própria sala, depois de montada e com o fogo e as luzes acesos:
 * é o que faz o piso encerado, o latão, o verniz e as bolas da árvore refletirem o fogo e a janela azul.
 * Vai para VillageSet.environment (scene.environment) e para arvore.setEnvMap.
 */
import * as THREE from 'three';
import { AMBIENTE } from './ajustes';

export interface AmbienteDaSala {
  textura: THREE.Texture;
  dispose(): void;
}

/**
 * Fotografa `raiz` em volta de AMBIENTE.posicao e filtra para reflexos (PMREM).
 * `esconder` são objetos que não devem aparecer nos reflexos (poças pintadas, destaques).
 */
export function gerarAmbiente(renderer: THREE.WebGLRenderer, raiz: THREE.Object3D, esconder: THREE.Object3D[] = []): AmbienteDaSala {
  const cena = new THREE.Scene();
  cena.background = new THREE.Color('#0a0605');
  const paiAntigo = raiz.parent;
  cena.add(raiz);
  const visiveis = esconder.map((o) => o.visible);
  for (const o of esconder) o.visible = false;
  raiz.updateMatrixWorld(true);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const alvo = pmrem.fromScene(cena, AMBIENTE.sigma, 0.1, 200, { size: AMBIENTE.tamanho, position: new THREE.Vector3(...AMBIENTE.posicao) });
  pmrem.dispose();
  esconder.forEach((o, i) => (o.visible = visiveis[i]));
  cena.remove(raiz);
  if (paiAntigo) paiAntigo.add(raiz);
  return {
    textura: alvo.texture,
    dispose() {
      alvo.dispose();
    },
  };
}
