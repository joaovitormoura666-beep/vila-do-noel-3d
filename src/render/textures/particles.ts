import type Phaser from 'phaser';
import { PALETTE as P } from '../../config';
import { circle, ellipse, makeTexture, radial, rgba, rrect, star } from './canvas';

/** Texturas pequenas usadas por partículas, luzes e efeitos. */
export function createParticleTextures(scene: Phaser.Scene) {
  makeTexture(scene, 'flake', 20, 20, (ctx) => {
    radial(ctx, 10, 10, 10, [
      [0, 'rgba(255,255,255,1)'],
      [0.45, 'rgba(255,255,255,0.85)'],
      [1, 'rgba(255,255,255,0)'],
    ]);
  });

  makeTexture(scene, 'glow', 160, 160, (ctx) => {
    radial(ctx, 80, 80, 80, [
      [0, 'rgba(255,255,255,0.95)'],
      [0.3, 'rgba(255,255,255,0.45)'],
      [1, 'rgba(255,255,255,0)'],
    ]);
  });

  makeTexture(scene, 'sparkle', 40, 40, (ctx) => {
    radial(ctx, 20, 20, 18, [
      [0, 'rgba(255,255,255,0.7)'],
      [1, 'rgba(255,255,255,0)'],
    ]);
    star(ctx, 20, 20, 4, 19, 4.5, '#FFFFFF');
  });

  makeTexture(scene, 'bulb', 28, 28, (ctx) => {
    radial(ctx, 14, 14, 14, [
      [0, 'rgba(255,255,255,1)'],
      [0.35, 'rgba(255,255,255,0.9)'],
      [0.6, 'rgba(255,255,255,0.3)'],
      [1, 'rgba(255,255,255,0)'],
    ]);
  });

  makeTexture(scene, 'heart', 36, 34, (ctx) => {
    ctx.fillStyle = P.redLight;
    ctx.beginPath();
    ctx.moveTo(18, 31);
    ctx.bezierCurveTo(-2, 16, 4, 1, 12, 3);
    ctx.bezierCurveTo(16, 4, 18, 8, 18, 10);
    ctx.bezierCurveTo(18, 8, 20, 4, 24, 3);
    ctx.bezierCurveTo(32, 1, 38, 16, 18, 31);
    ctx.fill();
    circle(ctx, 11, 10, 3, 'rgba(255,255,255,0.6)');
  });

  makeTexture(scene, 'confetti', 14, 10, (ctx) => {
    rrect(ctx, 0, 0, 14, 10, 2, '#FFFFFF');
  });

  makeTexture(scene, 'puff', 72, 72, (ctx) => {
    radial(ctx, 36, 36, 36, [
      [0, 'rgba(235,240,250,0.75)'],
      [0.6, 'rgba(235,240,250,0.3)'],
      [1, 'rgba(235,240,250,0)'],
    ]);
  });

  makeTexture(scene, 'shadow', 120, 40, (ctx) => {
    ctx.save();
    ctx.translate(60, 20);
    ctx.scale(1, 0.33);
    radial(ctx, 0, 0, 58, [
      [0, 'rgba(23,37,59,0.55)'],
      [0.7, 'rgba(23,37,59,0.25)'],
      [1, 'rgba(23,37,59,0)'],
    ]);
    ctx.restore();
  });

  // raios dourados que giram atrás do presente revelado
  makeTexture(scene, 'rays', 640, 640, (ctx) => {
    const cx = 320;
    const n = 14;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2;
      const a1 = a0 + (Math.PI * 2) / n / 2;
      const g = ctx.createRadialGradient(cx, cx, 30, cx, cx, 320);
      g.addColorStop(0, rgba(P.goldLight, 0.75));
      g.addColorStop(0.6, rgba(P.gold, 0.28));
      g.addColorStop(1, rgba(P.gold, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(cx, cx);
      ctx.arc(cx, cx, 320, a0, a1);
      ctx.closePath();
      ctx.fill();
    }
    radial(ctx, cx, cx, 200, [
      [0, 'rgba(255,246,214,0.85)'],
      [0.5, 'rgba(255,236,170,0.3)'],
      [1, 'rgba(255,236,170,0)'],
    ]);
  });

  // anel de luz no chão da área de entrega
  makeTexture(scene, 'ring', 260, 110, (ctx) => {
    ctx.save();
    ctx.shadowColor = P.goldLight;
    ctx.shadowBlur = 16;
    ellipse(ctx, 130, 55, 104, 36, undefined, rgba(P.goldLight, 0.95), 6);
    ctx.restore();
  });
}
