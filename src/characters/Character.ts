import Phaser from 'phaser';
import type { Participant } from '../../shared/types';
import { DEPTH, depthScale, FONT, PALETTE as P } from '../config';
import type { PathTrack } from '../queue/PathTrack';
import { hashString } from '../render/textures/canvas';
import { LOOK_COUNT } from '../render/textures/visitors';
import { NameLabel } from './NameLabel';

export type CharacterState = 'fila' | 'indo' | 'entrega' | 'saindo' | 'removido';

const BODY_Y = -10;
const LABEL_BASE_Y = -166;

/** Retângulo na tela (em pixels) que as etiquetas de nome devem evitar cobrir. */
export interface LabelBounds {
  l: number;
  r: number;
  t: number;
  b: number;
  /** Peso ao medir sobreposição (1 = outra etiqueta; menos que 1 = "evite se der"). */
  weight?: number;
}

/** Um visitante da vila: corpinho, pés animados, etiqueta com nome/foto e presente na mão. */
export class Character {
  readonly root: Phaser.GameObjects.Container;
  readonly participant: Participant;
  state: CharacterState = 'fila';
  /** Distância percorrida na trilha atual. */
  s = 0;
  targetS = 0;
  track: PathTrack;
  /** Quanto a etiqueta sobe além do lugar normal (para não cobrir os nomes vizinhos). */
  labelLift = 0;
  /** Quanto a etiqueta desliza para o lado, pelo mesmo motivo. */
  labelShift = 0;
  /** Marcado quando o painel pede para pular este participante. */
  skipDelivery = false;
  /** Tamanho da etiqueta: menor na fila, maior quando é a vez da pessoa. */
  labelSize = 0.96;

  private readonly scene: Phaser.Scene;
  private readonly body: Phaser.GameObjects.Image;
  private readonly footL: Phaser.GameObjects.Image;
  private readonly footR: Phaser.GameObjects.Image;
  private readonly labelImg: Phaser.GameObjects.Image;
  private readonly label: NameLabel;
  private carried: Phaser.GameObjects.Image | null = null;
  private phase = Math.random() * Math.PI * 2;
  private moving = 0;
  private hop = 0;
  private pos = { x: 0, y: 0 };
  private lean = 0;
  private labelY = LABEL_BASE_Y;
  private labelX = 0;
  private carryLift = 0;
  private labelScale = 0.96;

  constructor(scene: Phaser.Scene, participant: Participant, track: PathTrack) {
    this.scene = scene;
    this.participant = participant;
    this.track = track;
    const look = hashString(participant.userId) % LOOK_COUNT;

    const shadow = scene.add.image(0, -3, 'shadow').setScale(0.82, 0.8);
    this.footL = scene.add.image(-16, -9, 'foot');
    this.footR = scene.add.image(16, -9, 'foot');
    this.body = scene.add.image(0, BODY_Y, `look-${look}`).setOrigin(0.5, 1);
    this.label = new NameLabel(scene, participant.userId, participant.nickname, participant.avatarUrl);
    // A etiqueta fica fora do corpo, numa camada acima de tudo no cenário:
    // assim o nome nunca é coberto por outro personagem nem pelos galhos da frente.
    this.labelImg = scene.add.image(0, 0, this.label.key).setOrigin(0.5, 1).setDepth(DEPTH.labels).setAlpha(0);

    this.root = scene.add.container(0, 0, [shadow, this.footL, this.footR, this.body]);
    this.place();
    // aparece com um "pop"
    this.root.setAlpha(0);
    scene.tweens.add({ targets: [this.root, this.labelImg], alpha: 1, duration: 220 });
  }

  get x() {
    return this.pos.x;
  }
  get y() {
    return this.pos.y;
  }
  get scale() {
    return this.root.scaleX;
  }
  /** Posição (na tela) logo acima da cabeça. */
  get headTop(): Phaser.Math.Vector2 {
    return new Phaser.Math.Vector2(this.pos.x, this.pos.y - 170 * this.root.scaleX);
  }

  get arrived(): boolean {
    return this.s >= this.targetS - 0.5;
  }

  /** Altura da etiqueta na tela (ela não muda de tamanho com a profundidade). */
  get labelHeight(): number {
    return this.label.height * this.labelSize;
  }

  /** Região do rosto na tela: as etiquetas de quem vem atrás tentam não cobri-la. */
  faceBounds(): LabelBounds {
    const scale = depthScale(this.pos.y);
    return {
      l: this.pos.x - 44 * scale,
      r: this.pos.x + 44 * scale,
      t: this.pos.y - 148 * scale,
      b: this.pos.y - 72 * scale,
      weight: 0.6,
    };
  }

  /**
   * Onde a etiqueta ficaria na tela se subisse `lift` e deslizasse `shift` para o lado.
   * A fila usa isto para escolher um lugar em que os nomes não se cobrem.
   */
  labelBounds(lift: number, shift = 0): LabelBounds {
    const scale = depthScale(this.pos.y);
    const w = this.label.width * this.labelSize;
    const cx = this.pos.x + shift;
    const b = this.pos.y + (LABEL_BASE_Y - lift - this.carryLift) * scale;
    return { l: cx - w / 2, r: cx + w / 2, t: b - this.labelHeight, b };
  }

  /**
   * Avança na trilha em direção a `targetS`, sem ultrapassar `limitS`
   * (posição de quem está à frente menos o espaçamento).
   */
  update(dtSec: number, baseSpeed: number, limitS = Infinity) {
    const goal = Math.min(this.targetS, limitS);
    const gap = goal - this.s;
    let moved = 0;
    if (gap > 0.5) {
      // corre quando está longe do lugar, anda quando está perto
      const hurry = gap > 260 ? 2.1 : gap > 120 ? 1.4 : 1;
      moved = Math.min(gap, baseSpeed * hurry * dtSec);
      const before = this.pos.x;
      this.s += moved;
      this.track.at(this.s, this.pos);
      const dx = this.pos.x - before;
      this.lean += ((Math.sign(dx) * Math.min(1, Math.abs(dx) / (moved || 1))) - this.lean) * Math.min(1, dtSec * 8);
      this.phase += dtSec * (9 + hurry * 4);
    } else {
      this.lean += (0 - this.lean) * Math.min(1, dtSec * 8);
    }
    const target = moved > 0 ? 1 : 0;
    this.moving += (target - this.moving) * Math.min(1, dtSec * 10);
    this.animate(dtSec);
    this.place();
  }

  private animate(dtSec: number) {
    const m = this.moving;
    const sin = Math.sin(this.phase);
    this.footL.y = -9 - Math.max(0, sin) * 10 * m;
    this.footR.y = -9 - Math.max(0, -sin) * 10 * m;
    this.footL.x = -16 + sin * 3 * m;
    this.footR.x = 16 - sin * 3 * m;
    // respiração quando parado
    const breath = Math.sin(this.scene.time.now / 420 + this.phase) * 0.012 * (1 - m);
    this.body.y = BODY_Y - Math.abs(sin) * 5 * m - this.hop;
    this.body.scaleY = 1 + breath;
    this.body.angle = this.lean * 5 * m + sin * 2.5 * m;
    // etiqueta acompanha suavemente
    const wantLabel = LABEL_BASE_Y - this.labelLift - this.carryLift;
    this.labelY += (wantLabel - this.labelY) * Math.min(1, dtSec * 8);
    this.labelX += (this.labelShift - this.labelX) * Math.min(1, dtSec * 8);
    this.labelScale += (this.labelSize - this.labelScale) * Math.min(1, dtSec * 6);
    if (this.carried) {
      this.carried.y = -196 - this.hop - Math.abs(sin) * 5 * m + Math.sin(this.scene.time.now / 300) * 3;
    }
  }

  private place() {
    const scale = depthScale(this.pos.y);
    this.root.setPosition(this.pos.x, this.pos.y);
    this.root.setScale(scale);
    this.root.setDepth(this.pos.y);
    // a etiqueta acompanha a cabeça, mas mantém o tamanho, independente da profundidade
    this.labelImg.setPosition(this.pos.x + this.labelX, this.pos.y + (this.labelY - this.hop) * scale);
    this.labelImg.setScale(this.labelScale);
    this.labelImg.setDepth(DEPTH.labels + this.pos.y / 10000);
    if (this.carried) this.carried.setScale(0.5 / scale);
  }

  /** Coloca o personagem no início de uma trilha. */
  setTrack(track: PathTrack, s = 0) {
    this.track = track;
    this.s = s;
    this.track.at(this.s, this.pos);
    this.place();
  }

  /** Pulinhos de alegria. */
  jump(times = 2, height = 34, duration = 190) {
    this.scene.tweens.add({ targets: this, hop: height, duration, yoyo: true, repeat: times - 1, ease: 'Sine.easeOut' });
  }

  /** Passa a carregar o presente acima da cabeça. */
  carry(textureKey: string) {
    this.carried?.destroy();
    this.carried = this.scene.add.image(0, -196, textureKey);
    this.root.add(this.carried);
    this.carryLift = 84;
    this.place();
  }

  /** Balãozinho de reação que sobe e some. */
  react(text: string) {
    const head = this.headTop;
    const t = this.scene.add
      .text(head.x + 96, head.y - 6, text, {
        fontFamily: FONT,
        fontSize: '32px',
        fontStyle: '700',
        color: P.snow,
        stroke: P.red,
        strokeThickness: 8,
      })
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.fx + 20)
      .setScale(0.3);
    this.scene.tweens.add({ targets: t, scale: 1, duration: 220, ease: 'Back.easeOut' });
    this.scene.tweens.add({ targets: t, y: t.y - 60, alpha: 0, delay: 900, duration: 600, onComplete: () => t.destroy() });
  }

  /** Some com um efeito suave (usado ao limpar a fila). */
  poof(onDone?: () => void) {
    this.state = 'removido';
    this.scene.tweens.add({ targets: this.labelImg, alpha: 0, duration: 200 });
    this.scene.tweens.add({
      targets: this.root,
      alpha: 0,
      scaleX: this.root.scaleX * 0.6,
      scaleY: this.root.scaleY * 0.6,
      duration: 260,
      onComplete: () => {
        this.destroy();
        onDone?.();
      },
    });
  }

  destroy() {
    this.state = 'removido';
    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.killTweensOf(this.root);
    this.scene.tweens.killTweensOf(this.labelImg);
    this.root.destroy();
    this.labelImg.destroy();
    this.label.destroy();
  }
}
