import type Phaser from 'phaser';

/** Erro usado para interromper uma sequência de animação (ex.: botão "Pular"). */
export class Cancelled extends Error {
  constructor() {
    super('sequência cancelada');
  }
}

/**
 * Pequeno "diretor" de animações: transforma tweens e esperas do Phaser em
 * Promises, aplica o multiplicador de velocidade e permite cancelar tudo.
 */
export class Timeline {
  private tweens = new Set<Phaser.Tweens.Tween>();
  private timers = new Set<Phaser.Time.TimerEvent>();
  private objects = new Set<Phaser.GameObjects.GameObject>();
  cancelled = false;

  constructor(
    readonly scene: Phaser.Scene,
    private readonly speed: () => number,
  ) {}

  /** Converte uma duração "normal" para a velocidade atual. */
  ms(base: number): number {
    return base / Math.max(0.25, this.speed());
  }

  private check() {
    if (this.cancelled) throw new Cancelled();
  }

  async wait(baseMs: number): Promise<void> {
    this.check();
    await new Promise<void>((resolve) => {
      const ev = this.scene.time.delayedCall(this.ms(baseMs), () => {
        this.timers.delete(ev);
        resolve();
      });
      this.timers.add(ev);
    });
    this.check();
  }

  /** Tween com duração ajustada pela velocidade. Não lança erro se for cancelado no meio: use `check` depois. */
  async tween(config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    this.check();
    await this.tweenLoose(config);
    this.check();
  }

  /** Inicia um tween sem bloquear a sequência (ainda é cancelado junto). */
  tweenLoose(config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    return new Promise<void>((resolve) => {
      const scale = (v: unknown) => (typeof v === 'number' ? this.ms(v) : v);
      const tween = this.scene.tweens.add({
        ...config,
        duration: scale(config.duration) as number | undefined,
        delay: scale(config.delay) as number | undefined,
        hold: scale(config.hold) as number | undefined,
        repeatDelay: scale(config.repeatDelay) as number | undefined,
        onComplete: (...args) => {
          this.tweens.delete(tween);
          (config.onComplete as ((...a: unknown[]) => void) | undefined)?.(...args);
          resolve();
        },
        onStop: () => {
          this.tweens.delete(tween);
          resolve();
        },
      });
      this.tweens.add(tween);
    });
  }

  /** Espera uma Promise externa (ex.: voz) junto com um tempo mínimo e um máximo. */
  async waitFor(promise: Promise<unknown>, minBaseMs: number, maxMs: number): Promise<void> {
    this.check();
    const cap = new Promise<void>((resolve) => {
      const ev = this.scene.time.delayedCall(maxMs, () => {
        this.timers.delete(ev);
        resolve();
      });
      this.timers.add(ev);
    });
    await Promise.all([this.wait(minBaseMs), Promise.race([promise, cap])]);
    this.check();
  }

  /** Registra um objeto temporário para ser destruído no fim ou no cancelamento. */
  track<T extends Phaser.GameObjects.GameObject>(obj: T): T {
    this.objects.add(obj);
    return obj;
  }

  release(obj: Phaser.GameObjects.GameObject) {
    this.objects.delete(obj);
  }

  cancel() {
    if (this.cancelled) return;
    this.cancelled = true;
    for (const t of [...this.tweens]) t.stop();
    for (const ev of [...this.timers]) ev.remove(true);
    this.timers.clear();
  }

  /** Destrói tudo o que foi criado pela sequência. */
  dispose() {
    for (const t of [...this.tweens]) t.stop();
    this.tweens.clear();
    for (const ev of [...this.timers]) ev.remove(false);
    this.timers.clear();
    for (const o of this.objects) {
      this.scene.tweens.killTweensOf(o);
      o.destroy();
    }
    this.objects.clear();
  }
}
