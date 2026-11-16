import type Phaser from 'phaser';
import { PALETTE as P } from '../config';
import { hashString } from '../render/textures/canvas';
import { avatarSrc, backendNow } from '../events/backend';

const H = 52;
const AV = 40;
const PAD = 6;
const FONT_PX = 26;
const MAX_TEXT_W = 196;
const AVATAR_BG = ['#B62835', '#226B53', '#B98A36', '#2F7FB5', '#7A4B9A', '#D9773B', '#2E8C8C', '#C24E7B'];

let seq = 0;

/**
 * Etiqueta com foto (ou inicial) + nome, desenhada em uma única textura
 * para custar apenas um desenho por personagem.
 */
export class NameLabel {
  readonly key: string;
  readonly width: number;
  readonly height = H;
  private readonly tex: Phaser.Textures.CanvasTexture;
  private readonly text: string;
  private img: HTMLImageElement | null = null;
  private destroyed = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly userId: string,
    nickname: string,
    avatarUrl?: string,
  ) {
    this.key = `label-${++seq}`;
    const measure = document.createElement('canvas').getContext('2d')!;
    measure.font = `600 ${FONT_PX}px Fredoka, sans-serif`;
    this.text = fit(measure, nickname, MAX_TEXT_W);
    const textW = Math.ceil(measure.measureText(this.text).width);
    this.width = PAD + AV + 10 + textW + 18;
    this.tex = scene.textures.createCanvas(this.key, this.width, H)!;
    this.draw();
    if (avatarUrl) this.loadAvatar(avatarUrl);
  }

  private loadAvatar(url: string) {
    // fotos de outros sites passam pelo back-end (o WebGL exige CORS); veja events/backend.ts
    const src = avatarSrc(backendNow(), url);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => {
      if (this.destroyed) return;
      this.img = img;
      this.draw();
    };
    img.onerror = () => {
      /* mantém a inicial colorida */
    };
    img.src = src;
  }

  private draw() {
    const ctx = this.tex.getContext();
    const w = this.width;
    ctx.clearRect(0, 0, w, H);

    // fundo
    ctx.beginPath();
    ctx.roundRect(1, 1, w - 2, H - 2, H / 2);
    ctx.fillStyle = 'rgba(13,22,38,0.86)';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = 'rgba(232,188,101,0.9)';
    ctx.stroke();

    // avatar
    const cx = PAD + AV / 2;
    const cy = H / 2;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, AV / 2, 0, Math.PI * 2);
    ctx.clip();
    if (this.img) {
      const s = Math.min(this.img.naturalWidth || AV, this.img.naturalHeight || AV);
      const sx = ((this.img.naturalWidth || AV) - s) / 2;
      const sy = ((this.img.naturalHeight || AV) - s) / 2;
      try {
        ctx.drawImage(this.img, sx, sy, s, s, cx - AV / 2, cy - AV / 2, AV, AV);
      } catch {
        this.drawInitial(ctx, cx, cy);
      }
    } else {
      this.drawInitial(ctx, cx, cy);
    }
    ctx.restore();
    ctx.beginPath();
    ctx.arc(cx, cy, AV / 2, 0, Math.PI * 2);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = P.snow;
    ctx.stroke();

    // nome
    ctx.font = `600 ${FONT_PX}px Fredoka, sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = P.snow;
    ctx.fillText(this.text, PAD + AV + 10, cy + 1);

    this.tex.refresh();
  }

  private drawInitial(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
    ctx.fillStyle = AVATAR_BG[hashString(this.userId) % AVATAR_BG.length];
    ctx.fillRect(cx - AV / 2, cy - AV / 2, AV, AV);
    const initial = Array.from(this.text.replace(/[^\p{L}\p{N}]/gu, ''))[0]?.toUpperCase() ?? '★';
    ctx.font = `700 24px Fredoka, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(initial, cx, cy + 1);
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.img) this.img.onload = null;
    this.img = null;
    if (this.scene.textures.exists(this.key)) this.scene.textures.remove(this.key);
  }
}

function fit(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  const chars = Array.from(text);
  while (chars.length > 1 && ctx.measureText(chars.join('') + '…').width > maxW) chars.pop();
  return chars.join('') + '…';
}
