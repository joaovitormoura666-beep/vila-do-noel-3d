import type { LiveEvent } from '../../shared/types.js';

/**
 * Contrato que qualquer fonte de eventos ao vivo precisa cumprir.
 *
 * O jogo nunca fala diretamente com o TikTok: ele só recebe `LiveEvent`
 * já normalizados do EventHub. Para ligar uma fonte nova (ex.: TikTok,
 * TikFinity, Streamer.bot), basta implementar esta interface e registrá-la
 * em server/app.ts (onde o simulador é ligado).
 */
export interface LiveSource {
  readonly name: string;
  start(emit: (ev: LiveEvent) => void): Promise<void> | void;
  stop(): Promise<void> | void;
}
