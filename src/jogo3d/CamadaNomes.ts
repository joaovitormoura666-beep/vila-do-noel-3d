/**
 * Camada dos nomes e do balão: projeta as âncoras 3D (cabeça de cada gnomo, topo do gorro do Noel) para a tela
 * e aplica as regras das etiquetas (etiquetas.ts): só o atendido e os primeiros da fila mostram o nome; nenhuma
 * etiqueta cobre o rosto do Noel, o saco, a área da entrega, o balão, a caixa ou o presente, nem outra etiqueta;
 * o resto da fila vira o selo "+N".
 */
import * as THREE from 'three';
import type { Stage } from '../engine/Stage';
import type { SantaRig, VillageSet } from '../world/contracts';
import type { Caminhante } from './caminhante';
import type { DiretorFila3D } from './DiretorFila3D';
import type { Entrega3D } from './Entrega3D';
import { ETIQUETAS, Posicionador, contarMaisN, type AreaProibida, type PedidoEtiqueta } from './etiquetas';
import type { Etiqueta, Hud3D } from './hud';

/** Lugares de reserva do selo "+N" (frações da área de jogo; o selo fica acima do ponto). */
const SELO_RESERVA: ReadonlyArray<[number, number]> = [
  [0.86, 1.0],
  [0.14, 1.0],
  [0.86, 0.9],
  [0.14, 0.9],
];

function area(nome: string): AreaProibida {
  return { nome, ativa: false, l: 0, t: 0, r: 0, b: 0 };
}

export class CamadaNomes {
  private readonly etiquetas = new Map<string, Etiqueta>();
  private readonly pos = new Posicionador();
  private readonly proibidas: AreaProibida[];
  private readonly rostoNoel = area('noel');
  private readonly corpoNoel = area('noel-corpo');
  private readonly saco = area('saco');
  private readonly entregaA = area('entrega');
  private readonly balao = area('balao');
  private readonly caixa = area('caixa');
  private readonly presente = area('presente');
  private readonly fila: Caminhante[] = [];
  private readonly vivos = new Set<string>();
  private readonly pedido: PedidoEtiqueta = { id: '', x: 0, y: 0, pes: 0, w: 0, h: 0 };
  private readonly v = new THREE.Vector3();
  private readonly p = { x: 0, y: 0, z: 0 };
  private readonly pontoCabecaNoel = new THREE.Vector3();
  private readonly pontoCorpoNoel = new THREE.Vector3();
  private readonly pontoSaco = new THREE.Vector3();
  private readonly pontoEntrega = new THREE.Vector3();
  private readonly topo = new THREE.Vector3();
  private readonly p2 = { x: 0, y: 0, z: 0 };
  private readonly selo: PedidoEtiqueta = { id: '+N', x: 0, y: 0, pes: 0, w: 0, h: 0 };
  private quadro = 0;

  constructor(
    private readonly stage: Stage,
    private readonly hud: Hud3D,
    set: VillageSet,
    private readonly santa: SantaRig,
    private readonly diretor: DiretorFila3D,
    private readonly entrega: Entrega3D,
  ) {
    this.proibidas = [this.rostoNoel, this.corpoNoel, this.saco, this.entregaA, this.balao, this.caixa, this.presente];
    santa.root.updateMatrixWorld(true);
    santa.bubbleAnchor.getWorldPosition(this.pontoCabecaNoel);
    this.pontoCorpoNoel.copy(this.pontoCabecaNoel);
    this.pontoCabecaNoel.y -= 0.42;
    this.pontoCorpoNoel.y -= 1.05;
    santa.sackMouth.getWorldPosition(this.pontoSaco);
    this.pontoSaco.y = 0;
    this.pontoEntrega.copy(set.anchors.delivery.position).setY(0);
    this.alturaSaco = santa.sackMouth.getWorldPosition(new THREE.Vector3()).y + 0.12;
  }

  private readonly alturaSaco: number;

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

  private etiqueta(c: Caminhante): Etiqueta {
    let e = this.etiquetas.get(c.id);
    if (!e) {
      e = this.hud.novaEtiqueta(c.participante);
      this.etiquetas.set(c.id, e);
    }
    return e;
  }

  /** Preenche o pedido de etiqueta de um visitante (cabeça e pés projetados). */
  private pedir(c: Caminhante, w: number, h: number, libera?: string): PedidoEtiqueta {
    const rig = c.rig;
    rig.labelAnchor.getWorldPosition(this.v);
    // segurando o presente acima da cabeça: a etiqueta sobe acima dele
    this.v.y += rig.pose.hold * 0.5;
    const cab = this.stage.project(this.v, this.p);
    const q = this.pedido;
    q.id = c.id;
    q.x = cab.x;
    q.y = cab.y;
    const pes = this.stage.project(rig.root.position, this.p);
    q.pes = pes.y;
    q.w = w;
    q.h = h;
    q.libera = libera;
    return q;
  }

  update(dt: number) {
    const ent = this.entrega;
    const q = ent.quadro;
    this.esfera(this.rostoNoel, this.pontoCabecaNoel, 0.42);
    this.esfera(this.corpoNoel, this.pontoCorpoNoel, 0.5);
    this.coluna(this.saco, this.pontoSaco, this.alturaSaco, 0.36);
    this.coluna(this.entregaA, this.pontoEntrega, 1.3, 0.36);
    this.esfera(this.caixa, ent.pontoCaixa, 0.42, ent.rodando && q.caixa.visivel);
    this.esfera(this.presente, ent.pontoRevelacao, 0.55, ent.rodando && q.presente.visivel && !q.presente.naMao);

    // balão: preso ao topo do gorro do Noel
    if (this.hud.balaoAberto) {
      this.santa.bubbleAnchor.getWorldPosition(this.v);
      const b = this.stage.project(this.v, this.p);
      this.hud.posicionarBalao(b.x, b.y, this.balao);
      this.balao.ativa = true;
    } else this.balao.ativa = false;

    this.pos.comecar();
    const usadas = this.vivos;
    usadas.clear();

    // 1. quem está sendo atendido (prioridade; pode ficar sobre a área da entrega, que é ele)
    const cur = this.diretor.atendido;
    if (cur && (cur.estado === 'indo' || cur.estado === 'entrega')) {
      const e = this.etiqueta(cur);
      e.setAtual(true);
      const lugar = this.pos.colocar(this.pedir(cur, e.w, e.h, 'entrega'), this.proibidas);
      if (lugar) {
        e.mostrar(lugar.l, lugar.t, dt);
        usadas.add(cur.id);
      }
    }

    // 2. os primeiros da fila que estão na tela
    const fila = this.diretor.filaNaTela(this.fila);
    let comNome = 0;
    let primeiroSemNome: Caminhante | null = null;
    for (let i = 0; i < fila.length; i++) {
      const c = fila[i];
      if (i >= ETIQUETAS.maxFila) {
        primeiroSemNome ??= c;
        continue;
      }
      const e = this.etiqueta(c);
      e.setAtual(false);
      const lugar = this.pos.colocar(this.pedir(c, e.w, e.h), this.proibidas);
      if (lugar) {
        e.mostrar(lugar.l, lugar.t, dt);
        usadas.add(c.id);
        comNome++;
      } else primeiroSemNome ??= c;
    }

    // 3. "+N": quem espera sem o nome à mostra
    const n = contarMaisN(this.diretor.esperandoTotal, comNome);
    if (n > 0) {
      this.hud.setMais(n);
      const sel = this.selo;
      sel.w = this.hud.maisW;
      sel.h = this.hud.maisH;
      let lugar = null;
      if (primeiroSemNome) {
        // perto da cabeça do primeiro da fila sem nome
        const q2 = this.pedir(primeiroSemNome, sel.w, sel.h);
        sel.x = q2.x;
        sel.y = q2.y;
        sel.pes = q2.pes;
        lugar = this.pos.colocar(sel, this.proibidas);
      }
      // sem ninguém da fila na tela (ou sem lugar perto dele): nos cantos de baixo da área de jogo
      for (let k = 0; k < SELO_RESERVA.length && !lugar; k++) {
        const [fx, fy] = SELO_RESERVA[k];
        sel.x = ETIQUETAS.area.l + fx * (ETIQUETAS.area.r - ETIQUETAS.area.l);
        sel.y = ETIQUETAS.area.t + fy * (ETIQUETAS.area.b - ETIQUETAS.area.t);
        sel.pes = sel.y;
        lugar = this.pos.colocar(sel, this.proibidas);
      }
      if (lugar) this.hud.mostrarMais(lugar.l, lugar.t);
      else this.hud.esconderMais();
    } else this.hud.esconderMais();

    // 4. esconde quem não tem lugar e descarta etiquetas de quem saiu de cena
    for (const [id, e] of this.etiquetas) if (!usadas.has(id)) e.esconder();
    if (++this.quadro % 30 === 0) {
      const vivos = this.diretor.vivos(new Set<string>());
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
      etiquetas: this.pos.colocados.map((l) => ({ id: l.id, opcao: l.opcao, l: Math.round(l.l), t: Math.round(l.t), r: Math.round(l.r), b: Math.round(l.b) })),
    };
  }

  dispose() {
    for (const e of this.etiquetas.values()) e.destruir();
    this.etiquetas.clear();
  }
}
