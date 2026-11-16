/**
 * Camada dos nomes e do balão: projeta as âncoras 3D (cabeça de cada gnomo, cabeça do Noel) para a tela e aplica
 * as regras das etiquetas (etiquetas.ts).
 *
 * - Quem está sendo atendido NÃO tem etiqueta no mundo 3D: o nome dele fica fixo no HUD (pílula "Agora", no alto),
 *   porque a etiqueta presa à cabeça subia sobre a árvore ou caía no gorro de outro gnomo durante a entrega.
 * - Os primeiros da fila (ETIQUETAS.maxFila) mostram o nome, sempre colado à cabeça (etiquetas.ts: longeMax).
 * - Nenhuma etiqueta cobre o Noel (o retângulo do pompom do gorro até os joelhos, com a poltrona), a boca do saco, a
 *   área da entrega, quem está sendo atendido, o balão, a caixa, o presente (no alto ou já nas mãos) nem outra
 *   etiqueta. Sem lugar, a etiqueta some.
 * - Quem está escondido atrás de outro gnomo (a cabeça dele cai dentro do corpo de alguém mais perto da câmera)
 *   não mostra o nome: a etiqueta flutuaria sobre a pessoa errada.
 * - Quem espera sem o nome à mostra aparece só no contador do HUD.
 */
import * as THREE from 'three';
import type { Stage } from '../engine/Stage';
import type { SantaRig, VillageSet } from '../world/contracts';
import type { Caminhante } from './caminhante';
import type { DiretorFila3D } from './DiretorFila3D';
import type { Entrega3D } from './Entrega3D';
import { ETIQUETAS, Posicionador, type AreaProibida, type PedidoEtiqueta } from './etiquetas';
import type { Etiqueta, Hud3D } from './hud';

function area(nome: string): AreaProibida {
  return { nome, ativa: false, l: 0, t: 0, r: 0, b: 0 };
}

/** Caixa da poltrona no espaço da raiz do Noel (metros): os braços e o encosto em volta dele, do assento para cima. */
const POLTRONA = { x: 0.62, zTras: -0.55, zFrente: 0.42, y: 1.58 };
/**
 * O retângulo proibido do Noel vai do pompom até a altura dos joelhos (fração da altura dele). Abaixo disso (canelas,
 * botas e pufe) a etiqueta pode passar: as cabeças da frente da fila ficam exatamente nessa faixa da tela, e sem isso
 * quase ninguém da frente da fila mostrava o nome.
 */
const JOELHOS = 0.45;
/** Meia largura (m) do corpo de um gnomo, para saber quem esconde quem. */
const MEIO_CORPO = 0.24;

interface Silhueta {
  l: number;
  r: number;
  t: number;
  b: number;
  z: number;
}

export class CamadaNomes {
  private readonly etiquetas = new Map<string, Etiqueta>();
  private readonly pos = new Posicionador();
  private readonly proibidas: AreaProibida[];
  private readonly rostoNoel = area('noel');
  /** O Noel inteiro, fixo (ele não sai da poltrona): calculado uma vez no construtor. */
  private readonly corpoNoel = area('noel-corpo');
  private readonly saco = area('saco');
  private readonly entregaA = area('entrega');
  private readonly atendidoA = area('atendido');
  private readonly balao = area('balao');
  private readonly caixa = area('caixa');
  private readonly presente = area('presente');
  /** O presente nas mãos de quem ganhou (o atendido e até dois saindo). */
  private readonly naMao = [area('presente-na-mao'), area('presente-na-mao'), area('presente-na-mao')];
  private readonly fila: Caminhante[] = [];
  private readonly saindo: Caminhante[] = [];
  private readonly vivos = new Set<string>();
  private readonly vivosTmp = new Set<string>();
  private readonly silhuetas: Silhueta[] = [];
  private readonly pedido: PedidoEtiqueta = { id: '', x: 0, y: 0, pes: 0, w: 0, h: 0 };
  private readonly v = new THREE.Vector3();
  private readonly p = { x: 0, y: 0, z: 0 };
  private readonly pontoCabecaNoel = new THREE.Vector3();
  private readonly pontoSaco = new THREE.Vector3();
  private readonly pontoEntrega = new THREE.Vector3();
  private readonly topo = new THREE.Vector3();
  private readonly p2 = { x: 0, y: 0, z: 0 };
  private readonly alturaSaco: number;
  private quadro = 0;
  /** O retângulo do Noel é refeito quando a câmera muda de fov (o zoom da revelação). */
  private fovDoNoel = -1;
  /** Cantos (mundo) das caixas das malhas do Noel e da poltrona, juntados uma vez. */
  private readonly cantosNoel: THREE.Vector3[] = [];
  /** Para a depuração: por que cada um dos primeiros da fila tem ou não tem etiqueta. */
  private readonly motivos: string[] = [];

  constructor(
    private readonly stage: Stage,
    private readonly hud: Hud3D,
    set: VillageSet,
    private readonly santa: SantaRig,
    private readonly diretor: DiretorFila3D,
    private readonly entrega: Entrega3D,
  ) {
    this.proibidas = [this.rostoNoel, this.corpoNoel, this.saco, this.entregaA, this.atendidoA, this.balao, this.caixa, this.presente, ...this.naMao];
    santa.root.updateMatrixWorld(true);
    santa.bubbleAnchor.getWorldPosition(this.pontoCabecaNoel);
    this.pontoCabecaNoel.y -= 0.42;
    santa.sackMouth.getWorldPosition(this.pontoSaco);
    // só a boca do saco (com os presentes aparecendo) fica proibida; a barriga do saco pode ficar atrás de um nome
    this.alturaSaco = 0.3;
    this.pontoSaco.y -= 0.18;
    this.pontoEntrega.copy(set.anchors.delivery.position).setY(0);
    for (let i = 0; i < 16; i++) this.silhuetas.push({ l: 0, r: 0, t: 0, b: 0, z: 0 });
    // o Noel não sai da poltrona: os cantos das caixas do corpo dele e da poltrona são fixos
    const juntar = (b: THREE.Box3, m: THREE.Matrix4) => {
      for (let i = 0; i < 8; i++) this.cantosNoel.push(new THREE.Vector3(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).applyMatrix4(m));
    };
    // o saco tem a área própria (coluna 'saco') e o pufe fica abaixo das botas: os dois ficam fora do retângulo,
    // senão ele se estende sobre a fila inteira e nenhuma etiqueta da frente acha lugar
    const foraDoCorpo = (o: THREE.Object3D) => {
      for (let p: THREE.Object3D | null = o; p && p !== santa.root; p = p.parent) if (p.name === 'noel-saco' || p.name === 'noel-pufe') return true;
      return false;
    };
    // pontos da própria malha (uma amostra dos vértices, já com a pose de repouso aplicada nos ossos), não as caixas:
    // a caixa de um corpo girado na poltrona sai bem mais larga que a silhueta e tomava o lugar das etiquetas
    santa.root.updateMatrixWorld(true);
    const v = new THREE.Vector3();
    const corte = new THREE.Vector3(0, santa.height * JOELHOS, 0).applyMatrix4(santa.root.matrixWorld).y;
    santa.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || !m.visible || !m.geometry || foraDoCorpo(m)) return;
      const pos = m.geometry.getAttribute('position');
      if (!pos) return;
      const sk = m as THREE.Mesh as THREE.SkinnedMesh;
      if (sk.isSkinnedMesh) sk.skeleton.update();
      const passo = Math.max(1, Math.ceil(pos.count / 500));
      for (let i = 0; i < pos.count; i += passo) {
        m.getVertexPosition(i, v).applyMatrix4(m.matrixWorld);
        if (v.y >= corte) this.cantosNoel.push(v.clone());
      }
    });
    juntar(new THREE.Box3(new THREE.Vector3(-POLTRONA.x, santa.height * JOELHOS, POLTRONA.zTras), new THREE.Vector3(POLTRONA.x, POLTRONA.y, POLTRONA.zFrente)), santa.root.matrixWorld);
  }

  /**
   * Retângulo do Noel na tela: uma amostra dos vértices do corpo (sem o saco e o pufe) mais a caixa da poltrona,
   * dos joelhos para cima (JOELHOS), projetados ponto a ponto. Fica proibido do pompom do gorro até o colo.
   */
  private medirNoel() {
    const a = this.corpoNoel;
    a.l = Infinity;
    a.t = Infinity;
    a.r = -Infinity;
    a.b = -Infinity;
    for (const canto of this.cantosNoel) {
      const q = this.stage.project(canto, this.p);
      a.l = Math.min(a.l, q.x);
      a.r = Math.max(a.r, q.x);
      a.t = Math.min(a.t, q.y);
      a.b = Math.max(a.b, q.y);
    }
    a.ativa = Number.isFinite(a.l);
    this.fovDoNoel = this.stage.camera.fov;
  }

  /** Área proibida = coluna vertical do mundo (da base até `altura`, com meia largura `r`) projetada. */
  private coluna(a: AreaProibida, base: THREE.Vector3, altura: number, r: number, ativa = true) {
    a.ativa = ativa;
    if (!ativa) return;
    const pb = this.stage.project(base, this.p);
    this.topo.copy(base);
    this.topo.y += altura;
    const pt = this.stage.project(this.topo, this.p2);
    const w = r * this.stage.pixelsPerMeter(base);
    a.l = Math.min(pb.x, pt.x) - w;
    a.r = Math.max(pb.x, pt.x) + w;
    a.t = pt.y;
    a.b = pb.y;
  }

  /** Área proibida = esfera do mundo projetada (centro ± raio em pixels). */
  private esfera(a: AreaProibida, centro: THREE.Vector3, raio: number, ativa = true) {
    a.ativa = ativa;
    if (!ativa) return;
    const p = this.stage.project(centro, this.p);
    const r = raio * this.stage.pixelsPerMeter(centro);
    a.l = p.x - r;
    a.r = p.x + r;
    a.t = p.y - r;
    a.b = p.y + r;
  }

  /** Esfera em volta do presente que alguém segura (raio proporcional ao tamanho do presente). */
  private presenteNaMao(a: AreaProibida, c: Caminhante | null) {
    if (!c || !c.presente || c.rig.pose.hold < 0.1 || !c.presente.visible) {
      a.ativa = false;
      return;
    }
    c.presente.getWorldPosition(this.v);
    this.esfera(a, this.v, 0.62 * c.presente.scale.x + 0.08);
  }

  private etiqueta(c: Caminhante): Etiqueta {
    let e = this.etiquetas.get(c.id);
    if (!e) {
      e = this.hud.novaEtiqueta(c.participante);
      this.etiquetas.set(c.id, e);
    }
    return e;
  }

  /** Silhueta de um gnomo na tela (dos pés ao topo do gorro), com a profundidade (para saber quem esconde quem). */
  private silhueta(c: Caminhante, out: Silhueta) {
    const rig = c.rig;
    const pes = this.stage.project(rig.root.position, this.p);
    out.b = pes.y;
    out.z = pes.z;
    const w = MEIO_CORPO * this.stage.pixelsPerMeter(rig.root.position);
    out.l = pes.x - w;
    out.r = pes.x + w;
    rig.labelAnchor.getWorldPosition(this.v);
    out.t = this.stage.project(this.v, this.p).y;
  }

  /** A cabeça de `i` está atrás do corpo de alguém mais perto da câmera. */
  private escondido(i: number, n: number, x: number, y: number): boolean {
    const si = this.silhuetas[i];
    for (let k = 0; k < n; k++) {
      if (k === i) continue;
      const s = this.silhuetas[k];
      if (s.z < si.z - 1e-5 && x > s.l && x < s.r && y > s.t + 8 && y < s.b) return true;
    }
    return false;
  }

  /** Preenche o pedido de etiqueta de um visitante (cabeça e pés projetados). */
  private pedir(c: Caminhante, w: number, h: number): PedidoEtiqueta {
    const rig = c.rig;
    rig.labelAnchor.getWorldPosition(this.v);
    const cab = this.stage.project(this.v, this.p);
    const q = this.pedido;
    q.id = c.id;
    q.x = cab.x;
    q.y = cab.y;
    q.pes = this.stage.project(rig.root.position, this.p).y;
    q.w = w;
    q.h = h;
    q.libera = undefined;
    return q;
  }

  update(dt: number) {
    const ent = this.entrega;
    const q = ent.quadro;
    if (this.stage.camera.fov !== this.fovDoNoel) this.medirNoel();
    this.esfera(this.rostoNoel, this.pontoCabecaNoel, 0.42);
    this.coluna(this.saco, this.pontoSaco, this.alturaSaco, 0.36);
    // o lugar da entrega fica livre enquanto ninguém está lá; com alguém, vale a coluna de quem está sendo atendido
    this.coluna(this.entregaA, this.pontoEntrega, 1.3, 0.3, !this.diretor.atendido);
    this.esfera(this.caixa, ent.pontoCaixa, 0.36, ent.rodando && q.caixa.visivel);
    this.esfera(this.presente, ent.pontoRevelacao, 0.55, ent.rodando && q.presente.visivel && !q.presente.naMao);

    // quem está sendo atendido (ou mostrando o presente na saída): o corpo e o presente nas mãos
    const cur = this.diretor.atendido;
    const saindo = this.diretor.saindoNaTela(this.saindo);
    const mostrando = cur ?? saindo[0] ?? null;
    if (mostrando) this.coluna(this.atendidoA, mostrando.rig.root.position, 1.2, 0.22);
    else this.atendidoA.ativa = false;
    this.presenteNaMao(this.naMao[0], cur);
    this.presenteNaMao(this.naMao[1], saindo[0] ?? null);
    this.presenteNaMao(this.naMao[2], saindo[1] ?? null);

    // balão: ao lado da cabeça do Noel, com a cauda na boca
    if (this.hud.balaoAberto) {
      this.santa.bubbleAnchor.getWorldPosition(this.v);
      const yTopo = this.stage.project(this.v, this.p).y;
      this.v.y -= 0.5;
      const boca = this.stage.project(this.v, this.p);
      this.hud.posicionarBalao(boca.x, boca.y, yTopo, this.balao);
      this.balao.ativa = true;
    } else this.balao.ativa = false;

    // pílula "Agora" no HUD (o atendido não tem etiqueta no mundo)
    this.hud.setAtendido(cur && (cur.estado === 'indo' || cur.estado === 'entrega') ? cur.participante : null);

    this.pos.comecar();
    const usadas = this.vivos;
    usadas.clear();

    // os primeiros da fila que estão na tela (quem está escondido atrás de outro não mostra o nome)
    const fila = this.diretor.filaNaTela(this.fila);
    const n = Math.min(fila.length, this.silhuetas.length);
    for (let i = 0; i < n; i++) this.silhueta(fila[i], this.silhuetas[i]);
    for (let i = 0; i < fila.length && i < ETIQUETAS.maxFila; i++) {
      const c = fila[i];
      const e = this.etiqueta(c);
      e.setAtual(false);
      const ped = this.pedir(c, e.w, e.h);
      if (i < n && this.escondido(i, n, ped.x, ped.y)) {
        this.motivos[i] = 'escondido';
        continue;
      }
      const lugar = this.pos.colocar(ped, this.proibidas);
      this.motivos[i] = lugar ? 'ok' : 'sem-lugar';
      if (lugar) {
        e.mostrar(lugar.l, lugar.t, dt);
        usadas.add(c.id);
      }
    }
    this.motivos.length = Math.min(fila.length, ETIQUETAS.maxFila);
    this.hud.setForaDaTela(this.diretor.esperandoTotal - fila.length);

    // esconde quem não tem lugar e descarta etiquetas de quem saiu de cena
    for (const [id, e] of this.etiquetas) if (!usadas.has(id)) e.esconder();
    if (++this.quadro % 30 === 0) {
      const vivos = this.diretor.vivos(this.vivosTmp);
      for (const [id, e] of this.etiquetas) {
        if (!vivos.has(id)) {
          e.destruir();
          this.etiquetas.delete(id);
        }
      }
      this.pos.esquecer(vivos);
    }
  }

  /** Para conferência nas fotos: áreas proibidas e lugares escolhidos. */
  depurar() {
    return {
      proibidas: this.proibidas.filter((a) => a.ativa).map((a) => ({ nome: a.nome, l: Math.round(a.l), t: Math.round(a.t), r: Math.round(a.r), b: Math.round(a.b) })),
      motivos: this.motivos.slice(),
      etiquetas: this.pos.colocados.map((l) => ({ id: l.id, opcao: l.opcao, l: Math.round(l.l), t: Math.round(l.t), r: Math.round(l.r), b: Math.round(l.b) })),
    };
  }

  dispose() {
    for (const e of this.etiquetas.values()) e.destruir();
    this.etiquetas.clear();
  }
}
