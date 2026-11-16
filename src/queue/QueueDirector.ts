import type Phaser from 'phaser';
import type { GameStatus, Participant } from '../../shared/types';
import type { DeliverySequence } from '../animations/DeliverySequence';
import type { AudioManager } from '../audio/AudioManager';
import { Character, type LabelBounds } from '../characters/Character';
import { EXIT_PATH, GAME_W, LAYOUT, QUEUE, QUEUE_PATH } from '../config';
import { bus } from '../events/gameEvents';
import { computeSpeed, settingsState } from '../settingsState';
import type { Hud } from '../ui/Hud';
import { PathTrack } from './PathTrack';
import { QueueManager } from './QueueManager';

/** Soma das áreas em que `rect` cobre as etiquetas já posicionadas. */
function overlapArea(rect: LabelBounds, placed: LabelBounds[]): number {
  let area = 0;
  for (const o of placed) {
    const w = Math.min(rect.r, o.r) - Math.max(rect.l, o.l);
    const h = Math.min(rect.b, o.b) - Math.max(rect.t, o.t);
    if (w > 0 && h > 0) area += w * h * (o.weight ?? 1);
  }
  return area;
}

interface LabelSpot {
  lift: number;
  shift: number;
  rect: LabelBounds;
  cost: number;
}

/** Deslizamentos laterais que uma etiqueta pode tentar, em pixels. */
const LABEL_SHIFTS = [0, -40, 40, -80, 80];

/** Área da entrega (quem está com o Noel e o tapete): as etiquetas da fila não devem cobri-la. */
const DELIVERY_AREA: LabelBounds = {
  l: LAYOUT.delivery.x - 115,
  r: LAYOUT.delivery.x + 115,
  t: LAYOUT.delivery.y - 175,
  b: LAYOUT.delivery.y + 48,
};

const STORAGE_KEY = 'vila-do-noel:fila';
const STORAGE_MAX_AGE_MS = 2 * 60 * 60 * 1000;

/**
 * Liga a fila lógica (QueueManager) ao que aparece na tela:
 * cria os personagens, organiza os lugares, chama a entrega e libera a vez.
 */
export class QueueDirector {
  readonly queue: QueueManager;
  private readonly queueTrack = new PathTrack(QUEUE_PATH);
  private readonly exitTrack = new PathTrack(EXIT_PATH);
  private readonly chars = new Map<string, Character>();
  private readonly leaving = new Set<Character>();
  private current: Character | null = null;
  private lastSpawnAt = -Infinity;
  private saveTimer: number | undefined;
  private lastJoinAt = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly sequence: DeliverySequence,
    private readonly hud: Hud,
    private readonly audio: AudioManager,
  ) {
    const cfg = settingsState.current;
    this.queue = new QueueManager({ maxQueue: cfg.maxQueue, rejoinCooldownSec: cfg.rejoinCooldownSec });
    this.restore();
  }

  /** Momento (relógio do jogo) da última entrada na fila — usado para as falas de espera. */
  get lastActivityAt() {
    return this.lastJoinAt;
  }

  get busy() {
    return this.current !== null || this.queue.length > 0;
  }

  applySettings() {
    const cfg = settingsState.current;
    this.queue.setOptions({ maxQueue: cfg.maxQueue, rejoinCooldownSec: cfg.rejoinCooldownSec });
  }

  /** Tenta colocar alguém na fila. */
  join(p: Participant) {
    const result = this.queue.enqueue(p);
    bus.emit('queueResult', { participant: p, result });
    if (result === 'aceito') {
      this.lastJoinAt = this.scene.time.now;
      this.audio.sfx.play('join');
      this.scheduleSave();
    } else if (result === 'fila_cheia') {
      this.audio.sfx.play('full');
      this.hud.toast('A fila está cheia! Tente de novo já, já 🎄');
    }
  }

  /** Pula quem está sendo atendido agora. */
  skip() {
    if (!this.current) return;
    if (this.sequence.running) this.sequence.cancel();
    else this.current.skipDelivery = true;
  }

  /** Esvazia a fila (quem está sendo atendido termina normalmente). */
  clear() {
    for (const entry of this.queue.clearWaiting()) {
      const c = this.chars.get(entry.participant.userId);
      if (c) {
        this.chars.delete(entry.participant.userId);
        c.poof();
      }
    }
    this.scheduleSave();
  }

  update(timeMs: number, deltaMs: number) {
    const cfg = settingsState.current;
    const dt = Math.min(0.1, deltaMs / 1000);
    const speed = computeSpeed(cfg, this.queue.waiting().length);
    settingsState.effectiveSpeed = speed;
    const L = this.queueTrack.length;
    const waiting = this.queue.waiting();
    const maxVisible = cfg.maxVisible;

    // 1. cria personagens para quem já pode aparecer (um de cada vez, em ordem)
    const visibleCount = Math.min(maxVisible, waiting.length);
    for (let i = 0; i < visibleCount; i++) {
      const p = waiting[i].participant;
      if (this.chars.has(p.userId)) continue;
      const entranceBusy = [...this.chars.values()].some((c) => c.track === this.queueTrack && c.s < QUEUE.spacing * 0.8);
      if (!entranceBusy && timeMs - this.lastSpawnAt >= QUEUE.spawnIntervalMs / speed) {
        const c = new Character(this.scene, p, this.queueTrack);
        c.setTrack(this.queueTrack, 0);
        this.chars.set(p.userId, c);
        this.lastSpawnAt = timeMs;
      }
      break; // respeita a ordem: só cria o próximo quando o anterior já existe
    }

    // 2. chama o próximo quando o Noel está livre
    if (!this.current && !cfg.paused && !this.sequence.running && waiting.length > 0) {
      const first = this.chars.get(waiting[0].participant.userId);
      if (first) {
        this.queue.startNext();
        this.current = first;
        first.state = 'indo';
        first.targetS = L;
        first.labelLift = 0;
        first.labelShift = 0;
        first.labelSize = 1.12;
      }
    }

    // 3. movimenta quem está indo até o Noel
    const cur = this.current;
    if (cur && cur.state === 'indo') {
      cur.update(dt, QUEUE.walkSpeed * speed);
      if (cur.arrived) {
        if (cur.skipDelivery) this.release(cur, false);
        else void this.deliver(cur);
      }
    } else if (cur && cur.state === 'entrega') {
      cur.update(dt, 0);
    }

    // 4. organiza a fila: cada um anda até o seu lugar, sem atropelar quem está à frente
    let aheadS = cur && cur.state === 'indo' ? cur.s : Infinity;
    let slot = 0;
    // Áreas que as etiquetas da fila devem evitar: a entrega (o foco da cena) e,
    // conforme forem sendo posicionadas, as etiquetas de quem está à frente.
    const labels: LabelBounds[] = [DELIVERY_AREA];
    if (cur) labels.push(cur.labelBounds(0), cur.faceBounds());
    for (const entry of this.queue.waiting()) {
      const c = this.chars.get(entry.participant.userId);
      if (!c) break;
      c.targetS = L - QUEUE.frontGap - slot * QUEUE.spacing;
      c.update(dt, QUEUE.walkSpeed * speed, aheadS - QUEUE.spacing * 0.86);
      this.placeLabel(c, labels);
      labels.push(c.faceBounds());
      aheadS = c.s;
      slot++;
    }

    // 5. quem já recebeu o presente vai embora
    for (const c of this.leaving) {
      c.update(dt, QUEUE.exitSpeed * speed);
      if (c.arrived) {
        this.leaving.delete(c);
        c.destroy();
      }
    }

    this.hud.setQueueCount(this.queue.waiting().length);
  }

  /**
   * Escolhe o lugar da etiqueta de `c`. Os nomes costumam ser mais largos que a
   * distância entre as pessoas, então cada etiqueta pode subir um degrau ou
   * deslizar um pouco para o lado. Vence o lugar que menos cobre a área da
   * entrega e os nomes e rostos de quem está à frente, com preferência por
   * ficar junto do dono; e ela só muda de lugar quando compensa, para não
   * ficar pulando enquanto a fila anda.
   */
  private placeLabel(c: Character, placed: LabelBounds[]) {
    const step = (c.labelHeight + 6) / c.scale;
    const isHigh = c.labelLift > step / 2;
    let best: LabelSpot | null = null;
    let current: LabelSpot | null = null;
    for (const lift of [0, step]) {
      for (const shift of LABEL_SHIFTS) {
        const rect = c.labelBounds(lift, shift);
        const offScreen = Math.max(0, 8 - rect.l) + Math.max(0, rect.r - (GAME_W - 8));
        const cost = overlapArea(rect, placed) + offScreen * 60 + (lift > 0 ? 200 : 0) + Math.abs(shift) * 6;
        const spot = { lift, shift, rect, cost };
        if (!best || cost < best.cost) best = spot;
        if (lift > 0 === isHigh && shift === c.labelShift) current = spot;
      }
    }
    const pick = current && best && current.cost <= best.cost + 350 ? current : best!;
    c.labelLift = pick.lift;
    c.labelShift = pick.shift;
    placed.push(pick.rect);
  }

  private async deliver(char: Character) {
    char.state = 'entrega';
    const gift = await this.sequence.run(char);
    if (gift) bus.emit('delivered', { participant: char.participant, giftName: gift.name });
    this.release(char, true);
  }

  /** Tira o personagem da fila e manda ele embora pelo caminho de saída. */
  private release(char: Character, served: boolean) {
    const id = char.participant.userId;
    if (served) this.queue.complete(id);
    else this.queue.remove(id);
    this.chars.delete(id);
    if (this.current === char) this.current = null;
    if (char.state !== 'removido') {
      char.state = 'saindo';
      char.labelLift = 0;
      char.labelShift = 0;
      char.labelSize = 0.96;
      char.setTrack(this.exitTrack, 0);
      char.targetS = this.exitTrack.length;
      this.leaving.add(char);
    }
    this.scheduleSave();
  }

  status(fps: number, quality: GameStatus['quality']): GameStatus {
    const waiting = this.queue.waiting();
    const visible = waiting.filter((e) => this.chars.has(e.participant.userId)).length;
    return {
      fps: Math.round(fps),
      quality,
      queueLength: waiting.length,
      visible,
      waitingOffscreen: waiting.length - visible,
      current: this.current?.participant.nickname,
      served: this.queue.served,
      paused: settingsState.current.paused,
      effectiveSpeed: Math.round(settingsState.effectiveSpeed * 10) / 10,
    };
  }

  /** Número de personagens desenhados agora. */
  get onScreen() {
    return this.chars.size + this.leaving.size;
  }

  /* ---------- persistência: a fila sobrevive a um recarregamento da página ---------- */

  private scheduleSave() {
    if (this.saveTimer !== undefined) return;
    this.saveTimer = window.setTimeout(() => {
      this.saveTimer = undefined;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ at: Date.now(), list: this.queue.snapshot() }));
      } catch {
        /* armazenamento indisponível: segue sem salvar */
      }
    }, 400);
  }

  private restore() {
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
    } catch {
      /* dados inválidos: começa com a fila vazia */
    }
  }
}
