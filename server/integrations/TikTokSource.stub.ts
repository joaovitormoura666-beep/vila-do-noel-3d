import type { LiveEvent } from '../../shared/types.js';
import type { LiveSource } from './LiveSource.js';

/**
 * ESBOÇO — NÃO ATIVO NO MVP.
 *
 * Ponto de encaixe para eventos reais do TikTok LIVE. O MVP não presume
 * acesso à API oficial. Caminhos possíveis, a validar antes de ativar:
 *
 * 1. Ferramentas de terceiros que o criador já usa (TikFinity, Streamer.bot,
 *    Social Stream Ninja etc.) enviando eventos para o webhook local
 *    POST http://127.0.0.1:3000/api/evento  — já funciona hoje, sem código novo.
 * 2. Bibliotecas não oficiais de leitura de eventos (ex.: "tiktok-live-connector").
 *    Funcionam lendo a live pública, mas não são oficiais e podem violar os
 *    Termos de Uso ou parar de funcionar sem aviso. Avaliar o risco antes.
 * 3. Programas oficiais do TikTok para desenvolvedores de LIVE, se/quando a
 *    conta tiver acesso.
 *
 * Para implementar, converta cada evento recebido em `LiveEvent`:
 *   gift  -> { type: 'gift', userId, nickname, avatarUrl, giftName, streakId }
 *   chat  -> { type: 'chat', userId, nickname, avatarUrl, comment }
 *   follow-> { type: 'follow', userId, nickname, avatarUrl }
 * e chame `emit(evento)`. Deduplicação, regras e fila já são tratadas pelo EventHub.
 */
export class TikTokSourceStub implements LiveSource {
  readonly name = 'tiktok';

  constructor(private readonly username: string) {}

  start(_emit: (ev: LiveEvent) => void) {
    throw new Error(
      `Integração TikTok ainda não ativada (usuário: ${this.username}). ` +
        'Use o simulador ou o webhook /api/evento. Veja server/integrations/TikTokSource.stub.ts.',
    );
  }

  stop() {}
}
