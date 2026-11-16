import type { Quality } from '../../shared/types';

export type Level = Exclude<Quality, 'auto'>;

const ORDER: Level[] = ['baixa', 'media', 'alta'];

/**
 * Acompanha o FPS e, no modo automático, reduz os efeitos quando o
 * computador não está dando conta — e volta a aumentar quando sobra folga.
 */
export class PerformanceMonitor {
  level: Level = 'alta';
  fps = 60;
  private mode: Quality = 'auto';
  private lowSeconds = 0;
  private highSeconds = 0;
  private acc = 0;
  private frames = 0;
  private upgrades = 0;
  private lastNow = 0;

  constructor(private readonly onChange: (level: Level) => void) {}

  setMode(mode: Quality) {
    this.mode = mode;
    if (mode !== 'auto') this.set(mode);
    this.lowSeconds = this.highSeconds = 0;
  }

  /** Chamado a cada quadro. Mede com o relógio real, sem depender do tempo suavizado do motor. */
  frame(now = performance.now()) {
    const deltaMs = this.lastNow ? now - this.lastNow : 16.7;
    this.lastNow = now;
    // ignora pausas longas (aba em segundo plano, janela minimizada)
    if (deltaMs > 1000) return;
    this.acc += deltaMs;
    this.frames++;
    if (this.acc < 1000) return;
    this.fps = (this.frames * 1000) / this.acc;
    this.acc = 0;
    this.frames = 0;
    if (this.mode !== 'auto') return;

    if (this.fps < 46) {
      this.lowSeconds++;
      this.highSeconds = 0;
    } else if (this.fps > 57) {
      this.highSeconds++;
      this.lowSeconds = 0;
    } else {
      this.lowSeconds = 0;
      this.highSeconds = 0;
    }

    const i = ORDER.indexOf(this.level);
    if (this.lowSeconds >= 4 && i > 0) {
      this.set(ORDER[i - 1]);
      this.lowSeconds = 0;
    } else if (this.highSeconds >= 25 && i < ORDER.length - 1 && this.upgrades < 3) {
      // limita as subidas para não ficar alternando sem parar
      this.upgrades++;
      this.set(ORDER[i + 1]);
      this.highSeconds = 0;
    }
  }

  private set(level: Level) {
    if (level === this.level) return;
    this.level = level;
    this.onChange(level);
  }
}
