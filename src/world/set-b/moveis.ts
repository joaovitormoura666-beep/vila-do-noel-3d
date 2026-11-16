/**
 * Móveis e objetos da sala B, todos do acervo (Poly Haven, CC0): a poltrona do Noel no recanto entre a
 * árvore e a lareira, o relógio e os castiçais sobre o console e a lanterna pendurada na tesoura (a luz
 * de leitura da poltrona, que justifica a poça de luz quente do lugar do Noel). Poucas peças, de propósito.
 */
import * as THREE from 'three';
import { loadModel } from '../../engine/assets';
import { MATERIAIS, PECAS } from './ajustes';

export interface Moveis {
  root: THREE.Group;
  /** Posição (no mundo) da chama da lanterna pendurada. */
  chamaLanterna: THREE.Vector3;
  /** Faz as chamas respirarem. brilho = tremor comum (perto de 1). */
  update(t: number): void;
  dispose(): void;
}

export interface ApoioConsole {
  /** Transformação da lareira (para pôr objetos no espaço dela). */
  posicao: THREE.Vector3;
  giroY: number;
  /** Tampo do console, no espaço da lareira. */
  y: number;
  z: number;
  largura: number;
}

/** Troca os materiais do modelo por cópias (os modelos em cache são compartilhados) e aplica um ajuste. */
function materiaisProprios(modelo: THREE.Object3D, ajustar: (m: THREE.MeshStandardMaterial, malha: THREE.Mesh) => void, lixo: Array<{ dispose(): void }>) {
  const copias = new Map<THREE.Material, THREE.MeshStandardMaterial>();
  modelo.traverse((o) => {
    const malha = o as THREE.Mesh;
    if (!malha.isMesh) return;
    const original = malha.material as THREE.MeshStandardMaterial;
    let copia = copias.get(original);
    if (!copia) {
      copia = original.clone();
      copias.set(original, copia);
      lixo.push(copia);
      ajustar(copia, malha);
    } else if (copia.name.includes('glass')) malha.castShadow = false;
    malha.material = copia;
  });
}

/** Receita do catálogo para os vidros que vêm opacos. */
function vidroClaro(m: THREE.MeshStandardMaterial, malha: THREE.Mesh, opacidade = 0.14) {
  m.map = null;
  m.roughnessMap = null;
  m.metalnessMap = null;
  m.color.set('#fff2dc');
  m.roughness = 0.08;
  m.metalness = 0;
  m.transparent = true;
  m.opacity = opacidade;
  m.depthWrite = false;
  malha.castShadow = false;
}

export async function criarMoveis(console_: ApoioConsole, alturaLinhaTesoura: number): Promise<Moveis> {
  const root = new THREE.Group();
  root.name = 'sala-b-moveis';
  const lixo: Array<{ dispose(): void }> = [];
  const [poltrona, relogio, casticais, lanterna] = await Promise.all([
    loadModel('assets/modelos/ArmChair_01.glb'),
    loadModel('assets/modelos/mantel_clock_01.glb'),
    loadModel('assets/modelos/brass_candleholders.glb'),
    loadModel('assets/modelos/wooden_lantern_01.glb'),
  ]);
  const reflexo = MATERIAIS.reflexoMoveis;
  const chamas: THREE.MeshStandardMaterial[] = [];

  /* ---------------------------------------------------- poltrona do Noel */
  materiaisProprios(
    poltrona,
    (m) => {
      m.envMapIntensity = reflexo;
      m.color.multiply(new THREE.Color(PECAS.poltrona.tinta)); // estofado cru tingido de vinho: não disputa com a árvore
    },
    lixo,
  );
  poltrona.scale.setScalar(PECAS.poltrona.escala);
  poltrona.position.set(PECAS.poltrona.x, 0, PECAS.poltrona.z);
  poltrona.rotation.y = PECAS.poltrona.giro;
  root.add(poltrona);

  /* ------------------------------------------------ console da lareira */
  const sobreConsole = new THREE.Group();
  sobreConsole.position.copy(console_.posicao);
  sobreConsole.rotation.y = console_.giroY;
  root.add(sobreConsole);
  materiaisProprios(relogio, (m, malha) => (m.name.includes('glass') ? (malha.castShadow = false) : (m.envMapIntensity = reflexo * 1.3)), lixo);
  relogio.scale.setScalar(1.5);
  relogio.position.set(0.02, console_.y, console_.z);
  relogio.rotation.y = 0.06;
  sobreConsole.add(relogio);
  materiaisProprios(casticais, (m) => (m.envMapIntensity = reflexo * 1.6), lixo);
  const pegar = (nome: string, x: number, giro: number, escala: number) => {
    const no = casticais.getObjectByName(nome);
    if (!no) return;
    const suporte = new THREE.Group();
    const yBase = no.position.y;
    no.position.set(0, yBase, 0);
    suporte.add(no);
    suporte.scale.setScalar(escala);
    suporte.position.set(x, console_.y, console_.z);
    suporte.rotation.y = giro;
    sobreConsole.add(suporte);
  };
  pegar('brass_candleholder_02', -0.82, 0.3, 1.25);
  pegar('brass_candleholder_01', 0.78, 0.9, 1.3);

  /* ------------------------------------------- lanterna pendurada na tesoura */
  const escalaLanterna = 1.35;
  const xL = PECAS.lanterna.x;
  const zL = PECAS.lanterna.z;
  const yGancho = alturaLinhaTesoura; // face de baixo da linha da tesoura
  const comprimentoCorda = PECAS.lanterna.corda;
  const alturaLanterna = 0.53 * escalaLanterna;
  const yLanterna = yGancho - comprimentoCorda - alturaLanterna;
  materiaisProprios(
    lanterna,
    (m, malha) => {
      if (m.name.includes('glass')) vidroClaro(m, malha, 0.2);
      else m.envMapIntensity = reflexo;
    },
    lixo,
  );
  lanterna.scale.setScalar(escalaLanterna);
  lanterna.position.set(xL, yLanterna, zL);
  lanterna.rotation.y = 0.7;
  root.add(lanterna);
  // corda torcida do gancho à alça (tubo fino com leve barriga) e a chama de vela lá dentro
  {
    const curva = new THREE.CatmullRomCurve3([new THREE.Vector3(xL, yGancho + 0.02, zL), new THREE.Vector3(xL + 0.006, yGancho - comprimentoCorda * 0.5, zL - 0.004), new THREE.Vector3(xL, yLanterna + alturaLanterna - 0.02, zL)]);
    const geoCorda = new THREE.TubeGeometry(curva, 10, 0.011, 6, false);
    const matCorda = new THREE.MeshStandardMaterial({ color: '#5b4630', roughness: 0.95 });
    const corda = new THREE.Mesh(geoCorda, matCorda);
    corda.castShadow = false;
    root.add(corda);
    lixo.push(geoCorda, matCorda);
    const geoChama = new THREE.SphereGeometry(0.5, 10, 8);
    geoChama.scale(0.05, 0.11, 0.05);
    const matChama = new THREE.MeshStandardMaterial({ color: '#000000', emissive: '#ffb45e', emissiveIntensity: 7, roughness: 1 });
    const chama = new THREE.Mesh(geoChama, matChama);
    chama.position.set(xL, yLanterna + alturaLanterna * 0.42, zL);
    chama.userData.semAO = true;
    root.add(chama);
    chamas.push(matChama);
    lixo.push(geoChama, matChama);
  }
  const chamaLanterna = new THREE.Vector3(xL, yLanterna + alturaLanterna * 0.42, zL);

  const bases = chamas.map((m) => m.emissiveIntensity);
  return {
    root,
    chamaLanterna,
    update(t) {
      // respiração lenta e desigual das chamas (soma de senos de períodos primos entre si)
      chamas.forEach((m, i) => {
        const k = 1 + 0.07 * Math.sin(t * 5.1 + i * 2.3) + 0.05 * Math.sin(t * 8.7 + i * 1.1) + 0.04 * Math.sin(t * 13.3 + i);
        m.emissiveIntensity = bases[i] * k;
      });
    },
    dispose() {
      for (const d of lixo) d.dispose();
    },
  };
}
