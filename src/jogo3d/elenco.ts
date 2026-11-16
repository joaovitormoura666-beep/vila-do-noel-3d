/**
 * PLANO DO ELENCO (lógica pura): quais visitantes já devem existir, quem entra em cena e em que ordem.
 *
 * - Na tela cabem `limite` pessoas esperando (o resto aparece no contador do HUD, "N a caminho"). Além delas, as próximas `preaquecer`
 *   sementes são montadas com antecedência, fora de cena: montar um gnomo novo custa ~30 ms, então nunca se monta
 *   mais de um por quadro e, de preferência, antes de ele precisar aparecer.
 * - A entrada em cena respeita a ordem da fila: o próximo só entra quando o anterior já entrou.
 */

/** O próximo da fila que ainda precisa ser montado (no máximo um por quadro), ou null. */
export function proximoAMontar(fila: readonly string[], existe: { has(id: string): boolean }, limite: number, preaquecer: number): string | null {
  const n = Math.min(fila.length, Math.max(0, limite) + Math.max(0, preaquecer));
  for (let i = 0; i < n; i++) if (!existe.has(fila[i])) return fila[i];
  return null;
}

/**
 * Quem deve entrar em cena agora (no máximo um por chamada), ou null. `emCena` diz quem já está na tela;
 * `pronto` diz quem já foi montado; `entradaLivre` diz se a entrada do caminho está desocupada.
 */
export function proximoAEntrar(
  fila: readonly string[],
  emCena: { has(id: string): boolean },
  pronto: { has(id: string): boolean },
  limite: number,
  entradaLivre: boolean,
): string | null {
  const n = Math.min(fila.length, Math.max(0, limite));
  for (let i = 0; i < n; i++) {
    const id = fila[i];
    if (emCena.has(id)) continue;
    // respeita a ordem: se o próximo ainda não está montado ou a entrada está ocupada, espera
    return pronto.has(id) && entradaLivre ? id : null;
  }
  return null;
}

/** Montados que não estão mais na fila (saíram por "limpar" ou "pular" antes de aparecer): devem ser descartados. */
export function sobrando(montados: Iterable<string>, fila: readonly string[], ocupados: { has(id: string): boolean }): string[] {
  const naFila = new Set(fila);
  const fora: string[] = [];
  for (const id of montados) if (!naFila.has(id) && !ocupados.has(id)) fora.push(id);
  return fora;
}

/**
 * Quantas pessoas cabem esperando na tela ao longo do caminho: do primeiro (a `folga` metros do fim) para trás,
 * a cada `espaco` metros, até `inicioVisivel` metros do começo do caminho (antes disso fica fora da tela).
 */
export function capacidadeDoCaminho(comprimento: number, folga: number, espaco: number, inicioVisivel: number): number {
  const util = comprimento - folga - inicioVisivel;
  return util < 0 ? 0 : Math.floor(util / espaco) + 1;
}
