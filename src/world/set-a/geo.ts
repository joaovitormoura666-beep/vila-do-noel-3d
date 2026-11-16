/**
 * Ferramentas de geometria da sala A: caixas de aresta arredondada, perfis varridos em linha reta,
 * mapeamento de textura em metros (repeat = 1 / ladrilho no material) e cor por vértice.
 * Tudo sai sem índice e com os mesmos atributos (position, normal, uv, color), pronto para fundir.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export type Eixo = 'x' | 'y' | 'z';
export type Sorteio = () => number;

/** Gerador com semente (mulberry32): a sala sai igual em toda foto. */
export function criarSorteio(semente: number): Sorteio {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const entre = (r: Sorteio, a: number, b: number) => a + (b - a) * r();

/** Ruído de valor 2D suave e determinístico, de 0 a 1 (manchas de cera, sujeira). */
export function ruido2(x: number, y: number, sal = 0): number {
  const h = (i: number, j: number) => {
    let n = (i * 374761393 + j * 668265263 + sal * 1442695041) | 0;
    n = (n ^ (n >>> 13)) * 1274126177;
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  };
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = h(x0, y0) + (h(x0 + 1, y0) - h(x0, y0)) * sx;
  const b = h(x0, y0 + 1) + (h(x0 + 1, y0 + 1) - h(x0, y0 + 1)) * sx;
  return a + (b - a) * sy;
}

const IDX: Record<Eixo, number> = { x: 0, y: 1, z: 2 };

/** Garante geometria sem índice e com o atributo de cor (branco). */
export function preparar(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (g !== geo) geo.dispose();
  if (!g.getAttribute('normal')) g.computeVertexNormals();
  const n = g.getAttribute('position').count;
  if (!g.getAttribute('color')) g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(n * 3).fill(1), 3));
  if (!g.getAttribute('uv')) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
  // só os quatro atributos comuns (para poder fundir)
  for (const nome of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(nome)) g.deleteAttribute(nome);
  return g;
}

export interface UvOpcoes {
  /** Eixo do veio da madeira (o comprimento da peça). */
  veio?: Eixo;
  /** A textura tem o veio na vertical (V)? Senão, na horizontal (U). */
  veioEmV?: boolean;
  /** Deslocamento em metros, para peças vizinhas não mostrarem o mesmo trecho da textura. */
  du?: number;
  dv?: number;
  /** Escala extra (1 = metros). */
  escala?: number;
}

/**
 * UV por face, em metros: cada triângulo é projetado no plano do eixo dominante da sua normal.
 * O veio da textura acompanha `veio` nas faces compridas; nos topos, usa os dois outros eixos.
 */
export function uvPorFace(geo: THREE.BufferGeometry, o: UvOpcoes = {}): THREE.BufferGeometry {
  const pos = geo.getAttribute('position');
  const uv = geo.getAttribute('uv');
  const veio = IDX[o.veio ?? 'x'];
  const s = o.escala ?? 1;
  const du = o.du ?? 0;
  const dv = o.dv ?? 0;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const n = new THREE.Vector3();
  const p = [0, 0, 0];
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1);
    c.fromBufferAttribute(pos, i + 2);
    n.subVectors(b, a).cross(c.sub(a));
    const ax = Math.abs(n.x);
    const ay = Math.abs(n.y);
    const az = Math.abs(n.z);
    const dom = ax >= ay && ax >= az ? 0 : ay >= az ? 1 : 2;
    const outros = [0, 1, 2].filter((k) => k !== dom);
    // g = coordenada ao longo do veio; t = a outra
    let ig = outros[0];
    let it = outros[1];
    if (outros[1] === veio) {
      ig = outros[1];
      it = outros[0];
    }
    for (let k = 0; k < 3; k++) {
      p[0] = pos.getX(i + k);
      p[1] = pos.getY(i + k);
      p[2] = pos.getZ(i + k);
      const g = p[ig] * s;
      const t = p[it] * s;
      if (o.veioEmV) uv.setXY(i + k, t + du, g + dv);
      else uv.setXY(i + k, g + du, t + dv);
    }
  }
  uv.needsUpdate = true;
  return geo;
}

/** Multiplica a cor de vértice de toda a geometria. */
export function tingir(geo: THREE.BufferGeometry, r: number, g = r, b = r): THREE.BufferGeometry {
  const cor = geo.getAttribute('color');
  for (let i = 0; i < cor.count; i++) cor.setXYZ(i, cor.getX(i) * r, cor.getY(i) * g, cor.getZ(i) * b);
  return geo;
}

/** Cor de vértice calculada ponto a ponto (sujeira, escurecimento perto do chão ou do teto). */
export function tingirPor(geo: THREE.BufferGeometry, f: (x: number, y: number, z: number) => number): THREE.BufferGeometry {
  const cor = geo.getAttribute('color');
  const pos = geo.getAttribute('position');
  for (let i = 0; i < cor.count; i++) {
    const k = f(pos.getX(i), pos.getY(i), pos.getZ(i));
    cor.setXYZ(i, cor.getX(i) * k, cor.getY(i) * k, cor.getZ(i) * k);
  }
  return geo;
}

/** Caixa com as arestas arredondadas (o filete de luz na quina), centrada na origem. */
export function caixa(w: number, h: number, d: number, raio = 0.012, segmentos = 2): THREE.BufferGeometry {
  const r = Math.min(raio, w * 0.45, h * 0.45, d * 0.45);
  return preparar(new RoundedBoxGeometry(w, h, d, segmentos, r));
}

/**
 * Peça de madeira comprida (tábua, viga, pilar, ripa) ao longo de um eixo, com UV em metros e um trecho
 * sorteado da textura. `veioEmV` conforme a textura (tábuas desenhadas na vertical ou na horizontal).
 */
export function pecaDeMadeira(w: number, h: number, d: number, veio: Eixo, r: Sorteio, o: { raio?: number; veioEmV?: boolean; escala?: number } = {}): THREE.BufferGeometry {
  const g = caixa(w, h, d, o.raio ?? 0.012);
  uvPorFace(g, { veio, veioEmV: o.veioEmV, du: r() * 7.3, dv: r() * 5.1, escala: o.escala });
  return g;
}

/** Emendas entre as tábuas da textura wood_trunk_wall, em fração do ladrilho (medidas no mapa de oclusão). */
const EMENDAS_TRONCO = [-0.008, 0.134, 0.288, 0.42, 0.5615, 0.707, 0.8486, 0.992];
/** Emendas entre as tábuas da textura old_planks_02, em fração do ladrilho. */
export const EMENDAS_LAMBRI = [0.016, 0.157, 0.308, 0.45, 0.591, 0.734, 0.873, 1.016];

/**
 * Viga ou pilar com UMA tábua da textura por face (wood_trunk_wall tem sete tábuas lado a lado, com o veio em V):
 * cada face comprida mostra uma tábua inteira, esticada na largura da face e na mesma proporção no comprimento,
 * de modo que nenhuma emenda da textura risca a viga.
 */
export function vigaDeUmaTora(w: number, h: number, d: number, veio: Eixo, r: Sorteio, o: { raio?: number; ladrilho?: number } = {}): THREE.BufferGeometry {
  const g = caixa(w, h, d, o.raio ?? 0.02, 3);
  const ladrilho = o.ladrilho ?? 1.25;
  const dim = [w, h, d];
  const iv = IDX[veio];
  const pos = g.getAttribute('position');
  const uv = g.getAttribute('uv');
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const n = new THREE.Vector3();
  // uma tábua e um trecho sorteados para cada uma das seis direções de face
  const faixaDe = [0, 1, 2, 3, 4, 5].map(() => Math.floor(r() * (EMENDAS_TRONCO.length - 1)));
  const trecho = [0, 1, 2, 3, 4, 5].map(() => r() * ladrilho);
  const p = [0, 0, 0];
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1);
    c.fromBufferAttribute(pos, i + 2);
    n.subVectors(b, a).cross(c.sub(a));
    const abs = [Math.abs(n.x), Math.abs(n.y), Math.abs(n.z)];
    const dom = abs[0] >= abs[1] && abs[0] >= abs[2] ? 0 : abs[1] >= abs[2] ? 1 : 2;
    const lado = dom * 2 + (n.getComponent(dom) > 0 ? 1 : 0);
    const outros = [0, 1, 2].filter((k) => k !== dom);
    const it = outros[0] === iv ? outros[1] : outros[0]; // eixo atravessado
    const ig = dom === iv ? outros[1] : iv; // eixo do veio (nos topos, qualquer um)
    const largura = dim[it];
    const u0 = (EMENDAS_TRONCO[faixaDe[lado]] + 0.012) * ladrilho;
    const u1 = (EMENDAS_TRONCO[faixaDe[lado] + 1] - 0.012) * ladrilho;
    const esc = (u1 - u0) / largura;
    for (let k = 0; k < 3; k++) {
      p[0] = pos.getX(i + k);
      p[1] = pos.getY(i + k);
      p[2] = pos.getZ(i + k);
      const t = p[it] / largura + 0.5; // 0..1 através da face
      uv.setXY(i + k, u0 + (u1 - u0) * t, p[ig] * esc + trecho[lado]);
    }
  }
  return g;
}

/**
 * Perfil 2D (pontos em metros, no plano XY) varrido em linha reta ao longo de +Z por `comprimento`.
 * Serve para rodapé, moldura do lambri, cimalha. UV em metros com o veio ao longo do comprimento.
 */
export function perfilReto(pontos: Array<[number, number]>, comprimento: number, r: Sorteio, veioEmV = false): THREE.BufferGeometry {
  const forma = new THREE.Shape(pontos.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = preparar(new THREE.ExtrudeGeometry(forma, { depth: comprimento, bevelEnabled: false }));
  uvPorFace(g, { veio: 'z', veioEmV, du: r() * 3.1, dv: r() * 2.7 });
  return g;
}

/** Move e gira uma geometria (giro em Y, depois translação). */
export function colocar(g: THREE.BufferGeometry, x: number, y: number, z: number, giroY = 0): THREE.BufferGeometry {
  if (giroY) g.rotateY(giroY);
  g.translate(x, y, z);
  return g;
}

/** Funde as peças de um mesmo material em uma geometria só (uma chamada de desenho). */
export function fundir(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const prontas = geos.map(preparar);
  const g = mergeGeometries(prontas, false);
  for (const p of prontas) p.dispose();
  if (!g) throw new Error('não foi possível fundir as geometrias da sala');
  return g;
}
