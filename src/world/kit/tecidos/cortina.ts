/**
 * Cortina de veludo pesado, com pregas de verdade (geometria ondulada, mais marcadas em cima e
 * abrindo embaixo), presa de lado por uma abraçadeira de cordão torcido com borla, bainha pesada
 * tocando o piso, varão de latão com argolas e ponteiras. O veludo usa o relevo e a rugosidade
 * reais de velour_velvet (Poly Haven) e o brilho rasante (sheen) do MeshPhysicalMaterial.
 *
 * Convenções: a peça nasce com o piso em y = 0 e o eixo do varão em z = 0, y = altura. Para
 * lado = 'esquerda', a borda presa (a de fora, junto da parede) fica em x = 0 e o pano avança para
 * +x; para lado = 'direita', é o espelho (o pano avança para -x). A frente é +Z.
 */
import * as THREE from 'three';
import type { Level } from '../../contracts';
import { loadTexture } from '../../../engine/assets';
import type { KitContext, Peca } from '../tipos';
import { materialLatao } from '../janela/materiais';
import { acaso2, criarSorteio, entre, fbm2, juntar, limitar, misturar, pintar, suave } from '../janela/util';

export interface CortinaOpcoes {
  /** Largura que a cortina cobre quando fechada, em metros. */
  largura: number;
  /** Altura do eixo do varão ao piso. */
  altura: number;
  /** 0 = fechada (cobre a largura toda); 1 = recolhida e presa pela abraçadeira. Padrão 0,8. */
  abertura?: number;
  /** Lado para onde a cortina é recolhida. Padrão 'esquerda'. */
  lado?: 'esquerda' | 'direita';
  /** Cor do veludo. Padrão: vermelho profundo da paleta. */
  cor?: THREE.ColorRepresentation;
  semente?: number;
  /** Inclui o próprio varão com ponteiras e suportes. Padrão true (a janela usa um varão só para as duas). */
  varao?: boolean;
  /** Distância do eixo do varão à parede (para os suportes e o gancho da abraçadeira). Padrão 0,09. */
  distanciaParede?: number;
  /** Altura onde a barra da cortina assenta (0 = no piso; use a altura do assento para cortinas curtas). Padrão 0. */
  barra?: number;
  /** Quanto pano há por metro coberto (2 = o dobro). Padrão 1,8. */
  franzido?: number;
}

export const VERMELHO_VELUDO = '#5a0f19';
const LADRILHO_VELUDO = 0.12; // ladrilho de velour_velvet um pouco menor que o real: a trama aparece de perto

let veludoMapas: Promise<{ normal: THREE.Texture; arm: THREE.Texture; pelo: THREE.Texture }> | null = null;
function mapasVeludo() {
  veludoMapas ??= (async () => {
    const [normal, arm] = await Promise.all([loadTexture('assets/texturas/velour_velvet/nor.jpg'), loadTexture('assets/texturas/velour_velvet/arm.jpg')]);
    return { normal, arm, pelo: texturaPelo() };
  })();
  return veludoMapas;
}

/**
 * Pelo escovado do veludo: manchas compridas na vertical (10 a 30 cm), onde o pelo deitou para um lado
 * ou para o outro. Cobre 1,2 m de pano (10 ladrilhos da trama). Canal R: quanto o pelo "acende".
 */
function texturaPelo(): THREE.DataTexture {
  const n = 256;
  const dados = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const u = x / n;
      const v = y / n;
      // ruído periódico (o ladrilho repete sem emenda): amostra em um toro
      const a = u * Math.PI * 2;
      const b = v * Math.PI * 2;
      const px = Math.cos(a) * 1.6 + 7;
      const py = Math.sin(a) * 1.6 + 3;
      const pz = Math.cos(b) * 0.35;
      const pw = Math.sin(b) * 0.35;
      const f = 0.65 * fbm2(px * 2 + pz, py * 2 + pw, 3, 41) + 0.35 * fbm2(px * 6 + pz * 2, py * 6 + pw * 2, 2, 43);
      const val = Math.round(255 * limitar(0.5 + 0.9 * f, 0, 1));
      const i = (y * n + x) * 4;
      dados[i] = dados[i + 1] = dados[i + 2] = val;
      dados[i + 3] = 255;
    }
  }
  const t = new THREE.DataTexture(dados, n, n);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

/**
 * Material de veludo na cor pedida (as texturas são compartilhadas). `brilhoRasante` é a força do sheen
 * (1 nas cortinas; menos em tampos vistos de raspão). O veludo é escuro de frente e acende na borda
 * rasante: o difuso cai onde o pano encara a câmera e o sheen carmim aparece nas curvas. O avesso
 * (forro) é creme escuro, sem pelo.
 */
export async function materialVeludo(cor: THREE.ColorRepresentation = VERMELHO_VELUDO, brilhoRasante = 1): Promise<THREE.MeshPhysicalMaterial> {
  const { normal, arm, pelo } = await mapasVeludo();
  const base = new THREE.Color(cor);
  // o pelo deitado devolve a própria cor, mais clara e quente
  const hsl = { h: 0, s: 0, l: 0 };
  base.getHSL(hsl);
  const brilho = new THREE.Color().setHSL(hsl.h, Math.min(1, hsl.s * 0.75), Math.min(0.42, hsl.l * 1.4 + 0.1));
  const mat = new THREE.MeshPhysicalMaterial({
    color: base,
    roughness: 1,
    roughnessMap: arm,
    metalness: 0,
    normalMap: normal,
    sheen: brilhoRasante,
    sheenColor: brilho,
    sheenRoughness: 0.5,
    side: THREE.DoubleSide,
    vertexColors: true,
    envMapIntensity: 0.45,
  });
  mat.normalScale.set(1.3, 1.3);
  mat.name = 'veludo';
  const forro = new THREE.Color('#6b5a46');
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.mapaPelo = { value: pelo };
    sh.uniforms.corForro = { value: forro };
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
        uniform sampler2D mapaPelo;
        uniform vec3 corForro;`,
      )
      .replace(
        '#include <color_fragment>',
        /* glsl */ `#include <color_fragment>
        float peloVeludo = texture2D( mapaPelo, vNormalMapUv * 0.1 ).r;
        if ( ! gl_FrontFacing ) diffuseColor.rgb = corForro * vColor.rgb; // forro do avesso`,
      )
      .replace(
        '#include <lights_physical_fragment>',
        /* glsl */ `#include <lights_physical_fragment>
        material.sheenColor *= gl_FrontFacing ? mix( 0.5, 1.35, peloVeludo ) : 0.12;
        material.roughness = clamp( material.roughness * mix( 1.08, 0.86, peloVeludo ), 0.0525, 1.0 );`,
      )
      .replace(
        '#include <lights_fragment_end>',
        /* glsl */ `#include <lights_fragment_end>
        if ( gl_FrontFacing ) {
          // veludo: de frente o pelo engole a luz; o brilho vem de raspão (sheen)
          float nvVeludo = saturate( dot( geometryNormal, geometryViewDir ) );
          float frente = nvVeludo * nvVeludo;
          reflectedLight.directDiffuse *= mix( 1.0, 0.7, frente ) * mix( 0.88, 1.1, peloVeludo );
          reflectedLight.indirectDiffuse *= mix( 1.0, 0.65, frente );
        }`,
      );
  };
  mat.customProgramCacheKey = () => 'veludo-v2';
  return mat;
}

let cordao: THREE.MeshStandardMaterial | null = null;
/** Fio dourado fosco do cordão e da borla. */
export function materialCordao(): THREE.MeshStandardMaterial {
  cordao ??= new THREE.MeshStandardMaterial({ color: '#a58446', map: texturaCordao(), roughness: 0.7, metalness: 0.12, vertexColors: true, name: 'cordao' });
  return cordao;
}

/** Peça torneada deitada ao longo de X (ponteira do varão). Perfil em pares (distância ao longo do eixo, raio). */
function torneadoX(perfil: Array<[number, number]>, lados = 14): THREE.BufferGeometry {
  const g = new THREE.LatheGeometry(
    perfil.map(([d, r]) => new THREE.Vector2(Math.max(0.0001, r), d)),
    lados,
  );
  g.rotateZ(-Math.PI / 2); // o eixo Y do torno vira +X
  return g;
}

export interface VaraoOpcoes {
  /** Extremos do varão em x (sem contar as ponteiras). */
  de: number;
  ate: number;
  /** Altura do eixo. */
  altura: number;
  /** Posições em x dos suportes de parede. */
  suportes?: number[];
  distanciaParede?: number;
  raio?: number;
}

/** Geometria de um varão de latão com ponteiras torneadas e suportes de parede (eixo em z = 0). */
export function geometriaVarao(o: VaraoOpcoes): THREE.BufferGeometry {
  const raio = o.raio ?? 0.022;
  const dist = o.distanciaParede ?? 0.09;
  const geos: THREE.BufferGeometry[] = [];
  const comp = o.ate - o.de;
  const tubo = new THREE.CylinderGeometry(raio, raio, comp, 24, 1, true);
  tubo.rotateZ(Math.PI / 2);
  tubo.translate((o.de + o.ate) / 2, o.altura, 0);
  geos.push(tubo);
  // ponteira torneada: colar, gola, bulbo e botão (perfil em múltiplos do raio do varão)
  const e = raio / 0.014;
  const ponteira = (): THREE.BufferGeometry =>
    torneadoX(
      (
        [
          [0, 1],
          [0.002, 1.18],
          [0.006, 1.22],
          [0.01, 1.12],
          [0.016, 0.88],
          [0.022, 0.92],
          [0.028, 1.3],
          [0.038, 1.78],
          [0.05, 2.05],
          [0.062, 2.12],
          [0.074, 1.9],
          [0.084, 1.3],
          [0.09, 0.72],
          [0.095, 0.62],
          [0.099, 0.74],
          [0.104, 0.66],
          [0.108, 0.36],
          [0.11, 0],
        ] as Array<[number, number]>
      ).map(([d, rr]) => [d * e * 0.8, rr * raio] as [number, number]),
      28,
    );
  const pd = ponteira();
  pd.translate(o.ate, o.altura, 0);
  const pe = ponteira();
  pe.rotateY(Math.PI);
  pe.translate(o.de, o.altura, 0);
  geos.push(pd, pe);
  for (const x of o.suportes ?? []) {
    // roseta na parede, braço horizontal por baixo do varão e berço em U abraçando o varão
    const yBraco = o.altura - raio - 0.009;
    const roseta = new THREE.LatheGeometry(
      [
        [0.0001, 0.014],
        [0.016, 0.014],
        [0.024, 0.0105],
        [0.029, 0.006],
        [0.031, 0.002],
        [0.031, 0],
      ].map(([rr, y]) => new THREE.Vector2(rr, y)),
      20,
    );
    roseta.rotateX(Math.PI / 2);
    roseta.translate(x, yBraco, -dist);
    const braco = new THREE.CylinderGeometry(0.0075, 0.0095, dist, 12, 1, true);
    braco.rotateX(Math.PI / 2);
    braco.translate(x, yBraco, -dist / 2);
    // berço: meio anel por baixo do varão, com a haste do braço chegando nele
    const berco = new THREE.TorusGeometry(raio + 0.005, 0.0045, 8, 18, Math.PI);
    berco.rotateZ(Math.PI); // a metade de baixo
    berco.rotateY(Math.PI / 2); // no plano perpendicular ao varão
    berco.translate(x, o.altura, 0);
    const pe = new THREE.CylinderGeometry(0.006, 0.0075, 0.012, 10, 1);
    pe.translate(x, o.altura - raio - 0.009, 0);
    geos.push(roseta, braco, berco, pe);
  }
  return juntar(geos);
}

let texCordao: THREE.CanvasTexture | null = null;
/** Textura do cordão torcido: três pernas em diagonal, com o fundo entre elas mais escuro. Em (0, 0) é clara. */
function texturaCordao(): THREE.CanvasTexture {
  if (texCordao) return texCordao;
  const n = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = n;
  const c = canvas.getContext('2d')!;
  const img = c.createImageData(n, n);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const u = x / n;
      const v = 1 - y / n;
      const perna = Math.abs(Math.cos(Math.PI * (3 * u + v)));
      const fio = 0.9 + 0.1 * Math.cos(Math.PI * 2 * (9 * u - 4 * v)); // fiozinhos dentro de cada perna
      const b = Math.round(255 * Math.min(1, (0.3 + 0.7 * Math.pow(perna, 0.6)) * fio));
      const i = (y * n + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = b;
      img.data[i + 3] = 255;
    }
  }
  c.putImageData(img, 0, 0);
  texCordao = new THREE.CanvasTexture(canvas);
  texCordao.colorSpace = THREE.SRGBColorSpace;
  texCordao.wrapS = texCordao.wrapT = THREE.RepeatWrapping;
  texCordao.anisotropy = 4;
  return texCordao;
}

/**
 * Cordão torcido ao longo de uma curva: tubo liso com a torção das pernas na textura (em diagonal) e um
 * leve engrossar e afinar ao longo do comprimento. Barato e sem serrilhado.
 */
function cordaoTorcido(pontos: THREE.Vector3[], fechado: boolean, raio: number, passo = 0.03): THREE.BufferGeometry {
  const centro = new THREE.CatmullRomCurve3(pontos, fechado, 'centripetal');
  const comprimento = centro.getLength();
  const aneis = Math.max(16, Math.round(comprimento / 0.009));
  const lados = 8;
  const voltas = Math.max(1, Math.round(comprimento / passo));
  const pos: number[] = [];
  const uvs: number[] = [];
  const idx: number[] = [];
  const cima = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i <= aneis; i++) {
    const t = i / aneis;
    const tt = fechado ? t % 1 : t;
    const p = centro.getPointAt(tt);
    const tan = centro.getTangentAt(tt);
    const n = new THREE.Vector3().crossVectors(tan, cima);
    if (n.lengthSq() < 1e-6) n.set(1, 0, 0);
    n.normalize();
    const b = new THREE.Vector3().crossVectors(n, tan).normalize();
    for (let k = 0; k <= lados; k++) {
      const a = (k / lados) * Math.PI * 2;
      const rr = raio * (1 + 0.05 * Math.cos(3 * a + t * voltas * Math.PI * 2));
      pos.push(p.x + (n.x * Math.cos(a) + b.x * Math.sin(a)) * rr, p.y + (n.y * Math.cos(a) + b.y * Math.sin(a)) * rr, p.z + (n.z * Math.cos(a) + b.z * Math.sin(a)) * rr);
      uvs.push(k / lados, t * voltas);
    }
  }
  for (let i = 0; i < aneis; i++) {
    for (let k = 0; k < lados; k++) {
      const a = i * (lados + 1) + k;
      const c = a + lados + 1;
      idx.push(a, c, a + 1, a + 1, c, c + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return pintar(g, '#ffffff');
}

/** Borla: cabeça torneada com gola enrolada e saia de fios (gomos irregulares). Pendurada a partir da origem, para baixo. */
function borla(semente: number): THREE.BufferGeometry[] {
  const geos: THREE.BufferGeometry[] = [];
  const fio = new THREE.CylinderGeometry(0.0028, 0.0028, 0.045, 6, 1);
  fio.translate(0, -0.0225, 0);
  geos.push(pintar(fio, '#ffffff', 0.8));
  const y0 = -0.042;
  const cabeca = new THREE.LatheGeometry(
    (
      [
        [0.0001, 0.003],
        [0.004, 0.002],
        [0.0065, -0.001],
        [0.0055, -0.005],
        [0.009, -0.008],
        [0.0145, -0.014],
        [0.0172, -0.022],
        [0.0168, -0.03],
        [0.0135, -0.038],
        [0.0105, -0.042],
        [0.0128, -0.0435],
        [0.0128, -0.046],
        [0.0108, -0.0475],
        [0.0128, -0.049],
        [0.0128, -0.0515],
        [0.0108, -0.053],
        [0.0124, -0.0545],
        [0.0124, -0.057],
        [0.0104, -0.0585],
      ] as Array<[number, number]>
    )
      .reverse()
      .map(([r, y]) => new THREE.Vector2(r, y + y0)),
    16,
  );
  geos.push(pintar(cabeca, '#ffffff', 1));
  // saia de fios: mechas que abrem para baixo e terminam em alturas diferentes
  const gomos = 38;
  const linhas = 6;
  const pos: number[] = [];
  const cores: number[] = [];
  const idx: number[] = [];
  const yTopo = y0 - 0.058;
  for (let j = 0; j <= linhas; j++) {
    const t = j / linhas;
    for (let i = 0; i <= gomos * 2; i++) {
      const a = (i / (gomos * 2)) * Math.PI * 2;
      const crista = i % 2 === 0;
      const g = Math.floor(((i + 1) % (gomos * 2)) / 2);
      const comp = 0.1 * (0.9 + 0.12 * acaso2(g, semente, 3));
      const abre = 0.0105 + 0.012 * Math.pow(t, 0.75) * (0.8 + 0.4 * acaso2(g, semente, 5));
      const raio = abre * (crista ? 1 : misturar(0.9, 0.72, Math.min(1, t * 2.5)));
      const torce = 0.25 * t * (acaso2(g, semente, 7) - 0.5);
      pos.push(Math.cos(a + torce) * raio, yTopo - comp * t, Math.sin(a + torce) * raio);
      const c = (crista ? 1 : 0.42) * (0.8 + 0.2 * acaso2(g, semente, 9)) * (1 - 0.15 * t);
      cores.push(c, c, c);
    }
  }
  const col = gomos * 2 + 1;
  for (let j = 0; j < linhas; j++) {
    for (let i = 0; i < gomos * 2; i++) {
      const a = j * col + i;
      const b = a + 1;
      const c = a + col;
      const d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  }
  const saia = new THREE.BufferGeometry();
  saia.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  saia.setAttribute('color', new THREE.Float32BufferAttribute(cores, 3));
  saia.setIndex(idx);
  saia.computeVertexNormals();
  geos.push(saia);
  return geos;
}

/** Fileiras em v (0 no alto, 1 na barra), mais juntas no alto, na abraçadeira e na bainha. */
function fileiras(n: number, vLaco: number, forcaLaco: number, vBainha: number): number[] {
  const fino = 600;
  const acum: number[] = [0];
  for (let i = 0; i < fino; i++) {
    const v = (i + 0.5) / fino;
    const d = 1 + 2.2 * Math.exp(-Math.pow(v / 0.05, 2)) + 4.5 * forcaLaco * Math.exp(-Math.pow((v - vLaco) / 0.07, 2)) + 1.2 * Math.exp(-Math.pow((v - 1) / 0.05, 2));
    acum.push(acum[i] + d);
  }
  const out: number[] = [];
  let k = 0;
  for (let j = 0; j <= n; j++) {
    const alvo = (j / n) * acum[fino];
    while (k < fino - 1 && acum[k + 1] < alvo) k++;
    const f = (alvo - acum[k]) / (acum[k + 1] - acum[k]);
    out.push((k + limitar(f, 0, 1)) / fino);
  }
  out[0] = 0;
  out[n] = 1;
  // garante uma fileira exatamente na costura da bainha
  let perto = 1;
  for (let j = 1; j < n; j++) if (Math.abs(out[j] - vBainha) < Math.abs(out[perto] - vBainha)) perto = j;
  out[perto] = vBainha;
  return out;
}

export async function criarCortina(_ctx: KitContext, o: CortinaOpcoes): Promise<Peca> {
  const L = o.largura;
  const altura = o.altura;
  const a = limitar(o.abertura ?? 0.8, 0, 1);
  const sinal = (o.lado ?? 'esquerda') === 'esquerda' ? 1 : -1;
  const semente = o.semente ?? 3;
  const dist = o.distanciaParede ?? 0.09;
  const franzido = o.franzido ?? 1.8;
  const r = criarSorteio(semente * 977 + 13);

  const yBarra = o.barra ?? 0;
  const noPiso = yBarra < 0.001;
  const RAIO_VARAO = 0.022;
  const RAIO_ARGOLA = 0.038;
  const yTopo = altura - 0.07; // alto do cabeçote: logo abaixo das argolas
  const queda = yTopo - yBarra - (noPiso ? 0 : 0.01); // comprimento do pano pendurado (com banco, para 1 cm acima)
  const sobra = noPiso ? 0.045 : 0; // pano que sobra e deita no piso
  const yLaco = yBarra + (altura - yBarra) * 0.4;
  const vLaco = 1 - (yLaco - yBarra) / queda;
  const tau = suave(0.12, 0.55, a); // força da abraçadeira
  const Wf = L * franzido; // largura do pano esticado
  const N = Math.max(4, Math.round(Wf / 0.5)); // pregas: uma por grupo do cabeçote (prega francesa)
  const vBainha = 1 - 0.1 / queda;
  const vCabeca = 0.09 / queda; // costura do cabeçote

  // larguras ocupadas no alto, na abraçadeira e na barra
  const sTopo = L * misturar(1, 0.36, a);
  const wLaco = misturar(L, 0.2 + 0.02 * L, tau);
  const xcLaco = misturar(L / 2, 0.05 + wLaco / 2, tau);
  const x0Laco = xcLaco - wLaco / 2;
  const sBarra = Math.max(Math.min(L, 0.4), L * misturar(1, noPiso ? 0.3 : 0.55, a));
  const x0Barra = misturar(0, 0.015, tau);
  const A_MAX = 0.055;

  const nu = Math.max(60, Math.min(140, Math.round(N * 17)));
  const nv = 50;
  const vs = fileiras(nv, vLaco, tau, vBainha);
  // fileira na costura do cabeçote
  {
    let perto = 1;
    for (let j = 1; j < nv; j++) if (Math.abs(vs[j] - vCabeca) < Math.abs(vs[perto] - vCabeca)) perto = j;
    if (perto > 0 && vs[perto] !== vBainha) vs[perto] = vCabeca;
    vs.sort((p, q) => p - q);
  }
  const nPoca = noPiso ? 3 : 0;
  // fileiras: [avesso do cabeçote, borda de cima, ...pano..., ...poça no piso..., bainha virada]
  const linhasTotal = 2 + vs.length + nPoca + 1;
  const col = nu + 1;
  const pos = new Float32Array(col * linhasTotal * 3);
  const cor = new Float32Array(col * linhasTotal * 3);
  const uv = new Float32Array(col * linhasTotal * 2);
  const sal = Math.floor(r() * 500);
  const deriva = r() * 6.28;

  /** Largura ocupada e borda de fora em cada altura. */
  const faixa = (v: number): [number, number] => {
    v = Math.min(v, 1);
    if (v <= vLaco) {
      // barriga: o pano desce quase reto e só no fim recolhe para a abraçadeira, chegando nela na vertical
      const e = 1 - Math.pow(1 - Math.pow(v / vLaco, 2.2), 1.6);
      return [misturar(0, x0Laco, e), misturar(sTopo, wLaco, e)];
    }
    // abaixo da abraçadeira o feixe sai na vertical e abre em uns dois palmos
    const t = (v - vLaco) / (1 - vLaco);
    const e = 1 - Math.exp(-Math.pow(t / 0.2, 2));
    return [misturar(x0Laco, x0Barra, e), misturar(wLaco, sBarra, e)];
  };

  const fase = new Float32Array(col);
  /** Uma fileira do pano principal em v (0 no alto, 1 na barra; > 1 é a sobra deitada no piso). */
  const fileira = (v: number, linha: number) => {
    const vv = Math.min(v, 1);
    const [x0, S] = faixa(vv);
    const yNom = yBarra + (noPiso ? 0.012 : 0) + (queda - (noPiso ? 0.012 : 0)) * (1 - vv);
    const desce = yTopo - yNom; // metros abaixo do alto
    const h = suave(0.06, 0.3, desce); // 0 no cabeçote (prega francesa), 1 com a prega solta
    const perto = tau * Math.exp(-Math.pow((vv - vLaco) / 0.06, 2)); // junto da abraçadeira
    const razao = Wf / S;
    let A = (Math.sqrt(2 * Math.max(razao * razao - 1, 0)) * S) / (2 * Math.PI * N);
    A = limitar(A, 0.012, A_MAX) * misturar(1, 0.7, perto);
    A = Math.min(A, Math.max(0.008, (0.5 * S) / N));
    const hb = (1 - vv) * queda; // altura acima da barra
    // perto do piso o pano pesa e as pregas se abrem
    A *= 1 + 0.25 * suave(0.5, 0, hb);
    const solto = suave(0.03, 0.25, vv) * h; // quanto as larguras das pregas variam
    // fase: frequência local variando (pregas largas e estreitas, que derivam com a altura)
    let acum = 0;
    for (let i = 0; i <= nu; i++) {
      const u = i / nu;
      const f = 1 + 0.8 * solto * fbm2(u * N * 0.42 + deriva, vv * 1.7, 2, sal);
      if (i > 0) acum += f;
      fase[i] = acum;
    }
    const escala = (2 * Math.PI * N) / Math.max(1e-6, acum / nu) / nu;
    for (let i = 0; i <= nu; i++) {
      const u = i / nu;
      const phi = fase[i] * escala - Math.PI / 2 + 0.9 * solto * fbm2(vv * 1.3, 0.5, 2, sal + 3);
      const k = phi / (2 * Math.PI); // índice contínuo da prega
      // cada prega tem fundura própria; umas morrem no meio do caminho e duas se fundem
      const varia = 1 + 0.6 * fbm2(k * 0.9 + 2, vv * 2.4, 2, sal + 20);
      const morre = misturar(0.12, 1, suave(-0.42, 0.06, fbm2(k * 0.7 + 5, vv * 1.5, 2, sal + 30)));
      const m = misturar(1, Math.max(0.15, varia * morre), solto);
      // perfil da prega solta: seno com um harmônico que entorta a crista para um lado
      const solta = Math.sin(phi) + 0.16 * Math.sin(2 * phi + 1.3 * fbm2(k * 1.3, vv * 3, 1, sal + 40));
      // cabeçote: prega francesa (três dobras costuradas viram um gomo estreito) e pano liso entre elas
      let dw = ((phi - Math.PI / 2) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
      const gomo = Math.exp(-Math.pow(dw / 0.62, 2)) * 1.25 - 0.18;
      let z = A * m * misturar(gomo * 0.55, solta, h);
      // feixe preso: as pregas das pontas perdem fundo
      const rolico = Math.sqrt(Math.max(0.1, 1 - Math.pow(2 * u - 1, 2)));
      z *= misturar(1, rolico, perto);
      // o tecido entre os gomos se concentra neles (o x anda devagar sobre a prega)
      const comprime = 0.7 * (1 - h);
      let x = x0 + S * u - (S * comprime * Math.sin(dw)) / (2 * Math.PI * N) - ((0.03 * S) / N) * Math.sin(2 * phi) * h;
      let y = yNom;
      // ondulação larga do pano inteiro (barrigas de 30 a 60 cm): o brilho das pregas varia ao longo da queda
      const xm = u * Wf;
      const ym = vv * queda;
      z += h * (1 - perto) * (0.022 * fbm2(xm * 1.6 + 3, ym * 0.9, 2, sal + 70) + 0.008 * fbm2(xm * 4, ym * 2.2, 1, sal + 71));
      x += h * 0.012 * fbm2(xm * 1.1, ym * 0.7 + 5, 1, sal + 72);
      // perto do piso a barra pesa: uma dobra larga deitada, que empurra o pano para frente
      if (noPiso) z += 0.016 * Math.exp(-Math.pow((hb - 0.05) / 0.03, 2)) * (0.6 + 0.4 * fbm2(k * 0.8, 1.7, 1, sal + 50)) * (1 - 0.7 * tau * u);
      // bainha: pano dobrado, um nada mais grosso
      if (vv > vBainha) z += 0.003;
      // a sobra deita no piso, para a frente
      if (v > 1) {
        const t = (v - 1) / (sobra / queda);
        const th = t * Math.PI * 0.5;
        const quanto = sobra * (0.7 + 0.5 * fbm2(k * 0.9, 4.1, 1, sal + 60)) * (1 - 0.75 * tau * u);
        y = yBarra + 0.0035 + 0.0085 * Math.cos(th);
        z += quanto * Math.sin(th);
      }
      // borda da frente virada para trás (vira do pano, mostra o forro)
      if (u > 0.988) {
        const tb = (u - 0.988) / 0.012;
        x -= 0.007 * tb;
        z -= 0.012 * tb;
      }
      const idx = linha * col + i;
      pos.set([x * sinal, y, z], idx * 3);
      uv.set([(u * Wf) / LADRILHO_VELUDO, ((yTopo - y) + (v > 1 ? (v - 1) * queda : 0)) / LADRILHO_VELUDO], idx * 2);
      // sombra pintada bem de leve: a oclusão de verdade vem da luz
      let c = misturar(0.86, 1, suave(-1, 0.3, solta * h + gomo * (1 - h) * 0.5));
      c *= 1 - 0.18 * tau * Math.exp(-Math.pow((vv - vLaco) / 0.025, 2));
      if (Math.abs(vv - vCabeca) < 1e-6 || Math.abs(vv - vBainha) < 1e-6) c *= 0.84; // costuras
      cor.set([c, c * 0.98, c * 0.98], idx * 3);
    }
  };

  // pano principal e a sobra no piso
  for (let j = 0; j < vs.length; j++) fileira(vs[j], 2 + j);
  for (let j = 1; j <= nPoca; j++) fileira(1 + (j / nPoca) * (sobra / queda), 2 + vs.length + j - 1);
  // cabeçote: a borda de cima arredonda e o pano volta por trás uns 6 cm (entretela)
  // bainha: a borda de baixo vira para dentro
  const ult = 2 + vs.length + nPoca - 1;
  for (let i = 0; i <= nu; i++) {
    const p0 = 2 * col + i;
    const pl = ult * col + i;
    const x = pos[p0 * 3];
    const y = pos[p0 * 3 + 1];
    const z = pos[p0 * 3 + 2];
    pos.set([x, y + 0.004, z - 0.004], (col + i) * 3);
    pos.set([x, y - 0.06, Math.min(z, 0) - 0.009], i * 3);
    const xb = pos[pl * 3];
    const yb = pos[pl * 3 + 1];
    const zb = pos[pl * 3 + 2];
    pos.set(noPiso ? [xb, yb - 0.0025, zb - 0.007] : [xb, yb + 0.014, zb - 0.008], (ult + 1) * col * 3 + i * 3);
    for (const [de, para] of [
      [p0, col + i],
      [p0, i],
      [pl, (ult + 1) * col + i],
    ]) {
      uv.set([uv[de * 2], uv[de * 2 + 1] + 0.05], para * 2);
      cor.set([cor[de * 3] * 0.8, cor[de * 3 + 1] * 0.8, cor[de * 3 + 2] * 0.8], para * 3);
    }
  }
  const indices: number[] = [];
  for (let j = 0; j < linhasTotal - 1; j++) {
    for (let i = 0; i < nu; i++) {
      const p = j * col + i;
      const q = p + 1;
      const s = p + col;
      const t = s + 1;
      // frente (+Z) com o pano avançando para +x; no espelho a ordem inverte
      if (sinal > 0) indices.push(p, s, q, q, s, t);
      else indices.push(p, q, s, q, t, s);
    }
  }
  const pano = new THREE.BufferGeometry();
  pano.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  pano.setAttribute('color', new THREE.BufferAttribute(cor, 3));
  pano.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  pano.setIndex(indices);
  pano.computeVertexNormals();

  // medidas reais do feixe na abraçadeira (para o cordão abraçar o pano de verdade)
  let zLacoMax = 0.02;
  let zLacoMin = -0.02;
  {
    let melhor = 2;
    for (let j = 0; j < vs.length; j++) if (Math.abs(vs[j] - vLaco) < Math.abs(vs[melhor - 2] - vLaco)) melhor = j + 2;
    for (let i = 0; i <= nu; i++) {
      const z = pos[(melhor * col + i) * 3 + 2];
      zLacoMax = Math.max(zLacoMax, z);
      zLacoMin = Math.min(zLacoMin, z);
    }
  }

  const root = new THREE.Group();
  root.name = 'cortina';
  const veludo = await materialVeludo(o.cor ?? VERMELHO_VELUDO);
  const malhaPano: THREE.Mesh = new THREE.Mesh(pano, veludo);
  malhaPano.name = 'cortina-pano';
  malhaPano.castShadow = true;
  malhaPano.receiveShadow = true;
  root.add(malhaPano);

  // latão: argolas (uma por prega), gancho da abraçadeira e, se pedido, o varão
  const latoes: THREE.BufferGeometry[] = [];
  for (let kk = 0; kk < N; kk++) {
    const x = (sTopo * ((kk + 0.5) / N) + entre(r, -0.003, 0.003)) * sinal;
    // argola pendurada no varão (encosta por dentro no alto dele)
    const yArgola = altura + RAIO_VARAO - (RAIO_ARGOLA - 0.005);
    const g = new THREE.TorusGeometry(RAIO_ARGOLA, 0.005, 6, 20);
    g.rotateY(Math.PI / 2 + entre(r, -0.12, 0.12));
    g.rotateX(entre(r, -0.05, 0.05));
    g.translate(x, yArgola, 0);
    latoes.push(g);
    // ganchinho: olhal preso na argola e o pino entrando no gomo do cabeçote
    const yOlhal = yArgola - RAIO_ARGOLA - 0.004;
    const olhal = new THREE.TorusGeometry(0.0075, 0.0026, 5, 10);
    olhal.translate(x, yOlhal, 0.001);
    const pino = new THREE.CylinderGeometry(0.0022, 0.0022, yOlhal - 0.0075 - (yTopo - 0.035), 6, 1);
    pino.translate(x, (yOlhal - 0.0075 + yTopo - 0.035) / 2, 0.004);
    latoes.push(olhal, pino);
  }
  if (o.varao ?? true) {
    const pontas = [-0.16 * sinal, (L + 0.16) * sinal];
    latoes.push(geometriaVarao({ de: Math.min(...pontas), ate: Math.max(...pontas), altura, suportes: [-0.06 * sinal, (L + 0.06) * sinal], distanciaParede: dist }));
  }

  // abraçadeira: cordão torcido abraçando o feixe e voltando ao gancho da parede, com a borla caída na frente
  const cordoes: THREE.BufferGeometry[] = [];
  if (tau > 0.25) {
    const rx = wLaco / 2 + 0.006;
    const rzF = zLacoMax + 0.01;
    const rzT = -zLacoMin + 0.008;
    const gancho = new THREE.Vector3((xcLaco - wLaco * 0.42) * sinal, yLaco + 0.045, -dist + 0.012);
    const laco: THREE.Vector3[] = [];
    const M = 28;
    for (let i = 0; i < M; i++) {
      const th = (i / M) * Math.PI * 2;
      const p = new THREE.Vector3((xcLaco + rx * Math.cos(th)) * sinal, yLaco - 0.04 * Math.max(0, Math.sin(th)) - 0.012 * Math.cos(th), (Math.sin(th) > 0 ? rzF : rzT) * Math.sin(th));
      // a parte de trás é puxada para o gancho
      const puxa = Math.pow(Math.max(0, -Math.sin(th)), 1.5) * Math.max(0, 0.35 - 0.65 * Math.cos(th));
      p.lerp(gancho, limitar(puxa * 1.25, 0, 1));
      laco.push(p);
    }
    cordoes.push(cordaoTorcido(laco, true, 0.0082));
    // borla: pendurada do cordão, na frente, do lado de dentro
    const thB = 1.05;
    const pb = new THREE.Vector3((xcLaco + rx * Math.cos(thB)) * sinal, yLaco - 0.04 * Math.sin(thB) - 0.012 * Math.cos(thB) - 0.004, rzF * Math.sin(thB) + 0.012);
    for (const g of borla(semente)) {
      g.deleteAttribute('uv'); // sem uv a borla cai no ponto claro da textura do cordão
      g.scale(0.82, 0.82, 0.82);
      g.rotateZ(-0.05 * sinal);
      g.translate(pb.x, pb.y, pb.z);
      cordoes.push(g);
    }
    // nó que prende a borla ao cordão
    const no = new THREE.SphereGeometry(0.011, 8, 6);
    no.scale(1, 0.8, 1);
    no.translate(pb.x, pb.y + 0.002, pb.z - 0.004);
    no.deleteAttribute('uv');
    cordoes.push(pintar(no, '#d9d0c0'));
    // gancho de latão na parede
    const base = new THREE.CylinderGeometry(0.012, 0.014, 0.006, 10, 1);
    base.rotateX(Math.PI / 2);
    base.translate(gancho.x, gancho.y, -dist + 0.003);
    const haste = new THREE.TorusGeometry(0.012, 0.0032, 5, 10, Math.PI * 1.3);
    haste.rotateY(Math.PI / 2);
    haste.rotateX(-0.6);
    haste.translate(gancho.x, gancho.y + 0.004, -dist + 0.018);
    latoes.push(base, haste);
  }
  const lixo: Array<{ dispose(): void }> = [pano, veludo];
  const malhaLatao = new THREE.Mesh(juntar(latoes), materialLatao());
  malhaLatao.name = 'cortina-latao';
  malhaLatao.castShadow = true;
  root.add(malhaLatao);
  lixo.push(malhaLatao.geometry);
  let malhaCordao: THREE.Mesh | null = null;
  if (cordoes.length) {
    malhaCordao = new THREE.Mesh(juntar(cordoes, true), materialCordao());
    malhaCordao.name = 'cortina-cordao';
    malhaCordao.castShadow = true;
    root.add(malhaCordao);
    lixo.push(malhaCordao.geometry);
  }

  // balanço quase parado da barra (2 a 3 mm, ar quente subindo da sala): só no shader, em função de t
  const tempo = { value: 0 };
  const compilarVeludo = veludo.onBeforeCompile;
  veludo.onBeforeCompile = (sh, renderer) => {
    compilarVeludo.call(veludo, sh, renderer);
    sh.uniforms.tempoCortina = tempo;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float tempoCortina;').replace(
      '#include <begin_vertex>',
      /* glsl */ `#include <begin_vertex>
      float pesoBalanco = 1.0 - smoothstep( ${(yBarra + 0.02).toFixed(3)}, ${(yBarra + 0.9).toFixed(3)}, position.y );
      transformed.z += pesoBalanco * 0.0025 * sin( tempoCortina * 0.55 + position.x * 2.3 ) * sin( tempoCortina * 0.31 + 1.7 );`,
    );
  };
  veludo.customProgramCacheKey = () => `veludo-v2-balanco-${yBarra.toFixed(3)}`;

  // nível baixo: veludo sem sheen (Standard) e sem sombra dos miúdos
  let simples: THREE.MeshStandardMaterial | null = null;
  return {
    root,
    update(_dt: number, t: number) {
      tempo.value = t;
    },
    setQuality(level: Level) {
      malhaLatao.castShadow = level === 'alta';
      if (malhaCordao) malhaCordao.castShadow = level !== 'baixa';
      if (level === 'baixa') {
        simples ??= new THREE.MeshStandardMaterial({
          color: new THREE.Color(o.cor ?? VERMELHO_VELUDO).multiplyScalar(1.15),
          roughness: 0.92,
          metalness: 0,
          normalMap: veludo.normalMap,
          normalScale: veludo.normalScale,
          vertexColors: true,
          side: THREE.DoubleSide,
          name: 'veludo-simples',
        });
        malhaPano.material = simples;
      } else malhaPano.material = veludo;
    },
    dispose() {
      for (const l of lixo) l.dispose();
      simples?.dispose();
    },
  };
}
