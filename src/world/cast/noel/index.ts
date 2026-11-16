/**
 * O PAPAI NOEL DO DONO, em 3D: refeito à mão a partir do modelo que ele criou no Tripo (veja
 * lab/referencia-noel-tripo.png e lab/referencia-noel/): corpo de pera muito barrigudo, cabeça grande,
 * nariz de bolota, óculos redondos dourados, barba e bigode em mechas de pelúcia, gorro caído com pompom,
 * casaco de veludo com faixa e barra felpudas, cinto preto com fivela dourada, luvas brancas de quatro
 * dedos e botas de couro marrom-escuro. SENTADO na poltrona da sala, com as botas num pufe de veludo
 * e o saco de presentes ao lado.
 *
 * Tudo é geometria esculpida por código (superfícies paramétricas, veja corpo.ts) presa a um esqueleto
 * (THREE.Bone + SkinnedMesh, pesos suaves), com materiais físicos (veludo com sheen, pelúcia em cascas,
 * couro, ouro). A geometria e os materiais são criados uma vez e compartilhados por todas as cópias.
 *
 * Arquivos: medidas.ts (TODOS os números para ajustar), forma.ts (tronco, saia, barra), corpo.ts
 * (escultura), saco.ts, pufe.ts, esqueleto.ts, animacao.ts (poses, olhar e mola), materiais.ts,
 * texturas.ts.
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { Level, SantaPose, SantaRig, SetContext } from '../../contracts';
import { loadModel } from '../../../engine/assets';
import { AnimadorNoel } from './animacao';
import { esculpir } from './corpo';
import { criarEsqueleto } from './esqueleto';
import { CASCAS_MAX, criarMateriais } from './materiais';
import { SACO } from './medidas';
import { esculpirPufe } from './pufe';
import { esculpirSaco } from './saco';

export interface NoelPart {
  createSanta(): SantaRig;
  setQuality(level: Level): void;
}

export interface OpcoesNoel {
  /**
   * Só para o laboratório: põe a poltrona da sala (ArmChair_01 em escala 1,5) junto do Noel, para
   * fotografá-lo sentado no estúdio. Na sala de verdade a poltrona já existe: deixe false.
   */
  poltronaDeEnsaio?: boolean;
}

/** Cascas de pelo por nível. */
const CASCAS: Record<Level, number> = { alta: CASCAS_MAX, media: 3, baixa: 2 };

export function buildNoel(ctx: SetContext, opts: OpcoesNoel = {}): NoelPart {
  const mats = criarMateriais();
  const modelo = criarEsqueleto();
  const partes = esculpir(modelo);
  const geo = {
    veludo: partes.veludo.geometria(),
    pelo: partes.pelo.geometria(CASCAS_MAX),
    mechas: partes.mechas.geometria(),
    pele: partes.pele.geometria(),
    luva: partes.luva.geometria(),
    couro: partes.couro.geometria(),
    ouro: partes.ouro.geometria(),
    olhos: partes.olhos.geometria(),
  };
  const indicesPorCasca = partes.pelo.idx.length;
  const indicesSoBase = partes.pelo.idxBase.length;
  const saco = esculpirSaco();
  const geoSaco = {
    saco: saco.saco.geometria(),
    papel: saco.papel.geometria(),
    veludo: saco.veludo.geometria(),
    ouro: saco.ouro.geometria(),
  };
  const pufe = esculpirPufe();
  const geoPufe = { veludo: pufe.veludo.geometria(), ouro: pufe.ouro.geometria() };
  // tira os atributos de pele das peças fixas do saco e do pufe (não são SkinnedMesh)
  for (const g of [...Object.values(geoSaco), ...Object.values(geoPufe)]) {
    g.deleteAttribute('skinIndex');
    g.deleteAttribute('skinWeight');
  }

  // ambiente reserva para os reflexos (só quando a cena não tem um, como no estúdio)
  let reserva: THREE.Texture | null = null;
  try {
    const pmrem = new THREE.PMREMGenerator(ctx.renderer);
    const sala = new RoomEnvironment();
    reserva = pmrem.fromScene(sala, 0.04).texture;
    sala.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      }
    });
    pmrem.dispose();
  } catch {
    reserva = null;
  }
  const todos: THREE.MeshStandardMaterial[] = [mats.veludo, mats.veludoVerde, mats.fita, mats.pelo, mats.mecha, mats.pele, mats.luva, mats.couro, mats.ouro, mats.olhos, mats.saco, mats.papel];
  const forcaBase = new Map(todos.map((m) => [m, m.envMapIntensity]));
  let ambienteAtual: THREE.Texture | null | undefined;
  const ajustarAmbiente = (cena: THREE.Scene) => {
    const quer = cena.environment ? null : reserva;
    if (quer === ambienteAtual) return;
    ambienteAtual = quer;
    for (const m of todos) {
      m.envMap = quer;
      // o ambiente reserva (estúdio) é claro e neutro: entra com metade da força
      m.envMapIntensity = (forcaBase.get(m) ?? 1) * (quer ? 0.45 : 1);
      m.needsUpdate = true;
    }
  };

  // a geometria do pelo é compartilhada: o número de cascas (drawRange) vale para todas as cópias
  let nivel: Level = ctx.level;
  const aplicarNivel = () => {
    const n = CASCAS[nivel];
    mats.peloU.uCamadas.value = n - 1;
    geo.pelo.setDrawRange(0, indicesSoBase + indicesPorCasca * n);
  };
  aplicarNivel();

  function createSanta(): SantaRig {
    const root = new THREE.Group();
    root.name = 'noel';
    const corpo = new THREE.Group();
    corpo.name = 'noel-corpo';
    root.add(corpo);

    const esq = criarEsqueleto();
    corpo.add(esq.o.raiz);
    root.updateMatrixWorld(true);
    const esqueleto = new THREE.Skeleton(esq.ossos);
    const identidade = new THREE.Matrix4();
    const malha = (g: THREE.BufferGeometry, m: THREE.Material, nome: string) => {
      const s = new THREE.SkinnedMesh(g, m);
      s.name = nome;
      s.bind(esqueleto, identidade);
      s.frustumCulled = false;
      s.castShadow = true;
      s.receiveShadow = true;
      corpo.add(s);
      return s;
    };
    const veludo = malha(geo.veludo, mats.veludo, 'noel-veludo');
    veludo.onBeforeRender = (_r, cena) => ajustarAmbiente(cena as THREE.Scene);
    // pelúcia em cascas: não projeta sombra (as cascas recortadas fariam o mapa de sombra pagar todas
    // as camadas); a barba, o bigode e as sobrancelhas projetam (dão volume no peito e no rosto)
    const pelo = malha(geo.pelo, mats.pelo, 'noel-pelucia');
    pelo.userData.semAO = true;
    pelo.castShadow = false;
    malha(geo.mechas, mats.mecha, 'noel-barba');
    malha(geo.pele, mats.pele, 'noel-pele');
    malha(geo.luva, mats.luva, 'noel-luvas');
    malha(geo.couro, mats.couro, 'noel-couro');
    malha(geo.ouro, mats.ouro, 'noel-ouro');
    const olhos = malha(geo.olhos, mats.olhos, 'noel-olhos');
    olhos.castShadow = false;

    // saco de presentes no piso, ao lado da poltrona
    const grupoSaco = new THREE.Group();
    grupoSaco.name = 'noel-saco';
    grupoSaco.position.set(SACO.x, 0, SACO.z);
    // o saco encosta de leve no braço da poltrona (a boca fica ao alcance da mão esquerda dele)
    grupoSaco.rotation.set(0, SACO.giro, 0, 'ZYX');
    grupoSaco.rotation.z = SACO.inclinacao;
    const fixa = (g: THREE.BufferGeometry, m: THREE.Material) => {
      const s = new THREE.Mesh(g, m);
      s.castShadow = true;
      s.receiveShadow = true;
      grupoSaco.add(s);
      return s;
    };
    fixa(geoSaco.saco, mats.saco);
    fixa(geoSaco.papel, mats.papel);
    fixa(geoSaco.veludo, mats.veludo);
    fixa(geoSaco.ouro, mats.fita);
    const sackMouth = new THREE.Object3D();
    sackMouth.name = 'boca-do-saco';
    sackMouth.position.copy(saco.boca);
    grupoSaco.add(sackMouth);
    root.add(grupoSaco);

    // pufe diante da poltrona, onde ele apoia as botas
    const grupoPufe = new THREE.Group();
    grupoPufe.name = 'noel-pufe';
    for (const [g, m] of [
      [geoPufe.veludo, mats.veludoVerde],
      [geoPufe.ouro, mats.ouro],
    ] as const) {
      const s = new THREE.Mesh(g, m);
      s.castShadow = true;
      s.receiveShadow = true;
      grupoPufe.add(s);
    }
    root.add(grupoPufe);

    const bubbleAnchor = new THREE.Object3D();
    bubbleAnchor.name = 'balao';
    // acima do ponto mais alto do gorro (que agora é curto e tomba para o lado)
    const topoGorro = Math.max(...modelo.gorro.map((p) => p.y)) + 0.03;
    bubbleAnchor.position.set(0.06, topoGorro + 0.18, -0.05);
    root.add(bubbleAnchor);

    let poltrona: THREE.Object3D | null = null;
    let vivo = true;
    if (opts.poltronaDeEnsaio) {
      void loadModel('assets/modelos/ArmChair_01.glb').then((m) => {
        if (!vivo) return;
        m.scale.setScalar(1.5);
        poltrona = m;
        root.add(m);
      });
    }

    root.updateMatrixWorld(true);
    const bocaNoCorpo = sackMouth.getWorldPosition(new THREE.Vector3());
    const animador = new AnimadorNoel(esq, corpo, bocaNoCorpo);
    const pose: SantaPose = { wave: 0, talk: 0, rummage: 0, present: 0, give: 0, cheer: 0 };
    animador.update(pose, 0, 0);

    return {
      root,
      pose,
      sackMouth,
      bubbleAnchor,
      height: 2.25,
      update(dt, t) {
        animador.update(pose, dt, t);
      },
      dispose() {
        vivo = false;
        root.removeFromParent();
        esqueleto.dispose();
        if (poltrona) root.remove(poltrona);
      },
    };
  }

  return {
    createSanta,
    setQuality(level) {
      nivel = level;
      aplicarNivel();
    },
  };
}
