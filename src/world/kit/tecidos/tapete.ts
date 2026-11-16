/**
 * Tapete grande de lã, redondo ou retangular, com espessura, borda arrematada e franja.
 * O desenho é ORIGINAL e feito por código, nó a nó: campo vinho com florzinhas miúdas, medalhão
 * central de oito gomos, cantoneiras, barra larga verde com losangos em degraus e filetes dourados
 * e creme. Cada nó tem sua pequena variação de cor e o fio muda de tom em faixas (o "abrash" dos
 * tapetes feitos à mão). Por cima, o relevo e a rugosidade de um tapete real (dirty_carpet, Poly Haven).
 * A malha ondula de leve e as bordas não são retas.
 *
 * A peça nasce centrada na origem, apoiada em y = 0. No retangular, `largura` corre em X e
 * `comprimento` em Z, com a franja de feixes amarrados nas duas cabeceiras (z = ±comprimento/2). No
 * redondo, `largura` é o diâmetro e a borda é arrematada por um cordão de lã (sem franja).
 */
import * as THREE from 'three';
import { loadTexture } from '../../../engine/assets';
import type { KitContext, Peca } from '../tipos';
import { acaso2, criarSorteio, entre, fbm2, limitar, ruido2 } from '../janela/util';

export interface TapeteOpcoes {
  forma: 'redondo' | 'retangular';
  /** Largura (X) do retangular ou diâmetro do redondo, em metros. */
  largura: number;
  /** Comprimento (Z) do retangular. Padrão: 1,4 x a largura. */
  comprimento?: number;
  semente?: number;
  /** Franja nas cabeceiras. Padrão: só no retangular (o redondo tem a borda arrematada por um cordão). */
  franja?: boolean;
}

type RGB = [number, number, number];
const hex = (h: string): RGB => {
  const c = new THREE.Color(h); // já em linear; voltamos para sRGB na hora de escrever o pixel
  return [c.r, c.g, c.b];
};
// paleta do briefing, envelhecida e fosca (lã tingida, não tinta): o campo é escuro e os claros são só filetes
const VINHO = hex('#5c1921');
const VINHO_ESC = hex('#451218');
const VINHO_CLARO = hex('#72252c');
const VERDE = hex('#1d3e32');
const VERDE_CLARO = hex('#2f5746');
const OURO = hex('#a07f47');
const CREME = hex('#b7a886');
const ESCURO = hex('#26110f');

const NO = 0.0028; // tamanho de um nó, em metros (cerca de um texel da textura de 1024)
const FIO = 0.0065; // filete fino (um nó e meio)
const FIM_BARRA = 0.345; // onde termina a barra e começa o campo, medido da beira

/** Losango em degraus (motivo da barra). s ao longo da barra, d atravessado, em metros a partir do centro do motivo. */
function losango(s: number, d: number, raio: number): RGB | null {
  const m = Math.abs(s) * 0.85 + Math.abs(d);
  if (m > raio) return null;
  if (m > raio - FIO) return OURO;
  if (m > raio * 0.6) return VINHO;
  if (m > raio * 0.6 - FIO) return ESCURO;
  if (m > raio * 0.24) return VINHO_ESC;
  return CREME;
}

/** Barra e filetes, de fora para dentro. Devolve null quando o ponto já está no campo. */
function barra(borda: number, ao: number, passo: number): RGB | null {
  if (borda < 0.018) return ESCURO; // arremate
  if (borda < 0.018 + FIO * 1.6) return OURO;
  if (borda < 0.04) return ESCURO;
  if (borda < 0.086) {
    // barrinha de fora: contas douradas e pontos creme, tom sobre tom
    const d = borda - 0.063;
    const f = ao / (passo / 4);
    const s = (f - Math.floor(f) - 0.5) * (passo / 4);
    if (Math.abs(s) + Math.abs(d) < 0.0095) return Math.floor(f) % 2 === 0 ? OURO : VINHO_CLARO;
    return VINHO_ESC;
  }
  if (borda < 0.096) return ESCURO;
  if (borda < 0.096 + FIO) return CREME;
  if (borda < 0.114) return ESCURO;
  if (borda < 0.292) {
    // barra principal verde: losangos em degraus ligados por uma rama ondulada, tom sobre tom
    const d = borda - 0.203;
    const fase = ao / passo;
    const s = (fase - Math.floor(fase) - 0.5) * passo;
    const l = losango(s, d, 0.05);
    if (l) return l;
    const rama = 0.05 * Math.cos((2 * Math.PI * ao) / passo);
    if (Math.abs(d - rama) < FIO * 0.75) return VERDE_CLARO;
    // folhinhas saindo da rama e um botão dourado a meio caminho entre dois losangos
    const s2 = (fase + 0.5 - Math.floor(fase + 0.5) - 0.5) * passo;
    if (Math.abs(s2) + Math.abs(d + 0.05) * 1.2 < 0.013) return OURO;
    const folha = Math.abs(Math.abs(s2) - 0.045) * 1.3 + Math.abs(d + 0.012);
    if (folha < 0.017) return VERDE_CLARO;
    if (Math.abs(Math.abs(d) - 0.079) < FIO * 0.6) return Math.floor(ao / (NO * 3)) % 2 === 0 ? VERDE_CLARO : VERDE;
    return VERDE;
  }
  if (borda < 0.302) return ESCURO;
  if (borda < 0.302 + FIO) return CREME;
  if (borda < 0.32) return ESCURO;
  if (borda < 0.32 + FIO * 1.4) return OURO;
  if (borda < FIM_BARRA) return ESCURO;
  return null;
}

/** Medalhão de oito gomos. rr e ang em coordenadas polares; R é o raio do medalhão. null fora dele. */
function medalhao(rr: number, ang: number, R: number): RGB | null {
  const gomo = 1 + 0.07 * Math.cos(8 * ang) + 0.012 * Math.cos(24 * ang);
  const t = rr / (R * gomo);
  if (t > 1.07) return null;
  const fio = FIO / R; // filete em unidades do raio
  if (t > 1.07 - fio * 1.5) return ESCURO;
  if (t > 1) return VINHO_ESC;
  if (t > 1 - fio * 1.3) return OURO;
  if (t > 0.94) return ESCURO;
  if (t > 0.94 - fio) return CREME;
  if (t > 0.62) {
    // coroa verde: oito pétalas vinho com contorno dourado, botões entre elas
    const setor = (((ang / (Math.PI / 4)) % 1) + 1) % 1 - 0.5; // -0,5 a 0,5 dentro do gomo
    const tt = (t - 0.775) / 0.15; // -1 a 1 na coroa
    const petala = Math.abs(setor) * 3.3 * (1 + 0.5 * Math.max(0, tt)) + tt * tt * 0.72; // gota: larga embaixo, afinando para fora
    if (petala < 0.46) return VINHO_CLARO;
    if (petala < 0.46 + fio * 5.5) return OURO;
    const botao = Math.hypot((Math.abs(setor) - 0.5) * 2.6, tt + 0.25);
    if (botao < 0.2) return VERDE_CLARO;
    return VERDE;
  }
  if (t > 0.62 - fio * 1.3) return OURO;
  if (t > 0.565) return ESCURO;
  if (t > 0.3) {
    // anel vinho escuro com dezesseis losanguinhos alternando ouro e creme
    const f = ((ang / (Math.PI / 8)) % 1 + 1) % 1 - 0.5;
    const par = Math.floor(ang / (Math.PI / 8) + 64) % 2 === 0;
    const m = Math.abs(f) * 1.5 + Math.abs(t - 0.43) * 5.2;
    if (m < 0.42) return par ? OURO : CREME;
    if (m < 0.42 + fio * 6) return ESCURO;
    return VINHO_ESC;
  }
  if (t > 0.3 - fio * 1.3) return OURO;
  // miolo verde com estrela de oito pontas
  const ponta = 0.15 + 0.085 * Math.pow(Math.abs(Math.cos(4 * ang)), 1.6);
  if (t < 0.05) return CREME;
  if (t < 0.05 + fio * 1.2) return ESCURO;
  if (t < ponta) return VINHO;
  if (t < ponta + fio * 1.4) return OURO;
  return VERDE;
}

/** Campo vinho com treliça em losangos, tom sobre tom, e um pontinho dourado em cada cruzamento. */
function campo(x: number, z: number): RGB {
  const passo = 0.19;
  const a = (x + z) / passo;
  const b = (x - z) / passo;
  const fa = Math.abs(a - Math.round(a)) * passo;
  const fb = Math.abs(b - Math.round(b)) * passo;
  if (fa < 0.008 && fb < 0.008) return OURO;
  if (fa < FIO * 0.62 || fb < FIO * 0.62) return VINHO_ESC;
  // florzinha clara no meio de cada losango
  const ca = (a - Math.floor(a) - 0.5) * passo;
  const cb = (b - Math.floor(b) - 0.5) * passo;
  const m = Math.abs(ca) + Math.abs(cb);
  if (m < 0.008) return VINHO_ESC;
  if (m < 0.022 && (Math.abs(ca) < 0.005 || Math.abs(cb) < 0.005)) return VINHO_CLARO;
  return VINHO;
}

/**
 * Cor do desenho em um ponto. `borda` é a distância até a beira do tapete; `ao` é a posição ao longo
 * da beira (para repetir os motivos da barra); (x, z) a posição em metros a partir do centro.
 */
function desenho(x: number, z: number, borda: number, ao: number, passoBarra: number, meiaX: number, meiaZ: number, redondo: boolean): RGB {
  const b = barra(borda, ao, passoBarra);
  if (b) return b;
  const cx = meiaX - FIM_BARRA;
  const cz = meiaZ - FIM_BARRA;
  const escala = Math.min(cx, cz);
  // medalhão central (no retangular, alongado no sentido do comprimento)
  const alonga = redondo ? 1 : Math.min(1.3, cz / cx);
  const R = escala * (redondo ? 0.47 : 0.6);
  const m = medalhao(Math.hypot(x, z / alonga), Math.atan2(z / alonga, x), R);
  if (m) return m;
  if (!redondo) {
    // pendentes: duas pontas saindo do medalhão ao longo do comprimento
    const pz = Math.abs(z) - R * alonga * 1.07;
    if (pz > 0 && pz < 0.19) {
      const meia = (0.19 - pz) * 0.42;
      if (Math.abs(x) < meia - FIO * 1.2) return pz < 0.1 ? VERDE : VINHO_CLARO;
      if (Math.abs(x) < meia) return OURO;
      if (Math.abs(x) < meia + FIO) return ESCURO;
    }
    // cantoneiras: um quarto de medalhão simplificado em cada canto do campo
    const dx = cx - Math.abs(x);
    const dz = cz - Math.abs(z);
    const dc = Math.hypot(dx, dz);
    const angC = Math.atan2(dz, dx);
    const Rc = escala * 0.52 * (1 + 0.06 * Math.cos(8 * angC));
    if (dc < Rc + FIO * 1.5) {
      if (dc > Rc) return ESCURO;
      if (dc > Rc - FIO * 1.3) return OURO;
      if (dc > Rc * 0.9) return ESCURO;
      if (dc > Rc * 0.9 - FIO) return CREME;
      if (dc > Rc * 0.52) {
        const f = ((angC / (Math.PI / 8)) % 1 + 1) % 1 - 0.5;
        if (Math.abs(f) * 1.6 + Math.abs(dc / Rc - 0.71) * 5 < 0.42) return VINHO_CLARO;
        return VERDE;
      }
      if (dc > Rc * 0.52 - FIO * 1.3) return OURO;
      return VINHO_ESC;
    }
  } else {
    // no redondo, uma grinalda de arcos junto à barra, tom sobre tom
    const dcampo = borda - FIM_BARRA;
    const ang = Math.atan2(z, x);
    const onda = 0.05 + 0.032 * Math.abs(Math.cos(12 * ang));
    if (dcampo < onda) return VINHO_ESC;
    if (dcampo < onda + FIO * 1.2) return OURO;
    if (dcampo < onda + FIO * 2.6) return ESCURO;
  }
  return campo(x, z);
}

function pintarDesenho(largura: number, comprimento: number, redondo: boolean, semente: number, lado: number): THREE.CanvasTexture {
  const maior = Math.max(largura, comprimento);
  const W = Math.min(lado, Math.pow(2, Math.round(Math.log2((largura / maior) * lado))));
  const Hh = Math.min(lado, Math.pow(2, Math.round(Math.log2((comprimento / maior) * lado))));
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = Hh;
  const c = canvas.getContext('2d')!;
  const img = c.createImageData(W, Hh);
  const meiaX = largura / 2;
  const meiaZ = comprimento / 2;
  const raio = largura / 2;
  // a barra repete um número inteiro de motivos em cada lado (ou na volta toda, no redondo)
  const meioBarra = 0.203;
  const voltaRedonda = 2 * Math.PI * (raio - meioBarra);
  const nRedondo = Math.max(8, Math.round(voltaRedonda / 0.27 / 8) * 8);
  const passoX = (largura - 2 * meioBarra) / Math.max(2, Math.round((largura - 2 * meioBarra) / 0.27));
  const passoZ = (comprimento - 2 * meioBarra) / Math.max(2, Math.round((comprimento - 2 * meioBarra) / 0.27));
  const paraSrgb = (v: number) => Math.round(255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055));
  for (let py = 0; py < Hh; py++) {
    for (let px = 0; px < W; px++) {
      // posição em metros, quantizada no nó (é o que dá o serrilhado de tecelagem nas curvas)
      const xm = ((px + 0.5) / W - 0.5) * largura;
      const zm = ((py + 0.5) / Hh - 0.5) * comprimento;
      const ix = Math.round(xm / NO);
      const iz = Math.round(zm / NO);
      const x = ix * NO;
      const z = iz * NO;
      let cor: RGB;
      if (redondo) {
        const rr = Math.hypot(x, z);
        const ang = Math.atan2(z, x);
        const borda = raio - rr;
        cor = borda < 0 ? ESCURO : desenho(x, z, borda, ((ang + Math.PI) / (2 * Math.PI)) * voltaRedonda, voltaRedonda / nRedondo, raio, raio, true);
      } else {
        const bx = meiaX - Math.abs(x);
        const bz = meiaZ - Math.abs(z);
        const borda = Math.min(bx, bz);
        // ao longo da beira mais próxima, medido a partir do centro para os motivos ficarem simétricos
        const ao = bx < bz ? z + passoZ * 0.5 + 1000 * passoZ : x + passoX * 0.5 + 1000 * passoX;
        cor = desenho(x, z, borda, ao, bx < bz ? passoZ : passoX, meiaX, meiaZ, false);
      }
      // irregularidade de tecelagem: faixas de tom ao longo da trama, manchas de desgaste e variação por nó
      const faixa = 1 + 0.07 * ruido2(iz * 0.024, 3.3, semente) + 0.035 * ruido2(iz * 0.11, 7.7, semente + 1);
      const mancha = 1 + 0.07 * fbm2(x * 1.3, z * 1.3, 3, semente + 2);
      const no = 0.94 + 0.12 * acaso2(ix, iz, semente + 3);
      const gasto = 1 + 0.06 * Math.exp(-(x * x + z * z) / (0.5 * maior * 0.5 * maior) * 3); // o meio, mais pisado, desbota um pouco
      // sombra fina entre os nós (o pixel cai na beira do nó)
      const fx = Math.abs(xm / NO - ix);
      const fz = Math.abs(zm / NO - iz);
      const entreNos = 1 - 0.06 * Math.max(0, Math.max(fx, fz) - 0.3) * 5;
      const f = faixa * mancha * no * gasto * entreNos;
      const i = (py * W + px) * 4;
      img.data[i] = paraSrgb(limitar(cor[0] * f, 0, 1));
      img.data[i + 1] = paraSrgb(limitar(cor[1] * f * (0.985 + 0.03 * acaso2(ix, iz, semente + 5)), 0, 1));
      img.data[i + 2] = paraSrgb(limitar(cor[2] * f, 0, 1));
      img.data[i + 3] = 255;
    }
  }
  c.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Textura da franja: 4 feixes (atlas 4 x 1), cada um com o nó no alto (v = 1) e 6 a 10 fios abrindo em
 * leque até a ponta, sobre transparente (o material corta por alphaTest).
 */
function texturaFranja(semente: number): THREE.CanvasTexture {
  const L = 128;
  const canvas = document.createElement('canvas');
  canvas.width = L * 4;
  canvas.height = L;
  const c = canvas.getContext('2d')!;
  const r = criarSorteio(semente * 71 + 9);
  c.lineCap = 'round';
  for (let v = 0; v < 4; v++) {
    const ox = v * L + L / 2;
    const fios = 6 + Math.floor(r() * 5);
    for (let i = 0; i < fios; i++) {
      const sai = ((i + 0.5) / fios - 0.5) * 10;
      const abre = ((i + 0.5) / fios - 0.5) * entre(r, 34, 58) + entre(r, -6, 6);
      const comp = entre(r, 0.78, 0.98) * (L - 22);
      const curva = entre(r, -5, 5);
      const claro = Math.round(entre(r, 200, 250));
      c.strokeStyle = `rgb(${claro},${claro - 4},${claro - 14})`;
      c.lineWidth = entre(r, 4.2, 6);
      c.beginPath();
      for (let s = 0; s <= 10; s++) {
        const t = s / 10;
        const x = ox + sai + abre * Math.pow(t, 0.8) + curva * Math.sin(t * Math.PI);
        const y = 16 + comp * t;
        if (s === 0) c.moveTo(x, y);
        else c.lineTo(x, y);
      }
      c.stroke();
      // fiapos soltos na ponta
      c.lineWidth = 1.6;
      c.beginPath();
      const xp = ox + sai + abre + curva * 0;
      c.moveTo(xp, 16 + comp);
      c.lineTo(xp + entre(r, -5, 5), 16 + comp + entre(r, 3, 6));
      c.stroke();
    }
    // nó: bolota apertada com as voltas do fio
    c.fillStyle = 'rgb(214,206,186)';
    c.beginPath();
    c.ellipse(ox, 13, 13, 11, 0, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = 'rgb(160,150,128)';
    c.lineWidth = 2;
    for (let k = -1; k <= 1; k++) {
      c.beginPath();
      c.moveTo(ox - 11, 13 + k * 5);
      c.quadraticCurveTo(ox, 13 + k * 5 + 3, ox + 11, 13 + k * 5);
      c.stroke();
    }
    // a parte de cima (escondida sob a beira) é cheia
    c.fillStyle = 'rgb(206,198,178)';
    c.fillRect(ox - 9, 0, 18, 10);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

let texCordaoTapete: THREE.CanvasTexture | null = null;
/** Fio enrolado em diagonal (o cordão que arremata a borda do tapete redondo). */
function texturaCordaoTapete(): THREE.CanvasTexture {
  if (texCordaoTapete) return texCordaoTapete;
  const n = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = n;
  const c = canvas.getContext('2d')!;
  const img = c.createImageData(n, n);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const u = x / n;
      const v = y / n;
      const volta = 0.5 + 0.5 * Math.cos(Math.PI * 2 * (u * 2 + v)); // duas voltas por ladrilho
      const fio = 0.92 + 0.08 * Math.cos(Math.PI * 2 * (u * 14 - v * 5));
      const b = Math.round(255 * (0.45 + 0.55 * Math.pow(volta, 0.5)) * fio);
      const i = (y * n + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = b;
      img.data[i + 3] = 255;
    }
  c.putImageData(img, 0, 0);
  texCordaoTapete = new THREE.CanvasTexture(canvas);
  texCordaoTapete.colorSpace = THREE.SRGBColorSpace;
  texCordaoTapete.wrapS = texCordaoTapete.wrapT = THREE.RepeatWrapping;
  texCordaoTapete.anisotropy = 4;
  return texCordaoTapete;
}

export async function criarTapete(ctx: KitContext, o: TapeteOpcoes): Promise<Peca> {
  const redondo = o.forma === 'redondo';
  const largura = o.largura;
  const comprimento = redondo ? largura : (o.comprimento ?? largura * 1.4);
  const semente = o.semente ?? 1;
  const r = criarSorteio(semente * 613 + 29);
  const ESP = 0.014; // espessura do tapete
  const meiaX = largura / 2;
  const meiaZ = comprimento / 2;

  /** Deformação suave: bordas que não são retas, cantos fora do esquadro e ondulação do pano no piso. */
  const torto = (x: number, z: number): [number, number, number] => {
    const dx = 0.014 * fbm2(x * 0.7 + 3, z * 0.7, 2, semente) + 0.004 * z * (r0 - 0.5) * (x / meiaX);
    const dz = 0.014 * fbm2(x * 0.7, z * 0.7 + 9, 2, semente + 1) + 0.004 * x * (r1 - 0.5) * (z / meiaZ);
    // ondulação baixa e uma ruga comprida perto de uma das beiras
    const cx = x * Math.cos(angRuga) + z * Math.sin(angRuga) - posRuga;
    const ruga = 0.007 * Math.exp(-Math.pow(cx / 0.12, 2)) * (0.5 + 0.5 * fbm2(x * 0.9, z * 0.9, 2, semente + 6));
    // a beira levanta em dois pontos (onda de 4 a 8 mm, 30 a 50 cm de comprimento), como tapete pisado
    const borda = redondo ? meiaX - Math.hypot(x, z) : Math.min(meiaX - Math.abs(x), meiaZ - Math.abs(z));
    let onda = 0;
    for (const [ox, oz, h, w] of ondasBeira) onda += h * Math.exp(-((x - ox) * (x - ox) + (z - oz) * (z - oz)) / (w * w));
    onda *= Math.exp(-Math.max(0, borda) / 0.14);
    const y = 0.003 * (0.5 + 0.5 * fbm2(x * 1.6, z * 1.6, 2, semente + 4)) + ruga + onda;
    return [x + dx, y, z + dz];
  };
  const r0 = r();
  const r1 = r();
  const angRuga = entre(r, 0.2, 1.2);
  const posRuga = entre(r, 0.25, 0.4) * Math.min(meiaX, meiaZ) * (r() < 0.5 ? -1 : 1) * 2;
  const ondasBeira: Array<[number, number, number, number]> = [];
  for (let k = 0; k < 2; k++) {
    // um ponto da beira (no retangular, só nas laterais compridas ou nas cabeceiras, sorteado)
    const ang = r() * Math.PI * 2;
    let ox = Math.cos(ang) * meiaX;
    let oz = Math.sin(ang) * meiaZ;
    if (!redondo) {
      if (r() < 0.5) ox = Math.sign(ox) * meiaX;
      else oz = Math.sign(oz) * meiaZ;
    }
    ondasBeira.push([ox, oz, entre(r, 0.004, 0.008), entre(r, 0.15, 0.25)]);
  }

  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  // degraus da borda arrematada: (avanço para fora, fração da espessura)
  const saia: Array<[number, number]> = [
    [0, 1],
    [0.004, 0.86],
    [0.007, 0.5],
    [0.008, 0.0],
  ];
  /** Vértices da beira (onde nasce a franja): posição no piso e direção para fora. */
  const beira: Array<{ p: THREE.Vector3; n: THREE.Vector3; franja: boolean }> = [];

  if (redondo) {
    const raio = largura / 2;
    const seg = 112;
    const aneis = 22;
    pos.push(...torto(0, 0).map((v, i) => (i === 1 ? v + ESP : v)));
    uv.push(0.5, 0.5);
    const linhas = aneis + saia.length - 1;
    for (let a = 1; a <= linhas; a++) {
      const k = a - aneis; // 0 na quina do tampo; depois os degraus da saia
      for (let s = 0; s < seg; s++) {
        const ang = (s / seg) * Math.PI * 2;
        const rr = a <= aneis ? (raio * a) / aneis : raio;
        const fora = k > 0 ? saia[k][0] : 0;
        const alt = k > 0 ? saia[k][1] : 1;
        const [x, y, z] = torto(Math.cos(ang) * rr, Math.sin(ang) * rr);
        const px = x + Math.cos(ang) * fora;
        const pz = z + Math.sin(ang) * fora;
        pos.push(px, (y + ESP) * alt, pz);
        const ru = Math.min(rr, raio - 0.004) / raio;
        uv.push(0.5 + 0.5 * Math.cos(ang) * ru, 0.5 - 0.5 * Math.sin(ang) * ru);
        if (a === linhas) beira.push({ p: new THREE.Vector3(px, 0, pz), n: new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang)), franja: true });
      }
    }
    for (let s = 0; s < seg; s++) idx.push(0, 1 + ((s + 1) % seg), 1 + s);
    for (let a = 1; a < linhas; a++) {
      for (let s = 0; s < seg; s++) {
        const p = 1 + (a - 1) * seg + s;
        const q = 1 + (a - 1) * seg + ((s + 1) % seg);
        idx.push(p, q, p + seg, q, q + seg, p + seg);
      }
    }
  } else {
    const nx = Math.max(16, Math.round(largura / 0.07));
    const nz = Math.max(16, Math.round(comprimento / 0.07));
    const extra = saia.length - 1;
    const colunas = nx + 1 + 2 * extra;
    const linhas = nz + 1 + 2 * extra;
    const indice = (i: number, j: number) => j * colunas + i;
    for (let j = 0; j < linhas; j++) {
      for (let i = 0; i < colunas; i++) {
        // índice dentro do tampo e degrau da saia em cada direção
        const ii = limitar(i - extra, 0, nx);
        const jj = limitar(j - extra, 0, nz);
        const ki = i < extra ? extra - i : i > nx + extra ? i - nx - extra : 0;
        const kj = j < extra ? extra - j : j > nz + extra ? j - nz - extra : 0;
        const k = Math.max(ki, kj);
        const x0 = -meiaX + (largura * ii) / nx;
        const z0 = -meiaZ + (comprimento * jj) / nz;
        const [x, y, z] = torto(x0, z0);
        const sx = i < extra ? -1 : i > nx + extra ? 1 : 0;
        const sz = j < extra ? -1 : j > nz + extra ? 1 : 0;
        const comp = Math.hypot(sx * saia[ki][0], sz * saia[kj][0]) || 1;
        const fora = saia[k][0];
        const px = x + ((sx * saia[ki][0]) / comp) * fora;
        const pz = z + ((sz * saia[kj][0]) / comp) * fora;
        pos.push(px, (y + ESP) * saia[k][1], pz);
        uv.push(limitar((x0 + meiaX) / largura, 0.003, 0.997), 1 - limitar((z0 + meiaZ) / comprimento, 0.003, 0.997));
        if ((j === 0 || j === linhas - 1) && i >= extra && i <= nx + extra) beira.push({ p: new THREE.Vector3(px, 0, pz), n: new THREE.Vector3(0, 0, j === 0 ? -1 : 1), franja: true });
      }
    }
    for (let j = 0; j < linhas - 1; j++) {
      for (let i = 0; i < colunas - 1; i++) {
        const a = indice(i, j);
        const b = indice(i + 1, j);
        const c2 = indice(i, j + 1);
        const d = indice(i + 1, j + 1);
        idx.push(a, c2, b, b, c2, d);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();

  const [normal, arm] = await Promise.all([loadTexture('assets/texturas/dirty_carpet/nor.jpg'), loadTexture('assets/texturas/dirty_carpet/arm.jpg')]);
  const ladrilho = 0.34; // o ladrilho real mede 0,6 m; menor deixa o pelo fino como lã de tapete
  for (const t of [normal, arm]) {
    t.repeat.set(largura / ladrilho, comprimento / ladrilho);
    t.needsUpdate = true;
  }
  const desenhoTex = pintarDesenho(largura, comprimento, redondo, semente, ctx.level === 'baixa' ? 512 : 1024);
  const mat = new THREE.MeshPhysicalMaterial({
    map: desenhoTex,
    normalMap: normal,
    roughnessMap: arm,
    aoMap: arm,
    aoMapIntensity: 0.9,
    roughness: 1,
    metalness: 0,
    sheen: 0.1,
    sheenColor: new THREE.Color('#e8c9a8'),
    sheenRoughness: 0.7,
    envMapIntensity: 0.35,
    name: 'tapete-la',
  });
  mat.normalScale.set(0.85, 0.85);
  const root = new THREE.Group();
  root.name = 'tapete';
  const malha = new THREE.Mesh(geo, mat);
  malha.name = 'tapete-la';
  malha.receiveShadow = true;
  malha.castShadow = false;
  root.add(malha);
  const lixo: Array<{ dispose(): void }> = [geo, mat, desenhoTex, normal, arm];

  // redondo: cordão de arremate em volta da beira, de lã vinho escura enrolada em diagonal
  if (redondo) {
    const raio = largura / 2;
    const seg = 240;
    const lados = 8;
    const rc = 0.0072;
    const cp: number[] = [];
    const cu: number[] = [];
    const ci: number[] = [];
    let arco = 0;
    let anterior: THREE.Vector3 | null = null;
    for (let s2 = 0; s2 <= seg; s2++) {
      const ang = (s2 / seg) * Math.PI * 2;
      const [x, y, z] = torto(Math.cos(ang) * raio, Math.sin(ang) * raio);
      const centro = new THREE.Vector3(x + Math.cos(ang) * 0.0045, Math.max(rc * 0.92, (y + ESP) * 0.55), z + Math.sin(ang) * 0.0045);
      if (anterior) arco += centro.distanceTo(anterior);
      anterior = centro;
      const fora = new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang));
      for (let k = 0; k <= lados; k++) {
        const a2 = (k / lados) * Math.PI * 2;
        const rr = rc * (1 + 0.06 * Math.cos(2 * a2 + arco * 900));
        cp.push(centro.x + fora.x * Math.cos(a2) * rr, centro.y + Math.sin(a2) * rr, centro.z + fora.z * Math.cos(a2) * rr);
        cu.push(k / lados, arco / 0.012);
      }
    }
    for (let s2 = 0; s2 < seg; s2++)
      for (let k = 0; k < lados; k++) {
        const a2 = s2 * (lados + 1) + k;
        const b2 = a2 + lados + 1;
        ci.push(a2, a2 + 1, b2, a2 + 1, b2 + 1, b2);
      }
    const cg = new THREE.BufferGeometry();
    cg.setAttribute('position', new THREE.Float32BufferAttribute(cp, 3));
    cg.setAttribute('uv', new THREE.Float32BufferAttribute(cu, 2));
    cg.setIndex(ci);
    cg.computeVertexNormals();
    const cmat = new THREE.MeshStandardMaterial({ color: '#5a1a20', map: texturaCordaoTapete(), roughness: 0.92, metalness: 0, name: 'tapete-cordao' });
    const cordao = new THREE.Mesh(cg, cmat);
    cordao.name = 'tapete-cordao';
    cordao.receiveShadow = true;
    root.add(cordao);
    lixo.push(cg, cmat);
  }

  // franja (cabeceiras do retangular): feixes curtos e densos, um a cada 1,2 cm, com o nó erguido junto
  // à beira e os fios abrindo em leque no piso; 4 variações de feixe, cada um com giro próprio
  if (o.franja ?? !redondo) {
    const fp: number[] = [];
    const fc: number[] = [];
    const fu: number[] = [];
    const fi: number[] = [];
    const passo = 0.012;
    const feixe = (p: THREE.Vector3, n: THREE.Vector3, k: number) => {
      const comp = 0.045 * (0.88 + 0.24 * acaso2(k, semente, 11));
      const giro = (acaso2(k, semente, 12) - 0.5) * 0.42 + 0.12 * ruido2(k * 0.08, 1.5, semente);
      const lado = new THREE.Vector3(-n.z, 0, n.x);
      const dir = n.clone().multiplyScalar(Math.cos(giro)).add(lado.clone().multiplyScalar(Math.sin(giro)));
      const atrav = new THREE.Vector3(-dir.z, 0, dir.x);
      const meia = 0.0085;
      const tom = 0.84 + 0.2 * acaso2(k, semente, 15);
      const variacao = Math.floor(acaso2(k, semente, 17) * 4);
      const base = fp.length / 3;
      const partes = 3;
      for (let s2 = 0; s2 <= partes; s2++) {
        const t = s2 / partes;
        const centro = p
          .clone()
          .addScaledVector(n, -0.006)
          .addScaledVector(dir, comp * t);
        // o nó fica erguido junto à beira; os fios deitam no piso
        const y = 0.0012 + 0.0065 * Math.pow(1 - t, 2.2) + (k % 2) * 0.0004;
        fp.push(centro.x - atrav.x * meia, y, centro.z - atrav.z * meia, centro.x + atrav.x * meia, y, centro.z + atrav.z * meia);
        const c = tom * (0.78 + 0.22 * t);
        fc.push(c, c * 0.97, c * 0.9, c, c * 0.97, c * 0.9);
        fu.push(variacao / 4, 1 - t, (variacao + 1) / 4, 1 - t);
      }
      for (let s2 = 0; s2 < partes; s2++) {
        const a2 = base + s2 * 2;
        fi.push(a2, a2 + 2, a2 + 1, a2 + 1, a2 + 2, a2 + 3);
      }
    };
    let k = 0;
    const fechar = redondo ? beira.length : beira.length - 1;
    for (let b2 = 0; b2 < fechar; b2++) {
      const A = beira[b2];
      const B = beira[(b2 + 1) % beira.length];
      if (!redondo && A.n.z !== B.n.z) continue; // não liga uma cabeceira à outra
      const d = A.p.distanceTo(B.p);
      const n = Math.max(1, Math.round(d / passo));
      for (let s2 = 0; s2 < n; s2++) {
        const t = (s2 + 0.5 + (acaso2(k, 0, semente + 20) - 0.5) * 0.3) / n;
        feixe(A.p.clone().lerp(B.p, t), A.n.clone().lerp(B.n, t).normalize(), k++);
      }
    }
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3));
    fg.setAttribute('color', new THREE.Float32BufferAttribute(fc, 3));
    fg.setAttribute('uv', new THREE.Float32BufferAttribute(fu, 2));
    fg.setIndex(fi);
    fg.computeVertexNormals();
    const fios = texturaFranja(semente);
    const fmat = new THREE.MeshStandardMaterial({ color: '#c2b392', map: fios, roughness: 0.95, metalness: 0, vertexColors: true, alphaTest: 0.5, side: THREE.DoubleSide, name: 'tapete-franja' });
    const franja = new THREE.Mesh(fg, fmat);
    franja.name = 'tapete-franja';
    franja.receiveShadow = true;
    root.add(franja);
    lixo.push(fg, fmat, fios);
  }

  return {
    root,
    update() {},
    setQuality() {},
    dispose() {
      for (const l of lixo) l.dispose();
    },
  };
}
