/**
 * Janela grande de casa de campo, de madeira escura encerada: "o grande recorte azul" da sala.
 *
 * Convenções: o plano do vidro fica em z = 0, o lado de dentro (a sala) é +Z, a base em y = 0 (o piso).
 * A peça NÃO inclui a parede nem a paisagem: devolve `vao` e `contorno()` para a composição abrir o
 * buraco na parede dela (a parede ocupa de z = vao.zFora a z = vao.zDentro).
 *
 * Uso:
 *   const janela = await criarJanela(ctx, { largura: 3, altura: 3.2, peitoril: 0.75, arco: true });
 *   janela.root.position.set(x, 0, zDaParede);          // o vidro fica neste z
 *   const furo = new THREE.Path(janela.contorno());      // contorno do vão em XY (local da janela)
 *   paredeShape.holes.push(furo);                        // ShapeGeometry ou ExtrudeGeometry da parede
 *   // luar: DirectionalLight azul com sombra vinda de fora (z negativo) desenha as travessas no piso
 *
 * Montagem (tudo com perfil de marcenaria, nada de caixas): forro do vão (os lados fundos da parede),
 * marco com rebaixo, travessa fixa, duas folhas de abrir com pinázios, bandeira fixa no alto (em arco
 * ou reta), guarnição moldurada na face da parede, peitoril interno grosso e saliente com saia,
 * peitoril externo, ferragens de latão, vidro com reflexo, geada nos cantos de cada vidro e neve
 * acumulada do lado de fora.
 */
import * as THREE from 'three';
import type { Level } from '../../contracts';
import type { KitContext, Peca } from '../tipos';
import { criarCortina, geometriaVarao } from '../tecidos/cortina';
import { ALTURA_ALMOFADAO, criarBancoDaJanela } from './banco';
import { cremona, dobradica } from './ferragens';
import { forcasGeada, quadroGeada, texturaGeadaJanela, type CaixaGeada } from './geada';
import { arredondar, barra, contornoVao, topoDoVao, varrerPerfil, type FormaVao, type Ponto2 } from './marcenaria';
import { LADRILHO_MADEIRA, materialLatao, materialMadeira, materialNeve } from './materiais';
import { monteDoPeitoril, montinhoDoVidro } from './neve';
import { criarSorteio, entre, escalarUv, fbm2, juntar, limitar, pintar } from './util';

export interface JanelaOpcoes {
  /** Largura do vão na parede, de 2,6 a 3,6 m. Padrão 3. */
  largura?: number;
  /** Altura do vão, de 2,6 a 4 m. Padrão 3,2. */
  altura?: number;
  /** Altura do peitoril ao piso, de 0,6 a 0,9 m. Padrão 0,75. */
  peitoril?: number;
  /** Topo em arco abatido (true, padrão) ou verga reta. */
  arco?: boolean;
  /** Colunas de vidros no vão todo (par: metade em cada folha). Padrão 4. */
  colunas?: number;
  /** Linhas de vidros das folhas (a bandeira do alto é uma linha a mais). Padrão 3. */
  linhas?: number;
  /** Espessura da parede (o vão é fundo), de 0,3 a 0,5 m. Padrão 0,4. */
  espessuraParede?: number;
  /** Assento de janela estofado sob o peitoril. Padrão false. */
  banco?: boolean;
  /** Cortinas de veludo com varão. Padrão true. */
  cortinas?: boolean;
  /** Quanto as cortinas estão recolhidas (0 fechadas, 1 presas de lado). Padrão 0,85. */
  aberturaCortinas?: number;
  /** Cor do veludo das cortinas e do assento. */
  corTecido?: THREE.ColorRepresentation;
  /** Neve acumulada do lado de fora e geada nos vidros. Padrão true. */
  inverno?: boolean;
  semente?: number;
}

export interface VaoJanela {
  largura: number;
  altura: number;
  /** Altura da base do vão (o peitoril) em relação ao piso. */
  base: number;
  /** Flecha do arco no topo (0 = reto). O topo do vão fica em base + altura. */
  flecha: number;
  /** A parede vai de zFora (face externa) a zDentro (face da sala), no eixo Z local da janela. */
  zFora: number;
  zDentro: number;
}

export interface Janela extends Peca {
  /** Medidas do buraco que a composição precisa abrir na parede. */
  vao: VaoJanela;
  /** Contorno do vão no plano XY local (anti-horário), pronto para virar furo de um THREE.Shape. */
  contorno(segmentosArco?: number): THREE.Vector2[];
  /** A malha do vidro (um plano só, atrás dos pinázios), para ajustes de reflexo e cor. */
  vidro: THREE.Mesh;
  /** A malha da geada (para ajustar a força do azul que atravessa: material.emissiveIntensity). */
  geada: THREE.Mesh | null;
  /** As cortinas (esquerda e direita), quando ligadas. */
  cortinas: Peca[];
  /** Retângulo ocupado pela peça com cortinas e varão, em XY local: útil para compor. */
  limites: { xMin: number; xMax: number; yMax: number; zMax: number };
  /**
   * Cria o luar que entra pela janela, já acertado: SpotLight azul-cobalto, distante e sem queda (raios
   * quase paralelos), com sombra de penumbra macia e o cone cobrindo só o vão. A luz e o alvo entram
   * em `root` (andam com a janela). Opcional: a composição pode usar a sua própria luz.
   */
  luar(opcoes?: LuarOpcoes): THREE.SpotLight;
}

export interface LuarOpcoes {
  /** Direção de onde a luz vem (local da janela, apontando para fora e para cima). Padrão (-0,2; 0,74; -0,86). */
  deOnde?: THREE.Vector3;
  /** Ponto (local) para onde o eixo do cone aponta, no piso da sala. Padrão: 1,6 m para dentro, 1,2 m de altura. */
  alvo?: THREE.Vector3;
  /** Padrão 2 (é uma luz sem queda: compare com o reboco iluminado; o recorte nunca deve passar dele). */
  forca?: number;
  /** Padrão '#2c74cc' (cobalto; mais lavanda que isto dessatura no ACES). */
  cor?: THREE.ColorRepresentation;
  /** Lado do mapa de sombra. Padrão 2048. */
  mapa?: number;
  /** Raio do filtro da sombra (penumbra), em texels. Padrão 3. */
  penumbra?: number;
}

let ondulacao: THREE.DataTexture | null = null;
/** Ondulação de baixa frequência do vidro soprado (mapa de normais, gerado por código, sem emenda). */
function ondulacaoVidro(): THREE.DataTexture {
  if (ondulacao) return ondulacao;
  const n = 128;
  const altura = new Float32Array(n * n);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const a = (x / n) * Math.PI * 2;
      const b = (y / n) * Math.PI * 2;
      // ruído periódico: amostra em um toro
      altura[y * n + x] = fbm2(Math.cos(a) * 1.2 + Math.sin(b) * 0.3 + 5, Math.sin(a) * 1.2 + Math.cos(b) * 2.2 + 5, 3, 77) + 0.3 * Math.sin(b * 3 + Math.cos(a) * 0.7);
    }
  const dados = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const h = (xx: number, yy: number) => altura[((yy + n) % n) * n + ((xx + n) % n)];
      const dx = (h(x + 1, y) - h(x - 1, y)) * 4;
      const dy = (h(x, y + 1) - h(x, y - 1)) * 4;
      const v = new THREE.Vector3(-dx, -dy, 1).normalize();
      const i = (y * n + x) * 4;
      dados[i] = Math.round((v.x * 0.5 + 0.5) * 255);
      dados[i + 1] = Math.round((v.y * 0.5 + 0.5) * 255);
      dados[i + 2] = Math.round((v.z * 0.5 + 0.5) * 255);
      dados[i + 3] = 255;
    }
  ondulacao = new THREE.DataTexture(dados, n, n);
  ondulacao.wrapS = ondulacao.wrapT = THREE.RepeatWrapping;
  ondulacao.magFilter = THREE.LinearFilter;
  ondulacao.minFilter = THREE.LinearMipmapLinearFilter;
  ondulacao.generateMipmaps = true;
  ondulacao.needsUpdate = true;
  return ondulacao;
}

/** Vidro: quase invisível, mas com o reflexo da sala somado por cima (não some com a transparência). */
function materialVidro(): THREE.MeshPhysicalMaterial {
  const mat = new THREE.MeshPhysicalMaterial({
    color: '#0b1626',
    transparent: true,
    opacity: 0.1,
    roughness: 0.07,
    metalness: 0,
    ior: 1.5,
    envMapIntensity: 4,
    depthWrite: false,
    side: THREE.FrontSide,
    normalMap: ondulacaoVidro(),
  });
  mat.normalScale.set(0.012, 0.012);
  // cor pré-multiplicada feita à mão: o difuso pesa pela opacidade, o reflexo entra inteiro
  mat.blending = THREE.CustomBlending;
  mat.blendSrc = THREE.OneFactor;
  mat.blendDst = THREE.OneMinusSrcAlphaFactor;
  mat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      /* glsl */ `
      float reflexoVidro = clamp(dot(totalSpecular, vec3(0.299, 0.587, 0.114)), 0.0, 1.0);
      gl_FragColor = vec4(totalDiffuse * diffuseColor.a + totalSpecular, clamp(diffuseColor.a + reflexoVidro * 0.6, 0.0, 1.0));
      `,
    );
  };
  mat.customProgramCacheKey = () => 'vidro-janela';
  mat.name = 'vidro-janela';
  return mat;
}

export async function criarJanela(ctx: KitContext, opcoes: JanelaOpcoes = {}): Promise<Janela> {
  const W = limitar(opcoes.largura ?? 3, 2.6, 3.6);
  const H = limitar(opcoes.altura ?? 3.2, 2.6, 4);
  const base = limitar(opcoes.peitoril ?? 0.75, 0.6, 0.9);
  const parede = limitar(opcoes.espessuraParede ?? 0.4, 0.3, 0.5);
  const arco = opcoes.arco ?? true;
  const colunas = Math.max(2, Math.round((opcoes.colunas ?? 4) / 2) * 2);
  const linhas = Math.max(1, Math.round(opcoes.linhas ?? 3));
  const inverno = opcoes.inverno ?? true;
  const semente = opcoes.semente ?? 1;
  const r = criarSorteio(semente * 7919 + 5);

  const flecha = arco ? Math.min(W * 0.2, H - 1.9) : 0;
  const zFora = -0.1;
  const zDentro = parede - 0.1;
  const forma: FormaVao = { largura: W, altura: H, base, flecha };
  const vao: VaoJanela = { largura: W, altura: H, base, flecha, zFora, zDentro };

  // medidas da marcenaria
  const FORRO = 0.022; // tábua que reveste os lados do vão
  const BATENTE = 0.05; // parte do marco até o rebaixo onde as folhas encostam
  const MARCO = 0.075; // largura total do marco (o lábio de fora cobre a folga)
  const FOLHA = 0.068; // largura dos montantes das folhas
  const BAND = 0.04; // quadro fixo da bandeira
  const PINAZIO = 0.013; // meia largura do pinázio junto ao vidro
  const rf = FORRO + BATENTE; // recuo do rebaixo em relação à parede
  const X = W / 2 - rf; // meia largura livre entre os rebaixos
  const yNasce = base + H - flecha; // onde o arco nasce
  const yTrav = yNasce - (arco ? 0.3 : 0.52); // eixo da travessa fixa
  const TRAV = 0.03; // meia altura da travessa fixa (por dentro)

  const madeiras: THREE.BufferGeometry[] = [];
  const tom = (g: THREE.BufferGeometry, forca = 1) => {
    const f = forca * entre(r, 0.9, 1.04);
    madeiras.push(pintar(g, new THREE.Color(1, 0.985, 0.97), f));
  };
  const uvAcaso = () => ({ ladrilho: LADRILHO_MADEIRA, uvU: r() * 7, uvV: r() * 7 });

  /* ---------------------------------------------------------------- forro do vão */
  {
    const caminho = contornoVao(forma, 0);
    const perfil = arredondar(
      [
        [0, zFora - 0.004],
        [FORRO, zFora - 0.004],
        [FORRO, zDentro + 0.004],
        [0, zDentro + 0.004],
      ],
      [0, 0.004, 0.004, 0],
    );
    tom(varrerPerfil(caminho, perfil, { ...uvAcaso(), semTampas: true }), 0.92);
    // filete (cordão) a meia profundidade do forro, do lado da sala: quebra o plano liso
    const filete: Ponto2[] = arredondar(
      [
        [FORRO - 0.001, 0.105],
        [FORRO + 0.007, 0.105],
        [FORRO + 0.007, 0.123],
        [FORRO - 0.001, 0.123],
      ],
      [0, 0.004, 0.004, 0],
    );
    if (zDentro > 0.16) tom(varrerPerfil(caminho, filete, { ...uvAcaso(), semTampas: true }), 0.95);
  }

  /* ---------------------------------------------------------------------- marco */
  {
    const caminho = contornoVao(forma, FORRO);
    const perfil = arredondar(
      [
        [0, -0.06],
        [MARCO, -0.06],
        [MARCO, -0.026],
        [BATENTE, -0.026],
        [BATENTE, 0.06],
        [0, 0.06],
      ],
      [0, 0.004, 0.002, 0, 0.007, 0],
    );
    tom(varrerPerfil(caminho, perfil, { ...uvAcaso(), fechado: true }));
  }

  /* -------------------------------------------------------------- travessa fixa */
  {
    const perfil = arredondar(
      [
        [-0.05, -0.064],
        [0.05, -0.064],
        [0.05, -0.026],
        [TRAV, -0.026],
        [TRAV, 0.052],
        [0.012, 0.064],
        [-0.012, 0.064],
        [-TRAV, 0.052],
        [-TRAV, -0.026],
        [-0.05, -0.026],
      ],
      [0, 0, 0.002, 0, 0.005, 0.004, 0.004, 0.005, 0, 0.002],
    );
    tom(barra(new THREE.Vector2(-X - 0.01, yTrav), new THREE.Vector2(X + 0.01, yTrav), perfil, { ...uvAcaso(), semTampas: true }));
  }

  /* --------------------------------------------------------------------- folhas */
  const perfilFolha = arredondar(
    [
      [0, -0.024],
      [0.05, -0.024],
      [FOLHA, -0.006],
      [FOLHA, 0.006],
      [0.059, 0.0125],
      [0.051, 0.024],
      [0, 0.024],
    ],
    [0.002, 0.002, 0.0015, 0.0015, 0.004, 0.004, 0.003],
  );
  const perfilPinazio = (fundo = 1): Ponto2[] =>
    arredondar(
      [
        [-PINAZIO, -0.004],
        [-0.005, -0.021 * fundo],
        [0.005, -0.021 * fundo],
        [PINAZIO, -0.004],
        [PINAZIO, 0.004],
        [0.0075, 0.011 * fundo],
        [0.0055, 0.0225 * fundo],
        [-0.0055, 0.0225 * fundo],
        [-0.0075, 0.011 * fundo],
        [-PINAZIO, 0.004],
      ],
      [0, 0.002, 0.002, 0, 0.001, 0.003, 0.0035, 0.0035, 0.003, 0.001],
      2,
    );
  const yFolha0 = base + rf + 0.002;
  const yFolha1 = yTrav - TRAV - 0.002;
  /** Retângulos dos vidros (para a geada e a neve): x0, x1, y0, y1 e se é da fileira de baixo. */
  const vidros: Array<{ pts: THREE.Vector2[]; x0: number; x1: number; y0: number; baixo: boolean; bandeira: boolean }> = [];
  const colPorFolha = colunas / 2;
  for (const lado of [-1, 1]) {
    const x0 = lado < 0 ? -X + 0.002 : 0.0015;
    const x1 = lado < 0 ? -0.0015 : X - 0.002;
    const quadro = [new THREE.Vector2(x1, yFolha0), new THREE.Vector2(x1, yFolha1), new THREE.Vector2(x0, yFolha1), new THREE.Vector2(x0, yFolha0)];
    tom(varrerPerfil(quadro, perfilFolha, { ...uvAcaso(), fechado: true }));
    const gx0 = x0 + FOLHA;
    const gx1 = x1 - FOLHA;
    const gy0 = yFolha0 + FOLHA;
    const gy1 = yFolha1 - FOLHA;
    const lc = (gx1 - gx0) / colPorFolha;
    const al = (gy1 - gy0) / linhas;
    for (let c = 1; c < colPorFolha; c++) {
      const x = gx0 + lc * c;
      tom(barra(new THREE.Vector2(x, gy0 - 0.006), new THREE.Vector2(x, gy1 + 0.006), perfilPinazio(), { ...uvAcaso(), semTampas: true }));
    }
    for (let l = 1; l < linhas; l++) {
      const y = gy0 + al * l;
      // um nada mais raso que os verticais: no cruzamento as faces não disputam o mesmo plano
      tom(barra(new THREE.Vector2(gx0 - 0.006, y), new THREE.Vector2(gx1 + 0.006, y), perfilPinazio(0.93), { ...uvAcaso(), semTampas: true }));
    }
    for (let c = 0; c < colPorFolha; c++) {
      for (let l = 0; l < linhas; l++) {
        const a0 = gx0 + lc * c + (c > 0 ? PINAZIO : 0);
        const a1 = gx0 + lc * (c + 1) - (c < colPorFolha - 1 ? PINAZIO : 0);
        const b0 = gy0 + al * l + (l > 0 ? PINAZIO : 0);
        const b1 = gy0 + al * (l + 1) - (l < linhas - 1 ? PINAZIO : 0);
        vidros.push({
          pts: [new THREE.Vector2(a0, b0), new THREE.Vector2(a1, b0), new THREE.Vector2(a1, b1), new THREE.Vector2(a0, b1)],
          x0: a0,
          x1: a1,
          y0: b0,
          baixo: l === 0,
          bandeira: false,
        });
      }
    }
  }

  /* ------------------------------------------------------------------- bandeira */
  {
    const yb = yTrav + TRAV + 0.002;
    const dentro = contornoVao(forma, rf + 0.002).slice(1, -1);
    const quadro = [new THREE.Vector2(X - 0.002, yb), ...dentro, new THREE.Vector2(-X + 0.002, yb)];
    const perfil = arredondar(
      [
        [0, -0.024],
        [0.026, -0.024],
        [BAND, -0.006],
        [BAND, 0.006],
        [0.032, 0.0125],
        [0.025, 0.024],
        [0, 0.024],
      ],
      [0.002, 0.002, 0.0015, 0.0015, 0.004, 0.004, 0.003],
    );
    tom(varrerPerfil(quadro, perfil, { ...uvAcaso(), fechado: true }));
    const recuoVidro = rf + 0.002 + BAND;
    const gy0 = yb + BAND;
    const gx = X - 0.002 - BAND;
    // pinázios verticais alinhados com os das folhas, mais um no encontro das folhas
    const xs: number[] = [];
    const lc = (X - 0.002 - 0.0015 - 2 * FOLHA) / colPorFolha;
    for (const lado of [-1, 1]) for (let c = 1; c < colPorFolha; c++) xs.push(lado * (0.0015 + FOLHA + lc * c));
    xs.push(0);
    xs.sort((p, q) => p - q);
    for (const x of xs) {
      const topo = topoDoVao(forma, x, recuoVidro);
      tom(barra(new THREE.Vector2(x, gy0 - 0.006), new THREE.Vector2(x, topo + 0.006), perfilPinazio(), { ...uvAcaso(), semTampas: true }));
    }
    const limitesX = [-gx, ...xs, gx];
    for (let i = 0; i < limitesX.length - 1; i++) {
      const a0 = limitesX[i] + (i > 0 ? PINAZIO : 0);
      const a1 = limitesX[i + 1] - (i < limitesX.length - 2 ? PINAZIO : 0);
      const pts = [new THREE.Vector2(a0, gy0), new THREE.Vector2(a1, gy0)];
      const passos = 6;
      for (let k = 0; k <= passos; k++) {
        const x = a1 + ((a0 - a1) * k) / passos;
        pts.push(new THREE.Vector2(x, topoDoVao(forma, x, recuoVidro)));
      }
      vidros.push({ pts, x0: a0, x1: a1, y0: gy0, baixo: false, bandeira: true });
    }
  }

  /* --------------------------------------------------------- guarnição (moldura) */
  const yPeitoril = base + 0.05; // tampo do peitoril interno
  const ALTURA_PLINTO = 0.14; // bloco de base onde a guarnição pousa
  {
    const caminho = contornoVao(forma, 0);
    caminho[0].y = yPeitoril + ALTURA_PLINTO;
    caminho[caminho.length - 1].y = yPeitoril + ALTURA_PLINTO;
    const perfil = arredondar(
      (
        [
          [-0.112, 0],
          [0.008, 0],
          [0.008, 0.013],
          [-0.002, 0.0185],
          [-0.016, 0.0175],
          [-0.027, 0.011],
          [-0.064, 0.0125],
          [-0.078, 0.027],
          [-0.112, 0.031],
        ] as Ponto2[]
      ).map(([a, z]) => [a, z + zDentro] as Ponto2),
      [0, 0, 0.003, 0.004, 0.003, 0.004, 0.002, 0.004, 0.006],
    );
    tom(varrerPerfil(caminho, perfil, { ...uvAcaso() }), 1.02);
  }

  /* --------------------------------------------- plintos: o pé da guarnição sobre o peitoril */
  for (const lado of [-1, 1]) {
    const larg = 0.134;
    const s = new THREE.Shape();
    s.moveTo(-larg / 2, 0);
    s.lineTo(larg / 2, 0);
    s.lineTo(larg / 2, ALTURA_PLINTO);
    s.lineTo(-larg / 2, ALTURA_PLINTO);
    s.closePath();
    const ch = 0.004;
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.04 - 2 * ch, bevelEnabled: true, bevelThickness: ch, bevelSize: ch, bevelOffset: -ch, bevelSegments: 2, steps: 1, curveSegments: 1 });
    // o veio corre na vertical, como a guarnição que ele recebe
    const uvP = g.getAttribute('uv');
    for (let i = 0; i < uvP.count; i++) uvP.setXY(i, uvP.getY(i) / LADRILHO_MADEIRA + 3.7 * (lado + 2), uvP.getX(i) / LADRILHO_MADEIRA);
    g.translate(lado * (W / 2 + 0.052), yPeitoril + 0.0005, zDentro + ch);
    tom(g, 0.98);
  }

  /* ------------------------------------------------------------ peitoril interno */
  {
    const esp = 0.058;
    const nariz = zDentro + 0.078;
    const orelha = W / 2 + 0.165;
    const s = new THREE.Shape();
    // em planta (x, z): a parte funda dentro do vão e as orelhas que passam da guarnição
    s.moveTo(-W / 2 + 0.001, 0.056);
    s.lineTo(W / 2 - 0.001, 0.056);
    s.lineTo(W / 2 - 0.001, zDentro + 0.004);
    s.lineTo(orelha, zDentro + 0.004);
    s.lineTo(orelha, nariz);
    s.lineTo(-orelha, nariz);
    s.lineTo(-orelha, zDentro + 0.004);
    s.lineTo(-W / 2 + 0.001, zDentro + 0.004);
    s.closePath();
    const chanfro = 0.014;
    const g = new THREE.ExtrudeGeometry(s, { depth: esp - 2 * chanfro, bevelEnabled: true, bevelThickness: chanfro, bevelSize: chanfro, bevelOffset: -chanfro, bevelSegments: 4, steps: 1 });
    g.rotateX(Math.PI / 2); // a planta deita: a profundidade da extrusão vira a espessura (para baixo)
    g.computeBoundingBox();
    g.translate(0, yPeitoril - g.boundingBox!.max.y, 0);
    escalarUv(g, 1 / LADRILHO_MADEIRA, 1 / LADRILHO_MADEIRA, r() * 5, r() * 5);
    tom(g, 1.03);
    // saia sob o peitoril, com a quina de baixo aliviada
    const saia = arredondar(
      [
        [-0.05, zDentro],
        [0.045, zDentro],
        [0.045, zDentro + 0.024],
        [-0.022, zDentro + 0.024],
        [-0.05, zDentro + 0.009],
      ],
      [0, 0, 0.003, 0.006, 0.003],
    );
    // meia-cana no canto entre a saia e o peitoril
    const yCana = yPeitoril - esp + 0.001;
    const cana: Ponto2[] = [
      [-0.028, zDentro + 0.022],
      [0, zDentro + 0.022],
      [0, zDentro + 0.052],
      [-0.004, zDentro + 0.04],
      [-0.011, zDentro + 0.031],
      [-0.02, zDentro + 0.025],
    ];
    tom(barra(new THREE.Vector2(-W / 2 - 0.118, yCana), new THREE.Vector2(W / 2 + 0.118, yCana), cana, uvAcaso()), 1);
    const ySaia = yPeitoril - esp - 0.04;
    tom(barra(new THREE.Vector2(-W / 2 - 0.105, ySaia), new THREE.Vector2(W / 2 + 0.105, ySaia), saia, uvAcaso()), 0.97);
  }

  /* ------------------------------------------------------------ peitoril externo */
  {
    const fora = zFora - 0.07;
    const perfil = arredondar(
      [
        [-0.035, fora],
        [0.012, fora],
        [0.03, -0.058],
        [-0.02, -0.058],
      ],
      [0.004, 0.008, 0, 0],
    );
    tom(barra(new THREE.Vector2(-W / 2 + 0.001, base), new THREE.Vector2(W / 2 - 0.001, base), perfil, uvAcaso()), 0.85);
  }

  /* ------------------------------------------------------------------ montagem */
  const root = new THREE.Group();
  root.name = 'janela';
  const lixo: Array<{ dispose(): void }> = [];
  const matMadeira = await materialMadeira();
  const madeira = new THREE.Mesh(juntar(madeiras, true), matMadeira);
  madeira.name = 'janela-madeira';
  madeira.castShadow = true; // as travessas desenham a janela no piso com o luar
  madeira.receiveShadow = true;
  root.add(madeira);
  lixo.push(madeira.geometry);

  // vidro: um quadro por vidro (todos em uma malha só), cada um um nada torto (vidro antigo de caixilho:
  // o reflexo quebra em cada pinázio) e com a ondulação do vidro soprado; não bloqueia a luz
  const vidroGeo = (() => {
    const rv = criarSorteio(semente * 389 + 1);
    const pos: number[] = [];
    const nor: number[] = [];
    const uvs: number[] = [];
    for (const v of vidros) {
      const meio = new THREE.Vector2();
      for (const p of v.pts) meio.addScaledVector(p, 1 / v.pts.length);
      const tx = entre(rv, 0.007, 0.014) * (rv() < 0.5 ? -1 : 1);
      const ty = entre(rv, 0.007, 0.014) * (rv() < 0.5 ? -1 : 1);
      const n = new THREE.Vector3(Math.sin(tx), Math.sin(ty), 1).normalize();
      const du = rv() * 3;
      const dv = rv() * 3;
      const poe = (p: THREE.Vector2) => {
        // um pouco maior que o vão do vidro: as bordas ficam escondidas na madeira
        const q = p.clone().sub(meio);
        q.addScaledVector(q.clone().normalize(), 0.005).add(meio);
        pos.push(q.x, q.y, 0);
        nor.push(n.x, n.y, n.z);
        uvs.push(q.x * 0.7 + du, q.y * 0.7 + dv);
      };
      for (let i = 0; i < v.pts.length; i++) {
        poe(meio);
        poe(v.pts[i]);
        poe(v.pts[(i + 1) % v.pts.length]);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    return g;
  })();
  const vidroMat = materialVidro();
  const vidro = new THREE.Mesh(vidroGeo, vidroMat);
  vidro.name = 'janela-vidro';
  vidro.castShadow = false;
  vidro.receiveShadow = false;
  vidro.renderOrder = 2;
  root.add(vidro);
  lixo.push(vidroGeo, vidroMat);

  // ferragens de latão
  {
    const latoes: THREE.BufferGeometry[] = [];
    const altFolha = yFolha1 - yFolha0;
    for (const lado of [-1, 1]) {
      for (const f of [0.1, 0.5, 0.9]) {
        const d = dobradica(0.095);
        d.translate(lado * (X - 0.001), yFolha0 + altFolha * f, 0.024 + 0.0055);
        latoes.push(d);
      }
    }
    const yPux = limitar(1.28, yFolha0 + 0.3, yFolha1 - 0.3);
    latoes.push(cremona(0, yFolha0 + 0.012, yFolha1 - 0.012, yPux, 0.024));
    const latao = new THREE.Mesh(juntar(latoes), materialLatao());
    latao.name = 'janela-latao';
    latao.castShadow = false;
    root.add(latao);
    lixo.push(latao.geometry);
  }

  // inverno: geada por dentro de cada vidro e neve acumulada por fora
  let geada: THREE.Mesh | null = null;
  if (inverno) {
    // a textura cobre a janela inteira: cada vidro tem a sua geada, pintada no lugar
    const caixa: CaixaGeada = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity };
    for (const v of vidros)
      for (const p of v.pts) {
        caixa.x0 = Math.min(caixa.x0, p.x);
        caixa.x1 = Math.max(caixa.x1, p.x);
        caixa.y0 = Math.min(caixa.y0, p.y);
        caixa.y1 = Math.max(caixa.y1, p.y);
      }
    const forcas = forcasGeada(vidros, caixa, semente);
    const texGeada = texturaGeadaJanela(vidros, forcas, caixa, semente, ctx.level === 'baixa' ? 300 : 440);
    const geadaMat = new THREE.MeshStandardMaterial({
      map: texGeada,
      color: '#e9f0fb',
      roughness: 0.55,
      metalness: 0,
      emissive: '#3f5fae', // um pouco do azul de fora atravessando o gelo
      emissiveIntensity: 0.16,
      emissiveMap: texGeada,
      transparent: true,
      depthWrite: false,
      envMapIntensity: 0.6,
      name: 'geada',
    });
    geada = new THREE.Mesh(
      juntar(vidros.map((v) => quadroGeada(v.pts, 0.0025, caixa))),
      geadaMat,
    );
    geada.name = 'janela-geada';
    geada.renderOrder = 3;
    geada.castShadow = false;
    geada.receiveShadow = false;
    geada.userData.semAO = true;
    root.add(geada);
    lixo.push(geada.geometry, geadaMat, texGeada);

    const neves: THREE.BufferGeometry[] = [];
    neves.push(monteDoPeitoril(-W / 2 + FORRO + 0.004, W / 2 - FORRO - 0.004, base + 0.02, -0.0262, -0.0262 - (zFora - 0.075), 0.15, semente * 31 + 7));
    // montinhos só em parte dos vidros, mais do lado do vento
    const rn = criarSorteio(semente * 53 + 11);
    const ladoVento = rn() < 0.5 ? -1 : 1;
    for (const v of vidros) {
      if (v.baixo) continue;
      const vento = limitar(((v.x0 + v.x1) / 2 / (W / 2)) * ladoVento, -1, 1);
      if (rn() > 0.5 + 0.3 * vento) continue;
      neves.push(montinhoDoVidro(v.x0 - 0.004, v.x1 + 0.004, v.y0 - 0.002, 0, rn, (v.bandeira ? 1.2 : 1) * entre(rn, 0.5, 1.2), ladoVento));
    }
    const neve = new THREE.Mesh(juntar(neves, true), await materialNeve());
    neve.name = 'janela-neve';
    neve.castShadow = true;
    neve.receiveShadow = true;
    root.add(neve);
    lixo.push(neve.geometry);
  }

  // assento de janela, opcional: vai de cortina a cortina; as cortinas então são curtas e assentam nele
  const pecas: Peca[] = [];
  const xFora = W / 2 + 0.3;
  const yAssento = yPeitoril - 0.058; // tampo de madeira do assento, logo abaixo do peitoril
  if (opcoes.banco) {
    const banco = await criarBancoDaJanela(ctx, { largura: 2 * xFora + 0.06, altura: yAssento, zParede: zDentro, corTecido: opcoes.corTecido, semente });
    root.add(banco.root);
    pecas.push(banco);
  }

  // cortinas de veludo com um varão só
  const cortinas: Peca[] = [];
  const yVarao = base + H + 0.2;
  const zVarao = zDentro + 0.15;
  if (opcoes.cortinas ?? true) {
    const larguraPano = xFora + 0.02;
    for (const lado of ['esquerda', 'direita'] as const) {
      const c = await criarCortina(ctx, {
        largura: larguraPano,
        altura: yVarao,
        abertura: opcoes.aberturaCortinas ?? 0.85,
        lado,
        cor: opcoes.corTecido,
        semente: semente * 2 + (lado === 'esquerda' ? 1 : 2),
        varao: false,
        barra: opcoes.banco ? yAssento + ALTURA_ALMOFADAO - 0.012 : 0,
        distanciaParede: zVarao - zDentro,
      });
      c.root.position.set(lado === 'esquerda' ? -xFora : xFora, 0, zVarao);
      root.add(c.root);
      cortinas.push(c);
      pecas.push(c);
    }
    const varaoGeo = geometriaVarao({ de: -xFora - 0.09, ate: xFora + 0.09, altura: yVarao, suportes: [-xFora - 0.03, 0, xFora + 0.03], distanciaParede: zVarao - zDentro });
    const varao = new THREE.Mesh(varaoGeo, materialLatao());
    varao.name = 'janela-varao';
    varao.position.z = zVarao;
    varao.castShadow = true;
    root.add(varao);
    lixo.push(varaoGeo);
  }

  return {
    root,
    vao,
    contorno: (segmentosArco = 28) => contornoVao(forma, 0, segmentosArco),
    vidro,
    geada,
    cortinas,
    limites: { xMin: -xFora - 0.2, xMax: xFora + 0.2, yMax: yVarao + 0.06, zMax: zVarao + 0.12 },
    luar(o: LuarOpcoes = {}) {
      const rumo = (o.deOnde ?? new THREE.Vector3(-0.2, 0.74, -0.86)).clone().normalize();
      const alvo = o.alvo ?? new THREE.Vector3(0.3, 1.2, 1.6);
      const distancia = 26;
      // o cone cobre o vão visto da luz, com folga (a parede é que recorta a janela)
      const raio = Math.hypot(W / 2, (H + base) / 2) + 1.2;
      const sp = new THREE.SpotLight(o.cor ?? '#2c74cc', o.forca ?? 2.0, 0, Math.atan(raio / distancia), 0.2, 0);
      sp.name = 'janela-luar';
      sp.position.copy(alvo).addScaledVector(rumo, distancia);
      sp.target.position.copy(alvo);
      sp.castShadow = true;
      const lado = o.mapa ?? 2048;
      sp.shadow.mapSize.set(lado, lado);
      sp.shadow.camera.near = distancia - 8;
      sp.shadow.camera.far = distancia + 14;
      sp.shadow.bias = -0.0004;
      sp.shadow.normalBias = 0.02;
      sp.shadow.radius = o.penumbra ?? 3;
      root.add(sp, sp.target);
      return sp;
    },
    update(dt: number, t: number) {
      for (const p of pecas) p.update(dt, t);
    },
    setQuality(level: Level) {
      for (const p of pecas) p.setQuality(level);
      // na baixa só a madeira (o desenho da janela no piso) projeta sombra
      root.traverse((o) => {
        if (o.name === 'janela-neve' || o.name === 'janela-varao') (o as THREE.Mesh).castShadow = level !== 'baixa';
      });
    },
    dispose() {
      for (const p of pecas) p.dispose();
      for (const l of lixo) l.dispose();
    },
  };
}
