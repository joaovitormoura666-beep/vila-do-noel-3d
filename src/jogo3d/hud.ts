/**
 * Interface da live em HTML por cima do canvas (não em WebGL): título, instrução, contador da fila, balão de fala
 * do Noel, faixa da revelação, aviso, selo "+N" e as etiquetas de nome (avatar redondo + apelido).
 *
 * Tudo vive na camada do palco (Stage.overlay), em pixels de projeto 1080x1920 (o palco escala junto com o
 * canvas). Os textos e tamanhos foram escolhidos para ler em 1080x1920 e no celular. As zonas da live: 0 a 190
 * barra do TikTok (vazia), 190 a 420 título, 430 a 1480 área de jogo, abaixo de 1480 o chat cobre.
 *
 * Cada elemento só mexe em `transform` e `opacity` por quadro (nada de layout no caminho quente); os tamanhos
 * são medidos uma vez, quando o texto muda.
 */
import type { Participant } from '../../shared/types';
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
  private posta = false;
  private destruida = false;

  constructor(
    pai: HTMLElement,
    readonly participante: Participant,
  ) {
    const node = el('div', 'j3d-etiqueta');
    const avatar = el('span', 'j3d-avatar');
    const letra = el('span', 'j3d-inicial', inicial(participante.nickname));
    avatar.style.background = corDaInicial(participante.userId);
    avatar.append(letra);
    if (participante.avatarUrl) {
      // fotos de outros sites passam pelo back-end, como no 2D (events/backend.ts); se falhar, fica a inicial
      const img = el('img', 'j3d-foto');
      img.alt = '';
      img.decoding = 'async';
      img.referrerPolicy = 'no-referrer';
      img.onload = () => {
        if (!this.destruida) avatar.classList.add('com-foto');
      };
      img.onerror = () => img.remove();
      img.src = avatarSrc(backendNow(), participante.avatarUrl);
      avatar.append(img);
    }
    node.append(avatar, el('span', 'j3d-nome', participante.nickname));
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
    this.el.style.transform = `translate3d(${this.x.toFixed(1)}px, ${this.y.toFixed(1)}px, 0)`;
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
  private readonly mais: HTMLDivElement;
  private readonly fps: HTMLDivElement;
  private readonly pausado: HTMLDivElement;
  private ultimoContador = -1;
  private ultimaDica = '';
  private balaoW = 0;
  private balaoH = 0;
  private balaoVisivel = false;
  private avisoAte = 0;
  private relogio = 0;
  maisW = 0;
  maisH = 0;
  private maisN = -1;

  constructor(overlay: HTMLElement, opts: OpcoesHud) {
    const raiz = el('div', 'j3d-hud');
    if (opts.obs) raiz.classList.add('obs');
    raiz.append(el('div', 'j3d-titulo', 'Vila do Noel'));
    this.dica = el('div', 'j3d-dica');
    this.contador = el('div', 'j3d-contador');
    this.camadaEtiquetas = el('div', 'j3d-etiquetas');
    this.mais = el('div', 'j3d-mais');
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
    raiz.append(this.dica, this.contador, this.camadaEtiquetas, this.mais, this.balao, this.faixa, this.aviso, this.fps, this.pausado);
    overlay.append(raiz);
    this.raiz = raiz;
    this.mais.textContent = '+0';
  }

  setDica(texto: string) {
    if (texto === this.ultimaDica) return;
    this.ultimaDica = texto;
    this.dica.textContent = texto;
    this.dica.classList.toggle('longa', texto.length > 46);
  }

  /** Quantas pessoas esperam na fila (sem contar quem está sendo atendido). */
  setContador(n: number) {
    if (n === this.ultimoContador) return;
    this.ultimoContador = n;
    this.contador.textContent = n === 0 ? 'Fila livre: seja o primeiro!' : n === 1 ? '1 pessoa na fila' : `${n} pessoas na fila`;
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
   * Prende a ponta do balão em (x, y) (topo da cabeça do Noel, em pixels de projeto). Devolve o retângulo
   * ocupado (para as etiquetas não cobrirem o balão).
   */
  posicionarBalao(x: number, y: number, out: { l: number; t: number; r: number; b: number }) {
    const w = this.balaoW || 520;
    const h = this.balaoH || 140;
    const l = Math.min(1080 - 28 - w, Math.max(28, x - w / 2));
    const t = Math.max(436, y - h - 30);
    this.balao.style.transform = `translate3d(${l.toFixed(1)}px, ${t.toFixed(1)}px, 0)`;
    this.balao.style.setProperty('--cauda', `${Math.min(w - 40, Math.max(40, x - l)).toFixed(0)}px`);
    out.l = l;
    out.t = t;
    out.r = l + w;
    out.b = t + h + 26;
    return out;
  }

  /** Selo "+N na fila" (N = quem espera sem etiqueta). */
  setMais(n: number) {
    if (n === this.maisN) return;
    this.maisN = n;
    this.mais.textContent = `+${n} na fila`;
    this.maisW = this.mais.offsetWidth || 150;
    this.maisH = this.mais.offsetHeight || 46;
  }

  mostrarMais(l: number, t: number) {
    this.mais.style.transform = `translate3d(${l.toFixed(1)}px, ${t.toFixed(1)}px, 0)`;
    this.mais.classList.add('visivel');
  }

  esconderMais() {
    this.mais.classList.remove('visivel');
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
