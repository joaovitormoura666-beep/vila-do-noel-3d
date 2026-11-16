/**
 * Descarte de objetos que saem de cena (presentes, caixas). O contrato do elenco não tem dispose para os presentes:
 * se o objeto trouxer `userData.dispose()`, usamos; senão liberamos geometrias e materiais dele (texturas ficam,
 * porque costumam ser compartilhadas entre cópias).
 */
import type * as THREE from 'three';

export function descartarObjeto(obj: THREE.Object3D | null | undefined) {
  if (!obj) return;
  obj.removeFromParent();
  const proprio = obj.userData?.dispose;
  if (typeof proprio === 'function') {
    (proprio as () => void)();
    return;
  }
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh && !(o as THREE.Points).isPoints) return;
    if (m.userData?.compartilhado === true) return;
    m.geometry?.dispose();
    const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
    for (const mat of mats) if (!mat.userData?.compartilhado) mat.dispose();
  });
}
