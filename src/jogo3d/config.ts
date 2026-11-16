/**
 * Números do jogo 3D (ritmo, caminhada, fila, presente). Ajuste aqui sem mexer na lógica.
 * Posições do cenário (caminho da fila, entrega, revelação) ficam nas âncoras do cenário: src/world/set-a/.
 */

export const ANDAR = {
  /** Velocidade de quem anda na fila, em m/s, na velocidade 1 do jogo. */
  velocidade: 0.5,
  /** Velocidade em que a pose `walk` chega a 1 (a passada inteira). */
  velocidadeNominal: 0.5,
  /**
   * Metros andados por radiano de fase do passo com walk = 1 (medido no gnomo: o pé de apoio recua 0,13 m por meio
   * ciclo; `__jogo3d.medirPasso()` dá de 0,029 a 0,041 conforme a semente). As pernas do gnomo são curtas: a 0,5 m/s ele dá cerca de 4 passinhos por segundo.
   */
  passoPorRadiano: 0.034,
  aceleracao: 1.5,
  frenagem: 1.1,
  /** Giro máximo do corpo (rad/s). */
  giroMax: 4.2,
  /** Depois de parar, quanto tempo (s) continua olhando para a frente do caminho antes de virar para o lado. */
  esperaParaVirar: 0.9,
  /** Saída: um pouco mais rápida (vai embora contente). */
  velocidadeSaida: 0.58,
  /** A velocidade do jogo acelera a agenda; a caminhada acelera no máximo isto (gnomo correndo fica feio). */
  aceleracaoMaxima: 1.7,
};

export const FILA3D = {
  /** Teto de gente esperando na tela (o painel escolhe maxVisible; o caminho da sala A comporta 13). */
  tetoVisiveis: 13,
  /** Quantas sementes além das visíveis ficam montadas com antecedência, fora de cena. */
  preaquecer: 2,
  /** No máximo quantos saindo ao mesmo tempo (os mais antigos aceleram e somem). */
  saindoMax: 2,
  /** A entrada está livre quando ninguém da fila está a menos de espaço x isto do começo do caminho. */
  entradaLivre: 0.9,
  /** Intervalo mínimo entre duas entradas em cena (s). */
  intervaloEntrada: 0.3,
  /** O próximo só é chamado quando quem saiu já andou isto (m) pelo caminho de saída. */
  folgaSaida: 0.6,
  /** Parado na fila, quanto o corpo vira da direção do Noel para a câmera (0 = de costas, 1 = de frente). */
  viradaParaCamera: 0.5,
  /** Até quantos metros do começo do caminho a pessoa ainda está fora da tela. */
  inicioVisivel: 2.4,
  /** Parado na entrega: tempo (s) para virar de frente para o Noel antes de a agenda começar. */
  virarNaEntrega: 0.25,
};

export const PRESENTE = {
  /** Tamanho do presente na revelação (m; o modelo cabe num cubo de 1 m). */
  escalaRevelacao: 0.72,
  /** Tamanho nas mãos do visitante. */
  escalaNaMao: 0.46,
  /** Tamanho da caixa (m). */
  escalaCaixa: 0.5,
  /** Onde a caixa para: fração do caminho do Noel ao visitante, altura da base (m) e quanto vem para a câmera (m). */
  caixa: { fracao: 0.56, altura: 0.98, paraCamera: 0.25 },
  /** Brilho contido: raio do halo (m) e opacidade máxima (fica abaixo do limiar do bloom). */
  halo: { raio: 0.62, opacidade: 0.42 },
  /** Na entrega o visitante olha para o Noel "roubando" esta fração do giro para a câmera (0 = só o Noel). */
  olharCamera: 0.32,
  /** Faíscas na abertura da caixa. */
  faiscas: 26,
};

/** Fala do Noel quando a fila está vazia: dura isto (s). */
export const FALA_SOLTA_S = 3.2;

/** Ritmo da entrada automática de visitantes fictícios no modo demonstração. */
export const DEMO = {
  /** Mantém a fila com pelo menos isto. */
  minimo: 7,
  /** Intervalo entre chegadas (s): mínimo e variação. */
  intervalo: [1.4, 3.6] as [number, number],
  /** Quantos entram logo no começo. */
  iniciais: 4,
};
