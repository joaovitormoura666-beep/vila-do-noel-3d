/**
 * Sala B: TODOS os números que o dono pode querer ajustar ficam aqui (planta, câmera, luz, cor).
 *
 * Planta (metros, vista de cima). O canto da sala fica na origem; a sala ocupa x < 0 e z > 0.
 *   parede J (da janela):  plano z = 0, corre para -X. A janela olha para +Z; a vila fica em z < 0.
 *   parede L (da lareira): plano x = 0, corre para +Z. É a empena: a lareira fica sob a cumeeira.
 *   A câmera fica fora da sala (parede cortada, como em um estúdio), olhando para o canto em diagonal.
 */
import type { Look } from '../contracts';

const grau = Math.PI / 180;

export const PLANTA = {
  /** Espessura das paredes (igual à opção espessuraParede da janela). */
  espessura: 0.4,
  /** Comprimento construído da parede J (para -X) e da parede L (para +Z). */
  comprimentoJ: 11.5,
  comprimentoL: 17,
  /** Altura do topo da parede J (onde o telhado apoia). */
  beiral: 5.3,
  /**
   * Inclinação do telhado, em graus. A cumeeira corre em X, no meio de comprimentoL. Só a água de trás
   * (da parede J até a cumeeira) é construída: a da frente fica do lado da câmera e taparia a sala.
   */
  inclinacao: 20,
  /** Altura do lambri de tábuas (coincide com o peitoril da janela). */
  lambri: 0.9,
  /** Tesouras do telhado: posições em X (uma terceira, em -10.65, cruzaria a frente do quadro). */
  tesouras: [-2.25, -6.45],
  /** Piso: até onde vai (precisa passar da borda de baixo da tela). */
  piso: { xMin: -22, xMax: 0.2, zMin: -0.2, zMax: 22 },
};

export const PECAS = {
  janela: { x: -4.2, largura: 2.8, altura: 3.2, peitoril: 0.9, colunas: 4, linhas: 3, abertura: 0.86, semente: 3 },
  lareira: { z: 3.95, largura: 3.2, alturaConsole: 1.7, alturaTotal: 7.0, profundidade: 0.95, semente: 7 },
  arvore: { x: -1.7, z: 1.7, altura: 5.0, raio: 1.75, luzes: 220, presentes: 4, semente: 7, giro: -0.69 },
  /** recuo: quanto a vila fica atrás do vidro (o terreno da peça avança 1 m para dentro; o recuo o esconde na parede). */
  exterior: { semente: 7, ganho: 0.8, luzDaSala: 1, recuo: 0.76 },
  tapete: { x: -3.75, z: 5.15, diametro: 3.1, giro: 0.4, semente: 3 },
  /** Poltrona do Noel, no recanto entre a árvore e a lareira, virada para o meio da sala. */
  poltrona: { x: -2.45, z: 3.6, giro: -1.05, escala: 1.35, tinta: '#b8705e' },
  /** Lanterna pendurada na linha da primeira tesoura (x = PLANTA.tesouras[0]), sobre o lugar do Noel. */
  lanterna: { x: -2.25, z: 3.4, corda: 1.25 },
};

/** Lugares do jogo (coordenadas de piso). */
export const LUGARES = {
  noel: { x: -3.6, z: 5.0 },
  entrega: { x: -5.1, z: 4.9 },
  /** Altura do ponto de revelação do presente, acima do meio entre o Noel e o visitante. */
  revelacaoY: 3.25,
  espacoFila: 1.12,
  folgaFrente: 1.7,
};

export const CAMERA = {
  /** Giro da câmera em relação à parede da janela, em graus (0 = de frente para a janela). */
  angulo: 40,
  /** Ponto do piso para onde a câmera aponta o eixo (x, z) e a altura do alvo. */
  alvo: { x: -2.35, y: 0.95, z: 1.95 },
  distancia: 24,
  altura: 4.4,
  fov: 36,
  balanco: 0.06,
};

export const LUZ = {
  /** Multiplica a luz principal do fogo (o spot da lareira) depois do tremor dela. */
  fogo: 2.6,
  /**
   * Leque da luz principal do fogo (spot da peça): meio ângulo em radianos, penumbra, alcance, queda com a
   * distância e desvio (metros que o alvo anda para o lado da parede da janela, para o leque pegar a árvore).
   */
  fogoCone: { angulo: 1.22, penumbra: 0.9, alcance: 30, queda: 0.85, desvio: 0 },
  /** Multiplica a luz "rebatida" da lareira (sobe pela pedra e pela parede). */
  fogoRebatido: 2.2,
  /** Luar pela janela: multiplicador sobre exterior.luzExterna.intensidade; a cor é copiada a cada quadro. */
  luar: 8,
  /** Saturação da cor do luar dentro da sala (1 = a cor de fora como veio; mais = o recorte no piso âmbar ainda lê azul). */
  luarSaturacao: 1.8,
  /** Facho do luar visto no ar (véu de poeira azul riscado pelas travessas). 0 desliga. */
  facho: 0.016,
  /** Reflexo da janela no piso encerado (coluna azul abaixo da janela, vista rasante). 0 desliga. */
  reflexoJanela: 0.3,
  /** Elevação do luar, em graus (o azimute é sempre o de exterior.luar.direcao). */
  luarElevacao: 37,
  /** Distância do spot do luar ao centro da janela (raios quase paralelos). */
  luarDistancia: 30,
  /** Luz da árvore (PointLight da peça). */
  arvore: 1.5,
  /** Luz pontual fraca da lanterna pendurada (a chama em si). */
  lanterna: { cor: '#ffb463', forca: 2.2, alcance: 6 },
  /** Poça de luz quente no lugar do Noel (lanterna pendurada na tesoura). */
  poca: { cor: '#ffc27d', forca: 40, forcaEntrega: 75, angulo: 0.5, penumbra: 0.9 },
  /**
   * Preenchimento. `ceu` chega às faces viradas para cima (piso, tampos) e fica baixo, para as sombras do
   * fogo continuarem fundas; `chao` é o rebatido do piso aquecido e chega às faces viradas para baixo
   * (forro, barriga das vigas): é ele que deixa o telhado legível.
   */
  preenchimento: { ceu: '#7a5640', chao: '#d07a3c', forca: 1.5 },
  /** Força do recorte do luar pintado no piso (níveis médio e baixo, sem a sombra do luar). */
  recortePintado: 0.05,
  /** Mapas de sombra por nível. */
  sombra: { alta: 2048, media: 1024 },
};

export const MATERIAIS = {
  reboco: '#e9d3b0',
  rebocoNormal: 0.9,
  lambri: '#b0906c',
  vigas: '#d6b592',
  forro: '#c4a482',
  marcenaria: '#a8826a',
  piso: { cor: '#d4b392', rugosidade: 0.62, relevo: 1.0, reflexo: 1.0 },
  /** Móveis: força do reflexo do ambiente. */
  reflexoMoveis: 1.0,
};

export const LOOK: Look = {
  background: '#06080f',
  fog: { color: '#1c0f09', near: 24, far: 95 },
  toneMapping: 'aces',
  exposure: 1.3,
  environmentIntensity: 0.55,
  ao: { radius: 0.55, intensity: 1.0 },
  bloom: { strength: 0.2, radius: 0.55, threshold: 1.0 },
  finish: { vignette: 0.34, vignetteColor: '#140907', warmth: 0.18, grain: 0.1, saturation: 1.04 },
  camera: (() => {
    const a = CAMERA.angulo * grau;
    const { x, y, z } = CAMERA.alvo;
    return {
      fov: CAMERA.fov,
      position: [x - Math.sin(a) * CAMERA.distancia, CAMERA.altura, z + Math.cos(a) * CAMERA.distancia] as [number, number, number],
      target: [x, y, z] as [number, number, number],
      near: 0.5,
      far: 400,
      sway: CAMERA.balanco,
    };
  })(),
};
