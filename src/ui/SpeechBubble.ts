import Phaser from 'phaser';
import { DEPTH, FONT, GAME_W, hex, PALETTE as P } from '../config';

/** Balão de fala do Papai Noel. */
export class SpeechBubble {
  private readonly root: Phaser.GameObjects.Container;
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly text: Phaser.GameObjects.Text;
  private tween: Phaser.Tweens.Tween | null = null;
  private visible = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly anchorX: number,
    private readonly anchorY: number,
  ) {
    this.bg = scene.add.graphics();
    this.text = scene.add
      .text(0, 0, '', {
        fontFamily: FONT,
        fontSize: '40px',
        fontStyle: '600',
        color: P.night,
        align: 'center',
        wordWrap: { width: 560, useAdvancedWrap: true },
        lineSpacing: 4,
      })
      .setOrigin(0.5, 0.5);
    this.root = scene.add.container(anchorX, anchorY, [this.bg, this.text]).setDepth(DEPTH.fx + 100).setVisible(false);
  }

  show(message: string) {
    this.text.setText(message);
    const w = Math.max(240, this.text.width + 64);
    const h = this.text.height + 46;
    const tail = 30;

    // mantém o balão dentro da tela
    const half = w / 2;
    const cx = Phaser.Math.Clamp(this.anchorX, half + 24, GAME_W - half - 24);
    const tailX = this.anchorX - cx;
    this.root.setPosition(cx, this.anchorY);
    this.text.setPosition(0, -tail - h / 2);

    const g = this.bg;
    g.clear();
    // sombra
    g.fillStyle(hex(P.nightDeep), 0.28);
    g.fillRoundedRect(-half + 6, -tail - h + 8, w, h, 30);
    // contorno dourado
    g.fillStyle(hex(P.gold), 1);
    g.fillRoundedRect(-half - 5, -tail - h - 5, w + 10, h + 10, 34);
    g.fillTriangle(tailX - 26, -tail - 2, tailX + 26, -tail - 2, tailX + 6, 6);
    // interior
    g.fillStyle(hex(P.snow), 1);
    g.fillRoundedRect(-half, -tail - h, w, h, 30);
    g.fillTriangle(tailX - 18, -tail - 1, tailX + 18, -tail - 1, tailX + 5, -4);

    this.tween?.stop();
    this.root.setVisible(true);
    if (!this.visible) {
      this.root.setScale(0.5).setAlpha(0);
      this.tween = this.scene.tweens.add({ targets: this.root, scale: 1, alpha: 1, duration: 220, ease: 'Back.easeOut' });
    } else {
      this.root.setAlpha(1).setScale(0.94);
      this.tween = this.scene.tweens.add({ targets: this.root, scale: 1, duration: 160, ease: 'Back.easeOut' });
    }
    this.visible = true;
  }

  hide() {
    if (!this.visible) return;
    this.visible = false;
    this.tween?.stop();
    this.tween = this.scene.tweens.add({
      targets: this.root,
      alpha: 0,
      scale: 0.8,
      duration: 160,
      onComplete: () => this.root.setVisible(false),
    });
  }
}
