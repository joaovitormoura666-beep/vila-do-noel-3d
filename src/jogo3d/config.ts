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
  /**
   * Longe do alvo (mais de `pressaDe` metros), quem anda apressa o passo até `pressa` vezes a velocidade (a fase
   * do passo continua presa à distância: as perninhas andam mais rápido, sem patinar). Assim quem chega com a fila
   * vazia não leva meio minuto atravessando a serpentina.
   */
  pressa: 2.6,
  pressaDe: 1.6,
  pressaAte: 4.0,
};

export const FILA3D = {
  /**
   * Teto de gente esperando na tela (o painel escolhe maxVisible). Com a câmera do jogo (mais fechada no Noel) e
   * todos os pés acima da faixa do chat, o caminho da sala A comporta 10; com o atendido e quem sai, até 12 na tela.
   */
  tetoVisiveis: 10,
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
  inicioVisivel: 1.5,
  /** Parado na entrega: tempo (s) para virar de frente para o Noel antes de a agenda começar. */
  virarNaEntrega: 0.25,
  /** Com a fila cheia na tela, monta gnomos novos só a cada tantos quadros (montar custa mais que um quadro). */
  montarACadaCheia: 2,
  /**
   * Saída com "passeio": quem ganhou dá alguns passos para a câmera (sobre o tapete), para e mostra o presente
   * por `mostrar` segundos antes de seguir pelo caminho de saída (FILA.saida em set-a/ajustes.ts).
   */
  mostrar: 0.85,
};

export const PRESENTE = {
  /** Tamanho do presente na revelação (m; o modelo cabe num cubo de 1 m). */
  escalaRevelacao: 0.72,
  /** Tamanho nas mãos do visitante. */
  escalaNaMao: 0.46,
  /** Na festa o presente cresce nas mãos até isto (o clímax precisa ler na miniatura do celular). */
  escalaNaFesta: 0.7,
  /** Tamanho da caixa (m). */
  escalaCaixa: 0.9,
  /** Onde a caixa para: fração do caminho do Noel ao visitante, altura da base (m) e quanto vem para a câmera (m). */
  caixa: { fracao: 0.56, altura: 0.8, paraCamera: 0.3 },
  /** Brilho contido: raio do halo (m) e opacidade máxima (fica abaixo do limiar do bloom). */
  /** Halo atrás do presente: raio (m) e opacidade na revelação; naMao = fração dele que fica nas mãos, na festa. */
  halo: { raio: 0.62, opacidade: 0.42, naMao: 0.7 },
  /**
   * Na entrega o corpo do visitante fica entre o Noel e a câmera ("roubando" esta fração do giro para a câmera,
   * 0 = só o Noel); a cabeça e o peito viram para o Noel (pose.turn), para o rosto aparecer de três quartos.
   */
  olharCamera: 0.7,
  /** Quanto da diferença entre o corpo e o Noel a cabeça e o peito compensam (1 = olham direto para o Noel). */
  cabecaParaNoel: 0.75,
  /**
   * Na festa o visitante dá uns passinhos para a câmera, saindo de cima do fundo da árvore (o presente lê contra o
   * tapete e a sala, não contra as luzinhas): distância (m) e em que fração da festa ele chega lá.
   */
  passosNaFesta: 0.6,
  /**
   * Os passinhos quase retos para a câmera, com um leve giro (rad, negativo = para a esquerda da tela): o visitante
   * se afasta da coluna da fila (à direita) sem chegar perto do lugar da fileira da frente (à esquerda).
   */
  giroDosPassos: -0.2,
  /** Na festa ele se vira quase de frente para a câmera (fração do giro do Noel para a câmera). */
  olharCameraNaFesta: 0.85,
  /** Faíscas na abertura da caixa. */
  faiscas: 26,
};

/**
 * Escala própria de cada presente (multiplica a da revelação e a das mãos): os finos e altos (bengala, meia,
 * pinheirinho, boneco) parecem menores que os redondos no mesmo cubo de 1 m.
 */
export const ESCALA_PRESENTE: Readonly<Record<string, number>> = {
  bengala: 1.25,
  meia: 1.15,
  pinheirinho: 1.2,
  boneco: 1.15,
  biscoito: 1.1,
};

export function escalaDoPresente(id: string): number {
  return ESCALA_PRESENTE[id] ?? 1;
}

/**
 * Câmera do jogo (só o jogo 3D; o laboratório continua com a câmera da sala, LOOK.camera em set-a/ajustes.ts).
 * Mais fechada e mais baixa que a da sala: o Noel fica com cerca de um quarto da altura da tela e a fila inteira
 * cabe acima da faixa do chat do TikTok. `zoomRevelacao` = graus de fov a menos no momento da revelação.
 */
export const CAMERA_JOGO = {
  fov: 29,
  position: [7.05, 3.2, 10.9] as [number, number, number],
  // alvo baixo: o Noel sobe na tela (rosto perto de y 740) e sobra piso acima do chat para a fila
  target: [-1.4, 0.4, -5.2] as [number, number, number],
  zoomRevelacao: 2.6,
};

/** Direção (no piso, normalizada) dos passinhos da festa a partir do ponto da entrega. */
export function direcaoDosPassos(entrega: { x: number; z: number }, camera: readonly [number, number, number], out: { x: number; y: number; z: number }) {
  const dx = camera[0] - entrega.x;
  const dz = camera[2] - entrega.z;
  const ang = Math.atan2(dx, dz) + PRESENTE.giroDosPassos;
  out.x = Math.sin(ang);
  out.y = 0;
  out.z = Math.cos(ang);
  return out;
}

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
