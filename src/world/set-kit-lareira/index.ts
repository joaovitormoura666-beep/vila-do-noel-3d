/**
 * Estúdio da lareira: a peça sozinha em um canto de sala, como luz principal (luzQuente: 0), com um
 * luar frio fraco e uma poltrona perto para conferir as sombras longas e o calor no piso encerado.
 *   node tools/shot.cjs sala --param set=kit-lareira --out lab/fotos/kit-lareira/final.png
 *   node tools/shot.cjs sala --param set=kit-lareira --param efeito=FIREPLACE_MAGIC --param intensidade=1 --t 2,3,4
 */
import * as THREE from 'three';
import type { BuildVillageSet } from '../contracts';
import { loadModel } from '../../engine/assets';
import { criarEstudio } from '../kit/estudio';
import type { Peca } from '../kit/tipos';
import { criarLareira } from '../kit/lareira';

export const buildVillageSet: BuildVillageSet = async (ctx) => {
  const altura = 6;
  const tamanho = 14;
  const lareira = await criarLareira(ctx, { alturaTotal: altura });
  // encostada na parede do fundo do estúdio, um pouco para a esquerda
  lareira.root.position.set(-0.6, 0, -tamanho / 2);
  lareira.luz.castShadow = true;
  // só para estudo no laboratório: ?lz=1,0,0 desliga luzes da peça (principal, câmara, soleira); ?forca=1.3 muda o fogo
  const params = new URLSearchParams(location.search);
  const lz = (params.get('lz') ?? '').split(',').map(Number);
  lareira.luzes.forEach((l, i) => {
    if (Number.isFinite(lz[i]) && params.has('lz')) l.visible = lz[i] > 0;
  });
  if (params.has('forca')) lareira.forca = Number(params.get('forca')) || 0;
  if (params.get('semchamas') === '1') lareira.fogo.root.visible = false;

  // objetos simples para ver as sombras longas: a poltrona de lado para o fogo e um banquinho de três pernas
  const poltrona = await loadModel('assets/modelos/ArmChair_01.glb');
  poltrona.position.set(1.6, 0, -tamanho / 2 + 3.0);
  poltrona.rotation.y = -2.3;
  const aderecos: Peca = {
    root: new THREE.Group(),
    update() {},
    setQuality() {},
    dispose() {},
  };
  // banquinho baixo entre o fogo e a câmera: a sombra dele corre comprida pelo piso, na direção de quem olha
  const banco = await loadModel('assets/modelos/painted_wooden_stool.glb');
  banco.position.set(-0.4, 0, -tamanho / 2 + 3.5);
  banco.rotation.y = 0.5;
  aderecos.root.add(poltrona, banco);

  const set = await criarEstudio(ctx, {
    pecas: [lareira, aderecos],
    tamanho,
    altura,
    luzQuente: 0,
    luzFria: 0.6,
    camera: { fov: 34, position: [3.4, 1.9, 5.9], target: [-0.6, 2.55, -6.6] },
    look: {
      exposure: 1.2,
      bloom: { strength: 0.22, radius: 0.5, threshold: 1.0 },
      ao: { radius: 0.45, intensity: 1 },
      finish: { vignette: 0.4, vignetteColor: '#120805', warmth: 0.22, grain: 0.12 },
    },
    onAmbient(effect, state) {
      if (effect === 'FIREPLACE_MAGIC') lareira.setMagia(state.intensity);
    },
  });
  // preenchimento quente bem fraco, só para a pedra do alto não sumir no escuro do estúdio
  set.root.add(new THREE.HemisphereLight('#ffc890', '#2a1810', 0.2));
  return set;
};
