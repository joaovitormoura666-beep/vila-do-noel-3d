/**
 * Estúdio dos PRESENTES: os 12 presentes e a caixa sob uma luz parecida com a da sala A (fogo quente,
 * baixo e de lado; luar azul do outro lado; reflexos de uma sala escura e quente).
 *
 *   node tools/shot.cjs sala --param set=kit-presentes --out lab/fotos/presentes/folha.png             os 12 lado a lado
 *   node tools/shot.cjs sala --param set=kit-presentes --param mostrar=um --param presente=sino ...    um de perto
 *   node tools/shot.cjs sala --param set=kit-presentes --param mostrar=caixa ...                      caixa fechada e aberta
 *   node tools/shot.cjs sala --param set=kit-presentes --param mostrar=varios --param presente=sino,bola,globo
 *   node tools/shot.cjs sala --param set=kit-presentes --param mostrar=abertura ...                   a tampa abrindo em 4 tempos
 *
 * Parâmetros (só deste estúdio):
 *   mostrar=folha|um|varios|caixa|abertura   o que montar (padrão folha)
 *   presente=id[,id...]             para "um" e "varios"
 *   giro=0.5                        giro dos presentes em Y, em radianos (padrão 0,45); girar=1 gira com o tempo
 *   escala=0.42                     escala dos presentes (o cubo de 1 m vira 42 cm, o tamanho de tela no jogo)
 *   olho=x,y,z,ax,ay,az,fov         câmera manual
 *   abrir=1                         quanto a caixa aberta abriu (0 a 1, por root.userData.abrir)
 *   visual=0                        não aplica a escalaVisual de cada presente na folha
 *   rotulos=0                       esconde os nomes
 */
import * as THREE from 'three';
import type { BuildVillageSet, Look } from '../contracts';
import { GIFTS } from '../../gifts/giftCatalog';
import { criarEstudio } from '../kit/estudio';
import type { Peca } from '../kit/tipos';
import { criarCatalogo } from '../cast/presentes';

/** Etiqueta de texto (não recebe luz). */
function etiqueta(texto: string, largura: number, altura: number): THREE.Mesh {
  const tela = document.createElement('canvas');
  tela.width = 512;
  tela.height = Math.round((512 * altura) / largura);
  const c = tela.getContext('2d')!;
  c.font = `600 ${Math.round(tela.height * 0.62)}px Fredoka, system-ui, sans-serif`;
  c.fillStyle = 'rgba(20,10,6,0.55)';
  const w = Math.min(tela.width, c.measureText(texto).width + tela.height * 0.9);
  const x0 = (tela.width - w) / 2;
  c.beginPath();
  c.roundRect(x0, 2, w, tela.height - 4, (tela.height - 4) / 2);
  c.fill();
  c.fillStyle = '#f3dfb8';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(texto, tela.width / 2, tela.height / 2 + 2);
  const tex = new THREE.CanvasTexture(tela);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(largura, altura), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, depthWrite: false }));
  m.userData.semAO = true;
  return m;
}

/** Ambiente de reflexos de uma sala escura e quente: fogo baixo de um lado, janela azul do outro. */
function ambienteDeSala(renderer: THREE.WebGLRenderer): THREE.Texture {
  const tela = document.createElement('canvas');
  tela.width = 512;
  tela.height = 256;
  const c = tela.getContext('2d')!;
  const g = c.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#2a1a10');
  g.addColorStop(0.55, '#1c110b');
  g.addColorStop(1, '#3a2414');
  c.fillStyle = g;
  c.fillRect(0, 0, 512, 256);
  const fogo = c.createRadialGradient(400, 150, 4, 400, 150, 80);
  fogo.addColorStop(0, '#ffd9a0');
  fogo.addColorStop(0.25, '#ff9a45');
  fogo.addColorStop(1, 'rgba(120,50,10,0)');
  c.fillStyle = fogo;
  c.fillRect(290, 50, 220, 200);
  // luzinhas e abajur: pontos quentes pequenos (dão o brilho fino no metal)
  c.fillStyle = '#ffe2a8';
  for (const [x, y] of [
    [200, 110],
    [230, 95],
    [250, 120],
    [470, 90],
  ])
    c.fillRect(x, y, 6, 6);
  c.fillStyle = '#2c4a86';
  c.fillRect(60, 60, 70, 80);
  const tex = new THREE.CanvasTexture(tela);
  tex.colorSpace = THREE.SRGBColorSpace;
  const cena = new THREE.Scene();
  const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide });
  mat.color.setScalar(2.2);
  const esfera = new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), mat);
  cena.add(esfera);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(cena, 0.02).texture;
  pmrem.dispose();
  esfera.geometry.dispose();
  mat.dispose();
  tex.dispose();
  return env;
}

export const buildVillageSet: BuildVillageSet = async (ctx) => {
  const params = new URLSearchParams(location.search);
  const num = (k: string, padrao: number) => (params.has(k) && Number.isFinite(Number(params.get(k))) ? Number(params.get(k)) : padrao);
  const mostrar = params.get('mostrar') ?? 'folha';
  const giro = num('giro', 0.45);
  const girar = params.get('girar') === '1';
  const escala = num('escala', 0.42);
  const rotulos = params.get('rotulos') !== '0';
  const visual = params.get('visual') !== '0';

  const catalogo = criarCatalogo(ctx);
  await catalogo.pronto;

  const root = new THREE.Group();
  const vivos: THREE.Object3D[] = [];
  const giraveis: Array<{ o: THREE.Object3D; base: number }> = [];
  let camera: Look['camera'] = { fov: 30, position: [0, 1.45, 6.4], target: [0, 1.38, 0] };
  const medidas: Record<string, unknown> = {};

  const porPresente = (id: string, x: number, y: number, z = 0, s = escala) => {
    const g = catalogo.createGift(id);
    g.position.set(x, y, z);
    g.scale.setScalar(s);
    g.rotation.y = giro;
    root.add(g);
    vivos.push(g);
    giraveis.push({ o: g, base: giro });
    medidas[id] = catalogo.medir(id);
    return g;
  };

  if (mostrar === 'folha') {
    // 3 colunas x 4 linhas: a tela é vertical
    const cols = 3;
    const dx = 0.66;
    const dy = 0.74;
    GIFTS.forEach((def, i) => {
      const col = i % cols;
      const lin = Math.floor(i / cols);
      const x = (col - (cols - 1) / 2) * dx;
      const y = 2.95 - lin * dy;
      const g = porPresente(def.id, x, y);
      // como o jogo deve mostrar: os finos um pouco maiores (userData.escalaVisual)
      if (visual) g.scale.multiplyScalar((g.userData.escalaVisual as number | undefined) ?? 1);
      if (rotulos) {
        const e = etiqueta(def.name, 0.5, 0.07);
        e.position.set(x, y - 0.27, 0.25);
        root.add(e);
      }
    });
    camera = { fov: 30, position: [0, 1.85, 6.3], target: [0, 1.84, 0] };
  } else if (mostrar === 'um') {
    const id = params.get('presente') ?? 'estrela';
    porPresente(id, 0, 1.3);
    camera = { fov: 30, position: [0, 1.36, 1.55], target: [0, 1.3, 0] };
  } else if (mostrar === 'varios') {
    const ids = (params.get('presente') ?? 'estrela,bola,sino').split(',');
    ids.forEach((id, i) => porPresente(id, 0, 1.3 + ((ids.length - 1) / 2 - i) * 0.5));
    camera = { fov: 30, position: [0, 1.32, 0.6 + ids.length * 0.9], target: [0, 1.3, 0] };
  } else if (mostrar === 'caixa') {
    const fechada = catalogo.createGiftBox();
    fechada.root.position.set(-0.27, 0, 0.32);
    fechada.root.rotation.y = 0.5;
    const aberta = catalogo.createGiftBox();
    aberta.root.position.set(0.27, 0, -0.32);
    aberta.root.rotation.y = -0.35;
    (aberta.root.userData.abrir as (f: number) => void)(num('abrir', 1));
    root.add(fechada.root, aberta.root);
    // o presente saindo da caixa aberta
    const g = porPresente(params.get('presente') ?? 'estrela', 0.27, 0.5, -0.32, 0.36);
    g.rotation.y = 0.5;
    camera = { fov: 30, position: [0, 1.5, 4.5], target: [0, 0.42, 0] };
  } else if (mostrar === 'abertura') {
    // a mesma caixa em quatro tempos da abertura (f = 0; 0,25; 0,5 e 1), em grade 2 x 2
    [0, 0.25, 0.5, 1].forEach((f, i) => {
      const cx = catalogo.createGiftBox();
      const x = (i % 2 === 0 ? -1 : 1) * 0.4;
      const y = i < 2 ? 1.3 : 0.12;
      cx.root.position.set(x, y, 0);
      cx.root.rotation.y = 0.35;
      (cx.root.userData.abrir as (f: number) => void)(f);
      root.add(cx.root);
      if (rotulos) {
        const e = etiqueta(`abrir(${f})`, 0.5, 0.07);
        e.position.set(x, y - 0.1, 0.4);
        root.add(e);
      }
    });
    camera = { fov: 30, position: [0, 1.7, 5.3], target: [0, 0.86, 0] };
  }

  const peca: Peca = {
    root,
    update(dt, t) {
      for (const g of vivos) (g.userData.update as ((dt: number, t: number) => void) | undefined)?.(dt, t);
      if (girar) for (const { o, base } of giraveis) o.rotation.y = base + t * 0.6;
    },
    setQuality(level) {
      catalogo.setQuality(level);
    },
    dispose() {
      for (const g of vivos) (g.userData.dispose as (() => void) | undefined)?.();
      catalogo.dispose();
    },
  };

  if (params.has('olho')) {
    const [x, y, z, ax, ay, az, fov] = (params.get('olho') ?? '').split(',').map(Number);
    camera = { fov: fov || 30, position: [x, y, z], target: [ax, ay, az] };
  }
  const set = await criarEstudio(ctx, {
    pecas: [peca],
    camera,
    tamanho: 14,
    luzQuente: 0.8,
    luzFria: 0.8,
    look: {
      exposure: 1.1,
      environmentIntensity: 0.9,
      ao: { radius: 0.06, intensity: 0.9 },
      bloom: { strength: 0.2, radius: 0.5, threshold: 1.0 },
      finish: { vignette: 0.3, vignetteColor: '#140a06', warmth: 0.18, grain: 0.1 },
    },
  });
  set.environment = ambienteDeSala(ctx.renderer);
  // ?medir=1: os números de cada presente saem no console (o shot.cjs mostra os avisos)
  if (params.get('medir') === '1') console.warn('[presentes]', JSON.stringify(medidas));
  return set;
};
