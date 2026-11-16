import { describe, expect, it } from 'vitest';
import { EventDeduper } from '../server/dedup';
import { cleanNickname, eventToParticipant, isChatCommand, parseExternalEvent } from '../server/rules';
import { sanitizeSettings } from '../server/settingsStore';
import { DEFAULT_SETTINGS, type LiveEvent } from '../shared/types';
import { AmbientDirector } from '../src/ambient/AmbientDirector';
import { DEFAULT_AMBIENT } from '../shared/ambient';

const ev = (over: Partial<LiveEvent>): LiveEvent => ({
  eventId: 'e1',
  type: 'gift',
  userId: 'u1',
  nickname: 'Luna',
  source: 'teste',
  ts: 0,
  ...over,
});

describe('EventDeduper (eventos duplicados)', () => {
  it('descarta o mesmo evento recebido duas vezes', () => {
    const d = new EventDeduper();
    expect(d.accept('e1', 'u1', undefined, 0)).toBe(true);
    expect(d.accept('e1', 'u1', undefined, 10_000)).toBe(false);
  });

  it('conta uma sequência (combo) de presentes uma única vez', () => {
    const d = new EventDeduper();
    expect(d.accept('e1', 'u1', 'combo-1', 0)).toBe(true);
    expect(d.accept('e2', 'u1', 'combo-1', 5000)).toBe(false);
    expect(d.accept('e3', 'u1', 'combo-2', 10_000)).toBe(true);
  });

  it('segura rajadas do mesmo usuário em poucos segundos', () => {
    const d = new EventDeduper(5000, 2500);
    expect(d.accept('e1', 'u1', undefined, 0)).toBe(true);
    expect(d.accept('e2', 'u1', undefined, 1000)).toBe(false);
    expect(d.accept('e3', 'u1', undefined, 4000)).toBe(true);
    expect(d.accept('e4', 'u2', undefined, 4001)).toBe(true); // outra pessoa não é afetada
  });

  it('não cresce sem limite durante horas de live', () => {
    const d = new EventDeduper(100, 0);
    for (let i = 0; i < 5000; i++) d.accept(`e${i}`, `u${i}`, undefined, i);
    expect(d.size).toBeLessThanOrEqual(100);
  });
});

describe('regras de participação', () => {
  it('presente coloca na fila', () => {
    const p = eventToParticipant(ev({ giftName: 'Rosa' }), DEFAULT_SETTINGS);
    expect(p).toMatchObject({ userId: 'u1', nickname: 'Luna', via: 'presente', giftName: 'Rosa' });
  });

  it('comando gratuito do chat coloca na fila; conversa comum não', () => {
    expect(eventToParticipant(ev({ type: 'chat', comment: '!presente' }), DEFAULT_SETTINGS)?.via).toBe('comando');
    expect(eventToParticipant(ev({ type: 'chat', comment: '  !PRESENTE por favor' }), DEFAULT_SETTINGS)?.via).toBe('comando');
    expect(eventToParticipant(ev({ type: 'chat', comment: 'oi gente' }), DEFAULT_SETTINGS)).toBeNull();
    expect(isChatCommand('quero !presente', ['!presente'])).toBe(false);
  });

  it('respeita as chaves de configuração', () => {
    expect(eventToParticipant(ev({}), { ...DEFAULT_SETTINGS, giftJoins: false })).toBeNull();
    expect(eventToParticipant(ev({ type: 'follow' }), DEFAULT_SETTINGS)).toBeNull();
    expect(eventToParticipant(ev({ type: 'follow' }), { ...DEFAULT_SETTINGS, followJoins: true })?.via).toBe('outro');
    expect(eventToParticipant(ev({ type: 'like' }), DEFAULT_SETTINGS)).toBeNull();
  });

  it('limpa nomes estranhos e descarta fotos com endereço inválido', () => {
    expect(cleanNickname('  Ana​   Clara \n')).toBe('Ana Clara');
    expect(cleanNickname('')).toBe('Visitante');
    expect(Array.from(cleanNickname('x'.repeat(60))).length).toBeLessThanOrEqual(22);
    expect(eventToParticipant(ev({ avatarUrl: 'javascript:alert(1)' }), DEFAULT_SETTINGS)?.avatarUrl).toBeUndefined();
    expect(eventToParticipant(ev({ avatarUrl: 'https://exemplo.com/a.jpg' }), DEFAULT_SETTINGS)?.avatarUrl).toBe('https://exemplo.com/a.jpg');
  });

  it('valida eventos externos (webhook)', () => {
    expect(parseExternalEvent(null, 'webhook')).toBeNull();
    expect(parseExternalEvent({ type: 'hack', userId: '1' }, 'webhook')).toBeNull();
    expect(parseExternalEvent({ type: 'gift' }, 'webhook')).toBeNull();
    const ok = parseExternalEvent({ type: 'gift', userId: 123, nickname: 'Theo', giftName: 'Rosa' }, 'webhook');
    expect(ok).toMatchObject({ type: 'gift', userId: '123', nickname: 'Theo', source: 'webhook' });
    expect(ok?.eventId).toBeTruthy();
  });
});

describe('configurações', () => {
  it('mantém os valores dentro de limites seguros', () => {
    const s = sanitizeSettings({ speed: 99, maxQueue: -4, maxVisible: 500, volumes: { master: 7, music: -1, sfx: 0.5, voice: 1 }, quality: 'ultra' as never });
    expect(s.speed).toBe(3);
    expect(s.maxQueue).toBe(5);
    expect(s.maxVisible).toBe(12);
    expect(s.volumes).toEqual({ master: 1, music: 0, sfx: 0.5, voice: 1 });
    expect(s.quality).toBe('auto');
  });

  it('normaliza os comandos do chat', () => {
    const s = sanitizeSettings({ chatCommands: [' !Noel ', '', '!FILA'] });
    expect(s.chatCommands).toEqual(['!noel', '!fila']);
  });

  it('nunca fica sem comando gratuito: lista vazia volta para !presente, !noel e !fila', () => {
    expect(sanitizeSettings({ chatCommands: [] }).chatCommands).toEqual(['!presente', '!noel', '!fila']);
    expect(sanitizeSettings({ chatCommands: ['   ', ''] }).chatCommands).toEqual(['!presente', '!noel', '!fila']);
  });
});

describe('efeitos da sala: botão do painel durante o descanso', () => {
  it('presente da live respeita o descanso; o botão (force) passa por cima', () => {
    const d = new AmbientDirector(DEFAULT_AMBIENT);
    const cfg = DEFAULT_AMBIENT.effects.MAGICAL_NIGHT;
    expect(d.request({ effect: 'MAGICAL_NIGHT', source: 'tiktok' })).toBe('iniciado');
    // deixa terminar: entra no descanso
    for (let t = 0; t < cfg.durationSec * 2 + 2; t += 0.5) d.update(0.5);
    expect(d.snapshot().active).toHaveLength(0);
    if (cfg.cooldownSec > 0) expect(d.request({ effect: 'MAGICAL_NIGHT', source: 'tiktok' })).toBe('descartado');
    expect(d.request({ effect: 'MAGICAL_NIGHT', source: 'painel', force: true })).toBe('iniciado');
  });
});
