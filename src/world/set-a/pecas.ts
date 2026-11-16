/**
 * Carregamento das peças do kit (src/world/kit) com tolerância a falhas.
 *
 * As peças são importadas uma a uma, por import dinâmico: se o arquivo de uma delas não compilar ou
 * falhar ao montar, a sala sobe assim mesmo, com um substituto invisível no lugar (mesma interface,
 * mesmas luzes), e o erro vai para o console com o nome da peça. Com o kit inteiro, nada disto aparece.
 */
import * as THREE from 'three';
import type { ArvoreDeNatal, OpcoesArvore } from '../kit/arvore';
import type { Exterior } from '../kit/exterior';
import type { Janela } from '../kit/janela';
import type { Lareira, LareiraOpcoes } from '../kit/lareira';
import type { KitContext, Peca } from '../kit/tipos';

async function tentar<T>(nome: string, montar: () => Promise<T>, substituto: () => T): Promise<T> {
  try {
    return await montar();
  } catch (erro) {
    console.error(`[sala-a] a peça "${nome}" do kit falhou; a sala foi montada sem ela.`, erro);
    return substituto();
  }
}

function pecaVazia(nome: string): Peca {
  const root = new THREE.Group();
  root.name = `${nome}-ausente`;
  return { root, update() {}, setQuality() {}, dispose() {} };
}

/** Lareira ausente: só a luz do fogo, para a sala não ficar às escuras. */
function lareiraAusente(o: LareiraOpcoes): Lareira {
  const base = pecaVazia('lareira');
  const P = o.profundidade ?? 0.95;
  const aC = o.alturaConsole ?? 1.95;
  const luz = new THREE.SpotLight('#ff9a4a', 60, 22, 1.15, 0.7, 1.4);
  luz.position.set(0, 0.55, P * 0.6);
  luz.target.position.set(0, 0.2, P + 4);
  luz.shadow.mapSize.set(1024, 1024);
  base.root.add(luz, luz.target);
  const peca = {
    ...base,
    luz,
    luzes: [luz],
    bocaDoFogo: new THREE.Vector3(0, 0.45, P * 0.5),
    console: { y: aC, largura: (o.largura ?? 3.2) * 0.9, profundidade: 0.3, z: P + 0.02 },
    forca: 1,
    setMagia() {},
    fogo: undefined,
  };
  return peca as unknown as Lareira;
}

function arvoreAusente(o: OpcoesArvore): ArvoreDeNatal {
  const base = pecaVazia('arvore');
  const altura = o.altura ?? 3.2;
  const luz = new THREE.PointLight('#ffc27a', 1, 7, 1.6);
  luz.position.set(0, altura * 0.45, 0);
  base.root.add(luz);
  return { ...base, altura, raio: o.raio ?? 1, topo: new THREE.Vector3(0, altura, 0), luz, setCintilar() {}, setEnvMap() {} };
}

export const carregarLareira = (ctx: KitContext, o: LareiraOpcoes): Promise<Lareira> =>
  tentar('lareira', async () => (await import('../kit/lareira')).criarLareira(ctx, o), () => lareiraAusente(o));

export const carregarArvore = (ctx: KitContext, o: OpcoesArvore): Promise<ArvoreDeNatal> =>
  tentar('árvore', async () => (await import('../kit/arvore')).criarArvore(ctx, o), () => arvoreAusente(o));

export const carregarGuirlanda = (ctx: KitContext, o: { raio: number; laco?: boolean; semente?: number }): Promise<Peca> =>
  tentar('guirlanda', async () => (await import('../kit/arvore')).criarGuirlanda(ctx, o), () => pecaVazia('guirlanda'));

/** A janela e o exterior são a estrutura da composição (o furo da parede sai da janela): sem substituto. */
export const carregarJanela = async (ctx: KitContext, o: Parameters<typeof import('../kit/janela').criarJanela>[1]): Promise<Janela> =>
  (await import('../kit/janela')).criarJanela(ctx, o);

export const carregarExterior = async (ctx: KitContext, o: Parameters<typeof import('../kit/exterior').criarExterior>[1]): Promise<Exterior> =>
  (await import('../kit/exterior')).criarExterior(ctx, o);

export const carregarTapete = (ctx: KitContext, o: Parameters<typeof import('../kit/tecidos').criarTapete>[1]): Promise<Peca> =>
  tentar('tapete', async () => (await import('../kit/tecidos')).criarTapete(ctx, o), () => pecaVazia('tapete'));

export const carregarMeia = (ctx: KitContext, o: Parameters<typeof import('../kit/tecidos').criarMeia>[1]): Promise<Peca> =>
  tentar('meia', async () => (await import('../kit/tecidos')).criarMeia(ctx, o), () => pecaVazia('meia'));
