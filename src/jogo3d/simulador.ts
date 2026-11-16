/**
 * Visitantes fictícios para a demonstração (sem servidor) e para o modo de captura. Tudo com semente: a mesma
 * semente gera os mesmos nomes, as mesmas fotos de perfil fictícias e o mesmo ritmo de chegada, então uma
 * gravação quadro a quadro sai sempre igual. As fotos são avatares originais em SVG (shared/simAvatar.ts).
 */
import type { Participant } from '../../shared/types';
import { simulatedAvatarSvg } from '../../shared/simAvatar';
import { DEMO } from './config';
import { criarSorteio } from './sorteio';

const NOMES = ['Luna', 'Theo', 'Bia', 'Davi', 'Mari', 'Leo', 'Nina', 'Gabi', 'Rafa', 'Lia', 'Caio', 'Duda', 'Enzo', 'Malu', 'Juju', 'Sofia', 'Ana Clara', 'João Pedro', 'Helena', 'Benício'];
const FINAIS = ['', '', '', '_natal', '_neve', '_luz', '.star', '_br', '_doce', '_rena', '07', '2024'];

export class SimuladorDeVisitantes {
  private readonly sorteio: () => number;
  private n = 0;
  private relogio = 0;
  private proxima = 0;
  /** Chegadas pedidas pelo botão "Entrar 10", espaçadas. */
  private pendentes = 0;
  private proximaPendente = 0;
  /** Entrada automática ligada (modo demonstração). */
  automatico = false;

  constructor(private readonly semente: string) {
    this.sorteio = criarSorteio(`visitantes:${semente}`);
  }

  /** Um participante novo (nome e foto sorteados com a semente). Metade tem foto de perfil fictícia. */
  participante(): Participant {
    this.n++;
    const id = `sim-${this.semente}-${this.n}`;
    const nome = NOMES[Math.floor(this.sorteio() * NOMES.length)] + FINAIS[Math.floor(this.sorteio() * FINAIS.length)];
    const avatarUrl = this.n % 2 === 0 ? `data:image/svg+xml;utf8,${encodeURIComponent(simulatedAvatarSvg(id))}` : undefined;
    return { userId: id, nickname: nome, avatarUrl, via: 'presente', giftName: 'Rosa', eventId: id, ts: 0 };
  }

  /** Pede `n` chegadas espaçadas (botão "Entrar 10"). */
  pedir(n: number) {
    this.pendentes += n;
  }

  /** Avança o relógio da simulação e chama `entrar` para quem chega agora. */
  update(dt: number, naFila: number, entrar: (p: Participant) => void) {
    this.relogio += dt;
    if (this.pendentes > 0 && this.relogio >= this.proximaPendente) {
      this.pendentes--;
      this.proximaPendente = this.relogio + 0.14;
      entrar(this.participante());
    }
    if (!this.automatico) return;
    if (this.relogio >= this.proxima) {
      if (naFila < DEMO.minimo) entrar(this.participante());
      const [base, extra] = DEMO.intervalo;
      this.proxima = this.relogio + base + this.sorteio() * extra;
    }
  }

  /** Liga a entrada automática: alguns já entram e, depois, um de tempos em tempos. */
  ligar() {
    if (this.automatico) return;
    this.automatico = true;
    this.pedir(DEMO.iniciais);
    this.proxima = this.relogio + 2.5;
  }

  desligar() {
    this.automatico = false;
  }
}
