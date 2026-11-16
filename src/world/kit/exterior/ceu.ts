/**
 * Céu do diorama: cúpula com degradê do azul quase preto ao azul profundo, lua com halo, nuvens finas e a
 * aurora da noite mágica (tudo em um shader só); estrelas em pontos que cintilam devagar; morros e montanhas
 * do fundo em silhuetas azuladas; faixas de neblina entre as camadas.
 */
import * as THREE from 'three';
import type { Relevo } from './relevo';
import { GLSL_RUIDO, type UniformesLuar } from './luar';
import { Malha, criarRng, fbm } from './util';

const GRAU = Math.PI / 180;

/** Direção (unitária, espaço da peça) de um azimute (0 = em frente à janela, positivo = direita) e elevação, em graus. */
export function direcaoCeu(azGraus: number, elGraus: number, out = new THREE.Vector3()): THREE.Vector3 {
  const az = azGraus * GRAU;
  const el = elGraus * GRAU;
  return out.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
}

export interface Ceu {
  cupula: THREE.Mesh;
  estrelas: THREE.Points;
  uniformes: { uLuaPos: THREE.IUniform<THREE.Vector3>; uLuaRaio: THREE.IUniform<number>; uPx: THREE.IUniform<number> };
  definirEstrelas(fracao: number): void;
  dispose(): void;
}

/** Centro (altura dos olhos de quem está na sala) de onde as direções do céu são medidas. */
export const CENTRO_CEU = new THREE.Vector3(0, 1.9, 4);

export function criarCeu(U: UniformesLuar, raio: number, luaAz: number, luaEl: number, luaRaioGraus: number, semente: number): Ceu {
  const luaPos = direcaoCeu(luaAz, luaEl);
  const uniformes = {
    uLuaPos: { value: luaPos },
    uLuaRaio: { value: luaRaioGraus },
    uPx: { value: 1 },
  };
  const geo = new THREE.SphereGeometry(raio, 56, 28, Math.PI * 1.5 - 1.75, 3.5, 0, Math.PI / 2 + 0.22);
  geo.translate(CENTRO_CEU.x, CENTRO_CEU.y, CENTRO_CEU.z);
  const mat = new THREE.ShaderMaterial({
    name: 'ceu',
    side: THREE.BackSide,
    uniforms: { ...U, ...uniformes, uCentro: { value: CENTRO_CEU } },
    vertexShader: /* glsl */ `
      uniform vec3 uCentro;
      varying vec3 vDir;
      void main() {
        vDir = position - uCentro;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uLuaPos;
      uniform float uLuaRaio;
      uniform vec3 uNevoaCor;
      uniform vec3 uAuroraCor;
      uniform float uNoite;
      uniform float uGanho;
      uniform float uTempo;
      varying vec3 vDir;
      ${GLSL_RUIDO}

      // cortinas de aurora: faixas onduladas com a borda de baixo nítida, raios verticais finos e vãos de céu entre elas
      vec3 aurora(float az, float el, float t) {
        vec3 soma = vec3(0.0);
        for (int i = 0; i < 3; i++) {
          float fi = float(i);
          // cada cortina rola devagar em azimute, com velocidade própria (duas camadas em sentidos opostos)
          float x = az * (1.5 + 0.45 * fi) + fi * 2.3 + t * (fi == 1.0 ? -0.05 : 0.03 + 0.01 * fi);
          float base = radians(6.2 + fi * 3.3) + radians(1.7) * sin(x * 2.0 + t * 0.09 + fi) + radians(0.9) * sin(x * 5.3 - t * 0.13 + fi * 2.0);
          // a borda de baixo ondula com ruído no tempo: nada de diagonal reta
          base += radians(1.4) * (fbm(vec2(x * 1.7 + t * 0.06, fi * 4.0 + t * 0.035)) - 0.5);
          float altura = radians(3.4 + 1.7 * fi) * (0.5 + 0.95 * ruido(vec2(az * 3.0 + fi * 7.0, t * 0.05)));
          float hn = (el - base) / altura;
          float corpo = smoothstep(-0.3, 0.14, hn) * exp(-max(hn, 0.0) * 1.8);
          float dobra = az * 42.0 + 6.0 * sin(az * 4.0 + t * 0.05 + fi * 1.7);
          float raios = 0.4 + 0.6 * ruido(vec2(dobra, fi * 13.0 + t * 0.12));
          raios *= 0.65 + 0.35 * ruido(vec2(dobra * 3.1, t * 0.2 + fi));
          float trecho = smoothstep(0.22, 0.6, ruido(vec2(x * 0.9 + fi * 5.0 + t * 0.03, fi * 3.0 + 0.5 + t * 0.01)));
          vec3 verde = vec3(0.08, 0.9, 0.5);
          vec3 turquesa = vec3(0.06, 0.55, 0.8);
          vec3 violeta = vec3(0.4, 0.2, 0.8);
          vec3 c = mix(verde, turquesa, smoothstep(0.1, 1.0, hn) * (0.55 + 0.2 * fi));
          c = mix(c, violeta, smoothstep(0.9, 2.2, hn) * 0.85);
          soma += c * corpo * raios * trecho * (0.62 - 0.12 * fi);
          // franja violeta no alto das cortinas, bem mais fraca que o verde
          soma += violeta * smoothstep(0.35, 1.3, hn) * exp(-max(hn - 1.1, 0.0) * 1.0) * raios * trecho * 0.2;
        }
        return soma;
      }

      void main() {
        vec3 dir = normalize(vDir);
        float el = asin(clamp(dir.y, -1.0, 1.0));
        float az = atan(dir.x, -dir.z);
        float e = degrees(el);

        vec3 horizonte = vec3(0.03, 0.074, 0.23);
        vec3 medio = vec3(0.01, 0.026, 0.098);
        vec3 alto = vec3(0.0035, 0.009, 0.04);
        vec3 zenite = vec3(0.0015, 0.004, 0.02);
        vec3 c = mix(horizonte, medio, smoothstep(1.5, 9.5, e));
        c = mix(c, alto, smoothstep(8.0, 21.0, e));
        c = mix(c, zenite, smoothstep(20.0, 55.0, e));
        c = mix(c, uNevoaCor, smoothstep(3.0, -3.0, e));

        // clarão em volta da lua: um halo curto e um véu largo
        float ang = degrees(acos(clamp(dot(dir, normalize(uLuaPos)), -1.0, 1.0)));
        float veu = exp(-ang / 6.0);
        float halo = exp(-max(ang - uLuaRaio, 0.0) / 1.7);
        c += vec3(0.06, 0.115, 0.27) * veu * 0.5 + vec3(0.20, 0.30, 0.52) * halo * 0.2;

        // nuvens finas, baixas e paradas, que pegam o luar
        float nv = fbm(vec2(az * 4.2 + uTempo * 0.003, el * 26.0 + 3.0));
        float nuvem = smoothstep(0.5, 0.82, nv) * smoothstep(2.0, 6.0, e) * (1.0 - smoothstep(13.0, 24.0, e));
        c += nuvem * (vec3(0.012, 0.024, 0.065) + vec3(0.09, 0.14, 0.26) * veu);

        // aurora (noite mágica): soma por cima do céu, atrás da lua
        if (uNoite > 0.001) {
          c += aurora(az, el, uTempo) * uNoite * 0.85;
          c += uAuroraCor * uNoite * 0.5 * (1.0 - smoothstep(0.0, 30.0, e));
        }

        // disco da lua: branco quente com mares suaves e borda um pouco mais escura
        float d = ang / uLuaRaio;
        if (d < 1.15) {
          vec3 l = normalize(uLuaPos);
          vec3 dx = normalize(cross(vec3(0.0, 1.0, 0.0), l));
          vec3 dy = cross(l, dx);
          vec2 q = vec2(dot(dir, dx), dot(dir, dy)) / sin(radians(uLuaRaio));
          float mares = fbm(q * 2.1 + vec2(4.0, 1.5)) * 0.65 + fbm(q * 5.5 + 9.0) * 0.35;
          vec3 lua = mix(vec3(1.0, 0.97, 0.88), vec3(0.42, 0.53, 0.8), smoothstep(0.36, 0.62, mares) * 0.85);
          lua *= (0.7 + 0.3 * sqrt(max(1.0 - d * d, 0.0))) * 0.96;
          c = mix(c, lua, smoothstep(1.0, 0.93, d));
        }

        gl_FragColor = vec4(c * uGanho, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const cupula = new THREE.Mesh(geo, mat);
  cupula.name = 'ceu';
  cupula.frustumCulled = false;

  // estrelas
  const rng = criarRng(semente + 31);
  const N = 2600;
  const pos = new Float32Array(N * 3);
  const dados = new Float32Array(N * 4);
  const cor = new Float32Array(N * 3);
  const v = new THREE.Vector3();
  const rE = raio * 0.985;
  let n = 0;
  let guarda = 0;
  while (n < N && guarda++ < N * 20) {
    const az = (rng() - 0.5) * 170;
    const el = Math.asin(Math.sin(2.5 * GRAU) + Math.pow(rng(), 1.5) * (Math.sin(62 * GRAU) - Math.sin(2.5 * GRAU))) / GRAU;
    direcaoCeu(az, el, v);
    if (v.angleTo(luaPos) < luaRaioGraus * 2.4 * GRAU) continue;
    const b = Math.pow(rng(), 3.2);
    pos[n * 3] = CENTRO_CEU.x + v.x * rE;
    pos[n * 3 + 1] = CENTRO_CEU.y + v.y * rE;
    pos[n * 3 + 2] = CENTRO_CEU.z + v.z * rE;
    const desbota = Math.min(1, Math.max(0, (el - 3) / 6));
    dados[n * 4] = 1.6 + b * 2.6; // tamanho em pixels (na tela de 1920 de altura)
    dados[n * 4 + 1] = (0.42 + 0.58 * b) * (0.3 + 0.7 * desbota); // brilho
    dados[n * 4 + 2] = 0.25 + rng() * 0.9; // velocidade da cintilação
    dados[n * 4 + 3] = rng() * 6.283;
    const quente = rng();
    cor[n * 3] = 0.72 + 0.28 * quente;
    cor[n * 3 + 1] = 0.82 + 0.12 * quente;
    cor[n * 3 + 2] = 1.0 - 0.15 * quente;
    n++;
  }
  const geoE = new THREE.BufferGeometry();
  geoE.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geoE.setAttribute('aDados', new THREE.BufferAttribute(dados, 4));
  geoE.setAttribute('aCorE', new THREE.BufferAttribute(cor, 3));
  const matE = new THREE.ShaderMaterial({
    name: 'estrelas',
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTempo: U.uTempo, uNoite: U.uNoite, uGanho: U.uGanho, uPx: uniformes.uPx },
    vertexShader: /* glsl */ `
      attribute vec4 aDados;
      attribute vec3 aCorE;
      uniform float uTempo;
      uniform float uNoite;
      uniform float uPx;
      varying vec3 vCor;
      void main() {
        float cint = 0.72 + 0.2 * sin(uTempo * aDados.z + aDados.w) + 0.08 * sin(uTempo * aDados.z * 2.7 + aDados.w * 1.7);
        vCor = aCorE * aDados.y * cint * (1.0 + 0.9 * uNoite) * 3.2;
        gl_PointSize = max(1.8, aDados.x * uPx * (1.0 + 0.2 * uNoite));
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uGanho;
      varying vec3 vCor;
      void main() {
        float r = length(gl_PointCoord - 0.5) * 2.0;
        float a = smoothstep(1.0, 0.15, r);
        gl_FragColor = vec4(vCor * a * a * uGanho, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const estrelas = new THREE.Points(geoE, matE);
  estrelas.name = 'estrelas';
  estrelas.frustumCulled = false;
  estrelas.renderOrder = -40;

  return {
    cupula,
    estrelas,
    uniformes,
    definirEstrelas(fracao: number) {
      geoE.setDrawRange(0, Math.round(N * fracao));
    },
    dispose() {
      geo.dispose();
      mat.dispose();
      geoE.dispose();
      matE.dispose();
    },
  };
}

/** Morros (com mata) e montanhas do fundo, em dois anéis; a altura cai perto do azimute da lua para ela não se esconder. */
export function construirMorros(m: Malha, relevo: Relevo, luaAz: number, semente: number) {
  const k = relevo.k;
  const meioAng = Math.min(1.75, Math.atan2(relevo.largura / 2, 60) + 0.6);
  const nSeg = 96;
  const perfil = [
    [0.0, 0.0],
    [0.45, 0.5],
    [0.8, 0.9],
    [1.0, 1.0],
    [1.2, 0.86],
  ];
  const anel = (rBase: number, rCrista: number, yBase: number, altura: (phi: number) => number, cor: [number, number, number], mata: number) => {
    const v0 = m.vertices;
    m.grade(nSeg + 1, perfil.length, (i, j, out) => {
      const phi = -meioAng + (2 * meioAng * i) / nSeg;
      const [fr, fh] = perfil[j];
      const r = relevo.raio(rBase + (rCrista - rBase) * fr);
      out.set(Math.sin(phi) * r, (yBase + altura(phi) * fh) * k, -Math.cos(phi) * r);
      return { r: cor[0], g: cor[1], b: cor[2], quente: mata };
    });
    // a coordenada v da UV guarda a altura relativa (o shader pinta a mata mais densa embaixo)
    for (let j = 0; j < perfil.length; j++) for (let i = 0; i <= nSeg; i++) m.uv[(v0 + j * (nSeg + 1) + i) * 2 + 1] = perfil[j][1];
  };
  const phiLua = luaAz * GRAU;
  // desenhados no eixo da janela e girados inteiros para o eixo da vista
  m.definir(new THREE.Matrix4().makeRotationY(relevo.giro(1000)));
  anel(81, 92, 0.5, (phi) => 6.5 + 8.5 * fbm(phi * 2.4 + semente, 1.7, 3) + 2.2 * fbm(phi * 9 + 3, semente, 2), [0.78, 0.83, 0.95], 1);
  anel(
    99,
    111,
    2,
    (phi) => (8 + 17 * Math.pow(fbm(phi * 1.8 + semente * 0.7, 6.1, 3), 1.2) + 3 * fbm(phi * 7 + 1, 2.2, 2)) * (1 - 0.5 * Math.exp(-Math.pow((phi - phiLua) / 0.28, 2))),
    [0.74, 0.8, 0.95],
    0.3,
  );
}

/** Faixas de neblina entre as camadas (vale, atrás da crista, entre os morros): uma malha só, translúcida. */
export function criarNeblina(U: UniformesLuar, relevo: Relevo): THREE.Mesh {
  const k = relevo.k;
  const pos: number[] = [];
  const uv: number[] = [];
  const forca: number[] = [];
  const idx: number[] = [];
  const faixaDe = (pontos: Array<[number, number]>, y0: number, y1: number, f: number) => {
    const base = pos.length / 3;
    let comp = 0;
    pontos.forEach(([x, z], i) => {
      if (i > 0) comp += Math.hypot(x - pontos[i - 1][0], z - pontos[i - 1][1]);
      pos.push(x, y0, z, x, y1, z);
      uv.push(comp / 30, 0, comp / 30, 1);
      forca.push(f, f);
    });
    for (let i = 0; i < pontos.length - 1; i++) {
      const a = base + i * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  };
  // vale: acompanha o fundo do vale, logo atrás da borda do jardim
  const vale: Array<[number, number]> = [];
  for (let x = -80; x <= 80; x += 8) {
    const s = relevo.escala(21);
    vale.push([x * s, -relevo.dMundo(21 + 3 * Math.sin(x * 0.05))]);
  }
  faixaDe(vale, -4.2 * k, 0.9 * k, 0.5);
  const arco = (r: number): Array<[number, number]> => {
    const out: Array<[number, number]> = [];
    for (let i = 0; i <= 40; i++) {
      const phi = -1.75 + (3.5 * i) / 40;
      out.push([Math.sin(phi) * relevo.raio(r), -Math.cos(phi) * relevo.raio(r)]);
    }
    return out;
  };
  faixaDe(arco(76.5), 0.5 * k, 13 * k, 0.5);
  faixaDe(arco(96), 2 * k, 21 * k, 0.6);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('aForca', new THREE.Float32BufferAttribute(forca, 1));
  geo.setIndex(idx);
  const mat = new THREE.ShaderMaterial({
    name: 'neblina',
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { uNevoaCor: U.uNevoaCor, uAuroraCor: U.uAuroraCor, uNoite: U.uNoite, uTempo: U.uTempo, uGanho: U.uGanho, uLuaCor: U.uLuaCor },
    vertexShader: /* glsl */ `
      attribute float aForca;
      varying vec2 vUv;
      varying float vForca;
      void main() {
        vUv = uv;
        vForca = aForca;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uNevoaCor;
      uniform vec3 uAuroraCor;
      uniform vec3 uLuaCor;
      uniform float uNoite;
      uniform float uTempo;
      uniform float uGanho;
      varying vec2 vUv;
      varying float vForca;
      ${GLSL_RUIDO}
      void main() {
        float n = fbm(vec2(vUv.x * 2.2 + uTempo * 0.006, vUv.y * 1.6 - uTempo * 0.002));
        float topo = 1.0 - smoothstep(0.25 + 0.35 * n, 1.0, vUv.y);
        float a = vForca * topo * (0.65 + 0.35 * n);
        vec3 c = uNevoaCor * 1.15 + uLuaCor * 0.03 + uAuroraCor * uNoite * 0.3;
        gl_FragColor = vec4(c * uGanho, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'neblina';
  mesh.frustumCulled = false;
  mesh.renderOrder = -35;
  return mesh;
}
