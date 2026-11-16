import type { ClientRole, DenyReason, ToClient, ToServer } from '../../shared/types';
import { loadBackend, screenKeyFrom, type BackendInfo } from './backend';

export interface ConnectionOptions {
  /**
   * Senha enviada ao conectar. O painel passa a senha do painel; na tela do jogo, sem esta
   * opção, vai a chave da tela que está no endereço (?tela=...), quando houver.
   */
  token?: () => string | null;
  /**
   * O servidor recusou a conexão (senha ou chave ausente/errada). A reconexão automática para.
   * Na tela do jogo, sem esta opção, aparece um aviso explicando o que fazer.
   */
  onDenied?: (reason: DenyReason) => void;
  /** Uma tentativa de conexão falhou (servidor fora do ar, endereço errado ou página não permitida). */
  onAttemptFailed?: (attempt: number, info: BackendInfo) => void;
}

/**
 * Conexão WebSocket com reconexão automática.
 * Usada tanto pela tela do jogo quanto pelo painel. O endereço do servidor vem de
 * events/backend.ts (config.json ou a própria página).
 */
export class ServerConnection {
  private ws: WebSocket | null = null;
  private retry = 0;
  private closed = false;
  private timer: number | undefined;
  private failures = 0;
  online = false;
  backend: BackendInfo | null = null;

  constructor(
    private readonly role: ClientRole,
    private readonly onMessage: (msg: ToClient) => void,
    private readonly onStatus: (online: boolean) => void,
    private readonly options: ConnectionOptions = {},
  ) {}

  connect() {
    this.closed = false;
    window.clearTimeout(this.timer);
    void this.open();
  }

  private async open() {
    const info = await loadBackend();
    this.backend = info;
    if (this.closed || this.ws) return;
    if (info.fatal) {
      // config.json quebrado: espera e lê o arquivo de novo, sem conectar na própria página
      this.failed(info);
      return;
    }
    let ws: WebSocket;
    let opened = false;
    try {
      ws = new WebSocket(info.ws);
    } catch {
      this.failed(info);
      return;
    }
    this.ws = ws;

    ws.onopen = () => {
      opened = true;
      this.retry = 0;
      this.failures = 0;
      this.online = true;
      const token = (this.options.token ? this.options.token() : this.role === 'game' ? screenKeyFrom(location.search, location.hash) : null) ?? '';
      this.send(token ? { t: 'hello', role: this.role, token } : { t: 'hello', role: this.role });
      this.onStatus(true);
    };
    ws.onmessage = (e) => {
      let msg: ToClient;
      try {
        msg = JSON.parse(String(e.data)) as ToClient;
      } catch (err) {
        console.warn('[conexão] mensagem inválida', err);
        return;
      }
      if (msg.t === 'denied') {
        // senha ausente ou errada: não adianta tentar de novo sozinho
        this.closed = true;
        window.clearTimeout(this.timer);
        if (this.options.onDenied) this.options.onDenied(msg.reason);
        else if (this.role === 'game') showScreenDenied(msg.reason);
      }
      try {
        this.onMessage(msg);
      } catch (err) {
        console.warn('[conexão] erro ao tratar mensagem', err);
      }
    };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      if (this.online) {
        this.online = false;
        this.onStatus(false);
      }
      if (!opened) this.failed(info);
      else this.scheduleReconnect();
    };
    ws.onerror = () => ws.close();
  }

  private failed(info: BackendInfo) {
    this.failures++;
    this.options.onAttemptFailed?.(this.failures, info);
    this.scheduleReconnect();
  }

  private scheduleReconnect() {
    if (this.closed) return;
    const delay = Math.min(8000, 600 * 2 ** Math.min(this.retry++, 4));
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => void this.open(), delay);
  }

  send(msg: ToServer): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
      return true;
    }
    return false;
  }

  close() {
    this.closed = true;
    window.clearTimeout(this.timer);
    const ws = this.ws;
    this.ws = null;
    ws?.close();
    if (this.online) {
      this.online = false;
      this.onStatus(false);
    }
  }
}

const SCREEN_DENIED_TEXT: Record<DenyReason, string> = {
  token_ausente:
    'Esta tela do jogo precisa da chave da tela. Abra o painel, copie o "Endereço para o OBS" e use esse endereço completo (com ?tela=...).',
  token_invalido:
    'A chave da tela neste endereço está errada (a senha do painel mudou?). Abra o painel, copie de novo o "Endereço para o OBS" e atualize a fonte no OBS.',
  bloqueado: 'Tentativas erradas demais com a chave da tela. Espere 10 minutos ou reinicie o servidor, e use o endereço copiado do painel.',
  telas_demais: 'Já há telas do jogo demais abertas neste servidor. Feche as outras (abas, janelas, outras cenas do OBS) e recarregue esta.',
};

/** Aviso fixo na tela do jogo quando o servidor recusa a conexão (2D e 3D usam o mesmo). */
function showScreenDenied(reason: DenyReason) {
  console.warn(`[conexão] tela do jogo recusada pelo servidor: ${reason}`);
  let el = document.getElementById('vila-aviso-conexao');
  if (!el) {
    el = document.createElement('div');
    el.id = 'vila-aviso-conexao';
    el.setAttribute('role', 'alert');
    Object.assign(el.style, {
      position: 'fixed',
      left: '4%',
      right: '4%',
      top: '4%',
      zIndex: '9999',
      padding: '18px 22px',
      borderRadius: '14px',
      background: 'rgba(120, 20, 30, 0.94)',
      color: '#fff',
      font: '600 22px/1.35 Fredoka, system-ui, sans-serif',
      boxShadow: '0 6px 24px rgba(0,0,0,.4)',
    });
    document.body.append(el);
  }
  el.textContent = SCREEN_DENIED_TEXT[reason];
}
