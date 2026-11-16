/**
 * Elenco em uso pelo jogo: junta os visitantes, o Papai Noel e os presentes.
 * Cada parte mora no seu arquivo para poder ser trocada sozinha
 * (por exemplo, o Noel por um modelo GLB).
 */
import type { BuildCast } from '../contracts';
import { buildGifts } from './gifts';
import { buildSanta } from './santa';
import { buildVisitors } from './visitors';

export const buildCast: BuildCast = (ctx) => {
  const visitors = buildVisitors(ctx);
  const santa = buildSanta(ctx);
  const gifts = buildGifts(ctx);
  return {
    createVisitor: visitors.createVisitor,
    createSanta: santa.createSanta,
    createGift: gifts.createGift,
    createGiftBox: gifts.createGiftBox,
    setQuality(level) {
      visitors.setQuality(level);
      santa.setQuality(level);
      gifts.setQuality(level);
    },
  };
};
