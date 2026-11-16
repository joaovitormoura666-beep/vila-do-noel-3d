/**
 * Utilidades do Noel: sorteio com semente, ruído suave, curvas por chaves e pequenas contas.
 * Nada aqui usa Math.random: o Noel sai idêntico em toda foto.
 */

/** Gerador mulberry32: devolve uma função que dá números em [0, 1). */
export function criarSorteio(semente: number): () => number {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const limitar = (x: number, a: number, b: number) => (x < a ? a : x > b ? b : x);
export const misturar = (a: number, b: number, t: number) => a + (b - a) * t;
export function suave(a: number, b: number, x: number): number {
  const t = limitar((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}
/** Sino de Gauss centrado em 0 com largura l. */
export const sino = (x: number, l: number) => Math.exp(-(x * x) / (l * l));

function aleat3(x: number, y: number, z: number, s: number): number {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1274126177) ^ Math.imul(s, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Ruído de valor suave em 3D, de -1 a 1. */
export function ruido3(x: number, y: number, z: number, s = 0): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const fx = x - xi;
  const fy = y - yi;
  const fz = z - zi;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const uz = fz * fz * (3 - 2 * fz);
  let r = 0;
  for (let dz = 0; dz < 2; dz++)
    for (let dy = 0; dy < 2; dy++)
      for (let dx = 0; dx < 2; dx++) {
        const w = (dx ? ux : 1 - ux) * (dy ? uy : 1 - uy) * (dz ? uz : 1 - uz);
        r += w * aleat3(xi + dx, yi + dy, zi + dz, s);
      }
  return r * 2 - 1;
}

/** Soma de oitavas de ruído (fbm), de cerca de -1 a 1. */
export function fbm3(x: number, y: number, z: number, oitavas = 3, s = 0): number {
  let soma = 0;
  let amp = 0.5;
  let f = 1;
  let norma = 0;
  for (let i = 0; i < oitavas; i++) {
    soma += amp * ruido3(x * f, y * f, z * f, s + i * 17);
    norma += amp;
    amp *= 0.5;
    f *= 2.03;
  }
  return soma / norma;
}

/**
 * Curva suave por chaves (Catmull-Rom em x crescente). `xs` em ordem crescente; fora do intervalo, mantém a ponta.
 * Serve para os perfis do corpo: raio em função da altura, por exemplo.
 */
export function chaves(xs: readonly number[], ys: readonly number[]): (x: number) => number {
  const n = xs.length;
  return (x: number) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (i < n - 2 && x > xs[i + 1]) i++;
    const x0 = xs[i];
    const x1 = xs[i + 1];
    const t = (x - x0) / (x1 - x0);
    const y0 = ys[Math.max(0, i - 1)];
    const y1 = ys[i];
    const y2 = ys[i + 1];
    const y3 = ys[Math.min(n - 1, i + 2)];
    // tangentes escaladas pelo espaçamento (chaves desiguais)
    const xa = xs[Math.max(0, i - 1)];
    const xb = xs[Math.min(n - 1, i + 2)];
    const m1 = ((y2 - y0) / Math.max(1e-6, x1 - xa)) * (x1 - x0);
    const m2 = ((y3 - y1) / Math.max(1e-6, xb - x0)) * (x1 - x0);
    const t2 = t * t;
    const t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * y1 + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * y2 + (t3 - t2) * m2;
  };
}

/** Potência com sinal (para superelipses). */
export const potS = (x: number, e: number) => Math.sign(x) * Math.pow(Math.abs(x), e);
