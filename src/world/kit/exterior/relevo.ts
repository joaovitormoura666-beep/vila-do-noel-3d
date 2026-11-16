/**
 * Relevo e planta do diorama.
 *
 * Tudo é desenhado em "coordenadas de projeto": x para a direita de quem olha de dentro da sala e D = distância
 * à vidraça (o mundo fica em z = -D). Até D = 14 m é o jardim, em escala real. Dali em diante é o plano médio
 * (vale, vila na encosta em frente, crista), construído em perspectiva forçada: a vila tem 30% do tamanho
 * real, o que deixa o conjunto compacto (120 m de fundo) e com paralaxe visível quando a câmera balança.
 * A opção `profundidade` estica ou encolhe o plano médio e o fundo (fator k); o jardim não muda.
 */
import * as THREE from 'three';
import { curva, fbm, limitar, mistura, suave } from './util';

export const PROFUNDIDADE_PADRAO = 120;
export const LARGURA_PADRAO = 260;
/** Onde o jardim (escala real) dá lugar ao plano médio. */
const FIM_JARDIM = 14;
/** Escala da vila em relação ao tamanho real (perspectiva forçada). */
export const ESCALA_VILA = 0.3;
const EIXO_Y = new THREE.Vector3(0, 1, 0);

/** Perfil do terreno ao longo de D, no eixo da janela. */
const PERFIL: ReadonlyArray<readonly [number, number]> = [
  [0, 0.16],
  [3, 0.12],
  [6.5, 0.04],
  [10, -0.62],
  [13, -1.02],
  [18, -1.6],
  [25.5, -1.85],
  [29, -1.4],
  [36, 0.4],
  [43, 2.2],
  [50, 4.0],
  [58, 6.2],
  [66, 8.0],
  [72, 8.4],
  [78, 7.0],
  [88, 4.0],
];

/** Caminho que sai do portão do jardim, cruza a ponte e sobe em S pela vila até a igreja. [x, D] */
export const ESTRADA: ReadonlyArray<readonly [number, number]> = [
  [0.9, 7.2],
  [1.1, 10.4],
  [2.0, 15],
  [3.1, 20.5],
  [3.4, 25.5],
  [2.4, 29],
  [-0.6, 31.4],
  [-3.6, 33.2],
  [-4.8, 35.6],
  [-3.4, 38],
  [0.2, 39.6],
  [3.4, 41],
  [5.2, 43.4],
  [4.6, 46.6],
  [1.6, 48.6],
  [-1.2, 49.6],
];

/** Linha do riacho congelado no fundo do vale. */
export const riachoD = (x: number) => 25.6 + 2.2 * Math.sin(x * 0.075 + 0.4) + 0.9 * Math.sin(x * 0.21 + 2.0);

export interface Plato {
  x: number;
  D: number;
  raio: number;
}

export class Relevo {
  /** Fator de escala do plano médio e do fundo (1 = profundidade padrão). */
  readonly k: number;
  readonly profundidade: number;
  readonly largura: number;
  /** Altura da neve encostada na parede da casa, junto do vidro (m). */
  readonly neveParede: number;
  /** Azimute da vista (radianos, positivo = para a direita): tudo além do jardim gira para ficar no eixo de quem olha. */
  readonly azimute: number;
  private readonly plato: Array<Plato & { y: number }> = [];

  constructor(profundidade = PROFUNDIDADE_PADRAO, largura = LARGURA_PADRAO, neveParede = 0.36, azimuteGraus = 0) {
    this.neveParede = limitar(neveParede, 0, 1.2);
    this.azimute = (limitar(azimuteGraus, -70, 70) * Math.PI) / 180;
    this.profundidade = limitar(profundidade, 60, 280);
    this.largura = limitar(largura, 80, 520);
    this.k = (this.profundidade - FIM_JARDIM) / (PROFUNDIDADE_PADRAO - FIM_JARDIM);
  }

  /** Assenta o terreno em volta de uma construção (para a casa não ficar meio enterrada, meio no ar). */
  aplainar(p: Plato): number {
    const y = this.alturaBase(p.x, p.D);
    this.plato.push({ ...p, y });
    return y;
  }

  /** Distância (em planta, coordenadas de projeto) ao eixo do caminho. */
  distEstrada(x: number, D: number): number {
    let melhor = 1e9;
    for (let i = 0; i < ESTRADA.length - 1; i++) {
      const ax = ESTRADA[i][0];
      const ad = ESTRADA[i][1];
      const bx = ESTRADA[i + 1][0] - ax;
      const bd = ESTRADA[i + 1][1] - ad;
      const t = limitar(((x - ax) * bx + (D - ad) * bd) / (bx * bx + bd * bd), 0, 1);
      const d = Math.hypot(x - ax - bx * t, D - ad - bd * t);
      if (d < melhor) melhor = d;
    }
    return melhor;
  }

  private alturaBase(x: number, D: number): number {
    const ax = Math.abs(x);
    const medio = suave(12, 30, D);
    // o perfil avança e recua conforme x: a encosta não é um plano inclinado
    let y = curva(PERFIL, D + (fbm(x * 0.021 + 7, 3.1, 3) - 0.5) * 9 * medio);
    // morros dos lados (fecham a vista em ângulo) e ondulação larga do plano médio
    y += 6.5 * suave(28, 100, ax) * suave(9, 36, D);
    y += (fbm(x * 0.045 + 3, D * 0.045 + 9, 4) - 0.5) * 3.4 * suave(16, 44, D);
    y += (fbm(x * 0.24 + 1, D * 0.24 + 4, 3) - 0.5) * 0.55 * suave(14, 26, D);
    // jardim: neve fofa em montes largos e ondas miúdas; neve encostada na casa
    const perto = 1 - suave(10, 20, D);
    y += perto * ((fbm(x * 0.42 + 11, D * 0.42 + 2, 3) - 0.5) * 0.4 + (fbm(x * 1.6, D * 1.6 + 5, 2) - 0.5) * 0.08);
    // montes soprados pelo vento: compridos de lado, curtos em profundidade (a luz rasante da lua desenha as cristas)
    const duna = fbm(x * 0.55 + D * 0.16 + 21, D * 1.35 - x * 0.1 + 8, 2);
    y += perto * suave(1.2, 3.5, D) * (Math.pow(duna, 2.2) * 0.5 - 0.1);
    y += (this.neveParede - 0.16) * Math.exp(-Math.max(D, 0) / 0.9);
    // leito do riacho
    const dr = Math.abs(D - riachoD(x));
    y -= 0.5 * (1 - suave(0.5, 2.2, dr)) * (1 - suave(34, 60, ax));
    return y;
  }

  /** Altura do terreno em coordenadas de projeto (antes da escala do plano médio). */
  alturaProjeto(x: number, D: number): number {
    let y = this.alturaBase(x, D);
    for (const p of this.plato) {
      const d = Math.hypot(x - p.x, D - p.D);
      if (d < p.raio * 1.7) y = mistura(p.y, y, suave(p.raio * 0.75, p.raio * 1.7, d));
    }
    // caminho: levemente rebaixado e sem ondas miúdas
    const de = this.distEstrada(x, D);
    y -= 0.06 * (1 - suave(0.4, 1.1, de));
    return y;
  }

  /** Escala do mundo em D: 1 no jardim, k (vezes o que for) no plano médio. */
  escala(D: number): number {
    return mistura(1, this.k, suave(10, 18, D));
  }

  /** Distância de projeto -> distância real à vidraça. */
  dMundo(D: number): number {
    return D <= FIM_JARDIM ? D : FIM_JARDIM + (D - FIM_JARDIM) * this.k;
  }

  /**
   * Giro em Y (radianos) aplicado ao que está na distância de projeto D: zero no jardim (que fica colado à parede),
   * o azimute inteiro da vista do vale em diante. Com azimute 0 nada gira.
   */
  giro(D: number): number {
    return -this.azimute * suave(8, 18, D);
  }

  /** Leva um ponto "de projeto já em metros" (x * escala, y, -dMundo) para o espaço da peça, aplicando o giro. */
  girar(p: THREE.Vector3, D: number): THREE.Vector3 {
    const g = this.giro(D);
    if (g === 0) return p;
    const c = Math.cos(g);
    const s = Math.sin(g);
    const x = p.x * c + p.z * s;
    const z = -p.x * s + p.z * c;
    return p.set(x, p.y, z);
  }

  /** Direção do espaço da peça de volta para o espaço de projeto (desfaz o giro em D). */
  desgirarDir(v: THREE.Vector3, D: number): THREE.Vector3 {
    return v.applyAxisAngle(EIXO_Y, -this.giro(D));
  }

  /** Ponto do chão no espaço da peça (x, y, z) a partir das coordenadas de projeto. */
  chao(x: number, D: number, out = new THREE.Vector3()): THREE.Vector3 {
    const s = this.escala(D);
    return this.girar(out.set(x * s, this.alturaProjeto(x, D) * s, -this.dMundo(D)), D);
  }

  /** Matriz de uma construção em (x, D) de projeto: altura y já no mundo, giro em Y de projeto e escala. */
  posicionar(x: number, D: number, y: number, rot: number, escala: number): THREE.Matrix4 {
    const p = this.girar(new THREE.Vector3(x * this.escala(D), y, -this.dMundo(D)), D);
    return new THREE.Matrix4().compose(p, new THREE.Quaternion().setFromAxisAngle(EIXO_Y, rot + this.giro(D)), new THREE.Vector3(escala, escala, escala));
  }

  /** Inverso de `chao`: coordenadas de projeto [x, D] de um ponto do espaço da peça. */
  projetoDe(p: THREE.Vector3): [number, number] {
    // o giro depende de D, que depende do giro: três passos bastam (o giro varia devagar com D)
    let D = -p.z;
    const q = new THREE.Vector3();
    for (let i = 0; i < 3; i++) {
      q.copy(p).applyAxisAngle(EIXO_Y, -this.giro(D));
      const dm = -q.z;
      D = dm <= FIM_JARDIM ? dm : FIM_JARDIM + (dm - FIM_JARDIM) / this.k;
    }
    return [q.x / this.escala(D), D];
  }

  /** Escala das construções da vila neste ponto. */
  escalaVila(D: number): number {
    return ESCALA_VILA * this.escala(D);
  }

  /** Raio (no mundo) de um círculo de projeto de raio r, com centro no eixo da janela. */
  raio(r: number): number {
    return this.dMundo(r);
  }
}
