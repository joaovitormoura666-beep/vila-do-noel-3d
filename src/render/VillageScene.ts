import Phaser from 'phaser';
import type { GameStatus } from '../../shared/types';
import { DeliverySequence } from '../animations/DeliverySequence';
import type { AudioManager } from '../audio/AudioManager';
import { PerformanceMonitor } from '../effects/PerformanceMonitor';
import { Snow } from '../effects/Snow';
import { bus } from '../events/gameEvents';
import { fakeParticipant } from '../events/localSimulator';
import { QueueDirector } from '../queue/QueueDirector';
import { IDLE_LINES, PhrasePicker } from '../santa/phrases';
import { Santa } from '../santa/Santa';
import { settingsState } from '../settingsState';
import { STANDALONE } from '../standalone';
import { Hud } from '../ui/Hud';
import { SpeechBubble } from '../ui/SpeechBubble';
import { Scenery } from './Scenery';
import { createGiftTextures } from './textures/gifts';
import { createParticleTextures } from './textures/particles';
import { createSantaTextures } from './textures/santa';
import { createSceneryTextures } from './textures/scenery';
import { createVisitorTextures } from './textures/visitors';

export interface SceneServices {
  audio: AudioManager;
  reportStatus: (status: GameStatus) => void;
}

/** Cena única do jogo: monta a vila e coordena os módulos. */
export class VillageScene extends Phaser.Scene {
  private services!: SceneServices;
  private scenery!: Scenery;
  private snow!: Snow;
  private santa!: Santa;
  private hud!: Hud;
  private bubble!: SpeechBubble;
  private sequence!: DeliverySequence;
  private director!: QueueDirector;
  private perf!: PerformanceMonitor;
  private readonly idlePhrases = new PhrasePicker();
  private lastStatusAt = 0;
  private lastIdleAt = 0;
  private demoTimer: Phaser.Time.TimerEvent | null = null;

  constructor() {
    super('vila');
  }

  init(data: SceneServices) {
    this.services = data;
  }

  create() {
    // toda a arte é gerada aqui, por código
    createParticleTextures(this);
    createSceneryTextures(this);
    createSantaTextures(this);
    createVisitorTextures(this);
    createGiftTextures(this);

    const { audio } = this.services;
    this.scenery = new Scenery(this);
    this.snow = new Snow(this);
    this.santa = new Santa(this);
    this.hud = new Hud(this);
    const head = this.santa.headTop;
    this.bubble = new SpeechBubble(this, head.x - 10, head.y - 14);
    this.sequence = new DeliverySequence({ scene: this, santa: this.santa, bubble: this.bubble, scenery: this.scenery, audio, hud: this.hud });
    this.director = new QueueDirector(this, this.sequence, this.hud, audio);

    this.perf = new PerformanceMonitor((level) => {
      this.snow.setQuality(level);
      this.scenery.setQuality(level);
      this.sequence.effectScale = level === 'alta' ? 1 : level === 'media' ? 0.6 : 0.3;
    });

    this.applySettings();

    bus.on('participant', (p) => this.director.join(p));
    bus.on('settings', () => this.applySettings());
    bus.on('command', (cmd) => {
      switch (cmd) {
        case 'skip':
          this.director.skip();
          break;
        case 'clear':
          this.director.clear();
          break;
        case 'test_voice':
          audio.voice.retryTts();
          void this.sequence.idleLine({ id: 'teste-voz', text: 'Ho, ho, ho! Feliz Natal!' });
          break;
        case 'reload':
          location.reload();
          break;
      }
    });

    this.setupKeyboard();
    const params = new URLSearchParams(location.search);
    if (params.has('demo') || STANDALONE) this.setDemo(true);
    this.lastIdleAt = this.time.now;
  }

  private applySettings() {
    const cfg = settingsState.current;
    this.hud.setHint(cfg.hintText);
    this.hud.setPaused(cfg.paused && cfg.showFps);
    this.perf.setMode(cfg.quality);
    this.director.applySettings();
    this.services.audio.applySettings(cfg);
  }

  /** Atalhos para testar sem o painel: R = participante, D = modo demonstração. */
  private setupKeyboard() {
    this.input.keyboard?.on('keydown-R', () => this.director.join(fakeParticipant()));
    this.input.keyboard?.on('keydown-D', () => this.setDemo(!this.demoTimer));
  }

  /** Modo demonstração: participantes fictícios entram sozinhos (útil sem servidor). */
  private setDemo(on: boolean) {
    this.demoTimer?.remove(false);
    this.demoTimer = null;
    if (!on) return;
    const tick = () => {
      if (this.director.queue.length < 7) this.director.join(fakeParticipant());
      this.demoTimer = this.time.delayedCall(1400 + Math.random() * 3600, tick);
    };
    for (let i = 0; i < 4; i++) this.director.join(fakeParticipant());
    this.demoTimer = this.time.delayedCall(2500, tick);
  }

  update(time: number, delta: number) {
    this.perf.frame();
    this.snow.update(time);
    this.director.update(time, delta);

    const cfg = settingsState.current;

    // fala de espera quando ninguém está na fila
    if (this.director.busy || this.sequence.running) {
      this.lastIdleAt = time;
    } else if (cfg.idleHintSec > 0 && time - this.lastIdleAt > cfg.idleHintSec * 1000) {
      this.lastIdleAt = time;
      void this.sequence.idleLine(this.idlePhrases.pick(IDLE_LINES));
    }

    if (time - this.lastStatusAt > 1000) {
      this.lastStatusAt = time;
      const { audio } = this.services;
      this.services.reportStatus({
        ...this.director.status(this.perf.fps, this.perf.level),
        voice: audio.voice.info,
        audioLocked: audio.locked,
      });
      this.hud.setFps(cfg.showFps, this.perf.fps, this.perf.level, this.director.onScreen);
    }
  }
}
