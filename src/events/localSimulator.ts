import type { Participant } from '../../shared/types';
import { simulatedAvatarSvg } from '../../shared/simAvatar';

const NAMES = ['Luna', 'Theo', 'Bia', 'Davi', 'Mari', 'Leo', 'Nina', 'Gabi', 'Rafa', 'Lia', 'Caio', 'Duda', 'Enzo', 'Malu', 'Juju', 'Sofia'];
const SUFFIX = ['', '', '', '_natal', '_neve', '_luz', '.star', '_br', '_doce', '_rena'];

let counter = 0;

/**
 * Participante fictício criado na própria tela do jogo, sem passar pelo servidor.
 * Usado pelos atalhos de teclado (R e D) e pela demonstração autônoma.
 */
export function fakeParticipant(): Participant {
  counter++;
  const id = `local-${Date.now().toString(36)}-${counter}`;
  const nickname = NAMES[Math.floor(Math.random() * NAMES.length)] + SUFFIX[Math.floor(Math.random() * SUFFIX.length)];
  // metade com "foto de perfil" (avatar fictício), metade só com a inicial colorida
  const avatarUrl = counter % 2 === 0 ? `data:image/svg+xml;utf8,${encodeURIComponent(simulatedAvatarSvg(id))}` : undefined;
  return { userId: id, nickname, avatarUrl, via: 'presente', giftName: 'Rosa', eventId: id, ts: Date.now() };
}
