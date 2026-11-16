/**
 * Interface da live em HTML por cima do canvas (não em WebGL): título, instrução (com a rosa desenhada), contador da
 * fila (com quantos ainda estão a caminho), a pílula "Agora" com quem está sendo atendido, balão de fala do Noel
 * (à esquerda da cabeça dele, para a janela ficar livre), faixa da revelação, aviso e as etiquetas de nome (avatar
 * redondo + apelido) dos primeiros da fila.
 *
 * Tudo vive na camada do palco (Stage.overlay), em pixels de projeto 1080x1920 (o palco escala junto com o
 * canvas). Os textos e tamanhos foram escolhidos para ler em 1080x1920 e no celular. As zonas da live: 0 a 190
 * barra do TikTok (vazia), 190 a 430 título, instrução e contador, 440 a 1480 área de jogo, abaixo de 1480 o chat.
 *
 * Cada elemento só mexe em `transform` e `opacity` por quadro (nada de layout no caminho quente), e só quando a
 * posição muda; os tamanhos são medidos uma vez, quando o texto muda.
 */
import { DEFAULT_SETTINGS, type Participant } from '../../shared/types';
import { avatarSrc, backendNow } from '../events/backend';
import { hashTexto } from './sorteio';

/** As mesmas cores de fundo da inicial que o 2D usa (src/characters/NameLabel.ts). */
const AVATAR_BG = ['#B62835', '#226B53', '#B98A36', '#2F7FB5', '#7A4B9A', '#D9773B', '#2E8C8C', '#C24E7B'];

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * A rosa da instrução, desenhada aqui (arte original, na paleta): o emoji 🌹 sai diferente em cada sistema
 * (Windows com OBS, celular, Linux), então a tela usa sempre este desenho.
 */
const ROSA_SVG =
  '<svg viewBox="0 0 32 32" aria-hidden="true">' +
  '<path d="M16 31V17" stroke="#2c7a52" stroke-width="2.4" stroke-linecap="round" fill="none"/>' +
  '<path d="M16 25c-3.6-3-6.6-2.6-8.4-.6 3 2.4 6 2.4 8.4.6z" fill="#2c7a52"/>' +
  '<path d="M16 21.5c3.4-2.6 6.4-2.2 8-.4-2.8 2.2-5.6 2.2-8 .4z" fill="#2c7a52"/>' +
  '<path d="M8.6 9.2C8.4 4.6 12.2 2 16 4c3.8-2 7.6.6 7.4 5.2C23.2 14 20.2 18 16 18S8.8 14 8.6 9.2z" fill="#b62835"/>' +
  '<path d="M11.6 8.4c1-3.2 7.4-3.4 8.6-.2.6 2.6-1.8 4-3.4 3-1.2-.8-.4-2.2.8-1.8" stroke="#6e1420" stroke-width="1.4" stroke-linecap="round" fill="none"/>' +
  '<path d="M9.8 11.4c1.6 2.6 3.6 3.6 6.2 3.6s4.6-1 6.2-3.6" stroke="#e8606d" stroke-width="1.2" stroke-linecap="round" fill="none"/>' +
  '</svg>';

/** A instrução padrão das configurações, longa para o celular: na tela vai a versão curta. */
const DICA_CURTA = 'Comente !presente ou mande 🌹 para entrar';

/** Avatar redondo: a inicial colorida por baixo e, se houver, a foto do perfil por cima (como no 2D). */
function criarAvatar(participante: Participant, vivo: () => boolean): HTMLSpanElement {
  const avatar = el('span', 'j3d-avatar');
  avatar.style.background = corDaInicial(participante.userId);
  avatar.append(el('span', 'j3d-inicial', inicial(participante.nickname)));
  if (participante.avatarUrl) {
    // fotos de outros sites passam pelo back-end, como no 2D (events/backend.ts); se falhar, fica a inicial
    const img = el('img', 'j3d-foto');
    img.alt = '';
    img.decoding = 'async';
    img.referrerPolicy = 'no-referrer';
    img.onload = () => {
      if (vivo()) avatar.classList.add('com-foto');
    };
    img.onerror = () => img.remove();
    img.src = avatarSrc(backendNow(), participante.avatarUrl);
    avatar.append(img);
  }
  return avatar;
}

/** Primeira letra (ou número) do apelido, como no 2D. */
export function inicial(nome: string): string {
  return Array.from(nome.replace(/[^\p{L}\p{N}]/gu, ''))[0]?.toUpperCase() ?? '★';
}

export function corDaInicial(userId: string): string {
  return AVATAR_BG[hashTexto(userId) % AVATAR_BG.length];
}

/** Etiqueta de nome de um visitante. */
export class Etiqueta {
  readonly el: HTMLDivElement;
  w = 0;
  h = 0;
  private atual = false;
  private mostrando = false;
  private x = 0;
  private y = 0;
  /** Última posição escrita no estilo (só reescreve quando anda mais de 0,1 px). */
  private xEscrito = NaN;
  private yEscrito = NaN;
  private posta = false;
  private destruida = false;

  constructor(
    pai: HTMLElement,
    readonly participante: Participant,
  ) {
    const node = el('div', 'j3d-etiqueta');
    node.append(criarAvatar(participante, () => !this.destruida), el('span', 'j3d-nome', participante.nickname));
    this.el = node;
    pai.append(node);
    this.medir();
  }

  private medir() {
    this.w = this.el.offsetWidth || 200;
    this.h = this.el.offsetHeight || 54;
  }

  /** Quem está sendo atendido tem a etiqueta maior. */
  setAtual(atual: boolean) {
    if (atual === this.atual) return;
    this.atual = atual;
    this.el.classList.toggle('atual', atual);
    this.medir();
  }

  /** Mostra com o canto de cima à esquerda em (l, t); desliza suave até lá. */
  mostrar(l: number, t: number, dt: number) {
    if (!this.posta || !this.mostrando) {
      this.x = l;
      this.y = t;
      this.posta = true;
    } else {
      const k = Math.min(1, dt * 14);
      this.x += (l - this.x) * k;
      this.y += (t - this.y) * k;
    }
    if (!(Math.abs(this.x - this.xEscrito) < 0.1 && Math.abs(this.y - this.yEscrito) < 0.1)) {
      this.xEscrito = this.x;
      this.yEscrito = this.y;
      this.el.style.transform = `translate3d(${this.x.toFixed(1)}px, ${this.y.toFixed(1)}px, 0)`;
    }
    if (!this.mostrando) {
      this.mostrando = true;
      this.el.classList.add('visivel');
    }
  }

  esconder() {
    if (!this.mostrando) return;
    this.mostrando = false;
    this.el.classList.remove('visivel');
  }

  destruir() {
    this.destruida = true;
    this.el.remove();
  }
}

export interface OpcoesHud {
  /** ?obs: só o que vai para a live (sem FPS, sem dicas de operação). */
  obs: boolean;
}

export class Hud3D {
  readonly raiz: HTMLDivElement;
  readonly camadaEtiquetas: HTMLDivElement;
  private readonly dica: HTMLDivElement;
  private readonly contador: HTMLDivElement;
  private readonly balao: HTMLDivElement;
  private readonly balaoTexto: HTMLSpanElement;
  private readonly faixa: HTMLDivElement;
  private readonly faixaQuem: HTMLDivElement;
  private readonly faixaOque: HTMLDivElement;
  private readonly aviso: HTMLDivElement;
  /** Pílula "Agora: [foto] Fulano" (quem está sendo atendido), ao lado do contador. */
  private readonly agora: HTMLDivElement;
  private agoraId: string | null = null;
  private readonly fps: HTMLDivElement;
  private readonly pausado: HTMLDivElement;
  private ultimoContador = -1;
  private ultimaDica = '';
  private balaoW = 0;
  private balaoH = 0;
  private balaoVisivel = false;
  private balaoMax = 0;
  private balaoL = NaN;
  private balaoT = NaN;
  private balaoCauda = NaN;
  private avisoAte = 0;
  private relogio = 0;
  private foraDaTela = 0;

  constructor(overlay: HTMLElement, opts: OpcoesHud) {
    const raiz = el('div', 'j3d-hud');
    if (opts.obs) raiz.classList.add('obs');
    raiz.append(el('div', 'j3d-titulo', 'Vila do Noel'));
    this.dica = el('div', 'j3d-dica');
    const linha = el('div', 'j3d-linha');
    this.contador = el('div', 'j3d-contador');
    this.agora = el('div', 'j3d-agora');
    linha.append(this.contador, this.agora);
    this.camadaEtiquetas = el('div', 'j3d-etiquetas');
    this.balao = el('div', 'j3d-balao');
    this.balaoTexto = el('span', 'j3d-balao-texto');
    this.balao.append(this.balaoTexto);
    this.faixa = el('div', 'j3d-faixa');
    this.faixaQuem = el('div', 'quem');
    this.faixaOque = el('div', 'oque');
    this.faixa.append(this.faixaQuem, this.faixaOque);
    this.aviso = el('div', 'j3d-aviso');
    this.fps = el('div', 'j3d-fps');
    this.pausado = el('div', 'j3d-pausado', 'PAUSADO');
    raiz.append(this.dica, linha, this.camadaEtiquetas, this.balao, this.faixa, this.aviso, this.fps, this.pausado);
    overlay.append(raiz);
    this.raiz = raiz;
  }

  /** Instrução do painel; a padrão vai na versão curta e o 🌹 vira o desenho da rosa (igual em todo sistema). */
  setDica(texto: string) {
    if (texto === this.ultimaDica) return;
    this.ultimaDica = texto;
    const mostrar = texto === DEFAULT_SETTINGS.hintText ? DICA_CURTA : texto;
    this.dica.replaceChildren();
    mostrar.split('🌹').forEach((parte, i) => {
      if (i > 0) {
        const rosa = el('span', 'j3d-rosa');
        rosa.innerHTML = ROSA_SVG; // desenho fixo deste arquivo (não vem de fora)
        this.dica.append(rosa);
      }
      if (parte) this.dica.append(document.createTextNode(parte));
    });
    this.dica.classList.toggle('longa', mostrar.length > 46);
  }

  /** Quantas pessoas esperam na fila (sem contar quem está sendo atendido). */
  setContador(n: number) {
    if (n === this.ultimoContador) return;
    this.ultimoContador = n;
    this.escreverContador();
  }

  /** Quantos esperam sem estar na tela (ainda a caminho): entra no próprio contador, sem um selo à parte. */
  setForaDaTela(n: number) {
    const v = Math.max(0, n);
    if (v === this.foraDaTela) return;
    this.foraDaTela = v;
    this.escreverContador();
  }

  private escreverContador() {
    const n = this.ultimoContador;
    const fora = this.foraDaTela > 0 && n > 0 ? ` · ${this.foraDaTela} a caminho` : '';
    this.contador.textContent = n <= 0 ? (this.agoraId ? 'Fila livre: entre já!' : 'Fila livre: seja o primeiro!') : `${n} na fila${fora}`;
  }

  /** Quem está sendo atendido (null = ninguém): avatar e apelido fixos no alto, ao lado do contador. */
  setAtendido(p: Participant | null) {
    const id = p ? p.userId : null;
    if (id === this.agoraId) return;
    this.agoraId = id;
    this.agora.replaceChildren();
    this.agora.classList.toggle('visivel', !!p);
    if (p) {
      const nome = el('span', 'j3d-nome', p.nickname);
      this.agora.append(el('span', 'rotulo', 'Agora'), criarAvatar(p, () => this.agoraId === id), nome);
    }
    this.escreverContador();
  }

  /** A faixa da revelação ocupa o lugar da instrução e do contador. */
  mostrarFaixa(nome: string, presente: string) {
    this.faixaQuem.textContent = `${nome} ganhou`;
    this.faixaOque.textContent = presente;
    this.faixa.classList.add('visivel');
    this.raiz.classList.add('com-faixa');
  }

  esconderFaixa() {
    this.faixa.classList.remove('visivel');
    this.raiz.classList.remove('com-faixa');
  }

  /** Balão de fala do Noel. */
  mostrarBalao(texto: string) {
    if (this.balaoTexto.textContent !== texto) {
      this.balaoTexto.textContent = texto;
      this.balao.classList.toggle('curto', texto.length <= 18);
      this.balaoW = this.balao.offsetWidth;
      this.balaoH = this.balao.offsetHeight;
    }
    if (!this.balaoVisivel) {
      this.balaoVisivel = true;
      this.balao.classList.add('visivel');
    }
  }

  esconderBalao() {
    if (!this.balaoVisivel) return;
    this.balaoVisivel = false;
    this.balao.classList.remove('visivel');
  }

  get balaoAberto() {
    return this.balaoVisivel;
  }

  /**
   * Põe o balão À ESQUERDA da cabeça do Noel, sobre a pedra da chaminé, com a cauda apontando para a boca (xb, yb,
   * pixels de projeto); `yTopo` = topo do gorro. A janela fica livre (a lua, a aurora e o trenó passam ali).
   * Devolve o retângulo ocupado (para as etiquetas não cobrirem o balão).
   */
  posicionarBalao(xb: number, yb: number, yTopo: number, out: { l: number; t: number; r: number; b: number }) {
    // largura máxima: do canto esquerdo até um pouco antes do rosto (a barba ocupa uns 80 px para cada lado)
    const max = Math.round(Math.min(470, Math.max(300, xb - 96 - 28)));
    if (Math.abs(max - this.balaoMax) > 3) {
      this.balaoMax = max;
      this.balao.style.maxWidth = `${max}px`;
      this.balaoW = this.balao.offsetWidth;
      this.balaoH = this.balao.offsetHeight;
    }
    const w = this.balaoW || 420;
    const h = this.balaoH || 160;
    const l = Math.min(1080 - 28 - w, Math.max(28, xb - 96 - w));
    // o meio do balão um pouco acima da boca (na altura dos olhos), sem subir para a área do título
    const t = Math.min(1476 - h, Math.max(440, Math.min(yb - h * 0.62, yTopo + 40)));
    const cauda = Math.min(h - 28, Math.max(28, yb - 18 - t));
    if (!(Math.abs(l - this.balaoL) < 0.1 && Math.abs(t - this.balaoT) < 0.1)) {
      this.balaoL = l;
      this.balaoT = t;
      this.balao.style.transform = `translate3d(${l.toFixed(1)}px, ${t.toFixed(1)}px, 0)`;
    }
    if (Math.abs(cauda - this.balaoCauda) >= 1) {
      this.balaoCauda = cauda;
      this.balao.style.setProperty('--cauda', `${cauda.toFixed(0)}px`);
    }
    out.l = l;
    out.t = t;
    out.r = l + w + 26;
    out.b = t + h;
    return out;
  }

  avisar(texto: string, segundos = 2.6) {
    this.aviso.textContent = texto;
    this.aviso.classList.add('visivel');
    this.avisoAte = this.relogio + segundos;
  }

  setStatus(mostrar: boolean, texto: string, pausado: boolean) {
    this.fps.classList.toggle('visivel', mostrar);
    if (mostrar) this.fps.textContent = texto;
    this.pausado.classList.toggle('visivel', pausado);
  }

  update(dt: number) {
    this.relogio += dt;
    if (this.avisoAte > 0 && this.relogio > this.avisoAte) {
      this.avisoAte = 0;
      this.aviso.classList.remove('visivel');
    }
  }

  novaEtiqueta(p: Participant): Etiqueta {
    return new Etiqueta(this.camadaEtiquetas, p);
  }
}
