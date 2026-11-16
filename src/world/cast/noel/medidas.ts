/**
 * MEDIDAS DO NOEL: os números de proporção, de encaixe na poltrona e de animação em um só lugar.
 *
 * Coordenadas locais da raiz do Noel (metros): origem no piso, no centro da poltrona; +Z é a frente da
 * poltrona (para onde ele olha); +X é a ESQUERDA dele (a direita de quem olha de frente), o lado do saco
 * e de onde o visitante chega. Ele é modelado já SENTADO: o assento define a altura do quadril, a borda
 * da frente define onde ficam os joelhos e o encosto define onde as costas encostam.
 */
import { ASSENTO_DO_NOEL } from '../../set-a/ancoras';

/** O assento em que ele senta (medido no GLB da ArmChair_01 em escala 1,5 pela sala A). */
export interface Assento {
  /** Altura do tampo do assento ao piso. */
  altura: number;
  /** Borda da frente do assento (z local). */
  frente: number;
  /** Face do encosto na altura das costas (z local). */
  encosto: number;
  /** Metade da largura livre entre os braços da poltrona. */
  meioVao: number;
  /** Altura do topo dos braços da poltrona (na frente). */
  alturaBraco: number;
}

/** Valores padrão (ArmChair_01 em escala 1,5), usados se a sala não informar. */
const PADRAO: Assento = { altura: 0.75, frente: 0.495, encosto: -0.48, meioVao: 0.465, alturaBraco: 0.99 };

function lerAssento(): Assento {
  const a = ASSENTO_DO_NOEL as Partial<{ alturaAssento: number; profundidadeAssento: number; larguraEntreBracos: number; alturaBraco: number }> | undefined;
  if (!a || !Number.isFinite(a.alturaAssento) || !Number.isFinite(a.profundidadeAssento)) return PADRAO;
  // a sala mede o assento a partir do centro da poltrona: frente = +0,33 e encosto = -0,32 (escala 1);
  // reparte a profundidade na mesma proporção
  const prof = a.profundidadeAssento as number;
  return {
    altura: a.alturaAssento as number,
    frente: prof * (0.33 / 0.65),
    encosto: -prof * (0.32 / 0.65),
    meioVao: (a.larguraEntreBracos ?? PADRAO.meioVao * 2) / 2,
    alturaBraco: a.alturaBraco ?? PADRAO.alturaBraco,
  };
}

export const ASSENTO: Assento = lerAssento();

/** Quanto o corpo sobe ou desce em relação ao assento padrão (0,75): tudo que é do tronco acompanha. */
export const DY = ASSENTO.altura - 0.75;

/** Proporções do corpo (no assento padrão; DY desloca o tronco inteiro). */
export const CORPO = {
  /** Linha do cinto. */
  cinto: 1.13 + DY,
  alturaCinto: 0.105,
  /** Centro da cabeça e raios (x, y, z). */
  cabeca: { x: 0, y: 1.84 + DY, z: -0.1, rx: 0.235, ry: 0.245, rz: 0.225 },
  /** Ombro (encaixe do braço), metade da largura. */
  ombro: { x: 0.3, y: 1.47 + DY, z: -0.16 },
  /** Comprimentos do braço (ombro-cotovelo, cotovelo-pulso). */
  braco: 0.335,
  antebraco: 0.31,
  /** Quadril (encaixe da coxa). */
  quadril: { x: 0.215, y: 0.915 + DY, z: -0.1 },
  /** Raio da coxa e da canela. */
  coxa: 0.178,
  canela: 0.14,
  /** Afastamento dos pés (metade). */
  pe: 0.215,
  /**
   * Do joelho à sola da bota (m). Na referência a perna é curta e atarracada (canela + bota ≈ 0,42 m):
   * como o assento é alto (0,75 m), as botas descansam num pufe de veludo diante da poltrona.
   */
  joelhoASola: 0.42,
};

/** Altura do joelho (sentado) ao piso. */
export const JOELHO_Y = 0.86 + DY;

/**
 * O PUFE onde ele apoia as botas (veludo verde-pinheiro capitonê, pés dourados). A altura sai do assento:
 * joelho menos `CORPO.joelhoASola`, então se a sala mudar a altura do assento o pufe acompanha.
 */
export const PUFE = {
  altura: JOELHO_Y - CORPO.joelhoASola,
  /** Centro (z local) e meias medidas. */
  z: 0.76,
  rx: 0.41,
  rz: 0.25,
  cor: '#1d4a3a',
  brilho: '#7fc8a4',
};

/** Cores-base (sRGB) dos materiais, conferidas na referência do dono. */
export const CORES = {
  /** Carmim profundo: a sombra vai quase a vinho; o brilho do veludo fica só nas bordas (sheen). */
  veludo: '#7a0912',
  veludoBrilho: '#e85466',
  pelo: '#f4efe6',
  /** Mechas da barba, do bigode e das sobrancelhas: um pouco mais claras que a pelúcia. */
  barba: '#f6f2ea',
  pele: '#f4bfa0',
  bochecha: '#e8656a',
  nariz: '#f07a78',
  luva: '#e9e3db',
  /** Botas de couro marrom muito escuro, acetinado; sola mais escura. */
  bota: '#2b1a12',
  sola: '#140c08',
  /** Cinto cinza-carvão acetinado. */
  cinto: '#2e2b2a',
  ouro: '#d9a94e',
  olho: '#2a1610',
  iris: '#6b3d1c',
  saco: '#b08a5e',
};

/** Onde fica o saco de presentes (local), do lado esquerdo dele (+X), no piso, ao lado da poltrona. */
export const SACO = { x: 0.97, z: 0.5, giro: -0.85, inclinacao: 0.1 };

/**
 * Onde o visitante atendido fica, visto pelo Noel (sala A: âncora delivery a 1,85 m, 0,59 rad para a
 * esquerda dele, além do saco; veja LUGAR em src/world/set-a/ajustes.ts). O give estende os braços para lá e
 * o olhar procura o rosto do visitante. (Jogo 3D: a entrega foi para a direita para o visitante ficar de perfil,
 * sem se esconder atrás da poltrona.)
 */
export const VISITANTE = { direcao: 0.59, distancia: 1.85, alturaRosto: 1.0 };

/** Animação: velocidades e amplitudes (ajuste aqui). */
export const ANIMA = {
  respiracao: { freq: 0.23, amp: 0.012 },
  piscadaACada: 3.7,
  /** Pálpebra de cima em repouso (rad): cobre a borda de cima do olho, olhar calmo e simpático. */
  palpebraRepouso: 0.12,
  /** Limites do giro dos olhos (rad) e intervalo médio das micro-sacadas (s). */
  olhar: { yaw: 0.4, pitch: 0.3, sacada: 1.1 },
  /** Mola do pompom: rigidez e amortecimento. */
  mola: { k: 38, c: 5.5, ganho: 0.9 },
  /** Velocidade da mistura das poses (o jogo já anima os números; isto só suaviza degraus). */
  aceno: { freq: 1.6, amp: 0.32 },
  fala: { freq: 2.6 },
  riso: { freq: 2.4, amp: 0.02 },
};
