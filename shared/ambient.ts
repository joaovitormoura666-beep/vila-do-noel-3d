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
  /**
   * Pedido feito à mão (botão do painel, da demonstração ou do console): passa por cima do
   * descanso do efeito. Quem aperta o botão espera ver o efeito; os presentes da live continuam
   * respeitando o descanso. O limite de efeitos ao mesmo tempo continua valendo (fica na espera).
   */
  force?: boolean;
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

/* ---------- presente da live → efeito ambiente ---------- */

/**
 * Regra que decide qual presente da live dispara qual efeito ambiente.
 *
 * ATENÇÃO: a escolha de qual presente dispara qual efeito é decisão criativa do dono e da
 * direção criativa. O padrão abaixo (DEFAULT_AMBIENT_GIFTS) é PROVISÓRIO, só para a primeira
 * live funcionar; tudo pode ser mudado no painel ("Efeitos pela live").
 *
 * Como a regra é aplicada a um presente (já no fim do combo):
 * 1. o nome está em `onlyQueue` → nenhum efeito (a pessoa só entra na fila);
 * 2. o nome está na lista `names` de um efeito → esse efeito (com dois, vale o mais importante);
 * 3. o valor do envio (moedas por unidade x quantidade) alcança o `minCoins` de algum efeito →
 *    o efeito com o maior `minCoins` alcançado;
 * 4. senão, nenhum efeito.
 * O jogo ainda aplica a prioridade, o descanso e a proteção contra excesso do AmbientDirector.
 */
export interface AmbientGiftRule {
  enabled: boolean;
  effects: Record<AmbientEffectId, { minCoins: number; names: string[] }>;
  onlyQueue: string[];
}

/** PADRÃO PROVISÓRIO (a confirmar com o dono): a rosa só põe na fila; presentes maiores acendem a sala. */
export const DEFAULT_AMBIENT_GIFTS: AmbientGiftRule = {
  enabled: true,
  effects: {
    TREE_SPARKLE: { minCoins: 5, names: [] },
    FIREPLACE_MAGIC: { minCoins: 30, names: [] },
    SLEIGH_PASS: { minCoins: 100, names: [] },
    MAGICAL_NIGHT: { minCoins: 500, names: [] },
  },
  onlyQueue: ['rosa', 'rose'],
};

/** Nome de presente para comparar: minúsculas, sem acento, espaços simples. */
export function normalizeGiftName(name: unknown): string {
  return String(name ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanNameList(v: unknown, fallback: string[]): string[] {
  const list = Array.isArray(v) ? v : typeof v === 'string' ? v.split(',') : fallback;
  const out: string[] = [];
  for (const item of list) {
    const n = normalizeGiftName(item).slice(0, 40);
    if (n && !out.includes(n)) out.push(n);
    if (out.length >= 30) break;
  }
  return out;
}

/** Confere uma regra vinda do painel ou do arquivo e preenche o que faltar com `base`. */
export function sanitizeAmbientGiftRule(input: unknown, base: AmbientGiftRule = DEFAULT_AMBIENT_GIFTS): AmbientGiftRule {
  const src = input && typeof input === 'object' ? (input as Partial<AmbientGiftRule>) : {};
  const effectsIn = src.effects && typeof src.effects === 'object' ? src.effects : ({} as Partial<AmbientGiftRule['effects']>);
  const effects = {} as AmbientGiftRule['effects'];
  for (const id of AMBIENT_EFFECTS) {
    const b = base.effects[id];
    const e = (effectsIn as Partial<AmbientGiftRule['effects']>)[id];
    const coins = Number(e?.minCoins ?? b.minCoins);
    effects[id] = {
      minCoins: Number.isFinite(coins) ? Math.round(Math.min(1_000_000, Math.max(0, coins))) : b.minCoins,
      names: cleanNameList(e?.names, b.names),
    };
  }
  return {
    enabled: src.enabled === undefined ? base.enabled : Boolean(src.enabled),
    effects,
    onlyQueue: cleanNameList(src.onlyQueue, base.onlyQueue),
  };
}

export interface GiftForEffect {
  giftName?: string;
  /** Moedas por unidade (no TikTok, diamondCount). */
  diamondCount?: number;
  /** Quantidade no envio (combo). */
  giftCount?: number;
}

export interface GiftEffectMatch {
  effect: AmbientEffectId;
  /** Por que este efeito: pelo nome do presente ou pelo valor em moedas. */
  reason: 'nome' | 'moedas';
  /** Valor total do envio em moedas, quando conhecido. */
  coins?: number;
}

/** Aplica a regra a um presente. Devolve null quando ele não dispara efeito. */
export function giftToAmbientEffect(gift: GiftForEffect, rule: AmbientGiftRule): GiftEffectMatch | null {
  if (!rule.enabled) return null;
  const name = normalizeGiftName(gift.giftName);
  const unit = Number(gift.diamondCount);
  const count = Math.max(1, Math.round(Number(gift.giftCount) || 1));
  const coins = Number.isFinite(unit) && unit > 0 ? unit * count : undefined;
  if (name && rule.onlyQueue.includes(name)) return null;
  if (name) {
    // AMBIENT_EFFECTS vai do menos ao mais importante: o último que bater vence
    let byName: AmbientEffectId | null = null;
    for (const id of AMBIENT_EFFECTS) if (rule.effects[id].names.includes(name)) byName = id;
    if (byName) return { effect: byName, reason: 'nome', coins };
  }
  if (coins === undefined) return null;
  let best: AmbientEffectId | null = null;
  let bestMin = 0;
  for (const id of AMBIENT_EFFECTS) {
    const min = rule.effects[id].minCoins;
    if (min > 0 && coins >= min && min >= bestMin) {
      best = id;
      bestMin = min;
    }
  }
  return best ? { effect: best, reason: 'moedas', coins } : null;
}
