/**
 * EXTERIOR: a vila nevada à noite, vista pela janela grande da sala.
 *
 * Um diorama 3D de verdade, em camadas com paralaxe: jardim em escala real junto ao vidro (cerca com neve,
 * árvore nua, pinheiro carregado, lampião), vale com riacho e ponte, vila subindo a encosta em frente
 * (perspectiva forçada, metade do tamanho real), crista com bosque, morros, montanhas, céu com lua e estrelas,
 * e neve caindo em três profundidades.
 *
 * Convenção: o plano do vidro é z = 0, o piso da sala é y = 0, o diorama se estende para -Z. A peça não usa
 * nenhuma luz da cena e não acrescenta nenhuma: todos os materiais são iluminados no shader (veja luar.ts), então
 * o fogo da sala não tinge a neve e o luar do diorama não vaza para dentro. A composição cria a própria luz azul
 * da janela a partir de `luar` e copia `luzExterna` a cada quadro.
 *
 * Uso:
 *   const exterior = await criarExterior(ctx, { semente: 7 });
 *   exterior.root.position.set(xDaJanela, 0, zDoVidro);        // e gire junto com a parede, se for o caso
 *   const luzJanela = new THREE.DirectionalLight(exterior.luar.cor, exterior.luar.intensidade);
 *   luzJanela.position.copy(exterior.luar.direcao).multiplyScalar(12);   // direcao aponta PARA a lua (espaço da peça)
 *   // a cada quadro: exterior.update(dt, t); luzJanela.color.copy(exterior.luzExterna.cor); luzJanela.intensity = exterior.luzExterna.intensidade;
 *   // eventos: SLEIGH_PASS -> exterior.setTreno(progress, intensity); MAGICAL_NIGHT -> exterior.setNoiteMagica(intensity)
 * A câmera precisa de far >= profundidade + 15 (o padrão do palco, 300, serve).
 */
import * as THREE from 'three';
import type { Level } from '../../contracts';
import { loadTexture } from '../../../engine/assets';
import type { KitContext, Peca } from '../tipos';
import { construirArvoreNua } from './arvores';
import { assarAtlasBosque, construirPinheiro, criarBosque, criarTexturaRamos } from './pinheiros';
import { type CasaSpec, type Malhas, type Obra, construirCasa, construirCerca, construirIgreja, construirLampiao, construirPonte } from './casas';
import { criarCeu, criarNeblina, construirMorros, direcaoCeu } from './ceu';
import { MAX_LAMPIOES, criarUniformesLuar, materialLuar } from './luar';
import { criarFumaca, criarHalos, criarMaterialVidros, criarNeveCaindo } from './particulas';
import { ESTRADA, LARGURA_PADRAO, PROFUNDIDADE_PADRAO, Relevo } from './relevo';
import { assarSombras } from './sombras';
import { MapaLuz, construirRiacho, criarGeometriaTerreno } from './terreno';
import { criarTreno } from './treno';
import { Malha, criarRng, faixa, fbm, matrizTRS } from './util';

export interface ExteriorOpcoes {
  /** Largura do diorama no fundo, em metros (cobre a vista em ângulo). Padrão 260. */
  largura?: number;
  /** Profundidade total (raio do céu), em metros. Padrão 120. O jardim não muda; o plano médio e o fundo escalam. */
  profundidade?: number;
  semente?: number;
  /** Multiplicador de brilho de tudo o que há lá fora (1 = padrão). Pode ser mudado depois em `ganho`. */
  ganho?: number;
  /** Força inicial da luz quente que a janela da sala derrama na neve do jardim (0 desliga). Padrão 0,5. Depois, use `luzSala`. */
  luzDaSala?: number;
  /** Vão da janela da sala (m), para a luz da sala na neve sair com o recorte e a cruz do caixilho certos. Padrão 3,2 x 3,4, peitoril 0,75. */
  janela?: { largura?: number; altura?: number; peitoril?: number };
  /** Altura da neve encostada na parede de fora, junto do vidro (m). Padrão 0,36; abaixe se o peitoril for baixo. */
  alturaNeveNaParede?: number;
  /**
   * Azimute (graus, positivo = para a direita, no espaço da peça) de onde a câmera olha pela janela, para a vista em
   * ângulo (janela em parede lateral): a vila, a igreja, a lua, o trenó e a aurora giram para esse eixo e as árvores do
   * jardim se reposicionam dos lados do cone de visão; o jardim continua colado à parede. Padrão 0 (de frente).
   * Ex.: câmera olhando para a janela 30 graus vinda da esquerda (olhar indo para a direita) -> 30.
   */
  azimuteVista?: number;
  /** Põe uma figura sentada no trenó. Padrão false: por ora a cena não leva Papai Noel nenhum. */
  condutor?: boolean;
}

export interface Exterior extends Peca {
  /**
   * Sugestão para a luz azul que entra pela janela, coerente com a lua do diorama. `direcao` aponta para a lua
   * (espaço da peça; use como position de uma DirectionalLight) e é um pouco mais alta que a lua desenhada, para o
   * recorte da janela cair no piso em vez de atravessar a sala. `direcaoLua` é onde o disco aparece de fato.
   */
  luar: { cor: THREE.Color; direcao: THREE.Vector3; intensidade: number; direcaoLua: THREE.Vector3 };
  /** Atualizada a cada quadro (noite mágica): a composição copia para a luz da janela. */
  luzExterna: { cor: THREE.Color; intensidade: number };
  /**
   * Luz da sala que sai pela janela e cai na neve do jardim (com o recorte do vão e a cruz do caixilho). A composição
   * pode mudar a cada quadro, por exemplo copiando a tremulação da lareira. intensidade 0 desliga.
   */
  luzSala: { cor: THREE.Color; intensidade: number };
  /** SLEIGH_PASS: progress de 0 (entra à esquerda) a 1 (sai à direita), passando rente ao alto da lua perto de 0,45; intensity = opacidade. */
  setTreno(progress: number, intensity: number): void;
  /** MAGICAL_NIGHT: 0 = noite normal; 1 = aurora plena. */
  setNoiteMagica(intensity: number): void;
  /** Multiplicador de brilho do exterior. */
  ganho: number;
  /** Números da peça (malhas visíveis e triângulos), para relatório. */
  numeros(): { malhas: number; triangulos: number; detalhe: string };
}

/** Azimute e elevação (graus) do disco da lua e da luz que modela o diorama. */
const LUA_AZ = -8.5;
const LUA_EL = 11.6;
const LUA_RAIO = 1.08;
const LUZ_AZ = -36;
const LUZ_EL = 29;

/** Onde ficam as casas da vila: [x, D, giro]. Três fileiras subindo a encosta, ao longo do caminho em S. */
const LOTES: Array<[number, number, number]> = [
  [-9.6, 29.6, 0.7],
  [-5.6, 28.6, 0.35],
  [-1.7, 28.2, -0.2],
  [5.9, 29.6, -0.5],
  [9.9, 30.8, -0.75],
  [-11.6, 34.6, 0.8],
  [-8.0, 33.4, 0.5],
  [-0.9, 34.4, 0.25],
  [2.9, 34.9, -0.3],
  [7.1, 35.6, -0.6],
  [-9.2, 39.8, 0.6],
  [-5.6, 40.9, 0.3],
  [5.9, 38.6, -0.45],
  [10.2, 40.2, -0.8],
  [-7.4, 45.6, 0.5],
  [-2.6, 44.6, 0.2],
  [8.6, 45.2, -0.6],
  [-18.5, 38.0, 0.9],
  [17.5, 37.0, -0.9],
  // casas afastadas, para as vistas em ângulo terem as suas janelas acesas
  [-29, 33.5, 1.1],
  [-38, 44, 1.2],
  [27, 31.5, -1.1],
  [36, 42, -1.2],
  [-24, 47, 0.9],
  [24.5, 46, -0.9],
];
const IGREJA: [number, number] = [-3.4, 51.0];
const PONTE: [number, number] = [3.38, 25.6];

/** Sorteia o feitio de cada casa (tamanho, material, alas, trapeiras), para nenhuma ser cópia da outra. */
function sortearCasas(semente: number): CasaSpec[] {
  const r = criarRng(semente + 1009);
  const tintas: Array<[number, number, number]> = [
    [1.0, 0.93, 0.8],
    [0.92, 0.9, 0.95],
    [1.0, 0.85, 0.76],
    [0.96, 0.94, 0.86],
    [0.9, 0.84, 0.8],
  ];
  return LOTES.map(([x, D, rot], i) => {
    const sorte = r();
    const parede = sorte < 0.5 ? 'reboco' : sorte < 0.78 ? 'tabuas' : 'pedra';
    const alta = r() < 0.25;
    const w = faixa(r, 7.2, 9.6);
    const d = faixa(r, 6.0, 7.3);
    const h = alta ? faixa(r, 4.9, 5.4) : faixa(r, 2.9, 3.5);
    // algumas casas mostram a empena (giradas de um quarto de volta)
    const deEmpena = r() < 0.22;
    const sp: CasaSpec = {
      x,
      D,
      rot: rot + (deEmpena ? (rot > 0 ? -1 : 1) * (Math.PI / 2) : 0) + (r() - 0.5) * 0.2,
      w,
      d,
      h,
      inclin: faixa(r, 50, 58),
      parede,
      cor: parede === 'reboco' ? tintas[Math.floor(r() * tintas.length)] : [faixa(r, 0.85, 1), faixa(r, 0.82, 0.95), faixa(r, 0.8, 0.92)],
      enxaimel: parede === 'reboco' && r() < 0.7,
      venezianas: r() < 0.4,
      acesas: Math.abs(x) > 15 ? 0.45 : 0.6,
      chamines: r() < 0.3 ? [[-w * 0.26, 0.4], [w * 0.28, -0.5]] : [[(r() < 0.5 ? -1 : 1) * w * faixa(r, 0.15, 0.3), faixa(r, -0.6, 0.5)]],
    };
    const feitio = r();
    if (deEmpena) sp.portaNa = 'nenhuma';
    else if (feitio < 0.3) sp.ala = { w: faixa(r, 4.6, 5.4), avanco: faixa(r, 2.4, 3.4), pos: (r() < 0.5 ? -1 : 1) * faixa(r, 1.4, 2.2) };
    else if (feitio < 0.75) sp.trapeiras = w > 8.6 && r() < 0.5 ? [-w * 0.22, w * 0.22] : [(r() - 0.5) * w * 0.4];
    if (r() < 0.3) sp.anexo = { w: faixa(r, 3.4, 4.2), d: faixa(r, 4.2, 4.8), h: faixa(r, 2.1, 2.4), lado: i % 2 ? 1 : -1 };
    return sp;
  });
}

/** Árvores nuas da vila: [x, D, altura real, semente]. */
const ARVORES_VILA: Array<[number, number, number, number]> = [
  [-3.6, 30.6, 10, 11],
  [1.4, 31.4, 11, 12],
  [8.2, 33.0, 9, 13],
  [-3.2, 37.4, 10, 14],
  [1.6, 37.4, 9.5, 15],
  [-12.6, 37.6, 11, 17],
  [2.6, 44.4, 10, 20],
  [-8.4, 49.6, 11, 21],
  [1.3, 27.0, 8, 22],
  [6.4, 49.0, 10, 23],
];

function malhaDe(m: Malha, mat: THREE.Material, nome: string): THREE.Mesh {
  const mesh = new THREE.Mesh(m.geometria(), mat);
  mesh.name = nome;
  mesh.frustumCulled = false;
  return mesh;
}

export async function criarExterior(ctx: KitContext, opcoes: ExteriorOpcoes = {}): Promise<Exterior> {
  const semente = opcoes.semente ?? 7;
  const nivel = ctx.level;
  const rng = criarRng(semente);
  const relevo = new Relevo(opcoes.profundidade ?? PROFUNDIDADE_PADRAO, opcoes.largura ?? LARGURA_PADRAO, opcoes.alturaNeveNaParede ?? 0.36, opcoes.azimuteVista ?? 0);
  // vista em ângulo: azimute em graus somado ao que fica longe; o jardim desliza em x para acompanhar o eixo
  const azV = (relevo.azimute * 180) / Math.PI;
  const tanA = Math.tan(relevo.azimute);
  const jx = (x: number, D: number) => x * (1 + 0.8 * Math.abs(tanA)) + D * tanA;
  const giroLonge = relevo.giro(1000);
  const k = relevo.k;
  const root = new THREE.Group();
  root.name = 'exterior';
  // nada daqui entra na oclusão de ambiente da sala (são materiais próprios; a marca evita até a visita)
  root.userData.semAO = true;

  const U = criarUniformesLuar();
  U.uGanho.value = opcoes.ganho ?? 1;
  direcaoCeu(LUZ_AZ + azV, LUZ_EL, U.uLuaDir.value);
  // planos separados por valor: o jardim escuro, a vila clara, a crista e os morros dissolvendo no azul
  U.uNevoa.value.set(14 + 14 * k, 0.026 / k, 0.9, 0);
  U.uVale.value.set(1.5 * k, -3.2 * k, 0.8, 15);

  const tex = (id: string, mapa: 'diff' | 'nor') => loadTexture(`assets/texturas/${id}/${mapa}.jpg`, { srgb: mapa === 'diff' });
  const [neveD, neveN, rebD, rebN, tabD, tabN, pedD, pedN, casD, casN] = await Promise.all([
    tex('snow_02', 'diff'),
    tex('snow_02', 'nor'),
    tex('clay_plaster', 'diff'),
    tex('clay_plaster', 'nor'),
    tex('dark_planks', 'diff'),
    tex('dark_planks', 'nor'),
    tex('stone_wall_04', 'diff'),
    tex('stone_wall_04', 'nor'),
    tex('bark_willow', 'diff'),
    tex('bark_willow', 'nor'),
  ]);

  /* ---------------------------------------------------------- construção */
  const m: Malhas = { reboco: new Malha(), tabuas: new Malha(), pedra: new Malha(), neve: new Malha(), vidros: new Malha() };
  const casca = new Malha();
  const folhagem = new Malha();
  const gelo = new Malha();
  const morros = new Malha();
  const luz = new MapaLuz();
  const obra: Obra = { m, relevo, luz, rng, halos: [], fumacas: [], lampioes: [] };

  // vila (as casas aplainam o terreno antes de ele virar malha)
  const casas = sortearCasas(semente);
  for (const c of casas) construirCasa(obra, c);
  construirIgreja(obra, IGREJA[0], IGREJA[1], -Math.PI / 2 + 0.3);
  // a ponte fica oblíqua ao eixo da vista, para o arco aparecer de perfil (de frente seriam só dois parapeitos)
  construirPonte(obra, PONTE[0], PONTE[1], Math.PI - 0.5);

  // a luz quente da própria janela da sala é calculada no shader (luzDaSala, em luar.ts) a partir do vão
  U.uJanelaSala.value.set(opcoes.janela?.largura ?? 3.2, opcoes.janela?.altura ?? 3.4, opcoes.janela?.peitoril ?? 0.75, 0.62);
  const luzSala = { cor: new THREE.Color(1.0, 0.62, 0.24), intensidade: opcoes.luzDaSala ?? 0.5 };
  // caminho pisado no mapa de luz
  luz.caminho(ESTRADA, 1.1, 0.85);
  // primeiro plano um degrau mais escuro: a neve junto da casa não pode ser a área mais clara do quadro
  luz.oclusao(0, 3.6, 1, 0, 40, 4.4, 0.4);

  // lampiões: um no jardim (escala real) e os da vila ao longo do caminho
  construirLampiao(obra, jx(-2.9, 10.3), 10.3, 2.55, 1, 0.75);
  const lampVila: Array<[number, number]> = [
    [4.3, 23.2],
    [1.6, 30.0],
    [-4.0, 34.6],
    [1.0, 40.6],
    [5.9, 44.2],
    [2.9, 48.6],
  ];
  for (const [x, D] of lampVila) construirLampiao(obra, x, D, 3.6, relevo.escalaVila(D), 0.9);

  // cercas: a do jardim (ripas no trecho em frente à janela, com o vão do portão; varas nos lados) e as rústicas da vila
  construirCerca(
    obra,
    [
      [-11, 7.7],
      [-5.5, 8.3],
      [0, 9.5],
      [5, 11.0],
      [10, 13.0],
    ],
    'ripas',
    1,
    [0.25, 1.9],
  );
  construirCerca(obra, [[-26, 9.2], [-18, 8.0], [-11, 7.7]], 'varas', 1);
  construirCerca(obra, [[10, 13.0], [18, 13.4], [26, 13.0]], 'varas', 1);
  const ev = relevo.escalaVila(30);
  construirCerca(obra, [[4.5, 18.6], [4.6, 23.4]], 'varas', ev);
  construirCerca(obra, [[2.0, 19.4], [2.3, 23.6]], 'varas', ev);
  construirCerca(obra, [[1.2, 30.4], [-1.6, 32.0], [-4.6, 33.8], [-5.9, 35.8], [-4.6, 38.4]], 'varas', ev);
  construirCerca(obra, [[-1.0, 40.4], [2.6, 42.0], [4.2, 44.0], [3.6, 47.0]], 'varas', ev);
  construirCerca(obra, [[7.0, 33.6], [10.4, 34.2], [13.6, 35.6]], 'varas', ev);

  // árvores nuas: a do jardim, de primeiro plano, e as da vila
  const pArv = relevo.chao(jx(1.95, 5.5), 5.5);
  construirArvoreNua(casca, m.neve, matrizTRS(pArv.x, pArv.y, pArv.z, 0.6, 1), {
    altura: 6.9,
    raioTronco: 0.21,
    niveis: nivel === 'alta' ? 4 : 3,
    semente: semente * 13 + 5,
    abertura: 1.05,
    neveAcimaDe: 0.022,
    inclina: [-0.1, 0.04],
  });
  luz.oclusao(jx(1.95, 5.5), 5.5, 1, 0, 1.3, 1.3, 0.7);
  for (const [x, D, alt, s] of ARVORES_VILA) {
    const p = relevo.chao(x, D);
    construirArvoreNua(casca, m.neve, matrizTRS(p.x, p.y, p.z, s, relevo.escalaVila(D)), {
      altura: alt,
      raioTronco: 0.3,
      niveis: nivel === 'baixa' ? 2 : 3,
      semente: semente * 7 + s,
      abertura: 1.1,
      neveAcimaDe: 0.12,
      detalhe: 'baixo',
    });
    luz.oclusao(x, D, 1, 0, 0.6, 0.6, 0.5);
  }
  // uma árvore nua menor do outro lado do jardim (aparece nas vistas em ângulo)
  const pArv2 = relevo.chao(jx(-7.4, 6.4), 6.4);
  construirArvoreNua(casca, m.neve, matrizTRS(pArv2.x, pArv2.y, pArv2.z, 2.1, 1), { altura: 5.2, raioTronco: 0.15, niveis: 3, semente: semente * 5 + 3, neveAcimaDe: 0.03, detalhe: 'baixo' });
  luz.oclusao(jx(-7.4, 6.4), 6.4, 1, 0, 1.0, 1.0, 0.6);

  // pinheiros carregados de neve, no fim do jardim
  for (const [x, D, alt, s] of [
    [-3.9, 11.6, 5.6, 3],
    [8.6, 12.6, 4.2, 4],
  ] as const) {
    const xp = jx(x, D);
    const p = relevo.chao(xp, D);
    construirPinheiro({ folhagem, neve: m.neve, casca }, matrizTRS(p.x, p.y, p.z, s, 1), alt, semente + s, { detalhe: nivel === 'baixa' ? 'baixo' : 'alto', carga: 0.85, densidade: 2.5 });
    luz.oclusao(xp, D, 1, 0, alt * 0.3, alt * 0.3, 0.75);
  }

  construirRiacho(gelo, relevo);
  construirMorros(morros, relevo, LUA_AZ, semente);

  /* ------------------------------------------------------------ materiais */
  const mapaLuz = luz.criarTextura();
  const matTerreno = materialLuar(U, { modo: 'terreno', mapa: neveD, normal: neveN, mapaLuz, tinta: new THREE.Color(0.84, 0.89, 1.0), lavar: 0.72, forcaNormal: 0.5, envolve: 0.36, brilho: 0.2, brilhoPot: 12, lampioes: false });
  const matNeve = materialLuar(U, { modo: 'neve', mapa: neveD, normal: neveN, tinta: new THREE.Color(0.86, 0.9, 1.0), lavar: 0.8, forcaNormal: 0.35, envolve: 0.42, brilho: 0.14, brilhoPot: 10 });
  const matReboco = materialLuar(U, { mapa: rebD, normal: rebN, tinta: new THREE.Color(1.0, 0.9, 0.76), lavar: 0.3, forcaNormal: 1.4, poeira: 0.18 });
  const matTabuas = materialLuar(U, { mapa: tabD, normal: tabN, tinta: new THREE.Color(0.74, 0.7, 0.68), lavar: 0.15, forcaNormal: 1.2, poeira: 0.5 });
  const matPedra = materialLuar(U, { mapa: pedD, normal: pedN, tinta: new THREE.Color(0.86, 0.86, 0.92), lavar: 0.2, forcaNormal: 1.3, poeira: 0.42 });
  const matCasca = materialLuar(U, { mapa: casD, normal: casN, tinta: new THREE.Color(0.62, 0.58, 0.58), lavar: 0.25, forcaNormal: 1.2, poeira: 0.5 });
  // agulhas: tiras recortadas pelo atlas de ramos; a neve do pinheiro é a malha dos mantos
  const ramos = criarTexturaRamos();
  const matFolhagem = materialLuar(U, { tinta: new THREE.Color(0.11, 0.2, 0.18), envolve: 0.4, alfa: ramos });
  const matFolhagemSombra = new THREE.MeshBasicMaterial({ map: ramos, alphaTest: 0.42, side: THREE.DoubleSide });
  const matGelo = materialLuar(U, { tinta: new THREE.Color(0.09, 0.15, 0.3), brilho: 1.1, brilhoPot: 70, lampioes: false });
  const matMorros = materialLuar(U, { modo: 'morro', envolve: 0.3, lampioes: false, sombras: false });
  const matVidros = criarMaterialVidros(U);

  /* --------------------------------------------------------------- malhas */
  const terreno = new THREE.Mesh(criarGeometriaTerreno(relevo, nivel), matTerreno);
  terreno.name = 'terreno';
  terreno.frustumCulled = false;
  const malhas = {
    reboco: malhaDe(m.reboco, matReboco, 'reboco'),
    tabuas: malhaDe(m.tabuas, matTabuas, 'madeira'),
    pedra: malhaDe(m.pedra, matPedra, 'pedra'),
    neve: malhaDe(m.neve, matNeve, 'neve-pousada'),
    vidros: malhaDe(m.vidros, matVidros, 'vidros'),
    casca: malhaDe(casca, matCasca, 'galhos'),
    folhagem: malhaDe(folhagem, matFolhagem, 'pinheiros'),
    gelo: malhaDe(gelo, matGelo, 'riacho'),
    morros: malhaDe(morros, matMorros, 'morros'),
  };

  malhas.folhagem.userData.materialSombra = matFolhagemSombra;
  // bosque: pinheiros carregados fotografados uma vez (impostores) e instanciados nas encostas, na crista e em grupos na vila
  const atlasBosque = assarAtlasBosque(ctx.renderer, ramos, semente, nivel === 'baixa' ? 256 : 512);
  let totalConiferas = 0;
  const nConiferas = nivel === 'alta' ? 620 : nivel === 'media' ? 460 : 300;
  const coniferas = criarBosque(U, atlasBosque, nConiferas);
  const feitios = coniferas.geometry.getAttribute('aFeitio') as THREE.InstancedBufferAttribute;
  {
    const r2 = criarRng(semente + 211);
    const M = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Vector3();
    const p = new THREE.Vector3();
    let n = 0;
    let guarda = 0;
    while (n < nConiferas && guarda++ < 60000) {
      const D = faixa(r2, 15, 82);
      const meia = 22 + (relevo.largura / 2 - 22) * (D / 87);
      const x = faixa(r2, -meia, meia) * 0.97;
      const ax = Math.abs(x);
      const dens = fbm(x * 0.05 + 40, D * 0.05 + 13, 3);
      const lateral = ax > 17 + (60 - D) * 0.12;
      const crista = D > 54;
      const grupo = dens > 0.6 && (ax > 6 || D > 47);
      if (!(lateral || crista || grupo)) continue;
      if (dens < (crista ? 0.4 : lateral ? 0.44 : 0.6)) continue;
      if (relevo.distEstrada(x, D) < 2.6) continue;
      if (ax > 40 && r2() < 0.45) continue;
      if (casas.some((c) => Math.hypot(c.x - x, c.D - D) < 4) || Math.hypot(IGREJA[0] - x, IGREJA[1] - D) < 5) continue;
      relevo.chao(x, D, p);
      const alt = (7 + 15 * Math.pow(r2(), 1.6)) * relevo.escalaVila(D) * (crista ? 0.9 : 1);
      e.set(alt * faixa(r2, 0.8, 1.15), alt, alt);
      q.identity();
      p.y -= alt * 0.06;
      M.compose(p, q, e);
      feitios.setX(n, Math.floor(r2() * 4) % 4);
      coniferas.setMatrixAt(n++, M);
    }
    coniferas.count = n;
    totalConiferas = n;
    coniferas.instanceMatrix.needsUpdate = true;
    feitios.needsUpdate = true;
  }

  const ceu = criarCeu(U, relevo.profundidade, LUA_AZ, LUA_EL, LUA_RAIO, semente);
  const neblina = criarNeblina(U, relevo);
  // céu, estrelas e faixas de neblina são desenhados no eixo da janela e giram inteiros para o eixo da vista
  ceu.cupula.rotation.y = giroLonge;
  ceu.estrelas.rotation.y = giroLonge;
  neblina.rotation.y = giroLonge;
  const neveCaindo = criarNeveCaindo(U, semente, k);
  // só parte das chaminés fumega (sorteio por semente): uma dúzia de colunas iguais seria ruído, não atmosfera
  const rFum = criarRng(semente + 501);
  const fumaca = criarFumaca(U, obra.fumacas.filter(() => rFum() < 0.42));
  const halos = criarHalos(U, obra.halos, neveCaindo.uAlturaPx);
  const treno = criarTreno(U, neveCaindo.uAlturaPx, {
    raio: relevo.raio(95),
    // entra pela esquerda, no céu limpo, cruza o alto da lua perto de 0,45 e sai à direita por entre os galhos (já esmaecendo)
    azimute: [-19 + azV, 5 + azV],
    elevacao: [8.2, 12.8],
    comprimento: 9.2 * k,
    condutor: opcoes.condutor ?? false,
    semente,
  });

  root.add(terreno, malhas.reboco, malhas.tabuas, malhas.pedra, malhas.neve, malhas.vidros, malhas.casca, malhas.folhagem, malhas.gelo, malhas.morros, coniferas);
  root.add(ceu.cupula, ceu.estrelas, neblina, fumaca, halos, neveCaindo.pontos, treno.grupo);

  // lampiões que iluminam as superfícies próximas (posições no espaço da peça)
  obra.lampioes.slice(0, MAX_LAMPIOES).forEach((l, i) => U.uLamp.value[i].set(l.pos.x, l.pos.y, l.pos.z, l.forca));

  /* -------------------------------------------------------------- sombras */
  const sombras = assarSombras(
    ctx.renderer,
    U,
    [terreno, malhas.reboco, malhas.tabuas, malhas.pedra, malhas.neve, malhas.casca, malhas.folhagem, coniferas],
    U.uLuaDir.value,
    nivel === 'alta' ? 2048 : 1024,
    [
      { centro: new THREE.Vector3(THREE.MathUtils.clamp(8 * tanA, -12, 12), 1.5, -8), meia: 15.5, folga: 0.035 },
      { centro: new THREE.Vector3(0, 2 * k, -(14 + 28 * k)).applyAxisAngle(new THREE.Vector3(0, 1, 0), giroLonge), meia: 50 * k, folga: 0.14 * k },
    ],
  );

  /* ------------------------------------------------------------------ API */
  const corBase = new THREE.Color('#7f9df2');
  const corMagica = new THREE.Color('#6fe3cf');
  const luar = {
    cor: corBase.clone(),
    direcao: direcaoCeu(LUZ_AZ + azV, 34),
    intensidade: 1.6,
    direcaoLua: direcaoCeu(LUA_AZ + azV, LUA_EL),
  };
  const luzExterna = { cor: corBase.clone(), intensidade: luar.intensidade };
  let noite = 0;
  let trenoProgresso = 0;
  let trenoForca = 0;
  let nivelAtual: Level = nivel;
  const tamanhoQuadro = new THREE.Vector2();
  // valores de repouso das cores que a noite mágica altera
  const luaCor0 = U.uLuaCor.value.clone();
  const luaCorMagica = new THREE.Color(0.3, 0.78, 0.95);

  const aplicarQualidade = (level: Level) => {
    nivelAtual = level;
    neveCaindo.definirFracao(level === 'alta' ? 1 : level === 'media' ? 0.62 : 0.36);
    ceu.definirEstrelas(level === 'alta' ? 1 : level === 'media' ? 0.8 : 0.6);
    fumaca.visible = level !== 'baixa';
    coniferas.count = Math.min(totalConiferas, level === 'alta' ? 620 : level === 'media' ? 460 : 300);
  };
  aplicarQualidade(nivel);

  const descartaveis: Array<{ dispose(): void }> = [matTerreno, matNeve, matReboco, matTabuas, matPedra, matCasca, matFolhagem, matFolhagemSombra, coniferas.material as THREE.Material, coniferas.userData.materialSombra as THREE.Material, ramos, atlasBosque, coniferas.geometry, matGelo, matMorros, matVidros, terreno.geometry, mapaLuz, ceu, sombras, neveCaindo, treno];
  for (const mm of Object.values(malhas)) descartaveis.push(mm.geometry);
  descartaveis.push(neblina.geometry, neblina.material as THREE.Material, fumaca.geometry, fumaca.material as THREE.Material, halos.geometry, halos.material as THREE.Material);
  const atlas = matVidros.userData.atlas as THREE.Texture | undefined;
  if (atlas) descartaveis.push(atlas);

  const peca: Exterior = {
    root,
    luar,
    luzExterna,
    luzSala,
    ganho: U.uGanho.value,
    update(_dt, t) {
      U.uTempo.value = t;
      U.uGanho.value = peca.ganho;
      U.uNoite.value = noite;
      U.uLuzSala.value.set(luzSala.cor.r, luzSala.cor.g, luzSala.cor.b, Math.max(0, luzSala.intensidade));
      // tamanho dos flocos, halos e estrelas acompanha a resolução do quadro
      ctx.renderer.getDrawingBufferSize(tamanhoQuadro);
      neveCaindo.uAlturaPx.value = tamanhoQuadro.y;
      ceu.uniformes.uPx.value = tamanhoQuadro.y / 1920;
      // noite mágica: o luar puxa para o verde-água e a aurora respira devagar
      const respira = 1 + 0.05 * Math.sin(t * 0.37) + 0.03 * Math.sin(t * 0.83 + 1.1);
      U.uLuaCor.value.copy(luaCor0).lerp(luaCorMagica, noite * 0.22);
      luzExterna.cor.copy(corBase).lerp(corMagica, noite * 0.55);
      luzExterna.intensidade = luar.intensidade * (1 + noite * (0.28 * respira));
      treno.definir(trenoProgresso, trenoForca);
      treno.atualizar(t);
    },
    setQuality: aplicarQualidade,
    setTreno(progress, intensity) {
      trenoProgresso = progress;
      trenoForca = intensity;
    },
    setNoiteMagica(intensity) {
      noite = Math.min(1, Math.max(0, intensity));
    },
    numeros() {
      let n = 0;
      let tri = 0;
      const partes: string[] = [];
      root.traverse((o) => {
        const mesh = o as THREE.InstancedMesh;
        if (!(mesh.isMesh || (o as THREE.Points).isPoints) || !o.visible || (o.parent && !o.parent.visible)) return;
        n++;
        if (!mesh.isMesh) return;
        const g = mesh.geometry;
        const t = ((g.index ? g.index.count : g.getAttribute('position').count) / 3) * (mesh.isInstancedMesh ? mesh.count : 1);
        tri += t;
        partes.push(`${o.name}=${Math.round(t)}`);
      });
      return { malhas: n, triangulos: Math.round(tri), detalhe: partes.join(', ') };
    },
    dispose() {
      for (const d of descartaveis) d.dispose();
      luz.dispose();
    },
  };
  void nivelAtual;
  return peca;
}
