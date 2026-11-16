/**
 * Descarta eventos repetidos antes de chegarem ao jogo.
 * - mesmo eventId (reenvio da plataforma ou do webhook);
 * - mesma sequência de presente (combo de rosas conta uma vez);
 * - rajada do mesmo usuário em poucos segundos.
 */
export class EventDeduper {
  private seen = new Map<string, number>();

  constructor(
    private readonly maxEntries = 5000,
    private readonly userBurstMs = 2500,
  ) {}

  /** Retorna true quando o evento é novo e deve ser processado. */
  accept(eventId: string, userId: string, streakId: string | undefined, now = Date.now()): boolean {
    const keys = [`e:${eventId}`];
    if (streakId) keys.push(`s:${streakId}`);
    for (const k of keys) if (this.seen.has(k)) return false;

    const userKey = `u:${userId}`;
    const last = this.seen.get(userKey);
    if (last !== undefined && now - last < this.userBurstMs) {
      // marca o evento para não ser reconsiderado, mas descarta
      this.remember(keys[0], now);
      return false;
    }

    for (const k of keys) this.remember(k, now);
    this.remember(userKey, now);
    return true;
  }

  private remember(key: string, now: number) {
    this.seen.delete(key);
    this.seen.set(key, now);
    if (this.seen.size > this.maxEntries) {
      // Map preserva ordem de inserção: remove o mais antigo
      const oldest = this.seen.keys().next().value;
      if (oldest !== undefined) this.seen.delete(oldest);
    }
  }

  get size() {
    return this.seen.size;
  }
}
