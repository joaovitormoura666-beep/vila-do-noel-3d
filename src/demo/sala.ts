/**
 * Cena de demonstração da sala natalina 3D: só o cenário, com botões para testar
 * os eventos ambientais à mão. Não usa servidor, fila nem TikTok.
 *
 * Endereço: demo-sala.html (ou "npm run sala" para gerar a pasta dist-sala).
 *   ?manual=1  não anima sozinho: a ferramenta de captura avança o tempo com window.__sala.frame(dt)
 *   ?q=baixa   força um nível de qualidade (alta, media, baixa); sem isso, ajusta sozinho pelo FPS
 */
import { AMBIENT_EFFECTS, AMBIENT_LABELS, DEFAULT_AMBIENT, isAmbientEffect, type AmbientResult } from '../../shared/ambient';
import { AmbientDirector } from '../ambient/AmbientDirector';
import { PerformanceMonitor } from '../effects/PerformanceMonitor';
import { Stage } from '../engine/Stage';
import type { Level } from '../world/contracts';
import { buildVillageSet } from '../world/set/index';

const RESULT_TEXT: Record<AmbientResult, string> = {
  iniciado: 'tocando',
  na_fila: 'aguardando a vez',
  prolongado: 'prolongado',
  descartado: 'ignorado (proteção contra excesso)',
  desligado: 'desligado',
};

async function start() {
  const params = new URLSearchParams(location.search);
  const parent = document.getElementById('palco');
  if (!parent) return;
  const manual = params.get('manual') === '1';
  const q = params.get('q');
  const forced: Level | null = q === 'alta' || q === 'media' || q === 'baixa' ? q : null;

  const stage = new Stage({ parent, preserveDrawingBuffer: manual, fixedResolution: manual ? Number(params.get('pr') ?? 1) : undefined });
  const set = await buildVillageSet({ renderer: stage.renderer, level: forced ?? 'alta' });
  document.getElementById('carregando')?.remove();
  stage.applyLook(set.look, set.environment ?? null);
  stage.scene.add(set.root);
  const director = new AmbientDirector(DEFAULT_AMBIENT);

  const applyLevel = (level: Level) => {
    stage.setQuality(level);
    set.setQuality(level);
    const tag = document.getElementById('nivel');
    if (tag) tag.textContent = level;
  };
  const perf = new PerformanceMonitor(applyLevel);
  perf.setMode(forced ?? 'auto');
  if (forced) applyLevel(forced);

  let t = 0;
  const frame = (dt: number) => {
    t += dt;
    director.update(dt);
    for (const effect of AMBIENT_EFFECTS) set.setAmbient(effect, director.state(effect));
    set.update(dt, t);
    stage.updateCamera(t);
    stage.render();
  };

  // botões dos efeitos
  const status = document.getElementById('estado');
  const buttons = new Map<string, HTMLButtonElement>();
  document.querySelectorAll<HTMLButtonElement>('[data-efeito]').forEach((b) => {
    const id = b.dataset.efeito ?? '';
    if (!isAmbientEffect(id)) return;
    buttons.set(id, b);
    b.addEventListener('click', () => {
      const result = director.request({ effect: id, source: 'demonstracao' });
      if (status) status.textContent = `${AMBIENT_LABELS[id]}: ${RESULT_TEXT[result]}`;
    });
  });
  const refreshButtons = () => {
    const snap = director.snapshot();
    for (const [id, b] of buttons) {
      const active = snap.active.some((a) => a.effect === id);
      const queued = snap.queued.includes(id as (typeof snap.queued)[number]);
      b.classList.toggle('ativo', active);
      b.classList.toggle('espera', queued && !active);
    }
  };

  frame(0);
  if (!manual) {
    let last = performance.now();
    let lastUi = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
      last = now;
      if (!document.hidden) {
        perf.frame(now);
        frame(dt);
        if (now - lastUi > 250) {
          lastUi = now;
          refreshButtons();
          const fps = document.getElementById('fps');
          if (fps) fps.textContent = String(Math.round(perf.fps));
        }
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  (window as unknown as Record<string, unknown>).__sala = { stage, set, director, frame, info: () => ({ t, ...stage.info() }) };
}

void start();
