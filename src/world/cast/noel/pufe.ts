/**
 * O PUFE: banquinho de veludo verde-pinheiro capitonê, com vivo em volta do tampo e quatro pés de bola
 * dourados, diante da poltrona. É onde o Noel apoia as botas: assim as pernas ficam curtas e atarracadas
 * como na referência, mesmo com o assento alto da poltrona (0,75 m). A altura sai de PUFE.altura
 * (joelho menos `CORPO.joelhoASola`), que acompanha a altura do assento.
 *
 * Coordenadas locais do Noel (origem no piso, no centro da poltrona; +Z para a frente).
 */
import * as THREE from 'three';
import { anel } from './aneis';
import { Acumulador, elipsoide, type Cor } from './malha';
import { PUFE } from './medidas';
import { fbm3, misturar, sino, suave } from './util';

export interface PartesPufe {
  /** Corpo de veludo (com o vivo). */
  veludo: Acumulador;
  /** Pés de bola dourados. */
  ouro: Acumulador;
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const nada = () => [[0, 1]] as const;

/** Contorno do pufe (superelipse: retângulo de cantos bem redondos), em θ. */
function contorno(th: number, encolhe: number, out: THREE.Vector3) {
  const e = 2 / 2.8;
  const s = Math.sin(th);
  const c = Math.cos(th);
  out.set(Math.sign(s) * Math.pow(Math.abs(s), e) * (PUFE.rx - encolhe), 0, Math.sign(c) * Math.pow(Math.abs(c), e) * (PUFE.rz - encolhe));
  return out;
}

export function esculpirPufe(): PartesPufe {
  const veludo = new Acumulador();
  const ouro = new Acumulador();
  const H = PUFE.altura;
  const PES = 0.035;
  const cz = PUFE.z;
  const R = 0.07; // raio do arredondado da borda do tampo
  // botões do capitonê (no tampo, coordenadas relativas ao centro)
  const botoes: Array<[number, number]> = [[0, 0]];
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
    botoes.push([Math.sin(a) * (PUFE.rx - 0.17), Math.cos(a) * (PUFE.rz - 0.12)]);
  }
  const capitone = (x: number, z: number) => {
    let d = 0;
    let b = 0;
    for (const [bx, bz] of botoes) {
      const r2 = (x - bx) * (x - bx) + (z - bz) * (z - bz);
      d += Math.exp(-r2 / (0.05 * 0.05));
      b += Math.exp(-r2 / (0.012 * 0.012));
    }
    return { fundo: d, botao: b };
  };
  const q = V(0, 0, 0);
  veludo.adicionar({
    nu: 40,
    nv: 20,
    ponto(u, v, out) {
      const th = u * Math.PI * 2;
      // v: 0 fundo (centro) → 0,08 borda de baixo → lado → 0,55 começo do arredondado de cima → 1 centro do tampo
      let y: number;
      let encolhe: number;
      let escala = 1;
      if (v < 0.08) {
        encolhe = 0.02;
        escala = v / 0.08;
        y = PES;
      } else if (v < 0.5) {
        const t = (v - 0.08) / 0.42;
        // lado estufado (almofada), recolhido embaixo
        encolhe = 0.02 * (1 - suave(0, 0.2, t)) - 0.018 * Math.sin(Math.PI * t);
        y = misturar(PES, H - R, t);
      } else if (v < 0.7) {
        const ph = ((v - 0.5) / 0.2) * Math.PI * 0.5;
        encolhe = R - R * Math.cos(ph);
        y = H - R + R * Math.sin(ph);
      } else {
        const t = (v - 0.7) / 0.3;
        encolhe = R;
        escala = 1 - t;
        y = H;
      }
      contorno(th, encolhe, q);
      const x = q.x * escala;
      const z = q.z * escala;
      if (v >= 0.6) {
        // tampo levemente abaulado e capitonê (fundos com botão no meio)
        const dome = 0.022 * (1 - Math.pow(Math.min(1, Math.hypot(x / PUFE.rx, z / PUFE.rz)), 2));
        const { fundo, botao } = capitone(x, z);
        y += dome * suave(0.6, 0.75, v) - 0.016 * fundo + 0.007 * botao;
      }
      // franzido do tecido no lado
      const pregas = 0.004 * Math.sin(th * 18) * sino(v - 0.3, 0.15);
      out.set(x * (1 + pregas), y, cz + z * (1 + pregas));
    },
    pesos: () => nada(),
    cor: (_u, v, p) => {
      const { fundo } = capitone(p.x, p.z - cz);
      const k = 0.95 + 0.06 * fbm3(p.x * 8, p.y * 8, p.z * 8, 2, 9) - 0.35 * Math.min(1, fundo) * suave(0.6, 0.75, v) - 0.25 * (1 - suave(0.08, 0.2, v));
      return [k, k, k] as Cor;
    },
  });
  // vivo (cordão) em volta do tampo
  veludo.adicionar({
    nu: 6,
    nv: 48,
    ponto: anel(
      (t, out) => {
        contorno(t * Math.PI * 2, 0.012, out);
        out.y = H - R * 0.55;
        out.z += cz;
      },
      (t, _p, out) => {
        contorno(t * Math.PI * 2, 0, out);
        out.normalize().setY(0.6).normalize();
      },
      () => [0.012, 0.012],
    ),
    pesos: () => nada(),
    cor: () => [0.75, 0.75, 0.75] as Cor,
  });
  // pés de bola dourados
  for (const [sx, sz] of [
    [1, 1],
    [-1, 1],
    [1, -1],
    [-1, -1],
  ]) {
    ouro.adicionar({
      nu: 8,
      nv: 6,
      // pé de bola achatado, recolhido sob a borda (não uma bolinha solta no chão)
      ponto: elipsoide(V(sx * (PUFE.rx - 0.12), PES * 0.55, cz + sz * (PUFE.rz - 0.1)), V(0.04, PES * 0.6, 0.04)),
      pesos: () => nada(),
    });
  }
  return { veludo, ouro };
}
