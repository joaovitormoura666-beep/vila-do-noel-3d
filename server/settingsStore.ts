import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { DEFAULT_SETTINGS, type Settings } from '../shared/types.js';
import { sanitizeAmbientGiftRule } from '../shared/ambient.js';
import { normalizarUsuarioTikTok, type TikTokConfigOrigin, type TikTokPublicConfig } from '../shared/tiktok.js';

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** Garante que valores vindos do painel/arquivo estejam dentro de limites seguros. */
export function sanitizeSettings(input: Partial<Settings>, base: Settings = DEFAULT_SETTINGS): Settings {
  const s: Settings = { ...base, ...input, volumes: { ...base.volumes, ...(input.volumes ?? {}) } };
  s.speed = clamp(Number(s.speed) || 1, 0.5, 3);
  s.maxVisible = Math.round(clamp(Number(s.maxVisible) || 11, 3, 12));
  s.maxQueue = Math.round(clamp(Number(s.maxQueue) || 150, 5, 1000));
  s.rejoinCooldownSec = Math.round(clamp(Number(s.rejoinCooldownSec) || 0, 0, 3600));
  s.idleHintSec = Math.round(clamp(Number(s.idleHintSec) || 0, 0, 600));
  for (const k of ['master', 'music', 'sfx', 'voice'] as const) {
    s.volumes[k] = clamp(Number(s.volumes[k]), 0, 1);
    if (Number.isNaN(s.volumes[k])) s.volumes[k] = DEFAULT_SETTINGS.volumes[k];
  }
  if (!['auto', 'alta', 'media', 'baixa'].includes(s.quality)) s.quality = 'auto';
  s.chatCommands = (Array.isArray(s.chatCommands) ? s.chatCommands : DEFAULT_SETTINGS.chatCommands)
    .map((c) => String(c).trim().toLowerCase())
    .filter((c) => c.length > 0 && c.length <= 30)
    .slice(0, 10);
  s.hintText = String(s.hintText ?? '').replace(/\s+/g, ' ').trim().slice(0, 90);
  s.paused = Boolean(s.paused);
  s.autoSpeed = Boolean(s.autoSpeed);
  s.voiceEnabled = Boolean(s.voiceEnabled);
  s.speakNames = Boolean(s.speakNames);
  s.giftJoins = Boolean(s.giftJoins);
  s.followJoins = Boolean(s.followJoins);
  s.showFps = Boolean(s.showFps);
  s.ambientGifts = sanitizeAmbientGiftRule(input.ambientGifts, base.ambientGifts ?? DEFAULT_SETTINGS.ambientGifts);
  return s;
}

/** Grava um JSON trocando o arquivo de uma vez (se a máquina desligar no meio, o antigo continua inteiro). */
function writeJsonAtomic(file: string, data: unknown) {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2));
  renameSync(tmp, file);
}

export class SettingsStore {
  private settings: Settings;
  /** A última gravação deu certo? (false = pasta sem permissão, disco cheio...) */
  lastSaveOk = true;

  /** `file`: onde as configurações ficam salvas (data/configuracoes.json, ou dentro de DATA_DIR). */
  constructor(private readonly file: string) {
    this.settings = { ...DEFAULT_SETTINGS };
    try {
      if (existsSync(file)) {
        const raw = JSON.parse(readFileSync(file, 'utf8'));
        this.settings = sanitizeSettings(raw);
      }
    } catch (err) {
      console.warn('[config] Não foi possível ler configuracoes.json, usando padrão.', (err as Error).message);
    }
    // A live sempre começa sem pausa.
    this.settings.paused = false;
  }

  get(): Settings {
    return this.settings;
  }

  update(patch: Partial<Settings>): Settings {
    this.settings = sanitizeSettings(patch, this.settings);
    this.save();
    return this.settings;
  }

  reset(): Settings {
    this.settings = sanitizeSettings({}, DEFAULT_SETTINGS);
    this.save();
    return this.settings;
  }

  private save() {
    try {
      writeJsonAtomic(this.file, this.settings);
      this.lastSaveOk = true;
    } catch (err) {
      this.lastSaveOk = false;
      console.warn('[config] Falha ao salvar configurações:', (err as Error).message);
    }
  }
}

/* ---------- leitura da live do TikTok ---------- */

/** Valores do arquivo .env (TIKTOK_USUARIO, TIKTOK_LIGADO, EULER_API_KEY). */
export interface TikTokEnvConfig {
  usuario: string | null;
  ligado: boolean | null;
  chave: string | null;
}

/** Configuração em uso: o que vale agora, juntando o painel e o .env. */
export interface TikTokEffectiveConfig {
  usuario: string;
  ligado: boolean;
  /** Chave do Euler Stream. Só o servidor vê; nunca vai para o navegador. */
  chave: string | null;
  usuarioOrigem: TikTokConfigOrigin;
  chaveOrigem: TikTokConfigOrigin;
}

/** O que o painel pode mudar. `chave: null` apaga a chave salva pelo painel (volta a valer a do .env, se houver). */
export interface TikTokConfigPatch {
  usuario?: unknown;
  ligado?: unknown;
  chave?: unknown;
}

/** Chave do Euler Stream: texto visível, sem espaços, até 200 caracteres. */
export function sanitizeEulerKey(raw: unknown): string | null {
  const s = String(raw ?? '').trim();
  if (!s || s.length > 200 || !/^[\x21-\x7e]+$/.test(s)) return null;
  return s;
}

/**
 * Configuração da leitura da live, guardada à parte em data/tiktok.json (o configuracoes.json
 * vai para a tela do jogo; a chave do Euler Stream não pode ir).
 *
 * O .env dá o valor inicial; o que o dono muda no painel fica salvo aqui e passa a valer
 * mais que o .env. "Restaurar padrões" do painel não mexe nesta parte.
 */
export class TikTokConfigStore {
  private saved: { usuario?: string; ligado?: boolean; chave?: string } = {};
  lastSaveOk = true;

  constructor(
    private readonly file: string,
    private readonly env: TikTokEnvConfig = { usuario: null, ligado: null, chave: null },
  ) {
    try {
      if (existsSync(file)) {
        const raw = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
        const usuario = normalizarUsuarioTikTok(raw.usuario);
        if (usuario) this.saved.usuario = usuario;
        if (typeof raw.ligado === 'boolean') this.saved.ligado = raw.ligado;
        const chave = sanitizeEulerKey(raw.chave);
        if (chave) this.saved.chave = chave;
      }
    } catch (err) {
      console.warn('[tiktok] Não foi possível ler tiktok.json; usando o .env.', (err as Error).message);
    }
  }

  get(): TikTokEffectiveConfig {
    const envUser = normalizarUsuarioTikTok(this.env.usuario);
    const usuario = this.saved.usuario ?? envUser ?? '';
    const usuarioOrigem: TikTokConfigOrigin = this.saved.usuario ? 'painel' : envUser ? 'env' : null;
    // a chave salva pelo painel vale mais; apagada no painel, volta a valer a do .env (se houver)
    const envKey = sanitizeEulerKey(this.env.chave);
    const chave = this.saved.chave ?? envKey;
    const chaveOrigem: TikTokConfigOrigin = this.saved.chave ? 'painel' : envKey ? 'env' : null;
    const ligado = (this.saved.ligado ?? this.env.ligado ?? false) && usuario !== '';
    return { usuario, ligado, chave, usuarioOrigem, chaveOrigem };
  }

  /** Versão para o painel: sem a chave. */
  publicConfig(): TikTokPublicConfig {
    const c = this.get();
    return { usuario: c.usuario, ligado: c.ligado, chaveDefinida: Boolean(c.chave), chaveOrigem: c.chaveOrigem, usuarioOrigem: c.usuarioOrigem };
  }

  /**
   * Aplica uma mudança vinda do painel. Devolve um texto de erro (em português) quando o
   * @ não é válido; nesse caso nada muda.
   */
  update(patch: TikTokConfigPatch): string | null {
    const next = { ...this.saved };
    if (patch.usuario !== undefined) {
      const usuario = normalizarUsuarioTikTok(patch.usuario);
      if (!usuario) return 'Esse @ não parece uma conta do TikTok. Use só letras, números, ponto e sublinhado (ex.: @vila.do.noel).';
      next.usuario = usuario;
    }
    if (patch.ligado !== undefined) next.ligado = Boolean(patch.ligado);
    if (patch.chave !== undefined) {
      if (patch.chave === null || String(patch.chave).trim() === '') delete next.chave;
      else {
        const chave = sanitizeEulerKey(patch.chave);
        if (!chave) return 'A chave do Euler Stream tem caracteres que não servem (espaços ou acentos). Copie de novo do site.';
        next.chave = chave;
      }
    }
    this.saved = next;
    try {
      writeJsonAtomic(this.file, this.saved);
      this.lastSaveOk = true;
    } catch (err) {
      this.lastSaveOk = false;
      console.warn('[tiktok] Falha ao salvar tiktok.json:', (err as Error).message);
    }
    return null;
  }
}
