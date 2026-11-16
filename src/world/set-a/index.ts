/**
 * SALA NATALINA, COMPOSIÇÃO A: lareira à esquerda, janela ao fundo, árvore à direita.
 *
 * A câmera olha em diagonal para o canto esquerdo do fundo: a parede esquerda aparece em perspectiva
 * com a lareira em três quartos, subindo até o teto; o fogo fica de lado e joga a luz âmbar e as
 * sombras longas pelo piso, da esquerda para a direita. A janela em arco é o grande recorte azul da
 * parede do fundo; a árvore fecha o quadro à direita. No meio, sobre o tapete redondo e diante da
 * janela, a poltrona grande é o trono do Noel (ele entra depois, sentado: ASSENTO_DO_NOEL em ancoras.ts).
 *
 * Arquivos: ajustes.ts (TODOS os números de luz, câmera e posições), arquitetura.ts, materiais.ts,
 * moveis.ts, luzes.ts, ambiente.ts (reflexos gerados da própria sala), ancoras.ts (fila e entrega).
 * As peças principais vêm do kit (src/world/kit): lareira, árvore, exterior, janela e tecidos.
 *
 *   node tools/shot.cjs sala --param set=a --half --guias --out lab/fotos/sala-a/rascunho.png
 */
import * as THREE from 'three';
import type { BuildVillageSet, Level, VillageSet } from '../contracts';
import type { Peca } from '../kit/tipos';
import { ARVORE, EXTERIOR, JANELA, LAREIRA, LOOK, LUGAR, MAGIA, SALA } from './ajustes';
import { gerarAmbiente } from './ambiente';
import { criarAncoras } from './ancoras';
import { criarArquitetura } from './arquitetura';
import { criarLuzes } from './luzes';
import { criarPoeiraMagica } from './magia';
import { criarMateriais } from './materiais';
import { criarMoveis } from './moveis';
import { criarNeveDaJanela } from './neve';
import { carregarArvore, carregarExterior, carregarJanela, carregarLareira, carregarTapete } from './pecas';
import { apontarExterior } from './vista';

export const buildVillageSet: BuildVillageSet = async (ctx) => {
  const root = new THREE.Group();
  root.name = 'sala-a';

  /* ------------------------------------------------------------- peças do kit */
  // o vidro da janela fica 0,3 m para fora da face interna da parede (o vão é fundo)
  const zVidro = SALA.zFundo - (SALA.espessura - 0.1);
  const [materiais, lareira, janela, exterior, arvore, tapete] = await Promise.all([
    criarMateriais(),
    carregarLareira(ctx, { largura: LAREIRA.largura, alturaConsole: LAREIRA.alturaConsole, alturaTotal: SALA.altura, profundidade: LAREIRA.profundidade, semente: LAREIRA.semente }),
    carregarJanela(ctx, {
      largura: JANELA.largura,
      altura: JANELA.altura,
      peitoril: JANELA.peitoril,
      arco: true,
      colunas: JANELA.colunas,
      linhas: JANELA.linhas,
      espessuraParede: SALA.espessura,
      cortinas: true,
      aberturaCortinas: JANELA.aberturaCortinas,
      semente: JANELA.semente,
    }),
    carregarExterior(ctx, { semente: EXTERIOR.semente, ganho: EXTERIOR.ganho }),
    carregarArvore(ctx, { altura: ARVORE.altura, raio: ARVORE.raio, semente: ARVORE.semente, luzes: ARVORE.luzes, enfeites: true, presentes: ARVORE.presentes, estrela: true }),
    carregarTapete(ctx, { forma: 'redondo', largura: LUGAR.tapete.diametro, semente: 3 }),
  ]);

  // lareira na parede esquerda: costas na parede, boca voltada para +X (para dentro da sala)
  lareira.root.position.set(SALA.xEsq, 0, LAREIRA.z);
  lareira.root.rotation.y = Math.PI / 2;
  lareira.luz.castShadow = true;
  lareira.luz.target.position.set(...LAREIRA.alvoLuz);

  janela.root.position.set(JANELA.x, 0, zVidro);
  // o vidro reflete o fogo bem atrás do encosto da poltrona: um reflexo um pouco mais fosco espalha o ponto quente
  (janela.vidro.material as THREE.MeshPhysicalMaterial).roughness = 0.2;
  // o exterior é um fundo de cinema: girado e afastado para a câmera ver a vila e a lua pelo vão (vista.ts)
  const centroDoVao = new THREE.Vector3(JANELA.x, JANELA.peitoril + JANELA.altura / 2, zVidro);
  const vista = apontarExterior(exterior.root, new THREE.Vector3(...LOOK.camera.position), centroDoVao, exterior.luar.direcaoLua);

  arvore.root.position.set(ARVORE.x, 0, ARVORE.z);
  arvore.root.rotation.y = ARVORE.giro;
  arvore.luz.intensity = ARVORE.luz;

  tapete.root.position.set(LUGAR.tapete.x, 0, LUGAR.tapete.z);
  tapete.root.rotation.y = LUGAR.tapete.giro;

  /* ------------------------------------------------- arquitetura, móveis, luz */
  const arquitetura = criarArquitetura(materiais, janela.contorno(), janela.vao.base);
  const moveis = await criarMoveis(ctx, lareira);
  const luzes = criarLuzes(exterior, vista.paraLua, janela.contorno(), zVidro, moveis.chamaDoLampiao);

  // flocos grandes logo atrás do vidro (os do diorama ficaram longe)
  const neve = criarNeveDaJanela(JANELA.largura, JANELA.peitoril, JANELA.altura);
  neve.pontos.position.set(JANELA.x, 0, zVidro);

  // poeira dourada da FIREPLACE_MAGIC, nascendo diante da boca (a peça olha para +Z local = +X do mundo)
  lareira.root.updateMatrixWorld(true);
  const bocaMundo = lareira.root.localToWorld(lareira.bocaDoFogo.clone());
  const paraSala = new THREE.Vector3(0, 0, 1).transformDirection(lareira.root.matrixWorld).setY(0).normalize();
  const poeira = criarPoeiraMagica(bocaMundo.clone().setY(0).addScaledVector(paraSala, 0.35), paraSala);
  let magia = 0;

  const pecas: Peca[] = [lareira, janela, exterior, arvore, tapete];
  root.add(poeira.pontos, arquitetura.root, exterior.root, neve.pontos, janela.root, lareira.root, arvore.root, tapete.root, moveis.root, luzes.root);

  /* ------------------------------------------------------------ qualidade */
  let nivel: Level = ctx.level;
  const ganhoBaseDoFogo = LAREIRA.ganhoLuz;
  /**
   * Economia de sombras e de oclusão (refeita a cada troca de nível, porque as peças mexem nas próprias marcas):
   *   árvore   nada projeta sombra (o fogo jogaria a sombra dela para fora do quadro);
   *   janela   as cortinas não projetam nem entram na oclusão; o caixilho só projeta para o luar;
   *   lareira  o leito de cinzas fica fora da oclusão (está no escuro da câmara).
   */
  const economizar = () => {
    arvore.root.traverse((o) => {
      // a árvore não projeta sombra: o fogo a pega de frente e joga a sombra para fora do quadro, e o luar não a
      // alcança; sem ela, o mapa de sombra do fogo deixa de redesenhar uns 170 mil triângulos por quadro
      if ((o as THREE.Mesh).isMesh) o.castShadow = false;
      if (['bulbos', 'fio'].includes(o.name)) o.userData.semAO = true;
    });
    const soDoLuar: THREE.Object3D[] = [];
    const paredes = arquitetura.root.getObjectByName('paredes');
    if (paredes) soDoLuar.push(paredes);
    janela.root.traverse((o) => {
      if (!(o as THREE.Mesh).isMesh) return;
      if (/^cortina/.test(o.name)) {
        o.castShadow = false;
        o.userData.semAO = true;
      } else if (o.castShadow) soDoLuar.push(o);
    });
    lareira.root.traverse((o) => {
      if (o.name === 'cinzas-e-carvoes') o.userData.semAO = true;
    });
    luzes.sombrasSoDoLuar(soDoLuar);
  };
  const aplicarQualidade = (level: Level) => {
    nivel = level;
    for (const p of pecas) p.setQuality(level);
    moveis.setQuality(level);
    neve.setQuality(level);
    poeira.setQuality(level);
    luzes.setQuality(level); // alta: fogo e luar com sombra; média: só o fogo; baixa: nenhuma (a lareira desliga a dela)
    economizar();
  };
  aplicarQualidade(nivel);

  /* ------------------------------------------ reflexos da própria sala (PMREM) */
  // um quadro de animação antes, para o fogo, as lâmpadas e a luz de fora estarem acesos na "foto"
  const avancar = (dt: number, t: number) => {
    lareira.forca = LAREIRA.forca * (1 + MAGIA.reforcoFogo * magia);
    for (const p of pecas) p.update(dt, t);
    lareira.luz.intensity *= ganhoBaseDoFogo;
    poeira.update(t, magia);
    moveis.update(dt, t);
    luzes.update(dt, t);
    neve.update(t, exterior.luzExterna.cor, exterior.luzExterna.intensidade);
  };
  avancar(1 / 60, 3);
  const ambiente = gerarAmbiente(ctx.renderer, root, [luzes.entrega]);
  arvore.setEnvMap(ambiente.textura);

  const set: VillageSet = {
    root,
    environment: ambiente.textura,
    look: LOOK,
    anchors: criarAncoras(),
    update(dt, t) {
      avancar(dt, t);
    },
    setQuality: aplicarQualidade,
    setDeliveryActive(on) {
      luzes.setEntrega(on);
    },
    setAmbient(effect, state) {
      if (effect === 'TREE_SPARKLE') arvore.setCintilar(state.intensity);
      else if (effect === 'FIREPLACE_MAGIC') {
        lareira.setMagia(state.intensity);
        magia = state.intensity; // a poeira dourada e o fogo mais forte (avancar)
      }
      else if (effect === 'SLEIGH_PASS') exterior.setTreno(state.progress, state.intensity);
      else if (effect === 'MAGICAL_NIGHT') exterior.setNoiteMagica(state.intensity); // a luz da janela acompanha luzExterna em luzes.update
    },
    dispose() {
      for (const p of pecas) p.dispose();
      moveis.dispose();
      neve.dispose();
      poeira.dispose();
      luzes.dispose();
      arquitetura.dispose();
      materiais.dispose();
      ambiente.dispose();
    },
  };
  return set;
};
