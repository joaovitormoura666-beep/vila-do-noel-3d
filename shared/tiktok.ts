/**
 * Tipos da leitura da live do TikTok, compartilhados entre o servidor e o painel.
 *
 * A leitura em si fica em server/integrations/TikTokSource.ts. Aqui ficam só o formato do
 * estado mostrado no painel e a limpeza do @ digitado pelo dono (o painel usa a mesma regra
 * para avisar na hora quando o @ não parece válido).
 *
 * A chave do Euler Stream nunca aparece aqui inteira: o painel só fica sabendo se ela existe
 * e de onde veio.
 */

/**
 * Situação da conexão com a live:
 * - desligado: a leitura está desligada no painel (ou ainda não tem @);
 * - conectando: abrindo a conexão agora;
 * - aguardando_live: o @ existe, mas não está ao vivo; confere de novo sozinho de tempos em tempos;
 * - conectado: recebendo comentários e presentes;
 * - reconectando: a conexão caiu ou falhou; tenta de novo sozinho, com espera crescente;
 * - erro: algo que não se resolve sozinho (ex.: @ inválido); precisa de uma ação do dono.
 */
export type TikTokState = 'desligado' | 'conectando' | 'aguardando_live' | 'conectado' | 'reconectando' | 'erro';

export interface TikTokStatus {
  state: TikTokState;
  /** @ da conta lida (sem o @ na frente). Vazio quando nada foi configurado. */
  usuario: string;
  /** Explicação curta, em português simples, do que está acontecendo e do que fazer. */
  mensagem: string;
  /** Título da live, quando conectado e o TikTok informar. */
  sala?: string;
  /** Espectadores agora, quando conectado e o TikTok informar. */
  espectadores?: number;
  /** Quando a próxima tentativa acontece (milissegundos desde 1970), se houver uma agendada. */
  proximaTentativa?: number;
  /** Número da tentativa atual de reconexão (1, 2, 3...). */
  tentativa?: number;
  /** Desde quando está neste estado. */
  desde: number;
}

/** Contadores desde que o servidor ligou (zeram ao trocar de @). */
export interface TikTokCounters {
  comentarios: number;
  /** Envios de presente já fechados (um combo de 10 rosas conta 1). */
  presentes: number;
  curtidas: number;
  seguidores: number;
  compartilhamentos: number;
  /** Pessoas vindas da live que a tela do jogo aceitou na fila. */
  entraramNaFila: number;
  /** Efeitos ambientes pedidos por presentes da live. */
  efeitos: number;
}

/** De onde veio cada configuração: do painel (salva em data/tiktok.json) ou do arquivo .env. */
export type TikTokConfigOrigin = 'painel' | 'env' | null;

/** O que o painel recebe sobre a configuração. A chave nunca vem: só se ela existe. */
export interface TikTokPublicConfig {
  usuario: string;
  ligado: boolean;
  chaveDefinida: boolean;
  chaveOrigem: TikTokConfigOrigin;
  usuarioOrigem: TikTokConfigOrigin;
}

export interface TikTokPanelInfo {
  status: TikTokStatus;
  contadores: TikTokCounters;
  config: TikTokPublicConfig;
}

export const EMPTY_TIKTOK_COUNTERS: TikTokCounters = {
  comentarios: 0,
  presentes: 0,
  curtidas: 0,
  seguidores: 0,
  compartilhamentos: 0,
  entraramNaFila: 0,
  efeitos: 0,
};

/**
 * Limpa o @ digitado: aceita "@nome", "nome" ou o endereço da live
 * (https://www.tiktok.com/@nome/live). Devolve o nome sem @, em minúsculas,
 * ou null quando não parece um @ do TikTok (letras, números, ponto e sublinhado, até 24).
 */
export function normalizarUsuarioTikTok(raw: unknown): string | null {
  let s = String(raw ?? '').trim();
  if (!s) return null;
  const doEndereco = /tiktok\.com\/@([^/?#\s]+)/i.exec(s);
  if (doEndereco) s = doEndereco[1];
  s = s.replace(/^@+/, '').trim().toLowerCase();
  if (!/^[a-z0-9._]{2,24}$/.test(s)) return null;
  return s;
}
