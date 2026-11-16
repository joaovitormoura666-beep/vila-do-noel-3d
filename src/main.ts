import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/600.css';
import '@fontsource/fredoka/700.css';
import Phaser from 'phaser';
import { AudioManager } from './audio/AudioManager';
import { GAME_H, GAME_W, PALETTE } from './config';
import { bus } from './events/gameEvents';
import { fakeParticipant } from './events/localSimulator';
import { ServerConnection } from './events/ServerConnection';
import { VillageScene, type SceneServices } from './render/VillageScene';
import { settingsState } from './settingsState';
import { STANDALONE } from './standalone';

async function loadFonts() {
  try {
    await Promise.all(['500', '600', '700'].map((w) => document.fonts.load(`${w} 32px Fredoka`)));
  } catch {
    /* segue com a fonte reserva */
  }
}

async function start() {
  await loadFonts();

  const audio = new AudioManager();

  // conexão com o servidor local (eventos, painel e configurações)
  const conn = new ServerConnection(
    'game',
    (msg) => {
      switch (msg.t) {
        case 'participant':
          bus.emit('participant', msg.p);
          break;
        case 'command':
          bus.emit('command', msg.cmd);
          break;
        case 'settings':
          settingsState.current = msg.settings;
          bus.emit('settings', msg.settings);
          break;
      }
    },
    (online) => {
      bus.emit('connection', { online });
      console.info(online ? '[vila] conectado ao servidor' : '[vila] servidor desconectado — tentando reconectar');
    },
  );
  // na demonstração autônoma não existe servidor: a tela usa as configurações padrão
  if (!STANDALONE) conn.connect();

  bus.on('queueResult', ({ participant, result }) => {
    conn.send({ t: 'queueResult', eventId: participant.eventId, nickname: participant.nickname, result });
  });
  bus.on('delivered', ({ participant, giftName }) => {
    conn.send({ t: 'delivered', nickname: participant.nickname, gift: giftName });
  });

  const services: SceneServices = {
    audio,
    reportStatus: (status) => conn.send({ t: 'status', status }),
  };

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'jogo',
    width: GAME_W,
    height: GAME_H,
    backgroundColor: PALETTE.nightDeep,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    // smoothStep desligado: o jogo usa o tempo real entre quadros, então a velocidade
    // das animações continua correta mesmo se o FPS cair ou a janela perder o foco.
    fps: { target: 60, smoothStep: false },
    render: { antialias: true, powerPreference: 'high-performance' },
    audio: { noAudio: true }, // o áudio é próprio (Web Audio), fora do Phaser
    banner: false,
  });
  game.scene.add('vila', VillageScene, true, services);

  setupAudioUnlock(audio);
  if (STANDALONE) setupStandaloneControls(audio);

  // acesso para depuração pelo console do navegador
  (window as unknown as Record<string, unknown>).__vila = { game, audio, bus, settings: settingsState };
}

/** O Chrome só libera som após um clique; no OBS o som já sai direto. */
function setupAudioUnlock(audio: AudioManager) {
  const hint = document.getElementById('som');
  const tryUnlock = async () => {
    const ok = await audio.unlock();
    if (ok) {
      hint?.remove();
      window.removeEventListener('pointerdown', tryUnlock);
      window.removeEventListener('keydown', tryUnlock);
    }
    return ok;
  };
  window.addEventListener('pointerdown', tryUnlock);
  window.addEventListener('keydown', tryUnlock);
  void tryUnlock().then((ok) => {
    if (!ok && hint && !new URLSearchParams(location.search).has('obs')) hint.hidden = false;
  });
}

/**
 * Botões da demonstração autônoma (demo.html): fazem o papel do painel,
 * criando visitantes fictícios direto na tela.
 */
function setupStandaloneControls(audio: AudioManager) {
  const bar = document.getElementById('controles');
  if (!bar) return;
  const on = (action: string, fn: () => void) => bar.querySelector(`[data-acao="${action}"]`)?.addEventListener('click', fn);

  on('rosa', () => bus.emit('participant', fakeParticipant()));
  on('dez', () => {
    for (let i = 0; i < 10; i++) window.setTimeout(() => bus.emit('participant', fakeParticipant()), i * 140);
  });

  const sound = bar.querySelector<HTMLButtonElement>('[data-acao="som"]');
  const normal = settingsState.current.volumes.master;
  let muted = false;
  const render = () => {
    if (!sound) return;
    const audible = !audio.locked && !muted;
    const icon = sound.querySelector('.icone');
    const label = sound.querySelector('.rotulo');
    if (icon) icon.textContent = audible ? '🔊' : '🔇';
    if (label) label.textContent = audible ? 'Silenciar' : 'Ativar som';
    sound.setAttribute('aria-pressed', String(audible));
  };
  // O navegador só libera o som depois de um toque, e esse mesmo toque já o libera.
  // Por isso guardamos como o som estava ANTES do toque: o primeiro só ativa,
  // os seguintes ligam e desligam.
  let lockedAtPress = audio.locked;
  const remember = () => {
    lockedAtPress = audio.locked;
  };
  sound?.addEventListener('pointerdown', remember);
  sound?.addEventListener('keydown', remember);
  sound?.addEventListener('click', () => {
    if (!lockedAtPress) {
      muted = !muted;
      const cfg = settingsState.current;
      settingsState.current = { ...cfg, volumes: { ...cfg.volumes, master: muted ? 0 : normal } };
      bus.emit('settings', settingsState.current);
    }
    void audio.unlock().then(render);
  });
  window.addEventListener('pointerup', () => window.setTimeout(render, 250));
  render();
}

void start();
