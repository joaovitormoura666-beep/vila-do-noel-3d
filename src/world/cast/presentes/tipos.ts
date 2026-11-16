/** Tipos comuns dos presentes: o que cada arquivo de presente devolve para o catálogo montar. */
import type * as THREE from 'three';
import type { Level } from '../../contracts';
import type { Molde } from './malha';
import type { MateriaisPresentes, NomeMaterial } from './materiais';

/** Quanto detalhe moldar: k multiplica as divisões das superfícies; cascas = camadas da pelúcia. */
export interface Qualidade {
  nivel: Level;
  k: number;
  cascas: number;
}

export const QUALIDADE: Record<Level, Qualidade> = {
  alta: { nivel: 'alta', k: 1, cascas: 4 },
  media: { nivel: 'media', k: 0.7, cascas: 3 },
  baixa: { nivel: 'baixa', k: 0.5, cascas: 2 },
};

/** Divisões arredondadas pelo nível, com um mínimo. */
export const div = (q: Qualidade, n: number, min = 4) => Math.max(min, Math.round(n * q.k));

/** Uma malha do presente: um material, uma chamada de desenho. */
export interface Parte {
  nome: string;
  material: NomeMaterial;
  molde: Molde;
  /** Pelúcia: a malha se repete em cascas. */
  cascas?: boolean;
  /** Projeta sombra (padrão true). */
  sombra?: boolean;
  /** Ponto de giro da peça (no espaço do modelo): a malha nasce em volta dele, para animar. */
  pivo?: THREE.Vector3;
  /** Nome da parte-mãe (a peça gira junto com ela). */
  mae?: string;
  /** Quantas cópias (InstancedMesh), com as matrizes no espaço da mãe. */
  instancias?: THREE.Matrix4[];
  /** Ordem de desenho (vidro por último). */
  ordem?: number;
}

/** Objeto extra criado por cópia (flocos, vapor), com animação e descarte próprios. */
export interface Extra {
  objeto: THREE.Object3D;
  update?(dt: number, t: number): void;
  dispose?(): void;
}

/** Peças já criadas de uma cópia, por nome (para a animação). */
export type PecasVivas = Map<string, THREE.Object3D>;

export interface Modelo {
  partes: Parte[];
  /** Extras de cada cópia (no espaço do modelo, antes do ajuste ao cubo de 1 m). */
  extras?(mats: MateriaisPresentes, q: Qualidade): Extra[];
  /** Animação própria da cópia (só dt e t). */
  animar?(pecas: PecasVivas): (dt: number, t: number) => void;
}

export type Moldar = (q: Qualidade) => Modelo;
