/**
 * Luzes da sala A (além das que as peças do kit trazem: três da lareira e uma da árvore).
 *   luar         spot azul estreito e distante, com sombra, atravessando a janela: desenha no piso o
 *                recorte do vão com as travessas. Só ilumina o cone que passa pelo vão (não vaza).
 *                Cor e força copiadas de exterior.luzExterna a cada quadro.
 *   remendo      nos níveis médio e baixo o luar fica sem sombra: sai o spot e entra uma "poça pintada"
 *                (o recorte da janela projetado no piso, desenhado em textura).
 *   preenchimento hemisférica quente e baixa: sombras marrom-avermelhadas, nunca pretas.
 *   lampião      pontual curta no peitoril da janela.
 *   rebatida     pontual quente no meio da sala, sem sombra: o clarão que o piso devolve às vigas.
 *   noel         spot quente e largo, do alto e da frente, sobre o tapete: a poça de luz do lugar do Noel
 *                (e a luz que acende o rosto dele, que fica de costas para o fogo).
 *   entrega      spot quente de cima sobre a área de entrega (setDeliveryActive), aceso aos poucos.
 *   fila         spot quente, largo e fraco do lado da câmera sobre o piso da fila (jogo 3D): os visitantes são
 *                vistos de costas e o fogo pega o outro lado deles; sem isto viram uma massa escura.
 * Total com as peças: 11 luzes (10 com a entrega apagada), duas com sombra (fogo e luar).
 */
import * as THREE from 'three';
import type { Level } from '../contracts';
import type { Exterior } from '../kit/exterior';
import { JANELA, LUGAR, LUZ } from './ajustes';
import { criarAncoras } from './ancoras';

export interface LuzesDaSala {
  root: THREE.Group;
  luar: THREE.SpotLight;
  preenchimento: THREE.HemisphereLight;
  lampiao: THREE.PointLight;
  rebatida: THREE.PointLight;
  noel: THREE.SpotLight;
  entrega: THREE.SpotLight;
  /** Preenchimento da fila (jogo 3D): quente, largo, sem sombra, do lado da câmera. */
  fila: THREE.SpotLight;
  /** Objetos que só precisam projetar sombra para o luar (parede do vão, caixilho): ligados só nos quadros em que o mapa do luar é refeito. */
  sombrasSoDoLuar(objetos: THREE.Object3D[]): void;
  update(dt: number, t: number): void;
  setQuality(level: Level): void;
  setEntrega(ligada: boolean): void;
  dispose(): void;
}

/** O recorte da janela (vidros claros, madeira escura) desenhado em textura, para a poça pintada. */
function texturaDoRecorte(contorno: THREE.Vector2[], largura: number, base: number, altura: number): THREE.CanvasTexture {
  const N = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = N;
  const c = canvas.getContext('2d')!;
  c.fillStyle = '#000';
  c.fillRect(0, 0, N, N);
  const px = (x: number) => ((x + largura / 2) / largura) * N;
  const py = (y: number) => N - ((y - base) / altura) * N;
  // vidro: o contorno do vão, recuado pela largura do marco e das folhas
  const RECUO = 0.16;
  const cx = 0;
  const cy = base + altura / 2;
  c.fillStyle = '#fff';
  c.beginPath();
  contorno.forEach((p, i) => {
    const dx = p.x - cx;
    const dy = p.y - cy;
    const x = p.x - Math.sign(dx) * Math.min(RECUO, Math.abs(dx));
    const y = p.y - Math.sign(dy) * Math.min(RECUO, Math.abs(dy));
    if (i === 0) c.moveTo(px(x), py(y));
    else c.lineTo(px(x), py(y));
  });
  c.closePath();
  c.fill();
  // travessas e pinázios
  c.fillStyle = '#000';
  const flecha = Math.min(largura * 0.2, altura - 1.9);
  const yTrav = base + altura - flecha - 0.3;
  const barraV = (x: number, w: number) => c.fillRect(px(x - w / 2), 0, (w / largura) * N, N);
  const barraH = (y: number, h: number) => c.fillRect(0, py(y + h / 2), N, (h / altura) * N);
  barraV(0, 0.15);
  for (let i = 1; i < JANELA.colunas; i++) if (i !== JANELA.colunas / 2) barraV(-largura / 2 + (largura * i) / JANELA.colunas, 0.045);
  barraH(yTrav, 0.22);
  const y0 = base + 0.16;
  const y1 = yTrav - 0.11;
  for (let i = 1; i < JANELA.linhas; i++) barraH(y0 + ((y1 - y0) * i) / JANELA.linhas, 0.045);
  // amacia as bordas (a penumbra do luar)
  c.filter = 'blur(3px)';
  c.drawImage(canvas, 0, 0);
  c.filter = 'none';
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function criarLuzes(exterior: Exterior, direcaoDaLua: THREE.Vector3, contornoJanela: THREE.Vector2[], zVidro: number, chamaDoLampiao: THREE.Vector3): LuzesDaSala {
  const root = new THREE.Group();
  root.name = 'luzes';

  /* ------------------------------------------------------------------ luar */
  // direção PARA a lua: o azimute é o de onde a câmera vê o disco pela janela (coerente com o exterior, que a
  // composição gira como um fundo de cinema); a altura é LUZ.luar.elevacao
  const azimute = Math.atan2(direcaoDaLua.x, -direcaoDaLua.z);
  const elev = THREE.MathUtils.degToRad(LUZ.luar.elevacao);
  const paraLua = new THREE.Vector3(Math.sin(azimute) * Math.cos(elev), Math.sin(elev), -Math.cos(azimute) * Math.cos(elev));
  const centro = new THREE.Vector3(JANELA.x, JANELA.peitoril + JANELA.altura / 2, zVidro);
  const raio = Math.hypot(JANELA.largura / 2, JANELA.altura / 2) + LUZ.luar.folga;
  const D = LUZ.luar.distancia;
  const luar = new THREE.SpotLight(exterior.luar.cor, exterior.luar.intensidade * LUZ.luar.ganho, 0, Math.atan(raio / D), 0.12, 0);
  luar.name = 'luar-da-janela';
  luar.position.copy(centro).addScaledVector(paraLua, D);
  luar.target.position.copy(centro);
  luar.castShadow = true;
  luar.shadow.mapSize.set(LUZ.luar.mapa, LUZ.luar.mapa);
  luar.shadow.camera.near = D - 7;
  luar.shadow.camera.far = D + 16;
  luar.shadow.bias = -0.0003;
  luar.shadow.normalBias = 0.015;
  luar.shadow.radius = 2.2;
  // a sombra do luar quase não muda (parede, caixilho, árvore e móveis não se mexem; só os personagens): o mapa
  // é refeito nos primeiros quadros, quando o nível muda e, depois, um quadro a cada LUZ.luar.refazerACada
  luar.shadow.autoUpdate = false;
  let quadrosDeSombra = 8;
  let quadro = 0;
  let soDoLuar: THREE.Object3D[] = [];
  root.add(luar, luar.target);

  /* --------------------------------------------- poça pintada (médio e baixo) */
  // cada ponto (x, y) do vão cai no piso em (x + kx·y, zVidro + kz·y): um paralelogramo
  const kx = -paraLua.x / paraLua.y;
  const kz = -paraLua.z / paraLua.y;
  const xa = -JANELA.largura / 2;
  const xb = JANELA.largura / 2;
  const ya = JANELA.peitoril;
  const yb = JANELA.peitoril + JANELA.altura;
  const noPiso = (x: number, y: number) => [JANELA.x + x + kx * y, 0.03, zVidro + kz * y];
  const geoPoca = new THREE.BufferGeometry();
  geoPoca.setAttribute('position', new THREE.Float32BufferAttribute([...noPiso(xa, ya), ...noPiso(xb, ya), ...noPiso(xa, yb), ...noPiso(xb, yb)], 3));
  geoPoca.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 1, 1], 2));
  geoPoca.setIndex([0, 2, 1, 1, 2, 3]);
  const texPoca = texturaDoRecorte(contornoJanela, JANELA.largura, JANELA.peitoril, JANELA.altura);
  const matPoca = new THREE.MeshBasicMaterial({ map: texPoca, color: '#000', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: true });
  const poca = new THREE.Mesh(geoPoca, matPoca);
  poca.name = 'luar-pintado';
  poca.userData.semAO = true;
  poca.renderOrder = 1;
  poca.visible = false;
  root.add(poca);

  /* ---------------------------------------------------------- luzes quentes */
  const preenchimento = new THREE.HemisphereLight(LUZ.preenchimento.ceu, LUZ.preenchimento.chao, LUZ.preenchimento.forca);
  preenchimento.name = 'preenchimento';
  const lampiao = new THREE.PointLight(LUZ.lampiao.cor, LUZ.lampiao.forca, LUZ.lampiao.alcance, 1.6);
  lampiao.name = 'luz-do-lampiao';
  lampiao.position.copy(chamaDoLampiao);
  const rebatida = new THREE.PointLight(LUZ.rebatida.cor, LUZ.rebatida.forca, LUZ.rebatida.alcance, 1.1);
  rebatida.name = 'luz-rebatida-da-sala';
  rebatida.position.set(LUZ.rebatida.x, LUZ.rebatida.y, LUZ.rebatida.z);
  const entrega = new THREE.SpotLight(LUZ.entrega.cor, 0, 12, LUZ.entrega.angulo, 0.9, 1.2);
  entrega.name = 'destaque-da-entrega';
  const ancoras = criarAncoras();
  const pontoDaEntrega = ancoras.delivery.position;
  // mais perto do visitante que do Noel (o Noel já tem a poça de luz dele): acende quem está sendo atendido
  const meio = ancoras.santa.position.clone().lerp(pontoDaEntrega, 0.68);
  entrega.position.set(meio.x + 0.6, LUZ.entrega.altura, meio.z + 1.4);
  entrega.target.position.set(meio.x, 0.3, meio.z);
  const noel = new THREE.SpotLight(LUZ.noel.cor, LUZ.noel.forca, 14, LUZ.noel.angulo, 1, 1.2);
  noel.name = 'luz-do-lugar-do-noel';
  noel.position.set(LUGAR.noel.x + LUZ.noel.dx, LUZ.noel.altura, LUGAR.noel.z + LUZ.noel.dz);
  noel.target.position.set(LUGAR.noel.x, 1.0, LUGAR.noel.z);
  const fila = new THREE.SpotLight(LUZ.fila.cor, LUZ.fila.forca, 0, LUZ.fila.angulo, 1, 1.2);
  fila.name = 'preenchimento-da-fila';
  fila.position.set(...LUZ.fila.posicao);
  fila.target.position.set(...LUZ.fila.alvo);
  root.add(preenchimento, lampiao, rebatida, noel, noel.target, entrega, entrega.target, fila, fila.target);

  let nivel: Level = 'alta';
  let alvoEntrega = 0;
  let forcaEntrega = 0;
  const corPoca = new THREE.Color();
  // quanto da luz de fora vira brilho no piso encerado (a poça pintada não passa pelo material do piso)
  const ALBEDO_PISO = 0.13;

  return {
    root,
    luar,
    preenchimento,
    lampiao,
    rebatida,
    noel,
    entrega,
    fila,
    sombrasSoDoLuar(objetos) {
      soDoLuar = objetos;
    },
    update(dt, t) {
      // a luz da janela acompanha o exterior (a noite mágica muda a cor e faz a força respirar)
      const fora = exterior.luzExterna;
      luar.color.copy(fora.cor);
      luar.intensity = nivel === 'alta' ? fora.intensidade * LUZ.luar.ganho : 0;
      corPoca.copy(fora.cor).multiplyScalar(fora.intensidade * LUZ.luar.ganho * ALBEDO_PISO);
      matPoca.color.copy(corPoca);
      quadro++;
      const refazer = nivel === 'alta' && (quadrosDeSombra > 0 || quadro % LUZ.luar.refazerACada === 0);
      if (quadrosDeSombra > 0) quadrosDeSombra--;
      if (refazer) luar.shadow.needsUpdate = true;
      // o pedido fica pendente até o renderizador refazer o mapa (ele baixa needsUpdate): enquanto isso, quem só
      // projeta para o luar continua ligado, mesmo que update rode várias vezes entre dois quadros desenhados
      const pendente = nivel === 'alta' && luar.shadow.needsUpdate;
      for (const o of soDoLuar) o.castShadow = pendente;
      // o lampião treme pouco e devagar (dois ruídos somados, sem seno regular à vista)
      const tremor = 1 + 0.05 * Math.sin(t * 7.3 + Math.sin(t * 2.1) * 2.0) + 0.03 * Math.sin(t * 17.9 + 1.3);
      lampiao.intensity = LUZ.lampiao.forca * tremor;
      // destaque da entrega: entra e sai em meio segundo
      forcaEntrega += (alvoEntrega - forcaEntrega) * (1 - Math.exp(-dt * 5));
      entrega.intensity = LUZ.entrega.forca * forcaEntrega;
      // apagado, o destaque sai da conta de luzes (uma luz a menos em cada pixel na maior parte do tempo)
      entrega.visible = forcaEntrega > 0.002;
    },
    setQuality(level) {
      nivel = level;
      // alta: luar com sombra de verdade. média e baixa: a sombra do luar sai e entra a poça pintada.
      luar.castShadow = level === 'alta';
      luar.visible = level === 'alta';
      quadrosDeSombra = 8;
      poca.visible = level !== 'alta';
      // no nível baixo saem as luzes supérfluas
      rebatida.visible = level !== 'baixa';
      noel.intensity = LUZ.noel.forca;
      preenchimento.intensity = LUZ.preenchimento.forca * (level === 'baixa' ? 1.5 : 1);
    },
    setEntrega(ligada) {
      alvoEntrega = ligada ? 1 : 0;
    },
    dispose() {
      geoPoca.dispose();
      matPoca.dispose();
      texPoca.dispose();
      luar.shadow.map?.dispose();
      luar.dispose();
      noel.dispose();
      entrega.dispose();
      fila.dispose();
    },
  };
}

/** Só para conferência: a sala nunca passa de dez luzes nem de duas sombras. */
export function contarLuzes(raiz: THREE.Object3D): { luzes: number; sombras: number } {
  let luzes = 0;
  let sombras = 0;
  raiz.traverse((o) => {
    const l = o as THREE.Light;
    if (!l.isLight || !l.visible) return;
    luzes++;
    if (l.castShadow) sombras++;
  });
  return { luzes, sombras };
}
