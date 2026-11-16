/**
 * AGENDA DA ENTREGA (lógica pura, sem tela): o roteiro de cada atendimento, no ritmo do jogo 2D.
 *
 *   chegada    o visitante para diante do Noel e olha para ele; o Noel começa a acenar
 *   saudacao   "Ho, ho, ho! Olá, Fulano!" (balão e voz), acenando
 *   fala       "Vamos ver qual é o seu presente!" (a fala obrigatória)
 *   saco       o Noel procura no saco
 *   caixa      a caixa sai da boca do saco e voa até a frente dos dois; o Noel começa a apresentar
 *   suspense   a caixa balança
 *   abre       a tampa salta com mola e o presente sobe girando
 *   revelacao  o presente gira no alto, com brilho contido; faixa "Fulano ganhou ..."; o Noel apresenta
 *   entrega    o Noel estende os braços (give) e o presente desce até as mãos do visitante (hold)
 *   festa      o visitante comemora e pula; o Noel comemora; "Feliz Natal, Fulano!"
 *
 * Tudo em segundos de agenda (o relógio da entrega avança dt x velocidade do jogo). As fases marcadas com
 * `esperaVoz` podem segurar o relógio enquanto a voz do Noel termina a frase (quem executa decide; veja
 * Entrega3D). `avaliar()` devolve, para um instante, os pesos das poses e o estado da caixa e do presente:
 * sem alocar nada (escreve no objeto recebido), para ser chamado a cada quadro.
 */

export type FaseId = 'chegada' | 'saudacao' | 'fala' | 'saco' | 'caixa' | 'suspense' | 'abre' | 'revelacao' | 'entrega' | 'festa';

export interface FaseDef {
  id: FaseId;
  /** Segundos de agenda (velocidade 1). */
  duracao: number;
  /** O relógio pode esperar a voz terminar perto do fim desta fase. */
  esperaVoz?: boolean;
}

/** O roteiro, em ordem. Soma 9,25 s; com a caminhada até o Noel (cerca de 2,5 s) dá perto de 11 s por pessoa, como no 2D. */
export const ROTEIRO: readonly FaseDef[] = [
  { id: 'chegada', duracao: 0.3 },
  { id: 'saudacao', duracao: 1.35, esperaVoz: true },
  { id: 'fala', duracao: 1.55, esperaVoz: true },
  { id: 'saco', duracao: 0.75 },
  { id: 'caixa', duracao: 0.8 },
  { id: 'suspense', duracao: 0.6 },
  { id: 'abre', duracao: 0.5 },
  { id: 'revelacao', duracao: 1.5, esperaVoz: true },
  { id: 'entrega', duracao: 0.8 },
  { id: 'festa', duracao: 1.1, esperaVoz: true },
];

export interface Fase extends FaseDef {
  inicio: number;
  fim: number;
}

export class Agenda {
  readonly fases: readonly Fase[];
  readonly total: number;
  /** As fases por nome (acesso direto, sem alocar). */
  readonly f: Record<FaseId, Fase>;

  constructor(roteiro: readonly FaseDef[] = ROTEIRO) {
    let t = 0;
    const fases: Fase[] = [];
    const porId: Partial<Record<FaseId, Fase>> = {};
    for (const f of roteiro) {
      const fase = { ...f, inicio: t, fim: t + f.duracao };
      fases.push(fase);
      porId[f.id] = fase;
      t += f.duracao;
    }
    for (const id of ['chegada', 'saudacao', 'fala', 'saco', 'caixa', 'suspense', 'abre', 'revelacao', 'entrega', 'festa'] as FaseId[]) {
      if (!porId[id]) throw new Error(`o roteiro precisa da fase ${id}`);
    }
    this.fases = fases;
    this.f = porId as Record<FaseId, Fase>;
    this.total = t;
  }

  fase(id: FaseId): Fase {
    return this.f[id];
  }

  inicio(id: FaseId) {
    return this.fase(id).inicio;
  }

  fim(id: FaseId) {
    return this.fase(id).fim;
  }

  /** Fase em andamento no instante t (null antes do começo ou depois do fim). */
  faseEm(t: number): Fase | null {
    if (t < 0 || t >= this.total) return null;
    for (const f of this.fases) if (t < f.fim) return f;
    return null;
  }
}

export type Balao = 'saudacao' | 'fala' | 'despedida' | null;

/** Estado de um instante da entrega. Todos os pesos de 0 a 1, menos onde dito. */
export interface Quadro {
  fase: FaseId | null;
  noel: { wave: number; talk: number; rummage: number; present: number; give: number; cheer: number };
  visitante: { lookUp: number; hold: number; joy: number; jump: number };
  caixa: {
    visivel: boolean;
    /** 0 = na boca do saco, 1 = no lugar diante dos dois. */
    voo: number;
    /** Escala relativa (cresce ao sair do saco e encolhe ao sumir). */
    escala: number;
    /** Balanço do suspense (rad). */
    balanco: number;
    /** Tampa: 0 fechada, 1 aberta (passa um pouco de 1 na mola). */
    tampa: number;
  };
  presente: {
    visivel: boolean;
    /** 0 = dentro da caixa, 1 = no ponto da revelação. */
    subida: number;
    /** Giro em Y (rad, acumulado). */
    giro: number;
    /** 0 = no ponto da revelação, 1 = nas mãos do visitante. */
    paraMao: number;
    /** Já está nas mãos (preso ao visitante). */
    naMao: boolean;
    /** Brilho contido em volta do presente. */
    brilho: number;
    /** Instante (s de agenda) da faísca da abertura; -1 antes dela. */
    faisca: number;
  };
  balao: Balao;
  /** Faixa "Fulano ganhou ..." no lugar da instrução. */
  faixa: boolean;
}

export function novoQuadro(): Quadro {
  return {
    fase: null,
    noel: { wave: 0, talk: 0, rummage: 0, present: 0, give: 0, cheer: 0 },
    visitante: { lookUp: 0, hold: 0, joy: 0, jump: 0 },
    caixa: { visivel: false, voo: 0, escala: 0, balanco: 0, tampa: 0 },
    presente: { visivel: false, subida: 0, giro: 0, paraMao: 0, naMao: false, brilho: 0, faisca: -1 },
    balao: null,
    faixa: false,
  };
}

/* ------------------------------------------------------------- curvas */

export const limitar = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const suave = (x: number) => {
  const t = limitar(x);
  return t * t * (3 - 2 * t);
};
/** Sobe de 0 a 1 começando em `a`, em `dur` segundos. */
export const rampa = (t: number, a: number, dur: number) => suave((t - a) / Math.max(1e-4, dur));
/** Janela suave: sobe a partir de `a` (em `sobe` s), fica em 1 e desce até chegar a 0 em `b` (em `desce` s). */
export const janela = (t: number, a: number, b: number, sobe: number, desce: number) => Math.min(rampa(t, a, sobe), 1 - rampa(t, b - desce, desce));
/** Saída com passada do ponto (back-out). */
export const sobra = (x: number) => {
  const t = limitar(x) - 1;
  const k = 1.5;
  return 1 + t * t * ((k + 1) * t + k);
};
/** Mola amortecida: 0 em x = 0, passa de 1 e assenta em 1. */
export const mola = (x: number) => (x <= 0 ? 0 : 1 - Math.exp(-5.5 * x) * Math.cos(11 * x));

/**
 * Escreve em `q` o estado do instante `t` (segundos de agenda). Função pura: o mesmo t dá sempre o mesmo quadro.
 * Depois do fim, o visitante continua segurando o presente (hold = 1) e o resto zera.
 */
export function avaliar(ag: Agenda, t: number, q: Quadro): Quadro {
  const f = ag.f;
  q.fase = ag.faseEm(t)?.id ?? null;

  /* Noel */
  const n = q.noel;
  n.wave = janela(t, f.chegada.inicio, f.saudacao.fim + 0.1, 0.35, 0.45);
  n.talk = Math.max(janela(t, f.saudacao.inicio + 0.05, f.fala.fim, 0.2, 0.3), 0.7 * janela(t, f.revelacao.inicio + 0.25, f.revelacao.fim, 0.25, 0.3), janela(t, f.festa.inicio + 0.2, f.festa.fim, 0.2, 0.3));
  n.rummage = janela(t, f.saco.inicio, f.caixa.inicio + 0.3, 0.3, 0.4);
  n.present = janela(t, f.caixa.inicio + 0.15, f.revelacao.fim + 0.15, 0.45, 0.4);
  n.give = janela(t, f.entrega.inicio - 0.05, f.entrega.fim + 0.45, 0.3, 0.5);
  n.cheer = Math.max(0.3 * janela(t, f.abre.inicio, f.revelacao.inicio + 0.8, 0.2, 0.4), janela(t, f.festa.inicio + 0.1, f.festa.fim, 0.3, 0.4));

  /* visitante */
  const v = q.visitante;
  v.lookUp = Math.max(0.35 * janela(t, f.chegada.inicio, f.fala.fim, 0.4, 0.4), janela(t, f.caixa.inicio + 0.1, f.revelacao.fim + 0.3, 0.45, 0.45));
  const pegou = f.entrega.inicio + f.entrega.duracao * 0.78;
  v.hold = t >= ag.total ? 1 : rampa(t, pegou - 0.18, 0.3);
  v.joy = janela(t, f.festa.inicio, f.festa.fim, 0.22, 0.35);
  const tf = t - f.festa.inicio;
  v.jump = tf > 0 && tf < 0.9 ? Math.abs(Math.sin((Math.PI * tf) / 0.45)) * (1 - tf / 1.4) : 0;

  /* caixa */
  const c = q.caixa;
  const tc = t - f.caixa.inicio;
  c.visivel = tc >= 0 && t < f.entrega.inicio + 0.2;
  c.voo = suave(tc / f.caixa.duracao);
  c.escala = c.visivel ? (0.2 + 0.8 * sobra(tc / (f.caixa.duracao * 0.9))) * (1 - rampa(t, f.revelacao.inicio + 0.35, 0.65)) : 0;
  const ts = t - f.suspense.inicio;
  c.balanco = ts > 0 && ts < f.suspense.duracao ? Math.sin(ts * Math.PI * 2 * 4.2) * 0.13 * Math.sin((Math.PI * ts) / f.suspense.duracao) : 0;
  c.tampa = mola(t - f.abre.inicio);

  /* presente */
  const p = q.presente;
  const ta = t - f.abre.inicio - 0.05;
  p.visivel = ta >= 0;
  p.subida = suave(ta / (f.abre.duracao + 0.55));
  // gira rápido ao sair da caixa e desacelera até um giro lento de vitrine
  p.giro = ta > 0 ? 1.1 * ta + 5.5 * (1 - Math.exp(-2.2 * ta)) : 0;
  p.paraMao = suave((t - f.entrega.inicio) / (pegou - f.entrega.inicio));
  p.naMao = t >= pegou;
  p.brilho = janela(t, f.abre.inicio, f.entrega.inicio + 0.35, 0.15, 0.45);
  p.faisca = t >= f.abre.inicio ? f.abre.inicio : -1;

  /* tela */
  q.balao = t >= f.saudacao.inicio && t < f.saudacao.fim - 0.05 ? 'saudacao' : t >= f.fala.inicio && t < f.fala.fim ? 'fala' : t >= f.festa.inicio + 0.15 && t < ag.total ? 'despedida' : null;
  q.faixa = t >= f.revelacao.inicio + 0.1 && t < f.entrega.inicio + 0.45;
  return q;
}
