import { EventEmitter } from 'node:events';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WebSocket } from 'ws';
import { createVilaServer, type VilaServer } from '../server/app';
import { readConfig } from '../server/config';
import { EventHub } from '../server/EventHub';
import { eventToParticipant } from '../server/rules';
import { TikTokConfigStore } from '../server/settingsStore';
import {
  ConversorTikTok,
  TikTokSource,
  NodeAntigoError,
  classificarErro,
  esperaReconexao,
  type ConectorTikTok,
  type FabricaConector,
} from '../server/integrations/TikTokSource';
import { DEFAULT_AMBIENT_GIFTS, giftToAmbientEffect, sanitizeAmbientGiftRule } from '../shared/ambient';
import { normalizarUsuarioTikTok } from '../shared/tiktok';
import { DEFAULT_SETTINGS, type LiveEvent, type ToClient, type ToServer } from '../shared/types';

/**
 * Leitura da live do TikTok com um conector FALSO (o contêiner de testes não alcança o TikTok).
 * Os eventos falsos imitam o formato da biblioteca tiktok-live-connector 2.5.0 (mensagens
 * "v3": user.id, user.displayId, user.avatarThumb.urlList, content, gift.diamondCount...).
 */

/* ---------------------------------------------------------------- conector falso */

class UserOfflineError extends Error {}
class InvalidUniqueIdError extends Error {}
class SignatureRateLimitError extends Error {
  constructor(readonly retryAfter: number) {
    super('[Rate Limited] too many requests');
  }
}

type Plano = () => void | Promise<void>;

class ConectorFalso extends EventEmitter implements ConectorTikTok {
  conectado = false;
  desligamentos = 0;
  roomInfo = { data: { title: 'Live de teste', user_count: 12 } };
  constructor(
    readonly usuario: string,
    readonly chave: string | null,
    private readonly plano: Plano,
  ) {
    super();
  }
  async connect() {
    await this.plano();
    this.conectado = true;
    return {};
  }
  async disconnect() {
    this.desligamentos++;
    this.conectado = false;
  }
}

/** Fábrica que entrega conectores falsos, cada um com o próximo plano da lista (o último se repete). */
function fabricaFalsa(planos: Plano[] = [() => {}]) {
  const criados: ConectorFalso[] = [];
  const fabrica: FabricaConector = (usuario, { chave }) => {
    const plano = planos[Math.min(criados.length, planos.length - 1)];
    const c = new ConectorFalso(usuario, chave, plano);
    criados.push(c);
    return c;
  };
  return { fabrica, criados };
}

const usuarioV3 = (id: string, nome: string) => ({
  id,
  displayId: `conta_${id}`,
  nickname: nome,
  avatarThumb: { urlList: [`https://p16-sign-va.tiktokcdn.com/avatar/${id}.webp`] },
});
const chat = (id: string, texto: string, msgId = `m-${id}-${texto}`) => ({ common: { msgId }, user: usuarioV3(id, `Pessoa ${id}`), content: texto });
const presente = (id: string, extra: Record<string, unknown>) => ({
  common: { msgId: `g-${id}-${JSON.stringify(extra)}` },
  user: usuarioV3(id, `Pessoa ${id}`),
  giftId: '5655',
  groupId: '777',
  ...extra,
});
const rosa = { type: 1, name: 'Rose', diamondCount: 1 };

/* ---------------------------------------------------------------- conversão */

describe('TikTok: conversão de eventos', () => {
  const conv = () => new ConversorTikTok();

  it('chat vira chat com o texto, identificador estável, nome e foto', () => {
    const ev = conv().converter('chat', chat('123', '!presente'), 1000);
    expect(ev).toMatchObject({
      type: 'chat',
      comment: '!presente',
      userId: 'tiktok:123',
      nickname: 'Pessoa 123',
      avatarUrl: 'https://p16-sign-va.tiktokcdn.com/avatar/123.webp',
      source: 'tiktok',
      eventId: 'tiktok:m-123-!presente',
    });
  });

  it('aceita também o formato antigo da biblioteca (uniqueId, profilePictureUrl, comment)', () => {
    const ev = conv().converter('chat', { userId: '9', uniqueId: 'luna', nickname: 'Luna', profilePictureUrl: 'https://p77.tiktokcdn-us.com/a.jpg', comment: '!noel' });
    expect(ev).toMatchObject({ type: 'chat', comment: '!noel', userId: 'tiktok:9', nickname: 'Luna', avatarUrl: 'https://p77.tiktokcdn-us.com/a.jpg' });
  });

  it('sem nome usa o @; foto que não é https fica de fora; evento sem pessoa é ignorado', () => {
    const ev = conv().converter('chat', { user: { id: '5', displayId: 'sem_nome', avatarThumb: { urlList: ['http://x/a.jpg'] } }, content: 'oi' });
    expect(ev).toMatchObject({ nickname: 'sem_nome', avatarUrl: undefined });
    expect(conv().converter('chat', { content: 'oi' })).toBeNull();
  });

  it('curtida, seguir, compartilhar e entrada viram like, follow, share e join', () => {
    const c = conv();
    expect(c.converter('like', { user: usuarioV3('1', 'A'), likeCount: 15 })).toMatchObject({ type: 'like', giftCount: 15 });
    expect(c.converter('like', { user: usuarioV3('1', 'A'), count: 3 })).toMatchObject({ type: 'like', giftCount: 3 });
    expect(c.converter('follow', { user: usuarioV3('2', 'B') })).toMatchObject({ type: 'follow', userId: 'tiktok:2' });
    expect(c.converter('share', { user: usuarioV3('3', 'C') })).toMatchObject({ type: 'share' });
    expect(c.converter('member', { user: usuarioV3('4', 'D') })).toMatchObject({ type: 'join' });
  });

  it('presente sem sequência conta na hora, com nome, quantidade e moedas', () => {
    const ev = conv().converter('gift', presente('7', { gift: { type: 2, name: 'Universe', diamondCount: 34999 }, repeatCount: 1 }));
    expect(ev).toMatchObject({ type: 'gift', giftName: 'Universe', giftCount: 1, diamondCount: 34999 });
    expect(ev?.streakId).toBeUndefined();
  });

  it('usa extendedGiftInfo quando o presente não traz o nome e o valor', () => {
    const ev = conv().converter('gift', presente('7', { extendedGiftInfo: { name: 'Doughnut', diamond_count: 30, type: 2 } }));
    expect(ev).toMatchObject({ giftName: 'Doughnut', diamondCount: 30 });
  });

  it('combo de rosas só conta no fim da sequência (repeatEnd), com a quantidade final', () => {
    const c = conv();
    expect(c.converter('gift', presente('8', { gift: rosa, repeatCount: 1, repeatEnd: 0 }), 0)).toBeNull();
    expect(c.converter('gift', presente('8', { gift: rosa, repeatCount: 5, repeatEnd: 0 }), 500)).toBeNull();
    const fim = c.converter('gift', presente('8', { gift: rosa, repeatCount: 10, repeatEnd: 1 }), 900);
    expect(fim).toMatchObject({ type: 'gift', giftName: 'Rose', giftCount: 10, diamondCount: 1 });
    expect(fim?.streakId).toBe('tiktok:tiktok:8|5655|777:0');
    // o mesmo fim repetido (reconexão) não conta de novo
    expect(c.converter('gift', presente('8', { gift: rosa, repeatCount: 10, repeatEnd: 1, x: 1 }), 950)).toBeNull();
  });

  it('combo cujo fim se perdeu é contado depois de 15 s sem novidade', () => {
    const c = conv();
    c.converter('gift', presente('9', { gift: rosa, repeatCount: 3, repeatEnd: 0 }), 0);
    expect(c.varrer(10_000)).toEqual([]);
    const fechados = c.varrer(16_000);
    expect(fechados).toHaveLength(1);
    expect(fechados[0]).toMatchObject({ giftName: 'Rose', giftCount: 3 });
    // o fim atrasado não conta outra vez
    expect(c.converter('gift', presente('9', { gift: rosa, repeatCount: 3, repeatEnd: 1 }), 17_000)).toBeNull();
  });
});

describe('TikTok: limpeza do @ e classificação de erros', () => {
  it('aceita @, endereço da live e maiúsculas; recusa o que não é @', () => {
    expect(normalizarUsuarioTikTok('@Vila.Do.Noel')).toBe('vila.do.noel');
    expect(normalizarUsuarioTikTok('https://www.tiktok.com/@canal_teste/live')).toBe('canal_teste');
    expect(normalizarUsuarioTikTok('  canal  ')).toBe('canal');
    expect(normalizarUsuarioTikTok('com espaço')).toBeNull();
    expect(normalizarUsuarioTikTok('')).toBeNull();
    expect(normalizarUsuarioTikTok('a'.repeat(30))).toBeNull();
  });

  it('reconhece live desligada, limite do serviço, @ inválido e falta de internet', () => {
    expect(classificarErro(new UserOfflineError("The requested user isn't online :("))).toEqual({ tipo: 'offline' });
    expect(classificarErro(new SignatureRateLimitError(90_000))).toEqual({ tipo: 'limite', esperaMs: 90_000 });
    expect(classificarErro(new InvalidUniqueIdError('bad'))).toEqual({ tipo: 'usuario_invalido' });
    expect(classificarErro(Object.assign(new Error('getaddrinfo ENOTFOUND www.tiktok.com'), { code: 'ENOTFOUND' }))).toEqual({ tipo: 'sem_internet' });
    expect(classificarErro(new Error('Failed to retrieve Room ID from all sources.'))).toEqual({ tipo: 'nao_encontrado' });
    // Node antigo (got 15 da biblioteca exige o 22): avisado antes de carregar a biblioteca
    expect(classificarErro(new NodeAntigoError('Node.js 20.3.0 é antigo demais'))).toEqual({ tipo: 'node_antigo' });
    // um SyntaxError qualquer (ex.: resposta estranha do TikTok) NÃO vira "Node antigo"
    expect(classificarErro(new SyntaxError('Unexpected token < in JSON at position 0'))).toEqual({ tipo: 'outro' });
    // erro composto da biblioteca cujo motivo de dentro é falta de internet (visto com a biblioteca real, sem rede)
    const semRede = Object.assign(new Error('Failed to retrieve Room ID from all sources.'), {
      config: { requestErrs: [Object.assign(new Error('getaddrinfo ENOTFOUND www.tiktok.com'), { code: 'ENOTFOUND' })] },
    });
    expect(classificarErro(semRede)).toEqual({ tipo: 'sem_internet' });
  });

  it('espera crescente até 1 minuto', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 20].map(esperaReconexao)).toEqual([2000, 4000, 8000, 16000, 32000, 60000, 60000, 60000]);
  });
});

/* ---------------------------------------------------------------- fonte (conexão) */

describe('TikTok: conexão, espera da live, reconexão e troca de @', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-16T12:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const montar = (planos?: Plano[]) => {
    const { fabrica, criados } = fabricaFalsa(planos);
    const eventos: LiveEvent[] = [];
    const avisos = vi.fn();
    const fonte = new TikTokSource({ fabrica, aoMudar: avisos });
    fonte.start((ev) => eventos.push(ev));
    return { fonte, criados, eventos, avisos };
  };

  it('começa desligado e conecta quando ligado; entrega os eventos e conta', async () => {
    const { fonte, criados, eventos } = montar();
    expect(fonte.status.state).toBe('desligado');
    fonte.configurar({ usuario: 'canal.teste', ligado: true, chave: null });
    expect(fonte.status.state).toBe('conectando');
    await vi.advanceTimersByTimeAsync(0);
    expect(fonte.status).toMatchObject({ state: 'conectado', usuario: 'canal.teste', sala: 'Live de teste', espectadores: 12 });
    expect(criados).toHaveLength(1);
    expect(criados[0].usuario).toBe('canal.teste');

    criados[0].emit('chat', chat('1', '!presente'));
    criados[0].emit('like', { user: usuarioV3('2', 'B'), likeCount: 4 });
    criados[0].emit('gift', presente('3', { gift: { type: 2, name: 'Doughnut', diamondCount: 30 } }));
    criados[0].emit('roomUser', { total: '57' });
    expect(eventos.map((e) => e.type)).toEqual(['chat', 'like', 'gift']);
    expect(fonte.contadores).toMatchObject({ comentarios: 1, curtidas: 4, presentes: 1 });
    expect(fonte.status.espectadores).toBe(57);
    fonte.stop();
  });

  it('live desligada: espera e confere de novo a cada 30 s, sem derrubar nada', async () => {
    let aoVivo = false;
    const { fonte, criados } = montar([
      () => {
        if (!aoVivo) throw new UserOfflineError("The requested user isn't online :(");
      },
    ]);
    fonte.configurar({ usuario: 'canal.teste', ligado: true, chave: null });
    await vi.advanceTimersByTimeAsync(0);
    expect(fonte.status.state).toBe('aguardando_live');
    expect(fonte.status.mensagem).toMatch(/não está ao vivo/);
    expect(criados).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(29_000);
    expect(criados).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(criados).toHaveLength(2);
    expect(fonte.status.state).toBe('aguardando_live');
    aoVivo = true;
    await vi.advanceTimersByTimeAsync(30_000);
    expect(fonte.status.state).toBe('conectado');
    // nunca mais de uma conexão viva
    expect(criados.filter((c) => c.conectado)).toHaveLength(1);
    fonte.stop();
  });

  it('queda: reconecta sozinho com espera crescente', async () => {
    const falhas = { n: 0 };
    const { fonte, criados } = montar([
      () => {},
      () => {
        falhas.n++;
        throw new Error('socket hang up');
      },
      () => {},
    ]);
    fonte.configurar({ usuario: 'canal.teste', ligado: true, chave: null });
    await vi.advanceTimersByTimeAsync(0);
    expect(fonte.status.state).toBe('conectado');
    criados[0].emit('disconnected', { code: 1006 });
    expect(fonte.status).toMatchObject({ state: 'reconectando', tentativa: 1 });
    expect(criados[0].desligamentos).toBe(1);
    await vi.advanceTimersByTimeAsync(2000); // 1ª tentativa (falha)
    expect(falhas.n).toBe(1);
    expect(fonte.status).toMatchObject({ state: 'reconectando', tentativa: 2 });
    expect(fonte.status.mensagem).toMatch(/internet/);
    await vi.advanceTimersByTimeAsync(3999);
    expect(criados).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1); // 2ª tentativa depois de 4 s (dá certo)
    expect(criados).toHaveLength(3);
    expect(fonte.status.state).toBe('conectado');
    fonte.stop();
  });

  it('fim da live: volta a esperar a próxima', async () => {
    const { fonte, criados } = montar();
    fonte.configurar({ usuario: 'canal.teste', ligado: true, chave: null });
    await vi.advanceTimersByTimeAsync(0);
    criados[0].emit('streamEnd', { action: 3 });
    expect(fonte.status.state).toBe('aguardando_live');
    expect(fonte.status.mensagem).toMatch(/terminou/);
    fonte.stop();
  });

  it('limite do Euler Stream: espera o tempo pedido pelo serviço', async () => {
    const { fonte, criados } = montar([
      () => {
        throw new SignatureRateLimitError(90_000);
      },
      () => {},
    ]);
    fonte.configurar({ usuario: 'canal.teste', ligado: true, chave: null });
    await vi.advanceTimersByTimeAsync(0);
    expect(fonte.status.state).toBe('reconectando');
    expect(fonte.status.mensagem).toMatch(/Euler Stream/);
    await vi.advanceTimersByTimeAsync(89_000);
    expect(criados).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(fonte.status.state).toBe('conectado');
    fonte.stop();
  });

  it('sem número da sala (conta fora do ar): espera a live como "Esperando a live começar", sem "Reconectando"', async () => {
    let aoVivo = false;
    const { fonte, criados } = montar([
      () => {
        if (!aoVivo) throw new Error('Failed to retrieve Room ID from all sources.');
      },
    ]);
    fonte.configurar({ usuario: 'canal.teste', ligado: true, chave: null });
    await vi.advanceTimersByTimeAsync(0);
    expect(fonte.status.state).toBe('aguardando_live');
    expect(fonte.status.mensagem).toMatch(/Ainda não encontrei a live de @canal\.teste/);
    // confere de novo no ritmo da live desligada (30 s), não no da reconexão (2 s, 4 s...)
    await vi.advanceTimersByTimeAsync(29_000);
    expect(criados).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(criados).toHaveLength(2);
    aoVivo = true;
    await vi.advanceTimersByTimeAsync(30_000);
    expect(fonte.status.state).toBe('conectado');
    // depois de uma conexão boa, a explicação muda: a live pode ter terminado
    aoVivo = false;
    criados[2].emit('disconnected', { code: 1006 });
    await vi.advanceTimersByTimeAsync(2000);
    expect(fonte.status.state).toBe('aguardando_live');
    expect(fonte.status.mensagem).toMatch(/pode ter terminado/);
    fonte.stop();
  });

  it('"Conferir agora" (mesmo @ ligado de novo) tenta na hora enquanto espera a live', async () => {
    const { fonte, criados } = montar([
      () => {
        throw new UserOfflineError("The requested user isn't online :(");
      },
    ]);
    fonte.configurar({ usuario: 'canal.teste', ligado: true, chave: null });
    await vi.advanceTimersByTimeAsync(0);
    expect(fonte.status.state).toBe('aguardando_live');
    fonte.configurar({ usuario: 'canal.teste', ligado: true, chave: null }, true);
    await vi.advanceTimersByTimeAsync(0);
    expect(criados).toHaveLength(2);
    expect(fonte.status.state).toBe('aguardando_live');
    fonte.stop();
  });

  it('Node.js antigo: para e explica como atualizar (sem ficar tentando)', async () => {
    const { fonte, criados } = montar([
      () => {
        throw new NodeAntigoError('Node.js 20.3.0 é antigo demais');
      },
    ]);
    fonte.configurar({ usuario: 'canal.teste', ligado: true, chave: null });
    await vi.advanceTimersByTimeAsync(0);
    expect(fonte.status.state).toBe('erro');
    expect(fonte.status.mensagem).toMatch(/Node\.js.*nodejs\.org/);
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(criados).toHaveLength(1);
    fonte.stop();
  });

  it('@ recusado pelo TikTok: para e explica (sem ficar tentando)', async () => {
    const { fonte, criados } = montar([
      () => {
        throw new InvalidUniqueIdError('bad');
      },
    ]);
    fonte.configurar({ usuario: 'canal.teste', ligado: true, chave: null });
    await vi.advanceTimersByTimeAsync(0);
    expect(fonte.status.state).toBe('erro');
    expect(fonte.status.mensagem).toMatch(/Confira/);
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(criados).toHaveLength(1);
    // "Conectar de novo" no painel tenta na hora
    fonte.configurar({ usuario: 'canal.teste', ligado: true, chave: null }, true);
    await vi.advanceTimersByTimeAsync(0);
    expect(criados).toHaveLength(2);
    fonte.stop();
  });

  it('trocar de @ fecha a conexão anterior, ignora o que vier dela e zera os contadores', async () => {
    const { fonte, criados, eventos } = montar();
    fonte.configurar({ usuario: 'primeiro', ligado: true, chave: null });
    await vi.advanceTimersByTimeAsync(0);
    criados[0].emit('chat', chat('1', 'oi'));
    expect(fonte.contadores.comentarios).toBe(1);
    fonte.configurar({ usuario: 'segundo', ligado: true, chave: null });
    expect(criados[0].desligamentos).toBe(1);
    expect(fonte.contadores.comentarios).toBe(0);
    await vi.advanceTimersByTimeAsync(0);
    expect(criados).toHaveLength(2);
    expect(criados[1].usuario).toBe('segundo');
    criados[0].emit('chat', chat('2', 'atrasado da conexão antiga'));
    expect(eventos).toHaveLength(1);
    expect(criados.filter((c) => c.conectado)).toHaveLength(1);
    fonte.stop();
  });

  it('desligar no meio da conexão não deixa conexão aberta nem tentativa agendada', async () => {
    let soltar: () => void = () => {};
    const { fonte, criados } = montar([() => new Promise<void>((r) => (soltar = r))]);
    fonte.configurar({ usuario: 'canal.teste', ligado: true, chave: null });
    await vi.advanceTimersByTimeAsync(0);
    expect(fonte.status.state).toBe('conectando');
    fonte.configurar({ usuario: 'canal.teste', ligado: false, chave: null });
    expect(fonte.status.state).toBe('desligado');
    soltar();
    await vi.advanceTimersByTimeAsync(0);
    expect(criados[0].conectado).toBe(false);
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    expect(criados).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('a mesma configuração de novo não reconecta; trocar a chave reconecta com a chave nova', async () => {
    const { fonte, criados } = montar();
    fonte.configurar({ usuario: 'canal.teste', ligado: true, chave: null });
    await vi.advanceTimersByTimeAsync(0);
    fonte.configurar({ usuario: 'canal.teste', ligado: true, chave: null });
    await vi.advanceTimersByTimeAsync(0);
    expect(criados).toHaveLength(1);
    fonte.configurar({ usuario: 'canal.teste', ligado: true, chave: 'chave-nova' });
    await vi.advanceTimersByTimeAsync(0);
    expect(criados).toHaveLength(2);
    expect(criados[1].chave).toBe('chave-nova');
    fonte.stop();
  });
});

/* ---------------------------------------------------------------- regras */

describe('TikTok: regras de entrada na fila', () => {
  const c = new ConversorTikTok();
  const part = (ev: LiveEvent | null, s = DEFAULT_SETTINGS) => (ev ? eventToParticipant(ev, s) : null);

  it('comandos gratuitos do chat colocam na fila; conversa comum não', () => {
    for (const cmd of ['!presente', '!noel', '!fila', '!FILA agora']) expect(part(c.converter('chat', chat('1', cmd)))?.via).toBe('comando');
    expect(part(c.converter('chat', chat('1', 'oi Noel')))).toBeNull();
  });

  it('presente (rosa ou outro) coloca na fila; curtida, entrada e compartilhamento não', () => {
    expect(part(c.converter('gift', presente('2', { gift: { type: 2, name: 'Rose', diamondCount: 1 } })))?.via).toBe('presente');
    expect(part(c.converter('like', { user: usuarioV3('3', 'C'), likeCount: 50 }))).toBeNull();
    expect(part(c.converter('member', { user: usuarioV3('3', 'C') }))).toBeNull();
    expect(part(c.converter('share', { user: usuarioV3('3', 'C') }))).toBeNull();
  });

  it('seguir só coloca na fila quando a opção do painel estiver ligada', () => {
    const ev = c.converter('follow', { user: usuarioV3('4', 'D') });
    expect(part(ev)).toBeNull();
    expect(part(ev, { ...DEFAULT_SETTINGS, followJoins: true })?.via).toBe('outro');
  });
});

/* ---------------------------------------------------------------- presente → efeito */

describe('presente da live → efeito ambiente (regra provisória)', () => {
  const r = DEFAULT_AMBIENT_GIFTS;

  it('a rosa só põe na fila, mesmo num combo grande', () => {
    expect(giftToAmbientEffect({ giftName: 'Rose', diamondCount: 1, giftCount: 99 }, r)).toBeNull();
    expect(giftToAmbientEffect({ giftName: 'Rosa', diamondCount: 1, giftCount: 1 }, r)).toBeNull();
  });

  it('o valor do envio (moedas x quantidade) escolhe o efeito', () => {
    expect(giftToAmbientEffect({ giftName: 'Coração', diamondCount: 1, giftCount: 1 }, r)).toBeNull();
    expect(giftToAmbientEffect({ giftName: 'Bastão', diamondCount: 10 }, r)?.effect).toBe('TREE_SPARKLE');
    expect(giftToAmbientEffect({ giftName: 'Doughnut', diamondCount: 30 }, r)?.effect).toBe('FIREPLACE_MAGIC');
    expect(giftToAmbientEffect({ giftName: 'Doughnut', diamondCount: 30, giftCount: 4 }, r)).toMatchObject({ effect: 'SLEIGH_PASS', coins: 120 });
    expect(giftToAmbientEffect({ giftName: 'Lion', diamondCount: 29999 }, r)).toMatchObject({ effect: 'MAGICAL_NIGHT', reason: 'moedas' });
  });

  it('sem valor conhecido, só pelo nome; o nome vale mais que as moedas', () => {
    expect(giftToAmbientEffect({ giftName: 'Desconhecido' }, r)).toBeNull();
    const rule = sanitizeAmbientGiftRule({ ...r, effects: { ...r.effects, SLEIGH_PASS: { minCoins: 100, names: ['Trenó Mágico'] } } });
    expect(rule.effects.SLEIGH_PASS.names).toEqual(['treno magico']);
    expect(giftToAmbientEffect({ giftName: 'TRENÓ  mágico' }, rule)).toMatchObject({ effect: 'SLEIGH_PASS', reason: 'nome' });
    expect(giftToAmbientEffect({ giftName: 'Trenó Mágico', diamondCount: 5000 }, rule)?.effect).toBe('SLEIGH_PASS');
  });

  it('desligada não toca nada; valores do painel são conferidos', () => {
    expect(giftToAmbientEffect({ giftName: 'Lion', diamondCount: 29999 }, { ...r, enabled: false })).toBeNull();
    const s = sanitizeAmbientGiftRule({ enabled: 'sim', effects: { TREE_SPARKLE: { minCoins: -5 } }, onlyQueue: 'Rosa, Rose ,  ' });
    expect(s.enabled).toBe(true);
    expect(s.effects.TREE_SPARKLE.minCoins).toBe(0);
    expect(s.effects.MAGICAL_NIGHT.minCoins).toBe(500);
    expect(s.onlyQueue).toEqual(['rosa', 'rose']);
  });
});

/* ---------------------------------------------------------------- configuração e servidor */

describe('configuração do TikTok (painel e .env)', () => {
  let dir = '';
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'vila-tiktok-'));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('o .env dá o valor inicial; o painel vale mais e fica salvo em data/tiktok.json', () => {
    const env = readConfig({ TIKTOK_USUARIO: '@Canal.Env', TIKTOK_LIGADO: 'sim', EULER_API_KEY: 'chave-do-env' }, dir, false).config.tiktok;
    expect(env).toEqual({ usuario: 'canal.env', ligado: true, chave: 'chave-do-env' });
    const file = join(dir, 'tiktok.json');
    const store = new TikTokConfigStore(file, env);
    expect(store.get()).toMatchObject({ usuario: 'canal.env', ligado: true, chave: 'chave-do-env', usuarioOrigem: 'env', chaveOrigem: 'env' });
    expect(store.update({ usuario: 'outra conta' })).toMatch(/não parece/);
    expect(store.update({ usuario: '@Painel', ligado: false, chave: 'chave-do-painel' })).toBeNull();
    expect(new TikTokConfigStore(file, env).get()).toMatchObject({ usuario: 'painel', ligado: false, chave: 'chave-do-painel', chaveOrigem: 'painel' });
    // apagar a chave do painel volta a usar a do .env
    store.update({ chave: null });
    expect(store.get()).toMatchObject({ chave: 'chave-do-env', chaveOrigem: 'env' });
    expect(store.publicConfig()).toEqual({ usuario: 'painel', ligado: false, chaveDefinida: true, chaveOrigem: 'env', usuarioOrigem: 'painel' });
  });

  it('a tela do jogo não pode mexer no TikTok nem tocar efeitos; o painel pode', () => {
    expect(EventHub.allowed('game', 'tiktokConfig')).toBe(false);
    expect(EventHub.allowed('game', 'ambient')).toBe(false);
    expect(EventHub.allowed(null, 'tiktokConfig')).toBe(false);
    expect(EventHub.allowed('panel', 'tiktokConfig')).toBe(true);
    expect(EventHub.allowed('panel', 'ambient')).toBe(true);
  });
});

interface Peer {
  raw: string[];
  messages: ToClient[];
  send(msg: ToServer): void;
  next(pred: (m: ToClient) => boolean, ms?: number): Promise<ToClient>;
  close(): void;
}

function connect(base: string): Promise<Peer> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://${base}/ws`);
    const raw: string[] = [];
    const messages: ToClient[] = [];
    const waiters: Array<{ pred: (m: ToClient) => boolean; done: (m: ToClient) => void }> = [];
    ws.on('message', (data) => {
      raw.push(String(data));
      const msg = JSON.parse(String(data)) as ToClient;
      messages.push(msg);
      for (const w of [...waiters])
        if (w.pred(msg)) {
          waiters.splice(waiters.indexOf(w), 1);
          w.done(msg);
        }
    });
    ws.on('open', () =>
      resolve({
        raw,
        messages,
        send: (msg) => ws.send(JSON.stringify(msg)),
        close: () => ws.close(),
        next: (pred, ms = 3000) =>
          new Promise((res, rej) => {
            const found = messages.find(pred);
            if (found) return res(found);
            const t = setTimeout(() => rej(new Error('mensagem não chegou')), ms);
            waiters.push({ pred, done: (m) => (clearTimeout(t), res(m)) });
          }),
      }),
    );
    ws.on('error', reject);
  });
}

describe('servidor com a live do TikTok (conector falso)', () => {
  const CHAVE = 'chave-secreta-do-euler-0123456789';
  let dir = '';
  let app: VilaServer;
  let base = '';
  let criados: ConectorFalso[] = [];

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'vila-tiktok-srv-'));
    const { config, errors } = readConfig(
      { HOST: '127.0.0.1', PORT: '0', DATA_DIR: dir, TIKTOK_USUARIO: 'canal.teste', TIKTOK_LIGADO: '1', EULER_API_KEY: CHAVE },
      dir,
      false,
    );
    expect(errors).toEqual([]);
    const f = fabricaFalsa();
    criados = f.criados;
    app = createVilaServer(config, { tiktokFactory: f.fabrica });
    const addr = await app.listen();
    base = `127.0.0.1:${addr.port}`;
  });

  afterEach(async () => {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('liga sozinho pelo .env, leva o chat até a tela do jogo e conta quem entrou na fila', async () => {
    const game = await connect(base);
    game.send({ t: 'hello', role: 'game' });
    await game.next((m) => m.t === 'welcome');
    const panel = await connect(base);
    panel.send({ t: 'hello', role: 'panel' });
    await panel.next((m) => m.t === 'tiktok' && m.info.status.state === 'conectado');
    expect(criados[0].chave).toBe(CHAVE); // a chave chega à biblioteca...

    criados[0].emit('chat', chat('42', '!presente'));
    const p = await game.next((m) => m.t === 'participant');
    expect(p).toMatchObject({ p: { userId: 'tiktok:42', nickname: 'Pessoa 42', via: 'comando' } });
    if (p.t !== 'participant') throw new Error('tipo');
    game.send({ t: 'queueResult', eventId: p.p.eventId, nickname: p.p.nickname, result: 'aceito' });
    await panel.next((m) => m.t === 'tiktok' && m.info.contadores.entraramNaFila === 1 && m.info.contadores.comentarios === 1);

    // ...mas nunca volta para o navegador (nem painel, nem tela do jogo)
    for (const s of [...panel.raw, ...game.raw]) expect(s).not.toContain(CHAVE);
    const info = panel.messages.find((m) => m.t === 'tiktok');
    expect(info).toMatchObject({ info: { config: { chaveDefinida: true, chaveOrigem: 'env', usuario: 'canal.teste', ligado: true } } });
    game.close();
    panel.close();
  });

  it('presente grande da live toca um efeito; a rosa não; o painel toca efeitos pelos botões', async () => {
    const game = await connect(base);
    game.send({ t: 'hello', role: 'game' });
    await game.next((m) => m.t === 'welcome');
    const panel = await connect(base);
    panel.send({ t: 'hello', role: 'panel' });
    await panel.next((m) => m.t === 'tiktok' && m.info.status.state === 'conectado');

    criados[0].emit('gift', presente('1', { gift: { type: 1, name: 'Rose', diamondCount: 1 }, repeatCount: 30, repeatEnd: 1 }));
    criados[0].emit('gift', presente('2', { gift: { type: 2, name: 'Lion', diamondCount: 29999 }, repeatCount: 1 }));
    expect(await game.next((m) => m.t === 'ambient')).toEqual({ t: 'ambient', effect: 'MAGICAL_NIGHT', source: 'tiktok' });
    expect(game.messages.filter((m) => m.t === 'ambient')).toHaveLength(1);
    // as duas pessoas entram na fila do mesmo jeito
    await game.next((m) => m.t === 'participant' && m.p.userId === 'tiktok:2');
    expect(game.messages.filter((m) => m.t === 'participant')).toHaveLength(2);

    panel.send({ t: 'ambient', effect: 'SLEIGH_PASS' });
    expect(await game.next((m) => m.t === 'ambient' && m.effect === 'SLEIGH_PASS')).toEqual({ t: 'ambient', effect: 'SLEIGH_PASS', source: 'painel' });
    // a tela do jogo não consegue pedir efeitos para as outras telas
    game.send({ t: 'ambient', effect: 'TREE_SPARKLE' } as ToServer);
    await panel.next((m) => m.t === 'tiktok' && m.info.contadores.efeitos === 1);
    expect(game.messages.some((m) => m.t === 'ambient' && m.effect === 'TREE_SPARKLE')).toBe(false);
    game.close();
    panel.close();
  });

  it('o painel troca de @, salva a chave sem devolvê-la e desliga', async () => {
    const panel = await connect(base);
    panel.send({ t: 'hello', role: 'panel' });
    await panel.next((m) => m.t === 'tiktok' && m.info.status.state === 'conectado');

    panel.send({ t: 'tiktokConfig', usuario: '@Outra.Conta', ligado: true, chave: 'chave-nova-do-painel-987' });
    await panel.next((m) => m.t === 'tiktok' && m.info.status.usuario === 'outra.conta' && m.info.status.state === 'conectado');
    expect(criados).toHaveLength(2);
    expect(criados[0].desligamentos).toBeGreaterThan(0);
    expect(criados[1]).toMatchObject({ usuario: 'outra.conta', chave: 'chave-nova-do-painel-987' });
    expect(panel.raw.some((s) => s.includes('chave-nova-do-painel-987'))).toBe(false);
    expect(JSON.parse(readFileSync(join(dir, 'tiktok.json'), 'utf8'))).toMatchObject({ usuario: 'outra.conta', ligado: true });

    panel.send({ t: 'tiktokConfig', usuario: 'nome com espaço' });
    await panel.next((m) => m.t === 'log' && /não parece uma conta/.test(m.entry.text));

    panel.send({ t: 'tiktokConfig', ligado: false });
    await panel.next((m) => m.t === 'tiktok' && m.info.status.state === 'desligado');
    expect(criados.filter((c) => c.conectado)).toHaveLength(0);
    // a configuração do jogo (que vai para a tela do OBS) não leva nada do TikTok além da regra dos efeitos
    expect(app.settings.get()).not.toHaveProperty('tiktok');
    expect(existsSync(join(dir, 'configuracoes.json')) ? readFileSync(join(dir, 'configuracoes.json'), 'utf8') : '').not.toContain('chave');
    panel.close();
  });
});
