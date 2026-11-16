import { DEFAULT_SETTINGS, type Settings } from '../shared/types';

/** Configurações atuais do jogo (vindas do painel pelo servidor). */
export const settingsState: { current: Settings; effectiveSpeed: number } = {
  current: { ...DEFAULT_SETTINGS, volumes: { ...DEFAULT_SETTINGS.volumes } },
  /** Velocidade realmente aplicada (inclui a aceleração automática por tamanho da fila). */
  effectiveSpeed: DEFAULT_SETTINGS.speed,
};

/**
 * Aceleração automática: com até 6 pessoas esperando o ritmo é o normal;
 * a partir daí aumenta aos poucos, chegando ao dobro com 40 pessoas.
 */
export function computeSpeed(settings: Settings, waiting: number): number {
  const boost = settings.autoSpeed ? 1 + Math.min(1, Math.max(0, (waiting - 6) / 34)) : 1;
  return Math.min(4, settings.speed * boost);
}
