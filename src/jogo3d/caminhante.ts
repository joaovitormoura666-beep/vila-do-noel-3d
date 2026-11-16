/**
 * Um visitante em cena: o gnomo (VisitorRig) andando por um caminho (Path3) sem patinar.
 *
 * - Anda por distância: `s` metros ao longo do caminho, com aceleração e frenagem suaves até o alvo, sem passar
 *   do limite de quem está à frente.
 * - O passo acompanha a distância de verdade: a fase do passo avança `ds / (passo x peso)`, porque a amplitude
 *   da passada do gnomo cresce com o peso `walk` (o pé no chão anda junto com o piso, sem deslizar).
 * - Gira o corpo para a direção do caminho com velocidade limitada; parado, gira para `yawParado`.
 * - As poses de expressão (lookUp, hold, joy, jump) recebem alvos e seguem suavizadas, para que cancelar uma
 *   entrega no meio não dê tranco.
 */
import * as THREE from 'three';
import type { Path3 } from '../engine/Path3';
import type { VisitorRig } from '../world/contracts';
import type { Participant } from '../../shared/types';
import { ANDAR } from './config';

export type EstadoCaminhante = 'pronto' | 'fila' | 'indo' | 'entrega' | 'saindo' | 'sumindo';

const DOIS_PI = Math.PI * 2;

/** Diferença de ângulo no caminho mais curto (-π..π). */
export function difAngulo(a: number, b: number): number {
  let d = (b - a) % DOIS_PI;
  if (d > Math.PI) d -= DOIS_PI;
  if (d < -Math.PI) d += DOIS_PI;
  return d;
}

export class Caminhante {
  estado: EstadoCaminhante = 'pronto';
  trilho: Path3 | null = null;
  /** Metros andados no trilho. */
  s = 0;
  /** Até onde quer ir (metros no trilho). */
  alvo = 0;
  /** Velocidade atual (m/s). */
  v = 0;
  yaw = 0;
  /** Para onde olhar quando parado (null = direção do caminho). */
  yawParado: number | null = null;
  /** Força o giro para este ângulo mesmo andando (null = livre). */
  yawFixo: number | null = null;
  emCena = false;
  /** Tempo parado (s), para decidir quando virar para o lado. */
  parado = 0;
  /** Alvos das poses de expressão (o jogo escreve; o caminhante suaviza). */
  readonly alvoPose = { lookUp: 0, hold: 0, joy: 0, jump: 0 };
  /** Quando true, as poses de expressão são escritas direto por quem controla (a entrega), sem suavizar. */
  poseDireta = false;
  /** Presente nas mãos (vai junto na saída e é descartado com o visitante). */
  presente: THREE.Object3D | null = null;
  presenteDescartar: (() => void) | null = null;
  /** Encolhendo para sumir (limpar fila): 1 = inteiro, 0 = sumiu. */
  escala = 1;
  descartado = false;

  constructor(
    readonly rig: VisitorRig,
    readonly participante: Participant,
  ) {}

  get id() {
    return this.participante.userId;
  }

  /** Põe no começo de um trilho (ou em `s`), virado para a frente. */
  colocar(trilho: Path3, s = 0) {
    this.trilho = trilho;
    this.s = s;
    this.alvo = s;
    this.v = 0;
    trilho.at(s, this.rig.root.position);
    this.yaw = trilho.yawAt(s);
    this.rig.root.rotation.y = this.yaw;
  }

  /** Chegou ao alvo e parou. */
  get chegou() {
    return this.alvo - this.s < 0.01 && this.v < 0.05;
  }

  /**
   * Avança um quadro. `vMax` em m/s; `limite` = até onde pode ir no trilho (quem está à frente).
   */
  update(dt: number, t: number, vMax: number, limite = Infinity) {
    const rig = this.rig;
    const pose = rig.pose;
    const trilho = this.trilho;
    let ds = 0;
    if (trilho && dt > 0) {
      const fim = Math.min(this.alvo, limite, trilho.length);
      const falta = fim - this.s;
      // velocidade desejada: freia a tempo de parar no alvo (v² = 2·a·d)
      const vDesejada = falta > 0.002 ? Math.min(vMax, Math.sqrt(2 * ANDAR.frenagem * falta)) : 0;
      const a = vDesejada > this.v ? ANDAR.aceleracao : ANDAR.frenagem * 1.6;
      this.v += Math.max(-a * dt, Math.min(a * dt, vDesejada - this.v));
      if (this.v < 0) this.v = 0;
      ds = Math.min(this.v * dt, Math.max(0, falta));
      this.s += ds;
      trilho.at(this.s, rig.root.position);
    }

    // peso do andar: acompanha a velocidade (amplitude da passada) e a fase acompanha a distância
    const wAlvo = Math.min(1, this.v / ANDAR.velocidadeNominal);
    pose.walk += (wAlvo - pose.walk) * Math.min(1, dt * 8);
    if (pose.walk < 0.002) pose.walk = 0;
    if (ds > 0) pose.phase += ds / (ANDAR.passoPorRadiano * Math.max(0.3, pose.walk));

    // giro: na direção do caminho andando; parado, para o lado escolhido
    this.parado = ds > 0.0005 ? 0 : this.parado + dt;
    let yawAlvo = this.yaw;
    if (this.yawFixo !== null) yawAlvo = this.yawFixo;
    else if (trilho && (this.v > 0.04 || this.parado < ANDAR.esperaParaVirar)) yawAlvo = trilho.yawAt(Math.min(trilho.length - 0.01, this.s + 0.05));
    else if (this.yawParado !== null) yawAlvo = this.yawParado;
    const d = difAngulo(this.yaw, yawAlvo);
    const passo = Math.min(Math.abs(d) * (1 - Math.exp(-dt * 7)), ANDAR.giroMax * dt);
    this.yaw += Math.sign(d) * passo;
    rig.root.rotation.y = this.yaw;

    // poses de expressão
    if (!this.poseDireta) {
      const k = Math.min(1, dt * 6);
      const ap = this.alvoPose;
      pose.lookUp += (ap.lookUp - pose.lookUp) * k;
      pose.hold += (ap.hold - pose.hold) * k;
      pose.joy += (ap.joy - pose.joy) * k;
      pose.jump += (ap.jump - pose.jump) * Math.min(1, dt * 10);
    }

    // sumindo (limpar fila): encolhe e afunda um pouco
    if (this.estado === 'sumindo') {
      this.escala = Math.max(0, this.escala - dt / 0.35);
      const e = 0.05 + 0.95 * this.escala * this.escala * (3 - 2 * this.escala);
      rig.root.scale.setScalar(e);
    }
    rig.update(dt, t);
  }

  descartar() {
    if (this.descartado) return;
    this.descartado = true;
    this.presenteDescartar?.();
    this.presente = null;
    this.presenteDescartar = null;
    this.rig.root.removeFromParent();
    this.rig.dispose();
  }
}
