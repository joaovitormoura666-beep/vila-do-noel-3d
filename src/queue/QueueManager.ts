import type { Participant, QueueResult } from '../../shared/types';

export interface QueueEntry {
  participant: Participant;
  state: 'aguardando' | 'atendendo';
  joinedAt: number;
}

export interface QueueOptions {
  maxQueue: number;
  rejoinCooldownSec: number;
}

/**
 * Fila lógica do jogo (sem nada de desenho).
 * Regras: uma pessoa só ocupa um lugar por vez, a fila tem tamanho máximo
 * e a ordem é sempre de chegada.
 */
export class QueueManager {
  private entries: QueueEntry[] = [];
  private servedAt = new Map<string, number>();
  private servedCount = 0;
  private options: QueueOptions;

  constructor(options: QueueOptions) {
    this.options = { ...options };
  }

  setOptions(options: Partial<QueueOptions>) {
    this.options = { ...this.options, ...options };
  }

  enqueue(p: Participant, now = Date.now()): QueueResult {
    if (this.entries.some((e) => e.participant.userId === p.userId)) return 'duplicado';
    const last = this.servedAt.get(p.userId);
    if (last !== undefined && this.options.rejoinCooldownSec > 0 && now - last < this.options.rejoinCooldownSec * 1000) {
      return 'aguardando_intervalo';
    }
    if (this.entries.length >= this.options.maxQueue) return 'fila_cheia';
    this.entries.push({ participant: p, state: 'aguardando', joinedAt: now });
    return 'aceito';
  }

  /** Quem está sendo atendido agora. */
  current(): QueueEntry | undefined {
    return this.entries.find((e) => e.state === 'atendendo');
  }

  /** Pessoas aguardando, em ordem. */
  waiting(): QueueEntry[] {
    return this.entries.filter((e) => e.state === 'aguardando');
  }

  /** Marca o primeiro da fila como "em atendimento". */
  startNext(): QueueEntry | undefined {
    if (this.current()) return undefined;
    const next = this.entries.find((e) => e.state === 'aguardando');
    if (next) next.state = 'atendendo';
    return next;
  }

  /** Remove da fila quem terminou de ser atendido. */
  complete(userId: string, now = Date.now()): boolean {
    const i = this.entries.findIndex((e) => e.participant.userId === userId);
    if (i < 0) return false;
    this.entries.splice(i, 1);
    this.servedAt.set(userId, now);
    this.servedCount++;
    if (this.servedAt.size > 5000) {
      const oldest = this.servedAt.keys().next().value;
      if (oldest !== undefined) this.servedAt.delete(oldest);
    }
    return true;
  }

  /** Remove sem contar como atendido (ex.: limpar fila). */
  remove(userId: string): boolean {
    const i = this.entries.findIndex((e) => e.participant.userId === userId);
    if (i < 0) return false;
    this.entries.splice(i, 1);
    return true;
  }

  /** Esvazia quem está aguardando. Retorna os removidos. */
  clearWaiting(): QueueEntry[] {
    const removed = this.entries.filter((e) => e.state === 'aguardando');
    this.entries = this.entries.filter((e) => e.state !== 'aguardando');
    return removed;
  }

  has(userId: string) {
    return this.entries.some((e) => e.participant.userId === userId);
  }

  get length() {
    return this.entries.length;
  }

  get served() {
    return this.servedCount;
  }

  /** Para salvar/restaurar a fila se a página for recarregada. */
  snapshot(): Participant[] {
    return this.entries.map((e) => e.participant);
  }

  restore(list: Participant[], now = Date.now()) {
    for (const p of list) {
      if (p && typeof p.userId === 'string' && typeof p.nickname === 'string') this.enqueue(p, now);
    }
  }
}
