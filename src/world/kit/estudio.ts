/**
 * Estúdio para fotografar uma peça do kit sozinha, já com uma luz parecida com a da sala final:
 * piso de tábuas enceradas, duas paredes de reboco, luz quente baixa vinda de um lado (com sombra),
 * um luar azul do outro e um preenchimento quente fraco. Devolve um VillageSet, então a peça é vista com
 *   node tools/shot.cjs sala --param set=kit-<peça> ...
 * Uso (em src/world/set-kit-<peça>/index.ts):
 *   export const buildVillageSet: BuildVillageSet = async (ctx) => {
 *     const arvore = await criarArvore(ctx, {...});
 *     arvore.root.position.set(0, 0, 0);
 *     return criarEstudio(ctx, { pecas: [arvore], camera: { fov: 30, position: [0, 2.2, 9], target: [0, 1.8, 0] } });
 *   };
 */
import * as THREE from 'three';
import type { AmbientEffectId, AmbientState, Level, Look, VillageSet } from '../contracts';
import { loadPbr } from '../../engine/assets';
import type { KitContext, Peca } from './tipos';

export interface EstudioOpcoes {
  pecas: Peca[];
  camera: Look['camera'];
  /** 'sala' (padrão): canto de sala com luz quente e fria. 'noite': chão de neve azulado, sem paredes (para o exterior). 'vazio': só as luzes. */
  fundo?: 'sala' | 'noite' | 'vazio';
  /** Largura e profundidade do piso do estúdio, em metros. Padrão 14. */
  tamanho?: number;
  /** Altura das paredes. Padrão 6. */
  altura?: number;
  /** Força das luzes do estúdio (1 = padrão). Use 0 quando a própria peça ilumina tudo (lareira). */
  luzQuente?: number;
  luzFria?: number;
  /** Ajustes de aparência por cima do padrão do estúdio. */
  look?: Partial<Look>;
  /** Recebe os eventos ambientais para repassar à peça (ex.: TREE_SPARKLE -> arvore.setCintilar). */
  onAmbient?: (effect: AmbientEffectId, state: AmbientState) => void;
}

export async function criarEstudio(ctx: KitContext, o: EstudioOpcoes): Promise<VillageSet> {
  const root = new THREE.Group();
  const fundo = o.fundo ?? 'sala';
  const size = o.tamanho ?? 14;
  const wallH = o.altura ?? 6;
  const descartaveis: Array<{ dispose(): void }> = [];

  if (fundo === 'sala') {
    const rep = size / 1.7; // o ladrilho de wood_floor mede 1,7 m
    const pisoMat = new THREE.MeshStandardMaterial({ ...(await loadPbr('wood_floor', { repeat: [rep, rep] })), roughness: 1, metalness: 0, color: '#b9977a' });
    const piso = new THREE.Mesh(new THREE.PlaneGeometry(size, size), pisoMat);
    piso.rotation.x = -Math.PI / 2;
    piso.receiveShadow = true;
    const paredeMat = new THREE.MeshStandardMaterial({ color: '#8a6f58', roughness: 0.92 });
    const fundoParede = new THREE.Mesh(new THREE.PlaneGeometry(size, wallH), paredeMat);
    fundoParede.position.set(0, wallH / 2, -size / 2);
    fundoParede.receiveShadow = true;
    const lado = new THREE.Mesh(new THREE.PlaneGeometry(size, wallH), paredeMat);
    lado.rotation.y = Math.PI / 2;
    lado.position.set(-size / 2, wallH / 2, 0);
    lado.receiveShadow = true;
    root.add(piso, fundoParede, lado);
    descartaveis.push(piso.geometry, pisoMat, fundoParede.geometry, paredeMat);
  } else if (fundo === 'noite') {
    const neveMat = new THREE.MeshStandardMaterial({ color: '#aebfe0', roughness: 0.95 });
    const neve = new THREE.Mesh(new THREE.PlaneGeometry(size * 4, size * 4), neveMat);
    neve.rotation.x = -Math.PI / 2;
    neve.position.y = -0.01;
    neve.receiveShadow = true;
    root.add(neve);
    descartaveis.push(neve.geometry, neveMat);
  }

  const quente = o.luzQuente ?? 1;
  const fria = o.luzFria ?? 1;
  // luz quente baixa, de lado, como a de uma lareira fora do quadro: é a principal e projeta sombra
  const fogo = new THREE.SpotLight('#ffb060', 260 * quente, 30, 0.9, 0.7, 1.6);
  fogo.position.set(5.5, 1.4, 4.5);
  fogo.target.position.set(0, 1.2, 0);
  fogo.castShadow = true;
  fogo.shadow.mapSize.set(2048, 2048);
  fogo.shadow.bias = -0.0004;
  fogo.shadow.normalBias = 0.03;
  // luar azul vindo do outro lado, de cima, como o de uma janela alta
  const lua = new THREE.DirectionalLight('#7f9ff0', 1.1 * fria);
  lua.position.set(-6, 7, 3);
  const preenchimento = new THREE.HemisphereLight('#ffcf9a', '#3a2418', fundo === 'noite' ? 0.15 : 0.28 * Math.max(quente, 0.35));
  root.add(fogo, fogo.target, lua, preenchimento);

  for (const p of o.pecas) root.add(p.root);

  const look: Look = {
    background: fundo === 'noite' ? '#0b1730' : '#120b08',
    fog: null,
    toneMapping: 'aces',
    exposure: 1,
    environmentIntensity: 0.6,
    ao: { radius: 0.5, intensity: 1 },
    bloom: { strength: 0.22, radius: 0.5, threshold: 0.92 },
    finish: { vignette: 0.35, vignetteColor: '#140a06', warmth: 0.2, grain: 0.12 },
    ...o.look,
    camera: o.camera,
  };

  const zero = new THREE.Vector3();
  const applyQuality = (level: Level) => {
    fogo.castShadow = level !== 'baixa';
    for (const p of o.pecas) p.setQuality(level);
  };
  applyQuality(ctx.level);

  return {
    root,
    look,
    // âncoras só para cumprir o contrato: no estúdio não há Noel nem fila
    anchors: {
      santa: { position: new THREE.Vector3(60, 0, 60), yaw: 0 },
      delivery: { position: new THREE.Vector3(61.4, 0, 60), yaw: 0 },
      reveal: new THREE.Vector3(60, 3, 60),
      queuePath: [new THREE.Vector3(70, 0, 60), new THREE.Vector3(61.4, 0, 60)],
      exitPath: [new THREE.Vector3(61.4, 0, 60), zero.clone().set(70, 0, 64)],
      queueSpacing: 1.3,
      frontGap: 2,
    },
    update(dt, t) {
      for (const p of o.pecas) p.update(dt, t);
    },
    setQuality: applyQuality,
    setDeliveryActive() {},
    setAmbient(effect, state) {
      o.onAmbient?.(effect, state);
    },
    dispose() {
      for (const p of o.pecas) p.dispose();
      for (const d of descartaveis) d.dispose();
    },
  };
}
