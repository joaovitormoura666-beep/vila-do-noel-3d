/**
 * ANIMAÇÃO do Noel sentado: mistura por peso das poses do contrato (wave, talk, rummage, present, give,
 * cheer) sobre o repouso (respiração, piscadas, cabeça viva). Os braços são resolvidos por IK de dois
 * ossos: cada pose diz onde fica o pulso, para onde aponta o cotovelo e como a mão se vira; a mistura é
 * feita nesses alvos (não nos ângulos), então as poses combinam sem atravessar o corpo. O pompom do gorro
 * segue com atraso por uma mola. Tudo em função de dt e t, sem relógio próprio.
 */
import * as THREE from 'three';
import type { SantaPose } from '../../contracts';
import type { Esqueleto } from './esqueleto';
import { ANIMA, CORPO, DY, VISITANTE } from './medidas';
import { limitar } from './util';

type Lado = 'E' | 'D';
type NomePose = keyof SantaPose;

interface AlvoBraco {
  pulso: THREE.Vector3;
  /** Para onde o cotovelo aponta. */
  cotovelo: THREE.Vector3;
  /** Direção dos dedos e normal da palma. */
  mao: THREE.Vector3;
  palma: THREE.Vector3;
  /** Dobra dos dedos (0 aberta, 1 fechada). */
  dedos: number;
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

// temporários de módulo: nada de alocação por quadro (numa live longa isso vira engasgo de coleta de lixo)
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _qp = new THREE.Quaternion();
const _qa = new THREE.Quaternion();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _d = new THREE.Vector3();
const _pulso = new THREE.Vector3();
const _cot = new THREE.Vector3();
const _mao = new THREE.Vector3();
const _palma = new THREE.Vector3();
const _ap = new THREE.Vector3();
const _am = new THREE.Vector3();
const _apa = new THREE.Vector3();
const _S = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _perp = new THREE.Vector3();
const _E = new THREE.Vector3();
const _W = new THREE.Vector3();
const _dirU = new THREE.Vector3();
const _dirF = new THREE.Vector3();
const _dobra = new THREE.Vector3();
const _ladoF = new THREE.Vector3();
const _alvoOlhar = new THREE.Vector3();
const _olho = new THREE.Vector3();
const _ponta = new THREE.Vector3();
const _vel = new THREE.Vector3();
const _acel = new THREE.Vector3();
const _euler = new THREE.Euler(0, 0, 0, 'YXZ');
const POSES = ['wave', 'talk', 'rummage', 'present', 'give', 'cheer'] as const;
const _pw: Record<NomePose, number> = { wave: 0, talk: 0, rummage: 0, present: 0, give: 0, cheer: 0 };

/** Número pseudoaleatório fixo por inteiro (micro-sacadas determinísticas). */
function hash1(n: number) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Base ortonormal (eixo, lado ortogonalizado, terceiro) em uma matriz de rotação. */
function base(eixo: THREE.Vector3, lado: THREE.Vector3, out: THREE.Matrix4) {
  _a.copy(eixo).normalize();
  _b.copy(lado).addScaledVector(_a, -lado.dot(_a));
  if (_b.lengthSq() < 1e-8) _b.set(_a.y, -_a.x, 0.3);
  _b.normalize();
  _c.crossVectors(_a, _b);
  return out.makeBasis(_a, _b, _c);
}

export class AnimadorNoel {
  private readonly bind = new Map<THREE.Bone, THREE.Vector3>();
  /** Rotação de ligação (eixo, lado) de cada osso do IK, constante: calculada uma vez. */
  private readonly bindQ = new Map<string, THREE.Quaternion>();
  private readonly eixoDedo: Record<Lado, THREE.Vector3>;
  private readonly bocaDoSaco: THREE.Vector3;
  private readonly visitante: THREE.Vector3;
  private readonly raizInv = new THREE.Matrix4();
  private readonly raizQInv = new THREE.Quaternion();
  /** Mola do gorro: ângulo e velocidade (x = para a frente/trás, z = de lado). */
  private mola = { ax: 0, az: 0, vx: 0, vz: 0 };
  private pontaAntes: THREE.Vector3 | null = null;
  private velAntes = new THREE.Vector3();
  private readonly alvos: Record<Lado, Partial<Record<NomePose | 'repouso', AlvoBraco>>>;

  constructor(
    private readonly esq: Esqueleto,
    private readonly corpo: THREE.Object3D,
    bocaDoSaco: THREE.Vector3,
  ) {
    for (const b of esq.ossos) this.bind.set(b, b.position.clone());
    const y = (n: number) => n + DY;
    const boca = bocaDoSaco.clone();
    this.bocaDoSaco = boca.clone();
    this.visitante = V(Math.sin(VISITANTE.direcao) * VISITANTE.distancia, VISITANTE.alturaRosto, Math.cos(VISITANTE.direcao) * VISITANTE.distancia);
    for (const L of ['E', 'D'] as const) {
      const br = esq.braco[L];
      this.bindQ.set(`braco${L}`, new THREE.Quaternion().setFromRotationMatrix(base(br.eixo, br.polegar, new THREE.Matrix4())));
      this.bindQ.set(`antebraco${L}`, new THREE.Quaternion().setFromRotationMatrix(base(br.eixo, br.polegar, new THREE.Matrix4())));
      this.bindQ.set(`mao${L}`, new THREE.Quaternion().setFromRotationMatrix(base(br.eixo, br.palma, new THREE.Matrix4())));
    }
    this.eixoDedo = {
      E: new THREE.Vector3().crossVectors(esq.braco.E.eixo, esq.braco.E.palma).normalize(),
      D: new THREE.Vector3().crossVectors(esq.braco.D.eixo, esq.braco.D.palma).normalize(),
    };
    // o give estende os braços na direção do visitante (girada para a esquerda dele, +X)
    const paraVisitante = (x: number, yy: number, z: number) => V(x, yy, z).applyAxisAngle(V(0, 1, 0), VISITANTE.direcao);
    const alvo = (pulso: THREE.Vector3, cotovelo: THREE.Vector3, mao: THREE.Vector3, palma: THREE.Vector3, dedos: number): AlvoBraco => ({ pulso, cotovelo: cotovelo.normalize(), mao: mao.normalize(), palma: palma.normalize(), dedos });
    const lado = (s: 1 | -1) => ({
      repouso: alvo(V(s * 0.56, y(1.07), 0.21), V(s * 1, -0.35, -0.55), V(s * 0.12, -0.28, 1), V(0, -1, 0.1), 0.35),
      // falar: mãos de perfil para a câmera, palmas para cima, dedos para fora (nada de punho de frente)
      talk: alvo(V(s * 0.66, y(1.22), 0.2), V(s * 0.6, -1, -0.5), V(s * 1, 0.35, 0.25), V(-s * 0.25, 1, 0.3), 0.25),
      // apresentar: braços abertos para os lados, palmas para cima ("olhem só!"), sem cobrir o rosto
      present: alvo(V(s * 0.74, y(1.58), 0.42), V(s * 1, -0.7, -0.35), V(s * 0.7, 0.2, 1), V(s * 0.15, 1, 0.25), 0.1),
      // entregar: braços quase retos estendidos para o visitante, palmas para cima oferecendo
      give: alvo(paraVisitante(s * 0.21, y(1.33), 0.78), paraVisitante(s * 0.8, -1, -0.3), paraVisitante(s * 0.08, 0.05, 1), V(-s * 0.15, 1, 0.05), 0.12),
      cheer: alvo(V(s * 0.74, y(2.08), 0.08), V(s * 1, -0.35, -0.3), V(s * 0.35, 1, 0.05), V(0, -0.1, 1), 0.05),
    });
    const E = lado(1);
    const D = lado(-1);
    this.alvos = {
      E: { ...E, rummage: alvo(boca.clone().add(V(-0.07, 0.07, 0)), V(0.5, 1, -0.7), V(0.3, -1, 0.05), V(-1, -0.15, 0.1), 0.55) },
      D: { ...D, wave: alvo(V(-0.56, y(1.97), 0.2), V(-1, -0.9, -0.25), V(-0.12, 1, 0.12), V(0, 0, 1), 0.0) },
    };
    // a mão direita não entra no saco e a esquerda não acena (ficam no repouso nessas poses)
  }

  private o(n: string) {
    return this.esq.o[n];
  }

  /** Posição de um osso no espaço do corpo. */
  private pos(n: string, out: THREE.Vector3) {
    return this.o(n).getWorldPosition(out).applyMatrix4(this.raizInv);
  }
  /** Rotação de um osso no espaço do corpo. */
  private rot(b: THREE.Object3D, out: THREE.Quaternion) {
    return b.getWorldQuaternion(out).premultiply(this.raizQInv);
  }

  /** Gira o osso para que o eixo e o lado da ligação apontem para os desejados (espaço do corpo). */
  private alinhar(n: string, eixo: THREE.Vector3, lado: THREE.Vector3) {
    const b = this.o(n);
    base(eixo, lado, _m);
    // mundo = alvo * ligação⁻¹; local = pai⁻¹ * mundo
    _q.setFromRotationMatrix(_m).multiply(_qa.copy(this.bindQ.get(n)!).invert());
    this.rot(b.parent!, _qp);
    b.quaternion.copy(_qp.invert().multiply(_q));
    b.updateMatrixWorld(true);
  }

  private atualizarRaiz() {
    this.corpo.updateMatrixWorld(true);
    this.raizInv.copy(this.corpo.matrixWorld).invert();
    this.corpo.getWorldQuaternion(this.raizQInv).invert();
  }

  update(pose: SantaPose, dt: number, t: number) {
    const w = {
      wave: limitar(pose.wave, 0, 1),
      talk: limitar(pose.talk, 0, 1),
      rummage: limitar(pose.rummage, 0, 1),
      present: limitar(pose.present, 0, 1),
      give: limitar(pose.give, 0, 1),
      cheer: limitar(pose.cheer, 0, 1),
    };
    // volta tudo à ligação
    for (const [b, p] of this.bind) {
      b.position.copy(p);
      b.quaternion.identity();
      b.scale.set(1, 1, 1);
    }
    const o = (n: string) => this.o(n);
    const TAU = Math.PI * 2;

    /* --------------------------------------------------------------- tronco */
    const resp = Math.sin(t * TAU * ANIMA.respiracao.freq);
    const riso = w.cheer * Math.abs(Math.sin(t * TAU * ANIMA.riso.freq));
    const falaS = Math.sin(t * TAU * ANIMA.fala.freq);
    // inclinações do tronco (x = para a frente; z = de lado, negativo puxa para a esquerda dele, +X)
    let colX = -0.015 * resp + 0.1 * w.rummage + 0.1 * w.give - 0.05 * w.present - 0.06 * w.cheer + 0.02 * w.talk * falaS;
    let colZ = -0.27 * w.rummage + 0.03 * w.wave;
    // no give o tronco gira para o visitante
    const colY = 0.04 * w.rummage + 0.13 * w.give + 0.05 * w.talk;
    const peitoY = 0.12 * w.give + 0.04 * w.talk;
    const peitoX = 0.07 * w.rummage + 0.1 * w.give - 0.04 * w.present - 0.04 * w.cheer;
    const peitoZ = -0.16 * w.rummage + 0.04 * w.wave + 0.025 * Math.sin(t * TAU * ANIMA.riso.freq * 0.5) * w.cheer;
    colX += 0.012 * Math.sin(t * 0.37 + 0.5);
    colZ += 0.01 * Math.sin(t * 0.29);
    o('coluna').rotation.set(colX, colY, colZ);
    o('peito').rotation.set(peitoX, peitoY, peitoZ);
    // pula de rir
    o('quadril').position.y += ANIMA.riso.amp * riso;
    // barriga: respira e sacode
    const sacode = 0.005 * w.talk * Math.sin(t * 13.1) + 0.012 * w.cheer * Math.sin(t * 15.7 + 0.4);
    const barriga = o('barriga');
    barriga.scale.setScalar(1 + 0.018 * resp + Math.abs(sacode) * 0.6);
    barriga.position.y += sacode;
    barriga.position.z += 0.006 * resp;
    // ombros sobem nos braços para cima
    const alto = Math.max(w.present, w.cheer);
    o('claviculaE').rotation.z = 0.2 * alto + 0.02 * resp;
    o('claviculaD').rotation.z = -0.2 * Math.max(alto, w.wave * 0.9) - 0.02 * resp;

    /* ----------------------------------------------------------------- cabeça */
    const vivo = (1 - Math.min(1, w.rummage + w.present)) * 1;
    let cabX = 0.05 * Math.sin(t * 0.53 + 1.1) * vivo + 0.02 * resp;
    let cabY = (0.09 * Math.sin(t * 0.31) + 0.04 * Math.sin(t * 0.83 + 2)) * vivo;
    let cabZ = 0.03 * Math.sin(t * 0.41 + 0.3) * vivo;
    // falar: acena de leve com a cabeça no ritmo das sílabas
    cabX += w.talk * (0.045 * Math.sin(t * TAU * ANIMA.fala.freq * 0.5) + 0.02 * falaS);
    cabZ += w.talk * 0.04 * Math.sin(t * 1.3);
    cabX += 0.22 * w.rummage - 0.22 * w.present + 0.14 * w.give - 0.2 * w.cheer + 0.05 * w.talk;
    cabY += 0.45 * w.rummage - 0.15 * w.wave * 0.5 + 0.18 * w.give + 0.12 * w.talk;
    cabZ += -0.09 * w.wave + 0.06 * w.cheer * Math.sin(t * TAU * ANIMA.riso.freq * 0.5);
    o('pescoco').rotation.set(cabX * 0.35, cabY * 0.4, cabZ * 0.4);
    o('cabeca').rotation.set(cabX * 0.65, cabY * 0.6, cabZ * 0.6);
    // boca: sorriso entreaberto; abre com as sílabas ao falar; gargalha ao comemorar
    const silaba = Math.max(0, Math.sin(t * TAU * ANIMA.fala.freq)) * (0.6 + 0.4 * Math.sin(t * 5.3 + 1));
    const queixo = 0.05 + w.talk * 0.2 * silaba + w.cheer * (0.16 + 0.12 * riso) + 0.06 * w.present;
    o('queixo').rotation.x = queixo;
    // a barba pousa no peito: desce um pouco quando a boca abre e sacode com a barriga
    o('barba').position.y += -0.035 * queixo + 0.6 * sacode;
    o('barba').position.z += 0.02 * queixo;
    // sobrancelhas sobem ao falar e comemorar
    const sobe = 0.012 * w.talk * (0.5 + 0.5 * Math.sin(t * 2.1)) + 0.018 * w.cheer + 0.016 * w.present + 0.008 * w.wave + 0.008 * w.give;
    o('sobrancelhaE').position.y += sobe;
    o('sobrancelhaD').position.y += sobe;
    // piscadas: uma a cada ANIMA.piscadaACada segundos, com um pequeno desvio fixo; olhos apertados de rir
    const ciclo = t / ANIMA.piscadaACada + 0.13 * Math.sin(t * 0.7);
    const fase = ciclo - Math.floor(ciclo);
    const pisca = fase < 0.045 ? Math.sin((fase / 0.045) * Math.PI) : 0;
    const aperta = 0.4 * w.cheer;
    // olhar acompanhando: a pálpebra desce um pouco quando ele olha para baixo
    const palp = ANIMA.palpebraRepouso + Math.max(pisca * 1.05, aperta) + 0.12 * Math.max(w.rummage, w.give);
    o('palpebraE').rotation.x = palp;
    o('palpebraD').rotation.x = palp;

    /* ------------------------------------------------------------------ braços */
    this.atualizarRaiz();
    for (const L of ['E', 'D'] as const) this.braco(L, w, t);

    /* ------------------------------------------------------------------- olhar */
    this.olhar(w, t);

    /* ------------------------------------------------------------------- pernas */
    const bate = w.cheer * Math.max(0, Math.sin(t * TAU * ANIMA.riso.freq + 1.2));
    o('peE').rotation.x = -0.15 * bate;
    o('peD').rotation.x = -0.15 * w.cheer * Math.max(0, Math.sin(t * TAU * ANIMA.riso.freq + 2.6));

    /* --------------------------------------------------------- mola do pompom */
    this.atualizarRaiz();
    this.molaGorro(dt);
  }

  /** Os olhos procuram o alvo: o visitante (falar, entregar, apresentar), a boca do saco (remexer) ou a
   * câmera à frente, com micro-sacadas. Limitados a um cone pequeno: o resto quem faz é a cabeça. */
  private olhar(w: Record<NomePose, number>, t: number) {
    const lim = ANIMA.olhar;
    // micro-sacadas: um pequeno salto do olhar a cada ~1 s (sorteio fixo por intervalo)
    const passo = Math.floor(t / lim.sacada + 0.3 * Math.sin(t * 0.37));
    const sx = (hash1(passo) - 0.5) * 0.12;
    const sy = (hash1(passo + 91) - 0.5) * 0.07;
    // em repouso ele olha para a câmera da sala A (alta, à frente e um pouco à direita dele)
    _alvoOlhar.set(-0.55 + sx * 3, 2.15 + sy * 3, 3.2);
    const vis = Math.min(1, Math.max(w.give, w.talk * 0.9, w.present * 0.7));
    _alvoOlhar.lerp(this.visitante, vis);
    _alvoOlhar.lerp(this.bocaDoSaco, Math.min(1, w.rummage));
    _alvoOlhar.y += 1.2 * w.cheer;
    this.rot(this.o('cabeca'), _qa).invert();
    for (const L of ['E', 'D'] as const) {
      const n = `olho${L}`;
      this.pos(n, _olho);
      _d.subVectors(_alvoOlhar, _olho).applyQuaternion(_qa);
      const yaw = limitar(Math.atan2(_d.x, _d.z) + sx * 0.4, -lim.yaw, lim.yaw);
      const pitch = limitar(Math.atan2(-_d.y, Math.hypot(_d.x, _d.z)) + sy * 0.4, -lim.pitch, lim.pitch);
      _euler.set(pitch, yaw, 0, 'YXZ');
      this.o(n).quaternion.setFromEuler(_euler);
    }
  }

  private braco(L: Lado, w: Record<NomePose, number>, t: number) {
    const alvos = this.alvos[L];
    const rep = alvos.repouso!;
    const sinal = L === 'E' ? 1 : -1;
    const pulso = _pulso.copy(rep.pulso);
    const cot = _cot.copy(rep.cotovelo);
    const mao = _mao.copy(rep.mao);
    const palma = _palma.copy(rep.palma);
    let dedos = rep.dedos;
    // pesos das poses que mexem neste braço. O gesto próprio do braço manda: a mão que acena (D) e a
    // que remexe o saco (E) deixam de gesticular a fala, senão a mistura para no meio do caminho (punho
    // virado para a câmera). Normalizados se somarem mais de 1.
    const pw = _pw;
    for (const n of POSES) pw[n] = w[n];
    if (L === 'D') pw.talk *= 1 - w.wave;
    else pw.talk *= 1 - w.rummage;
    let soma = 0;
    for (const n of POSES) if (alvos[n] && pw[n] > 0) soma += pw[n];
    const k = soma > 1 ? 1 / soma : 1;
    const TAU = Math.PI * 2;
    for (const n of POSES) {
      const a = alvos[n];
      if (!a || pw[n] <= 0) continue;
      const p = pw[n] * k;
      const alvoPulso = _ap.copy(a.pulso);
      const alvoMao = _am.copy(a.mao);
      const alvoPalma = _apa.copy(a.palma);
      // movimento próprio de cada pose
      if (n === 'wave') {
        const s = Math.sin(t * TAU * ANIMA.aceno.freq);
        alvoPulso.x += 0.07 * s;
        alvoMao.x += ANIMA.aceno.amp * s * 1.6;
        alvoMao.normalize();
      } else if (n === 'talk') {
        // uma mão de cada vez gesticula (fases opostas): sobe, abre para fora e volta
        const g = Math.max(0, Math.sin(t * 1.7 + (L === 'E' ? 0 : Math.PI)));
        const h = Math.sin(t * 3.1 + (L === 'E' ? 1 : 0));
        alvoPulso.x += 0.06 * g * sinal;
        alvoPulso.y += 0.13 * g + 0.015 * h;
        alvoPulso.z += 0.05 * g;
        alvoMao.y += 0.35 * g;
        alvoMao.normalize();
        alvoPalma.x += 0.2 * h * sinal;
      } else if (n === 'rummage') {
        const g = Math.sin(t * 7.3);
        const h = Math.sin(t * 4.1 + 1);
        alvoPulso.x += 0.04 * h;
        alvoPulso.y += -0.05 + 0.05 * g;
        alvoPulso.z += 0.04 * g;
      } else if (n === 'cheer') {
        const g = Math.sin(t * TAU * ANIMA.riso.freq + (L === 'E' ? 0 : 1.6));
        alvoPulso.x += 0.03 * g * sinal;
        alvoPulso.y += 0.04 * g;
      } else if (n === 'present') {
        alvoPulso.y += 0.015 * Math.sin(t * 2.2);
      } else if (n === 'give') {
        // oferece: um pequeno avanço e volta das mãos
        alvoPulso.addScaledVector(alvoMao, 0.02 * Math.sin(t * 1.6));
      }
      pulso.lerp(alvoPulso, p);
      cot.lerp(a.cotovelo, p);
      mao.lerp(alvoMao, p).normalize();
      palma.lerp(alvoPalma, p);
      dedos += (a.dedos - dedos) * p;
    }
    // respiração mexe um pouco as mãos
    pulso.y += 0.006 * Math.sin(t * TAU * ANIMA.respiracao.freq);

    /* IK de dois ossos */
    const br = this.esq.braco[L];
    const l1 = CORPO.braco;
    const l2 = CORPO.antebraco;
    const S = this.pos(`braco${L}`, _S);
    const dSW = _d.subVectors(pulso, S);
    const dist = limitar(dSW.length(), Math.abs(l1 - l2) + 0.02, l1 + l2 - 0.005);
    const dir = _dir.copy(dSW).normalize();
    const perp = _perp.copy(cot).addScaledVector(dir, -cot.dot(dir));
    if (perp.lengthSq() < 1e-6) perp.set(sinal, -0.3, 0).addScaledVector(dir, -dir.dot(perp));
    perp.normalize();
    const cosA = limitar((l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist), -1, 1);
    const sinA = Math.sqrt(1 - cosA * cosA);
    const E = _E.copy(S).addScaledVector(dir, l1 * cosA).addScaledVector(perp, l1 * sinA);
    const W = _W.copy(S).addScaledVector(dir, dist);
    const dirU = _dirU.subVectors(E, S).normalize();
    const dirF = _dirF.subVectors(W, E).normalize();
    // o lado "do polegar" da ligação vira o lado para onde o antebraço dobra
    const dobra = _dobra.copy(dirF).addScaledVector(dirU, -dirF.dot(dirU));
    if (dobra.lengthSq() < 1e-6) dobra.copy(perp).negate();
    dobra.normalize();
    this.alinhar(`braco${L}`, dirU, dobra);
    const cb = dirF.dot(dirU);
    const sb = dirF.dot(dobra);
    const ladoF = _ladoF.copy(dirU).multiplyScalar(-sb).addScaledVector(dobra, cb);
    this.alinhar(`antebraco${L}`, dirF, ladoF);
    // mão
    this.alinhar(`mao${L}`, mao, palma);
    // dedos: dobram para a palma em volta do eixo (eixo × palma)
    this.o(`dedos${L}`).quaternion.setFromAxisAngle(this.eixoDedo[L], 0.15 + 1.0 * dedos);
    this.o(`polegar${L}`).quaternion.setFromAxisAngle(br.eixo, -sinal * 0.25 * dedos);
  }

  private molaGorro(dt: number) {
    const ponta = this.pos('gorro4', _ponta);
    if (!this.pontaAntes || dt <= 0) {
      if (!this.pontaAntes) this.pontaAntes = new THREE.Vector3();
      this.pontaAntes.copy(ponta);
      this.velAntes.set(0, 0, 0);
      this.aplicarMola();
      return;
    }
    const passos = Math.max(1, Math.ceil(dt / (1 / 60)));
    const h = dt / passos;
    const vel = _vel.subVectors(ponta, this.pontaAntes).divideScalar(dt);
    const acel = _acel.subVectors(vel, this.velAntes).divideScalar(dt);
    // limita picos (primeiro quadro, saltos do jogo)
    acel.clampLength(0, 25);
    this.pontaAntes.copy(ponta);
    this.velAntes.copy(vel);
    const { k, c, ganho } = ANIMA.mola;
    const m = this.mola;
    for (let i = 0; i < passos; i++) {
      // a ponta fica para trás da aceleração: aceleração para +Z gira o gorro para trás (x negativo)
      const fx = -k * m.ax - c * m.vx - ganho * acel.z;
      const fz = -k * m.az - c * m.vz + ganho * acel.x;
      m.vx += fx * h;
      m.vz += fz * h;
      m.ax += m.vx * h;
      m.az += m.vz * h;
    }
    m.ax = limitar(m.ax, -0.5, 0.5);
    m.az = limitar(m.az, -0.5, 0.5);
    this.aplicarMola();
  }

  private aplicarMola() {
    const m = this.mola;
    const g2 = this.o('gorro2');
    const g3 = this.o('gorro3');
    const g4 = this.o('gorro4');
    g2.rotation.set(m.ax * 0.3, 0, m.az * 0.3);
    g3.rotation.set(m.ax * 0.4, 0, m.az * 0.4);
    g4.rotation.set(m.ax * 0.5, 0, m.az * 0.5);
  }
}
