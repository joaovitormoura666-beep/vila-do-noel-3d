/**
 * Chão de neve: uma malha só, em leque (fina perto da vidraça, larga ao longe), com o relevo do Relevo,
 * mais o "mapa de luz" pintado em um canvas visto de cima: R = luz quente das janelas e lampiões derramada
 * na neve, G = caminho pisado, B = oclusão pintada (assenta casas, troncos e cercas no chão).
 */
import * as THREE from 'three';
import type { Level } from '../../contracts';
import { Relevo, ESTRADA, riachoD } from './relevo';
import { Malha, fbm } from './util';

/** Região do mapa de luz, em coordenadas de projeto. */
const LM_X0 = -48;
const LM_D0 = -2;
const LM_TAM = 96;
const LM_PX = 1024;

export class MapaLuz {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private textura: THREE.CanvasTexture | null = null;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = LM_PX;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('canvas 2D indisponível');
    this.ctx = ctx;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, LM_PX, LM_PX);
    ctx.globalCompositeOperation = 'lighter';
  }

  static uv(x: number, D: number): [number, number] {
    return [(x - LM_X0) / LM_TAM, (D - LM_D0) / LM_TAM];
  }
  private px(m: number) {
    return (m / LM_TAM) * LM_PX;
  }

  /** Mancha elíptica com degradê. (x, D) = centro; (dx, dD) = direção do eixo maior; raios em metros de projeto. */
  private mancha(x: number, D: number, dx: number, dD: number, raioMaior: number, raioMenor: number, cor: [number, number, number], forca: number, miolo = 0.0) {
    const c = this.ctx;
    const [u, v] = MapaLuz.uv(x, D);
    c.save();
    c.translate(u * LM_PX, v * LM_PX);
    c.rotate(Math.atan2(dD, dx));
    c.scale(this.px(raioMaior), this.px(raioMenor));
    const g = c.createRadialGradient(0, 0, miolo, 0, 0, 1);
    const rgb = `${Math.round(cor[0] * 255)},${Math.round(cor[1] * 255)},${Math.round(cor[2] * 255)}`;
    g.addColorStop(0, `rgba(${rgb},${forca})`);
    g.addColorStop(0.35, `rgba(${rgb},${forca * 0.55})`);
    g.addColorStop(0.7, `rgba(${rgb},${forca * 0.16})`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    c.fillStyle = g;
    c.beginPath();
    c.arc(0, 0, 1, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }

  /**
   * Poça de luz quente de uma janela: um trapézio que nasce ao pé da parede (x, D), com a largura da janela, e se
   * abre na direção (dx, dD), esmaecendo com a distância; borda amolecida pelo desfoque do canvas.
   */
  pocaJanela(x: number, D: number, dx: number, dD: number, alcance: number, largura: number, forca: number) {
    const l = Math.hypot(dx, dD) || 1;
    const ux = dx / l;
    const ud = dD / l;
    const c = this.ctx;
    const [u, v] = MapaLuz.uv(x, D);
    const A = this.px(alcance);
    const W = this.px(largura);
    c.save();
    c.filter = `blur(${Math.max(1, W * 0.35)}px)`;
    c.translate(u * LM_PX, v * LM_PX);
    c.rotate(Math.atan2(ud, ux));
    const g = c.createLinearGradient(0, 0, A, 0);
    g.addColorStop(0, `rgba(255,0,0,${forca})`);
    g.addColorStop(0.3, `rgba(255,0,0,${forca * 0.6})`);
    g.addColorStop(0.7, `rgba(255,0,0,${forca * 0.18})`);
    g.addColorStop(1, 'rgba(255,0,0,0)');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(0, -W * 0.5);
    c.lineTo(A, -W * 0.95);
    c.lineTo(A, W * 0.95);
    c.lineTo(0, W * 0.5);
    c.closePath();
    c.fill();
    c.restore();
  }

  /** Poça redonda de lampião. */
  pocaLampiao(x: number, D: number, raio: number, forca: number) {
    this.mancha(x, D, 1, 0, raio, raio, [1, 0, 0], forca);
    this.mancha(x, D, 1, 0, raio * 0.45, raio * 0.45, [1, 0, 0], forca * 0.6);
  }

  /** Oclusão pintada (sombra de contato). */
  oclusao(x: number, D: number, dx: number, dD: number, raioMaior: number, raioMenor: number, forca: number) {
    this.mancha(x, D, dx, dD, raioMaior, raioMenor, [0, 0, 1], forca, 0.35);
  }

  /** Caminho pisado ao longo de uma linha de pontos [x, D]. */
  caminho(pontos: ReadonlyArray<readonly [number, number]>, largura: number, forca: number) {
    const c = this.ctx;
    c.save();
    c.filter = `blur(${Math.max(1, this.px(largura * 0.35))}px)`;
    c.strokeStyle = `rgba(0,255,0,${forca})`;
    c.lineWidth = this.px(largura);
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.beginPath();
    pontos.forEach(([x, D], i) => {
      const [u, v] = MapaLuz.uv(x, D);
      if (i === 0) c.moveTo(u * LM_PX, v * LM_PX);
      else c.lineTo(u * LM_PX, v * LM_PX);
    });
    c.stroke();
    c.restore();
  }

  criarTextura(): THREE.CanvasTexture {
    const t = new THREE.CanvasTexture(this.canvas);
    t.flipY = false;
    t.colorSpace = THREE.NoColorSpace;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.needsUpdate = true;
    this.textura = t;
    return t;
  }
  dispose() {
    this.textura?.dispose();
  }
}

const GRADE: Record<Level, [number, number]> = { alta: [132, 108], media: [108, 90], baixa: [84, 70] };

/** Malha do chão de neve. Atributos: position, normal, uv (não usada), aCor e aLm (UV no mapa de luz). */
export function criarGeometriaTerreno(relevo: Relevo, nivel: Level): THREE.BufferGeometry {
  const [nx, nz] = GRADE[nivel];
  const fundo = 87;
  const meia = relevo.largura / 2;
  const pos: number[] = [];
  const nor: number[] = [];
  const lm: number[] = [];
  const cor: number[] = [];
  const idx: number[] = [];
  const p = new THREE.Vector3();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const n = new THREE.Vector3();
  // a malha nunca passa do vidro (z <= -0,02): a fileira j = -1 é uma saia que desce no mesmo z, para não haver fresta
  for (let j = -1; j <= nz; j++) {
    const t = Math.max(j, 0) / nz;
    const D = 0.02 + (fundo - 0.02) * (0.2 * t + 0.8 * Math.pow(t, 2.1));
    const hw = 22 + (meia - 22) * Math.max(D, 0) / fundo;
    for (let i = 0; i <= nx; i++) {
      const u = -1 + (2 * i) / nx;
      const x = hw * Math.sign(u) * Math.pow(Math.abs(u), 1.25);
      relevo.chao(x, D, p);
      const e = 0.12 + D * 0.012;
      relevo.chao(x + e, D, a).sub(relevo.chao(x - e, D, n));
      relevo.chao(x, D + e, b).sub(relevo.chao(x, D - e, n));
      n.crossVectors(a, b).normalize();
      if (n.y < 0) n.negate();
      if (j < 0) p.y -= 0.8;
      pos.push(p.x, p.y, p.z);
      nor.push(n.x, n.y, n.z);
      const [lu, lv] = MapaLuz.uv(x, D);
      lm.push(lu, lv);
      cor.push(1, 1, 1, 0);
    }
  }
  const linha = nx + 1;
  for (let j = 0; j < nz + 1; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * linha + i;
      idx.push(k, k + linha, k + 1, k + 1, k + linha, k + linha + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
  g.setAttribute('aCor', new THREE.Float32BufferAttribute(cor, 4));
  g.setAttribute('aLm', new THREE.Float32BufferAttribute(lm, 2));
  g.setIndex(new THREE.Uint32BufferAttribute(idx, 1));
  g.computeBoundingSphere();
  return g;
}

/** Fita de gelo do riacho, pousada no leito. */
export function construirRiacho(gelo: Malha, relevo: Relevo) {
  gelo.definir(new THREE.Matrix4());
  const p = new THREE.Vector3();
  const pts: Array<[THREE.Vector3, THREE.Vector3]> = [];
  for (let x = -40; x <= 40; x += 0.5) {
    const D = riachoD(x);
    const meiaLarg = 0.75 + 0.45 * fbm(x * 0.3, 2.7, 2);
    const s = relevo.escala(D);
    const y = (relevo.alturaProjeto(x, D) + 0.17) * s;
    relevo.chao(x, D - meiaLarg, p);
    const e = new THREE.Vector3(p.x, y, p.z);
    relevo.chao(x, D + meiaLarg, p);
    const d = new THREE.Vector3(p.x, y, p.z);
    pts.push([e, d]);
  }
  for (let i = 0; i < pts.length - 1; i++) gelo.face(pts[i][0], pts[i + 1][0], pts[i + 1][1], pts[i][1], 2);
}

export { ESTRADA };
