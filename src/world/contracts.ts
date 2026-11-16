/**
 * Contratos entre o jogo e a arte 3D.
 *
 * O jogo (fila, entrega, nomes, efeitos) só conhece estas interfaces. Assim o cenário,
 * o Papai Noel, os visitantes e os presentes podem ser trocados (outro estilo, um modelo
 * GLB enviado pelo dono) sem mexer na lógica.
 *
 * Unidades: metros. Eixo Y para cima. A câmera olha, em geral, de +Z para -Z.
 * Um visitante tem perto de 1,1 m de altura; o Noel, perto de 2 m.
 * Ângulo "yaw": rotação em Y; 0 = de frente para +Z (para a câmera).
 */
import type * as THREE from 'three';
import type { AmbientEffectId, AmbientState } from '../../shared/ambient';

export type { AmbientEffectId, AmbientState };

export type Level = 'alta' | 'media' | 'baixa';

/* ------------------------------------------------------------------ cenário */

/** Aparência geral aplicada pelo palco (src/engine/Stage.ts). Tudo aqui é ajustável sem mexer em geometria. */
export interface Look {
  /** Cor de fundo (o cenário pode ter o próprio céu por cima). */
  background: string;
  /** Neblina linear para dar profundidade. */
  fog: { color: string; near: number; far: number } | null;
  toneMapping: 'aces' | 'agx' | 'neutral' | 'none';
  exposure: number;
  /** Força dos reflexos do ambiente (VillageSet.environment) nos materiais. Padrão 1. */
  environmentIntensity?: number;
  /**
   * Oclusão de ambiente, opcional e só no nível alto: escurece suavemente cantos, encontros e a base
   * dos objetos (é o que "assenta" os móveis no chão). radius em metros (0,3 a 0,8 costuma servir);
   * intensity de 0 a 1 ou um pouco mais. Objetos transparentes, recortados por alpha e partículas
   * ficam de fora sozinhos; para tirar outro objeto, marque userData.semAO = true.
   */
  ao?: { radius: number; intensity: number; distanceExponent?: number; thickness?: number } | null;
  /** Brilho ao redor do que é luminoso. null desliga. */
  bloom: { strength: number; radius: number; threshold: number } | null;
  /**
   * Acabamento de imagem, opcional (uma passada barata, desligada no nível baixo):
   * vignette escurece as bordas (0 a 1); vignetteColor tinge esse escurecimento;
   * warmth empurra os tons claros para o dourado e os escuros para o azul (0 a 1);
   * grain acrescenta um granulado fino de pintura (0 a 1).
   */
  finish?: { vignette?: number; vignetteColor?: string; warmth?: number; grain?: number; saturation?: number };
  camera: {
    fov: number;
    position: [number, number, number];
    target: [number, number, number];
    near?: number;
    far?: number;
    /** Balanço lento da câmera, em metros (0 = parada). Dá vida e paralaxe. */
    sway?: number;
  };
}

/** Um lugar no chão com direção. */
export interface Spot {
  position: THREE.Vector3;
  yaw: number;
}

/** Pontos de referência que o jogo usa para posicionar tudo. */
export interface VillageAnchors {
  /** Onde o Papai Noel fica. */
  santa: Spot;
  /** Onde o visitante atendido para (de frente para o Noel). */
  delivery: Spot;
  /** Onde o presente aparece grande na revelação (bem visível, acima da cena da entrega). */
  reveal: THREE.Vector3;
  /**
   * Caminho da fila pelo chão: começa fora da tela (entrada) e termina exatamente em delivery.position.
   * A fila se organiza ao longo dele; precisa caber maxVisible pessoas (11 a 13) dentro da tela.
   */
  queuePath: THREE.Vector3[];
  /** Caminho de saída: começa em delivery.position e termina fora da tela. */
  exitPath: THREE.Vector3[];
  /** Distância entre as pessoas na fila, em metros ao longo do caminho. */
  queueSpacing: number;
  /** Distância, ao longo do caminho, entre a área de entrega e o primeiro da fila. */
  frontGap: number;
}

export interface VillageSet {
  /** Tudo do cenário (inclui as luzes e a neve caindo). */
  root: THREE.Group;
  /**
   * Opcional: ambiente para os reflexos dos materiais PBR (vai para scene.environment), com a força
   * em look.environmentIntensity. Pode ser um HDR carregado ou um ambiente gerado a partir da própria sala.
   */
  environment?: THREE.Texture | null;
  look: Look;
  anchors: VillageAnchors;
  /** Animação ambiente (luzes piscando, neve, fumaça...). Sem setTimeout nem relógio próprio: só dt e t. */
  update(dt: number, t: number): void;
  /** Reduz ou devolve efeitos caros (sombras, partículas, luzes). */
  setQuality(level: Level): void;
  /** Destaque suave na área de entrega enquanto alguém é atendido. */
  setDeliveryActive(on: boolean): void;
  /**
   * Eventos ambientais (veja shared/ambient.ts). O jogo chama a cada quadro, para cada efeito,
   * com o estado calculado pela agenda (src/ambient/AmbientDirector.ts): `intensity` de 0 a 1 já
   * com entrada e saída suaves, e `progress` de 0 a 1 ao longo da duração. O cenário só desenha:
   * não guarda relógio próprio do efeito. intensity = 0 significa efeito desligado.
   *   TREE_SPARKLE     as luzes da árvore piscam e cintilam com força
   *   FIREPLACE_MAGIC  a lareira se intensifica e solta partículas mágicas
   *   SLEIGH_PASS      um trenó cruza o céu visto pela janela (posição conforme progress)
   *   MAGICAL_NIGHT    a iluminação do lado de fora muda e surge uma aurora
   */
  setAmbient(effect: AmbientEffectId, state: AmbientState): void;
  dispose(): void;
}

export interface SetContext {
  renderer: THREE.WebGLRenderer;
  level: Level;
}

/** Pode ser assíncrono: o cenário carrega modelos e texturas antes de ficar pronto. */
export type BuildVillageSet = (ctx: SetContext) => VillageSet | Promise<VillageSet>;

/* --------------------------------------------------------------- personagens */

/**
 * Pose de um visitante. O jogo escreve estes números a cada quadro e chama update();
 * o boneco se desenha de acordo. Todos de 0 a 1, menos phase.
 */
export interface VisitorPose {
  /** 0 parado, 1 andando. */
  walk: number;
  /** Fase do passo, em radianos (o jogo avança conforme a distância andada). */
  phase: number;
  /** Altura do pulinho de alegria (0 no chão, 1 no topo). */
  jump: number;
  /** Braços erguidos segurando o presente acima da cabeça. */
  hold: number;
  /** Alegria: braços para cima, corpo esticado. */
  joy: number;
  /** Olhando para cima (para o presente). */
  lookUp: number;
  /**
   * Opcional: meia largura (m) do presente que ele segura, no eixo X do corpo. As mãos encostam nos lados do
   * presente em vez de ficarem na largura padrão de uma caixa. Sem o campo, vale a largura da caixa.
   */
  holdWidth?: number;
  /** Opcional: meia altura (m) do presente nas mãos; o presente sobe isto para assentar acima do gorro. */
  holdLift?: number;
  /** Opcional: giro da cabeça e do peito em relação ao corpo (rad, + = para a esquerda dele); para olhar alguém de lado. */
  turn?: number;
}

export interface VisitorRig {
  /** Raiz com os pés em y = 0. O jogo move e gira este objeto. */
  root: THREE.Group;
  pose: VisitorPose;
  /** Ponto no topo da cabeça: a etiqueta de nome fica presa logo acima. */
  labelAnchor: THREE.Object3D;
  /** Ponto onde o presente recebido fica (acima da cabeça, entre as mãos erguidas). */
  giftAnchor: THREE.Object3D;
  /** Altura total, em metros. */
  height: number;
  update(dt: number, t: number): void;
  dispose(): void;
}

/** Pose do Papai Noel, de 0 a 1 cada. O jogo anima os números; o boneco mistura as poses. */
export interface SantaPose {
  /** Acenando. */
  wave: number;
  /** Falando (cabeça e barba se mexendo). */
  talk: number;
  /** Mexendo dentro do saco de presentes. */
  rummage: number;
  /** Braços erguidos apresentando o presente. */
  present: number;
  /** Estendendo o braço para entregar. */
  give: number;
  /** Comemorando. */
  cheer: number;
}

export interface SantaRig {
  /** Raiz com os pés em y = 0, incluindo o saco de presentes ao lado. */
  root: THREE.Group;
  pose: SantaPose;
  /** Boca do saco: de onde a caixa do presente sai. */
  sackMouth: THREE.Object3D;
  /** Topo da cabeça: o balão de fala aponta para cá. */
  bubbleAnchor: THREE.Object3D;
  height: number;
  update(dt: number, t: number): void;
  dispose(): void;
}

/**
 * Caixa de presente com tampa que salta na revelação. Origem no centro da base.
 * Em tamanho real: cerca de 42 cm de lado e 46 cm de altura com o laço (a definitiva, em
 * src/world/cast/presentes/caixa.ts; a provisória tem ~1 m). O pivô de `lid` é o centro de cima do
 * corpo (onde a tampa assenta): subir lid.position.y e girar lid.rotation abre a tampa.
 * Opcional, em root.userData: tamanho { lado, alturaCorpo, alturaTotal } e dispose(); e, na definitiva,
 * abrir(f) (f de 0 a 1, linear no tempo: a tampa solta, bascula em dobradiça na borda de trás com mola e
 * sobe no máximo 0,12 m, sem se separar da caixa), inicioFaiscas (o f a partir do qual soltar faíscas)
 * e boca (Vector3 do centro da boca, no espaço de root).
 */
export interface GiftBox {
  root: THREE.Group;
  lid: THREE.Object3D;
  body: THREE.Object3D;
}

export interface Cast {
  /** Visitante com aparência escolhida a partir da semente (o mesmo usuário tem sempre a mesma). */
  createVisitor(seed: string): VisitorRig;
  createSanta(): SantaRig;
  /**
   * Presente decorativo pelo id do catálogo (src/gifts/giftCatalog.ts).
   * Centrado na origem, cabendo em um cubo de 1 m. Quem chama cuida da escala.
   * Opcional, em userData: update(dt, t) (animação própria: chame a cada quadro se existir) e
   * dispose() (tira de cena; as cópias compartilham geometria e materiais, então não descarte
   * geometry nem material das malhas); escalaVisual (multiplica a escala na revelação e na mão: os
   * finos, como a bengala, vêm maiores) e fatorHalo (multiplica um halo aditivo atrás do presente: os
   * metais polidos pedem menos). Detalhes em src/world/cast/presentes/index.ts.
   */
  createGift(id: string): THREE.Object3D;
  createGiftBox(): GiftBox;
  /**
   * Troca o nível de detalhe. Com `aosPoucos` = true, os visitantes já em cena não são remodelados todos no mesmo
   * quadro: o jogo chama `stepQuality()` uma vez por quadro e cada chamada troca um (opcional para quem implementa).
   */
  setQuality(level: Level, aosPoucos?: boolean): void;
  /** Opcional: troca a malha de um visitante pendente da última troca de nível; true se trocou. */
  stepQuality?(): boolean;
}

export type BuildCast = (ctx: SetContext) => Cast;
