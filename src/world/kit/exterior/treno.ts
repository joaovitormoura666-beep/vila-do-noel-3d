/**
 * SLEIGH_PASS: um trenó puxado por renas cruza o céu em arco, passando diante da lua, com um rastro fino de
 * poeira dourada que se desfaz. Silhueta original, recortada por código (contornos em curvas suaves): trenó de
 * proa alta enrolada, saco de presentes, três parelhas de renas em galope. O galope é animado no shader
 * (cada perna gira em volta do ombro ou do quadril, e dobra no joelho), então tudo é uma chamada de desenho.
 */
import * as THREE from 'three';
import { CENTRO_CEU, direcaoCeu } from './ceu';
import type { UniformesLuar } from './luar';
import { criarRng } from './util';

type P2 = [number, number];

class Recorte {
  readonly pos: number[] = [];
  readonly pivos: number[] = [];
  readonly anim: number[] = [];
  readonly idx: number[] = [];
  // estado corrente: deslocamento, escala, profundidade e animação dos próximos vértices
  ox = 0;
  oy = 0;
  oz = 0;
  esc = 1;
  pivo1: P2 = [0, 0];
  pivo2: P2 = [0, 0];
  an: [number, number, number, number] = [0, 0, 0, 0];

  private vert(x: number, y: number): number {
    this.pos.push(this.ox + x * this.esc, this.oy + y * this.esc, this.oz);
    this.pivos.push(this.ox + this.pivo1[0] * this.esc, this.oy + this.pivo1[1] * this.esc, this.ox + this.pivo2[0] * this.esc, this.oy + this.pivo2[1] * this.esc);
    this.anim.push(...this.an);
    return this.pos.length / 3 - 1;
  }

  /** Contorno fechado suave passando pelos pontos (Catmull-Rom), preenchido. */
  forma(pontos: P2[], amostras = 6) {
    const curva = new THREE.CatmullRomCurve3(
      pontos.map(([x, y]) => new THREE.Vector3(x, y, 0)),
      true,
      'catmullrom',
      0.5,
    );
    const pts = curva.getPoints(pontos.length * amostras).slice(0, -1);
    const contorno = pts.map((p) => new THREE.Vector2(p.x, p.y));
    const tris = THREE.ShapeUtils.triangulateShape(contorno, []);
    const base = contorno.map((p) => this.vert(p.x, p.y));
    for (const t of tris) this.idx.push(base[t[0]], base[t[1]], base[t[2]]);
  }

  /** Fita ao longo de pontos (suavizada), com largura que varia do começo ao fim. */
  fita(pontos: P2[], larg0: number, larg1: number, amostras = 5) {
    const curva = new THREE.CatmullRomCurve3(
      pontos.map(([x, y]) => new THREE.Vector3(x, y, 0)),
      false,
      'catmullrom',
      0.5,
    );
    const n = Math.max(2, (pontos.length - 1) * amostras);
    const pts = pontos.length === 2 ? [curva.getPoint(0), curva.getPoint(1)] : curva.getPoints(n);
    const ids: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)];
      const b = pts[Math.min(pts.length - 1, i + 1)];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const l = Math.hypot(dx, dy) || 1;
      const w = (larg0 + (larg1 - larg0) * (i / (pts.length - 1))) / 2;
      ids.push(this.vert(pts[i].x - (dy / l) * w, pts[i].y + (dx / l) * w), this.vert(pts[i].x + (dy / l) * w, pts[i].y - (dx / l) * w));
    }
    for (let i = 0; i < pts.length - 1; i++) {
      const a = ids[i * 2];
      this.idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }

  geometria(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('aPivos', new THREE.Float32BufferAttribute(this.pivos, 4));
    g.setAttribute('aAnim', new THREE.Float32BufferAttribute(this.anim, 4));
    g.setIndex(this.idx);
    return g;
  }
}

/** Uma rena de perfil, olhando para +x, com os cascos perto de y = 0 e a cernelha a 1,45. */
function rena(r: Recorte, fase: number) {
  const balanco = 0.05;
  r.an = [fase, 0, 0, balanco];
  // corpo, pescoço e cabeça em um contorno só
  r.forma([
    [-0.8, 1.33],
    [-0.93, 1.3],
    [-1.02, 1.4],
    [-0.98, 1.22],
    [-0.9, 1.02],
    [-0.66, 0.8],
    [-0.1, 0.74],
    [0.42, 0.75],
    [0.68, 0.93],
    [0.8, 1.2],
    [0.94, 1.58],
    [1.1, 1.76],
    [1.34, 1.79],
    [1.43, 1.87],
    [1.33, 1.96],
    [1.13, 2.07],
    [0.99, 2.07],
    [0.74, 1.76],
    [0.45, 1.47],
    [-0.2, 1.37],
  ]);
  // orelha
  r.fita(
    [
      [1.0, 2.04],
      [0.86, 2.16],
    ],
    0.09,
    0.02,
  );
  // galhadas: viga principal para trás e para cima, com pontas; a segunda, um pouco deslocada, dá a de trás
  for (const [dx, dy, e] of [
    [0, 0, 1],
    [0.07, -0.02, 0.9],
  ] as const) {
    const g = (pts: P2[], l0: number, l1: number) =>
      r.fita(
        pts.map(([x, y]) => [1.04 + dx + (x - 1.04) * e, 2.06 + dy + (y - 2.06) * e] as P2),
        l0,
        l1,
      );
    g(
      [
        [1.04, 2.06],
        [0.97, 2.4],
        [0.76, 2.68],
        [0.46, 2.84],
        [0.22, 2.82],
      ],
      0.06,
      0.018,
    );
    g(
      [
        [0.96, 2.42],
        [1.12, 2.62],
        [1.16, 2.84],
      ],
      0.04,
      0.014,
    );
    g(
      [
        [0.74, 2.68],
        [0.8, 2.9],
        [0.74, 3.06],
      ],
      0.036,
      0.014,
    );
    g(
      [
        [1.05, 2.1],
        [1.26, 2.2],
        [1.36, 2.38],
      ],
      0.036,
      0.014,
    );
    g(
      [
        [0.47, 2.83],
        [0.5, 3.0],
      ],
      0.03,
      0.012,
    );
  }
  // pernas: coxa (gira no ombro ou quadril) e canela (dobra no joelho e acompanha a coxa)
  const perna = (quadril: P2, ang: number, defas: number, amp: number, dobra: number, dz: number) => {
    const joelho: P2 = [quadril[0] + Math.sin(ang) * 0.52, quadril[1] - Math.cos(ang) * 0.52];
    const casco: P2 = [joelho[0] + Math.sin(ang) * 0.56, joelho[1] - Math.cos(ang) * 0.56];
    const z0 = r.oz;
    r.oz = z0 + dz;
    r.pivo1 = quadril;
    r.pivo2 = joelho;
    r.an = [fase + defas, amp, 0, balanco];
    r.fita([[quadril[0] - Math.sin(ang) * 0.12, quadril[1] + Math.cos(ang) * 0.12], joelho], 0.2, 0.085);
    r.an = [fase + defas, amp, dobra, balanco];
    r.fita([joelho, casco], 0.08, 0.05);
    r.fita([casco, [casco[0] + Math.sin(ang) * 0.09, casco[1] - Math.cos(ang) * 0.09]], 0.075, 0.085);
    r.oz = z0;
    r.an = [fase, 0, 0, balanco];
  };
  // dianteiras estendidas para a frente, traseiras para trás; as do outro lado, um pouco defasadas
  perna([0.5, 0.98], 0.62, 0, 0.5, -1.15, 0);
  perna([0.4, 0.98], 0.3, 0.8, 0.5, -1.15, -0.02);
  perna([-0.64, 1.02], -0.6, Math.PI, 0.5, 1.05, 0);
  perna([-0.56, 1.02], -0.3, Math.PI + 0.8, 0.5, 1.05, -0.02);
}

/** O trenó de perfil, olhando para +x, com os patins em y = 0. */
function treno(r: Recorte, condutor: boolean) {
  r.an = [1.1, 0, 0, 0.03];
  // patim: longo, com a frente subindo e enrolando para dentro
  r.fita(
    [
      [-2.12, 0.34],
      [-1.95, 0.1],
      [-1.5, 0.01],
      [0.6, 0.0],
      [1.36, 0.08],
      [1.82, 0.4],
      [1.96, 0.86],
      [1.78, 1.2],
      [1.5, 1.23],
      [1.4, 1.04],
    ],
    0.075,
    0.04,
    7,
  );
  // apoios
  r.fita(
    [
      [-1.2, 0.02],
      [-1.1, 0.46],
    ],
    0.06,
    0.06,
  );
  r.fita(
    [
      [0.0, 0.0],
      [0.06, 0.42],
    ],
    0.06,
    0.06,
  );
  r.fita(
    [
      [1.02, 0.03],
      [0.92, 0.5],
    ],
    0.06,
    0.06,
  );
  // casco: fundo raso, proa alta em voluta, encosto alto atrás também enrolado
  r.forma([
    [-1.46, 0.44],
    [0.0, 0.38],
    [1.0, 0.46],
    [1.4, 0.8],
    [1.52, 1.26],
    [1.36, 1.52],
    [1.2, 1.4],
    [1.24, 1.2],
    [1.08, 0.94],
    [0.5, 0.82],
    [-0.3, 0.86],
    [-1.0, 1.14],
    [-1.36, 1.7],
    [-1.62, 1.9],
    [-1.8, 1.78],
    [-1.66, 1.46],
    [-1.6, 0.9],
  ]);
  // saco de presentes atrás do banco, com a boca amarrada
  r.forma([
    [-1.22, 0.98],
    [-0.3, 0.84],
    [-0.08, 1.3],
    [-0.3, 1.74],
    [-0.62, 1.94],
    [-0.74, 2.1],
    [-0.9, 2.1],
    [-0.92, 1.94],
    [-1.18, 1.8],
    [-1.36, 1.4],
  ]);
  if (condutor) {
    // figura sentada, pequena e genérica (só com a opção `condutor`)
    r.forma([
      [0.0, 0.84],
      [0.52, 0.86],
      [0.62, 1.2],
      [0.5, 1.52],
      [0.56, 1.72],
      [0.42, 1.9],
      [0.2, 2.02],
      [0.18, 1.82],
      [0.06, 1.5],
      [-0.08, 1.2],
    ]);
    r.fita(
      [
        [0.46, 1.4],
        [0.9, 1.3],
        [1.3, 1.34],
      ],
      0.11,
      0.06,
    );
  }
}

export interface Treno {
  grupo: THREE.Group;
  /** progress de 0 a 1 ao longo do arco; intensity de 0 a 1 (opacidade). */
  definir(progress: number, intensity: number): void;
  atualizar(t: number): void;
  dispose(): void;
}

export interface TrenoOpc {
  raio: number;
  /** Azimute (graus) de entrada e de saída, e elevação da base e do topo do arco. */
  azimute: [number, number];
  elevacao: [number, number];
  /** Comprimento do conjunto (trenó + renas) em metros, na distância do arco. */
  comprimento: number;
  condutor: boolean;
  semente: number;
}

export function criarTreno(U: UniformesLuar, uAlturaPx: THREE.IUniform<number>, o: TrenoOpc): Treno {
  const rec = new Recorte();
  const comprimentoLocal = 8.75 + 1.45 + 2.12;
  const centroLocal = (8.75 + 1.45 - 2.12) / 2;
  // tudo é construído já centrado (os pivôs das pernas acompanham o deslocamento)
  const X0 = -centroLocal;
  const Y0 = -1.0;
  rec.ox = X0;
  rec.oy = Y0;
  treno(rec, o.condutor);
  // três parelhas; a rena de trás de cada parelha fica um pouco adiante e mais ao fundo
  const parelhas = [3.75, 6.25, 8.75];
  parelhas.forEach((x, i) => {
    rec.ox = X0 + x + 0.28;
    rec.oy = Y0 + 0.2;
    rec.oz = -0.5;
    rec.esc = 0.95;
    rena(rec, i * 1.1 + 0.6);
    rec.ox = X0 + x;
    rec.oy = Y0 + 0.12;
    rec.oz = 0.4;
    rec.esc = 1;
    rena(rec, i * 1.1);
  });
  // tirantes do trenó até a parelha da frente
  rec.ox = X0;
  rec.oy = Y0;
  rec.oz = 0;
  rec.esc = 1;
  rec.an = [0, 0, 0, 0.02];
  rec.fita(
    [
      [1.45, 1.0],
      [3.2, 1.18],
      [5.0, 1.3],
      [7.5, 1.3],
      [9.2, 1.36],
    ],
    0.035,
    0.03,
    6,
  );
  const geo = rec.geometria();
  const uniformes = {
    uGalope: { value: 0 },
    uOpacidade: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({
    name: 'treno',
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
    uniforms: { ...uniformes, uNevoaCor: U.uNevoaCor, uLuaCor: U.uLuaCor, uGanho: U.uGanho, uAuroraCor: U.uAuroraCor, uNoite: U.uNoite },
    vertexShader: /* glsl */ `
      attribute vec4 aPivos;
      attribute vec4 aAnim;
      uniform float uGalope;
      varying float vAlt;
      varying float vFundo;
      vec2 gira(vec2 p, vec2 c, float a) {
        float s = sin(a);
        float co = cos(a);
        vec2 d = p - c;
        return c + vec2(d.x * co - d.y * s, d.x * s + d.y * co);
      }
      void main() {
        vec2 p = position.xy;
        float g = uGalope + aAnim.x;
        // a canela dobra quando a perna recolhe; a perna inteira vai e volta em volta do ombro ou do quadril
        p = gira(p, aPivos.zw, aAnim.z * (0.5 + 0.5 * sin(g + 1.9)));
        p = gira(p, aPivos.xy, aAnim.y * sin(g));
        p.y += aAnim.w * sin(g + 0.5);
        vAlt = position.y + 1.0;
        vFundo = step(position.z, -0.2);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, position.z, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uNevoaCor;
      uniform vec3 uLuaCor;
      uniform vec3 uAuroraCor;
      uniform float uNoite;
      uniform float uOpacidade;
      uniform float uGanho;
      varying float vAlt;
      varying float vFundo;
      void main() {
        // silhueta mais escura que o céu (lê-se contra o azul e contra a lua); o dorso pega um fio de luar;
        // a rena de trás de cada parelha, um tom mais clara (atmosfera)
        vec3 cor = vec3(0.004, 0.01, 0.032) + uLuaCor * 0.035 * smoothstep(0.4, 2.2, vAlt) + uAuroraCor * uNoite * 0.25;
        cor = mix(cor, uNevoaCor * 0.55 + cor, vFundo * 0.8);
        gl_FragColor = vec4(cor * uGanho, uOpacidade);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const malha = new THREE.Mesh(geo, mat);
  malha.name = 'treno';
  malha.frustumCulled = false;
  malha.renderOrder = -38;
  malha.matrixAutoUpdate = false;

  // rastro de poeira dourada: pontos que nascem atrás do trenó e se espalham, caem um pouco e somem
  const rng = criarRng(o.semente + 5);
  const N = 340;
  const dados = new Float32Array(N * 4);
  const posR = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    dados.set([Math.pow(rng(), 1.35), rng() * 6.283, rng() * 2 - 1, rng() * 2 - 1], i * 4);
  }
  const geoR = new THREE.BufferGeometry();
  geoR.setAttribute('position', new THREE.BufferAttribute(posR, 3));
  geoR.setAttribute('aDados', new THREE.BufferAttribute(dados, 4));
  const escala = o.comprimento / comprimentoLocal;
  const uniR = {
    uProgresso: { value: 0 },
    uOpacidade: uniformes.uOpacidade,
    uCaminho: { value: new THREE.Vector4(o.azimute[0], o.azimute[1], o.elevacao[0], o.elevacao[1]) },
    uRaio: { value: o.raio },
    uCentro: { value: CENTRO_CEU },
    uEscala: { value: escala },
    // o rastro nasce na traseira do trenó: distância do centro do conjunto até a ponta de trás do patim, em progresso
    uAtras: { value: ((((centroLocal + 2.3) / comprimentoLocal) * o.comprimento) / o.raio) * (180 / Math.PI) / Math.max(1, Math.abs(o.azimute[1] - o.azimute[0])) },
    uTempo: U.uTempo,
    uGanho: U.uGanho,
    uAlturaPx,
  };
  const matR = new THREE.ShaderMaterial({
    name: 'rastro',
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: uniR,
    vertexShader: /* glsl */ `
      attribute vec4 aDados;
      uniform float uProgresso;
      uniform float uOpacidade;
      uniform vec4 uCaminho;
      uniform float uRaio;
      uniform vec3 uCentro;
      uniform float uEscala;
      uniform float uAtras;
      uniform float uTempo;
      uniform float uAlturaPx;
      varying float vAlfa;
      vec3 caminho(float u) {
        float az = radians(mix(uCaminho.x, uCaminho.y, u));
        float el = radians(uCaminho.z + (uCaminho.w - uCaminho.z) * pow(max(sin(3.14159265 * clamp(u, 0.0, 1.0)), 0.0), 0.8));
        return uCentro + vec3(sin(az) * cos(el), sin(el), -cos(az) * cos(el)) * uRaio;
      }
      void main() {
        float idade = aDados.x;
        // o rastro nasce na traseira do trenó e ocupa um quinto do percurso
        float u = uProgresso - uAtras - idade * 0.17;
        vec3 p = caminho(u);
        vec3 frente = normalize(caminho(u + 0.01) - p);
        vec3 cima = normalize(vec3(0.0, 1.0, 0.0) - frente * frente.y);
        float abre = uEscala * (0.2 + 2.2 * idade);
        p += cima * (aDados.w * abre - uEscala * 2.2 * idade * idade + uEscala * 0.2);
        p += frente * aDados.z * uEscala * 0.8;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        float cint = 0.55 + 0.45 * sin(uTempo * (2.0 + 3.0 * fract(aDados.y * 3.7)) + aDados.y);
        float visivel = step(0.0, u) * step(u, 1.0);
        vAlfa = uOpacidade * pow(1.0 - idade, 1.7) * cint * visivel;
        float px = (2.0 + 4.5 * fract(aDados.y * 5.1) * pow(1.0 - idade, 1.5)) * uAlturaPx / 1920.0;
        gl_PointSize = max(1.5, px);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uGanho;
      varying float vAlfa;
      void main() {
        float r = length(gl_PointCoord - 0.5) * 2.0;
        float a = smoothstep(1.0, 0.1, r);
        gl_FragColor = vec4(vec3(1.0, 0.75, 0.35) * 2.0 * a * a * vAlfa * uGanho, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const rastro = new THREE.Points(geoR, matR);
  rastro.name = 'rastro';
  rastro.frustumCulled = false;
  rastro.renderOrder = -37;

  const grupo = new THREE.Group();
  grupo.name = 'treno';
  grupo.add(malha, rastro);
  grupo.visible = false;

  const caminho = (u: number, out: THREE.Vector3) => {
    const uc = Math.min(1, Math.max(0, u));
    const az = o.azimute[0] + (o.azimute[1] - o.azimute[0]) * u;
    const el = o.elevacao[0] + (o.elevacao[1] - o.elevacao[0]) * Math.pow(Math.max(Math.sin(Math.PI * uc), 0), 0.8);
    return direcaoCeu(az, el, out).multiplyScalar(o.raio).add(CENTRO_CEU);
  };
  const p = new THREE.Vector3();
  const q = new THREE.Vector3();
  const ex = new THREE.Vector3();
  const ey = new THREE.Vector3();
  const ez = new THREE.Vector3();
  return {
    grupo,
    definir(progress, intensity) {
      const visivel = intensity > 0.002;
      grupo.visible = visivel;
      if (!visivel) return;
      uniformes.uOpacidade.value = Math.min(1, intensity);
      uniR.uProgresso.value = progress;
      caminho(progress, p);
      caminho(progress + 0.004, q);
      ex.subVectors(q, p).normalize();
      ey.set(0, 1, 0).addScaledVector(ex, -ex.y).normalize();
      ez.crossVectors(ex, ey);
      malha.matrix.makeBasis(ex, ey, ez).scale(q.set(escala, escala, escala)).setPosition(p);
      malha.matrixWorldNeedsUpdate = true;
    },
    atualizar(t) {
      uniformes.uGalope.value = t * 7.0;
    },
    dispose() {
      geo.dispose();
      mat.dispose();
      geoR.dispose();
      matR.dispose();
    },
  };
}
