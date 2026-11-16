import type Phaser from 'phaser';
import { PALETTE as P } from '../../config';
import { circle, ellipse, linear, makeTexture, poly, radial, rgba, rrect, shade, star, type Ctx } from './canvas';

export const GIFT_TEX = 180;

const DRAWERS: Record<string, (ctx: Ctx) => void> = {
  estrela: drawStar,
  bola: drawOrnament,
  bengala: drawCane,
  boneco: drawSnowman,
  ursinho: drawTeddy,
  sino: drawBell,
  meia: drawStocking,
  biscoito: drawGingerbread,
  globo: drawGlobe,
  pinheirinho: drawMiniTree,
  chocolate: drawCocoa,
  trenzinho: drawTrain,
};

export function createGiftTextures(scene: Phaser.Scene) {
  for (const [id, draw] of Object.entries(DRAWERS)) {
    makeTexture(scene, `gift-${id}`, GIFT_TEX, GIFT_TEX, draw);
  }
  makeTexture(scene, 'box-body', 150, 120, drawBoxBody);
  makeTexture(scene, 'box-lid', 170, 96, drawBoxLid);
}

export function hasGiftTexture(id: string) {
  return id in DRAWERS;
}

const C = GIFT_TEX / 2;

function shine(ctx: Ctx, x: number, y: number, r: number) {
  ctx.save();
  ctx.globalAlpha = 0.65;
  ellipse(ctx, x, y, r, r * 0.6, '#FFFFFF', undefined, 0, -0.6);
  ctx.restore();
}

function drawStar(ctx: Ctx) {
  ctx.save();
  ctx.lineJoin = 'round';
  star(ctx, C, C + 4, 5, 78, 36, P.goldDark, P.goldDark, 10);
  star(ctx, C, C, 5, 78, 36, P.gold, P.gold, 10);
  star(ctx, C, C, 5, 50, 24, P.goldLight, P.goldLight, 6);
  ctx.restore();
  circle(ctx, C - 13, C + 2, 5, '#5A3A1A');
  circle(ctx, C + 13, C + 2, 5, '#5A3A1A');
  ctx.strokeStyle = '#5A3A1A';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.arc(C, C + 10, 9, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
  circle(ctx, C - 24, C + 12, 6, rgba('#E8767F', 0.5));
  circle(ctx, C + 24, C + 12, 6, rgba('#E8767F', 0.5));
}

function drawOrnament(ctx: Ctx) {
  // argola e tampa
  ctx.strokeStyle = P.goldDark;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(C, 20, 9, Math.PI, 0);
  ctx.stroke();
  rrect(ctx, C - 13, 22, 26, 24, 5, P.gold, P.goldDark, 2);
  // bola
  ctx.save();
  ctx.beginPath();
  ctx.arc(C, C + 14, 62, 0, Math.PI * 2);
  ctx.clip();
  radial(ctx, C - 20, C - 8, 110, [
    [0, P.redLight],
    [0.5, P.red],
    [1, P.redDark],
  ]);
  ctx.strokeStyle = P.gold;
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(C - 70, C + 8);
  ctx.quadraticCurveTo(C, C + 34, C + 70, C + 8);
  ctx.stroke();
  for (let i = -2; i <= 2; i++) star(ctx, C + i * 26, C + 44 - Math.abs(i) * 5, 4, 7, 2.5, P.snow);
  ctx.restore();
  shine(ctx, C - 26, C - 14, 15);
}

function drawCane(ctx: Ctx) {
  const off = document.createElement('canvas');
  off.width = GIFT_TEX;
  off.height = GIFT_TEX;
  const o = off.getContext('2d')!;
  o.lineCap = 'round';
  const path = () => {
    o.beginPath();
    o.moveTo(70, 160);
    o.lineTo(70, 62);
    o.arc(102, 62, 32, Math.PI, 0);
    o.lineTo(134, 84);
  };
  path();
  o.strokeStyle = '#C9D2DF';
  o.lineWidth = 34;
  o.stroke();
  path();
  o.strokeStyle = P.snow;
  o.lineWidth = 28;
  o.stroke();
  o.globalCompositeOperation = 'source-atop';
  o.strokeStyle = P.red;
  o.lineWidth = 12;
  for (let i = -60; i < 240; i += 30) {
    o.beginPath();
    o.moveTo(0, i + 50);
    o.lineTo(GIFT_TEX, i - 40);
    o.stroke();
  }
  ctx.drawImage(off, -12, -4);
  // laço verde
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(58 + side * 17, 112, 16, 10, side * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = P.greenLight;
    ctx.fill();
  }
  circle(ctx, 58, 112, 7, P.green);
}

function snowBall(ctx: Ctx, x: number, y: number, r: number) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();
  radial(ctx, x - r * 0.3, y - r * 0.35, r * 1.7, [
    [0, '#FFFFFF'],
    [0.65, '#E6ECF5'],
    [1, '#B4C5DC'],
  ]);
  ctx.restore();
  circle(ctx, x, y, r, undefined, 'rgba(120,140,175,0.55)', 2.5);
}

function drawSnowman(ctx: Ctx) {
  snowBall(ctx, C, 124, 46);
  snowBall(ctx, C, 66, 34);
  rrect(ctx, C - 32, 86, 64, 14, 7, P.red);
  rrect(ctx, C + 10, 90, 14, 34, 6, P.red);
  circle(ctx, C - 11, 60, 4, '#1E2433');
  circle(ctx, C + 11, 60, 4, '#1E2433');
  poly(ctx, [[C, 66], [C + 26, 72], [C, 76]], '#E8873A');
  circle(ctx, C, 112, 4, P.green);
  circle(ctx, C, 130, 4, P.green);
  // cartola
  rrect(ctx, C - 36, 30, 72, 10, 5, '#26324A');
  rrect(ctx, C - 22, 4, 44, 30, 5, '#26324A');
  ctx.fillStyle = P.red;
  ctx.fillRect(C - 22, 24, 44, 7);
}

function drawTeddy(ctx: Ctx) {
  const brown = '#B07A4A';
  const dark = '#8A5A34';
  const light = '#E4C59A';
  circle(ctx, C - 40, 36, 19, brown);
  circle(ctx, C + 40, 36, 19, brown);
  circle(ctx, C - 40, 36, 10, light);
  circle(ctx, C + 40, 36, 10, light);
  // corpo
  ellipse(ctx, C, 128, 46, 42, brown);
  ellipse(ctx, C, 134, 26, 26, light);
  // braços e pés
  ellipse(ctx, C - 48, 118, 14, 22, dark, undefined, 0, 0.4);
  ellipse(ctx, C + 48, 118, 14, 22, dark, undefined, 0, -0.4);
  ellipse(ctx, C - 26, 164, 19, 12, dark);
  ellipse(ctx, C + 26, 164, 19, 12, dark);
  // cabeça
  circle(ctx, C, 66, 46, brown);
  ellipse(ctx, C, 80, 22, 17, light);
  ellipse(ctx, C, 72, 8, 6, '#3A2420');
  ctx.strokeStyle = '#3A2420';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(C, 78);
  ctx.lineTo(C, 84);
  ctx.arc(C - 6, 84, 6, 0, Math.PI * 0.9);
  ctx.moveTo(C, 84);
  ctx.arc(C + 6, 84, 6, Math.PI, Math.PI * 0.1, true);
  ctx.stroke();
  circle(ctx, C - 18, 58, 5, '#2A2026');
  circle(ctx, C + 18, 58, 5, '#2A2026');
  circle(ctx, C - 16.5, 56, 1.8, '#FFFFFF');
  circle(ctx, C + 19.5, 56, 1.8, '#FFFFFF');
  // laço vermelho
  poly(ctx, [[C, 106], [C - 24, 94], [C - 24, 118]], P.red);
  poly(ctx, [[C, 106], [C + 24, 94], [C + 24, 118]], P.red);
  circle(ctx, C, 106, 7, P.redLight);
}

function drawBell(ctx: Ctx) {
  // laço
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(C + side * 22, 28, 22, 13, side * 0.45, 0, Math.PI * 2);
    ctx.fillStyle = P.red;
    ctx.fill();
  }
  circle(ctx, C, 30, 9, P.redLight);
  // sino
  ctx.beginPath();
  ctx.moveTo(C - 16, 38);
  ctx.bezierCurveTo(C - 50, 50, C - 44, 112, C - 68, 134);
  ctx.lineTo(C + 68, 134);
  ctx.bezierCurveTo(C + 44, 112, C + 50, 50, C + 16, 38);
  ctx.closePath();
  ctx.fillStyle = linear(ctx, C - 60, 0, C + 60, 0, [
    [0, P.goldDark],
    [0.35, P.gold],
    [0.55, P.goldLight],
    [1, P.goldDark],
  ]);
  ctx.fill();
  rrect(ctx, C - 74, 128, 148, 18, 9, P.gold, P.goldDark, 2.5);
  circle(ctx, C, 156, 13, P.goldDark);
  circle(ctx, C - 4, 152, 4, P.goldLight);
  shine(ctx, C - 22, 78, 10);
}

function drawStocking(ctx: Ctx) {
  ctx.beginPath();
  ctx.moveTo(C - 30, 40);
  ctx.lineTo(C - 30, 104);
  ctx.bezierCurveTo(C - 34, 124, C - 74, 126, C - 70, 150);
  ctx.bezierCurveTo(C - 66, 172, C - 10, 170, C + 14, 158);
  ctx.bezierCurveTo(C + 34, 148, C + 32, 124, C + 32, 104);
  ctx.lineTo(C + 32, 40);
  ctx.closePath();
  ctx.fillStyle = linear(ctx, C - 60, 0, C + 40, 0, [
    [0, P.redDark],
    [0.5, P.red],
    [1, P.redLight],
  ]);
  ctx.fill();
  // ponteira e calcanhar
  ctx.save();
  ctx.clip();
  circle(ctx, C - 64, 152, 26, P.green);
  circle(ctx, C + 30, 118, 20, P.green);
  ctx.restore();
  rrect(ctx, C - 40, 18, 82, 32, 14, P.snow, 'rgba(120,140,175,0.4)', 2);
  star(ctx, C, 82, 5, 13, 6, P.gold);
}

function drawGingerbread(ctx: Ctx) {
  const col = '#B8743C';
  const dark = '#8E5527';
  ctx.strokeStyle = col;
  ctx.lineCap = 'round';
  ctx.lineWidth = 30;
  ctx.beginPath();
  ctx.moveTo(C - 50, 92);
  ctx.lineTo(C + 50, 92);
  ctx.moveTo(C - 4, 110);
  ctx.lineTo(C - 28, 156);
  ctx.moveTo(C + 4, 110);
  ctx.lineTo(C + 28, 156);
  ctx.stroke();
  ellipse(ctx, C, 106, 30, 34, col);
  circle(ctx, C, 48, 36, col);
  ctx.strokeStyle = dark;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(C, 48, 36, 0, Math.PI * 2);
  ctx.globalAlpha = 0.35;
  ctx.stroke();
  ctx.globalAlpha = 1;
  // glacê
  ctx.strokeStyle = P.snow;
  ctx.lineWidth = 5;
  const wavy = (x0: number, y0: number, x1: number, y1: number) => {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo((x0 + x1) / 2, y0 + 8, x1, y1);
    ctx.stroke();
  };
  wavy(C - 60, 84, C - 44, 100);
  wavy(C + 44, 100, C + 60, 84);
  wavy(C - 38, 150, C - 20, 158);
  wavy(C + 20, 158, C + 38, 150);
  circle(ctx, C - 13, 42, 4.5, '#3A2420');
  circle(ctx, C + 13, 42, 4.5, '#3A2420');
  ctx.strokeStyle = P.snow;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(C, 52, 13, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
  circle(ctx, C - 24, 54, 5, rgba('#E8767F', 0.6));
  circle(ctx, C + 24, 54, 5, rgba('#E8767F', 0.6));
  circle(ctx, C, 96, 5.5, P.red);
  circle(ctx, C, 116, 5.5, P.greenLight);
}

function drawGlobe(ctx: Ctx) {
  // base
  ctx.beginPath();
  ctx.moveTo(C - 44, 138);
  ctx.lineTo(C + 44, 138);
  ctx.lineTo(C + 58, 170);
  ctx.lineTo(C - 58, 170);
  ctx.closePath();
  ctx.fillStyle = P.red;
  ctx.fill();
  rrect(ctx, C - 62, 162, 124, 14, 7, P.redDark);
  rrect(ctx, C - 30, 146, 60, 10, 5, P.gold);
  // vidro
  ctx.save();
  ctx.beginPath();
  ctx.arc(C, 82, 66, 0, Math.PI * 2);
  ctx.clip();
  radial(ctx, C - 20, 60, 120, [
    [0, '#DDF0FF'],
    [0.6, '#9FC6EC'],
    [1, '#5F8FC4'],
  ]);
  // neve no fundo
  ellipse(ctx, C, 146, 80, 30, P.snow);
  // pinheirinho
  poly(ctx, [[C, 44], [C - 30, 92], [C + 30, 92]], P.greenLight);
  poly(ctx, [[C, 70], [C - 38, 124], [C + 38, 124]], P.green);
  rrect(ctx, C - 6, 120, 12, 14, 2, P.woodDark);
  star(ctx, C, 42, 5, 11, 5, P.gold);
  for (const [x, y] of [[-40, 54], [38, 40], [46, 88], [-48, 98], [-18, 30], [20, 64], [-30, 74], [52, 112]] as const) {
    circle(ctx, C + x, y, 3.2, '#FFFFFF');
  }
  ctx.restore();
  circle(ctx, C, 82, 66, undefined, 'rgba(255,255,255,0.75)', 4);
  shine(ctx, C - 34, 48, 16);
}

function drawMiniTree(ctx: Ctx) {
  // vaso
  poly(ctx, [[C - 34, 134], [C + 34, 134], [C + 26, 174], [C - 26, 174]], P.red);
  rrect(ctx, C - 40, 126, 80, 16, 6, P.redLight);
  rrect(ctx, C - 7, 112, 14, 18, 2, P.woodDark);
  const tier = (top: number, bottom: number, half: number, color: string) => {
    ctx.beginPath();
    ctx.moveTo(C, top);
    ctx.quadraticCurveTo(C + half * 0.5, top + (bottom - top) * 0.6, C + half, bottom);
    ctx.quadraticCurveTo(C, bottom + 12, C - half, bottom);
    ctx.quadraticCurveTo(C - half * 0.5, top + (bottom - top) * 0.6, C, top);
    ctx.fillStyle = color;
    ctx.fill();
  };
  tier(58, 120, 56, P.green);
  tier(34, 92, 44, shade(P.greenLight, 0.02));
  tier(14, 62, 31, shade(P.greenLight, 0.12));
  for (const [x, y, c] of [[-22, 100, P.red], [16, 106, P.gold], [0, 76, P.redLight], [-14, 54, P.gold], [20, 80, P.snow], [8, 44, P.red]] as const) {
    circle(ctx, C + x, y, 6, c);
  }
  star(ctx, C, 14, 5, 15, 7, P.gold, P.goldDark, 1.5);
}

function drawCocoa(ctx: Ctx) {
  // vapor
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  for (const x of [C - 24, C + 4]) {
    ctx.beginPath();
    ctx.moveTo(x, 44);
    ctx.bezierCurveTo(x - 14, 30, x + 14, 22, x, 6);
    ctx.stroke();
  }
  // alça
  ctx.strokeStyle = P.redDark;
  ctx.lineWidth = 15;
  ctx.beginPath();
  ctx.arc(C + 42, 112, 26, -Math.PI * 0.45, Math.PI * 0.45);
  ctx.stroke();
  // caneca
  rrect(ctx, C - 62, 62, 108, 108, [10, 10, 30, 30], P.red);
  ctx.fillStyle = 'rgba(0,0,0,0.13)';
  ctx.beginPath();
  ctx.roundRect(C + 12, 66, 34, 100, [0, 8, 28, 0]);
  ctx.fill();
  ellipse(ctx, C - 8, 64, 54, 14, P.redLight);
  ellipse(ctx, C - 8, 65, 46, 10, '#6B3B22');
  // marshmallows
  rrect(ctx, C - 34, 54, 22, 15, 5, P.snow);
  rrect(ctx, C - 6, 58, 22, 15, 5, P.snow);
  // floco na caneca
  ctx.strokeStyle = P.snow;
  ctx.lineWidth = 4;
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI) / 3;
    ctx.beginPath();
    ctx.moveTo(C - 14 + Math.cos(a) * 20, 118 + Math.sin(a) * 20);
    ctx.lineTo(C - 14 - Math.cos(a) * 20, 118 - Math.sin(a) * 20);
    ctx.stroke();
  }
}

function drawTrain(ctx: Ctx) {
  // rodas
  const wheel = (x: number, r: number) => {
    circle(ctx, x, 150, r, '#26324A');
    circle(ctx, x, 150, r * 0.5, P.gold);
  };
  // corpo
  rrect(ctx, 26, 86, 92, 50, 8, P.red);
  rrect(ctx, 100, 44, 56, 92, 8, P.green);
  rrect(ctx, 92, 32, 72, 16, 7, P.greenDark);
  rrect(ctx, 112, 60, 32, 30, 5, '#FFE4A0', P.goldDark, 2.5);
  // chaminé
  poly(ctx, [[40, 86], [66, 86], [72, 50], [34, 50]], '#26324A');
  rrect(ctx, 30, 42, 46, 12, 5, P.gold);
  circle(ctx, 54, 26, 11, 'rgba(255,255,255,0.85)');
  circle(ctx, 72, 12, 8, 'rgba(255,255,255,0.7)');
  // detalhes
  rrect(ctx, 18, 128, 144, 12, 5, P.gold);
  circle(ctx, 26, 106, 10, P.goldLight, P.goldDark, 2);
  wheel(50, 19);
  wheel(96, 19);
  wheel(138, 23);
}

function drawBoxBody(ctx: Ctx, w: number, h: number) {
  rrect(ctx, 6, 8, w - 12, h - 12, 8, P.red);
  ctx.fillStyle = 'rgba(0,0,0,0.14)';
  ctx.fillRect(w * 0.64, 10, w * 0.36 - 8, h - 16);
  ctx.fillStyle = P.gold;
  ctx.fillRect(w / 2 - 13, 8, 26, h - 12);
  ctx.fillStyle = rgba(P.goldLight, 0.7);
  ctx.fillRect(w / 2 - 13, 8, 7, h - 12);
  // estrelinhas no papel
  for (const [x, y] of [[30, 44], [44, 88], [112, 52], [124, 92]] as const) star(ctx, x, y, 4, 7, 2.6, rgba(P.goldLight, 0.85));
}

function drawBoxLid(ctx: Ctx, w: number, h: number) {
  // laço
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(w / 2 + side * 28, 30, 30, 19, side * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = P.gold;
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(w / 2 + side * 28, 30, 15, 8, side * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = P.goldDark;
    ctx.fill();
  }
  rrect(ctx, 2, 50, w - 4, h - 54, 8, P.redLight);
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.fillRect(w * 0.66, 52, w * 0.34 - 6, h - 58);
  ctx.fillStyle = P.gold;
  ctx.fillRect(w / 2 - 14, 50, 28, h - 54);
  circle(ctx, w / 2, 36, 13, P.goldLight, P.goldDark, 2);
}
