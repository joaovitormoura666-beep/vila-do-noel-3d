/**
 * REGRAS DAS ETIQUETAS DE NOME (lógica pura, em pixels de projeto 1080x1920, sem tela nem DOM).
 *
 * - Só quem está sendo atendido e os primeiros da fila (ETIQUETAS.maxFila) têm etiqueta; o resto da fila aparece
 *   num selo "+N".
 * - Cada etiqueta tenta alguns lugares em volta da cabeça (acima, acima e para o lado, um degrau mais alto) e, por
 *   último, abaixo dos pés. Um lugar só vale se ficar inteiro dentro da área de jogo, não cobrir nenhuma área
 *   proibida (rosto do Noel, saco, área da entrega, balão, presente) e não encostar em outra etiqueta.
 * - Entre os lugares válidos ganha o mais barato (perto da cabeça, sem degrau), com preferência pelo lugar do
 *   quadro anterior (para a etiqueta não ficar pulando enquanto a fila anda).
 * - Sem lugar válido, a etiqueta some (e a pessoa passa a contar no "+N").
 *
 * O posicionador reaproveita os próprios objetos: nada é alocado por quadro depois de aquecido.
 */

export interface Retangulo {
  l: number;
  t: number;
  r: number;
  b: number;
}

export const ETIQUETAS = {
  /** Quantos da fila (além de quem está sendo atendido) podem mostrar o nome. */
  maxFila: 6,
  /** Distância entre o topo da cabeça e a etiqueta (px). */
  folga: 6,
  /** Folga mínima entre duas etiquetas (px). */
  entre: 6,
  /** Área de jogo da tela da live (fora dela ficam o título e o chat do TikTok). */
  area: { l: 14, t: 440, r: 1066, b: 1476 } as Retangulo,
  /** Bônus para continuar no mesmo lugar do quadro anterior. */
  ficar: 60,
};

/** Lugares tentados, em ordem de preferência: deslocamento em x (px), degraus para cima, e se é abaixo dos pés. */
export const OPCOES: ReadonlyArray<{ dx: number; degrau: number; abaixo: boolean; custo: number }> = [
  { dx: 0, degrau: 0, abaixo: false, custo: 0 },
  { dx: -70, degrau: 0, abaixo: false, custo: 30 },
  { dx: 70, degrau: 0, abaixo: false, custo: 30 },
  { dx: -140, degrau: 0, abaixo: false, custo: 70 },
  { dx: 140, degrau: 0, abaixo: false, custo: 70 },
  { dx: 0, degrau: 1, abaixo: false, custo: 90 },
  { dx: -90, degrau: 1, abaixo: false, custo: 120 },
  { dx: 90, degrau: 1, abaixo: false, custo: 120 },
  { dx: -210, degrau: 0, abaixo: false, custo: 140 },
  { dx: 210, degrau: 0, abaixo: false, custo: 140 },
  { dx: 0, degrau: 0, abaixo: true, custo: 160 },
  { dx: -80, degrau: 0, abaixo: true, custo: 190 },
  { dx: 80, degrau: 0, abaixo: true, custo: 190 },
  { dx: -170, degrau: 1, abaixo: false, custo: 200 },
  { dx: 170, degrau: 1, abaixo: false, custo: 200 },
  { dx: 0, degrau: 2, abaixo: false, custo: 230 },
];

export interface PedidoEtiqueta {
  id: string;
  /** Topo da cabeça na tela. */
  x: number;
  y: number;
  /** Altura dos pés na tela (para o lugar abaixo dos pés). */
  pes: number;
  /** Tamanho da etiqueta. */
  w: number;
  h: number;
  /** Nomes das áreas proibidas que esta etiqueta pode cobrir (ex.: o atendido pode ficar sobre a área da entrega). */
  libera?: string;
}

export interface AreaProibida extends Retangulo {
  nome: string;
  ativa: boolean;
}

export interface Lugar extends Retangulo {
  id: string;
  opcao: number;
  visivel: boolean;
}

export function sobrepoe(a: Retangulo, b: Retangulo, margem = 0): boolean {
  return a.l < b.r + margem && b.l < a.r + margem && a.t < b.b + margem && b.t < a.b + margem;
}

export function dentro(a: Retangulo, area: Retangulo): boolean {
  return a.l >= area.l && a.r <= area.r && a.t >= area.t && a.b <= area.b;
}

/** Quem tem direito a etiqueta: os primeiros `max` da fila que já estão na tela (na ordem da fila). */
export function comEtiqueta(filaNaTela: readonly string[], max = ETIQUETAS.maxFila): string[] {
  return filaNaTela.slice(0, Math.max(0, max));
}

/** Quantos aparecem no selo "+N": todos que esperam, menos os que estão com o nome à mostra. */
export function contarMaisN(esperando: number, comNome: number): number {
  return Math.max(0, esperando - comNome);
}

export class Posicionador {
  private readonly lugares: Lugar[] = [];
  private usados = 0;
  private readonly anterior = new Map<string, number>();
  private readonly tmp: Retangulo = { l: 0, t: 0, r: 0, b: 0 };

  /** Começa um quadro novo (as etiquetas são posicionadas em ordem de prioridade com `colocar`). */
  comecar() {
    this.usados = 0;
  }

  /** Calcula o retângulo de uma opção para o pedido. */
  static retangulo(p: PedidoEtiqueta, i: number, out: Retangulo): Retangulo {
    const o = OPCOES[i];
    const cx = p.x + o.dx;
    out.l = cx - p.w / 2;
    out.r = cx + p.w / 2;
    if (o.abaixo) {
      out.t = p.pes + ETIQUETAS.folga;
    } else {
      out.t = p.y - ETIQUETAS.folga - p.h - o.degrau * (p.h + ETIQUETAS.entre);
    }
    out.b = out.t + p.h;
    return out;
  }

  /**
   * Escolhe o lugar do pedido. Devolve o lugar (reaproveitado: copie se precisar guardar) ou null se não há lugar
   * válido. Pedidos colocados antes têm prioridade.
   */
  colocar(p: PedidoEtiqueta, proibidas: readonly AreaProibida[], area: Retangulo = ETIQUETAS.area): Lugar | null {
    const antes = this.anterior.get(p.id);
    let melhor = -1;
    let melhorCusto = Infinity;
    const r = this.tmp;
    for (let i = 0; i < OPCOES.length; i++) {
      Posicionador.retangulo(p, i, r);
      if (!dentro(r, area)) continue;
      let ok = true;
      for (let k = 0; k < proibidas.length && ok; k++) {
        const a = proibidas[k];
        if (a.ativa && a.nome !== p.libera && sobrepoe(r, a)) ok = false;
      }
      for (let k = 0; k < this.usados && ok; k++) if (sobrepoe(r, this.lugares[k], ETIQUETAS.entre)) ok = false;
      if (!ok) continue;
      const custo = OPCOES[i].custo - (antes === i ? ETIQUETAS.ficar : 0);
      if (custo < melhorCusto) {
        melhorCusto = custo;
        melhor = i;
      }
    }
    if (melhor < 0) {
      this.anterior.delete(p.id);
      return null;
    }
    this.anterior.set(p.id, melhor);
    let lugar = this.lugares[this.usados];
    if (!lugar) {
      lugar = { id: '', l: 0, t: 0, r: 0, b: 0, opcao: 0, visivel: true };
      this.lugares.push(lugar);
    }
    this.usados++;
    Posicionador.retangulo(p, melhor, lugar);
    lugar.id = p.id;
    lugar.opcao = melhor;
    lugar.visivel = true;
    return lugar;
  }

  /** Esquece as etiquetas que não existem mais (chame de vez em quando, não precisa ser a cada quadro). */
  esquecer(vivos: { has(id: string): boolean }) {
    for (const id of this.anterior.keys()) if (!vivos.has(id)) this.anterior.delete(id);
  }

  /** Lugares já colocados neste quadro. */
  get colocados(): readonly Lugar[] {
    return this.lugares.slice(0, this.usados);
  }
}
