export type SfxName = 'join' | 'arrive' | 'rummage' | 'rise' | 'drum' | 'reveal' | 'jump' | 'full' | 'step' | 'sleigh';

const NOTE = (semitonesFromA4: number) => 440 * 2 ** (semitonesFromA4 / 12);
// escala de dó maior a partir do dó central
const C5 = NOTE(3);
const E5 = NOTE(7);
const G5 = NOTE(10);
const C6 = NOTE(15);
const E6 = NOTE(19);
const G6 = NOTE(22);

/** Efeitos sonoros natalinos sintetizados (sem arquivos externos). */
export class Sfx {
  private noise: AudioBuffer | null = null;
  private lastPlayed = new Map<SfxName, number>();

  constructor(
    private readonly ctx: AudioContext | null,
    private readonly out: GainNode | null,
  ) {
    if (ctx) {
      const len = ctx.sampleRate;
      this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
  }

  play(name: SfxName) {
    const ctx = this.ctx;
    if (!ctx || !this.out || ctx.state !== 'running') return;
    // evita empilhar o mesmo som dezenas de vezes no mesmo instante
    const now = ctx.currentTime;
    const last = this.lastPlayed.get(name) ?? -1;
    if (now - last < 0.06) return;
    this.lastPlayed.set(name, now);

    switch (name) {
      case 'join':
        this.bell(C6, now, 0.22, 0.16);
        this.bell(E6, now + 0.07, 0.25, 0.14);
        break;
      case 'arrive':
        this.bell(G5, now, 0.5, 0.2);
        this.bell(C6, now + 0.12, 0.6, 0.2);
        this.sleigh(now, 3, 0.11, 0.1);
        break;
      case 'rummage':
        for (let i = 0; i < 4; i++) this.noiseBurst(now + i * 0.13, 0.1, 900 + i * 260, 0.16);
        break;
      case 'rise':
        [C5, E5, G5, C6, E6].forEach((f, i) => this.bell(f, now + i * 0.085, 0.4, 0.15));
        break;
      case 'drum':
        for (let i = 0; i < 12; i++) this.bell(i % 2 ? E6 : G6, now + i * 0.075, 0.12, 0.05 + i * 0.006);
        break;
      case 'reveal':
        [C5, E5, G5, C6].forEach((f) => this.bell(f, now, 1.4, 0.16));
        this.bell(E6, now + 0.16, 1.2, 0.14);
        this.bell(G6, now + 0.3, 1.3, 0.13);
        this.sleigh(now, 6, 0.09, 0.12);
        break;
      case 'jump': {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(420, now);
        o.frequency.exponentialRampToValueAtTime(820, now + 0.14);
        g.gain.setValueAtTime(0.0001, now);
        g.gain.exponentialRampToValueAtTime(0.16, now + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
        o.connect(g).connect(this.out);
        o.start(now);
        o.stop(now + 0.22);
        break;
      }
      case 'full': {
        for (const [t, f] of [[0, 330], [0.14, 262]] as const) {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = 'triangle';
          o.frequency.value = f;
          g.gain.setValueAtTime(0.0001, now + t);
          g.gain.exponentialRampToValueAtTime(0.18, now + t + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.22);
          o.connect(g).connect(this.out);
          o.start(now + t);
          o.stop(now + t + 0.25);
        }
        break;
      }
      case 'step':
        this.noiseBurst(now, 0.05, 500, 0.04);
        break;
      case 'sleigh':
        this.sleigh(now, 4, 0.12, 0.12);
        break;
    }
  }

  /** Som de sininho: parciais senoidais com decaimento rápido. */
  bell(freq: number, when: number, dur: number, vol: number, out: AudioNode | null = this.out) {
    const ctx = this.ctx;
    if (!ctx || !out) return;
    const partials: Array<[number, number]> = [
      [1, 1],
      [2.76, 0.32],
      [5.4, 0.14],
    ];
    for (const [mult, amp] of partials) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = freq * mult;
      g.gain.setValueAtTime(0.0001, when);
      g.gain.exponentialRampToValueAtTime(vol * amp, when + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, when + dur / (mult > 1 ? 2.2 : 1));
      o.connect(g).connect(out);
      o.start(when);
      o.stop(when + dur + 0.05);
    }
  }

  private noiseBurst(when: number, dur: number, freq: number, vol: number) {
    const ctx = this.ctx;
    if (!ctx || !this.out || !this.noise) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(vol, when + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    src.connect(f).connect(g).connect(this.out);
    src.start(when, Math.random() * 0.5, dur + 0.05);
  }

  /** Guizos de trenó: rajadas curtas de ruído agudo. */
  sleigh(when: number, hits: number, interval: number, vol: number, out: AudioNode | null = this.out) {
    const ctx = this.ctx;
    if (!ctx || !out || !this.noise) return;
    for (let i = 0; i < hits; i++) {
      const t = when + i * interval;
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 6800 + Math.random() * 1200;
      f.Q.value = 6;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
      src.connect(f).connect(g).connect(out);
      src.start(t, Math.random() * 0.5, 0.1);
    }
  }
}
