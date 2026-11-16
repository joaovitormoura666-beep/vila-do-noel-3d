/**
 * Estúdio do ACERVO: folhas de conferência dos modelos e das texturas baixados do Poly Haven, vistos sob
 * uma luz parecida com a da sala (quente, baixa e rasante, como a de uma lareira fora do quadro, mais um
 * luar azul fraco e um ambiente de sala para os reflexos de verniz e latão).
 *
 *   node tools/shot.cjs sala --param set=kit-acervo --param modelos=ArmChair_01,GreenChair_01,Sofa_01,Ottoman_01 --out lab/acervo/folha.png
 *   node tools/shot.cjs sala --param set=kit-acervo --param texturas=wood_floor,clay_plaster@2,rough_wood --out lab/acervo/amostras.png
 *   node tools/shot.cjs sala --param set=kit-acervo --param pisos=wood_floor,plank_flooring_02 --out lab/acervo/pisos.png
 *
 * Parâmetros do endereço (só deste estúdio):
 *   modelos=a,b,c     ids de public/assets/modelos; cada um em um nicho de uma estante de conferência, com
 *                     etiqueta (id, largura x altura x profundidade em metros, triângulos)
 *   texturas=a,b@2    painéis verticais de 1,5 m, com o repeat calculado pelo tamanho real do ladrilho
 *                     (tabela LADRILHOS abaixo, ou "@metros" depois do id); mapas diff, nor e arm
 *   pisos=a,b         amostras deitadas de 3 x 2,4 m, vistas contra a luz (mostra o brilho da cera)
 *   colunas=2         nichos ou painéis por linha
 *   yaw=0.5           giro dos modelos, em radianos
 *   rasante=18        ângulo, em graus, entre a luz quente e o plano dos painéis de textura
 *   luz=neutra        luz branca difusa (confere a cor real, sem o âmbar)
 *   cor=b9977a        multiplica a cor das texturas (testa o escurecimento ou aquecimento)
 *   semarm=a,b        texturas que não têm o mapa arm baixado
 *   rug=0.6           multiplica a rugosidade das amostras (abaixo de 1 simula cera ou verniz)
 *   res=2k            usa a pasta <id>_2k (quando existir)
 *   olho=x,y,z,ax,ay,az,fov   câmera manual (posição, alvo e lente) para olhar um detalhe de perto
 *   vidro=0.12        troca os materiais de vidro (nome com "glass") por um vidro claro com esta opacidade
 *   tinta=id:8a6a50   multiplica a cor de um modelo (ou "tinta=8a6a50" para todos): testa o escurecimento
 *   ocultar=glass     esconde as malhas cujo material tem este trecho no nome (vidros opacos, por exemplo)
 * A medida e os triângulos de cada modelo também saem no console, em linhas "[acervo]".
 */
import * as THREE from 'three';
import type { BuildVillageSet } from '../contracts';
import { loadModel, loadPbr } from '../../engine/assets';
import { criarEstudio } from '../kit/estudio';
import type { KitContext, Peca } from '../kit/tipos';

/** Lado real do ladrilho de cada textura, em metros (do catálogo do Poly Haven). */
export const LADRILHOS: Record<string, number> = {
  wood_floor: 1.7,
  dark_wooden_planks: 2,
  wood_floor_worn: 2,
  clay_plaster: 2,
  painted_plaster_wall: 2,
  wooden_panels: 2.1,
  rough_wood: 0.5,
  dark_wood: 2,
  wood_trunk_wall: 1.25,
  weathered_brown_planks: 1.8,
  brown_leather: 0.4,
  wool_boucle: 0.35,
  knitted_fleece: 0.27,
  gingham_check: 0.29,
  dark_planks: 2,
  old_planks_02: 2,
  velour_velvet: 0.28,
};

const INCLINACAO = THREE.MathUtils.degToRad(14); // a câmera olha os nichos um pouco de cima

/** Etiqueta de texto em um plano (não recebe luz: precisa ser legível em qualquer foto). */
function etiqueta(texto: string, largura: number, altura: number): THREE.Mesh {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = Math.max(32, Math.round((1024 * altura) / largura));
  const c = canvas.getContext('2d')!;
  c.fillStyle = '#1a100a';
  c.fillRect(0, 0, canvas.width, canvas.height);
  let corpo = Math.round(canvas.height * 0.52);
  c.font = `600 ${corpo}px system-ui, sans-serif`;
  const medida = c.measureText(texto).width;
  if (medida > canvas.width - 40) {
    corpo = Math.floor((corpo * (canvas.width - 40)) / medida);
    c.font = `600 ${corpo}px system-ui, sans-serif`;
  }
  c.fillStyle = '#f3dfb8';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(texto, canvas.width / 2, canvas.height / 2 + 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(largura, altura), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  m.userData.semAO = true;
  m.name = 'etiqueta';
  return m;
}

/** Ambiente pequeno para os reflexos: sala escura e quente, com uma mancha de fogo à direita e uma janela azul à esquerda. */
function ambienteDeSala(renderer: THREE.WebGLRenderer, neutro: boolean): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const c = canvas.getContext('2d')!;
  if (neutro) {
    const g = c.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, '#c9ccd2');
    g.addColorStop(1, '#5a5d63');
    c.fillStyle = g;
    c.fillRect(0, 0, 512, 256);
  } else {
    const g = c.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, '#2a1a10');
    g.addColorStop(0.55, '#1c110b');
    g.addColorStop(1, '#2b1b10');
    c.fillStyle = g;
    c.fillRect(0, 0, 512, 256);
    // fogo: baixo, à direita e um pouco à frente (o centro do mapa, u = 0,5, é o lado -Z... basta estar de um lado)
    const fogo = c.createRadialGradient(400, 150, 4, 400, 150, 70);
    fogo.addColorStop(0, '#ffd9a0');
    fogo.addColorStop(0.25, '#ff9a45');
    fogo.addColorStop(1, 'rgba(120,50,10,0)');
    c.fillStyle = fogo;
    c.fillRect(300, 60, 200, 180);
    // janela: recorte azul do outro lado, mais alto
    c.fillStyle = '#243a6a';
    c.fillRect(70, 70, 60, 70);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const cena = new THREE.Scene();
  const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide });
  mat.color.setScalar(neutro ? 1.2 : 2.4);
  const esfera = new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), mat);
  cena.add(esfera);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(cena, 0.03).texture;
  pmrem.dispose();
  esfera.geometry.dispose();
  mat.dispose();
  tex.dispose();
  return env;
}

interface Montagem {
  peca: Peca;
  /** Largura, altura e profundidade totais do que foi montado, com o centro da base em (0, 0, 0). */
  largura: number;
  altura: number;
  profundidade: number;
  /** Maior dimensão de um item (para acertar a oclusão e a sombra). */
  escala: number;
}

function pecaDe(root: THREE.Group, descartaveis: Array<{ dispose(): void }>): Peca {
  return {
    root,
    update() {},
    setQuality() {},
    dispose() {
      for (const d of descartaveis) d.dispose();
    },
  };
}

function contarTriangulos(raiz: THREE.Object3D): { triangulos: number; malhas: number; materiais: number } {
  let triangulos = 0;
  let malhas = 0;
  const mats = new Set<THREE.Material>();
  raiz.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    malhas++;
    const g = m.geometry;
    triangulos += (g.index ? g.index.count : g.getAttribute('position').count) / 3;
    for (const mat of Array.isArray(m.material) ? m.material : [m.material]) mats.add(mat);
  });
  return { triangulos: Math.round(triangulos), malhas, materiais: mats.size };
}

/** Estante de conferência: cada modelo em um nicho com piso de tábuas, parede de reboco e etiqueta na testeira. */
interface Retoques {
  /** Trechos de nome de material a esconder. */
  ocultar: string[];
  /** Opacidade para os materiais de vidro (nome com "glass"); null deixa como veio. */
  vidro: number | null;
  /** Cor que multiplica os materiais de cada modelo: "id:hex" ou só "hex" para todos. */
  tintas: string[];
}

/**
 * Aplica nos modelos os retoques que o catálogo recomenda, para conferir na foto antes de recomendar:
 * vidro translúcido no lugar do vidro escuro que vem nos GLB e uma cor multiplicada (escurecer ou aquecer).
 * Os materiais são copiados antes: os originais ficam no cache compartilhado do carregador.
 */
function retocar(ids: string[], modelos: THREE.Group[], r: Retoques, descartaveis: Array<{ dispose(): void }>) {
  if (r.vidro === null && !r.tintas.length) return;
  modelos.forEach((modelo, i) => {
    const tinta = r.tintas.map((t) => t.split(':')).find((t) => t.length === 1 || t[0] === ids[i]);
    const copias = new Map<THREE.Material, THREE.Material>();
    modelo.traverse((o) => {
      const malha = o as THREE.Mesh;
      if (!malha.isMesh || Array.isArray(malha.material)) return;
      const original = malha.material as THREE.MeshStandardMaterial;
      const ehVidro = original.name.toLowerCase().includes('glass');
      if (!(ehVidro && r.vidro !== null) && !(tinta && !ehVidro)) return;
      let copia = copias.get(original) as THREE.MeshStandardMaterial | undefined;
      if (!copia) {
        copia = original.clone();
        copias.set(original, copia);
        descartaveis.push(copia);
        if (ehVidro && r.vidro !== null) {
          copia.map = null;
          copia.roughnessMap = null;
          copia.metalnessMap = null;
          copia.color.set('#fff2dc');
          copia.roughness = 0.08;
          copia.metalness = 0;
          copia.transparent = true;
          copia.opacity = r.vidro;
          copia.depthWrite = false;
        } else if (tinta) {
          copia.color.set(`#${tinta[tinta.length - 1]}`);
        }
      }
      malha.material = copia;
      if (ehVidro) malha.castShadow = false;
    });
  });
}

async function montarModelos(ids: string[], colunas: number, yaw: number, r: Retoques): Promise<Montagem> {
  const root = new THREE.Group();
  root.name = 'acervo-modelos';
  const descartaveis: Array<{ dispose(): void }> = [];
  const ocultar = r.ocultar;
  const modelos = await Promise.all(ids.map((id) => loadModel(`assets/modelos/${id}.glb`)));
  retocar(ids, modelos, r, descartaveis);
  if (ocultar.length) {
    // esconde as malhas cujo material tem um destes trechos no nome (ex.: ocultar=glass tira os vidros)
    for (const modelo of modelos)
      modelo.traverse((o) => {
        const malha = o as THREE.Mesh;
        if (!malha.isMesh) return;
        const nome = (Array.isArray(malha.material) ? malha.material[0] : malha.material).name.toLowerCase();
        if (ocultar.some((trecho) => nome.includes(trecho.toLowerCase()))) malha.visible = false;
      });
  }
  const caixas = modelos.map((m) => new THREE.Box3().setFromObject(m));
  const tamanhos = caixas.map((b) => b.getSize(new THREE.Vector3()));
  const maiorPlanta = Math.max(...tamanhos.map((t) => Math.hypot(t.x, t.z)), 0.12);
  const maiorAltura = Math.max(...tamanhos.map((t) => t.y), 0.1);
  const celulaL = maiorPlanta * 1.12 + 0.04;
  const fundoP = maiorPlanta * 1.15 + 0.04;
  const faixa = Math.max(celulaL * 0.085, 0.02); // testeira com a etiqueta (é a frente da laje do nicho)
  const celulaA = maiorAltura * 1.08 + fundoP * Math.tan(INCLINACAO) + 0.02;
  const linhas = Math.ceil(ids.length / colunas);
  const largura = celulaL * colunas;
  const altura = linhas * (celulaA + faixa);

  const rep = Math.max(largura / 1.7, 0.2);
  const pisoMat = new THREE.MeshStandardMaterial({ ...(await loadPbr('wood_floor', { repeat: [rep, (rep * fundoP) / largura] })), roughness: 1, metalness: 0, color: '#b9977a' });
  const paredeMat = new THREE.MeshStandardMaterial({ color: '#6f6257', roughness: 0.92 });
  const lajeMat = new THREE.MeshStandardMaterial({ color: '#2a1a12', roughness: 0.9 });
  descartaveis.push(pisoMat, paredeMat, lajeMat);

  for (let l = 0; l < linhas; l++) {
    const y0 = altura - (l + 1) * (celulaA + faixa) + faixa; // cota do piso desta linha (a primeira fica no alto)
    const laje = new THREE.Mesh(new THREE.BoxGeometry(largura, faixa, fundoP), lajeMat);
    laje.position.set(0, y0 - faixa / 2, 0);
    laje.castShadow = true;
    const piso = new THREE.Mesh(new THREE.PlaneGeometry(largura, fundoP), pisoMat);
    piso.rotation.x = -Math.PI / 2;
    piso.position.set(0, y0 + 0.0005 * celulaL, 0);
    piso.receiveShadow = true;
    const parede = new THREE.Mesh(new THREE.PlaneGeometry(largura, celulaA), paredeMat);
    parede.position.set(0, y0 + celulaA / 2, -fundoP / 2);
    parede.receiveShadow = true;
    root.add(laje, piso, parede);
    descartaveis.push(laje.geometry, piso.geometry, parede.geometry);
    for (let c = 0; c < colunas; c++) {
      const i = l * colunas + c;
      if (i >= ids.length) break;
      const x = -largura / 2 + celulaL * (c + 0.5);
      const caixa = caixas[i];
      const t = tamanhos[i];
      const centro = caixa.getCenter(new THREE.Vector3());
      const suporte = new THREE.Group();
      modelos[i].position.set(-centro.x, -caixa.min.y, -centro.z);
      suporte.add(modelos[i]);
      suporte.rotation.y = yaw;
      suporte.position.set(x, y0, 0);
      root.add(suporte);
      const n = contarTriangulos(modelos[i]);
      const texto = `${ids[i]}  ${t.x.toFixed(2)} x ${t.y.toFixed(2)} x ${t.z.toFixed(2)} m  ${n.triangulos} tri`;
      const tag = etiqueta(texto, celulaL * 0.96, faixa * 0.86);
      tag.position.set(x, y0 - faixa / 2, fundoP / 2 + 0.001 * celulaL);
      root.add(tag);
      descartaveis.push(tag.geometry, tag.material as THREE.Material, (tag.material as THREE.MeshBasicMaterial).map!);
      console.warn(
        `[acervo] ${ids[i]}: L ${t.x.toFixed(3)} A ${t.y.toFixed(3)} P ${t.z.toFixed(3)} m; ${n.triangulos} triangulos; ${n.malhas} malhas; ${n.materiais} materiais; base y ${caixa.min.y.toFixed(3)}; centro x ${centro.x.toFixed(3)} z ${centro.z.toFixed(3)}`,
      );
    }
  }
  return { peca: pecaDe(root, descartaveis), largura, altura, profundidade: fundoP, escala: Math.max(maiorPlanta, maiorAltura) };
}

interface Amostra {
  id: string;
  ladrilho: number;
}

function lerAmostras(lista: string): Amostra[] {
  return lista
    .split(',')
    .filter(Boolean)
    .map((item) => {
      const [id, lado] = item.split('@');
      return { id, ladrilho: Number(lado) || LADRILHOS[id] || 2 };
    });
}

/** Multiplicador da rugosidade das amostras (parâmetro rug): abaixo de 1 simula cera ou verniz. */
let rugosidade = 1;

async function materialDaAmostra(a: Amostra, larguraM: number, alturaM: number, semArm: Set<string>, cor: string | null, pasta: string): Promise<THREE.MeshStandardMaterial> {
  const maps: Array<'diff' | 'nor' | 'arm'> = semArm.has(a.id) ? ['diff', 'nor'] : ['diff', 'nor', 'arm'];
  const pbr = await loadPbr(pasta, { repeat: [larguraM / a.ladrilho, alturaM / a.ladrilho], maps });
  const mat = new THREE.MeshStandardMaterial({ ...pbr, roughness: (semArm.has(a.id) ? 0.8 : 1) * rugosidade, metalness: 0 });
  if (cor) mat.color.set(`#${cor}`);
  return mat;
}

/** Painéis verticais de 1,5 m com cada textura na escala real. */
async function montarTexturas(amostras: Amostra[], colunas: number, semArm: Set<string>, cor: string | null, sufixo: string): Promise<Montagem> {
  const root = new THREE.Group();
  root.name = 'acervo-texturas';
  const descartaveis: Array<{ dispose(): void }> = [];
  const lado = 1.5;
  const folga = 0.12;
  const faixa = 0.16;
  const passoX = lado + folga;
  const passoY = lado + faixa + folga;
  const linhas = Math.ceil(amostras.length / colunas);
  const largura = passoX * colunas + folga;
  const altura = passoY * linhas + folga;
  const fundoMat = new THREE.MeshStandardMaterial({ color: '#20140e', roughness: 0.95 });
  const fundo = new THREE.Mesh(new THREE.PlaneGeometry(largura, altura), fundoMat);
  fundo.position.set(0, altura / 2, -0.04);
  fundo.receiveShadow = true;
  root.add(fundo);
  descartaveis.push(fundo.geometry, fundoMat);
  const geo = new THREE.PlaneGeometry(lado, lado);
  descartaveis.push(geo);
  for (let i = 0; i < amostras.length; i++) {
    const a = amostras[i];
    const l = Math.floor(i / colunas);
    const c = i % colunas;
    const x = -largura / 2 + folga + passoX * c + lado / 2;
    const yTopo = altura - folga - passoY * l;
    const mat = await materialDaAmostra(a, lado, lado, semArm, cor, a.id + sufixo);
    const painel = new THREE.Mesh(geo, mat);
    painel.position.set(x, yTopo - lado / 2, 0);
    painel.receiveShadow = true;
    const tag = etiqueta(`${a.id}${sufixo}  ladrilho ${a.ladrilho} m  repeat ${(lado / a.ladrilho).toFixed(2)}`, lado, faixa * 0.86);
    tag.position.set(x, yTopo - lado - faixa / 2, 0.002);
    // um pino cilíndrico na frente de cada painel: a sombra longa mostra a direção da luz e o relevo que ela cruza
    const pino = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.1, 12), fundoMat);
    pino.rotation.x = Math.PI / 2;
    pino.position.set(x + lado * 0.36, yTopo - lado * 0.2, 0.05);
    pino.castShadow = true;
    root.add(painel, tag, pino);
    descartaveis.push(mat, tag.geometry, tag.material as THREE.Material, (tag.material as THREE.MeshBasicMaterial).map!, pino.geometry);
  }
  return { peca: pecaDe(root, descartaveis), largura, altura, profundidade: 0.1, escala: lado };
}

/** Amostras de piso deitadas (3 x 2,4 m), empilhadas em andares abertos atrás: a luz quente vem do fundo e mostra o brilho da cera. */
async function montarPisos(amostras: Amostra[], semArm: Set<string>, cor: string | null, sufixo: string): Promise<Montagem> {
  const root = new THREE.Group();
  root.name = 'acervo-pisos';
  const descartaveis: Array<{ dispose(): void }> = [];
  const larguraP = 3;
  const fundoP = 2.4;
  const faixa = 0.16;
  const vao = 1.35;
  const linhas = amostras.length;
  const altura = linhas * (vao + faixa);
  const lajeMat = new THREE.MeshStandardMaterial({ color: '#2a1a12', roughness: 0.9 });
  descartaveis.push(lajeMat);
  let poltrona: THREE.Group | null = null;
  try {
    poltrona = await loadModel('assets/modelos/ArmChair_01.glb');
  } catch {
    poltrona = null; // sem a poltrona, um cilindro faz a sombra
  }
  for (let l = 0; l < linhas; l++) {
    const a = amostras[l];
    const y0 = altura - (l + 1) * (vao + faixa) + faixa;
    const laje = new THREE.Mesh(new THREE.BoxGeometry(larguraP, faixa, fundoP), lajeMat);
    laje.position.set(0, y0 - faixa / 2, 0);
    laje.castShadow = true;
    const mat = await materialDaAmostra(a, larguraP, fundoP, semArm, cor, a.id + sufixo);
    const piso = new THREE.Mesh(new THREE.PlaneGeometry(larguraP, fundoP), mat);
    piso.rotation.x = -Math.PI / 2;
    piso.position.set(0, y0 + 0.002, 0);
    piso.receiveShadow = true;
    const tag = etiqueta(`${a.id}${sufixo}  ladrilho ${a.ladrilho} m  repeat ${(larguraP / a.ladrilho).toFixed(2)} x ${(fundoP / a.ladrilho).toFixed(2)}`, larguraP * 0.96, faixa * 0.86);
    tag.position.set(0, y0 - faixa / 2, fundoP / 2 + 0.003);
    root.add(laje, piso, tag);
    descartaveis.push(laje.geometry, mat, piso.geometry, tag.geometry, tag.material as THREE.Material, (tag.material as THREE.MeshBasicMaterial).map!);
    if (poltrona) {
      const copia = l === 0 ? poltrona : poltrona.clone(true);
      copia.position.set(-0.75, y0, -0.25);
      copia.rotation.y = 0.7;
      root.add(copia);
    } else {
      const pe = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.9, 20), lajeMat);
      pe.position.set(-0.75, y0 + 0.45, -0.25);
      pe.castShadow = true;
      root.add(pe);
      descartaveis.push(pe.geometry);
    }
  }
  return { peca: pecaDe(root, descartaveis), largura: larguraP, altura, profundidade: fundoP, escala: 1.5 };
}

export const buildVillageSet: BuildVillageSet = async (ctx) => {
  const params = new URLSearchParams(location.search);
  const num = (nome: string, padrao: number) => (params.has(nome) && Number.isFinite(Number(params.get(nome))) ? Number(params.get(nome)) : padrao);
  const lista = (nome: string) => (params.get(nome) ?? '').split(',').filter(Boolean);
  const neutra = params.get('luz') === 'neutra';
  const semArm = new Set(lista('semarm'));
  const cor = params.get('cor');
  const sufixo = params.get('res') === '2k' ? '_2k' : '';
  const kit: KitContext = ctx;
  rugosidade = num('rug', 1);

  let modo: 'modelos' | 'texturas' | 'pisos' = 'modelos';
  let m: Montagem;
  if (params.has('pisos')) {
    modo = 'pisos';
    m = await montarPisos(lerAmostras(params.get('pisos') ?? ''), semArm, cor, sufixo);
  } else if (params.has('texturas')) {
    modo = 'texturas';
    m = await montarTexturas(lerAmostras(params.get('texturas') ?? ''), Math.max(1, Math.round(num('colunas', 2))), semArm, cor, sufixo);
  } else {
    const ids = lista('modelos');
    m = await montarModelos(ids.length ? ids : ['ArmChair_01'], Math.max(1, Math.round(num('colunas', 2))), num('yaw', 0.5), { ocultar: lista('ocultar'), vidro: params.has('vidro') ? num('vidro', 0.12) : null, tintas: lista('tinta') });
  }

  // câmera quase ortográfica (lente bem longa), olhando um pouco de cima, enquadrando a montagem inteira
  const fov = 12;
  const tan = Math.tan(THREE.MathUtils.degToRad(fov / 2));
  const incl = modo === 'texturas' ? 0 : modo === 'pisos' ? THREE.MathUtils.degToRad(11) : INCLINACAO;
  const alturaVista = m.altura * Math.cos(incl) + m.profundidade * Math.sin(incl);
  const dist = Math.max(alturaVista / 2 / tan, m.largura / 2 / (tan * (9 / 16))) * 1.03 + m.profundidade;
  const alvo: [number, number, number] = [0, m.altura / 2, 0];
  let camera = {
    fov,
    position: [0, alvo[1] + dist * Math.sin(incl), dist * Math.cos(incl)] as [number, number, number],
    target: alvo,
    near: Math.max(dist * 0.2, 0.05),
    far: dist * 3 + 20,
  };
  // olho=x,y,z,ax,ay,az,fov : câmera manual para olhar um detalhe de perto
  const olho = lista('olho').map(Number);
  if (olho.length >= 6 && olho.every((v) => Number.isFinite(v))) {
    camera = { fov: olho[6] || 20, position: [olho[0], olho[1], olho[2]], target: [olho[3], olho[4], olho[5]], near: 0.05, far: 200 };
  }

  // luzes próprias, proporcionais ao tamanho da montagem (as do estúdio padrão ficam desligadas)
  const s = Math.max(m.largura, m.altura);
  const luzes = new THREE.Group();
  const descartaveis: Array<{ dispose(): void }> = [];
  const fogo = new THREE.SpotLight(neutra ? '#fff6ea' : '#ffb060', neutra ? 5 : 6, 0, 0.5, 0.6, 0);
  if (modo === 'texturas') {
    // rasante: quase paralela ao plano dos painéis, vinda da direita e um pouco de baixo (lareira)
    const r = THREE.MathUtils.degToRad(num('rasante', 18));
    fogo.position.set(s * 2.6 * Math.cos(r), m.altura / 2 - s * 0.5, s * 2.6 * Math.sin(r));
    fogo.angle = 0.42;
  } else if (modo === 'pisos') {
    // contraluz: atrás e à direita, baixa, entrando por baixo de cada laje
    fogo.position.set(s * 1.2, m.altura / 2 + s * 0.42, -s * 2.4);
    fogo.angle = 0.42;
  } else {
    // de frente e de lado, quase horizontal: entra em todos os nichos e deita sombras longas no piso
    fogo.position.set(s * 2.3, m.altura / 2 + s * 0.3, s * 2.3);
    fogo.angle = 0.42;
  }
  fogo.target.position.set(0, m.altura / 2, 0);
  fogo.castShadow = ctx.level !== 'baixa';
  fogo.shadow.mapSize.set(2048, 2048);
  fogo.shadow.bias = -0.0003;
  fogo.shadow.normalBias = Math.min(0.03, m.escala * 0.012);
  fogo.shadow.camera.near = s * 0.8;
  fogo.shadow.camera.far = s * 6;
  const lua = new THREE.DirectionalLight(neutra ? '#ffffff' : '#7f9ff0', neutra ? 1.6 : 0.45);
  lua.position.set(-s * 1.4, m.altura / 2 + s * 0.8, s * 2);
  lua.target.position.set(0, m.altura / 2, 0);
  const preenchimento = new THREE.HemisphereLight(neutra ? '#ffffff' : '#ffcf9a', neutra ? '#8a8a8a' : '#3a2418', neutra ? 1.1 : 0.22);
  luzes.add(fogo, fogo.target, lua, lua.target, preenchimento);
  m.peca.root.add(luzes);

  const ambiente = ambienteDeSala(ctx.renderer, neutra);
  descartaveis.push(ambiente);

  const set = await criarEstudio(kit, {
    pecas: [m.peca],
    camera,
    fundo: 'vazio',
    luzQuente: 0,
    luzFria: 0,
    look: {
      background: neutra ? '#3a3d42' : '#120b08',
      exposure: 1,
      environmentIntensity: neutra ? 0.8 : 0.7,
      ao: modo === 'texturas' ? null : { radius: Math.min(0.5, m.escala * 0.3), intensity: 1 },
      bloom: null,
      finish: { vignette: 0, warmth: neutra ? 0 : 0.12, grain: 0 },
    },
  });
  set.environment = ambiente;
  const descartarSet = set.dispose.bind(set);
  set.dispose = () => {
    descartarSet();
    for (const d of descartaveis) d.dispose();
  };
  return set;
};
