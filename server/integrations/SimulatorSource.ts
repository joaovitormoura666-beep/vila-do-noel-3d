import type { LiveEvent, SimKind } from '../../shared/types.js';
import type { LiveSource } from './LiveSource.js';

const FIRST = [
  'Luna', 'Theo', 'Bia', 'Davi', 'Mari', 'Leo', 'Nina', 'Gabi', 'Rafa', 'Lia', 'Caio', 'Duda',
  'Enzo', 'Malu', 'Juju', 'Pedrinho', 'Sofia', 'Tati', 'Vini', 'Lari', 'Nando', 'Cacau', 'Iara',
  'Biel', 'Mel', 'Zeca', 'Lulu', 'Dani', 'Gui', 'Manu', 'Rê', 'Tom', 'Cris', 'Fefa', 'Kaká',
];
const SUFFIX = [
  '', '_natal', '.gamer', '2026', '_oficial', '_br', 'zinha', 'zinho', '_luz', '_neve', '.star',
  '_rena', '_doce', '', '', '_xo', '777', '_sp', '_rj', '_mg',
];
/**
 * Presentes fictícios com um valor em moedas por unidade, só para testar a regra
 * "presente → efeito ambiente" do painel sem estar ao vivo (valores de teste, não da loja do TikTok).
 */
const GIFTS: Array<{ name: string; coins: number }> = [
  { name: 'Rosa', coins: 1 },
  { name: 'Rosquinha', coins: 30 },
  { name: 'Coração', coins: 10 },
  { name: 'Sorvete', coins: 1 },
  { name: 'GG', coins: 1 },
  { name: 'Bastão de luz', coins: 10 },
];

let counter = 0;

/** Gera eventos fictícios para testar o jogo sem conexão com o TikTok. */
export class SimulatorSource implements LiveSource {
  readonly name = 'simulador';
  private emit: ((ev: LiveEvent) => void) | null = null;
  private timers = new Set<NodeJS.Timeout>();
  private lastUser: { id: string; nick: string } | null = null;

  start(emit: (ev: LiveEvent) => void) {
    this.emit = emit;
  }

  stop() {
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
    this.emit = null;
  }

  private randomUser() {
    counter++;
    const nick = FIRST[Math.floor(Math.random() * FIRST.length)] + SUFFIX[Math.floor(Math.random() * SUFFIX.length)];
    const user = { id: `sim-${Date.now().toString(36)}-${counter}`, nick };
    this.lastUser = user;
    return user;
  }

  private make(type: LiveEvent['type'], user: { id: string; nick: string }, extra: Partial<LiveEvent> = {}): LiveEvent {
    counter++;
    return {
      eventId: `sim-ev-${Date.now().toString(36)}-${counter}`,
      type,
      userId: user.id,
      nickname: user.nick,
      source: 'simulador',
      ts: Date.now(),
      ...extra,
    };
  }

  /** Dispara uma simulação. `count` > 1 espalha os eventos no tempo, como numa live real. */
  simulate(kind: SimKind, count = 1) {
    if (!this.emit) return;
    const n = Math.max(1, Math.min(200, Math.round(count)));
    if (n === 1) {
      this.fire(kind);
      return;
    }
    for (let i = 0; i < n; i++) {
      const t = setTimeout(() => {
        this.timers.delete(t);
        this.fire(Math.random() < 0.7 ? 'rosa' : 'comando');
      }, i * 120 + Math.random() * 80);
      this.timers.add(t);
    }
  }

  private fire(kind: SimKind) {
    const emit = this.emit;
    if (!emit) return;
    switch (kind) {
      case 'rosa': {
        const u = this.randomUser();
        emit(this.make('gift', u, { giftName: 'Rosa', giftCount: 1, diamondCount: 1, avatarUrl: `/api/avatar-sim/${encodeURIComponent(u.id)}.svg` }));
        break;
      }
      case 'presente_aleatorio': {
        const u = this.randomUser();
        const g = GIFTS[Math.floor(Math.random() * GIFTS.length)];
        emit(this.make('gift', u, { giftName: g.name, giftCount: 1, diamondCount: g.coins }));
        break;
      }
      case 'presente_grande': {
        // um presente caro (valor de teste) para ver um efeito ambiente pela regra do painel
        const u = this.randomUser();
        emit(this.make('gift', u, { giftName: 'Presente grande (teste)', giftCount: 1, diamondCount: 500 }));
        break;
      }
      case 'comando': {
        const u = this.randomUser();
        emit(this.make('chat', u, { comment: '!presente' }));
        break;
      }
      case 'com_foto': {
        const u = this.randomUser();
        emit(this.make('gift', u, { giftName: 'Rosa', avatarUrl: `/api/avatar-sim/${encodeURIComponent(u.id)}.svg` }));
        break;
      }
      case 'seguir': {
        const u = this.randomUser();
        emit(this.make('follow', u));
        break;
      }
      case 'duplicado': {
        // Mesmo evento chegando duas vezes (acontece em reconexões).
        const u = this.randomUser();
        const ev = this.make('gift', u, { giftName: 'Rosa' });
        emit(ev);
        emit({ ...ev });
        break;
      }
      case 'mesmo_usuario': {
        // A mesma pessoa mandando outro presente (deve ser ignorado enquanto ela estiver na fila).
        const u = this.lastUser ?? this.randomUser();
        emit(this.make('gift', u, { giftName: 'Rosa' }));
        break;
      }
    }
  }
}
