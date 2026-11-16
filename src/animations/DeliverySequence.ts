import Phaser from 'phaser';
import type { AudioManager } from '../audio/AudioManager';
import type { Character } from '../characters/Character';
import { DEPTH, FONT, hex, LAYOUT, PALETTE as P } from '../config';
import { GiftPicker, type GiftDef } from '../gifts/giftCatalog';
import type { Scenery } from '../render/Scenery';
import { FAREWELLS, fill, GREETINGS, MAIN_LINE, PhrasePicker, REACTIONS, REVEALS, speakableName, type Phrase } from '../santa/phrases';
import type { Santa } from '../santa/Santa';
import type { Hud } from '../ui/Hud';
import { settingsState } from '../settingsState';
import type { SpeechBubble } from '../ui/SpeechBubble';
import { Cancelled, Timeline } from './async';

export interface DeliveryDeps {
  scene: Phaser.Scene;
  santa: Santa;
  bubble: SpeechBubble;
  scenery: Scenery;
  audio: AudioManager;
  hud: Hud;
}

const CONFETTI = [hex(P.red), hex(P.gold), hex(P.greenLight), hex(P.snow), hex(P.goldLight)];

/**
 * A cena principal do jogo: o Papai Noel cumprimenta o visitante, tira um
 * presente do saco, revela qual é e entrega. Tudo pode ser interrompido
 * pelo painel ("Pular").
 */
export class DeliverySequence {
  private readonly gifts = new GiftPicker();
  private readonly phrases = new PhrasePicker();
  private readonly burst: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly confetti: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly hearts: Phaser.GameObjects.Particles.ParticleEmitter;
  private timeline: Timeline | null = null;
  /** Reduz partículas quando o desempenho está baixo. */
  effectScale = 1;

  constructor(private readonly deps: DeliveryDeps) {
    const { scene } = deps;
    this.burst = scene.add
      .particles(0, 0, 'sparkle', {
        lifespan: { min: 500, max: 1100 },
        speed: { min: 160, max: 520 },
        scale: { start: 0.9, end: 0 },
        alpha: { start: 1, end: 0 },
        rotate: { min: 0, max: 360 },
        tint: [hex(P.goldLight), 0xffffff, hex(P.gold)],
        blendMode: Phaser.BlendModes.ADD,
        emitting: false,
      })
      .setDepth(DEPTH.fx + 40);
    this.confetti = scene.add
      .particles(0, 0, 'confetti', {
        lifespan: { min: 1100, max: 1900 },
        speed: { min: 200, max: 560 },
        angle: { min: 200, max: 340 },
        gravityY: 760,
        scale: { min: 0.8, max: 1.5 },
        rotate: { min: 0, max: 360 },
        alpha: { start: 1, end: 0.2 },
        tint: CONFETTI,
        emitting: false,
      })
      .setDepth(DEPTH.fx + 41);
    this.hearts = scene.add
      .particles(0, 0, 'heart', {
        lifespan: { min: 900, max: 1500 },
        speedY: { min: -170, max: -90 },
        speedX: { min: -70, max: 70 },
        scale: { start: 0.5, end: 1.1 },
        alpha: { start: 1, end: 0 },
        emitting: false,
      })
      .setDepth(DEPTH.fx + 42);
  }

  get running() {
    return this.timeline !== null;
  }

  cancel() {
    this.timeline?.cancel();
    this.deps.audio.voice.stop();
  }

  private count(n: number) {
    return Math.max(2, Math.round(n * this.effectScale));
  }

  /** Mostra a fala no balão e na voz, e espera ela terminar. */
  private async say(tl: Timeline, phrase: Phrase, vars: { nome: string; presente?: string }, minMs: number, showBubble = true) {
    const { santa, bubble, audio } = this.deps;
    const cfg = settingsState.current;
    if (showBubble) bubble.show(fill(phrase.text, vars));
    santa.setTalking(true);
    let speech: Promise<void> = Promise.resolve();
    if (cfg.voiceEnabled) {
      const spokenName = cfg.speakNames ? speakableName(vars.nome) : '';
      const spoken = fill(phrase.text, { nome: spokenName || 'meu amigo', presente: vars.presente });
      speech = audio.voice.speak(spoken, phrase.id);
    }
    try {
      // em velocidades altas não esperamos a voz terminar
      if (settingsState.effectiveSpeed > 1.6) await tl.wait(minMs);
      else await tl.waitFor(speech, minMs, 5200);
    } finally {
      santa.setTalking(false);
    }
  }

  /**
   * Executa a entrega para o personagem. Retorna o presente entregue, ou
   * null se a sequência foi cancelada antes da entrega.
   */
  async run(char: Character): Promise<GiftDef | null> {
    const { scene, santa, bubble, scenery, audio, hud } = this.deps;
    const tl = new Timeline(scene, () => settingsState.effectiveSpeed);
    this.timeline = tl;
    const nome = char.participant.nickname;
    const gift = this.gifts.pick();
    let delivered = false;

    try {
      scenery.setDeliveryActive(true);
      audio.sfx.play('arrive');
      santa.wave(3, settingsState.effectiveSpeed);
      char.jump(1, 16, 150);

      // 1. cumprimento personalizado
      await this.say(tl, this.phrases.pick(GREETINGS), { nome }, 1500);
      // 2. frase principal
      await this.say(tl, MAIN_LINE, { nome }, 1500);

      // 3. Noel procura no saco
      bubble.hide();
      audio.sfx.play('rummage');
      santa.reachIntoSack(tl.ms(760));
      const mouth = santa.sackMouth;
      this.burst.explode(this.count(8), mouth.x, mouth.y);
      await tl.wait(700);

      // 4. a caixa sai do saco e voa até o centro
      const boxBody = scene.add.image(0, 0, 'box-body').setOrigin(0.5, 1);
      const boxLid = scene.add.image(0, -100, 'box-lid').setOrigin(0.5, 1);
      const box = tl.track(scene.add.container(mouth.x, mouth.y, [boxBody, boxLid]).setDepth(DEPTH.fx + 30).setScale(0.2));
      const glow = tl.track(
        scene.add.image(mouth.x, mouth.y, 'glow').setTint(hex(P.goldLight)).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.fx + 29).setScale(0.6).setAlpha(0.8),
      );
      audio.sfx.play('rise');
      santa.present(tl.ms(420));
      const reveal = LAYOUT.reveal;
      const boxY = reveal.y + 66;
      tl.tweenLoose({ targets: box, x: reveal.x, duration: 780, ease: 'Sine.easeInOut' });
      tl.tweenLoose({ targets: glow, x: reveal.x, y: boxY - 60, scale: 2.6, duration: 780, ease: 'Sine.easeInOut' });
      tl.tweenLoose({ targets: box, scale: 1.25, duration: 780, ease: 'Back.easeOut' });
      await tl.tween({ targets: box, y: boxY, duration: 780, ease: 'Back.easeOut' });

      // 5. suspense
      audio.sfx.play('drum');
      tl.tweenLoose({ targets: box, scale: 1.4, duration: 840, ease: 'Sine.easeIn' });
      await tl.tween({ targets: box, angle: { from: -7, to: 7 }, duration: 70, yoyo: true, repeat: 5, ease: 'Sine.easeInOut' });
      box.setAngle(0);

      // 6. revelação
      audio.sfx.play('reveal');
      this.burst.explode(this.count(34), reveal.x, boxY - 70);
      this.confetti.explode(this.count(46), reveal.x, boxY - 70);
      tl.tweenLoose({ targets: boxLid, y: -420, angle: 50, alpha: 0, duration: 520, ease: 'Cubic.easeOut' });
      tl.tweenLoose({ targets: boxBody, scaleY: 0.2, alpha: 0, duration: 300, ease: 'Sine.easeIn' });
      tl.tweenLoose({ targets: glow, alpha: 0, duration: 400 });

      const rays = tl.track(scene.add.image(reveal.x, reveal.y, 'rays').setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.fx + 31).setScale(0.2).setAlpha(0));
      tl.tweenLoose({ targets: rays, scale: 1.05, alpha: 0.95, duration: 380, ease: 'Sine.easeOut' });
      const spin = scene.tweens.add({ targets: rays, angle: 360, duration: 9000, repeat: -1 });

      const item = tl.track(scene.add.image(reveal.x, reveal.y, `gift-${gift.id}`).setDepth(DEPTH.fx + 33).setScale(0));
      tl.tweenLoose({ targets: item, scale: 1.55, duration: 520, ease: 'Back.easeOut' });
      const bob = scene.tweens.add({ targets: item, y: reveal.y - 12, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

      // a faixa com o nome ocupa o lugar da instrução por alguns segundos
      hud.setInfoVisible(false);
      const banner = tl.track(this.makeBanner(nome, gift.name));
      banner.setScale(0.5).setAlpha(0);
      tl.tweenLoose({ targets: banner, scale: 1, alpha: 1, duration: 320, delay: 160, ease: 'Back.easeOut' });

      santa.cheer();
      try {
        // a fala da revelação sai só na voz: na tela, quem conta é a faixa
        await this.say(tl, this.phrases.pick(REVEALS), { nome, presente: gift.spoken }, 2100, false);
      } finally {
        spin.stop();
        bob.stop();
      }

      // 7. entrega ao visitante
      bubble.hide();
      santa.give(tl.ms(300));
      const head = char.headTop;
      tl.tweenLoose({ targets: rays, alpha: 0, scale: 0.4, duration: 380 });
      tl.tweenLoose({ targets: banner, alpha: 0, y: banner.y - 30, duration: 300 });
      hud.setInfoVisible(true, 400);
      await tl.tween({ targets: item, x: head.x, y: head.y - 34, scale: 0.5, duration: 520, ease: 'Cubic.easeInOut' });

      item.setVisible(false);
      char.carry(`gift-${gift.id}`);
      delivered = true;
      audio.sfx.play('jump');
      char.jump(2, 38, tl.ms(190));
      char.react(this.phrases.pick(REACTIONS));
      this.hearts.explode(this.count(7), head.x, head.y);
      this.burst.explode(this.count(10), head.x, head.y - 30);

      // 8. despedida
      await this.say(tl, this.phrases.pick(FAREWELLS), { nome }, 1150);
      return gift;
    } catch (err) {
      if (!(err instanceof Cancelled)) console.error('[entrega] erro na sequência', err);
      return delivered ? gift : null;
    } finally {
      tl.dispose();
      this.timeline = null;
      bubble.hide();
      santa.setTalking(false);
      santa.rest();
      scenery.setDeliveryActive(false);
      hud.setInfoVisible(true);
    }
  }

  private makeBanner(nome: string, giftName: string) {
    const { scene } = this.deps;
    const { x, y } = LAYOUT.banner;
    const who = scene.add
      .text(0, 0, `${nome} ganhou`, { fontFamily: FONT, fontSize: '36px', fontStyle: '600', color: P.snow, stroke: P.night, strokeThickness: 8 })
      .setOrigin(0.5, 1);
    const what = scene.add
      .text(0, -2, giftName, { fontFamily: FONT, fontSize: '62px', fontStyle: '700', color: P.goldLight, stroke: P.redDark, strokeThickness: 12 })
      .setOrigin(0.5, 0);
    // ajusta nomes longos
    const maxW = 960;
    if (what.width > maxW) what.setScale(maxW / what.width);
    if (who.width > maxW) who.setScale(maxW / who.width);
    return scene.add.container(x, y, [who, what]).setDepth(DEPTH.hud + 2);
  }

  /** Fala solta do Noel quando a fila está vazia. */
  async idleLine(phrase: Phrase) {
    if (this.running) return;
    const { scene, bubble, santa, audio } = this.deps;
    bubble.show(phrase.text);
    santa.setTalking(true);
    santa.wave(2);
    const speech = settingsState.current.voiceEnabled ? audio.voice.speak(phrase.text, phrase.id) : Promise.resolve();
    await Promise.all([speech, new Promise<void>((res) => scene.time.delayedCall(2600, res))]);
    if (this.running) return;
    santa.setTalking(false);
    bubble.hide();
  }
}
