/**
 * CANECA DE CHOCOLATE QUENTE: caneca de cerâmica de parede grossa, esmaltada em vermelho e pintada à mão
 * (flocos e pontos creme, filetes), com a boca arredondada, pé recuado e asa gorda. Dentro, chocolate
 * brilhante com a borda subindo na parede, um redemoinho de chantili (fosco, com as dobras do bico de
 * confeitar) polvilhado de cacau e um pau de canela apoiado na borda. Fios de vapor sobem, ondulando.
 *
 * ANIMAÇÃO (userData.update): o vapor sobe e ondula (no shader, pelo tempo t). O vapor, transparente e
 * fraco, passa um pouco acima do cubo de 1 m; a caneca sólida cabe nele.
 * Duas malhas: a caneca com tudo dentro (uma só, acabamentos por vértice) e o vapor (some no nível baixo).
 */
import * as THREE from 'three';
import type { Level } from '../../contracts';
import { type Cor, Molde, quadros, torno, tubo } from './malha';
import { ACAB, ruido } from './pecas';
import { USO_ESTAMPA, V_BRANCO } from './texturas';
import { div, type Extra, type Moldar } from './tipos';

const RAIO = 0.064;
const ALTURA = 0.125;
const PAREDE = 0.008;
const NIVEL = ALTURA - 0.017; // superfície do chocolate

const CHOCOLATE: Cor = [0.11, 0.035, 0.015];
const CHANTILI: Cor = [0.8, 0.76, 0.68];
const CANELA: Cor = [0.16, 0.05, 0.018];

export const moldarChocolate: Moldar = (q) => {
  const m = new Molde();
  const branco = (): readonly [number, number] => [0.5, V_BRANCO];
  // corpo: pé, parede de fora (estampada), boca arredondada, parede de dentro (lisa) até o chocolate
  const perfil = (v: number): readonly [number, number] => {
    if (v < 0.08) return [(RAIO - 0.012) * (v / 0.08), 0.004];
    if (v < 0.14) {
      const a = ((v - 0.08) / 0.06) * Math.PI * 0.5;
      return [RAIO - 0.012 + Math.sin(a) * 0.006, 0.004 - Math.sin(a) * 0.004 + (1 - Math.cos(a)) * 0.006];
    }
    if (v < 0.7) {
      const t = (v - 0.14) / 0.56;
      // barriga levíssima
      return [RAIO - 0.005 + Math.sin(t * Math.PI) * 0.003 + t * 0.004, 0.006 + t * (ALTURA - 0.012)];
    }
    if (v < 0.82) {
      const a = ((v - 0.7) / 0.12) * Math.PI;
      return [RAIO - 0.001 - PAREDE / 2 + Math.cos(a) * PAREDE / 2, ALTURA - 0.006 + Math.sin(a) * 0.006];
    }
    const t = (v - 0.82) / 0.18;
    return [RAIO - PAREDE - t * 0.004, ALTURA - 0.006 - t * (ALTURA - NIVEL + 0.004)];
  };
  m.adicionar({
    nu: div(q, 56, 24),
    nv: div(q, 32, 16),
    ponto: torno(perfil),
    uv(u, v) {
      if (v >= 0.14 && v < 0.7) return [u, ((v - 0.14) / 0.56) * USO_ESTAMPA];
      // pé, boca e o lado de dentro: vermelho liso (cor do vértice sobre o branco da textura)
      return branco();
    },
    cor(_u, v) {
      if (v >= 0.14 && v < 0.7) return [1, 1, 1];
      const k = v >= 0.82 ? 0.55 : v < 0.08 ? 0.45 : 0.95;
      // vermelho da paleta (B62835) em linear
      return [0.47 * k, 0.022 * k, 0.034 * k];
    },
    acab: (_u, v) => (v < 0.08 ? [0, 0.7, 0, 0] : ACAB.esmalte),
  });

  // asa: gorda, achatada, presa em dois pontos
  const aq = quadros((t, out) => {
    const a = -Math.PI * 0.5 + t * Math.PI;
    out.set(RAIO + 0.008 + Math.cos(a) * 0.034, ALTURA * 0.52 + Math.sin(a) * 0.036 * (1 + 0.1 * Math.cos(a)), 0);
  }, 24, new THREE.Vector3(0, 0, 1));
  m.adicionar({
    nu: div(q, 12, 8),
    nv: 24,
    ponto: tubo(aq, (_u, v) => [0.0085 * (1 + 0.25 * Math.sin(Math.PI * v)), 0.0062 * (1 + 0.3 * Math.sin(Math.PI * v))]),
    uv: branco,
    cor: () => [0.47, 0.022, 0.034],
    acab: () => ACAB.esmalte,
  });

  // chocolate: disco com o menisco subindo na parede
  const rChoc = RAIO - PAREDE - 0.004;
  m.adicionar({
    nu: div(q, 48, 20),
    nv: 5,
    ponto(u, v, out) {
      const a = u * Math.PI * 2;
      const r = rChoc * v;
      out.set(Math.sin(a) * r, NIVEL + Math.pow(v, 6) * 0.003, Math.cos(a) * r);
    },
    uv: branco,
    cor: () => CHOCOLATE,
    acab: () => [0, 0.12, 0.6, 0],
  });

  // chantili: redemoinho em espiral, afinando até um biquinho, com as dobras do bico estrela
  const voltas = 2.6;
  const cq = quadros((t, out) => {
    const a = t * voltas * Math.PI * 2;
    const r = (1 - t) * 0.04 + 0.002;
    out.set(Math.sin(a) * r, NIVEL + 0.006 + t * 0.048 + Math.pow(t, 3) * 0.008, Math.cos(a) * r);
  }, div(q, 72, 36));
  m.adicionar({
    nu: div(q, 12, 8),
    nv: div(q, 72, 36),
    ponto: tubo(cq, (u, v) => {
      const estrela = 1 + 0.16 * Math.pow(Math.abs(Math.cos(u * Math.PI * 4)), 2);
      const r = (0.016 * (1 - v * 0.75) + 0.002) * estrela;
      return [r, r * 0.9];
    }, (v) => v * 9, 0.03),
    uv: branco,
    cor(_u, _v, p) {
      // cacau polvilhado em pontinhos
      const n = ruido(p.x * 260, p.y * 260, p.z * 260, 14);
      return n > 0.42 ? [0.2, 0.09, 0.04] : CHANTILI;
    },
    acab: () => [0, 0.62, 0.15, 0],
  });

  // pau de canela: casca enrolada (tubo com a borda da volta), apoiado na boca
  const pc = new THREE.Vector3(-0.022, NIVEL + 0.01, 0.018);
  const dir = new THREE.Vector3(-0.55, 1, 0.25).normalize();
  const kq = quadros((t, out) => out.copy(pc).addScaledVector(dir, (t - 0.25) * 0.085), 6);
  m.adicionar({
    nu: div(q, 14, 8),
    nv: 6,
    ponto: tubo(kq, (u) => {
      // seção em espiral (a casca enrolada)
      const r = 0.0062 * (0.55 + 0.45 * u) + 0.0004 * Math.sin(u * 40);
      return [r, r];
    }, undefined, 0.02),
    uv: branco,
    cor: (u) => [CANELA[0] * (0.8 + 0.3 * u), CANELA[1] * (0.8 + 0.3 * u), CANELA[2]],
    acab: () => [0, 0.85, 0, 0],
  });

  return {
    partes: [{ nome: 'caneca', material: 'caneca', molde: m }],
    extras(mats, qq) {
      return qq.nivel === 'baixa' ? [] : [criarVapor(mats.vapor, qq.nivel)];
    },
  };
};

const cacheVapor = new Map<Level, THREE.BufferGeometry>();

/** Fios de vapor: fitas cruzadas (cada fio são duas fitas em X, para ler de qualquer lado). */
function criarVapor(material: THREE.ShaderMaterial, nivel: Level): Extra {
  let geo = cacheVapor.get(nivel);
  if (!geo) {
    const fios = nivel === 'alta' ? 3 : 2;
    const pos: number[] = [];
    const uv: number[] = [];
    const fase: number[] = [];
    const idx: number[] = [];
    const seg = 10;
    for (let f = 0; f < fios; f++) {
      const ang = (f / fios) * Math.PI * 2 + 0.4;
      const cx = Math.sin(ang) * 0.022;
      const cz = Math.cos(ang) * 0.022;
      for (const giro of [0, Math.PI / 2]) {
        const base = pos.length / 3;
        for (let i = 0; i <= seg; i++) {
          const t = i / seg;
          const y = NIVEL + 0.03 + t * 0.09;
          const w = 0.012 + t * 0.016;
          for (const s of [-1, 1]) {
            pos.push(cx + Math.cos(giro + ang) * w * s, y, cz - Math.sin(giro + ang) * w * s);
            uv.push(s < 0 ? 0 : 1, t);
            fase.push(f * 1.7 + giro);
          }
        }
        for (let i = 0; i < seg; i++) {
          const a = base + i * 2;
          idx.push(a, a + 1, a + 3, a, a + 3, a + 2);
        }
      }
    }
    geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setAttribute('fase', new THREE.Float32BufferAttribute(fase, 1));
    geo.setIndex(idx);
    geo.computeBoundingSphere();
    cacheVapor.set(nivel, geo);
  }
  const malha = new THREE.Mesh(geo, material);
  malha.name = 'chocolate-vapor';
  malha.renderOrder = 3;
  malha.castShadow = false;
  malha.userData.semAO = true;
  return { objeto: malha };
}

/** Libera a geometria do vapor (fim do jogo). */
export function liberarVapor() {
  for (const g of cacheVapor.values()) g.dispose();
  cacheVapor.clear();
}
