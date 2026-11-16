import type { LiveEvent } from '../../shared/types.js';
import { EMPTY_TIKTOK_COUNTERS, type TikTokCounters, type TikTokState, type TikTokStatus } from '../../shared/tiktok.js';
import type { LiveSource } from './LiveSource.js';

/**
 * Leitura da live do TikTok pela biblioteca gratuita e NÃO OFICIAL "tiktok-live-connector"
 * (npm, licença AGPL-3.0). Ela entra na live pública pelo @ do criador, sem login e sem senha.
 * A conexão precisa de uma assinatura que vem do serviço Euler Stream (limite gratuito da
 * comunidade; uma chave gratuita aumenta o limite). O Euler Stream recebe só o @ da live.
 * Nunca usamos sessão, cookie nem senha do dono (nada de authenticateWs).
 *
 * O que esta fonte faz:
 * - converte cada evento da biblioteca para LiveEvent (shared/types.ts) e entrega ao EventHub;
 * - presentes em combo (rosas seguidas) só contam no fim da sequência (repeatEnd);
 * - espera a live começar (confere de tempos em tempos) sem derrubar o servidor;
 * - reconecta sozinha com espera crescente (2 s, 4 s, 8 s... até 1 minuto);
 * - uma conexão por vez: trocar de @ ou desligar encerra a anterior;
 * - informa a situação (estado, explicação em português, espectadores) e os contadores.
 *
 * Privacidade: no registro do servidor aparece só o @ do criador, nunca dados de quem assiste.
 *
 * A biblioteca é carregada só quando a leitura é ligada (import dinâmico). Os testes trocam a
 * biblioteca por um conector falso (opção `fabrica`).
 */

/* ---------------------------------------------------------------- conector */

/** O pedaço da biblioteca que usamos. O conector falso dos testes implementa só isto. */
export interface ConectorTikTok {
  on(evento: string, ouvinte: (...args: any[]) => void): unknown;
  removeAllListeners(evento?: string): unknown;
  connect(): Promise<unknown>;
  disconnect(): Promise<void>;
  /** Informações da sala depois de conectar (título, espectadores). */
  readonly roomInfo?: unknown;
}

export interface OpcoesConector {
  /** Chave opcional do Euler Stream. */
  chave: string | null;
}

/** Cria um conector para o @ dado. Os testes passam um conector falso. */
export type FabricaConector = (usuario: string, opcoes: OpcoesConector) => ConectorTikTok | Promise<ConectorTikTok>;

let chaveEmUso: string | null | undefined;

/** Fábrica de verdade: carrega a biblioteca só quando a leitura é ligada. */
export const fabricaPadrao: FabricaConector = async (usuario, { chave }) => {
  const mod = (await import('tiktok-live-connector')) as unknown as {
    TikTokLiveConnection: new (u: string, o: Record<string, unknown>) => ConectorTikTok;
    SignConfig: { apiKey?: string; cachedInstance?: unknown };
  };
  // A biblioteca guarda o cliente do Euler Stream num objeto global e só lê a chave na primeira
  // vez. Quando a chave muda (ou é apagada), refazemos esse cliente.
  if (chaveEmUso !== chave) {
    mod.SignConfig.apiKey = chave ?? undefined;
    mod.SignConfig.cachedInstance = undefined;
    chaveEmUso = chave;
  }
  return new mod.TikTokLiveConnection(usuario, {
    // não repetir os comentários antigos que vêm junto com a conexão
    processInitialData: false,
    // nome e valor (moedas) de cada presente, usados na regra presente → efeito
    enableExtendedGiftInfo: true,
    // confere se está ao vivo antes de abrir a conexão (erro UserOfflineError se não estiver)
    fetchRoomInfoOnConnect: true,
    ...(chave ? { signApiKey: chave } : {}),
  });
};

/* ---------------------------------------------------------------- conversão */

const str = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' || typeof v === 'bigint' ? String(v) : '');
const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const obj = (v: unknown): Record<string, any> | undefined => (v && typeof v === 'object' ? (v as Record<string, any>) : undefined);

function primeiraFoto(...listas: unknown[]): string | undefined {
  for (const l of listas) {
    const arr = Array.isArray(l) ? l : typeof l === 'string' ? [l] : [];
    for (const u of arr) if (typeof u === 'string' && /^https:\/\//i.test(u) && u.length <= 1000) return u;
  }
  return undefined;
}

interface Pessoa {
  userId: string;
  nickname: string;
  avatarUrl?: string;
}

/**
 * Quem mandou o evento. A biblioteca 2.x entrega o formato novo (user.id, user.displayId,
 * user.avatarThumb.urlList); o formato antigo (uniqueId, profilePictureUrl) também é aceito.
 */
export function pessoaDoEvento(dados: unknown): Pessoa | null {
  const d = obj(dados);
  if (!d) return null;
  const u = obj(d.user) ?? obj(d.userDetails) ?? d;
  const handle = str(u.uniqueId) || str(u.displayId);
  const id = str(u.userId) || str(u.id) || handle;
  if (!id || id === '0') return null;
  const nickname = str(u.nickname) || handle || 'Visitante';
  const avatarUrl = primeiraFoto(
    u.profilePictureUrl,
    obj(u.avatarThumb)?.urlList,
    obj(u.avatarMedium)?.urlList,
    obj(u.avatarLarge)?.urlList,
    obj(u.profilePicture)?.urls,
    obj(u.profilePicture)?.url,
    obj(d.userDetails)?.profilePictureUrls,
  );
  return { userId: `tiktok:${id.slice(0, 60)}`, nickname: nickname.slice(0, 80), avatarUrl };
}

export interface PresenteLido {
  nome: string;
  quantidade: number;
  /** Moedas por unidade, quando conhecido. */
  moedas?: number;
  /** Presente que pode vir em combo (giftType 1). */
  combo: boolean;
  fimDaSequencia: boolean;
  giftId: string;
  groupId: string;
}

export function lerPresente(dados: unknown): PresenteLido {
  const d = obj(dados) ?? {};
  const g = obj(d.gift) ?? {};
  const det = obj(d.giftDetails) ?? {};
  const ext = obj(d.extendedGiftInfo) ?? {};
  const tipo = num(g.type ?? det.giftType ?? d.giftType ?? ext.type);
  const moedas = num(g.diamondCount ?? det.diamondCount ?? ext.diamond_count ?? ext.diamondCount ?? d.diamondCount);
  return {
    nome: (str(g.name) || str(det.giftName) || str(ext.name) || str(d.giftName) || 'Presente').slice(0, 60),
    quantidade: Math.max(1, Math.round(num(d.repeatCount) || num(d.comboCount) || 1)),
    moedas: moedas > 0 ? moedas : undefined,
    combo: tipo === 1,
    fimDaSequencia: Boolean(d.repeatEnd),
    giftId: str(d.giftId) || str(g.id) || '0',
    groupId: str(d.groupId) || '0',
  };
}

/** Tipos de evento da biblioteca que viram LiveEvent. */
export const EVENTOS_LIDOS = ['chat', 'gift', 'like', 'follow', 'share', 'member'] as const;
export type EventoLido = (typeof EVENTOS_LIDOS)[number];

/** Combo sem novidade há este tempo é dado como terminado (o fim pode se perder numa queda). */
const COMBO_ESQUECIDO_MS = 15_000;
/** Por quanto tempo lembrar de um combo já contado (para o fim atrasado não contar de novo). */
const COMBO_LEMBRADO_MS = 60_000;

/**
 * Converte eventos da biblioteca em LiveEvent. Guarda os combos em andamento: um presente de
 * combo só vira evento quando a sequência termina (repeatEnd), com a quantidade final.
 */
export class ConversorTikTok {
  private seq = 0;
  private pendentes = new Map<string, { dados: unknown; inicio: number; ultimo: number }>();
  private contados = new Map<string, number>();

  converter(tipo: EventoLido, dados: unknown, agora = Date.now()): LiveEvent | null {
    const pessoa = pessoaDoEvento(dados);
    if (!pessoa) return null;
    const d = obj(dados) ?? {};
    const msgId = str(obj(d.common)?.msgId) || str(d.msgId);
    const base = (sufixo = ''): LiveEvent => ({
      eventId: msgId ? `tiktok:${msgId}${sufixo}` : `tiktok:${tipo}:${pessoa.userId}:${agora}:${++this.seq}`,
      type: 'chat',
      userId: pessoa.userId,
      nickname: pessoa.nickname,
      avatarUrl: pessoa.avatarUrl,
      source: 'tiktok',
      ts: agora,
    });
    switch (tipo) {
      case 'chat': {
        const comment = (str(d.content) || str(d.comment)).slice(0, 300);
        return { ...base(), type: 'chat', comment };
      }
      case 'gift':
        return this.presente(dados, pessoa, base, agora);
      case 'like':
        return { ...base(), type: 'like', giftCount: Math.max(1, Math.round(num(d.likeCount ?? d.count) || 1)) };
      case 'follow':
        return { ...base(), type: 'follow' };
      case 'share':
        return { ...base(), type: 'share' };
      case 'member':
        return { ...base(), type: 'join' };
    }
    return null;
  }

  private presente(dados: unknown, pessoa: Pessoa, base: (s?: string) => LiveEvent, agora: number): LiveEvent | null {
    const p = lerPresente(dados);
    if (!p.combo) return this.eventoPresente(base(), p);
    const chave = `${pessoa.userId}|${p.giftId}|${p.groupId}`;
    this.limpar(agora);
    if (!p.fimDaSequencia) {
      // combo em andamento: guarda o último (com a quantidade mais alta) e espera o fim
      const atual = this.pendentes.get(chave);
      if (!this.contados.has(chave)) this.pendentes.set(chave, { dados, inicio: atual?.inicio ?? agora, ultimo: agora });
      return null;
    }
    if (this.contados.has(chave)) return null; // fim que chegou depois de já ter sido contado
    const inicio = this.pendentes.get(chave)?.inicio ?? agora;
    this.pendentes.delete(chave);
    this.contados.set(chave, agora);
    return this.eventoPresente({ ...base(), streakId: `tiktok:${chave}:${inicio}` }, p);
  }

  private eventoPresente(ev: LiveEvent, p: PresenteLido): LiveEvent {
    return { ...ev, type: 'gift', giftName: p.nome, giftCount: p.quantidade, diamondCount: p.moedas };
  }

  /**
   * Fecha os combos que pararam de chegar há muito tempo (o fim pode ter se perdido numa
   * queda de conexão). Devolve os presentes que passam a contar.
   */
  varrer(agora = Date.now()): LiveEvent[] {
    const saida: LiveEvent[] = [];
    for (const [chave, pend] of this.pendentes) {
      if (agora - pend.ultimo < COMBO_ESQUECIDO_MS) continue;
      this.pendentes.delete(chave);
      const d = obj(pend.dados) ?? {};
      const fechado = { ...d, repeatEnd: 1 };
      const ev = this.converter('gift', fechado, agora);
      if (ev) saida.push(ev);
    }
    this.limpar(agora);
    return saida;
  }

  private limpar(agora: number) {
    for (const [chave, quando] of this.contados) if (agora - quando > COMBO_LEMBRADO_MS) this.contados.delete(chave);
    // proteção: uma live enorme não faz a memória crescer sem limite
    while (this.pendentes.size > 2000) {
      const primeira = this.pendentes.keys().next().value;
      if (primeira === undefined) break;
      this.pendentes.delete(primeira);
    }
  }

  /** Esquece os combos (ao trocar de @ ou desligar). */
  zerar() {
    this.pendentes.clear();
    this.contados.clear();
  }
}

/* ---------------------------------------------------------------- erros */

export type TipoDeErro = 'offline' | 'limite' | 'usuario_invalido' | 'sem_internet' | 'nao_encontrado' | 'biblioteca' | 'outro';

const REDE = /ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENETUNREACH|socket hang up|timed? ?out/i;

/**
 * Erros de dentro de um erro composto da biblioteca (ex.: "Failed to retrieve Room ID from all
 * sources" guarda em config.requestErrs o erro de cada caminho tentado).
 */
function errosInternos(err: unknown, nivel = 0): unknown[] {
  const e = obj(err);
  if (!e || nivel > 3) return [];
  const cfg = obj(e.config);
  const filhos = [...(Array.isArray(cfg?.requestErrs) ? cfg.requestErrs : []), cfg?.requestErr, e.cause].filter(Boolean);
  return filhos.flatMap((f) => [f, ...errosInternos(f, nivel + 1)]);
}

/** Classifica um erro da biblioteca para escolher a espera e a explicação ao dono. */
export function classificarErro(err: unknown): { tipo: TipoDeErro; esperaMs?: number } {
  const e = obj(err) ?? {};
  const ctor = (err as { constructor?: unknown } | null)?.constructor;
  const nome = (typeof ctor === 'function' ? ctor.name : '') || str(e.name);
  const msg = `${str(e.message)} ${str(e.reason)}`;
  const code = str(e.code);
  if (nome === 'UserOfflineError' || /isn't online|not live|offline/i.test(msg)) return { tipo: 'offline' };
  if (nome === 'SignatureRateLimitError' || /rate limit/i.test(msg)) {
    const espera = num(e.retryAfter);
    return { tipo: 'limite', esperaMs: espera > 0 ? espera : undefined };
  }
  if (nome === 'InvalidUniqueIdError') return { tipo: 'usuario_invalido' };
  if (code === 'ERR_MODULE_NOT_FOUND' || /Cannot find (package|module) 'tiktok-live-connector'/i.test(msg)) return { tipo: 'biblioteca' };
  if (REDE.test(`${code} ${msg}`) || errosInternos(err).some((i) => REDE.test(`${str(obj(i)?.code)} ${str(obj(i)?.message)}`))) {
    return { tipo: 'sem_internet' };
  }
  if (/room ?id|user not found|does not exist/i.test(msg)) return { tipo: 'nao_encontrado' };
  return { tipo: 'outro' };
}

/* ---------------------------------------------------------------- fonte */

/** Esperas entre tentativas depois de uma queda: 2 s, 4 s, 8 s, 16 s, 32 s e depois 1 minuto. */
export function esperaReconexao(tentativa: number): number {
  return Math.min(60_000, 2000 * 2 ** Math.max(0, tentativa - 1));
}
/** Espera entre as conferências de "já começou a live?": 30 s nos primeiros 10 minutos, depois 1 minuto. */
export function esperaLive(conferencias: number): number {
  return conferencias < 20 ? 30_000 : 60_000;
}

/** Uma conexão que durou isto sem cair zera a contagem de tentativas. */
const CONEXAO_ESTAVEL_MS = 60_000;
/** Uma tentativa de conexão que não termina neste tempo conta como falha (a internet pode travar). */
const TEMPO_LIMITE_CONEXAO_MS = 45_000;

function comTempoLimite<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(Object.assign(new Error('timed out'), { code: 'ETIMEDOUT' })), ms);
    t.unref?.();
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

export interface TikTokSourceOptions {
  fabrica?: FabricaConector;
  /** Chamado quando o estado ou os contadores mudam (os contadores, no máximo uma vez por segundo). */
  aoMudar?: () => void;
  /** Linha para o registro do painel (sem dados de quem assiste). */
  registrar?: (nivel: 'info' | 'ok' | 'warn' | 'erro', texto: string) => void;
  /** Relógio (os testes usam o relógio falso do Vitest; padrão Date.now). */
  agora?: () => number;
}

export interface TikTokConfigAtiva {
  usuario: string;
  ligado: boolean;
  chave: string | null;
}

export class TikTokSource implements LiveSource {
  readonly name = 'tiktok';
  private emit: ((ev: LiveEvent) => void) | null = null;
  private readonly fabrica: FabricaConector;
  private readonly agora: () => number;
  private readonly conversor = new ConversorTikTok();

  private config: TikTokConfigAtiva = { usuario: '', ligado: false, chave: null };
  /** Muda a cada troca de configuração: respostas de conexões antigas são ignoradas. */
  private geracao = 0;
  private conector: ConectorTikTok | null = null;
  private timer: NodeJS.Timeout | null = null;
  private varredura: NodeJS.Timeout | null = null;
  private avisoTimer: NodeJS.Timeout | null = null;
  private tentativas = 0;
  private conferencias = 0;
  private conectadoEm = 0;

  private _status: TikTokStatus;
  private _contadores: TikTokCounters = { ...EMPTY_TIKTOK_COUNTERS };

  constructor(private readonly options: TikTokSourceOptions = {}) {
    this.fabrica = options.fabrica ?? fabricaPadrao;
    this.agora = options.agora ?? Date.now;
    this._status = this.novoStatus('desligado', 'Escreva o @ da sua conta do TikTok e clique em Conectar.');
  }

  /* ---------- LiveSource ---------- */

  start(emit: (ev: LiveEvent) => void) {
    this.emit = emit;
  }

  stop() {
    this.emit = null;
    this.desligarConexao();
    if (this.avisoTimer) clearTimeout(this.avisoTimer);
    this.avisoTimer = null;
  }

  /* ---------- leitura de fora ---------- */

  get status(): TikTokStatus {
    return this._status;
  }

  get contadores(): TikTokCounters {
    return this._contadores;
  }

  /** O EventHub avisa quando a tela do jogo aceitou na fila alguém que veio da live. */
  contarEntradaNaFila() {
    this._contadores.entraramNaFila++;
    this.avisar(false);
  }

  /** O servidor avisa quando um presente da live pediu um efeito ambiente. */
  contarEfeito() {
    this._contadores.efeitos++;
    this.avisar(false);
  }

  /**
   * Aplica a configuração (do painel ou do .env). Só reconecta quando algo mudou de verdade:
   * trocar de @, ligar, desligar ou trocar a chave; ou quando `tentarAgora` pede uma tentativa
   * imediata (o dono clicou em Conectar enquanto o jogo esperava a live ou depois de um erro).
   */
  configurar(nova: TikTokConfigAtiva, tentarAgora = false) {
    const ligado = nova.ligado && nova.usuario !== '';
    // "Conectar" de novo enquanto espera ou depois de um erro: tenta agora, sem esperar o relógio
    const repetir = tentarAgora && ligado && this._status.state !== 'conectado' && this._status.state !== 'conectando';
    const mudou = repetir || nova.usuario !== this.config.usuario || ligado !== this.config.ligado || nova.chave !== this.config.chave;
    const trocouUsuario = nova.usuario !== this.config.usuario;
    this.config = { usuario: nova.usuario, ligado, chave: nova.chave };
    if (!mudou) return;
    this.desligarConexao();
    if (trocouUsuario) this._contadores = { ...EMPTY_TIKTOK_COUNTERS };
    if (!ligado) {
      this.mudarEstado(
        'desligado',
        nova.usuario
          ? `A leitura da live de @${nova.usuario} está desligada. Clique em Conectar quando for começar.`
          : 'Escreva o @ da sua conta do TikTok e clique em Conectar.',
      );
      return;
    }
    this.log('info', `TikTok: conectando à live de @${nova.usuario}`);
    void this.tentar(this.geracao);
  }

  /* ---------- ciclo da conexão ---------- */

  private async tentar(geracao: number) {
    if (geracao !== this.geracao || !this.config.ligado) return;
    const usuario = this.config.usuario;
    this.mudarEstado('conectando', `Conectando à live de @${usuario}…`);
    let conector: ConectorTikTok;
    try {
      conector = await this.fabrica(usuario, { chave: this.config.chave });
    } catch (err) {
      if (geracao !== this.geracao) return;
      this.falhou(geracao, err);
      return;
    }
    if (geracao !== this.geracao) return;
    this.conector = conector;
    this.ouvir(conector, geracao);
    const conectando = conector.connect();
    try {
      await comTempoLimite(conectando, TEMPO_LIMITE_CONEXAO_MS);
    } catch (err) {
      // se a tentativa que estourou o tempo ainda conseguir conectar, fecha: uma conexão por vez
      conectando.then(
        () => void conector.disconnect().catch(() => {}),
        () => {},
      );
      if (geracao !== this.geracao) return;
      this.soltar(conector);
      this.falhou(geracao, err);
      return;
    }
    if (geracao !== this.geracao) {
      // desligaram enquanto conectava
      this.soltar(conector);
      return;
    }
    this.conectadoEm = this.agora();
    this.conferencias = 0;
    const info = obj(obj(conector.roomInfo)?.data) ?? obj(conector.roomInfo) ?? {};
    const sala = str(info.title).slice(0, 120) || undefined;
    const espectadores = num(info.user_count ?? info.userCount ?? obj(info.stats)?.user_count_composition) || undefined;
    this.mudarEstado('conectado', `Recebendo comentários e presentes da live de @${usuario}.`, { sala, espectadores });
    this.log('ok', `TikTok: conectado à live de @${usuario}`);
    if (!this.varredura) {
      this.varredura = setInterval(() => {
        for (const ev of this.conversor.varrer(this.agora())) this.entregar(ev);
      }, 5000);
      this.varredura.unref?.();
    }
  }

  private ouvir(conector: ConectorTikTok, geracao: number) {
    const valido = () => geracao === this.geracao && this.conector === conector;
    for (const tipo of EVENTOS_LIDOS) {
      conector.on(tipo, (dados: unknown) => {
        if (!valido()) return;
        try {
          const ev = this.conversor.converter(tipo, dados, this.agora());
          if (ev) this.entregar(ev);
        } catch {
          // um evento estranho não pode derrubar a leitura
        }
      });
    }
    conector.on('roomUser', (dados: unknown) => {
      if (!valido()) return;
      const d = obj(dados) ?? {};
      const n = num(d.total ?? d.viewerCount ?? d.totalUser);
      if (n > 0 && this._status.state === 'conectado' && n !== this._status.espectadores) {
        this._status = { ...this._status, espectadores: n };
        this.avisar(false);
      }
    });
    conector.on('streamEnd', () => {
      if (!valido()) return;
      this.log('info', `TikTok: a live de @${this.config.usuario} terminou`);
      this.soltar(conector);
      this.conferencias = 0;
      this.esperarLive(geracao, 'A live terminou. Quando você começar outra, o jogo conecta sozinho.');
    });
    conector.on('disconnected', () => {
      if (!valido() || this._status.state !== 'conectado') return;
      this.soltar(conector);
      if (this.agora() - this.conectadoEm > CONEXAO_ESTAVEL_MS) this.tentativas = 0;
      this.log('warn', `TikTok: a conexão com a live de @${this.config.usuario} caiu; tentando de novo`);
      this.reconectar(geracao, 'A conexão com a live caiu.');
    });
    // a biblioteca avisa erros por este evento; sem ouvinte ela só ignora, com ouvinte não derruba nada
    conector.on('error', () => {});
  }

  private falhou(geracao: number, err: unknown) {
    const { tipo, esperaMs } = classificarErro(err);
    const u = this.config.usuario;
    switch (tipo) {
      case 'offline':
        this.tentativas = 0;
        this.esperarLive(geracao, `@${u} não está ao vivo agora. Comece a live no TikTok: o jogo conecta sozinho.`);
        return;
      case 'usuario_invalido':
        this.mudarEstado('erro', `O TikTok não aceitou o @${u}. Confira se escreveu certo (sem espaços) e clique em Conectar de novo.`);
        this.log('erro', `TikTok: o @${u} não foi aceito`);
        return;
      case 'biblioteca':
        this.mudarEstado(
          'erro',
          'A peça que lê a live (tiktok-live-connector) não está instalada. Feche o jogo e abra de novo pelo iniciar.bat (ele roda o npm install).',
        );
        this.log('erro', 'TikTok: biblioteca tiktok-live-connector não encontrada (rode npm install)');
        return;
      case 'limite':
        this.reconectar(
          geracao,
          'O serviço gratuito que libera a conexão (Euler Stream) pediu uma pausa por excesso de pedidos. Uma chave gratuita do Euler Stream aumenta esse limite.',
          esperaMs,
        );
        return;
      case 'sem_internet':
        this.reconectar(geracao, 'Não consegui falar com o TikTok. Confira a internet deste computador.');
        return;
      case 'nao_encontrado':
        this.reconectar(geracao, `Não encontrei a live de @${u}. Confira se o @ está certo e se a live já começou.`);
        return;
      default:
        this.reconectar(geracao, 'O TikTok recusou a conexão desta vez.');
    }
  }

  private reconectar(geracao: number, motivo: string, esperaMinima = 0) {
    if (geracao !== this.geracao) return;
    this.tentativas++;
    const espera = Math.max(esperaReconexao(this.tentativas), Math.min(esperaMinima, 10 * 60_000));
    const quando = this.agora() + espera;
    const seg = Math.round(espera / 1000);
    this.mudarEstado('reconectando', `${motivo} Tentando de novo em ${seg} s.`, { proximaTentativa: quando, tentativa: this.tentativas });
    this.agendar(geracao, espera);
  }

  private esperarLive(geracao: number, mensagem: string) {
    if (geracao !== this.geracao) return;
    const espera = esperaLive(this.conferencias++);
    const quando = this.agora() + espera;
    if (this._status.state !== 'aguardando_live') this.log('info', `TikTok: esperando @${this.config.usuario} começar a live`);
    this.mudarEstado('aguardando_live', `${mensagem} (confere a cada ${Math.round(espera / 1000)} s)`, { proximaTentativa: quando });
    this.agendar(geracao, espera);
  }

  private agendar(geracao: number, ms: number) {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.tentar(geracao);
    }, ms);
    this.timer.unref?.();
  }

  /** Larga um conector: tira os ouvintes e fecha a conexão sem esperar. */
  private soltar(conector: ConectorTikTok) {
    if (this.conector === conector) this.conector = null;
    try {
      conector.removeAllListeners();
    } catch {
      /* nada */
    }
    // fechar pode demorar (espera o "close"); sem ouvintes, nada mais chega dele
    conector.on('error', () => {});
    void conector.disconnect().catch(() => {});
  }

  /** Encerra tudo: conexão, espera agendada e combos em andamento. A próxima geração começa limpa. */
  private desligarConexao() {
    this.geracao++;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (this.varredura) clearInterval(this.varredura);
    this.varredura = null;
    if (this.conector) this.soltar(this.conector);
    this.conector = null;
    this.tentativas = 0;
    this.conferencias = 0;
    this.conversor.zerar();
  }

  /* ---------- eventos e contadores ---------- */

  private entregar(ev: LiveEvent) {
    const c = this._contadores;
    if (ev.type === 'chat') c.comentarios++;
    else if (ev.type === 'gift') c.presentes++;
    else if (ev.type === 'like') c.curtidas += ev.giftCount ?? 1;
    else if (ev.type === 'follow') c.seguidores++;
    else if (ev.type === 'share') c.compartilhamentos++;
    if (ev.type !== 'join') this.avisar(false);
    this.emit?.(ev);
  }

  private novoStatus(state: TikTokState, mensagem: string, extra: Partial<TikTokStatus> = {}): TikTokStatus {
    return { state, usuario: this.config?.usuario ?? '', mensagem, desde: this.agora(), ...extra };
  }

  private mudarEstado(state: TikTokState, mensagem: string, extra: Partial<TikTokStatus> = {}) {
    const anterior = this._status.state;
    this._status = this.novoStatus(state, mensagem, extra);
    if (anterior !== state) console.log(`[tiktok] @${this.config.usuario || '-'}: ${state}`);
    this.avisar(true);
  }

  private log(nivel: 'info' | 'ok' | 'warn' | 'erro', texto: string) {
    this.options.registrar?.(nivel, texto);
  }

  /** Avisa quem mostra o estado. Mudança de estado avisa na hora; contadores, no máximo 1 vez por segundo. */
  private avisar(agora: boolean) {
    if (!this.options.aoMudar) return;
    if (agora) {
      if (this.avisoTimer) clearTimeout(this.avisoTimer);
      this.avisoTimer = null;
      this.options.aoMudar();
      return;
    }
    if (this.avisoTimer) return;
    this.avisoTimer = setTimeout(() => {
      this.avisoTimer = null;
      this.options.aoMudar?.();
    }, 1000);
    this.avisoTimer.unref?.();
  }
}
