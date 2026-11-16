/**
 * JOGO 3D da Vila do Noel, a TELA PRINCIPAL DA LIVE (index.html, servida em /; jogo3d.html é a mesma página):
 * a sala natalina 3D com o Noel sentado na poltrona, a fila de gnomos e a entrega dos presentes, ligada à mesma
 * camada de eventos do jogo 2D (servidor, painel, simulador).
 *
 * Reaproveita sem reescrever: a fila lógica (queue/QueueManager), o barramento (events/gameEvents), a conexão
 * com o servidor no papel 'game' (events/ServerConnection), as configurações (settingsState), os presentes
 * (gifts/giftCatalog), as frases (santa/phrases), o áudio (audio/AudioManager), a agenda dos efeitos ambientes
 * (ambient/AmbientDirector) e a qualidade automática (effects/PerformanceMonitor).
 *
 * Parâmetros do endereço:
 *   ?obs            só o que vai para a live (sem barra de demonstração, sem aviso de som, sem dicas de operação).
 *                   Na fonte de navegador do OBS o som sai direto, sem clique.
 *   ?janela=1       captura de janela (TikTok LIVE Studio): tenta acertar a janela em 9:16 (só funciona quando a
 *                   janela foi aberta pelo painel ou pelo abrir-janela-da-live.bat). Com ?obs junto, o pedido de clique
 *                   para o som aparece só no título da janela (fora da imagem) e some depois do clique.
 *                   ?janela=540 ou ?janela=1080 pedem esse tamanho exato (540x960 ou 1080x1920).
 *   ?depurar        mostra o FPS, o nível de qualidade e os números do palco (também no ?obs); o info() traz mais
 *                   detalhes. ?fps mostra só a linha do FPS fora do ?obs (o mesmo que "Mostrar FPS" do painel).
 *   ?demo=1         demonstração sem servidor: visitantes fictícios e botões. No laboratório e no npm run dev ela
 *                   também liga sozinha se o servidor não responder; na página compilada (npm start, Cloudflare) e
 *                   no ?obs, nunca: na live, gnomos fictícios não podem aparecer por causa de uma queda do servidor.
 *   ?manual=1       captura: nada anda sozinho; window.__jogo3d.frame(dt) avança a simulação (determinística)
 *   ?q=alta|media|baixa   força a qualidade (sem isso, segue o painel / automático pelo FPS)
 *   ?fila=N         começa com N visitantes fictícios já nos lugares (útil com manual=1)
 *   ?auto=1         chegadas automáticas de visitantes fictícios (padrão na demonstração)
 *   ?visiveis=N     teto de gente esperando na tela (padrão: maxVisible do painel)
 *   ?semente=texto  semente da simulação (nomes, presentes, frases)
 *   ?velocidade=1.5 velocidade do jogo (padrão: a do painel)
 *   ?efeito=SLEIGH_PASS   pede um efeito ambiente no começo (lista separada por vírgula)
 *   ?pr=0.5         resolução fixa (captura); ?limpar descarta a fila guardada no navegador
 *   ?fov=28&cam=x,y,z&alvo=x,y,z   ajuste fino da câmera do jogo (padrão: CAMERA_JOGO em config.ts)
 *   ?presente=id    força o presente das entregas (estrela, bola, bengala...; para fotografar cada um)
 */
import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/600.css';
import '@fontsource/fredoka/700.css';
import './jogo3d.css';
import * as THREE from 'three';
import { AMBIENT_EFFECTS, DEFAULT_AMBIENT, isAmbientEffect, type AmbientEffectId } from '../../shared/ambient';
import type { Participant } from '../../shared/types';
import { AmbientDirector } from '../ambient/AmbientDirector';
import { AudioManager } from '../audio/AudioManager';
import { semListaDoServidor } from '../audio/manifest';
import { PerformanceMonitor } from '../effects/PerformanceMonitor';
import { Stage } from '../engine/Stage';
import { bus } from '../events/gameEvents';
import { ServerConnection } from '../events/ServerConnection';
import { IDLE_LINES, PhrasePicker } from '../santa/phrases';
import { settingsState } from '../settingsState';
import { STANDALONE } from '../standalone';
import { buildCast } from '../world/cast/index';
import type { Level } from '../world/contracts';
import { buildVillageSet } from '../world/set/index';
import { GIFTS } from '../gifts/giftCatalog';
import { CAMERA_JOGO } from './config';
import { descartarObjeto } from './descarte';
import { CamadaNomes } from './CamadaNomes';
import { DiretorFila3D } from './DiretorFila3D';
import { Entrega3D } from './Entrega3D';
import { Hud3D } from './hud';
import { SimuladorDeVisitantes } from './simulador';
import { criarSorteio } from './sorteio';

interface Api3D {
  pronto: boolean;
  erro?: string;
  /** Avança a simulação dt segundos (em passos de no máximo 1/30 s) e desenha um quadro. */
  frame(dt: number): Record<string, unknown>;
  /** Avança sem desenhar. */
  avancar(segundos: number): void;
  entrar(n?: number): void;
  efeito(id: string): void;
  pular(): void;
  limpar(): void;
  info(): Record<string, unknown>;
  /** Mede quanto o gnomo anda por radiano de fase (para ANDAR.passoPorRadiano). */
  medirPasso(semente?: string): number;
}

interface ApiCaptura {
  ready: boolean;
  error?: string;
  freeze(t: number): Record<string, unknown>;
  info(): Record<string, unknown>;
  benchmark(n: number): number;
}

declare global {
  interface Window {
    __jogo3d?: Api3D;
    __proto?: ApiCaptura;
  }
}

const params = new URLSearchParams(location.search);
const num = (k: string, padrao: number) => {
  const v = Number(params.get(k));
  return params.has(k) && Number.isFinite(v) ? v : padrao;
};

const OBS = params.has('obs');
const MANUAL = params.get('manual') === '1';
const SEMENTE = params.get('semente') ?? 'vila';
const QUALIDADE: Level | null = ((q) => (q === 'alta' || q === 'media' || q === 'baixa' ? q : null))(params.get('q'));
const DEMO = params.get('demo') === '1';
const DEPURAR = params.has('depurar');
/** Captura de janela (LIVE Studio): 0 = desligado; 1 = acerta a largura pela altura; 540 ou 1080 = tamanho exato. */
const JANELA = ((v) => (v === null ? 0 : v === '540' || v === '1080' ? Number(v) : 1))(params.get('janela'));
/**
 * Demonstração automática quando o servidor não responde: só no laboratório e no npm run dev (Vite em modo de
 * desenvolvimento), nunca na página compilada nem no ?obs.
 */
const DEMO_SEM_SERVIDOR = import.meta.env.DEV && !OBS;
/** Segundos do começo em que o monitor de FPS não mede (carga das texturas e compilação dos sombreadores). */
const CARENCIA_FPS = 3;

/** Três números separados por vírgula (?cam=7,3.2,11), ou o padrão. */
function vetor(k: string, padrao: readonly [number, number, number]): [number, number, number] {
  const v = (params.get(k) ?? '').split(',').map(Number);
  return v.length === 3 && v.every(Number.isFinite) ? [v[0], v[1], v[2]] : [padrao[0], padrao[1], padrao[2]];
}

async function carregarFontes() {
  try {
    await Promise.all(['500', '600', '700'].map((w) => document.fonts.load(`${w} 32px Fredoka`)));
  } catch {
    /* segue com a fonte reserva */
  }
}

async function iniciar() {
  const api: Api3D = {
    pronto: false,
    frame: () => ({}),
    avancar: () => undefined,
    entrar: () => undefined,
    efeito: () => undefined,
    pular: () => undefined,
    limpar: () => undefined,
    info: () => ({}),
    medirPasso: () => 0,
  };
  const captura: ApiCaptura = { ready: false, freeze: () => ({}), info: () => ({}), benchmark: () => 0 };
  window.__jogo3d = api;
  window.__proto = captura;

  try {
    await carregarFontes();
    const palco = document.getElementById('palco')!;
    if (OBS) document.body.classList.add('obs');
    if (MANUAL) document.body.classList.add('manual');
    if (JANELA) {
      document.body.classList.add('janela');
      ajustarJanela(JANELA);
    }

    const stage = new Stage({ parent: palco, fixedResolution: MANUAL ? Math.min(2, Math.max(0.25, num('pr', 1))) : undefined, preserveDrawingBuffer: MANUAL });
    const nivelInicial: Level = QUALIDADE ?? 'alta';
    stage.setQuality(nivelInicial);
    const ctx = { renderer: stage.renderer, level: nivelInicial };
    const set = await buildVillageSet(ctx);
    const cast = buildCast(ctx);
    // câmera própria do jogo (mais fechada no Noel, a fila acima do chat); o laboratório segue com a da sala
    const camera = { ...set.look.camera, fov: num('fov', CAMERA_JOGO.fov), position: vetor('cam', CAMERA_JOGO.position), target: vetor('alvo', CAMERA_JOGO.target) };
    const fovBase = camera.fov;
    stage.applyLook({ ...set.look, camera }, set.environment ?? null);
    stage.scene.add(set.root);
    set.setQuality(nivelInicial);
    cast.setQuality(nivelInicial);

    // o Noel, sentado na poltrona da sala (raiz no centro da poltrona, com o giro dela)
    const santa = cast.createSanta();
    santa.root.position.copy(set.anchors.santa.position);
    santa.root.rotation.y = set.anchors.santa.yaw;
    stage.scene.add(santa.root);

    // configurações do modo de captura: sem voz e sem som (determinístico)
    if (MANUAL) settingsState.current = { ...settingsState.current, voiceEnabled: false, volumes: { ...settingsState.current.volumes, master: 0 } };
    if (params.has('velocidade')) settingsState.current = { ...settingsState.current, speed: Math.min(3, Math.max(0.5, num('velocidade', 1))), autoSpeed: false };

    // sem servidor (captura e demonstração): não pede a lista de áudios (evita os 404 do console)
    if (MANUAL || DEMO || STANDALONE) semListaDoServidor();
    const audio = new AudioManager();
    const hud = new Hud3D(stage.overlay, { obs: OBS });
    const sorteio = criarSorteio(`jogo:${SEMENTE}`);
    const entrega = new Entrega3D({
      stage,
      set,
      santa,
      cast,
      hud,
      audio,
      sorteio,
      velocidade: () => settingsState.effectiveSpeed,
      vozLigada: () => !MANUAL && settingsState.current.voiceEnabled,
      falarNomes: () => settingsState.current.speakNames,
      camera: camera.position,
      presenteFixo: params.get('presente'),
    });
    const diretor = new DiretorFila3D(stage.scene, set, cast, entrega, hud, audio, {
      guardar: !MANUAL,
      visiveis: params.has('visiveis') ? Math.round(num('visiveis', 11)) : null,
      camera: camera.position,
    });
    const nomes = new CamadaNomes(stage, hud, set, santa, diretor, entrega);
    const simulador = new SimuladorDeVisitantes(SEMENTE);
    const ambiente = new AmbientDirector(DEFAULT_AMBIENT);
    const falasSoltas = new PhrasePicker(sorteio);

    /* ---------------------------------------------------------- qualidade */
    // os gnomos em cena são trocados aos poucos (um por quadro, no orçamento do diretor), não todos no mesmo quadro
    const aplicarNivel = (level: Level) => {
      stage.setQuality(level);
      set.setQuality(level);
      cast.setQuality(level, true);
    };
    const perf = new PerformanceMonitor(aplicarNivel);
    // o monitor começa no nível em que a página abriu (com ?q=baixa ele não "desce" para média)
    perf.level = nivelInicial;

    const aplicarConfiguracoes = () => {
      const cfg = settingsState.current;
      hud.setDica(cfg.hintText);
      // ?q= vale mais que o painel; no modo de captura o monitor nem roda
      if (!MANUAL) perf.setMode(QUALIDADE ?? cfg.quality);
      diretor.applySettings();
      audio.applySettings(cfg);
    };
    aplicarConfiguracoes();

    /* ------------------------------------------------- eventos (mesmo bus do 2D) */
    bus.on('participant', (p) => diretor.join(p));
    bus.on('settings', aplicarConfiguracoes);
    bus.on('command', (cmd) => {
      switch (cmd) {
        case 'skip':
          diretor.skip();
          break;
        case 'clear':
          diretor.clear();
          break;
        case 'test_voice':
          entrega.testarVoz();
          break;
        case 'reload':
          location.reload();
          break;
      }
    });
    const pedirEfeito = (effect: AmbientEffectId, source: string) => {
      const r = ambiente.request({ effect, source });
      if (effect === 'SLEIGH_PASS' && r === 'iniciado') audio.sfx.play('sleigh');
      return r;
    };

    /* ------------------------------------------------------------ demonstração */
    const barra = document.getElementById('demo');
    let demo = false;
    let demoAutomatica = false;
    const ligarDemo = (automatica: boolean) => {
      if (demo) return;
      demo = true;
      demoAutomatica = automatica;
      if (!MANUAL) simulador.ligar();
      if (barra && !OBS && !MANUAL) barra.hidden = false;
      document.body.classList.add('com-demo');
      stage.resize(true);
    };
    const desligarDemo = () => {
      if (!demo) return;
      demo = false;
      simulador.desligar();
      if (barra) barra.hidden = true;
      document.body.classList.remove('com-demo');
      stage.resize(true);
    };
    if (barra) configurarBarra(barra, simulador, (e) => pedirEfeito(e, 'demonstracao'), audio, (p) => diretor.join(p));

    /* ---------------------------------------------------------------- servidor */
    let conn: ServerConnection | null = null;
    if (!MANUAL) {
      conn = new ServerConnection(
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
            default: {
              // efeitos ambientes vindos do servidor (quando o servidor passar a mandá-los)
              const m = msg as unknown as { t: string; effect?: unknown; durationSec?: unknown; source?: unknown };
              if (m.t === 'ambient' && isAmbientEffect(m.effect)) pedirEfeito(m.effect, typeof m.source === 'string' ? m.source : 'servidor');
            }
          }
        },
        (online) => {
          bus.emit('connection', { online });
          if (online && demoAutomatica) desligarDemo();
          console.info(online ? '[vila 3d] conectado ao servidor' : '[vila 3d] servidor desconectado: tentando reconectar');
        },
        {
          // sem servidor (página aberta sozinha, laboratório): liga a demonstração para o jogo não ficar parado
          onAttemptFailed: (tentativa) => {
            if (DEMO_SEM_SERVIDOR && tentativa === 1 && !conn?.online) ligarDemo(true);
          },
        },
      );
      if (DEMO || STANDALONE) ligarDemo(false);
      else conn.connect();
      bus.on('queueResult', ({ participant, result }) => {
        conn?.send({ t: 'queueResult', eventId: participant.eventId, nickname: participant.nickname, result });
      });
      bus.on('delivered', ({ participant, giftName }) => {
        conn?.send({ t: 'delivered', nickname: participant.nickname, gift: giftName });
      });
      configurarSom(audio);
      window.addEventListener('keydown', (e) => {
        if (e.key === 'r' || e.key === 'R') diretor.join(simulador.participante());
        if (e.key === 'd' || e.key === 'D') (demo ? desligarDemo() : ligarDemo(false));
      });
    } else if (DEMO) ligarDemo(false);
    if (MANUAL && params.get('auto') === '1') simulador.ligar();
    if (!MANUAL && params.get('auto') === '0') simulador.desligar();

    // fila inicial já nos lugares (?fila=N)
    const iniciais = Math.max(0, Math.round(num('fila', 0)));
    for (let i = 0; i < iniciais; i++) diretor.join(simulador.participante(), true);
    for (const e of (params.get('efeito') ?? '').split(',')) if (isAmbientEffect(e)) pedirEfeito(e, 'endereco');

    /* ------------------------------------------- aquecimento (sem engasgo depois) */
    // um gnomo e a caixa com o presente compilam os programas de shader antes do primeiro visitante
    const ensaio = cast.createVisitor('aquecimento');
    ensaio.root.position.set(set.anchors.delivery.position.x, -20, set.anchors.delivery.position.z);
    stage.scene.add(ensaio.root);
    entrega.preparar();
    // os doze presentes montados e descartados uma vez: enchem o cache de cada tipo (a primeira montagem de alguns
    // custa até 160 ms; depois, perto de zero) e compilam os programas deles
    const amostras = GIFTS.map((g) => {
      const o = cast.createGift(g.id);
      o.position.set(set.anchors.delivery.position.x, -20, set.anchors.delivery.position.z);
      stage.scene.add(o);
      return o;
    });
    stage.updateCamera(0);
    // o destaque da entrega fica sempre na conta de luzes (aceso ou com força zero): os programas compilados aqui
    // valem para a primeira entrega também (antes, acender a luz recompilava tudo e congelava a tela por segundos)
    try {
      stage.renderer.compile(stage.scene, stage.camera);
    } catch {
      /* compila no primeiro desenho */
    }
    for (const o of amostras) descartarObjeto(o);
    ensaio.root.removeFromParent();
    ensaio.dispose();

    /* ------------------------------------------------------------- o quadro */
    let t = 0;
    let ultimaAtividade = 0;
    let ultimoStatus = -1;
    const passo = (dt: number) => {
      t += dt;
      ambiente.update(dt);
      for (const effect of AMBIENT_EFFECTS) set.setAmbient(effect, ambiente.state(effect));
      set.update(dt, t);
      simulador.update(dt, diretor.esperandoTotal, (p) => diretor.join(p));
      entrega.update(dt);
      // zoom lento da câmera na revelação (volta na festa)
      const fov = fovBase - CAMERA_JOGO.zoomRevelacao * entrega.zoom;
      if (Math.abs(stage.camera.fov - fov) > 1e-4) {
        stage.camera.fov = fov;
        stage.camera.updateProjectionMatrix();
      }
      diretor.update(dt, t, true);
      santa.update(dt, t);
      stage.updateCamera(t);
      nomes.update(dt);
      hud.update(dt);

      // fala de espera quando ninguém está na fila
      const cfg = settingsState.current;
      if (diretor.ocupado || entrega.rodando || entrega.falandoSozinho) ultimaAtividade = t;
      else if (cfg.idleHintSec > 0 && t - ultimaAtividade > cfg.idleHintSec) {
        ultimaAtividade = t;
        entrega.falarSozinho(falasSoltas.pick(IDLE_LINES));
      }

      if (t - ultimoStatus >= 1) {
        ultimoStatus = t;
        const status = { ...diretor.status(perf.fps, stage.level), voice: audio.voice.info, audioLocked: audio.locked };
        conn?.send({ t: 'status', status });
        const i = stage.info();
        // FPS e nível: com ?depurar (até no OBS, para medir lá); fora do OBS também com ?fps ou "Mostrar FPS" do painel
        hud.setStatus(
          DEPURAR || (!OBS && (cfg.showFps || params.has('fps'))),
          `${Math.round(perf.fps)} fps · ${stage.level} · ${i.drawCalls} desenhos · ${(i.triangles / 1000).toFixed(0)} mil tri · ${diretor.naTela} na tela`,
          cfg.paused,
        );
      }
    };

    const info = () => {
      const i = stage.info();
      const st = diretor.status(perf.fps, stage.level);
      return {
        t: Math.round(t * 100) / 100,
        ...i,
        fila: st.queueLength,
        naTela: diretor.naTela,
        atendido: st.current ?? null,
        fase: entrega.faseAtual,
        presente: entrega.presenteAtual?.name ?? null,
        atendidos: st.served,
        velocidade: settingsState.effectiveSpeed,
        ...(params.has('depurar') ? { ...nomes.depurar(), gnomos: diretor.depurar(stage) } : {}),
      };
    };

    const avancar = (segundos: number) => {
      let resta = segundos;
      while (resta > 1e-6) {
        const dt = Math.min(1 / 30, resta);
        passo(dt);
        resta -= dt;
      }
    };

    api.frame = (dt: number) => {
      avancar(Math.max(0, dt));
      stage.render();
      return info();
    };
    api.avancar = avancar;
    api.entrar = (n = 1) => {
      for (let i = 0; i < n; i++) diretor.join(simulador.participante());
    };
    api.efeito = (id: string) => {
      if (isAmbientEffect(id)) pedirEfeito(id, 'console');
    };
    api.pular = () => diretor.skip();
    api.limpar = () => diretor.clear();
    api.info = info;
    api.medirPasso = (semente = 'medida') => medirPasso(cast, semente);

    captura.freeze = (alvo: number) => {
      while (t + 1 / 30 <= alvo + 1e-6) passo(1 / 30);
      stage.render();
      return info();
    };
    captura.info = info;
    captura.benchmark = (n: number) => {
      const gl = stage.renderer.getContext();
      const px = new Uint8Array(4);
      const t0 = performance.now();
      for (let i = 0; i < n; i++) {
        passo(1 / 60);
        stage.render();
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      }
      return (performance.now() - t0) / n;
    };

    passo(0);
    stage.render();
    document.getElementById('carregando')?.remove();
    api.pronto = true;
    captura.ready = true;

    if (!MANUAL) {
      let ultimo = performance.now();
      const inicio = ultimo;
      const loop = (agora: number) => {
        const dt = Math.min(0.1, Math.max(0, (agora - ultimo) / 1000));
        ultimo = agora;
        // começa em 'alta' e só passa a medir depois da carência: os primeiros quadros (texturas subindo para a
        // placa, sombreadores terminando de compilar) são lentos em qualquer computador e baixariam o nível à toa
        if (agora - inicio > CARENCIA_FPS * 1000) perf.frame(agora);
        passo(dt);
        stage.render();
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }
    (window as unknown as Record<string, unknown>).__vila3d = { stage, set, cast, santa, diretor, entrega, audio, bus, settings: settingsState, THREE };
  } catch (err) {
    const msg = err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err);
    api.erro = msg;
    captura.error = msg;
    console.error('[vila 3d] falhou ao iniciar', err);
    const c = document.getElementById('carregando');
    if (c) c.textContent = 'Não foi possível abrir a Vila do Noel 3D neste navegador.';
  }
}

/** Barra de botões da demonstração (fora do quadro 9:16, escondida no ?obs). */
function configurarBarra(barra: HTMLElement, sim: SimuladorDeVisitantes, efeito: (e: AmbientEffectId) => unknown, audio: AudioManager, entrar: (p: Participant) => void) {
  const on = (acao: string, fn: () => void) => barra.querySelector(`[data-acao="${acao}"]`)?.addEventListener('click', fn);
  on('um', () => entrar(sim.participante()));
  on('dez', () => sim.pedir(10));
  for (const e of AMBIENT_EFFECTS) on(e, () => efeito(e));

  const som = barra.querySelector<HTMLButtonElement>('[data-acao="som"]');
  const normal = settingsState.current.volumes.master;
  let mudo = false;
  const desenhar = () => {
    if (!som) return;
    const audivel = !audio.locked && !mudo;
    const icone = som.querySelector('.icone');
    const rotulo = som.querySelector('.rotulo');
    if (icone) icone.textContent = audivel ? '🔊' : '🔇';
    if (rotulo) rotulo.textContent = audivel ? 'Som ligado' : 'Som';
    som.setAttribute('aria-pressed', String(audivel));
  };
  // o primeiro toque só libera o som (o navegador exige); os seguintes ligam e desligam
  let travadoNoToque = audio.locked;
  som?.addEventListener('pointerdown', () => (travadoNoToque = audio.locked));
  som?.addEventListener('keydown', () => (travadoNoToque = audio.locked));
  som?.addEventListener('click', () => {
    if (!travadoNoToque) {
      mudo = !mudo;
      const cfg = settingsState.current;
      settingsState.current = { ...cfg, volumes: { ...cfg.volumes, master: mudo ? 0 : normal } };
      bus.emit('settings', settingsState.current);
    }
    void audio.unlock().then(desenhar);
  });
  window.addEventListener('pointerup', () => window.setTimeout(desenhar, 250));
  desenhar();
}

/**
 * O navegador comum só libera o som depois de um clique na página; a fonte de navegador do OBS libera sozinha.
 * - Navegador comum: aviso discreto no pé da tela ("Clique na tela para ligar o som"), que some no primeiro clique.
 * - ?obs: o aviso nunca aparece na imagem. Com ?obs&janela=1 (captura de janela, em que o som ainda precisa do
 *   clique), o pedido vai para o título da janela, que fica fora da imagem capturada, e some depois do clique.
 * O painel também avisa "A tela do jogo está sem som" enquanto o som estiver travado (status audioLocked).
 */
function configurarSom(audio: AudioManager) {
  const aviso = document.getElementById('som');
  const tituloNormal = document.title;
  const tentar = async () => {
    const ok = await audio.unlock();
    if (ok) {
      aviso?.remove();
      document.title = tituloNormal;
      window.removeEventListener('pointerdown', tentar);
      window.removeEventListener('keydown', tentar);
    }
    return ok;
  };
  window.addEventListener('pointerdown', tentar);
  window.addEventListener('keydown', tentar);
  void tentar().then((ok) => {
    if (ok) return;
    if (aviso && !OBS) aviso.hidden = false;
    if (JANELA || !OBS) document.title = `🔈 Clique na tela para ligar o som · ${tituloNormal}`;
  });
}

/**
 * Captura de janela: deixa a área da página em 9:16 (sem faixas nas laterais para cortar). O navegador só deixa
 * uma página mudar o tamanho da própria janela quando ela foi aberta por outra página (o botão do painel) ou como
 * aplicativo (abrir-janela-da-live.bat); nos outros casos o pedido é ignorado e o jogo continua centralizado em 9:16.
 */
function ajustarJanela(modo: number) {
  const acertar = () => {
    try {
      const dentroW = window.innerWidth;
      const dentroH = window.innerHeight;
      if (!dentroW || !dentroH) return;
      const alvoH = modo === 1 ? dentroH : Math.min(modo === 1080 ? 1920 : 960, screen.availHeight - (window.outerHeight - dentroH));
      const alvoW = Math.round((alvoH * 9) / 16);
      const dw = alvoW - dentroW;
      const dh = alvoH - dentroH;
      if (Math.abs(dw) > 1 || Math.abs(dh) > 1) window.resizeBy(dw, dh);
    } catch {
      /* janela comum: o navegador não deixa; o jogo segue centralizado */
    }
  };
  acertar();
  // de novo depois que a janela termina de abrir (alguns navegadores só aplicam o tamanho final depois da carga)
  window.setTimeout(acertar, 600);
}

/**
 * Mede o passo do gnomo: com walk = 1, quanto o pé de apoio desliza para trás (no espaço da raiz) por radiano de
 * fase. Andar com a fase avançando distância / isto deixa o pé parado no chão (sem patinar).
 */
function medirPasso(cast: ReturnType<typeof buildCast>, semente: string): number {
  const rig = cast.createVisitor(semente);
  const ossos: THREE.Bone[] = [];
  rig.root.traverse((o) => {
    if ((o as THREE.Bone).isBone) ossos.push(o as THREE.Bone);
  });
  // os ossos dos pés (PE_E = 19 e PE_D = 22 no esqueleto do gnomo; veja cast/gnomos/esqueleto.ts)
  const pes = ['osso19', 'osso22'].map((n) => ossos.find((b) => b.name === n)).filter((b): b is THREE.Bone => !!b);
  if (pes.length < 2) {
    rig.dispose();
    return 0;
  }
  rig.pose.walk = 1;
  let soma = 0;
  let amostras = 0;
  const passos = 240;
  const dp = (Math.PI * 4) / passos;
  const antes = pes.map((p) => p.getWorldPosition(new THREE.Vector3()));
  for (let k = 0; k < passos; k++) {
    rig.pose.phase += dp;
    rig.update(1 / 120, k / 120);
    rig.root.updateMatrixWorld(true);
    const agora = pes.map((p) => p.getWorldPosition(new THREE.Vector3()));
    // o pé de apoio é o mais baixo
    const apoio = agora[0].y < agora[1].y ? 0 : 1;
    if (k > passos / 4) {
      soma += Math.max(0, antes[apoio].z - agora[apoio].z) / dp;
      amostras++;
    }
    antes[0].copy(agora[0]);
    antes[1].copy(agora[1]);
  }
  rig.dispose();
  return amostras ? soma / amostras : 0;
}

void iniciar();

