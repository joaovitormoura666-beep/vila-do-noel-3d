/**
 * Catálogo de presentes virtuais. São apenas animações decorativas:
 * não têm valor, não são sorteio e não podem ser resgatados.
 */
export interface GiftDef {
  id: string;
  /** Nome exibido na tela. */
  name: string;
  /** Nome com artigo, para as falas ("uma estrela dourada"). */
  spoken: string;
}

export const GIFTS: GiftDef[] = [
  { id: 'estrela', name: 'Estrela Dourada', spoken: 'uma estrela dourada' },
  { id: 'bola', name: 'Bola de Natal', spoken: 'uma bola de Natal' },
  { id: 'bengala', name: 'Bengala Doce', spoken: 'uma bengala doce' },
  { id: 'boneco', name: 'Boneco de Neve', spoken: 'um boneco de neve' },
  { id: 'ursinho', name: 'Ursinho de Pelúcia', spoken: 'um ursinho de pelúcia' },
  { id: 'sino', name: 'Sino Dourado', spoken: 'um sino dourado' },
  { id: 'meia', name: 'Meia Natalina', spoken: 'uma meia natalina' },
  { id: 'biscoito', name: 'Biscoito de Gengibre', spoken: 'um biscoito de gengibre' },
  { id: 'globo', name: 'Globo de Neve', spoken: 'um globo de neve' },
  { id: 'pinheirinho', name: 'Pinheirinho', spoken: 'um pinheirinho de Natal' },
  { id: 'chocolate', name: 'Chocolate Quente', spoken: 'uma caneca de chocolate quente' },
  { id: 'trenzinho', name: 'Trenzinho', spoken: 'um trenzinho de brinquedo' },
];

/** Escolhe presentes ao acaso evitando repetir os últimos sorteados. */
export class GiftPicker {
  private recent: string[] = [];

  constructor(
    private readonly gifts: GiftDef[] = GIFTS,
    private readonly random: () => number = Math.random,
  ) {}

  pick(): GiftDef {
    const avoid = Math.min(3, this.gifts.length - 1);
    const pool = this.gifts.filter((g) => !this.recent.slice(-avoid).includes(g.id));
    const choice = pool[Math.floor(this.random() * pool.length)] ?? this.gifts[0];
    this.recent.push(choice.id);
    if (this.recent.length > 8) this.recent.shift();
    return choice;
  }
}
