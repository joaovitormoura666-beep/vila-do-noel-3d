/**
 * SEQUÊNCIA DA ENTREGA 3D: executa a agenda (agenda.ts) com o Noel, o visitante, a caixa e o presente.
 *
 * O relógio da entrega avança dt x velocidade do jogo (settingsState.effectiveSpeed). Nas fases com fala, o
 * relógio espera a voz do Noel terminar (até um limite), como o 2D; acima de 1,6x não espera. Tudo pode ser
 * interrompido pelo painel ("Pular"): a caixa e o presente (se ainda não foi entregue) saem de cena e são
 * descartados; o balão e a faixa somem; as poses voltam suaves.
 *
 * Nada é alocado por quadro: posições em vetores reaproveitados; caixa e presente são montados antes (preparar),
 * quando o visitante começa a andar até o Noel.
 */
import * as THREE from 'three';
import type { AudioManager } from '../audio/AudioManager';
import type { Stage } from '../engine/Stage';
import { GiftPicker, GIFTS, type GiftDef } from '../gifts/giftCatalog';
import { FAREWELLS, fill, GREETINGS, MAIN_LINE, PhrasePicker, REVEALS, speakableName, type Phrase } from '../santa/phrases';
import type { Cast, GiftBox, SantaRig, VillageSet } from '../world/contracts';
import { Agenda, avaliar, novoQuadro, type FaseId, type Quadro } from './agenda';
import type { Caminhante } from './caminhante';
import { FALA_SOLTA_S, PRESENTE } from './config';
import { descartarObjeto } from './descarte';
import type { Hud3D } from './hud';

export interface DepsEntrega {
  stage: Stage;
  set: VillageSet;
  santa: SantaRig;
  cast: Cast;
  hud: Hud3D;
  audio: AudioManager;
  /** Sorteio (com semente no modo de captura). */
  sorteio: () => number;
  /** Velocidade do jogo agora (base x aceleração automática). */
  velocidade: () => number;
  /** A voz está ligada (configurações) e não é captura. */
  vozLigada: () => boolean;
  /** Falar o nome do visitante na voz. */
  falarNomes: () => boolean;
}

/** Quanto o relógio pode esperar a voz, no total, por fase (s). */
const ESPERA_MAX_VOZ = 3.2;

interface Preparo {
  def: GiftDef;
  caixa: GiftBox;
  presente: THREE.Object3D;
  tampaY: number;
  tampaRx: number;
  tampaRz: number;
}

/** Textura do halo: um degradê redondo, quente, que some nas bordas (feita uma vez). */
function texturaHalo(): THREE.CanvasTexture {
  const N = 128;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
  grad.addColorStop(0, 'rgba(255,226,160,0.9)');
  grad.addColorStop(0.25, 'rgba(255,200,120,0.45)');
  grad.addColorStop(0.6, 'rgba(232,170,90,0.12)');
  grad.addColorStop(1, 'rgba(232,170,90,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, N, N);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function texturaPonto(): THREE.CanvasTexture {
  const N = 32;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
  grad.addColorStop(0, 'rgba(255,240,200,1)');
  grad.addColorStop(0.4, 'rgba(255,210,130,0.6)');
  grad.addColorStop(1, 'rgba(255,200,120,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, N, N);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class Entrega3D {
  readonly agenda = new Agenda();
  private readonly q: Quadro = novoQuadro();
  private readonly presentes: GiftPicker;
  private readonly frases: PhrasePicker;
  private visitante: Caminhante | null = null;
  private t = 0;
  private fase: FaseId | null = null;
  private preparo: Preparo | null = null;
  private atual: Preparo | null = null;
  private esperou = 0;
  private falando = false;
  private vozToken = 0;
  private textoSaudacao = '';
  private textoDespedida = '';
  /** O presente já chegou às mãos do visitante. */
  entregue = false;
  /** A última entrega terminou (o diretor lê e zera). */
  terminou = false;
  /** Presente da entrega em andamento (para o painel e o evento "delivered"). */
  presenteAtual: GiftDef | null = null;

  private readonly halo: THREE.Sprite;
  private readonly faiscas: THREE.Points;
  private readonly faiscasPos: Float32Array;
  private readonly faiscasVel: Float32Array;
  private readonly matFaiscas: THREE.PointsMaterial;

  // pontos fixos no mundo
  private readonly pBoca = new THREE.Vector3();
  private readonly pCaixa = new THREE.Vector3();
  private readonly pRevela = new THREE.Vector3();
  private readonly paraCamera = new THREE.Vector3();
  // temporários
  private readonly v1 = new THREE.Vector3();
  private readonly v2 = new THREE.Vector3();

  /**
   * Para onde o visitante fica virado na entrega: para o Noel, "roubando" um pouco para a câmera (como no cinema),
   * para o rosto aparecer de três quartos em vez de ficar de costas.
   */
  readonly yawNaEntrega: number;

  /** Fala solta (fila vazia): tempo restante. */
  private solta = 0;

  constructor(private readonly deps: DepsEntrega) {
    this.presentes = new GiftPicker(GIFTS, deps.sorteio);
    this.frases = new PhrasePicker(deps.sorteio);
    const { set, santa, stage } = deps;
    const a = set.anchors;
    santa.root.updateMatrixWorld(true);
    santa.sackMouth.getWorldPosition(this.pBoca);
    this.pRevela.copy(a.reveal);
    const cam = set.look.camera.position;
    this.paraCamera.set(cam[0] - a.delivery.position.x, 0, cam[2] - a.delivery.position.z).normalize();
    const paraNoel = a.delivery.yaw;
    const paraCam = Math.atan2(this.paraCamera.x, this.paraCamera.z);
    let d = paraCam - paraNoel;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.yawNaEntrega = paraNoel + d * PRESENTE.olharCamera;
    this.pCaixa
      .copy(a.santa.position)
      .lerp(a.delivery.position, PRESENTE.caixa.fracao)
      .addScaledVector(this.paraCamera, PRESENTE.caixa.paraCamera)
      .setY(PRESENTE.caixa.altura);

    // halo contido em volta do presente (abaixo do limiar do bloom: não estoura)
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: texturaHalo(), color: '#ffffff', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.scale.setScalar(PRESENTE.halo.raio * 2);
    halo.visible = false;
    halo.renderOrder = 2;
    halo.userData.semAO = true;
    stage.scene.add(halo);
    this.halo = halo;

    // faíscas da abertura: um Points só, com velocidades sorteadas uma vez
    const n = PRESENTE.faiscas;
    this.faiscasPos = new Float32Array(n * 3);
    this.faiscasVel = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const ang = deps.sorteio() * Math.PI * 2;
      const el = 0.5 + deps.sorteio() * 0.9;
      const vel = 1.2 + deps.sorteio() * 1.1;
      this.faiscasVel[i * 3] = Math.cos(ang) * Math.cos(el) * vel;
      this.faiscasVel[i * 3 + 1] = Math.sin(el) * vel + 0.6;
      this.faiscasVel[i * 3 + 2] = Math.sin(ang) * Math.cos(el) * vel;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.faiscasPos, 3).setUsage(THREE.DynamicDrawUsage));
    this.matFaiscas = new THREE.PointsMaterial({ map: texturaPonto(), color: '#ffd59a', size: 0.07, sizeAttenuation: true, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    this.faiscas = new THREE.Points(geo, this.matFaiscas);
    this.faiscas.frustumCulled = false;
    this.faiscas.visible = false;
    this.faiscas.userData.semAO = true;
    stage.scene.add(this.faiscas);
  }

  get rodando() {
    return this.visitante !== null;
  }

  get faseAtual() {
    return this.fase;
  }

  /** Onde a caixa para e onde o presente aparece (para as áreas proibidas das etiquetas). */
  get pontoCaixa() {
    return this.pCaixa;
  }

  get pontoRevelacao() {
    return this.pRevela;
  }

  get quadro(): Readonly<Quadro> {
    return this.q;
  }

  /** Monta a caixa e o presente da próxima entrega antes da hora (escondidos), para não engasgar na chegada. */
  preparar() {
    if (this.preparo) return;
    const def = this.presentes.pick();
    const caixa = this.deps.cast.createGiftBox();
    const presente = this.deps.cast.createGift(def.id);
    caixa.root.visible = false;
    presente.visible = false;
    caixa.root.traverse((o) => (o.castShadow = true));
    this.deps.stage.scene.add(caixa.root, presente);
    this.preparo = { def, caixa, presente, tampaY: caixa.lid.position.y, tampaRx: caixa.lid.rotation.x, tampaRz: caixa.lid.rotation.z };
    // compila os materiais em segundo plano (onde o navegador permitir)
    this.aquecer(caixa.root);
    this.aquecer(presente);
  }

  private aquecer(obj: THREE.Object3D) {
    const { renderer, camera, scene } = this.deps.stage;
    const antes = obj.visible;
    obj.visible = true;
    try {
      void renderer.compileAsync(obj, camera, scene).catch(() => undefined);
    } catch {
      /* sem compilação antecipada: compila no primeiro desenho */
    }
    obj.visible = antes;
  }

  /** Começa a entrega para o visitante que acabou de chegar. */
  iniciar(c: Caminhante) {
    this.preparar();
    this.atual = this.preparo;
    this.preparo = null;
    this.visitante = c;
    this.presenteAtual = this.atual!.def;
    this.t = 0;
    this.fase = null;
    this.esperou = 0;
    this.entregue = false;
    this.terminou = false;
    const nome = c.participante.nickname;
    this.textoSaudacao = fill(this.frases.pick(GREETINGS).text, { nome });
    this.textoDespedida = fill(this.frases.pick(FAREWELLS).text, { nome });
    c.poseDireta = true;
    this.deps.set.setDeliveryActive(true);
    this.solta = 0;
  }

  /** "Pular": encerra já, sem deixar nada para trás. */
  cancelar() {
    if (!this.visitante) return;
    this.encerrar();
  }

  private encerrar() {
    const c = this.visitante;
    const { hud, set, audio } = this.deps;
    audio.voice.stop();
    this.vozToken++;
    this.falando = false;
    const p = this.atual;
    if (p) {
      descartarObjeto(p.caixa.root);
      if (!this.entregue) descartarObjeto(p.presente);
    }
    this.atual = null;
    this.halo.visible = false;
    this.faiscas.visible = false;
    hud.esconderBalao();
    hud.esconderFaixa();
    set.setDeliveryActive(false);
    if (c) {
      c.poseDireta = false;
      c.alvoPose.lookUp = 0;
      c.alvoPose.joy = 0;
      c.alvoPose.jump = 0;
      c.alvoPose.hold = this.entregue ? 1 : 0;
      c.yawFixo = null;
    }
    this.visitante = null;
    this.fase = null;
    this.terminou = true;
  }

  /** Fala solta do Noel com a fila vazia (balão, voz e aceno). */
  falarSozinho(frase: Phrase) {
    if (this.visitante) return;
    this.solta = FALA_SOLTA_S;
    this.deps.hud.mostrarBalao(frase.text);
    this.falar(frase.text, frase.id);
  }

  get falandoSozinho() {
    return this.solta > 0;
  }

  /** Teste de voz do painel. */
  testarVoz() {
    this.deps.audio.voice.retryTts();
    this.falarSozinho({ id: 'teste-voz', text: 'Ho, ho, ho! Feliz Natal!' });
  }

  private falar(texto: string, id: string) {
    if (!this.deps.vozLigada()) return;
    const token = ++this.vozToken;
    this.falando = true;
    void this.deps.audio.voice.speak(texto, id).finally(() => {
      if (token === this.vozToken) this.falando = false;
    });
  }

  private aoEntrarNaFase(f: FaseId) {
    const { audio, hud } = this.deps;
    const c = this.visitante!;
    const nome = c.participante.nickname;
    const falaNome = this.deps.falarNomes() ? speakableName(nome) : '';
    const def = this.atual!.def;
    this.esperou = 0;
    switch (f) {
      case 'chegada':
        audio.sfx.play('arrive');
        break;
      case 'saudacao':
        this.falar(this.textoSaudacao.split(nome).join(falaNome || 'meu amigo'), 'saudacao');
        break;
      case 'fala':
        this.falar(MAIN_LINE.text, MAIN_LINE.id);
        break;
      case 'saco':
        audio.sfx.play('rummage');
        break;
      case 'caixa':
        audio.sfx.play('rise');
        break;
      case 'suspense':
        audio.sfx.play('drum');
        break;
      case 'abre':
        audio.sfx.play('reveal');
        break;
      case 'revelacao': {
        // a fala da revelação sai só na voz: na tela, quem conta é a faixa
        const frase = this.frases.pick(REVEALS);
        this.falar(fill(frase.text, { nome: falaNome || 'meu amigo', presente: def.spoken }), frase.id);
        hud.mostrarFaixa(nome, def.name);
        break;
      }
      case 'entrega':
        break;
      case 'festa':
        audio.sfx.play('jump');
        this.falar(this.textoDespedida.split(nome).join(falaNome || 'meu amigo'), 'despedida');
        break;
    }
  }

  /** Um quadro. `t` é o relógio do jogo (para as animações próprias dos bonecos). */
  update(dt: number) {
    const { santa, hud } = this.deps;
    const pose = santa.pose;
    if (!this.visitante) {
      // sem entrega: fala solta ou repouso (o Noel mistura as poses sozinho)
      if (this.solta > 0) {
        this.solta -= dt;
        const k = Math.min(1, this.solta / 0.4, (FALA_SOLTA_S - this.solta) / 0.3);
        pose.wave = 0.85 * Math.max(0, k);
        pose.talk = Math.max(0, k);
        if (this.solta <= 0) hud.esconderBalao();
      } else {
        const k = Math.min(1, dt * 4);
        pose.wave -= pose.wave * k;
        pose.talk -= pose.talk * k;
        pose.rummage -= pose.rummage * k;
        pose.present -= pose.present * k;
        pose.give -= pose.give * k;
        pose.cheer -= pose.cheer * k;
      }
      return;
    }

    // relógio da agenda: espera a voz no fim das fases com fala
    const ag = this.agenda;
    const vel = this.deps.velocidade();
    let avanco = dt * vel;
    const faseAg = ag.faseEm(this.t);
    if (faseAg?.esperaVoz && this.falando && vel <= 1.6 && this.esperou < ESPERA_MAX_VOZ) {
      const segurar = faseAg.fim - 0.42;
      if (this.t + avanco > segurar) {
        this.esperou += dt;
        avanco = Math.max(0, segurar - this.t);
      }
    }
    this.t += avanco;
    const q = avaliar(ag, this.t, this.q);
    if (q.fase !== this.fase && q.fase) {
      // entra em todas as fases puladas (quadros longos ou velocidade alta), em ordem
      for (const f of ag.fases) {
        if (f.inicio < (this.fase ? ag.f[this.fase].fim : 0) - 1e-6) continue;
        if (f.inicio > this.t) break;
        this.fase = f.id;
        this.aoEntrarNaFase(f.id);
      }
    }

    // Noel
    pose.wave = q.noel.wave;
    pose.talk = q.noel.talk;
    pose.rummage = q.noel.rummage;
    pose.present = q.noel.present;
    pose.give = q.noel.give;
    pose.cheer = q.noel.cheer;

    // visitante (de frente para o Noel)
    const c = this.visitante;
    const vp = c.rig.pose;
    vp.lookUp = q.visitante.lookUp;
    vp.hold = q.visitante.hold;
    vp.joy = q.visitante.joy;
    vp.jump = q.visitante.jump;
    c.yawFixo = this.yawNaEntrega;

    // balão
    if (q.balao === 'saudacao') hud.mostrarBalao(this.textoSaudacao);
    else if (q.balao === 'fala') hud.mostrarBalao(MAIN_LINE.text);
    else if (q.balao === 'despedida') hud.mostrarBalao(this.textoDespedida);
    else hud.esconderBalao();
    if (!q.faixa) hud.esconderFaixa();

    this.posicionarObjetos(q);

    if (this.t >= ag.total) this.encerrar();
  }

  private posicionarObjetos(q: Quadro) {
    const p = this.atual;
    const c = this.visitante;
    if (!p || !c) return;
    const { caixa, presente } = p;

    // caixa: sai da boca do saco num arco e para diante dos dois, de frente para a câmera
    caixa.root.visible = q.caixa.visivel && q.caixa.escala > 0.01;
    if (caixa.root.visible) {
      const r = caixa.root;
      r.position.lerpVectors(this.pBoca, this.pCaixa, q.caixa.voo);
      r.position.y += Math.sin(Math.PI * q.caixa.voo) * 0.45;
      r.scale.setScalar(PRESENTE.escalaCaixa * q.caixa.escala);
      r.rotation.set(0, Math.atan2(this.paraCamera.x, this.paraCamera.z) + (1 - q.caixa.voo) * 1.2, q.caixa.balanco);
      const lid = caixa.lid;
      lid.position.y = p.tampaY + q.caixa.tampa * 0.55;
      lid.rotation.x = p.tampaRx - q.caixa.tampa * 0.55;
      lid.rotation.z = p.tampaRz + q.caixa.tampa * 0.18;
    }

    // presente: sobe da caixa, gira no alto, desce até as mãos e fica preso ao visitante
    if (q.presente.naMao) {
      if (!this.entregue) {
        this.entregue = true;
        c.rig.giftAnchor.add(presente);
        presente.position.set(0, 0, 0);
        presente.rotation.set(0, 0, 0);
        presente.scale.setScalar(PRESENTE.escalaNaMao);
        presente.visible = true;
        c.presente = presente;
        c.presenteDescartar = () => descartarObjeto(presente);
      }
    } else if (q.presente.visivel) {
      presente.visible = true;
      // de dentro da caixa (meio da altura dela) até o ponto da revelação
      this.v1.copy(this.pCaixa);
      this.v1.y += PRESENTE.escalaCaixa * 0.5;
      this.v2.copy(this.pRevela);
      this.v2.y += Math.sin(this.t * 2.3) * 0.035 * q.presente.subida;
      presente.position.lerpVectors(this.v1, this.v2, q.presente.subida);
      let escala = PRESENTE.escalaRevelacao * (0.25 + 0.75 * q.presente.subida);
      if (q.presente.paraMao > 0) {
        c.rig.giftAnchor.getWorldPosition(this.v1);
        presente.position.lerp(this.v1, q.presente.paraMao);
        escala += (PRESENTE.escalaNaMao - escala) * q.presente.paraMao;
      }
      presente.scale.setScalar(escala);
      presente.rotation.set(0, q.presente.giro, 0);
    } else {
      presente.visible = false;
    }

    // halo contido, um pouco atrás do presente (do ponto de vista da câmera)
    const brilho = q.presente.brilho;
    this.halo.visible = brilho > 0.01 && presente.visible;
    if (this.halo.visible) {
      presente.getWorldPosition(this.halo.position);
      this.halo.position.addScaledVector(this.paraCamera, -0.25);
      (this.halo.material as THREE.SpriteMaterial).opacity = brilho * PRESENTE.halo.opacidade;
      this.halo.scale.setScalar(PRESENTE.halo.raio * 2 * (0.7 + 0.3 * q.presente.subida) * (1 - 0.5 * q.presente.paraMao));
    }

    // faíscas da abertura: balísticas, somem em 1,2 s
    const idade = q.presente.faisca >= 0 ? this.t - q.presente.faisca : -1;
    this.faiscas.visible = idade >= 0 && idade < 1.2;
    if (this.faiscas.visible) {
      const n = PRESENTE.faiscas;
      const o = this.pCaixa;
      const top = PRESENTE.escalaCaixa * 0.9;
      for (let i = 0; i < n; i++) {
        this.faiscasPos[i * 3] = o.x + this.faiscasVel[i * 3] * idade * 0.6;
        this.faiscasPos[i * 3 + 1] = o.y + top + this.faiscasVel[i * 3 + 1] * idade * 0.6 - 1.4 * idade * idade;
        this.faiscasPos[i * 3 + 2] = o.z + this.faiscasVel[i * 3 + 2] * idade * 0.6;
      }
      (this.faiscas.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
      this.matFaiscas.opacity = 0.85 * (1 - idade / 1.2);
    }
  }

  dispose() {
    this.encerrar();
    if (this.preparo) {
      descartarObjeto(this.preparo.caixa.root);
      descartarObjeto(this.preparo.presente);
      this.preparo = null;
    }
    this.halo.removeFromParent();
    (this.halo.material as THREE.SpriteMaterial).map?.dispose();
    (this.halo.material as THREE.SpriteMaterial).dispose();
    this.faiscas.removeFromParent();
    this.faiscas.geometry.dispose();
    this.matFaiscas.map?.dispose();
    this.matFaiscas.dispose();
  }
}
