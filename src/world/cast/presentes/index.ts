/**
 * CATÁLOGO DOS PRESENTES 3D e da CAIXA de presente.
 *
 * Os 12 presentes de src/gifts/giftCatalog.ts, cada um esculpido por código (superfícies paramétricas,
 * veja malha.ts) com materiais físicos compartilhados (veja materiais.ts): latão escovado, laca, esmalte
 * de cerâmica, madeira pintada, açúcar, glacê, massa assada, neve, tricô, feltro, cetim, pelúcia em
 * cascas, vidro e ramos de abeto.
 *
 * CONTRATO (src/world/contracts.ts):
 *   createGift(id)  devolve um Object3D CENTRADO NA ORIGEM e cabendo num cubo de 1 m (a maior medida fica
 *                   em ~0,92 m). Quem chama cuida da escala (na tela ele aparece com 30 a 45 cm, então
 *                   uma escala de 0,35 a 0,5). id desconhecido vira a estrela. Síncrono: as texturas do
 *                   disco chegam depois, sem trocar de programa de sombreamento.
 *   createGiftBox() devolve { root, lid, body } em TAMANHO REAL (caixa de 42 x 42 cm, ~46 cm de altura com
 *                   a tampa e o laço). Papel VERMELHO com estrelinhas douradas, fita de cetim dourado-creme e
 *                   forro creme por dentro. Origem de root no centro da base. O PIVÔ DA TAMPA (lid) é o
 *                   CENTRO DE CIMA do corpo (o meio da borda de cima da caixa, onde a tampa assenta).
 *                   ABRIR (recomendado): root.userData.abrir(f), com f de 0 (fechada) a 1 (aberta), linear no
 *                   tempo: a tampa solta do encaixe (sobe no máximo 0,12 m), bascula para trás em DOBRADIÇA
 *                   na borda de trás até ~-1,9 rad em x, com mola (passa um pouco e volta), e fica presa à
 *                   caixa (lê como um objeto só). Sem alocação. root.userData.inicioFaiscas (0,3) diz em que
 *                   f a boca já está aberta o bastante para as faíscas; root.userData.boca é o centro da boca
 *                   (Vector3 no espaço de root). Quem preferir abrir à mão: suba lid.position.y e/ou gire
 *                   lid.rotation, ou gire em torno de lid.userData.bordaDeTras (Vector3, espaço de root).
 *
 * userData de cada presente (opcionais, o jogo usa se quiser):
 *   update(dt, t)   animação própria: o sino balança e o badalo bate, as rodas do trem giram, a neve do
 *                   globo rodopia, o vapor do chocolate sobe. Chame a cada quadro enquanto estiver na tela
 *                   (só dt e t, sem relógio próprio; nada é alocado por quadro).
 *   dispose()       tira da cena e solta o que é só desta cópia (flocos). NÃO chame geometry.dispose() nem
 *                   material.dispose() nas malhas: as cópias COMPARTILHAM geometria e materiais (cache por
 *                   presente e nível). Tudo isso só é liberado por `dispose()` do catálogo, no fim do jogo.
 *   id, nome        o id do catálogo e o nome de tela.
 *   escalaVisual    multiplicador de escala sugerido para a revelação e para a mão (padrão 1). O ajuste ao
 *                   cubo usa a maior medida, então os finos (bengala, pinheirinho, meia) pareceriam prêmios
 *                   menores que os redondos; multiplique a escala do jogo por este número para igualar o
 *                   peso visual (eles passam do cubo de 1 m, de propósito).
 *   fatorHalo       multiplicador sugerido para um halo/brilho aditivo atrás do presente (padrão 1): o metal
 *                   polido já brilha sozinho (sino 0,5; estrela 0,7).
 *
 * setQuality('alta' | 'media' | 'baixa') troca a geometria dos presentes vivos (menos divisões, menos
 * cascas de pelúcia, menos flocos) e vale para os próximos.
 *
 * Orçamento (nível alta, uma cópia): até ~8 mil triângulos e até 4 chamadas de desenho por presente
 * (os números de cada um estão em lab/fotos/presentes/NOTAS.md).
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { GiftBox, Level, SetContext } from '../../contracts';
import { GIFTS } from '../../../gifts/giftCatalog';
import { liberarCaixas, moldarCaixa } from './caixa';
import { CASCAS_MAX, criarMateriais } from './materiais';
import { liberarTexturas } from './texturas';
import { type Extra, type Moldar, type Parte, type PecasVivas, QUALIDADE } from './tipos';
import { moldarEstrela } from './estrela';
import { moldarBola } from './bola';
import { moldarBengala } from './bengala';
import { moldarBoneco } from './boneco';
import { moldarUrsinho } from './ursinho';
import { moldarSino } from './sino';
import { moldarMeia } from './meia';
import { moldarBiscoito } from './biscoito';
import { moldarGlobo } from './globo';
import { moldarPinheirinho } from './pinheirinho';
import { liberarVapor, moldarChocolate } from './chocolate';
import { moldarTrenzinho } from './trenzinho';

/** Maior medida de um presente dentro do cubo de 1 m. */
export const TAMANHO = 0.92;

/**
 * Peso visual (2ª rodada): os presentes finos parecem menores que os redondos no mesmo cubo. O jogo
 * multiplica a escala da revelação e da mão por isto (root.userData.escalaVisual). Ajuste aqui.
 */
export const ESCALA_VISUAL: Partial<Record<string, number>> = { bengala: 1.25, pinheirinho: 1.2, meia: 1.15 };

/** Halo aditivo do jogo atrás do presente: menos nos metais polidos (root.userData.fatorHalo). */
export const FATOR_HALO: Partial<Record<string, number>> = { sino: 0.5, estrela: 0.7 };

/** Abertura da tampa (root.userData.abrir): giro final em x (rad), subida máxima (m) e início das faíscas. */
export const TAMPA_ABRE = { giro: -1.9, soltar: 0.07, pulo: 0.04, inicioFaiscas: 0.3 };

const suave = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};
/** Saída com mola: chega a 1 passando um pouco (uns 8%) e voltando. */
const comMola = (x: number) => {
  const t = Math.min(1, Math.max(0, x)) - 1;
  const c = 1.45;
  return 1 + (c + 1) * t * t * t + c * t * t;
};

export const MOLDES: Record<string, Moldar> = {
  estrela: moldarEstrela,
  bola: moldarBola,
  bengala: moldarBengala,
  boneco: moldarBoneco,
  ursinho: moldarUrsinho,
  sino: moldarSino,
  meia: moldarMeia,
  biscoito: moldarBiscoito,
  globo: moldarGlobo,
  pinheirinho: moldarPinheirinho,
  chocolate: moldarChocolate,
  trenzinho: moldarTrenzinho,
};

interface ParteFeita {
  parte: Omit<Parte, 'molde'>;
  geo: THREE.BufferGeometry;
}

interface Entrada {
  partes: ParteFeita[];
  extras?: ReturnType<Moldar>['extras'];
  animar?: ReturnType<Moldar>['animar'];
  escala: number;
  centro: THREE.Vector3;
}

interface Vivo {
  id: string;
  malhas: THREE.Mesh[];
}

export interface CatalogoPresentes {
  createGift(id: string): THREE.Object3D;
  createGiftBox(): GiftBox;
  setQuality(level: Level): void;
  /** Resolve quando as texturas do disco chegaram (para fotos). */
  pronto: Promise<void>;
  /** Números de uma cópia no nível atual: triângulos e chamadas de desenho. */
  medir(id: string): { triangulos: number; chamadas: number };
  /** Libera geometrias, materiais e texturas de todos os presentes (fim do jogo). */
  dispose(): void;
}

const BOX = new THREE.Box3();
const BOX2 = new THREE.Box3();

export function criarCatalogo(ctx: SetContext): CatalogoPresentes {
  const mats = criarMateriais();
  let nivel: Level = ctx.level;
  mats.peloU.uCamadas.value = QUALIDADE[nivel].cascas - 1;

  // ambiente reserva para os reflexos, só quando a cena não tem um (como no estúdio do laboratório)
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
  const forcaBase = new Map(mats.todos.map((m) => [m, m.envMapIntensity]));
  let ambienteAtual: THREE.Texture | null | undefined;
  const ajustarAmbiente = (cena: THREE.Object3D) => {
    const quer = (cena as THREE.Scene).environment ? null : reserva;
    if (quer === ambienteAtual) return;
    ambienteAtual = quer;
    for (const m of mats.todos) {
      m.envMap = quer;
      m.envMapIntensity = (forcaBase.get(m) ?? 1) * (quer ? 0.5 : 1);
      m.needsUpdate = true;
    }
  };

  const cache = new Map<string, Entrada>();
  function entrada(id: string, lv: Level): Entrada {
    const chave = `${id}|${lv}`;
    let e = cache.get(chave);
    if (e) return e;
    const q = QUALIDADE[lv];
    const modelo = MOLDES[id](q);
    // caixa envolvente no espaço do modelo (as instâncias contam com as suas matrizes)
    BOX.makeEmpty();
    for (const p of modelo.partes) {
      p.molde.caixa(BOX2);
      if (p.instancias) for (const m of p.instancias) BOX.union(BOX2.clone().applyMatrix4(m));
      else BOX.union(BOX2);
    }
    const tam = BOX.getSize(new THREE.Vector3());
    const centro = BOX.getCenter(new THREE.Vector3());
    const escala = TAMANHO / Math.max(tam.x, tam.y, tam.z, 1e-3);
    const partes: ParteFeita[] = modelo.partes.map((p) => {
      if (p.pivo) p.molde.transformar(new THREE.Matrix4().makeTranslation(-p.pivo.x, -p.pivo.y, -p.pivo.z));
      const geo = p.molde.geometria(p.cascas ? q.cascas : 0);
      const { molde: _m, ...resto } = p;
      return { parte: resto, geo };
    });
    e = { partes, extras: modelo.extras, animar: modelo.animar, escala, centro };
    cache.set(chave, e);
    return e;
  }

  const vivos = new Set<Vivo>();

  function montar(id: string, e: Entrada, raiz: THREE.Object3D, malhas: THREE.Mesh[]): PecasVivas {
    const pecas: PecasVivas = new Map();
    for (const { parte, geo } of e.partes) {
      const mat = mats.get(parte.material);
      const malha = parte.instancias ? new THREE.InstancedMesh(geo, mat, parte.instancias.length) : new THREE.Mesh(geo, mat);
      if (parte.instancias) parte.instancias.forEach((m, i) => (malha as THREE.InstancedMesh).setMatrixAt(i, m));
      malha.name = `${id}-${parte.nome}`;
      malha.castShadow = parte.sombra ?? true;
      malha.receiveShadow = true;
      if (parte.cascas) {
        malha.castShadow = false;
        malha.userData.semAO = true;
      }
      if (parte.ordem) malha.renderOrder = parte.ordem;
      const mae = parte.mae ? pecas.get(parte.mae) : undefined;
      const pivoMae = parte.mae ? e.partes.find((x) => x.parte.nome === parte.mae)?.parte.pivo : undefined;
      if (parte.pivo) malha.position.copy(parte.pivo);
      if (pivoMae) malha.position.sub(pivoMae);
      (mae ?? raiz).add(malha);
      pecas.set(parte.nome, malha);
      malhas.push(malha);
    }
    return pecas;
  }

  function createGift(idPedido: string): THREE.Object3D {
    const id = MOLDES[idPedido] ? idPedido : 'estrela';
    const e = entrada(id, nivel);
    const root = new THREE.Group();
    root.name = `presente-${id}`;
    const ajuste = new THREE.Group();
    ajuste.name = 'ajuste-ao-cubo';
    ajuste.scale.setScalar(e.escala);
    ajuste.position.copy(e.centro).multiplyScalar(-e.escala);
    root.add(ajuste);
    const malhas: THREE.Mesh[] = [];
    const pecas = montar(id, e, ajuste, malhas);
    if (malhas[0]) malhas[0].onBeforeRender = (_r, cena) => ajustarAmbiente(cena);
    const extras: Extra[] = e.extras ? e.extras(mats, QUALIDADE[nivel]) : [];
    for (const x of extras) ajuste.add(x.objeto);
    const anima = e.animar ? e.animar(pecas) : null;
    const vivo: Vivo = { id, malhas };
    vivos.add(vivo);
    const def = GIFTS.find((g) => g.id === id);
    root.userData.id = id;
    root.userData.nome = def?.name ?? id;
    root.userData.escalaVisual = ESCALA_VISUAL[id] ?? 1;
    root.userData.fatorHalo = FATOR_HALO[id] ?? 1;
    root.userData.compartilhado = true;
    root.userData.update = (dt: number, t: number) => {
      mats.tempo.value = t;
      if (anima) anima(dt, t);
      for (const x of extras) x.update?.(dt, t);
    };
    root.userData.dispose = () => {
      root.removeFromParent();
      vivos.delete(vivo);
      // as instâncias (rodas do trem) têm matrizes próprias de cada cópia; a geometria é compartilhada
      for (const m of malhas) if ((m as THREE.InstancedMesh).isInstancedMesh) (m as THREE.InstancedMesh).dispose();
      for (const x of extras) x.dispose?.();
      extras.length = 0;
    };
    // primeira pose da animação (o presente nasce já arrumado, mesmo que ninguém chame update)
    root.userData.update(0, 0);
    return root;
  }

  function createGiftBox(): GiftBox {
    const caixa = moldarCaixa(QUALIDADE[nivel]);
    const root = new THREE.Group();
    root.name = 'caixa-de-presente';
    const body = new THREE.Group();
    body.name = 'caixa-corpo';
    const lid = new THREE.Group();
    lid.name = 'caixa-tampa';
    lid.position.set(0, caixa.alturaCorpo, 0);
    root.add(body, lid);
    const malhas: THREE.Mesh[] = [];
    for (const [grupo, partes] of [
      [body, caixa.corpo],
      [lid, caixa.tampa],
    ] as const) {
      for (const p of partes) {
        const malha = new THREE.Mesh(p.geo, mats.get(p.material));
        malha.name = `caixa-${p.nome}`;
        malha.castShadow = true;
        malha.receiveShadow = true;
        grupo.add(malha);
        malhas.push(malha);
      }
    }
    if (malhas[0]) malhas[0].onBeforeRender = (_r, cena) => ajustarAmbiente(cena);
    lid.userData.pivo = 'centro-de-cima';
    lid.userData.bordaDeTras = new THREE.Vector3(0, caixa.alturaCorpo, -caixa.meiaTampa);
    root.userData.tamanho = { lado: caixa.lado, alturaCorpo: caixa.alturaCorpo, alturaTotal: caixa.alturaTotal };
    root.userData.boca = new THREE.Vector3(0, caixa.alturaCorpo, 0);
    root.userData.inicioFaiscas = TAMPA_ABRE.inicioFaiscas;
    // abertura em dobradiça na borda de trás (veja o cabeçalho): f de 0 a 1, linear no tempo
    const m = caixa.meiaTampa;
    root.userData.abrir = (f: number) => {
      const x = Math.min(1, Math.max(0, f));
      // 1) solta do encaixe nos primeiros 30% (a saia da tampa tem 6 cm) e dá um pulinho no meio
      const sobe = TAMPA_ABRE.soltar * suave(x / 0.3) + TAMPA_ABRE.pulo * Math.sin(Math.PI * Math.min(1, x / 0.7));
      // 2) bascula para trás com mola, girando em volta da borda de trás (que sobe junto)
      const ang = TAMPA_ABRE.giro * (x <= 0.12 ? 0 : comMola((x - 0.12) / 0.88));
      lid.rotation.set(ang, 0, 0);
      // o centro de cima da tampa, a uma distância m da dobradiça (para a frente), girado por ang
      lid.position.set(0, caixa.alturaCorpo + sobe - m * Math.sin(ang), -m + m * Math.cos(ang));
    };
    root.userData.compartilhado = true;
    root.userData.dispose = () => root.removeFromParent();
    return { root, lid, body };
  }

  return {
    createGift,
    createGiftBox,
    pronto: mats.pronto,
    setQuality(level) {
      if (level === nivel) return;
      nivel = level;
      mats.peloU.uCamadas.value = QUALIDADE[nivel].cascas - 1;
      for (const v of vivos) {
        const e = entrada(v.id, nivel);
        v.malhas.forEach((m, i) => {
          if (e.partes[i]) m.geometry = e.partes[i].geo;
        });
      }
    },
    medir(id) {
      // monta uma cópia de verdade e conta o que ela desenha (malhas, instâncias, flocos, vapor)
      const g = createGift(id);
      let triangulos = 0;
      let chamadas = 0;
      g.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh && !(o as THREE.Points).isPoints) return;
        chamadas++;
        const geo = m.geometry;
        const n = (o as THREE.InstancedMesh).isInstancedMesh ? (o as THREE.InstancedMesh).count : 1;
        if ((o as THREE.Points).isPoints) return;
        triangulos += ((geo.getIndex()?.count ?? geo.getAttribute('position').count) / 3) * n;
      });
      (g.userData.dispose as () => void)();
      return { triangulos: Math.round(triangulos), chamadas };
    },
    dispose() {
      for (const e of cache.values()) for (const p of e.partes) p.geo.dispose();
      cache.clear();
      vivos.clear();
      mats.dispose();
      liberarCaixas();
      liberarVapor();
      liberarTexturas();
      reserva?.dispose();
    },
  };
}

export { CASCAS_MAX };
