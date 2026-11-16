/**
 * Música de fundo.
 *
 * Padrão: uma caixinha de música ORIGINAL gerada por código (não é nenhuma
 * canção existente), portanto livre de direitos autorais.
 *
 * Opcional: se existir o arquivo public/audio/musica/fundo.mp3, ele é tocado
 * em loop no lugar da caixinha. Só coloque ali músicas com licença que
 * permita uso em transmissões ao vivo (veja docs/AUDIO.md).
 */

import { STANDALONE } from '../standalone';
import { loadAudioManifest } from './manifest';

const A4 = 440;
const n = (semi: number) => A4 * 2 ** (semi / 12);

// Dó maior. Índices em semitons a partir do Lá 4.
const NOTES: Record<string, number> = {
  C4: n(-9), D4: n(-7), E4: n(-5), F4: n(-4), G4: n(-2), A4: n(0), B4: n(2),
  C5: n(3), D5: n(5), E5: n(7), F5: n(8), G5: n(10), A5: n(12), B5: n(14), C6: n(15),
  G3: n(-14), A3: n(-12), F3: n(-16), C3: n(-21), E3: n(-17), D3: n(-19), B3: n(-10),
};

interface Bar {
  bass: string;
  chord: string[];
  melody: Array<string | null>;
}

// Valsa lenta em 3/4, 16 compassos. Melodia original.
const SONG: Bar[] = [
  { bass: 'C3', chord: ['E4', 'G4'], melody: ['E5', 'G5', 'C6'] },
  { bass: 'C3', chord: ['E4', 'G4'], melody: ['B5', 'G5', 'E5'] },
  { bass: 'A3', chord: ['C4', 'E4'], melody: ['A5', 'C6', 'A5'] },
  { bass: 'A3', chord: ['C4', 'E4'], melody: ['G5', null, 'E5'] },
  { bass: 'F3', chord: ['A3', 'C4'], melody: ['F5', 'A5', 'G5'] },
  { bass: 'F3', chord: ['A3', 'C4'], melody: ['F5', 'E5', 'D5'] },
  { bass: 'G3', chord: ['B3', 'D4'], melody: ['D5', 'G5', 'B5'] },
  { bass: 'G3', chord: ['B3', 'D4'], melody: ['A5', null, 'G5'] },
  { bass: 'C3', chord: ['E4', 'G4'], melody: ['E5', 'G5', 'C6'] },
  { bass: 'E3', chord: ['G4', 'B4'], melody: ['B5', 'G5', 'B5'] },
  { bass: 'A3', chord: ['C4', 'E4'], melody: ['C6', 'A5', 'E5'] },
  { bass: 'F3', chord: ['A3', 'C4'], melody: ['F5', 'A5', 'C6'] },
  { bass: 'D3', chord: ['F4', 'A4'], melody: ['A5', 'F5', 'D5'] },
  { bass: 'G3', chord: ['B3', 'D4'], melody: ['G5', 'B5', 'D5'] },
  { bass: 'C3', chord: ['E4', 'G4'], melody: ['E5', 'D5', 'E5'] },
  { bass: 'C3', chord: ['E4', 'G4'], melody: ['C5', null, null] },
];

const BEAT = 60 / 104; // segundos por tempo

export class Music {
  private started = false;
  private nextBarTime = 0;
  private bar = 0;
  private timer: number | undefined;
  private fileEl: HTMLAudioElement | null = null;
  private noise: AudioBuffer | null = null;

  constructor(
    private readonly ctx: AudioContext | null,
    private readonly out: GainNode | null,
  ) {}

  async start() {
    if (this.started || !this.ctx || !this.out) return;
    this.started = true;
    if (await this.tryFile()) return;
    this.nextBarTime = this.ctx.currentTime + 0.3;
    this.schedule();
    this.timer = window.setInterval(() => this.schedule(), 400);
  }

  stop() {
    window.clearInterval(this.timer);
    this.fileEl?.pause();
    this.started = false;
  }

  /** Usa um arquivo fornecido pelo dono da live, se existir (public/audio/musica/fundo.mp3). */
  private async tryFile(): Promise<boolean> {
    const ctx = this.ctx;
    if (!ctx || !this.out || STANDALONE) return false;
    try {
      const info = await loadAudioManifest();
      if (!info.musica) return false;
      const el = new Audio(`/audio/musica/${encodeURIComponent(info.musica)}`);
      el.loop = true;
      ctx.createMediaElementSource(el).connect(this.out);
      await el.play();
      this.fileEl = el;
      return true;
    } catch {
      return false; // sem servidor ou sem arquivo: usa a caixinha de música
    }
  }

  private schedule() {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    // Se a aba ficou parada, não tenta "recuperar" compassos atrasados.
    if (this.nextBarTime < ctx.currentTime - 0.2) this.nextBarTime = ctx.currentTime + 0.1;
    while (this.nextBarTime < ctx.currentTime + 1.2) {
      this.playBar(SONG[this.bar % SONG.length], this.nextBarTime, this.bar);
      this.nextBarTime += BEAT * 3;
      this.bar++;
    }
  }

  private playBar(bar: Bar, t: number, index: number) {
    this.tone(NOTES[bar.bass], t, BEAT * 2.6, 0.22, 'triangle');
    for (const beat of [1, 2]) {
      for (const note of bar.chord) this.musicBox(NOTES[note], t + BEAT * beat, 0.9, 0.07);
    }
    bar.melody.forEach((note, i) => {
      if (note) this.musicBox(NOTES[note], t + BEAT * i, 1.6, 0.2);
    });
    // guizos discretos a cada dois compassos
    if (index % 2 === 0) this.jingle(t);
    this.jingle(t + BEAT, 0.035);
    this.jingle(t + BEAT * 2, 0.035);
  }

  private tone(freq: number, t: number, dur: number, vol: number, type: OscillatorType) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.out!);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private musicBox(freq: number, t: number, dur: number, vol: number) {
    const ctx = this.ctx!;
    for (const [mult, amp, d] of [
      [1, 1, 1],
      [4, 0.22, 0.25],
    ] as const) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = freq * mult;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol * amp, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur * d);
      o.connect(g).connect(this.out!);
      o.start(t);
      o.stop(t + dur * d + 0.05);
    }
  }

  private jingle(t: number, vol = 0.06) {
    const ctx = this.ctx!;
    if (!this.noise) {
      this.noise = ctx.createBuffer(1, ctx.sampleRate / 2, ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 7200;
    f.Q.value = 7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    src.connect(f).connect(g).connect(this.out!);
    src.start(t, Math.random() * 0.3, 0.1);
  }
}
