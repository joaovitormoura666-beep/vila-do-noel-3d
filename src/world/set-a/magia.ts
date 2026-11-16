/**
 * Reforço da FIREPLACE_MAGIC para a câmera da sala A.
 *
 * A peça da lareira já faz a magia dela (fogo dourado e faíscas em espiral dentro da boca), mas nesta
 * câmera a boca é vista de lado e pequena: na miniatura o efeito não lia. Aqui a composição soma, só
 * enquanto o efeito está ligado: (1) um fio de poeira dourada que sobe da soleira, gira devagar diante
 * do peito da chaminé e se apaga no alto; (2) mais força no fogo e na luz (lareira.forca), feito em index.ts.
 * Um único Points sem estado: a posição de cada grão sai só de `t` (uniforme), nada de sorteio na animação.
 */
import * as THREE from 'three';
import type { Level } from '../contracts';
import { MAGIA } from './ajustes';
import { criarSorteio } from './geo';

export interface PoeiraMagica {
  pontos: THREE.Points;
  /** `forca` de 0 a 1 (a intensidade do efeito, já suavizada pela agenda). */
  update(t: number, forca: number): void;
  setQuality(level: Level): void;
  dispose(): void;
}

/**
 * `base` é o centro da soleira, diante da boca (mundo); `paraSala` é a direção horizontal para onde a boca olha.
 */
export function criarPoeiraMagica(base: THREE.Vector3, paraSala: THREE.Vector3, semente = 91): PoeiraMagica {
  const N = MAGIA.graos;
  const r = criarSorteio(semente);
  const pos = new Float32Array(N * 3);
  const dados = new Float32Array(N * 4); // fase de subida, raio da espiral, giro inicial, tamanho
  for (let i = 0; i < N; i++) {
    pos[i * 3] = r() - 0.5; // deslocamento lateral ao longo da boca
    pos[i * 3 + 1] = r(); // atraso
    pos[i * 3 + 2] = r(); // velocidade relativa
    dados[i * 4] = r();
    dados[i * 4 + 1] = 0.12 + 0.38 * r();
    dados[i * 4 + 2] = r() * 6.283;
    dados[i * 4 + 3] = MAGIA.tamanho * (0.5 + r());
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aDados', new THREE.BufferAttribute(dados, 4));
  const lado = new THREE.Vector3(-paraSala.z, 0, paraSala.x); // ao longo da boca
  const uniforms = {
    uTempo: { value: 0 },
    uForca: { value: 0 },
    uBase: { value: base.clone() },
    uSala: { value: paraSala.clone().normalize() },
    uLado: { value: lado.normalize() },
    uAltura: { value: MAGIA.altura },
    uLargura: { value: MAGIA.largura },
    uCor: { value: new THREE.Color(MAGIA.cor).multiplyScalar(MAGIA.brilho) },
    uAlturaPx: { value: 1920 },
  };
  const mat = new THREE.ShaderMaterial({
    name: 'poeira-magica',
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute vec4 aDados;
      uniform float uTempo;
      uniform float uForca;
      uniform vec3 uBase;
      uniform vec3 uSala;
      uniform vec3 uLado;
      uniform float uAltura;
      uniform float uLargura;
      uniform float uAlturaPx;
      varying float vAlfa;
      void main() {
        // cada grão sobe em ~5 a 9 s, girando numa espiral larga que se afasta da boca para a sala
        float vel = 0.11 + 0.08 * position.z;
        float u = fract(aDados.x + uTempo * vel + position.y);
        float giro = aDados.z + uTempo * (0.5 + 0.4 * position.z) + u * 5.0;
        float raio = aDados.y * (0.35 + 0.9 * u);
        vec3 w = uBase
          + uLado * (position.x * uLargura + cos(giro) * raio)
          + uSala * (0.15 + 0.55 * u + sin(giro) * raio * 0.6)
          + vec3(0.0, 0.15 + u * uAltura, 0.0);
        vec4 mv = modelViewMatrix * vec4(w, 1.0);
        gl_Position = projectionMatrix * mv;
        float px = aDados.w * projectionMatrix[1][1] * uAlturaPx * 0.5 / max(-mv.z, 0.2);
        // cintila devagar, nasce e some suave, e só existe com o efeito ligado
        float pisca = 0.55 + 0.45 * sin(uTempo * (2.0 + 3.0 * position.z) + aDados.z * 7.0);
        vAlfa = uForca * smoothstep(0.0, 0.12, u) * (1.0 - smoothstep(0.6, 1.0, u)) * pisca;
        gl_PointSize = vAlfa > 0.003 ? clamp(px, 1.5, 14.0) : 0.0;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uCor;
      varying float vAlfa;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float a = (smoothstep(1.0, 0.0, d) * 0.6 + smoothstep(0.35, 0.0, d) * 0.4) * vAlfa;
        if (a < 0.004) discard;
        gl_FragColor = vec4(uCor * a, a);
      }`,
  });
  const pontos = new THREE.Points(geo, mat);
  pontos.name = 'poeira-magica-da-lareira';
  pontos.frustumCulled = false;
  pontos.userData.semAO = true;
  pontos.visible = false;
  return {
    pontos,
    update(t, forca) {
      uniforms.uTempo.value = t;
      uniforms.uForca.value = forca;
      pontos.visible = forca > 0.003;
    },
    setQuality(level) {
      geo.setDrawRange(0, Math.round(N * (level === 'alta' ? 1 : level === 'media' ? 0.65 : 0.4)));
    },
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
}
