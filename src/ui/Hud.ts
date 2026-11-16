import Phaser from 'phaser';
import { DEPTH, FONT, GAME_W, hex, LAYOUT, PALETTE as P } from '../config';

/**
 * Textos fixos da transmissão: título, instrução, contador da fila e avisos.
 * Propositalmente enxuto para não poluir a tela.
 */
export class Hud {
  private readonly hintBg: Phaser.GameObjects.Graphics;
  private readonly hint: Phaser.GameObjects.Text;
  private readonly counterBg: Phaser.GameObjects.Graphics;
  private readonly counter: Phaser.GameObjects.Text;
  private readonly toastC: Phaser.GameObjects.Container;
  private readonly toastBg: Phaser.GameObjects.Graphics;
  private readonly toastText: Phaser.GameObjects.Text;
  private readonly fps: Phaser.GameObjects.Text;
  private readonly pausedTag: Phaser.GameObjects.Text;
  private toastTimer: Phaser.Time.TimerEvent | null = null;
  private lastCount = -1;
  private lastHint = '';

  constructor(private readonly scene: Phaser.Scene) {
    const { x, y } = LAYOUT.title;

    const title = scene.add
      .text(x, y, 'Vila do Noel', {
        fontFamily: FONT,
        fontSize: '84px',
        fontStyle: '700',
        color: P.goldLight,
        stroke: P.redDark,
        strokeThickness: 14,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.hud)
      .setShadow(0, 6, 'rgba(8,14,26,0.55)', 10, true, false);
    const grad = title.context.createLinearGradient(0, 0, 0, title.height);
    grad.addColorStop(0, '#FFF3CF');
    grad.addColorStop(0.55, P.gold);
    grad.addColorStop(1, '#D9A245');
    title.setFill(grad);
    scene.tweens.add({ targets: title, scale: 1.025, duration: 2400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // estrelinhas ao lado do título
    for (const [dx, dy, s] of [[-300, -8, 0.9], [300, -8, 0.9], [-262, 30, 0.5], [262, -40, 0.5]] as const) {
      const sp = scene.add.image(x + dx, y + dy, 'sparkle').setScale(s).setTint(hex(P.goldLight)).setDepth(DEPTH.hud);
      scene.tweens.add({ targets: sp, alpha: 0.25, scale: s * 0.6, duration: 900 + Math.random() * 700, yoyo: true, repeat: -1, delay: Math.random() * 800 });
    }

    this.hintBg = scene.add.graphics().setDepth(DEPTH.hud);
    this.hint = scene.add
      .text(x, y + 84, '', { fontFamily: FONT, fontSize: '31px', fontStyle: '500', color: P.snow, align: 'center' })
      .setOrigin(0.5)
      .setDepth(DEPTH.hud + 1);

    this.counterBg = scene.add.graphics().setDepth(DEPTH.hud);
    this.counter = scene.add
      .text(x, y + 140, '', { fontFamily: FONT, fontSize: '28px', fontStyle: '600', color: P.goldLight })
      .setOrigin(0.5)
      .setDepth(DEPTH.hud + 1);

    this.toastBg = scene.add.graphics();
    this.toastText = scene.add.text(0, 0, '', { fontFamily: FONT, fontSize: '36px', fontStyle: '600', color: P.snow, align: 'center' }).setOrigin(0.5);
    this.toastC = scene.add.container(GAME_W / 2, 1120, [this.toastBg, this.toastText]).setDepth(DEPTH.hud + 5).setVisible(false);

    this.fps = scene.add
      .text(16, 16, '', { fontFamily: 'monospace', fontSize: '24px', color: '#9FE8B0', backgroundColor: 'rgba(0,0,0,0.5)', padding: { x: 8, y: 4 } })
      .setDepth(DEPTH.hud + 10)
      .setVisible(false);

    this.pausedTag = scene.add
      .text(GAME_W - 20, 20, 'PAUSADO', { fontFamily: FONT, fontSize: '26px', fontStyle: '700', color: P.snow, backgroundColor: 'rgba(182,40,53,0.9)', padding: { x: 14, y: 6 } })
      .setOrigin(1, 0)
      .setDepth(DEPTH.hud + 10)
      .setVisible(false);
  }

  private pill(g: Phaser.GameObjects.Graphics, text: Phaser.GameObjects.Text, padX: number, padY: number, color: number, alpha: number, border?: number) {
    const w = text.width + padX * 2;
    const h = text.height + padY * 2;
    g.clear();
    if (border !== undefined) {
      g.fillStyle(border, 0.9);
      g.fillRoundedRect(text.x - w / 2 - 3, text.y - h / 2 - 3, w + 6, h + 6, (h + 6) / 2);
    }
    g.fillStyle(color, alpha);
    g.fillRoundedRect(text.x - w / 2, text.y - h / 2, w, h, h / 2);
  }

  setHint(text: string) {
    if (text === this.lastHint) return;
    this.lastHint = text;
    this.hint.setText(text);
    // reduz a fonte se o texto for longo demais para a largura da tela
    let size = 31;
    this.hint.setFontSize(size);
    while (this.hint.width > GAME_W - 120 && size > 20) this.hint.setFontSize(--size);
    this.hintBg.setVisible(text.length > 0);
    this.hint.setVisible(text.length > 0);
    if (text) this.pill(this.hintBg, this.hint, 26, 10, hex(P.nightDeep), 0.62);
  }

  setQueueCount(n: number) {
    if (n === this.lastCount) return;
    this.lastCount = n;
    const show = n > 0;
    this.counter.setVisible(show);
    this.counterBg.setVisible(show);
    if (!show) return;
    this.counter.setText(n === 1 ? '1 pessoa na fila' : `${n} pessoas na fila`);
    this.pill(this.counterBg, this.counter, 22, 7, hex(P.green), 0.85, hex(P.gold));
  }

  toast(message: string, ms = 2600) {
    this.toastText.setText(message);
    const w = this.toastText.width + 70;
    const h = this.toastText.height + 34;
    this.toastBg.clear();
    this.toastBg.fillStyle(hex(P.gold), 1);
    this.toastBg.fillRoundedRect(-w / 2 - 4, -h / 2 - 4, w + 8, h + 8, (h + 8) / 2);
    this.toastBg.fillStyle(hex(P.red), 0.96);
    this.toastBg.fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    this.scene.tweens.killTweensOf(this.toastC);
    this.toastC.setVisible(true).setAlpha(0).setScale(0.8);
    this.scene.tweens.add({ targets: this.toastC, alpha: 1, scale: 1, duration: 220, ease: 'Back.easeOut' });
    this.toastTimer?.remove(false);
    this.toastTimer = this.scene.time.delayedCall(ms, () => {
      this.scene.tweens.add({ targets: this.toastC, alpha: 0, duration: 300, onComplete: () => this.toastC.setVisible(false) });
    });
  }

  setFps(visible: boolean, value = 0, quality = '', objects = 0) {
    this.fps.setVisible(visible);
    if (visible) this.fps.setText(`${value.toFixed(0)} FPS · ${quality} · ${objects} pers.`);
  }

  /** Esconde/mostra a instrução e o contador (durante a revelação do presente). */
  setInfoVisible(visible: boolean, duration = 220) {
    this.scene.tweens.add({
      targets: [this.hint, this.hintBg, this.counter, this.counterBg],
      alpha: visible ? 1 : 0,
      duration,
    });
  }

  setPaused(paused: boolean) {
    this.pausedTag.setVisible(paused);
  }
}
