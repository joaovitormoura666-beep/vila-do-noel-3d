import * as THREE from 'three';

/**
 * Caminho no chão, percorrido por distância (metros). Os pontos dados são suavizados
 * por uma curva para os personagens fazerem as curvas sem trancos.
 */
export class Path3 {
  readonly length: number;
  private readonly pts: THREE.Vector3[];
  private readonly acc: number[];

  constructor(points: THREE.Vector3[], smooth = true) {
    if (points.length < 2) throw new Error('um caminho precisa de pelo menos dois pontos');
    if (smooth && points.length > 2) {
      const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
      this.pts = curve.getPoints(Math.max(24, points.length * 14));
    } else {
      this.pts = points.map((p) => p.clone());
    }
    this.acc = [0];
    for (let i = 1; i < this.pts.length; i++) this.acc.push(this.acc[i - 1] + this.pts[i].distanceTo(this.pts[i - 1]));
    this.length = this.acc[this.acc.length - 1];
  }

  /** Posição a `s` metros do início (limitado às pontas). */
  at(s: number, out = new THREE.Vector3()): THREE.Vector3 {
    const { i, f } = this.locate(s);
    return out.lerpVectors(this.pts[i], this.pts[i + 1], f);
  }

  /** Direção de quem anda para a frente em `s`, como ângulo em Y (0 = olhando para +Z). */
  yawAt(s: number): number {
    const { i } = this.locate(s);
    const a = this.pts[i];
    const b = this.pts[i + 1];
    return Math.atan2(b.x - a.x, b.z - a.z);
  }

  private locate(s: number) {
    const d = Math.min(this.length, Math.max(0, s));
    let lo = 0;
    let hi = this.acc.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (this.acc[mid] <= d) lo = mid;
      else hi = mid;
    }
    const seg = this.acc[lo + 1] - this.acc[lo];
    return { i: lo, f: seg > 0 ? (d - this.acc[lo]) / seg : 0 };
  }
}
