import type Phaser from 'phaser';
import { PALETTE as P } from '../../config';
import { circle, ellipse, linear, makeTexture, poly, rgba, rng, rrect, shade, type Ctx } from './canvas';

export const LOOK_COUNT = 24;
export const LOOK_W = 136;
export const LOOK_H = 156;

const COATS = ['#B62835', '#2F7D62', '#E8BC65', '#3D6FA8', '#7A4B9A', '#D9698C', '#2E8C8C', '#D9773B', '#EADFCB', '#5B6FC4'];
const ACCENTS = ['#F7F4EF', '#E8BC65', '#B62835', '#174D3B', '#F2A0B5', '#8FD0C0'];
const SKINS = ['#F9D9BF', '#F0C19C', '#D9A074', '#B57A52', '#8A5638'];
const HAIRS = ['#2B1B14', '#5A3620', '#A9692F', '#E8C77A', '#8C2F2F', '#3B3B48'];

export interface Look {
  coat: string;
  accent: string;
  skin: string;
  hair: string;
  hat: number;
  hatColor: string;
  smile: number;
}

export function lookFor(index: number): Look {
  const r = rng(index * 7919 + 13);
  const coat = COATS[index % COATS.length];
  let accent = ACCENTS[Math.floor(r() * ACCENTS.length)];
  if (accent.toLowerCase() === coat.toLowerCase()) accent = '#F7F4EF';
  let hatColor = COATS[Math.floor(r() * COATS.length)];
  if (hatColor === coat) hatColor = accent;
  return {
    coat,
    accent,
    skin: SKINS[Math.floor(r() * SKINS.length)],
    hair: HAIRS[Math.floor(r() * HAIRS.length)],
    hat: index % 4,
    hatColor,
    smile: Math.floor(r() * 3),
  };
}

export function createVisitorTextures(scene: Phaser.Scene) {
  for (let i = 0; i < LOOK_COUNT; i++) {
    makeTexture(scene, `look-${i}`, LOOK_W, LOOK_H, (ctx) => drawVisitor(ctx, lookFor(i)));
  }
  makeTexture(scene, 'foot', 34, 22, (ctx) => {
    rrect(ctx, 1, 3, 32, 18, [10, 10, 7, 7], '#3A2A2A');
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.beginPath();
    ctx.ellipse(12, 9, 7, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawVisitor(ctx: Ctx, look: Look) {
  const cx = LOOK_W / 2;
  const headY = 62;
  const headR = 38;
  const bodyTop = 92;
  const bodyBottom = LOOK_H - 6;

  // braços
  for (const side of [-1, 1]) {
    ctx.strokeStyle = shade(look.coat, -0.12);
    ctx.lineWidth = 19;
    ctx.beginPath();
    ctx.moveTo(cx + side * 30, bodyTop + 12);
    ctx.quadraticCurveTo(cx + side * 46, bodyTop + 26, cx + side * 46, bodyTop + 40);
    ctx.stroke();
    circle(ctx, cx + side * 46, bodyTop + 44, 11, look.accent, 'rgba(0,0,0,0.12)', 1.5);
  }

  // casaco
  ctx.beginPath();
  ctx.moveTo(cx - 30, bodyTop);
  ctx.quadraticCurveTo(cx - 46, bodyTop + 30, cx - 42, bodyBottom - 8);
  ctx.quadraticCurveTo(cx, bodyBottom + 8, cx + 42, bodyBottom - 8);
  ctx.quadraticCurveTo(cx + 46, bodyTop + 30, cx + 30, bodyTop);
  ctx.closePath();
  ctx.fillStyle = linear(ctx, cx - 44, 0, cx + 44, 0, [
    [0, shade(look.coat, -0.14)],
    [0.45, look.coat],
    [0.7, shade(look.coat, 0.12)],
    [1, shade(look.coat, -0.14)],
  ]);
  ctx.fill();
  // zíper e botões
  ctx.strokeStyle = 'rgba(0,0,0,0.16)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(cx, bodyTop + 14);
  ctx.lineTo(cx, bodyBottom - 4);
  ctx.stroke();
  circle(ctx, cx + 8, bodyTop + 28, 3.4, look.accent);
  circle(ctx, cx + 8, bodyTop + 43, 3.4, look.accent);
  // barra do casaco
  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.strokeStyle = look.accent;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(cx - 40, bodyBottom - 11);
  ctx.quadraticCurveTo(cx, bodyBottom + 4, cx + 40, bodyBottom - 11);
  ctx.stroke();
  ctx.restore();

  // cabeça
  circle(ctx, cx, headY, headR, look.skin);
  // orelhas
  circle(ctx, cx - headR + 2, headY + 4, 7, look.skin);
  circle(ctx, cx + headR - 2, headY + 4, 7, look.skin);

  // cachecol
  rrect(ctx, cx - 32, bodyTop - 9, 64, 19, 9, look.accent);
  rrect(ctx, cx - 30, bodyTop + 2, 17, 30, 7, look.accent);
  ctx.fillStyle = 'rgba(0,0,0,0.13)';
  ctx.fillRect(cx - 30, bodyTop + 20, 17, 4);
  ctx.fillRect(cx - 14, bodyTop - 9, 4, 19);
  ctx.fillRect(cx + 8, bodyTop - 9, 4, 19);

  // rosto
  circle(ctx, cx - 21, headY + 14, 8, rgba('#E8767F', 0.42));
  circle(ctx, cx + 21, headY + 14, 8, rgba('#E8767F', 0.42));
  for (const side of [-1, 1]) {
    ellipse(ctx, cx + side * 14, headY + 5, 4.6, 6, '#2A2026');
    circle(ctx, cx + side * 14 + 1.6, headY + 2.6, 1.9, '#FFFFFF');
  }
  ctx.strokeStyle = '#6A2A2A';
  ctx.lineWidth = 3;
  ctx.beginPath();
  if (look.smile === 0) {
    ctx.arc(cx, headY + 13, 8, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  } else if (look.smile === 1) {
    ctx.moveTo(cx - 8, headY + 16);
    ctx.quadraticCurveTo(cx, headY + 28, cx + 8, headY + 16);
    ctx.closePath();
    ctx.fillStyle = '#7A2A33';
    ctx.fill();
  } else {
    ctx.arc(cx, headY + 15, 6, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();
  }

  drawHat(ctx, look, cx, headY, headR);
}

function drawHat(ctx: Ctx, look: Look, cx: number, headY: number, r: number) {
  const hairFringe = () => {
    ctx.fillStyle = look.hair;
    ctx.beginPath();
    ctx.moveTo(cx - r + 3, headY - 6);
    ctx.quadraticCurveTo(cx - 20, headY - 26, cx - 4, headY - 12);
    ctx.quadraticCurveTo(cx + 14, headY - 26, cx + r - 3, headY - 6);
    ctx.quadraticCurveTo(cx + r - 2, headY - 34, cx, headY - 36);
    ctx.quadraticCurveTo(cx - r + 2, headY - 34, cx - r + 3, headY - 6);
    ctx.fill();
  };

  switch (look.hat) {
    case 0: {
      // gorro com pompom
      hairFringe();
      ctx.beginPath();
      ctx.moveTo(cx - r - 2, headY - 12);
      ctx.bezierCurveTo(cx - r, headY - 62, cx + r, headY - 62, cx + r + 2, headY - 12);
      ctx.closePath();
      ctx.fillStyle = look.hatColor;
      ctx.fill();
      rrect(ctx, cx - r - 5, headY - 24, r * 2 + 10, 17, 8, shade(look.hatColor, 0.3));
      ctx.strokeStyle = 'rgba(0,0,0,0.1)';
      ctx.lineWidth = 2;
      for (let x = cx - r + 4; x < cx + r; x += 10) {
        ctx.beginPath();
        ctx.moveTo(x, headY - 22);
        ctx.lineTo(x, headY - 9);
        ctx.stroke();
      }
      circle(ctx, cx, headY - 54, 11, P.snow, 'rgba(0,0,0,0.08)', 1.5);
      break;
    }
    case 1: {
      // gorro de duende
      hairFringe();
      ctx.beginPath();
      ctx.moveTo(cx - r - 2, headY - 14);
      ctx.quadraticCurveTo(cx - 14, headY - 46, cx + 30, headY - 60);
      ctx.quadraticCurveTo(cx + 20, headY - 36, cx + r + 2, headY - 14);
      ctx.closePath();
      ctx.fillStyle = look.hatColor;
      ctx.fill();
      // barra em zigue-zague
      const pts: Array<[number, number]> = [];
      const n = 7;
      for (let i = 0; i <= n; i++) {
        const x = cx - r - 4 + ((r * 2 + 8) / n) * i;
        pts.push([x, headY - 22]);
      }
      for (let i = n; i >= 0; i--) {
        const x = cx - r - 4 + ((r * 2 + 8) / n) * i;
        pts.push([x, headY - 10]);
        if (i > 0) pts.push([x - (r * 2 + 8) / n / 2, headY - 3]);
      }
      poly(ctx, pts, look.accent);
      circle(ctx, cx + 32, headY - 60, 7, P.gold, P.goldDark, 1.5);
      break;
    }
    case 2: {
      // cabelo + protetor de orelha
      ctx.fillStyle = look.hair;
      ctx.beginPath();
      ctx.moveTo(cx - r - 1, headY + 2);
      ctx.bezierCurveTo(cx - r - 6, headY - 50, cx + r + 6, headY - 50, cx + r + 1, headY + 2);
      ctx.quadraticCurveTo(cx + r - 6, headY - 16, cx + 10, headY - 18);
      ctx.quadraticCurveTo(cx - 6, headY - 8, cx - 22, headY - 18);
      ctx.quadraticCurveTo(cx - r + 4, headY - 14, cx - r - 1, headY + 2);
      ctx.fill();
      ctx.strokeStyle = shade(look.hatColor, -0.2);
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(cx, headY, r + 3, Math.PI * 1.08, Math.PI * 1.92);
      ctx.stroke();
      circle(ctx, cx - r - 1, headY + 4, 12, look.hatColor, 'rgba(0,0,0,0.1)', 1.5);
      circle(ctx, cx + r + 1, headY + 4, 12, look.hatColor, 'rgba(0,0,0,0.1)', 1.5);
      break;
    }
    default: {
      // tiara de rena
      ctx.fillStyle = look.hair;
      ctx.beginPath();
      ctx.moveTo(cx - r, headY - 2);
      ctx.bezierCurveTo(cx - r - 4, headY - 48, cx + r + 4, headY - 48, cx + r, headY - 2);
      ctx.quadraticCurveTo(cx + 18, headY - 26, cx, headY - 16);
      ctx.quadraticCurveTo(cx - 18, headY - 26, cx - r, headY - 2);
      ctx.fill();
      ctx.strokeStyle = '#8A5A34';
      ctx.lineWidth = 6;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(cx + side * 17, headY - 30);
        ctx.quadraticCurveTo(cx + side * 22, headY - 46, cx + side * 30, headY - 56);
        ctx.moveTo(cx + side * 22, headY - 43);
        ctx.lineTo(cx + side * 13, headY - 54);
        ctx.moveTo(cx + side * 26, headY - 50);
        ctx.lineTo(cx + side * 38, headY - 47);
        ctx.stroke();
      }
      circle(ctx, cx, headY + 9, 5.5, P.redLight);
      break;
    }
  }
}
