/**
 * Tipos comuns das peças do kit da sala (árvore, lareira, exterior da janela, janela, tecidos...).
 * Uma peça é um pedaço de cenário pronto para ser posicionado por uma composição (src/world/set-*).
 * Convenções: metros, Y para cima, a peça nasce com a base em y = 0 e a "frente" voltada para +Z;
 * quem monta a sala move e gira `root`. Nada de relógio próprio: só dt e t.
 */
import type * as THREE from 'three';
import type { Level } from '../contracts';

export interface KitContext {
  renderer: THREE.WebGLRenderer;
  level: Level;
}

export interface Peca {
  /** Tudo da peça. A composição posiciona e gira este grupo. */
  root: THREE.Group;
  /** Animação própria (fogo, pisca-pisca, neve). */
  update(dt: number, t: number): void;
  /** Reduz ou devolve o que é caro (sombras, partículas, luzes, detalhe). */
  setQuality(level: Level): void;
  dispose(): void;
}
