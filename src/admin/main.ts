import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/600.css';
import './painel.css';
import {
  DEFAULT_SETTINGS,
  type DenyReason,
  type GameCommand,
  type GameStatus,
  type LogEntry,
  type Settings,
  type SimKind,
} from '../../shared/types';
import { AMBIENT_EFFECTS, DEFAULT_AMBIENT_GIFTS, isAmbientEffect, type AmbientGiftRule } from '../../shared/ambient';
import { normalizarUsuarioTikTok, type TikTokPanelInfo, type TikTokState } from '../../shared/tiktok';
import { checkHealth, loadBackend, type BackendInfo } from '../events/backend';
import { ServerConnection } from '../events/ServerConnection';

/**
 * Painel de controle (separado da tela da transmissão).
 * Liga a leitura da live do TikTok, toca os efeitos da sala e envia simulações, comandos e
 * configurações ao servidor (no computador ou na VM).
 * Quando o servidor exige senha (TOKEN_ADMIN), o painel pede na primeira vez e guarda
 * só neste navegador.
 */

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

let settings: Settings = { ...DEFAULT_SETTINGS, volumes: { ...DEFAULT_SETTINGS.volumes } };

/* ---------- senha do painel ---------- */

// A senha é guardada por servidor: um link com outro ?servidor= não recebe a senha deste.
const TOKEN_PREFIX = 'vila-do-noel:senha:';
let memoryToken: string | null = null; // quando o navegador não deixa guardar (janela anônima)

const serverLabel = (info: BackendInfo | null) => info?.base || location.origin;
const tokenKey = () => TOKEN_PREFIX + serverLabel(conn.backend);

function readToken(): string | null {
  try {
    return localStorage.getItem(tokenKey()) ?? memoryToken;
  } catch {
    return memoryToken;
  }
}

function saveToken(token: string | null) {
  memoryToken = token;
  try {
    if (token) localStorage.setItem(tokenKey(), token);
    else localStorage.removeItem(tokenKey());
  } catch {
    /* fica só na memória até fechar a página */
  }
}

const DENY_TEXT: Record<DenyReason, string> = {
  token_ausente: '',
  token_invalido: 'Senha errada. Confira o valor de TOKEN_ADMIN no arquivo .env do servidor (maiúsculas e minúsculas contam).',
  bloqueado:
    'Muitas tentativas erradas seguidas. Por segurança o servidor bloqueou o painel para este endereço por 10 minutos (a live continua recebendo eventos). Espere, ou reinicie o serviço na VM: sudo systemctl restart vila-do-noel',
  telas_demais: '',
};

function showLogin(reason: DenyReason | null) {
  $('entrada-servidor').textContent = serverLabel(conn.backend) + (conn.backend?.from === 'link' ? ' (vindo do link ?servidor=)' : '');
  const error = $('entrada-erro');
  const text = reason ? DENY_TEXT[reason] : '';
  error.textContent = text;
  error.hidden = !text;
  $('entrada').hidden = false;
  $('aviso-servidor').hidden = true;
  const input = $<HTMLInputElement>('entrada-token');
  input.value = '';
  input.focus();
}

$('entrada-form').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const token = $<HTMLInputElement>('entrada-token').value.trim();
  if (!token) return;
  saveToken(token);
  $('entrada-erro').hidden = true;
  $('entrada').hidden = true;
  $('selo-servidor').textContent = 'Servidor: conectando…';
  conn.connect();
});

$('btn-sair').addEventListener('click', () => {
  saveToken(null);
  conn.close();
  // a chave da tela só aparece para quem entrou com a senha
  screenKey = null;
  welcomed = false;
  $<HTMLInputElement>('obs-url').value = '';
  $('cartao-obs').hidden = true;
  showLogin(null);
});

/* ---------- avisos de conexão ---------- */

function showServerProblem(text: string | null) {
  const el = $('aviso-servidor');
  el.textContent = text ?? '';
  el.hidden = !text;
}

let diagnosing = false;

function setServerBadge(text: string) {
  $('selo-servidor').textContent = text;
}

/** Explica por que não conectou: servidor fora do ar, endereço errado ou página não permitida. */
async function diagnose(info: BackendInfo) {
  if (info.fatal) {
    // config.json com erro de digitação: só isso importa (nem dá para saber onde está o servidor)
    setServerBadge('Servidor: config.json com erro');
    showServerProblem(info.problem ?? null);
    return;
  }
  if (diagnosing) return;
  diagnosing = true;
  const where = serverLabel(info);
  const health = await checkHealth(info);
  diagnosing = false;
  if (conn.online) return;
  const prefix = info.problem ? `${info.problem} ` : '';
  if (!health.online) {
    setServerBadge('Servidor: fora do ar');
    showServerProblem(
      `${prefix}Não foi possível falar com o servidor em ${where}. Confira se a VM e o serviço estão ligados e se o endereço no config.json está certo. Tentando de novo sozinho…`,
    );
  } else if (health.originAllowed === false) {
    setServerBadge('Servidor: recusou esta página');
    showServerProblem(
      `O servidor ${where} está no ar, mas não aceita esta página. No arquivo .env do servidor, acrescente ,${location.origin} no fim da linha ORIGENS_PERMITIDAS (separado por vírgula, sem apagar o que já está lá) e reinicie o serviço: sudo systemctl restart vila-do-noel`,
    );
  } else {
    setServerBadge('Servidor: no ar, sem conexão');
    showServerProblem(
      `O servidor ${where} está no ar, mas a conexão em tempo real (WebSocket) não abriu. Confira o proxy reverso (Caddy) e tente recarregar a página.`,
    );
  }
}

const conn = new ServerConnection(
  'panel',
  (msg) => {
    switch (msg.t) {
      case 'welcome':
        $('entrada').hidden = true;
        $('btn-sair').hidden = !msg.requiresToken;
        showServerProblem(null);
        screenKey = msg.screenKey ?? null;
        welcomed = true;
        updateGameLinks();
        break;
      case 'settings':
        settings = msg.settings;
        renderSettings();
        break;
      case 'status':
        renderStatus(msg.status, msg.games);
        break;
      case 'log':
        addLog(msg.entry);
        break;
      case 'logHistory':
        $('log').innerHTML = '';
        msg.entries.forEach(addLog);
        break;
      case 'tiktok':
        tiktok = msg.info;
        renderTikTok();
        break;
    }
  },
  (online) => {
    if (!online) {
      tiktok = null;
      renderTikTok();
    }
    const el = $('selo-servidor');
    el.textContent = online ? 'Servidor: conectado' : 'Servidor: desconectado';
    el.title = serverLabel(conn.backend);
    el.classList.toggle('ok', online);
    if (online) showServerProblem(null);
    else renderStatus(null, 0);
  },
  {
    token: readToken,
    onDenied: (reason) => {
      if (reason === 'token_invalido') saveToken(null);
      showLogin(reason);
    },
    onAttemptFailed: (attempt, info) => {
      if (attempt === 1) setServerBadge('Servidor: conectando…');
      if (attempt === 1 || attempt % 6 === 0) void diagnose(info);
    },
  },
);
conn.connect();

/* ---------- endereço da tela do jogo (OBS) ---------- */

/** Chave da tela do jogo, recebida do servidor depois da senha certa (null = o servidor não exige). */
let screenKey: string | null = null;
/** O servidor já aceitou este painel (só então o endereço do OBS aparece). */
let welcomed = false;

/** Endereço da tela do jogo: com a chave da tela e, ao testar com ?servidor=, o mesmo servidor. */
function gameUrl(obs: boolean): string {
  const url = new URL('/', location.href);
  if (obs) url.searchParams.set('obs', '');
  if (conn.backend?.from === 'link') url.searchParams.set('servidor', conn.backend.base);
  if (screenKey) url.searchParams.set('tela', screenKey);
  return url.href.replace('?obs=&', '?obs&').replace(/\?obs=$/, '?obs');
}

function updateGameLinks() {
  $<HTMLAnchorElement>('abrir-jogo').href = gameUrl(false);
  const box = $('cartao-obs');
  box.hidden = !welcomed;
  $<HTMLInputElement>('obs-url').value = gameUrl(true);
  $('obs-chave-info').hidden = !screenKey;
}

$('obs-copiar').addEventListener('click', () => {
  const input = $<HTMLInputElement>('obs-url');
  const done = () => {
    $('obs-copiar').textContent = 'Copiado!';
    window.setTimeout(() => ($('obs-copiar').textContent = 'Copiar'), 1800);
  };
  input.select();
  if (navigator.clipboard) navigator.clipboard.writeText(input.value).then(done, () => document.execCommand('copy') && done());
  else if (document.execCommand('copy')) done();
});

void loadBackend().then((info) => {
  if (info.problem) showServerProblem(info.problem);
  if (info.fatal) setServerBadge('Servidor: config.json com erro');
  updateGameLinks();
});

/* ---------- simulador e comandos ---------- */

document.querySelectorAll<HTMLButtonElement>('[data-sim]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const count = Number(btn.dataset.count ?? 1);
    conn.send({ t: 'simulate', kind: btn.dataset.sim as SimKind, count });
  });
});

document.querySelectorAll<HTMLButtonElement>('[data-cmd]').forEach((btn) => {
  btn.addEventListener('click', () => conn.send({ t: 'command', cmd: btn.dataset.cmd as GameCommand }));
});

// Abre a tela do jogo numa janela à parte, no formato vertical, para ficar visível ao lado do painel.
// (Numa aba escondida o navegador pausa as animações; por isso uma janela separada é melhor.)
$('abrir-jogo').addEventListener('click', (ev) => {
  const h = Math.max(520, Math.min(window.screen.availHeight - 80, 960));
  const w = Math.round((h * 9) / 16);
  const left = Math.max(0, window.screen.availWidth - w - 20);
  const href = ($('abrir-jogo') as HTMLAnchorElement).href;
  const win = window.open(href, 'vila-do-noel-jogo', `popup=yes,width=${w},height=${h},left=${left},top=20`);
  // se o navegador bloquear a janela, o próprio link abre a tela em uma aba
  if (win) {
    ev.preventDefault();
    win.focus();
  }
});

$('btn-pausa').addEventListener('click', () => patch({ paused: !settings.paused }));

$('btn-limpar').addEventListener('click', () => {
  if (confirm('Remover todo mundo que está aguardando na fila?')) conn.send({ t: 'command', cmd: 'clear' });
});

$('btn-padrao').addEventListener('click', () => {
  if (confirm('Voltar todas as configurações para o padrão?')) conn.send({ t: 'resetSettings' });
});

/* ---------- configurações ---------- */

let sendTimer: number | undefined;
let pending: Partial<Settings> = {};

function patch(p: Partial<Settings>) {
  settings = { ...settings, ...p, volumes: { ...settings.volumes, ...(p.volumes ?? {}) } };
  pending = { ...pending, ...p, ...(p.volumes ? { volumes: settings.volumes } : {}) };
  renderSettings();
  window.clearTimeout(sendTimer);
  sendTimer = window.setTimeout(() => {
    conn.send({ t: 'settings', patch: pending });
    pending = {};
  }, 120);
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

function bindRange(id: string, read: () => number, write: (v: number) => void, fmt: (v: number) => string) {
  const input = $<HTMLInputElement>(id);
  input.addEventListener('input', () => write(Number(input.value)));
  return () => {
    if (document.activeElement !== input) input.value = String(read());
    $(`o-${id}`).textContent = fmt(read());
  };
}

function bindNumber(id: keyof Settings) {
  const input = $<HTMLInputElement>(id);
  input.addEventListener('change', () => patch({ [id]: Number(input.value) } as Partial<Settings>));
  return () => {
    if (document.activeElement !== input) input.value = String(settings[id]);
  };
}

function bindCheck(id: keyof Settings) {
  const input = $<HTMLInputElement>(id);
  input.addEventListener('change', () => patch({ [id]: input.checked } as Partial<Settings>));
  return () => {
    input.checked = Boolean(settings[id]);
  };
}

const renderers: Array<() => void> = [
  bindRange('speed', () => settings.speed, (v) => patch({ speed: v }), (v) => `${v.toFixed(1)}x`),
  bindRange('maxVisible', () => settings.maxVisible, (v) => patch({ maxVisible: v }), (v) => String(v)),
  bindRange('vol-master', () => settings.volumes.master, (v) => patch({ volumes: { ...settings.volumes, master: v } }), pct),
  bindRange('vol-music', () => settings.volumes.music, (v) => patch({ volumes: { ...settings.volumes, music: v } }), pct),
  bindRange('vol-sfx', () => settings.volumes.sfx, (v) => patch({ volumes: { ...settings.volumes, sfx: v } }), pct),
  bindRange('vol-voice', () => settings.volumes.voice, (v) => patch({ volumes: { ...settings.volumes, voice: v } }), pct),
  bindNumber('maxQueue'),
  bindNumber('rejoinCooldownSec'),
  bindNumber('idleHintSec'),
  bindCheck('autoSpeed'),
  bindCheck('voiceEnabled'),
  bindCheck('speakNames'),
  bindCheck('giftJoins'),
  bindCheck('followJoins'),
  bindCheck('showFps'),
];

const commands = $<HTMLInputElement>('chatCommands');
commands.addEventListener('change', () => patch({ chatCommands: commands.value.split(',').map((c) => c.trim()).filter(Boolean) }));
const hint = $<HTMLInputElement>('hintText');
hint.addEventListener('change', () => patch({ hintText: hint.value }));
const quality = $<HTMLSelectElement>('quality');
quality.addEventListener('change', () => patch({ quality: quality.value as Settings['quality'] }));

function renderSettings() {
  renderers.forEach((r) => r());
  if (document.activeElement !== commands) commands.value = settings.chatCommands.join(', ');
  if (document.activeElement !== hint) hint.value = settings.hintText;
  quality.value = settings.quality;
  const pause = $('btn-pausa');
  pause.textContent = settings.paused ? '▶ Retomar atendimentos' : '⏸ Pausar atendimentos';
  pause.classList.toggle('ativo', settings.paused);
}

/* ---------- estado e registro ---------- */

const QUALITY_NAME: Record<string, string> = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };

function renderStatus(status: GameStatus | null, games: number) {
  const jogo = $('selo-jogo');
  jogo.textContent = games > 0 ? `Tela do jogo: aberta${games > 1 ? ` (${games})` : ''}` : 'Tela do jogo: fechada';
  jogo.classList.toggle('ok', games > 0);
  $('aviso-telas').hidden = games < 2;
  $('abrir-jogo').classList.toggle('dourado', games === 0);
  $('selo-fps').textContent = status ? `FPS: ${status.fps}` : 'FPS: —';
  $('n-fila').textContent = String(status?.queueLength ?? 0);
  $('n-espera').textContent = String(status?.waitingOffscreen ?? 0);
  $('n-atendidos').textContent = String(status?.served ?? 0);
  $('atual').textContent = status?.current ?? 'ninguém';
  $('q-atual').textContent = status ? QUALITY_NAME[status.quality] ?? status.quality : '—';
  $('v-atual').textContent = status ? `${status.effectiveSpeed.toFixed(1)}x` : '—';
  $('voz-info').textContent = soundInfo(status);
}

/** Explica, em uma frase, como está o som da tela do jogo (a dúvida mais comum ao usar o OBS). */
function soundInfo(status: GameStatus | null): string {
  if (!status) return 'Abra a tela do jogo para ver a situação do som.';
  if (status.audioLocked) return '⚠️ A tela do jogo está sem som: clique uma vez nela para liberar o áudio.';
  const v = status.voice;
  if (!v) return '';
  if (v.state === 'ok') return `Voz desta tela: funcionando (${v.name}).`;
  if (v.state === 'sem_teste') return 'Voz desta tela: ainda não testada. Clique em "Testar voz".';
  return v.recorded > 0
    ? `Esta tela não tem voz sintetizada. Frases gravadas encontradas: ${v.recorded}.`
    : 'Esta tela não tem voz sintetizada (normal na fonte de navegador do OBS). O jogo segue sem a voz; veja docs/AUDIO.md.';
}

function addLog(entry: LogEntry) {
  const list = $('log');
  const li = document.createElement('li');
  const time = document.createElement('time');
  time.textContent = new Date(entry.ts).toLocaleTimeString('pt-BR');
  const text = document.createElement('span');
  text.className = entry.level;
  text.textContent = entry.text;
  li.append(time, text);
  list.prepend(li);
  while (list.children.length > 200) list.lastElementChild?.remove();
}

/* ---------- live do TikTok ---------- */

/** Situação da leitura da live, vinda do servidor (null = servidor desconectado). */
let tiktok: TikTokPanelInfo | null = null;
/** O dono está digitando outro @ (não sobrescrever o campo com o que veio do servidor). */
let ttEditing = false;

const TT_SELO: Record<TikTokState, { text: string; cls: string }> = {
  desligado: { text: 'Desligado', cls: 'neutro' },
  conectando: { text: 'Conectando…', cls: 'aguardando' },
  aguardando_live: { text: 'Esperando a live começar', cls: 'aguardando' },
  conectado: { text: 'Ao vivo', cls: 'ok' },
  reconectando: { text: 'Reconectando', cls: 'aguardando' },
  erro: { text: 'Precisa de atenção', cls: '' },
};

const ttInput = $<HTMLInputElement>('tt-usuario');
const ttError = $('tt-erro');

function showTikTokError(text: string | null) {
  ttError.textContent = text ?? '';
  ttError.hidden = !text;
}

ttInput.addEventListener('input', () => {
  ttEditing = true;
  showTikTokError(null);
  renderTikTok();
});

/** O @ digitado, já limpo, ou null quando está vazio ou inválido. */
function typedUser(): string | null {
  return normalizarUsuarioTikTok(ttInput.value);
}

$('tt-form').addEventListener('submit', (ev) => {
  ev.preventDefault();
  if (!tiktok) return;
  const cfg = tiktok.config;
  const typed = typedUser();
  const changing = typed !== null && typed !== cfg.usuario;
  // depois de um erro, o mesmo botão tenta de novo (ex.: o @ foi corrigido no TikTok)
  const retry = tiktok.status.state === 'erro';
  if (cfg.ligado && !changing && !retry) {
    conn.send({ t: 'tiktokConfig', ligado: false });
    return;
  }
  if (!typed) {
    showTikTokError(
      ttInput.value.trim()
        ? 'Esse @ não parece uma conta do TikTok. Use só letras, números, ponto e sublinhado (ex.: @vila.do.noel).'
        : 'Escreva o @ da sua conta do TikTok (o mesmo que aparece no seu perfil).',
    );
    ttInput.focus();
    return;
  }
  showTikTokError(null);
  ttEditing = false;
  conn.send({ t: 'tiktokConfig', usuario: typed, ligado: true });
});

// "Conferir agora": enquanto espera a live ou reconecta, tenta na hora (o servidor trata o mesmo @
// ligado de novo como pedido de tentativa imediata). Sem este botão, o único botão era "Desconectar".
$('tt-agora').addEventListener('click', () => {
  if (!tiktok?.config.ligado || !tiktok.config.usuario) return;
  conn.send({ t: 'tiktokConfig', usuario: tiktok.config.usuario, ligado: true });
});

$('tt-chave-salvar').addEventListener('click', () => {
  const input = $<HTMLInputElement>('tt-chave');
  const key = input.value.trim();
  if (!key) {
    input.focus();
    return;
  }
  conn.send({ t: 'tiktokConfig', chave: key });
  // a chave não fica na página depois de enviada
  input.value = '';
});

$('tt-chave-apagar').addEventListener('click', () => {
  if (confirm('Apagar a chave do Euler Stream salva pelo painel?')) conn.send({ t: 'tiktokConfig', chave: null });
});

function renderTikTok() {
  const selo = $('tt-selo');
  const button = $<HTMLButtonElement>('tt-botao');
  const info = tiktok;
  if (!info) {
    selo.textContent = 'Sem servidor';
    selo.className = 'selo neutro';
    $('tt-mensagem').textContent = 'O painel não está conectado ao servidor do jogo.';
    button.disabled = true;
    $('tt-sala').hidden = true;
    $('tt-agora').hidden = true;
    return;
  }
  const { status, contadores, config } = info;
  const look = TT_SELO[status.state] ?? TT_SELO.desligado;
  selo.textContent = look.text;
  selo.className = `selo ${look.cls}`.trim();
  $('tt-mensagem').textContent = status.mensagem;

  if (!ttEditing && document.activeElement !== ttInput) ttInput.value = config.usuario ? `@${config.usuario}` : '';
  const typed = typedUser();
  button.disabled = false;
  if (config.ligado && typed && typed !== config.usuario) button.textContent = `Conectar a @${typed}`;
  else if (config.ligado && status.state === 'erro') button.textContent = 'Conectar de novo';
  else if (config.ligado) button.textContent = 'Desconectar';
  else button.textContent = 'Conectar';
  button.classList.toggle('primario', !config.ligado || (typed !== null && typed !== config.usuario));
  $('tt-agora').hidden = !(config.ligado && (status.state === 'aguardando_live' || status.state === 'reconectando'));

  const sala = $('tt-sala');
  const parts: string[] = [];
  if (status.state === 'conectado' && status.sala) parts.push(`Live: ${status.sala}`);
  if (status.state === 'conectado' && status.espectadores) parts.push(`${status.espectadores.toLocaleString('pt-BR')} assistindo agora`);
  sala.textContent = parts.join(' · ');
  sala.hidden = parts.length === 0;

  $('tt-comentarios').textContent = contadores.comentarios.toLocaleString('pt-BR');
  $('tt-presentes').textContent = contadores.presentes.toLocaleString('pt-BR');
  $('tt-curtidas').textContent = contadores.curtidas.toLocaleString('pt-BR');
  $('tt-fila').textContent = contadores.entraramNaFila.toLocaleString('pt-BR');
  // os outros números também ajudam a conferir, na primeira live, se seguir e compartilhar estão chegando
  $('tt-outros').textContent =
    `Seguidores: ${contadores.seguidores.toLocaleString('pt-BR')} · ` +
    `Compartilhamentos: ${contadores.compartilhamentos.toLocaleString('pt-BR')} · ` +
    `Efeitos pedidos por presentes: ${contadores.efeitos.toLocaleString('pt-BR')}`;

  $('tt-chave-info').textContent = !config.chaveDefinida
    ? 'Nenhuma chave salva (usando o limite gratuito).'
    : config.chaveOrigem === 'painel'
      ? 'Chave salva pelo painel. Ela fica só no servidor.'
      : 'Usando a chave do arquivo .env do servidor (EULER_API_KEY). Para trocar, salve outra aqui.';
  $<HTMLButtonElement>('tt-chave-apagar').disabled = config.chaveOrigem !== 'painel';
}

/* ---------- efeitos da sala ---------- */

document.querySelectorAll<HTMLButtonElement>('[data-efeito]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const effect = btn.dataset.efeito;
    if (isAmbientEffect(effect)) conn.send({ t: 'ambient', effect });
  });
});

/** Cópia da regra atual, para mudar um pedaço e mandar inteira. */
function currentRule(): AmbientGiftRule {
  const r = settings.ambientGifts ?? DEFAULT_AMBIENT_GIFTS;
  return {
    enabled: r.enabled,
    onlyQueue: [...r.onlyQueue],
    effects: Object.fromEntries(AMBIENT_EFFECTS.map((id) => [id, { minCoins: r.effects[id].minCoins, names: [...r.effects[id].names] }])) as AmbientGiftRule['effects'],
  };
}

const efOn = $<HTMLInputElement>('ef-ligado');
efOn.addEventListener('change', () => patch({ ambientGifts: { ...currentRule(), enabled: efOn.checked } }));
for (const id of AMBIENT_EFFECTS) {
  const input = $<HTMLInputElement>(`ef-min-${id}`);
  input.addEventListener('change', () => {
    const rule = currentRule();
    rule.effects[id].minCoins = Math.max(0, Math.round(Number(input.value) || 0));
    patch({ ambientGifts: rule });
  });
}
const efOnlyQueue = $<HTMLInputElement>('ef-so-fila');
efOnlyQueue.addEventListener('change', () => {
  const rule = currentRule();
  rule.onlyQueue = efOnlyQueue.value.split(',').map((n) => n.trim()).filter(Boolean);
  patch({ ambientGifts: rule });
});
$('ef-padrao').addEventListener('click', () => {
  if (confirm('Voltar a regra dos efeitos para a provisória?')) patch({ ambientGifts: DEFAULT_AMBIENT_GIFTS });
});

function renderEffects() {
  const rule = settings.ambientGifts ?? DEFAULT_AMBIENT_GIFTS;
  efOn.checked = rule.enabled;
  for (const id of AMBIENT_EFFECTS) {
    const input = $<HTMLInputElement>(`ef-min-${id}`);
    if (document.activeElement !== input) input.value = String(rule.effects[id].minCoins);
    input.disabled = !rule.enabled;
  }
  if (document.activeElement !== efOnlyQueue) efOnlyQueue.value = rule.onlyQueue.join(', ');
}
renderers.push(renderEffects);

renderSettings();
renderStatus(null, 0);
renderTikTok();
