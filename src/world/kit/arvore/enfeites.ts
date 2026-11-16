/**
 * Enfeites da árvore, com contenção: bolas de vidro (vermelho e dourado da paleta, algumas acetinadas)
 * penduradas por um ganchinho sob os ramos, com reflexo de verdade; alguns laços de veludo; uma estrela de
 * latão envelhecido no topo; e, só durante o efeito de cintilar, o brilho da estrela e poucas fagulhas
 * douradas subindo devagar.
 */
import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Malhador } from './geometria';
import { juntarLaco } from './laco';
import { materialVeludo } from './materiais';
import { manchaRedonda, normalDeMetalBatido, rugosidadeDeMetal } from './texturas';
import { acaso, type RelogioLuzes, type Sorteio } from './util';

export interface PontoDaCopa {
  posicao: THREE.Vector3;
  /** Para fora da copa, na horizontal. */
  fora: THREE.Vector3;
}

/** Espalha `n` pontos pela superfície da copa, com densidade uniforme por área e distância mínima entre eles. */
export function espalharNaCopa(n: number, yBase: number, yTopo: number, raioEm: (y: number) => number, r: Sorteio, fundo: number, ocupados: THREE.Vector3[] = [], minimo = 0.3): PontoDaCopa[] {
  const passos = 120;
  const acumulado: number[] = [0];
  for (let i = 1; i <= passos; i++) acumulado.push(acumulado[i - 1] + raioEm(yBase + ((yTopo - yBase) * (i - 0.5)) / passos));
  const total = acumulado[passos];
  const pontos: PontoDaCopa[] = [];
  const giro = r() * Math.PI * 2;
  for (let i = 0; i < n; i++) {
    for (let tentativa = 0; tentativa < 12; tentativa++) {
      const alvo = ((i + 0.2 + 0.6 * r()) / n) * total;
      let j = 0;
      while (j < passos - 1 && acumulado[j + 1] < alvo) j++;
      const y = yBase + ((yTopo - yBase) * (j + 0.5)) / passos;
      const ang = giro + i * 2.39996 + (r() - 0.5) * 0.9 + tentativa * 0.7;
      const fora = new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang));
      const posicao = fora.clone().multiplyScalar(raioEm(y) * fundo);
      posicao.y = y;
      if (ocupados.some((o) => o.distanceTo(posicao) < minimo)) continue;
      ocupados.push(posicao);
      pontos.push({ posicao, fora });
      break;
    }
  }
  return pontos;
}

export interface Enfeites {
  grupo: THREE.Group;
  /** Lampejo da estrela (0 a 1), comandado pelo efeito de cintilar. */
  setLampejo(v: number): void;
  setEnvMap(tex: THREE.Texture | null): void;
  dispose(): void;
}

const VERMELHO = new THREE.Color('#a32330');
const VERMELHO_FUNDO = new THREE.Color('#6e1420');
const OURO_VELHO = new THREE.Color('#c79a4a');

/** Uma bola pendurada: `gancho` é o ponto do ramo onde o ganchinho prende. */
export interface BolaPendurada {
  gancho: THREE.Vector3;
}

/** Bolas de vidro instanciadas: esfera com tampinha, argola e ganchinho de metal. */
export function criarBolas(pontos: BolaPendurada[], envMap: THREE.Texture | null, r: Sorteio, k: number) {
  const geo = new Malhador();
  const tampa: number[] = [];
  const junta = (g: THREE.BufferGeometry, m: THREE.Matrix4 | undefined, valor: number) => {
    geo.juntar(g, m);
    for (let i = 0; i < g.getAttribute('position').count; i++) tampa.push(valor);
    g.dispose();
  };
  junta(new THREE.SphereGeometry(1, 16, 10), undefined, 0);
  junta(new THREE.CylinderGeometry(0.19, 0.22, 0.2, 10, 1, false), new THREE.Matrix4().makeTranslation(0, 1.06, 0), 1);
  junta(new THREE.TorusGeometry(0.09, 0.022, 5, 10), new THREE.Matrix4().makeTranslation(0, 1.22, 0), 1);
  // ganchinho de arame: sobe da argola até o ramo, um pouco torto
  const GANCHO = 0.85;
  junta(new THREE.CylinderGeometry(0.016, 0.016, GANCHO, 4, 1, true), new THREE.Matrix4().makeRotationZ(0.06).setPosition(0.02, 1.3 + GANCHO / 2, 0), 1);
  const g = geo.geometria();
  g.setAttribute('aTampa', new THREE.Float32BufferAttribute(tampa, 1));

  const mat = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.15, metalness: 0.6, clearcoat: 1, clearcoatRoughness: 0.06, envMap, envMapIntensity: 1.25 });
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
        attribute float aTampa;
        attribute vec4 aBola;
        varying float vTampa;
        varying vec4 vBola;`,
      )
      .replace(
        '#include <begin_vertex>',
        /* glsl */ `#include <begin_vertex>
        vTampa = aTampa;
        vBola = aBola;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
        varying float vTampa;
        varying vec4 vBola;`,
      )
      .replace(
        '#include <color_fragment>',
        /* glsl */ `#include <color_fragment>
        diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.6, 0.44, 0.2 ), vTampa );`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        /* glsl */ `#include <roughnessmap_fragment>
        roughnessFactor = mix( vBola.x, 0.4, vTampa );`,
      )
      .replace(
        '#include <metalnessmap_fragment>',
        /* glsl */ `#include <metalnessmap_fragment>
        metalnessFactor = mix( vBola.y, 1.0, vTampa );`,
      )
      .replace(
        '#include <lights_physical_fragment>',
        /* glsl */ `#include <lights_physical_fragment>
        material.clearcoat *= vBola.z * ( 1.0 - vTampa );
        material.clearcoatRoughness = mix( material.clearcoatRoughness, 0.35, vBola.w );`,
      );
  };
  mat.customProgramCacheKey = () => 'bola-de-vidro-2';
  const n = pontos.length;
  const malha = new THREE.InstancedMesh(g, mat, n);
  const dados = new Float32Array(n * 4);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const cor = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const p = pontos[i];
    const raio = (0.046 + 0.019 * r()) * k * (p.gancho.y < 1.4 * k ? 1.06 : 1);
    // pendurada pelo gancho: o centro fica abaixo do ramo, e a bola quase não entorta (ela pende a prumo)
    q.setFromEuler(new THREE.Euler((r() - 0.5) * 0.12, r() * 6.28, (r() - 0.5) * 0.12));
    m.compose(new THREE.Vector3(p.gancho.x, p.gancho.y - raio * (1.3 + GANCHO), p.gancho.z), q, new THREE.Vector3(raio, raio, raio));
    malha.setMatrixAt(i, m);
    // cores sorteadas (não em sequência, para não agrupar por lado): vermelho fundo, ouro velho, vermelho escuro
    const sorte = acaso(i, 23);
    const acetinada = acaso(i, 17) < 0.3;
    cor.copy(sorte < 0.52 ? VERMELHO : sorte < 0.82 ? OURO_VELHO : VERMELHO_FUNDO);
    malha.setColorAt(i, cor);
    // brilhante: vidro espelhado com verniz. Acetinada: vidro fosco de reflexo largo e macio (não plástico)
    dados.set(acetinada ? [0.34, 0.85, 0.4, 1] : [0.12, 0.62, 1, 0], i * 4);
  }
  g.setAttribute('aBola', new THREE.InstancedBufferAttribute(dados, 4));
  malha.instanceMatrix.needsUpdate = true;
  if (malha.instanceColor) malha.instanceColor.needsUpdate = true;
  malha.castShadow = false;
  malha.receiveShadow = true;
  malha.userData.semAO = true;
  malha.computeBoundingSphere();
  malha.name = 'bolas';
  return { malha, geo: g, mat };
}

/**
 * Estrela de cinco pontas de latão: cada ponta tem uma quina que sobe até o centro (a estrela clássica de
 * topo de árvore), mas as quinas e a borda são arredondadas, como metal estampado e polido, não papel
 * dobrado. Embaixo, a luva que encaixa na haste do topo da árvore.
 */
function geometriaEstrela(raio: number): THREE.BufferGeometry {
  const interno = 0.46;
  const porAresta = 6;
  const voltas = 10 * porAresta;
  const aneis = [0, 0.2, 0.4, 0.58, 0.74, 0.86, 0.94, 0.985, 1];
  const cantos: THREE.Vector2[] = [];
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i / 10) * Math.PI * 2;
    const rr = (i % 2 === 0 ? 1 : interno) * raio;
    cantos.push(new THREE.Vector2(Math.cos(a) * rr, Math.sin(a) * rr));
  }
  const pos: number[] = [];
  const idx: number[] = [];
  const borda = new THREE.Vector2();
  for (const [sinal, alto] of [
    [1, 0.2],
    [-1, 0.13],
  ]) {
    const base = pos.length / 3;
    for (let k = 0; k < aneis.length; k++) {
      const s = aneis[k];
      for (let j = 0; j <= voltas; j++) {
        const i = Math.floor(j / porAresta) % 10;
        const f = (j % porAresta) / porAresta;
        borda.copy(cantos[i]).lerp(cantos[(i + 1) % 10], f);
        // a face sobe em rampa até o centro; a borda vira para trás em quarto de círculo (espessura)
        const z = sinal * raio * (alto * Math.pow(1 - s, 1.1) + 0.05 * Math.sqrt(1 - Math.pow(s, 6)));
        pos.push(borda.x * s, borda.y * s, z);
      }
    }
    const linha = voltas + 1;
    for (let k = 0; k < aneis.length - 1; k++)
      for (let j = 0; j < voltas; j++) {
        const a = base + k * linha + j;
        if (sinal > 0) idx.push(a, a + linha, a + 1, a + 1, a + linha, a + linha + 1);
        else idx.push(a, a + 1, a + linha, a + 1, a + linha + 1, a + linha);
      }
  }
  const bruta = new THREE.BufferGeometry();
  bruta.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  bruta.setIndex(idx);
  // solda o centro, a costura e a borda entre as duas faces; as normais saem suaves (quinas arredondadas)
  const corpo = mergeVertices(bruta, raio * 0.0015);
  corpo.computeVertexNormals();
  bruta.dispose();
  const p = corpo.getAttribute('position');
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    uv[i * 2] = (p.getX(i) + p.getZ(i)) / raio;
    uv[i * 2 + 1] = p.getY(i) / raio;
  }
  corpo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));

  const m = new Malhador();
  m.juntar(corpo);
  corpo.dispose();
  // luva: tubo levemente cônico com um anel na boca, visível entre a estrela e a guia da árvore
  const luva = new THREE.LatheGeometry(
    [new THREE.Vector2(raio * 0.1, -raio * 1.12), new THREE.Vector2(raio * 0.135, -raio * 1.1), new THREE.Vector2(raio * 0.125, -raio * 1.03), new THREE.Vector2(raio * 0.095, -raio * 0.99), new THREE.Vector2(raio * 0.07, -raio * 0.3)],
    12,
  );
  m.juntar(luva);
  luva.dispose();
  return m.geometria();
}

/**
 * Fagulhas do efeito de cintilar: poucos pontinhos dourados que nascem junto à copa e sobem devagar,
 * acendendo e apagando. Uma malha instanciada só, animada no shader com o relógio da árvore.
 */
export function criarFagulhas(n: number, yBase: number, yTopo: number, raioEm: (y: number) => number, relogio: RelogioLuzes, r: Sorteio, k: number) {
  const geo = new THREE.PlaneGeometry(1, 1);
  const origem = new Float32Array(n * 4);
  const ritmo = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const y = yBase + (yTopo - yBase) * Math.pow(r(), 0.8);
    const ang = r() * Math.PI * 2;
    const raio = raioEm(y) * (0.95 + 0.25 * r()) + 0.04;
    origem.set([Math.cos(ang) * raio, y, Math.sin(ang) * raio, (0.011 + 0.006 * r()) * k], i * 4);
    ritmo.set([r(), 2.2 + 1.2 * r(), r() * 6.28], i * 3);
  }
  geo.setAttribute('aOrigem', new THREE.InstancedBufferAttribute(origem, 4));
  geo.setAttribute('aRitmo', new THREE.InstancedBufferAttribute(ritmo, 3));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTempo: relogio.uTempo, uCintilar: relogio.uCintilar },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute vec4 aOrigem;
      attribute vec3 aRitmo;
      uniform float uTempo;
      uniform float uCintilar;
      varying vec2 vP;
      varying float vForca;
      void main() {
        vP = position.xy * 2.0;
        // vida de 2 a 3 segundos, em laço; cada fagulha começa em um momento diferente
        float fase = fract( uTempo / aRitmo.y + aRitmo.x );
        vec3 p = aOrigem.xyz;
        p.y += fase * 0.34;
        p.x += sin( uTempo * 0.9 + aRitmo.z ) * 0.03 + p.x * fase * 0.06;
        p.z += cos( uTempo * 0.7 + aRitmo.z ) * 0.03 + p.z * fase * 0.06;
        float pisca = 0.65 + 0.35 * sin( uTempo * 9.0 + aRitmo.z * 5.0 );
        vForca = sin( fase * 3.14159 ) * pisca * uCintilar;
        vec4 mv = modelViewMatrix * vec4( p, 1.0 );
        mv.xy += position.xy * aOrigem.w * ( 0.6 + 0.4 * vForca );
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      varying vec2 vP;
      varying float vForca;
      void main() {
        float d = dot( vP, vP );
        float g = exp( -d * 4.5 ) * smoothstep( 1.0, 0.5, d );
        gl_FragColor = vec4( vec3( 1.0, 0.66, 0.24 ) * g * vForca * 2.6, 1.0 );
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const malha = new THREE.InstancedMesh(geo, mat, n);
  malha.frustumCulled = false;
  malha.visible = false;
  malha.renderOrder = 3;
  malha.userData.semAO = true;
  malha.name = 'fagulhas';
  return { malha, geo, mat };
}

export interface OpcoesEnfeites {
  bolas: BolaPendurada[];
  lacos: PontoDaCopa[];
  /** Centro e raio da estrela (a ponta de cima fica em centro.y + raio). */
  estrela: { centro: THREE.Vector3; raio: number } | null;
  envMap: THREE.Texture | null;
  veludo: { cor: THREE.Texture; normal: THREE.Texture };
  k: number;
}

export function criarEnfeites(o: OpcoesEnfeites, r: Sorteio): Enfeites {
  const grupo = new THREE.Group();
  grupo.name = 'enfeites';
  const lixo: Array<{ dispose(): void }> = [];
  const comEnv: Array<THREE.MeshStandardMaterial> = [];
  const k = o.k;

  if (o.bolas.length) {
    const b = criarBolas(o.bolas, o.envMap, r, k);
    grupo.add(b.malha);
    lixo.push(b.geo, b.mat, b.malha);
    comEnv.push(b.mat);
  }

  if (o.lacos.length) {
    const m = new Malhador();
    const branco = new THREE.Color(1, 1, 1);
    for (const p of o.lacos) {
      const z = p.fora.clone().setY(0.25).normalize();
      const x = new THREE.Vector3(0, 1, 0).cross(z).normalize();
      const y = z.clone().cross(x);
      const base = new THREE.Matrix4().makeBasis(x, y, z).setPosition(p.posicao);
      base.multiply(new THREE.Matrix4().makeRotationZ((r() - 0.5) * 0.5));
      juntarLaco(m, { largura: (0.2 + 0.05 * r()) * k, pontas: 0.8, queda: 0.35, cor: branco }, r, base);
    }
    const geo = m.geometria();
    const mat = materialVeludo(o.veludo);
    const malha = new THREE.Mesh(geo, mat);
    malha.castShadow = false;
    malha.receiveShadow = true;
    malha.userData.semAO = true;
    malha.name = 'lacos';
    grupo.add(malha);
    lixo.push(geo, mat);
  }

  let estrelaMat: THREE.MeshStandardMaterial | null = null;
  let brilho: THREE.Mesh | null = null;
  const uLampejo = { value: 0 };
  if (o.estrela) {
    const raio = o.estrela.raio;
    const geo = geometriaEstrela(raio);
    const relevo = normalDeMetalBatido();
    const rugosidade = rugosidadeDeMetal();
    for (const t of [relevo, rugosidade]) t.repeat.set(2.2, 2.2);
    // latão envelhecido: metal de cor contida, polimento irregular, batido bem leve
    estrelaMat = new THREE.MeshStandardMaterial({
      color: '#b88a3a',
      metalness: 1,
      roughness: 1,
      roughnessMap: rugosidade,
      normalMap: relevo,
      normalScale: new THREE.Vector2(0.12, 0.12),
      envMap: o.envMap,
      envMapIntensity: 1.25,
      emissive: '#ff9d3a',
      emissiveIntensity: 0.03,
    });
    const estrela = new THREE.Mesh(geo, estrelaMat);
    estrela.position.copy(o.estrela.centro);
    estrela.rotation.y = 0.12;
    estrela.castShadow = false;
    estrela.userData.semAO = true;
    estrela.name = 'estrela';
    grupo.add(estrela);
    lixo.push(geo, estrelaMat, relevo, rugosidade);
    comEnv.push(estrelaMat);

    // durante o efeito de cintilar a estrela ganha luz própria e um halo redondo e macio que respira
    // (sem raios em cruz: nada de reflexo de lente); o brilho do palco faz o resto
    const bGeo = new THREE.PlaneGeometry(1, 1);
    const mancha = manchaRedonda(64, 3);
    const bMat = new THREE.ShaderMaterial({
      uniforms: { uLampejo, uTamanho: { value: raio * 2.1 }, uMancha: { value: mancha } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        uniform float uTamanho;
        uniform float uLampejo;
        varying vec2 vP;
        void main() {
          vP = position.xy + 0.5;
          vec4 mv = modelViewMatrix * vec4( 0.0, 0.0, 0.0, 1.0 );
          mv.xy += position.xy * uTamanho * ( 0.85 + 0.3 * uLampejo );
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uLampejo;
        uniform sampler2D uMancha;
        varying vec2 vP;
        void main() {
          gl_FragColor = vec4( vec3( 1.0, 0.7, 0.3 ) * texture2D( uMancha, vP ).r * uLampejo * 0.42, 1.0 );
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    brilho = new THREE.Mesh(bGeo, bMat);
    brilho.position.copy(o.estrela.centro);
    brilho.frustumCulled = false;
    brilho.visible = false;
    brilho.renderOrder = 3;
    brilho.userData.semAO = true;
    brilho.name = 'brilho-da-estrela';
    grupo.add(brilho);
    lixo.push(bGeo, bMat, mancha);
  }

  return {
    grupo,
    setLampejo(v) {
      uLampejo.value = v;
      if (brilho) brilho.visible = v > 0.003;
      if (estrelaMat) estrelaMat.emissiveIntensity = 0.03 + v * 1.4;
    },
    setEnvMap(tex) {
      for (const m of comEnv) {
        m.envMap = tex;
        m.needsUpdate = true;
      }
    },
    dispose() {
      for (const l of lixo) l.dispose();
    },
  };
}
