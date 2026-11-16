/**
 * Peças que se repetem nos presentes: laço de fita (o mesmo da árvore da sala), fita plana, folhas de
 * azevinho com bagas, esferas e caixas arredondadas (superelipsoides), argolas de arame.
 */
import * as THREE from 'three';
import { Malhador } from '../../kit/arvore/geometria';
import { faixa, type OpcoesLaco } from '../../kit/arvore/laco';
import { criarSorteio, fbm3 } from '../noel/util';
import { type Acab, type Cor, elipsoide, Molde } from './malha';

/** Acabamentos de uso comum. */
export const ACAB = {
  /** Latão dourado escovado (não espelha). */
  ouro: [1, 0.4, 0, 0] as Acab,
  ouroGasto: [1, 0.5, 0, 0] as Acab,
  /** Laca ou esmalte brilhante. */
  laca: [0, 0.32, 1, 0] as Acab,
  esmalte: [0, 0.38, 0.85, 0] as Acab,
  /** Tinta acetinada sobre madeira. */
  acetinado: [0, 0.5, 0.45, 0] as Acab,
  fosco: [0, 0.82, 0, 0] as Acab,
  rugoso: [0, 0.95, 0, 0] as Acab,
};

/** Cores de vértice (lineares) da paleta e dos tons derivados. */
const c = (hex: string): Cor => {
  const k = new THREE.Color(hex);
  return [k.r, k.g, k.b];
};
export const COR = {
  vermelho: c('#B62835'),
  vermelhoEscuro: c('#7e1420'),
  verde: c('#174D3B'),
  verdeClaro: c('#2a6b4f'),
  dourado: c('#E8BC65'),
  /** Cor de base do metal dourado (mais saturada e escura que o dourado da paleta: metal multiplica a luz). */
  ouro: c('#d6a24e'),
  neve: c('#F7F4EF'),
  creme: c('#efe3cc'),
  azul: c('#17253B'),
  branco: c('#ffffff'),
  carvao: c('#1a1614'),
  marrom: c('#5a3520'),
};

/**
 * Faixa de fita (como `faixa` da árvore, com a resolução escolhida): `cols` divisões na largura, bordas
 * dobradas para dentro (`bainha`) e pregas onde a fita é apertada.
 */
function faixaLeve(m: Malhador, caminho: THREE.Vector3[], lado: THREE.Vector3[], largura: (t: number) => number, ladrilho: number, cols: number, bico = 0, pregas?: (t: number) => number, bainha = 0) {
  const n = caminho.length;
  const inicio = m.vertices;
  const t = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const p = new THREE.Vector3();
  const nn = new THREE.Vector3();
  const k0 = bainha > 0 ? -1 : 0;
  const k1 = bainha > 0 ? cols + 1 : cols;
  let comp = 0;
  for (let i = 0; i < n; i++) {
    if (i > 0) comp += caminho[i].distanceTo(caminho[i - 1]);
    t.subVectors(caminho[Math.min(n - 1, i + 1)], caminho[Math.max(0, i - 1)]).normalize();
    normal.crossVectors(lado[i], t).normalize();
    const w = largura(i / (n - 1));
    for (let k = k0; k <= k1; k++) {
      const dobra = k < 0 || k > cols;
      const u = THREE.MathUtils.clamp(k, 0, cols) / cols - 0.5;
      let arco = (0.25 - u * u) * 0.24 * w;
      if (pregas) arco += Math.sin(u * 9.5 + 0.6) * 0.065 * w * pregas(i / (n - 1)) * (1 - 2 * Math.abs(u) * 0.3);
      p.copy(caminho[i]).addScaledVector(lado[i], u * w).addScaledVector(normal, arco);
      if (dobra) p.addScaledVector(normal, -bainha).addScaledVector(lado[i], -Math.sign(u) * bainha * 0.9);
      if (bico > 0 && i === n - 1) p.addScaledVector(t, -bico * (1 - Math.abs(u) * 2));
      nn.copy(normal).addScaledVector(lado[i], u * 0.9).normalize();
      m.vertice(p, nn, comp / ladrilho, (u * w) / ladrilho);
    }
  }
  const linha = k1 - k0 + 1;
  for (let i = 0; i < n - 1; i++)
    for (let k = 0; k < linha - 1; k++) {
      const a = inicio + i * linha + k;
      m.quad(a, a + 1, a + linha + 1, a + linha);
    }
}

/**
 * Laço de fita com volume (o desenho do laço da árvore da sala, src/world/kit/arvore/laco.ts, refeito com a
 * resolução ajustável `k`, para caber no orçamento dos presentes): duas alças cheias apertadas no nó (ou
 * quatro, com `duplo`), um nó e duas pontas caídas com corte em V. Nasce no plano XY, de frente para +Z,
 * com o nó na origem; `matriz` o leva ao lugar.
 */
export function laco(m: Molde, o: OpcoesLaco & { k?: number }, semente: number, matriz: THREE.Matrix4, cor: Cor, acab: Acab = ACAB.fosco) {
  const k = o.k ?? 1;
  const r = criarSorteio(semente);
  const L = o.largura;
  const fita = o.fita ?? L * 0.26;
  const ladrilho = o.ladrilho ?? 0.08;
  const local = new Malhador();
  const eixoZ = new THREE.Vector3(0, 0, 1);
  const cols = Math.max(4, Math.round(8 * k));
  const alcas: Array<[number, number, number]> = [
    [-1, 1, 0],
    [1, 1, 0],
  ];
  if (o.duplo) alcas.push([-1, 0.72, 0.6], [1, 0.72, 0.6]);
  for (const [s, tamanho, giro] of alcas) {
    const a = (L / 2) * (0.92 + 0.16 * r()) * tamanho;
    const b = a * (0.3 + 0.1 * r() + 0.25 * (o.cheio ?? 0));
    const sobe = 0.25 + 0.2 * r() - (o.queda ?? 0.3) * 0.6;
    const inclina = (o.inclina ?? 0.65) + (r() - 0.5) * 0.2;
    const fundoDir = new THREE.Vector3(0, Math.sin(inclina), Math.cos(inclina));
    const larguraDir = new THREE.Vector3(0, Math.cos(inclina), -Math.sin(inclina));
    const caminho: THREE.Vector3[] = [];
    const lado: THREE.Vector3[] = [];
    const passos = Math.max(10, Math.round(16 * k));
    for (let i = 0; i <= passos; i++) {
      const th = (i / passos) * Math.PI * 2;
      const x = (a * (1 - Math.cos(th))) / 2;
      const fundo = b * Math.sin(th) * (0.55 + 0.45 * Math.sin(th / 2));
      const y = x * sobe - (x / a) * (x / a) * a * (o.queda ?? 0.3) * 0.5;
      const p = new THREE.Vector3(s * x, y, b * 0.9 * Math.sin(th / 2)).addScaledVector(fundoDir, fundo);
      const abre = (x / a) * 0.28 * s;
      const l = larguraDir.clone().add(new THREE.Vector3(-abre, 0, 0)).normalize();
      if (giro) {
        p.applyAxisAngle(eixoZ, s * giro);
        l.applyAxisAngle(eixoZ, s * giro);
        p.z += b * 0.35;
      }
      caminho.push(p);
      lado.push(l);
    }
    faixaLeve(local, caminho, lado, (t) => fita * (0.42 + 0.63 * Math.sin(Math.PI * t)), ladrilho, cols, 0, (t) => Math.pow(1 - Math.sin(Math.PI * t), 1.5), fita * 0.045);
  }
  const pontas = o.pontas ?? 0.75;
  if (pontas > 0) {
    for (const s of [-1, 1]) {
      const comp = L * pontas * (0.85 + 0.3 * r());
      const abre = 0.28 + 0.3 * r();
      const onda = (r() - 0.5) * 0.5;
      const caminho: THREE.Vector3[] = [];
      const lado: THREE.Vector3[] = [];
      const passos = Math.max(5, Math.round(8 * k));
      for (let i = 0; i <= passos; i++) {
        const t = i / passos;
        const x = s * comp * abre * (t + 0.25 * t * t);
        const y = -comp * t * (1 - 0.12 * t) - 0.02 * L;
        const z = 0.05 * L + Math.sin(t * 5 + onda * 6) * 0.05 * L * t + 0.12 * L * t;
        caminho.push(new THREE.Vector3(x, y, z));
        lado.push(new THREE.Vector3(1, 0.25 * s * (1 - t), onda * t).normalize().multiplyScalar(-s));
      }
      faixaLeve(local, caminho, lado, (t) => fita * (0.5 + 0.45 * Math.min(1, t * 2.5)), ladrilho, Math.max(3, Math.round(cols * 0.6)), fita * 0.5, (t) => (1 - t) * (1 - t), fita * 0.045);
    }
  }
  // nó: uma volta de fita apertada
  {
    const no = new THREE.SphereGeometry(1, Math.max(8, Math.round(12 * k)), Math.max(6, Math.round(8 * k)));
    const mm = new THREE.Matrix4().makeScale(fita * 0.4, fita * 0.56, fita * 0.38).setPosition(0, 0, fita * 0.16);
    const uv = no.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * fita * 2) / ladrilho, (uv.getY(i) * fita) / ladrilho);
    local.juntar(no, mm);
    no.dispose();
  }
  const g = local.geometria();
  g.computeVertexNormals();
  m.juntar(g, matriz, cor, acab);
  g.dispose();
}

/**
 * Fita plana ao longo de pontos (com a direção da largura em cada ponto), com as bordas dobradas para
 * dentro (espessura de tecido).
 */
export function fitaPlana(m: Molde, caminho: THREE.Vector3[], lado: THREE.Vector3[], largura: number, cor: Cor, acab: Acab = ACAB.fosco, ladrilho = 0.1) {
  const malha = new Malhador();
  faixa(malha, caminho, lado, () => largura, ladrilho, new THREE.Color(1, 1, 1), 0, undefined, largura * 0.04);
  const g = malha.geometria();
  g.computeVertexNormals();
  m.juntar(g, undefined, cor, acab);
  g.dispose();
}

/** Esfera (ou elipsoide) simples. */
export function esfera(m: Molde, centro: THREE.Vector3, r: number, nu: number, nv: number, cor?: Cor, acab?: Acab, achatar: [number, number, number] = [1, 1, 1]) {
  m.adicionar({ nu, nv, ponto: elipsoide(centro, r * achatar[0], r * achatar[1], r * achatar[2]), cor: cor ? () => cor : undefined, acab: acab ? () => acab : undefined });
}

/**
 * Superelipsoide: caixa de cantos arredondados (expoente pequeno) ou bolha (expoente 1). Meias medidas
 * rx, ry, rz; `e` controla a quina (0,15 = caixa de cantos macios; 1 = elipsoide).
 */
export function superelipsoide(centro: THREE.Vector3, rx: number, ry: number, rz: number, e: number, deform?: (dir: THREE.Vector3) => number) {
  const pot = (x: number, k: number) => Math.sign(x) * Math.pow(Math.abs(x), k);
  const dir = new THREE.Vector3();
  return (u: number, v: number, out: THREE.Vector3) => {
    const th = u * Math.PI * 2;
    const ph = (v - 0.5) * Math.PI;
    const cph = Math.cos(ph);
    const x = pot(cph, e) * pot(Math.sin(th), e);
    const y = pot(Math.sin(ph), e);
    const z = pot(cph, e) * pot(Math.cos(th), e);
    dir.set(x, y, z);
    const k = 1 + (deform ? deform(dir) : 0);
    out.set(centro.x + x * rx * k, centro.y + y * ry * k, centro.z + z * rz * k);
  };
}

/**
 * Folha de azevinho: lâmina com a borda em pontas (cinco recortes de cada lado), dobrada na nervura e
 * arqueada, com espessura (duas faces). Nasce com o cabo na origem, apontando para +X, a face para +Z.
 */
export function folhaAzevinho(m: Molde, matriz: THREE.Matrix4, comprimento: number, cor: Cor, semente = 1) {
  const local = new Molde();
  const L = comprimento;
  const W = L * 0.36;
  const sorteio = criarSorteio(semente);
  const torto = (sorteio() - 0.5) * 0.3;
  local.adicionar({
    nu: 16,
    nv: 12,
    fechadoU: false,
    ponto(u, v, out) {
      // u: de uma borda à outra passando por cima (0 a 0,5) e por baixo (0,5 a 1) da lâmina
      const lado = u < 0.5 ? u * 2 : 2 - u * 2; // 0 na borda de baixo... 1 na outra borda
      const s = lado * 2 - 1; // -1 a 1 através da folha
      const x = v * L;
      // largura em gota com as pontas (dentes) da borda
      const perfil = Math.sin(Math.PI * Math.pow(v, 0.8)) * (1 - 0.15 * v);
      const dentes = 1 + 0.28 * Math.max(0, Math.sin(v * Math.PI * 5 + 0.4)) ** 3 - 0.12;
      const w = W * 0.5 * perfil * dentes;
      const y = s * w;
      // dobra na nervura (V) e arco ao longo
      const dobra = Math.abs(s) * w * 0.45;
      const arco = Math.sin(Math.PI * v) * L * 0.08 + torto * v * v * L * 0.3;
      const espessura = (u < 0.5 ? 1 : -1) * L * 0.012 * (1 - Math.abs(s) ** 4);
      out.set(x, y + torto * x * 0.2, dobra + arco + espessura);
    },
    acab: () => [0, 0.32, 0.9, 0],
    cor: (_u, v) => {
      const k = 0.85 + 0.25 * v;
      return [cor[0] * k, cor[1] * k, cor[2] * k];
    },
    orientar: 1,
  });
  m.absorver(local, matriz);
}

/** Bagas vermelhas (de azevinho) agrupadas em volta de um ponto. */
export function bagas(m: Molde, centro: THREE.Vector3, raio: number, n: number, semente: number, k = 1) {
  const s = criarSorteio(semente);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + s() * 0.5;
    const p = centro.clone().add(new THREE.Vector3(Math.cos(a) * raio * 0.95, Math.sin(a) * raio * 0.95, raio * 0.4 * s()));
    const tom = 0.85 + 0.2 * s();
    esfera(m, p, raio, Math.max(8, Math.round(12 * k)), Math.max(6, Math.round(8 * k)), [0.55 * tom, 0.02 * tom, 0.03 * tom], [0, 0.18, 1, 0]);
  }
}

/** Argola de arame (toro), no plano XY, centrada em `centro`. */
export function argola(m: Molde, centro: THREE.Vector3, R: number, r: number, cor: Cor, acab: Acab, giroY = 0, k = 1, uvFixo?: readonly [number, number]) {
  const g = new THREE.TorusGeometry(R, r, Math.max(6, Math.round(8 * k)), Math.max(12, Math.round(24 * k)));
  const mat = new THREE.Matrix4().makeRotationY(giroY).setPosition(centro);
  m.juntar(g, mat, cor, acab, uvFixo);
  g.dispose();
}

/** Ruído suave pronto para deformar superfícies (−1 a 1). */
export const ruido = (x: number, y: number, z: number, s = 0) => fbm3(x, y, z, 3, s);
