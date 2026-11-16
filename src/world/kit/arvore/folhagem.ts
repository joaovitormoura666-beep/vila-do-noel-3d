/**
 * Folhagem de abeto feita de frondes instanciadas.
 *
 * Cada fronde é um leque de abeto de verdade assado em cartão: o leque foi modelado agulha por agulha e
 * fotografado de cima (cor + recorte, normal e altura) pela ferramenta em ferramentas/assar.cjs, em nove
 * variantes (atlas 3x3). No jogo, a fronde são dois cartões: o leque deitado (levemente abaulado, vergando
 * com o peso) e, em pé no meio dele, um cartão estreito que dá a espessura de "escova" quando o leque é
 * visto de lado. O material parte do MeshStandardMaterial (recebe luzes, sombras e neblina da sala) e
 * acrescenta:
 *   - recorte com bordas suaves (alpha to coverage no nível alto) que não emagrece ao longe;
 *   - cartão visto de quina some (o outro cartão cobre);
 *   - normal das agulhas misturada com a normal do "volume" da copa (a árvore lê como massa, não como cartões);
 *   - luz envolvente e leve translucidez; brilho só nas agulhas de cima e de fora;
 *   - escurecimento pintado para dentro da peça e nas agulhas de baixo de cada ramo;
 *   - o halo quente das três lampadinhas mais próximas de cada fronde, com o mesmo ritmo das lâmpadas
 *     (o brilho de cada lâmpada é calculado por vértice; no pixel fica só a queda com a distância).
 * A mesma folhagem serve à árvore, à guirlanda e ao festão.
 */
import * as THREE from 'three';
import { loadTexture } from '../../../engine/assets';
import type { Level } from '../../contracts';
import { GLSL_BRILHO, type RelogioLuzes } from './util';

export interface RecursosFolhagem {
  cor: THREE.Texture;
  normal: THREE.Texture;
}

/**
 * O atlas tem 3 x 3 ramos: quatro abertos (raminhos em dedos, com vãos), dois de ponta (estreitos), dois
 * leques cheios (fecham a massa) e um de miolo (escuro e largo).
 */
export const GRADE = 3;
export const LEQUES = [0, 1, 2, 3];
export const PONTAS = [4, 5];
export const CHEIOS = [6, 7];
export const MIOLO = 8;

export async function carregarFolhagem(): Promise<RecursosFolhagem> {
  const [cor, normal] = await Promise.all([loadTexture('assets/arvore/ramo_cor.webp', { srgb: true, anisotropy: 4 }), loadTexture('assets/arvore/ramo_normal.webp', { srgb: false, anisotropy: 4 })]);
  for (const t of [cor, normal]) {
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.needsUpdate = true;
  }
  return { cor, normal };
}

/** Uma fronde a instanciar. Tudo no espaço local da peça. */
export interface Fronde {
  base: THREE.Vector3;
  /** Para onde a fronde aponta (da base para a ponta). */
  frente: THREE.Vector3;
  /** Lado de cima aproximado do leque. */
  cima: THREE.Vector3;
  comprimento: number;
  largura: number;
  variante: number;
  tinta: THREE.Color;
  /** Claridade pintada na base e na ponta (0 = fundo escuro da árvore, 1 = por fora). */
  sombraBase: number;
  sombraPonta: number;
  /** Quanto a fronde verga (positivo: a ponta cai). */
  curva: number;
  /** De onde irradia a normal de volume nesta região (o eixo da árvore, a linha do festão). */
  centro: THREE.Vector3;
  /** true = fronde que nunca é cortada nos níveis mais baixos (miolo que fecha a vista, pontas da silhueta). */
  essencial?: boolean;
}

export interface LampadaPonto {
  x: number;
  y: number;
  z: number;
  /** Parte inteira: ordem de corte (1 = a última a apagar nos níveis baixos); fração: variação. */
  id: number;
}

const SEG_COMPRIMENTO = 3;

/** Índices do leque deitado (primeiro) e do cartão em pé (depois): os níveis baixos e a sombra desenham só o começo. */
function geometriaFronde(): { geo: THREE.BufferGeometry; indicesLeque: number } {
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  // leque deitado: x de -0,5 a 0,5, z de 0 (base) a 1 (ponta); abaulado (as bordas caem) e com um leve arco
  const segL = 2;
  for (let j = 0; j <= SEG_COMPRIMENTO; j++) {
    const z = j / SEG_COMPRIMENTO;
    for (let i = 0; i <= segL; i++) {
      const u = i / segL;
      const x = u - 0.5;
      const cai = 0.2 * (0.4 + 0.6 * z);
      const y = -cai * Math.abs(x) + 0.035 * Math.sin(Math.PI * z);
      const n = new THREE.Vector3(Math.sign(x) * cai, 1, 0).normalize();
      pos.push(x, y, z);
      nor.push(n.x, n.y, n.z);
      uv.push(u, z);
    }
  }
  const linha = segL + 1;
  for (let j = 0; j < SEG_COMPRIMENTO; j++)
    for (let i = 0; i < segL; i++) {
      const a = j * linha + i;
      idx.push(a, a + linha, a + 1, a + 1, a + linha, a + linha + 1);
    }
  const indicesLeque = idx.length;
  // cartão em pé: o mesmo ramo espremido (vira a "escova" vista de lado). A normal é a do leque (para cima):
  // os dois cartões recebem a mesma luz e a fronde lê como uma coisa só.
  const base = pos.length / 3;
  const meia = 0.11;
  for (let j = 0; j <= SEG_COMPRIMENTO; j++) {
    const z = j / SEG_COMPRIMENTO;
    for (let i = 0; i <= 1; i++) {
      const y = (i - 0.42) * 2 * meia + 0.035 * Math.sin(Math.PI * z);
      pos.push(0, y, z);
      nor.push(0, 1, 0);
      uv.push(i, z);
    }
  }
  for (let j = 0; j < SEG_COMPRIMENTO; j++) {
    const a = base + j * 2;
    idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  return { geo, indicesLeque };
}

export interface OpcoesMaterialFolhagem {
  /** Quanto a normal de volume domina a do cartão (0 a 1). */
  volume?: number;
  /** Raio do halo de cada lâmpada nas agulhas, em metros. */
  haloRaio?: number;
  haloForca?: number;
}

const CORTE = 0.4;

const GLSL_VERTICE_COMUM = /* glsl */ `
  attribute vec4 aRamo;
  uniform float uLargura;
`;
const GLSL_VERTICE_FORMA = /* glsl */ `vec3 transformed = vec3( position );
  transformed.xy *= uLargura;
  transformed.y -= aRamo.w * transformed.z * transformed.z;`;

function criarMateriais(rec: RecursosFolhagem, relogio: RelogioLuzes, o: OpcoesMaterialFolhagem) {
  const proprios = {
    uVolume: { value: o.volume ?? 0.4 },
    uHaloRaio: { value: o.haloRaio ?? 0.085 },
    uHaloForca: { value: o.haloForca ?? 2.6 },
    uEnvolver: { value: 0.3 },
    uTransluz: { value: 0.08 },
    uLargura: { value: 1 },
    uClaridade: { value: 1 },
    uFundo: { value: 1 },
    /** Lâmpadas acesas neste nível (as de ordem maior não fazem halo). */
    uLampadasAtivas: { value: 1e6 },
  };
  const material = new THREE.MeshStandardMaterial({
    map: rec.cor,
    normalMap: rec.normal,
    alphaTest: CORTE,
    alphaToCoverage: true,
    side: THREE.DoubleSide,
    roughness: 0.78,
    metalness: 0,
    envMapIntensity: 0.4,
  });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, proprios, relogio);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
        ${GLSL_VERTICE_COMUM}
        attribute vec3 aTinta;
        attribute vec4 aCentro;
        attribute vec4 aLuzA;
        attribute vec4 aLuzB;
        attribute vec4 aLuzC;
        uniform float uLampadasAtivas;
        varying vec3 vNormalVol;
        varying vec3 vTinta;
        varying float vSombra;
        varying vec3 vLuzPosA;
        varying vec3 vLuzPosB;
        varying vec3 vLuzPosC;
        varying vec3 vLuzCorA;
        varying vec3 vLuzCorB;
        varying vec3 vLuzCorC;
        ${GLSL_BRILHO}
        // cor vezes brilho de uma lâmpada vizinha (zero quando não há ou quando ela está apagada neste nível)
        vec3 luzVizinha( vec4 l ) {
          if ( l.w < 0.0 || floor( l.w ) > uLampadasAtivas ) return vec3( 0.0 );
          return corLampada( l.w ) * brilhoLampada( l.w, l.y );
        }`,
      )
      .replace(
        '#include <uv_vertex>',
        /* glsl */ `#include <uv_vertex>
        vMapUv = uv / ${GRADE}.0 + aRamo.xy;
        vNormalMapUv = vMapUv;`,
      )
      .replace('#include <begin_vertex>', GLSL_VERTICE_FORMA)
      .replace(
        '#include <project_vertex>',
        /* glsl */ `#include <project_vertex>
        vec3 posPeca = ( instanceMatrix * vec4( transformed, 1.0 ) ).xyz;
        vNormalVol = normalize( normalMatrix * normalize( posPeca - aCentro.xyz ) );
        vTinta = aTinta;
        vSombra = mix( aRamo.z, aCentro.w, smoothstep( 0.0, 0.8, uv.y ) );
        vLuzPosA = ( modelViewMatrix * vec4( aLuzA.xyz, 1.0 ) ).xyz;
        vLuzPosB = ( modelViewMatrix * vec4( aLuzB.xyz, 1.0 ) ).xyz;
        vLuzPosC = ( modelViewMatrix * vec4( aLuzC.xyz, 1.0 ) ).xyz;
        vLuzCorA = luzVizinha( aLuzA );
        vLuzCorB = luzVizinha( aLuzB );
        vLuzCorC = luzVizinha( aLuzC );`,
      );
    // luz direta: o difuso ganha luz envolvente e a que atravessa as agulhas (verde-amarelada, fraca)
    const luzes = THREE.ShaderChunk.lights_physical_pars_fragment.replace(
      'reflectedLight.directDiffuse += irradiance * diffuseBRDF * ( 1.0 - F );',
      /* glsl */ `float dotCru = dot( geometryNormal, directLight.direction );
      vec3 difusa = saturate( ( dotCru + uEnvolver ) / ( 1.0 + uEnvolver ) ) * directLight.color + uTransluz * saturate( - dotCru ) * directLight.color * vec3( 0.45, 0.8, 0.25 );
      reflectedLight.directDiffuse += difusa * diffuseBRDF * ( 1.0 - F );`,
    );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
        uniform float uVolume;
        uniform float uHaloRaio;
        uniform float uHaloForca;
        uniform float uEnvolver;
        uniform float uTransluz;
        uniform float uClaridade;
        uniform float uFundo;
        varying vec3 vNormalVol;
        varying vec3 vTinta;
        varying float vSombra;
        varying vec3 vLuzPosA;
        varying vec3 vLuzPosB;
        varying vec3 vLuzPosC;
        varying vec3 vLuzCorA;
        varying vec3 vLuzCorB;
        varying vec3 vLuzCorC;
        float alturaAgulha = 1.0;
        // halo de uma lâmpada: cai com a distância e desenha as agulhas (mais luz nas que olham para ela)
        vec3 haloLampada( vec3 pos, vec3 cor, vec3 n ) {
          vec3 d = pos + vViewPosition;
          float q = dot( d, d ) / ( uHaloRaio * uHaloRaio );
          float f = 1.0 / ( 1.0 + q );
          float frente = saturate( dot( n, d * inversesqrt( max( dot( d, d ), 1e-6 ) ) ) * 0.6 + 0.4 );
          return cor * f * f * mix( 1.0, frente, saturate( q * 4.0 ) );
        }`,
      )
      .replace('#include <lights_physical_pars_fragment>', luzes)
      .replace(
        '#include <map_fragment>',
        /* glsl */ `vec4 texCor = texture2D( map, vMapUv, -0.6 );
        diffuseColor *= texCor;
        diffuseColor.rgb *= vTinta;
        // ao longe a média do alpha emagrece o ramo: compensa um pouco conforme o nível de mipmap
        float nivelMip = max( 0.0, log2( max( length( dFdx( vMapUv ) ), length( dFdy( vMapUv ) ) ) * 2048.0 ) );
        diffuseColor.a *= 1.0 + 0.16 * nivelMip;
        // cartão visto de quina vira um risco: some antes disso (o outro cartão da fronde cobre)
        vec3 normalFace = normalize( cross( dFdx( vViewPosition ), dFdy( vViewPosition ) ) );
        diffuseColor.a *= smoothstep( 0.16, 0.42, abs( dot( normalFace, normalize( vViewPosition ) ) ) );
        vec3 albedoFolha = diffuseColor.rgb;`,
      )
      .replace(
        '#include <normal_fragment_begin>',
        /* glsl */ `float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
        // a normal do leque olha sempre para quem vê (o cartão em pé usa a normal do leque, não a própria)
        vec3 normal = normalize( vNormal );
        float ladoVisto = dot( normal, vViewPosition ) < 0.0 ? - 1.0 : 1.0;
        normal *= ladoVisto;
        mat3 tbn = getTangentFrame( - vViewPosition, normal, vNormalMapUv );
        tbn[0] *= faceDirection;
        tbn[1] *= faceDirection;
        vec3 nonPerturbedNormal = normal;`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        /* glsl */ `vec4 texRamo = texture2D( normalMap, vNormalMapUv );
        vec3 mapN = vec3( ( texRamo.xy * 2.0 - 1.0 ) * normalScale, 0.0 );
        mapN.z = sqrt( saturate( 1.0 - dot( mapN.xy, mapN.xy ) ) );
        normal = normalize( tbn * mapN );
        normal = normalize( mix( normal, normalize( vNormalVol ), uVolume ) );
        // oclusão pintada: fundo da peça escuro; agulhas de baixo do ramo mais escuras que as de cima
        alturaAgulha = smoothstep( 0.25, 0.7, texRamo.b );
        diffuseColor.rgb *= uClaridade * pow( vSombra, uFundo ) * mix( 0.36, 1.0, alturaAgulha );`,
      )
      .replace(
        '#include <lights_fragment_end>',
        /* glsl */ `#include <lights_fragment_end>
        // brilho só nas agulhas de cima e de fora (o miolo e as de baixo ficam foscos)
        float brilhoAgulha = alturaAgulha * vSombra;
        reflectedLight.directSpecular *= brilhoAgulha;
        reflectedLight.indirectSpecular *= brilhoAgulha;`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        /* glsl */ `#include <emissivemap_fragment>
        vec3 haloTotal = haloLampada( vLuzPosA, vLuzCorA, normal ) + haloLampada( vLuzPosB, vLuzCorB, normal ) + haloLampada( vLuzPosC, vLuzCorC, normal );
        haloTotal = min( haloTotal, vec3( 1.2 ) ) * mix( 0.5, 1.0, alturaAgulha );
        // a luz da lâmpada vezes a cor da agulha (âmbar-esverdeado), mais um nada de luz quente própria
        totalEmissiveRadiance += ( albedoFolha * uHaloForca + 0.03 ) * haloTotal;`,
      );
  };
  material.customProgramCacheKey = () => 'folhagem-abeto-2';

  // sombra com recorte: a profundidade usa o mesmo alpha, o mesmo recorte de atlas e a mesma curvatura
  const sombra = { uLargura: { value: 1.25 } };
  const profundidade = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: rec.cor, alphaTest: CORTE, side: THREE.DoubleSide });
  profundidade.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, sombra);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${GLSL_VERTICE_COMUM}`)
      .replace(
        '#include <uv_vertex>',
        /* glsl */ `#include <uv_vertex>
        vMapUv = uv / ${GRADE}.0 + aRamo.xy;`,
      )
      .replace('#include <begin_vertex>', GLSL_VERTICE_FORMA);
  };
  profundidade.customProgramCacheKey = () => 'folhagem-abeto-2-sombra';
  return { material, profundidade, proprios };
}

export interface MalhaFolhagem {
  malha: THREE.InstancedMesh;
  total: number;
  /** Uniformes próprios, para ajustes finos de quem monta a peça. */
  ajustes: ReturnType<typeof criarMateriais>['proprios'];
  setQuality(level: Level): void;
  dispose(): void;
}

export interface OpcoesMalhaFolhagem extends OpcoesMaterialFolhagem {
  /** Fração das frondes NÃO essenciais mantida em cada nível. */
  fracao?: Record<Level, number>;
  sombra?: boolean;
  /** Quantas lâmpadas ficam acesas em cada nível (as de ordem maior param de fazer halo). */
  lampadasAtivas?: Record<Level, number>;
}

/**
 * Monta a malha instanciada. A lista é reordenada: primeiro as frondes essenciais (miolo e pontas), depois
 * as outras, embaralhadas. Os níveis médio e baixo e a passada de sombra desenham só o começo da lista
 * (com as frondes um pouco mais largas), então o miolo e a silhueta nunca são cortados.
 */
export function criarMalhaFolhagem(rec: RecursosFolhagem, relogio: RelogioLuzes, frondes: Fronde[], lampadas: LampadaPonto[], r: () => number, o: OpcoesMalhaFolhagem = {}): MalhaFolhagem {
  const essenciais = frondes.filter((f) => f.essencial);
  const outras = embaralhar(
    frondes.filter((f) => !f.essencial),
    r,
  );
  const lista = [...essenciais, ...outras];
  const n = lista.length;
  const { geo, indicesLeque } = geometriaFronde();
  const indicesTotal = geo.getIndex()!.count;
  const ramo = new Float32Array(n * 4);
  const tinta = new Float32Array(n * 3);
  const centro = new Float32Array(n * 4);
  const luz = [new Float32Array(n * 4), new Float32Array(n * 4), new Float32Array(n * 4)];
  const { material, profundidade, proprios } = criarMateriais(rec, relogio, o);
  const malha = new THREE.InstancedMesh(geo, material, n);
  const m = new THREE.Matrix4();
  const x = new THREE.Vector3();
  const y = new THREE.Vector3();
  const z = new THREE.Vector3();
  // lâmpadas em uma grade espacial: cada fronde só olha as células vizinhas
  const CEL = 0.3;
  const grade = new Map<string, LampadaPonto[]>();
  const chave = (a: number, b: number, c: number) => `${a},${b},${c}`;
  for (const l of lampadas) {
    const k = chave(Math.floor(l.x / CEL), Math.floor(l.y / CEL), Math.floor(l.z / CEL));
    const lista2 = grade.get(k);
    if (lista2) lista2.push(l);
    else grade.set(k, [l]);
  }
  const perto: Array<{ d: number; l: LampadaPonto }> = [];
  for (let i = 0; i < n; i++) {
    const f = lista[i];
    z.copy(f.frente).normalize();
    x.crossVectors(f.cima, z);
    if (x.lengthSq() < 1e-6) x.set(1, 0, 0);
    x.normalize();
    y.crossVectors(z, x);
    m.set(x.x * f.largura, y.x * f.comprimento, z.x * f.comprimento, f.base.x, x.y * f.largura, y.y * f.comprimento, z.y * f.comprimento, f.base.y, x.z * f.largura, y.z * f.comprimento, z.z * f.comprimento, f.base.z, 0, 0, 0, 1);
    malha.setMatrixAt(i, m);
    const v = f.variante % (GRADE * GRADE);
    ramo.set([(v % GRADE) / GRADE, 1 - (Math.floor(v / GRADE) + 1) / GRADE, f.sombraBase, f.curva], i * 4);
    tinta.set([f.tinta.r, f.tinta.g, f.tinta.b], i * 3);
    centro.set([f.centro.x, f.centro.y, f.centro.z, f.sombraPonta], i * 4);
    // as três lâmpadas mais próximas do talo desta fronde (distância ao segmento da base à ponta)
    perto.length = 0;
    if (lampadas.length) {
      const c = f.comprimento * 0.9;
      const mx = f.base.x + z.x * c * 0.5;
      const my = f.base.y + z.y * c * 0.5;
      const mz = f.base.z + z.z * c * 0.5;
      const cx = Math.floor(mx / CEL);
      const cy = Math.floor(my / CEL);
      const cz = Math.floor(mz / CEL);
      for (let a = -1; a <= 1; a++)
        for (let b = -1; b <= 1; b++)
          for (let d = -1; d <= 1; d++) {
            const cel = grade.get(chave(cx + a, cy + b, cz + d));
            if (!cel) continue;
            for (const l of cel) {
              const px = l.x - f.base.x;
              const py = l.y - f.base.y;
              const pz = l.z - f.base.z;
              const t = THREE.MathUtils.clamp((px * z.x + py * z.y + pz * z.z) / c, 0, 1) * c;
              const dx = px - z.x * t;
              const dy = py - z.y * t;
              const dz = pz - z.z * t;
              const dist = dx * dx + dy * dy + dz * dz;
              if (dist < 0.26 * 0.26) perto.push({ d: dist, l });
            }
          }
      perto.sort((p, q) => p.d - q.d);
    }
    for (let k = 0; k < 3; k++) {
      const l = perto[k]?.l;
      luz[k].set(l ? [l.x, l.y, l.z, l.id] : [0, 0, 0, -1], i * 4);
    }
  }
  malha.instanceMatrix.needsUpdate = true;
  geo.setAttribute('aRamo', new THREE.InstancedBufferAttribute(ramo, 4));
  geo.setAttribute('aTinta', new THREE.InstancedBufferAttribute(tinta, 3));
  geo.setAttribute('aCentro', new THREE.InstancedBufferAttribute(centro, 4));
  geo.setAttribute('aLuzA', new THREE.InstancedBufferAttribute(luz[0], 4));
  geo.setAttribute('aLuzB', new THREE.InstancedBufferAttribute(luz[1], 4));
  geo.setAttribute('aLuzC', new THREE.InstancedBufferAttribute(luz[2], 4));
  malha.customDepthMaterial = profundidade;
  malha.castShadow = o.sombra ?? true;
  malha.receiveShadow = true;
  malha.computeBoundingSphere();
  malha.computeBoundingBox();
  malha.name = 'folhagem';

  // a sombra não precisa de todas as frondes nem do cartão em pé: desenha as essenciais e parte das outras,
  // só o leque deitado (o material de sombra as alarga para a sombra não ficar rala)
  let contagem = n;
  let indices = indicesTotal;
  const naSombra = Math.min(n, essenciais.length + Math.round(outras.length * 0.45));
  malha.onBeforeShadow = () => {
    malha.count = Math.min(contagem, naSombra);
    geo.setDrawRange(0, indicesLeque);
  };
  malha.onAfterShadow = () => {
    malha.count = contagem;
    geo.setDrawRange(0, indices);
  };

  const fracao = o.fracao ?? { alta: 1, media: 0.72, baixa: 0.6 };
  return {
    malha,
    total: n,
    ajustes: proprios,
    setQuality(level) {
      contagem = Math.max(1, essenciais.length + Math.round(outras.length * fracao[level]));
      indices = level === 'baixa' ? indicesLeque : indicesTotal;
      malha.count = contagem;
      geo.setDrawRange(0, indices);
      // menos frondes, cada uma um pouco mais larga, para a peça não ficar rala
      proprios.uLargura.value = level === 'alta' ? 1 : level === 'media' ? 1.1 : 1.2;
      proprios.uLampadasAtivas.value = o.lampadasAtivas ? o.lampadasAtivas[level] : 1e6;
      // bordas suaves pelas amostras do alvo do palco: só o nível alto tem multiamostragem
      const cobertura = level === 'alta';
      if (material.alphaToCoverage !== cobertura) {
        material.alphaToCoverage = cobertura;
        material.needsUpdate = true;
      }
      malha.castShadow = (o.sombra ?? true) && level !== 'baixa';
    },
    dispose() {
      geo.dispose();
      material.dispose();
      profundidade.dispose();
      malha.dispose();
    },
  };
}

/** Embaralha no lugar com o sorteio dado (Fisher-Yates). */
export function embaralhar<T>(lista: T[], r: () => number): T[] {
  for (let i = lista.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [lista[i], lista[j]] = [lista[j], lista[i]];
  }
  return lista;
}
