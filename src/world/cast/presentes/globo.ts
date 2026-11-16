/**
 * GLOBO DE NEVE: redoma de vidro fino (reflexo na borda, quase invisível de frente) sobre uma base de
 * nogueira torneada e envernizada, com um friso de latão. Dentro, a calota de baixo cheia de neve leitosa
 * (do tampo da base até o monte, colada no vidro) e, em cima dela, um montinho com uma casinha de
 * telhado nevado e janela acesa (a única luz própria, fraca) e dois pinheirinhos com neve nas pontas.
 *
 * ANIMAÇÃO (userData.update): a neve dentro do globo rodopia devagar e cai, recomeçando em cima (posição
 * calculada de t, sem estado; o mesmo buffer é reescrito a cada quadro, sem alocar).
 * Três malhas: base e miniaturas (uma só), vidro e os flocos (Points).
 */
import * as THREE from 'three';
import type { Level } from '../../contracts';
import { type Cor, Molde, torno } from './malha';
import { ACAB, COR, superelipsoide } from './pecas';
import { div, type Extra, type Moldar } from './tipos';
import { chaves, criarSorteio, fbm3 } from '../noel/util';

const R = 0.1; // raio da redoma
const BASE_ALTURA = 0.066;
const CENTRO = new THREE.Vector3(0, BASE_ALTURA + R * 0.82, 0);
const NOGUEIRA: Cor = [0.13, 0.05, 0.022];

// perfil da base torneada: altura -> raio
const PERFIL_BASE = chaves([0, 0.006, 0.014, 0.024, 0.034, 0.044, 0.052, 0.06, 0.066], [0.092, 0.094, 0.09, 0.08, 0.083, 0.078, 0.072, 0.073, 0.07]);

export const moldarGlobo: Moldar = (q) => {
  const base = new Molde();
  // base: do centro de baixo, pela parede torneada, até o tampo (onde a redoma assenta)
  base.adicionar({
    nu: div(q, 48, 24),
    nv: div(q, 26, 14),
    ponto: torno((v) => {
      if (v < 0.12) return [PERFIL_BASE(0) * (v / 0.12), 0];
      if (v > 0.9) return [PERFIL_BASE(BASE_ALTURA) * (1 - (v - 0.9) / 0.1) * 0.999, BASE_ALTURA];
      const y = ((v - 0.12) / 0.78) * BASE_ALTURA;
      return [PERFIL_BASE(y), y];
    }),
    cor(_u, v) {
      const y = ((v - 0.12) / 0.78) * BASE_ALTURA;
      // friso de latão na cintura
      return y > 0.028 && y < 0.038 && v > 0.12 && v < 0.9 ? COR.ouro : NOGUEIRA;
    },
    acab(_u, v) {
      const y = ((v - 0.12) / 0.78) * BASE_ALTURA;
      return y > 0.028 && y < 0.038 && v > 0.12 && v < 0.9 ? ACAB.ouro : [0, 0.32, 0.8, 0];
    },
    uv: (u, v) => [u * 0.6, v * 0.25],
  });

  // monte de neve dentro da redoma
  const yNeve = CENTRO.y - R * 0.42;
  const raioMonte = Math.sqrt(R * R - (yNeve - CENTRO.y) ** 2) * 0.97;
  const neve: Cor = [0.8, 0.84, 0.92];
  base.adicionar({
    nu: div(q, 40, 18),
    nv: div(q, 10, 6),
    ponto(u, v, out) {
      const a = u * Math.PI * 2;
      const r = raioMonte * v;
      const h = (1 - v * v) * 0.022 + fbm3(Math.cos(a) * r * 40, Math.sin(a) * r * 40, 0.5, 2, 4) * 0.004 * v;
      out.set(Math.sin(a) * r, yNeve + h, Math.cos(a) * r);
    },
    cor: () => neve,
    acab: () => [0, 0.8, 0, 0],
  });

  // 2ª rodada: a calota de baixo da redoma CHEIA de neve (antes o monte era um disco solto e, por baixo
  // dele, via-se a janela através do vidro vazio até a base: lia como uma ilha flutuando). A neve desce
  // colada no vidro, da borda do monte até o tampo da base, num azul leitoso (#cfd8e6) mais escuro embaixo,
  // com um tico de brilho próprio que imita a luz atravessando a neve molhada (translucidez falsa).
  const leitosa = new THREE.Color('#cfd8e6');
  const cheio: Cor = [leitosa.r, leitosa.g, leitosa.b];
  const raioEsfera = (y: number) => Math.sqrt(Math.max(0, R * R - (y - CENTRO.y) ** 2));
  base.adicionar({
    nu: div(q, 40, 18),
    nv: div(q, 6, 4),
    ponto(u, v, out) {
      const a = u * Math.PI * 2;
      const y = BASE_ALTURA + (yNeve - BASE_ALTURA) * v;
      // encostada no vidro (um nada para dentro), com um ondulado leve de neve assentada
      const r = raioEsfera(y) * 0.975 * (1 + fbm3(Math.cos(a) * 3, y * 60, Math.sin(a) * 3, 2, 3) * 0.012 * v);
      out.set(Math.sin(a) * r, y, Math.cos(a) * r);
    },
    cor(_u, v) {
      const k = 0.78 + 0.22 * v;
      return [(cheio[0] * (1 - v) + neve[0] * v) * k, (cheio[1] * (1 - v) + neve[1] * v) * k, (cheio[2] * (1 - v) + neve[2] * v) * k];
    },
    acab: (_u, v) => [0, 0.82, 0, 0.05 * (1 - v * 0.5)],
  });

  // casinha: paredes vermelhas, telhado de duas águas nevado, janela acesa e porta
  const casa = new THREE.Vector3(0.012, yNeve + 0.015, -0.012);
  const parede = superelipsoide(casa.clone().add(new THREE.Vector3(0, 0.017, 0)), 0.024, 0.019, 0.018, 0.12);
  base.adicionar({ nu: div(q, 24, 12), nv: div(q, 12, 8), ponto: parede, cor: () => [0.45, 0.07, 0.06], acab: () => ACAB.acetinado });
  // telhado: prisma arredondado com neve em cima
  base.adicionar({
    nu: div(q, 16, 8),
    nv: 6,
    fechadoU: false,
    ponto(u, v, out) {
      // u atravessa o telhado de uma beirada à outra (passando pela cumeeira); v ao longo
      const x = (v - 0.5) * 0.06;
      const s = u * 2 - 1;
      const y = casa.y + 0.034 + (1 - Math.abs(s)) * 0.022 + 0.004 * (1 - s * s);
      out.set(casa.x + x, y, casa.z + s * 0.026);
    },
    cor: (u) => (Math.abs(u * 2 - 1) < 0.92 ? neve : [0.2, 0.06, 0.04]),
    acab: () => [0, 0.75, 0, 0],
    orientar: 1,
  });
  // janela acesa e porta
  const janela = superelipsoide(casa.clone().add(new THREE.Vector3(-0.009, 0.021, 0.0175)), 0.006, 0.0065, 0.0012, 0.2);
  base.adicionar({ nu: 10, nv: 6, ponto: janela, cor: () => [1.0, 0.62, 0.22], acab: () => [0, 0.5, 0, 1] });
  const porta = superelipsoide(casa.clone().add(new THREE.Vector3(0.01, 0.011, 0.0175)), 0.0055, 0.0095, 0.0012, 0.25);
  base.adicionar({ nu: 10, nv: 6, ponto: porta, cor: () => [0.12, 0.05, 0.03], acab: () => ACAB.acetinado });

  // pinheirinhos: camadas de saias serrilhadas com neve nas pontas
  const pinheiro = (c: THREE.Vector3, h: number, semente: number) => {
    const s = criarSorteio(semente);
    const camadas = 4;
    for (let k = 0; k < camadas; k++) {
      const y0 = c.y + (k / camadas) * h * 0.8;
      const r0 = (1 - k / camadas) * h * 0.38 + h * 0.06;
      const giro = s() * 6;
      base.adicionar({
        nu: div(q, 18, 10),
        nv: 3,
        ponto(u, v, out) {
          const a = u * Math.PI * 2 + giro;
          const dente = 1 + 0.18 * Math.abs(Math.sin(a * 4.5));
          const r = r0 * v * dente;
          out.set(c.x + Math.sin(a) * r, y0 + h * 0.34 * (1 - v) - v * v * h * 0.03, c.z + Math.cos(a) * r);
        },
        cor: (_u, v) => (v > 0.8 ? neve : [0.03, 0.11, 0.06]),
        acab: () => [0, 0.8, 0, 0],
        orientar: 1,
      });
    }
  };
  pinheiro(new THREE.Vector3(-0.045, yNeve + 0.008, 0.005), 0.065, 3);
  pinheiro(new THREE.Vector3(0.05, yNeve + 0.004, 0.025), 0.045, 4);

  // redoma de vidro
  const vidro = new Molde();
  vidro.adicionar({
    nu: div(q, 40, 20),
    nv: div(q, 22, 12),
    ponto(u, v, out) {
      // da linha do tampo da base até o topo
      const ph0 = Math.asin((BASE_ALTURA - CENTRO.y) / R);
      const ph = ph0 + v * (Math.PI / 2 - ph0);
      const a = u * Math.PI * 2;
      out.set(Math.sin(a) * Math.cos(ph) * R, CENTRO.y + Math.sin(ph) * R, Math.cos(a) * Math.cos(ph) * R);
    },
    cor: () => [1, 1, 1],
  });

  return {
    partes: [
      { nome: 'base', material: 'madeira', molde: base },
      { nome: 'vidro', material: 'vidro', molde: vidro, sombra: false, ordem: 2 },
    ],
    extras(mats, qq) {
      return [criarFlocos(mats.flocos, qq.nivel)];
    },
  };
};

const FLOCOS: Record<Level, number> = { alta: 140, media: 80, baixa: 40 };

/** Neve do globo: Points com posições calculadas de t (sem estado). */
function criarFlocos(material: THREE.PointsMaterial, nivel: Level): Extra {
  const n = FLOCOS[nivel];
  const s = criarSorteio(91);
  const raio = new Float32Array(n);
  const ang = new Float32Array(n);
  const vel = new Float32Array(n);
  const fase = new Float32Array(n);
  const giro = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    raio[i] = Math.sqrt(s()) * R * 0.85;
    ang[i] = s() * Math.PI * 2;
    vel[i] = 0.012 + s() * 0.012;
    fase[i] = s();
    giro[i] = (s() - 0.5) * 0.8;
  }
  const pos = new Float32Array(n * 3);
  const geo = new THREE.BufferGeometry();
  const atr = new THREE.BufferAttribute(pos, 3);
  atr.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', atr);
  geo.boundingSphere = new THREE.Sphere(CENTRO.clone(), R);
  const pontos = new THREE.Points(geo, material);
  pontos.name = 'globo-flocos';
  pontos.renderOrder = 1;
  const topo = CENTRO.y + R * 0.75;
  const fundo = CENTRO.y - R * 0.38;
  const altura = topo - fundo;
  const escala = new THREE.Vector3();
  const update = (_dt: number, t: number) => {
    // o floco tem ~6 mm no tamanho do modelo: acompanha a escala com que o presente aparece
    pontos.getWorldScale(escala);
    material.size = 0.006 * escala.x;
    for (let i = 0; i < n; i++) {
      // cai devagar e recomeça em cima; gira em volta do eixo com um balanço
      const f = (fase[i] + (t * vel[i]) / altura) % 1;
      const y = topo - f * altura;
      const a = ang[i] + t * giro[i] + Math.sin(t * 0.7 + i) * 0.3;
      // fica dentro da esfera
      const lim = Math.sqrt(Math.max(0, R * R * 0.85 - (y - CENTRO.y) ** 2));
      const r = Math.min(raio[i], lim);
      pos[i * 3] = Math.sin(a) * r;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = Math.cos(a) * r;
    }
    atr.needsUpdate = true;
  };
  update(0, 0);
  return {
    objeto: pontos,
    update,
    dispose() {
      geo.dispose();
    },
  };
}
