/**
 * Almofadas: a almofada solta (quadrada, cheia, com cantos em "orelha" e vivo na costura) e o
 * almofadão de assento (caixa fofa com vivo em cima e embaixo), os dois em veludo.
 * A peça nasce apoiada em y = 0, centrada em x e z.
 */
import * as THREE from 'three';
import type { KitContext, Peca } from '../tipos';
import { fbm2, juntar, limitar, pintar } from '../janela/util';
import { materialCordao, materialVeludo } from './cortina';

export const VERDE_VELUDO = '#1d4a3a';

/** Tubo fino (vivo da costura) ao longo de um laço fechado de pontos. */
function vivo(pontos: THREE.Vector3[], raio: number): THREE.BufferGeometry {
  const curva = new THREE.CatmullRomCurve3(pontos, true, 'centripetal');
  return new THREE.TubeGeometry(curva, Math.max(40, pontos.length * 2), raio, 5, true);
}

/**
 * Almofadão de assento: caixa de cantos bem arredondados, tampo levemente estufado e afundado onde
 * se senta, com vivo nas duas costuras. Centrado em x e z, base em y = 0.
 */
export function geometriaAlmofadao(largura: number, profundidade: number, altura: number, semente = 1): { pano: THREE.BufferGeometry; vivos: THREE.BufferGeometry } {
  const hx = largura / 2;
  const hy = altura / 2;
  const hz = profundidade / 2;
  const raio = Math.min(hy * 0.95, 0.05);
  const sx = Math.max(8, Math.round(largura / 0.045));
  const sz = Math.max(6, Math.round(profundidade / 0.045));
  const g = new THREE.BoxGeometry(largura, altura, profundidade, sx, 6, sz);
  const p = g.getAttribute('position');
  const cor = new Float32Array(p.count * 3);
  const v = new THREE.Vector3();
  const q = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    // caixa arredondada: prende o ponto a uma caixa menor e empurra o raio para fora
    q.set(limitar(v.x, -hx + raio, hx - raio), limitar(v.y, -hy + raio, hy - raio), limitar(v.z, -hz + raio, hz - raio));
    const d = v.clone().sub(q);
    if (d.lengthSq() > 1e-10) v.copy(q).add(d.normalize().multiplyScalar(raio));
    // tampo estufado, com dois afundados suaves (lugares de sentar) e ruguinhas
    const fx = v.x / hx;
    const fz = v.z / hz;
    const miolo = (1 - Math.pow(Math.abs(fx), 4)) * (1 - Math.pow(Math.abs(fz), 4));
    if (v.y > 0) {
      const ty = v.y / hy;
      v.y += ty * miolo * (0.018 + 0.006 * fbm2(v.x * 2.2, v.z * 2.2, 2, semente));
      v.y -= ty * miolo * 0.012 * (Math.exp(-Math.pow((fx - 0.45) / 0.3, 2)) + Math.exp(-Math.pow((fx + 0.4) / 0.3, 2)));
    }
    // barriga dos lados
    const lado = 1 - Math.pow(v.y / hy, 2);
    v.x += Math.sign(v.x) * 0.006 * lado * (Math.abs(fx) > 0.9 ? 1 : 0);
    v.z += Math.sign(v.z) * 0.006 * lado * (Math.abs(fz) > 0.9 ? 1 : 0);
    p.setXYZ(i, v.x, v.y + hy, v.z);
    const c = 0.82 + 0.18 * miolo + 0.06 * fbm2(v.x * 5, v.z * 5, 2, semente + 3);
    cor.set([c, c, c], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(cor, 3));
  // UV em metros (o veludo usa ladrilho de 0,28 m)
  const uv = g.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * largura) / 0.28, (uv.getY(i) * profundidade) / 0.28);
  g.computeVertexNormals();
  // vivos: laços nas costuras de cima e de baixo
  const lacos: THREE.BufferGeometry[] = [];
  for (const y of [altura - raio * 0.55, raio * 0.55]) {
    const pts: THREE.Vector3[] = [];
    const rc = raio * 0.9;
    const n = 10;
    const cantos: Array<[number, number, number]> = [
      [hx - rc, hz - rc, 0],
      [-hx + rc, hz - rc, Math.PI / 2],
      [-hx + rc, -hz + rc, Math.PI],
      [hx - rc, -hz + rc, (3 * Math.PI) / 2],
    ];
    for (const [cx, cz, a0] of cantos) {
      for (let k = 0; k <= n; k++) {
        const a = a0 + ((Math.PI / 2) * k) / n;
        pts.push(new THREE.Vector3(cx + Math.cos(a) * (rc + 0.008), y, cz + Math.sin(a) * (rc + 0.008)));
      }
    }
    lacos.push(vivo(pts, 0.006));
  }
  return { pano: g, vivos: juntar(lacos) };
}

export interface AlmofadaOpcoes {
  /** Lado da almofada, em metros. Padrão 0,45. */
  lado?: number;
  cor?: THREE.ColorRepresentation;
  /** Vivo dourado na costura. Padrão true. */
  vivo?: boolean;
  semente?: number;
}

/** Almofada solta de veludo: quadrada, cheia no meio, com os cantos em orelha e vivo na costura. Deitada, base em y = 0. */
export async function criarAlmofada(_ctx: KitContext, o: AlmofadaOpcoes = {}): Promise<Peca> {
  const lado = o.lado ?? 0.45;
  const semente = o.semente ?? 1;
  const h = lado / 2;
  const cheio = lado * 0.16; // meia espessura no miolo
  const n = 22;
  const pos: number[] = [];
  const cor: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const borda: THREE.Vector3[] = [];
  // contorno: os lados entram um pouco entre os cantos (o enchimento puxa o pano)
  const planta = (u: number, v: number): [number, number] => {
    const x = u * h * (1 - 0.07 * (1 - v * v) * Math.abs(u));
    const z = v * h * (1 - 0.07 * (1 - u * u) * Math.abs(v));
    return [x, z];
  };
  for (const face of [1, -1]) {
    const base = pos.length / 3;
    for (let j = 0; j <= n; j++) {
      for (let i = 0; i <= n; i++) {
        const u = (i / n) * 2 - 1;
        const v = (j / n) * 2 - 1;
        const [x, z] = planta(u, v);
        const miolo = Math.pow(Math.max(0, (1 - u * u) * (1 - v * v)), 0.42);
        const ruga = 1 + 0.08 * fbm2(u * 2.5, v * 2.5, 2, semente + (face > 0 ? 0 : 9));
        const y = face * cheio * miolo * ruga;
        pos.push(x, y + cheio, z);
        const c = 0.8 + 0.2 * miolo;
        cor.push(c, c, c);
        uv.push((u * h) / 0.28, (v * h) / 0.28);
      }
    }
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const a = base + j * (n + 1) + i;
        const b = a + 1;
        const c = a + n + 1;
        const d = c + 1;
        if (face > 0) idx.push(a, c, b, b, c, d);
        else idx.push(a, b, c, b, d, c);
      }
    }
  }
  // laço da costura, no sentido anti-horário
  const passo = 2 / n;
  const naBorda = (u: number, v: number) => {
    const [x, z] = planta(u, v);
    borda.push(new THREE.Vector3(x, cheio, z));
  };
  for (let k = 0; k < n; k++) naBorda(-1 + k * passo, -1);
  for (let k = 0; k < n; k++) naBorda(1, -1 + k * passo);
  for (let k = 0; k < n; k++) naBorda(1 - k * passo, 1);
  for (let k = 0; k < n; k++) naBorda(-1, 1 - k * passo);
  const pano = new THREE.BufferGeometry();
  pano.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  pano.setAttribute('color', new THREE.Float32BufferAttribute(cor, 3));
  pano.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  pano.setIndex(idx);
  pano.computeVertexNormals();
  const root = new THREE.Group();
  root.name = 'almofada';
  const mat = await materialVeludo(o.cor ?? VERDE_VELUDO, 0.6);
  const malha = new THREE.Mesh(pano, mat);
  malha.name = 'almofada-pano';
  malha.castShadow = true;
  malha.receiveShadow = true;
  root.add(malha);
  const lixo: Array<{ dispose(): void }> = [pano, mat];
  if (o.vivo ?? true) {
    const g = pintar(vivo(borda, 0.0055), '#ffffff');
    const m = new THREE.Mesh(g, materialCordao());
    m.name = 'almofada-vivo';
    root.add(m);
    lixo.push(g);
  }
  return {
    root,
    update() {},
    setQuality() {},
    dispose() {
      for (const l of lixo) l.dispose();
    },
  };
}
