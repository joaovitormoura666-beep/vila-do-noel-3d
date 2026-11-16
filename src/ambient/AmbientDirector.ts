import {
  AMBIENT_EFFECTS,
  DEFAULT_AMBIENT,
  type AmbientConfig,
  type AmbientEffectId,
  type AmbientRequest,
  type AmbientResult,
  type AmbientSnapshot,
  type AmbientState,
} from '../../shared/ambient';

interface Running {
  effect: AmbientEffectId;
  elapsed: number;
  duration: number;
  priority: number;
  source?: string;
}

interface Waiting {
  req: AmbientRequest;
  priority: number;
  order: number;
}

const OFF: AmbientState = { progress: 0, intensity: 0 };

/**
 * Agenda dos eventos ambientais. Lógica pura (sem tela, sem relógio próprio): recebe pedidos,
 * decide o que toca agora, o que espera e o que é descartado, e informa o estado de cada
 * efeito a cada quadro. Não conhece a fila do Papai Noel.
 *
 * Proteções: limite de efeitos simultâneos, descanso mínimo por efeito (pedidos à mão, com
 * `force`, passam por cima dele), fila de espera limitada, pedidos repetidos do mesmo efeito
 * apenas prolongam (até o dobro da duração) e um pedido mais importante faz o menos
 * importante terminar mais cedo.
 */
export class AmbientDirector {
  private config: AmbientConfig;
  private readonly running: Running[] = [];
  private readonly waiting: Waiting[] = [];
  private readonly restUntil = new Map<AmbientEffectId, number>();
  private now = 0;
  private order = 0;
  private dropped = 0;

  constructor(config: AmbientConfig = DEFAULT_AMBIENT) {
    this.config = config;
  }

  setConfig(config: AmbientConfig) {
    this.config = config;
  }

  request(req: AmbientRequest): AmbientResult {
    const cfg = this.config.effects[req.effect];
    if (!cfg || !cfg.enabled) return 'desligado';
    const duration = clamp(req.durationSec ?? cfg.durationSec, 1, 120);
    const priority = req.priority ?? cfg.priority;

    const same = this.running.find((r) => r.effect === req.effect);
    if (same) {
      const remaining = same.duration - same.elapsed;
      const extended = Math.min(remaining + duration, duration * 2);
      if (extended <= remaining + 0.01) return this.drop();
      same.duration = same.elapsed + extended;
      return 'prolongado';
    }
    if (!req.force && (this.restUntil.get(req.effect) ?? 0) > this.now) return this.drop();

    if (this.running.length < this.config.maxSimultaneous) {
      this.start(req, duration, priority);
      return 'iniciado';
    }
    // tudo ocupado: quem é mais importante faz o menos importante sair de cena mais cedo
    const weakest = [...this.running].sort((a, b) => a.priority - b.priority)[0];
    if (weakest && priority > weakest.priority) {
      weakest.duration = Math.min(weakest.duration, weakest.elapsed + fadeOut(weakest.duration));
    }
    if (this.waiting.some((w) => w.req.effect === req.effect)) return this.drop();
    if (this.waiting.length >= this.config.maxQueued) return this.drop();
    this.waiting.push({ req: { ...req, durationSec: duration }, priority, order: this.order++ });
    this.waiting.sort((a, b) => b.priority - a.priority || a.order - b.order);
    return 'na_fila';
  }

  /** Encerra um efeito (ou todos) com saída suave e esvazia a espera correspondente. */
  stop(effect?: AmbientEffectId) {
    for (const r of this.running) {
      if (!effect || r.effect === effect) r.duration = Math.min(r.duration, r.elapsed + fadeOut(r.duration));
    }
    for (let i = this.waiting.length - 1; i >= 0; i--) {
      if (!effect || this.waiting[i].req.effect === effect) this.waiting.splice(i, 1);
    }
  }

  update(dt: number) {
    this.now += dt;
    for (let i = this.running.length - 1; i >= 0; i--) {
      const r = this.running[i];
      r.elapsed += dt;
      if (r.elapsed >= r.duration) {
        this.running.splice(i, 1);
        this.restUntil.set(r.effect, this.now + (this.config.effects[r.effect]?.cooldownSec ?? 0));
      }
    }
    while (this.running.length < this.config.maxSimultaneous && this.waiting.length > 0) {
      const next = this.waiting.shift()!;
      const cfg = this.config.effects[next.req.effect];
      if (!cfg?.enabled) continue;
      this.start(next.req, next.req.durationSec ?? cfg.durationSec, next.priority);
    }
  }

  state(effect: AmbientEffectId): AmbientState {
    const r = this.running.find((x) => x.effect === effect);
    if (!r) return OFF;
    const fin = fadeIn(r.duration);
    const fout = fadeOut(r.duration);
    const up = smooth(r.elapsed / fin);
    const down = smooth((r.duration - r.elapsed) / fout);
    return { progress: clamp(r.elapsed / r.duration, 0, 1), intensity: Math.min(up, down) };
  }

  snapshot(): AmbientSnapshot {
    return {
      active: this.running.map((r) => ({ effect: r.effect, remainingSec: Math.max(0, r.duration - r.elapsed), source: r.source })),
      queued: this.waiting.map((w) => w.req.effect),
      dropped: this.dropped,
    };
  }

  get effects(): readonly AmbientEffectId[] {
    return AMBIENT_EFFECTS;
  }

  private start(req: AmbientRequest, duration: number, priority: number) {
    this.running.push({ effect: req.effect, elapsed: 0, duration, priority, source: req.source });
  }

  private drop(): AmbientResult {
    this.dropped++;
    return 'descartado';
  }
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const smooth = (x: number) => {
  const t = clamp(x, 0, 1);
  return t * t * (3 - 2 * t);
};
const fadeIn = (duration: number) => Math.min(0.9, duration * 0.2);
const fadeOut = (duration: number) => Math.min(1.4, duration * 0.25);
