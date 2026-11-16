/**
 * Neve do lado de fora da janela: o monte acumulado no peitoril externo, encostado nos vidros de
 * baixo, e montinhos em parte dos cantos das travessas (do lado do vento). Malhas fofas e
 * irregulares (altura e contorno com ruído em duas escalas), nada de caixas. Tudo fica em z negativo
 * (fora), colado no vidro. Cor por vértice: a base é mais escura e azul, a crista pega luz, e os
 * dois centímetros junto ao vidro recebem um âmbar fraco da luz da sala que vaza.
 */
import * as THREE from 'three';
import { fbm2, limitar, misturar, type Sorteio } from './util';

const AZUL_BASE = new THREE.Color(0.62, 0.7, 0.88);
const CRISTA = new THREE.Color(1.12, 1.14, 1.18);
const AMBAR = new THREE.Color(1.25, 0.98, 0.72);

/** Malha em grade (nx colunas ao longo de x, perfil de `linhas` pontos) com normais suaves e cor por vértice. */
function grade(
  nx: number,
  linhas: number,
  ponto: (i: number, j: number, out: THREE.Vector3) => void,
  tom: (i: number, j: number, out: THREE.Color) => void,
  uvEscala: number,
): THREE.BufferGeometry {
  const pos = new Float32Array((nx + 1) * linhas * 3);
  const uv = new Float32Array((nx + 1) * linhas * 2);
  const cor = new Float32Array((nx + 1) * linhas * 3);
  const v = new THREE.Vector3();
  const c = new THREE.Color();
  for (let i = 0; i <= nx; i++) {
    for (let j = 0; j < linhas; j++) {
      ponto(i, j, v);
      tom(i, j, c);
      const k = i * linhas + j;
      pos.set([v.x, v.y, v.z], k * 3);
      uv.set([v.x * uvEscala, (v.y + v.z) * uvEscala], k * 2);
      cor.set([c.r, c.g, c.b], k * 3);
    }
  }
  const idx: number[] = [];
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < linhas - 1; j++) {
      const a = i * linhas + j;
      const b = (i + 1) * linhas + j;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.BufferAttribute(cor, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Tom da neve: `alto` de 0 (base) a 1 (crista), `vidro` de 0 a 1 (junto ao vidro = 1). */
function tomNeve(out: THREE.Color, alto: number, vidro: number, ruido: number) {
  out.copy(AZUL_BASE).lerp(CRISTA, limitar(alto, 0, 1));
  out.multiplyScalar(0.92 + 0.12 * ruido);
  out.lerp(AMBAR, 0.35 * limitar(vidro, 0, 1));
}

/**
 * Monte de neve comprido sobre o peitoril externo, de x0 a x1. `yBase` é o tampo do peitoril,
 * `zVidro` a face de fora das folhas, `fundo` até onde o monte avança para fora. A altura sobe
 * junto aos cantos e varia com ruído; duas ou três cornijas pendem para fora da beirada.
 */
export function monteDoPeitoril(x0: number, x1: number, yBase: number, zVidro: number, fundo: number, altura: number, semente: number): THREE.BufferGeometry {
  const nx = Math.max(24, Math.round((x1 - x0) / 0.02));
  const perfil = 13;
  // cornijas: onde a neve passa da beirada e cai em lábio
  const cornijas: Array<[number, number, number]> = [];
  for (let k = 0; k < 3; k++) {
    const t = 0.15 + 0.7 * (0.5 + 0.5 * fbm2(k * 3.7, semente * 0.31, 1, semente + 40));
    cornijas.push([x0 + (x1 - x0) * t, 0.07 + 0.08 * (0.5 + 0.5 * fbm2(k, 2.2, 1, semente + 41)), k === 2 ? 0.5 : 1]);
  }
  const alturaEm = (x: number) => {
    const dBorda = Math.min(x - x0, x1 - x);
    const canto = Math.exp(-dBorda / 0.2);
    let h = altura * (0.78 + 0.3 * fbm2(x * 1.9, 1.7, 2, semente) + 0.12 * fbm2(x * 9, 4.2, 2, semente + 5)) + canto * altura * 0.55;
    h *= limitar(dBorda / 0.02, 0, 1) * 0.88 + 0.12; // fecha nas pontas
    return h;
  };
  const cornijaEm = (x: number) => cornijas.reduce((m, [cx, w, f]) => Math.max(m, f * Math.exp(-Math.pow((x - cx) / w, 2))), 0);
  return grade(
    nx,
    perfil,
    (i, j, out) => {
      const x = x0 + ((x1 - x0) * i) / nx;
      const h = alturaEm(x);
      const corn = cornijaEm(x);
      const s = j / (perfil - 1);
      if (s < 0.2) {
        // parede encostada no vidro, subindo do peitoril
        const q = s / 0.2;
        out.set(x, yBase + h * 0.9 * Math.sin((q * Math.PI) / 2), zVidro - 0.0015 - 0.004 * q * q);
        return;
      }
      // do alto, junto ao vidro, até a beirada: quarto de superelipse fofa
      const th = ((s - 0.2) / 0.8) * (Math.PI / 2);
      const p = 0.8; // < 1: ombro arredondado e cheio
      const fz = Math.pow(Math.sin(th), p);
      const fy = Math.pow(Math.cos(th), p);
      const ond = 1 + 0.08 * fbm2(x * 33, s * 4, 2, semente + 9) + 0.05 * fbm2(x * 160, s * 12, 1, semente + 10);
      const f = fundo * (0.9 + 0.18 * fbm2(x * 3.3, 8.8, 2, semente + 2)) + 0.035 * corn;
      const z = zVidro - 0.0055 - (f - 0.0055) * fz;
      let y = yBase + (h * 0.9 + h * 0.1 * fy) * fy * ond;
      y = Math.max(y, yBase - (0.012 + 0.03 * corn) * fz * fz);
      out.set(x, y, z);
    },
    (i, j, out) => {
      const x = x0 + ((x1 - x0) * i) / nx;
      const s = j / (perfil - 1);
      const alto = s < 0.2 ? (s / 0.2) * 0.7 : 1 - Math.pow((s - 0.2) / 0.8, 1.6) * 0.9;
      tomNeve(out, alto, s < 0.24 ? 1 - s / 0.24 : 0, fbm2(x * 12, s * 3, 2, semente + 20));
    },
    1 / 0.08,
  );
}

/**
 * Montinho de neve no canto de um vidro, do lado de fora: assenta sobre a travessa de baixo e sobe
 * pelos lados em curva, mais alto do lado do vento (`vento` de -1, esquerda, a 1, direita).
 */
export function montinhoDoVidro(x0: number, x1: number, y0: number, zVidro: number, r: Sorteio, forca = 1, vento = 0): THREE.BufferGeometry {
  const nx = 24;
  const larg = x1 - x0;
  const hE = (0.01 + r() * 0.02) * forca * (1 - 0.65 * vento); // subida à esquerda
  const hD = (0.01 + r() * 0.02) * forca * (1 + 0.65 * vento); // subida à direita
  const meio = (0.003 + r() * 0.006) * forca;
  const sal = Math.floor(r() * 1000);
  const expE = 1.8 + r() * 2;
  const expD = 1.8 + r() * 2;
  const alturaEm = (t: number) => {
    let h = meio + hE * Math.pow(1 - t, expE * 2) + hD * Math.pow(t, expD * 2);
    h *= 1 + 0.3 * fbm2(t * 5, 0.5, 2, sal) + 0.12 * fbm2(t * 22, 1.5, 1, sal + 2);
    return Math.max(0.002, h);
  };
  return grade(
    nx,
    7,
    (i, j, out) => {
      const t = i / nx;
      const x = x0 + larg * t;
      const h = alturaEm(t);
      // perfil roliço: encosta no vidro embaixo e vai se afastando até a crista; depois cai para fora
      const fundo = 0.022 + 0.01 * fbm2(t * 4, 2.5, 2, sal + 1) + h * 0.3;
      const perfil: Array<[number, number]> = [
        [-0.004, -0.0015],
        [h * 0.5, -0.0022],
        [h * 0.86, -0.005],
        [h, -0.011 - h * 0.12],
        [h * 0.8, -fundo * 0.6],
        [h * 0.4, -fundo * 0.88],
        [-0.004, -fundo - 0.004],
      ];
      const [dy, dz] = perfil[j];
      out.set(x, y0 + dy, zVidro + dz);
    },
    (i, j, out) => {
      const alto = [0.1, 0.45, 0.75, 1, 0.75, 0.4, 0.1][j];
      tomNeve(out, alto, j <= 1 ? 1 - j * 0.5 : 0, fbm2((i / nx) * 6, j, 1, sal + 3));
      out.multiplyScalar(misturar(0.95, 1, alto));
    },
    1 / 0.08,
  );
}
