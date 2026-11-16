import type { LiveEvent, Participant, Settings } from '../shared/types.js';

/** Remove caracteres de controle e limita o tamanho do nome. */
export function cleanNickname(name: unknown): string {
  const s = String(name ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f​-‏‪-‮]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const chars = Array.from(s);
  return chars.length > 22 ? chars.slice(0, 21).join('') + '…' : s || 'Visitante';
}

export function isChatCommand(comment: string | undefined, commands: string[]): boolean {
  if (!comment) return false;
  const first = comment.trim().toLowerCase().split(/\s+/)[0] ?? '';
  return commands.includes(first);
}

/**
 * Decide se um evento da live coloca alguém na fila.
 * Retorna null quando o evento não gera participação.
 */
export function eventToParticipant(ev: LiveEvent, settings: Settings): Participant | null {
  let via: Participant['via'] | null = null;
  if (ev.type === 'gift' && settings.giftJoins) via = 'presente';
  else if (ev.type === 'chat' && isChatCommand(ev.comment, settings.chatCommands)) via = 'comando';
  else if (ev.type === 'follow' && settings.followJoins) via = 'outro';
  if (!via) return null;

  return {
    userId: String(ev.userId),
    nickname: cleanNickname(ev.nickname),
    avatarUrl: ev.avatarUrl && /^(https?:\/\/|\/api\/)/.test(ev.avatarUrl) ? ev.avatarUrl : undefined,
    via,
    giftName: ev.giftName,
    eventId: ev.eventId,
    ts: ev.ts,
  };
}

/** Valida dados vindos de fora (webhook) e monta um LiveEvent. */
export function parseExternalEvent(body: unknown, source: string): LiveEvent | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  const type = String(b.type ?? '');
  if (!['gift', 'chat', 'follow', 'like', 'share', 'join'].includes(type)) return null;
  const userId = String(b.userId ?? b.uniqueId ?? '').slice(0, 64);
  if (!userId) return null;
  return {
    eventId: String(b.eventId ?? `${source}-${userId}-${type}-${Date.now()}`).slice(0, 128),
    type: type as LiveEvent['type'],
    userId,
    nickname: cleanNickname(b.nickname ?? b.uniqueId ?? userId),
    avatarUrl: typeof b.avatarUrl === 'string' ? b.avatarUrl.slice(0, 1000) : undefined,
    giftName: typeof b.giftName === 'string' ? b.giftName.slice(0, 60) : undefined,
    giftCount: Number(b.giftCount) || undefined,
    streakId: typeof b.streakId === 'string' ? b.streakId.slice(0, 128) : undefined,
    comment: typeof b.comment === 'string' ? b.comment.slice(0, 300) : undefined,
    source,
    ts: Date.now(),
  };
}
