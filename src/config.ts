/** Constantes de layout, cores e tempos do jogo. Ajuste aqui sem mexer na lógica. */

export const GAME_W = 1080;
export const GAME_H = 1920;

/** Paleta definida pela direção criativa. */
export const PALETTE = {
  red: '#B62835',
  redDark: '#8C1D28',
  redLight: '#D5434F',
  green: '#174D3B',
  greenLight: '#226B53',
  greenDark: '#0F3528',
  gold: '#E8BC65',
  goldLight: '#F7DC9B',
  goldDark: '#B98A36',
  snow: '#F7F4EF',
  snowShade: '#D5DFEC',
  snowBlue: '#B4C5DC',
  night: '#17253B',
  nightDeep: '#0D1626',
  nightLight: '#2A3E5F',
  wood: '#7B4A30',
  woodDark: '#573220',
  woodLight: '#9A6441',
  warm: '#FFD98A',
} as const;

export const hex = (c: string) => parseInt(c.slice(1), 16);

export const FONT = 'Fredoka, "Trebuchet MS", "Segoe UI", sans-serif';

/** Posições principais do cenário (pixels na tela 1080x1920). */
export const LAYOUT = {
  horizonY: 800,
  house: { x: 540, y: 842 },
  santa: { x: 668, y: 938 },
  sack: { x: 826, y: 950 },
  delivery: { x: 452, y: 958 },
  /** Onde o presente aparece grande na revelação. */
  reveal: { x: 476, y: 590 },
  /** Faixa "Fulano ganhou ..." (ocupa o lugar da instrução durante a revelação). */
  banner: { x: 540, y: 362 },
  title: { x: 540, y: 262 },
} as const;

/**
 * Caminho da fila: do ponto de entrada (fora da tela) até a área de entrega.
 * Para redesenhar a fila, basta alterar estes pontos.
 */
export const QUEUE_PATH: Array<[number, number]> = [
  [-160, 1650],
  [120, 1590],
  [400, 1548],
  [660, 1540],
  [860, 1496],
  [930, 1362],
  [806, 1262],
  [560, 1240],
  [330, 1226],
  [176, 1150],
  [196, 1040],
  [310, 986],
  [LAYOUT.delivery.x, LAYOUT.delivery.y],
];

/** Caminho de saída depois de receber o presente. */
export const EXIT_PATH: Array<[number, number]> = [
  [LAYOUT.delivery.x, LAYOUT.delivery.y],
  [570, 1012],
  [770, 1030],
  [970, 1020],
  [1240, 1000],
];

export const QUEUE = {
  /** Distância entre personagens na fila (px ao longo do caminho). */
  spacing: 165,
  /**
   * Distância do primeiro da fila até a área de entrega. É grande de propósito:
   * quem é chamado sobe sozinho até o Noel, e a entrega não disputa espaço com a fila.
   */
  frontGap: 400,
  walkSpeed: 250,
  exitSpeed: 270,
  spawnIntervalMs: 380,
} as const;

/** Escala dos personagens conforme a profundidade (efeito 2.5D). */
export function depthScale(y: number): number {
  const t = Math.min(1, Math.max(0, (y - 940) / (1620 - 940)));
  return 0.98 + t * 0.24;
}

export const DEPTH = {
  sky: -1000,
  stars: -990,
  moon: -985,
  farSnow: -950,
  ground: -900,
  groundFx: -890,
  nearSnow: 7000,
  foreground: 7500,
  /** Etiquetas de nome: sempre por cima dos personagens e das árvores da frente. */
  labels: 7600,
  /** Efeitos da entrega (caixa, presente, brilhos) e balão de fala: por cima do cenário e dos nomes. */
  fx: 7700,
  hud: 9000,
} as const;
