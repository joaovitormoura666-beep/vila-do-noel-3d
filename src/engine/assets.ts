/**
 * Carregamento dos recursos 3D (modelos GLB, texturas PBR, ambientes HDR) que ficam em public/assets.
 * Tudo é guardado em cache: pedir o mesmo arquivo duas vezes não baixa nem decodifica de novo.
 * Os recursos baixados do Poly Haven estão listados em public/assets/CREDITOS.md (licença CC0).
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';

/** Endereço de um arquivo de public/. Funciona no servidor local, no laboratório e na demonstração estática. */
export function assetUrl(path: string): string {
  const base = import.meta.env.BASE_URL || '/';
  return `${base.endsWith('/') ? base : `${base}/`}${path.replace(/^\/+/, '')}`;
}

const manager = new THREE.LoadingManager();
const gltfLoader = new GLTFLoader(manager);
const textureLoader = new THREE.TextureLoader(manager);
const hdrLoader = new HDRLoader(manager);
const models = new Map<string, Promise<THREE.Group>>();
const textures = new Map<string, Promise<THREE.Texture>>();

/** Andamento do carregamento (0 a 1), para uma tela de espera. */
export function onAssetProgress(cb: (loaded: number, total: number) => void) {
  manager.onProgress = (_url, loaded, total) => cb(loaded, total);
}

export interface ModelOptions {
  castShadow?: boolean;
  receiveShadow?: boolean;
  /** Força das reflexões do ambiente nos materiais do modelo. */
  envMapIntensity?: number;
}

/**
 * Carrega um GLB de public/ (ex.: 'assets/modelos/ArmChair_01.glb') e devolve uma CÓPIA da cena dele.
 * As cópias compartilham geometrias, materiais e texturas: não chame dispose() nelas individualmente.
 * Os modelos do Poly Haven vêm em metros, com a base em y = 0.
 */
export async function loadModel(path: string, opts: ModelOptions = {}): Promise<THREE.Group> {
  let pending = models.get(path);
  if (!pending) {
    pending = gltfLoader.loadAsync(assetUrl(path)).then((gltf) => gltf.scene);
    models.set(path, pending);
  }
  const copy = (await pending).clone(true);
  copy.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = opts.castShadow ?? true;
    mesh.receiveShadow = opts.receiveShadow ?? true;
    if (opts.envMapIntensity !== undefined) {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) if ('envMapIntensity' in m) (m as THREE.MeshStandardMaterial).envMapIntensity = opts.envMapIntensity;
    }
  });
  return copy;
}

export interface TextureOptions {
  /** true para cor (difusa, emissiva); false para dados (normal, rugosidade, oclusão). */
  srgb?: boolean;
  /** Quantas vezes a textura se repete em U e V. */
  repeat?: [number, number];
  anisotropy?: number;
}

/** Carrega uma textura de public/. Com `repeat`, devolve uma cópia que compartilha a imagem (a repetição é por material). */
export async function loadTexture(path: string, opts: TextureOptions = {}): Promise<THREE.Texture> {
  let pending = textures.get(path);
  if (!pending) {
    pending = textureLoader.loadAsync(assetUrl(path));
    textures.set(path, pending);
  }
  const tex = (await pending).clone();
  tex.colorSpace = opts.srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  if (opts.repeat) tex.repeat.set(opts.repeat[0], opts.repeat[1]);
  tex.anisotropy = opts.anisotropy ?? 8;
  tex.needsUpdate = true;
  return tex;
}

export interface PbrMaps {
  map?: THREE.Texture;
  normalMap?: THREE.Texture;
  roughnessMap?: THREE.Texture;
  aoMap?: THREE.Texture;
  metalnessMap?: THREE.Texture;
  displacementMap?: THREE.Texture;
}

/**
 * Carrega o conjunto PBR de uma textura baixada com tools/polyhaven.mjs (public/assets/texturas/<id>/).
 * Uso: new THREE.MeshStandardMaterial({ ...(await loadPbr('wood_floor', { repeat: [4, 4] })) }).
 * `maps` escolhe quais mapas carregar (padrão: diff, nor, arm):
 *   diff = cor; nor = normal; arm = oclusão + rugosidade + metal em um arquivo só (vai para aoMap,
 *   roughnessMap e metalnessMap: deixe roughness = 1 e metalness = 1 no material para valerem os do mapa,
 *   ou metalness = 0 para ignorar o metal); rough, ao e disp = mapas separados, quando foram baixados.
 * A oclusão (aoMap) usa o primeiro conjunto de UV, como os demais mapas.
 */
export async function loadPbr(id: string, opts: { repeat?: [number, number]; maps?: Array<'diff' | 'nor' | 'arm' | 'rough' | 'ao' | 'disp'>; anisotropy?: number } = {}): Promise<PbrMaps> {
  const want = opts.maps ?? ['diff', 'nor', 'arm'];
  const load = (name: string, srgb: boolean) => loadTexture(`assets/texturas/${id}/${name}.jpg`, { srgb, repeat: opts.repeat, anisotropy: opts.anisotropy });
  const out: PbrMaps = {};
  await Promise.all(
    want.map(async (m) => {
      if (m === 'diff') out.map = await load('diff', true);
      else if (m === 'nor') out.normalMap = await load('nor', false);
      else if (m === 'arm') {
        const arm = await load('arm', false);
        out.aoMap = arm;
        out.roughnessMap = arm;
        out.metalnessMap = arm;
      } else if (m === 'rough') out.roughnessMap = await load('rough', false);
      else if (m === 'ao') out.aoMap = await load('ao', false);
      else if (m === 'disp') out.displacementMap = await load('disp', false);
    }),
  );
  return out;
}

/**
 * Carrega um ambiente HDR de public/ e o converte para iluminação por imagem (reflexos nos materiais PBR).
 * Devolve a textura pronta para scene.environment ou material.envMap.
 */
export async function loadEnvironment(path: string, renderer: THREE.WebGLRenderer): Promise<THREE.Texture> {
  const hdr = await hdrLoader.loadAsync(assetUrl(path));
  hdr.mapping = THREE.EquirectangularReflectionMapping;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromEquirectangular(hdr).texture;
  hdr.dispose();
  pmrem.dispose();
  return env;
}
