/**
 * Tipos compartilhados entre o servidor (Node) e os clientes (jogo e painel).
 * Toda fonte de eventos (simulador, webhook, leitura da live do TikTok)
 * precisa converter seus dados para `LiveEvent` antes de entrar no sistema.
 */

import { DEFAULT_AMBIENT_GIFTS, type AmbientEffectId, type AmbientGiftRule } from './ambient.js';
import type { TikTokPanelInfo } from './tiktok.js';

export type LiveEventType = 'gift' | 'chat' | 'follow' | 'like' | 'share' | 'join';

export interface LiveEvent {
  /** Identificador único do evento (usado para descartar duplicados). */
  eventId: string;
  type: LiveEventType;
  /** Identificador estável do usuário (ex.: userId numérico do TikTok). */
  userId: string;
  /** Nome exibido. */
  nickname: string;
  /** URL da foto de perfil, quando disponível. */
  avatarUrl?: string;
  giftName?: string;
  giftCount?: number;
  /** Moedas por unidade do presente (no TikTok, diamondCount), quando a fonte informa. */
  diamondCount?: number;
  /** Para presentes em sequência (combo): só o primeiro evento da sequência conta. */
  streakId?: string;
  comment?: string;
  /** Origem do evento: 'simulador', 'webhook', 'tiktok' ... */
  source: string;
  ts: number;
}

/** Participante normalizado que vai para a fila do jogo. */
export interface Participant {
  userId: string;
  nickname: string;
  avatarUrl?: string;
  /** Como entrou: presente ou comando gratuito do chat. */
  via: 'presente' | 'comando' | 'outro';
  giftName?: string;
  eventId: string;
  ts: number;
}

export type QueueResult = 'aceito' | 'duplicado' | 'fila_cheia' | 'aguardando_intervalo';

export type Quality = 'auto' | 'alta' | 'media' | 'baixa';

export interface Settings {
  paused: boolean;
  /** Multiplicador de velocidade (0.5 a 3). */
  speed: number;
  /** Acelera sozinho quando a fila cresce (até dobrar a velocidade com 40+ pessoas). */
  autoSpeed: boolean;
  volumes: { master: number; music: number; sfx: number; voice: number };
  voiceEnabled: boolean;
  speakNames: boolean;
  quality: Quality;
  /** Personagens desenhados ao mesmo tempo na fila. */
  maxVisible: number;
  /** Tamanho máximo da fila lógica (visíveis + aguardando). */
  maxQueue: number;
  /** Segundos até a mesma pessoa poder entrar de novo depois de atendida. */
  rejoinCooldownSec: number;
  chatCommands: string[];
  giftJoins: boolean;
  followJoins: boolean;
  showFps: boolean;
  /** Intervalo (s) entre falas do Noel quando a fila está vazia. 0 desliga. */
  idleHintSec: number;
  /** Texto de instrução exibido abaixo do título. */
  hintText: string;
  /** Qual presente da live dispara qual efeito ambiente (padrão PROVISÓRIO; veja shared/ambient.ts). */
  ambientGifts: AmbientGiftRule;
}

export const DEFAULT_SETTINGS: Settings = {
  paused: false,
  speed: 1,
  autoSpeed: true,
  volumes: { master: 0.8, music: 0.35, sfx: 0.7, voice: 1 },
  voiceEnabled: true,
  speakNames: true,
  quality: 'auto',
  maxVisible: 11,
  maxQueue: 150,
  rejoinCooldownSec: 0,
  chatCommands: ['!presente', '!noel', '!fila'],
  giftJoins: true,
  followJoins: false,
  showFps: false,
  idleHintSec: 45,
  hintText: 'Digite !presente no chat ou envie uma 🌹 para entrar na fila',
  ambientGifts: DEFAULT_AMBIENT_GIFTS,
};

export interface GameStatus {
  fps: number;
  quality: Exclude<Quality, 'auto'>;
  queueLength: number;
  visible: number;
  waitingOffscreen: number;
  current?: string;
  served: number;
  paused: boolean;
  /** Velocidade em uso agora (base x aceleração automática). */
  effectiveSpeed: number;
  /** Situação da voz do Noel nesta tela (a síntese depende do navegador). */
  voice?: { state: 'ok' | 'sem_teste' | 'indisponivel'; name: string; recorded: number };
  /** true enquanto o navegador não liberou o som (falta um clique na tela do jogo). */
  audioLocked?: boolean;
}

export type GameCommand = 'skip' | 'clear' | 'test_voice' | 'reload';

export type SimKind =
  | 'rosa'
  | 'comando'
  | 'presente_aleatorio'
  | 'presente_grande'
  | 'com_foto'
  | 'duplicado'
  | 'mesmo_usuario'
  | 'seguir';

export interface LogEntry {
  ts: number;
  level: 'info' | 'ok' | 'warn' | 'erro';
  text: string;
}

/* ---------- Protocolo WebSocket ---------- */

export type ClientRole = 'game' | 'panel';

/**
 * Por que o servidor recusou a conexão:
 * - token_ausente: o servidor exige a senha do painel (TOKEN_ADMIN), ou a chave da tela do
 *   jogo (?tela= no endereço do OBS), e ela não foi enviada;
 * - token_invalido: a senha (ou a chave da tela) enviada está errada;
 * - bloqueado: tentativas erradas demais deste endereço; espere alguns minutos;
 * - telas_demais: já há telas do jogo demais conectadas (MAX_TELAS).
 */
export type DenyReason = 'token_ausente' | 'token_invalido' | 'bloqueado' | 'telas_demais';

export type ToServer =
  /**
   * Primeira mensagem de toda conexão. O painel manda a senha (TOKEN_ADMIN) em `token`;
   * a tela do jogo manda ali a chave da tela (?tela= do endereço), quando o servidor exige.
   */
  | { t: 'hello'; role: ClientRole; token?: string }
  | { t: 'status'; status: GameStatus }
  | { t: 'queueResult'; eventId: string; nickname: string; result: QueueResult }
  | { t: 'delivered'; nickname: string; gift: string }
  | { t: 'simulate'; kind: SimKind; count?: number }
  | { t: 'command'; cmd: GameCommand }
  | { t: 'settings'; patch: Partial<Settings> }
  | { t: 'resetSettings' }
  /** Painel: tocar um efeito ambiente agora na tela do jogo. */
  | { t: 'ambient'; effect: AmbientEffectId }
  /**
   * Painel: configurar a leitura da live do TikTok. Só os campos enviados mudam.
   * `chave`: texto define a chave do Euler Stream; null apaga a chave salva pelo painel.
   */
  | { t: 'tiktokConfig'; usuario?: string; ligado?: boolean; chave?: string | null };

export type ToClient =
  /**
   * Conexão aceita. `requiresToken` diz se este servidor exige a senha do painel.
   * Só o painel recebe `screenKey`: a chave que a tela do jogo precisa (para montar o endereço do OBS).
   */
  | { t: 'welcome'; role: ClientRole; requiresToken: boolean; screenKey?: string }
  /** Conexão recusada (o servidor fecha em seguida). */
  | { t: 'denied'; reason: DenyReason }
  | { t: 'participant'; p: Participant }
  | { t: 'command'; cmd: GameCommand }
  | { t: 'settings'; settings: Settings }
  | { t: 'status'; status: GameStatus | null; games: number }
  | { t: 'log'; entry: LogEntry }
  | { t: 'logHistory'; entries: LogEntry[] }
  /** Tela do jogo: tocar um efeito ambiente (vindo do painel ou de um presente da live). */
  | { t: 'ambient'; effect: AmbientEffectId; source: string }
  /** Só o painel: situação da leitura da live do TikTok (a chave nunca vem). */
  | { t: 'tiktok'; info: TikTokPanelInfo };
