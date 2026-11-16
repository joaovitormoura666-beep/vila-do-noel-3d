import type { WebSocket } from 'ws';
import type {
  ClientRole,
  DenyReason,
  GameStatus,
  LiveEvent,
  LogEntry,
  QueueResult,
  Settings,
  ToClient,
  ToServer,
} from '../shared/types.js';
import { AMBIENT_LABELS, giftToAmbientEffect, isAmbientEffect, type AmbientEffectId } from '../shared/ambient.js';
import type { TikTokPanelInfo } from '../shared/tiktok.js';
import { EventDeduper } from './dedup.js';
import { cleanNickname, eventToParticipant } from './rules.js';
import { TokenBucket } from './security.js';
import type { SettingsStore } from './settingsStore.js';
import type { SimulatorSource } from './integrations/SimulatorSource.js';

interface Client {
  ws: WebSocket;
  role: ClientRole | null;
  ip: string;
  bucket: TokenBucket;
  /** Linhas de registro que esta tela do jogo pode gerar (o excesso é descartado). */
  logBucket: TokenBucket;
  dropped: number;
  helloTimer: NodeJS.Timeout | null;
}

/**
 * O que cada papel pode mandar. Tudo o que não está aqui é ignorado.
 * - A tela do jogo (aberta no OBS, sem senha) só informa o que está acontecendo nela.
 * - O painel (com a senha, quando o servidor exige) é quem muda configurações, comanda a
 *   fila e usa o simulador.
 * Ao criar uma mensagem nova que muda o estado (ex.: disparar um efeito ambiental),
 * coloque-a em PANEL_MESSAGES: assim ela já exige a senha.
 */
const GAME_MESSAGES: ReadonlySet<ToServer['t']> = new Set(['status', 'queueResult', 'delivered']);
const PANEL_MESSAGES: ReadonlySet<ToServer['t']> = new Set(['simulate', 'command', 'settings', 'resetSettings', 'ambient', 'tiktokConfig']);

export interface HubOptions {
  /**
   * Confere a senha do painel. Devolve null quando pode entrar, ou o motivo da recusa.
   * Sem esta função o painel entra sem senha (modo local de sempre).
   */
  authorizePanel?: (token: unknown, ip: string) => DenyReason | null;
  /**
   * Confere a chave da tela do jogo (?tela= no endereço do OBS). Sem esta função a tela
   * conecta sem chave (modo local de sempre).
   */
  authorizeGame?: (token: unknown, ip: string) => DenyReason | null;
  /** Chave da tela, mandada só ao painel já autenticado (ele monta o endereço do OBS). */
  screenKey?: string | null;
  /** Telas do jogo ao mesmo tempo (padrão 4). */
  maxScreens?: number;
  /** O servidor exige senha do painel? (só informa o painel, para mostrar o botão "Sair"). */
  requiresToken?: boolean;
  msgsPerSec?: number;
  msgBurst?: number;
  /** Tempo para a conexão se identificar (mensagem hello) antes de ser fechada. */
  helloTimeoutMs?: number;
  /** Situação da leitura da live do TikTok, mandada ao painel quando ele entra. */
  tiktokInfo?: () => TikTokPanelInfo;
  /** O painel mudou a configuração do TikTok (o servidor salva e reconecta). */
  onTikTokConfig?: (msg: Extract<ToServer, { t: 'tiktokConfig' }>) => void;
  /** A tela do jogo aceitou na fila alguém que veio desta fonte ('tiktok', 'simulador'...). */
  onQueueAccepted?: (source: string) => void;
  /** Um presente desta fonte pediu um efeito ambiente. */
  onGiftEffect?: (source: string) => void;
}

const QUEUE_RESULTS: ReadonlySet<string> = new Set<QueueResult>(['aceito', 'duplicado', 'fila_cheia', 'aguardando_intervalo']);
const QUALITIES = new Set(['alta', 'media', 'baixa']);
const VOICE_STATES = new Set(['ok', 'sem_teste', 'indisponivel']);

const num = (v: unknown, min: number, max: number, int = false) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return min;
  const c = Math.min(max, Math.max(min, n));
  return int ? Math.round(c) : c;
};

/** Confere o estado mandado pela tela do jogo antes de repassar ao painel. */
export function sanitizeStatus(raw: unknown): GameStatus | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Record<string, unknown>;
  const status: GameStatus = {
    fps: num(s.fps, 0, 1000, true),
    quality: (QUALITIES.has(String(s.quality)) ? s.quality : 'alta') as GameStatus['quality'],
    queueLength: num(s.queueLength, 0, 100_000, true),
    visible: num(s.visible, 0, 1000, true),
    waitingOffscreen: num(s.waitingOffscreen, 0, 100_000, true),
    current: typeof s.current === 'string' && s.current ? cleanNickname(s.current) : undefined,
    served: num(s.served, 0, 10_000_000, true),
    paused: Boolean(s.paused),
    effectiveSpeed: num(s.effectiveSpeed, 0, 10),
    audioLocked: s.audioLocked === undefined ? undefined : Boolean(s.audioLocked),
  };
  if (s.voice && typeof s.voice === 'object') {
    const v = s.voice as Record<string, unknown>;
    status.voice = {
      state: (VOICE_STATES.has(String(v.state)) ? v.state : 'indisponivel') as NonNullable<GameStatus['voice']>['state'],
      name: String(v.name ?? '').slice(0, 80),
      recorded: num(v.recorded, 0, 100_000, true),
    };
  }
  return status;
}

const COMMAND_TEXT: Record<string, string> = {
  skip: 'pular a pessoa atual',
  clear: 'limpar a fila',
  test_voice: 'testar a voz do Noel',
  reload: 'recarregar a tela do jogo',
};

const RESULT_TEXT: Record<string, string> = {
  aceito: 'entrou na fila',
  duplicado: 'já está na fila (ignorado)',
  fila_cheia: 'não entrou: fila cheia',
  aguardando_intervalo: 'não entrou: aguardando intervalo para participar de novo',
};

/**
 * Centro de eventos: recebe eventos de qualquer fonte, descarta duplicados,
 * aplica as regras de participação e distribui para a tela do jogo e o painel.
 */
export class EventHub {
  private clients = new Set<Client>();
  private deduper = new EventDeduper();
  private log: LogEntry[] = [];
  private lastStatus: GameStatus | null = null;
  private counters = { recebidos: 0, duplicados: 0, ignorados: 0, enviados: 0, efeitos: 0 };
  /** De que fonte veio cada participante enviado ao jogo (para contar quem entrou na fila por fonte). */
  private sentFrom = new Map<string, string>();
  /** Presentes que já pediram efeito (o mesmo evento repetido numa reconexão não pede de novo). */
  private effectSeen = new Set<string>();
  /** Proteção contra excesso de efeitos pedidos por presentes: 1 a cada 4 s, com folga de 3. */
  private giftEffectBucket = new TokenBucket(0.25, 3);

  constructor(
    private readonly settings: SettingsStore,
    private readonly simulator: SimulatorSource,
    private readonly options: HubOptions = {},
  ) {}

  /* ---------- entrada de eventos ---------- */

  ingest(ev: LiveEvent) {
    this.counters.recebidos++;
    const cfg = this.settings.get();
    // o efeito ambiente vale para todo presente, mesmo de quem já está na fila
    if (ev.type === 'gift') this.giftEffect(ev);
    const participant = eventToParticipant(ev, cfg);
    if (!participant) {
      this.counters.ignorados++;
      return;
    }
    if (!this.deduper.accept(ev.eventId, ev.userId, ev.streakId)) {
      this.counters.duplicados++;
      this.addLog('warn', `Evento duplicado de ${participant.nickname} descartado`);
      return;
    }
    if (this.gameCount() === 0) {
      this.addLog('erro', `${participant.nickname} não entrou: a tela do jogo não está aberta`);
      return;
    }
    this.counters.enviados++;
    this.sentFrom.set(ev.eventId, ev.source);
    if (this.sentFrom.size > 3000) {
      const oldest = this.sentFrom.keys().next().value;
      if (oldest !== undefined) this.sentFrom.delete(oldest);
    }
    this.broadcast('game', { t: 'participant', p: participant });
  }

  /* ---------- efeitos ambientes ---------- */

  /** Aplica a regra "presente → efeito" do painel a um presente que chegou. */
  private giftEffect(ev: LiveEvent) {
    const match = giftToAmbientEffect(ev, this.settings.get().ambientGifts);
    if (!match) return;
    if (this.effectSeen.has(ev.eventId) || (ev.streakId && this.effectSeen.has(`s:${ev.streakId}`))) return;
    this.effectSeen.add(ev.eventId);
    if (ev.streakId) this.effectSeen.add(`s:${ev.streakId}`);
    if (this.effectSeen.size > 4000) {
      const oldest = this.effectSeen.values().next().value;
      if (oldest !== undefined) this.effectSeen.delete(oldest);
    }
    const why = match.reason === 'moedas' ? `presente de ${match.coins} moedas` : 'presente';
    // o registro não mostra quem mandou: só o presente e o efeito
    const gift = String(ev.giftName ?? 'presente').slice(0, 40);
    if (!this.giftEffectBucket.take()) {
      this.addLog('warn', `Efeito ${AMBIENT_LABELS[match.effect]} não tocou (${gift}): presentes demais seguidos; a proteção segurou`);
      return;
    }
    if (this.requestAmbient(match.effect, ev.source, `${why}: ${gift}`)) {
      this.counters.efeitos++;
      this.options.onGiftEffect?.(ev.source);
    }
  }

  /**
   * Manda a tela do jogo tocar um efeito ambiente. A prioridade, o descanso e o limite de
   * efeitos ao mesmo tempo ficam com o AmbientDirector do jogo. Devolve false sem tela aberta.
   */
  requestAmbient(effect: AmbientEffectId, source: string, why: string): boolean {
    if (this.gameCount() === 0) {
      this.addLog('warn', `Efeito ${AMBIENT_LABELS[effect]} não tocou (${why}): a tela do jogo não está aberta`);
      return false;
    }
    this.broadcast('game', { t: 'ambient', effect, source });
    // "pedido enviado", e não "tocou": a tela do jogo ainda decide (um efeito de presente em
    // descanso, ou com outros tocando, espera a vez ou fica de fora; os botões do painel passam
    // por cima do descanso)
    this.addLog('info', `✨ Efeito ${AMBIENT_LABELS[effect]}: pedido enviado à tela (${why})`);
    return true;
  }

  /** Manda ao painel a situação da leitura da live do TikTok. */
  pushTikTok(info: TikTokPanelInfo) {
    this.broadcast('panel', { t: 'tiktok', info });
  }

  /* ---------- conexões ---------- */

  /** Liga uma conexão WebSocket ao centro. `ip` é usado no limite de tentativas da senha. */
  attach(ws: WebSocket, meta: { ip?: string } = {}) {
    const client: Client = {
      ws,
      role: null,
      ip: meta.ip ?? 'desconhecido',
      bucket: new TokenBucket(this.options.msgsPerSec ?? 20, this.options.msgBurst ?? 60),
      // folga para o teste de carga do painel (+100 pessoas de uma vez), mas sem deixar uma
      // tela encher o registro do painel sem parar
      logBucket: new TokenBucket(10, 150),
      dropped: 0,
      helloTimer: null,
    };
    this.clients.add(client);
    // quem conecta e não se identifica logo é desligado (não ocupa vaga à toa)
    client.helloTimer = setTimeout(() => {
      if (!client.role) ws.close(4000, 'sem identificacao');
    }, this.options.helloTimeoutMs ?? 10_000);

    ws.on('message', (data, isBinary) => {
      if (!client.bucket.take()) {
        // mensagens demais: descarta; se continuar insistindo, desliga
        if (++client.dropped > 100) ws.close(1008, 'mensagens demais');
        return;
      }
      if (isBinary) return;
      let msg: unknown;
      try {
        msg = JSON.parse(String(data));
      } catch {
        return;
      }
      if (!msg || typeof msg !== 'object' || typeof (msg as { t?: unknown }).t !== 'string') return;
      this.onMessage(client, msg as ToServer);
    });

    ws.on('close', () => {
      if (client.helloTimer) clearTimeout(client.helloTimer);
      const wasPrimary = client.role === 'game' && this.primaryGame() === client;
      if (!this.clients.delete(client)) return; // já tinha sido removida (desligada para dar lugar a outra)
      if (client.role === 'game') {
        // o estado mostrado no painel é sempre o da tela mais antiga; se ela saiu, espera a próxima informar
        if (wasPrimary || this.gameCount() === 0) this.lastStatus = null;
        this.addLog('warn', 'Tela do jogo desconectada');
        this.pushStatus();
      }
    });
    ws.on('error', () => ws.close());
  }

  /** O papel de quem mandou pode enviar esta mensagem? */
  static allowed(role: ClientRole | null, type: string): boolean {
    if (role === 'game') return GAME_MESSAGES.has(type as ToServer['t']);
    if (role === 'panel') return PANEL_MESSAGES.has(type as ToServer['t']);
    return false;
  }

  private onMessage(client: Client, msg: ToServer) {
    if (msg.t === 'hello') {
      this.onHello(client, msg);
      return;
    }
    if (!EventHub.allowed(client.role, msg.t)) return;
    switch (msg.t) {
      case 'status':
        // com mais de uma tela aberta, o painel mostra a mais antiga (a que está no OBS desde o começo)
        if (this.primaryGame() !== client) return;
        this.lastStatus = sanitizeStatus(msg.status);
        this.pushStatus();
        break;
      case 'queueResult': {
        const result = String(msg.result);
        if (!QUEUE_RESULTS.has(result) || !client.logBucket.take()) return;
        this.addLog(result === 'aceito' ? 'ok' : 'warn', `${cleanNickname(msg.nickname)} ${RESULT_TEXT[result] ?? result}`);
        if (result === 'aceito') {
          const source = this.sentFrom.get(String(msg.eventId));
          if (source) {
            this.sentFrom.delete(String(msg.eventId));
            this.options.onQueueAccepted?.(source);
          }
        }
        break;
      }
      case 'delivered':
        if (!client.logBucket.take()) return;
        this.addLog('info', `🎁 ${cleanNickname(msg.nickname)} recebeu: ${String(msg.gift ?? '').slice(0, 60)}`);
        break;
      case 'simulate': {
        const count = Math.max(1, Math.min(200, Math.round(Number(msg.count ?? 1)) || 1));
        this.simulator.simulate(msg.kind, count);
        if (count > 1) this.addLog('info', `Simulador: ${count} participantes fictícios a caminho`);
        break;
      }
      case 'command':
        if (!Object.hasOwn(COMMAND_TEXT, String(msg.cmd))) return;
        this.broadcast('game', { t: 'command', cmd: msg.cmd });
        this.addLog('info', `Painel: ${COMMAND_TEXT[msg.cmd]}`);
        break;
      case 'settings':
        if (!msg.patch || typeof msg.patch !== 'object') return;
        this.applySettings(this.settings.update(msg.patch));
        this.warnIfNotSaved();
        break;
      case 'resetSettings':
        this.applySettings(this.settings.reset());
        this.addLog('info', 'Configurações restauradas para o padrão');
        this.warnIfNotSaved();
        break;
      case 'ambient':
        if (!isAmbientEffect(msg.effect)) return;
        this.requestAmbient(msg.effect, 'painel', 'pedido pelo painel');
        break;
      case 'tiktokConfig':
        this.options.onTikTokConfig?.(msg);
        break;
    }
  }

  private onHello(client: Client, msg: Extract<ToServer, { t: 'hello' }>) {
    if (client.role) return; // o papel é definido uma vez só por conexão
    const role: ClientRole = msg.role === 'panel' ? 'panel' : 'game';
    const authorize = role === 'panel' ? this.options.authorizePanel : this.options.authorizeGame;
    let denied = authorize ? authorize(msg.token, client.ip) : null;
    if (!denied && role === 'game' && this.gameCount() >= (this.options.maxScreens ?? 4)) denied = 'telas_demais';
    if (denied) {
      if (denied === 'telas_demais') this.addLog('warn', 'Uma tela do jogo a mais tentou conectar e foi recusada (limite MAX_TELAS)');
      this.send(client, { t: 'denied', reason: denied });
      client.ws.close(4001, denied);
      return;
    }
    client.role = role;
    if (client.helloTimer) clearTimeout(client.helloTimer);
    client.helloTimer = null;
    const screenKey = role === 'panel' && this.options.screenKey ? { screenKey: this.options.screenKey } : {};
    this.send(client, { t: 'welcome', role, requiresToken: Boolean(this.options.requiresToken), ...screenKey });
    this.send(client, { t: 'settings', settings: this.settings.get() });
    if (role === 'panel') {
      this.send(client, { t: 'logHistory', entries: this.log.slice(-150) });
      if (this.options.tiktokInfo) this.send(client, { t: 'tiktok', info: this.options.tiktokInfo() });
    } else {
      this.addLog('ok', 'Tela do jogo conectada');
    }
    this.pushStatus();
  }

  private applySettings(settings: Settings) {
    this.broadcast(null, { t: 'settings', settings });
  }

  private lastSaveWarning = 0;

  /** Avisa no painel (no máximo uma vez por minuto) quando as configurações não puderam ser gravadas. */
  private warnIfNotSaved() {
    if (this.settings.lastSaveOk || Date.now() - this.lastSaveWarning < 60_000) return;
    this.lastSaveWarning = Date.now();
    this.addLog(
      'erro',
      'O servidor não conseguiu gravar as configurações (pasta DATA_DIR sem permissão de escrita). Elas valem até o servidor reiniciar; veja o registro do servidor.',
    );
  }

  /* ---------- saída ---------- */

  private gameCount() {
    let n = 0;
    for (const c of this.clients) if (c.role === 'game') n++;
    return n;
  }

  /** A tela do jogo conectada há mais tempo (o Set guarda a ordem de chegada). */
  private primaryGame(): Client | null {
    for (const c of this.clients) if (c.role === 'game') return c;
    return null;
  }

  /** Conexões abertas agora (inclusive as que ainda não se identificaram). */
  connectionCount() {
    return this.clients.size;
  }

  /**
   * Abre espaço para uma conexão nova desligando a mais antiga que ainda não se identificou.
   * Quem é de verdade manda o "hello" logo ao conectar; quem só ocupa vaga é quem sai.
   * Devolve false quando todas as conexões já estão identificadas.
   */
  evictOldestPending(): boolean {
    for (const c of this.clients) {
      if (c.role) continue;
      this.clients.delete(c);
      if (c.helloTimer) clearTimeout(c.helloTimer);
      c.ws.terminate();
      return true;
    }
    return false;
  }

  private pushStatus() {
    this.broadcast('panel', { t: 'status', status: this.lastStatus, games: this.gameCount() });
  }

  addLog(level: LogEntry['level'], text: string) {
    const entry: LogEntry = { ts: Date.now(), level, text };
    this.log.push(entry);
    if (this.log.length > 400) this.log.splice(0, this.log.length - 400);
    this.broadcast('panel', { t: 'log', entry });
  }

  private send(client: Client, msg: ToClient) {
    if (client.ws.readyState === client.ws.OPEN) client.ws.send(JSON.stringify(msg));
  }

  private broadcast(role: ClientRole | null, msg: ToClient) {
    const data = JSON.stringify(msg);
    for (const c of this.clients) {
      if (role && c.role !== role) continue;
      if (c.ws.readyState === c.ws.OPEN) c.ws.send(data);
    }
  }

  stats() {
    return { ...this.counters, jogosConectados: this.gameCount(), status: this.lastStatus };
  }

  /** Fecha todas as conexões (usado ao desligar o servidor). */
  closeAll() {
    for (const c of this.clients) {
      if (c.helloTimer) clearTimeout(c.helloTimer);
      c.ws.terminate();
    }
    this.clients.clear();
  }
}
