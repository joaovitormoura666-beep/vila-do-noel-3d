/**
 * AJUSTES DA SALA A: todos os números de composição, luz, câmera e acabamento em um só lugar.
 * O dono vai pedir ajustes: mude aqui e fotografe (node tools/shot.cjs sala --param set=a --half).
 *
 * Planta (metros; Y para cima; a câmera fica em x 7,5  z 11,6, a 3,5 m de altura, e olha para o canto
 * esquerdo do fundo, de modo que a parede esquerda aparece em perspectiva):
 *
 *     z = -5,5  ┌──────[  JANELA em arco  ]──────────────────────── parede do fundo
 *               │▓▓▓     x -2,85 .. -0,25        ▲ árvore (1,0  -3,85)
 *     LAREIRA   │▓▓▓▶ fogo ──►   ▣ POLTRONA = trono do Noel (-0,3  -2,85), giro 0,68
 *     z -3,65   │▓▓▓      lanterna ◦   ( tapete redondo )      ● entrega (1,04  -2,08)
 *     (boca +X) │▓▓▓                                                    ──► saída (direita)
 *               │                piso livre: fila em três fileiras atravessadas à câmera
 *     x = -3,6  │                                     ⌒ cadeira de balanço (2,85  5,35), 1º plano
 */
import type { Look } from '../contracts';

/** Medidas da sala (faces internas das paredes). */
export const SALA = {
  /** Face interna da parede esquerda (a da lareira). */
  xEsq: -3.6,
  /** Face interna da parede do fundo (a da janela). */
  zFundo: -5.5,
  /** A sala é um salão: a parede direita e a da frente ficam fora do quadro, atrás da câmera. */
  xDir: 10.2,
  zFrente: 13.8,
  /** Pé-direito até o forro. */
  altura: 5.6,
  /** Espessura das paredes (o vão da janela é fundo). */
  espessura: 0.4,
  /** Altura do lambri de tábuas. */
  lambri: 1.02,
  /** Até onde (x e z) a arquitetura é feita com todo o detalhe; além disso fica fora do quadro. */
  xDetalhe: 6.2,
  zDetalhe: 4.6,
};

/** Estrutura de madeira do teto. */
export const TETO = {
  /** Vigas mestras, atravessando a sala de parede a parede (ao longo de X): posições em Z. */
  vigasZ: [-4.92, -1.48, 1.96],
  vigaLargura: 0.3,
  vigaAltura: 0.36,
  /** Face de baixo das vigas mestras. */
  vigaBase: 4.92,
  /** Caibros sobre as vigas (ao longo de Z): passo em X. */
  caibroPasso: 0.78,
  caibroLargura: 0.11,
  caibroAltura: 0.17,
  /** Pilares na parede do fundo (posições em X) e na parede esquerda (posições em Z). */
  pilaresFundoX: [1.75, 4.6],
  pilaresEsqZ: [-1.48, 1.96],
  pilar: 0.24,
};

export const LAREIRA = {
  /** Centro da lareira ao longo da parede esquerda. */
  z: -3.65,
  largura: 3.2,
  alturaConsole: 1.78,
  profundidade: 0.95,
  semente: 7,
  /** Força do fogo e da luz (1 = como a peça nasce). */
  forca: 1.4,
  /** Multiplica só a luz principal (o spot que atravessa a sala e projeta as sombras). */
  ganhoLuz: 2.3,
  /**
   * Para onde o spot do fogo aponta, em coordenadas da peça (x ao longo do console, negativo = lado da câmera;
   * y altura; z metros à frente da parede): um pouco para o lado da câmera e para baixo, para a luz âmbar
   * atravessar o piso e o tapete na frente do Noel.
   */
  alvoLuz: [-1.3, 0.05, 3.4] as [number, number, number],
};

/**
 * Objetos do console da lareira. Posições ao longo da viga, em metros a partir do meio dela:
 * negativo = lado mais perto da câmera (a poltrona esconde o que passar de +0,5).
 */
export const CONSOLE = {
  relogio: -0.1,
  castical: -0.78,
  meias: [-1.2, -0.82] as [number, number],
  giroDasMeias: -0.35,
  /** Guirlanda no peito da chaminé: raio e altura do centro acima do tampo. */
  guirlanda: { raio: 0.4, altura: 0.62 },
};

export const JANELA = {
  /** Centro do vão na parede do fundo. */
  x: -1.55,
  /** A peça aceita de 2,6 a 3,6 m. */
  largura: 2.6,
  altura: 3.7,
  peitoril: 0.7,
  colunas: 4,
  linhas: 3,
  aberturaCortinas: 0.86,
  semente: 3,
};

export const EXTERIOR = {
  semente: 7,
  /** Brilho geral da vila vista pela janela. */
  ganho: 1.15,
};

/**
 * O que a janela mostra (veja vista.ts). O "olho virtual" fica dentro do diorama do kit, em coordenadas
 * da peça: x para a direita, y altura, z = metros à frente da vidraça do diorama. Quanto mais longe (z),
 * mais coisa cabe no vão e menor fica cada casa; x desloca a vila em relação à lua.
 */
export const VISTA = {
  olho: [10, 5, 60] as [number, number, number],
  /** Direção, a partir do olho, que cai no centro do vão: azimute (negativo = esquerda) e elevação, em graus. */
  azimute: -9,
  elevacao: 2.9,
  /** Raio do céu do diorama (a opção `profundidade` do exterior; 120 é o padrão da peça). */
  profundidade: 120,
};

export const ARVORE = {
  x: 1.02,
  z: -3.85,
  altura: 3.6,
  raio: 1.0,
  luzes: 230,
  presentes: 4,
  semente: 7,
  giro: 0.6,
  /** Luz real da árvore (PointLight da peça). */
  luz: 1.0,
};

/** O lugar do Noel (vazio nesta entrega) e os móveis em volta. */
export const LUGAR = {
  /** O trono: a poltrona grande do Noel, de frente para a câmera e um pouco virada para quem chega (direita). */
  poltrona: { x: -0.3, z: -2.85, giro: 0.68, escala: 1.5 },
  /** O Noel fica sentado na poltrona: o ponto dele no piso é o centro da poltrona (veja ASSENTO_DO_NOEL em ancoras.ts). */
  noel: { x: -0.3, z: -2.85 },
  /** Para onde o Noel olha (0 = +Z): o mesmo giro da poltrona. */
  noelYaw: 0.68,
  /**
   * Onde o visitante para, de frente para o Noel: a `distanciaDaEntrega` metros do centro da poltrona, na direção
   * `direcaoDaEntrega` (rad, 0 = +Z). Mais para o lado que o giro da poltrona, para o visitante ficar de perfil
   * para a câmera e não tapar o Noel.
   */
  distanciaDaEntrega: 1.85,
  direcaoDaEntrega: 1.27,
  /**
   * Referência das fileiras da fila (o antigo ponto de entrega, 1,55 m na direção 1,05 rad): as fileiras foram
   * compostas a partir dele e continuam no mesmo lugar depois que a entrega foi para a direita (jogo 3D).
   */
  referenciaDaFila: { distancia: 1.55, direcao: 1.05 },
  tapete: { x: -0.05, z: -2.4, diametro: 3.1, giro: 0.5 },
  /** Lanterna de madeira acesa no piso, à esquerda da poltrona (baixa: não entra na silhueta do Noel). */
  lanterna: { x: -1.5, z: -2.45, giro: 0.5 },
};

/** Reforço da FIREPLACE_MAGIC nesta câmera (magia.ts): poeira dourada subindo da soleira e mais fogo. */
export const MAGIA = {
  graos: 160,
  /** Diâmetro de cada grão (m). */
  tamanho: 0.06,
  /** Até onde a poeira sobe acima da soleira (m) e a largura da boca onde ela nasce (m). */
  altura: 3.0,
  largura: 0.9,
  cor: '#ffcf6e',
  /** Multiplica a cor (acima de 1 o brilho do palco faz um halo pequeno). */
  brilho: 3.4,
  /** Quanto a força do fogo cresce com a magia no máximo (0,4 = +40 %). */
  reforcoFogo: 0.4,
};

/** Primeiro plano escuro em silhueta (canto de baixo à esquerda, fora do caminho da fila). */
export const PRIMEIRO_PLANO = {
  /** Cadeira de balanço virada para a lareira, cortada pela borda da tela; `tom` escurece a madeira (silhueta). */
  balanco: { x: 2.85, z: 5.35, giro: -2.0, tom: 0.32 },
};

/** Luzes. Dez no total (três da lareira, uma da árvore e as seis daqui) e duas com sombra (o fogo e o luar). */
export const LUZ = {
  /** Luar que entra pela janela: cor e força vêm de exterior.luzExterna a cada quadro, vezes este ganho. */
  luar: {
    ganho: 0.22,
    /**
     * Altura da luz, em graus. O azimute vem de onde a lua aparece na janela; a altura é mais alta que a da
     * lua desenhada (como a peça do exterior já sugere), para o recorte cair no piso antes do tapete do Noel.
     */
    elevacao: 33,
    /** Distância da fonte (spot estreito e distante, raios quase paralelos). */
    distancia: 30,
    /** Folga do cone em volta do vão, em metros. */
    folga: 0.5,
    mapa: 2048,
    /** O mapa de sombra do luar é refeito um quadro a cada tantos (os personagens andam devagar). */
    refazerACada: 6,
  },
  /** Preenchimento quente e baixo: mantém as sombras marrom-avermelhadas. */
  preenchimento: { ceu: '#ffb47a', chao: '#7a3c1c', forca: 0.3 },
  /** Lanterna acesa no piso, ao lado da poltrona. */
  lampiao: { cor: '#ffb469', forca: 2.2, alcance: 5.5 },
  /** Clarão quente no alto, sem sombra: devolve às vigas e ao peito da chaminé a luz que o piso rebate. */
  rebatida: { cor: '#ff9a55', forca: 3.6, alcance: 10, x: -0.6, y: 4.0, z: -0.8 },
  /** Poça de luz do lugar do Noel: spot largo, do alto, deslocado (dx, dz) para o lado da câmera. */
  noel: { cor: '#ffb877', forca: 15, angulo: 0.3, altura: 5.0, dx: 2.0, dz: 3.2 },
  /**
   * Preenchimento da fila (jogo 3D): spot quente, largo e sem sombra, do lado da câmera, sobre o piso da fila. A
   * fila é vista de costas e o fogo pega o outro lado dos visitantes: sem isto as costas viram uma massa escura.
   * Fraco de propósito (é a luz que o piso e a sala rebatem, não um refletor).
   */
  fila: { cor: '#ffb98a', forca: 9, angulo: 0.62, posicao: [6.2, 6.6, 7.4] as [number, number, number], alvo: [1.4, 0.3, 0.2] as [number, number, number] },
  /** Destaque da área de entrega (setDeliveryActive). */
  entrega: { cor: '#ffd9a0', forca: 26, angulo: 0.34, altura: 5.0 },
  /** Chamas das velas e do lampião (emissivo; o brilho do palco faz o halo). */
  chama: { cor: '#ffb05a', forca: 3.2 },
};

/** Materiais da arquitetura. */
export const MATERIAL = {
  /**
   * Luz pintada no reboco (coordenadas do mundo): a parede escurece para o alto (de `alto[0]` a `alto[1]` metros,
   * até `topo` do tom) e para longe do fogo (de `fogo[0]` a `fogo[1]` metros do ponto `origem`, até `longe`).
   */
  rebocoLuz: { alto: [1.3, 5.4] as [number, number], topo: 0.55, fogo: [1.8, 7.5] as [number, number], longe: 0.74, origem: [-2.7, -3.6] as [number, number] },
  /** Cera do piso: multiplica a rugosidade da textura (menor = mais espelhado). */
  pisoRugosidade: 0.64,
  pisoCor: '#c9b29c',
  pisoReflexo: 1.25,
  rebocoCor: '#dcc4a2',
  lambriCor: '#b89878',
  vigaCor: '#c4a888',
  forroCor: '#b39a80',
  madeiraEscuraCor: '#a98a70',
};

/** Aparência aplicada pelo palco (src/engine/Stage.ts). */
export const LOOK: Look = {
  background: '#05070d',
  fog: null,
  toneMapping: 'aces',
  exposure: 1.12,
  environmentIntensity: 0.9,
  ao: { radius: 0.5, intensity: 1 },
  bloom: { strength: 0.2, radius: 0.55, threshold: 1.0 },
  finish: { vignette: 0.36, vignetteColor: '#150906', warmth: 0.16, grain: 0.1, saturation: 1.04 },
  camera: {
    fov: 32,
    position: [7.5, 3.5, 11.6],
    target: [-1.4, 1.25, -5.2],
    near: 0.5,
    far: 300,
    sway: 0.06,
  },
};

/** Fila e saída. */
export const FILA = {
  espaco: 1.05,
  folgaDaFrente: 1.15,
  /**
   * Serpentina medida a partir da entrega, em relação à tela: cada fileira fica a `p` metros da entrega em
   * direção à câmera e vai de `e` a `d` metros (negativo = para a esquerda da tela). As de perto são mais
   * curtas porque a perspectiva fecha o piso visível à esquerda.
   */
  fileiras: [
    { p: 2.7, e: -2.1, d: 0.6 },
    { p: 3.8, e: -1.75, d: 0.55 },
    { p: 4.9, e: -1.35, d: 0.35 },
  ],
  /**
   * Subida da fila pela direita até a entrega (d, p como nas fileiras, a partir da referência): a fileira da frente
   * termina na borda direita e a fila sobe junto dela. O primeiro da fila fica aqui, à direita do visitante atendido.
   */
  subida: [
    [1.05, 2.5],
    [1.32, 1.8],
    [1.3, 1.1],
  ] as Array<[number, number]>,
  /** Saída (x, z do mundo, depois da entrega): por trás do primeiro da fila e à frente da árvore, até a borda direita. */
  saida: [
    [2.25, -2.75],
    [3.3, -2.8],
    [4.7, -2.55],
    [7.6, -2.0],
  ] as Array<[number, number]>,
  /** Onde o presente aparece grande: fração do caminho do Noel ao visitante e altura (m). */
  revelacao: { fracao: 0.62, altura: 2.5 },
};

/** Ambiente de reflexos gerado da própria sala. */
export const AMBIENTE = {
  /** De onde a sala é "fotografada" para os reflexos: o meio do piso livre, à altura do peito. */
  posicao: [0.9, 1.25, -0.9] as [number, number, number],
  tamanho: 256,
  /** Desfoque (radianos). */
  sigma: 0.015,
};
