/**
 * Ruído e sorteio com semente para a lareira: tudo determinístico (nada de Math.random),
 * para a peça sair igual em toda foto e em toda máquina.
 */

/** Gerador com semente (mulberry32). Devolve números em [0, 1). */
export function criarRng(semente: number): () => number {
  let a = (semente | 0) + 0x6d2b79f5;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashInt(x: number, y: number, z: number): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const suave = (t: number) => t * t * (3 - 2 * t);

/** Ruído de valor 3D suave, em [0, 1]. */
export function ruido3(x: number, y: number, z: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const fx = suave(x - xi);
  const fy = suave(y - yi);
  const fz = suave(z - zi);
  const l = (a: number, b: number, t: number) => a + (b - a) * t;
  const c000 = hashInt(xi, yi, zi);
  const c100 = hashInt(xi + 1, yi, zi);
  const c010 = hashInt(xi, yi + 1, zi);
  const c110 = hashInt(xi + 1, yi + 1, zi);
  const c001 = hashInt(xi, yi, zi + 1);
  const c101 = hashInt(xi + 1, yi, zi + 1);
  const c011 = hashInt(xi, yi + 1, zi + 1);
  const c111 = hashInt(xi + 1, yi + 1, zi + 1);
  return l(l(l(c000, c100, fx), l(c010, c110, fx), fy), l(l(c001, c101, fx), l(c011, c111, fx), fy), fz);
}

/** Soma de oitavas do ruído 3D, em [0, 1]. */
export function fbm3(x: number, y: number, z: number, oitavas = 3): number {
  let soma = 0;
  let amp = 0.5;
  let norma = 0;
  for (let i = 0; i < oitavas; i++) {
    soma += ruido3(x, y, z) * amp;
    norma += amp;
    x = x * 2.03 + 17.1;
    y = y * 2.03 + 5.7;
    z = z * 2.03 + 11.3;
    amp *= 0.5;
  }
  return soma / norma;
}

/** Ruído 1D suave em [-1, 1], para tremores orgânicos em função do tempo. */
export function ruido1(t: number, semente = 0): number {
  return ruido3(t, semente * 13.37, semente * 7.11) * 2 - 1;
}

/** Trecho GLSL com hash, ruído de valor 2D e 3D e fbm. Incluído nos shaders do fogo e das brasas. */
export const GLSL_RUIDO = /* glsl */ `
float lrHash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float lrHash3(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.x + p.y) * p.z);
}
float lrRuido(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = lrHash(i);
  float b = lrHash(i + vec2(1.0, 0.0));
  float c = lrHash(i + vec2(0.0, 1.0));
  float d = lrHash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float lrRuido3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float n000 = lrHash3(i);
  float n100 = lrHash3(i + vec3(1.0, 0.0, 0.0));
  float n010 = lrHash3(i + vec3(0.0, 1.0, 0.0));
  float n110 = lrHash3(i + vec3(1.0, 1.0, 0.0));
  float n001 = lrHash3(i + vec3(0.0, 0.0, 1.0));
  float n101 = lrHash3(i + vec3(1.0, 0.0, 1.0));
  float n011 = lrHash3(i + vec3(0.0, 1.0, 1.0));
  float n111 = lrHash3(i + vec3(1.0, 1.0, 1.0));
  return mix(mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y), mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y), f.z);
}
float lrFbm(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    s += lrRuido(p) * a;
    p = p * 2.03 + vec2(17.1, 5.7);
    a *= 0.5;
  }
  return s / 0.9375;
}
float lrFbm3(vec3 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 3; i++) {
    s += lrRuido3(p) * a;
    p = p * 2.03 + vec3(17.1, 5.7, 11.3);
    a *= 0.5;
  }
  return s / 0.875;
}
`;

/**
 * Ruído celular 3D (Worley) em GLSL: lrCelular(p) devolve (F1, F2, sorteio da célula mais próxima).
 * F2 - F1 é pequeno nas divisas entre células: é o que desenha as frestas do carvão.
 */
export const GLSL_CELULAR = /* glsl */ `
vec3 lrHash33(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx);
}
vec3 lrCelular(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  float f1 = 8.0;
  float f2 = 8.0;
  float id = 0.0;
  for (int z = -1; z <= 1; z++)
    for (int y = -1; y <= 1; y++)
      for (int x = -1; x <= 1; x++) {
        vec3 g = vec3(float(x), float(y), float(z));
        vec3 o = lrHash33(i + g);
        vec3 r = g + o - f;
        float d = dot(r, r);
        if (d < f1) {
          f2 = f1;
          f1 = d;
          id = o.x + o.y * 0.37;
        } else if (d < f2) f2 = d;
      }
  return vec3(sqrt(f1), sqrt(f2), fract(id * 7.31));
}
`;

/**
 * Volume de ruído que se repete (para o fogo em volume): textura 3D RGBA de `tam` de lado, com quatro
 * ruídos de valor suaves e independentes. R, G e B têm 8 células por repetição; A tem 16 (detalhe).
 * Devolve só os bytes: quem usa monta a Data3DTexture.
 */
export function gerarVolumeDeRuido(tam: number, semente: number): Uint8Array {
  const rng = criarRng(semente);
  const dados = new Uint8Array(tam * tam * tam * 4);
  const periodos = [8, 8, 8, 16];
  for (let canal = 0; canal < 4; canal++) {
    const n = periodos[canal];
    const grade = new Float32Array(n * n * n);
    for (let i = 0; i < grade.length; i++) grade[i] = rng();
    const celula = tam / n;
    for (let z = 0; z < tam; z++) {
      const gz = z / celula;
      const z0 = Math.floor(gz);
      const fz = suave(gz - z0);
      const za = (z0 % n) * n * n;
      const zb = ((z0 + 1) % n) * n * n;
      for (let y = 0; y < tam; y++) {
        const gy = y / celula;
        const y0 = Math.floor(gy);
        const fy = suave(gy - y0);
        const ya = (y0 % n) * n;
        const yb = ((y0 + 1) % n) * n;
        for (let x = 0; x < tam; x++) {
          const gx = x / celula;
          const x0 = Math.floor(gx);
          const fx = suave(gx - x0);
          const xa = x0 % n;
          const xb = (x0 + 1) % n;
          const c00 = grade[za + ya + xa] + (grade[za + ya + xb] - grade[za + ya + xa]) * fx;
          const c10 = grade[za + yb + xa] + (grade[za + yb + xb] - grade[za + yb + xa]) * fx;
          const c01 = grade[zb + ya + xa] + (grade[zb + ya + xb] - grade[zb + ya + xa]) * fx;
          const c11 = grade[zb + yb + xa] + (grade[zb + yb + xb] - grade[zb + yb + xa]) * fx;
          const c0 = c00 + (c10 - c00) * fy;
          const c1 = c01 + (c11 - c01) * fy;
          dados[((z * tam + y) * tam + x) * 4 + canal] = Math.round((c0 + (c1 - c0) * fz) * 255);
        }
      }
    }
  }
  return dados;
}
