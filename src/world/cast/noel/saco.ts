/**
 * O SACO DE PRESENTES: juta (hessian, Poly Haven CC0), barrigudo e cheio, com as quinas dos presentes
 * marcando o pano, amarrado no pescoço com fita de veludo vermelho e laço, a boca franzida aberta e três
 * embrulhos aparecendo. Fica no piso, ao lado da poltrona, do lado esquerdo dele (+X).
 *
 * Coordenadas do próprio saco: origem no piso, no centro; a frente do laço olha para +Z.
 */
import * as THREE from 'three';
import { anel, mecha } from './aneis';
import { Acumulador, Caminho, type Cor } from './malha';
import { fbm3, misturar, sino, suave } from './util';

export interface PartesSaco {
  saco: Acumulador;
  papel: Acumulador;
  /** Fita e laço do pescoço (veludo). */
  veludo: Acumulador;
  /** Fitas dos presentes (dourado). */
  ouro: Acumulador;
  /** Centro da boca (coordenadas do saco). */
  boca: THREE.Vector3;
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const nada = () => [[0, 1]] as const;

/** Altura do pescoço (onde a fita amarra) e da borda da boca. */
const PESCOCO = 0.7;
const BORDA = 0.86;

export function esculpirSaco(): PartesSaco {
  const saco = new Acumulador();
  const papel = new Acumulador();
  const veludo = new Acumulador();
  const ouro = new Acumulador();

  // presentes dentro do pano: direções e força das quinas que marcam a juta
  const quinas = [V(0.7, 0.2, 0.6), V(-0.6, -0.1, 0.75), V(0.1, 0.4, -0.95), V(-0.8, 0.3, -0.4), V(0.9, -0.3, -0.2), V(0.2, -0.2, 1)].map((d) => d.normalize());
  // pano pesado: o fundo assenta no piso e se espalha (base larga e achatada), a barriga cai por cima
  const raioCorpo = (v: number) => {
    // v = 0 no fundo, 1 no pescoço
    if (v < 0.1) return 0.36 * Math.sin((v / 0.1) * Math.PI * 0.5);
    return misturar(0.38, 0.35, suave(0.1, 0.35, v)) * (1 - 0.6 * suave(0.45, 1, v)) + 0.03 * sino(v - 0.14, 0.06);
  };
  const alturaCorpo = (v: number) => (v < 0.1 ? 0.025 * (1 - Math.cos((v / 0.1) * Math.PI * 0.5)) : misturar(0.025, PESCOCO, Math.pow((v - 0.1) / 0.9, 1.1)));
  const dir = V(0, 0, 0);
  saco.adicionar({
    nu: 32,
    nv: 22,
    ponto(u, v, out) {
      const th = u * Math.PI * 2;
      let r = raioCorpo(v);
      const y = alturaCorpo(v);
      dir.set(Math.sin(th), (y - 0.35) / 0.5, Math.cos(th)).normalize();
      // calombos das caixas lá dentro + franzido que sobe para o pescoço
      let bossa = 0;
      for (const q of quinas) bossa += 0.055 * Math.pow(Math.max(0, dir.dot(q)), 6);
      const corpo = suave(0.08, 0.3, v) * (1 - suave(0.7, 0.95, v));
      r += r * (bossa * corpo + 0.05 * fbm3(dir.x * 2.2, dir.y * 2.2, dir.z * 2.2, 3, 7) * corpo);
      // dobras verticais do pano caindo (mais fundas embaixo, onde o peso amassa) e o franzido do pescoço
      const dobras = 0.014 * fbm3(Math.cos(th) * 3.5, Math.sin(th) * 3.5, v * 1.2, 2, 19) * suave(0.05, 0.4, v) * (1 - suave(0.6, 0.85, v));
      const rugas = 0.01 * Math.sin(th * 9 + 2 * fbm3(Math.cos(th), Math.sin(th), 3.3, 2, 23)) * sino(v - 0.13, 0.07);
      r += dobras + rugas + 0.012 * Math.sin(th * 13 + v * 3) * suave(0.62, 0.98, v);
      out.set(Math.sin(th) * r + 0.03 * v * v, y, Math.cos(th) * r);
    },
    pesos: () => nada(),
    cor: (u, v) => {
      // sombra no franzido, nas rugas do fundo e no pé (onde encosta no piso); pano mais claro na barriga
      const th = u * Math.PI * 2;
      const vinco = 0.12 * Math.max(0, -Math.sin(th * 13 + v * 3)) * suave(0.62, 0.98, v) + 0.1 * Math.max(0, -Math.sin(th * 9)) * sino(v - 0.13, 0.07);
      const k = 0.92 - vinco - 0.3 * (1 - suave(0, 0.16, v));
      return [k, k * 0.98, k * 0.95];
    },
  });
  // gola franzida da boca: abre do pescoço até a borda, com babados
  saco.adicionar({
    nu: 36,
    nv: 8,
    ponto(u, v, out) {
      const th = u * Math.PI * 2;
      const babado = 0.03 * Math.sin(th * 9 + 0.4) * v + 0.012 * Math.sin(th * 17) * v;
      const r = misturar(0.115, 0.215, Math.pow(v, 0.8)) + babado;
      const y = misturar(PESCOCO, BORDA, v) + 0.03 * Math.sin(th * 4 + 1) * v - 0.025 * v * v;
      out.set(Math.sin(th) * r + 0.03, y, Math.cos(th) * r);
    },
    pesos: () => nada(),
    cor: (_u, v) => {
      const k = 0.8 + 0.18 * v;
      return [k, k * 0.98, k * 0.95];
    },
  });
  // fundo escuro dentro da boca (ninguém vê o vazio)
  saco.adicionar({
    nu: 24,
    nv: 6,
    ponto(u, v, out) {
      const th = u * Math.PI * 2;
      const r = 0.15 * (1 - v);
      out.set(Math.sin(th) * r + 0.03, PESCOCO + 0.05 - 0.04 * v, Math.cos(th) * r);
    },
    pesos: () => nada(),
    cor: () => [0.18, 0.15, 0.12] as Cor,
    orientar: 1,
  });

  /* ----------------------------------------------------- fita de veludo e laço */
  const centroP = V(0.03, PESCOCO + 0.012, 0);
  veludo.adicionar({
    nu: 8,
    nv: 32,
    ponto: anel(
      (t, out) => {
        const th = t * Math.PI * 2;
        out.set(centroP.x + Math.sin(th) * 0.128, centroP.y + 0.008 * Math.sin(th * 3), centroP.z + Math.cos(th) * 0.128);
      },
      (t, _p, out) => out.set(Math.sin(t * Math.PI * 2), 0, Math.cos(t * Math.PI * 2)),
      () => [0.012, 0.028],
    ),
    pesos: () => nada(),
  });
  const n = V(0.03, PESCOCO + 0.01, 0.135);
  // duas alças e duas pontas do laço
  for (const lado of [1, -1]) {
    const alca = new Caminho([n.clone(), n.clone().add(V(lado * 0.06, 0.05, 0.03)), n.clone().add(V(lado * 0.12, 0.03, 0.02)), n.clone().add(V(lado * 0.08, -0.015, 0.035)), n.clone().add(V(lado * 0.01, 0, 0.01))], { amostras: 24 });
    veludo.adicionar({ nu: 8, nv: 14, ponto: mecha({ caminho: alca, raio: 0.032, achatar: 0.35, fora: V(0, 0, 1), afinar: 0.2, barriga: 0.5 }), pesos: () => nada() });
    const ponta = new Caminho([n.clone(), n.clone().add(V(lado * 0.03, -0.07, 0.03)), n.clone().add(V(lado * 0.05, -0.15, 0.06)), n.clone().add(V(lado * 0.07, -0.21, 0.09))], { amostras: 24 });
    veludo.adicionar({ nu: 8, nv: 12, ponto: mecha({ caminho: ponta, raio: 0.026, achatar: 0.3, fora: V(0, 0, 1), afinar: 0.1, barriga: 0.3 }), pesos: () => nada() });
  }
  veludo.adicionar({
    nu: 12,
    nv: 10,
    ponto: (u, v, out) => {
      const th = u * Math.PI * 2;
      const ph = v * Math.PI;
      out.set(Math.sin(ph) * Math.sin(th) * 0.028, Math.cos(ph) * 0.032, Math.sin(ph) * Math.cos(th) * 0.022).add(n).add(V(0, 0, 0.012));
    },
    pesos: () => nada(),
  });

  /* ---------------------------------------------------------- presentes na boca */
  const caixa = (centro: THREE.Vector3, meia: THREE.Vector3, rot: THREE.Euler, quadrante: [number, number]) => {
    const q = new THREE.Quaternion().setFromEuler(rot);
    const e = 0.14; // expoente da superelipse: quina arredondada
    const pot = (x: number) => Math.sign(x) * Math.pow(Math.abs(x), e);
    papel.adicionar({
      nu: 20,
      nv: 12,
      ponto(u, v, out) {
        const th = u * Math.PI * 2;
        const ph = v * Math.PI;
        out.set(pot(Math.sin(ph)) * pot(Math.sin(th)) * meia.x, pot(Math.cos(ph)) * meia.y, pot(Math.sin(ph)) * pot(Math.cos(th)) * meia.z);
        out.applyQuaternion(q).add(centro);
      },
      pesos: () => nada(),
      uv: (u, v) => [(quadrante[0] + 0.04 + 0.92 * ((u * 2) % 1)) / 2, (quadrante[1] + 0.04 + 0.92 * v) / 2],
      cor: () => [1, 1, 1],
    });
    // fita em cruz por cima, contornando a caixa
    for (const eixo of [0, 1]) {
      ouro.adicionar({
        nu: 4,
        nv: 20,
        ponto: anel(
          (t, out) => {
            const th = t * Math.PI * 2;
            const a = pot(Math.cos(th)) * 1.02;
            const b = pot(Math.sin(th)) * 1.02;
            if (eixo === 0) out.set(a * meia.x, b * meia.y, 0);
            else out.set(0, b * meia.y, a * meia.z);
            out.applyQuaternion(q).add(centro);
          },
          (_t, p, out) => out.subVectors(p, centro).normalize(),
          () => [0.004, 0.017],
        ),
        pesos: () => nada(),
      });
    }
    // laçinho no topo
    const topo = V(0, meia.y + 0.008, 0).applyQuaternion(q).add(centro);
    const cima = V(0, 1, 0).applyQuaternion(q);
    const lx = V(1, 0, 0).applyQuaternion(q);
    for (const lado of [1, -1]) {
      const alca = new Caminho([topo.clone(), topo.clone().addScaledVector(cima, 0.04).addScaledVector(lx, lado * 0.035), topo.clone().addScaledVector(cima, 0.02).addScaledVector(lx, lado * 0.07), topo.clone().addScaledVector(lx, lado * 0.01)], { amostras: 16 });
      ouro.adicionar({ nu: 6, nv: 8, ponto: mecha({ caminho: alca, raio: 0.022, achatar: 0.35, fora: cima, afinar: 0.2, barriga: 0.5 }), pesos: () => nada() });
    }
  };
  caixa(V(0.0, BORDA + 0.03, -0.03), V(0.11, 0.095, 0.1), new THREE.Euler(0.18, 0.5, -0.12), [0, 0]);
  caixa(V(0.11, BORDA - 0.01, 0.07), V(0.08, 0.075, 0.08), new THREE.Euler(-0.25, -0.3, -0.42), [1, 0]);
  caixa(V(-0.06, BORDA + 0.07, -0.11), V(0.06, 0.12, 0.06), new THREE.Euler(-0.32, 0.2, 0.22), [0, 1]);

  return { saco, papel, veludo, ouro, boca: V(0.03, BORDA + 0.02, 0) };
}
