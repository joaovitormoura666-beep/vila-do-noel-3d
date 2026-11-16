import type Phaser from 'phaser';
import { EXIT_PATH, GAME_H, GAME_W, LAYOUT, PALETTE as P, QUEUE_PATH } from '../../config';
import { PathTrack } from '../../queue/PathTrack';
import { circle, ellipse, linear, makeTexture, poly, radial, rgba, rng, rrect, shade, star, type Ctx } from './canvas';

/**
 * Cenário da vila. Clima: noite azul profunda de livro de histórias, neve
 * azulada ao luar, janelas com luz quente e árvores escuras emoldurando a cena.
 * Tudo desenhado por código (arte original).
 */

/** Topo da textura do chão, em coordenadas da tela. */
export const GROUND_TOP = 480;

/** Árvores da moldura: o tronco fica a 30% da largura, e os galhos abrem para dentro da tela. */
export const BARE_W = 640;
export const BARE_H = 1500;
export const BARE_TRUNK_X = 0.3;

/** Tons da noite. */
const N = {
  ink: '#070D1B',
  silhouette: '#0A1424',
  silhouetteLight: '#15233F',
  hillFar: '#142546',
  hillNear: '#1B3157',
  snowFar: '#34528A',
  snowMid: '#5F81BB',
  snowNear: '#8AA8D8',
  snowLight: '#C9DBF5',
  snowShadow: '#22406F',
  window: '#FFCB6B',
};

export function createSceneryTextures(scene: Phaser.Scene) {
  makeTexture(scene, 'sky', GAME_W, 900, drawSky);
  makeTexture(scene, 'moon', 300, 300, drawMoon);
  makeTexture(scene, 'ground', GAME_W, GAME_H - GROUND_TOP, drawGround);
  makeTexture(scene, 'house', 620, 540, drawHouse);
  makeTexture(scene, 'tree-big', 320, 470, (c, w, h) => drawPine(c, w, h, 11, true));
  makeTexture(scene, 'tree-med', 230, 340, (c, w, h) => drawPine(c, w, h, 23, true));
  makeTexture(scene, 'tree-small', 130, 190, (c, w, h) => drawPine(c, w, h, 5, false));
  makeTexture(scene, 'bare-a', BARE_W, BARE_H, (c, w, h) => drawBareTree(c, w, h, 41));
  makeTexture(scene, 'bare-b', BARE_W, BARE_H, (c, w, h) => drawBareTree(c, w, h, 97));
  makeTexture(scene, 'lantern', 80, 110, drawLantern);
  makeTexture(scene, 'lamp', 90, 300, drawLamp);
  makeTexture(scene, 'snowman', 160, 200, drawSnowman);
  makeTexture(scene, 'spot', 240, 110, drawSpot);
  makeTexture(scene, 'foreground', GAME_W, 300, drawForeground);
  makeTexture(scene, 'giftpile', 220, 150, drawGiftPile);
  makeTexture(scene, 'vignette', GAME_W / 4, GAME_H / 4, drawVignette);
}

/** Escurece e azula o que já foi desenhado, como se estivesse à noite. */
function nightTint(ctx: Ctx, w: number, h: number, amount: number) {
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = rgba('#0E1B3A', amount);
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/** Luz quente pintada apenas sobre o que já existe (não vaza para o fundo). */
function warmLight(ctx: Ctx, x: number, y: number, r: number, strength: number) {
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  radial(ctx, x, y, r, [
    [0, rgba('#FFC060', strength)],
    [0.5, rgba('#FFB050', strength * 0.45)],
    [1, rgba('#FFB050', 0)],
  ]);
  ctx.restore();
}

/* ---------------- céu ---------------- */

function drawSky(ctx: Ctx, w: number, h: number) {
  ctx.fillStyle = linear(ctx, 0, 0, 0, h, [
    [0, N.ink],
    [0.35, '#0B1630'],
    [0.7, P.night],
    [1, '#243A63'],
  ]);
  ctx.fillRect(0, 0, w, h);
  // luar difuso
  radial(ctx, 930, 452, 520, [
    [0, 'rgba(120,150,210,0.26)'],
    [0.5, 'rgba(90,120,190,0.1)'],
    [1, 'rgba(90,120,190,0)'],
  ]);
  // nuvens tênues
  const r = rng(5);
  ctx.save();
  ctx.globalAlpha = 0.07;
  for (let i = 0; i < 9; i++) {
    const x = r() * w;
    const y = 120 + r() * 420;
    ellipse(ctx, x, y, 180 + r() * 220, 16 + r() * 22, '#9DB7E6');
  }
  ctx.restore();
}

function drawMoon(ctx: Ctx, w: number, h: number) {
  const cx = w / 2;
  const cy = h / 2;
  radial(ctx, cx, cy, 150, [
    [0, 'rgba(226,236,255,0.5)'],
    [0.36, 'rgba(200,218,255,0.18)'],
    [1, 'rgba(200,218,255,0)'],
  ]);
  circle(ctx, cx, cy, 56, '#F4F1E6');
  ctx.save();
  ctx.globalAlpha = 0.3;
  circle(ctx, cx - 18, cy - 14, 11, '#C9CDD8');
  circle(ctx, cx + 20, cy + 8, 15, '#C9CDD8');
  circle(ctx, cx - 6, cy + 26, 8, '#C9CDD8');
  circle(ctx, cx + 22, cy - 26, 6, '#C9CDD8');
  ctx.restore();
}

/* ---------------- colinas, vila ao fundo, neve e caminho ---------------- */

function strokeTrack(ctx: Ctx, pts: Array<{ x: number; y: number }>, width: number, color: string) {
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y - GROUND_TOP) : ctx.moveTo(p.x, p.y - GROUND_TOP)));
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
}

/** Casinha distante: silhueta escura, telhado com neve e janelas acesas. */
function tinyHouse(ctx: Ctx, x: number, y: number, s: number, r: () => number) {
  const w = 44 * s;
  const h = 24 * s;
  const roofH = 20 * s;
  // brilho das janelas na neve
  radial(ctx, x, y - h * 0.3, 46 * s, [
    [0, rgba(N.window, 0.22)],
    [1, rgba(N.window, 0)],
  ]);
  ctx.fillStyle = '#0D1930';
  ctx.fillRect(x - w / 2, y - h, w, h);
  // telhado com neve
  poly(ctx, [[x - w / 2 - 5 * s, y - h], [x, y - h - roofH], [x + w / 2 + 5 * s, y - h]], '#7E9ED2');
  poly(ctx, [[x - w / 2 - 5 * s, y - h], [x, y - h - roofH], [x - w * 0.1, y - h]], '#A9C3EA');
  // chaminé
  ctx.fillStyle = '#0D1930';
  ctx.fillRect(x + w * 0.18, y - h - roofH * 0.95, 6 * s, roofH * 0.7);
  ctx.fillStyle = '#A9C3EA';
  ctx.fillRect(x + w * 0.18 - s, y - h - roofH * 0.95 - 2 * s, 8 * s, 3 * s);
  // janelas
  const n = r() > 0.5 ? 2 : 3;
  for (let i = 0; i < n; i++) {
    if (r() < 0.12) continue;
    const wx = x - w / 2 + (w / (n + 1)) * (i + 1);
    ctx.fillStyle = r() > 0.3 ? N.window : '#FFE3A0';
    ctx.fillRect(wx - 3 * s, y - h * 0.72, 6 * s, 8 * s);
  }
}

/** Arvorezinha sem folhas em silhueta (para o fundo). */
function tinyBare(ctx: Ctx, x: number, y: number, s: number, r: () => number) {
  ctx.strokeStyle = '#0B1529';
  ctx.lineCap = 'round';
  const branch = (bx: number, by: number, ang: number, len: number, wd: number, depth: number) => {
    const ex = bx + Math.cos(ang) * len;
    const ey = by + Math.sin(ang) * len;
    ctx.lineWidth = wd;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    if (depth <= 0) return;
    branch(ex, ey, ang - 0.45 - r() * 0.3, len * 0.68, wd * 0.65, depth - 1);
    branch(ex, ey, ang + 0.45 + r() * 0.3, len * 0.68, wd * 0.65, depth - 1);
  };
  branch(x, y, -Math.PI / 2 + (r() - 0.5) * 0.2, 20 * s, 3.4 * s, 3);
}

function drawGround(ctx: Ctx, w: number, h: number) {
  const r = rng(77);
  const Y = (worldY: number) => worldY - GROUND_TOP;

  // colinas ao fundo: sobem nas laterais, formando um vale atrás da casa
  const ridge = (edgeY: number, centerY: number, color: string, rim: string, seed: number) => {
    const rr = rng(seed);
    const pts: Array<[number, number]> = [];
    for (let x = 0; x <= w; x += 60) {
      const t = Math.abs(x - w / 2) / (w / 2);
      const base = centerY + (edgeY - centerY) * Math.pow(t, 1.5);
      pts.push([x, Y(base + (rr() - 0.5) * 18)]);
    }
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) {
      const [px, py] = pts[i - 1];
      const [cx, cy] = pts[i];
      ctx.quadraticCurveTo(px, py, (px + cx) / 2, (py + cy) / 2);
    }
    ctx.lineTo(w, pts[pts.length - 1][1]);
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = rim;
    ctx.lineWidth = 5;
    ctx.stroke();
  };
  ridge(500, 700, N.hillFar, 'rgba(90,125,190,0.5)', 3);
  // vila distante (camada do fundo)
  const farSpots: Array<[number, number, number]> = [
    [38, 548, 0.8], [118, 572, 0.78], [262, 628, 0.74], [326, 664, 0.7], [196, 600, 0.7],
    [1046, 546, 0.8], [968, 572, 0.78], [824, 632, 0.74], [760, 668, 0.7], [892, 604, 0.7],
  ];
  for (const [x, y, s] of farSpots) tinyHouse(ctx, x, Y(y), s, r);
  for (let i = 0; i < 12; i++) {
    const left = i % 2 === 0;
    const x = left ? r() * 330 : 750 + r() * 330;
    const t = Math.abs(x - w / 2) / (w / 2);
    tinyBare(ctx, x, Y(700 - 200 * Math.pow(t, 1.5) + r() * 30), 0.9 + r() * 0.5, r);
  }

  ridge(612, 770, N.hillNear, 'rgba(120,155,215,0.55)', 9);
  // vila (camada da frente, casas maiores)
  const nearSpots: Array<[number, number, number]> = [
    [52, 690, 1.25], [286, 760, 1.05], [338, 800, 0.9],
    [1030, 688, 1.25], [800, 762, 1.05], [746, 800, 0.9], [906, 716, 1.0],
  ];
  for (const [x, y, s] of nearSpots) tinyHouse(ctx, x, Y(y), s, r);
  for (let i = 0; i < 8; i++) {
    const left = i % 2 === 0;
    const x = left ? 10 + r() * 300 : 770 + r() * 300;
    const t = Math.abs(x - w / 2) / (w / 2);
    tinyBare(ctx, x, Y(782 - 150 * Math.pow(t, 1.5) + r() * 26), 1.3 + r() * 0.7, r);
  }

  // plano de neve
  ctx.fillStyle = linear(ctx, 0, Y(800), 0, h, [
    [0, N.snowFar],
    [0.22, N.snowMid],
    [0.6, N.snowNear],
    [1, '#7B9BCF'],
  ]);
  ctx.beginPath();
  ctx.moveTo(0, Y(818));
  ctx.bezierCurveTo(200, Y(798), 380, Y(826), 560, Y(810));
  ctx.bezierCurveTo(760, Y(796), 920, Y(824), w, Y(806));
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();
  // borda iluminada do plano de neve
  ctx.strokeStyle = 'rgba(170,198,240,0.6)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, Y(818));
  ctx.bezierCurveTo(200, Y(798), 380, Y(826), 560, Y(810));
  ctx.bezierCurveTo(760, Y(796), 920, Y(824), w, Y(806));
  ctx.stroke();

  // clarão do luar no centro da cena
  ctx.save();
  ctx.translate(540, Y(1260));
  ctx.scale(1, 0.74);
  radial(ctx, 0, 0, 640, [
    [0, rgba(N.snowLight, 0.62)],
    [0.55, rgba(N.snowLight, 0.3)],
    [1, rgba(N.snowLight, 0)],
  ]);
  ctx.restore();

  // ondulações suaves
  for (let i = 0; i < 30; i++) {
    const x = r() * w;
    const y = Y(870 + r() * 960);
    const rx = 90 + r() * 180;
    ctx.save();
    ctx.globalAlpha = 0.22;
    ellipse(ctx, x, y, rx, rx * 0.15, '#DCE8FA');
    ctx.globalAlpha = 0.2;
    ellipse(ctx, x + 16, y + rx * 0.2, rx * 0.9, rx * 0.1, N.snowShadow);
    ctx.restore();
  }

  // luz quente que sai da porta e das janelas da casa
  ctx.save();
  ctx.translate(LAYOUT.house.x, Y(LAYOUT.house.y + 60));
  ctx.scale(1, 0.44);
  radial(ctx, 0, 0, 500, [
    [0, 'rgba(255,196,110,0.62)'],
    [0.4, 'rgba(255,186,100,0.3)'],
    [1, 'rgba(255,186,100,0)'],
  ]);
  ctx.restore();

  // caminho pisado na neve (fila + saída)
  const queue = new PathTrack(QUEUE_PATH).sample(14);
  const exit = new PathTrack(EXIT_PATH).sample(14);
  for (const pts of [exit, queue]) strokeTrack(ctx, pts, 116, 'rgba(210,226,250,0.3)');
  for (const pts of [exit, queue]) strokeTrack(ctx, pts, 100, 'rgba(52,84,140,0.5)');
  for (const pts of [exit, queue]) strokeTrack(ctx, pts, 78, 'rgba(74,108,166,0.5)');
  // pegadas
  for (const pts of [queue, exit]) {
    for (let i = 3; i < pts.length - 2; i += 2) {
      const a = pts[i - 1];
      const b = pts[i + 1];
      const p = pts[i];
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const nx = -(b.y - a.y) / len;
      const ny = (b.x - a.x) / len;
      const side = (i >> 1) % 2 === 0 ? 1 : -1;
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      ctx.save();
      ctx.globalAlpha = 0.34;
      ellipse(ctx, p.x + nx * 14 * side, Y(p.y) + ny * 8 * side, 9, 4.5, '#1D3A6B', undefined, 0, ang);
      ctx.restore();
    }
  }

  // escurece as laterais (profundidade de floresta)
  for (const [x0, x1] of [[0, 300], [w, w - 300]] as const) {
    ctx.fillStyle = linear(ctx, x0, 0, x1, 0, [
      [0, 'rgba(10,20,44,0.5)'],
      [1, 'rgba(10,20,44,0)'],
    ]);
    ctx.fillRect(Math.min(x0, x1), Y(800), 300, h - Y(800));
  }

  // brilhos na neve
  for (let i = 0; i < 180; i++) {
    const x = r() * w;
    const y = Y(840 + r() * 1040);
    ctx.save();
    ctx.globalAlpha = 0.3 + r() * 0.5;
    circle(ctx, x, y, 1 + r() * 1.5, '#FFFFFF');
    ctx.restore();
  }
}

/* ---------------- casa do Papai Noel ---------------- */

function drawHouse(ctx: Ctx, w: number, h: number) {
  const base = h - 14;
  const wallL = 78;
  const wallR = w - 78;
  const wallTop = 300;
  const cx = w / 2;

  // chaminé (atrás do telhado)
  rrect(ctx, 418, 78, 62, 150, 4, '#9A4B3A');
  ctx.strokeStyle = 'rgba(60,20,15,0.35)';
  ctx.lineWidth = 2;
  for (let y = 100; y < 220; y += 18) {
    ctx.beginPath();
    ctx.moveTo(418, y);
    ctx.lineTo(480, y);
    ctx.stroke();
  }
  rrect(ctx, 410, 66, 78, 22, 8, '#7C3A2D');

  // parede
  ctx.fillStyle = linear(ctx, 0, wallTop, 0, base, [
    [0, '#96603D'],
    [1, '#7B4A30'],
  ]);
  ctx.fillRect(wallL, wallTop, wallR - wallL, base - wallTop);
  ctx.strokeStyle = 'rgba(60,30,15,0.28)';
  ctx.lineWidth = 3;
  for (let y = wallTop + 26; y < base - 20; y += 30) {
    ctx.beginPath();
    ctx.moveTo(wallL, y);
    ctx.lineTo(wallR, y);
    ctx.stroke();
  }
  // base de pedra
  rrect(ctx, wallL - 8, base - 26, wallR - wallL + 16, 28, 6, '#73829C');
  for (let x = wallL; x < wallR; x += 44) rrect(ctx, x, base - 22, 30, 9, 4, 'rgba(255,255,255,0.18)');

  // frontão (triângulo sob o telhado)
  poly(ctx, [[cx, 78], [wallL - 6, wallTop + 2], [wallR + 6, wallTop + 2]], '#A56E48');
  ctx.strokeStyle = 'rgba(60,30,15,0.22)';
  ctx.lineWidth = 3;
  for (let x = wallL + 30; x < wallR; x += 34) {
    const t = Math.abs(x - cx) / (cx - wallL + 6);
    ctx.beginPath();
    ctx.moveTo(x, wallTop);
    ctx.lineTo(x, 82 + t * (wallTop - 78));
    ctx.stroke();
  }
  // viga
  rrect(ctx, wallL - 10, wallTop - 6, wallR - wallL + 20, 16, 5, P.woodDark);

  // molduras (as luzes são pintadas depois do efeito de noite)
  circle(ctx, cx, 212, 40, P.woodDark);
  for (const wx of [cx - 152, cx + 152]) rrect(ctx, wx - 61, 398 - 65, 122, 130, 10, P.woodDark);

  // porta
  const dw = 112;
  const dTop = 352;
  ctx.beginPath();
  ctx.moveTo(cx - dw / 2 - 10, base - 20);
  ctx.lineTo(cx - dw / 2 - 10, dTop + 46);
  ctx.quadraticCurveTo(cx - dw / 2 - 10, dTop - 14, cx, dTop - 14);
  ctx.quadraticCurveTo(cx + dw / 2 + 10, dTop - 14, cx + dw / 2 + 10, dTop + 46);
  ctx.lineTo(cx + dw / 2 + 10, base - 20);
  ctx.closePath();
  ctx.fillStyle = P.woodDark;
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx - dw / 2, base - 20);
  ctx.lineTo(cx - dw / 2, dTop + 46);
  ctx.quadraticCurveTo(cx - dw / 2, dTop, cx, dTop);
  ctx.quadraticCurveTo(cx + dw / 2, dTop, cx + dw / 2, dTop + 46);
  ctx.lineTo(cx + dw / 2, base - 20);
  ctx.closePath();
  ctx.fillStyle = linear(ctx, 0, dTop, 0, base, [
    [0, P.greenLight],
    [1, P.green],
  ]);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx, dTop + 4);
  ctx.lineTo(cx, base - 22);
  ctx.stroke();

  // degraus
  rrect(ctx, cx - 86, base - 22, 172, 16, 6, '#8E9CB4');
  rrect(ctx, cx - 100, base - 10, 200, 18, 7, '#A2AFC4');

  // telhado
  const roofL: [number, number] = [18, wallTop + 22];
  const roofR: [number, number] = [w - 18, wallTop + 22];
  const peak: [number, number] = [cx, 34];
  const thick = 58;
  ctx.fillStyle = linear(ctx, 0, 30, 0, wallTop + 20, [
    [0, P.redLight],
    [1, P.redDark],
  ]);
  ctx.beginPath();
  ctx.moveTo(peak[0], peak[1]);
  ctx.lineTo(roofR[0], roofR[1]);
  ctx.lineTo(roofR[0] - 36, roofR[1] + 8);
  ctx.lineTo(peak[0], peak[1] + thick);
  ctx.lineTo(roofL[0] + 36, roofL[1] + 8);
  ctx.lineTo(roofL[0], roofL[1]);
  ctx.closePath();
  ctx.fill();

  // ---- noite: escurece tudo o que não emite luz ----
  nightTint(ctx, w, h, 0.5);

  // luz das janelas e da porta sobre a fachada
  warmLight(ctx, cx - 152, 400, 150, 0.5);
  warmLight(ctx, cx + 152, 400, 150, 0.5);
  warmLight(ctx, cx, 440, 150, 0.42);
  warmLight(ctx, cx, 212, 100, 0.4);

  // janelinha redonda do sótão
  radial(ctx, cx, 212, 32, [
    [0, '#FFF2C4'],
    [1, '#F2A93B'],
  ]);
  ctx.strokeStyle = P.woodDark;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(cx - 32, 212);
  ctx.lineTo(cx + 32, 212);
  ctx.moveTo(cx, 180);
  ctx.lineTo(cx, 244);
  ctx.stroke();

  // janelas acesas
  for (const wx of [cx - 152, cx + 152]) drawWindow(ctx, wx, 398, 104, 112);

  // detalhes iluminados da porta
  circle(ctx, cx + 36, 452, 7, P.gold, P.goldDark, 2);
  ctx.lineWidth = 15;
  ctx.strokeStyle = '#1E6A4C';
  ctx.beginPath();
  ctx.arc(cx, 406, 25, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#2E8A63';
  ctx.setLineDash([5, 8]);
  ctx.beginPath();
  ctx.arc(cx, 406, 27, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  for (const [dx, dy] of [[-22, -12], [20, -16], [24, 12], [-18, 18], [0, -26]] as const) circle(ctx, cx + dx, 406 + dy, 4, P.gold);
  poly(ctx, [[cx, 428], [cx - 15, 420], [cx - 15, 438]], P.red);
  poly(ctx, [[cx, 428], [cx + 15, 420], [cx + 15, 438]], P.red);
  circle(ctx, cx, 428, 5, P.redLight);

  // placa
  rrect(ctx, cx - 62, 306, 124, 34, 10, P.gold, P.goldDark, 3);
  ctx.fillStyle = P.redDark;
  ctx.font = '700 23px Fredoka, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('NOEL', cx, 324);

  // ---- neve (ao luar: branco azulado) ----
  const snowTop = '#E4EEFB';
  const snowShade = '#9DB7E2';
  snowBlob(ctx, 406, 62, 86, 18, snowTop);
  for (const side of [-1, 1]) {
    const end = side < 0 ? roofL : roofR;
    const nSeg = 9;
    ctx.beginPath();
    ctx.moveTo(peak[0], peak[1] - 12);
    for (let i = 1; i <= nSeg; i++) {
      const t = i / nSeg;
      const x = peak[0] + (end[0] - peak[0]) * t;
      const y = peak[1] + (end[1] - peak[1]) * t;
      ctx.lineTo(x + side * 6, y - 14);
    }
    ctx.lineTo(end[0] + side * 10, end[1] + 6);
    for (let i = nSeg; i >= 0; i--) {
      const t = i / nSeg;
      const x = peak[0] + (end[0] - peak[0]) * t;
      const y = peak[1] + (end[1] - peak[1]) * t;
      const bump = i % 2 === 0 ? 30 : 18;
      ctx.quadraticCurveTo(x + side * 14, y + bump + 10, x - side * 4, y + bump);
    }
    ctx.closePath();
    ctx.fillStyle = linear(ctx, 0, 20, 0, wallTop + 40, [
      [0, snowTop],
      [1, '#B9CFF0'],
    ]);
    ctx.fill();
    // sombra azul na parte de baixo da neve
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = snowShade;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(peak[0] + side * 34, peak[1] + 44);
    ctx.lineTo(end[0] - side * 26, end[1] + 6);
    ctx.stroke();
    ctx.restore();
  }
  circle(ctx, peak[0], peak[1] - 2, 22, snowTop);
  snowBlob(ctx, cx - 100, base - 14, 200, 10, snowTop);
  for (const wx of [cx - 152, cx + 152]) snowBlob(ctx, wx - 66, 398 + 52, 132, 12, snowTop);
  snowBlob(ctx, cx - 70, 300, 140, 9, snowTop);
}

function drawWindow(ctx: Ctx, cx: number, cy: number, w: number, h: number) {
  ctx.fillStyle = linear(ctx, 0, cy - h / 2, 0, cy + h / 2, [
    [0, '#FFF1BF'],
    [0.6, '#FFD27A'],
    [1, '#F0A53A'],
  ]);
  ctx.fillRect(cx - w / 2, cy - h / 2, w, h);
  // cortinas
  ctx.fillStyle = rgba(P.red, 0.8);
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, cy - h / 2);
  ctx.quadraticCurveTo(cx - w / 2 + 34, cy - 6, cx - w / 2, cy + h / 2 - 16);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx + w / 2, cy - h / 2);
  ctx.quadraticCurveTo(cx + w / 2 - 34, cy - 6, cx + w / 2, cy + h / 2 - 16);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = P.woodDark;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(cx, cy - h / 2);
  ctx.lineTo(cx, cy + h / 2);
  ctx.moveTo(cx - w / 2, cy);
  ctx.lineTo(cx + w / 2, cy);
  ctx.stroke();
  rrect(ctx, cx - w / 2 - 14, cy + h / 2 + 4, w + 28, 12, 5, shade(P.wood, -0.35));
}

/** Montinho de neve arredondado. */
function snowBlob(ctx: Ctx, x: number, y: number, w: number, h: number, color: string = P.snow) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  const n = Math.max(2, Math.round(w / 26));
  for (let i = 0; i < n; i++) {
    const x0 = x + (w / n) * i;
    const x1 = x + (w / n) * (i + 1);
    ctx.quadraticCurveTo((x0 + x1) / 2, y - h * 0.6, x1, y + h * (i === n - 1 ? 1 : 0.45));
  }
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
  ctx.fill();
}

/* ---------------- pinheiros ---------------- */

function drawPine(ctx: Ctx, w: number, h: number, seed: number, decorated: boolean) {
  const r = rng(seed);
  const cx = w / 2;
  const trunkH = h * 0.1;
  const baseY = h - 6;
  const topY = decorated ? h * 0.11 : h * 0.03;

  rrect(ctx, cx - w * 0.055, baseY - trunkH - 4, w * 0.11, trunkH + 4, 4, P.woodDark);

  const tiers = 4;
  const bodyTop = topY;
  const bodyBottom = baseY - trunkH;
  const ornaments: Array<[number, number]> = [];
  const snowPaths: Array<() => void> = [];
  for (let i = 0; i < tiers; i++) {
    const t0 = i / tiers;
    const tierBottom = bodyBottom - (bodyBottom - bodyTop) * t0 * 0.8;
    const tierTop = tierBottom - (bodyBottom - bodyTop) * 0.46;
    const half = w * (0.47 - i * 0.085);
    const col = shade(P.green, i * 0.05);
    const colLight = shade(P.greenLight, i * 0.04);

    ctx.beginPath();
    ctx.moveTo(cx, tierTop);
    ctx.quadraticCurveTo(cx + half * 0.5, tierTop + (tierBottom - tierTop) * 0.62, cx + half, tierBottom - 6);
    const scallops = 5;
    for (let s = 0; s < scallops; s++) {
      const xa = cx + half - ((half * 2) / scallops) * s;
      const xb = cx + half - ((half * 2) / scallops) * (s + 1);
      ctx.quadraticCurveTo((xa + xb) / 2, tierBottom + 14, xb, tierBottom - 6);
    }
    ctx.quadraticCurveTo(cx - half * 0.5, tierTop + (tierBottom - tierTop) * 0.62, cx, tierTop);
    ctx.closePath();
    ctx.fillStyle = linear(ctx, cx - half, 0, cx + half, 0, [
      [0, col],
      [0.55, colLight],
      [1, shade(col, -0.2)],
    ]);
    ctx.fill();

    snowPaths.push(() => {
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(cx + side * half, tierBottom - 6);
        ctx.quadraticCurveTo(cx + side * half * 0.72, tierBottom - 30, cx + side * half * 0.5, tierBottom - (tierBottom - tierTop) * 0.36);
        ctx.quadraticCurveTo(cx + side * half * 0.62, tierBottom - 12, cx + side * half * 0.52, tierBottom + 2);
        ctx.quadraticCurveTo(cx + side * half * 0.78, tierBottom + 12, cx + side * half, tierBottom - 6);
        ctx.closePath();
        ctx.fill();
      }
    });

    if (decorated) {
      const count = 3 - Math.floor(i / 2);
      for (let k = 0; k < count; k++) {
        const ox = (r() - 0.5) * half * 1.2;
        const oy = tierBottom - 22 - r() * (tierBottom - tierTop) * 0.34;
        ornaments.push([cx + ox, oy]);
      }
    }
  }

  // noite sobre o verde
  nightTint(ctx, w, h, decorated ? 0.42 : 0.62);

  // neve azulada nas pontas e no topo
  ctx.fillStyle = decorated ? '#DCE8FA' : '#8FACDC';
  for (const p of snowPaths) p();
  ctx.beginPath();
  ctx.moveTo(cx, bodyTop - 2);
  ctx.quadraticCurveTo(cx + w * 0.1, bodyTop + h * 0.08, cx + w * 0.13, bodyTop + h * 0.12);
  ctx.quadraticCurveTo(cx + w * 0.04, bodyTop + h * 0.1, cx, bodyTop + h * 0.13);
  ctx.quadraticCurveTo(cx - w * 0.04, bodyTop + h * 0.1, cx - w * 0.13, bodyTop + h * 0.12);
  ctx.quadraticCurveTo(cx - w * 0.1, bodyTop + h * 0.08, cx, bodyTop - 2);
  ctx.fill();

  if (decorated) {
    const colors = [P.red, P.gold, P.redLight, P.goldLight];
    ornaments.forEach(([x, y], i) => {
      const c = colors[i % colors.length];
      const rad = w * 0.034;
      circle(ctx, x, y, rad, c, 'rgba(0,0,0,0.25)', 1.5);
      circle(ctx, x - rad * 0.3, y - rad * 0.3, rad * 0.3, 'rgba(255,255,255,0.7)');
    });
    radial(ctx, cx, topY - 4, w * 0.2, [
      [0, rgba(P.goldLight, 0.75)],
      [1, rgba(P.goldLight, 0)],
    ]);
    star(ctx, cx, topY - 4, 5, w * 0.085, w * 0.038, P.goldLight, P.gold, 2);
  }
}

/* ---------------- árvores sem folhas (moldura da cena) ---------------- */

function drawBareTree(ctx: Ctx, w: number, h: number, seed: number) {
  const r = rng(seed);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const snow: Array<[number, number, number, number, number]> = [];
  const tx = w * BARE_TRUNK_X;
  const trunkTop = h * 0.36;

  const segment = (x0: number, y0: number, x1: number, y1: number, wd: number) => {
    ctx.strokeStyle = N.silhouette;
    ctx.lineWidth = wd;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    // a neve assenta nos galhos mais deitados
    const ang = Math.atan2(y1 - y0, x1 - x0);
    if (Math.abs(Math.cos(ang)) > 0.42 && wd > 2.4) snow.push([x0, y0, x1, y1, wd]);
  };

  const branch = (x: number, y: number, ang: number, len: number, wd: number, depth: number) => {
    // cada galho é feito de 3 pedaços levemente tortos, o que dá um ar mais orgânico
    let cx = x;
    let cy = y;
    let a = ang;
    let cw = wd;
    for (let i = 0; i < 3; i++) {
      a += (r() - 0.5) * 0.28;
      const nx = cx + Math.cos(a) * (len / 3);
      const ny = cy + Math.sin(a) * (len / 3);
      segment(cx, cy, nx, ny, cw);
      // raminhos laterais
      if (depth > 0 && i > 0 && r() > 0.5) {
        const side = r() > 0.5 ? 1 : -1;
        branch(nx, ny, a + side * (0.55 + r() * 0.45), len * 0.4, cw * 0.45, Math.min(1, depth - 1));
      }
      cx = nx;
      cy = ny;
      cw *= 0.86;
    }
    if (depth <= 0 || cw < 1.4 || cy < 12 || cx > w - 14 || cx < 14) return;
    const spread = 0.42 + r() * 0.24;
    // os galhos abrem para os lados e continuam buscando o alto
    const up = -Math.PI / 2;
    for (const dir of [-1, 1]) {
      let na = a + dir * spread;
      na = na * 0.84 + up * 0.16;
      branch(cx, cy, na, len * (0.68 + r() * 0.12), cw * 0.72, depth - 1);
    }
  };

  // tronco
  const base = 78;
  const top = 40;
  ctx.fillStyle = N.silhouette;
  ctx.beginPath();
  ctx.moveTo(tx - base * 0.7, h);
  ctx.bezierCurveTo(tx - base * 0.4, h * 0.82, tx - top * 0.62, h * 0.6, tx - top * 0.5, trunkTop);
  ctx.lineTo(tx + top * 0.5, trunkTop);
  ctx.bezierCurveTo(tx + top * 0.62, h * 0.6, tx + base * 0.45, h * 0.82, tx + base * 0.85, h);
  ctx.closePath();
  ctx.fill();
  // luar na lateral do tronco
  ctx.strokeStyle = 'rgba(86,118,180,0.4)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(tx + base * 0.6, h - 20);
  ctx.bezierCurveTo(tx + base * 0.34, h * 0.82, tx + top * 0.5, h * 0.6, tx + top * 0.36, trunkTop + 30);
  ctx.stroke();

  // galhos principais (a maioria abre para a direita = para dentro da tela)
  const up = -Math.PI / 2;
  branch(tx, trunkTop + 4, up - 0.08, h * 0.13, top * 0.92, 5);
  branch(tx + 4, trunkTop + 30, up + 0.62, h * 0.12, top * 0.6, 4);
  branch(tx - 4, trunkTop + 60, up - 0.7, h * 0.09, top * 0.5, 3);
  branch(tx + 6, trunkTop + h * 0.09, up + 1.05, h * 0.085, top * 0.42, 3);
  branch(tx + 6, trunkTop + h * 0.17, up + 1.22, h * 0.055, top * 0.3, 2);

  // neve fina sobre os galhos
  for (const [x0, y0, x1, y1, wd] of snow) {
    const lift = wd * 0.36 + 0.5;
    ctx.strokeStyle = 'rgba(188,210,244,0.9)';
    ctx.lineWidth = Math.max(1.4, wd * 0.3);
    ctx.beginPath();
    ctx.moveTo(x0 + (x1 - x0) * 0.1, y0 + (y1 - y0) * 0.1 - lift);
    ctx.lineTo(x0 + (x1 - x0) * 0.92, y0 + (y1 - y0) * 0.92 - lift);
    ctx.stroke();
  }
}

/* ---------------- objetos de cenário ---------------- */

function drawLamp(ctx: Ctx, w: number, h: number) {
  const cx = w / 2;
  const base = h - 4;
  rrect(ctx, cx - 12, base - 16, 24, 16, 5, '#1A2740');
  rrect(ctx, cx - 5, 86, 10, base - 96, 4, '#223150');
  rrect(ctx, cx - 22, 78, 44, 10, 4, '#1A2740');
  // vidro aceso
  ctx.fillStyle = linear(ctx, 0, 34, 0, 78, [
    [0, '#FFF3C8'],
    [1, '#FFC766'],
  ]);
  poly(ctx, [[cx - 20, 78], [cx + 20, 78], [cx + 15, 34], [cx - 15, 34]]);
  ctx.fill();
  ctx.strokeStyle = '#1A2740';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(cx - 20, 78);
  ctx.lineTo(cx - 15, 34);
  ctx.moveTo(cx + 20, 78);
  ctx.lineTo(cx + 15, 34);
  ctx.moveTo(cx, 78);
  ctx.lineTo(cx, 34);
  ctx.stroke();
  poly(ctx, [[cx - 24, 36], [cx + 24, 36], [cx, 12]], '#1A2740');
  snowBlob(ctx, cx - 24, 16, 48, 14, '#DCE8FA');
  circle(ctx, cx, 10, 5, '#1A2740');
  // laço vermelho no poste
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(cx + side * 11, 104, 11, 7, side * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = P.red;
    ctx.fill();
  }
  circle(ctx, cx, 104, 5, P.redLight);
}

/** Lanterna baixa, pousada na neve (não cobre os personagens da fila). */
function drawLantern(ctx: Ctx, w: number, h: number) {
  const cx = w / 2;
  const base = h - 6;
  // alça
  ctx.strokeStyle = '#1A2740';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(cx, 30, 15, Math.PI, 0);
  ctx.stroke();
  poly(ctx, [[cx - 24, 40], [cx + 24, 40], [cx + 14, 24], [cx - 14, 24]], '#1A2740');
  rrect(ctx, cx - 26, base - 12, 52, 12, 4, '#1A2740');
  // vidro com a chama
  ctx.fillStyle = linear(ctx, 0, 40, 0, base - 12, [
    [0, '#FFE9A8'],
    [1, '#FFB648'],
  ]);
  ctx.fillRect(cx - 20, 40, 40, base - 52);
  ctx.strokeStyle = '#1A2740';
  ctx.lineWidth = 4;
  ctx.strokeRect(cx - 20, 40, 40, base - 52);
  ctx.beginPath();
  ctx.moveTo(cx, 40);
  ctx.lineTo(cx, base - 12);
  ctx.stroke();
  ellipse(ctx, cx, base - 30, 6, 10, '#FFF7DA');
  snowBlob(ctx, cx - 24, 16, 48, 9, '#DCE8FA');
}

function drawSnowman(ctx: Ctx, w: number, h: number) {
  const cx = w / 2;
  const ball = (x: number, y: number, r: number) => {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.clip();
    radial(ctx, x - r * 0.3, y - r * 0.35, r * 1.6, [
      [0, '#F2F7FF'],
      [0.6, '#BDD2F2'],
      [1, '#7F9FD2'],
    ]);
    ctx.restore();
    circle(ctx, x, y, r, undefined, 'rgba(60,90,150,0.55)', 2);
  };
  ball(cx, h - 54, 50);
  ball(cx, h - 122, 36);
  rrect(ctx, cx - 34, h - 100, 68, 15, 7, P.red);
  rrect(ctx, cx + 12, h - 96, 15, 40, 6, P.red);
  ctx.fillStyle = P.gold;
  ctx.fillRect(cx + 12, h - 66, 15, 5);
  circle(ctx, cx - 12, h - 130, 4, '#1E2433');
  circle(ctx, cx + 12, h - 130, 4, '#1E2433');
  poly(ctx, [[cx, h - 124], [cx + 26, h - 118], [cx, h - 114]], '#E8873A');
  for (let i = -2; i <= 2; i++) circle(ctx, cx + i * 6, h - 108 + (2 - Math.abs(i)) * 1.5, 2, '#1E2433');
  circle(ctx, cx, h - 70, 4, P.green);
  circle(ctx, cx, h - 50, 4, P.green);
  ctx.fillStyle = P.green;
  ctx.beginPath();
  ctx.moveTo(cx - 30, h - 150);
  ctx.quadraticCurveTo(cx - 8, h - 200, cx + 34, h - 176);
  ctx.quadraticCurveTo(cx + 24, h - 160, cx + 30, h - 150);
  ctx.closePath();
  ctx.fill();
  rrect(ctx, cx - 34, h - 158, 68, 14, 7, '#E4EEFB');
  circle(ctx, cx + 36, h - 176, 8, '#E4EEFB');
}

function drawSpot(ctx: Ctx, w: number, h: number) {
  const cx = w / 2;
  const cy = h / 2;
  ctx.save();
  ctx.globalAlpha = 0.3;
  ellipse(ctx, cx, cy + 6, w * 0.47, h * 0.4, '#101C36');
  ctx.restore();
  ellipse(ctx, cx, cy, w * 0.46, h * 0.38, P.goldDark);
  ellipse(ctx, cx, cy - 3, w * 0.46, h * 0.38, P.gold);
  ellipse(ctx, cx, cy - 3, w * 0.41, h * 0.32, P.red);
  ellipse(ctx, cx, cy - 3, w * 0.33, h * 0.25, undefined, rgba(P.gold, 0.9), 3);
  ctx.save();
  ctx.translate(cx, cy - 3);
  ctx.scale(1, 0.62);
  star(ctx, 0, 0, 5, 26, 11, P.goldLight);
  ctx.restore();
}

function drawGiftPile(ctx: Ctx, w: number, h: number) {
  giftBox(ctx, 24, h - 86, 76, 76, P.green, P.gold);
  giftBox(ctx, 112, h - 64, 84, 54, P.red, P.snow);
  giftBox(ctx, 82, h - 126, 60, 50, P.gold, P.red);
  nightTint(ctx, w, h, 0.2);
  // neve por cima
  snowBlob(ctx, 22, h - 96, 40, 8, '#E4EEFB');
  snowBlob(ctx, 150, h - 72, 44, 8, '#E4EEFB');
}

export function giftBox(ctx: Ctx, x: number, y: number, w: number, h: number, color: string, ribbon: string) {
  rrect(ctx, x, y, w, h, 6, color);
  ctx.fillStyle = 'rgba(0,0,0,0.14)';
  ctx.fillRect(x + w * 0.62, y + 4, w * 0.38 - 4, h - 8);
  ctx.fillStyle = ribbon;
  ctx.fillRect(x + w / 2 - w * 0.08, y, w * 0.16, h);
  rrect(ctx, x - 4, y - 6, w + 8, h * 0.26, 5, shade(color, 0.12));
  ctx.fillStyle = ribbon;
  ctx.fillRect(x + w / 2 - w * 0.08, y - 6, w * 0.16, h * 0.26);
  ctx.fillStyle = ribbon;
  ctx.beginPath();
  ctx.ellipse(x + w / 2 - w * 0.14, y - 12, w * 0.15, h * 0.11, -0.5, 0, Math.PI * 2);
  ctx.ellipse(x + w / 2 + w * 0.14, y - 12, w * 0.15, h * 0.11, 0.5, 0, Math.PI * 2);
  ctx.fill();
  circle(ctx, x + w / 2, y - 9, w * 0.07, shade(ribbon, -0.15));
}

/** Primeiro plano: monte de neve na sombra, cerquinha e galhos secos. */
function drawForeground(ctx: Ctx, w: number, h: number) {
  const curve = (dy: number) => {
    ctx.moveTo(0, 130 + dy);
    ctx.bezierCurveTo(160, 70 + dy, 330, 170 + dy, 520, 150 + dy);
    ctx.bezierCurveTo(720, 128 + dy, 880, 60 + dy, w, 120 + dy);
  };

  // cerquinha atrás do monte de neve
  const fence = (x0: number, x1: number, yAt: (x: number) => number) => {
    ctx.strokeStyle = N.silhouette;
    ctx.lineWidth = 7;
    for (const off of [-52, -26]) {
      ctx.beginPath();
      for (let x = x0; x <= x1; x += 20) {
        const y = yAt(x) + off;
        if (x === x0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    for (let x = x0 + 8; x <= x1; x += 44) {
      const y = yAt(x);
      rrect(ctx, x - 7, y - 78, 14, 92, 4, N.silhouette);
      snowBlob(ctx, x - 10, y - 84, 20, 7, '#C9DBF5');
    }
  };
  fence(0, 300, (x) => 118 + Math.sin(x / 90) * 10 + x * 0.04);
  fence(790, w, (x) => 112 - (x - 790) * 0.06 + Math.sin(x / 80) * 8);

  ctx.beginPath();
  curve(0);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fillStyle = linear(ctx, 0, 60, 0, h, [
    [0, '#88A6D8'],
    [0.5, '#5B7CB6'],
    [1, '#35558F'],
  ]);
  ctx.fill();
  // luz na crista
  ctx.strokeStyle = 'rgba(214,230,252,0.85)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  curve(1);
  ctx.stroke();

  // galhos secos
  const r = rng(31);
  const twig = (x: number, y: number, ang: number, len: number, wd: number, depth: number) => {
    const ex = x + Math.cos(ang) * len;
    const ey = y + Math.sin(ang) * len;
    ctx.strokeStyle = N.silhouette;
    ctx.lineWidth = wd;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    if (depth <= 0) return;
    twig(ex, ey, ang - 0.35 - r() * 0.4, len * 0.66, wd * 0.7, depth - 1);
    twig(ex, ey, ang + 0.3 + r() * 0.4, len * 0.6, wd * 0.7, depth - 1);
  };
  for (const [x, y, a, l] of [[380, 262, -1.35, 78], [436, 280, -1.0, 54], [640, 250, -1.7, 84], [704, 276, -2.0, 50], [520, 290, -1.5, 44]] as const) {
    twig(x, y, a, l, 5, 3);
  }

  // brilhos
  for (let i = 0; i < 40; i++) {
    ctx.save();
    ctx.globalAlpha = 0.3 + r() * 0.5;
    circle(ctx, r() * w, 130 + r() * 160, 1 + r() * 1.5, '#FFFFFF');
    ctx.restore();
  }
}

/** Escurecimento das bordas para concentrar o olhar no centro. */
function drawVignette(ctx: Ctx, w: number, h: number) {
  const g = ctx.createRadialGradient(w / 2, h * 0.52, h * 0.24, w / 2, h * 0.52, h * 0.66);
  g.addColorStop(0, 'rgba(6,11,26,0)');
  g.addColorStop(0.6, 'rgba(6,11,26,0.2)');
  g.addColorStop(1, 'rgba(6,11,26,0.72)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}
