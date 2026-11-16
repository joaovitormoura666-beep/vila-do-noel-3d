import type Phaser from 'phaser';
import { PALETTE as P } from '../../config';
import { circle, ellipse, linear, makeTexture, poly, rgba, rrect, type Ctx } from './canvas';
import { giftBox } from './scenery';

const SKIN = '#F5CBA7';
const BEARD = '#FBFAF7';
const BEARD_SHADE = '#D6DEEA';

export function createSantaTextures(scene: Phaser.Scene) {
  makeTexture(scene, 'santa-body', 300, 260, drawBody);
  makeTexture(scene, 'santa-head', 300, 320, drawHead);
  makeTexture(scene, 'santa-blink', 120, 30, drawBlink);
  makeTexture(scene, 'santa-arm', 100, 180, drawArm);
  makeTexture(scene, 'sack', 240, 250, drawSack);
}

function fluffyBand(ctx: Ctx, x: number, y: number, w: number, h: number) {
  rrect(ctx, x, y, w, h, h / 2, BEARD);
  ctx.save();
  ctx.globalAlpha = 0.5;
  rrect(ctx, x + 6, y + h * 0.58, w - 12, h * 0.3, h * 0.15, BEARD_SHADE);
  ctx.restore();
}

function drawBody(ctx: Ctx, w: number, h: number) {
  const cx = w / 2;
  // botas
  for (const side of [-1, 1]) {
    const bx = cx + side * 44;
    rrect(ctx, bx - 30, h - 62, 60, 30, 8, P.redDark);
    ctx.beginPath();
    ctx.moveTo(bx - 28, h - 34);
    ctx.lineTo(bx + 28, h - 34);
    ctx.quadraticCurveTo(bx + 36 + (side > 0 ? 6 : 0), h - 30, bx + 34 + (side > 0 ? 6 : 0), h - 8);
    ctx.lineTo(bx - 34 - (side < 0 ? 6 : 0), h - 8);
    ctx.quadraticCurveTo(bx - 36 - (side < 0 ? 6 : 0), h - 30, bx - 28, h - 34);
    ctx.closePath();
    ctx.fillStyle = '#20222C';
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.beginPath();
    ctx.ellipse(bx - side * 8, h - 24, 12, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    fluffyBand(ctx, bx - 34, h - 50, 68, 20);
  }

  // casaco
  ctx.beginPath();
  ctx.moveTo(cx - 62, 30);
  ctx.bezierCurveTo(cx - 130, 44, cx - 150, 150, cx - 118, 204);
  ctx.lineTo(cx + 118, 204);
  ctx.bezierCurveTo(cx + 150, 150, cx + 130, 44, cx + 62, 30);
  ctx.closePath();
  ctx.fillStyle = linear(ctx, cx - 130, 0, cx + 130, 0, [
    [0, P.redDark],
    [0.3, P.red],
    [0.6, P.redLight],
    [1, P.redDark],
  ]);
  ctx.fill();

  // faixa de pelo central
  rrect(ctx, cx - 15, 40, 30, 168, 12, BEARD);
  // barra de pelo
  ctx.beginPath();
  ctx.moveTo(cx - 126, 190);
  ctx.quadraticCurveTo(cx, 214, cx + 126, 190);
  ctx.lineTo(cx + 124, 218);
  ctx.quadraticCurveTo(cx, 242, cx - 124, 218);
  ctx.closePath();
  ctx.fillStyle = BEARD;
  ctx.fill();
  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.strokeStyle = BEARD_SHADE;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(cx - 116, 216);
  ctx.quadraticCurveTo(cx, 238, cx + 116, 216);
  ctx.stroke();
  ctx.restore();

  // cinto
  ctx.beginPath();
  ctx.moveTo(cx - 133, 132);
  ctx.quadraticCurveTo(cx, 152, cx + 133, 132);
  ctx.lineTo(cx + 134, 160);
  ctx.quadraticCurveTo(cx, 182, cx - 134, 160);
  ctx.closePath();
  ctx.fillStyle = '#20222C';
  ctx.fill();
  rrect(ctx, cx - 28, 134, 56, 44, 9, P.gold, P.goldDark, 3);
  rrect(ctx, cx - 15, 146, 30, 20, 4, '#20222C');
  ctx.fillStyle = P.goldLight;
  ctx.fillRect(cx - 22, 139, 44, 4);
}

function drawArm(ctx: Ctx, w: number) {
  const cx = w / 2;
  // manga
  ctx.beginPath();
  ctx.moveTo(cx - 24, 22);
  ctx.quadraticCurveTo(cx - 30, 80, cx - 27, 118);
  ctx.lineTo(cx + 27, 118);
  ctx.quadraticCurveTo(cx + 30, 80, cx + 24, 22);
  ctx.quadraticCurveTo(cx, -2, cx - 24, 22);
  ctx.closePath();
  ctx.fillStyle = linear(ctx, cx - 30, 0, cx + 30, 0, [
    [0, P.redDark],
    [0.5, P.red],
    [1, P.redDark],
  ]);
  ctx.fill();
  // luva
  circle(ctx, cx, 150, 24, P.green);
  ellipse(ctx, cx + 20, 140, 9, 13, P.green, undefined, 0, 0.5);
  circle(ctx, cx - 7, 143, 6, 'rgba(255,255,255,0.14)');
  // punho de pelo
  fluffyBand(ctx, cx - 33, 108, 66, 28);
}

function drawHead(ctx: Ctx, w: number) {
  const cx = w / 2;
  const fy = 150; // centro do rosto

  // barba (fundo)
  ctx.beginPath();
  ctx.moveTo(cx - 92, fy - 10);
  ctx.bezierCurveTo(cx - 118, fy + 40, cx - 104, fy + 96, cx - 72, fy + 112);
  ctx.bezierCurveTo(cx - 62, fy + 140, cx - 28, fy + 150, cx, fy + 164);
  ctx.bezierCurveTo(cx + 28, fy + 150, cx + 62, fy + 140, cx + 72, fy + 112);
  ctx.bezierCurveTo(cx + 104, fy + 96, cx + 118, fy + 40, cx + 92, fy - 10);
  ctx.closePath();
  ctx.fillStyle = BEARD;
  ctx.fill();
  // cachos da barba
  ctx.save();
  ctx.strokeStyle = BEARD_SHADE;
  ctx.lineWidth = 4;
  ctx.globalAlpha = 0.8;
  for (const [x, y, r] of [
    [-62, 78, 18],
    [-30, 108, 18],
    [8, 124, 18],
    [44, 100, 18],
    [70, 70, 16],
    [-8, 86, 14],
  ] as const) {
    ctx.beginPath();
    ctx.arc(cx + x, fy + y, r, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  }
  ctx.restore();

  // rosto
  ellipse(ctx, cx, fy, 78, 64, SKIN);
  // bochechas
  circle(ctx, cx - 50, fy + 20, 17, rgba('#E8767F', 0.45));
  circle(ctx, cx + 50, fy + 20, 17, rgba('#E8767F', 0.45));
  // olhos
  for (const side of [-1, 1]) {
    ellipse(ctx, cx + side * 30, fy - 4, 8, 10.5, '#2A2026');
    circle(ctx, cx + side * 30 + 3, fy - 8, 3.2, '#FFFFFF');
    // sobrancelhas brancas
    ctx.strokeStyle = BEARD;
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(cx + side * 16, fy - 26);
    ctx.quadraticCurveTo(cx + side * 32, fy - 38, cx + side * 48, fy - 24);
    ctx.stroke();
  }

  // boca
  ctx.fillStyle = '#7A2A33';
  ctx.beginPath();
  ctx.moveTo(cx - 17, fy + 38);
  ctx.quadraticCurveTo(cx, fy + 62, cx + 17, fy + 38);
  ctx.closePath();
  ctx.fill();

  // bigode
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx, fy + 22);
    ctx.bezierCurveTo(cx + side * 16, fy + 10, cx + side * 54, fy + 16, cx + side * 66, fy + 40);
    ctx.bezierCurveTo(cx + side * 44, fy + 54, cx + side * 14, fy + 50, cx, fy + 34);
    ctx.closePath();
    ctx.fillStyle = BEARD;
    ctx.fill();
    ctx.save();
    ctx.globalAlpha = 0.7;
    ctx.strokeStyle = BEARD_SHADE;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx + side * 12, fy + 40);
    ctx.quadraticCurveTo(cx + side * 40, fy + 50, cx + side * 60, fy + 40);
    ctx.stroke();
    ctx.restore();
  }
  // nariz
  circle(ctx, cx, fy + 18, 15, '#EE9F8B');
  circle(ctx, cx - 5, fy + 13, 5, 'rgba(255,255,255,0.5)');

  // gorro
  ctx.beginPath();
  ctx.moveTo(cx - 84, fy - 44);
  ctx.bezierCurveTo(cx - 80, fy - 120, cx - 10, fy - 148, cx + 46, fy - 130);
  ctx.bezierCurveTo(cx + 96, fy - 114, cx + 118, fy - 70, cx + 116, fy - 30);
  ctx.bezierCurveTo(cx + 100, fy - 64, cx + 92, fy - 78, cx + 84, fy - 44);
  ctx.closePath();
  ctx.fillStyle = linear(ctx, cx - 84, 0, cx + 116, 0, [
    [0, P.red],
    [0.5, P.redLight],
    [1, P.redDark],
  ]);
  ctx.fill();
  fluffyBand(ctx, cx - 96, fy - 68, 192, 42);
  // pompom
  circle(ctx, cx + 116, fy - 26, 22, BEARD);
  ctx.save();
  ctx.globalAlpha = 0.6;
  ctx.strokeStyle = BEARD_SHADE;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(cx + 116, fy - 26, 15, 0.1 * Math.PI, 0.8 * Math.PI);
  ctx.stroke();
  ctx.restore();
}

function drawBlink(ctx: Ctx, w: number, h: number) {
  const cy = h / 2;
  for (const x of [w / 2 - 30, w / 2 + 30]) {
    ellipse(ctx, x, cy, 11, 13, SKIN);
    ctx.strokeStyle = '#2A2026';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x, cy - 3, 9, 0.12 * Math.PI, 0.88 * Math.PI);
    ctx.stroke();
  }
}

function drawSack(ctx: Ctx, w: number, h: number) {
  const cx = w / 2;
  ctx.save();
  ctx.globalAlpha = 0.25;
  ellipse(ctx, cx, h - 10, 96, 14, '#2A3E5F');
  ctx.restore();

  // presentes aparecendo no topo
  giftBox(ctx, cx - 62, 44, 54, 50, P.green, P.gold);
  giftBox(ctx, cx + 4, 30, 60, 58, P.gold, P.red);
  poly(ctx, [[cx - 6, 20], [cx + 6, 20], [cx + 4, 80], [cx - 4, 80]], P.snow);

  // saco
  ctx.beginPath();
  ctx.moveTo(cx - 60, 78);
  ctx.bezierCurveTo(cx - 118, 110, cx - 124, 220, cx - 84, h - 12);
  ctx.lineTo(cx + 84, h - 12);
  ctx.bezierCurveTo(cx + 124, 220, cx + 118, 110, cx + 60, 78);
  ctx.quadraticCurveTo(cx, 96, cx - 60, 78);
  ctx.closePath();
  ctx.fillStyle = linear(ctx, cx - 110, 0, cx + 110, 0, [
    [0, '#7E2430'],
    [0.4, '#A63340'],
    [0.7, '#B8404C'],
    [1, '#7E2430'],
  ]);
  ctx.fill();
  // boca do saco
  ctx.beginPath();
  ctx.moveTo(cx - 72, 70);
  ctx.quadraticCurveTo(cx, 98, cx + 72, 70);
  ctx.quadraticCurveTo(cx + 66, 92, cx + 58, 96);
  ctx.quadraticCurveTo(cx, 116, cx - 58, 96);
  ctx.quadraticCurveTo(cx - 66, 92, cx - 72, 70);
  ctx.closePath();
  ctx.fillStyle = '#C24E59';
  ctx.fill();
  // corda dourada
  ctx.strokeStyle = P.gold;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(cx - 60, 98);
  ctx.quadraticCurveTo(cx, 120, cx + 60, 98);
  ctx.stroke();
  circle(ctx, cx + 38, 116, 8, P.gold, P.goldDark, 2);
  // remendo
  ctx.save();
  ctx.translate(cx - 44, 176);
  ctx.rotate(-0.2);
  rrect(ctx, -18, -16, 36, 32, 4, P.green);
  ctx.strokeStyle = P.goldLight;
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]);
  ctx.strokeRect(-14, -12, 28, 24);
  ctx.restore();
  // dobras
  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.strokeStyle = '#4E121B';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(cx + 30, 126);
  ctx.quadraticCurveTo(cx + 54, 170, cx + 46, 214);
  ctx.moveTo(cx - 6, 128);
  ctx.quadraticCurveTo(cx - 2, 160, cx - 12, 196);
  ctx.stroke();
  ctx.restore();
}
