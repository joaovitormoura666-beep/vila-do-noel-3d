/**
 * Visitantes: gnomos natalinos esculpidos por código (veja src/world/cast/gnomos/).
 * Cada semente dá sempre o mesmo gnomo (corpo, gorro, barba, roupa e acessórios).
 * As geometrias de uma mesma semente e nível são compartilhadas e liberadas quando o último
 * gnomo que as usa é descartado; os materiais e texturas são os mesmos para todos (quatro programas
 * de shader para a fila inteira, mais um corpo simplificado que só projeta a sombra).
 */
import type * as THREE from 'three';
import type { Level, SetContext, VisitorRig } from '../contracts';
import { escolherAparencia } from './gnomos/aparencia';
import type { GeometriasGnomo, GnomoMontado, MateriaisMontagem } from './gnomos/gnomo';
import { montarGnomo } from './gnomos/gnomo';
import { geometriaDeSombra } from './gnomos/malha';
import type { MateriaisGnomo, NomeMaterial } from './gnomos/materiais';
import { MATERIAIS, pegarMateriais, soltarMateriais } from './gnomos/materiais';
import type { Modelo } from './gnomos/modelagem';
import { modelar } from './gnomos/modelagem';

export interface VisitorsPart {
  createVisitor(seed: string): VisitorRig;
  /**
   * Troca o nível. Os gnomos já em cena NÃO são remodelados todos no mesmo quadro (cada um custa de 20 a 30 ms):
   * ficam numa lista e são trocados um por chamada de `stepQuality` (o jogo chama uma vez por quadro, no mesmo
   * orçamento de "montar um gnomo"). Quem não chama `stepQuality` recebe a troca de todos de uma vez no próximo
   * `setQuality`... por isso `setQuality(level, true)` troca todos já (o laboratório usa assim).
   */
  setQuality(level: Level, deUmaVez?: boolean): void;
  /** Troca a malha de UM gnomo que ainda está no nível antigo. Devolve true se trocou (gastou o orçamento do quadro). */
  stepQuality(): boolean;
}

/** Fração de detalhe (divisões das superfícies e número de mechas) por nível. */
const DETALHE: Record<Level, number> = { alta: 0.76, media: 0.5, baixa: 0.26 };
/** Detalhe do corpo que projeta a sombra (a silhueta basta). */
const DETALHE_SOMBRA = 0.2;

interface Entrada {
  modelo: Modelo;
  g: GeometriasGnomo;
  usos: number;
}

function materiaisDoNivel(mats: MateriaisGnomo, level: Level): MateriaisMontagem {
  return { m: level === 'baixa' ? mats.leves : mats.m, sombra: mats.sombra };
}

export function buildVisitors(ctx: SetContext): VisitorsPart {
  let nivel: Level = ctx.level;
  const materiais = pegarMateriais();
  materiais.setQuality(nivel);
  const cache = new Map<string, Entrada>();
  const sombras = new Map<string, { geo: THREE.BufferGeometry; usos: number }>();
  type Vivo = { semente: string; rig: GnomoMontado; chave: string };
  const vivos = new Set<Vivo>();
  /** Gnomos em cena ainda com a malha de um nível antigo (trocados um por quadro em stepQuality). */
  const pendentes: Vivo[] = [];

  function pegarSombra(semente: string): THREE.BufferGeometry {
    let e = sombras.get(semente);
    if (!e) {
      const m = modelar(escolherAparencia(semente), DETALHE_SOMBRA);
      e = { geo: geometriaDeSombra([m.acc.pele, m.acc.tecido, m.acc.duro, m.acc.barba], m.acc.barba), usos: 0 };
      sombras.set(semente, e);
    }
    e.usos++;
    return e.geo;
  }

  function soltarSombra(semente: string) {
    const e = sombras.get(semente);
    if (!e) return;
    e.usos--;
    if (e.usos <= 0) {
      e.geo.dispose();
      sombras.delete(semente);
    }
  }

  function pegar(semente: string, level: Level): { chave: string; e: Entrada } {
    const chave = `${semente}|${level}`;
    let e = cache.get(chave);
    if (!e) {
      const modelo = modelar(escolherAparencia(semente), DETALHE[level]);
      const geos = new Map<NomeMaterial, THREE.BufferGeometry>();
      for (const nome of MATERIAIS) if (modelo.acc[nome].triangulos > 0) geos.set(nome, modelo.acc[nome].paraGeometria(nome === 'barba' && level !== 'baixa'));
      // os acumuladores não são mais necessários (libera a memória dos arrays)
      for (const nome of MATERIAIS) modelo.acc[nome].pos = [];
      // no nível baixo não há sombra de personagem
      const sombra = level === 'baixa' ? null : pegarSombra(semente);
      e = { modelo, g: { geos, sombra }, usos: 0 };
      cache.set(chave, e);
    }
    e.usos++;
    return { chave, e };
  }

  function soltar(chave: string) {
    const e = cache.get(chave);
    if (!e) return;
    e.usos--;
    if (e.usos <= 0) {
      for (const g of e.g.geos.values()) g.dispose();
      if (e.g.sombra) soltarSombra(chave.slice(0, chave.lastIndexOf('|')));
      cache.delete(chave);
    }
  }

  function createVisitor(seed: string): VisitorRig {
    const ap = escolherAparencia(seed);
    const { chave, e } = pegar(seed, nivel);
    const registro: Vivo = { semente: seed, chave, rig: null as unknown as GnomoMontado };
    const rig = montarGnomo(ap, e.modelo, e.g, materiaisDoNivel(materiais, nivel), () => {
      vivos.delete(registro);
      soltar(registro.chave);
    });
    registro.rig = rig;
    vivos.add(registro);
    return rig;
  }

  /** Troca as malhas de um gnomo em cena pelo nível atual. */
  function trocar(v: Vivo) {
    const antiga = v.chave;
    const { chave, e } = pegar(v.semente, nivel);
    v.rig.trocarMalhas(e.g, materiaisDoNivel(materiais, nivel));
    v.chave = chave;
    soltar(antiga);
  }

  const nivelDaChave = (chave: string) => chave.slice(chave.lastIndexOf('|') + 1);

  return {
    createVisitor,
    setQuality(level, deUmaVez = false) {
      if (level === nivel) return;
      nivel = level;
      materiais.setQuality(level);
      pendentes.length = 0;
      for (const v of vivos) if (nivelDaChave(v.chave) !== level) pendentes.push(v);
      if (deUmaVez) while (pendentes.length) trocar(pendentes.pop()!);
    },
    stepQuality() {
      while (pendentes.length) {
        const v = pendentes.shift()!;
        // descartado no meio do caminho, ou já no nível certo: passa para o próximo sem gastar o quadro
        if (!vivos.has(v) || nivelDaChave(v.chave) === nivel) continue;
        trocar(v);
        return true;
      }
      return false;
    },
  };
}

/** Para quem desmonta o elenco inteiro (os materiais são compartilhados entre todos os gnomos). */
export function liberarVisitantes(): void {
  soltarMateriais();
}
