/**
 * O pé da árvore: saia de veludo franzida junto ao tronco, com pregas largas e irregulares e barra de
 * pelúcia; e poucos presentes embrulhados com cara de papel de verdade (cantos levemente arredondados,
 * faces um nada abauladas, vincos, dobras nas laterais, fita de cetim com espessura e laço volumoso).
 * A zona debaixo da copa é a mais escura do quadro: a sombra que a luz da árvore não projeta vem pintada
 * em cor de vértice (saia e presentes escurecem para o tronco).
 */
import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Malhador } from './geometria';
import { faixa, juntarLaco } from './laco';
import { normalDePapel, normalDePelucia, papeisDePresente, type PapelDef } from './texturas';
import { criarSorteio, suave, type Sorteio } from './util';

export interface TexturasDeTecido {
  cor: THREE.Texture;
  normal: THREE.Texture;
}

/** Ruído suave e periódico em volta de um círculo (de -1 a 1), sem repetição evidente. */
function ruidoCircular(r: Sorteio, celulas: number): (a: number) => number {
  const v: number[] = [];
  for (let i = 0; i < celulas; i++) v.push(r() * 2 - 1);
  return (a: number) => {
    const f = (((a / (Math.PI * 2)) % 1) + 1) % 1 * celulas;
    const i = Math.floor(f);
    const t = f - i;
    const s = t * t * (3 - 2 * t);
    return v[i % celulas] + (v[(i + 1) % celulas] - v[i % celulas]) * s;
  };
}

/** Saia de árvore: um pano redondo de veludo caído no chão, franzido em volta do tronco. */
export function criarSaia(raio: number, veludo: TexturasDeTecido, r: Sorteio, k: number) {
  const grupo = new THREE.Group();
  grupo.name = 'saia';
  const voltas = 192;
  const aneis = 26;
  const n5 = ruidoCircular(r, 9);
  const n8 = ruidoCircular(r, 15);
  const n13 = ruidoCircular(r, 24);
  const n9 = ruidoCircular(r, 9);
  const n4 = ruidoCircular(r, 4);
  const n31 = ruidoCircular(r, 31);
  const torce = r() * 6.28;
  const borda = (a: number) => raio * (1 + 0.05 * n4(a) + 0.022 * n9(a + 1));
  /** Crista das pregas (0 a 1): duas ou três ondas largas e desiguais que serpenteiam ao longo do raio. */
  const crista = (a: number, t: number) => {
    // pano mole: ondas largas e arredondadas que nascem no franzido do colar e abrem em leque até a barra,
    // serpenteando um pouco (dois ruídos somados, sem cristas vivas: veludo pesado não faz vinco)
    const onda = n8(a + 0.1 * Math.sin(t * 3.2 + torce) - 0.05 * t) + 0.45 * n13(a + 0.06 * t);
    const macia = THREE.MathUtils.smoothstep(onda, -0.55, 0.85);
    const larga = THREE.MathUtils.clamp(0.5 + 0.7 * n5(a + 0.12 * t), 0, 1);
    return THREE.MathUtils.clamp(0.75 * macia * (0.5 + 0.5 * larga) + 0.25 * larga * larga, 0, 1);
  };
  const gomos = (a: number) => 0.5 + 0.5 * n9(a);
  const altura = (rr: number, a: number, t: number) => {
    // junto ao tronco o pano sobe franzido em gomos irregulares; depois deita no chão
    const colar = 0.06 * k * Math.exp(-(((rr - 0.07 * k) / (0.2 * k)) ** 2)) * (0.25 + 0.75 * gomos(a));
    // as pregas crescem até dois terços do raio e assentam um pouco na barra
    const forca = suave(0.04, 0.5, t) * (1 - 0.35 * suave(0.8, 1, t));
    return 0.008 + colar + 0.1 * k * crista(a, t) * forca;
  };
  const m = new Malhador();
  const cima = new THREE.Vector3(0, 1, 0);
  const p = new THREE.Vector3();
  const cor = new THREE.Color();
  for (let j = 0; j <= aneis; j++)
    for (let i = 0; i <= voltas; i++) {
      const a = (i / voltas) * Math.PI * 2;
      const t = j / aneis;
      const rin = 0.07 * k * (1 + 0.14 * gomos(a));
      const rr = rin + (borda(a) - rin) * Math.pow(t, 1.12);
      p.set(Math.cos(a) * rr, altura(rr, a, t), Math.sin(a) * rr);
      // oclusão pintada: escuro debaixo da copa e no fundo das pregas; claro só nas cristas perto da borda
      const sombra = (0.5 + 0.5 * suave(0.1, 0.9, t)) * (0.62 + 0.38 * crista(a, t));
      cor.setScalar(sombra);
      m.vertice(p, cima, p.x / 0.28, p.z / 0.28, cor);
    }
  const linha = voltas + 1;
  for (let j = 0; j < aneis; j++)
    for (let i = 0; i < voltas; i++) {
      const a = j * linha + i;
      m.quad(a, a + linha, a + linha + 1, a + 1);
    }
  const geo = m.geometria();
  geo.computeVertexNormals();
  costurar(geo, linha, aneis + 1, voltas);
  // veludo fundo: quase sem brilho de frente; o claro aparece só no rasante das cristas (o pelo do tecido)
  const mat = new THREE.MeshPhysicalMaterial({
    map: veludo.cor,
    normalMap: veludo.normal,
    normalScale: new THREE.Vector2(1.5, 1.5),
    color: '#9a7a5e',
    roughness: 0.95,
    // veludo quase não tem reflexo especular: o claro dele é o sheen (o pelo). Sem isto, a luz rasante
    // vira um véu branco que deixa o pano rosa-salmão
    specularIntensity: 0.25,
    sheen: 0.85,
    sheenColor: new THREE.Color('#c4505a'),
    sheenRoughness: 0.5,
    vertexColors: true,
    side: THREE.DoubleSide,
  });
  const saia = new THREE.Mesh(geo, mat);
  saia.name = 'saia-de-veludo';
  saia.receiveShadow = true;
  // a sombra que o pano faz em si mesmo (pregas contra a luz rasante) é o que o deixa com cara de veludo
  // pesado na penumbra da copa; sem ela o pano vira vermelho-tomate chapado
  saia.castShadow = true;
  grupo.add(saia);

  // barra de pelúcia: um rolo grosso e irregular que acompanha a borda e assenta no chão
  const barra = new Malhador();
  const lados = 8;
  const centro = new THREE.Vector3();
  const nn = new THREE.Vector3();
  const claro = new THREE.Color(1, 1, 1);
  for (let i = 0; i <= voltas; i++) {
    const a = (i / voltas) * Math.PI * 2;
    const rr = borda(a);
    const raioTubo = 0.033 * k * (1 + 0.12 * n31(a) + 0.06 * n13(a * 2));
    centro.set(Math.cos(a) * rr, altura(rr, a, 1) + raioTubo * 0.55, Math.sin(a) * rr);
    for (let s = 0; s <= lados; s++) {
      const b = (s / lados) * Math.PI * 2;
      nn.set(Math.cos(a) * Math.cos(b), Math.sin(b), Math.sin(a) * Math.cos(b));
      p.copy(centro).addScaledVector(nn, raioTubo);
      if (p.y < 0.002) p.y = 0.002;
      barra.vertice(p, nn, (a * raio) / 0.09, s / lados, claro);
    }
  }
  const linhaB = lados + 1;
  for (let i = 0; i < voltas; i++)
    for (let s = 0; s < lados; s++) {
      const a = i * linhaB + s;
      barra.quad(a, a + 1, a + linhaB + 1, a + linhaB);
    }
  const barraGeo = barra.geometria();
  const pelo = normalDePelucia();
  pelo.repeat.set(1, 2);
  const barraMat = new THREE.MeshPhysicalMaterial({
    color: '#a3977f',
    roughness: 1,
    normalMap: pelo,
    normalScale: new THREE.Vector2(0.55, 0.55),
    sheen: 1,
    sheenColor: new THREE.Color('#efe6d2'),
    sheenRoughness: 0.6,
  });
  const barraMalha = new THREE.Mesh(barraGeo, barraMat);
  barraMalha.name = 'barra-da-saia';
  barraMalha.receiveShadow = true;
  barraMalha.castShadow = false;
  grupo.add(barraMalha);

  const corPano = mat.color.clone();
  const brilhoPano = mat.sheenColor.clone();
  const corBarra = barraMat.color.clone();
  const brilhoBarra = barraMat.sheenColor.clone();
  return {
    grupo,
    /** Escurece o pano (1 = como está): usado no nível baixo, que não tem a sombra da copa. */
    setPenumbra(v: number) {
      // o brilho rasante do veludo também fica na penumbra (senão o pano vira rosa-salmão sob a luz quente)
      mat.color.copy(corPano).multiplyScalar(v);
      mat.sheenColor.copy(brilhoPano).multiplyScalar(v);
      mat.specularIntensity = 0.25 * v;
      barraMat.color.copy(corBarra).multiplyScalar(0.5 + 0.5 * v);
      barraMat.sheenColor.copy(brilhoBarra).multiplyScalar(0.5 + 0.5 * v);
    },
    dispose() {
      geo.dispose();
      mat.dispose();
      barraGeo.dispose();
      barraMat.dispose();
      pelo.dispose();
    },
  };
}

/** Iguala as normais das duas colunas que fecham uma malha em anel (i = 0 e i = voltas). */
function costurar(geo: THREE.BufferGeometry, linha: number, linhas: number, voltas: number) {
  const nor = geo.getAttribute('normal');
  for (let j = 0; j < linhas; j++) {
    const a = j * linha;
    const b = a + voltas;
    const x = nor.getX(a) + nor.getX(b);
    const y = nor.getY(a) + nor.getY(b);
    const z = nor.getZ(a) + nor.getZ(b);
    const l = Math.hypot(x, y, z) || 1;
    nor.setXYZ(a, x / l, y / l, z / l);
    nor.setXYZ(b, x / l, y / l, z / l);
  }
}

/** Papéis de embrulho (camadas da textura): tons contidos da paleta, nenhum claro demais. */
const PAPEIS: PapelDef[] = [
  { estampa: 'kraft', fundo: '#86643f', figura: '#d9c8a2' },
  { estampa: 'liso', fundo: '#671520', figura: '#000000' },
  { estampa: 'listras', fundo: '#94876e', figura: '#1a4534' },
  { estampa: 'bolinhas', fundo: '#1a4d3b', figura: '#a39577' },
  { estampa: 'xadrez', fundo: '#93866c', figura: '#8a1e28' },
];

interface PresenteDef {
  /** largura (x), altura (y), profundidade (z), em metros */
  tam: [number, number, number];
  /** Índice em PAPEIS. */
  papel: number;
  /** Brilho do papel: 0,45 = papel acetinado; 0,85 = pardo fosco. */
  rugosidade: number;
  fita: string;
  /** Ângulo em volta da árvore (0 = frente, +Z), distância do tronco, giro próprio. */
  angulo: number;
  distancia: number;
  giro: number;
  /** Índice do presente que serve de base (empilhado), ou -1 no chão. */
  sobre: number;
}

const FITA_VERMELHA = '#7c1a22';
const FITA_DOURADA = '#a8813a';
const FITA_VERDE = '#1c5440';

const PRESENTES: PresenteDef[] = [
  { tam: [0.52, 0.2, 0.36], papel: 0, rugosidade: 0.82, fita: FITA_VERMELHA, angulo: 0.5, distancia: 1.16, giro: 0.3, sobre: -1 },
  { tam: [0.3, 0.34, 0.3], papel: 1, rugosidade: 0.4, fita: FITA_DOURADA, angulo: -0.52, distancia: 1.12, giro: -0.3, sobre: -1 },
  { tam: [0.36, 0.25, 0.27], papel: 2, rugosidade: 0.55, fita: FITA_VERMELHA, angulo: 1.28, distancia: 1.14, giro: 0.9, sobre: -1 },
  { tam: [0.2, 0.15, 0.2], papel: 3, rugosidade: 0.5, fita: FITA_DOURADA, angulo: 0, distancia: 0, giro: 0.5, sobre: 0 },
  { tam: [0.44, 0.13, 0.19], papel: 4, rugosidade: 0.58, fita: FITA_VERDE, angulo: -1.3, distancia: 1.16, giro: -1.0, sobre: -1 },
];

/**
 * Caixa embrulhada: cantos e arestas levemente arredondados e faces um nada abauladas e frouxas (papel
 * esticado à mão, não chapa). As UV saem em metros, pela face dominante de cada triângulo (a estampa não estica).
 */
function caixaDePapel(w: number, h: number, p: number, canto: number, ladrilho: number, r: Sorteio): THREE.BufferGeometry {
  const N = 10;
  const bruta = new THREE.BoxGeometry(w, h, p, N, N, N);
  const pos = bruta.getAttribute('position');
  const meia = [w / 2, h / 2, p / 2];
  // a grade regular vira: dois segmentos em cada canto arredondado e o resto espalhado pela face
  const mapear = (c: number, m: number) => {
    const i = Math.round(((c / m + 1) / 2) * N);
    if (i <= 2) return -m + canto * (i / 2);
    if (i >= N - 2) return m - canto * ((N - i) / 2);
    return THREE.MathUtils.lerp(-m + canto, m - canto, (i - 2) / (N - 4));
  };
  const fases = [r() * 6, r() * 6, r() * 6, r() * 6];
  const v = [0, 0, 0];
  const c = [0, 0, 0];
  for (let i = 0; i < pos.count; i++) {
    v[0] = mapear(pos.getX(i), meia[0]);
    v[1] = mapear(pos.getY(i), meia[1]);
    v[2] = mapear(pos.getZ(i), meia[2]);
    let fora = 0;
    let eixo = -1;
    for (let e = 0; e < 3; e++) {
      c[e] = THREE.MathUtils.clamp(v[e], -(meia[e] - canto), meia[e] - canto);
      if (Math.abs(v[e] - c[e]) > 1e-7) {
        fora++;
        eixo = e;
      }
    }
    const dx = v[0] - c[0];
    const dy = v[1] - c[1];
    const dz = v[2] - c[2];
    const l = Math.hypot(dx, dy, dz) || 1;
    v[0] = c[0] + (dx / l) * canto;
    v[1] = c[1] + (dy / l) * canto;
    v[2] = c[2] + (dz / l) * canto;
    if (fora === 1 && !(eixo === 1 && v[1] < 0)) {
      // miolo de uma face (menos a de baixo): estufa no meio e ondula de leve
      const a = (eixo + 1) % 3;
      const b = (eixo + 2) % 3;
      const qa = c[a] / (meia[a] - canto);
      const qb = c[b] / (meia[b] - canto);
      const estufa = (1 - qa * qa) * (1 - qb * qb);
      const frouxo = Math.sin(c[a] * 31 + fases[eixo]) * Math.sin(c[b] * 27 + fases[3]) * (1 - qa * qa * qa * qa) * (1 - qb * qb * qb * qb);
      v[eixo] += Math.sign(v[eixo]) * (0.0022 * estufa + 0.0011 * frouxo);
    }
    pos.setXYZ(i, v[0], v[1], v[2]);
  }
  bruta.deleteAttribute('normal');
  bruta.deleteAttribute('uv');
  const lisa = mergeVertices(bruta, 1e-5);
  lisa.computeVertexNormals();
  bruta.dispose();
  const g = lisa.toNonIndexed();
  lisa.dispose();
  const pp = g.getAttribute('position');
  const n = g.getAttribute('normal');
  const uv = new Float32Array(pp.count * 2);
  for (let t = 0; t < pp.count; t += 3) {
    const nx = Math.abs(n.getX(t) + n.getX(t + 1) + n.getX(t + 2));
    const ny = Math.abs(n.getY(t) + n.getY(t + 1) + n.getY(t + 2));
    const nz = Math.abs(n.getZ(t) + n.getZ(t + 1) + n.getZ(t + 2));
    for (let q = 0; q < 3; q++) {
      const i = t + q;
      let u: number;
      let vv: number;
      if (ny >= nx && ny >= nz) [u, vv] = [pp.getX(i), pp.getZ(i)];
      else if (nx >= nz) [u, vv] = [pp.getZ(i), pp.getY(i)];
      else [u, vv] = [pp.getX(i), pp.getY(i)];
      uv[i * 2] = u / ladrilho;
      uv[i * 2 + 1] = vv / ladrilho;
    }
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

/**
 * Um presente, já na posição final (matriz). O papel vai para `papel` (com cor de vértice: as abas dobradas
 * ficam um nada mais claras ou escuras, como papel em duas camadas); as fitas e o laço vão para `fitas`.
 */
function juntarPresente(papel: Malhador, fitas: Malhador, d: PresenteDef, matriz: THREE.Matrix4, r: Sorteio, comLaco: boolean, giroTotal: number) {
  const [w, h, p] = d.tam;
  const canto = 0.006;
  const branco = new THREE.Color(1, 1, 1);
  const ladrilho = 0.12;
  const local = new Malhador();
  const caixa = caixaDePapel(w, h, p, canto, ladrilho, r);
  local.juntar(caixa, new THREE.Matrix4().makeTranslation(0, h / 2, 0), branco);
  caixa.dispose();

  // dobras do papel nas duas laterais menores: a aba de baixo sobe em trapézio e a de cima desce por cima
  // dela. As UV das abas continuam as da face (a estampa segue reta; a dobra aparece pelo degrau e pelo tom).
  const emX = w >= p; // as laterais fechadas ficam nas pontas do lado mais comprido
  const meiaFace = (emX ? p : w) / 2 - canto;
  const comprimento = (emX ? w : p) / 2;
  for (const s of [-1, 1]) {
    const ponto = (a: number, y: number, fora: number) => (emX ? new THREE.Vector3(s * (comprimento + fora), y, a) : new THREE.Vector3(a, y, s * (comprimento + fora)));
    const normalFace = emX ? new THREE.Vector3(s, 0, 0) : new THREE.Vector3(0, 0, s);
    const aba = (pontos: Array<[number, number, number]>, tom: number) => {
      const cor = new THREE.Color(tom, tom, tom);
      const v = pontos.map(([a, y, fora]) => ponto(a, y, fora));
      const idx = v.map((q) => local.vertice(q, normalFace, (emX ? q.z : q.x) / ladrilho, q.y / ladrilho, cor));
      // um lado só, com a face para fora
      const horario = new THREE.Vector3().crossVectors(v[1].clone().sub(v[0]), v[2].clone().sub(v[0])).dot(normalFace) < 0;
      for (let i = 1; i < idx.length - 1; i++) {
        if (horario) local.idx.push(idx[0], idx[i + 1], idx[i]);
        else local.idx.push(idx[0], idx[i], idx[i + 1]);
      }
    };
    const e = canto;
    const torto = (r() - 0.5) * meiaFace * 0.12;
    const estreita = Math.max(meiaFace * 0.14, meiaFace - h * 0.5);
    // o papel estufa uns 2 mm no meio da face: as abas ficam por cima disso
    aba(
      [
        [-meiaFace, e, 0.0012],
        [meiaFace, e, 0.0012],
        [estreita + torto, h * 0.54, 0.0034],
        [-estreita + torto, h * 0.54, 0.0034],
      ],
      0.955,
    );
    aba(
      [
        [meiaFace, h - e, 0.0018],
        [-meiaFace, h - e, 0.0018],
        [-estreita * 1.1 - torto, h * 0.4, 0.0044],
        [estreita * 1.1 - torto, h * 0.4, 0.0044],
      ],
      1.04,
    );
  }
  papel.juntar(local.geometria(), matriz, branco);
  // as cores das abas se perdem em juntar(): repõe
  const base = papel.vertices - local.vertices;
  for (let i = 0; i < local.cor.length; i++) papel.cor[base * 3 + i] = local.cor[i];

  // fita de cetim em cruz: duas voltas que sobem pelas laterais e passam por cima (por baixo não se vê),
  // com as bordas dobradas para baixo (espessura)
  const corFita = new THREE.Color(d.fita);
  const larguraFita = Math.min(0.052, Math.min(w, p) * 0.2);
  const folga = 0.0034;
  const volta = (meio: number, eixo: 'x' | 'z', desvio: number) => {
    const caminho: THREE.Vector3[] = [];
    const lado: THREE.Vector3[] = [];
    const rc = canto + folga;
    const pt = (a: number, y: number) => (eixo === 'x' ? new THREE.Vector3(a, y, desvio) : new THREE.Vector3(desvio, y, -a));
    const ladoDir = eixo === 'x' ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
    const por = (a: number, y: number) => {
      caminho.push(pt(a, y));
      lado.push(ladoDir);
    };
    const m = meio + folga;
    const topo = h + folga;
    for (let i = 0; i <= 4; i++) por(-m, 0.004 + ((topo - rc - 0.004) * i) / 4);
    for (let i = 1; i <= 4; i++) {
      const a = (i / 4) * (Math.PI / 2);
      por(-m + rc - rc * Math.cos(a), topo - rc + rc * Math.sin(a));
    }
    for (let i = 1; i <= 5; i++) por(-m + rc + ((2 * m - 2 * rc) * i) / 6, topo);
    for (let i = 0; i <= 4; i++) {
      const a = (i / 4) * (Math.PI / 2);
      por(m - rc + rc * Math.sin(a), topo - rc + rc * Math.cos(a));
    }
    for (let i = 1; i <= 4; i++) por(m, topo - rc - ((topo - rc - 0.004) * i) / 4);
    const tira = new Malhador();
    faixa(tira, caminho, lado, () => larguraFita, 0.14, corFita, 0, undefined, 0.0016);
    const g = tira.geometria();
    g.computeVertexNormals();
    fitas.juntar(g, matriz, corFita);
    g.dispose();
  };
  const dx = (r() - 0.5) * w * 0.14;
  const dz = (r() - 0.5) * p * 0.14;
  volta(w / 2, 'x', dz);
  volta(p / 2, 'z', dx);
  // laço volumoso deitado sobre o cruzamento das fitas, um pouco torto (não quando há outro presente em cima)
  if (!comLaco) return;
  const laco = new THREE.Matrix4()
    .makeTranslation(dx, h + 0.006, dz)
    // o laço fica de frente para a frente da peça (+Z), um pouco torto, e inclinado para trás: assim as
    // alças mostram a face larga da fita, não a borda
    .multiply(new THREE.Matrix4().makeRotationY(-giroTotal * 0.8 + (r() - 0.5) * 0.5))
    .multiply(new THREE.Matrix4().makeRotationX(-0.62));
  juntarLaco(fitas, { largura: Math.min(0.3, Math.min(w, p) * 1.05), fita: larguraFita * 1.7, pontas: 0.42, queda: 0.1, duplo: true, cheio: 0.4, inclina: 0.5, cor: corFita }, r, new THREE.Matrix4().multiplyMatrices(matriz, laco));
}

export interface PeDaArvore {
  grupo: THREE.Group;
  setEnvMap(tex: THREE.Texture | null): void;
  dispose(): void;
}

/** De três a cinco presentes dispostos na frente da árvore, na beira da saia. Uma malha de papel e uma de fitas. */
export function criarPresentes(quantos: number, raioCopa: number, envMap: THREE.Texture | null, veludoNormal: THREE.Texture, semente: number): PeDaArvore {
  const grupo = new THREE.Group();
  grupo.name = 'presentes';
  const r = criarSorteio(semente);
  const lixo: Array<{ dispose(): void }> = [];
  const papel = new Malhador();
  const fitas = new Malhador();
  const camada: number[] = [];
  const n = THREE.MathUtils.clamp(Math.round(quantos), 0, PRESENTES.length);
  const matrizes: THREE.Matrix4[] = [];
  const giros: number[] = [];
  const escala = raioCopa / 1.19;
  for (let i = 0; i < n; i++) {
    const d = PRESENTES[i];
    const matriz = new THREE.Matrix4();
    if (d.sobre >= 0 && d.sobre < i) {
      const base = PRESENTES[d.sobre];
      matriz.copy(matrizes[d.sobre]).multiply(new THREE.Matrix4().makeTranslation(base.tam[0] * 0.12, base.tam[1] + 0.002, -base.tam[2] * 0.08)).multiply(new THREE.Matrix4().makeRotationY(d.giro));
    } else {
      const dist = d.distancia * escala;
      matriz.makeTranslation(Math.sin(d.angulo) * dist, 0.004, Math.cos(d.angulo) * dist).multiply(new THREE.Matrix4().makeRotationY(d.angulo + d.giro));
    }
    matrizes.push(matriz);
    giros.push(d.sobre >= 0 && d.sobre < i ? giros[d.sobre] + d.giro : d.angulo + d.giro);
    const temAlgoEmCima = PRESENTES.some((outro, j) => j < n && outro.sobre === i);
    const antes = papel.vertices;
    juntarPresente(papel, fitas, d, matriz, r, !temAlgoEmCima, giros[i]);
    for (let v = antes; v < papel.vertices; v++) camada.push(d.papel, d.rugosidade);
  }
  if (n > 0) {
    // sombra pintada: o que está mais para dentro da copa escurece (a luz da árvore não projeta sombra)
    const sombrear = (m: Malhador) => {
      for (let v = 0; v < m.vertices; v++) {
        const d = Math.hypot(m.pos[v * 3], m.pos[v * 3 + 2]);
        const s = 0.38 + 0.62 * suave(0.55 * raioCopa, 1.2 * raioCopa, d + m.pos[v * 3 + 1] * 0.3);
        m.cor[v * 3] *= s;
        m.cor[v * 3 + 1] *= s;
        m.cor[v * 3 + 2] *= s;
      }
    };
    sombrear(papel);
    sombrear(fitas);

    const geo = papel.geometria();
    geo.setAttribute('aPapel', new THREE.Float32BufferAttribute(camada, 2));
    const estampas = papeisDePresente(PAPEIS, semente);
    const relevo = normalDePapel();
    const proprios = { uPapeis: { value: estampas } };
    const mat = new THREE.MeshPhysicalMaterial({
      normalMap: relevo,
      normalScale: new THREE.Vector2(0.5, 0.5),
      roughness: 0.6,
      metalness: 0,
      vertexColors: true,
      envMap,
      envMapIntensity: 0.6,
      side: THREE.DoubleSide,
    });
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, proprios);
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          /* glsl */ `#include <common>
          attribute vec2 aPapel;
          varying vec2 vPapel;
          varying vec2 vUvPapel;`,
        )
        .replace(
          '#include <begin_vertex>',
          /* glsl */ `#include <begin_vertex>
          vPapel = aPapel;
          vUvPapel = uv;`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          /* glsl */ `#include <common>
          uniform sampler2DArray uPapeis;
          varying vec2 vPapel;
          varying vec2 vUvPapel;`,
        )
        .replace(
          '#include <map_fragment>',
          /* glsl */ `diffuseColor *= texture( uPapeis, vec3( vUvPapel, floor( vPapel.x + 0.5 ) ) );`,
        )
        .replace(
          '#include <roughnessmap_fragment>',
          /* glsl */ `#include <roughnessmap_fragment>
          roughnessFactor = vPapel.y;`,
        );
    };
    mat.customProgramCacheKey = () => 'papel-de-presente';
    const malha = new THREE.Mesh(geo, mat);
    malha.castShadow = true;
    malha.receiveShadow = true;
    malha.name = 'presentes-papel';
    grupo.add(malha);
    lixo.push(geo, mat, estampas, relevo);

    const fitaGeo = fitas.geometria();
    const trama = veludoNormal.clone();
    trama.repeat.set(3, 3);
    trama.needsUpdate = true;
    // cetim: brilho macio, com um véu claro no rasante
    const fitaMat = new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      roughness: 0.34,
      metalness: 0,
      sheen: 0.3,
      sheenColor: new THREE.Color('#ffffff'),
      sheenRoughness: 0.4,
      normalMap: trama,
      normalScale: new THREE.Vector2(0.2, 0.2),
      envMap,
      envMapIntensity: 0.9,
      side: THREE.DoubleSide,
    });
    const fitaMalha = new THREE.Mesh(fitaGeo, fitaMat);
    fitaMalha.castShadow = false;
    fitaMalha.receiveShadow = true;
    fitaMalha.userData.semAO = true;
    fitaMalha.name = 'fitas-dos-presentes';
    grupo.add(fitaMalha);
    lixo.push(fitaGeo, fitaMat, trama);
  }
  return {
    grupo,
    setEnvMap(tex) {
      for (const filho of grupo.children) {
        const mat = (filho as THREE.Mesh).material as THREE.MeshPhysicalMaterial;
        mat.envMap = tex;
        mat.needsUpdate = true;
      }
    },
    dispose() {
      for (const l of lixo) l.dispose();
    },
  };
}
