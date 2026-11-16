/**
 * Utilidades dos gnomos: sorteio com semente, ruído suave e pequenas contas.
 * Nada aqui usa Math.random: a mesma semente sempre dá o mesmo resultado.
 */

/** Hash FNV-1a de 32 bits de um texto. */
export function hashTexto(texto: string): number {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) h = Math.imul(h ^ texto.charCodeAt(i), 16777619);
  // mistura final (avalanche), para sementes parecidas ("a1", "a2") darem números bem diferentes
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

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

/* ----------------------------------------------------------------- ruído de valor 3D */

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

/** Escolhe um item da lista. */
export function escolher<T>(sorteio: () => number, lista: readonly T[]): T {
  return lista[Math.floor(sorteio() * lista.length) % lista.length];
}

/** Embaralha uma cópia da lista (Fisher-Yates com a semente). */
export function embaralhar<T>(sorteio: () => number, lista: readonly T[]): T[] {
  const a = lista.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(sorteio() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
