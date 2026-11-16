/**
 * Neve caindo logo atrás da vidraça. O diorama do kit tem a neve dele, mas na sala A ele fica afastado
 * (veja vista.ts) e os flocos de lá viram poeira fina; estes são os flocos grandes e macios de perto,
 * que dão a leitura de "está nevando" mesmo na miniatura.
 * Um único Points, sem estado: a posição de cada floco sai só do tempo (uniforme uTempo).
 */
import * as THREE from 'three';
import type { Level } from '../contracts';
import { criarSorteio } from './geo';

export interface NeveDaJanela {
  pontos: THREE.Points;
  /** Cor e força do luar (copiadas de exterior.luzExterna a cada quadro). */
  update(t: number, cor: THREE.Color, forca: number): void;
  setQuality(level: Level): void;
  dispose(): void;
}

/**
 * Caixa de flocos atrás do vão: `largura` x `altura` (a partir de `base`) x `fundo` metros, com a face
 * da frente a 0,15 m do vidro. A origem do objeto é o centro do vão no piso, no plano do vidro.
 */
export function criarNeveDaJanela(largura: number, base: number, altura: number, fundo = 3.2, quantidade = 300, semente = 77): NeveDaJanela {
  const r = criarSorteio(semente);
  const pos = new Float32Array(quantidade * 3);
  const dados = new Float32Array(quantidade * 4); // tamanho (m), velocidade (m/s), fase, deriva
  for (let i = 0; i < quantidade; i++) {
    pos[i * 3] = r();
    pos[i * 3 + 1] = r();
    pos[i * 3 + 2] = r();
    dados[i * 4] = 0.016 + 0.026 * Math.pow(r(), 2.2);
    dados[i * 4 + 1] = 0.32 + 0.4 * r();
    dados[i * 4 + 2] = r() * 6.283;
    dados[i * 4 + 3] = 0.06 + 0.16 * r();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aDados', new THREE.BufferAttribute(dados, 4));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, base + altura / 2, -fundo / 2), Math.max(largura, altura));
  const uniforms = {
    uTempo: { value: 0 },
    uCor: { value: new THREE.Color('#9fb6ee') },
    uCaixaMin: { value: new THREE.Vector3(-largura / 2 - 0.5, base - 0.2, -0.15 - fundo) },
    uCaixaTam: { value: new THREE.Vector3(largura + 1.0, altura + 0.5, fundo) },
    uAlturaPx: { value: 1920 },
  };
  const mat = new THREE.ShaderMaterial({
    name: 'neve-da-janela',
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      attribute vec4 aDados;
      uniform float uTempo;
      uniform vec3 uCaixaMin;
      uniform vec3 uCaixaTam;
      uniform float uAlturaPx;
      varying float vAlfa;
      void main() {
        vec3 p = position;
        // cai, reaparece em cima; balanço lateral de dois ritmos (nenhum floco desce em linha reta)
        p.y = fract(p.y - uTempo * aDados.y / uCaixaTam.y);
        float bal = sin(uTempo * (0.5 + 0.35 * fract(aDados.z * 3.7)) + aDados.z) + 0.5 * sin(uTempo * 1.31 + aDados.z * 2.3);
        p.x = fract(p.x + (bal * aDados.w + uTempo * 0.05) / uCaixaTam.x);
        vec3 w = uCaixaMin + p * uCaixaTam;
        vec4 mv = modelViewMatrix * vec4(w, 1.0);
        gl_Position = projectionMatrix * mv;
        float px = aDados.x * projectionMatrix[1][1] * uAlturaPx * 0.5 / max(-mv.z, 0.2);
        gl_PointSize = clamp(px, 1.5, 24.0);
        // some nas bordas da caixa (em cima e embaixo) para não "nascer" à vista
        vAlfa = smoothstep(0.0, 0.08, p.y) * smoothstep(1.0, 0.92, p.y) * (0.45 + 0.55 * fract(aDados.z * 5.3));
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uCor;
      varying float vAlfa;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float a = smoothstep(1.0, 0.25, d) * vAlfa;
        if (a < 0.01) discard;
        gl_FragColor = vec4(uCor, a);
      }`,
  });
  const pontos = new THREE.Points(geo, mat);
  pontos.name = 'neve-da-janela';
  pontos.userData.semAO = true;
  pontos.frustumCulled = false;
  pontos.renderOrder = 1; // depois do exterior, antes do vidro
  const base0 = new THREE.Color();
  return {
    pontos,
    update(t, cor, forca) {
      uniforms.uTempo.value = t;
      // flocos iluminados pelo luar: a cor de fora, clareada
      uniforms.uCor.value.copy(base0.copy(cor).lerp(new THREE.Color(1, 1, 1), 0.35)).multiplyScalar(0.42 * forca);
    },
    setQuality(level) {
      geo.setDrawRange(0, Math.round(quantidade * (level === 'alta' ? 1 : level === 'media' ? 0.7 : 0.45)));
    },
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
}
