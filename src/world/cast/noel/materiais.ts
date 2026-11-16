/**
 * Materiais do Noel, compartilhados por todas as cópias: veludo com brilho de veludo (sheen), pelúcia em
 * cascas, pele com rubor, luva de feltro macio, couro envernizado, ouro, olhos vidrados, juta do saco e
 * papel de presente. As texturas do disco (Poly Haven, CC0) chegam depois: o material nasce pronto e
 * ganha os mapas quando eles carregam (createSanta é síncrono).
 */
import * as THREE from 'three';
import { loadPbr } from '../../../engine/assets';
import { CORES, PUFE } from './medidas';
import { mascaraDePelo, papelDePresente, texturaDeFios } from './texturas';

export interface MateriaisNoel {
  veludo: THREE.MeshPhysicalMaterial;
  /** Veludo verde-pinheiro do pufe (mesmos mapas do vermelho). */
  veludoVerde: THREE.MeshPhysicalMaterial;
  /** Fitas de cetim dourado fosco dos presentes. */
  fita: THREE.MeshStandardMaterial;
  pelo: THREE.MeshStandardMaterial;
  /** Mechas da barba, do bigode e das sobrancelhas: fios penteados, sem cascas. */
  mecha: THREE.MeshPhysicalMaterial;
  pele: THREE.MeshPhysicalMaterial;
  luva: THREE.MeshPhysicalMaterial;
  couro: THREE.MeshPhysicalMaterial;
  ouro: THREE.MeshStandardMaterial;
  olhos: THREE.MeshPhysicalMaterial;
  saco: THREE.MeshStandardMaterial;
  papel: THREE.MeshPhysicalMaterial;
  /** Uniformes do pelo (quantas cascas estão ativas). */
  peloU: { uCamadas: { value: number } };
  /** Materiais que refletem o ambiente (recebem um ambiente reserva quando a cena não tem um). */
  refletivos: THREE.MeshStandardMaterial[];
  dispose(): void;
}

/** Número máximo de cascas do pelo (nível alto). */
export const CASCAS_MAX = 5;

export function criarMateriais(): MateriaisNoel {
  const texturas: THREE.Texture[] = [];

  // veludo carmim profundo: quase nada de reflexo especular; o brilho dele é o sheen, que com a rugosidade
  // baixa do sheen fica concentrado nas bordas e nos volumes (não lava o tecido inteiro)
  const veludo = new THREE.MeshPhysicalMaterial({
    name: 'noel-veludo',
    color: CORES.veludo,
    roughness: 0.92,
    metalness: 0,
    specularIntensity: 0.15,
    sheen: 0.8,
    sheenColor: new THREE.Color(CORES.veludoBrilho),
    sheenRoughness: 0.42,
    vertexColors: true,
    envMapIntensity: 0.6,
  });
  const veludoVerde = veludo.clone();
  veludoVerde.name = 'noel-veludo-verde';
  veludoVerde.color.set(PUFE.cor);
  veludoVerde.sheenColor.set(PUFE.brilho);
  veludoVerde.sheen = 0.7;

  /* ---------------------------------------------------------------- pelúcia em cascas */
  const mascara = mascaraDePelo();
  texturas.push(mascara);
  const peloU = {
    uCamadas: { value: CASCAS_MAX - 1 },
    uMascara: { value: mascara as THREE.Texture },
    uDensidade: { value: 8.5 },
    uGravidade: { value: new THREE.Vector3(0, -0.6, 0) },
  };
  const pelo = new THREE.MeshStandardMaterial({
    name: 'noel-pelucia',
    color: CORES.pelo,
    roughness: 0.92,
    metalness: 0,
    vertexColors: true,
    envMapIntensity: 0.55,
  });
  // a borda dos fios sai suave pela multiamostragem (alpha to coverage) em vez do corte seco do discard,
  // que soltava "poeira" de pixels no contorno
  pelo.alphaToCoverage = true;
  pelo.onBeforeCompile = (sh) => {
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
// os tufos se curvam: sobem pela normal e tombam com a gravidade perto da ponta
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
// de raspão (contorno) as cascas viram fatias: afina os fios ali e deixa o contorno para a malha fofa
float ndvPelo = abs(dot(normalize(vNormal), normalize(vViewPosition)));
float raspao = 1.0 - smoothstep(0.1, 0.45, ndvPelo);
float limiarPelo = vCamada * 0.88 + 0.05 + raspao * vCamada * 0.7;
// na casca de fora só ficam as pontas dos tufos (nada de fio solto isolado)
limiarPelo += 0.12 * smoothstep(0.7, 1.0, vCamada);
float largura = max(fwidth(fio) * 1.2, 0.04);
float cobre = vCamada > 0.001 ? smoothstep(limiarPelo - largura, limiarPelo + largura, fio) : 1.0;
if (cobre < 0.2) discard;
diffuseColor.a = cobre;
// raiz mais escura (oclusão entre os fios), ponta clara; leve variação de tufos
float raiz = mix(0.74, 1.0, smoothstep(0.0, 0.8, vCamada + fio * 0.35));
diffuseColor.rgb *= raiz * mix(0.9, 1.05, fio2);`,
      )
      // a cor da pelúcia (curly teddy) entra só como luminância: cachos claros e escuros, sem o bege
      .replace(
        '#include <map_fragment>',
        `#ifdef USE_MAP
vec4 texelTeddy = texture2D(map, vMapUv);
float lumTeddy = dot(texelTeddy.rgb, vec3(0.299, 0.587, 0.114));
diffuseColor.rgb *= mix(0.82, 1.05, smoothstep(0.3, 0.75, lumTeddy));
#endif`,
      );
  };
  pelo.customProgramCacheKey = () => 'noel-pelucia-tufos';

  // mechas: fios finos em mapa de normal (não mais o relevo largo que parecia sabão) e brilho anisotrópico
  // correndo ao longo dos fios (a direção v das mechas)
  const fios = texturaDeFios();
  fios.cor.repeat.set(12, 3);
  fios.normal.repeat.set(12, 3);
  texturas.push(fios.cor, fios.normal);
  const mecha = new THREE.MeshPhysicalMaterial({
    name: 'noel-mechas',
    color: CORES.pelo,
    roughness: 0.66,
    sheen: 0.8,
    sheenColor: new THREE.Color('#ffffff'),
    sheenRoughness: 0.45,
    map: fios.cor,
    normalMap: fios.normal,
    normalScale: new THREE.Vector2(0.9, 0.9),
    anisotropy: 0.6,
    anisotropyRotation: Math.PI / 2,
    specularIntensity: 0.3,
    vertexColors: true,
    envMapIntensity: 0.55,
  });

  // contorno das mechas em fios: de raspão (onde a mecha vira contorno) só ficam os fios mais altos do
  // mapa, com cobertura suave (alpha to coverage): a silhueta deixa de ser um polígono liso e vira
  // pelo, sem nenhum triângulo a mais
  mecha.alphaToCoverage = true;
  mecha.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace(
      '#include <alphatest_fragment>',
      `#include <alphatest_fragment>
#ifdef USE_MAP
float fioM = clamp((texture2D(map, vMapUv * vec2(1.7, 1.0)).r - 0.84) / 0.16, 0.0, 1.0);
float ndvM = abs(dot(normalize(vNormal), normalize(vViewPosition)));
float cobreM = smoothstep(0.035, 0.15, ndvM + (fioM - 0.55) * 0.16);
if (cobreM < 0.15) discard;
diffuseColor.a = cobreM;
#endif`,
    );
  };
  mecha.customProgramCacheKey = () => 'noel-mechas-contorno';

  // pele: o sheen avermelhado nas bordas imita a luz que atravessa a pele (subsurface aparente)
  const pele = new THREE.MeshPhysicalMaterial({
    name: 'noel-pele',
    color: '#ffffff',
    roughness: 0.5,
    metalness: 0,
    sheen: 0.7,
    sheenColor: new THREE.Color('#ff8a7a'),
    sheenRoughness: 0.35,
    clearcoat: 0.12,
    clearcoatRoughness: 0.45,
    vertexColors: true,
    envMapIntensity: 0.5,
  });

  const luva = new THREE.MeshPhysicalMaterial({
    name: 'noel-luva',
    color: CORES.luva,
    roughness: 0.78,
    sheen: 0.7,
    sheenColor: new THREE.Color('#ffffff'),
    sheenRoughness: 0.5,
    vertexColors: true,
    envMapIntensity: 0.5,
  });

  // couro acetinado (não envernizado): a cor vem por vértice (botas marrom-escuras, sola, cinto carvão)
  const couro = new THREE.MeshPhysicalMaterial({
    name: 'noel-couro',
    color: '#ffffff',
    roughness: 0.5,
    metalness: 0,
    clearcoat: 0.35,
    clearcoatRoughness: 0.35,
    vertexColors: true,
    envMapIntensity: 0.9,
  });

  const ouro = new THREE.MeshStandardMaterial({
    name: 'noel-ouro',
    color: CORES.ouro,
    metalness: 1,
    roughness: 0.24,
    envMapIntensity: 1.25,
  });

  const olhos = new THREE.MeshPhysicalMaterial({
    name: 'noel-olhos',
    color: '#ffffff',
    roughness: 0.18,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    vertexColors: true,
    envMapIntensity: 0.9,
  });

  const saco = new THREE.MeshStandardMaterial({ name: 'noel-saco', color: '#d8c3a5', roughness: 1, metalness: 0, envMapIntensity: 0.4 });

  const papelMapa = papelDePresente();
  texturas.push(papelMapa);
  const papel = new THREE.MeshPhysicalMaterial({
    name: 'noel-papel',
    map: papelMapa,
    roughness: 0.6,
    clearcoat: 0.1,
    clearcoatRoughness: 0.4,
    vertexColors: true,
    envMapIntensity: 0.7,
  });
  const fita = new THREE.MeshStandardMaterial({ name: 'noel-fita', color: '#c9a259', roughness: 0.38, metalness: 0.3, envMapIntensity: 0.8 });

  /* -------------------------------------------------------- texturas do disco (assíncronas) */
  let descartado = false;
  const aplicar = (m: THREE.MeshStandardMaterial, mapas: Record<string, THREE.Texture | undefined>) => {
    if (descartado) {
      for (const t of Object.values(mapas)) t?.dispose();
      return;
    }
    Object.assign(m, mapas);
    for (const t of Object.values(mapas)) if (t) texturas.push(t);
    m.needsUpdate = true;
  };
  // veludo: normal e rugosidade do veludo (ladrilho ~0,3 m; as UV estão em metros)
  void loadPbr('velour_velvet', { maps: ['nor', 'arm'], repeat: [6.5, 6.5] })
    .then((t) => {
      veludo.normalScale.set(1, 1);
      veludoVerde.normalScale.set(1, 1);
      aplicar(veludo, { normalMap: t.normalMap, roughnessMap: t.roughnessMap });
      aplicar(veludoVerde, { normalMap: t.normalMap, roughnessMap: t.roughnessMap });
    })
    .catch(() => undefined);
  // pelúcia: relevo e cachos do curly teddy (ladrilho ~0,25 m)
  void loadPbr('curly_teddy_natural', { maps: ['diff', 'nor'], repeat: [4, 4] })
    .then((t) => {
      pelo.normalScale.set(0.9, 0.9);
      aplicar(pelo, { map: t.map, normalMap: t.normalMap });
    })
    .catch(() => undefined);
  void loadPbr('brown_leather', { maps: ['nor'], repeat: [5, 5] })
    .then((t) => {
      couro.normalScale.set(0.35, 0.35);
      aplicar(couro, { normalMap: t.normalMap });
    })
    .catch(() => undefined);
  void loadPbr('knitted_fleece', { maps: ['nor'], repeat: [9, 9] })
    .then((t) => {
      luva.normalScale.set(0.3, 0.3);
      aplicar(luva, { normalMap: t.normalMap });
    })
    .catch(() => undefined);
  void loadPbr('hessian_230', { maps: ['diff', 'nor', 'arm'], repeat: [1 / 0.27, 1 / 0.27] })
    .then((t) => {
      saco.normalScale.set(1.1, 1.1);
      aplicar(saco, { map: t.map, normalMap: t.normalMap, roughnessMap: t.roughnessMap, aoMap: t.aoMap });
    })
    .catch(() => undefined);

  return {
    veludo,
    veludoVerde,
    fita,
    pelo,
    mecha,
    pele,
    luva,
    couro,
    ouro,
    olhos,
    saco,
    papel,
    peloU,
    refletivos: [ouro, couro, olhos],
    dispose() {
      descartado = true;
      for (const m of [veludo, veludoVerde, fita, pelo, mecha, pele, luva, couro, ouro, olhos, saco, papel]) m.dispose();
      for (const t of texturas) t.dispose();
    },
  };
}
