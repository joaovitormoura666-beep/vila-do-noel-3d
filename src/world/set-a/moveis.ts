/**
 * Móveis e objetos da sala A: poucos, do acervo (Poly Haven, CC0), mais as peças de tecido do kit.
 *   poltrona do Noel (escala 1,5: o trono, no meio do tapete), lanterna acesa no piso ao lado dela,
 *   tina com achas ao lado da lareira, relógio e castiçal no console, duas meias penduradas na viga e
 *   uma guirlanda no peito da chaminé.
 * As posições vêm de ajustes.ts. Nada aqui tem relógio próprio.
 */
import * as THREE from 'three';
import { loadModel, loadPbr } from '../../engine/assets';
import type { Level } from '../contracts';
import type { Lareira } from '../kit/lareira';
import type { KitContext, Peca } from '../kit/tipos';
import { CONSOLE, LAREIRA, LUGAR, LUZ, PRIMEIRO_PLANO, SALA } from './ajustes';
import { criarSorteio, entre, fundir, preparar } from './geo';
import { carregarGuirlanda, carregarMeia } from './pecas';

export interface Moveis {
  root: THREE.Group;
  /** Onde fica a chama da lanterna (mundo), para a luz pontual dela. */
  chamaDoLampiao: THREE.Vector3;
  update(dt: number, t: number): void;
  setQuality(level: Level): void;
  dispose(): void;
}

/** Vidros do acervo vêm escuros ou opacos: receita do catálogo (vidro claro, quase invisível, sem sombra). */
function clarearVidros(modelo: THREE.Object3D, lixo: Array<{ dispose(): void }>) {
  modelo.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const original = m.material as THREE.MeshStandardMaterial;
    if (!/glass/i.test(original.name)) return;
    const vidro = original.clone();
    vidro.map = null;
    vidro.roughnessMap = null;
    vidro.metalnessMap = null;
    vidro.color.set('#fff2dc');
    vidro.roughness = 0.08;
    vidro.metalness = 0;
    vidro.transparent = true;
    vidro.opacity = 0.14;
    vidro.depthWrite = false;
    m.material = vidro;
    m.castShadow = false;
    lixo.push(vidro);
  });
}

/** Põe a base do objeto em y = 0 e o centro em x = z = 0 (para nós tirados de dentro de um GLB). */
function assentar(o: THREE.Object3D): THREE.Group {
  const g = new THREE.Group();
  g.add(o);
  o.position.set(0, 0, 0);
  o.updateMatrixWorld(true);
  const caixa = new THREE.Box3().setFromObject(o);
  const centro = caixa.getCenter(new THREE.Vector3());
  o.position.set(-centro.x, -caixa.min.y, -centro.z);
  return g;
}

/**
 * Onde fica a face da pedra da lareira em (x, y), em coordenadas da peça: lança um raio de frente para trás
 * e devolve o z do primeiro bloco atingido. Serve para pendurar coisas no peito da chaminé sem depender
 * das medidas internas da peça. Sem pedra no caminho (ou sem lareira), devolve `reserva`.
 */
function faceDaPedra(lareira: Lareira, x: number, y: number, reserva: number): number {
  lareira.root.updateMatrixWorld(true);
  const origem = lareira.root.localToWorld(new THREE.Vector3(x, y, LAREIRA.profundidade + 2));
  const direcao = new THREE.Vector3(0, 0, -1).transformDirection(lareira.root.matrixWorld);
  const raio = new THREE.Raycaster(origem, direcao, 0, LAREIRA.profundidade + 2.2);
  for (const toque of raio.intersectObject(lareira.root, true)) {
    const m = toque.object as THREE.Mesh;
    if (!m.isMesh || !m.visible) continue;
    const mat = m.material as THREE.Material;
    if (Array.isArray(mat) || mat.transparent || (mat as THREE.ShaderMaterial).isShaderMaterial) continue;
    return lareira.root.worldToLocal(toque.point.clone()).z;
  }
  return reserva;
}

/** Achas de lenha rachada para a tina (o acervo não tem lenha): cilindros de casca real com o topo claro. */
async function criarAchas(lixo: Array<{ dispose(): void }>): Promise<THREE.Mesh> {
  const r = criarSorteio(41);
  const mapas = await loadPbr('pine_bark', { maps: ['diff', 'nor'], repeat: [2, 1] });
  const mat = new THREE.MeshStandardMaterial({ ...mapas, roughness: 0.92, metalness: 0, vertexColors: true });
  const geos: THREE.BufferGeometry[] = [];
  const n = 8;
  for (let i = 0; i < n; i++) {
    const raio = entre(r, 0.045, 0.075);
    const comp = entre(r, 0.42, 0.56);
    const g = preparar(new THREE.CylinderGeometry(raio, raio * entre(r, 0.85, 1), comp, 9, 1));
    // topos claros (madeira rachada), casca escura
    const nor = g.getAttribute('normal');
    const cor = g.getAttribute('color');
    for (let k = 0; k < cor.count; k++) {
      if (Math.abs(nor.getY(k)) > 0.9) cor.setXYZ(k, 2.1, 1.6, 1.05);
      else cor.setXYZ(k, 0.85, 0.8, 0.75);
    }
    // de pé dentro da tina, cada uma inclinada para um lado
    const ang = (i / n) * Math.PI * 2 + r();
    const dist = i === 0 ? 0 : entre(r, 0.1, 0.19);
    g.rotateZ(entre(r, -0.22, 0.22));
    g.rotateX(entre(r, -0.22, 0.22));
    g.rotateY(r() * 6.28);
    g.translate(Math.cos(ang) * dist, 0.1 + comp / 2 + r() * 0.05, Math.sin(ang) * dist);
    geos.push(g);
  }
  const geo = fundir(geos);
  const malha = new THREE.Mesh(geo, mat);
  malha.name = 'achas';
  malha.castShadow = true;
  malha.receiveShadow = true;
  lixo.push(geo, mat, ...(Object.values(mapas) as THREE.Texture[]));
  return malha;
}

export async function criarMoveis(ctx: KitContext, lareira: Lareira): Promise<Moveis> {
  const root = new THREE.Group();
  root.name = 'moveis';
  const lixo: Array<{ dispose(): void }> = [];
  const pecas: Peca[] = [];
  const chama = new THREE.MeshBasicMaterial({ color: new THREE.Color(LUZ.chama.cor).multiplyScalar(LUZ.chama.forca), toneMapped: true });
  chama.name = 'chama-acesa';
  lixo.push(chama);

  const [poltrona, lampiao, tina, relogio, casticais, balanco] = await Promise.all([
    loadModel('assets/modelos/ArmChair_01.glb', { envMapIntensity: 0.9 }),
    loadModel('assets/modelos/wooden_lantern_01.glb', { envMapIntensity: 1.0 }),
    loadModel('assets/modelos/wooden_bucket_02.glb'),
    loadModel('assets/modelos/mantel_clock_01.glb', { envMapIntensity: 1.2 }),
    loadModel('assets/modelos/brass_candleholders.glb', { envMapIntensity: 1.4 }),
    loadModel('assets/modelos/Rockingchair_01.glb', { envMapIntensity: 0.6 }),
  ]);

  /* ----------------------------------------------------- poltrona do Noel */
  poltrona.scale.setScalar(LUGAR.poltrona.escala);
  poltrona.position.set(LUGAR.poltrona.x, 0, LUGAR.poltrona.z);
  poltrona.rotation.y = LUGAR.poltrona.giro;
  root.add(poltrona);

  /* ------------------------------ primeiro plano: cadeira de balanço */
  // de costas para a câmera, virada para o fogo: uma silhueta escura no canto de baixo, cortada pela borda
  const pp = PRIMEIRO_PLANO.balanco;
  balanco.position.set(pp.x, -0.102, pp.z); // o modelo vem com a base 10 cm acima do zero
  balanco.rotation.y = pp.giro;
  balanco.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const escuro = (m.material as THREE.MeshStandardMaterial).clone();
    escuro.color.multiplyScalar(pp.tom);
    m.material = escuro;
    lixo.push(escuro);
  });
  root.add(balanco);

  /* ------------------------- lanterna acesa no piso, ao lado da poltrona */
  // baixa (0,53 m): um ponto quente perto do Noel sem entrar na silhueta dele
  clarearVidros(lampiao, lixo);
  const L = LUGAR.lanterna;
  lampiao.position.set(L.x, 0.011, L.z); // o modelo vem com a base 1 cm abaixo do zero
  lampiao.rotation.y = L.giro;
  root.add(lampiao);
  // a lanterna vem sem vela: uma vela curta com chama emissiva dentro da caixa
  const vela = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.024, 0.09, 12), new THREE.MeshStandardMaterial({ color: '#efe2c8', roughness: 0.6, emissive: '#ff9a40', emissiveIntensity: 0.25 }));
  vela.position.set(L.x, 0.1, L.z);
  const gotaLanterna = new THREE.Mesh(new THREE.SphereGeometry(0.014, 10, 8).scale(1, 2.2, 1), chama);
  gotaLanterna.position.set(L.x, 0.18, L.z);
  gotaLanterna.userData.semAO = true;
  root.add(vela, gotaLanterna);
  lixo.push(vela.geometry, vela.material as THREE.Material, gotaLanterna.geometry);
  const chamaDoLampiao = new THREE.Vector3(L.x, 0.22, L.z);

  /* -------------------------------- tina com achas, entre a lareira e o canto */
  const xTina = SALA.xEsq + 0.55;
  const zTina = LAREIRA.z + LAREIRA.largura / 2 + 0.48;
  tina.position.set(xTina, 0, zTina);
  tina.rotation.y = 0.4;
  const achas = await criarAchas(lixo);
  achas.position.set(xTina, 0, zTina);
  root.add(tina, achas);

  /* ------------------------------------- console da lareira (espaço da peça) */
  // mesmo lugar e giro da lareira: aqui x corre ao longo do console e z avança para a sala
  const noConsole = new THREE.Group();
  noConsole.position.copy(lareira.root.position);
  noConsole.rotation.copy(lareira.root.rotation);
  root.add(noConsole);
  const c = lareira.console;
  // do lado de cá (x negativo = mais perto da câmera) ficam o castiçal e as meias; o relógio no meio
  relogio.position.set(CONSOLE.relogio, c.y, c.z);
  relogio.rotation.y = -0.25;
  noConsole.add(relogio);
  const castical = casticais.getObjectByName('brass_candleholder_02');
  if (castical) {
    const peca = assentar(castical);
    peca.position.set(CONSOLE.castical, c.y, c.z);
    peca.rotation.y = 0.25;
    noConsole.add(peca);
    // chamas das três velas (a peça vem apagada): gotas emissivas no topo de cada vela
    peca.updateMatrixWorld(true);
    let velas: THREE.Mesh | null = null;
    peca.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && /candles/i.test((m.material as THREE.Material).name)) velas = m;
    });
    if (velas) {
      const caixaVelas = new THREE.Box3().setFromObject(velas);
      const gota = new THREE.SphereGeometry(0.011, 8, 6);
      gota.scale(1, 2.1, 1);
      lixo.push(gota);
      const local = peca.worldToLocal.bind(peca);
      // o castiçal está girado junto com a lareira: as três velas se alinham ao longo do console (Z do mundo)
      for (const f of [0.03, 0.5, 0.97]) {
        const p = new THREE.Vector3((caixaVelas.min.x + caixaVelas.max.x) / 2, caixaVelas.max.y + 0.02, THREE.MathUtils.lerp(caixaVelas.min.z, caixaVelas.max.z, f));
        const m = new THREE.Mesh(gota, chama);
        m.position.copy(local(p));
        m.userData.semAO = true;
        peca.add(m);
      }
    }
  }
  // meias penduradas na frente da viga, sobre o pilar de pedra do lado de cá (não tapam o fogo)
  const zGancho = c.z + c.profundidade / 2 + 0.035;
  const meias = await Promise.all([
    carregarMeia(ctx, { corDetalhe: '#d9cfb8', virada: 'esquerda', semente: 1 }),
    carregarMeia(ctx, { cor: '#1d5240', corDetalhe: '#b9343c', virada: 'esquerda', semente: 4, tamanho: 0.42 }),
  ]);
  meias.forEach((m, i) => {
    m.root.position.set(CONSOLE.meias[i], c.y - 0.07, zGancho);
    m.root.rotation.y = CONSOLE.giroDasMeias; // um pouco viradas para a câmera
    noConsole.add(m.root);
    pecas.push(m);
  });
  // guirlanda no peito da chaminé, acima do console: encostada no bloco mais saliente atrás dela
  const RAIO_GUIRLANDA = CONSOLE.guirlanda.raio;
  const yGuirlanda = c.y + CONSOLE.guirlanda.altura;
  let zPeito = -Infinity;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    zPeito = Math.max(zPeito, faceDaPedra(lareira, Math.cos(a) * RAIO_GUIRLANDA, yGuirlanda + Math.sin(a) * RAIO_GUIRLANDA, LAREIRA.profundidade * 0.66));
  }
  const guirlanda = await carregarGuirlanda(ctx, { raio: RAIO_GUIRLANDA, laco: true, semente: 21 });
  guirlanda.root.position.set(0, yGuirlanda, zPeito + 0.07);
  noConsole.add(guirlanda.root);
  pecas.push(guirlanda);

  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m.userData.semAO !== true && !(m.material as THREE.Material).transparent) m.receiveShadow = true;
  });
  // economia: só a poltrona e as achas projetam sombra (o resto fica fora do cone do fogo ou é miúdo)
  for (const semSombra of [lampiao, tina, noConsole]) semSombra.traverse((o) => (o.castShadow = false));

  return {
    root,
    chamaDoLampiao,
    update(dt, t) {
      for (const p of pecas) p.update(dt, t);
    },
    setQuality(level) {
      for (const p of pecas) p.setQuality(level);
    },
    dispose() {
      for (const p of pecas) p.dispose();
      for (const l of lixo) l.dispose();
    },
  };
}
