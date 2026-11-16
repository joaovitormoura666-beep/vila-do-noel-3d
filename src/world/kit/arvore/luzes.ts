/**
 * Lampadinhas de verdade: bulbo de vidro em forma de gota com soquete, presas em um fio que serpenteia
 * pela peça. Tudo instanciado (uma chamada de desenho para os bulbos e outra para o fio). O brilho de cada
 * bulbo vem da mesma função GLSL usada pelo halo nas agulhas (util.ts), calculado por vértice, em HDR
 * moderado para o brilho do palco pegar só nelas: miolo quase branco, borda do vidro âmbar.
 */
import * as THREE from 'three';
import type { Level } from '../../contracts';
import type { LampadaPonto } from './folhagem';
import { Malhador, tubo } from './geometria';
import { manchaRedonda } from './texturas';
import { GLSL_BRILHO, type RelogioLuzes } from './util';

export interface Lampada extends LampadaPonto {
  /** Para onde o bulbo aponta (do soquete para a ponta do vidro). */
  dir: THREE.Vector3;
  /** false = lâmpada na beira da silhueta: no nível baixo ela não ganha o halo em cartaz (ele boiaria contra a parede). */
  halo?: boolean;
}

/** Bulbo unitário, em metros: soquete de z = 0 a 0,011 e vidro em gota até 0,034. Atributo aVidro: 1 no vidro. */
function geometriaBulbo(escala: number): THREE.BufferGeometry {
  const pos: number[] = [];
  const nor: number[] = [];
  const vidro: number[] = [];
  const idx: number[] = [];
  const lados = 7;
  // perfil [z, raio, é vidro]
  const perfil: Array<[number, number, number]> = [
    [0, 0.0042, 0],
    [0.0105, 0.0046, 0],
    [0.0105, 0.0036, 1],
    [0.0145, 0.0056, 1],
    [0.0195, 0.0066, 1],
    [0.0255, 0.0056, 1],
    [0.031, 0.0032, 1],
    [0.034, 0.0, 1],
  ];
  for (let j = 0; j < perfil.length; j++) {
    const [z, rr, v] = perfil[j];
    // normal aproximada pelo perfil vizinho
    const a = perfil[Math.max(0, j - 1)];
    const b = perfil[Math.min(perfil.length - 1, j + 1)];
    const dz = b[0] - a[0];
    const dr = b[1] - a[1];
    const nl = Math.hypot(dz, dr) || 1;
    for (let i = 0; i <= lados; i++) {
      const ang = (i / lados) * Math.PI * 2;
      pos.push(Math.cos(ang) * rr * escala, Math.sin(ang) * rr * escala, z * escala);
      nor.push((Math.cos(ang) * dz) / nl, (Math.sin(ang) * dz) / nl, -dr / nl);
      vidro.push(v);
    }
  }
  const linha = lados + 1;
  for (let j = 0; j < perfil.length - 1; j++) {
    if (perfil[j][0] === perfil[j + 1][0]) continue; // degrau entre o soquete e o vidro
    for (let i = 0; i < lados; i++) {
      const a = j * linha + i;
      idx.push(a, a + 1, a + linha, a + 1, a + linha + 1, a + linha);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('aVidro', new THREE.Float32BufferAttribute(vidro, 1));
  g.setIndex(idx);
  return g;
}

export interface CordaoDeLuzes {
  grupo: THREE.Group;
  /** Quantas lâmpadas ficam acesas em cada nível. */
  ativas: Record<Level, number>;
  setQuality(level: Level): void;
  dispose(): void;
}

export interface OpcoesCordao {
  /** Tamanho do bulbo (1 = 3,4 cm de comprimento). */
  escala?: number;
  /** Emissão do vidro em HDR (1 = branco pleno). */
  emissao?: number;
  /** Fração das lâmpadas acesas em cada nível. */
  fracao?: Record<Level, number>;
  fio?: boolean;
  /** Direção "para dentro da folhagem" em um ponto (para o fio mergulhar entre os ramos). Padrão: o eixo vertical da peça. */
  paraDentro?: (p: THREE.Vector3, out: THREE.Vector3) => THREE.Vector3;
}

/**
 * `lampadas` na ordem do fio. A parte inteira de `id` é a ordem de corte: os níveis mais baixos acendem só
 * as de ordem menor (elas ficam espalhadas pela peça inteira). Devolve os bulbos instanciados e o fio que
 * passa por todos os soquetes, pousando nos ramos.
 */
export function criarCordao(lampadas: Lampada[], relogio: RelogioLuzes, o: OpcoesCordao = {}): CordaoDeLuzes {
  const grupo = new THREE.Group();
  grupo.name = 'luzinhas';
  const n = lampadas.length;
  const escala = o.escala ?? 1;
  const geo = geometriaBulbo(escala);
  const dados = new Float32Array(n * 3);
  const emissao = o.emissao ?? 2.6;
  const proprios = { uEmissao: { value: emissao }, uInchar: { value: 1 }, uLeite: { value: 1 }, uSoquete: { value: 0 } };
  const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.3, metalness: 0 });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, proprios, relogio);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
        attribute float aVidro;
        attribute vec3 aLampada;
        uniform float uInchar;
        varying float vVidro;
        varying vec4 vLuz;
        ${GLSL_BRILHO}`,
      )
      .replace(
        '#include <begin_vertex>',
        /* glsl */ `#include <begin_vertex>
        // sem o brilho do palco (nível baixo) o bulbo cresce um pouco para continuar lendo como ponto de luz
        transformed = ( transformed - vec3( 0.0, 0.0, 0.02 ) ) * uInchar + vec3( 0.0, 0.0, 0.02 );
        vVidro = aVidro;
        vLuz = vec4( corLampada( aLampada.x ), brilhoLampada( aLampada.x, aLampada.y ) );`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
        uniform float uEmissao;
        uniform float uLeite;
        uniform float uSoquete;
        varying float vVidro;
        varying vec4 vLuz;`,
      )
      .replace(
        '#include <color_fragment>',
        /* glsl */ `#include <color_fragment>
        // soquete de plástico verde-escuro; vidro leitoso
        diffuseColor.rgb = mix( vec3( 0.012, 0.035, 0.02 ), vec3( 0.5, 0.38, 0.24 ) * uLeite, vVidro );`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        /* glsl */ `#include <emissivemap_fragment>
        {
          // o filamento: o miolo do bulbo (de frente para a câmera) é quase branco; a borda do vidro é âmbar.
          // Assim a respiração da lâmpada aparece como "mais âmbar" ou "mais clara", não some no branco estourado.
          float miolo = pow( saturate( dot( normalize( vNormal ), normalize( vViewPosition ) ) ), 1.6 );
          vec3 c = vLuz.rgb;
          vec3 borda = c * c * 0.75;
          vec3 centro = mix( c * c * 1.5, c * 1.15 + 0.1, uLeite );
          totalEmissiveRadiance += vVidro * vLuz.a * uEmissao * mix( borda, centro, miolo * ( 0.35 + 0.65 * saturate( vLuz.a ) ) );
          // sem o brilho do palco o soquete também acende um pouco, senão vira um ponto preto no meio do clarão
          totalEmissiveRadiance += ( 1.0 - vVidro ) * uSoquete * vLuz.a * c * c;
        }`,
      );
  };
  mat.customProgramCacheKey = () => 'lampadinha-2';
  const bulbos = new THREE.InstancedMesh(geo, mat, n);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const z = new THREE.Vector3(0, 0, 1);
  const um = new THREE.Vector3(1, 1, 1);
  // instâncias na ordem de corte: os níveis mais baixos desenham só o começo da lista
  const ordem = lampadas.map((_, i) => i).sort((a, b) => lampadas[a].id - lampadas[b].id);
  for (let i = 0; i < n; i++) {
    const l = lampadas[ordem[i]];
    q.setFromUnitVectors(z, l.dir);
    // a posição da lâmpada é o centro do vidro; o soquete fica para trás
    m.compose(new THREE.Vector3(l.x, l.y, l.z).addScaledVector(l.dir, -0.02 * escala), q, um);
    bulbos.setMatrixAt(i, m);
    dados[i * 3] = l.id;
    dados[i * 3 + 1] = l.y;
    dados[i * 3 + 2] = l.halo === false ? 0 : 1;
  }
  geo.setAttribute('aLampada', new THREE.InstancedBufferAttribute(dados, 3));
  bulbos.instanceMatrix.needsUpdate = true;
  bulbos.computeBoundingSphere();
  bulbos.name = 'bulbos';
  bulbos.userData.semAO = true;
  grupo.add(bulbos);

  // nível baixo, sem o brilho do palco: um halo pequeno e aditivo por lâmpada faz o papel dele. Só nas
  // lâmpadas de dentro da copa: a folhagem na frente tapa o halo (testa profundidade) e nenhum boia fora
  // da silhueta.
  const haloGeo = new THREE.PlaneGeometry(1, 1);
  haloGeo.setAttribute('aLampada', geo.getAttribute('aLampada'));
  const mancha = manchaRedonda(32, 2.5);
  const haloMat = new THREE.ShaderMaterial({
    uniforms: { ...relogio, uTamanho: { value: 0.085 * escala }, uHalo: { value: 0.3 }, uMancha: { value: mancha } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute vec3 aLampada;
      uniform float uTamanho;
      varying vec2 vP;
      varying vec3 vCor;
      ${GLSL_BRILHO}
      void main() {
        vP = position.xy + 0.5;
        vCor = corLampada( aLampada.x ) * brilhoLampada( aLampada.x, aLampada.y ) * aLampada.z;
        vec4 mv = modelViewMatrix * instanceMatrix * vec4( 0.0, 0.0, 0.0, 1.0 );
        // um pouco para a frente, para o halo não ser cortado pelas agulhas onde a lâmpada pousa
        mv.z += 0.03;
        mv.xy += position.xy * uTamanho;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uHalo;
      uniform sampler2D uMancha;
      varying vec2 vP;
      varying vec3 vCor;
      void main() {
        gl_FragColor = vec4( vCor * vCor * texture2D( uMancha, vP ).r * uHalo, 1.0 );
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const halos = new THREE.InstancedMesh(haloGeo, haloMat, n);
  for (let i = 0; i < n; i++) {
    const l = lampadas[ordem[i]];
    halos.setMatrixAt(i, m.makeTranslation(l.x, l.y, l.z));
  }
  halos.instanceMatrix.needsUpdate = true;
  halos.frustumCulled = false;
  halos.visible = false;
  halos.renderOrder = 2;
  halos.name = 'halos';
  halos.userData.semAO = true;
  grupo.add(halos);

  // o fio: passa por trás de cada soquete e pousa nos ramos. Entre duas lâmpadas vizinhas faz uma barriga
  // curta, só para baixo (gravidade) e para dentro; entre lâmpadas distantes mergulha na folhagem e some.
  let fioGeo: THREE.BufferGeometry | null = null;
  let fioMat: THREE.MeshStandardMaterial | null = null;
  let fio: THREE.Mesh | null = null;
  if (o.fio !== false && n > 1) {
    const paraDentro = o.paraDentro ?? ((p: THREE.Vector3, out: THREE.Vector3) => out.set(-p.x, 0, -p.z).normalize());
    const guia: THREE.Vector3[] = [];
    const dentro = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      const l = lampadas[i];
      const soquete = new THREE.Vector3(l.x, l.y, l.z).addScaledVector(l.dir, -0.022 * escala);
      guia.push(soquete);
      if (i < n - 1) {
        const pr = lampadas[i + 1];
        const proximo = new THREE.Vector3(pr.x, pr.y, pr.z).addScaledVector(pr.dir, -0.022 * escala);
        const d = soquete.distanceTo(proximo);
        // entre lâmpadas distantes o fio mergulha na copa (some entre os ramos) em vez de cruzar o ar reto
        const longe = d > 0.2 * escala;
        for (const f of longe ? [0.3, 0.7] : [0.5]) {
          const meio = soquete.clone().lerp(proximo, f);
          paraDentro(meio, dentro);
          meio.y -= Math.min(0.06, d * 0.18) * escala;
          let fundo = longe ? Math.min(0.3, d * 0.55) : Math.min(0.05, d * 0.2);
          // na árvore (eixo vertical), sem atravessar para o outro lado da copa
          if (!o.paraDentro) fundo = Math.min(fundo, Math.hypot(meio.x, meio.z) * 0.6);
          meio.addScaledVector(dentro, fundo);
          guia.push(meio);
        }
      }
    }
    const curva = new THREE.CatmullRomCurve3(guia, false, 'catmullrom', 0.5);
    const pontos = curva.getPoints(guia.length * 3);
    const malhador = new Malhador();
    tubo(malhador, pontos, () => 0.0021 * escala, 3, 0.1, undefined, false);
    fioGeo = malhador.geometria();
    fioMat = new THREE.MeshStandardMaterial({ color: '#0b2014', roughness: 0.6 });
    fio = new THREE.Mesh(fioGeo, fioMat);
    fio.name = 'fio';
    fio.userData.semAO = true;
    grupo.add(fio);
  }

  const fracao = o.fracao ?? { alta: 1, media: 0.8, baixa: 0.6 };
  const ativas = { alta: Math.max(1, Math.round(n * fracao.alta)), media: Math.max(1, Math.round(n * fracao.media)), baixa: Math.max(1, Math.round(n * fracao.baixa)) };
  return {
    grupo,
    ativas,
    setQuality(level) {
      bulbos.count = ativas[level];
      if (fio) fio.visible = level !== 'baixa';
      const baixa = level === 'baixa';
      proprios.uInchar.value = baixa ? 1.45 : 1;
      // sem o brilho do palco, emissão menor e âmbar: o bulbo guarda a cor quente em vez de estourar em branco
      proprios.uEmissao.value = emissao * (baixa ? 0.5 : 1);
      proprios.uSoquete.value = baixa ? 0.5 : 0;
      halos.visible = baixa;
      halos.count = bulbos.count;
      // e o vidro reflete menos a luz da sala, senão é ela (e não o filamento) que dá a cor do bulbo
      proprios.uLeite.value = baixa ? 0.3 : 1;
    },
    dispose() {
      geo.dispose();
      mat.dispose();
      bulbos.dispose();
      haloGeo.dispose();
      haloMat.dispose();
      mancha.dispose();
      halos.dispose();
      fioGeo?.dispose();
      fioMat?.dispose();
    },
  };
}
