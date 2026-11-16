/**
 * Contingência: as peças do kit são polidas por outras pessoas ao mesmo tempo. Se a árvore não carregar,
 * a sala é montada sem ela; se a lareira do kit não
 * carregar (erro de compilação ou de execução dentro de src/world/kit/lareira), a sala é montada com um
 * volume escuro e uma luz âmbar no lugar, e avisa no console. Não é para ser vista: é só para a montagem
 * não parar. Com a peça de verdade no ar, este arquivo não é usado.
 */
import * as THREE from 'three';
import type { Level } from '../contracts';
import type { KitContext } from '../kit/tipos';
import type { ArvoreDeNatal, OpcoesArvore, OpcoesGuirlanda } from '../kit/arvore';
import type { Lareira, LareiraOpcoes } from '../kit/lareira';
import type { Peca } from '../kit/tipos';

export async function carregarLareira(ctx: KitContext, opcoes: LareiraOpcoes): Promise<{ lareira: Lareira; provisoria: boolean }> {
  try {
    const modulo = await import('../kit/lareira');
    return { lareira: await modulo.criarLareira(ctx, opcoes), provisoria: false };
  } catch (erro) {
    console.warn('[sala-b] a lareira do kit não carregou; usando o volume provisório', erro);
    return { lareira: lareiraProvisoria(opcoes), provisoria: true };
  }
}

/** Árvore do kit; se a peça não carregar, a sala é montada sem ela (devolve null) e avisa no console. */
export async function carregarArvore(ctx: KitContext, opcoes: OpcoesArvore): Promise<ArvoreDeNatal | null> {
  try {
    const modulo = await import('../kit/arvore');
    return await modulo.criarArvore(ctx, opcoes);
  } catch (erro) {
    console.warn('[sala-b] a árvore do kit não carregou; sala montada sem ela por enquanto', erro);
    return null;
  }
}

/** Guirlanda do kit (mesmo módulo da árvore), com a mesma contingência. */
export async function carregarGuirlanda(ctx: KitContext, opcoes: OpcoesGuirlanda): Promise<Peca | null> {
  try {
    const modulo = await import('../kit/arvore');
    return await modulo.criarGuirlanda(ctx, opcoes);
  } catch (erro) {
    console.warn('[sala-b] a guirlanda do kit não carregou', erro);
    return null;
  }
}

function lareiraProvisoria(o: LareiraOpcoes): Lareira {
  const L = o.largura ?? 3.2;
  const aC = o.alturaConsole ?? 1.7;
  const H = o.alturaTotal ?? 6;
  const P = o.profundidade ?? 0.95;
  const root = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: '#3a302a', roughness: 0.95 });
  const corpo = new THREE.Mesh(new THREE.BoxGeometry(L, aC + 0.6, P), mat);
  corpo.position.set(0, (aC + 0.6) / 2, P / 2);
  const peito = new THREE.Mesh(new THREE.BoxGeometry(L * 0.64, H, P * 0.66), mat);
  peito.position.set(0, H / 2, P * 0.33);
  const boca = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.8), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff8a3a').multiplyScalar(2) }));
  boca.position.set(0, 0.6, P + 0.01);
  root.add(corpo, peito, boca);
  const luz = new THREE.SpotLight('#ff9442', 5.2, 26, 1.2, 0.85, 0.7);
  luz.position.set(0, 0.78, P - 0.02);
  luz.target.position.set(0, 0.44, P + 2.4);
  luz.shadow.mapSize.set(2048, 2048);
  luz.shadow.camera.near = 0.25;
  luz.shadow.camera.far = 26;
  luz.shadow.bias = -0.0008;
  luz.shadow.normalBias = 0.045;
  const camara = new THREE.PointLight('#ff7a2c', 2.4, 3.4, 1.2);
  camara.position.set(0, 0.66, P - 0.2);
  const rebatida = new THREE.PointLight('#ff8a3a', 6.8, 9, 0.7);
  rebatida.position.set(0, -0.35, P + 1.5);
  root.add(luz, luz.target, camara, rebatida);
  const base = { luz: luz.intensity, rebatida: rebatida.intensity };
  const peca: Lareira = {
    root,
    luz,
    luzes: [luz, camara, rebatida],
    bocaDoFogo: new THREE.Vector3(0, 0.6, P - 0.3),
    console: { y: aC, largura: L, profundidade: 0.3, z: P + 0.05 },
    forca: 1,
    fogo: null as unknown as Lareira['fogo'],
    setMagia() {},
    update(_dt: number, t: number) {
      const b = 1 + 0.08 * Math.sin(t * 6.1) + 0.05 * Math.sin(t * 13.7 + 1);
      luz.intensity = base.luz * b * peca.forca;
      rebatida.intensity = base.rebatida * b * peca.forca;
    },
    setQuality(_level: Level) {},
    dispose() {
      corpo.geometry.dispose();
      peito.geometry.dispose();
      boca.geometry.dispose();
      mat.dispose();
    },
  };
  return peca;
}
