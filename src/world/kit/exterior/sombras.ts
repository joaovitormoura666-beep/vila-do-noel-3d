/**
 * Sombras do luar, assadas uma única vez na construção: dois mapas de profundidade vistos da direção da lua
 * (um fino para o jardim, um largo para a vila). Como nada do cenário se mexe, não há custo por quadro além
 * de ler a textura; e nenhuma luz real com sombra entra na conta da sala.
 */
import * as THREE from 'three';
import type { UniformesLuar } from './luar';

export interface SombrasAssadas {
  dispose(): void;
}

interface Cascata {
  centro: THREE.Vector3;
  meia: number;
  /** Folga de profundidade, em metros. */
  folga: number;
}

export function assarSombras(renderer: THREE.WebGLRenderer, U: UniformesLuar, projetores: THREE.Object3D[], direcaoLuz: THREE.Vector3, tamanho: number, cascatas: [Cascata, Cascata]): SombrasAssadas {
  const cena = new THREE.Scene();
  const pais = projetores.map((p) => p.parent);
  for (const p of projetores) cena.add(p);
  const sobreposto = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  // cada malha desenha a profundidade com o material neutro, ou com o seu `userData.materialSombra`
  // (recortes por alfa e cartões que giram para a câmera precisam do próprio)
  const trocados: Array<[THREE.Mesh, THREE.Material | THREE.Material[]]> = [];
  for (const p of projetores) {
    p.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      trocados.push([mesh, mesh.material]);
      mesh.material = (mesh.userData.materialSombra as THREE.Material | undefined) ?? sobreposto;
    });
  }
  const alvoAnterior = renderer.getRenderTarget();
  const corAnterior = new THREE.Color();
  renderer.getClearColor(corAnterior);
  const alfaAnterior = renderer.getClearAlpha();
  const dist = 160;
  const alvos: THREE.WebGLRenderTarget[] = [];
  const ajuste = new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
  const folgas: number[] = [];
  cascatas.forEach((c, i) => {
    const alvo = new THREE.WebGLRenderTarget(tamanho, tamanho, { depthBuffer: true });
    alvo.texture.minFilter = alvo.texture.magFilter = THREE.NearestFilter;
    alvo.texture.generateMipmaps = false;
    alvo.depthTexture = new THREE.DepthTexture(tamanho, tamanho);
    const cam = new THREE.OrthographicCamera(-c.meia, c.meia, c.meia, -c.meia, 1, dist * 2);
    cam.position.copy(c.centro).addScaledVector(direcaoLuz, dist);
    cam.lookAt(c.centro);
    cam.updateMatrixWorld(true);
    cam.updateProjectionMatrix();
    renderer.setRenderTarget(alvo);
    renderer.setClearColor(0xffffff, 1);
    renderer.clear(true, true, true);
    renderer.render(cena, cam);
    const m = new THREE.Matrix4().multiplyMatrices(ajuste, cam.projectionMatrix).multiply(cam.matrixWorldInverse);
    (i === 0 ? U.uSombraMat0 : U.uSombraMat1).value.copy(m);
    (i === 0 ? U.uSombra0 : U.uSombra1).value = alvo.depthTexture;
    folgas.push(c.folga / (dist * 2 - 1));
    alvos.push(alvo);
  });
  U.uSombraParam.value.set(1 / tamanho, 1 / tamanho, folgas[0], folgas[1]);
  renderer.setRenderTarget(alvoAnterior);
  renderer.setClearColor(corAnterior, alfaAnterior);
  for (const [mesh, mat] of trocados) mesh.material = mat;
  projetores.forEach((p, i) => pais[i]?.add(p));
  sobreposto.dispose();
  return {
    dispose() {
      for (const a of alvos) {
        a.depthTexture?.dispose();
        a.dispose();
      }
    },
  };
}
