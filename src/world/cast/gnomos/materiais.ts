/**
 * Materiais compartilhados por todos os gnomos. São só QUATRO programas de shader para a fila inteira
 * (a cor de cada gnomo vem da cor de vértice, e um atributo `tipo` por vértice escolhe a variante
 * dentro do mesmo programa), mais um material invisível para a sombra:
 *   pele    MeshPhysical. tipo 0 = pele com "subsuperfície" aproximada (luz envolvente avermelhada,
 *           brilho rosado rasante e luz atravessando orelhas e nariz contra a luz: a espessura vem do
 *           alfa da cor de vértice); tipo 1 = olho (íris do atlas, verniz de olho vivo);
 *   tecido  MeshPhysical. tipo 0 = tricô (ponto de meia com relevo, penugem tingida pela cor do fio,
 *           jacquard na cor neve onde o alfa da cor de vértice marca, mais o knitted_fleece do
 *           Poly Haven como relevo fino de penugem); tipo 1 = feltro (lã batida, fosca);
 *   barba   MeshPhysical com brilho anisotrópico ao longo da mecha; tipo 1 = cartões de fios soltos
 *           (recortados por alfa) no contorno, que dão o "fofo" da silhueta;
 *   duro    MeshStandard. tipo 0 = couro brown_leather (Poly Haven) gasto; 1 = metal (latão, ferro);
 *           2 = vidro aceso da lanterninha (emissivo).
 *   sombra  corpo simplificado que só projeta sombra (não escreve cor nem profundidade na tela).
 * As texturas do disco chegam depois (createVisitor é síncrono): o material nasce pronto e ganha os
 * mapas quando eles carregam.
 */
import * as THREE from 'three';
import type { Level } from '../../contracts';
import { loadTexture } from '../../../engine/assets';
import { pegarTexturas, soltarTexturas } from './texturas';

export type NomeMaterial = 'pele' | 'tecido' | 'barba' | 'duro';
export const MATERIAIS: readonly NomeMaterial[] = ['pele', 'tecido', 'barba', 'duro'];

/** Cor dos motivos em jacquard do tricô (neve da paleta). */
export const COR_MOTIVO = '#F7F4EF';

export interface MateriaisGnomo {
  /** Materiais do nível alto e médio (físicos, com penugem e anisotropia). */
  m: Record<NomeMaterial, THREE.Material>;
  /** Materiais do nível baixo (MeshStandard, programas leves). */
  leves: Record<NomeMaterial, THREE.Material>;
  /** Material do corpo que só projeta sombra. */
  sombra: THREE.Material;
  setQuality(level: Level): void;
  dispose(): void;
}

const DECL_VERT = 'attribute float tipo;\nvarying float vTipo;\n';
const DECL_FRAG = 'varying float vTipo;\n';

/** Passa o atributo `tipo` para o fragmento e aplica as trocas de trechos do shader. */
function preparar(s: THREE.WebGLProgramParametersWithUniforms) {
  s.vertexShader = DECL_VERT + s.vertexShader.replace('#include <color_vertex>', '#include <color_vertex>\n  vTipo = tipo;');
  s.fragmentShader = DECL_FRAG + s.fragmentShader;
}

/**
 * Luz envolvente (wrap) por canal na difusa: `envolver` = quanto a luz contorna a sombra em r, g, b.
 * `transmissao` (opcional) soma a luz que atravessa as partes finas contra a luz (orelhas, nariz).
 */
function luzEnvolvente(s: THREE.WebGLProgramParametersWithUniforms, envolver: [number, number, number], transmissao?: string) {
  const w = `vec3(${envolver.map((x) => x.toFixed(3)).join(',')})`;
  const luz = THREE.ShaderChunk.lights_physical_pars_fragment.replace(
    'reflectedLight.directDiffuse += irradiance * diffuseBRDF * ( 1.0 - F );',
    `{
        float nlEnv = dot( geometryNormal, directLight.direction );
        vec3 irrEnv = clamp( ( vec3( nlEnv ) + ${w} ) / ( 1.0 + ${w} ), 0.0, 1.0 ) * directLight.color;
        reflectedLight.directDiffuse += irrEnv * diffuseBRDF * ( 1.0 - F );
        ${transmissao ?? ''}
      }`,
  );
  s.fragmentShader = s.fragmentShader.replace('#include <lights_physical_pars_fragment>', luz);
}

let compartilhado: MateriaisGnomo | null = null;
let usuarios = 0;

export function pegarMateriais(): MateriaisGnomo {
  usuarios++;
  if (compartilhado) return compartilhado;
  const tx = pegarTexturas();
  const doDisco: THREE.Texture[] = [];

  /* ------------------------------------------------------------------ pele e olhos */
  const pele = new THREE.MeshPhysicalMaterial({
    name: 'gnomo-pele',
    vertexColors: true,
    map: tx.olhos,
    roughness: 0.52,
    specularIntensity: 0.5,
    sheen: 0.35,
    sheenColor: new THREE.Color('#ff9f8a'),
    sheenRoughness: 0.4,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    normalMap: tx.porosNormal,
    normalScale: new THREE.Vector2(0.04, 0.04),
  });
  pele.onBeforeCompile = (s) => {
    preparar(s);
    // luz que atravessa orelha e nariz contra a luz (cor de sangue), proporcional à "finura" (alfa da cor)
    luzEnvolvente(s, [0.34, 0.15, 0.1], 'reflectedLight.directDiffuse += directLight.color * vec3( 1.0, 0.35, 0.24 ) * pow( saturate( dot( geometryViewDir, - directLight.direction ) ), 2.5 ) * vColor.a * ( 1.0 - vTipo ) * 0.55;');
    s.fragmentShader = s.fragmentShader
      .replace('#include <map_fragment>', '')
      .replace(
        '#include <color_fragment>',
        `{
          vec3 olho = texture2D( map, vMapUv ).rgb;
          diffuseColor.rgb *= mix( vColor.rgb, olho, vTipo );
        }`,
      )
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n  normal = normalize( mix( normal, nonPerturbedNormal, vTipo ) );')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = mix( roughnessFactor, 0.3, vTipo );')
      .replace(
        '#include <lights_physical_fragment>',
        `#include <lights_physical_fragment>
        material.clearcoat *= vTipo;
        #ifdef USE_SHEEN
          material.sheenColor *= ( 1.0 - vTipo );
        #endif`,
      );
  };
  pele.customProgramCacheKey = () => 'gnomo-pele-2';

  /* ------------------------------------------------------------------ tecido */
  const motivo = { value: new THREE.Color(COR_MOTIVO) };
  const uTecido = {
    uMotivo: motivo,
    uFeltroCor: { value: tx.feltroCor as THREE.Texture },
    uFeltroNor: { value: tx.feltroNormal as THREE.Texture },
    uDetalhe: { value: tx.feltroNormal as THREE.Texture },
    uDetalheForca: { value: 0 },
  };
  const tecido = new THREE.MeshPhysicalMaterial({
    name: 'gnomo-tecido',
    vertexColors: true,
    map: tx.tricoCor,
    normalMap: tx.tricoNormal,
    normalScale: new THREE.Vector2(0.6, 0.6),
    roughness: 0.96,
    sheen: 1,
    sheenColor: new THREE.Color('#ffffff'),
    sheenRoughness: 0.38,
    specularIntensity: 0.22,
  });
  tecido.onBeforeCompile = (s) => {
    preparar(s);
    Object.assign(s.uniforms, uTecido);
    luzEnvolvente(s, [0.36, 0.3, 0.27]);
    s.fragmentShader = s.fragmentShader
      .replace('void main() {', 'uniform vec3 uMotivo;\nuniform sampler2D uFeltroCor;\nuniform sampler2D uFeltroNor;\nuniform sampler2D uDetalhe;\nuniform float uDetalheForca;\nvoid main() {')
      .replace('#include <map_fragment>', '')
      .replace(
        '#include <color_fragment>',
        `{
          vec4 pontoTex = texture2D( map, vMapUv );
          vec3 base = mix( vColor.rgb, uMotivo, pontoTex.g * vColor.a );
          float sombraPonto = 0.5 + 0.58 * pow( pontoTex.r, 1.3 );
          vec3 trico = base * sombraPonto;
          vec3 feltro = vColor.rgb * texture2D( uFeltroCor, vMapUv ).rgb;
          diffuseColor.rgb *= mix( trico, feltro, vTipo );
        }`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#ifdef USE_NORMALMAP_TANGENTSPACE
        {
          vec3 nT = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
          nT.xy *= normalScale;
          vec3 nD = texture2D( uDetalhe, vNormalMapUv * 2.7 ).xyz * 2.0 - 1.0;
          nT.xy += nD.xy * uDetalheForca;
          vec3 nF = texture2D( uFeltroNor, vNormalMapUv ).xyz * 2.0 - 1.0;
          nF.xy *= 0.32;
          vec3 mapN = mix( nT, nF, vTipo );
          normal = normalize( tbn * mapN );
        }
        #endif`,
      )
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = mix( roughnessFactor, 1.0, vTipo );')
      .replace(
        '#include <lights_physical_fragment>',
        `#include <lights_physical_fragment>
        #ifdef USE_SHEEN
          // penugem tingida pela cor do fio (sem isso, todo tecido ganha um véu branco); o feltro brilha menos
          material.sheenColor = sheenColor * ( 0.3 + 1.7 * diffuseColor.rgb ) * mix( 1.0, 0.32, vTipo );
        #endif`,
      );
  };
  tecido.customProgramCacheKey = () => 'gnomo-tecido-2';

  /* ------------------------------------------------------------------ barba */
  const uBarba = { uCartoes: { value: tx.cartoes as THREE.Texture } };
  const barba = new THREE.MeshPhysicalMaterial({
    name: 'gnomo-barba',
    vertexColors: true,
    map: tx.fiosCor,
    normalMap: tx.fiosNormal,
    normalScale: new THREE.Vector2(0.45, 0.45),
    roughness: 0.62,
    anisotropy: 0.6,
    anisotropyRotation: Math.PI / 2,
    sheen: 0.7,
    sheenColor: new THREE.Color('#ffffff'),
    sheenRoughness: 0.45,
    specularIntensity: 0.3,
    alphaTest: 0.42,
  });
  barba.onBeforeCompile = (s) => {
    preparar(s);
    Object.assign(s.uniforms, uBarba);
    luzEnvolvente(s, [0.42, 0.37, 0.34]);
    s.fragmentShader = s.fragmentShader
      .replace('void main() {', 'uniform sampler2D uCartoes;\nvoid main() {')
      .replace(
        '#include <color_fragment>',
        `diffuseColor.rgb *= vColor.rgb;
        {
          // cartões de fios: recorte pelo alfa da textura de fios soltos
          vec4 c = texture2D( uCartoes, vMapUv );
          diffuseColor.a = mix( 1.0, c.a, vTipo );
          diffuseColor.rgb *= mix( 1.0, 0.8 + 0.3 * c.r, vTipo );
        }`,
      )
      .replace(
        '#include <lights_physical_fragment>',
        `#include <lights_physical_fragment>
        #ifdef USE_SHEEN
          material.sheenColor = sheenColor * ( 0.3 + 1.4 * diffuseColor.rgb );
        #endif`,
      );
  };
  barba.customProgramCacheKey = () => 'gnomo-barba-2';

  /* ------------------------------------------------------------------ duro */
  const uDuro = { uBrilho: { value: new THREE.Color('#ffb860').multiplyScalar(2.2) } };
  const duro = new THREE.MeshStandardMaterial({ name: 'gnomo-duro', vertexColors: true, roughness: 0.62, metalness: 0 });
  duro.onBeforeCompile = (s) => {
    preparar(s);
    Object.assign(s.uniforms, uDuro);
    s.fragmentShader = s.fragmentShader
      .replace('void main() {', 'uniform vec3 uBrilho;\nvoid main() {')
      .replace(
        '#include <map_fragment>',
        `#ifdef USE_MAP
          diffuseColor *= mix( texture2D( map, vMapUv ), vec4( 1.0 ), step( 0.5, vTipo ) );
        #endif`,
      )
      .replace('#include <color_fragment>', 'diffuseColor.rgb *= vColor.rgb * ( 1.0 - step( 1.5, vTipo ) );')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = mix( roughnessFactor, 0.38, step( 0.5, vTipo ) );')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n  metalnessFactor = step( 0.5, vTipo ) * ( 1.0 - step( 1.5, vTipo ) ) * 0.8;')
      .replace(
        '#include <normal_fragment_maps>',
        `#ifdef USE_NORMALMAP_TANGENTSPACE
        {
          vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
          mapN.xy *= normalScale * ( 1.0 - step( 0.5, vTipo ) );
          normal = normalize( tbn * mapN );
        }
        #endif`,
      )
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance += uBrilho * step( 1.5, vTipo );');
  };
  duro.customProgramCacheKey = () => 'gnomo-duro-2';

  /* ------------------------------------------------- nível baixo: MeshStandard simples */
  const leveComCor = (nome: string, extra: THREE.MeshStandardMaterialParameters, cor: string) => {
    const mat = new THREE.MeshStandardMaterial({ name: nome, vertexColors: true, ...extra });
    mat.onBeforeCompile = (s) => {
      preparar(s);
      s.fragmentShader = s.fragmentShader.replace('#include <map_fragment>', '').replace('#include <color_fragment>', cor);
    };
    mat.customProgramCacheKey = () => `${nome}-2`;
    return mat;
  };
  const pelLeve = leveComCor('gnomo-pele-leve', { map: tx.olhos, roughness: 0.55 }, 'diffuseColor.rgb *= mix( vColor.rgb, texture2D( map, vMapUv ).rgb, vTipo );');
  const tecLeve = leveComCor(
    'gnomo-tecido-leve',
    { map: tx.tricoCor, roughness: 0.95 },
    `{
      vec4 pontoTex = texture2D( map, vMapUv );
      vec3 base = mix( vColor.rgb, vec3( 0.93, 0.9, 0.86 ), pontoTex.g * vColor.a * ( 1.0 - vTipo ) );
      diffuseColor.rgb *= base * mix( 0.45 + 0.7 * pontoTex.r, 0.95, vTipo );
    }`,
  );
  const barLeve = leveComCor('gnomo-barba-leve', { map: tx.fiosCor, roughness: 0.7 }, 'diffuseColor.rgb *= vColor.rgb * texture2D( map, vMapUv ).rgb; if ( vTipo > 0.5 ) discard;');
  const durLeve = leveComCor('gnomo-duro-leve', { roughness: 0.6 }, 'diffuseColor.rgb *= vColor.rgb * mix( 1.0, 3.0, step( 1.5, vTipo ) );');

  const sombra = new THREE.MeshBasicMaterial({ name: 'gnomo-sombra', colorWrite: false, depthWrite: false });

  // brown_leather do Poly Haven (botas e cinto) e knitted_fleece (penugem fina do tricô)
  void Promise.all([
    loadTexture('assets/texturas/brown_leather/diff.jpg', { srgb: true }),
    loadTexture('assets/texturas/brown_leather/nor.jpg'),
    loadTexture('assets/texturas/brown_leather/arm.jpg'),
  ])
    .then(([map, normal, arm]) => {
      if (!compartilhado) return;
      doDisco.push(map, normal, arm);
      duro.map = map;
      duro.normalMap = normal;
      duro.normalScale.set(1.2, 1.2);
      duro.roughnessMap = arm;
      duro.roughness = 0.9;
      duro.needsUpdate = true;
    })
    .catch(() => undefined);
  void loadTexture('assets/texturas/knitted_fleece/nor.jpg')
    .then((t) => {
      if (!compartilhado) return;
      doDisco.push(t);
      uTecido.uDetalhe.value = t;
      uTecido.uDetalheForca.value = 0.35;
    })
    .catch(() => undefined);

  const m: Record<NomeMaterial, THREE.Material> = { pele, tecido, barba, duro };
  const leves: Record<NomeMaterial, THREE.Material> = { pele: pelLeve, tecido: tecLeve, barba: barLeve, duro: durLeve };
  compartilhado = {
    m,
    leves,
    sombra,
    setQuality(level) {
      // no médio, um pouco menos de penugem e de verniz (mesmos programas)
      const media = level === 'media';
      tecido.sheen = media ? 0.8 : 1;
      barba.anisotropy = media ? 0.45 : 0.6;
    },
    dispose() {
      for (const k of MATERIAIS) {
        m[k].dispose();
        leves[k].dispose();
      }
      sombra.dispose();
      for (const t of doDisco) t.dispose();
      soltarTexturas();
    },
  };
  return compartilhado;
}

export function soltarMateriais(): void {
  usuarios = Math.max(0, usuarios - 1);
  if (usuarios === 0 && compartilhado) {
    compartilhado.dispose();
    compartilhado = null;
  }
}
