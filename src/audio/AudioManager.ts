import type { Settings } from '../../shared/types';
import { Music } from './music';
import { Sfx } from './sfx';
import { Voice } from './voice';

/**
 * Áudio do jogo com três categorias de volume independentes
 * (música, efeitos e voz), todas passando por um volume geral.
 * Os efeitos e a música padrão são sintetizados (Web Audio), então
 * não há nenhum arquivo de terceiros nem questão de licença.
 */
export class AudioManager {
  readonly ctx: AudioContext | null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private voiceGain: GainNode | null = null;
  readonly sfx: Sfx;
  readonly music: Music;
  readonly voice: Voice;
  private volumes: Settings['volumes'] = { master: 0.8, music: 0.35, sfx: 0.7, voice: 1 };

  constructor() {
    let ctx: AudioContext | null = null;
    try {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AC) ctx = new AC({ latencyHint: 'interactive' });
    } catch (err) {
      console.warn('[áudio] Web Audio indisponível', err);
    }
    this.ctx = ctx;
    if (ctx) {
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -10;
      limiter.ratio.value = 6;
      limiter.connect(ctx.destination);
      this.master = ctx.createGain();
      this.master.connect(limiter);
      this.musicGain = ctx.createGain();
      this.sfxGain = ctx.createGain();
      this.voiceGain = ctx.createGain();
      for (const g of [this.musicGain, this.sfxGain, this.voiceGain]) g.connect(this.master);
    }
    this.sfx = new Sfx(ctx, this.sfxGain);
    this.music = new Music(ctx, this.musicGain);
    this.voice = new Voice(ctx, this.voiceGain);
    this.applyVolumes();
  }

  /** Navegadores só liberam som depois de uma interação; o OBS libera direto. */
  get locked(): boolean {
    return !!this.ctx && this.ctx.state !== 'running';
  }

  async unlock(): Promise<boolean> {
    if (!this.ctx) return false;
    try {
      if (this.ctx.state !== 'running') await this.ctx.resume();
    } catch {
      /* continua bloqueado */
    }
    const ok = this.ctx.state === 'running';
    if (ok) this.music.start();
    return ok;
  }

  applySettings(s: Settings) {
    this.volumes = { ...s.volumes };
    this.voice.enabled = s.voiceEnabled;
    this.applyVolumes();
  }

  private applyVolumes() {
    const t = this.ctx?.currentTime ?? 0;
    this.master?.gain.setTargetAtTime(this.volumes.master, t, 0.05);
    this.musicGain?.gain.setTargetAtTime(this.volumes.music, t, 0.05);
    this.sfxGain?.gain.setTargetAtTime(this.volumes.sfx, t, 0.05);
    this.voiceGain?.gain.setTargetAtTime(this.volumes.voice, t, 0.05);
    // A síntese de voz do navegador não passa pelo Web Audio: recebe o volume direto.
    this.voice.ttsVolume = Math.min(1, this.volumes.master * this.volumes.voice);
  }
}
