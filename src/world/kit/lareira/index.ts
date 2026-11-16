/**
 * Lareira de pedra de casa de campo, com o fogo.
 *
 * Nasce com as costas em z = 0, a boca voltada para +Z e a base em y = 0. A composição gira e
 * posiciona `root`. Montagem (de baixo para cima):
 *   soleira     lajes modeladas uma a uma, avançando sobre o piso (também são o chão da câmara)
 *   corpo       pele de pedra bruta com o relevo do mapa de deslocamento aplicado na malha
 *   boca        arco abatido de aduelas lavradas uma a uma (larguras diferentes), pés-direitos e chave
 *   câmara      tijolo escurecido por fuligem, paredes abertas em leque
 *   console     viga grossa lavrada a enxó, sobre duas mísulas de pedra de perfil curvo
 *   ombros      fiadas em degrau, cada uma com a sua pedra de capa
 *   peito       a mesma pele de pedra, subindo até o teto
 *   cunhais     pedras de quina alternadas (comprida e curta), para a silhueta não ser uma régua
 * Dentro: cães de ferro fundido, lenha rachada com casca real (carbonizada onde o fogo pega, com a
 * brasa nas frestas), leito de cinzas com carvões partidos e o fogo em volume.
 *
 * Luzes (três): `luz` é a principal, um spot âmbar dentro da boca apontando para a sala (a
 * composição liga castShadow nela); uma pontual sem sombra dentro da câmara; e a `luz-rebatida`,
 * um spot sem sombra que fica rente ao piso, 2 m à frente, apontado de volta para a pedra (faz o
 * clarão devolvido pelo chão: ilumina a frente da lareira, forte embaixo e sumindo para o alto).
 *
 * Sombras: as malhas detalhadas NÃO projetam sombra; quem projeta é uma malha substituta invisível
 * de poucas dezenas de triângulos (o contorno da lareira com o vão da boca), que serve à luz do
 * fogo e a qualquer outra luz da sala. Com isso a lareira é desenhada uma vez só por quadro.
 *
 * O que a peça espera da composição: um preenchimento quente mínimo (luz de hemisfério ou mapa de
 * ambiente) para o tampo da viga e as laterais não ficarem em preto; nenhum objeto alto dentro dos
 * 2 m à frente da soleira (a luz rebatida o iluminaria pelo lado da sala); e piso com rugosidade
 * de 0,45 para cima na faixa de 2 m diante da boca, para o reflexo do fogo ser uma mancha quente
 * e não um espelho.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Level } from '../../contracts';
import { loadPbr, loadTexture } from '../../../engine/assets';
import type { KitContext, Peca } from '../tipos';
import { criarFogo, type Fogo, type SegmentoDeLenha } from './fogo';
import { criarAcha, criarCaesDeFerro, criarLeito, criarTexturaAneis, queimarMaterial, vigaLavrada, type AchaDef } from './lenha';
import { blocoIrregular, caixaCantos, criarAmostrador, peleDePedra, variarRugosidade, type Cor3 } from './pedra';
import { criarRng, fbm3 } from './ruido';

export { criarFogo } from './fogo';
export type { Fogo, FogoOpcoes, SegmentoDeLenha, TremorDoFogo } from './fogo';

export interface LareiraOpcoes {
  /** Largura do corpo de pedra, em metros. Padrão 3,2. */
  largura?: number;
  /** Altura do tampo do console (a viga). Padrão 1,95. */
  alturaConsole?: number;
  /** Altura total, até o teto. Padrão 6. */
  alturaTotal?: number;
  /** Quanto o corpo avança da parede. Padrão 0,95. */
  profundidade?: number;
  semente?: number;
  /**
   * Sombra de contato pintada na parede, dos dois lados da chaminé (malha fina, mistura
   * multiplicativa, 34 cm de cada lado): assenta o volume na parede em qualquer nível de qualidade.
   * Padrão true. Desligue se a parede da composição não estiver no plano z = 0 da peça.
   */
  sombraNaParede?: boolean;
}

export interface Lareira extends Peca {
  /** Luz principal do fogo: spot âmbar dentro da boca, apontando para +Z e um pouco para baixo. castShadow nasce desligado. */
  luz: THREE.SpotLight;
  /** Todas as luzes da peça (a principal, a pontual da câmara e o spot da luz rebatida; as duas últimas sem sombra). */
  luzes: THREE.Light[];
  /** Centro do fogo, em coordenadas locais da peça. */
  bocaDoFogo: THREE.Vector3;
  /** Tampo do console, para a composição apoiar objetos: altura, largura, profundidade livre e o z do meio dessa faixa. */
  console: { y: number; largura: number; profundidade: number; z: number };
  /** Aumenta ou diminui todo o fogo e a luz (1 = normal). Pode ser mudado a qualquer momento. */
  forca: number;
  /** Efeito FIREPLACE_MAGIC, de 0 a 1. */
  setMagia(intensidade: number): void;
  /** O fogo, para quem quiser mexer direto. */
  fogo: Fogo;
}

const ss = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** Um quadrilátero simples com cor por vértice (argamassa no fundo das juntas). UV em metros. */
function quad(p00: THREE.Vector3, p10: THREE.Vector3, p01: THREE.Vector3, p11: THREE.Vector3, cores: Cor3[], ladrilho: number): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  const n = new THREE.Vector3().subVectors(p10, p00).cross(new THREE.Vector3().subVectors(p01, p00)).normalize();
  const pts = [p00, p10, p01, p11];
  const u = new THREE.Vector3().subVectors(p10, p00).normalize();
  const v = new THREE.Vector3().crossVectors(n, u);
  const pos: number[] = [];
  const nor: number[] = [];
  const uvs: number[] = [];
  const cor: number[] = [];
  pts.forEach((q, i) => {
    pos.push(q.x, q.y, q.z);
    nor.push(n.x, n.y, n.z);
    uvs.push((q.dot(u) + q.y * 0.37) / ladrilho, q.dot(v) / ladrilho);
    cor.push(...cores[i]);
  });
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cor, 3));
  g.setAttribute('aGasto', new THREE.Float32BufferAttribute([1, 1, 1, 1], 1));
  g.setIndex([0, 1, 3, 0, 3, 2]);
  return g;
}

/** Oito cantos de um bloco dado por um quadrilátero no plano XY (ordem: baixo-esq, baixo-dir, cima-esq, cima-dir) e a faixa em Z. */
function cantosDeQuad(q: Array<[number, number]>, z0: number, z1: number): THREE.Vector3[] {
  const c: THREE.Vector3[] = [];
  for (const z of [z0, z1]) for (const [x, y] of q) c.push(new THREE.Vector3(x, y, z));
  return c;
}

export async function criarLareira(ctx: KitContext, opcoes: LareiraOpcoes = {}): Promise<Lareira> {
  const L = opcoes.largura ?? 3.2;
  const aC = opcoes.alturaConsole ?? 1.95;
  const H = opcoes.alturaTotal ?? 6;
  const P = opcoes.profundidade ?? 0.95;
  const semente = opcoes.semente ?? 7;
  const rng = criarRng(semente);
  const nivel: Level = ctx.level;
  // menos subdivisão nos níveis médio e baixo (decidido na montagem)
  const passoPele = nivel === 'alta' ? 0.04 : nivel === 'media' ? 0.056 : 0.08;
  const passoBloco = nivel === 'alta' ? 0.085 : nivel === 'media' ? 0.11 : 0.16;
  const segLenha = nivel === 'alta' ? 16 : nivel === 'media' ? 12 : 9;

  /* ------------------------------------------------------------ medidas */
  const ySoleira = 0.14;
  const vigaAlt = Math.min(0.34, aC * 0.2);
  const vigaEsp = 0.5;
  const vigaBase = aC - vigaAlt;
  const bocaL = Math.min(L * 0.56, L - 1.3); // a boca é grande: mais da metade da largura
  const a = bocaL / 2; // meia largura da boca
  const yImposta = ySoleira + (vigaBase - ySoleira) * 0.5; // onde o arco nasce
  const flecha = Math.min(bocaL * 0.2, vigaBase - yImposta - 0.3);
  const R = (a * a + flecha * flecha) / (2 * flecha);
  const yCentro = yImposta + flecha - R;
  const phi = Math.asin(a / R);
  const yChave = yImposta + flecha; // ponto mais alto da boca
  const esp = Math.max(0.16, Math.min(0.3, vigaBase - 0.1 - yChave)); // espessura do anel de aduelas
  const zAnel = P - 0.32; // até onde as pedras da boca entram
  const yOmbro0 = Math.min(aC + 0.6, H - 1.3);
  const yOmbro1 = Math.min(yOmbro0 + 1.0, H - 0.2);
  const nDegraus = 4;
  const Lp = L * 0.64;
  const Pp = P * 0.66;
  const meiaLargura = (y: number) => {
    // a pele segue uma rampa reta nos ombros; as fiadas em degrau ficam por cima dela
    const ombro = Math.min(1, Math.max(0, (y - yOmbro0) / (yOmbro1 - yOmbro0)));
    const sapata = 0.035 * (1 - ss(0, 1.1, y));
    const afina = 0.035 * Math.max(0, (y - yOmbro1) / Math.max(0.5, H - yOmbro1));
    return L / 2 + sapata + (Lp / 2 - L / 2) * ombro - afina;
  };
  const profundidade = (y: number) => P + 0.02 * (1 - ss(0, 1.1, y)) + (Pp - P) * ss(yOmbro0, yOmbro1, y);

  /** Tira o prumo perfeito de toda a alvenaria (as mesmas ondas largas para a pele e para as pedras por cima). */
  const entortar = (p: THREE.Vector3) => {
    const k = ss(0.0, 0.3, p.z);
    p.x += (fbm3(p.y * 0.75 + semente, p.z * 0.6, 1.3, 2) - 0.5) * 0.07 * (0.4 + 0.6 * k);
    p.z += (fbm3(p.x * 0.7, p.y * 0.75 - semente, 4.4, 2) - 0.5) * 0.06 * k;
  };

  const dentroDaBoca = (x: number, y: number, folga: number) => {
    if (y > yChave + folga || Math.abs(x) > a + folga) return false;
    if (y < yImposta) return true;
    return Math.hypot(x, y - yCentro) < R + folga;
  };

  /** Fuligem: 0 limpo, 1 preto. Pluma larga subindo da boca pela frente, e forte no intradorso. */
  const fuligem = (p: THREE.Vector3) => {
    const sujo = 0.55 + 0.9 * fbm3(p.x * 2.3 + 5, p.y * 1.6, p.z * 2.3, 2);
    let f = 0;
    if (p.z > P - 0.5) {
      const dx = Math.abs(p.x) / (a * 1.15);
      const sobe = ss(yImposta - 0.1, yChave + 0.1, p.y);
      const some = 1 - ss(aC + 0.1, Math.min(H, aC + 2.3), p.y);
      f = Math.exp(-dx * dx * 1.5) * sobe * some * 0.8;
      // debaixo da viga a fumaça acumula
      if (p.y < vigaBase + 0.03 && p.y > yChave) f = Math.max(f, Math.exp(-dx * dx * 0.9) * 0.75);
    }
    // por dentro da boca (intradorso e faces internas dos pés-direitos)
    if (p.z < P - 0.03 && Math.abs(p.x) < a + 0.12 && p.y < yChave + esp) f = Math.max(f, 0.72 + 0.3 * ss(P, P - 0.3, p.z));
    return Math.min(1, f * sujo);
  };
  const vigaComp = L + 0.36;
  const sujar = (p: THREE.Vector3, cor: Cor3) => {
    const f = fuligem(p);
    let k = 1 - 0.86 * f;
    // pé da lareira um pouco mais sujo
    k *= 0.84 + 0.16 * ss(0.1, 0.7, p.y);
    // sombra da viga na pedra logo acima dela (a luz rebatida vem de baixo e não tem sombra): pintada, de borda irregular
    if (p.z > P - 0.25 && p.y > aC - 0.02 && Math.abs(p.x) < vigaComp / 2) {
      const borda = aC + 0.34 + 0.2 * fbm3(p.x * 2.1, 3.3, p.y * 1.5, 2);
      k *= 0.5 + 0.5 * ss(borda - 0.16, borda + 0.1, p.y);
    }
    cor[0] *= k;
    cor[1] *= k * (1 - 0.03 * f);
    cor[2] *= k * (1 - 0.06 * f);
  };

  /* ------------------------------------------------------------ texturas */
  const rep1: [number, number] = [1, 1];
  const [pedraBruta, pedraLisa, tijolo, cascaMapas, madeira, imgRelevo] = await Promise.all([
    loadPbr('rock_wall_10', { repeat: rep1, anisotropy: 8 }),
    loadPbr('rock_08', { repeat: rep1 }),
    loadPbr('brick_wall_10', { repeat: rep1 }),
    loadPbr('pine_bark', { repeat: rep1, maps: ['diff', 'nor'] }),
    loadPbr('rough_wood', { repeat: rep1 }),
    loadTexture('assets/texturas/rock_wall_10/disp.jpg'),
  ]);
  const altura01 = criarAmostrador(imgRelevo.image as CanvasImageSource, 256);
  imgRelevo.dispose();

  const root = new THREE.Group();
  root.name = 'lareira';
  const geometrias: THREE.BufferGeometry[] = [];
  const materiais: THREE.Material[] = [];
  const texturas: THREE.Texture[] = [];
  for (const conj of [pedraBruta, pedraLisa, tijolo, cascaMapas, madeira]) for (const t of Object.values(conj)) if (t && !texturas.includes(t)) texturas.push(t);
  /** Malha visível: recebe sombra, mas não projeta (quem projeta é a malha substituta, lá embaixo). */
  const malha = (geo: THREE.BufferGeometry, mat: THREE.Material, nome: string) => {
    const m = new THREE.Mesh(geo, mat);
    m.name = nome;
    m.castShadow = false;
    m.receiveShadow = true;
    geometrias.push(geo);
    if (!materiais.includes(mat)) materiais.push(mat);
    root.add(m);
    return m;
  };

  /* ---------------------------------------------------- pele de pedra bruta */
  const ladrilhoBruta = 1.8;
  const pele = peleDePedra({
    altura: H,
    meiaLargura,
    profundidade,
    raio: 0.1,
    passo: passoPele,
    passoAlto: { aPartirDe: yOmbro1, passo: passoPele * 1.75 },
    ladrilho: ladrilhoBruta,
    altura01,
    amplitude: 0.105,
    nivel: 0.55,
    deslocU: 0.37 + (semente % 5) * 0.11,
    deslocV: 0.21,
    furo: (x, y) => dentroDaBoca(x, y, 0.1),
    atenuar: (x, y, naFrente) => {
      let k = 1;
      // perto do anel da boca e dos cunhais o relevo baixa, para não atravessar as pedras lavradas
      if (naFrente && dentroDaBoca(x, y, esp + 0.1)) k = 0.4;
      const hw = meiaLargura(y);
      if (Math.abs(x) > hw - 0.34) k = Math.min(k, 0.55);
      // a viga encosta na pedra
      if (naFrente && y > vigaBase - 0.03 && y < aC + 0.02) k = Math.min(k, 0.3);
      return k;
    },
    pintar: (p, cor) => sujar(p, cor),
    entortar,
  });
  const matPele = new THREE.MeshStandardMaterial({ ...pedraBruta, roughness: 1, metalness: 0, vertexColors: true, color: '#f2e6d4', normalScale: new THREE.Vector2(1.0, 1.0), aoMapIntensity: 1 });
  variarRugosidade(matPele, 0.7);
  malha(pele, matPele, 'pele-de-pedra');

  /* ------------------------------------------- pedras lavradas (uma a uma) */
  const blocos: THREE.BufferGeometry[] = [];
  const tomPedra = (): Cor3 => {
    // cada pedra tem o seu tom: valor bem variado, umas ocres, outras rosadas e, de vez em quando, uma cinzenta e fria
    const v = 0.62 + rng() * 0.5;
    const q = rng() < 0.17 ? -0.1 - rng() * 0.06 : (rng() - 0.35) * 0.16;
    return [v * (1.0 + q), v * (0.97 + q * 0.2), v * (0.92 - q)];
  };
  interface PedraExtra {
    raio?: number;
    raios?: [number, number, number];
    relevo?: number;
    quebra?: number;
    lascas?: number;
    cor?: Cor3;
    maxSeg?: number;
    passo?: number;
    moldar?: (p: THREE.Vector3, f: THREE.Vector3) => void;
  }
  const pedra = (cantos: THREE.Vector3[], extra: PedraExtra = {}) => {
    blocos.push(
      blocoIrregular({
        cantos,
        semente: rng() * 1000,
        raio: extra.raio ?? 0.026,
        raios: extra.raios,
        relevo: extra.relevo ?? 0.01,
        quebra: extra.quebra ?? 0.7,
        lascas: extra.lascas,
        passo: extra.passo ?? passoBloco,
        maxSeg: extra.maxSeg ?? 8,
        ladrilho: 1.25,
        cor: extra.cor ?? tomPedra(),
        pintar: sujar,
        entortar,
        moldar: extra.moldar,
      }),
    );
  };

  // aduelas do arco: fatias do anel de larguras bem diferentes, com a chave mais alta e mais saliente
  const nAduelas = Math.max(7, 2 * Math.round((2 * phi * R) / 0.5) + 1);
  const meioArco = (nAduelas - 1) / 2;
  const pesos: number[] = [];
  for (let k = 0; k < nAduelas; k++) pesos.push(k === meioArco ? 1.25 : 0.7 + rng() * 0.7);
  const somaPesos = pesos.reduce((s, v) => s + v, 0);
  let ang = -phi;
  const junta = 0.004;
  const pontoArco = (raio: number, t: number): [number, number] => [raio * Math.sin(t), yCentro + raio * Math.cos(t)];
  for (let k = 0; k < nAduelas; k++) {
    const a0 = ang;
    const a1 = ang + (2 * phi * pesos[k]) / somaPesos;
    ang = a1;
    const chave = k === meioArco;
    const e = chave ? Math.min(esp + 0.14, vigaBase - 0.03 - yChave) : esp * (0.84 + rng() * 0.2);
    const sai = chave ? 0.09 : 0.03 + rng() * 0.026;
    const g0 = a0 + junta;
    const g1 = a1 - junta;
    const q: Array<[number, number]> = [pontoArco(R, g0), pontoArco(R, g1), pontoArco(R + e, g0 - (chave ? 0.014 : 0)), pontoArco(R + e, g1 + (chave ? 0.014 : 0))];
    // saiméis: a base assenta na horizontal sobre o pé-direito
    if (k === 0) {
      q[0] = [-a, yImposta + 0.005];
      q[2] = [-(a + e * 1.08), yImposta + 0.005];
    }
    if (k === nAduelas - 1) {
      q[1] = [a, yImposta + 0.005];
      q[3] = [a + e * 1.08, yImposta + 0.005];
    }
    // juntas estreitas entre as aduelas (chanfro pequeno nas arestas das faces laterais) e quina mais gasta na frente do intradorso
    pedra(cantosDeQuad(q, zAnel, P + sai), { raios: [0.028, 0.012, 0.012], relevo: 0.008, lascas: 0.22 });
  }
  // pés-direitos: dois blocos de cada lado
  const larguraPe = Math.min(0.34, (L / 2 - a) * 0.5);
  for (const lado of [-1, 1]) {
    const y1 = ySoleira + (yImposta - ySoleira) * (0.52 + (rng() - 0.5) * 0.14);
    const wBaixo = larguraPe * (0.88 + rng() * 0.12);
    const wCima = larguraPe * (0.96 + rng() * 0.12);
    const espelha = (q: Array<[number, number]>): Array<[number, number]> => (lado > 0 ? q : [[-q[1][0], q[1][1]], [-q[0][0], q[0][1]], [-q[3][0], q[3][1]], [-q[2][0], q[2][1]]]);
    pedra(
      cantosDeQuad(
        espelha([
          [a, ySoleira - 0.02],
          [a + wBaixo, ySoleira - 0.02],
          [a, y1 - 0.005],
          [a + wBaixo - 0.02, y1 - 0.005],
        ]),
        zAnel,
        P + 0.045 + rng() * 0.015,
      ),
      { raio: 0.024 },
    );
    pedra(
      cantosDeQuad(
        espelha([
          [a, y1 + 0.005],
          [a + wCima, y1 + 0.005],
          [a, yImposta - 0.005],
          [a + wCima + 0.015, yImposta - 0.005],
        ]),
        zAnel,
        P + 0.035 + rng() * 0.015,
      ),
      { raio: 0.022 },
    );
  }
  // cunhais: pedras de quina alternando a face comprida entre a frente e o lado
  const cunhais = (yIni: number, yFim: number) => {
    for (const lado of [-1, 1]) {
      let y = yIni;
      let comprida = lado > 0;
      while (y < yFim - 0.02) {
        let h = 0.25 + rng() * 0.12;
        if (yFim - (y + h) < 0.2) h = yFim - y;
        const y0 = y + 0.005;
        const y1 = y + h - 0.005;
        // ao lado da boca sobra pouco pano de pedra: as pedras de quina não podem invadir os pés-direitos nem o arco
        const livre = y0 < vigaBase ? L / 2 - (a + larguraPe + 0.06) - (y1 > yImposta ? 0.02 : 0) : 0.6;
        const naFrente = Math.min(livre, comprida ? 0.44 + rng() * 0.12 : 0.24 + rng() * 0.06);
        const noLado = comprida ? 0.23 + rng() * 0.06 : 0.42 + rng() * 0.1;
        const sai = 0.04 + rng() * 0.02;
        const c: THREE.Vector3[] = [];
        for (const iz of [0, 1])
          for (const yy of [y0, y1]) {
            const hw = meiaLargura(yy);
            const d = profundidade(yy);
            const z = iz ? d + sai : Math.max(0.02, d - noLado);
            const xDentro = hw - naFrente;
            const xFora = hw + sai;
            if (lado > 0) c.push(new THREE.Vector3(xDentro, yy, z), new THREE.Vector3(xFora, yy, z));
            else c.push(new THREE.Vector3(-xFora, yy, z), new THREE.Vector3(-xDentro, yy, z));
          }
        pedra(c, { raio: 0.03, relevo: 0.012, quebra: 0.9, lascas: 0.4 });
        y += h;
        comprida = !comprida;
      }
    }
  };
  cunhais(ySoleira - 0.02, yOmbro0);
  cunhais(yOmbro1, H);
  // ombros: fiadas horizontais em degrau; cada degrau termina em uma pedra de capa mais larga
  const hDegrau = (yOmbro1 - yOmbro0) / nDegraus;
  for (const lado of [-1, 1])
    for (let k = 0; k < nDegraus; k++) {
      const yb = yOmbro0 + k * hDegrau;
      const yt = yb + hDegrau;
      const capa = 0.09 + rng() * 0.025;
      const xFora = meiaLargura(yb) + 0.045 + rng() * 0.015;
      const xDentroCorpo = meiaLargura(yt) - 0.3;
      const zFrente = profundidade(yb) + 0.045 + rng() * 0.015;
      const zCorte = zFrente * (0.42 + rng() * 0.2); // duas pedras por fiada, de comprimentos diferentes
      const caixa = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) => (lado > 0 ? caixaCantos(x0, x1, y0, y1, z0, z1) : caixaCantos(-x1, -x0, y0, y1, z0, z1));
      for (const [z0, z1] of [
        [0.02, zCorte - 0.005],
        [zCorte + 0.005, zFrente],
      ]) {
        pedra(caixa(xDentroCorpo, xFora - rng() * 0.02, yb + 0.005, yt - capa - 0.005, z0, z1), { raio: 0.03, relevo: 0.012, quebra: 0.9, lascas: 0.4 });
      }
      const zCorte2 = zFrente * (0.4 + rng() * 0.25);
      for (const [z0, z1] of [
        [0.02, zCorte2 - 0.005],
        [zCorte2 + 0.005, zFrente + 0.04],
      ]) {
        pedra(caixa(meiaLargura(yt) - 0.26, xFora + 0.035 + rng() * 0.02, yt - capa, yt - 0.004, z0, z1), { raio: 0.03, relevo: 0.014, quebra: 1, lascas: 0.45, maxSeg: 12 });
      }
    }
  // mísulas de pedra que seguram a viga: corpo de perfil curvo (um quarto de círculo) e um ábaco reto por cima
  const xMisula = Math.min(L / 2 - 0.3, a + 0.5);
  const zVigaFrente = P - 0.1 + vigaEsp;
  for (const lado of [-1, 1]) {
    const x = lado * xMisula;
    const topoCorpo = vigaBase - 0.09;
    const altCorpo = 0.27;
    const zTras = P - 0.12;
    const zCheio = zVigaFrente - 0.09;
    pedra(caixaCantos(x - 0.13, x + 0.13, topoCorpo - altCorpo, topoCorpo - 0.004, zTras, zCheio), {
      raio: 0.022,
      relevo: 0.006,
      lascas: 0.15,
      passo: 0.045,
      maxSeg: 10,
      moldar: (p, f) => {
        // a frente recua de cima para baixo em quarto de círculo
        const t = 1 - f.y;
        const zFrente = P + 0.03 + (zCheio - P - 0.03) * Math.sqrt(Math.max(0, 1 - t * t));
        p.z = zTras + (p.z - zTras) * ((zFrente - zTras) / (zCheio - zTras));
      },
    });
    pedra(caixaCantos(x - 0.165, x + 0.165, topoCorpo + 0.004, vigaBase - 0.004, zTras, zVigaFrente - 0.045), { raio: 0.024, relevo: 0.006, lascas: 0.3 });
  }
  // argamassa no fundo das juntas do arco e dos pés-direitos: recuada, escura de fuligem, nunca à frente das pedras
  const argamassa = (p: THREE.Vector3): Cor3 => {
    const cor: Cor3 = [0.2, 0.185, 0.17];
    sujar(p, cor);
    return cor;
  };
  const quadSujo = (p00: THREE.Vector3, p10: THREE.Vector3, p01: THREE.Vector3, p11: THREE.Vector3) => blocos.push(quad(p00, p10, p01, p11, [argamassa(p00), argamassa(p10), argamassa(p01), argamassa(p11)], 1.25));
  const nSeg = 28;
  const zArgamassa = P + 0.012;
  for (let k = 0; k < nSeg; k++) {
    const t0 = -phi + (2 * phi * k) / nSeg;
    const t1 = -phi + (2 * phi * (k + 1)) / nSeg;
    const v = (raio: number, t: number, z: number) => {
      const [x, y] = pontoArco(raio, t);
      const p = new THREE.Vector3(x, y, z);
      entortar(p);
      return p;
    };
    // de frente, atrás do chanfro das aduelas; e por baixo, dentro das juntas (3,5 cm acima do intradorso)
    quadSujo(v(R + 0.04, t0, zArgamassa), v(R + 0.04, t1, zArgamassa), v(R + esp * 0.8, t0, zArgamassa), v(R + esp * 0.8, t1, zArgamassa));
    quadSujo(v(R + 0.035, t1, zArgamassa), v(R + 0.035, t0, zArgamassa), v(R + 0.035, t1, zAnel), v(R + 0.035, t0, zAnel));
  }
  for (const lado of [-1, 1]) {
    const v = (x: number, y: number, z: number) => {
      const p = new THREE.Vector3(lado * x, y, z);
      entortar(p);
      return p;
    };
    const frente = [v(a + 0.03, ySoleira, zArgamassa), v(a + larguraPe * 0.8, ySoleira, zArgamassa), v(a + 0.03, yImposta + 0.05, zArgamassa), v(a + larguraPe * 0.8, yImposta + 0.05, zArgamassa)];
    const dentro = [v(a + 0.03, ySoleira, zAnel), v(a + 0.03, ySoleira, zArgamassa), v(a + 0.03, yImposta + 0.05, zAnel), v(a + 0.03, yImposta + 0.05, zArgamassa)];
    if (lado > 0) {
      quadSujo(frente[0], frente[1], frente[2], frente[3]);
      quadSujo(dentro[0], dentro[1], dentro[2], dentro[3]);
    } else {
      quadSujo(frente[1], frente[0], frente[3], frente[2]);
      quadSujo(dentro[1], dentro[0], dentro[3], dentro[2]);
    }
  }
  const geoBlocos = mergeGeometries(blocos, false)!;
  for (const g of blocos) g.dispose();
  const matBlocos = new THREE.MeshStandardMaterial({ ...pedraLisa, roughness: 0.92, metalness: 0, vertexColors: true, color: '#c4b7a6', normalScale: new THREE.Vector2(1.15, 1.15) });
  variarRugosidade(matBlocos, 0.66);
  malha(geoBlocos, matBlocos, 'pedras-lavradas');

  /* ----------------------------------------------------------- soleira */
  const lajes: THREE.BufferGeometry[] = [];
  const xS = L / 2 + 0.34;
  const zS = P + 0.86;
  const fileiras: Array<[number, number, number]> = [
    [0.0, P - 0.36, 4],
    [P - 0.36, P + 0.14, 5],
    [P + 0.14, zS, 4],
  ];
  const cinzaNoChao = (p: THREE.Vector3, cor: Cor3) => {
    // dentro da câmara o chão é preto de fuligem; na frente da boca, um leque de cinza e fuligem
    const dentro = ss(P - 0.2, P - 0.4, p.z) * (Math.abs(p.x) < a + 0.1 ? 1 : 0);
    const dz = Math.max(0, p.z - (P - 0.2));
    const leque = Math.exp(-(p.x * p.x) / (0.6 + dz * 0.9)) * Math.exp(-dz * 1.5) * (0.45 + 0.8 * fbm3(p.x * 6, 2, p.z * 6, 2));
    const k = 1 - Math.min(0.85, 0.85 * dentro + 0.68 * leque);
    cor[0] *= k;
    cor[1] *= k;
    cor[2] *= k;
  };
  fileiras.forEach(([z0, z1, nCol], fi) => {
    // larguras sorteadas, com as juntas desencontradas entre as fileiras
    const cortes: number[] = [-xS];
    for (let k = 1; k < nCol; k++) cortes.push(-xS + (2 * xS * (k + (rng() - 0.5) * 0.5 + (fi % 2) * 0.25)) / nCol);
    cortes.push(xS);
    for (let k = 0; k < nCol; k++) {
      const x0 = cortes[k] + 0.006 - (k === 0 ? rng() * 0.03 : 0);
      const x1 = cortes[k + 1] - 0.006 + (k === nCol - 1 ? rng() * 0.03 : 0);
      const zFim = z1 - 0.006 + (fi === 2 ? rng() * 0.035 : 0);
      const topo = ySoleira + (rng() - 0.5) * 0.012;
      const tom = 0.8 + rng() * 0.28;
      lajes.push(
        blocoIrregular({
          cantos: caixaCantos(x0, x1, 0.001, topo, z0 + 0.006, zFim),
          semente: rng() * 1000,
          raio: 0.02,
          relevo: 0.0055,
          quebra: 0.8,
          lascas: 0.35,
          passo: passoBloco * 1.2,
          maxSeg: 10,
          ladrilho: 1.5,
          cor: [tom * 0.95, tom * 0.97, tom],
          pintar: cinzaNoChao,
        }),
      );
    }
  });
  // leito de argamassa sob as lajes (aparece só no fundo das juntas)
  const leitoLajes = new THREE.BoxGeometry(2 * xS - 0.06, ySoleira - 0.035, zS - 0.04);
  leitoLajes.translate(0, (ySoleira - 0.035) / 2 + 0.001, zS / 2);
  const nLeito = leitoLajes.getAttribute('position').count;
  leitoLajes.setAttribute('color', new THREE.BufferAttribute(new Float32Array(nLeito * 3).fill(0.2), 3));
  leitoLajes.setAttribute('aGasto', new THREE.BufferAttribute(new Float32Array(nLeito).fill(1), 1));
  leitoLajes.clearGroups();
  lajes.push(leitoLajes);
  const geoLajes = mergeGeometries(lajes, false)!;
  for (const g of lajes) g.dispose();
  // a laje fica rente à luz do fogo e de frente para quem olha: com o brilho comum da pedra, o reflexo
  // rasante estoura mais que a chama. Pedra fosca de cinza e fuligem: quase sem brilho especular.
  const matLajes = new THREE.MeshPhysicalMaterial({ ...pedraLisa, roughness: 1, metalness: 0, vertexColors: true, color: '#77726c', normalScale: new THREE.Vector2(0.75, 0.75), specularIntensity: 0.3 });
  variarRugosidade(matLajes, 0.94);
  malha(geoLajes, matLajes, 'soleira');

  /* ------------------------------------------------- câmara de tijolo */
  const zf = P - 0.3; // plano da frente da câmara (logo atrás das pedras da boca)
  const zb = 0.1;
  const wf = a + 0.07;
  const wb = a * 0.72;
  const yTopoCamara = Math.min(vigaBase + 0.05, yChave + 0.3);
  const larguraFogo = 2 * wb - 0.1;
  const alturaFogo = Math.min(1.0, (yChave - ySoleira) * 0.88);
  // o fundo só começa a inclinar para a frente acima do topo das chamas
  const yInclina = Math.min(yTopoCamara - 0.08, Math.max(ySoleira + (yTopoCamara - ySoleira) * 0.5, ySoleira + alturaFogo + 0.2));
  const avancoFundo = Math.min(0.3, (zf - zb) * 0.5);
  const zFundo = (y: number) => zb + Math.max(0, (y - yInclina) / (yTopoCamara - yInclina)) * avancoFundo;
  const zFogo = (zf + zb) / 2 + 0.045;
  const cp: number[] = [];
  const cu: number[] = [];
  const cc: number[] = [];
  const cg: number[] = [];
  const ci: number[] = [];
  const ladT = 1.5; // ladrilho do tijolo, um pouco menor que o real para os tijolos lerem bem no escuro
  const corCamara = (x: number, y: number, z: number): Cor3 => {
    // fornalha usada: preto pesado no alto e nos cantos, e uma mancha calcinada, clara e amarelada, só atrás do fogo
    const alto = ss(ySoleira + 0.1, yTopoCamara, y);
    const canto = ss(wb * 0.5, wb * 1.05, Math.abs(x)) * ss(zf, zb, z);
    const limpo = Math.exp(-((x * x) / (0.16 * larguraFogo) + (y - ySoleira - 0.3) ** 2 / 0.1)) * ss(zb + 0.35, zb, z);
    const sujo = 0.55 + 0.9 * fbm3(x * 3, y * 3, z * 3, 2);
    const k = Math.max(0.03, (0.38 - 0.35 * alto) * sujo * (1 - 0.6 * canto));
    return [k * 0.98 + 0.5 * limpo, k * 0.95 + 0.42 * limpo, k * 0.9 + 0.3 * limpo];
  };
  const vert = (x: number, y: number, z: number, u: number, v: number) => {
    cp.push(x, y, z);
    cu.push(u / ladT, v / ladT);
    cc.push(...corCamara(x, y, z));
    cg.push(1 - 0.9 * ss(ySoleira + 0.3, yTopoCamara, y)); // fuligem acetinada no alto
    return cp.length / 3 - 1;
  };
  const nyC = 12;
  const nxC = 10;
  const nzC = 6;
  const y0C = ySoleira - 0.03;
  const grade = (linhas: number, colunas: number, f: (i: number, j: number) => [number, number, number, number, number], inverter: boolean) => {
    const ids: number[] = [];
    for (let j = 0; j <= linhas; j++) for (let i = 0; i <= colunas; i++) ids.push(vert(...f(i, j)));
    for (let j = 0; j < linhas; j++)
      for (let i = 0; i < colunas; i++) {
        const p0 = ids[j * (colunas + 1) + i];
        const p1 = p0 + 1;
        const p2 = ids[(j + 1) * (colunas + 1) + i];
        const p3 = p2 + 1;
        if (inverter) ci.push(p0, p2, p1, p1, p2, p3);
        else ci.push(p0, p1, p2, p1, p3, p2);
      }
  };
  // fundo
  grade(nyC, nxC, (i, j) => {
    const y = y0C + ((yTopoCamara - y0C) * j) / nyC;
    const x = -wb + (2 * wb * i) / nxC;
    return [x, y, zFundo(y), x + 0.13, y + 0.02];
  }, false);
  // lados, abertos em leque do fundo para a frente (fiadas desencontradas das do fundo)
  for (const lado of [-1, 1])
    grade(nyC, nzC, (i, j) => {
      const y = y0C + ((yTopoCamara - y0C) * j) / nyC;
      const t = i / nzC;
      const zB = zFundo(y);
      const x = lado * (wb + (wf - wb) * t);
      const z = zB + (zf - zB) * t;
      return [x, y, z, 3.37 + lado * 1.21 + t * Math.hypot(wf - wb, zf - zB), y + 0.035 + lado * 0.3];
    }, lado < 0);
  // teto (garganta escura)
  grade(2, nxC, (i, j) => {
    const t = j / 2;
    const zB = zFundo(yTopoCamara);
    const w = wb + (wf - wb) * t;
    const x = -w + (2 * w * i) / nxC;
    return [x, yTopoCamara, zB + (zf - zB) * t, x, 7 + t];
  }, false);
  const geoCamara = new THREE.BufferGeometry();
  geoCamara.setAttribute('position', new THREE.Float32BufferAttribute(cp, 3));
  geoCamara.setAttribute('uv', new THREE.Float32BufferAttribute(cu, 2));
  geoCamara.setAttribute('color', new THREE.Float32BufferAttribute(cc, 3));
  geoCamara.setAttribute('aGasto', new THREE.Float32BufferAttribute(cg, 1));
  geoCamara.setIndex(ci);
  geoCamara.computeVertexNormals();
  const matCamara = new THREE.MeshStandardMaterial({ ...tijolo, roughness: 1, metalness: 0, vertexColors: true, color: '#a8948a', normalScale: new THREE.Vector2(1.15, 1.15) });
  variarRugosidade(matCamara, 0.74);
  malha(geoCamara, matCamara, 'camara');

  /* ---------------------------------------------------------------- viga */
  const zViga = P - 0.1 + vigaEsp / 2;
  const viga = vigaLavrada({
    comprimento: vigaComp,
    altura: vigaAlt,
    espessura: vigaEsp,
    semente,
    passo: nivel === 'alta' ? 0.04 : nivel === 'media' ? 0.065 : 0.1,
    pintar: (p, cor) => {
      // fuligem por baixo e na frente, acima da boca
      const dx = Math.abs(p.x) / (a * 1.2);
      const baixo = ss(0.02, -vigaAlt * 0.45, p.y);
      const f = Math.exp(-dx * dx * 1.2) * (0.12 + 0.88 * baixo) * (0.5 + 0.8 * fbm3(p.x * 3, p.y * 5, p.z * 5, 2)) * 0.8;
      const k = 1 - Math.min(0.85, f);
      cor[0] *= k;
      cor[1] *= k;
      cor[2] *= k;
    },
  });
  viga.corpo.translate(0, vigaBase + vigaAlt / 2, zViga);
  viga.topos.translate(0, vigaBase + vigaAlt / 2, zViga);
  const matViga = new THREE.MeshStandardMaterial({ ...madeira, roughness: 0.8, metalness: 0, vertexColors: true, color: '#d9a56e', normalScale: new THREE.Vector2(1.4, 1.4) });
  variarRugosidade(matViga, 0.6);
  malha(viga.corpo, matViga, 'viga');

  /* ------------------------------------------- ferro, lenha, cinzas, fogo */
  const centroFogo = new THREE.Vector3(0, ySoleira + 0.3, zFogo);
  const bocaDoFogo = new THREE.Vector3(0, ySoleira + 0.4, zFogo);
  const xCao = Math.min(0.42, wb - 0.14);
  const zCao = zf + 0.07; // as colunas ficam no vão da boca, à frente da lenha
  const geoFerro = criarCaesDeFerro([-xCao, xCao], ySoleira, zCao, zb + 0.1, 0.5, nivel === 'baixa' ? 8 : 14);
  const matFerro = new THREE.MeshStandardMaterial({ color: '#1c1917', roughness: 0.68, metalness: 0.6 });
  malha(geoFerro, matFerro, 'caes-de-ferro');

  // pilha de lenha: cada acha apoiada na de baixo
  const yBarra = ySoleira + 0.125 + 0.0135;
  const comp = Math.min(1.12, larguraFogo - 0.06);
  const rTras = 0.105;
  const rFrente = 0.115;
  const zTras = zFogo - 0.135;
  const zFrenteLenha = Math.min(zFogo + 0.125, zCao - 0.04 - rFrente);
  const rCima = 0.125;
  const yVale = yBarra + rFrente * 0.92; // onde o quarto de cima encosta, no vale entre as duas de baixo
  const achas: AchaDef[] = [
    // tora roliça grossa atrás, deitada nas barras
    { raio: rTras, comprimento: comp, abertura: Math.PI * 2, posicao: new THREE.Vector3(0.03, yBarra + rTras * 0.97, zTras), rotacao: new THREE.Euler(1.3, -0.06, -0.02), carvao: 0.7, brasa: 0.9, semente: semente + 2 },
    // meia tora na frente, com a face de racha para baixo, assentada nas barras
    { raio: rFrente, comprimento: comp * 0.9, abertura: Math.PI, posicao: new THREE.Vector3(-0.05, yBarra + rFrente * 0.42, zFrenteLenha), rotacao: new THREE.Euler(0.06, 0.1, 0.015), carvao: 0.45, brasa: 0.6, semente: semente + 1 },
    // um quarto por cima, atravessado em diagonal: a quina do miolo encaixa no vale e uma ponta fica mais alta
    { raio: rCima, comprimento: comp * 0.78, abertura: Math.PI / 2, posicao: new THREE.Vector3(0.06, yVale + rCima * 0.6 + 0.012, zFogo + 0.005), rotacao: new THREE.Euler(0.28, -0.46, -0.1), carvao: 0.6, brasa: 0.75, semente: semente + 3 },
    // uma acha fina de pé, apoiada no chão da câmara e encostada por cima da tora de trás
    { raio: 0.085, comprimento: 0.66, abertura: Math.PI / 2, posicao: new THREE.Vector3(-Math.min(0.41, wb - 0.2), ySoleira + 0.33, zTras + 0.05), rotacao: new THREE.Euler(0.7, 0.521, 1.178, 'ZYX'), carvao: 0.55, brasa: 0.4, semente: semente + 4 },
    // um resto quase todo carvão caído nas cinzas
    { raio: 0.06, comprimento: 0.34, abertura: Math.PI, posicao: new THREE.Vector3(0.17, ySoleira + 0.062, zFogo + 0.06), rotacao: new THREE.Euler(0.2, 0.9, 0.05), carvao: 1, brasa: 1, semente: semente + 5 },
  ];
  const zona = { centro: centroFogo, alcance: new THREE.Vector3(larguraFogo * 0.46, 0.4, 0.36) };
  const cascas: THREE.BufferGeometry[] = [];
  const lenhos: THREE.BufferGeometry[] = [];
  const topos: THREE.BufferGeometry[] = [viga.topos];
  const origemFogo = new THREE.Vector3(0, ySoleira, zFogo);
  const segmentos: SegmentoDeLenha[] = [];
  for (const def of achas) {
    const acha = criarAcha(def, zona, segLenha);
    cascas.push(acha.casca);
    if (acha.lenho) lenhos.push(acha.lenho);
    topos.push(acha.topos);
    // só a lenha deitada alimenta as chamas (a acha de pé, encostada, fica fora do miolo)
    if (Math.abs(acha.segmento.a.y - acha.segmento.b.y) < 0.2) segmentos.push({ a: acha.segmento.a.sub(origemFogo), b: acha.segmento.b.sub(origemFogo), raio: acha.segmento.raio, alto: acha.segmento.alto });
  }
  const geoCascas = mergeGeometries(cascas, false)!;
  const geoLenhos = mergeGeometries(lenhos, false)!;
  const geoTopos = mergeGeometries(topos, false)!;
  for (const g of [...cascas, ...lenhos, ...topos]) g.dispose();
  const uBrasa = { uTempo: { value: 0 }, uBrasa: { value: 1 } };
  // madeira e carvão quase sem reflexo especular: sob a luz rasante da câmara, o brilho de Fresnel deixava a
  // lenha cinza-clara, com cara de bétula; carvão de verdade é preto aveludado
  const matCasca = new THREE.MeshPhysicalMaterial({ ...cascaMapas, roughness: 0.92, metalness: 0, vertexColors: true, color: '#6e6258', normalScale: new THREE.Vector2(1.5, 1.5), specularIntensity: 0.22 });
  queimarMaterial(matCasca, uBrasa, { escala: 46, saturacao: 0.5, cinza: 0.18 });
  malha(geoCascas, matCasca, 'lenha-casca');
  const matLenho = new THREE.MeshPhysicalMaterial({ ...madeira, roughness: 0.9, metalness: 0, vertexColors: true, color: '#a88a68', normalScale: new THREE.Vector2(1.6, 1.6), specularIntensity: 0.22 });
  queimarMaterial(matLenho, uBrasa, { escala: 46, saturacao: 0.75, cinza: 0.18 });
  malha(geoLenhos, matLenho, 'lenha-racha');
  const texAneis = criarTexturaAneis(semente + 31, nivel === 'baixa' ? 128 : 256);
  texturas.push(texAneis);
  const matTopos = new THREE.MeshPhysicalMaterial({ map: texAneis, roughness: 0.86, metalness: 0, vertexColors: true, color: '#c9b49a', specularIntensity: 0.3 });
  queimarMaterial(matTopos, uBrasa, { escala: 40, saturacao: 0.85, cinza: 0.2 });
  malha(geoTopos, matTopos, 'topos-da-madeira');

  const geoLeito = criarLeito(new THREE.Vector3(0, ySoleira, zFogo + 0.03), Math.min(2 * wb + 0.25, larguraFogo + 0.3), zf - zb + 0.12, semente + 17, nivel === 'alta' ? 1 : nivel === 'media' ? 0.75 : 0.5);
  const matLeito = new THREE.MeshPhysicalMaterial({ roughness: 1, metalness: 0, vertexColors: true, color: '#d8d4cf', specularIntensity: 0.35 });
  queimarMaterial(matLeito, uBrasa, { escala: 46, cinza: 0.5, grao: 1.2, luzDaBrasa: 0.6 });
  malha(geoLeito, matLeito, 'cinzas-e-carvoes');

  const fogo = criarFogo(ctx, {
    largura: larguraFogo,
    altura: alturaFogo,
    profundidade: Math.min(0.5, zf - zb - 0.04),
    semente: semente + 3,
    alcanceMagia: 2.4,
    lenha: segmentos,
    fundo: { z0: zb - zFogo, yInclina: yInclina - ySoleira, inclinacao: avancoFundo / (yTopoCamara - yInclina) },
    lados: { x0: wb, abertura: (wf - wb) / (zf - zb) },
    teto: yTopoCamara - ySoleira,
  });
  fogo.root.position.copy(origemFogo);
  for (const o of fogo.root.children) o.userData.semAO = true;
  root.add(fogo.root);

  /* ---------------------------------------- quem projeta sombra: malha substituta */
  {
    const partes: THREE.BufferGeometry[] = [];
    const soPosicao = (g: THREE.BufferGeometry) => {
      const s = g.index ? g.toNonIndexed() : g;
      for (const nome of Object.keys(s.attributes)) if (nome !== 'position') s.deleteAttribute(nome);
      return s;
    };
    // frente do corpo, com o vão da boca aberto (a luz do fogo só sai por ali)
    const frente = new THREE.Shape();
    frente.moveTo(-L / 2, 0);
    frente.lineTo(L / 2, 0);
    frente.lineTo(L / 2, yOmbro0);
    frente.lineTo(-L / 2, yOmbro0);
    frente.closePath();
    const vao = new THREE.Path();
    const av = a + 0.02;
    vao.moveTo(-av, ySoleira);
    vao.lineTo(-av, yImposta);
    for (let k = 1; k < 8; k++) {
      const t = -phi + (2 * phi * k) / 8;
      vao.lineTo((R + 0.02) * Math.sin(t), yCentro + (R + 0.02) * Math.cos(t));
    }
    vao.lineTo(av, yImposta);
    vao.lineTo(av, ySoleira);
    vao.closePath();
    frente.holes.push(vao);
    const gFrente = new THREE.ShapeGeometry(frente);
    gFrente.translate(0, 0, P - 0.04);
    partes.push(soPosicao(gFrente));
    // ombros e peito da chaminé
    const peito = new THREE.Shape();
    peito.moveTo(-L / 2, yOmbro0);
    peito.lineTo(L / 2, yOmbro0);
    peito.lineTo(Lp / 2, yOmbro1);
    peito.lineTo(Lp / 2, H);
    peito.lineTo(-Lp / 2, H);
    peito.lineTo(-Lp / 2, yOmbro1);
    peito.closePath();
    const gPeito = new THREE.ShapeGeometry(peito);
    gPeito.translate(0, 0, Pp - 0.03);
    partes.push(soPosicao(gPeito));
    for (const lado of [-1, 1]) {
      const baixo = new THREE.PlaneGeometry(P, yOmbro0);
      baixo.rotateY(Math.PI / 2);
      baixo.translate((lado * L) / 2, yOmbro0 / 2, P / 2);
      partes.push(soPosicao(baixo));
      const alto = new THREE.PlaneGeometry(Pp, H - yOmbro0);
      alto.rotateY(Math.PI / 2);
      alto.translate((lado * (L + Lp)) / 4, (H + yOmbro0) / 2, Pp / 2);
      partes.push(soPosicao(alto));
    }
    // viga e soleira
    const gViga = new THREE.BoxGeometry(vigaComp, vigaAlt, vigaEsp);
    gViga.translate(0, vigaBase + vigaAlt / 2, zViga);
    partes.push(soPosicao(gViga));
    const gSoleira = new THREE.BoxGeometry(2 * xS, ySoleira, zS - P);
    gSoleira.translate(0, ySoleira / 2, (zS + P) / 2);
    partes.push(soPosicao(gSoleira));
    const geoSombra = mergeGeometries(partes, false)!;
    for (const g of partes) g.dispose();
    const matSombra = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, side: THREE.DoubleSide });
    const sombra = new THREE.Mesh(geoSombra, matSombra);
    sombra.name = 'sombra-substituta';
    sombra.castShadow = true;
    sombra.receiveShadow = false;
    sombra.userData.semAO = true;
    geometrias.push(geoSombra);
    materiais.push(matSombra);
    root.add(sombra);
  }

  /* ------------------------------ sombra de contato pintada na parede (opcional) */
  if (opcoes.sombraNaParede ?? true) {
    const pos: number[] = [];
    const cor: number[] = [];
    const idx: number[] = [];
    const larguraSombra = 0.34;
    const nY = 28;
    for (const lado of [-1, 1]) {
      const base = pos.length / 3;
      for (let j = 0; j <= nY; j++) {
        const y = (H * j) / nY;
        const hw = meiaLargura(y);
        // mais escura junto do chão e sob os ombros
        const forca = 0.5 + 0.1 * ss(1.2, 0, y) + 0.08 * ss(yOmbro0 - 0.6, yOmbro0, y) * (1 - ss(yOmbro0, yOmbro1, y));
        for (const [dx, k] of [
          [-0.12, 1 - forca],
          [0.03, 1 - forca],
          [larguraSombra * 0.45, 1 - forca * 0.35],
          [larguraSombra, 1],
        ]) {
          pos.push(lado * (hw + dx), y, 0.004);
          cor.push(k, k * 0.985, k * 0.97);
        }
      }
      for (let j = 0; j < nY; j++)
        for (let i = 0; i < 3; i++) {
          const p0 = base + j * 4 + i;
          const p1 = p0 + 1;
          const p2 = p0 + 4;
          const p3 = p2 + 1;
          if (lado > 0) idx.push(p0, p1, p2, p1, p3, p2);
          else idx.push(p0, p2, p1, p1, p2, p3);
        }
    }
    const geoParede = new THREE.BufferGeometry();
    geoParede.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geoParede.setAttribute('color', new THREE.Float32BufferAttribute(cor, 3));
    geoParede.setIndex(idx);
    const matParede = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      fog: false,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.DstColorFactor,
      blendDst: THREE.ZeroFactor,
      blendSrcAlpha: THREE.ZeroFactor,
      blendDstAlpha: THREE.OneFactor,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const parede = new THREE.Mesh(geoParede, matParede);
    parede.name = 'sombra-na-parede';
    parede.renderOrder = 1;
    parede.userData.semAO = true;
    geometrias.push(geoParede);
    materiais.push(matParede);
    root.add(parede);
  }

  /* --------------------------------------------------------------- luzes */
  // a luz da sala é âmbar pouco saturado (a cor de cada pedra aparece); o vermelho fica dentro da câmara
  const COR_FOGO = new THREE.Color('#ffab66');
  const COR_MAGIA = new THREE.Color('#ffc878');
  // principal: na boca, à frente da lenha (as toras ficam atrás do cone e não são lavadas de luz à
  // queima-roupa) e rente à soleira: com a sombra ligada, a borda da soleira corta o começo do piso, que
  // é onde o reflexo rasante de uma luz pontual num piso encerado estouraria em branco; o reflexo fica uma
  // faixa âmbar mais fraca que o próprio fogo. Queda suave (decay 1,25): a sala longe continua acesa
  // e as sombras dos móveis saem compridas
  const luz = new THREE.SpotLight(COR_FOGO, 5.4, 26, 0.95, 1, 1.25);
  luz.name = 'luz-do-fogo';
  const luzBase = new THREE.Vector3(0, ySoleira + 0.12, zf + 0.1);
  luz.position.copy(luzBase);
  luz.target.position.set(0, ySoleira + 0.22, P + 2.4);
  luz.castShadow = false; // a composição decide; a sombra já fica configurada
  luz.shadow.mapSize.set(nivel === 'alta' ? 2048 : 1024, nivel === 'alta' ? 2048 : 1024);
  luz.shadow.camera.near = 0.2;
  luz.shadow.camera.far = 14;
  luz.shadow.bias = -0.0008;
  luz.shadow.normalBias = 0.04;
  luz.shadow.radius = 3.5;
  // luz da câmara: acima da lenha, um pouco à frente; acende o tijolo, a lenha, o intradorso do arco e as
  // lajes da soleira, com alcance curto (não chega à sala, então não enfraquece as sombras do spot)
  const luzCamara = new THREE.PointLight('#ff7a2c', 1.9, 3.4, 1.2);
  luzCamara.name = 'luz-da-camara';
  const camaraBase = new THREE.Vector3(0, ySoleira + 0.8, zFogo + 0.15);
  luzCamara.position.copy(camaraBase);
  // luz rebatida: o clarão do fogo devolvido pelo piso. Spot sem sombra, rente ao chão, 2 m à frente,
  // apontado de volta para a pedra: ilumina só a frente da lareira, cai de verdade com a altura e
  // não acende o piso nem a parede ao lado.
  const luzRebatida = new THREE.SpotLight('#ff9a52', 13.5, 10, 0.9, 1, 1.6);
  luzRebatida.name = 'luz-rebatida';
  const rebatidaBase = new THREE.Vector3(0, 0.25, P + 2.0);
  luzRebatida.position.copy(rebatidaBase);
  luzRebatida.target.position.set(0, aC + 0.35, P);
  root.add(luz, luz.target, luzCamara, luzRebatida, luzRebatida.target);
  const luzes: THREE.Light[] = [luz, luzCamara, luzRebatida];
  const INT = { luz: luz.intensity, camara: luzCamara.intensity, rebatida: luzRebatida.intensity };

  let sombraDesligadaPorNivel = false;
  const corLuz = new THREE.Color();
  const TOM_CAMARA = new THREE.Color(1, 0.72, 0.5); // a câmara é mais vermelha que a luz da sala
  const TOM_REBATIDA = new THREE.Color(1, 0.9, 0.8);

  const lareira: Lareira = {
    root,
    luz,
    luzes,
    bocaDoFogo,
    console: { y: aC, largura: vigaComp - 0.1, profundidade: zVigaFrente - (P + 0.08), z: (P + 0.08 + zVigaFrente) / 2 },
    forca: 1,
    fogo,
    setMagia(intensidade: number) {
      fogo.setMagia(intensidade);
    },
    update(dt: number, t: number) {
      const f = Math.max(0, lareira.forca);
      fogo.forca = f;
      fogo.update(dt, t);
      const tr = fogo.tremor;
      const m = fogo.magia;
      uBrasa.uTempo.value = t;
      uBrasa.uBrasa.value = (0.35 + 0.65 * Math.min(1.5, f)) * (1 + 0.5 * m);
      // a luz acompanha o fogo: intensidade e um pequeno passeio da fonte (as sombras respiram)
      const b = tr.brilho * f;
      corLuz.copy(COR_FOGO).lerp(COR_MAGIA, m * 0.5);
      luz.color.copy(corLuz);
      luz.intensity = INT.luz * b * (1 - 0.12 * m); // a magia se vende na câmara e na pedra, não no piso
      luz.position.set(luzBase.x + tr.dx, luzBase.y + tr.dy, luzBase.z + tr.dz * 0.5);
      // na entrada da magia a câmara e a luz rebatida dão um clarão dourado que decai
      const clarao = 1 + 0.15 * fogo.clarao + 0.1 * m;
      luzCamara.intensity = INT.camara * (0.25 + 0.75 * b) * clarao;
      luzCamara.position.set(camaraBase.x + tr.dx * 1.6, camaraBase.y + tr.dy * 1.5, camaraBase.z + tr.dz);
      luzCamara.color.copy(corLuz).multiply(TOM_CAMARA).lerp(COR_MAGIA, m * 0.35);
      luzRebatida.color.copy(corLuz).multiply(TOM_REBATIDA);
      luzRebatida.intensity = INT.rebatida * b * clarao;
      luzRebatida.position.set(rebatidaBase.x + tr.dx * 1.2, rebatidaBase.y, rebatidaBase.z);
    },
    setQuality(level: Level) {
      fogo.setQuality(level);
      // no nível baixo a luz principal fica sem sombra; ao voltar, devolve a sombra que a composição tinha pedido
      if (level === 'baixa') {
        if (luz.castShadow) sombraDesligadaPorNivel = true;
        luz.castShadow = false;
      } else if (sombraDesligadaPorNivel) {
        luz.castShadow = true;
        sombraDesligadaPorNivel = false;
      }
    },
    dispose() {
      fogo.dispose();
      for (const g of geometrias) g.dispose();
      for (const m of materiais) m.dispose();
      for (const t of texturas) t.dispose();
      luz.shadow.map?.dispose();
    },
  };
  return lareira;
}
