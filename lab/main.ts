/**
 * Laboratório 3D: monta cenas fixas para fotografar o cenário e os personagens
 * sem depender do servidor nem da lógica do jogo. Veja lab/LEIA-ME.md.
 *
 *   /lab/index.html?cena=sala      só o cenário (cena de demonstração)
 *   /lab/index.html?cena=vila      jogo montado: cenário + Noel + fila com nomes
 *   /lab/index.html?cena=estudio   palco neutro para ver visitantes, Noel e presentes de perto
 */
import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/600.css';
import '@fontsource/fredoka/700.css';
import * as THREE from 'three';
import { AMBIENT_EFFECTS, DEFAULT_AMBIENT, isAmbientEffect } from '../shared/ambient';
import { AmbientDirector } from '../src/ambient/AmbientDirector';
import { loadModel } from '../src/engine/assets';
import { Path3 } from '../src/engine/Path3';
import { Stage, STAGE_H, STAGE_W } from '../src/engine/Stage';
import { GIFTS } from '../src/gifts/giftCatalog';
import type { BuildCast, BuildVillageSet, Cast, Level, Look, SantaPose, SantaRig, VisitorRig, VillageSet } from '../src/world/contracts';
import { buildCast as stubCast } from '../src/world/provisorio/cast';
import { buildVillageSet as stubSet } from '../src/world/provisorio/set';
import { VISITORS, fakePhoto, initialColor } from './dados';
import './lab.css';

interface LabWorld {
  update(dt: number, t: number): void;
  info?(): Record<string, unknown>;
}

interface LabApi {
  ready: boolean;
  error?: string;
  freeze(t: number): Record<string, unknown>;
  info(): Record<string, unknown>;
  benchmark(n: number): number;
}

declare global {
  interface Window {
    __proto?: LabApi;
  }
}

const params = new URLSearchParams(location.search);
const num = (key: string, fallback: number) => {
  const v = Number(params.get(key));
  return params.has(key) && Number.isFinite(v) ? v : fallback;
};

/**
 * ?set=provisorio usa os blocos; ?set=a usa src/world/set-a; ?set=kit-arvore usa src/world/set-kit-arvore;
 * sem parâmetro usa src/world/set. O endereço é montado na hora (sem lista fixa), então uma pasta criada
 * com o servidor ligado já funciona.
 */
async function loadSet(): Promise<BuildVillageSet> {
  const name = params.get('set');
  if (name === 'provisorio') return stubSet;
  if (name && !/^[\w-]+$/.test(name)) throw new Error(`nome de cenário inválido: ${name}`);
  const url = `/src/world/set${name ? `-${name}` : ''}/index.ts`;
  const mod = (await import(/* @vite-ignore */ url)) as { buildVillageSet?: BuildVillageSet };
  if (!mod.buildVillageSet) throw new Error(`o cenário ${url} não exporta buildVillageSet`);
  return mod.buildVillageSet;
}

async function loadCast(): Promise<BuildCast> {
  if (params.get('cast') === 'provisorio') return stubCast;
  try {
    return (await import('../src/world/cast/index')).buildCast;
  } catch (err) {
    console.error('[lab] o elenco (src/world/cast) não carregou; usando o provisório', err);
    return stubCast;
  }
}

function el(tag: string, className: string, text?: string) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Etiquetas HTML que seguem um ponto da cena. */
class Followers {
  private readonly items: Array<{ node: HTMLElement; target: THREE.Object3D; lift: number; anchorY: string }> = [];
  private readonly v = new THREE.Vector3();
  constructor(private readonly stage: Stage) {}

  add(node: HTMLElement, target: THREE.Object3D, lift = 0, anchorY = '-100%') {
    this.stage.overlay.append(node);
    this.items.push({ node, target, lift, anchorY });
    return node;
  }

  update() {
    const rects: Array<{ x: number; y: number; w: number; h: number }> = [];
    for (const it of this.items) {
      it.target.getWorldPosition(this.v);
      this.v.y += it.lift;
      const p = this.stage.project(this.v);
      it.node.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px) translate(-50%, ${it.anchorY})`;
      rects.push({ x: p.x - it.node.offsetWidth / 2, y: p.y - it.node.offsetHeight, w: it.node.offsetWidth, h: it.node.offsetHeight });
    }
    return rects;
  }
}

function nameLabel(name: string, withPhoto: boolean, current: boolean) {
  const node = el('div', `name-label${current ? ' current' : ''}`);
  const avatar = el('span', 'avatar');
  if (withPhoto) avatar.style.backgroundImage = `url("${fakePhoto(name)}")`;
  else {
    avatar.textContent = name.trim().charAt(0).toUpperCase();
    avatar.style.background = initialColor(name);
  }
  node.append(avatar, el('span', 'text', name));
  return node;
}

function countOverlaps(rects: Array<{ x: number; y: number; w: number; h: number }>) {
  let n = 0;
  for (let i = 0; i < rects.length; i++)
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i];
      const b = rects[j];
      if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) n++;
    }
  return n;
}

/**
 * Eventos ambientais no laboratório. Dois modos:
 *   efeito=SLEIGH_PASS&progresso=0.5&intensidade=1   congela o efeito nesse ponto (para fotos)
 *   tocar=TREE_SPARKLE,MAGICAL_NIGHT&aos=2           pede os efeitos à agenda no instante 2 s (para ver a animação)
 */
function ambientDriver(set: VillageSet) {
  const fixed = (params.get('efeito') ?? '').split(',').filter(isAmbientEffect);
  const fixedState = { progress: num('progresso', 0.5), intensity: num('intensidade', 1) };
  const toPlay = (params.get('tocar') ?? '').split(',').filter(isAmbientEffect);
  const playAt = num('aos', 1);
  const director = new AmbientDirector({ ...DEFAULT_AMBIENT, maxSimultaneous: 4 });
  let played = false;
  return {
    update(dt: number, t: number) {
      if (!played && toPlay.length && t >= playAt) {
        played = true;
        for (const effect of toPlay) director.request({ effect, source: 'laboratorio' });
      }
      director.update(dt);
      for (const effect of AMBIENT_EFFECTS) set.setAmbient(effect, fixed.includes(effect) ? fixedState : director.state(effect));
    },
    active: () => director.snapshot().active.map((a) => a.effect as string).concat(fixed),
  };
}

/* ---------------------------------------------------------------- cena: sala */

/** Só o cenário, sem personagens nem interface: é a cena de demonstração para avaliar o visual. */
function buildSala(stage: Stage, set: VillageSet, level: Level): LabWorld {
  // cam=x,y,z,alvoX,alvoY,alvoZ,fov : troca a câmera só para a foto (olhar uma peça de perto ou de outro ângulo)
  const cam = (params.get('cam') ?? '').split(',').map(Number);
  const look: Look = cam.length >= 6 && cam.every(Number.isFinite) ? { ...set.look, camera: { ...set.look.camera, position: [cam[0], cam[1], cam[2]], target: [cam[3], cam[4], cam[5]], fov: cam[6] ?? set.look.camera.fov, sway: 0 } } : { ...set.look };
  // ao=0 desliga a oclusão de ambiente; ao=0.5,1 força raio e intensidade (para comparar com e sem)
  if (params.has('ao')) {
    const [raio, forca] = (params.get('ao') ?? '').split(',').map(Number);
    look.ao = raio > 0 ? { radius: raio, intensity: Number.isFinite(forca) ? forca : 1 } : null;
  }
  stage.applyLook(look, set.environment ?? null);
  stage.scene.add(set.root);
  set.setQuality(level);
  if (params.get('entrega') === '1') set.setDeliveryActive(true);
  // fantasmas=1: silhuetas translúcidas no lugar do Noel (2,2 m) e do visitante (1,2 m), só para conferir escala e espaço
  if (params.get('fantasmas') === '1') {
    const mat = new THREE.MeshBasicMaterial({ color: '#7fd6ff', transparent: true, opacity: 0.35, depthWrite: false });
    const ghost = (h: number, r: number, spot: { position: THREE.Vector3; yaw: number }) => {
      const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, h - 2 * r, 6, 16), mat);
      m.position.copy(spot.position).y += h / 2;
      stage.scene.add(m);
    };
    ghost(2.2, 0.62, set.anchors.santa);
    ghost(1.2, 0.3, set.anchors.delivery);
  }
  const ambient = ambientDriver(set);
  return {
    update(dt, t) {
      ambient.update(dt, t);
      set.update(dt, t);
      stage.updateCamera(t);
    },
    info: () => ({ cena: 'sala', efeitos: ambient.active() }),
  };
}

/* ---------------------------------------------------------------- cena: vila */

function buildVila(stage: Stage, set: VillageSet, cast: Cast, level: Level): LabWorld {
  const estado = params.get('estado') ?? 'fila';
  const { anchors } = set;
  stage.applyLook(set.look, set.environment ?? null);
  stage.scene.add(set.root);

  const santa = cast.createSanta();
  santa.root.position.copy(anchors.santa.position);
  santa.root.rotation.y = anchors.santa.yaw;
  stage.scene.add(santa.root);

  const path = new Path3(anchors.queuePath);
  const waitingCount = Math.round(num('fila', 12));
  const followers = new Followers(stage);
  const rigs: VisitorRig[] = [];

  // quem está sendo atendido
  const current = cast.createVisitor(VISITORS[0].name);
  current.root.position.copy(anchors.delivery.position);
  current.root.rotation.y = anchors.delivery.yaw;
  stage.scene.add(current.root);
  rigs.push(current);
  followers.add(nameLabel(VISITORS[0].name, VISITORS[0].photo, true), current.labelAnchor, 0.12);

  // a fila
  for (let i = 0; i < waitingCount; i++) {
    const who = VISITORS[(i + 1) % VISITORS.length];
    const name = i + 1 < VISITORS.length ? who.name : `${who.name}${i}`;
    const rig = cast.createVisitor(name);
    const s = path.length - anchors.frontGap - i * anchors.queueSpacing;
    path.at(s, rig.root.position);
    rig.root.rotation.y = path.yawAt(s);
    stage.scene.add(rig.root);
    rigs.push(rig);
    followers.add(nameLabel(name, who.photo, false), rig.labelAnchor, 0.1);
  }
  // alguém chegando, andando pela entrada
  let walker: VisitorRig | null = null;
  if (params.get('andando') !== '0') {
    walker = cast.createVisitor('chegando');
    const s = Math.max(0.5, path.length - anchors.frontGap - (waitingCount + 1.6) * anchors.queueSpacing);
    path.at(s, walker.root.position);
    walker.root.rotation.y = path.yawAt(s);
    walker.pose.walk = 1;
    stage.scene.add(walker.root);
    rigs.push(walker);
  }

  // título, instrução e contador
  const title = el('div', 'hud-title', 'Vila do Noel');
  const hint = el('div', 'hud-hint', 'Digite !presente no chat ou envie uma 🌹 para entrar na fila');
  const count = el('div', 'hud-count', `${waitingCount} pessoas na fila`);
  stage.overlay.append(title, hint, count);

  let gift: THREE.Object3D | null = null;
  const giftId = params.get('presente') ?? 'ursinho';
  const giftDef = GIFTS.find((g) => g.id === giftId) ?? GIFTS[0];
  if (estado === 'revelacao') {
    gift = cast.createGift(giftDef.id);
    gift.position.copy(anchors.reveal);
    gift.scale.setScalar(num('escala', 1.5));
    stage.scene.add(gift);
    santa.pose.present = 1;
    santa.pose.cheer = 0.4;
    current.pose.joy = 1;
    current.pose.lookUp = 1;
    hint.hidden = true;
    count.hidden = true;
    const banner = el('div', 'lab-banner');
    banner.append(el('div', 'who', `${VISITORS[0].name} ganhou`), el('div', 'what', giftDef.name));
    stage.overlay.append(banner);
    set.setDeliveryActive(true);
  } else if (estado === 'entrega') {
    gift = cast.createGift(giftDef.id);
    gift.scale.setScalar(0.55);
    current.giftAnchor.add(gift);
    current.pose.hold = 1;
    santa.pose.give = 0.6;
    set.setDeliveryActive(true);
  } else if (estado === 'caixa') {
    const box = cast.createGiftBox();
    box.root.position.copy(anchors.reveal).y -= 0.5;
    box.root.scale.setScalar(num('escala', 1.3));
    stage.scene.add(box.root);
    santa.pose.present = 1;
    current.pose.lookUp = 1;
    set.setDeliveryActive(true);
  } else {
    santa.pose.talk = 1;
    santa.pose.wave = 0.6;
    const bubble = el('div', 'lab-bubble', 'Vamos ver qual é o seu presente!');
    followers.add(bubble, santa.bubbleAnchor, 0.15, 'calc(-100% - 26px)');
    set.setDeliveryActive(true);
  }
  set.setQuality(level);
  cast.setQuality(level);

  const ambient = ambientDriver(set);

  let overlaps = 0;
  return {
    update(dt, t) {
      ambient.update(dt, t);
      set.update(dt, t);
      santa.update(dt, t);
      if (walker) walker.pose.phase += dt * 7;
      if (estado === 'entrega') current.pose.jump = Math.abs(Math.sin(t * 5)) * 0.8;
      for (const r of rigs) r.update(dt, t);
      if (gift && estado === 'revelacao') {
        gift.rotation.y = t * 0.9;
        gift.position.y = anchors.reveal.y + Math.sin(t * 2.2) * 0.08;
      }
      stage.updateCamera(t);
      overlaps = countOverlaps(followers.update().slice(0, waitingCount + 1));
    },
    info: () => ({ estado, nomesSobrepostos: overlaps, caminhoDaFila: Math.round(path.length * 10) / 10, efeitos: ambient.active() }),
  };
}

/* ------------------------------------------------------------- cena: estúdio */

const SANTA_POSES: Array<keyof SantaPose | 'parado'> = ['parado', 'wave', 'talk', 'rummage', 'present', 'give', 'cheer'];

async function buildEstudio(stage: Stage, cast: Cast, level: Level): Promise<LabWorld> {
  const mostrar = params.get('mostrar') ?? 'visitantes';
  const noite = params.get('luz') === 'noite';
  const look: Look = {
    background: noite ? '#17253B' : '#8fa3bd',
    fog: null,
    toneMapping: 'aces',
    exposure: 1.05,
    bloom: { strength: 0.35, radius: 0.5, threshold: 0.95 },
    camera: { fov: 26, position: [0, 4.2, 13], target: [0, 1.5, 0] },
  };
  const scene = stage.scene;
  scene.add(new THREE.HemisphereLight(noite ? '#8fa9d9' : '#ffffff', noite ? '#2b3a57' : '#9aa7b8', noite ? 0.8 : 1.2));
  const key = new THREE.DirectionalLight(noite ? '#bcd0ff' : '#fff4e0', noite ? 1.5 : 2.2);
  key.position.set(-5, 9, 7);
  key.castShadow = level !== 'baixa';
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -8, right: 8, top: 10, bottom: -4, far: 40 });
  scene.add(key);
  if (noite) {
    const warm = new THREE.PointLight('#ffcf80', 40, 14, 1.6);
    warm.position.set(3, 3, 3);
    scene.add(warm);
  }
  const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 48), new THREE.MeshStandardMaterial({ color: noite ? '#dfe7f2' : '#e9edf2', roughness: 0.95 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const followers = new Followers(stage);
  const updaters: Array<(dt: number, t: number) => void> = [];
  const tag = (text: string, target: THREE.Object3D, lift: number) => followers.add(el('div', 'lab-tag', text), target, lift);
  const spin = params.get('girar') !== '0';

  if (mostrar === 'modelo') {
    // mostrar=modelo&url=assets/modelos/ArmChair_01.glb : confere um modelo baixado (escala, aparência, triângulos).
    // Aceita vários separados por vírgula (ficam lado a lado, cada um com nome e medidas): url=a.glb,b.glb,c.glb
    const urls = (params.get('url') ?? '').split(',').filter(Boolean);
    const yaw = num('yaw', 0.6);
    const loaded = await Promise.all(urls.map((u) => loadModel(u)));
    const sizes = loaded.map((m) => new THREE.Box3().setFromObject(m).getSize(new THREE.Vector3()));
    const gap = 0.35;
    const widths = sizes.map((sz) => Math.max(sz.x, sz.z, 0.25));
    const total = widths.reduce((a, b) => a + b, 0) + gap * (widths.length - 1);
    const tallest = Math.max(...sizes.map((sz) => sz.y), 0.3);
    let x = -total / 2;
    loaded.forEach((model, i) => {
      const holder = new THREE.Group();
      holder.add(model);
      holder.position.x = x + widths[i] / 2;
      x += widths[i] + gap;
      scene.add(holder);
      if (spin) updaters.push((_dt, t) => (holder.rotation.y = t * 0.5));
      else holder.rotation.y = yaw;
      const sz = sizes[i];
      const name = urls[i].split('/').pop()!.replace(/\.glb$/i, '');
      const label = tag(`${urls.length > 1 ? `${name}  ` : ''}${sz.x.toFixed(2)} x ${sz.y.toFixed(2)} x ${sz.z.toFixed(2)} m`, holder, -0.05);
      label.style.marginTop = `${34 + (i % 2) * 30}px`;
    });
    const reach = Math.max(total * 0.62, tallest, 0.3);
    look.camera = { fov: 26, position: [0, tallest * 0.75 + reach * 0.5, reach * 3.4], target: [0, tallest * 0.5, 0] };
    const ruler = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.6, 6, 12), new THREE.MeshStandardMaterial({ color: '#b62835' }));
    ruler.position.set(-total / 2 - 0.7, 0.6, 0);
    scene.add(ruler);
    tag('visitante 1,2 m', ruler, 1.25);
  } else if (mostrar === 'noel') {
    const pose = params.get('pose');
    const list = pose ? [pose as keyof SantaPose] : SANTA_POSES;
    const cols = pose ? 1 : 4;
    look.camera = pose ? { fov: 26, position: [0, 2.6, 8.5], target: [0.3, 1.25, 0] } : { fov: 26, position: [0, 5.5, 21], target: [0, 2.3, 0] };
    list.forEach((name, i) => {
      const rig: SantaRig = cast.createSanta();
      const col = i % cols;
      const row = Math.floor(i / cols);
      rig.root.position.set(pose ? 0 : (col - 1.5) * 4.2, 0, pose ? 0 : -row * 5.2 + 2.6);
      rig.root.rotation.y = num('yaw', -0.35);
      if (name !== 'parado') rig.pose[name] = 1;
      scene.add(rig.root);
      updaters.push((dt, t) => rig.update(dt, t));
      tag(name, rig.root, -0.05).style.marginTop = '34px';
    });
  } else if (mostrar === 'presentes') {
    look.camera = { fov: 26, position: [0, 5.2, 13.5], target: [0, 2.0, 0] };
    const only = params.get('presente');
    const defs = only ? GIFTS.filter((g) => g.id === only) : GIFTS;
    if (only) look.camera = { fov: 26, position: [0, 1.6, 4.4], target: [0, 0.9, 0] };
    defs.forEach((g, i) => {
      const obj = cast.createGift(g.id);
      const holder = new THREE.Group();
      holder.add(obj);
      holder.position.set(only ? 0 : ((i % 4) - 1.5) * 1.9, only ? 0.9 : 3.9 - Math.floor(i / 4) * 1.7, 0);
      scene.add(holder);
      if (spin) updaters.push((_dt, t) => (holder.rotation.y = t * 0.8 + i));
      else holder.rotation.y = num('yaw', 0);
      tag(g.name, holder, -0.62);
    });
    if (!only) {
      const box = cast.createGiftBox();
      box.root.position.set(-4.6, 0, 1.5);
      const open = cast.createGiftBox();
      open.root.position.set(4.6, 0, 1.5);
      open.lid.position.y += 0.7;
      open.lid.rotation.z = 0.5;
      scene.add(box.root, open.root);
      tag('caixa', box.root, 0);
      tag('caixa abrindo', open.root, 0);
    }
  } else {
    // visitantes: três fileiras (parados, andando, comemorando com o presente)
    look.camera = { fov: 26, position: [0, 5.2, 14.5], target: [0, 1.3, 0] };
    const perRow = Math.round(num('porLinha', 6));
    const rows = Math.round(num('linhas', 3));
    for (let row = 0; row < rows; row++)
      for (let col = 0; col < perRow; col++) {
        const seed = `visitante-${row * perRow + col + Math.round(num('semente', 0))}`;
        const rig = cast.createVisitor(seed);
        rig.root.position.set((col - (perRow - 1) / 2) * 1.75, 0, 2.6 - row * 2.6);
        rig.root.rotation.y = num('yaw', 0) + (row === 1 ? 0.7 : 0);
        scene.add(rig.root);
        if (row === 1) rig.pose.walk = 1;
        if (row === 2) {
          if (col % 2 === 0) {
            rig.pose.joy = 1;
            rig.pose.lookUp = 1;
          } else {
            rig.pose.hold = 1;
            const g = cast.createGift(GIFTS[col % GIFTS.length].id);
            g.scale.setScalar(0.55);
            rig.giftAnchor.add(g);
          }
        }
        updaters.push((dt, t) => {
          if (row === 1) rig.pose.phase += dt * 7;
          if (row === 2) rig.pose.jump = Math.abs(Math.sin(t * 5 + col));
          rig.update(dt, t);
        });
      }
  }
  if (params.has('cam')) {
    const [x, y, z, tx, ty, tz, fov] = (params.get('cam') ?? '').split(',').map(Number);
    look.camera = { fov: fov || look.camera.fov, position: [x, y, z], target: [tx || 0, ty || 0, tz || 0] };
  }
  stage.applyLook(look);
  cast.setQuality(level);
  return {
    update(dt, t) {
      for (const u of updaters) u(dt, t);
      stage.updateCamera(t);
      followers.update();
    },
    info: () => ({ mostrar }),
  };
}

/* -------------------------------------------------------------------- início */

async function start() {
  const api: LabApi = { ready: false, freeze: () => ({}), info: () => ({}), benchmark: () => 0 };
  window.__proto = api;
  try {
    const parent = document.getElementById('palco')!;
    const pr = Math.min(2, Math.max(0.25, num('pr', 1)));
    const q = params.get('q');
    const level: Level = q === 'baixa' || q === 'media' ? q : 'alta';
    const stage = new Stage({ parent, fixedResolution: pr, preserveDrawingBuffer: true });
    stage.setQuality(level);
    await Promise.all(['500 20px Fredoka', '600 20px Fredoka', '700 20px Fredoka'].map((f) => document.fonts.load(f))).catch(() => undefined);

    const cena = params.get('cena') ?? 'vila';
    const ctx = { renderer: stage.renderer, level };
    const world =
      cena === 'sala'
        ? buildSala(stage, await (await loadSet())(ctx), level)
        : cena === 'estudio'
          ? await buildEstudio(stage, (await loadCast())(ctx), level)
          : buildVila(stage, await (await loadSet())(ctx), (await loadCast())(ctx), level);

    let t = 0;
    let frozen = false;
    let last = performance.now();
    const info = () => ({ t: Math.round(t * 100) / 100, ...stage.info(), ...(world.info?.() ?? {}) });
    const frame = (now: number) => {
      if (frozen) return;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      t += dt;
      world.update(dt, t);
      stage.render();
      requestAnimationFrame(frame);
    };
    api.freeze = (target: number) => {
      frozen = true;
      const step = 1 / 30;
      while (t + step <= target) {
        t += step;
        world.update(step, t);
      }
      stage.render();
      return info();
    };
    api.info = info;
    api.benchmark = (n: number) => {
      frozen = true;
      const gl = stage.renderer.getContext();
      const px = new Uint8Array(4);
      const t0 = performance.now();
      for (let i = 0; i < n; i++) {
        t += 1 / 60;
        world.update(1 / 60, t);
        stage.render();
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      }
      return (performance.now() - t0) / n;
    };
    world.update(0, 0);
    stage.render();
    api.ready = true;
    requestAnimationFrame(frame);
  } catch (err) {
    api.error = err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err);
    console.error('[lab] falhou ao iniciar', err);
  }
}

void start();

export { STAGE_H, STAGE_W };
