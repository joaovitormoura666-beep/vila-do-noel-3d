/**
 * DIRETOR DA FILA 3D: liga a fila lógica (src/queue/QueueManager.ts, a mesma do 2D) ao que aparece na sala.
 *
 * - Cada participante vira um gnomo (semente = userId: a mesma pessoa tem sempre o mesmo gnomo). Os gnomos são
 *   montados com antecedência, fora de cena, no máximo um por quadro (elenco.ts), e entram em cena pelo começo
 *   do caminho da fila (fora da tela), andando, um de cada vez e na ordem da fila.
 * - Na tela ficam no máximo `limite` pessoas esperando (maxVisible do painel, até o que o caminho comporta); o
 *   resto conta no "+N".
 * - Cada um anda até o seu lugar (frontGap + i x queueSpacing antes do fim do caminho) sem passar de quem está à
 *   frente; parado, vira o corpo entre o Noel e a câmera (não vira uma parede de costas).
 * - Com o Noel livre (e o painel sem pausa), o primeiro anda até a entrega e a sequência começa; no fim (ou com
 *   "Pular") ele sai pelo caminho de saída, que passa por trás da fila, e é descartado fora da tela.
 * - "Limpar fila": quem espera encolhe e some (os que ainda não apareceram são descartados direto).
 */
import * as THREE from 'three';
import type { GameStatus, Participant } from '../../shared/types';
import type { AudioManager } from '../audio/AudioManager';
import { Path3 } from '../engine/Path3';
import { bus } from '../events/gameEvents';
import { QueueManager } from '../queue/QueueManager';
import { computeSpeed, settingsState } from '../settingsState';
import type { Cast, VillageSet } from '../world/contracts';
import { Caminhante } from './caminhante';
import { ANDAR, FILA3D } from './config';
import { capacidadeDoCaminho, proximoAEntrar, proximoAMontar, sobrando } from './elenco';
import type { Entrega3D } from './Entrega3D';
import type { Hud3D } from './hud';

const STORAGE_KEY = 'vila-do-noel-3d:fila';
const STORAGE_MAX_AGE_MS = 2 * 60 * 60 * 1000;

export interface OpcoesDiretor {
  /** Guarda a fila no navegador para sobreviver a um recarregamento (desligado no modo de captura). */
  guardar: boolean;
  /** Teto de visíveis forçado (?visiveis=N), ou null para seguir o painel. */
  visiveis: number | null;
}

export class DiretorFila3D {
  readonly queue: QueueManager;
  readonly trilhoFila: Path3;
  readonly trilhoSaida: Path3;
  /** Gnomos montados (em cena ou esperando a vez de entrar), por userId. */
  private readonly montados = new Map<string, Caminhante>();
  private readonly saindo: Caminhante[] = [];
  private readonly sumindo: Caminhante[] = [];
  private atual: Caminhante | null = null;
  private relogio = 0;
  private ultimaEntrada = -Infinity;
  /** Lista de ids esperando, refeita só quando a fila muda. */
  private esperandoIds: string[] = [];
  private versaoFila = -1;
  private versao = 0;
  private saveTimer: number | undefined;
  /** Posicionar direto no lugar (fila restaurada ou ?fila=N), sem a caminhada desde a entrada. */
  private direto = new Set<string>();
  readonly capacidade: number;
  private readonly yawNoel = new THREE.Vector3();
  private readonly camXZ = new THREE.Vector3();
  /** Ids com gnomo em cena (fila esperando). */
  private readonly emCena = new Set<string>();
  /** Visitante de quem o diretor acabou de terminar a entrega (para o HUD). */
  served = 0;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly set: VillageSet,
    private readonly cast: Cast,
    private readonly entrega: Entrega3D,
    private readonly hud: Hud3D,
    private readonly audio: AudioManager,
    private readonly opts: OpcoesDiretor,
  ) {
    const cfg = settingsState.current;
    this.queue = new QueueManager({ maxQueue: cfg.maxQueue, rejoinCooldownSec: cfg.rejoinCooldownSec });
    const a = set.anchors;
    this.trilhoFila = new Path3(a.queuePath);
    this.trilhoSaida = new Path3(a.exitPath);
    this.capacidade = Math.min(FILA3D.tetoVisiveis, capacidadeDoCaminho(this.trilhoFila.length, a.frontGap, a.queueSpacing, FILA3D.inicioVisivel));
    this.yawNoel.copy(a.santa.position);
    const cam = set.look.camera.position;
    this.camXZ.set(cam[0], 0, cam[2]);
    if (opts.guardar) this.restaurar();
  }

  /** Quantos podem esperar na tela agora. */
  get limite() {
    const pedido = this.opts.visiveis ?? settingsState.current.maxVisible;
    return Math.max(1, Math.min(this.capacidade, pedido));
  }

  get ocupado() {
    return this.atual !== null || this.queue.length > 0;
  }

  /** Quem está sendo atendido (ou indo até o Noel). */
  get atendido(): Caminhante | null {
    return this.atual;
  }

  applySettings() {
    const cfg = settingsState.current;
    this.queue.setOptions({ maxQueue: cfg.maxQueue, rejoinCooldownSec: cfg.rejoinCooldownSec });
  }

  /** Tenta colocar alguém na fila (mesma regra do 2D: limite, duplicados, intervalo). */
  join(p: Participant, direto = false) {
    const result = this.queue.enqueue(p);
    bus.emit('queueResult', { participant: p, result });
    if (result === 'aceito') {
      this.versao++;
      if (direto) this.direto.add(p.userId);
      this.audio.sfx.play('join');
      this.agendarGravacao();
    } else if (result === 'fila_cheia') {
      this.audio.sfx.play('full');
      this.hud.avisar('A fila está cheia! Tente de novo já, já 🎄');
    }
    return result;
  }

  /** Pula quem está sendo atendido agora (no meio da entrega ou ainda andando até o Noel). */
  skip() {
    const c = this.atual;
    if (!c) return;
    if (this.entrega.rodando) this.entrega.cancelar();
    // ainda andando (ou virando para o Noel): sai sem presente; se a entrega foi cancelada, o update libera
    else if (c.estado === 'indo' || c.estado === 'entrega') this.liberar(c, false);
  }

  /** Esvazia a fila (quem está sendo atendido termina normalmente). */
  clear() {
    for (const entry of this.queue.clearWaiting()) {
      const c = this.montados.get(entry.participant.userId);
      this.direto.delete(entry.participant.userId);
      if (!c) continue;
      this.montados.delete(c.id);
      this.emCena.delete(c.id);
      if (c.emCena) {
        c.estado = 'sumindo';
        this.sumindo.push(c);
      } else c.descartar();
    }
    this.versao++;
    this.agendarGravacao();
  }

  /** Esperando, em ordem (ids). Refeito só quando a fila muda. */
  private esperando(): string[] {
    if (this.versaoFila !== this.versao) {
      this.versaoFila = this.versao;
      this.esperandoIds = this.queue.waiting().map((e) => e.participant.userId);
    }
    return this.esperandoIds;
  }

  /**
   * Um quadro. `podeMontar` = orçamento do quadro para montar um gnomo novo (no máximo um por quadro).
   * Devolve true se usou o orçamento.
   */
  update(dt: number, t: number, podeMontar: boolean): boolean {
    this.relogio += dt;
    const cfg = settingsState.current;
    let fila = this.esperando();
    const speed = computeSpeed(cfg, fila.length);
    settingsState.effectiveSpeed = speed;
    const vAndar = ANDAR.velocidade * Math.min(speed, ANDAR.aceleracaoMaxima);
    const a = this.set.anchors;
    const L = this.trilhoFila.length;
    const limite = this.limite;
    let montou = false;

    // 1. monta com antecedência (fora de cena) o próximo que vai precisar aparecer
    if (podeMontar) {
      const id = proximoAMontar(fila, this.montados, limite, FILA3D.preaquecer);
      if (id) {
        const entry = this.queue.waiting().find((e) => e.participant.userId === id);
        if (entry) {
          const rig = this.cast.createVisitor(id);
          this.montados.set(id, new Caminhante(rig, entry.participant));
          montou = true;
        }
      }
    }

    // 2. entra em cena (um por quadro, na ordem): pelo começo do caminho, ou direto no lugar
    const entradaLivre = this.relogio - this.ultimaEntrada >= FILA3D.intervaloEntrada / Math.min(speed, 2) && !this.entradaOcupada(a.queueSpacing * FILA3D.entradaLivre);
    const proximoDireto = this.proximoForaDeCena(fila, limite);
    const livre = entradaLivre || (proximoDireto !== null && this.direto.has(proximoDireto));
    const entra = proximoAEntrar(fila, this.emCena, this.montados, limite, livre);
    if (entra) {
      const c = this.montados.get(entra)!;
      const slot = fila.indexOf(entra);
      const sLugar = L - a.frontGap - slot * a.queueSpacing;
      if (this.direto.has(entra) && sLugar > 0) {
        c.colocar(this.trilhoFila, sLugar);
        c.yaw = this.yawDeEspera(c);
        c.parado = 10;
      } else c.colocar(this.trilhoFila, 0);
      this.direto.delete(entra);
      c.estado = 'fila';
      c.emCena = true;
      this.scene.add(c.rig.root);
      this.emCena.add(entra);
      this.ultimaEntrada = this.relogio;
    }

    // 3. chama o próximo quando o Noel está livre (e quem saiu já abriu caminho)
    let saidaLivre = true;
    for (let i = 0; i < this.saindo.length; i++) if (this.saindo[i].s <= FILA3D.folgaSaida) saidaLivre = false;
    if (!this.atual && !cfg.paused && !this.entrega.rodando && fila.length > 0 && saidaLivre) {
      const first = this.montados.get(fila[0]);
      if (first && first.emCena) {
        this.queue.startNext();
        this.versao++;
        this.emCena.delete(first.id);
        this.atual = first;
        first.estado = 'indo';
        first.alvo = L;
        first.yawParado = null;
        this.entrega.preparar();
        fila = this.esperando();
      }
    }

    // 4. quem está indo até o Noel; ao chegar, vira para ele e a entrega começa
    const cur = this.atual;
    if (cur) {
      if (cur.estado === 'indo') {
        cur.update(dt, t, vAndar);
        if (cur.chegou && cur.s >= L - 0.02) {
          cur.estado = 'entrega';
          cur.yawFixo = this.entrega.yawNaEntrega;
          cur.parado = 0;
        }
      } else if (cur.estado === 'entrega') {
        if (!this.entrega.rodando && !this.entrega.terminou && cur.parado >= FILA3D.virarNaEntrega) this.entrega.iniciar(cur);
        cur.update(dt, t, 0);
        if (this.entrega.terminou) {
          this.entrega.terminou = false;
          const presente = this.entrega.presenteAtual;
          const entregue = this.entrega.entregue;
          if (entregue && presente) bus.emit('delivered', { participant: cur.participante, giftName: presente.name });
          this.liberar(cur, entregue);
        }
      }
    }

    // 5. a fila: cada um anda até o seu lugar sem atropelar quem está à frente
    let frente = cur && cur.estado === 'indo' ? cur.s : Infinity;
    for (let i = 0; i < fila.length; i++) {
      const c = this.montados.get(fila[i]);
      if (!c || !c.emCena) break;
      if (c === cur) continue;
      c.alvo = L - a.frontGap - i * a.queueSpacing;
      c.yawParado = this.yawDeEspera(c);
      c.update(dt, t, vAndar, frente - a.queueSpacing * 0.86);
      frente = c.s;
    }

    // 6. quem saiu vai embora pelo caminho de saída e é descartado fora da tela
    for (let i = this.saindo.length - 1; i >= 0; i--) {
      const c = this.saindo[i];
      // se há gente demais saindo, os mais antigos apertam o passo
      const pressa = this.saindo.length - i > FILA3D.saindoMax ? 1.8 : 1;
      c.update(dt, t, ANDAR.velocidadeSaida * Math.min(speed, ANDAR.aceleracaoMaxima) * pressa);
      if (c.chegou) {
        this.saindo.splice(i, 1);
        c.descartar();
      }
    }
    for (let i = this.sumindo.length - 1; i >= 0; i--) {
      const c = this.sumindo[i];
      c.update(dt, t, 0);
      if (c.escala <= 0) {
        this.sumindo.splice(i, 1);
        c.descartar();
      }
    }

    // 7. montados que saíram da fila sem aparecer (limpar, pular): descarta
    if (this.montados.size > fila.length + 1) {
      for (const id of sobrando(this.montados.keys(), fila, { has: (x) => x === this.atual?.id })) {
        const c = this.montados.get(id)!;
        this.montados.delete(id);
        this.emCena.delete(id);
        if (c !== this.atual) c.descartar();
      }
    }

    this.hud.setContador(fila.length);
    return montou;
  }

  /** Alguém da fila está a menos de `d` metros do começo do caminho. */
  private entradaOcupada(d: number): boolean {
    for (const id of this.emCena) {
      const c = this.montados.get(id);
      if (c && c.estado === 'fila' && c.s < d) return true;
    }
    return false;
  }

  private proximoForaDeCena(fila: readonly string[], limite: number): string | null {
    const n = Math.min(fila.length, limite);
    for (let i = 0; i < n; i++) if (!this.emCena.has(fila[i])) return fila[i];
    return null;
  }

  /** Parado na fila: entre "olhando o Noel" e "virado para a câmera" (3/4, nunca de costas chapado). */
  private yawDeEspera(c: Caminhante): number {
    const p = c.rig.root.position;
    const paraNoel = Math.atan2(this.yawNoel.x - p.x, this.yawNoel.z - p.z);
    const paraCamera = Math.atan2(this.camXZ.x - p.x, this.camXZ.z - p.z);
    let d = paraCamera - paraNoel;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return paraNoel + d * FILA3D.viradaParaCamera;
  }

  /** Tira da fila e manda embora pelo caminho de saída. */
  private liberar(c: Caminhante, servido: boolean) {
    if (servido) {
      this.queue.complete(c.id);
      this.served++;
    } else this.queue.remove(c.id);
    this.versao++;
    this.montados.delete(c.id);
    this.emCena.delete(c.id);
    if (this.atual === c) this.atual = null;
    c.estado = 'saindo';
    c.yawFixo = null;
    c.yawParado = null;
    c.poseDireta = false;
    c.alvoPose.hold = c.presente ? 1 : 0;
    c.colocar(this.trilhoSaida, 0);
    c.yaw = this.trilhoSaida.yawAt(0.05);
    c.alvo = this.trilhoSaida.length;
    this.saindo.push(c);
    this.agendarGravacao();
  }

  /** Para a camada de etiquetas: quem espera na tela, em ordem (inclui os que ainda estão chegando). */
  filaNaTela(out: Caminhante[]): Caminhante[] {
    out.length = 0;
    const fila = this.esperando();
    for (let i = 0; i < fila.length; i++) {
      const c = this.montados.get(fila[i]);
      if (!c || !c.emCena) break;
      out.push(c);
    }
    return out;
  }

  get esperandoTotal() {
    return this.esperando().length;
  }

  /** Todos os gnomos vivos (para descartar etiquetas de quem saiu). */
  vivos(out: Set<string>): Set<string> {
    out.clear();
    for (const id of this.montados.keys()) out.add(id);
    if (this.atual) out.add(this.atual.id);
    return out;
  }

  status(fps: number, quality: GameStatus['quality']): GameStatus {
    const fila = this.esperando();
    let visible = 0;
    for (const id of fila) if (this.emCena.has(id)) visible++;
    return {
      fps: Math.round(fps),
      quality,
      queueLength: fila.length,
      visible,
      waitingOffscreen: fila.length - visible,
      current: this.atual?.participante.nickname,
      served: this.queue.served,
      paused: settingsState.current.paused,
      effectiveSpeed: Math.round(settingsState.effectiveSpeed * 10) / 10,
    };
  }

  /** Personagens desenhados agora (fila + atendido + saindo). */
  get naTela() {
    return this.emCena.size + (this.atual ? 1 : 0) + this.saindo.length + this.sumindo.length;
  }

  dispose() {
    for (const c of this.montados.values()) c.descartar();
    for (const c of this.saindo) c.descartar();
    for (const c of this.sumindo) c.descartar();
    this.atual?.descartar();
    this.montados.clear();
    this.saindo.length = 0;
    this.sumindo.length = 0;
    this.atual = null;
  }

  /* ---------- a fila sobrevive a um recarregamento da página ---------- */

  private agendarGravacao() {
    if (!this.opts.guardar || this.saveTimer !== undefined) return;
    this.saveTimer = window.setTimeout(() => {
      this.saveTimer = undefined;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ at: Date.now(), list: this.queue.snapshot() }));
      } catch {
        /* armazenamento indisponível: segue sem salvar */
      }
    }, 400);
  }

  private restaurar() {
    try {
      if (new URLSearchParams(location.search).has('limpar')) {
        localStorage.removeItem(STORAGE_KEY);
        return;
      }
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as { at: number; list: Participant[] };
      if (!data || Date.now() - data.at > STORAGE_MAX_AGE_MS || !Array.isArray(data.list)) return;
      this.queue.restore(data.list);
      for (const p of data.list) if (p && typeof p.userId === 'string') this.direto.add(p.userId);
      this.versao++;
    } catch {
      /* dados inválidos: começa com a fila vazia */
    }
  }
}
