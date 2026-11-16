/**
 * Sala natalina 3D, composição B: vista de canto. Lareira na parede da direita (a empena), janela grande
 * na parede da esquerda, árvore ao fundo junto do canto, lugar do Noel no tapete do meio.
 * A sala é montada com as peças do kit (src/world/kit) e com os móveis e materiais do acervo.
 * Todos os números ajustáveis estão em ./ajustes.ts.
 *   node tools/shot.cjs sala --param set=b --mini --out lab/fotos/sala-b/final.png
 * Parâmetros extras do endereço, só para estudo: planta=1 (sem telhado, para fotos de cima),
 * numeros=1 (escreve no console, como aviso, as malhas e os triângulos de cada parte).
 */
import * as THREE from 'three';
import type { BuildVillageSet, Level, VillageSet } from '../contracts';
import { criarExterior } from '../kit/exterior';
import { criarJanela } from '../kit/janela';
import { criarMeia, criarTapete } from '../kit/tecidos';
import type { Peca } from '../kit/tipos';
import { LOOK, LUZ, PECAS, PLANTA } from './ajustes';
import { gerarAmbiente } from './ambiente';
import { criarAncoras } from './ancoras';
import { carregarArvore, carregarGuirlanda, carregarLareira } from './contingencia';
import { criarArquitetura } from './arquitetura';
import { criarLuzes, direcaoDoLuar } from './luzes';
import { criarReflexoDaJanela } from './reflexo';
import { criarMoveis } from './moveis';
import { contar } from './util';

/** Faz as malhas de `raiz` não entrarem no mapa de sombra de uma luz (continuam nos das outras). */
function pularNaSombraDe(raiz: THREE.Object3D, luz: THREE.Light & { shadow: THREE.LightShadow }) {
  raiz.traverse((o) => {
    const malha = o as THREE.Mesh;
    if (!malha.isMesh) return;
    const inst = o as THREE.InstancedMesh;
    let guardado = 0;
    malha.onBeforeShadow = (_r, _o, _c, camSombra, geo) => {
      if (camSombra !== luz.shadow.camera) return;
      if (inst.isInstancedMesh) {
        guardado = inst.count;
        inst.count = 0;
      } else {
        guardado = geo.drawRange.count;
        geo.drawRange.count = 0;
      }
    };
    malha.onAfterShadow = (_r, _o, _c, camSombra, geo) => {
      if (camSombra !== luz.shadow.camera) return;
      if (inst.isInstancedMesh) inst.count = guardado;
      else geo.drawRange.count = guardado;
    };
  });
}

export const buildVillageSet: BuildVillageSet = async (ctx) => {
  const params = new URLSearchParams(location.search);
  const root = new THREE.Group();
  root.name = 'sala-b';
  const kit = { renderer: ctx.renderer, level: ctx.level };

  /* ------------------------------------------------------- peças do kit */
  const [janela, { lareira }, arvore, exterior, tapete] = await Promise.all([
    criarJanela(kit, {
      largura: PECAS.janela.largura,
      altura: PECAS.janela.altura,
      peitoril: PECAS.janela.peitoril,
      arco: true,
      colunas: PECAS.janela.colunas,
      linhas: PECAS.janela.linhas,
      espessuraParede: PLANTA.espessura,
      cortinas: true,
      aberturaCortinas: PECAS.janela.abertura,
      semente: PECAS.janela.semente,
    }),
    carregarLareira(kit, {
      largura: PECAS.lareira.largura,
      alturaConsole: PECAS.lareira.alturaConsole,
      alturaTotal: PECAS.lareira.alturaTotal,
      profundidade: PECAS.lareira.profundidade,
      semente: PECAS.lareira.semente,
    }),
    carregarArvore(kit, {
      altura: PECAS.arvore.altura,
      raio: PECAS.arvore.raio,
      semente: PECAS.arvore.semente,
      luzes: PECAS.arvore.luzes,
      enfeites: true,
      presentes: PECAS.arvore.presentes,
      estrela: true,
    }),
    criarExterior(kit, { semente: PECAS.exterior.semente, ganho: PECAS.exterior.ganho, luzDaSala: PECAS.exterior.luzDaSala }),
    criarTapete(kit, { forma: 'redondo', largura: PECAS.tapete.diametro, semente: PECAS.tapete.semente }),
  ]);
  const pecas: Peca[] = [janela, lareira, exterior, tapete];
  if (arvore) pecas.push(arvore);

  // janela: a face de dentro da parede J fica em z = 0; o vidro (e a vila) ficam um pouco atrás
  const zVidro = -janela.vao.zDentro;
  janela.root.position.set(PECAS.janela.x, 0, zVidro);
  exterior.root.position.set(PECAS.janela.x, 0, zVidro - PECAS.exterior.recuo);
  // lareira: costas na parede L (x = 0), boca virada para -X
  lareira.root.position.set(0, 0, PECAS.lareira.z);
  lareira.root.rotation.y = -Math.PI / 2;
  lareira.luz.castShadow = true;
  // a luz principal é da peça; a sala só abre o leque dela para a luz alcançar as duas paredes do canto
  // (a própria boca de pedra recorta o facho com sombra) e fixa a queda com a distância
  lareira.luz.angle = LUZ.fogoCone.angulo;
  lareira.luz.penumbra = LUZ.fogoCone.penumbra;
  lareira.luz.distance = LUZ.fogoCone.alcance;
  lareira.luz.decay = LUZ.fogoCone.queda;
  lareira.luz.target.position.x -= LUZ.fogoCone.desvio; // no espaço da lareira, -X é o lado da parede da janela
  if (arvore) {
    arvore.root.position.set(PECAS.arvore.x, 0, PECAS.arvore.z);
    arvore.root.rotation.y = PECAS.arvore.giro;
    arvore.luz.intensity = LUZ.arvore;
    arvore.root.userData.semAO = true; // a folhagem já fica fora da oclusão; os enfeites acompanham
  }
  tapete.root.position.set(PECAS.tapete.x, 0, PECAS.tapete.z);
  tapete.root.rotation.y = PECAS.tapete.giro;

  /* ------------------------------------------------------- a sala em si */
  const arquitetura = await criarArquitetura({ contorno: janela.contorno(28), x: PECAS.janela.x, meiaLargura: janela.vao.largura / 2 + 0.16 });
  const moveis = await criarMoveis(
    { posicao: lareira.root.position, giroY: lareira.root.rotation.y, y: lareira.console.y, z: lareira.console.z, largura: lareira.console.largura },
    PLANTA.beiral,
  );

  // enfeites da lareira: três meias penduradas na viga do console e uma guirlanda no peito da chaminé
  const enfeites = new THREE.Group();
  enfeites.position.copy(lareira.root.position);
  enfeites.rotation.y = lareira.root.rotation.y;
  {
    const frente = lareira.console.z + lareira.console.profundidade / 2;
    const meias = await Promise.all([
      criarMeia(kit, { cor: '#8e1c27', corDetalhe: '#d9cfb8', virada: 'direita', semente: 1, tamanho: 0.5 }),
      criarMeia(kit, { cor: '#1d5240', corDetalhe: '#b9343c', virada: 'direita', semente: 4, tamanho: 0.46 }),
      criarMeia(kit, { cor: '#d9cfb8', corDetalhe: '#8e1c27', virada: 'esquerda', semente: 6, tamanho: 0.48 }),
    ]);
    const xs = [-0.95, -0.42, 0.9];
    meias.forEach((m, i) => {
      m.root.position.set(xs[i], lareira.console.y - 0.2, frente + 0.015);
      enfeites.add(m.root);
      pecas.push(m);
    });
    const guirlanda = await carregarGuirlanda(kit, { raio: 0.44, laco: true, semente: 5 });
    if (guirlanda) {
      guirlanda.root.position.set(0, lareira.console.y + 0.52, PECAS.lareira.profundidade + 0.05);
      guirlanda.root.rotation.x = -0.1;
      enfeites.add(guirlanda.root);
      pecas.push(guirlanda);
    }
  }

  /* -------------------------------------------------------------- luzes */
  const direcao = direcaoDoLuar(exterior.luar.direcao);
  const luzes = criarLuzes(
    {
      direcao,
      centro: new THREE.Vector3(PECAS.janela.x, janela.vao.base + janela.vao.altura / 2, zVidro),
      largura: janela.vao.largura,
      altura: janela.vao.altura,
      base: janela.vao.base,
      flecha: janela.vao.flecha,
      colunas: PECAS.janela.colunas,
      linhas: PECAS.janela.linhas,
      obstaculo: { x: PECAS.arvore.x, z: PECAS.arvore.z, raio: PECAS.arvore.raio * 0.8 },
    },
    moveis.chamaLanterna,
  );

  const reflexo = criarReflexoDaJanela(
    { centro: new THREE.Vector3(PECAS.janela.x, 0, zVidro), largura: janela.vao.largura, altura: janela.vao.altura, base: janela.vao.base, colunas: PECAS.janela.colunas },
    arquitetura.materialPiso.roughnessMap,
    arquitetura.ladrilhoPiso,
  );

  // a árvore projeta sombra só do luar (é ela que segura o azul antes da lareira); no mapa de sombra do fogo ela é
  // pulada: a sombra dela cairia atrás da própria copa, fora da vista, e custaria um desenho inteiro da árvore
  if (arvore) pularNaSombraDe(arvore.root, lareira.luz);

  root.add(arquitetura.root, exterior.root, janela.root, lareira.root, tapete.root, moveis.root, enfeites, luzes.root, reflexo.malha);
  if (arvore) root.add(arvore.root);
  if (params.get('planta') === '1') {
    // só para fotos de cima: tira o telhado
    for (const nome of ['forro', 'estrutura-de-madeira']) {
      const o = arquitetura.root.getObjectByName(nome);
      if (o) o.visible = false;
    }
  }

  // só para estudo: desligar=luar,fogo,arvore,poca,lanterna,preenchimento apaga luzes pelo endereço
  const desligar = (params.get('desligar') ?? '').split(',');
  if (desligar.includes('luar')) luzes.luar.visible = false;
  if (desligar.includes('poca')) luzes.poca.visible = false;
  if (desligar.includes('lanterna')) luzes.lampiao.visible = false;
  if (desligar.includes('preenchimento')) luzes.preenchimento.visible = false;
  if (desligar.includes('arvore') && arvore) arvore.luz.visible = false;
  if (desligar.includes('fogo')) for (const l of lareira.luzes) l.visible = false;

  /* ------------------------------------------------------------- estado */
  let nivel: Level = ctx.level;
  let entregaAlvo = 0;
  let entrega = 0;
  const luzRebatida = lareira.luzes[2] as THREE.Light | undefined;

  const update = (dt: number, t: number) => {
    for (const p of pecas) p.update(dt, t);
    // a lareira recalcula a própria luz a cada quadro; a sala só escala o resultado
    lareira.luz.intensity *= LUZ.fogo;
    if (luzRebatida) luzRebatida.intensity *= LUZ.fogoRebatido;
    entrega += (entregaAlvo - entrega) * (1 - Math.exp(-4 * Math.min(dt, 0.1)));
    moveis.update(t);
    luzes.update(t, exterior.luzExterna.cor, exterior.luzExterna.intensidade, entrega);
    reflexo.atualizar(exterior.luzExterna.cor, exterior.luzExterna.intensidade);
  };

  const setQuality = (level: Level) => {
    nivel = level;
    for (const p of pecas) p.setQuality(level);
    // alta: sombra do fogo e do luar; média: só a do fogo; baixa: nenhuma (a lareira desliga a dela)
    lareira.luz.castShadow = level !== 'baixa';
    luzes.setQuality(level);
  };

  /* ----------------------------------------------- ambiente para reflexos */
  // gerado com tudo aceso: um passo de animação acende o fogo, as lâmpadas e a luz de fora
  setQuality('alta');
  update(0, 3);
  root.updateMatrixWorld(true);
  const ambiente = gerarAmbiente(ctx.renderer, root, new THREE.Vector3(-3.6, 1.35, 4.4));
  arvore?.setEnvMap(ambiente.texture);
  setQuality(nivel);

  if (params.get('numeros') === '1') {
    const partes: Array<[string, THREE.Object3D]> = [
      ['arquitetura', arquitetura.root],
      ['exterior', exterior.root],
      ['janela', janela.root],
      ['lareira', lareira.root],
      ['tapete', tapete.root],
      ['moveis', moveis.root],
      ['enfeites', enfeites],
    ];
    if (arvore) partes.push(['arvore', arvore.root]);
    for (const [nome, o] of partes) {
      const n = contar(o);
      console.warn(`[numeros] ${nome}: ${n.malhas} malhas, ${n.triangulos} triangulos`);
    }
  }

  const set: VillageSet = {
    root,
    environment: ambiente.texture,
    look: LOOK,
    anchors: criarAncoras(),
    update,
    setQuality,
    setDeliveryActive(on) {
      entregaAlvo = on ? 1 : 0;
    },
    setAmbient(effect, state) {
      if (effect === 'TREE_SPARKLE') arvore?.setCintilar(state.intensity);
      else if (effect === 'FIREPLACE_MAGIC') lareira.setMagia(state.intensity);
      else if (effect === 'SLEIGH_PASS') exterior.setTreno(state.progress, state.intensity);
      else if (effect === 'MAGICAL_NIGHT') exterior.setNoiteMagica(state.intensity);
    },
    dispose() {
      for (const p of pecas) p.dispose();
      arquitetura.dispose();
      moveis.dispose();
      luzes.dispose();
      reflexo.dispose();
      ambiente.dispose();
    },
  };
  return set;
};
