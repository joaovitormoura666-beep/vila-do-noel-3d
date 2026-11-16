/**
 * Palco 3D: renderizador, câmera, pós-processamento (brilho), níveis de qualidade,
 * ajuste 9:16 à janela e uma camada HTML por cima do canvas para título, nomes e balões.
 *
 * Não conhece o jogo nem o cenário: recebe um Look (src/world/contracts.ts) e desenha.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import type { Level, Look } from '../world/contracts';

/** Tamanho de projeto da tela da live (9:16). */
export const STAGE_W = 1080;
export const STAGE_H = 1920;

const TONE: Record<Look['toneMapping'], THREE.ToneMapping> = {
  aces: THREE.ACESFilmicToneMapping,
  agx: THREE.AgXToneMapping,
  neutral: THREE.NeutralToneMapping,
  none: THREE.NoToneMapping,
};

/** Acabamento de imagem: vinheta, separação quente e frio, saturação e granulado. Trabalha em cor linear, antes do OutputPass. */
const FinishShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uVignette: { value: 0 },
    uVignetteColor: { value: new THREE.Color('#000000') },
    uWarmth: { value: 0 },
    uGrain: { value: 0 },
    uSaturation: { value: 1 },
    uTime: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uVignette;
    uniform vec3 uVignetteColor;
    uniform float uWarmth;
    uniform float uGrain;
    uniform float uSaturation;
    uniform float uTime;
    varying vec2 vUv;
    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      c.rgb = mix(vec3(l), c.rgb, uSaturation);
      // claros para o dourado, escuros para o azul
      float hi = smoothstep(0.25, 1.4, l);
      c.rgb *= mix(vec3(1.0), mix(vec3(0.90, 0.97, 1.12), vec3(1.10, 1.0, 0.86), hi), uWarmth);
      // vinheta oval, mais forte nos cantos
      vec2 d = (vUv - 0.5) * vec2(1.0, 1.25);
      float v = smoothstep(0.32, 0.95, length(d));
      c.rgb = mix(c.rgb, c.rgb * uVignetteColor, v * uVignette);
      float n = hash(vUv * vec2(1080.0, 1920.0) + fract(uTime) * 97.0) - 0.5;
      c.rgb += n * uGrain * 0.06 * (0.4 + l);
      gl_FragColor = c;
    }`,
};

/**
 * Oclusão de ambiente (sombra suave de contato nos cantos, sob os móveis e entre as pedras).
 * A passada redesenha a cena só com as normais; por isso deixa de fora o que não é sólido:
 * materiais transparentes, recortados por alpha (folhagem em cartões), partículas e tudo que
 * estiver marcado com userData.semAO = true (vale para o objeto e os filhos).
 */
class OclusaoPass extends GTAOPass {
  private readonly escondidos: THREE.Object3D[] = [];
  // estes dois métodos existem na classe base (GTAOPass), sem tipos publicados
  _overrideVisibility() {
    const cache = this.escondidos;
    const visit = (o: THREE.Object3D, herdado: boolean) => {
      if (!o.visible) return;
      const mesh = o as THREE.Mesh;
      let fora = herdado || o.userData.semAO === true || (o as THREE.Points).isPoints === true || (o as THREE.Line).isLine === true || (o as THREE.Sprite).isSprite === true;
      if (!fora && mesh.isMesh) {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        fora = mats.every((m) => m.transparent || m.alphaTest > 0 || m.depthWrite === false || (m as THREE.ShaderMaterial).isShaderMaterial === true);
      }
      if (fora && (mesh.isMesh || (o as THREE.Points).isPoints || (o as THREE.Line).isLine || (o as THREE.Sprite).isSprite || o.userData.semAO === true)) {
        o.visible = false;
        cache.push(o);
        return;
      }
      for (const c of o.children) visit(c, fora);
    };
    visit(this.scene, false);
  }
  _restoreVisibility() {
    for (const o of this.escondidos) o.visible = true;
    this.escondidos.length = 0;
  }
}

/** Fração da resolução de projeto usada em cada nível. */
const RESOLUTION: Record<Level, number> = { alta: 1, media: 0.8, baixa: 0.64 };

export interface StageOptions {
  /** Elemento que recebe o canvas e a camada HTML. O palco ocupa o elemento inteiro, mantendo 9:16. */
  parent: HTMLElement;
  /** Força a resolução interna (1 = 1080x1920). Sem isso, acompanha o tamanho na tela e o nível de qualidade. */
  fixedResolution?: number;
  /** Necessário só para capturas de tela feitas por ferramentas. */
  preserveDrawingBuffer?: boolean;
}

export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(30, STAGE_W / STAGE_H, 0.1, 300);
  readonly canvas: HTMLCanvasElement;
  /** Camada HTML em pixels de projeto (1080x1920), escalada junto com o canvas. */
  readonly overlay: HTMLDivElement;
  level: Level = 'alta';

  private readonly parent: HTMLElement;
  private readonly fixedResolution: number | undefined;
  private composer: EffectComposer | null = null;
  private bloom: UnrealBloomPass | null = null;
  private ao: OclusaoPass | null = null;
  private finish: ShaderPass | null = null;
  private clock = 0;
  private look: Look | null = null;
  private bufferW = 0;
  private bufferH = 0;
  private cssScale = 1;
  private readonly camBase = new THREE.Vector3(0, 6, 20);
  private readonly camTarget = new THREE.Vector3(0, 1.5, 0);
  private sway = 0;
  private readonly onResize = () => this.resize();
  private observer: ResizeObserver | null = null;

  constructor(opts: StageOptions) {
    this.parent = opts.parent;
    this.fixedResolution = opts.fixedResolution;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'palco-canvas';
    this.overlay = document.createElement('div');
    this.overlay.className = 'palco-overlay';
    Object.assign(this.canvas.style, { position: 'absolute', display: 'block' });
    Object.assign(this.overlay.style, {
      position: 'absolute',
      left: '0',
      top: '0',
      width: `${STAGE_W}px`,
      height: `${STAGE_H}px`,
      transformOrigin: '0 0',
      pointerEvents: 'none',
      overflow: 'hidden',
    });
    if (getComputedStyle(this.parent).position === 'static') this.parent.style.position = 'relative';
    this.parent.append(this.canvas, this.overlay);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: false, // a suavização vem do alvo com multiamostragem do pós-processamento
      alpha: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: opts.preserveDrawingBuffer ?? false,
    });
    this.renderer.setPixelRatio(1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.info.autoReset = false;

    this.resize();
    window.addEventListener('resize', this.onResize);
    if (typeof ResizeObserver !== 'undefined') {
      this.observer = new ResizeObserver(this.onResize);
      this.observer.observe(this.parent);
    }
  }

  /** Aplica a aparência do cenário: fundo, neblina, câmera, cor e brilho. `environment` são os reflexos dos materiais. */
  applyLook(look: Look, environment: THREE.Texture | null = null) {
    this.look = look;
    this.scene.environment = environment;
    this.scene.environmentIntensity = look.environmentIntensity ?? 1;
    this.scene.background = new THREE.Color(look.background);
    this.scene.fog = look.fog ? new THREE.Fog(look.fog.color, look.fog.near, look.fog.far) : null;
    const c = look.camera;
    this.camera.fov = c.fov;
    this.camera.near = c.near ?? 0.1;
    this.camera.far = c.far ?? 300;
    this.camBase.set(...c.position);
    this.camTarget.set(...c.target);
    this.sway = c.sway ?? 0;
    this.camera.position.copy(this.camBase);
    this.camera.lookAt(this.camTarget);
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
    this.renderer.toneMappingExposure = look.exposure;
    this.rebuildPipeline();
  }

  setQuality(level: Level) {
    if (level === this.level) return;
    this.level = level;
    this.resize(true);
    this.rebuildPipeline();
  }

  /** Balanço lento da câmera. Chame uma vez por quadro, antes de posicionar as etiquetas. */
  updateCamera(t: number) {
    this.clock = t;
    if (this.sway > 0) {
      const s = this.sway;
      this.camera.position.set(
        this.camBase.x + Math.sin(t * 0.21) * s,
        this.camBase.y + Math.sin(t * 0.17 + 1.3) * s * 0.35,
        this.camBase.z + Math.cos(t * 0.13) * s * 0.5,
      );
      this.camera.lookAt(this.camTarget);
    }
    this.camera.updateMatrixWorld();
  }

  /** Projeta um ponto do mundo para pixels de projeto (1080x1920). z < 1 quando está na frente da câmera. */
  project(world: THREE.Vector3, out: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 }) {
    const v = Stage.tmp.copy(world).project(this.camera);
    out.x = (v.x * 0.5 + 0.5) * STAGE_W;
    out.y = (-v.y * 0.5 + 0.5) * STAGE_H;
    out.z = v.z;
    return out;
  }
  private static readonly tmp = new THREE.Vector3();

  /** Quantos pixels de projeto mede 1 metro na profundidade deste ponto. */
  pixelsPerMeter(world: THREE.Vector3): number {
    const d = Stage.tmp.copy(world).sub(this.camera.position).dot(this.camera.getWorldDirection(Stage.tmp2));
    const visibleH = 2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2) * Math.max(0.01, d);
    return STAGE_H / visibleH;
  }
  private static readonly tmp2 = new THREE.Vector3();

  render() {
    this.renderer.info.reset();
    if (this.finish) this.finish.uniforms.uTime.value = this.clock;
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }

  /** Números do último quadro, para o painel e para os testes. */
  info() {
    const i = this.renderer.info;
    return {
      drawCalls: i.render.calls,
      triangles: i.render.triangles,
      points: i.render.points,
      geometries: i.memory.geometries,
      textures: i.memory.textures,
      programs: i.programs?.length ?? 0,
      buffer: `${this.bufferW}x${this.bufferH}`,
      level: this.level,
    };
  }

  /** Ajusta o palco ao elemento pai mantendo 9:16 e escolhe a resolução interna. */
  resize(force = false) {
    const pw = this.parent.clientWidth || window.innerWidth;
    const ph = this.parent.clientHeight || window.innerHeight;
    const s = Math.min(pw / STAGE_W, ph / STAGE_H) || 1;
    const w = STAGE_W * s;
    const h = STAGE_H * s;
    const left = (pw - w) / 2;
    const top = (ph - h) / 2;
    this.cssScale = s;
    Object.assign(this.canvas.style, { width: `${w}px`, height: `${h}px`, left: `${left}px`, top: `${top}px` });
    this.overlay.style.transform = `translate(${left}px, ${top}px) scale(${s})`;

    // resolução interna: nunca maior que a de projeto; em janelas pequenas acompanha a tela
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const res = this.fixedResolution ?? Math.min(1, Math.max(0.3, s * dpr)) * RESOLUTION[this.level];
    const bw = Math.max(2, Math.round(STAGE_W * res));
    const bh = Math.max(2, Math.round(STAGE_H * res));
    if (!force && bw === this.bufferW && bh === this.bufferH) return;
    this.bufferW = bw;
    this.bufferH = bh;
    this.renderer.setSize(bw, bh, false);
    this.composer?.setSize(bw, bh);
  }

  /** Escala atual entre pixels de projeto e pixels da tela. */
  get displayScale() {
    return this.cssScale;
  }

  private rebuildPipeline() {
    this.composer?.dispose();
    this.bloom?.dispose();
    this.ao?.dispose();
    this.finish?.dispose();
    this.composer = null;
    this.bloom = null;
    this.ao = null;
    this.finish = null;
    const look = this.look;
    if (!look) return;
    const useBloom = this.level !== 'baixa' && (!!look.bloom || !!look.finish || !!look.ao);
    if (!useBloom) {
      // desenho direto: o próprio renderizador aplica a cor
      this.renderer.toneMapping = TONE[look.toneMapping];
      return;
    }
    this.renderer.toneMapping = THREE.NoToneMapping; // quem aplica é o OutputPass
    const target = new THREE.WebGLRenderTarget(this.bufferW, this.bufferH, {
      type: THREE.HalfFloatType,
      samples: this.level === 'alta' ? 4 : 0,
    });
    const composer = new EffectComposer(this.renderer, target);
    composer.setPixelRatio(1);
    composer.setSize(this.bufferW, this.bufferH);
    composer.addPass(new RenderPass(this.scene, this.camera));
    const o = look.ao;
    if (o && this.level === 'alta') {
      // só no nível alto: custa um desenho extra da cena (normais) mais duas passadas de tela
      const ao = new OclusaoPass(this.scene, this.camera, this.bufferW, this.bufferH);
      ao.updateGtaoMaterial({
        radius: o.radius,
        distanceExponent: o.distanceExponent ?? 1.4,
        thickness: o.thickness ?? 1.2,
        scale: 1,
        samples: 16,
        distanceFallOff: 1,
        screenSpaceRadius: false,
      });
      ao.blendIntensity = o.intensity;
      composer.addPass(ao);
      this.ao = ao;
    }
    const b = look.bloom;
    if (b) {
      const bloom = new UnrealBloomPass(new THREE.Vector2(this.bufferW, this.bufferH), b.strength, b.radius, b.threshold);
      composer.addPass(bloom);
      this.bloom = bloom;
    }
    const f = look.finish;
    if (f && ((f.vignette ?? 0) > 0 || (f.warmth ?? 0) > 0 || (f.grain ?? 0) > 0 || (f.saturation ?? 1) !== 1)) {
      const finish = new ShaderPass(FinishShader);
      finish.uniforms.uVignette.value = f.vignette ?? 0;
      finish.uniforms.uVignetteColor.value = new THREE.Color(f.vignetteColor ?? '#000000');
      finish.uniforms.uWarmth.value = f.warmth ?? 0;
      finish.uniforms.uGrain.value = f.grain ?? 0;
      finish.uniforms.uSaturation.value = f.saturation ?? 1;
      composer.addPass(finish);
      this.finish = finish;
    }
    const out = new OutputPass();
    composer.addPass(out);
    // o OutputPass lê o tone mapping do renderizador no momento do desenho
    this.renderer.toneMapping = TONE[look.toneMapping];
    this.composer = composer;
  }

  dispose() {
    window.removeEventListener('resize', this.onResize);
    this.observer?.disconnect();
    this.composer?.dispose();
    this.bloom?.dispose();
    this.ao?.dispose();
    this.finish?.dispose();
    this.renderer.dispose();
    this.canvas.remove();
    this.overlay.remove();
  }
}
