/**
 * Estúdio para fotografar a árvore de Natal do kit sozinha:
 *   node tools/shot.cjs sala --param set=kit-arvore --out lab/fotos/kit-arvore/foto.png
 * Parâmetros extras do endereço (só deste estúdio):
 *   escuro=1            sala quase apagada, para ver as próprias luzinhas dominando
 *   peca=folhagens      em vez da árvore, mostra a guirlanda e o festão na parede do fundo
 *   semente=7           outra árvore
 *   numeros=1           escreve no console (como aviso) as chamadas de desenho e os triângulos próprios da peça
 *   TREE_SPARKLE (efeito=TREE_SPARKLE&intensidade=1) é repassado para arvore.setCintilar
 */
import * as THREE from 'three';
import type { BuildVillageSet } from '../contracts';
import { criarEstudio } from '../kit/estudio';
import { criarArvore, criarFestao, criarGuirlanda } from '../kit/arvore';

/** Conta malhas visíveis e triângulos de uma peça (cada malha é uma chamada de desenho na passada principal). */
function contar(raiz: THREE.Object3D): string {
  const linhas: string[] = [];
  let total = 0;
  let malhas = 0;
  raiz.traverse((o) => {
    const m = o as THREE.InstancedMesh;
    if (!m.isMesh || !m.visible) return;
    const g = m.geometry;
    const tri = ((g.index ? g.index.count : g.getAttribute('position').count) / 3) * (m.isInstancedMesh ? m.count : 1);
    total += tri;
    malhas++;
    linhas.push(`${m.name || '?'}=${Math.round(tri)}`);
  });
  return `[numeros] ${raiz.name}: ${malhas} malhas, ${Math.round(total)} triangulos (${linhas.join(', ')})`;
}

export const buildVillageSet: BuildVillageSet = async (ctx) => {
  const params = new URLSearchParams(location.search);
  const escuro = params.get('escuro') === '1';
  if (params.get('peca') === 'folhagens') {
    // guirlanda e festão pendurados na parede do fundo do estúdio (z = -3)
    const guirlanda = await criarGuirlanda(ctx, { raio: 0.3 });
    guirlanda.root.position.set(0, 2.05, -2.98);
    const festao = await criarFestao(ctx, { pontos: [new THREE.Vector3(-0.5, 1.75, -2.88), new THREE.Vector3(0, 1.72, -2.88), new THREE.Vector3(0.5, 1.75, -2.88)], luzes: true });
    const simples = await criarFestao(ctx, { pontos: [new THREE.Vector3(-0.45, 1.2, -2.9), new THREE.Vector3(0.45, 1.2, -2.9)], espessura: 0.16, semente: 5 });
    if (params.get('numeros') === '1') for (const p of [guirlanda, festao, simples]) console.warn(contar(p.root));
    return criarEstudio(ctx, {
      pecas: [guirlanda, festao, simples],
      tamanho: 6,
      camera: { fov: 30, position: [0, 1.85, 0.9], target: [0, 1.8, -3] },
      luzQuente: escuro ? 0.12 : 1,
      luzFria: escuro ? 0.5 : 1,
      onAmbient: (efeito, estado) => {
        if (efeito === 'TREE_SPARKLE') festao.setCintilar(estado.intensity);
      },
    });
  }
  const arvore = await criarArvore(ctx, { semente: Number(params.get('semente') ?? 7) });
  arvore.root.position.set(0, 0, 0);
  if (params.get('numeros') === '1') console.warn(contar(arvore.root));
  return criarEstudio(ctx, {
    pecas: [arvore],
    camera: { fov: 30, position: [0, 1.95, 8.8], target: [0, 1.72, 0] },
    luzQuente: escuro ? 0.12 : 1,
    luzFria: escuro ? 0.5 : 1,
    onAmbient: (efeito, estado) => {
      if (efeito === 'TREE_SPARKLE') arvore.setCintilar(estado.intensity);
    },
  });
};
