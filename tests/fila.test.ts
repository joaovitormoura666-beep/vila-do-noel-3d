import { describe, expect, it } from 'vitest';
import type { Participant } from '../shared/types';
import { QueueManager } from '../src/queue/QueueManager';

const p = (id: string, nickname = id): Participant => ({ userId: id, nickname, via: 'presente', eventId: `ev-${id}`, ts: 0 });

describe('QueueManager (fila)', () => {
  it('aceita participantes em ordem de chegada', () => {
    const q = new QueueManager({ maxQueue: 10, rejoinCooldownSec: 0 });
    expect(q.enqueue(p('a'))).toBe('aceito');
    expect(q.enqueue(p('b'))).toBe('aceito');
    expect(q.waiting().map((e) => e.participant.userId)).toEqual(['a', 'b']);
  });

  it('ignora a mesma pessoa enquanto ela ainda está na fila', () => {
    const q = new QueueManager({ maxQueue: 10, rejoinCooldownSec: 0 });
    q.enqueue(p('a'));
    expect(q.enqueue(p('a'))).toBe('duplicado');
    q.startNext();
    expect(q.enqueue(p('a'))).toBe('duplicado'); // sendo atendida também conta
    expect(q.length).toBe(1);
  });

  it('recusa quando a fila está cheia', () => {
    const q = new QueueManager({ maxQueue: 2, rejoinCooldownSec: 0 });
    q.enqueue(p('a'));
    q.enqueue(p('b'));
    expect(q.enqueue(p('c'))).toBe('fila_cheia');
    expect(q.length).toBe(2);
  });

  it('atende um por vez e libera a vaga ao concluir', () => {
    const q = new QueueManager({ maxQueue: 2, rejoinCooldownSec: 0 });
    q.enqueue(p('a'));
    q.enqueue(p('b'));
    expect(q.startNext()?.participant.userId).toBe('a');
    expect(q.startNext()).toBeUndefined(); // já tem alguém com o Noel
    expect(q.complete('a')).toBe(true);
    expect(q.served).toBe(1);
    expect(q.enqueue(p('c'))).toBe('aceito');
    expect(q.startNext()?.participant.userId).toBe('b');
  });

  it('permite voltar depois de atendido, respeitando o intervalo configurado', () => {
    const q = new QueueManager({ maxQueue: 5, rejoinCooldownSec: 60 });
    q.enqueue(p('a'), 0);
    q.startNext();
    q.complete('a', 1000);
    expect(q.enqueue(p('a'), 30_000)).toBe('aguardando_intervalo');
    expect(q.enqueue(p('a'), 62_000)).toBe('aceito');

    const semIntervalo = new QueueManager({ maxQueue: 5, rejoinCooldownSec: 0 });
    semIntervalo.enqueue(p('a'), 0);
    semIntervalo.startNext();
    semIntervalo.complete('a', 1000);
    expect(semIntervalo.enqueue(p('a'), 1001)).toBe('aceito');
  });

  it('limpa quem está aguardando sem interromper o atendimento atual', () => {
    const q = new QueueManager({ maxQueue: 10, rejoinCooldownSec: 0 });
    ['a', 'b', 'c'].forEach((id) => q.enqueue(p(id)));
    q.startNext();
    expect(q.clearWaiting().map((e) => e.participant.userId)).toEqual(['b', 'c']);
    expect(q.current()?.participant.userId).toBe('a');
    expect(q.length).toBe(1);
  });

  it('salva e restaura a fila (recarregamento da página)', () => {
    const q = new QueueManager({ maxQueue: 10, rejoinCooldownSec: 0 });
    ['a', 'b', 'c'].forEach((id) => q.enqueue(p(id)));
    q.startNext();
    const copy = new QueueManager({ maxQueue: 10, rejoinCooldownSec: 0 });
    copy.restore(q.snapshot());
    expect(copy.waiting().map((e) => e.participant.userId)).toEqual(['a', 'b', 'c']);
    copy.restore([{ userId: 5 } as unknown as Participant]); // dados inválidos são ignorados
    expect(copy.length).toBe(3);
  });

  it('aguenta 100 participantes de uma vez', () => {
    const q = new QueueManager({ maxQueue: 150, rejoinCooldownSec: 0 });
    for (let i = 0; i < 100; i++) expect(q.enqueue(p(`u${i}`))).toBe('aceito');
    for (let i = 0; i < 100; i++) {
      const e = q.startNext();
      expect(e?.participant.userId).toBe(`u${i}`);
      q.complete(e!.participant.userId);
    }
    expect(q.length).toBe(0);
    expect(q.served).toBe(100);
  });
});
