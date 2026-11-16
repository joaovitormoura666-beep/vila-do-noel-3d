/** Materiais de tecido compartilhados pelas peças (veludo dos laços e da saia). */
import * as THREE from 'three';
import { loadTexture } from '../../../engine/assets';

export interface Veludo {
  cor: THREE.Texture;
  normal: THREE.Texture;
}

/** Veludo vermelho real (Velour Velvet, Poly Haven), reduzido a 512 px. O ladrilho mede 28 cm. */
export async function carregarVeludo(): Promise<Veludo> {
  const [cor, normal] = await Promise.all([loadTexture('assets/arvore/veludo_cor.jpg', { srgb: true }), loadTexture('assets/arvore/veludo_normal.jpg', { srgb: false })]);
  return { cor, normal };
}

/** Veludo dos laços: fosco, com o brilho rasante típico do pelo (sheen) em vermelho mais claro. */
export function materialVeludo(v: Veludo, cor = '#8a222c'): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    map: v.cor,
    normalMap: v.normal,
    normalScale: new THREE.Vector2(1.8, 1.8),
    color: cor,
    roughness: 0.82,
    sheen: 1,
    sheenColor: new THREE.Color('#d8525c'),
    sheenRoughness: 0.5,
    side: THREE.DoubleSide,
    vertexColors: true,
  });
}
