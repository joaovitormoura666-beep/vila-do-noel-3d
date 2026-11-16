/**
 * Geada dos vidros: textura própria, desenhada por código (nada baixado), cobrindo a janela inteira.
 * Cada vidro é pintado no seu lugar (não há carimbo repetido): a força vem de um campo de ruído no
 * espaço da janela (fileira de baixo e cantos de fora mais carregados, uns vidros quase limpos, um ou
 * dois tomados até a metade). Em cada vidro:
 *   - o corpo do gelo cresce das bordas e engorda nos cantos (soma de exponenciais da distância a
 *     cada borda, com o contorno roído por ruído e um granulado fino);
 *   - cristais em ramos contínuos (4 a 5 níveis de galhos alternados) nascem presos à borda e
 *     avançam para o vidro limpo, finos, com um véu desfocado em volta;
 *   - um embaçado leve sobe de baixo.
 */
import * as THREE from 'three';
import { criarSorteio, entre, fbm2, limitar, misturar, suave, type Sorteio } from './util';

/** Um vidro: polígono no plano XY local da janela (anti-horário), e se é da fileira de baixo ou da bandeira. */
export interface VidroGeada {
  pts: THREE.Vector2[];
  baixo: boolean;
  bandeira: boolean;
}

export interface CaixaGeada {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

interface Borda {
  a: THREE.Vector2;
  b: THREE.Vector2;
  /** Normal para dentro do vidro. */
  n: THREE.Vector2;
  /** Peso da borda no crescimento: a de baixo é a mais fria. */
  peso: number;
}

function bordasDe(pts: THREE.Vector2[]): Borda[] {
  const out: Borda[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const d = new THREE.Vector2().subVectors(b, a);
    if (d.lengthSq() < 1e-8) continue;
    const n = new THREE.Vector2(-d.y, d.x).normalize(); // anti-horário: a esquerda é dentro
    // n.y > 0: borda de baixo (normal para cima, para dentro); n.y < 0: borda de cima
    const peso = n.y > 0.7 ? 1.6 : n.y < -0.5 ? 0.45 : 1;
    out.push({ a, b, n, peso });
  }
  return out;
}

function distSeg(px: number, py: number, a: THREE.Vector2, b: THREE.Vector2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const t = limitar(((px - a.x) * dx + (py - a.y) * dy) / (dx * dx + dy * dy), 0, 1);
  return Math.hypot(px - (a.x + dx * t), py - (a.y + dy * t));
}

function dentroPoligono(px: number, py: number, pts: THREE.Vector2[]): boolean {
  let dentro = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i];
    const b = pts[j];
    if (a.y > py !== b.y > py && px < ((b.x - a.x) * (py - a.y)) / (b.y - a.y) + a.x) dentro = !dentro;
  }
  return dentro;
}

/**
 * Ramo de gelo contínuo: haste que entorta de leve e solta galhos alternados a 50-65 graus, cada vez
 * menores (recursivo). Coordenadas em pixels do canvas.
 */
function ramo(c: CanvasRenderingContext2D, r: Sorteio, x: number, y: number, ang: number, comp: number, larg: number, nivel: number, alfa: number) {
  const passo = Math.max(2.2, comp / 14);
  const passos = Math.max(2, Math.round(comp / passo));
  const curva = entre(r, -0.18, 0.18) / passos;
  let px = x;
  let py = y;
  let a = ang;
  let lado = r() < 0.5 ? 1 : -1;
  for (let i = 0; i < passos; i++) {
    const t = i / passos;
    const nx = px + Math.cos(a) * passo;
    const ny = py + Math.sin(a) * passo;
    c.globalAlpha = alfa * (1 - 0.7 * t);
    c.lineWidth = Math.max(0.45, larg * (1 - 0.75 * t));
    c.beginPath();
    c.moveTo(px, py);
    c.lineTo(nx, ny);
    c.stroke();
    if (nivel > 0 && i > 0 && r() < 0.8) {
      const sub = comp * (0.42 - 0.34 * t) * entre(r, 0.65, 1.1);
      if (sub > 2.5) ramo(c, r, nx, ny, a + lado * entre(r, 0.85, 1.15), sub, larg * 0.6, nivel - 1, alfa * 0.85);
      if (nivel > 1 && r() < 0.35 && sub > 3) ramo(c, r, nx, ny, a - lado * entre(r, 0.85, 1.15), sub * 0.6, larg * 0.55, nivel - 2, alfa * 0.75);
      lado = -lado;
    }
    px = nx;
    py = ny;
    a += curva + entre(r, -0.06, 0.06);
  }
}

/** Força da geada de cada vidro (0 limpo, 1 carregado, até 1,5 tomado até a metade), no espaço da janela. */
export function forcasGeada(vidros: VidroGeada[], caixa: CaixaGeada, semente: number): number[] {
  const r = criarSorteio(semente * 131 + 17);
  const meioX = (caixa.x0 + caixa.x1) / 2;
  const meiaL = (caixa.x1 - caixa.x0) / 2;
  // o vento joga a neve de um lado: esse lado gela mais
  const ladoVento = r() < 0.5 ? -1 : 1;
  const forcas = vidros.map((v) => {
    let cx = 0;
    let cy = 0;
    for (const p of v.pts) {
      cx += p.x / v.pts.length;
      cy += p.y / v.pts.length;
    }
    const fora = Math.abs(cx - meioX) / meiaL; // 0 no meio, 1 na borda
    const vento = ((cx - meioX) / meiaL) * ladoVento; // -1 a 1
    let f = 0.32 + 0.75 * fbm2(cx * 1.3 + semente * 3.1, cy * 1.1, 2, semente + 7) + 0.25 * fora + 0.18 * vento;
    if (v.baixo) f += 0.32;
    if (v.bandeira) f -= 0.12;
    return f;
  });
  // um terço dos vidros quase limpo; um ou dois tomados até a metade
  const ordem = forcas.map((f, i) => [f, i]).sort((p, q) => p[0] - q[0]);
  const nLimpos = Math.round(vidros.length * 0.34);
  const out = new Array<number>(vidros.length).fill(0);
  ordem.forEach(([f, i], k) => {
    if (k < nLimpos) out[i] = 0.05 + 0.1 * r();
    else out[i] = limitar(0.3 + 0.6 * suave(ordem[nLimpos]?.[0] ?? 0, ordem[ordem.length - 1][0], f), 0.3, 1);
  });
  const tomados = vidros.length > 10 ? 2 : 1;
  for (let k = 0; k < tomados; k++) {
    const i = ordem[ordem.length - 1 - k * 2]?.[1];
    if (i !== undefined) out[i] = 1.5;
  }
  return out;
}

/**
 * Textura da geada da janela inteira (RGBA, branco-azulado com alpha). `caixa` é o retângulo da
 * janela em XY local coberto pela textura; `pxPorMetro` a resolução.
 */
export function texturaGeadaJanela(vidros: VidroGeada[], forcas: number[], caixa: CaixaGeada, semente: number, pxPorMetro = 440): THREE.CanvasTexture {
  const largM = caixa.x1 - caixa.x0;
  const altM = caixa.y1 - caixa.y0;
  const LW = Math.round(largM * pxPorMetro);
  const LH = Math.round(altM * pxPorMetro);
  const canvas = document.createElement('canvas');
  canvas.width = LW;
  canvas.height = LH;
  const c = canvas.getContext('2d')!;
  c.clearRect(0, 0, LW, LH);
  const px = (x: number) => (x - caixa.x0) * pxPorMetro;
  const py = (y: number) => (caixa.y1 - y) * pxPorMetro;

  // 1) corpo do gelo e embaçado: campo calculado em meia resolução e ampliado com suavização
  const meia = 2;
  const CW = Math.ceil(LW / meia);
  const CH = Math.ceil(LH / meia);
  const campo = c.createImageData(CW, CH);
  const passoM = meia / pxPorMetro;
  vidros.forEach((v, iv) => {
    const s = forcas[iv];
    const bordas = bordasDe(v.pts);
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of v.pts) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }
    const altV = maxY - minY;
    const k = (s >= 1.4 ? 0.09 : 0.026 + 0.05 * s) * (0.85 + 0.3 * acasoVidro(iv, semente));
    const salV = semente * 13 + iv * 7;
    const i0 = Math.max(0, Math.floor(px(minX) / meia) - 1);
    const i1 = Math.min(CW - 1, Math.ceil(px(maxX) / meia) + 1);
    const j0 = Math.max(0, Math.floor(py(maxY) / meia) - 1);
    const j1 = Math.min(CH - 1, Math.ceil(py(minY) / meia) + 1);
    for (let j = j0; j <= j1; j++) {
      const y = caixa.y1 - (j + 0.5) * passoM;
      for (let i = i0; i <= i1; i++) {
        const x = caixa.x0 + (i + 0.5) * passoM;
        if (!dentroPoligono(x, y, v.pts)) continue;
        let e = 0;
        let dMin = Infinity;
        const hv = (y - minY) / altV;
        for (const b of bordas) {
          const d = distSeg(x, y, b.a, b.b);
          dMin = Math.min(dMin, d);
          // nas bordas dos lados o gelo sobe pouco: forte embaixo, quase nada no alto
          const lado = Math.abs(b.n.y) < 0.5 ? misturar(1, 0.25, suave(0, 0.75, hv)) : 1;
          e += b.peso * lado * Math.exp(-d / k);
        }
        // contorno roído: duas escalas de ruído (3 cm e 8 mm)
        const roido = 1 + 0.45 * fbm2(x * 30, y * 30, 2, salV) + 0.2 * fbm2(x * 110, y * 110, 2, salV + 5);
        const corpo = suave(1.45, 2.3, e * roido) * (s < 0.2 ? 0.5 : 1); // uma borda só quase não gela: o corpo nasce nos cantos
        const grao = 0.62 + 0.38 * fbm2(x * 260, y * 260, 2, salV + 9);
        // geada fina junto à borda (crosta de 2 a 5 mm), mesmo nos vidros limpos
        const crosta = Math.exp(-dMin / (0.002 + 0.003 * s)) * (0.5 + 0.5 * fbm2(x * 90, y * 90, 2, salV + 11)) * misturar(1, 0.4, hv);
        // embaçado: véu baixo, subindo pouco, mais forte nos vidros de baixo
        const veu = (1 - suave(0, (0.1 + 0.2 * acasoVidro(iv, semente + 3)) * (1 + 0.5 * fbm2(x * 5, 1.3, 2, salV + 13)), hv)) * (0.025 + 0.06 * Math.min(1, s)) * (v.baixo ? 1.3 : 0.8);
        const alfa = limitar(Math.max(corpo * 0.7 * grao, crosta * 0.55) + veu * (1 - corpo), 0, 1);
        const o = (j * CW + i) * 4;
        campo.data[o] = 228;
        campo.data[o + 1] = 237;
        campo.data[o + 2] = 250;
        campo.data[o + 3] = Math.round(alfa * 255);
      }
    }
  });
  const aux = document.createElement('canvas');
  aux.width = CW;
  aux.height = CH;
  aux.getContext('2d')!.putImageData(campo, 0, 0);
  c.imageSmoothingEnabled = true;
  c.drawImage(aux, 0, 0, CW * meia, CH * meia);

  // 2) cristais: ramos presos à borda, crescendo para dentro; desenhados em camada própria
  const camada = document.createElement('canvas');
  camada.width = LW;
  camada.height = LH;
  const gelo = camada.getContext('2d')!;
  gelo.strokeStyle = '#f2f7ff';
  gelo.lineCap = 'round';
  const r = criarSorteio(semente * 977 + 3);
  vidros.forEach((v, iv) => {
    const s = forcas[iv];
    gelo.save();
    gelo.beginPath();
    v.pts.forEach((p, i) => (i ? gelo.lineTo(px(p.x), py(p.y)) : gelo.moveTo(px(p.x), py(p.y))));
    gelo.closePath();
    gelo.clip();
    const k = (s >= 1.4 ? 0.09 : 0.026 + 0.05 * s) * pxPorMetro;
    for (const b of bordasDe(v.pts)) {
      const compB = b.a.distanceTo(b.b);
      const n = Math.round(compB * (s < 0.2 ? 5 : 10 + 18 * Math.min(1.2, s)) * (b.peso > 1 ? 1.3 : b.peso < 1 ? 0.4 : 1));
      for (let q = 0; q < n; q++) {
        let t = r();
        // mais ramos perto dos cantos
        t = t < 0.5 ? 0.5 * Math.pow(2 * t, 2.4) : 1 - 0.5 * Math.pow(2 * (1 - t), 2.4);
        const x = b.a.x + (b.b.x - b.a.x) * t;
        const y = b.a.y + (b.b.y - b.a.y) * t;
        const canto = Math.max(Math.exp(-(t * compB) / 0.06), Math.exp(-((1 - t) * compB) / 0.06));
        if (Math.abs(b.n.y) < 0.5) {
          // nos lados, os ramos rareiam e encurtam subindo
          let minY = Infinity;
          let maxY = -Infinity;
          for (const p of v.pts) {
            minY = Math.min(minY, p.y);
            maxY = Math.max(maxY, p.y);
          }
          if (r() < suave(0.1, 0.8, (y - minY) / (maxY - minY))) continue;
        }
        const ang = Math.atan2(-b.n.y, b.n.x) + entre(r, -0.75, 0.75); // y do canvas para baixo
        const comp = k * entre(r, 0.3, 0.9) * (1 + 1.8 * canto) * (s < 0.2 ? 0.45 : 1) * Math.min(1.2, b.peso);
        if (comp < 3) continue;
        ramo(gelo, r, px(x), py(y), ang, comp, entre(r, 0.7, 1.3), comp > 30 ? 4 : 3, entre(r, 0.55, 0.95));
      }
    }
    gelo.restore();
  });
  c.globalAlpha = 0.3;
  c.filter = 'blur(2.5px)';
  c.drawImage(camada, 0, 0);
  c.filter = 'none';
  c.globalAlpha = 0.85;
  c.drawImage(camada, 0, 0);
  c.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.needsUpdate = true;
  return tex;
}

function acasoVidro(i: number, semente: number): number {
  return criarSorteio(semente * 31 + i * 7919)();
}

/** Geometria da geada de um vidro: o polígono (leque a partir do centro) com UV no espaço da janela. */
export function quadroGeada(pts: THREE.Vector2[], z: number, caixa: CaixaGeada): THREE.BufferGeometry {
  const meio = new THREE.Vector2();
  for (const p of pts) meio.addScaledVector(p, 1 / pts.length);
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const poe = (p: THREE.Vector2) => {
    pos.push(p.x, p.y, z);
    nor.push(0, 0, 1);
    uv.push((p.x - caixa.x0) / (caixa.x1 - caixa.x0), (p.y - caixa.y0) / (caixa.y1 - caixa.y0));
  };
  for (let i = 0; i < pts.length; i++) {
    poe(meio);
    poe(pts[i]);
    poe(pts[(i + 1) % pts.length]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}
