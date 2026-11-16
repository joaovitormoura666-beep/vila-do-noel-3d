/**
 * Tecidos da sala: cortina de veludo, tapete de lã, meia de Natal, almofada e manta.
 *
 *   const cortina = await criarCortina(ctx, { largura: 1.8, altura: 4.1, abertura: 0.85, lado: 'esquerda' });
 *   const tapete = await criarTapete(ctx, { forma: 'redondo', largura: 2.8 });
 *   const meia = await criarMeia(ctx, { cor: '#174D3B', semente: 2 });   // a origem é o ganchinho
 *   const almofada = await criarAlmofada(ctx, { lado: 0.45 });
 *   const manta = await criarManta(ctx, { modo: 'dobrada' });
 */
export { criarCortina, geometriaVarao, materialVeludo, materialCordao, VERMELHO_VELUDO } from './cortina';
export type { CortinaOpcoes, VaraoOpcoes } from './cortina';
export { criarTapete } from './tapete';
export type { TapeteOpcoes } from './tapete';
export { criarMeia } from './meia';
export type { MeiaOpcoes } from './meia';
export { criarAlmofada, VERDE_VELUDO } from './almofada';
export type { AlmofadaOpcoes } from './almofada';
export { criarManta } from './manta';
export type { MantaOpcoes } from './manta';
