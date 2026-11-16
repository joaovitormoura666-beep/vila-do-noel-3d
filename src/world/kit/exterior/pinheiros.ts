/**
 * Coníferas do exterior.
 *  - Ramos de agulhas: um atlas pintado em canvas (raminhos com centenas de agulhas finas saindo de uma nervura),
 *    usado em tiras curvas recortadas por alfa. Nada de leque chapado: a silhueta é rendada como a de um pinheiro.
 *  - Pinheiro carregado de neve (primeiro plano, em escala real): verticilos de ramos que pendem com o peso,
 *    duas camadas de tiras por ramo e um manto de neve próprio por cima, irregular, com falhas por onde as
 *    agulhas aparecem.
 *  - Bosque: o mesmo pinheiro, construído em quatro feitios, é fotografado UMA vez (cor e normal) para um atlas;
 *    as árvores do bosque são cartões que giram para a câmera e são iluminados pelo luar com essa normal
 *    (impostores). Cada árvore custa 2 triângulos e tem o mesmo acabamento da árvore de primeiro plano.
 */
import * as THREE from 'three';
import { GLSL_LUAR, GLSL_RUIDO, type UniformesLuar } from './luar';
import { Malha, type CorVertice, criarRng, faixa, fbm } from './util';

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/* ------------------------------------------------------------ atlas de ramos */

/** Células do atlas de ramos (2 x 2). Cada uma é um raminho deitado: base à esquerda, ponta à direita. */
export const CELULAS_RAMO = 4;

/**
 * Pinta o atlas: em cada célula, uma nervura levemente curva com raminhos laterais, e agulhas finas saindo para a
 * frente dos dois lados (comprimento caindo para a ponta). rgb = valor (sombreamento interno), a = recorte.
 */
export function criarTexturaRamos(): THREE.CanvasTexture {
  const W = 512;
  const H = 256;
  const cv = document.createElement('canvas');
  cv.width = W * 2;
  cv.height = H * 2;
  const c = cv.getContext('2d');
  if (!c) throw new Error('canvas 2D indisponível');
  c.clearRect(0, 0, cv.width, cv.height);
  c.lineCap = 'round';
  const rng = criarRng(9091);
  const agulhas = (x0: number, y0: number, ang: number, comp: number, lAg: number, densidade: number, claro: number) => {
    const passos = Math.max(4, Math.round(comp / densidade));
    for (let i = 0; i <= passos; i++) {
      const t = i / passos;
      const x = x0 + Math.cos(ang) * comp * t;
      const y = y0 + Math.sin(ang) * comp * t;
      const la = lAg * (1 - 0.55 * t) * (0.8 + 0.4 * rng());
      for (const lado of [-1, 1]) {
        const a = ang + lado * (0.75 + 0.35 * rng());
        const v = Math.round(110 + 120 * claro * (0.55 + 0.45 * rng()) * (0.7 + 0.3 * t));
        c.strokeStyle = `rgba(${v},${v},${v},1)`;
        c.lineWidth = 1.6 + rng() * 1.1;
        c.beginPath();
        c.moveTo(x, y);
        // agulha levemente curva
        const mx = x + Math.cos(a) * la * 0.55;
        const my = y + Math.sin(a) * la * 0.55;
        c.quadraticCurveTo(mx + Math.cos(ang) * la * 0.12, my + Math.sin(ang) * la * 0.12, x + Math.cos(a) * la + Math.cos(ang) * la * 0.3, y + Math.sin(a) * la + Math.sin(ang) * la * 0.3);
        c.stroke();
      }
    }
  };
  for (let cel = 0; cel < CELULAS_RAMO; cel++) {
    const ox = (cel % 2) * W;
    const oy = Math.floor(cel / 2) * H;
    c.save();
    c.beginPath();
    c.rect(ox, oy, W, H);
    c.clip();
    const cy = oy + H / 2;
    const x0 = ox + 14;
    const comp = W - 50;
    const curva = (rng() - 0.5) * 18;
    // raminhos laterais (abaixo das agulhas da nervura, mais escuros: dão profundidade)
    const nTw = 6 + Math.floor(rng() * 3);
    for (let k = 0; k < nTw; k++) {
      const t = 0.1 + (0.78 * (k + rng() * 0.6)) / nTw;
      const lado = k % 2 ? 1 : -1;
      const bx = x0 + comp * t;
      const by = cy + curva * Math.sin(Math.PI * t);
      const ang = lado * (0.5 + 0.25 * rng());
      const lt = (H * 0.42 - 18) * (1 - 0.55 * t) * (0.75 + 0.3 * rng());
      c.strokeStyle = 'rgba(70,64,58,1)';
      c.lineWidth = 2.2;
      c.beginPath();
      c.moveTo(bx, by);
      c.lineTo(bx + Math.cos(ang) * lt, by + Math.sin(ang) * lt);
      c.stroke();
      agulhas(bx, by, ang, lt, 24, 3.2, 0.75);
    }
    // nervura e agulhas principais por cima
    c.strokeStyle = 'rgba(80,72,64,1)';
    c.lineWidth = 3.4;
    c.beginPath();
    c.moveTo(x0, cy);
    c.quadraticCurveTo(x0 + comp * 0.5, cy + curva * 2, x0 + comp, cy);
    c.stroke();
    agulhas(x0, cy, 0, comp, 34, 2.6, 1);
    c.restore();
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.NoColorSpace;
  t.anisotropy = 4;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

/* ---------------------------------------------------------------- pinheiro */

export interface MalhasPinheiro {
  /** Tiras de agulhas (material com recorte por alfa do atlas de ramos). */
  folhagem: Malha;
  neve: Malha;
  casca: Malha;
}

export interface PinheiroOpc {
  /** Raio dos ramos de baixo em relação à altura. Padrão 0,3. */
  esbelto?: number;
  /** Quantidade de neve (1 = carregado). */
  carga?: number;
  /** 'baixo' = uma tira por ramo e manto mais simples. */
  detalhe?: 'alto' | 'baixo';
  /** Verticilos por metro de altura. Padrão 2,1. */
  densidade?: number;
}

/** Pinheiro carregado de neve. A matriz dá posição, giro e escala; base do tronco em y = 0. */
export function construirPinheiro(m: MalhasPinheiro, M: THREE.Matrix4, altura: number, semente: number, opc: PinheiroOpc = {}) {
  const rng = criarRng(semente);
  const { folhagem, neve, casca } = m;
  const alto = opc.detalhe !== 'baixo';
  const carga = opc.carga ?? 1;
  casca.definir(M);
  casca.tubo([V(0, -0.3, 0), V(0.02, altura * 0.3, 0.02), V(-0.02, altura * 0.65, 0), V(0.01, altura * 0.96, 0)], [altura * 0.034, altura * 0.026, altura * 0.014, 0.008], 7, 0.8, { r: 0.7, g: 0.66, b: 0.66 }, false);
  const nTiers = Math.max(7, Math.round(altura * (opc.densidade ?? 2.1)));
  const rMax = altura * (opc.esbelto ?? 0.3);
  let giro = rng() * 6;
  const nS = alto ? 4 : 3;
  for (let i = 0; i < nTiers; i++) {
    const t = i / (nTiers - 1);
    const y = altura * (0.12 + 0.8 * Math.pow(t, 0.9));
    const alcance = rMax * Math.pow(1 - t, 0.85) + altura * 0.045;
    const nb = Math.max(5, Math.round(9 - 3.5 * t + rng()));
    giro += 0.9 + rng();
    for (let k = 0; k < nb; k++) {
      const az = giro + (k / nb) * Math.PI * 2 + (rng() - 0.5) * 0.5;
      const comp = alcance * faixa(rng, 0.78, 1.15);
      const larg = comp * faixa(rng, 0.34, 0.44) + 0.04;
      const dirH = V(Math.cos(az), 0, Math.sin(az));
      const ladoH = V(-Math.sin(az), 0, Math.cos(az));
      // ramos de baixo pendem mais (e mais ainda com neve); os do alto apontam para cima
      const sobe = 0.36 - 0.34 * (1 - t) + (rng() - 0.5) * 0.12;
      const cai = (0.42 + 0.22 * carga) * (1 - t * 0.55) + (rng() - 0.5) * 0.12;
      const yBase = y + (rng() - 0.5) * altura * 0.025;
      const meio = (s: number, out: THREE.Vector3) => out.copy(dirH).multiplyScalar(comp * s).setY(yBase + comp * (sobe * s - cai * s * s));
      const escuro = (0.5 + 0.3 * rng()) * (0.75 + 0.25 * t);
      const cel = Math.floor(rng() * CELULAS_RAMO);
      const u0 = (cel % 2) * 0.5;
      const v0c = Math.floor(cel / 2) * 0.5;
      // larguras: a tira é quase retangular (o desenho do raminho já afina para a ponta)
      const largura = (s: number) => larg * (0.62 + 0.38 * Math.sin(Math.PI * Math.min(1, 0.25 + s * 0.75)));
      const queda = (v: number, s: number) => Math.pow(Math.abs(v), 1.3) * largura(s) * 0.38;
      folhagem.definir(M);
      const pm = new THREE.Vector3();
      const nrm = new THREE.Vector3();
      const tira = (escalaL: number, escalaC: number, dy: number, giroA: number, tom: number, celU: number, celV: number) => {
        const v0 = folhagem.vertices;
        const dH = dirH.clone().applyAxisAngle(CIMA, giroA);
        const lH = ladoH.clone().applyAxisAngle(CIMA, giroA);
        for (let s = 0; s <= nS; s++) {
          const fs = s / nS;
          meio(fs * escalaC, pm);
          pm.x = dH.x * comp * fs * escalaC;
          pm.z = dH.z * comp * fs * escalaC;
          for (const v of [-1, 0, 1]) {
            const w = largura(fs) * escalaL;
            // normal "volumétrica": para cima e para fora do tronco (a copa se lê como volume, não como cartões)
            nrm.set(0, 0.75, 0).addScaledVector(dH, 0.45 + 0.2 * fs).addScaledVector(lH, v * 0.4).normalize();
            const c: CorVertice = { r: escuro * tom * (0.55 + 0.45 * fs), g: escuro * tom * (0.6 + 0.4 * fs), b: escuro * tom * (0.62 + 0.38 * fs) };
            folhagem.v(pm.x + lH.x * v * w, pm.y + dy - queda(v, fs) * escalaL, pm.z + lH.z * v * w, nrm.x, nrm.y, nrm.z, celU + 0.02 + fs * 0.46, celV + 0.25 + v * 0.24, c);
          }
        }
        for (let s = 0; s < nS; s++) {
          const a = v0 + s * 3;
          folhagem.tri(a, a + 3, a + 1);
          folhagem.tri(a + 1, a + 3, a + 4);
          folhagem.tri(a + 1, a + 4, a + 2);
          folhagem.tri(a + 2, a + 4, a + 5);
        }
      };
      tira(1, 1, 0, 0, 1, u0, v0c);
      if (alto) {
        const cel2 = (cel + 1 + Math.floor(rng() * 3)) % CELULAS_RAMO;
        tira(0.85, 0.82, -larg * 0.28, (rng() - 0.5) * 0.5, 0.62, (cel2 % 2) * 0.5, Math.floor(cel2 / 2) * 0.5);
      }

      // manto de neve: cobre o meio do ramo, com bordas quebradas e falhas; as pontas das agulhas ficam de fora
      if (carga <= 0) continue;
      const esp = (0.035 + 0.045 * rng()) * (0.6 + altura * 0.1) * (0.75 + 0.2 * (1 - t)) * carga;
      const sem = rng() * 30;
      const s0 = faixa(rng, 0.0, 0.08);
      const s1 = faixa(rng, 0.62, 0.8);
      neve.definir(M);
      const vs = alto ? [-1, -0.62, 0.05, 0.66, 1] : [-1, 0, 1];
      const nA = alto ? 7 : 5;
      neve.grade(
        nA,
        vs.length,
        (iu, iv, out) => {
          const fu = iu / (nA - 1);
          const fs = s0 + (s1 - s0) * (0.5 - 0.5 * Math.cos(Math.PI * fu));
          const v = vs[iv];
          meio(fs, out);
          // falhas: onde o ruído cai, o manto afina e encolhe (o ramo aparece por baixo)
          const g = 0.15 + 0.85 * THREE.MathUtils.smoothstep(fbm(fs * 3.1 + sem, sem * 0.7, 2), 0.36, 0.62);
          const bordaU = Math.min(fu, 1 - fu);
          const w = largura(fs) * (0.38 + 0.36 * fbm(fs * 5 + sem * 1.7, v * 0.8 + 2, 2)) * g * Math.pow(Math.min(1, bordaU * 4.5 + 0.12), 0.5);
          const borda = Math.abs(v) > 0.99 || iu === 0 || iu === nA - 1;
          const domo = borda ? 0 : Math.pow(1 - v * v, 0.5) * Math.pow(Math.min(1, bordaU * 5), 0.6);
          const caroco = 0.55 + 0.9 * fbm(fs * 7 + sem, v * 2.3 + sem, 2);
          const h = esp * domo * caroco * g;
          out.x += ladoH.x * v * w;
          out.z += ladoH.z * v * w;
          // a borda escorre irregular por entre as agulhas (nunca uma linha reta)
          const escorre = borda ? 0.02 + 0.05 * fbm(fs * 9 + sem * 2.1, v * 3 + sem, 2) : 0;
          out.y += -queda(v * w / Math.max(largura(fs), 1e-3), fs) + h + (borda ? -escorre : 0.012);
          return borda ? { r: 0.72, g: 0.76, b: 0.86 } : undefined;
        },
        0.9,
      );
    }
  }
  // ponta: guia fino e um punhado pequeno e torto de neve
  folhagem.definir(M);
  neve.definir(M.clone().multiply(new THREE.Matrix4().makeTranslation(altura * 0.012, altura * 0.93, -altura * 0.008)));
  if (carga > 0) {
    neve.grade(
      5,
      5,
      (i, j, out) => {
        const u = i / 4 - 0.5;
        const v = j / 4 - 0.5;
        const r = Math.hypot(u * 1.2, v) * 2;
        out.set(u * altura * 0.06, altura * 0.035 * Math.max(0, 1 - r * r) * (0.7 + 0.6 * fbm(u * 3 + 5, v * 3, 2)) - 0.012, v * altura * 0.05);
      },
      0.9,
    );
  }
}

const CIMA = new THREE.Vector3(0, 1, 0);

/* ------------------------------------------------------------- impostores */

/** Quadro de cada feitio do atlas do bosque: o pinheiro de altura 1 ocupa y de -0,03 a 1,07 e x de -MEIA a MEIA. */
const IMP_MEIA = 0.275;
const IMP_Y0 = -0.03;
const IMP_Y1 = 1.07;
const IMP_FEITIOS = 4;

export interface AtlasBosque {
  cor: THREE.Texture;
  normal: THREE.Texture;
  dispose(): void;
}

function materialAssar(modo: 0 | 1, tinta: THREE.Color, alfa: THREE.Texture | null): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    defines: alfa ? { TEM_ALFA: 1 } : {},
    uniforms: { uModo: { value: modo }, uTinta: { value: tinta }, uAlfa: { value: alfa } },
    vertexShader: /* glsl */ `
      attribute vec4 aCor;
      varying vec3 vNor;
      varying vec3 vVista;
      varying vec2 vUv;
      varying vec3 vCor;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vVista = mv.xyz;
        vNor = normalMatrix * normal;
        vUv = uv;
        vCor = aCor.rgb;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uModo;
      uniform vec3 uTinta;
      uniform sampler2D uAlfa;
      varying vec3 vNor;
      varying vec3 vVista;
      varying vec2 vUv;
      varying vec3 vCor;
      void main() {
        vec3 alb = uTinta * vCor;
        #ifdef TEM_ALFA
          vec4 ta = texture2D(uAlfa, vUv);
          if (ta.a < 0.42) discard;
          alb *= ta.rgb;
        #endif
        vec3 ng = normalize(cross(dFdx(vVista), dFdy(vVista)));
        if (ng.z < 0.0) ng = -ng;
        vec3 n = normalize(vNor);
        if (dot(n, ng) < 0.0) n = -n;
        gl_FragColor = uModo < 0.5 ? vec4(alb, 1.0) : vec4(n * 0.5 + 0.5, 1.0);
      }`,
  });
}

/**
 * Fotografa quatro feitios de pinheiro carregado (de frente, ortográfico) para dois atlas: cor (com alfa) e normal.
 * Feito uma vez na construção; o renderizador volta ao estado anterior.
 */
export function assarAtlasBosque(renderer: THREE.WebGLRenderer, ramos: THREE.Texture, semente: number, celula = 512): AtlasBosque {
  const W = celula;
  const H = celula * 2;
  const criarAlvo = () => {
    const a = new THREE.WebGLRenderTarget(W * IMP_FEITIOS, H, { depthBuffer: true, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter });
    a.texture.anisotropy = 4;
    return a;
  };
  const alvoCor = criarAlvo();
  const alvoNor = criarAlvo();
  const cena = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-IMP_MEIA * 10, IMP_MEIA * 10, IMP_Y1 * 10, IMP_Y0 * 10, 1, 100);
  cam.position.set(0, 0, 50);
  cam.lookAt(0, 0, 0);
  cam.updateMatrixWorld(true);
  const tintaAg = new THREE.Color(0.05, 0.1, 0.095);
  const tintaNeve = new THREE.Color(0.8, 0.84, 0.92);
  const tintaCasca = new THREE.Color(0.08, 0.06, 0.05);
  const mats = [0, 1].map((modo) => ({
    ag: materialAssar(modo as 0 | 1, tintaAg, ramos),
    neve: materialAssar(modo as 0 | 1, tintaNeve, null),
    casca: materialAssar(modo as 0 | 1, tintaCasca, null),
  }));
  const feitios: Array<{ ag: THREE.Mesh; neve: THREE.Mesh; casca: THREE.Mesh }> = [];
  for (let f = 0; f < IMP_FEITIOS; f++) {
    const m = { folhagem: new Malha(), neve: new Malha(), casca: new Malha() };
    construirPinheiro(m, new THREE.Matrix4().makeRotationY(f * 1.3), 10, semente * 31 + f * 7, {
      esbelto: [0.23, 0.2, 0.25, 0.18][f],
      carga: [0.8, 0.6, 0.9, 0.5][f],
      densidade: 2.3,
    });
    feitios.push({ ag: new THREE.Mesh(m.folhagem.geometria()), neve: new THREE.Mesh(m.neve.geometria()), casca: new THREE.Mesh(m.casca.geometria()) });
  }
  const anterior = renderer.getRenderTarget();
  const corAnterior = new THREE.Color();
  renderer.getClearColor(corAnterior);
  const alfaAnterior = renderer.getClearAlpha();
  renderer.setClearColor(0x000000, 0);
  [alvoCor, alvoNor].forEach((alvo, modo) => {
    renderer.setRenderTarget(alvo);
    alvo.scissorTest = false;
    renderer.clear(true, true, true);
    feitios.forEach((ft, f) => {
      ft.ag.material = mats[modo].ag;
      ft.neve.material = mats[modo].neve;
      ft.casca.material = mats[modo].casca;
      cena.add(ft.ag, ft.neve, ft.casca);
      alvo.viewport.set(f * W, 0, W, H);
      alvo.scissor.set(f * W, 0, W, H);
      alvo.scissorTest = true;
      renderer.setRenderTarget(alvo);
      renderer.render(cena, cam);
      cena.remove(ft.ag, ft.neve, ft.casca);
    });
    alvo.scissorTest = false;
    alvo.viewport.set(0, 0, W * IMP_FEITIOS, H);
    alvo.scissor.set(0, 0, W * IMP_FEITIOS, H);
  });
  renderer.setRenderTarget(anterior);
  renderer.setClearColor(corAnterior, alfaAnterior);
  for (const ft of feitios) {
    ft.ag.geometry.dispose();
    ft.neve.geometry.dispose();
    ft.casca.geometry.dispose();
  }
  for (const m of mats) for (const x of Object.values(m)) x.dispose();
  return {
    cor: alvoCor.texture,
    normal: alvoNor.texture,
    dispose() {
      alvoCor.dispose();
      alvoNor.dispose();
    },
  };
}

const GLSL_CARTAO_VERT = /* glsl */ `
  attribute float aFeitio;
  varying vec2 vUv;
  varying vec3 vPos;
  varying vec3 vCam;
  varying vec3 vDireita;
  varying vec3 vFrente;
  varying float vVar;
  void main() {
    vec3 c = instanceMatrix[3].xyz;
    float sx = length(instanceMatrix[0].xyz);
    float sy = length(instanceMatrix[1].xyz);
    vCam = (inverse(modelMatrix) * vec4(cameraPosition, 1.0)).xyz;
    vec2 f = vCam.xz - c.xz;
    f = length(f) > 1e-4 ? normalize(f) : vec2(0.0, 1.0);
    vec3 direita = vec3(f.y, 0.0, -f.x);
    vec3 p = c + direita * position.x * sx + vec3(0.0, position.y * sy, 0.0);
    vPos = p;
    vDireita = direita;
    vFrente = vec3(f.x, 0.0, f.y);
    vUv = vec2((aFeitio + uv.x) / ${IMP_FEITIOS.toFixed(1)}, uv.y);
    vVar = fract(sin(dot(c.xz, vec2(12.9898, 78.233))) * 43758.5453);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }`;

/**
 * Bosque de impostores: um InstancedMesh de cartões (altura 1, base em y = 0) que giram em torno do eixo vertical
 * para a câmera; a matriz de cada instância dá posição e escala (x = largura, y = altura). `aFeitio` escolhe a árvore.
 */
export function criarBosque(U: UniformesLuar, atlas: AtlasBosque, n: number): THREE.InstancedMesh {
  const geo = new THREE.PlaneGeometry(IMP_MEIA * 2, IMP_Y1 - IMP_Y0);
  geo.translate(0, (IMP_Y1 + IMP_Y0) / 2, 0);
  geo.setAttribute('aFeitio', new THREE.InstancedBufferAttribute(new Float32Array(n), 1));
  const mat = new THREE.ShaderMaterial({
    name: 'bosque',
    side: THREE.DoubleSide,
    uniforms: { ...U, uCor: { value: atlas.cor }, uNor: { value: atlas.normal } },
    vertexShader: GLSL_CARTAO_VERT,
    fragmentShader: /* glsl */ `
      uniform sampler2D uCor;
      uniform sampler2D uNor;
      varying vec2 vUv;
      varying vec3 vPos;
      varying vec3 vCam;
      varying vec3 vDireita;
      varying vec3 vFrente;
      varying float vVar;
      ${GLSL_RUIDO}
      ${GLSL_LUAR}
      void main() {
        vec4 sc = texture2D(uCor, vUv);
        if (sc.a < 0.45) discard;
        vec4 sn = texture2D(uNor, vUv);
        // o atlas foi limpo com preto transparente: a borda filtrada vem pré-multiplicada
        vec3 alb = sc.rgb / max(sc.a, 1e-3);
        vec3 nl = sn.rgb / max(sn.a, 1e-3) * 2.0 - 1.0;
        vec3 N = normalize(vDireita * nl.x + vec3(0.0, nl.y, 0.0) + vFrente * nl.z);
        alb *= 0.85 + 0.3 * vVar;
        float neve = smoothstep(0.3, 0.6, alb.b);
        vec3 L = normalize(uLuaDir);
        float env = mix(0.2, 0.42, neve);
        float dif = clamp((dot(N, L) + env) / (1.0 + env), 0.0, 1.0);
        float sombra = sombraLua(vPos + N * 0.05, N);
        vec3 luz = uLuaCor * dif * sombra;
        luz += uEnchCor * clamp(dot(N, normalize(uEnchDir)) * 0.6 + 0.4, 0.0, 1.0);
        luz += luzCeu(N);
        vec3 cor = alb * luz;
        cor = aplicarNevoa(cor, vPos);
        gl_FragColor = vec4(cor * uGanho, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const malha = new THREE.InstancedMesh(geo, mat, n);
  malha.name = 'bosque';
  malha.frustumCulled = false;
  // a profundidade para as sombras assadas usa o mesmo giro e o mesmo recorte
  malha.userData.materialSombra = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { uCor: { value: atlas.cor } },
    vertexShader: GLSL_CARTAO_VERT,
    fragmentShader: /* glsl */ `
      uniform sampler2D uCor;
      varying vec2 vUv;
      void main() {
        if (texture2D(uCor, vUv).a < 0.45) discard;
        gl_FragColor = vec4(1.0);
      }`,
  });
  return malha;
}
