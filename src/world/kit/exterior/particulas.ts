/**
 * O que se move ou brilha sem ser geometria: neve caindo em três camadas de profundidade, fios de fumaça das
 * chaminés, halos dos lampiões e das janelas, e as vidraças acesas (com um atlas pintado em canvas).
 * Cada sistema é uma única chamada de desenho, animada no shader só com o tempo.
 */
import * as THREE from 'three';
import { GLSL_LUAR, GLSL_RUIDO, type UniformesLuar } from './luar';
import type { Fumaca, Halo } from './casas';
import { criarRng } from './util';

/* ------------------------------------------------------------ neve caindo */

export interface NeveCaindo {
  pontos: THREE.Points;
  /** Altura do quadro em pixels (para o tamanho dos flocos acompanhar a resolução). */
  uAlturaPx: THREE.IUniform<number>;
  definirFracao(f: number): void;
  dispose(): void;
}

/**
 * Três camadas: flocos grandes, lentos e desfocados perto do vidro; médios no jardim; miúdos sobre a vila.
 * Cada floco vive em uma caixa e reaparece em cima quando chega embaixo; deriva lateral com o vento e um balanço próprio.
 */
export function criarNeveCaindo(U: UniformesLuar, semente: number, k: number): NeveCaindo {
  const rng = criarRng(semente + 97);
  const camadas = [
    { n: 150, min: [-5.5, -0.6, -3.3], tam: [11, 7.4, 3.05], diam: [0.03, 0.05], vel: [0.2, 0.34] },
    { n: 820, min: [-17, -2.5, -17], tam: [34, 13, 13.7], diam: [0.02, 0.03], vel: [0.42, 0.7] },
    { n: 1500, min: [-52 * k, -6 * k, -14 - 50 * k], tam: [104 * k, 30 * k, 50 * k - 3], diam: [0.035 * k, 0.06 * k], vel: [0.8, 1.3] },
  ];
  const itens: Array<[number, number, number, number, number, number, number]> = [];
  camadas.forEach((c, ci) => {
    for (let i = 0; i < c.n; i++) itens.push([rng(), rng(), rng(), ci, c.diam[0] + (c.diam[1] - c.diam[0]) * rng(), c.vel[0] + (c.vel[1] - c.vel[0]) * rng(), rng() * 6.283]);
  });
  // embaralha para que um prefixo qualquer tenha flocos de todas as camadas (níveis de qualidade)
  for (let i = itens.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [itens[i], itens[j]] = [itens[j], itens[i]];
  }
  const N = itens.length;
  const pos = new Float32Array(N * 3);
  const dados = new Float32Array(N * 4);
  itens.forEach((it, i) => {
    pos.set([it[0], it[1], it[2]], i * 3);
    dados.set([it[3], it[4], it[5], it[6]], i * 4);
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aDados', new THREE.BufferAttribute(dados, 4));
  const uAlturaPx = { value: 1920 };
  const mat = new THREE.ShaderMaterial({
    name: 'neve-caindo',
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTempo: U.uTempo,
      uGanho: U.uGanho,
      uLuaCor: U.uLuaCor,
      uAuroraCor: U.uAuroraCor,
      uNoite: U.uNoite,
      uAlturaPx,
      uMin: { value: camadas.map((c) => new THREE.Vector3(...c.min)) },
      uTam: { value: camadas.map((c) => new THREE.Vector3(...c.tam)) },
      uVento: { value: new THREE.Vector2(0.16, 0.04) },
    },
    vertexShader: /* glsl */ `
      attribute vec4 aDados;
      uniform float uTempo;
      uniform float uAlturaPx;
      uniform vec3 uMin[3];
      uniform vec3 uTam[3];
      uniform vec2 uVento;
      varying float vAlfa;
      varying float vSuave;
      varying float vPerto;
      void main() {
        int c = int(aDados.x + 0.5);
        vec3 mn = uMin[c];
        vec3 tm = uTam[c];
        float fase = aDados.w;
        vec3 p = position;
        p.y = fract(p.y - uTempo * aDados.z / tm.y);
        float bal = sin(uTempo * (0.45 + 0.4 * fract(fase * 7.3)) + fase) * (0.08 + 0.22 * fract(fase * 3.1));
        float bal2 = cos(uTempo * 0.33 + fase * 1.7) * 0.1;
        float camadaVento = c == 0 ? 0.6 : (c == 1 ? 1.0 : 1.5);
        p.x = fract(p.x + (uVento.x * camadaVento * uTempo + bal) / tm.x);
        p.z = fract(p.z + (uVento.y * uTempo + bal2) / tm.z);
        vec3 w = mn + p * tm;
        vec4 mv = modelViewMatrix * vec4(w, 1.0);
        gl_Position = projectionMatrix * mv;
        float px = aDados.y * projectionMatrix[1][1] * uAlturaPx * 0.5 / max(-mv.z, 0.2);
        gl_PointSize = clamp(px, 1.4, 48.0);
        float borda = smoothstep(0.0, 0.07, p.y) * smoothstep(1.0, 0.9, p.y) * smoothstep(0.0, 0.04, p.x) * smoothstep(1.0, 0.96, p.x);
        float base = c == 0 ? 0.42 : (c == 1 ? 0.7 : 0.55);
        vAlfa = base * borda * clamp(px / 1.4, 0.3, 1.0) * (px > 44.0 ? 0.0 : 1.0);
        vSuave = c == 0 ? 1.0 : 0.0;
        vPerto = c == 0 ? 1.0 - smoothstep(0.3, 3.0, -w.z) : 0.0;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uLuaCor;
      uniform vec3 uAuroraCor;
      uniform float uNoite;
      uniform float uGanho;
      varying float vAlfa;
      varying float vSuave;
      varying float vPerto;
      void main() {
        float r = length(gl_PointCoord - 0.5) * 2.0;
        // perto do vidro: disco largo e fora de foco; longe: ponto firme
        float a = mix(smoothstep(1.0, 0.35, r), exp(-r * r * 2.6) * smoothstep(1.0, 0.75, r), vSuave);
        vec3 cor = uLuaCor * 0.62 + vec3(0.07, 0.1, 0.16) + uAuroraCor * uNoite * 0.5;
        // os flocos junto à janela pegam um pouco da luz quente da sala
        cor = mix(cor, vec3(0.75, 0.55, 0.36), vPerto * 0.45);
        gl_FragColor = vec4(cor * uGanho, a * vAlfa);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const pontos = new THREE.Points(geo, mat);
  pontos.name = 'neve-caindo';
  pontos.frustumCulled = false;
  pontos.renderOrder = -20;
  return {
    pontos,
    uAlturaPx,
    definirFracao(f) {
      geo.setDrawRange(0, Math.round(N * f));
    },
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
}

/* ------------------------------------------------------------------ fumaça */

/** Fios de fumaça: uma fita por chaminé, que sobe, se inclina com o vento e se desfaz; o desenho é ruído rolando para cima. */
export function criarFumaca(U: UniformesLuar, fontes: Fumaca[]): THREE.Mesh {
  const SEG = 14;
  const pos: number[] = [];
  const dados: number[] = [];
  const idx: number[] = [];
  fontes.forEach((f, fi) => {
    const base = pos.length / 3;
    for (let s = 0; s <= SEG; s++) {
      for (const lado of [-1, 1]) {
        pos.push(f.pos.x, f.pos.y, f.pos.z);
        dados.push(s / SEG, lado, fi * 1.37 + 0.5, f.escala);
      }
    }
    for (let s = 0; s < SEG; s++) {
      const a = base + s * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aDados', new THREE.Float32BufferAttribute(dados, 4));
  geo.setIndex(idx);
  const mat = new THREE.ShaderMaterial({
    name: 'fumaca',
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { ...U },
    vertexShader: /* glsl */ `
      attribute vec4 aDados;
      uniform float uTempo;
      varying vec2 vUv;
      varying float vFase;
      varying vec3 vPos;
      void main() {
        float h = aDados.x;
        float esc = aDados.w;
        float t = uTempo * 0.22 + aDados.z;
        // cada coluna com a sua altura e a sua inclinação
        float var1 = fract(aDados.z * 7.31);
        float var2 = fract(aDados.z * 3.17 + 0.4);
        vec3 p = position;
        p.y += esc * (5.5 + 4.0 * var1) * h;
        // o vento deita a fumaça para um lado, cada vez mais com a altura, com um serpenteio lento
        p.x += esc * ((1.2 + 2.6 * var2) * h * h + 0.45 * h * sin(h * 4.0 - t * 1.2));
        p.z += esc * 0.35 * h * sin(h * 3.7 - t * 0.9 + 1.7);
        vPos = p;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        mv.x += aDados.y * esc * (0.2 + 2.1 * h);
        vUv = vec2(aDados.y, h);
        vFase = aDados.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      varying float vFase;
      varying vec3 vPos;
      ${GLSL_RUIDO}
      ${GLSL_LUAR}
      void main() {
        // novelos que sobem: duas oitavas de ruído rolando para cima, sem estrias; bordas dissolvidas
        vec2 q = vec2(vUv.x * 0.9 + vFase * 3.0, vUv.y * 2.4 - uTempo * 0.12 + vFase);
        float n = ruido(q) * 0.65 + ruido(q * 2.1 + vec2(3.1, -uTempo * 0.1)) * 0.35;
        float lado = 1.0 - smoothstep(0.15, 1.0, abs(vUv.x) + (n - 0.5) * 0.5);
        float a = lado * smoothstep(0.0, 0.1, vUv.y) * pow(1.0 - vUv.y, 1.6) * smoothstep(0.25, 0.75, n) * 0.26;
        // fumaça de lenha tomada pelo azul do céu, com um toque quente só na base
        vec3 cor = uLuaCor * 0.32 + uCeuAlto * 2.6 + uAuroraCor * uNoite * 0.4;
        cor = mix(cor, cor + uQuente * 0.08, 1.0 - smoothstep(0.0, 0.2, vUv.y));
        cor = aplicarNevoa(cor, vPos);
        gl_FragColor = vec4(cor * uGanho, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'fumaca';
  mesh.frustumCulled = false;
  mesh.renderOrder = -26;
  return mesh;
}

/* ------------------------------------------------------------------- halos */

/** Halos quentes dos lampiões e das janelas acesas (somam luz; dão o brilho mesmo no nível baixo, sem pós-processamento). */
export function criarHalos(U: UniformesLuar, halos: Halo[], uAlturaPx: THREE.IUniform<number>): THREE.Points {
  const N = halos.length;
  const pos = new Float32Array(N * 3);
  const dados = new Float32Array(N * 3);
  halos.forEach((h, i) => {
    pos.set([h.pos.x, h.pos.y, h.pos.z], i * 3);
    dados.set([h.raio, h.forca, (i * 0.618) % 1], i * 3);
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aDados', new THREE.BufferAttribute(dados, 3));
  const mat = new THREE.ShaderMaterial({
    name: 'halos',
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTempo: U.uTempo, uGanho: U.uGanho, uQuente: U.uQuente, uNevoa: U.uNevoa, uAlturaPx },
    vertexShader: /* glsl */ `
      attribute vec3 aDados;
      uniform float uTempo;
      uniform float uAlturaPx;
      uniform vec4 uNevoa;
      varying float vForca;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        float px = aDados.x * 2.0 * projectionMatrix[1][1] * uAlturaPx * 0.5 / max(-mv.z, 0.2);
        gl_PointSize = clamp(px, 2.0, 220.0);
        float fase = aDados.z * 40.0;
        float treme = 1.0 + 0.04 * sin(uTempo * 2.3 + fase) + 0.025 * sin(uTempo * 6.1 + fase * 1.7);
        // a névoa come um pouco do halo ao longe
        float d = length(position.xz);
        float nev = exp(-max(d - uNevoa.x, 0.0) * uNevoa.y * 0.7);
        vForca = aDados.y * treme * nev;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uQuente;
      uniform float uGanho;
      varying float vForca;
      void main() {
        float r = length(gl_PointCoord - 0.5) * 2.0;
        float a = exp(-r * r * 5.5) * 0.55 + exp(-r * 9.0) * 0.5;
        a *= smoothstep(1.0, 0.7, r);
        gl_FragColor = vec4((uQuente * 0.8 + vec3(0.1, 0.07, 0.02)) * a * vForca * 0.5 * uGanho, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const p = new THREE.Points(geo, mat);
  p.name = 'halos';
  p.frustumCulled = false;
  p.renderOrder = -28;
  return p;
}

/* ---------------------------------------------------------------- vidraças */

/** Atlas das vidraças: 0 e 1 = cômodos acesos (cortinas, luz baixa); 2 = janela apagada; 3 = vidro de lanterna. */
function criarAtlasVidros(): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 512;
  cv.height = 256;
  const c = cv.getContext('2d');
  if (!c) throw new Error('canvas 2D indisponível');
  const L = 128;
  const H = 256;
  // 0: cômodo aceso com cortinas abertas e a luz vindo de baixo (lareira, luminária)
  let g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#b8651c');
  g.addColorStop(0.55, '#f2a63c');
  g.addColorStop(1, '#ffd27a');
  c.fillStyle = g;
  c.fillRect(0, 0, L, H);
  g = c.createRadialGradient(L * 0.55, H * 0.8, 4, L * 0.55, H * 0.8, L * 0.9);
  g.addColorStop(0, 'rgba(255,236,170,0.95)');
  g.addColorStop(1, 'rgba(255,236,170,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, L, H);
  for (const lado of [0, 1]) {
    // cortinas: panos mais escuros dos lados, com dobras
    for (let i = 0; i < 5; i++) {
      const x = lado ? L - (i + 1) * 6 : i * 6;
      c.fillStyle = `rgba(${96 + i * 14},${34 + i * 9},8,${0.72 - i * 0.11})`;
      c.beginPath();
      c.moveTo(x, 0);
      c.lineTo(x + 6, 0);
      c.lineTo(lado ? x + 6 + i * 1.2 : x + 6 - i * 1.2 + 4, H);
      c.lineTo(lado ? x + i * 1.2 : x - i * 1.2, H);
      c.fill();
    }
  }
  // 1: cortina fina fechada, luz difusa e uniforme
  g = c.createLinearGradient(L, 0, L, H);
  g.addColorStop(0, '#d98a2c');
  g.addColorStop(1, '#ffc866');
  c.fillStyle = g;
  c.fillRect(L, 0, L, H);
  for (let i = 0; i < 16; i++) {
    c.fillStyle = `rgba(120,50,10,${0.1 + 0.12 * ((i * 7) % 3)})`;
    c.fillRect(L + i * 8 + 2, 0, 3, H);
  }
  g = c.createRadialGradient(L * 1.4, H * 0.62, 6, L * 1.4, H * 0.62, L * 0.8);
  g.addColorStop(0, 'rgba(255,240,190,0.75)');
  g.addColorStop(1, 'rgba(255,240,190,0)');
  c.fillStyle = g;
  c.fillRect(L, 0, L, H);
  // travessas do caixilho pintadas por cima das janelas acesas (a geometria fica só com a moldura)
  c.fillStyle = '#2a1408';
  for (const x0 of [0, L]) {
    c.fillRect(x0 + L / 2 - 4, 0, 8, H);
    c.fillRect(x0, H * 0.4 - 4, L, 8);
  }
  // 2: janela apagada: vidro escuro com um reflexo diagonal do céu
  g = c.createLinearGradient(L * 2, 0, L * 3, H);
  g.addColorStop(0, '#0b1730');
  g.addColorStop(0.45, '#16294e');
  g.addColorStop(0.55, '#0a1428');
  g.addColorStop(1, '#070d1c');
  c.fillStyle = g;
  c.fillRect(L * 2, 0, L, H);
  c.fillStyle = '#04070f';
  c.fillRect(L * 2.5 - 4, 0, 8, H);
  c.fillRect(L * 2, H * 0.4 - 4, L, 8);
  // 3: vidro de lanterna fosco: âmbar mais escuro nas bordas e no pé, miolo quente (nunca branco), fuligem nos cantos
  g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#6e3410');
  g.addColorStop(0.35, '#c06a1e');
  g.addColorStop(1, '#8a4614');
  c.fillStyle = g;
  c.fillRect(L * 3, 0, L, H);
  g = c.createRadialGradient(L * 3.5, H * 0.52, 6, L * 3.5, H * 0.52, L * 0.62);
  g.addColorStop(0, 'rgba(255,200,110,0.95)');
  g.addColorStop(0.45, 'rgba(240,160,70,0.6)');
  g.addColorStop(1, 'rgba(240,160,70,0)');
  c.fillStyle = g;
  c.fillRect(L * 3, 0, L, H);
  g = c.createLinearGradient(L * 3, 0, L * 4, 0);
  g.addColorStop(0, 'rgba(30,12,4,0.55)');
  g.addColorStop(0.18, 'rgba(30,12,4,0)');
  g.addColorStop(0.82, 'rgba(30,12,4,0)');
  g.addColorStop(1, 'rgba(30,12,4,0.55)');
  c.fillStyle = g;
  c.fillRect(L * 3, 0, L, H);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.anisotropy = 4;
  return t;
}

/** Material das vidraças: emissivo, com uma tremulação muito leve nas acesas; as apagadas só refletem o céu. */
export function criarMaterialVidros(U: UniformesLuar): THREE.ShaderMaterial {
  const atlas = criarAtlasVidros();
  const mat = new THREE.ShaderMaterial({
    name: 'vidros',
    side: THREE.DoubleSide,
    uniforms: { ...U, uAtlas: { value: atlas }, uForcaJanela: { value: 2.0 } },
    vertexShader: /* glsl */ `
      attribute vec4 aCor;
      varying vec2 vUv;
      varying vec4 vCor;
      varying vec3 vPos;
      void main() {
        vUv = uv;
        vCor = aCor;
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uAtlas;
      uniform float uForcaJanela;
      varying vec2 vUv;
      varying vec4 vCor;
      varying vec3 vPos;
      ${GLSL_LUAR}
      void main() {
        vec3 t = texture2D(uAtlas, vUv).rgb;
        float fase = vCor.g * 60.0;
        float treme = 1.0 + 0.035 * sin(uTempo * 2.1 + fase) + 0.02 * sin(uTempo * 5.3 + fase * 1.3);
        // matiz do cômodo (aCor.a): 0 a 0,4 = do mel ao âmbar; 0,62 = cortina avermelhada; 0,9 = cortina esverdeada
        float mz = vCor.a;
        vec3 tintaC = mix(vec3(1.0, 0.97, 0.9), vec3(1.0, 0.8, 0.58), clamp(mz / 0.4, 0.0, 1.0));
        tintaC = mix(tintaC, vec3(1.0, 0.56, 0.4), smoothstep(0.5, 0.62, mz) * (1.0 - smoothstep(0.75, 0.85, mz)));
        tintaC = mix(tintaC, vec3(0.72, 0.9, 0.55), smoothstep(0.8, 0.9, mz));
        vec3 acesa = t * tintaC * uForcaJanela * treme * (0.25 + 0.75 * vCor.b);
        // segura o miolo no âmbar: nada de branco estourado depois do tone mapping
        acesa = min(acesa, vec3(2.2, 1.35, 0.6));
        vec3 apagada = t * (0.35 + uNoite * 0.25) + uAuroraCor * uNoite * 0.12;
        vec3 cor = mix(apagada, acesa, step(0.5, vCor.r));
        // a névoa pesa menos sobre o que emite luz
        cor = mix(cor, aplicarNevoa(cor, vPos), 0.55);
        gl_FragColor = vec4(cor * uGanho, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  mat.userData.atlas = atlas;
  return mat;
}
