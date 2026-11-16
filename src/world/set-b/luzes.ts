/**
 * Luzes próprias da sala B (as da lareira e a da árvore pertencem às peças do kit):
 *   luar        spot azul estreito e distante (raios quase paralelos), com sombra, que só existe dentro do
 *               cone que atravessa a janela: não há o que vazar por paredes ou teto. Cor e força copiadas
 *               de exterior.luzExterna a cada quadro.
 *   poça        spot quente sem sombra, vindo da lanterna pendurada, sobre o lugar do Noel e da entrega.
 *   lanterna    pontual fraca na chama da lanterna pendurada (acende a parede e o alto da árvore).
 *   preenchimento  hemisférica quente e baixa, mais forte de baixo para cima (rebatido do piso).
 * Total da sala no nível alto: 3 (lareira) + 1 (árvore) + 4 = 8 luzes, 2 com sombra.
 */
import * as THREE from 'three';
import type { Level } from '../contracts';
import { LUGARES, LUZ } from './ajustes';

export interface DadosLuar {
  /** Direção para a lua (unitária, no mundo). */
  direcao: THREE.Vector3;
  /** Centro do vão da janela no plano do vidro (mundo). */
  centro: THREE.Vector3;
  largura: number;
  altura: number;
  /** Base do vão (peitoril) e flecha do arco. */
  base: number;
  flecha: number;
  colunas: number;
  linhas: number;
  /** Obstáculo redondo no caminho do facho (a árvore): centro (x, z) e raio. O facho some antes dele. */
  obstaculo?: { x: number; z: number; raio: number };
}

export interface LuzesDaSala {
  root: THREE.Group;
  luar: THREE.SpotLight;
  poca: THREE.SpotLight;
  lampiao: THREE.PointLight;
  preenchimento: THREE.HemisphereLight;
  /** Copia cor e força da luz de fora e anima as chamas. `entrega` de 0 a 1 (destaque da área de entrega). */
  update(t: number, corExterna: THREE.Color, forcaExterna: number, entrega: number): void;
  setQuality(level: Level): void;
  dispose(): void;
}

/** Direção do luar com a elevação escolhida em ajustes (o azimute é o da peça do exterior). */
export function direcaoDoLuar(sugerida: THREE.Vector3): THREE.Vector3 {
  const h = new THREE.Vector3(sugerida.x, 0, sugerida.z).normalize();
  const el = (LUZ.luarElevacao * Math.PI) / 180;
  return h.multiplyScalar(Math.cos(el)).add(new THREE.Vector3(0, Math.sin(el), 0)).normalize();
}

/**
 * Recorte do luar pintado no piso (níveis médio e baixo, em que o luar não tem sombra): a projeção do
 * vão da janela, com as travessas, ao longo da direção da luz. Um plano aditivo com textura desenhada.
 */
function criarRecortePintado(d: DadosLuar): { malha: THREE.Mesh; material: THREE.MeshBasicMaterial; dispose(): void } {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const c = canvas.getContext('2d')!;
  c.fillStyle = '#000';
  c.fillRect(0, 0, 256, 256);
  // v = 0 embaixo (peitoril), v = 1 no topo do arco; o canvas tem y para baixo
  const W = 256;
  const H = 256;
  const yDe = (v: number) => H - v * H;
  const vNasce = (d.altura - d.flecha) / d.altura;
  c.save();
  c.beginPath();
  c.moveTo(6, yDe(0.01));
  c.lineTo(6, yDe(vNasce));
  c.quadraticCurveTo(W / 2, yDe(1 + (1 - vNasce) * 0.9), W - 6, yDe(vNasce));
  c.lineTo(W - 6, yDe(0.01));
  c.closePath();
  c.clip();
  c.fillStyle = '#fff';
  c.fillRect(0, 0, W, H);
  // travessas e montantes (sombra do caixilho)
  c.fillStyle = '#000';
  const vTrav = vNasce - 0.3 / d.altura;
  for (let i = 1; i < d.colunas; i++) c.fillRect((W * i) / d.colunas - (i === d.colunas / 2 ? 9 : 3), 0, i === d.colunas / 2 ? 18 : 6, H);
  for (let j = 1; j < d.linhas; j++) c.fillRect(0, yDe((vTrav * j) / d.linhas) - 3, W, 6);
  c.fillRect(0, yDe(vTrav) - 7, W, 14);
  c.fillRect(0, 0, 12, H);
  c.fillRect(W - 12, 0, 12, H);
  c.restore();
  // borda macia
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  // projeta os quatro cantos do vão no piso
  const dir = d.direcao;
  const chao = (x: number, y: number) => {
    const k = y / dir.y;
    return new THREE.Vector3(x - dir.x * k, 0.006, d.centro.z - dir.z * k);
  };
  const x0 = d.centro.x - d.largura / 2;
  const x1 = d.centro.x + d.largura / 2;
  const p00 = chao(x0, d.base);
  const p10 = chao(x1, d.base);
  const p01 = chao(x0, d.base + d.altura);
  const p11 = chao(x1, d.base + d.altura);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([...p00.toArray(), ...p10.toArray(), ...p01.toArray(), ...p11.toArray()], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 1, 1], 2));
  g.setIndex([0, 2, 1, 1, 2, 3]);
  g.computeVertexNormals();
  const material = new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: true });
  const malha = new THREE.Mesh(g, material);
  malha.name = 'recorte-do-luar-pintado';
  malha.renderOrder = 2;
  malha.userData.semAO = true;
  malha.visible = false;
  return {
    malha,
    material,
    dispose() {
      g.dispose();
      material.dispose();
      tex.dispose();
    },
  };
}

/**
 * Facho do luar: a luz azul que entra pela janela, vista de lado como um véu de poeira no ar, riscado pelas
 * sombras das travessas. São lâminas verticais paralelas à direção da luz (uma ou duas por coluna de vidros),
 * aditivas e muito transparentes; somadas, dão volume e paralaxe. Uma chamada de desenho.
 */
function criarFacho(d: DadosLuar): { malha: THREE.Mesh; uniformes: { uCor: { value: THREE.Color }; uForca: { value: number }; uTempo: { value: number } }; dispose(): void } {
  const viagem = d.direcao.clone().multiplyScalar(-1); // sentido em que a luz anda
  const a = d.largura / 2;
  const R = d.flecha > 0 ? (a * a + d.flecha * d.flecha) / (2 * d.flecha) : 0;
  const topoEm = (x: number) => d.base + d.altura - d.flecha + (d.flecha > 0 ? Math.sqrt(Math.max(0, R * R - x * x)) - (R - d.flecha) : 0);
  const pos: number[] = [];
  const dados: number[] = []; // altura no vão (m), distância ao longo do facho (m), semente da lâmina
  const fins: number[] = []; // distância em que a lâmina acaba
  const idx: number[] = [];
  const porColuna = 2;
  const n = d.colunas * porColuna;
  for (let i = 0; i < n; i++) {
    const coluna = Math.floor(i / porColuna);
    const dentro = (i % porColuna) + 0.5;
    const x = -a + (d.largura * (coluna + (0.18 + 0.64 * (dentro / porColuna)))) / d.colunas;
    const yTopo = topoEm(x) - 0.07;
    const yBase = d.base + 0.07;
    const sTopo = yTopo / -viagem.y;
    const sBase = yBase / -viagem.y;
    const A = new THREE.Vector3(d.centro.x + x, yBase, d.centro.z + 0.12);
    const B = new THREE.Vector3(d.centro.x + x, yTopo, d.centro.z + 0.12);
    const C = B.clone().addScaledVector(viagem, sTopo);
    const D = A.clone().addScaledVector(viagem, sBase);
    C.y = 0.02;
    D.y = 0.02;
    const q = pos.length / 3;
    pos.push(...A.toArray(), ...B.toArray(), ...C.toArray(), ...D.toArray());
    const semente = (i * 0.618) % 1;
    dados.push(yBase, 0, semente, yTopo, 0, semente, yTopo, sTopo, semente, yBase, sBase, semente);
    // onde esta lâmina encontra a árvore (distância ao longo do facho); sem encontro, o comprimento inteiro
    let sFim = sTopo;
    if (d.obstaculo) {
      const hx = viagem.x;
      const hz = viagem.z;
      const ox = A.x - d.obstaculo.x;
      const oz = A.z - d.obstaculo.z;
      const qa = hx * hx + hz * hz;
      const qb = 2 * (ox * hx + oz * hz);
      const qc = ox * ox + oz * oz - d.obstaculo.raio * d.obstaculo.raio;
      const disc = qb * qb - 4 * qa * qc;
      if (disc > 0) {
        const s0 = (-qb - Math.sqrt(disc)) / (2 * qa);
        if (s0 > 0) sFim = Math.min(sFim, s0);
      }
    }
    fins.push(sFim, sFim, sFim, sFim);
    idx.push(q, q + 1, q + 3, q + 1, q + 2, q + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aDados', new THREE.Float32BufferAttribute(dados, 3));
  g.setAttribute('aFim', new THREE.Float32BufferAttribute(fins, 1));
  g.setIndex(idx);
  // alturas das travessas (para riscar o facho com as sombras delas)
  const yNasce = d.base + d.altura - d.flecha;
  const yTrav = yNasce - 0.3;
  const uniformes = {
    uCor: { value: new THREE.Color('#7f9df2') },
    uForca: { value: 0 },
    uTempo: { value: 0 },
    uBase: { value: d.base },
    uTrav: { value: yTrav },
    uLinhas: { value: d.linhas },
    uComprimento: { value: (d.base + d.altura) / -viagem.y },
  };
  const material = new THREE.ShaderMaterial({
    uniforms: uniformes,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: false,
    vertexShader: /* glsl */ `
      attribute vec3 aDados;
      attribute float aFim;
      varying vec3 vDados;
      varying vec3 vMundo;
      varying float vFim;
      void main() {
        vDados = aDados;
        vFim = aFim;
        vec4 m = modelMatrix * vec4(position, 1.0);
        vMundo = m.xyz;
        gl_Position = projectionMatrix * viewMatrix * m;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uCor;
      uniform float uForca;
      uniform float uTempo;
      uniform float uBase;
      uniform float uTrav;
      uniform float uLinhas;
      uniform float uComprimento;
      varying vec3 vDados;
      varying vec3 vMundo;
      varying float vFim;
      float acaso(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float ruido(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(acaso(i), acaso(i + vec2(1.0, 0.0)), f.x), mix(acaso(i + vec2(0.0, 1.0)), acaso(i + vec2(1.0, 1.0)), f.x), f.y);
      }
      void main() {
        float h = vDados.x;      // altura no vão de onde este raio saiu
        float s = vDados.y;      // quanto já andou
        // sombras das travessas: faixas escuras ao longo do facho
        float passo = (uTrav - uBase) / uLinhas;
        float linha = (h - uBase) / passo;
        float sombra = smoothstep(0.0, 0.11, abs(fract(linha + 0.5) - 0.5)) ;
        sombra = mix(sombra, 1.0, step(uLinhas + 0.25, linha));              // acima da travessa fixa não há mais linhas
        sombra *= smoothstep(0.0, 0.07, abs(h - uTrav));                     // a travessa fixa, mais grossa
        // some para o fim (perto do piso) e nasce macio no vidro
        float fim = min(vFim, uComprimento * 0.9);
        float ao_longo = smoothstep(0.0, 0.6, s) * (1.0 - smoothstep(fim * 0.3, fim, s));
        // poeira: riscos finos ao longo do raio e manchas lentas
        float po = 0.72 + 0.4 * ruido(vec2(h * 9.0 + vDados.z * 31.0, s * 0.35 - uTempo * 0.02)) + 0.25 * ruido(vMundo.xz * 1.7 + vec2(uTempo * 0.03, vDados.z * 7.0));
        float perto_do_piso = smoothstep(0.0, 0.35, vMundo.y);
        float a = sombra * ao_longo * po * perto_do_piso * uForca;
        gl_FragColor = vec4(uCor * a, 1.0);
      }`,
  });
  const malha = new THREE.Mesh(g, material);
  malha.name = 'facho-do-luar';
  malha.renderOrder = 3;
  malha.frustumCulled = false;
  malha.userData.semAO = true;
  return {
    malha,
    uniformes,
    dispose() {
      g.dispose();
      material.dispose();
    },
  };
}

export function criarLuzes(d: DadosLuar, chamaLanterna: THREE.Vector3): LuzesDaSala {
  const root = new THREE.Group();
  root.name = 'sala-b-luzes';

  /* ------------------------------------------------------------------ luar */
  const raio = 0.5 * Math.hypot(d.largura, d.altura) + 0.2;
  const dist = LUZ.luarDistancia;
  const luar = new THREE.SpotLight('#7f9df2', 1, 0, Math.atan(raio / dist), 0.06, 0);
  luar.name = 'luar-da-janela';
  luar.position.copy(d.centro).addScaledVector(d.direcao, dist);
  luar.target.position.copy(d.centro);
  luar.castShadow = true;
  luar.shadow.mapSize.set(LUZ.sombra.alta, LUZ.sombra.alta);
  luar.shadow.camera.near = dist - 6;
  luar.shadow.camera.far = dist + 16;
  luar.shadow.bias = -0.0003;
  luar.shadow.normalBias = 0.012;
  luar.shadow.radius = 1.8;
  root.add(luar, luar.target);
  const recorte = criarRecortePintado(d);
  const facho = criarFacho(d);
  root.add(recorte.malha, facho.malha);

  /* ------------------------------------------------- poça do lugar do Noel */
  const meio = new THREE.Vector3((LUGARES.noel.x * 2 + LUGARES.entrega.x) / 3, 0, (LUGARES.noel.z * 2 + LUGARES.entrega.z) / 3);
  const poca = new THREE.SpotLight(LUZ.poca.cor, LUZ.poca.forca, 11, LUZ.poca.angulo, LUZ.poca.penumbra, 1.6);
  poca.name = 'poca-da-lanterna';
  poca.position.copy(chamaLanterna);
  poca.target.position.copy(meio);
  root.add(poca, poca.target);

  /* -------------------------------------------------------------- lanterna */
  const lampiao = new THREE.PointLight(LUZ.lanterna.cor, LUZ.lanterna.forca, LUZ.lanterna.alcance, 1.8);
  lampiao.name = 'chama-da-lanterna';
  lampiao.position.copy(chamaLanterna);
  lampiao.position.y -= 0.6; // um pouco abaixo da lanterna: de dentro, estouraria a própria caixa
  root.add(lampiao);

  /* --------------------------------------------------------- preenchimento */
  const preenchimento = new THREE.HemisphereLight(LUZ.preenchimento.ceu, LUZ.preenchimento.chao, LUZ.preenchimento.forca);
  preenchimento.name = 'preenchimento-quente';
  root.add(preenchimento);

  let nivel: Level = 'alta';
  const corRecorte = new THREE.Color();
  const corLuar = new THREE.Color();
  return {
    root,
    luar,
    poca,
    lampiao,
    preenchimento,
    update(t, corExterna, forcaExterna, entrega) {
      // a cor vem de fora a cada quadro; a saturação é puxada para o recorte ler azul sobre o piso âmbar
      const media = (corExterna.r + corExterna.g + corExterna.b) / 3;
      corLuar.setRGB(
        Math.max(0, media + (corExterna.r - media) * LUZ.luarSaturacao),
        Math.max(0, media + (corExterna.g - media) * LUZ.luarSaturacao),
        Math.max(0, media + (corExterna.b - media) * LUZ.luarSaturacao),
      );
      luar.color.copy(corLuar);
      luar.intensity = forcaExterna * LUZ.luar;
      facho.uniformes.uCor.value.copy(corExterna);
      facho.uniformes.uForca.value = forcaExterna * LUZ.facho * (nivel === 'baixa' ? 0.7 : 1);
      facho.uniformes.uTempo.value = t;
      if (nivel !== 'alta') {
        // recorte pintado: mesma cor da luz de fora, força proporcional
        corRecorte.copy(corLuar).multiplyScalar(forcaExterna * LUZ.luar * LUZ.recortePintado);
        recorte.material.color.copy(corRecorte);
      }
      const chama = 1 + 0.05 * Math.sin(t * 4.3) + 0.04 * Math.sin(t * 7.9 + 1.3) + 0.03 * Math.sin(t * 12.7 + 0.4);
      lampiao.intensity = LUZ.lanterna.forca * chama;
      poca.intensity = (LUZ.poca.forca + (LUZ.poca.forcaEntrega - LUZ.poca.forca) * entrega) * (1 + (chama - 1) * 0.5);
    },
    setQuality(level) {
      nivel = level;
      // alta: luar com sombra de verdade; média e baixa: o luar vira o recorte pintado no piso
      const real = level === 'alta';
      luar.visible = real;
      luar.castShadow = real;
      recorte.malha.visible = !real;
      lampiao.visible = level !== 'baixa';
    },
    dispose() {
      luar.shadow.map?.dispose();
      recorte.dispose();
      facho.dispose();
    },
  };
}
