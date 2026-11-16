import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { DEFAULT_SETTINGS, type Settings } from '../shared/types.js';

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
  return s;
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
    this.settings = { ...DEFAULT_SETTINGS, volumes: { ...DEFAULT_SETTINGS.volumes } };
    this.save();
    return this.settings;
  }

  private save() {
    try {
      mkdirSync(dirname(this.file), { recursive: true });
      // grava num arquivo temporário e troca: se a VM desligar no meio, o arquivo antigo continua inteiro
      const tmp = `${this.file}.tmp`;
      writeFileSync(tmp, JSON.stringify(this.settings, null, 2));
      renameSync(tmp, this.file);
      this.lastSaveOk = true;
    } catch (err) {
      this.lastSaveOk = false;
      console.warn('[config] Falha ao salvar configurações:', (err as Error).message);
    }
  }
}
