/**
 * Ferramenta de preparação (não vai para o jogo): modela ramos de abeto com AGULHAS DE VERDADE em geometria
 * (cada agulha é uma lâmina fina, curva, com nervura) e os "assa" em cartões: fotografa de cima, em projeção
 * ortográfica e fundo transparente, a cor (albedo sem luz), a normal (no espaço do cartão) e a altura.
 *
 * O ramo é um leque denso, como o de um abeto de Natal: um talo guia, raminhos laterais alternados que também
 * se ramificam, agulhas curtas e juntas dos dois lados e por cima de cada talo, apontando para a frente, e uma
 * camada de trás mais escura que fecha os vãos. Tudo sai de um sorteio com semente (a mesma variante é sempre
 * igual). Quem monta o atlas e grava os arquivos é o assar.cjs, na mesma pasta.
 *
 * Espaço do ramo: o quadro vai de x = -0,5 a 0,5 e de y = 0 a 1 (a base do ramo fica embaixo, no meio; a ponta
 * em cima); z sai do cartão, para a câmera.
 */
import * as THREE from 'three';

export interface PedidoDeRamo {
  modo: 'ver' | 'cor' | 'normal' | 'altura';
  /** Índice da variante (veja VARIANTES). */
  variante: number;
  tam: number;
}

interface AssarApi {
  pronto: boolean;
  erro: string | null;
  variantes: number;
  foto(p: PedidoDeRamo): string;
}
declare global {
  interface Window {
    __assar?: AssarApi;
  }
}

type Sorteio = () => number;
function criarSorteio(semente: number): Sorteio {
  let a = (semente | 0) + 0x6d2b79f5;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const entre = (r: Sorteio, a: number, b: number) => a + (b - a) * r();

interface DefRamo {
  semente: number;
  /** Meia largura do leque (fração do quadro). */
  meia: number;
  /** Onde o leque é mais largo, ao longo do talo guia (0 a 1). */
  barriga: number;
  /** Distância entre raminhos laterais ao longo do guia. */
  passo: number;
  /** Ângulo dos raminhos com o guia, em graus. */
  angulo: number;
  /** Comprimento das agulhas (fração do quadro). */
  agulha: number;
  /** Camada de trás (mais escura, um pouco girada) que fecha os vãos. */
  fundo: number;
  /** Claridade geral (ramos de dentro da árvore são mais escuros). */
  claro: number;
  /** Como o leque afina para a ponta: 1 = em lança; 0,6 = arredondado. */
  ponta: number;
  /** Chance de os raminhos laterais compridos se ramificarem de novo (0 a 1). */
  filhos: number;
}

/**
 * As nove células do atlas 3x3:
 *   0 a 3  ramos abertos: raminhos espaçados, com vãos entre eles (a silhueta sai em "dedos" de escova);
 *   4 e 5  ramos de ponta, estreitos e pontudos (pontas dos galhos, guia do topo);
 *   6 e 7  leques cheios, que fecham a massa por trás dos abertos;
 *   8      leque de miolo, largo e escuro.
 */
const VARIANTES: DefRamo[] = [
  { semente: 11, meia: 0.4, barriga: 0.36, passo: 0.3, angulo: 48, agulha: 0.185, fundo: 0.5, claro: 1, ponta: 0.8, filhos: 0 },
  { semente: 23, meia: 0.38, barriga: 0.32, passo: 0.32, angulo: 45, agulha: 0.19, fundo: 0.5, claro: 1, ponta: 0.85, filhos: 0 },
  { semente: 37, meia: 0.41, barriga: 0.4, passo: 0.29, angulo: 50, agulha: 0.18, fundo: 0.5, claro: 1, ponta: 0.75, filhos: 0.1 },
  { semente: 41, meia: 0.37, barriga: 0.34, passo: 0.32, angulo: 44, agulha: 0.188, fundo: 0, claro: 1.04, ponta: 0.85, filhos: 0 },
  { semente: 71, meia: 0.28, barriga: 0.3, passo: 0.34, angulo: 40, agulha: 0.2, fundo: 0, claro: 1.08, ponta: 1.0, filhos: 0 },
  { semente: 83, meia: 0.32, barriga: 0.32, passo: 0.32, angulo: 42, agulha: 0.195, fundo: 0, claro: 1.06, ponta: 0.95, filhos: 0 },
  { semente: 53, meia: 0.4, barriga: 0.42, passo: 0.23, angulo: 54, agulha: 0.18, fundo: 1, claro: 0.97, ponta: 0.66, filhos: 0.2 },
  { semente: 67, meia: 0.38, barriga: 0.38, passo: 0.22, angulo: 52, agulha: 0.175, fundo: 1, claro: 0.95, ponta: 0.66, filhos: 0.2 },
  { semente: 97, meia: 0.42, barriga: 0.45, passo: 0.2, angulo: 58, agulha: 0.18, fundo: 1.3, claro: 0.78, ponta: 0.62, filhos: 0.4 },
];

/** Acumulador da malha do ramo: posições, normais e cor de vértice. */
class Malha {
  pos: number[] = [];
  nor: number[] = [];
  cor: number[] = [];
  idx: number[] = [];
  v(p: THREE.Vector3, n: THREE.Vector3, c: THREE.Color): number {
    this.pos.push(p.x, p.y, p.z);
    this.nor.push(n.x, n.y, n.z);
    this.cor.push(c.r, c.g, c.b);
    return this.pos.length / 3 - 1;
  }
  geometria(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.cor, 3));
    g.setIndex(this.idx);
    return g;
  }
}

const CIMA = new THREE.Vector3(0, 0, 1);
const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();
const tmpC = new THREE.Vector3();

/** Uma agulha: lâmina fina com nervura no meio, mais larga perto da base, pontuda, levemente curva. */
function agulha(m: Malha, base: THREE.Vector3, dir: THREE.Vector3, face: THREE.Vector3, comprimento: number, largura: number, curva: number, corBase: THREE.Color, corPonta: THREE.Color) {
  const lado = tmpA.crossVectors(dir, face).normalize().clone();
  const n = tmpB.crossVectors(lado, dir).normalize().clone();
  const secoes: Array<[number, number]> = [
    [0, 0.34],
    [0.3, 0.5],
    [0.72, 0.42],
    [1, 0.05],
  ];
  const inicio = m.pos.length / 3;
  const c = new THREE.Color();
  const p = new THREE.Vector3();
  const nn = new THREE.Vector3();
  for (const [t, meia] of secoes) {
    const centro = tmpC.copy(base).addScaledVector(dir, comprimento * t).addScaledVector(n, curva * comprimento * t * t).clone();
    c.copy(corBase).lerp(corPonta, t);
    // a lâmina é levemente abaulada (as bordas viram para baixo) e a nervura do meio é um nada mais clara
    for (const s of [-1, 0, 1]) {
      p.copy(centro).addScaledVector(lado, s * meia * largura).addScaledVector(n, s === 0 ? largura * 0.12 : 0);
      nn.copy(n).addScaledVector(lado, s * 0.75).normalize();
      m.v(p, nn, s === 0 ? c.clone().multiplyScalar(1.1) : c);
    }
  }
  for (let j = 0; j < secoes.length - 1; j++)
    for (let k = 0; k < 2; k++) {
      const a = inicio + j * 3 + k;
      m.idx.push(a, a + 1, a + 4, a, a + 4, a + 3);
    }
}

/** Talo: tubo fino de cinco lados ao longo de uma linha de pontos. */
function talo(m: Malha, pontos: THREE.Vector3[], raio: (t: number) => number, cor: THREE.Color) {
  const lados = 5;
  const inicio = m.pos.length / 3;
  const t = new THREE.Vector3();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const p = new THREE.Vector3();
  const nn = new THREE.Vector3();
  for (let i = 0; i < pontos.length; i++) {
    t.subVectors(pontos[Math.min(pontos.length - 1, i + 1)], pontos[Math.max(0, i - 1)]).normalize();
    a.crossVectors(t, CIMA).normalize();
    b.crossVectors(a, t).normalize();
    const r = raio(i / (pontos.length - 1));
    for (let k = 0; k < lados; k++) {
      const ang = (k / lados) * Math.PI * 2;
      nn.copy(a).multiplyScalar(Math.cos(ang)).addScaledVector(b, Math.sin(ang));
      p.copy(pontos[i]).addScaledVector(nn, r);
      m.v(p, nn, cor);
    }
  }
  for (let i = 0; i < pontos.length - 1; i++)
    for (let k = 0; k < lados; k++) {
      const v0 = inicio + i * lados + k;
      const v1 = inicio + i * lados + ((k + 1) % lados);
      m.idx.push(v0, v1, v1 + lados, v0, v1 + lados, v0 + lados);
    }
}

interface Paleta {
  base: THREE.Color;
  ponta: THREE.Color;
  broto: THREE.Color;
  talo: THREE.Color;
}

/**
 * Veste um talo de agulhas: em espiral em volta dele, sem as de baixo (que não se veem de cima), apontando
 * para a frente; as de cima mais deitadas sobre o talo, as dos lados mais abertas. Mais curtas na base e na
 * ponta, com um tufo no broto.
 */
function vestir(m: Malha, pontos: THREE.Vector3[], r: Sorteio, d: DefRamo, paleta: Paleta, tom: number, escalaAgulha: number) {
  // comprimento acumulado
  const acum: number[] = [0];
  for (let i = 1; i < pontos.length; i++) acum.push(acum[i - 1] + pontos[i].distanceTo(pontos[i - 1]));
  const total = acum[acum.length - 1];
  const em = (s: number, out: THREE.Vector3, tg: THREE.Vector3) => {
    let i = 1;
    while (i < acum.length - 1 && acum[i] < s) i++;
    const f = (s - acum[i - 1]) / Math.max(1e-6, acum[i] - acum[i - 1]);
    out.copy(pontos[i - 1]).lerp(pontos[i], f);
    tg.subVectors(pontos[i], pontos[i - 1]).normalize();
  };
  const p = new THREE.Vector3();
  const tg = new THREE.Vector3();
  const ladoT = new THREE.Vector3();
  const cimaT = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const radial = new THREE.Vector3();
  const face = new THREE.Vector3();
  const corBase = new THREE.Color();
  const corPonta = new THREE.Color();
  const passo = 0.0046;
  let giro = r() * 6.28;
  for (let s = 0.004; s < total; s += passo * entre(r, 0.75, 1.25)) {
    giro += 2.39996 + (r() - 0.5) * 0.5;
    // azimute em volta do talo: 0 = para cima (câmera); só o hemisfério de cima e os lados
    const az = ((giro % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    if (Math.abs(az) > 2.0) continue;
    em(s, p, tg);
    ladoT.crossVectors(tg, CIMA).normalize();
    cimaT.crossVectors(ladoT, tg).normalize();
    radial.copy(cimaT).multiplyScalar(Math.cos(az)).addScaledVector(ladoT, Math.sin(az));
    const lateral = Math.abs(Math.sin(az)); // 1 = para o lado; 0 = para cima
    // abertura em relação ao talo: as dos lados abrem mais; as de cima deitam para a frente
    const abre = THREE.MathUtils.degToRad(THREE.MathUtils.lerp(44, 70, lateral) + (r() - 0.5) * 16);
    dir.copy(tg).multiplyScalar(Math.cos(abre)).addScaledVector(radial, Math.sin(abre)).normalize();
    const t = s / total;
    // mais curtas onde o raminho nasce e no broto da ponta
    const fator = (0.84 + 0.16 * Math.sin(Math.PI * Math.min(1, t * 1.15 + 0.08))) * entre(r, 0.82, 1.12);
    const comp = d.agulha * escalaAgulha * fator * (0.8 + 0.2 * lateral);
    // a face da lâmina olha para fora do talo, um pouco torta
    face.copy(radial).addScaledVector(CIMA, 0.9).addScaledVector(ladoT, (r() - 0.5) * 0.9).normalize();
    const luz = tom * entre(r, 0.72, 1.22) * (0.86 + 0.14 * lateral);
    // as agulhas do broto (ponta do raminho) são mais novas: um verde um nada mais claro e vivo
    const novo = THREE.MathUtils.smoothstep(t, 0.7, 1.0) * 0.6;
    corBase.copy(paleta.base).lerp(paleta.broto, novo * 0.5).multiplyScalar(luz);
    corPonta.copy(paleta.ponta).lerp(paleta.broto, novo).multiplyScalar(luz);
    agulha(m, p.clone().addScaledVector(radial, 0.005), dir, face, comp, 0.021 * entre(r, 0.85, 1.15), (r() - 0.35) * 0.16, corBase, corPonta);
  }
  // broto: um tufo curto que fecha a ponta do raminho
  em(total, p, tg);
  ladoT.crossVectors(tg, CIMA).normalize();
  cimaT.crossVectors(ladoT, tg).normalize();
  for (let i = 0; i < 9; i++) {
    const az = (i / 9) * Math.PI * 2 + r();
    radial.copy(cimaT).multiplyScalar(Math.cos(az)).addScaledVector(ladoT, Math.sin(az));
    const abre = entre(r, 0.25, 1.0);
    dir.copy(tg).multiplyScalar(Math.cos(abre)).addScaledVector(radial, Math.sin(abre)).normalize();
    face.copy(radial).addScaledVector(CIMA, 1.2).normalize();
    const luz = tom * entre(r, 0.95, 1.15);
    corBase.copy(paleta.base).lerp(paleta.broto, 0.4).multiplyScalar(luz);
    corPonta.copy(paleta.broto).multiplyScalar(luz);
    agulha(m, p.clone(), dir, face, d.agulha * escalaAgulha * entre(r, 0.7, 0.95), 0.021, 0.05, corBase, corPonta);
  }
  talo(m, pontos, (t) => 0.008 * (1 - 0.6 * t), paleta.talo.clone().multiplyScalar(tom));
}

/** Linha curva de um talo: sai de `origem` na direção `ang` (radianos a partir de +y, positivo para a direita). */
function linha(origem: THREE.Vector3, ang: number, comprimento: number, curva: number, queda: number, ondula: number, fase: number): THREE.Vector3[] {
  const n = Math.max(4, Math.round(comprimento / 0.03));
  const pontos: THREE.Vector3[] = [];
  let a = ang;
  const p = origem.clone();
  pontos.push(p.clone());
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    a += curva / n + Math.sin(t * 7 + fase) * ondula;
    p.x += (Math.sin(a) * comprimento) / n;
    p.y += (Math.cos(a) * comprimento) / n;
    // o raminho sobe um pouco e a ponta pende
    p.z = origem.z + comprimento * (0.1 * Math.sin(Math.PI * t * 0.9) - queda * t * t);
    pontos.push(p.clone());
  }
  return pontos;
}

/** Um leque completo: guia + raminhos laterais alternados + raminhos de segunda ordem. */
function leque(m: Malha, d: DefRamo, r: Sorteio, paleta: Paleta, tom: number, escala: number, giro: number, z0: number) {
  const L = 0.8 * escala;
  const origem = new THREE.Vector3(0, 0.035, z0);
  const guia = linha(origem, giro + (r() - 0.5) * 0.08, L, (r() - 0.5) * 0.25, 0.05, 0.01, r() * 6);
  vestir(m, guia, r, d, paleta, tom, 1);
  // ponto e direção do guia em t
  const noGuia = (t: number) => {
    const f = t * (guia.length - 1);
    const i = Math.min(guia.length - 2, Math.floor(f));
    const p = guia[i].clone().lerp(guia[i + 1], f - i);
    const tg = guia[i + 1].clone().sub(guia[i]);
    return { p, ang: Math.atan2(tg.x, tg.y) };
  };
  // meia largura do leque ao longo do guia: oval, com a barriga perto da base e a ponta arredondada
  const perfil = (t: number) => {
    const u = t < d.barriga ? t / d.barriga : 1 - (t - d.barriga) / (1 - d.barriga);
    const sobe = t < d.barriga ? 0.22 + 0.78 * Math.pow(Math.sin((u * Math.PI) / 2), 1.25) : Math.pow(Math.max(0, u), d.ponta);
    return d.meia * escala * sobe;
  };
  let lado = r() < 0.5 ? 1 : -1;
  for (let t = 0.1; t < 0.86; t += (d.passo / 0.875) * entre(r, 0.8, 1.2) * 0.5) {
    const { p, ang } = noGuia(t);
    const abertura = THREE.MathUtils.degToRad(d.angulo * THREE.MathUtils.lerp(1.12, 0.78, t) + (r() - 0.5) * 12);
    const alcance = perfil(Math.min(1, t + 0.06)) * (r() < 0.14 ? 0.72 : 1);
    const comp = Math.max(0.05 * escala, ((alcance - d.agulha * 0.6) / Math.sin(abertura)) * entre(r, 0.86, 1.06));
    if (comp < 0.1 * escala) {
      lado = -lado;
      continue;
    }
    // o raminho abre e depois encurva de volta para a frente (para a ponta do leque)
    const pontos = linha(p, ang + lado * abertura, comp, -lado * entre(r, 0.1, 0.4), entre(r, 0.06, 0.16), 0.012, r() * 6);
    vestir(m, pontos, r, d, paleta, tom * entre(r, 0.84, 1.08), 0.96);
    // segunda ordem: raminhos curtos alternados nos laterais compridos
    if (comp > 0.2 * escala && r() < d.filhos) {
      let lado2 = lado;
      for (let u = 0.25; u < 0.8; u += entre(r, 0.26, 0.38)) {
        const f = u * (pontos.length - 1);
        const i = Math.min(pontos.length - 2, Math.floor(f));
        const q = pontos[i].clone().lerp(pontos[i + 1], f - i);
        const tg = pontos[i + 1].clone().sub(pontos[i]);
        const a0 = Math.atan2(tg.x, tg.y);
        const c2 = comp * (1 - u) * entre(r, 0.5, 0.78);
        if (c2 > 0.05 * escala) {
          const filho = linha(q, a0 + lado2 * THREE.MathUtils.degToRad(entre(r, 38, 52)), c2, -lado2 * 0.2, entre(r, 0.05, 0.14), 0.01, r() * 6);
          vestir(m, filho, r, d, paleta, tom * entre(r, 0.82, 1.06), 0.9);
        }
        lado2 = -lado2;
      }
    }
    lado = -lado;
  }
}

function construirRamo(d: DefRamo): THREE.BufferGeometry {
  const r = criarSorteio(d.semente);
  const m = new Malha();
  // verde-pinheiro profundo (a paleta do jogo pede #174D3B): base da agulha mais escura e azulada, ponta mais
  // clara, broto novo um pouco mais vivo. A luz da sala e a tinta por fronde fazem o resto.
  const paleta: Paleta = {
    base: new THREE.Color('#103626').multiplyScalar(d.claro),
    ponta: new THREE.Color('#2c7046').multiplyScalar(d.claro),
    broto: new THREE.Color('#528f4e').multiplyScalar(d.claro),
    talo: new THREE.Color('#5a4630'),
  };
  // camada de trás: outro leque um pouco menor, girado, mais fundo e bem mais escuro, que fecha os vãos
  if (d.fundo > 0) {
    const e = d.fundo < 1 ? 0.68 : 0.84;
    leque(m, { ...d, meia: d.meia * 0.86, filhos: 1, passo: Math.min(d.passo, 0.2) }, r, paleta, 0.5 / Math.max(0.6, d.fundo * 0.9), e, (r() < 0.5 ? 1 : -1) * entre(r, 0.08, 0.16), -0.05);
    if (d.fundo > 1) leque(m, { ...d, meia: d.meia * 0.9 }, r, paleta, 0.36, 0.8, (r() - 0.5) * 0.4, -0.085);
  }
  leque(m, d, r, paleta, 1, 1, 0, 0);
  return m.geometria();
}

const api: AssarApi = { pronto: false, erro: null, variantes: VARIANTES.length, foto: () => '' };
window.__assar = api;

function principal() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true, premultipliedAlpha: false });
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.body.append(renderer.domElement);
  const cena = new THREE.Scene();
  const sol = new THREE.DirectionalLight('#ffffff', 2.6);
  sol.position.set(0.5, 0.6, 1);
  const ceu = new THREE.HemisphereLight('#ffffff', '#3a3a3a', 1.0);
  cena.add(sol, ceu);
  const prontos = new Map<number, THREE.BufferGeometry>();
  const malha = new THREE.Mesh(new THREE.BufferGeometry());
  cena.add(malha);
  // altura: de z = -0,13 (fundo, escuro) a z = +0,09 (agulhas de cima, claro)
  const Z_BAIXO = -0.13;
  const Z_ALTO = 0.09;
  const materiais = {
    ver: new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.6 }),
    cor: new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }),
    normal: new THREE.MeshNormalMaterial({ side: THREE.DoubleSide }),
    altura: new THREE.MeshDepthMaterial({ side: THREE.DoubleSide }),
  };

  api.foto = (p) => {
    renderer.setSize(p.tam, p.tam, false);
    let g = prontos.get(p.variante);
    if (!g) {
      g = construirRamo(VARIANTES[p.variante]);
      prontos.set(p.variante, g);
    }
    malha.geometry = g;
    malha.material = materiais[p.modo];
    const cam = new THREE.OrthographicCamera(-0.5, 0.5, 1, 0, 2 - Z_ALTO, 2 - Z_BAIXO);
    if (p.modo !== 'altura') {
      cam.near = 0.1;
      cam.far = 4;
    }
    cam.position.set(0, 0, 2);
    cam.up.set(0, 1, 0);
    cam.lookAt(0, 0, 0);
    cam.position.set(0, 0, 2);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
    sol.visible = ceu.visible = p.modo === 'ver';
    renderer.setClearColor(p.modo === 'ver' ? 0x30343c : 0x000000, p.modo === 'ver' ? 1 : 0);
    renderer.render(cena, cam);
    return renderer.domElement.toDataURL('image/png');
  };
  api.pronto = true;
}

try {
  principal();
} catch (e) {
  api.erro = String(e instanceof Error ? e.stack : e);
}
