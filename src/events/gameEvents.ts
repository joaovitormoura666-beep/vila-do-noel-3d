import type { GameCommand, Participant, QueueResult, Settings } from '../../shared/types';
import { EventBus } from './EventBus';

export interface GameEvents extends Record<string, unknown> {
  /** Alguém pediu para entrar na fila (vindo do servidor, do teclado ou do modo demo). */
  participant: Participant;
  /** Resultado da tentativa de entrar na fila. */
  queueResult: { participant: Participant; result: QueueResult };
  command: GameCommand;
  settings: Settings;
  connection: { online: boolean };
  delivered: { participant: Participant; giftName: string };
}

export const bus = new EventBus<GameEvents>();
