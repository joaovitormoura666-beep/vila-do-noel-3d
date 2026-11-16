/**
 * Voz do Papai Noel em português do Brasil.
 *
 * 1) Se existir um arquivo pré-gravado para a frase (public/audio/voz/<id>.mp3),
 *    ele é usado.
 * 2) Caso contrário, usa a síntese de voz gratuita do próprio navegador.
 *
 * Observação importante: a "Fonte de navegador" do OBS normalmente NÃO tem
 * síntese de voz. Veja docs/AUDIO.md para as alternativas.
 */
import { STANDALONE } from '../standalone';
import { loadAudioManifest } from './manifest';

const MALE_HINTS = /antonio|antônio|daniel|fabio|fábio|humberto|julio|júlio|valerio|valério|donato|nicolau|felipe|ricardo|male|masc/i;

export class Voice {
  enabled = true;
  ttsVolume = 1;
  private voice: SpeechSynthesisVoice | null = null;
  private recorded = new Set<string>();
  private currentEl: HTMLAudioElement | null = null;
  private pendingResolve: (() => void) | null = null;
  private ttsTimer: number | undefined;
  private watchdog: number | undefined;
  private justCancelled = false;
  /** Falhas seguidas da síntese (fala que não começou). */
  private ttsFailures = 0;
  /** Enquanto `performance.now()` for menor que isto, a síntese fica em descanso. */
  private ttsRetryAt = 0;
  private ttsWorked = false;

  constructor(
    private readonly ctx: AudioContext | null,
    private readonly out: GainNode | null,
  ) {
    if (this.ttsAvailable) {
      this.pickVoice();
      window.speechSynthesis.addEventListener?.('voiceschanged', () => this.pickVoice());
    }
    void this.loadManifest();
  }

  get ttsAvailable(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
  }

  /** Nome da voz em uso (para mostrar no painel/console). */
  get voiceName(): string {
    return this.voice?.name ?? (this.ttsAvailable ? 'voz padrão do navegador' : 'indisponível');
  }

  /** Situação da voz nesta tela, mostrada no painel de controle. */
  get info(): { state: 'ok' | 'sem_teste' | 'indisponivel'; name: string; recorded: number } {
    const failing = this.ttsFailures > 0 || performance.now() < this.ttsRetryAt;
    const state = !this.ttsAvailable || failing ? 'indisponivel' : this.ttsWorked ? 'ok' : 'sem_teste';
    return { state, name: this.voiceName, recorded: this.recorded.size };
  }

  /** Tenta a síntese de novo na próxima fala (usado pelo botão "Testar voz" do painel). */
  retryTts() {
    this.ttsRetryAt = 0;
  }

  private noteTtsFailure() {
    this.ttsFailures++;
    this.ttsWorked = false;
    // Duas falhas seguidas: este navegador não tem síntese funcionando (caso típico:
    // fonte de navegador do OBS). Descansa um minuto para as falas não atrasarem o jogo.
    if (this.ttsFailures >= 2) this.ttsRetryAt = performance.now() + 60_000;
  }

  private pickVoice() {
    const voices = window.speechSynthesis.getVoices();
    const ptBr = voices.filter((v) => /^pt[-_]br/i.test(v.lang));
    const pt = voices.filter((v) => /^pt/i.test(v.lang));
    this.voice = ptBr.find((v) => MALE_HINTS.test(v.name)) ?? ptBr[0] ?? pt.find((v) => MALE_HINTS.test(v.name)) ?? pt[0] ?? null;
  }

  private async loadManifest() {
    if (STANDALONE) return; // sem servidor: só a síntese do navegador
    try {
      const info = await loadAudioManifest();
      for (const id of info.vozes) this.recorded.add(id);
    } catch {
      /* sem arquivos pré-gravados: usa a síntese */
    }
  }

  /**
   * Fala um texto. A Promise termina quando a fala acaba (ou depois de `maxMs`).
   * `phraseId` permite usar um arquivo pré-gravado quando ele existir.
   */
  speak(text: string, phraseId?: string, maxMs = 6000): Promise<void> {
    this.stop();
    if (!this.enabled) return Promise.resolve();

    return new Promise<void>((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        window.clearTimeout(timer);
        if (this.pendingResolve === finish) this.pendingResolve = null;
        resolve();
      };
      const timer = window.setTimeout(finish, maxMs);
      this.pendingResolve = finish;

      if (phraseId && this.recorded.has(phraseId)) {
        this.playFile(phraseId, finish);
        return;
      }
      if (!this.ttsAvailable || this.ttsVolume <= 0.001 || performance.now() < this.ttsRetryAt) {
        finish();
        return;
      }
      try {
        const synth = window.speechSynthesis;
        const u = new SpeechSynthesisUtterance(text);
        u.lang = this.voice?.lang ?? 'pt-BR';
        if (this.voice) u.voice = this.voice;
        u.pitch = 0.7;
        u.rate = 0.96;
        u.volume = this.ttsVolume;
        let started = false;
        u.onstart = () => {
          started = true;
          this.ttsFailures = 0;
          this.ttsWorked = true;
          window.clearTimeout(this.watchdog);
        };
        u.onend = finish;
        u.onerror = (e) => {
          // "not-allowed" = falta um clique na página; "interrupted/canceled" = nós mesmos paramos
          const benign = e.error === 'not-allowed' || e.error === 'interrupted' || e.error === 'canceled';
          if (!started && !benign) this.noteTtsFailure();
          finish();
        };
        // O Chrome às vezes engole a fala se speak() vier colado em cancel(): damos um respiro.
        this.ttsTimer = window.setTimeout(() => {
          if (done) return;
          synth.speak(u);
          // Se a fala não começar logo, não esperamos por ela (senão cada frase atrasaria a entrega).
          const patience = synth.getVoices().length > 0 ? 1600 : 500;
          this.watchdog = window.setTimeout(() => {
            if (started || done) return;
            this.noteTtsFailure();
            try {
              synth.cancel();
            } catch {
              /* ignora */
            }
            finish();
          }, patience);
        }, this.justCancelled ? 80 : 0);
        this.justCancelled = false;
      } catch {
        finish();
      }
    });
  }

  private playFile(id: string, finish: () => void) {
    try {
      const el = new Audio(`/audio/voz/${id}.mp3`);
      el.crossOrigin = 'anonymous';
      if (this.ctx && this.out) this.ctx.createMediaElementSource(el).connect(this.out);
      else el.volume = this.ttsVolume;
      el.onended = finish;
      el.onerror = finish;
      this.currentEl = el;
      void el.play().catch(finish);
    } catch {
      finish();
    }
  }

  stop() {
    window.clearTimeout(this.ttsTimer);
    window.clearTimeout(this.watchdog);
    try {
      if (this.ttsAvailable && (window.speechSynthesis.speaking || window.speechSynthesis.pending)) {
        window.speechSynthesis.cancel();
        this.justCancelled = true;
      }
    } catch {
      /* ignora */
    }
    if (this.currentEl) {
      this.currentEl.pause();
      this.currentEl = null;
    }
    this.pendingResolve?.();
    this.pendingResolve = null;
  }
}
