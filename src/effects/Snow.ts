import Phaser from 'phaser';
import type { Quality } from '../../shared/types';
import { DEPTH, GAME_H, GAME_W } from '../config';

type Level = Exclude<Quality, 'auto'>;

const NEAR_FREQ: Record<Level, number> = { alta: 55, media: 115, baixa: 260 };
const FAR_FREQ: Record<Level, number> = { alta: 80, media: 170, baixa: -1 };

/** Neve caindo em duas camadas (longe e perto) com vento suave. */
export class Snow {
  private readonly near: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly far: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(scene: Phaser.Scene) {
    this.far = scene.add
      .particles(0, 0, 'flake', {
        x: { min: -20, max: GAME_W + 20 },
        y: -10,
        lifespan: { min: 11000, max: 15000 },
        speedY: { min: 55, max: 95 },
        speedX: { min: -14, max: 14 },
        scale: { min: 0.14, max: 0.32 },
        alpha: { min: 0.35, max: 0.7 },
        frequency: FAR_FREQ.alta,
        quantity: 1,
      })
      .setDepth(DEPTH.farSnow);

    this.near = scene.add
      .particles(0, 0, 'flake', {
        x: { min: -60, max: GAME_W + 60 },
        y: -20,
        lifespan: { min: 11000, max: 17000 },
        speedY: { min: 110, max: 190 },
        speedX: { min: -30, max: 30 },
        scale: { min: 0.3, max: 0.8 },
        alpha: { min: 0.55, max: 0.95 },
        frequency: NEAR_FREQ.alta,
        quantity: 1,
        deathZone: { type: 'onLeave', source: new Phaser.Geom.Rectangle(-120, -60, GAME_W + 240, GAME_H + 120) },
      })
      .setDepth(DEPTH.nearSnow);

    // começa com a tela já cheia de flocos
    this.far.fastForward(12000, 60);
    this.near.fastForward(14000, 60);
  }

  setQuality(level: Level) {
    this.near.setFrequency(NEAR_FREQ[level], 1);
    if (FAR_FREQ[level] < 0) {
      this.far.stop();
    } else {
      this.far.setFrequency(FAR_FREQ[level], 1);
      if (!this.far.emitting) this.far.start();
    }
  }

  update(timeMs: number) {
    const wind = Math.sin(timeMs / 3800) * 9 + Math.sin(timeMs / 1700) * 4;
    this.near.gravityX = wind;
    this.far.gravityX = wind * 0.5;
  }
}
