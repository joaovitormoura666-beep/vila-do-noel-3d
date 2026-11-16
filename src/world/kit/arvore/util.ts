/** Utilidades comuns da árvore: sorteio com semente (a disposição sai igual em toda execução) e ruído suave. */
import * as THREE from 'three';

export type Sorteio = () => number;

/** Gerador determinístico (mulberry32): devolve números de 0 a 1. */
export function criarSorteio(semente: number): Sorteio {
  let a = (semente | 0) + 0x6d2b79f5;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const entre = (r: Sorteio, a: number, b: number) => a + (b - a) * r();

/** Número de 0 a 1 que depende só do índice (para variação estável sem gastar o sorteio). */
export function acaso(i: number, sal = 0): number {
  const s = Math.sin(i * 127.1 + sal * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Ruído suave de uma dimensão (soma de senos sem período evidente), de -1 a 1. */
export function ondulacao(x: number, sal = 0): number {
  return (Math.sin(x * 1.0 + sal * 1.7) + Math.sin(x * 2.3 + sal * 4.1 + 1.3) * 0.5 + Math.sin(x * 4.7 + sal * 2.9 + 4.2) * 0.25) / 1.75;
}

export const suave = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Uniformes compartilhados entre a folhagem, as lâmpadas e a estrela (um relógio só, vindo de update). */
export interface RelogioLuzes {
  uTempo: { value: number };
  /** 0 = pisca-pisca calmo; 1 = efeito TREE_SPARKLE no auge. */
  uCintilar: { value: number };
  /** Altura da peça, para a onda que sobe. */
  uAltura: { value: number };
  /** Força geral das lâmpadas (1 = normal). */
  uForca: { value: number };
}

export function criarRelogio(altura: number): RelogioLuzes {
  return { uTempo: { value: 0 }, uCintilar: { value: 0 }, uAltura: { value: altura }, uForca: { value: 1 } };
}

/**
 * Brilho de cada lâmpada ao longo do tempo, em GLSL, usado igual pelo bulbo e pelo halo nas agulhas vizinhas.
 * Calmo: cada lâmpada respira devagar no seu ritmo, entre meia luz e luz cheia (uma em cada seis quase apaga
 * e volta). Cintilando (TREE_SPARKLE): ondas de luz dourada sobem pela árvore e algumas lâmpadas ganham
 * lampejos curtos; a força fica contida, quem dá a magia é a cor e o movimento.
 */
export const GLSL_BRILHO = /* glsl */ `
  uniform float uTempo;
  uniform float uCintilar;
  uniform float uAltura;
  uniform float uForca;
  float acasoLuz(float n) { return fract(sin(n * 12.9898 + 4.1) * 43758.5453); }
  float brilhoLampada(float id, float y) {
    float h1 = acasoLuz(id);
    float h2 = acasoLuz(id + 31.7);
    float h3 = acasoLuz(id * 1.37 + 7.3);
    // respiração lenta, com período de 5 a 12 segundos, e uma segunda onda mais lenta ainda
    float calmo = 0.78 + 0.17 * sin(uTempo * (0.5 + 0.75 * h1) + h2 * 6.2831) + 0.05 * sin(uTempo * 0.23 + h3 * 6.2831);
    // uma em cada seis apaga quase toda, devagar, e volta
    float some = step(0.83, h3) * smoothstep(0.35, 1.0, sin(uTempo * (0.28 + 0.3 * h2) + h1 * 6.2831));
    calmo *= 1.0 - 0.88 * some;
    // ondas que sobem (duas, com passos diferentes) e lampejos individuais
    float alt = y / max(uAltura, 0.001);
    float onda = pow(0.5 + 0.5 * sin(6.2831 * (alt * 1.6 - uTempo * 0.42) + h1 * 0.9), 3.0);
    float onda2 = pow(0.5 + 0.5 * sin(6.2831 * (alt * 0.7 - uTempo * 0.19) + 2.0), 2.0);
    float lampejo = pow(0.5 + 0.5 * sin(uTempo * (4.0 + 5.0 * h2) + h1 * 40.0), 6.0);
    float vivo = 0.22 + 1.5 * onda + 0.35 * onda2 + 1.1 * lampejo * step(0.5, h3);
    return max(0.0, mix(calmo, vivo, uCintilar)) * uForca;
  }
  // branco-quente na maioria; perto de um terço mais âmbar. Cintilando, todas puxam para o dourado.
  vec3 corLampada(float id) {
    float h = acasoLuz(id * 2.71 + 11.0);
    vec3 c = mix(vec3(1.0, 0.76, 0.44), vec3(1.0, 0.58, 0.24), smoothstep(0.62, 0.78, h));
    return mix(c, vec3(1.0, 0.64, 0.22), 0.65 * uCintilar);
  }
`;

/** Cor com pequena variação de matiz, saturação e luz em torno de uma base. */
export function variarCor(base: THREE.Color, r: Sorteio, dh: number, ds: number, dl: number): THREE.Color {
  const hsl = { h: 0, s: 0, l: 0 };
  base.getHSL(hsl);
  return new THREE.Color().setHSL(hsl.h + (r() - 0.5) * dh, THREE.MathUtils.clamp(hsl.s + (r() - 0.5) * ds, 0, 1), THREE.MathUtils.clamp(hsl.l + (r() - 0.5) * dl, 0, 1));
}
