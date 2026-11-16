/**
 * Materiais da arquitetura da sala A: conjuntos PBR reais do acervo (Poly Haven, CC0), no tamanho real.
 * Todas as geometrias da sala têm UV em METROS; aqui cada textura recebe repeat = 1 / ladrilho.
 * A cor de vértice (sujeira, escurecimento, variação de tábua para tábua) multiplica a cor do material.
 */
import * as THREE from 'three';
import { loadPbr } from '../../engine/assets';
import { MATERIAL } from './ajustes';

/** Lado real do ladrilho de cada textura, em metros (lab/acervo/CATALOGO.md). */
export const LADRILHO = {
  dark_wooden_planks: 2,
  painted_plaster_wall: 2,
  old_planks_02: 2,
  wood_trunk_wall: 1.25,
  weathered_brown_planks: 1.8,
  dark_wood: 2,
} as const;

export interface MateriaisDaSala {
  /** Assoalho de tábuas largas, encerado. */
  piso: THREE.MeshStandardMaterial;
  /** Reboco pintado, tingido de creme (parte alta das paredes). */
  reboco: THREE.MeshStandardMaterial;
  /** Tábuas do lambri. */
  lambri: THREE.MeshStandardMaterial;
  /** Vigas, pilares e caibros. */
  viga: THREE.MeshStandardMaterial;
  /** Tábuas do forro. */
  forro: THREE.MeshStandardMaterial;
  /** Rodapé, molduras e frisos (madeira escura lisa). */
  madeiraEscura: THREE.MeshStandardMaterial;
  dispose(): void;
}

async function pbr(id: keyof typeof LADRILHO, cor: string, extra: THREE.MeshStandardMaterialParameters = {}, anisotropia = 8): Promise<THREE.MeshStandardMaterial> {
  const rep = 1 / LADRILHO[id];
  const mapas = await loadPbr(id, { repeat: [rep, rep], anisotropy: anisotropia });
  const mat = new THREE.MeshStandardMaterial({ ...mapas, color: cor, roughness: 1, metalness: 0, vertexColors: true, ...extra });
  mat.name = `sala-${id}`;
  return mat;
}

/**
 * Luz pintada no reboco: escurece a parede para o alto e para longe da lareira, em coordenadas do mundo
 * (a parede é uma placa grande com poucos vértices, então a cor de vértice não serve). É o degradê quente
 * da referência: o calor vem dos pontos de luz e a parede some no escuro perto do forro e nos cantos.
 */
function pintarLuzNoReboco(mat: THREE.MeshStandardMaterial) {
  const L = MATERIAL.rebocoLuz;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uAlto = { value: new THREE.Vector3(L.alto[0], L.alto[1], L.topo) };
    sh.uniforms.uFogo = { value: new THREE.Vector4(L.origem[0], L.origem[1], L.fogo[0], L.fogo[1]) };
    sh.uniforms.uLonge = { value: L.longe };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vMundoReboco;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvMundoReboco = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vMundoReboco;\nuniform vec3 uAlto;\nuniform vec4 uFogo;\nuniform float uLonge;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float kAlto = mix(1.0, uAlto.z, smoothstep(uAlto.x, uAlto.y, vMundoReboco.y));
        float kFogo = mix(1.0, uLonge, smoothstep(uFogo.z, uFogo.w, distance(vMundoReboco.xz, uFogo.xy)));
        diffuseColor.rgb *= kAlto * kFogo;`,
      );
  };
  mat.customProgramCacheKey = () => 'sala-a-reboco-luz';
}

export async function criarMateriais(): Promise<MateriaisDaSala> {
  const [piso, reboco, lambri, viga, forro, madeiraEscura] = await Promise.all([
    pbr('dark_wooden_planks', MATERIAL.pisoCor, { roughness: MATERIAL.pisoRugosidade, envMapIntensity: MATERIAL.pisoReflexo }, 16),
    pbr('painted_plaster_wall', MATERIAL.rebocoCor, { envMapIntensity: 0.22 }),
    pbr('old_planks_02', MATERIAL.lambriCor, { roughness: 0.82, envMapIntensity: 0.7 }),
    pbr('wood_trunk_wall', MATERIAL.vigaCor, { roughness: 0.9, envMapIntensity: 0.6 }),
    pbr('weathered_brown_planks', MATERIAL.forroCor, { envMapIntensity: 0.4 }),
    pbr('dark_wood', MATERIAL.madeiraEscuraCor, { roughness: 0.72, envMapIntensity: 0.8 }),
  ]);
  piso.normalScale.set(1.15, 1.15);
  reboco.normalScale.set(1.3, 1.3);
  pintarLuzNoReboco(reboco);
  viga.normalScale.set(1.2, 1.2);
  const todos = [piso, reboco, lambri, viga, forro, madeiraEscura];
  return {
    piso,
    reboco,
    lambri,
    viga,
    forro,
    madeiraEscura,
    dispose() {
      for (const m of todos) {
        for (const t of new Set([m.map, m.normalMap, m.roughnessMap, m.aoMap, m.metalnessMap])) t?.dispose();
        m.dispose();
      }
    },
  };
}
