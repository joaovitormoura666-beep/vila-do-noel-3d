/**
 * Presentes e caixa do jogo: os 12 presentes 3D definitivos e a caixa de presente (src/world/cast/presentes).
 * Veja o cabeçalho de presentes/index.ts para o contrato completo (escala, pivô da tampa, userData.update,
 * dispose e o que é compartilhado entre as cópias).
 */
import type * as THREE from 'three';
import type { GiftBox, Level, SetContext } from '../contracts';
import { criarCatalogo } from './presentes';

export interface GiftsPart {
  createGift(id: string): THREE.Object3D;
  createGiftBox(): GiftBox;
  setQuality(level: Level): void;
  /** Opcional: libera geometrias, materiais e texturas de todos os presentes (fim do jogo). */
  dispose?(): void;
}

export function buildGifts(ctx: SetContext): GiftsPart {
  const catalogo = criarCatalogo(ctx);
  return {
    createGift: catalogo.createGift,
    createGiftBox: catalogo.createGiftBox,
    setQuality: catalogo.setQuality,
    dispose: catalogo.dispose,
  };
}
