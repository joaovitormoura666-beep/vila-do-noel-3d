/**
 * Eventos ambientais: animações especiais do cenário (árvore, lareira, trenó, noite mágica)
 * acionadas por eventos da live ou pelo painel. São independentes da fila do Papai Noel.
 * Tipos compartilhados entre servidor, painel e jogo.
 */

export const AMBIENT_EFFECTS = ['TREE_SPARKLE', 'FIREPLACE_MAGIC', 'SLEIGH_PASS', 'MAGICAL_NIGHT'] as const;
export type AmbientEffectId = (typeof AMBIENT_EFFECTS)[number];

/** Nome de cada efeito para o painel. */
export const AMBIENT_LABELS: Record<AmbientEffectId, string> = {
  TREE_SPARKLE: 'Árvore cintilante',
  FIREPLACE_MAGIC: 'Lareira mágica',
  SLEIGH_PASS: 'Trenó no céu',
  MAGICAL_NIGHT: 'Noite mágica (aurora)',
};

export interface AmbientEffectConfig {
  enabled: boolean;
  /** Duração padrão, em segundos. */
  durationSec: number;
  /** Maior número = mais importante. Decide quem toca primeiro e quem cede lugar. */
  priority: number;
  /** Descanso mínimo, em segundos, entre o fim de uma execução e o começo da próxima do mesmo efeito. */
  cooldownSec: number;
}

export interface AmbientConfig {
  effects: Record<AmbientEffectId, AmbientEffectConfig>;
  /** Quantos efeitos podem tocar ao mesmo tempo. */
  maxSimultaneous: number;
  /** Quantos pedidos podem esperar a vez. Acima disso, os novos são descartados. */
  maxQueued: number;
}

export const DEFAULT_AMBIENT: AmbientConfig = {
  effects: {
    TREE_SPARKLE: { enabled: true, durationSec: 6, priority: 1, cooldownSec: 4 },
    FIREPLACE_MAGIC: { enabled: true, durationSec: 8, priority: 2, cooldownSec: 6 },
    SLEIGH_PASS: { enabled: true, durationSec: 9, priority: 3, cooldownSec: 20 },
    MAGICAL_NIGHT: { enabled: true, durationSec: 16, priority: 4, cooldownSec: 30 },
  },
  maxSimultaneous: 2,
  maxQueued: 6,
};

/** Pedido para tocar um efeito. */
export interface AmbientRequest {
  effect: AmbientEffectId;
  /** Sem valor, usa a duração configurada. */
  durationSec?: number;
  /** Sem valor, usa a prioridade configurada. */
  priority?: number;
  /** De onde veio: 'painel', 'simulador', 'webhook', 'tiktok'... */
  source?: string;
}

export type AmbientResult = 'iniciado' | 'na_fila' | 'prolongado' | 'descartado' | 'desligado';

/** Estado de um efeito em um instante, entregue ao cenário a cada quadro. */
export interface AmbientState {
  /** Andamento de 0 a 1 ao longo da duração (0 quando parado). */
  progress: number;
  /** Força de 0 a 1, já com entrada e saída suaves (0 = desligado). */
  intensity: number;
}

export interface AmbientSnapshot {
  active: Array<{ effect: AmbientEffectId; remainingSec: number; source?: string }>;
  queued: AmbientEffectId[];
  /** Pedidos descartados pela proteção desde o início. */
  dropped: number;
}

export function isAmbientEffect(value: unknown): value is AmbientEffectId {
  return typeof value === 'string' && (AMBIENT_EFFECTS as readonly string[]).includes(value);
}
