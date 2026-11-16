/**
 * Materiais dos presentes e da caixa, criados UMA vez e compartilhados por todas as cópias.
 *
 * O principal é a "pintura": um MeshPhysicalMaterial que lê o ACABAMENTO de cada vértice (metal,
 * rugosidade, verniz e brilho próprio; veja malha.ts). Assim, numa mesma malha (uma chamada de desenho),
 * o trenzinho tem madeira pintada acetinada, aros dourados metálicos e farol aceso; a caneca tem esmalte
 * brilhante, chocolate e chantili fosco. As variantes da pintura só trocam o relevo (normal) e, às vezes,
 * a estampa: o programa de sombreamento é o mesmo.
 *
 * Os outros: tecido (tricô, feltro, cetim das fitas e laços, com brilho de tecido), pelúcia em cascas
 * (como a do Noel), vidro (globo de neve), folhagem de abeto (pinheirinho, com os ramos assados da árvore
 * da sala), papel de presente (caixa), flocos de neve e vapor.
 *
 * Cuidado com o brilho: nenhum material passa do limiar do bloom sozinho. O "ouro" é latão escovado
 * (rugosidade 0,3 a 0,45), não espelho; o brilho próprio só existe na janelinha do globo e no farol do
 * trem, fraco.
 */
import * as THREE from 'three';
import { loadPbr, loadTexture } from '../../../engine/assets';
import { mascaraDePelo } from '../noel/texturas';
import { normalDePapel } from '../../kit/arvore/texturas';
import {
  mapaBengala,
  mapaBola,
  mapaCaneca,
  mapaMeia,
  mapaPapelCaixa,
  manchaMacia,
  MEIA_COLUNAS,
  normalCetim,
  normalEsmalte,
  normalFeltro,
  normalMadeira,
  normalMassa,
  normalMetal,
  normalNeve,
  normalTrico,
} from './texturas';

export type NomeMaterial =
  | 'metal'
  | 'esmalte'
  | 'madeira'
  | 'massa'
  | 'neve'
  | 'bola'
  | 'caneca'
  | 'bengala'
  | 'trico'
  | 'meia'
  | 'feltro'
  | 'cetim'
  | 'pelucia'
  | 'vidro'
  | 'folhagem'
  | 'papel';

export interface MateriaisPresentes {
  get(nome: NomeMaterial): THREE.Material;
  flocos: THREE.PointsMaterial;
  vapor: THREE.ShaderMaterial;
  /** Uniformes da pelúcia (quantas cascas estão ativas). */
  peloU: { uCamadas: { value: number } };
  /** Relógio dos shaders animados (vapor). */
  tempo: { value: number };
  /** Todos os materiais que refletem o ambiente (recebem o ambiente reserva no estúdio). */
  todos: THREE.MeshStandardMaterial[];
  /** Resolve quando as texturas do disco (Poly Haven e ramos da árvore) chegaram. */
  pronto: Promise<void>;
  dispose(): void;
}

/** Máximo de cascas da pelúcia (nível alto). */
export const CASCAS_MAX = 6;

const GLSL_ACAB_VERT = /* glsl */ `#include <common>
attribute vec4 acab;
varying vec4 vAcab;`;
const GLSL_ACAB_FRAG = /* glsl */ `#include <common>
varying vec4 vAcab;
uniform float uBrilhoProprio;`;

/** Liga o acabamento por vértice (atributo `acab`) a um MeshPhysicalMaterial. */
function comAcabamento(m: THREE.MeshPhysicalMaterial, chave: string) {
  const u = { uBrilhoProprio: { value: 1.4 } };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', GLSL_ACAB_VERT).replace('#include <begin_vertex>', '#include <begin_vertex>\nvAcab = acab;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', GLSL_ACAB_FRAG)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor *= vAcab.y;')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor *= vAcab.x;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * vAcab.w * uBrilhoProprio;')
      .replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\nmaterial.clearcoat *= vAcab.z;');
  };
  m.customProgramCacheKey = () => `presente-acab-${chave}`;
}

/** Repete uma textura compartilhada com outra escala (cópia leve: a imagem é a mesma). */
function repetida(t: THREE.Texture, r: number, ry = r): THREE.Texture {
  const c = t.clone();
  c.repeat.set(r, ry);
  c.needsUpdate = true;
  return c;
}

export function criarMateriais(): MateriaisPresentes {
  const proprias: THREE.Texture[] = [];
  const guardar = <T extends THREE.Texture>(t: T) => {
    proprias.push(t);
    return t;
  };

  const pintura = (nome: string, o: { normal: THREE.Texture; forca: number; map?: THREE.Texture; sheen?: number; envMapIntensity?: number }) => {
    const m = new THREE.MeshPhysicalMaterial({
      name: `presente-${nome}`,
      color: '#ffffff',
      roughness: 1,
      metalness: 1,
      clearcoat: 1,
      clearcoatRoughness: 0.16,
      vertexColors: true,
      normalMap: o.normal,
      normalScale: new THREE.Vector2(o.forca, o.forca),
      map: o.map ?? null,
      envMapIntensity: o.envMapIntensity ?? 1,
    });
    if (o.sheen) {
      m.sheen = o.sheen;
      m.sheenColor = new THREE.Color('#ffffff');
      m.sheenRoughness = 0.5;
    }
    comAcabamento(m, nome + (o.map ? '-mapa' : '') + (o.sheen ? '-sheen' : ''));
    return m;
  };

  // as UV das peças estão em metros: repetir = 1 / tamanho do ladrilho
  const metal = pintura('metal', { normal: guardar(repetida(normalMetal(), 1 / 0.07)), forca: 0.28 });
  const esmalte = pintura('esmalte', { normal: guardar(repetida(normalEsmalte(), 1 / 0.16)), forca: 0.18 });
  const madeira = pintura('madeira', { normal: guardar(repetida(normalMadeira(), 1 / 0.22, 1 / 0.6)), forca: 0.3 });
  const massa = pintura('massa', { normal: guardar(repetida(normalMassa(), 1 / 0.06)), forca: 0.85 });
  const neve = pintura('neve', { normal: guardar(repetida(normalNeve(), 1 / 0.07)), forca: 0.7, sheen: 0.5, envMapIntensity: 0.6 });
  // estampas: as UV dessas peças vão de 0 a 1 (uma volta); o relevo do esmalte vai junto, repetido
  const bola = pintura('bola', { normal: guardar(repetida(normalEsmalte(), 3, 2)), forca: 0.12, map: mapaBola() });
  const caneca = pintura('caneca', { normal: guardar(repetida(normalEsmalte(), 3, 1)), forca: 0.15, map: mapaCaneca() });
  const bengala = pintura('bengala', { normal: guardar(repetida(normalEsmalte(), 1, 3)), forca: 0.12, map: mapaBengala() });

  const tecido = (nome: string, o: { normal: THREE.Texture; forca: number; map?: THREE.Texture; rug: number; sheen: number; sheenRug?: number; lados?: THREE.Side }) => {
    const m = new THREE.MeshPhysicalMaterial({
      name: `presente-${nome}`,
      color: '#ffffff',
      roughness: o.rug,
      metalness: 0,
      vertexColors: true,
      normalMap: o.normal,
      normalScale: new THREE.Vector2(o.forca, o.forca),
      map: o.map ?? null,
      sheen: o.sheen,
      sheenColor: new THREE.Color('#ffffff'),
      sheenRoughness: o.sheenRug ?? 0.5,
      specularIntensity: 0.35,
      envMapIntensity: 0.55,
      side: o.lados ?? THREE.FrontSide,
    });
    return m;
  };
  // tricô: UV em metros; o ponto mede ~7 mm (8 pontos por ladrilho = 5,6 cm)
  const trico = tecido('trico', { normal: guardar(repetida(normalTrico(), 1 / 0.056)), forca: 0.9, rug: 0.88, sheen: 0.55 });
  // meia: UV em pontos (u = coluna / colunas, v = carreira / carreiras); o relevo acompanha 1 ponto por pixel
  const meia = tecido('meia', { normal: guardar(repetida(normalTrico(), MEIA_COLUNAS / 8, 96 / 8)), forca: 1.0, map: mapaMeia(), rug: 0.9, sheen: 0.5 });
  const feltro = tecido('feltro', { normal: guardar(repetida(normalFeltro(), 1 / 0.03)), forca: 0.6, rug: 0.95, sheen: 0.6 });
  // cetim: brilho macio e comprido, véu claro no rasante; as fitas são folhas finas (dois lados)
  const cetim = tecido('cetim', { normal: guardar(repetida(normalCetim(), 1 / 0.05, 1 / 0.02)), forca: 0.25, rug: 0.36, sheen: 0.45, sheenRug: 0.35, lados: THREE.DoubleSide });
  cetim.specularIntensity = 0.6;
  cetim.envMapIntensity = 0.8;

  /* ---------------------------------------------------------------- pelúcia em cascas */
  const mascara = mascaraDePelo(256, 170, 23);
  proprias.push(mascara);
  const peloU = {
    uCamadas: { value: CASCAS_MAX - 1 },
    uMascara: { value: mascara as THREE.Texture },
    uDensidade: { value: 22.0 },
    uGravidade: { value: new THREE.Vector3(0, -0.35, 0) },
  };
  const pelucia = new THREE.MeshStandardMaterial({ name: 'presente-pelucia', color: '#ffffff', roughness: 0.9, metalness: 0, vertexColors: true, envMapIntensity: 0.5 });
  pelucia.alphaToCoverage = true;
  pelucia.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, peloU);
    sh.vertexShader = sh.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute vec4 pelo;
uniform float uCamadas;
uniform vec3 uGravidade;
varying float vCamada;
varying vec2 vUvPelo;
varying float vEstica;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
float hPelo = pelo.w / max(uCamadas, 1.0);
vCamada = hPelo;
vUvPelo = uv + vec2(pelo.z * 0.37, pelo.z * 0.61);
vEstica = pelo.y;
transformed += normal * (pelo.x * hPelo) + uGravidade * (pelo.x * hPelo * hPelo);`,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform sampler2D uMascara;
uniform float uDensidade;
varying float vCamada;
varying vec2 vUvPelo;
varying float vEstica;`,
      )
      .replace(
        '#include <alphatest_fragment>',
        `#include <alphatest_fragment>
vec2 uvFio = vUvPelo * uDensidade * vec2(1.0, vEstica);
float fio = texture2D(uMascara, uvFio).r;
float fio2 = texture2D(uMascara, uvFio * 0.31 + 0.21).r;
float ndvPelo = abs(dot(normalize(vNormal), normalize(vViewPosition)));
float raspao = 1.0 - smoothstep(0.1, 0.45, ndvPelo);
float limiarPelo = vCamada * 0.88 + 0.05 + raspao * vCamada * 0.7;
limiarPelo += 0.12 * smoothstep(0.7, 1.0, vCamada);
float largura = max(fwidth(fio) * 1.2, 0.04);
float cobre = vCamada > 0.001 ? smoothstep(limiarPelo - largura, limiarPelo + largura, fio) : 1.0;
if (cobre < 0.2) discard;
diffuseColor.a = cobre;
float raiz = mix(0.66, 1.0, smoothstep(0.0, 0.8, vCamada + fio * 0.35));
diffuseColor.rgb *= raiz * mix(0.88, 1.06, fio2);`,
      )
      .replace(
        '#include <map_fragment>',
        `#ifdef USE_MAP
vec4 texelTeddy = texture2D(map, vMapUv);
float lumTeddy = dot(texelTeddy.rgb, vec3(0.299, 0.587, 0.114));
diffuseColor.rgb *= mix(0.8, 1.06, smoothstep(0.3, 0.75, lumTeddy));
#endif`,
      );
  };
  pelucia.customProgramCacheKey = () => 'presente-pelucia-tufos';

  /* ------------------------------------------------------------------------- vidro */
  // vidro fino: quase invisível de frente, refletindo mais na borda (Fresnel feito à mão, sem a passada
  // extra de transmissão, que custaria redesenhar a cena)
  const vidro = new THREE.MeshPhysicalMaterial({
    name: 'presente-vidro',
    color: '#eef4ff',
    roughness: 0.04,
    metalness: 0,
    transparent: true,
    opacity: 0.1,
    depthWrite: false,
    specularIntensity: 1,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    envMapIntensity: 1.4,
  });
  vidro.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace(
      '#include <opaque_fragment>',
      `float ndvVidro = abs(dot(normalize(vNormal), normalize(vViewPosition)));
float fresnelVidro = pow(1.0 - ndvVidro, 3.0);
diffuseColor.a = clamp(diffuseColor.a + fresnelVidro * 0.55, 0.0, 0.8);
#include <opaque_fragment>`,
    );
  };
  vidro.customProgramCacheKey = () => 'presente-vidro';

  /* ---------------------------------------------------------------------- folhagem */
  // os ramos de abeto assados para a árvore da sala (atlas 3 x 3, cor + recorte e normal); chegam depois
  const folhagem = new THREE.MeshStandardMaterial({
    name: 'presente-folhagem',
    color: '#ffffff',
    roughness: 0.75,
    metalness: 0,
    vertexColors: true,
    alphaTest: 0.45,
    side: THREE.DoubleSide,
    envMapIntensity: 0.4,
  });
  folhagem.alphaToCoverage = true;
  folhagem.visible = false; // só aparece com os ramos carregados (sem eles seriam quadrados verdes)

  /* ------------------------------------------------------------------------ papel */
  const papelCor = mapaPapelCaixa();
  const papelRelevo = guardar(normalDePapel());
  papelRelevo.repeat.set(1 / 0.2, 1 / 0.2);
  const papel = new THREE.MeshPhysicalMaterial({
    name: 'presente-papel',
    map: papelCor,
    normalMap: papelRelevo,
    normalScale: new THREE.Vector2(0.45, 0.45),
    roughness: 0.55,
    metalness: 0,
    clearcoat: 0.25,
    clearcoatRoughness: 0.35,
    vertexColors: true,
    envMapIntensity: 0.6,
  });

  /* ------------------------------------------------------------- flocos e vapor */
  const flocos = new THREE.PointsMaterial({
    name: 'presente-flocos',
    color: '#ffffff',
    map: manchaMacia(),
    size: 0.012,
    sizeAttenuation: true,
    transparent: true,
    depthWrite: false,
    alphaTest: 0.02,
  });
  const tempo = { value: 0 };
  const vapor = new THREE.ShaderMaterial({
    name: 'presente-vapor',
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { uTempo: tempo, uCor: { value: new THREE.Color('#fff3e6') } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying float vFace;
      uniform float uTempo;
      attribute float fase;
      void main() {
        vUv = uv;
        vec3 p = position;
        // a fita de vapor ondula e sobe, cada uma no seu tempo
        float t = uTempo * 0.6 + fase;
        p.x += sin(uv.y * 5.0 - t * 2.0) * 0.012 * uv.y + sin(uv.y * 11.0 - t * 3.1) * 0.004 * uv.y;
        p.z += cos(uv.y * 4.0 - t * 1.7) * 0.01 * uv.y;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        vFace = fase;
      }`,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      varying float vFace;
      uniform float uTempo;
      uniform vec3 uCor;
      float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h(i), h(i + vec2(1.0, 0.0)), f.x), mix(h(i + vec2(0.0, 1.0)), h(i + vec2(1.0, 1.0)), f.x), f.y);
      }
      void main() {
        float t = uTempo * 0.35 + vFace;
        vec2 q = vec2(vUv.x * 2.0, vUv.y * 3.0 - t);
        float fumo = n(q * 2.0) * 0.6 + n(q * 4.3 + 3.1) * 0.4;
        float borda = smoothstep(0.0, 0.35, vUv.x) * smoothstep(1.0, 0.65, vUv.x);
        float altura = smoothstep(0.0, 0.15, vUv.y) * (1.0 - smoothstep(0.45, 1.0, vUv.y));
        float a = borda * altura * smoothstep(0.35, 0.8, fumo) * 0.35;
        if (a < 0.003) discard;
        gl_FragColor = vec4(uCor, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });

  const porNome: Record<NomeMaterial, THREE.Material> = {
    metal,
    esmalte,
    madeira,
    massa,
    neve,
    bola,
    caneca,
    bengala,
    trico,
    meia,
    feltro,
    cetim,
    pelucia,
    vidro,
    folhagem,
    papel,
  };

  /* ------------------------------------------------- texturas do disco (assíncronas) */
  let descartado = false;
  const aplicar = (m: THREE.MeshStandardMaterial, mapas: Partial<Record<'map' | 'normalMap' | 'roughnessMap', THREE.Texture | undefined>>) => {
    if (descartado) {
      for (const t of Object.values(mapas)) t?.dispose();
      return;
    }
    Object.assign(m, mapas);
    for (const t of Object.values(mapas)) if (t) proprias.push(t);
    m.needsUpdate = true;
  };
  const esperas: Array<Promise<unknown>> = [];
  // pelúcia: cachos do curly teddy (ladrilho ~0,25 m; as UV da pelúcia estão em metros)
  esperas.push(
    loadPbr('curly_teddy_natural', { maps: ['diff', 'nor'], repeat: [6, 6] })
      .then((t) => {
        pelucia.normalScale = new THREE.Vector2(0.8, 0.8);
        aplicar(pelucia, { map: t.map, normalMap: t.normalMap });
      })
      .catch(() => undefined),
  );
  // ramos de abeto da árvore da sala
  esperas.push(
    Promise.all([loadTexture('assets/arvore/ramo_cor.webp', { srgb: true, anisotropy: 4 }), loadTexture('assets/arvore/ramo_normal.webp', { anisotropy: 4 })])
      .then(([cor, nor]) => {
        for (const t of [cor, nor]) {
          t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
          t.needsUpdate = true;
        }
        aplicar(folhagem, { map: cor, normalMap: nor });
        if (!descartado) folhagem.visible = true;
      })
      .catch(() => undefined),
  );
  // neve do Poly Haven (relevo de grãos de verdade) por cima do procedural, quando houver
  esperas.push(
    loadPbr('snow_02', { maps: ['nor'], repeat: [1 / 0.5, 1 / 0.5] })
      .then((t) => aplicar(neve, { normalMap: t.normalMap }))
      .catch(() => undefined),
  );

  const todos = [metal, esmalte, madeira, massa, neve, bola, caneca, bengala, trico, meia, feltro, cetim, pelucia, vidro, folhagem, papel];

  return {
    get: (nome) => porNome[nome],
    flocos,
    vapor,
    peloU,
    tempo,
    todos,
    pronto: Promise.all(esperas).then(() => undefined),
    dispose() {
      descartado = true;
      for (const m of todos) m.dispose();
      flocos.dispose();
      vapor.dispose();
      for (const t of proprias) t.dispose();
    },
  };
}
