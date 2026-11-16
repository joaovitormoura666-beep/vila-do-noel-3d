/**
 * Monta o gnomo (esqueleto + uma SkinnedMesh por material, mais um corpo simplificado só para a sombra)
 * e o anima a partir da pose do jogo.
 *
 * Animação (tudo em função de dt e t, sem relógio próprio):
 *   parado    respiração, peso trocando de pé, cabeça olhando em volta e, de tempos em tempos (ritmo da
 *             semente), uma olhada curiosa por cima do ombro que mostra o rosto a quem está atrás;
 *             olhos com sacadas e piscadas;
 *   andando   passo curto e gingado: o peso vai de um lado ao outro, o corpo sobe e desce duas vezes
 *             por ciclo, o pé assenta do calcanhar para a ponta, braços em contrafase;
 *   pulinho   corpo estica na subida e achata na queda; pernas encolhem; o gorro chicoteia;
 *   alegria   braços em V com as mãos abertas, boca aberta, olhos sorrindo, sobrancelhas no alto;
 *   segurar   o presente assenta sobre o gorro (que dobra para trás, amassado) e as mãos o seguram
 *             pelos lados, palmas para dentro e dedos curvados (cinemática inversa de dois ossos);
 *   olhar     cabeça e olhos para cima.
 * O gorro (cinco molas em corrente), a barba, o bigode, as tranças, a ponta do cachecol e a barriga
 * seguem com atraso, movidos pela aceleração real da cabeça e do corpo e pela gravidade.
 */
import * as THREE from 'three';
import type { VisitorPose, VisitorRig } from '../../contracts';
import type { Aparencia } from './aparencia';
import { O, PAIS, TOTAL_OSSOS } from './esqueleto';
import type { NomeMaterial } from './materiais';
import { MATERIAIS } from './materiais';
import type { Modelo } from './modelagem';
import { hashTexto, limitar, suave } from './util';

/** Mola angular de dois eixos (rotação em X e em Z). */
class Mola {
  x = 0;
  z = 0;
  vx = 0;
  vz = 0;
  constructor(
    public freq: number,
    public amort: number,
  ) {}
  passo(dt: number, alvoX: number, alvoZ: number) {
    const w = this.freq * Math.PI * 2;
    const n = Math.max(1, Math.ceil(dt / (1 / 120)));
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      this.vx += (w * w * (alvoX - this.x) - 2 * this.amort * w * this.vx) * h;
      this.vz += (w * w * (alvoZ - this.z) - 2 * this.amort * w * this.vz) * h;
      this.x += this.vx * h;
      this.z += this.vz * h;
    }
  }
}

/** Geometrias de um nível de detalhe: uma por material e o corpo da sombra. */
export interface GeometriasGnomo {
  geos: Map<NomeMaterial, THREE.BufferGeometry>;
  sombra: THREE.BufferGeometry | null;
}

export interface MateriaisMontagem {
  m: Record<NomeMaterial, THREE.Material>;
  sombra: THREE.Material;
}

export interface GnomoMontado extends VisitorRig {
  /** Troca as malhas (outro nível de detalhe) mantendo o esqueleto e a pose. */
  trocarMalhas(g: GeometriasGnomo, mats: MateriaisMontagem): void;
}

/** Esfera que cobre o gnomo em qualquer pose (pulo, braços erguidos, presente e ponta do gorro). */
const ESFERA = new THREE.Sphere(new THREE.Vector3(0, 0.82, 0), 1.05);

const tmpV = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();
const eixoX = new THREE.Vector3();
const eixoY = new THREE.Vector3();
const eixoZ = new THREE.Vector3();
const mBase = new THREE.Matrix4();

export function montarGnomo(ap: Aparencia, modelo: Modelo, geometrias: GeometriasGnomo, mats: MateriaisMontagem, aoSoltar: () => void): GnomoMontado {
  const root = new THREE.Group();
  root.name = `gnomo-${ap.chave}`;
  // escala de base: garante a altura do contrato (1,15 a 1,35 m) sem mexer na proporção
  const escBase = limitar(modelo.altura, 1.16, 1.34) / modelo.altura;
  // esqueleto (rotações de ligação = identidade; só posições)
  const ossos: THREE.Bone[] = [];
  for (let i = 0; i < TOTAL_OSSOS; i++) {
    const b = new THREE.Bone();
    b.name = `osso${i}`;
    const pai = PAIS[i];
    const pos = modelo.ossos[i] ?? modelo.ossos[O.CABECA];
    b.position.copy(pos);
    if (pai >= 0) b.position.sub(modelo.ossos[pai] ?? modelo.ossos[O.CABECA]);
    ossos.push(b);
  }
  for (let i = 0; i < TOTAL_OSSOS; i++) if (PAIS[i] >= 0) ossos[PAIS[i]].add(ossos[i]);
  root.add(ossos[O.RAIZ]);
  root.updateMatrixWorld(true);
  const esqueleto = new THREE.Skeleton(ossos);
  const ligacao = ossos.map((b) => b.position.clone());

  let malhas: THREE.SkinnedMesh[] = [];
  const criarMalhas = (g: GeometriasGnomo, ms: MateriaisMontagem) => {
    for (const m of malhas) root.remove(m);
    malhas = [];
    const nova = (geo: THREE.BufferGeometry, mat: THREE.Material, nome: string) => {
      const m = new THREE.SkinnedMesh(geo, mat);
      m.name = nome;
      // a esfera de recorte é fixa (não recalcula a pele a cada quadro)
      m.boundingSphere = ESFERA.clone();
      m.frustumCulled = true;
      root.add(m);
      m.bind(esqueleto, new THREE.Matrix4());
      malhas.push(m);
      return m;
    };
    for (const nome of MATERIAIS) {
      const geo = g.geos.get(nome);
      if (!geo) continue;
      const m = nova(geo, ms.m[nome], nome);
      // quem projeta a sombra é o corpo simplificado (uma chamada por luz, poucos triângulos)
      m.castShadow = false;
      m.receiveShadow = true;
    }
    if (g.sombra) {
      const m = nova(g.sombra, ms.sombra, 'sombra');
      m.castShadow = true;
      m.receiveShadow = false;
      m.userData.semAO = true;
      m.renderOrder = -1;
    }
  };
  criarMalhas(geometrias, mats);

  // âncoras: filhas do grupo (não da raiz, que estica e achata no pulo)
  const cabBind = modelo.ossos[O.CABECA];
  const labelAnchor = new THREE.Object3D();
  labelAnchor.name = 'etiqueta';
  root.add(labelAnchor);
  const giftAnchor = new THREE.Object3D();
  giftAnchor.name = 'presente';
  root.add(giftAnchor);
  const etiquetaSobe = (modelo.etiqueta.y - cabBind.y) * escBase;

  const h = hashTexto(ap.chave + '#anim');
  const pose: VisitorPose = { walk: 0, phase: (h % 628) / 100, jump: 0, hold: 0, joy: 0, lookUp: 0 };
  const r = ap.ritmo;
  // olhada curiosa: período, lado e força próprios de cada semente
  const curioso = { periodo: 7 + (h % 400) / 100, lado: (h >>> 9) % 2 ? 1 : -1, forca: 0.8 + ((h >>> 11) % 100) / 500, fase: ((h >>> 3) % 1000) / 100 };

  // molas: o gorro é uma corrente de cinco (a frequência cai para a ponta, que atrasa mais)
  const molasG = [new Mola(2.6, 0.2), new Mola(2.2, 0.2), new Mola(1.8, 0.21), new Mola(1.5, 0.22), new Mola(1.2, 0.24)];
  const pesoG = [0.18, 0.26, 0.3, 0.3, 0.26];
  const ossosG = [O.G1, O.G2, O.G3, O.G4, O.G5];
  const molaPompom = new Mola(1.6, 0.12);
  const molaBarba = new Mola(2.2, 0.3);
  const molaTranca = new Mola(1.9, 0.25);
  const molaCachecol = new Mola(1.7, 0.25);
  const molaBarriga = new Mola(3, 0.18);
  const posAnt = new THREE.Vector3();
  const velAnt = new THREE.Vector3();
  const acel = new THREE.Vector3();
  let quadros = 0;
  let pulaAnt = 0;
  let velPulaAnt = 0;
  let estica = 1;

  const info = modelo.info;
  const curva = info.curvaGorro;
  const p = ap.p;
  const ladoBraco = [
    { s: 1, braco: O.BRACO_E, ante: O.ANTE_E, mao: O.MAO_E, dedos: O.DEDOS_E },
    { s: -1, braco: O.BRACO_D, ante: O.ANTE_D, mao: O.MAO_D, dedos: O.DEDOS_D },
  ];
  const compBraco = ligacao[O.ANTE_E].length();
  const compAnte = ligacao[O.MAO_E].length();
  const palma = 0.062;

  /** Alvo pseudoaleatório para as sacadas dos olhos (determinístico pelo índice). */
  const sacada = (k: number) => {
    const q = hashTexto(`${ap.chave}:${k}`);
    return [((q & 255) / 255 - 0.5) * 0.36, (((q >>> 8) & 255) / 255 - 0.5) * 0.14];
  };

  // apoio da cinemática inversa e da orientação das mãos
  const mPeito = new THREE.Matrix4();
  const mPeitoInv = new THREE.Matrix4();
  const alvo = new THREE.Vector3();
  const polo = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const cot = new THREE.Vector3();
  const qBraco = new THREE.Quaternion();
  const qInv = new THREE.Quaternion();
  const qCadeia = new THREE.Quaternion();
  const qDesejo = new THREE.Quaternion();
  const qLocal = new THREE.Quaternion();
  const qIdent = new THREE.Quaternion();

  function ik(lado: (typeof ladoBraco)[number], alvoRoot: THREE.Vector3, poloRoot: THREE.Vector3, esticarMax: number) {
    const s = lado.s;
    const bB = ossos[lado.braco];
    const bA = ossos[lado.ante];
    const bM = ossos[lado.mao];
    alvo.copy(alvoRoot).applyMatrix4(mPeitoInv);
    polo.copy(poloRoot).transformDirection(mPeitoInv);
    const S = bB.position;
    dir.subVectors(alvo, S);
    let d = dir.length();
    dir.divideScalar(Math.max(1e-5, d));
    // esticar de desenho animado quando o alvo está longe
    const k = limitar((d - palma) / (compBraco + compAnte), 1, esticarMax);
    const a = compBraco * k;
    const b = compAnte * k + palma;
    bA.position.set(s * a, 0, 0);
    bM.position.set(s * compAnte * k, 0, 0);
    d = limitar(d, Math.abs(a - b) + 1e-3, a + b - 1e-4);
    const cosA = limitar((a * a + d * d - b * b) / (2 * a * d), -1, 1);
    const sinA = Math.sqrt(1 - cosA * cosA);
    polo.addScaledVector(dir, -polo.dot(dir));
    if (polo.lengthSq() < 1e-8) polo.set(0, 0, -1);
    polo.normalize();
    cot.copy(dir).multiplyScalar(cosA).addScaledVector(polo, sinA);
    tmpV.set(s, 0, 0);
    qBraco.setFromUnitVectors(tmpV, cot);
    bB.quaternion.copy(qBraco);
    // antebraço: do cotovelo ao alvo
    const E = tmpV2.copy(S).addScaledVector(cot, a);
    dir.subVectors(alvo, E).normalize();
    qInv.copy(qBraco).invert();
    dir.applyQuaternion(qInv);
    tmpV.set(s, 0, 0);
    bA.quaternion.setFromUnitVectors(tmpV, dir);
  }

  /**
   * Orientação da mão no espaço do grupo: `dedos` = para onde apontam os dedos, `costas` = para onde
   * olham as costas da mão (a palma fica do lado oposto). Devolve a rotação local do osso da mão.
   */
  function orientarMao(lado: (typeof ladoBraco)[number], dedos: THREE.Vector3, costas: THREE.Vector3, out: THREE.Quaternion) {
    eixoX.copy(dedos).normalize().multiplyScalar(lado.s);
    eixoY.copy(costas).addScaledVector(eixoX, -costas.dot(eixoX)).normalize();
    eixoZ.crossVectors(eixoX, eixoY);
    mBase.makeBasis(eixoX, eixoY, eixoZ);
    qDesejo.setFromRotationMatrix(mBase);
    qCadeia.copy(ossos[O.RAIZ].quaternion).multiply(ossos[O.QUADRIL].quaternion).multiply(ossos[O.BARRIGA].quaternion).multiply(ossos[O.PEITO].quaternion).multiply(ossos[lado.braco].quaternion).multiply(ossos[lado.ante].quaternion);
    return out.copy(qCadeia).invert().multiply(qDesejo);
  }

  const alvoE = new THREE.Vector3();
  const poloE = new THREE.Vector3();
  const alvoTmp = new THREE.Vector3();
  const poloTmp = new THREE.Vector3();
  const presenteRoot = new THREE.Vector3();
  const vDedos = new THREE.Vector3();
  const vCostas = new THREE.Vector3();
  const qHold = new THREE.Quaternion();
  const qJoy = new THREE.Quaternion();
  const wq = new THREE.Quaternion();
  const gl = new THREE.Vector3();

  function update(dt: number, t: number) {
    const w = limitar(pose.walk, 0, 1);
    const ph = pose.phase;
    const J = limitar(pose.jump, 0, 1);
    const hold = limitar(pose.hold, 0, 1);
    const joy = limitar(pose.joy, 0, 1);
    const lu = limitar(pose.lookUp, 0, 1);
    const cima = Math.max(hold, joy);
    const tt = t + r.fase;
    const parado = (1 - w) * (1 - cima);

    // reset das posições que a IK muda
    for (const l of ladoBraco) {
      ossos[l.braco].position.copy(ligacao[l.braco]);
      ossos[l.ante].position.copy(ligacao[l.ante]);
      ossos[l.mao].position.copy(ligacao[l.mao]);
    }

    /* raiz: pulo, ginga (o peso vai de um pé ao outro) e esticar/achatar */
    const passo = Math.abs(Math.sin(ph));
    const bob = w * passo * 0.026;
    const resp = Math.sin((tt * Math.PI * 2) / (3.6 / r.respirar));
    const raiz = ossos[O.RAIZ];
    // o pulinho de alegria (com ou sem presente) sobe mais: a cabeça passa do joelho do Noel
    raiz.position.set(Math.sin(ph) * 0.018 * w * r.ginga, J * (0.3 + 0.1 * cima) + bob, 0);
    let acelY = 0;
    if (dt > 0) {
      const vel = (J - pulaAnt) / dt;
      acelY = (vel - velPulaAnt) / dt;
      velPulaAnt = vel;
      const alvoEst = 1 + (limitar(vel * 0.045, -0.1, 0.14) + joy * 0.03) * (1 - 0.7 * hold);
      estica += (alvoEst - estica) * Math.min(1, dt * 18);
    }
    pulaAnt = J;
    const estW = 1 - w * (1 - passo) * 0.03; // achata um tiquinho quando o pé bate
    raiz.scale.set(escBase / Math.sqrt(estica * estW), escBase * estica * estW, escBase / Math.sqrt(estica * estW));
    raiz.rotation.set(0, 0, Math.sin(ph) * 0.13 * w * r.ginga + parado * 0.014 * Math.sin(tt * 0.7));

    /* olhada curiosa por cima do ombro (só parado) */
    const cc = (tt + curioso.fase) % curioso.periodo;
    const olhada = parado * suave(0, 0.6, cc) * (1 - suave(2.4, 3.1, cc)) * curioso.forca * curioso.lado;

    /* tronco, com a barriga que sacode */
    const quadril = ossos[O.QUADRIL];
    quadril.rotation.set(0, Math.sin(ph) * 0.12 * w + olhada * 0.15, 0);
    const barriga = ossos[O.BARRIGA];
    barriga.rotation.set(0.05 * w - 0.05 * joy, -Math.sin(ph) * 0.06 * w + olhada * 0.2, 0);
    if (dt > 0) molaBarriga.passo(dt, limitar(-acelY * 0.0016 - w * (1 - passo) * 0.02, -0.08, 0.08), 0);
    const jig = molaBarriga.x;
    barriga.scale.set(1 - jig * 0.5, 1 + jig, 1 - jig * 0.5);
    const peito = ossos[O.PEITO];
    peito.rotation.set(-0.1 * joy - 0.06 * hold, olhada * 0.12, -raiz.rotation.z * 0.4);
    peito.scale.set((1 + 0.01 * resp) / (1 - jig * 0.5), (1 + 0.014 * resp) / (1 + jig), (1 + 0.014 * resp) / (1 - jig * 0.5));

    /* cabeça e rosto */
    const cab = ossos[O.CABECA];
    const olhaVolta = parado * (0.2 * Math.sin(tt * 0.31) + 0.08 * Math.sin(tt * 0.83 + 1)) + olhada * 0.75;
    cab.rotation.set(-0.45 * lu - 0.08 * joy + 0.04 * Math.sin(ph * 2) * w + parado * 0.03 * Math.sin(tt * 0.5) - Math.abs(olhada) * 0.08, olhaVolta, -raiz.rotation.z * 0.55 + parado * 0.05 * Math.sin(tt * 0.23 + 2) + joy * 0.07 * Math.sin(t * 3) + olhada * 0.1);
    // olhos: sacadas rápidas entre alvos sorteados pelo tempo (e para o lado da olhada)
    const per = 1.4 + (h % 100) / 100;
    const k = Math.floor(tt / per);
    const f = tt / per - k;
    const s0 = sacada(k - 1);
    const s1 = sacada(k);
    const m = Math.min(1, f / 0.06);
    const yawO = (s0[0] + (s1[0] - s0[0]) * m) * (1 - lu) * (1 - joy * 0.7) * (1 - Math.abs(olhada)) + olhada * 0.35;
    const pitO = (s0[1] + (s1[1] - s0[1]) * m) * (1 - lu) - 0.38 * lu;
    for (const o of [O.OLHO_E, O.OLHO_D]) ossos[o].rotation.set(pitO, yawO, 0);
    // piscadas (às vezes duplas)
    const cic = tt % r.piscar;
    const dupla = hashTexto(`${ap.chave}p${Math.floor(tt / r.piscar)}`) % 4 === 0;
    const pisca = cic < 0.16 ? Math.sin((Math.PI * cic) / 0.16) : dupla && cic > 0.26 && cic < 0.42 ? Math.sin((Math.PI * (cic - 0.26)) / 0.16) : 0;
    // olhos bem abertos e alegres: a pálpebra de cima cobre pouco; a de baixo sobe em arco (sorriso dos olhos)
    const palpCima = -0.82 + pisca * 1.95 + joy * 0.3 + pitO * 0.5 - lu * 0.1;
    for (const o of [O.PALP_E, O.PALP_D]) ossos[o].rotation.set(Math.min(1.15, palpCima), yawO * 0.3, 0);
    for (const o of [O.PINF_E, O.PINF_D]) ossos[o].rotation.set(-0.36 - 0.3 * joy - pisca * 0.12 + Math.min(0, pitO) * 0.3, 0, 0);
    // sobrancelhas: sobem na alegria, no susto da piscada e ao olhar para cima
    const sob = 0.012 * joy + 0.008 * lu + 0.004 * pisca + 0.004 * Math.abs(olhada);
    ossos[O.SOBR_E].position.copy(ligacao[O.SOBR_E]).y += sob;
    ossos[O.SOBR_D].position.copy(ligacao[O.SOBR_D]).y += sob;
    ossos[O.SOBR_E].rotation.set(0, 0, 0.14 * joy);
    ossos[O.SOBR_D].rotation.set(0, 0, -0.14 * joy);
    // boca: abre na alegria e um pouquinho no esforço de segurar
    const abre = Math.max(joy * (0.75 + 0.25 * Math.sin(t * 7)), hold * 0.35);
    const boca = ossos[O.BOCA];
    boca.position.copy(ligacao[O.BOCA]);
    boca.position.y -= 0.016 * abre;
    boca.position.z -= 0.004 * abre;
    boca.scale.set(1 + 0.12 * abre, 1 + 0.6 * abre, 1);

    /* pernas: passo curto; o pé assenta do calcanhar para a ponta; no pulo encolhem */
    const pernas = [
      { coxa: O.COXA_E, canela: O.CANELA_E, pe: O.PE_E, f: 0 },
      { coxa: O.COXA_D, canela: O.CANELA_D, pe: O.PE_D, f: Math.PI },
    ];
    for (const l of pernas) {
      const fase = ph + l.f;
      const frente = Math.sin(fase);
      const ergue = Math.max(0, Math.cos(fase));
      const coxa = -frente * 0.5 * w - J * 0.55 - ergue * 0.2 * w;
      const joelho = ergue * 0.8 * w + J * 0.95;
      ossos[l.coxa].rotation.set(coxa, 0, 0);
      ossos[l.canela].rotation.set(joelho, 0, 0);
      // calcanhar na frente (ponta para cima), ponta atrás (empurra o chão)
      const rolar = (-0.22 * Math.max(0, frente) + 0.18 * Math.max(0, -frente) * (1 - ergue)) * w;
      ossos[l.pe].rotation.set(-(coxa + joelho) * 0.75 + J * 0.25 + rolar, 0, 0);
    }

    /* braços por cinemática inversa (alvos no espaço do grupo) */
    raiz.updateMatrix();
    quadril.updateMatrix();
    barriga.updateMatrix();
    peito.updateMatrix();
    mPeito.copy(raiz.matrix).multiply(quadril.matrix).multiply(barriga.matrix).multiply(peito.matrix);
    mPeitoInv.copy(mPeito).invert();
    // o presente: acima da cabeça, sem herdar o esticar e achatar do pulo
    presenteRoot.set(raiz.position.x, raiz.position.y + modelo.presente.y * escBase, modelo.presente.z * escBase);
    giftAnchor.position.copy(presenteRoot);
    for (const l of ladoBraco) {
      const s = l.s;
      // ombros sobem ao erguer os braços (dá alcance e expressão)
      ossos[l.braco].position.y += 0.035 * hold + 0.02 * joy;
      // parado: mãos na lateral da barriga; andando: balançam em contrafase
      const balanco = Math.sin(ph) * s * 0.1 * w;
      alvoE.copy(info.maoRepouso);
      alvoE.x *= s;
      alvoE.z += -balanco + parado * 0.01 * Math.sin(tt * 0.9 + s);
      alvoE.y += parado * 0.006 * resp + w * 0.01;
      alvoE.applyMatrix4(raiz.matrix);
      poloE.set(s * 0.45, 0, -1);
      // alegria: braços em V, mãos sacudindo
      alvoTmp.set(s * (p.ombroX + info.alcance * 0.72), p.ombroY + info.alcance * 1.0, 0.07 + 0.03 * Math.sin(t * 8 + s));
      alvoTmp.x += 0.025 * Math.sin(t * 11 + s * 2);
      alvoTmp.applyMatrix4(raiz.matrix);
      poloTmp.set(s, -0.4, -0.3);
      const a = joy * (1 - hold);
      alvoE.lerp(alvoTmp, a);
      poloE.lerp(poloTmp, a);
      // segurando: mãos nos lados do presente, um pouco abaixo do meio
      alvoTmp.set(presenteRoot.x + s * 0.235 * escBase, presenteRoot.y - 0.06 * escBase, presenteRoot.z + 0.01);
      poloTmp.set(s, -0.6, -0.25);
      alvoE.lerp(alvoTmp, hold);
      poloE.lerp(poloTmp, hold);
      ik(l, alvoE, poloE, 1 + 0.4 * hold + 0.1 * joy);
      // mãos: segurando, dedos para cima e palmas para dentro; na alegria, abertas para a frente
      vDedos.set(-s * 0.32, 1, 0.1);
      vCostas.set(s, 0.2, -0.1);
      orientarMao(l, vDedos, vCostas, qHold);
      vDedos.set(s * 0.35, 1, 0.15);
      vCostas.set(s * 0.2, 0.1, -1);
      orientarMao(l, vDedos, vCostas, qJoy);
      qLocal.copy(qIdent).slerp(qJoy, a).slerp(qHold, hold);
      ossos[l.mao].quaternion.copy(qLocal);
      // dedos: curvados em volta da caixa ao segurar, abertos na alegria, relaxados no resto
      const curl = 0.35 * (1 - cima) + 1.0 * hold - 0.25 * a + 0.1 * w * Math.sin(ph + s);
      ossos[l.dedos].rotation.set(0, 0, -s * curl);
    }

    /* molas: gorro, barba, tranças, cachecol */
    root.updateWorldMatrix(true, false);
    raiz.updateMatrixWorld(true);
    const pos = tmpV.setFromMatrixPosition(ossos[O.G1].matrixWorld);
    if (dt > 0 && quadros > 1) {
      const vel = tmpV2.subVectors(pos, posAnt).divideScalar(dt);
      acel.subVectors(vel, velAnt).divideScalar(dt);
      velAnt.copy(vel);
      // passa a aceleração e a gravidade para o espaço da cabeça
      ossos[O.G0].getWorldQuaternion(wq);
      wq.invert();
      acel.applyQuaternion(wq);
      if (acel.length() > 30) acel.setLength(30);
      gl.set(0, -1, 0).applyQuaternion(wq);
    } else {
      if (dt > 0 && quadros > 0) velAnt.subVectors(pos, posAnt).divideScalar(dt);
      acel.set(0, 0, 0);
      gl.set(0, -1, 0);
    }
    posAnt.copy(pos);
    quadros++;
    if (dt > 0) {
      const kA = 0.012;
      const brisa = parado * 0.035 * Math.sin(tt * 1.3) + 0.02 * Math.sin(tt * 2.1 + 1);
      // a gravidade puxa o gorro quando a cabeça inclina; o pulo e a passada o chicoteiam; a corrente
      // propaga o movimento até a ponta (cada mola persegue a anterior)
      const gx = gl.z * 0.55 - acel.z * kA;
      const gz = -gl.x * 0.55 + acel.x * kA + brisa;
      const chicote = acel.y * 0.03;
      // segurando o presente: o gorro dobra para trás, amassado sob a caixa
      const dobra = [-0.28, -0.66, -0.6, -0.4, -0.25];
      let ax = gx;
      let az = gz;
      for (let i = 0; i < molasG.length; i++) {
        const ponta = i / (molasG.length - 1);
        const mx = ax + curva.z * chicote * ponta;
        const mz = az - curva.x * chicote * ponta;
        molasG[i].passo(dt, mx, mz);
        ossos[ossosG[i]].rotation.set(molasG[i].x * pesoG[i] + dobra[i] * hold, 0, molasG[i].z * pesoG[i]);
        ax = molasG[i].x * 1.1;
        az = molasG[i].z * 1.1;
      }
      // pompom ou sino: pêndulo próprio na ponta
      molaPompom.passo(dt, gl.z * 0.4 - acel.z * 0.02, -gl.x * 0.4 + acel.x * 0.02);
      ossos[O.G5].rotation.x += molaPompom.x * 0.25;
      ossos[O.G5].rotation.z += molaPompom.z * 0.25;
      // o que pende (barba, tranças, ponta do cachecol) é puxado pela gravidade no sentido oposto ao do gorro
      molaBarba.passo(dt, limitar(acel.z * 0.007 - acel.y * 0.004 - gl.z * 0.85, -0.2, 0.7), limitar(-acel.x * 0.006 + gl.x * 0.85, -0.4, 0.4));
      ossos[O.BARBA0].rotation.set(molaBarba.x * 0.55, 0, molaBarba.z * 0.5);
      ossos[O.BARBA1].rotation.set(molaBarba.x * 0.6, 0, molaBarba.z * 0.6);
      ossos[O.BIGODE].rotation.set(molaBarba.x * 0.12 - abre * 0.05, 0, molaBarba.z * 0.1);
      molaTranca.passo(dt, limitar(acel.z * 0.008 - gl.z * 0.8, -0.3, 0.7), limitar(-acel.x * 0.008 + gl.x * 0.8, -0.5, 0.5));
      ossos[O.TRANCA_E].rotation.set(molaTranca.x, 0, molaTranca.z);
      ossos[O.TRANCA_D].rotation.set(molaTranca.x, 0, molaTranca.z);
      molaCachecol.passo(dt, limitar(acel.z * 0.008 - gl.z * 0.6, -0.4, 0.5), limitar(-acel.x * 0.008 + gl.x * 0.6, -0.5, 0.5));
      ossos[O.CACHECOL].rotation.set(molaCachecol.x, 0, molaCachecol.z);
    } else {
      // primeira pose (sem tempo): o gorro já dobrado se estiver segurando
      const dobra = [-0.28, -0.66, -0.6, -0.4, -0.25];
      for (let i = 0; i < ossosG.length; i++) ossos[ossosG[i]].rotation.set(dobra[i] * hold, 0, 0);
    }

    /* etiqueta: acompanha a cabeça em posição (sem o balanço de inclinação) */
    ossos[O.CABECA].updateMatrixWorld(true);
    tmpV.setFromMatrixPosition(ossos[O.CABECA].matrixWorld);
    root.worldToLocal(tmpV);
    labelAnchor.position.set(tmpV.x, tmpV.y + etiquetaSobe, tmpV.z);
  }

  let altura = modelo.altura * escBase;
  const rig: GnomoMontado = {
    root,
    pose,
    labelAnchor,
    giftAnchor,
    get height() {
      return altura;
    },
    set height(v: number) {
      altura = v;
    },
    update,
    trocarMalhas(g, ms) {
      criarMalhas(g, ms);
    },
    dispose() {
      for (const m of malhas) root.remove(m);
      malhas = [];
      esqueleto.dispose();
      aoSoltar();
    },
  };
  // pose inicial já resolvida (sem esperar o primeiro quadro)
  update(0, 0);
  return rig;
}
