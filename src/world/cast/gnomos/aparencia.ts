/**
 * Aparência de um gnomo escolhida pela semente: corpo, gorro, barba, roupa e acessórios.
 * A combinação segue regras de figurino (cores que conversam, nada de gorro e suéter da mesma cor
 * lisa, barba coerente com a idade), então qualquer semente dá um personagem bem vestido.
 */
import { criarSorteio, escolher, hashTexto } from './util';

export type TipoCorpo = 'medio' | 'redondo' | 'alto' | 'gnoma' | 'jovem' | 'vovo';
export type FormaGorro = 'mole' | 'pontudo' | 'caido' | 'touca';
export type PadraoGorro = 'liso' | 'listras' | 'jacquard' | 'feltro';
export type PontaGorro = 'pompom' | 'sino' | 'nada';
export type FormaBarba = 'cheia' | 'larga' | 'bifurcada' | 'trancada' | 'curta' | 'nenhuma';
export type FormaBigode = 'morsa' | 'guidao' | 'cheio' | 'nenhum';
export type Rgb = readonly [number, number, number];

/** Medidas do corpo, em metros (pés em y = 0, de frente para +Z). */
export interface Proporcao {
  /** Altura da barra do suéter (ou do vestido). */
  barra: number;
  /** Pivô dos quadris (onde nascem as pernas). */
  quadril: number;
  /** Raio da barriga e altura do ponto mais largo. */
  barriga: number;
  barrigaY: number;
  /** Altura e meia largura dos ombros (pivô dos braços). */
  ombroY: number;
  ombroX: number;
  /** Base do pescoço (pivô da cabeça). */
  pescoco: number;
  /** Centro e raio da cabeça. */
  cabecaY: number;
  cabecaR: number;
  /** Comprimento do braço (ombro ao punho) e da mão. */
  braco: number;
  /** Afastamento das pernas. */
  pernaX: number;
  /** Inclinação do tronco para a frente (corcunda do vovô), em radianos. */
  curvatura: number;
  /** Tamanho da bota (escala). */
  bota: number;
  /** Nariz (escala). */
  nariz: number;
  /** A barra abre como saia (gnoma). */
  saia: boolean;
}

export interface Aparencia {
  chave: string;
  semente: number;
  corpo: TipoCorpo;
  p: Proporcao;
  pele: Rgb;
  iris: number;
  gorro: {
    forma: FormaGorro;
    padrao: PadraoGorro;
    cor: Rgb;
    cor2: Rgb;
    ponta: PontaGorro;
    corPonta: Rgb;
    raminho: boolean;
    /** Lado para onde a ponta cai (+1 ou -1). */
    lado: number;
    comprimento: number;
  };
  barba: { forma: FormaBarba; cor: Rgb; comprimento: number; bigode: FormaBigode };
  cabelo: { trancas: boolean; cor: Rgb; franja: boolean };
  sobrancelha: Rgb;
  roupa: {
    sueter: Rgb;
    sueterMotivo: boolean;
    barra: Rgb;
    calca: Rgb;
    colete: Rgb | null;
    avental: boolean;
    cachecol: { cor: Rgb; cor2: Rgb } | null;
    cinto: boolean;
    luvas: Rgb | null;
    botas: Rgb;
    botoes: boolean;
  };
  lanterna: boolean;
  /** Ritmo próprio: piscadas, respiração, ginga. */
  ritmo: { piscar: number; respirar: number; fase: number; ginga: number };
}

/** Converte #rrggbb (sRGB) para rgb linear. */
export function hex(c: string): Rgb {
  const n = parseInt(c.slice(1), 16);
  const f = (x: number) => {
    const s = x / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return [f((n >> 16) & 255), f((n >> 8) & 255), f(n & 255)];
}

export function misturarRgb(a: Rgb, b: Rgb, t: number): Rgb {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
export function escalarRgb(a: Rgb, k: number): Rgb {
  return [a[0] * k, a[1] * k, a[2] * k];
}

/* ----------------------------------------------------------------------- paleta */

const VERMELHO = hex('#B62835');
const VINHO = hex('#7A1E2A');
const VERDE = hex('#174D3B');
const MUSGO = hex('#3F6A3C');
const DOURADO = hex('#D2A04C');
const CREME = hex('#EDE5D3');
const AZUL = hex('#17253B');
const AZUL_MEDIO = hex('#2D4A73');
const MARROM = hex('#6A4630');
const URZE = hex('#8B837C');
const CARAMELO = hex('#9A6438');

interface CorNomeada {
  nome: string;
  cor: Rgb;
}
const C = (nome: string, cor: Rgb): CorNomeada => ({ nome, cor });

// os gorros escuros sobem de valor (azul-noite e verde-pinheiro claros) para não sumirem no piso escuro da sala
const VERDE_GORRO = hex('#2E6B50');
const AZUL_GORRO = hex('#2D4A73');
const CORES_GORRO: CorNomeada[] = [C('vermelho', VERMELHO), C('verde', VERDE_GORRO), C('creme', CREME), C('azul', AZUL_GORRO), C('vinho', hex('#94283A')), C('vermelho', VERMELHO), C('verde', MUSGO)];
const CORES_SUETER: CorNomeada[] = [C('verde', VERDE), C('vermelho', VERMELHO), C('creme', CREME), C('azul', AZUL_MEDIO), C('dourado', DOURADO), C('urze', URZE), C('vinho', VINHO), C('musgo', MUSGO)];
const CORES_CALCA: Rgb[] = [MARROM, hex('#4A3A30'), hex('#2B3B2E'), AZUL, hex('#5B2A2A'), hex('#5E5850')];
const CORES_COLETE: CorNomeada[] = [C('verde', VERDE), C('vermelho', VINHO), C('marrom', CARAMELO), C('azul', AZUL), C('mostarda', DOURADO)];

const PELES: Rgb[] = [hex('#F0CDB8'), hex('#EAC0A6'), hex('#D9A88A'), hex('#C08E6E'), hex('#9C6A4E'), hex('#76503A'), hex('#E6BFA8')];

const BARBA_VELHA: Rgb[] = [hex('#F4F1EA'), hex('#EEEAE2'), hex('#DAD5CC'), hex('#C9C4BC'), hex('#A9A6A1')];
const BARBA_JOVEM: Rgb[] = [hex('#B4552A'), hex('#C9783A'), hex('#6E4630'), hex('#D9B277'), hex('#8F3E22')];
const CABELO_GNOMA: Rgb[] = [hex('#B4552A'), hex('#D9B277'), hex('#6E4630'), hex('#E6E1D8'), hex('#3B2A20'), hex('#C9783A')];

/* ------------------------------------------------------------------- proporções */

function proporcao(tipo: TipoCorpo, s: () => number): Proporcao {
  const j = (x: number, a = 0.04) => x * (1 + (s() * 2 - 1) * a);
  const base: Record<TipoCorpo, Proporcao> = {
    medio: { barra: 0.15, quadril: 0.2, barriga: 0.235, barrigaY: 0.3, ombroY: 0.55, ombroX: 0.135, pescoco: 0.6, cabecaY: 0.69, cabecaR: 0.135, braco: 0.31, pernaX: 0.075, curvatura: 0, bota: 1, nariz: 1, saia: false },
    redondo: { barra: 0.11, quadril: 0.16, barriga: 0.3, barrigaY: 0.28, ombroY: 0.5, ombroX: 0.14, pescoco: 0.55, cabecaY: 0.645, cabecaR: 0.142, braco: 0.29, pernaX: 0.085, curvatura: 0, bota: 1.08, nariz: 1.12, saia: false },
    alto: { barra: 0.2, quadril: 0.25, barriga: 0.165, barrigaY: 0.38, ombroY: 0.625, ombroX: 0.13, pescoco: 0.67, cabecaY: 0.76, cabecaR: 0.128, braco: 0.33, pernaX: 0.07, curvatura: 0, bota: 0.98, nariz: 1.05, saia: false },
    gnoma: { barra: 0.11, quadril: 0.2, barriga: 0.205, barrigaY: 0.27, ombroY: 0.53, ombroX: 0.125, pescoco: 0.58, cabecaY: 0.668, cabecaR: 0.134, braco: 0.29, pernaX: 0.07, curvatura: 0, bota: 0.9, nariz: 0.78, saia: true },
    jovem: { barra: 0.17, quadril: 0.22, barriga: 0.205, barrigaY: 0.32, ombroY: 0.575, ombroX: 0.135, pescoco: 0.62, cabecaY: 0.708, cabecaR: 0.132, braco: 0.32, pernaX: 0.075, curvatura: 0, bota: 0.96, nariz: 0.88, saia: false },
    vovo: { barra: 0.13, quadril: 0.18, barriga: 0.255, barrigaY: 0.29, ombroY: 0.515, ombroX: 0.135, pescoco: 0.56, cabecaY: 0.645, cabecaR: 0.138, braco: 0.3, pernaX: 0.08, curvatura: 0.24, bota: 1.04, nariz: 1.2, saia: false },
  };
  const b = base[tipo];
  const k = j(1, 0.03); // escala geral pequena
  return {
    ...b,
    barra: b.barra * k,
    quadril: b.quadril * k,
    barriga: j(b.barriga) * k,
    barrigaY: b.barrigaY * k,
    ombroY: b.ombroY * k,
    ombroX: b.ombroX * k,
    pescoco: b.pescoco * k,
    cabecaY: b.cabecaY * k,
    cabecaR: j(b.cabecaR, 0.03) * k,
    braco: b.braco * k,
    pernaX: b.pernaX * k,
    nariz: j(b.nariz, 0.08),
  };
}

/* --------------------------------------------------------------------- escolha */

const CORPOS: TipoCorpo[] = ['medio', 'redondo', 'alto', 'gnoma', 'jovem', 'vovo'];
// pesos: a touca e o mole aparecem mais; o caído (que de frente pode ler como projétil) menos
const GORROS: FormaGorro[] = ['mole', 'pontudo', 'caido', 'touca', 'mole', 'touca', 'pontudo', 'touca', 'caido', 'mole'];

/** Aparência do gnomo para uma semente (sempre a mesma para a mesma semente). */
export function escolherAparencia(semente: string): Aparencia {
  const h = hashTexto(semente);
  const s = criarSorteio(h);
  // as escolhas principais usam bits diferentes do hash, para sementes vizinhas variarem em tudo
  const corpo = escolher(s, CORPOS);
  const formaGorro = escolher(s, GORROS);
  const p = proporcao(corpo, s);
  const velho = corpo === 'vovo' || corpo === 'redondo' || (corpo !== 'jovem' && corpo !== 'gnoma' && s() < 0.8);

  // gorro
  const corG = escolher(s, CORES_GORRO);
  let padrao: PadraoGorro = escolher(s, ['liso', 'listras', 'jacquard', 'feltro', 'feltro', 'liso', 'listras'] as const);
  if (formaGorro === 'touca' && padrao === 'feltro') padrao = s() < 0.5 ? 'jacquard' : 'liso';
  const contraste = corG.nome === 'creme' ? escolher(s, [VERMELHO, VERDE, AZUL]) : CREME;
  // pompom ou sino na grande maioria: são os pontos claros que leem na miniatura
  const ponta: PontaGorro = formaGorro === 'touca' || formaGorro === 'caido' ? 'pompom' : escolher(s, ['pompom', 'sino', 'nada', 'sino', 'pompom'] as const);
  const comprimento = { mole: 0.58, pontudo: 0.6, caido: 0.58, touca: 0.37 }[formaGorro] * (0.92 + s() * 0.16) * (corpo === 'redondo' ? 1.05 : 1);

  // suéter: nunca da mesma cor do gorro (exceto creme com motivo)
  let sueter = escolher(s, CORES_SUETER);
  for (let i = 0; i < 4 && sueter.nome === corG.nome; i++) sueter = escolher(s, CORES_SUETER);
  const sueterMotivo = sueter.nome !== 'creme' && s() < 0.45;
  const barra = s() < 0.5 ? sueter.cor : escolher(s, [CREME, corG.cor, VERMELHO, VERDE]);

  // barba
  let formaBarba: FormaBarba;
  let corBarba: Rgb;
  if (corpo === 'gnoma') {
    formaBarba = 'nenhuma';
    corBarba = escolher(s, CABELO_GNOMA);
  } else if (corpo === 'jovem') {
    formaBarba = escolher(s, ['curta', 'cheia', 'curta'] as const);
    corBarba = escolher(s, BARBA_JOVEM);
  } else {
    formaBarba = escolher(s, ['cheia', 'larga', 'bifurcada', 'trancada', 'cheia'] as const);
    // três em cada dez barbudos são ruivos ou castanhos (mesmo os mais velhos, em tons apagados)
    corBarba = s() < 0.3 ? escolher(s, BARBA_JOVEM) : velho ? escolher(s, BARBA_VELHA) : escolher(s, [...BARBA_VELHA, ...BARBA_JOVEM]);
  }
  const bigode: FormaBigode = corpo === 'gnoma' ? 'nenhum' : escolher(s, formaBarba === 'curta' ? (['cheio', 'guidao'] as const) : (['morsa', 'guidao', 'cheio', 'morsa'] as const));
  const compBarba = formaBarba === 'curta' ? 0.55 : corpo === 'alto' ? 1.1 : 0.9 + s() * 0.25;

  const cachecol = s() < (corpo === 'jovem' ? 0.2 : 0.45) ? { cor: escolher(s, [VERMELHO, VERDE, CREME, DOURADO, AZUL_MEDIO]), cor2: escolher(s, [CREME, VERMELHO, VERDE]) } : null;
  if (cachecol && cachecol.cor === cachecol.cor2) cachecol.cor2 = cachecol.cor === CREME ? VERMELHO : CREME;
  let colete: Rgb | null = s() < 0.35 ? escolher(s, CORES_COLETE).cor : null;
  if (colete === sueter.cor) colete = CARAMELO;
  const avental = !colete && corpo !== 'gnoma' && s() < 0.22;

  return {
    chave: semente,
    semente: h,
    corpo,
    p,
    pele: escolher(s, PELES),
    iris: Math.floor(s() * 4),
    gorro: {
      forma: formaGorro,
      padrao,
      cor: corG.cor,
      cor2: contraste,
      ponta,
      corPonta: ponta === 'sino' ? hex('#E3B65C') : escolher(s, [CREME, CREME, contraste]),
      raminho: s() < 0.4,
      lado: s() < 0.5 ? -1 : 1,
      comprimento,
    },
    barba: { forma: formaBarba, cor: corBarba, comprimento: compBarba, bigode },
    cabelo: { trancas: corpo === 'gnoma', cor: corBarba, franja: corpo === 'gnoma' && s() < 0.6 },
    sobrancelha: corpo === 'gnoma' ? misturarRgb(corBarba, [0.05, 0.03, 0.02], 0.35) : corBarba,
    roupa: {
      sueter: sueter.cor,
      sueterMotivo,
      barra,
      calca: escolher(s, CORES_CALCA),
      colete,
      avental,
      cachecol,
      cinto: !avental && (s() < 0.68 || corpo === 'redondo'),
      luvas: s() < 0.55 ? escolher(s, [VERMELHO, VERDE, CREME, DOURADO, AZUL_MEDIO, MUSGO]) : null,
      botas: escolher(s, [hex('#ffffff'), hex('#c8b4a0'), hex('#8a6f5a'), hex('#5a463a'), hex('#e0c8b0')]),
      botoes: s() < 0.5,
    },
    lanterna: s() < 0.12,
    ritmo: { piscar: 2.6 + s() * 2.8, respirar: 1.1 + s() * 0.5, fase: s() * 100, ginga: 0.8 + s() * 0.4 },
  };
}
