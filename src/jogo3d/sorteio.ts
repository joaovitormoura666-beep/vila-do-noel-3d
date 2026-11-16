/**
 * Sorteio com semente (mulberry32): a mesma semente dá sempre a mesma sequência. Usado no modo de captura
 * (?manual=1), em que a simulação precisa sair igual em toda gravação, e nos sorteios de presente e de frase.
 */
export function criarSorteio(semente: number | string): () => number {
  let a = typeof semente === 'number' ? semente >>> 0 : hashTexto(semente);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash FNV-1a de 32 bits (o mesmo do 2D, src/render/textures/canvas.ts: hashString). */
export function hashTexto(texto: string): number {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
