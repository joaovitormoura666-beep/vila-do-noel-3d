import Phaser from 'phaser';
import type { Quality } from '../../shared/types';
import { DEPTH, GAME_H, GAME_W, hex, LAYOUT, PALETTE as P } from '../config';
import { rng } from './textures/canvas';
import { BARE_TRUNK_X, GROUND_TOP } from './textures/scenery';

type Level = Exclude<Quality, 'auto'>;

const HOUSE_SCALE = 0.8;
const HOUSE_W = 620;
const HOUSE_H = 540;
const BULB_COLORS = [0xff5964, 0xffd166, 0x6fe3a5, 0x8ecbff, 0xffffff];

/** Monta o cenário fixo da vila e suas pequenas animações (luzes, fumaça, estrelas). */
export class Scenery {
  private readonly ambient: Phaser.Tweens.Tween[] = [];
  private readonly smoke: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly magic: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly ring: Phaser.GameObjects.Image;
  private readonly detail: Phaser.GameObjects.GameObject[] = [];
  private readonly vignette: Phaser.GameObjects.Image;

  constructor(private readonly scene: Phaser.Scene) {
    const r = rng(2026);

    scene.add.image(0, 0, 'sky').setOrigin(0).setDepth(DEPTH.sky);

    // estrelas piscando
    for (let i = 0; i < 70; i++) {
      const x = r() * GAME_W;
      const y = 20 + r() * 520;
      const big = r() > 0.82;
      const s = scene.add
        .image(x, y, big ? 'sparkle' : 'flake')
        .setScale(big ? 0.25 + r() * 0.3 : 0.12 + r() * 0.2)
        .setAlpha(0.5 + r() * 0.5)
        .setDepth(DEPTH.stars);
      if (i % 2 === 0) {
        this.ambient.push(
          scene.tweens.add({ targets: s, alpha: 0.12, duration: 900 + r() * 1800, yoyo: true, repeat: -1, delay: r() * 2000, ease: 'Sine.easeInOut' }),
        );
      } else {
        this.detail.push(s);
      }
    }

    scene.add.image(930, 452, 'moon').setDepth(DEPTH.moon).setScale(0.9);

    scene.add.image(0, GROUND_TOP, 'ground').setOrigin(0).setDepth(DEPTH.ground);

    // casa
    const hx = LAYOUT.house.x;
    const hy = LAYOUT.house.y;
    scene.add.image(hx, hy, 'house').setOrigin(0.5, 1).setScale(HOUSE_SCALE).setDepth(hy);
    const hp = (cx: number, cy: number) => ({ x: hx + (cx - HOUSE_W / 2) * HOUSE_SCALE, y: hy - (HOUSE_H - cy) * HOUSE_SCALE });

    // brilho quente das janelas
    for (const [cx, cy, s] of [[HOUSE_W / 2 - 152, 398, 1.5], [HOUSE_W / 2 + 152, 398, 1.5], [HOUSE_W / 2, 212, 1.05]] as const) {
      const p = hp(cx, cy);
      const glow = scene.add.image(p.x, p.y, 'glow').setTint(hex(P.warm)).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.42).setScale(s).setDepth(hy + 1);
      this.ambient.push(scene.tweens.add({ targets: glow, alpha: 0.26, scale: s * 0.92, duration: 1300 + r() * 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }));
    }

    // pisca-pisca no beiral do telhado
    const peak = hp(HOUSE_W / 2, 100);
    for (const side of [-1, 1]) {
      const end = hp(side < 0 ? 52 : HOUSE_W - 52, 340);
      const n = 7;
      for (let i = 1; i <= n; i++) {
        const t = i / (n + 0.4);
        const x = peak.x + (end.x - peak.x) * t;
        const y = peak.y + (end.y - peak.y) * t + Math.sin(t * Math.PI * n) * 3;
        this.bulb(x, y, BULB_COLORS[(i + (side > 0 ? 2 : 0)) % BULB_COLORS.length], hy + 2, 0.62, i * 160 + (side > 0 ? 400 : 0));
      }
    }

    // fumaça da chaminé
    const ch = hp(449, 60);
    this.smoke = scene.add
      .particles(ch.x, ch.y, 'puff', {
        lifespan: { min: 3200, max: 4600 },
        speedY: { min: -46, max: -28 },
        speedX: { min: 6, max: 26 },
        scale: { start: 0.35, end: 1.5 },
        alpha: { start: 0.5, end: 0 },
        frequency: 420,
        quantity: 1,
      })
      .setDepth(hy - 1);

    // pinheiros escuros atrás da casa
    this.tree(262, 850, 'tree-small', 1.15, 0, r, false, hy - 2);
    this.tree(818, 848, 'tree-small', 1.05, 0, r, true, hy - 2);
    this.tree(1060, 868, 'tree-small', 1.2, 0, r);

    // a árvore de Natal iluminada da vila
    this.tree(160, 908, 'tree-big', 0.86, 16, r);
    const starGlow = scene.add.image(160, 908 - 470 * 0.86 * 0.9, 'glow').setTint(hex(P.goldLight)).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.6).setScale(0.9).setDepth(909);
    this.ambient.push(scene.tweens.add({ targets: starGlow, alpha: 0.3, scale: 0.7, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }));
    this.tree(968, 896, 'tree-med', 0.98, 8, r, true);

    // luzes do caminho
    this.lamp(64, 1408);
    this.lamp(1000, 1146);
    this.lantern(560, 1404);

    // enfeites
    scene.add.image(912, 1668, 'snowman').setOrigin(0.5, 1).setScale(0.82).setDepth(1668);
    scene.add.image(934, 1004, 'giftpile').setOrigin(0.5, 1).setScale(0.8).setDepth(1004);

    // área de entrega
    const d = LAYOUT.delivery;
    scene.add.image(d.x, d.y + 8, 'spot').setDepth(DEPTH.groundFx);
    this.ring = scene.add.image(d.x, d.y + 5, 'ring').setDepth(DEPTH.groundFx + 1).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.25);
    scene.tweens.add({ targets: this.ring, scale: 1.08, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // brilhos mágicos na área de entrega
    this.magic = scene.add
      .particles(d.x, d.y, 'sparkle', {
        x: { min: -95, max: 95 },
        y: { min: -20, max: 20 },
        lifespan: { min: 900, max: 1700 },
        speedY: { min: -70, max: -30 },
        scale: { start: 0.5, end: 0 },
        alpha: { start: 0.9, end: 0 },
        tint: [hex(P.goldLight), hex(P.gold), 0xffffff],
        blendMode: Phaser.BlendModes.ADD,
        frequency: 420,
        quantity: 1,
      })
      .setDepth(DEPTH.fx - 10);

    // moldura: árvores escuras em primeiro plano, como nas ilustrações clássicas de Natal
    scene.add.image(10, 1660, 'bare-a').setOrigin(BARE_TRUNK_X, 1).setDepth(DEPTH.foreground - 2);
    scene.add.image(GAME_W - 6, 1620, 'bare-b').setOrigin(1 - BARE_TRUNK_X, 1).setFlipX(true).setDepth(DEPTH.foreground - 2);
    scene.add.image(0, GAME_H, 'foreground').setOrigin(0, 1).setDepth(DEPTH.foreground);

    // bordas escurecidas
    this.vignette = scene.add.image(0, 0, 'vignette').setOrigin(0).setScale(4).setDepth(DEPTH.hud - 50);
  }

  private bulb(x: number, y: number, color: number, depth: number, scale: number, delay: number) {
    const b = this.scene.add.image(x, y, 'bulb').setTint(color).setScale(scale).setDepth(depth).setBlendMode(Phaser.BlendModes.ADD);
    this.ambient.push(
      this.scene.tweens.add({ targets: b, alpha: 0.3, duration: 620, yoyo: true, repeat: -1, delay: delay % 1500, hold: 300, repeatDelay: 250, ease: 'Sine.easeInOut' }),
    );
    return b;
  }

  private tree(x: number, y: number, key: string, scale: number, lights: number, r: () => number, flip = false, depth?: number) {
    const img = this.scene.add.image(x, y, key).setOrigin(0.5, 1).setScale(scale).setDepth(depth ?? y);
    if (flip) img.setFlipX(true);
    const w = img.width * scale;
    const h = img.height * scale;
    for (let i = 0; i < lights; i++) {
      // sorteia pontos dentro do triângulo da copa
      const t = 0.22 + r() * 0.62;
      const half = w * 0.4 * t;
      const lx = x + (r() * 2 - 1) * half;
      const ly = y - h * 0.14 - (1 - t) * h * 0.74;
      this.bulb(lx, ly, BULB_COLORS[i % BULB_COLORS.length], (depth ?? y) + 1, 0.55 * Math.max(0.8, scale), r() * 1500);
    }
    return img;
  }

  private lamp(x: number, y: number) {
    this.scene.add.image(x, y, 'lamp').setOrigin(0.5, 1).setDepth(y);
    const glow = this.scene.add
      .image(x, y - 244, 'glow')
      .setTint(hex(P.warm))
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.5)
      .setScale(1.25)
      .setDepth(y + 1);
    this.ambient.push(this.scene.tweens.add({ targets: glow, alpha: 0.36, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }));
    // poça de luz no chão
    this.scene.add.image(x, y + 4, 'glow').setTint(hex(P.warm)).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.2).setScale(1.5, 0.42).setDepth(DEPTH.groundFx);
  }

  private lantern(x: number, y: number) {
    this.scene.add.image(x, y, 'lantern').setOrigin(0.5, 1).setDepth(y);
    const glow = this.scene.add.image(x, y - 44, 'glow').setTint(hex(P.warm)).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.55).setScale(1.1).setDepth(y + 1);
    this.ambient.push(this.scene.tweens.add({ targets: glow, alpha: 0.36, scale: 1.0, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }));
    this.scene.add.image(x, y + 2, 'glow').setTint(hex(P.warm)).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.3).setScale(1.9, 0.5).setDepth(DEPTH.groundFx);
  }

  /** Destaca a área de entrega enquanto alguém está sendo atendido. */
  setDeliveryActive(active: boolean) {
    this.scene.tweens.add({ targets: this.ring, alpha: active ? 0.95 : 0.25, duration: 300 });
    this.magic.setFrequency(active ? 90 : 420, 1);
  }

  setQuality(level: Level) {
    const full = level === 'alta';
    const low = level === 'baixa';
    if (low) this.smoke.stop();
    else if (!this.smoke.emitting) this.smoke.start();
    if (low) this.magic.stop();
    else if (!this.magic.emitting) this.magic.start();
    for (const t of this.ambient) {
      if (low) t.pause();
      else t.resume();
    }
    for (const o of this.detail) (o as Phaser.GameObjects.Image).setVisible(full || level === 'media');
    this.vignette.setVisible(!low);
  }
}
