export interface Vec2 {
  x: number;
  y: number;
}

/**
 * Trilha suave (Catmull-Rom) com tabela de distâncias, para mover personagens
 * por "distância percorrida" em vez de por tempo. Sem dependência do Phaser,
 * o que permite testar a lógica isoladamente.
 */
export class PathTrack {
  private pts: Vec2[] = [];
  private acc: number[] = [];
  readonly length: number;

  constructor(control: Array<[number, number]>, samplesPerSegment = 24) {
    const c = control.map(([x, y]) => ({ x, y }));
    if (c.length < 2) throw new Error('PathTrack precisa de pelo menos 2 pontos');
    for (let i = 0; i < c.length - 1; i++) {
      const p0 = c[Math.max(0, i - 1)];
      const p1 = c[i];
      const p2 = c[i + 1];
      const p3 = c[Math.min(c.length - 1, i + 2)];
      for (let j = 0; j < samplesPerSegment; j++) {
        this.pts.push(catmull(p0, p1, p2, p3, j / samplesPerSegment));
      }
    }
    this.pts.push(c[c.length - 1]);
    let total = 0;
    this.acc.push(0);
    for (let i = 1; i < this.pts.length; i++) {
      total += Math.hypot(this.pts[i].x - this.pts[i - 1].x, this.pts[i].y - this.pts[i - 1].y);
      this.acc.push(total);
    }
    this.length = total;
  }

  /** Posição a `s` pixels do início da trilha. */
  at(s: number, out: Vec2 = { x: 0, y: 0 }): Vec2 {
    const d = Math.min(this.length, Math.max(0, s));
    let lo = 0;
    let hi = this.acc.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (this.acc[mid] <= d) lo = mid;
      else hi = mid;
    }
    const span = this.acc[hi] - this.acc[lo] || 1;
    const t = (d - this.acc[lo]) / span;
    out.x = this.pts[lo].x + (this.pts[hi].x - this.pts[lo].x) * t;
    out.y = this.pts[lo].y + (this.pts[hi].y - this.pts[lo].y) * t;
    return out;
  }

  /** Pontos igualmente espaçados (para desenhar o caminho). */
  sample(step: number): Vec2[] {
    const out: Vec2[] = [];
    for (let s = 0; s <= this.length; s += step) out.push(this.at(s));
    out.push(this.at(this.length));
    return out;
  }
}

function catmull(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, t: number): Vec2 {
  const t2 = t * t;
  const t3 = t2 * t;
  const f = (a: number, b: number, c: number, d: number) =>
    0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
  return { x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) };
}
