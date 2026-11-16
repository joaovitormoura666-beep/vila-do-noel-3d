/**
 * Marcenaria: gera peças de madeira com PERFIL (chanfros, rebaixos, molduras) varrendo uma seção
 * transversal ao longo de um caminho plano, com as quinas em meia-esquadria. É o que tira da janela
 * a cara de "caixas": cada montante, travessa e moldura tem seção de verdade.
 *
 * Convenções: o caminho fica no plano XY (x para a direita, y para cima). O perfil é um polígono
 * anti-horário em (a, z): `a` é o afastamento para a ESQUERDA do sentido do caminho (em um contorno
 * anti-horário, a esquerda é o lado de dentro) e `z` é a profundidade (z positivo = lado da sala).
 * As UV correm com o `u` ao longo do caminho (o veio da madeira acompanha a peça).
 */
import * as THREE from 'three';

export type Ponto2 = [number, number];

export interface VarrerOpcoes {
  /** Caminho fechado (contorno) ou aberto (com tampas nas pontas). */
  fechado?: boolean;
  /** Tamanho real do ladrilho da textura, em metros. */
  ladrilho?: number;
  /** Deslocamento das UV, para peças vizinhas não repetirem o mesmo veio. */
  uvU?: number;
  uvV?: number;
  /** Sem tampas nas pontas de um caminho aberto (quando ficam escondidas dentro de outra peça). */
  semTampas?: boolean;
  /** Ângulo (graus) abaixo do qual duas faces vizinhas do perfil são alisadas juntas. Padrão 50. */
  alisar?: number;
}

/** Arredonda as quinas de um polígono (perfil): cada quina vira `segmentos` faces. `raio` pode ser por vértice. */
export function arredondar(pol: Ponto2[], raio: number | number[], segmentos = 2): Ponto2[] {
  const n = pol.length;
  const out: Ponto2[] = [];
  for (let i = 0; i < n; i++) {
    const r = typeof raio === 'number' ? raio : (raio[i] ?? 0);
    const p = pol[i];
    if (r <= 0) {
      out.push(p);
      continue;
    }
    const a = pol[(i + n - 1) % n];
    const b = pol[(i + 1) % n];
    const da: Ponto2 = [a[0] - p[0], a[1] - p[1]];
    const db: Ponto2 = [b[0] - p[0], b[1] - p[1]];
    const la = Math.hypot(da[0], da[1]);
    const lb = Math.hypot(db[0], db[1]);
    const rr = Math.min(r, la * 0.45, lb * 0.45);
    const pa: Ponto2 = [p[0] + (da[0] / la) * rr, p[1] + (da[1] / la) * rr];
    const pb: Ponto2 = [p[0] + (db[0] / lb) * rr, p[1] + (db[1] / lb) * rr];
    // curva de Bézier quadrática entre pa e pb com controle na quina
    for (let s = 0; s <= segmentos; s++) {
      const t = s / segmentos;
      const u = 1 - t;
      out.push([u * u * pa[0] + 2 * u * t * p[0] + t * t * pb[0], u * u * pa[1] + 2 * u * t * p[1] + t * t * pb[1]]);
    }
  }
  return out;
}

/** Varre o perfil ao longo do caminho. Devolve geometria não indexada com posição, normal e uv. */
export function varrerPerfil(caminho: THREE.Vector2[], perfil: Ponto2[], op: VarrerOpcoes = {}): THREE.BufferGeometry {
  const fechado = op.fechado ?? false;
  const ladrilho = op.ladrilho ?? 1.4;
  const n = caminho.length;
  const m = perfil.length;
  const cosAlisar = Math.cos(THREE.MathUtils.degToRad(op.alisar ?? 50));
  const nSeg = fechado ? n : n - 1;

  // direção e normal (à esquerda) de cada trecho
  const dir: THREE.Vector2[] = [];
  const nor: THREE.Vector2[] = [];
  const comp: number[] = [];
  for (let i = 0; i < nSeg; i++) {
    const d = caminho[(i + 1) % n].clone().sub(caminho[i]);
    comp.push(d.length());
    d.normalize();
    dir.push(d);
    nor.push(new THREE.Vector2(-d.y, d.x));
  }
  // meia-esquadria em cada vértice do caminho
  const mitra: THREE.Vector2[] = [];
  const suaveAqui: boolean[] = [];
  for (let i = 0; i < n; i++) {
    const antes = fechado ? (i + nSeg - 1) % nSeg : i - 1;
    const depois = fechado ? i % nSeg : i;
    const n0 = antes >= 0 && antes < nSeg ? nor[antes] : nor[depois];
    const n1 = depois < nSeg ? nor[depois] : nor[antes];
    const soma = n0.clone().add(n1);
    if (soma.lengthSq() < 1e-8) soma.copy(n0);
    soma.normalize();
    const c = Math.max(0.2, soma.dot(n0));
    mitra.push(soma.clone().multiplyScalar(1 / c));
    suaveAqui.push(n0.dot(n1) > 0.86); // quinas abertas (arco) recebem normal contínua
  }
  // distância acumulada ao longo do caminho, para as UV
  const acum: number[] = [0];
  for (let i = 0; i < nSeg; i++) acum.push(acum[i] + comp[i]);

  // normais do perfil: uma por face, alisadas entre faces quase alinhadas
  const faceN: Ponto2[] = [];
  const perim: number[] = [0];
  for (let j = 0; j < m; j++) {
    const p = perfil[j];
    const q = perfil[(j + 1) % m];
    const da = q[0] - p[0];
    const dz = q[1] - p[1];
    const l = Math.hypot(da, dz) || 1;
    faceN.push([dz / l, -da / l]);
    perim.push(perim[j] + l);
  }
  const normalNoVertice = (face: number, vert: number): Ponto2 => {
    // vert é o índice do vértice do perfil (início ou fim da face)
    const outra = vert === face ? (face + m - 1) % m : (face + 1) % m;
    const a = faceN[face];
    const b = faceN[outra];
    if (a[0] * b[0] + a[1] * b[1] > cosAlisar) {
      const sx = a[0] + b[0];
      const sz = a[1] + b[1];
      const l = Math.hypot(sx, sz) || 1;
      return [sx / l, sz / l];
    }
    return a;
  };

  const pos: number[] = [];
  const norm: number[] = [];
  const uv: number[] = [];
  const ponto = (i: number, j: number): [number, number, number] => {
    const c = caminho[i % n];
    const mt = mitra[i % n];
    const p = perfil[j % m];
    return [c.x + mt.x * p[0], c.y + mt.y * p[0], p[1]];
  };
  // peças: cada quina viva é uma emenda em meia-esquadria e os trechos curvos (arco) são feitos de
  // aduelas, cada uma tirada de uma tábua reta. Em cada peça o veio corre reto ao longo da corda dela
  // e começa em outro ponto da textura: a emenda aparece como na marcenaria de verdade.
  const pecaDoTrecho: number[] = [];
  {
    let peca = 0;
    let giro = 0;
    for (let sgm = 0; sgm < nSeg; sgm++) {
      if (sgm > 0) {
        if (!suaveAqui[sgm]) {
          peca++;
          giro = 0;
        } else {
          giro += Math.acos(Math.min(1, dir[sgm - 1].dot(dir[sgm])));
          if (giro > 0.42) {
            peca++;
            giro = 0;
          }
        }
      }
      pecaDoTrecho.push(peca);
    }
  }
  const cordas = new Map<number, { o: THREE.Vector2; d: THREE.Vector2; du: number; dv: number }>();
  for (let sgm = 0; sgm < nSeg; sgm++) {
    const pc = pecaDoTrecho[sgm];
    let fim = sgm;
    while (fim + 1 < nSeg && pecaDoTrecho[fim + 1] === pc) fim++;
    if (!cordas.has(pc)) {
      const o = caminho[sgm].clone();
      const d = caminho[(fim + 1) % n].clone().sub(o).normalize();
      const h = Math.sin((pc + 1) * 12.9898 + (op.uvU ?? 0) * 78.233) * 43758.5453;
      const acaso = h - Math.floor(h);
      cordas.set(pc, { o, d, du: acaso * 5.3, dv: acaso * 3.1 });
    }
  }
  const vert = (i: number, seg: number, j: number, face: number) => {
    const P = ponto(i, j);
    pos.push(P[0], P[1], P[2]);
    const pn = normalNoVertice(face, j % m);
    const base = suaveAqui[i % n] ? mitra[i % n].clone().normalize() : nor[seg];
    const v3 = new THREE.Vector3(base.x * pn[0], base.y * pn[0], pn[1]).normalize();
    norm.push(v3.x, v3.y, v3.z);
    // v acompanha o perímetro do perfil; u corre ao longo da corda da peça
    const jv = j === face ? perim[face] : perim[face + 1];
    const cd = cordas.get(pecaDoTrecho[seg])!;
    const c = caminho[i % n];
    const rx = c.x - cd.o.x;
    const ry = c.y - cd.o.y;
    const u = rx * cd.d.x + ry * cd.d.y;
    const w = cd.d.x * ry - cd.d.y * rx;
    uv.push(u / ladrilho + (op.uvU ?? 0) + cd.du, (jv + w) / ladrilho + (op.uvV ?? 0) + cd.dv);
  };
  for (let s = 0; s < nSeg; s++) {
    const i0 = s;
    const i1 = s + 1;
    for (let j = 0; j < m; j++) {
      const j1 = j + 1;
      // A (i0, j) B (i0, j1) C (i1, j1) D (i1, j): triângulos ABC e ACD ficam virados para fora
      vert(i0, s, j, j);
      vert(i0, s, j1, j);
      vert(i1, s, j1, j);
      vert(i0, s, j, j);
      vert(i1, s, j1, j);
      vert(i1, s, j, j);
    }
  }
  if (!fechado && !op.semTampas) {
    const contorno = perfil.map((p) => new THREE.Vector2(p[0], p[1]));
    const tris = THREE.ShapeUtils.triangulateShape(contorno, []);
    const tampa = (i: number, seg: number, frente: boolean) => {
      const d = dir[seg];
      for (const t of tris) {
        const ordem = frente ? [t[0], t[1], t[2]] : [t[0], t[2], t[1]];
        for (const j of ordem) {
          const P = ponto(i, j);
          pos.push(P[0], P[1], P[2]);
          norm.push(frente ? d.x : -d.x, frente ? d.y : -d.y, 0);
          uv.push(perfil[j][0] / ladrilho + (op.uvU ?? 0), perfil[j][1] / ladrilho + (op.uvV ?? 0));
        }
      }
    };
    tampa(0, 0, false);
    tampa(n - 1, nSeg - 1, true);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}

/** Peça reta entre dois pontos do plano XY, com o perfil dado (tampas opcionais). */
export function barra(de: THREE.Vector2, ate: THREE.Vector2, perfil: Ponto2[], op: VarrerOpcoes = {}): THREE.BufferGeometry {
  return varrerPerfil([de, ate], perfil, { ...op, fechado: false });
}

export interface FormaVao {
  largura: number;
  altura: number;
  base: number;
  /** Flecha do arco (0 = verga reta). */
  flecha: number;
}

/**
 * Contorno de um vão (reto ou com arco abatido no topo), anti-horário, começando no canto de baixo à
 * direita. `recuo` encolhe o contorno para dentro (para as peças que ficam dentro do vão).
 * Com `aberto`, não repete o trecho de baixo (serve para guarnição e forro, que param no peitoril).
 */
export function contornoVao(v: FormaVao, recuo = 0, segmentosArco = 28): THREE.Vector2[] {
  const meia = v.largura / 2 - recuo;
  const y0 = v.base + recuo;
  const topo = v.base + v.altura - recuo;
  const pts: THREE.Vector2[] = [new THREE.Vector2(meia, y0)];
  if (v.flecha <= 0.001) {
    pts.push(new THREE.Vector2(meia, topo), new THREE.Vector2(-meia, topo));
  } else {
    // arco de círculo que passa pelos dois apoios e pelo ponto mais alto (com o recuo, o raio encolhe)
    const meia0 = v.largura / 2;
    const raio0 = (meia0 * meia0 + v.flecha * v.flecha) / (2 * v.flecha);
    const cy = v.base + v.altura - raio0;
    const raio = raio0 - recuo;
    const ang = Math.asin(limite(meia / raio));
    for (let i = 0; i <= segmentosArco; i++) {
      const a = ang - (2 * ang * i) / segmentosArco;
      pts.push(new THREE.Vector2(Math.sin(a) * raio, cy + Math.cos(a) * raio));
    }
  }
  pts.push(new THREE.Vector2(-meia, y0));
  return pts;
}

const limite = (x: number) => Math.min(1, Math.max(-1, x));

/** Altura do topo do vão (por dentro, com recuo) em uma posição x. */
export function topoDoVao(v: FormaVao, x: number, recuo = 0): number {
  if (v.flecha <= 0.001) return v.base + v.altura - recuo;
  const meia0 = v.largura / 2;
  const raio0 = (meia0 * meia0 + v.flecha * v.flecha) / (2 * v.flecha);
  const cy = v.base + v.altura - raio0;
  const raio = raio0 - recuo;
  return cy + Math.sqrt(Math.max(0, raio * raio - x * x));
}
