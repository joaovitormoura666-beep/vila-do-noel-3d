import Phaser from 'phaser';
import { LAYOUT } from '../config';

const SCALE = 0.74;
const ARM_REST = 0.2;

/** O Papai Noel: montado em partes (corpo, cabeça, braços) para permitir animações simples. */
export class Santa {
  readonly root: Phaser.GameObjects.Container;
  readonly sack: Phaser.GameObjects.Image;
  private body: Phaser.GameObjects.Image;
  private headC: Phaser.GameObjects.Container;
  private blink: Phaser.GameObjects.Image;
  private armL: Phaser.GameObjects.Image;
  private armR: Phaser.GameObjects.Image;
  private talkTween: Phaser.Tweens.Tween | null = null;
  private armTweenL: Phaser.Tweens.Tween | null = null;
  private armTweenR: Phaser.Tweens.Tween | null = null;
  private busy = false;

  constructor(private readonly scene: Phaser.Scene) {
    const { x, y } = LAYOUT.santa;

    this.sack = scene.add.image(LAYOUT.sack.x, LAYOUT.sack.y, 'sack').setOrigin(0.5, 1).setScale(0.74).setDepth(LAYOUT.sack.y);

    const shadow = scene.add.image(0, -6, 'shadow').setScale(2.9, 2.2);
    this.body = scene.add.image(0, 0, 'santa-body').setOrigin(0.5, 1);
    this.armL = scene.add.image(-100, -196, 'santa-arm').setOrigin(0.5, 0.1).setRotation(ARM_REST);
    this.armR = scene.add.image(100, -196, 'santa-arm').setOrigin(0.5, 0.1).setFlipX(true).setRotation(-ARM_REST);
    const head = scene.add.image(0, 0, 'santa-head').setOrigin(0.5, 0.75);
    this.blink = scene.add.image(0, -94, 'santa-blink').setVisible(false);
    this.headC = scene.add.container(0, -200, [head, this.blink]);

    this.root = scene.add.container(x, y, [shadow, this.body, this.armL, this.armR, this.headC]);
    this.root.setScale(SCALE).setDepth(y);

    // respiração
    scene.tweens.add({ targets: this.body, scaleY: 1.022, duration: 1700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    scene.tweens.add({ targets: this.headC, y: -205, duration: 1700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.idleArms();
    this.scheduleBlink();
  }

  /** Ponto (na tela) de onde o presente sai do saco. */
  get sackMouth(): Phaser.Math.Vector2 {
    return new Phaser.Math.Vector2(this.sack.x, this.sack.y - 150);
  }

  /** Topo da cabeça, para posicionar o balão de fala. */
  get headTop(): Phaser.Math.Vector2 {
    return new Phaser.Math.Vector2(this.root.x, this.root.y - 424 * SCALE);
  }

  private scheduleBlink() {
    this.scene.time.delayedCall(2200 + Math.random() * 3200, () => {
      this.blink.setVisible(true);
      this.scene.time.delayedCall(130, () => this.blink.setVisible(false));
      this.scheduleBlink();
    });
  }

  private stopArms() {
    this.armTweenL?.stop();
    this.armTweenR?.stop();
    this.armTweenL = this.armTweenR = null;
  }

  private idleArms() {
    this.stopArms();
    this.busy = false;
    this.armTweenL = this.scene.tweens.add({
      targets: this.armL,
      rotation: { from: this.armL.rotation, to: ARM_REST + 0.06 },
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.armTweenR = this.scene.tweens.add({
      targets: this.armR,
      rotation: { from: this.armR.rotation, to: -ARM_REST - 0.06 },
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  /** Volta à pose de descanso. */
  rest(duration = 350) {
    this.stopArms();
    this.busy = false;
    this.scene.tweens.add({ targets: this.root, rotation: 0, duration, ease: 'Sine.easeOut' });
    this.armTweenL = this.scene.tweens.add({ targets: this.armL, rotation: ARM_REST, duration, ease: 'Sine.easeOut', onComplete: () => !this.busy && this.idleArms() });
    this.armTweenR = this.scene.tweens.add({ targets: this.armR, rotation: -ARM_REST, duration, ease: 'Sine.easeOut' });
  }

  /** Acena para o visitante (braço do lado da fila). */
  wave(times = 3, speed = 1) {
    this.stopArms();
    this.busy = true;
    this.armTweenL = this.scene.tweens.chain({
      targets: this.armL,
      tweens: [
        { rotation: 2.25, duration: 260 / speed, ease: 'Back.easeOut' },
        { rotation: 2.75, duration: 170 / speed, yoyo: true, repeat: times - 1, ease: 'Sine.easeInOut' },
        { rotation: ARM_REST, duration: 300 / speed, ease: 'Sine.easeInOut' },
      ],
      onComplete: () => this.idleArms(),
    }) as unknown as Phaser.Tweens.Tween;
  }

  /** Inclina-se e enfia a mão no saco de presentes. */
  reachIntoSack(durationMs: number) {
    this.stopArms();
    this.busy = true;
    const d = durationMs;
    this.scene.tweens.add({ targets: this.root, rotation: 0.07, duration: d * 0.35, ease: 'Sine.easeOut' });
    this.armTweenR = this.scene.tweens.chain({
      targets: this.armR,
      tweens: [
        { rotation: -1.25, duration: d * 0.35, ease: 'Sine.easeOut' },
        { rotation: -1.0, duration: d * 0.16, yoyo: true, repeat: 1, ease: 'Sine.easeInOut' },
      ],
    }) as unknown as Phaser.Tweens.Tween;
    // o saco balança
    this.scene.tweens.add({
      targets: this.sack,
      angle: { from: -5, to: 5 },
      scaleY: { from: 0.74, to: 0.79 },
      duration: d * 0.16,
      yoyo: true,
      repeat: 3,
      ease: 'Sine.easeInOut',
      onComplete: () => this.sack.setAngle(0).setScale(0.74),
    });
  }

  /** Ergue os braços apresentando o presente. */
  present(durationMs = 400) {
    this.stopArms();
    this.busy = true;
    this.scene.tweens.add({ targets: this.root, rotation: -0.03, duration: durationMs, ease: 'Sine.easeOut' });
    this.armTweenL = this.scene.tweens.add({ targets: this.armL, rotation: 2.05, duration: durationMs, ease: 'Back.easeOut' });
    this.armTweenR = this.scene.tweens.add({ targets: this.armR, rotation: -2.05, duration: durationMs, ease: 'Back.easeOut' });
  }

  /** Estende a mão na direção do visitante. */
  give(durationMs = 350) {
    this.stopArms();
    this.busy = true;
    this.armTweenL = this.scene.tweens.add({ targets: this.armL, rotation: 1.25, duration: durationMs, ease: 'Sine.easeOut' });
    this.armTweenR = this.scene.tweens.add({ targets: this.armR, rotation: -ARM_REST, duration: durationMs, ease: 'Sine.easeOut' });
  }

  /** Pulinho de alegria. */
  cheer() {
    this.scene.tweens.add({ targets: this.root, y: this.root.y - 22, duration: 170, yoyo: true, repeat: 1, ease: 'Sine.easeOut' });
  }

  setTalking(on: boolean) {
    if (on && !this.talkTween) {
      this.talkTween = this.scene.tweens.add({
        targets: this.headC,
        angle: { from: -2.2, to: 2.2 },
        scaleY: { from: 1, to: 1.035 },
        duration: 190,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    } else if (!on && this.talkTween) {
      this.talkTween.stop();
      this.talkTween = null;
      this.scene.tweens.add({ targets: this.headC, angle: 0, scaleY: 1, duration: 150 });
    }
  }
}
