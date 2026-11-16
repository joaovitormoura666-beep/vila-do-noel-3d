/**
 * Reflexo da janela no piso encerado: a coluna azul que um piso lustroso devolve abaixo de uma janela
 * clara, vista rasante. O ambiente gerado da sala (PMREM) não sabe onde a janela está, então o reflexo é
 * desenhado à parte: cada vértice guarda o ponto do vão espelhado no piso (y negativo) e o shader o leva
 * para o ponto do piso que fica na linha entre a câmera e esse ponto espelhado. Assim o reflexo fica no
 * lugar certo para qualquer câmera (com balanço, em outro ângulo), fica rente ao piso (personagens passam
 * por cima dele) e custa uma chamada de desenho com 2 x 192 triângulos.
 * A rugosidade do próprio piso quebra a coluna tábua por tábua; a cor e a força vêm da luz de fora.
 */
import * as THREE from 'three';
import { LUZ } from './ajustes';

export interface VaoRefletido {
  /** Centro do vão no plano do vidro (mundo). */
  centro: THREE.Vector3;
  largura: number;
  altura: number;
  /** Base do vão (peitoril). */
  base: number;
  colunas: number;
}

export interface ReflexoDaJanela {
  malha: THREE.Mesh;
  /** Cor e força da luz de fora (a cada quadro). */
  atualizar(cor: THREE.Color, forca: number): void;
  dispose(): void;
}

export function criarReflexoDaJanela(d: VaoRefletido, rugosidadeDoPiso: THREE.Texture | null, ladrilhoDoPiso: number): ReflexoDaJanela {
  const NU = 12;
  const NV = 16;
  const U0 = -0.35;
  const U1 = 1.35;
  const V0 = -0.12;
  const V1 = 1.7; // o reflexo estica para perto da câmera (piso áspero visto rasante)
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let j = 0; j <= NV; j++) {
    for (let i = 0; i <= NU; i++) {
      const u = U0 + ((U1 - U0) * i) / NU;
      const v = V0 + ((V1 - V0) * j) / NV;
      // ponto do vão espelhado no piso
      pos.push(d.centro.x + (u - 0.5) * d.largura, -(d.base + v * d.altura), d.centro.z);
      uv.push(u, v);
    }
  }
  for (let j = 0; j < NV; j++) {
    for (let i = 0; i < NU; i++) {
      const a = j * (NU + 1) + i;
      idx.push(a, a + 1, a + NU + 1, a + 1, a + NU + 2, a + NU + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);

  const uniformes = {
    uCor: { value: new THREE.Color('#7f9df2') },
    uForca: { value: 0 },
    uRug: { value: rugosidadeDoPiso },
    uTemRug: { value: rugosidadeDoPiso ? 1 : 0 },
    uLadrilho: { value: ladrilhoDoPiso },
    uColunas: { value: d.colunas },
  };
  const material = new THREE.ShaderMaterial({
    uniforms: uniformes,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec2 vPiso;
      varying float vRasante;
      void main() {
        vUv = uv;
        vec3 m = (modelMatrix * vec4(position, 1.0)).xyz;      // ponto espelhado (abaixo do piso)
        float k = cameraPosition.y / max(cameraPosition.y - m.y, 0.001);
        vec3 p = cameraPosition + (m - cameraPosition) * k;     // onde a linha câmera-espelho fura o piso
        p.y = 0.003;
        vPiso = p.xz;
        vec3 raio = normalize(p - cameraPosition);
        vRasante = 1.0 - abs(raio.y);
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uCor;
      uniform float uForca;
      uniform sampler2D uRug;
      uniform float uTemRug;
      uniform float uLadrilho;
      uniform float uColunas;
      varying vec2 vUv;
      varying vec2 vPiso;
      varying float vRasante;
      void main() {
        float u = vUv.x;
        float v = vUv.y;
        float borra = 0.035 + 0.17 * clamp(v, 0.0, 1.6);           // quanto mais longe do vidro, mais borrado
        float lado = smoothstep(-borra, borra, u) * (1.0 - smoothstep(1.0 - borra, 1.0 + borra, u));
        float alto = smoothstep(-0.06, 0.1, v) * (1.0 - smoothstep(0.55, 1.6, v));
        // montantes: riscos escuros que somem conforme o reflexo borra
        float dm = abs(fract(u * uColunas + 0.5) - 0.5) / uColunas;
        float montante = (1.0 - smoothstep(0.008, 0.02 + 0.09 * v, dm)) * (1.0 - smoothstep(0.05, 0.6, v));
        float f = lado * alto * (1.0 - 0.55 * montante);
        // a cera: tábuas lisas devolvem mais, frestas e veios ásperos quase nada
        float rug = mix(0.5, texture2D(uRug, vec2(vPiso.y, vPiso.x) / uLadrilho).g, uTemRug);
        float cera = mix(1.35, 0.25, smoothstep(0.3, 0.85, rug));
        // Fresnel: só aparece de verdade em vista rasante
        float fresnel = 0.04 + 0.96 * pow(clamp(vRasante, 0.0, 1.0), 5.0);
        gl_FragColor = vec4(uCor * (uForca * f * cera * fresnel), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const malha = new THREE.Mesh(g, material);
  malha.name = 'reflexo-da-janela';
  malha.frustumCulled = false;
  malha.userData.semAO = true;
  malha.renderOrder = 2;
  return {
    malha,
    atualizar(cor, forca) {
      uniformes.uCor.value.copy(cor);
      uniformes.uForca.value = forca * LUZ.reflexoJanela;
    },
    dispose() {
      g.dispose();
      material.dispose();
    },
  };
}
