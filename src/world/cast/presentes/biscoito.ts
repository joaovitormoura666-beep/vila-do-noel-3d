/**
 * BISCOITO DE GENGIBRE: bonequinho de massa assada, gordinho e com a borda arredondada (cresceu no forno),
 * dourado no meio e mais tostado na borda, com grumos, poros e manchinhas; decorado com glacê real branco
 * em relevo (zigue-zagues nos punhos e nos tornozelos, olhos, sorriso) e três botões de bala (vermelho,
 * verde, vermelho) brilhantes.
 * Duas malhas: massa e glacê (o glacê e as balas na mesma, com acabamentos diferentes por vértice).
 */
import * as THREE from 'three';
import { type Cor, Molde, quadros, tubo } from './malha';
import { COR, esfera, ruido } from './pecas';
import { div, type Moldar } from './tipos';

const ESPESSURA = 0.014; // meia espessura no meio
const CENTRO = new THREE.Vector2(0, 0.005);

// silhueta por função de distância (círculos e cápsulas unidos com suavidade)
function capsula(px: number, py: number, ax: number, ay: number, bx: number, by: number, r: number) {
  const pax = px - ax;
  const pay = py - ay;
  const bax = bx - ax;
  const bay = by - ay;
  const h = Math.max(0, Math.min(1, (pax * bax + pay * bay) / (bax * bax + bay * bay)));
  return Math.hypot(pax - bax * h, pay - bay * h) - r;
}
function uniao(a: number, b: number, k: number) {
  const h = Math.max(0, Math.min(1, 0.5 + (0.5 * (b - a)) / k));
  return b + (a - b) * h - k * h * (1 - h);
}
function silhueta(x: number, y: number) {
  let d = Math.hypot(x, y - 0.092) - 0.054; // cabeça
  d = uniao(d, capsula(x, y, 0, 0.025, 0, -0.035, 0.052), 0.02); // tronco
  for (const s of [-1, 1]) {
    d = uniao(d, capsula(x, y, s * 0.03, 0.022, s * 0.1, 0.045, 0.027), 0.018); // braços
    d = uniao(d, capsula(x, y, s * 0.022, -0.04, s * 0.052, -0.118, 0.031), 0.016); // pernas
  }
  return d;
}

const N_RAIO = 720;
let raios: Float32Array | null = null;
/** Raio da borda em cada direção, a partir do centro (a borda mais de fora). */
function tabelaDeRaios(): Float32Array {
  if (raios) return raios;
  raios = new Float32Array(N_RAIO);
  for (let i = 0; i < N_RAIO; i++) {
    const a = (i / N_RAIO) * Math.PI * 2;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    let r = 0.25;
    while (r > 0 && silhueta(CENTRO.x + dx * r, CENTRO.y + dy * r) > 0) r -= 0.0005;
    // refina por bisseção
    let lo = r;
    let hi = r + 0.0005;
    for (let k = 0; k < 12; k++) {
      const m = (lo + hi) / 2;
      if (silhueta(CENTRO.x + dx * m, CENTRO.y + dy * m) > 0) hi = m;
      else lo = m;
    }
    raios[i] = lo;
  }
  return raios;
}
function raioEm(a: number) {
  const t = tabelaDeRaios();
  const f = ((((a / (Math.PI * 2)) % 1) + 1) % 1) * N_RAIO;
  const i = Math.floor(f);
  const w = f - i;
  return t[i % N_RAIO] * (1 - w) + t[(i + 1) % N_RAIO] * w;
}

/** Altura da face da frente do biscoito em (x, y) (0 na borda). */
function alturaEm(x: number, y: number) {
  const dx = x - CENTRO.x;
  const dy = y - CENTRO.y;
  const s = Math.min(1, Math.hypot(dx, dy) / raioEm(Math.atan2(dy, dx)));
  return ESPESSURA * Math.sqrt(Math.max(0, 1 - s ** 5)) * (1 + ruido(x * 28, y * 28, 0.5, 21) * 0.05);
}

const MASSA: Cor = [0.36, 0.14, 0.04];
const TOSTADO: Cor = [0.17, 0.06, 0.018];
const GLACE: Cor = [0.78, 0.76, 0.72];

export const moldarBiscoito: Moldar = (q) => {
  const massa = new Molde();
  massa.adicionar({
    nu: div(q, 112, 56),
    nv: div(q, 20, 12),
    ponto(u, v, out) {
      const a = u * Math.PI * 2;
      const frente = v <= 0.5;
      const s = frente ? v / 0.5 : (1 - v) / 0.5;
      const R = raioEm(a);
      const x = CENTRO.x + Math.cos(a) * R * s;
      const y = CENTRO.y + Math.sin(a) * R * s;
      // borda ondulada (massa cortada à mão e crescida)
      const borda = ruido(Math.cos(a) * 3, Math.sin(a) * 3, 2.5, 22) * 0.002 * s;
      const z = ESPESSURA * Math.sqrt(Math.max(0, 1 - s ** 5)) * (1 + ruido(x * 28, y * 28, frente ? 0.5 : 4.5, 21) * 0.05);
      out.set(x + Math.cos(a) * borda, y + Math.sin(a) * borda, frente ? z : -z * 0.85);
    },
    cor(u, v, p) {
      const s = v <= 0.5 ? v / 0.5 : (1 - v) / 0.5;
      // tostado na borda, manchas do forno, um pouco mais claro no alto do relevo
      const tost = THREE.MathUtils.smoothstep(s, 0.72, 1) * 0.85 + Math.max(0, ruido(p.x * 30, p.y * 30, 1.5, 23)) * 0.4;
      const k = 1 + ruido(p.x * 90, p.y * 90, 3.3, 24) * 0.08;
      const c: Cor = [
        (MASSA[0] + (TOSTADO[0] - MASSA[0]) * tost) * k,
        (MASSA[1] + (TOSTADO[1] - MASSA[1]) * tost) * k,
        (MASSA[2] + (TOSTADO[2] - MASSA[2]) * tost) * k,
      ];
      void u;
      return c;
    },
    acab: () => [0, 0.78, 0, 0],
    uv: (u, v) => {
      const a = u * Math.PI * 2;
      const s = v <= 0.5 ? v / 0.5 : (1 - v) / 0.5;
      const R = raioEm(a);
      return [Math.cos(a) * R * s * 1.0 + (v > 0.5 ? 0.37 : 0), Math.sin(a) * R * s];
    },
  });

  /* ------------------------------------------------------------------ glacê */
  const glace = new Molde();
  const naFrente = (x: number, y: number, sobe: number) => new THREE.Vector3(x, y, alturaEm(x, y) + sobe);
  const fio = (pts: THREE.Vector3[], r: number) => {
    const curva = new THREE.CatmullRomCurve3(pts);
    const n = Math.max(8, Math.round(pts.length * 4 * q.k));
    const fq = quadros((t, out) => curva.getPoint(t, out), n, new THREE.Vector3(0, 0, 1));
    glace.adicionar({
      nu: 6,
      nv: n,
      // o glacê é espremido do saco: engrossa e afina um pouco, e assenta (achatado)
      ponto: tubo(fq, (_u, v) => {
        const k = 1 + Math.sin(v * 37) * 0.08;
        return [r * k * 0.75, r * k];
      }, undefined, 0.04),
      cor: () => GLACE,
      acab: () => [0, 0.42, 0.55, 0],
    });
  };
  // zigue-zagues nos punhos e nos tornozelos (perpendiculares ao braço e à perna)
  const zigue = (a: THREE.Vector2, b: THREE.Vector2, larg: number, dentes: number) => {
    const dir = b.clone().sub(a).normalize();
    const perp = new THREE.Vector2(-dir.y, dir.x);
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= dentes * 2; i++) {
      const t = i / (dentes * 2);
      const c = a.clone().lerp(b, 0.5).addScaledVector(perp, (t - 0.5) * larg * 2).addScaledVector(dir, (i % 2 ? 1 : -1) * 0.0065);
      pts.push(naFrente(c.x, c.y, 0.0016));
    }
    fio(pts, 0.0032);
  };
  for (const s of [-1, 1]) {
    zigue(new THREE.Vector2(s * 0.074, 0.035), new THREE.Vector2(s * 0.088, 0.039), 0.021, 3);
    zigue(new THREE.Vector2(s * 0.044, -0.095), new THREE.Vector2(s * 0.048, -0.105), 0.025, 3);
  }
  // sorriso
  const sorriso: THREE.Vector3[] = [];
  for (let i = 0; i <= 6; i++) {
    const a = Math.PI * (1.18 + (i / 6) * 0.64);
    sorriso.push(naFrente(Math.cos(a) * 0.024, 0.088 + Math.sin(a) * 0.022, 0.0012));
  }
  fio(sorriso, 0.0028);
  // olhos: gotinhas de glacê
  for (const s of [-1, 1]) esfera(glace, naFrente(s * 0.018, 0.103, -0.001), 0.0062, div(q, 12, 8), div(q, 8, 6), GLACE, [0, 0.4, 0.6, 0], [1, 1, 0.6]);
  // botões de bala: vermelho, verde, vermelho (bala de goma vitrificada)
  const balas: Array<[number, Cor]> = [
    [0.03, COR.vermelho],
    [0.002, COR.verdeClaro],
    [-0.026, COR.vermelho],
  ];
  for (const [y, cor] of balas)
    glace.adicionar({
      nu: div(q, 14, 8),
      nv: div(q, 8, 6),
      ponto(u, v, out) {
        const a = u * Math.PI * 2;
        const ph = v * Math.PI * 0.5;
        const r = 0.0105 * Math.cos(ph) * (1 + 0.04 * Math.sin(a * 5));
        const base = naFrente(0, y, -0.002);
        out.set(base.x + Math.cos(a) * r, base.y + Math.sin(a) * r, base.z + Math.sin(ph) * 0.0075);
      },
      cor: () => [cor[0] * 0.8, cor[1] * 0.8, cor[2] * 0.8],
      acab: () => [0, 0.18, 1, 0],
    });

  return {
    partes: [
      { nome: 'massa', material: 'massa', molde: massa },
      { nome: 'glace', material: 'esmalte', molde: glace },
    ],
  };
};
