/** Pequenos construtores de geometria usados pela árvore: tubos ao longo de pontos e junção de malhas. */
import * as THREE from 'three';

/** Acumulador de malha (posições, normais, UV, cor de vértice opcional e índices). */
export class Malhador {
  pos: number[] = [];
  nor: number[] = [];
  uv: number[] = [];
  cor: number[] = [];
  idx: number[] = [];
  get vertices() {
    return this.pos.length / 3;
  }
  vertice(p: THREE.Vector3, n: THREE.Vector3, u: number, v: number, c?: THREE.Color): number {
    this.pos.push(p.x, p.y, p.z);
    this.nor.push(n.x, n.y, n.z);
    this.uv.push(u, v);
    if (c) this.cor.push(c.r, c.g, c.b);
    return this.vertices - 1;
  }
  quad(a: number, b: number, c: number, d: number) {
    this.idx.push(a, b, c, a, c, d);
  }
  /** Junta outra geometria, transformada, pintando-a com uma cor de vértice. */
  juntar(g: THREE.BufferGeometry, m?: THREE.Matrix4, c?: THREE.Color) {
    const base = this.vertices;
    const p = g.getAttribute('position');
    const n = g.getAttribute('normal');
    const t = g.getAttribute('uv');
    const v = new THREE.Vector3();
    const nm = m ? new THREE.Matrix3().getNormalMatrix(m) : null;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      if (m) v.applyMatrix4(m);
      this.pos.push(v.x, v.y, v.z);
      v.fromBufferAttribute(n, i);
      if (nm) v.applyMatrix3(nm).normalize();
      this.nor.push(v.x, v.y, v.z);
      this.uv.push(t ? t.getX(i) : 0, t ? t.getY(i) : 0);
      if (c) this.cor.push(c.r, c.g, c.b);
    }
    const ind = g.getIndex();
    if (ind) for (let i = 0; i < ind.count; i++) this.idx.push(ind.getX(i) + base);
    else for (let i = 0; i < p.count; i++) this.idx.push(i + base);
  }
  geometria(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    if (this.cor.length === this.pos.length) g.setAttribute('color', new THREE.Float32BufferAttribute(this.cor, 3));
    g.setIndex(this.idx);
    return g;
  }
}

/**
 * Tubo ao longo de uma linha de pontos, com raio por ponto. `lados` faces em volta; UV: u em volta, v pelo
 * comprimento em metros dividido por `metrosPorV`. Usa um referencial que não torce (transporte paralelo).
 */
export function tubo(m: Malhador, pontos: THREE.Vector3[], raio: (i: number) => number, lados: number, metrosPorV = 0.3, cor?: THREE.Color, tampa = true) {
  const n = pontos.length;
  if (n < 2) return;
  const t = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const bin = new THREE.Vector3();
  const anterior = new THREE.Vector3();
  const p = new THREE.Vector3();
  const nn = new THREE.Vector3();
  let comprimento = 0;
  const inicio = m.vertices;
  for (let i = 0; i < n; i++) {
    t.subVectors(pontos[Math.min(n - 1, i + 1)], pontos[Math.max(0, i - 1)]).normalize();
    if (i === 0) {
      normal.set(0, 1, 0);
      if (Math.abs(t.y) > 0.9) normal.set(1, 0, 0);
      normal.addScaledVector(t, -normal.dot(t)).normalize();
    } else {
      // transporte paralelo: remove da normal anterior a parte que ficou ao longo da nova tangente
      normal.copy(anterior).addScaledVector(t, -anterior.dot(t)).normalize();
      comprimento += pontos[i].distanceTo(pontos[i - 1]);
    }
    anterior.copy(normal);
    bin.crossVectors(t, normal);
    const r = raio(i);
    for (let k = 0; k <= lados; k++) {
      const a = (k / lados) * Math.PI * 2;
      nn.copy(normal).multiplyScalar(Math.cos(a)).addScaledVector(bin, Math.sin(a));
      p.copy(pontos[i]).addScaledVector(nn, r);
      m.vertice(p, nn, k / lados, comprimento / metrosPorV, cor);
    }
  }
  const linha = lados + 1;
  for (let i = 0; i < n - 1; i++)
    for (let k = 0; k < lados; k++) {
      const a = inicio + i * linha + k;
      m.quad(a, a + 1, a + linha + 1, a + linha);
    }
  if (tampa) {
    // ponta fechada com um vértice central
    t.subVectors(pontos[n - 1], pontos[n - 2]).normalize();
    const c = m.vertice(pontos[n - 1].clone().addScaledVector(t, raio(n - 1) * 0.6), t, 0.5, comprimento / metrosPorV, cor);
    const ult = inicio + (n - 1) * linha;
    for (let k = 0; k < lados; k++) m.idx.push(ult + k, ult + k + 1, c);
  }
}
