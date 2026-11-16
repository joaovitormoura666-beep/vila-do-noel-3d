/**
 * Materiais compartilhados pela janela e pelos tecidos: madeira escura encerada (textura real
 * black_walnut_veneer_02 do Poly Haven), latão envelhecido e neve. São criados uma vez e reaproveitados: não
 * chame dispose() neles em cada peça.
 */
import * as THREE from 'three';
import { loadPbr, loadTexture } from '../../../engine/assets';
import { fbm2 } from './util';

/** O ladrilho de black_walnut_veneer_02 mede 1 m; usamos um pouco menor para o veio ficar fino nas peças estreitas. */
export const LADRILHO_MADEIRA = 0.85;

let madeira: Promise<THREE.MeshStandardMaterial> | null = null;
/**
 * Nogueira escura encerada da marcenaria (marco, folhas, guarnição, peitoril): textura real
 * black_walnut_veneer_02 (veio reto e fino, com poro). O veio corre no `u` das UV. Um pouco
 * dessaturada e puxada para o marrom no shader (sem o vinho que a luz quente exagera).
 */
export function materialMadeira(): Promise<THREE.MeshStandardMaterial> {
  madeira ??= (async () => {
    const mapas = await loadPbr('black_walnut_veneer_02', { anisotropy: 8 });
    const mat = new THREE.MeshStandardMaterial({
      ...mapas,
      color: '#7d6655', // escurece a nogueira clara do veneer para a de móvel encerado antigo
      roughness: 0.78, // multiplica o mapa: cera gasta, brilho baixo e variado
      metalness: 0,
      aoMapIntensity: 0.6,
      envMapIntensity: 0.85,
      vertexColors: true, // sujeira e escurecimento nos encontros, pintados por vértice
    });
    mat.normalScale.set(1.4, 1.4);
    mat.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace(
        '#include <map_fragment>',
        /* glsl */ `#include <map_fragment>
        float lumaMadeira = dot( diffuseColor.rgb, vec3( 0.3, 0.6, 0.1 ) );
        diffuseColor.rgb = mix( vec3( lumaMadeira ), diffuseColor.rgb, 0.75 ) * vec3( 1.0, 0.92, 0.84 );`,
      );
    };
    mat.customProgramCacheKey = () => 'madeira-nogueira';
    mat.name = 'madeira-janela';
    return mat;
  })();
  return madeira;
}

let latao: THREE.MeshStandardMaterial | null = null;
/**
 * Latão envelhecido, discreto: ferragens, varão e argolas. Menos alaranjado, fosco de mão, com a
 * rugosidade quebrada por um ruído (pátina em manchas) para o reflexo nunca sair liso como cromado.
 */
export function materialLatao(): THREE.MeshStandardMaterial {
  if (latao) return latao;
  const n = 128;
  const dados = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const a = (x / n) * Math.PI * 2;
      const b = (y / n) * Math.PI * 2;
      // ruído periódico (toro): manchas de pátina mais foscas
      const f = fbm2(Math.cos(a) * 1.5 + Math.sin(b) * 0.4 + 9, Math.sin(a) * 1.5 + Math.cos(b) * 1.5 + 9, 3, 61);
      const rug = Math.round(255 * Math.min(1, Math.max(0.35, 0.72 + 0.45 * f)));
      const ao = Math.round(255 * Math.min(1, 0.86 + 0.25 * f)); // canal R: escurece onde a pátina pega
      const i = (y * n + x) * 4;
      dados[i] = ao;
      dados[i + 1] = rug;
      dados[i + 2] = 255;
      dados[i + 3] = 255;
    }
  const mapa = new THREE.DataTexture(dados, n, n);
  mapa.wrapS = mapa.wrapT = THREE.RepeatWrapping;
  mapa.repeat.set(3, 3);
  mapa.magFilter = THREE.LinearFilter;
  mapa.minFilter = THREE.LinearMipmapLinearFilter;
  mapa.generateMipmaps = true;
  mapa.needsUpdate = true;
  latao = new THREE.MeshStandardMaterial({
    color: '#9a7b45',
    metalness: 1,
    roughness: 0.62,
    roughnessMap: mapa,
    aoMap: mapa,
    aoMapIntensity: 1,
    envMapIntensity: 0.75,
    name: 'latao',
  });
  return latao;
}

let neve: Promise<THREE.MeshStandardMaterial> | null = null;
/** Neve fofa: quase branca, com um azulado próprio (como se o luar atravessasse o monte). */
export function materialNeve(): Promise<THREE.MeshStandardMaterial> {
  neve ??= (async () => {
    let normal: THREE.Texture | null = null;
    try {
      normal = await loadTexture('assets/texturas/snow_02/nor.jpg', { repeat: [1, 1] });
    } catch {
      normal = null; // a neve continua valendo sem o relevo fino
    }
    if (normal) normal.repeat.set(1, 1); // as UV da neve já vêm em ladrilhos de 8 cm
    const mat = new THREE.MeshStandardMaterial({
      color: '#8396c0', // vista de dentro, à noite, a neve de fora é azul-acinzentada: só a crista pega luz
      roughness: 0.9,
      metalness: 0,
      emissive: '#24365f',
      emissiveIntensity: 0.15,
      normalMap: normal,
      vertexColors: true, // base azul e escura, crista clara, âmbar junto ao vidro
      name: 'neve-janela',
    });
    mat.normalScale.set(1.2, 1.2);
    return mat;
  })();
  return neve;
}
