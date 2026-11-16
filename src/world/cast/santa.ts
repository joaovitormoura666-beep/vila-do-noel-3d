/**
 * Papai Noel: o Noel do dono refeito em 3D (src/world/cast/noel/), sentado na poltrona da sala com o
 * saco de presentes ao lado. Veja noel/index.ts e noel/medidas.ts (os números para ajustar).
 */
import type { Level, SantaRig, SetContext } from '../contracts';
import { buildNoel } from './noel';

export interface SantaPart {
  createSanta(): SantaRig;
  setQuality(level: Level): void;
}

export function buildSanta(ctx: SetContext): SantaPart {
  // laboratório: ?poltrona=1 põe a poltrona da sala junto do Noel no estúdio (para vê-lo sentado)
  const poltronaDeEnsaio = typeof location !== 'undefined' && new URLSearchParams(location.search).get('poltrona') === '1';
  return buildNoel(ctx, { poltronaDeEnsaio });
}
