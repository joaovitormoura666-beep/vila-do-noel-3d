/**
 * Avatar fictício original (SVG) usado pelo simulador para testar o caminho de
 * "foto de perfil" sem depender de nenhuma imagem de terceiros.
 * Fica em `shared` porque é usado pelo servidor e pela demonstração autônoma.
 */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const BG = ['#B62835', '#174D3B', '#E8BC65', '#17253B', '#7A4B9A', '#2F7FB5', '#D9773B', '#3E9B7A'];
const SKIN = ['#F6D2B3', '#E7B48C', '#C98E63', '#8F5B3C'];
const HAIR = ['#2B1B14', '#5A3620', '#C98A3A', '#F0D9A0', '#8C2F2F', '#3B3B48'];

export function simulatedAvatarSvg(seed: string): string {
  const h = hash(seed);
  const bg = BG[h % BG.length];
  const skin = SKIN[(h >>> 4) % SKIN.length];
  const hair = HAIR[(h >>> 8) % HAIR.length];
  const style = (h >>> 12) % 3;
  const smile = (h >>> 16) % 2;
  const hairShape =
    style === 0
      ? `<path d="M22 46 Q24 18 50 18 Q76 18 78 46 Q70 30 50 30 Q30 30 22 46Z" fill="${hair}"/>`
      : style === 1
        ? `<path d="M20 60 Q16 16 50 16 Q84 16 80 60 Q78 36 50 32 Q22 36 20 60Z" fill="${hair}"/>`
        : `<circle cx="50" cy="20" r="11" fill="${hair}"/><path d="M24 44 Q28 22 50 22 Q72 22 76 44 Q64 32 50 32 Q36 32 24 44Z" fill="${hair}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 100 100">
<rect width="100" height="100" fill="${bg}"/>
<circle cx="18" cy="16" r="2" fill="#F7F4EF" opacity=".7"/><circle cx="84" cy="26" r="1.6" fill="#F7F4EF" opacity=".7"/><circle cx="74" cy="10" r="1.2" fill="#F7F4EF" opacity=".6"/>
<path d="M14 100 Q16 72 50 72 Q84 72 86 100Z" fill="#F7F4EF"/>
<circle cx="50" cy="50" r="26" fill="${skin}"/>
${hairShape}
<circle cx="40" cy="50" r="3.2" fill="#2A1E1E"/><circle cx="60" cy="50" r="3.2" fill="#2A1E1E"/>
<circle cx="33" cy="58" r="4" fill="#E8767F" opacity=".5"/><circle cx="67" cy="58" r="4" fill="#E8767F" opacity=".5"/>
${smile ? '<path d="M41 60 Q50 69 59 60" stroke="#2A1E1E" stroke-width="2.4" fill="none" stroke-linecap="round"/>' : '<path d="M42 61 Q50 66 58 61 Q50 72 42 61Z" fill="#7A2A2A"/>'}
</svg>`;
}
