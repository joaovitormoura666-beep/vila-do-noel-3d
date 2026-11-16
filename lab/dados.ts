/** Dados comuns: paleta obrigatória, zonas seguras e visitantes fictícios para os protótipos. */

/** Paleta obrigatória do briefing. Tons derivados são permitidos, estas cinco são a base. */
export const PALETTE = {
  red: '#B62835',
  pine: '#174D3B',
  gold: '#E8BC65',
  snow: '#F7F4EF',
  night: '#17253B',
} as const;

/**
 * Zonas da tela (em pixels de projeto, 1080x1920).
 * O aplicativo do TikTok desenha por cima do vídeo: barra do perfil no topo,
 * chat embaixo à esquerda e botões na coluna da direita.
 */
export const SAFE = {
  /** Título e instrução ficam nesta faixa. */
  titleTop: 190,
  titleBottom: 420,
  /** Noel, área de entrega e fila precisam caber aqui dentro. */
  play: { left: 60, right: 1020, top: 430, bottom: 1480 },
  /** Abaixo disso só cenário decorativo de primeiro plano (o chat cobre). */
  decorBelow: 1480,
} as const;

/** Visitantes fictícios (o primeiro é quem está sendo atendido). */
export const VISITORS = [
  { name: 'Maria', photo: true },
  { name: 'João Pedro', photo: false },
  { name: 'ana.clara', photo: true },
  { name: 'Lucas_07', photo: false },
  { name: 'Bia', photo: true },
  { name: 'Rafa', photo: true },
  { name: 'Duda.natal', photo: false },
  { name: 'Theo', photo: true },
  { name: 'Luna_neve', photo: false },
  { name: 'Caio', photo: true },
  { name: 'Malu', photo: false },
  { name: 'Enzo.br', photo: true },
  { name: 'Nina', photo: false },
] as const;

const SKIN = ['#f6d2b8', '#e9b991', '#c98a5e', '#8d5a3b', '#f2c6a0'];
const HAIR = ['#3b2a22', '#5a3a1e', '#a86b2d', '#1f1a1a', '#d9a441', '#7a2e1d'];
const BG = ['#b62835', '#174d3b', '#2a4d8f', '#8a4fa3', '#c9772b', '#1f7a6d'];

function hash(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** "Foto de perfil" fictícia e original, desenhada em SVG a partir do nome. */
export function fakePhoto(seed: string): string {
  const h = hash(seed);
  const skin = SKIN[h % SKIN.length];
  const hair = HAIR[(h >> 4) % HAIR.length];
  const bg = BG[(h >> 9) % BG.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="${bg}"/><ellipse cx="32" cy="62" rx="24" ry="18" fill="#f7f4ef"/><circle cx="32" cy="30" r="15" fill="${skin}"/><path d="M16 28c0-12 8-18 16-18s16 6 16 18c-4-7-9-10-16-10s-12 3-16 10z" fill="${hair}"/><circle cx="26.500" cy="31" r="2" fill="#2b1d16"/><circle cx="37.500" cy="31" r="2" fill="#2b1d16"/><path d="M27 37.500q5 4 10 0" stroke="#2b1d16" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** Cor da inicial para quem não tem foto. */
export function initialColor(seed: string): string {
  return BG[hash(seed) % BG.length];
}
