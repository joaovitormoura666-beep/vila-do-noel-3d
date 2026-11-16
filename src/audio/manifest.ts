import { apiUrl, loadBackend } from '../events/backend';

/** Áudios opcionais colocados pelo dono da live em public/audio (música licenciada e frases gravadas). */
export interface AudioManifest {
  musica: string | null;
  vozes: string[];
}

let pending: Promise<AudioManifest> | null = null;

/**
 * Lista os áudios opcionais. Os arquivos ficam junto com as páginas (public/audio), então:
 * - no computador, o próprio servidor lista a pasta (GET /api/audio);
 * - com o front na Cloudflare e o back-end em outro endereço, a lista vem pronta no
 *   front (audio/lista.json, gerada por "npm run pacote:frontend").
 */
export function loadAudioManifest(): Promise<AudioManifest> {
  pending ??= (async () => {
    const empty: AudioManifest = { musica: null, vozes: [] };
    try {
      const backend = await loadBackend();
      const url = backend.base === '' ? apiUrl(backend, '/api/audio') : new URL('audio/lista.json', document.baseURI).href;
      const res = await fetch(url, { cache: 'no-cache' });
      if (!res.ok) return empty;
      const info = (await res.json()) as { musica?: unknown; vozes?: unknown };
      return {
        musica: typeof info.musica === 'string' && info.musica ? info.musica : null,
        vozes: Array.isArray(info.vozes) ? info.vozes.filter((v): v is string => typeof v === 'string') : [],
      };
    } catch {
      return empty; // sem servidor ou sem lista: usa a síntese e a caixinha de música
    }
  })();
  return pending;
}
