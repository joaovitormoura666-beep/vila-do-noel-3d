/**
 * Esqueleto da árvore: tronco, galhos em verticilos e as frondes presas neles.
 * Abeto de Natal cheio, cônico mas irregular. Cada galho é um "prato" de folhagem: leques pequenos
 * alternados dos dois lados, outros por cima (com giro próprio) e alguns pendentes por baixo, e na ponta um
 * tufo em estrela, que é o que dá a silhueta de escova. Os galhos de baixo são longos e pendem com o peso
 * (pontas levemente reviradas para cima); os do alto são curtos e ascendentes. Entre um andar e outro há
 * galhos curtos que tapam as fendas. O miolo é fechado por leques grandes e escuros.
 */
import * as THREE from 'three';
import type { Fronde } from './folhagem';
import { CHEIOS, LEQUES, MIOLO, PONTAS } from './folhagem';
import { entre, suave, type Sorteio } from './util';

export interface Galho {
  pontos: THREE.Vector3[];
  /** Raio na base, em metros. */
  grossura: number;
}

export interface PontaDeGalho {
  /** Fim do tufo da ponta. */
  posicao: THREE.Vector3;
  /** Para fora da copa, na horizontal. */
  fora: THREE.Vector3;
}

export interface Esqueleto {
  frondes: Fronde[];
  galhos: Galho[];
  /** Pontas dos galhos principais (onde se penduram enfeites). */
  pontas: PontaDeGalho[];
  /** Raio da copa (até as pontas) na altura y. */
  raioEm(y: number): number;
  /** Altura em que a copa começa (as pontas mais baixas). */
  yCopa: number;
  /** Altura em que a folhagem termina (a guia do topo); acima disso só a haste e a estrela. */
  yGuia: number;
}

export interface OpcoesEsqueleto {
  altura: number;
  raio: number;
}

const escolher = (r: Sorteio, lista: number[]) => lista[Math.floor(r() * lista.length) % lista.length];

export function gerarEsqueleto(o: OpcoesEsqueleto, r: Sorteio): Esqueleto {
  const H = o.altura;
  const R = o.raio;
  const k = H / 3.4; // escala geral em relação à árvore padrão
  const frondes: Fronde[] = [];
  const galhos: Galho[] = [];
  const pontas: PontaDeGalho[] = [];
  const yPrimeiro = 0.78 * k; // onde nasce o verticilo mais baixo
  const yUltimo = H - 0.52 * k;
  const perfil: Array<[number, number]> = []; // [altura das pontas, alcance] de cada verticilo
  const cimaMundo = new THREE.Vector3(0, 1, 0);

  /** Tinta por fronde: varia a luminosidade e muito pouco o matiz (umas um nada mais quentes, outras mais frias). */
  const tintaDe = (clara: number): THREE.Color => {
    const l = 0.84 + (r() - 0.5) * 0.26 + clara;
    const a = (r() - 0.5) * 0.1;
    return new THREE.Color(l * (1 + a), l, l * (1 - a * 0.8));
  };

  const nova = (base: THREE.Vector3, frente: THREE.Vector3, comprimento: number, largura: number, variante: number, clara: number, curva: number, rolo: number, alcance: number, essencial = false, escuro = 1) => {
    frente.normalize();
    const pontaF = base.clone().addScaledVector(frente, comprimento);
    // "para cima" do leque: o mundo, girado em torno do próprio talo
    const cima = cimaMundo.clone();
    if (Math.abs(frente.y) > 0.92) cima.set(base.x, 0, base.z).normalize();
    cima.applyAxisAngle(frente, rolo);
    const clarear = (p: THREE.Vector3) => (0.05 + 0.95 * suave(0.3, 0.93, Math.hypot(p.x, p.z) / Math.max(0.2, alcance))) * escuro;
    const meio = base.clone().lerp(pontaF, 0.5);
    frondes.push({
      base,
      frente,
      cima,
      comprimento,
      largura,
      variante,
      tinta: tintaDe(clara),
      sombraBase: clarear(base),
      sombraPonta: clarear(pontaF),
      curva,
      centro: new THREE.Vector3(0, meio.y - 0.45 * Math.hypot(meio.x, meio.z) - 0.05, 0),
      essencial,
    });
  };

  const galho = (ang: number, yb: number, alc: number, sobe: number, cai: number, tam: number, principal: boolean) => {
    const L = Math.max(0.06, alc - 0.6 * tam); // o lenho; o tufo da ponta passa dele
    const dir = new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang));
    const lateral = new THREE.Vector3(-dir.z, 0, dir.x);
    const quedaExtra = entre(r, 0.85, 1.15);
    const ponto = (t: number) => {
      const yy = yb + L * (sobe * t - cai * quedaExtra * t * t) + L * 0.1 * suave(0.6, 1, t);
      return new THREE.Vector3(dir.x * t * L, yy, dir.z * t * L);
    };
    const tangente = (t: number) => ponto(Math.min(1, t + 0.02)).sub(ponto(Math.max(0, t - 0.02))).normalize();
    const pts: THREE.Vector3[] = [];
    const seg = L > 0.5 ? 6 : 3;
    for (let s = 0; s <= seg; s++) pts.push(ponto(s / seg));
    galhos.push({ pontos: pts, grossura: (0.005 + 0.011 * (L / R)) * k });

    // ramos ao longo do galho, como telhas: cada um aponta para fora e para baixo, abrindo para um lado,
    // com a face de cima olhando para fora (é o caimento em camadas do abeto). Estreitos e muitos.
    const t0 = L > 0.5 * k ? 0.2 : L > 0.25 * k ? 0.14 : 0.06;
    const passo = 0.27 * tam;
    let lado = r() < 0.5 ? 1 : -1;
    for (let d = t0 * L; d < L - 0.15 * tam; d += passo * entre(r, 0.8, 1.2)) {
      const t = d / L;
      const T = tangente(t);
      const p = ponto(t);
      {
        const abre = lado * entre(r, 0.25, 0.9);
        const frente = T.clone().multiplyScalar(Math.cos(abre)).addScaledVector(lateral, Math.sin(abre));
        frente.y -= entre(r, 0.02, 0.36) * (0.55 + 0.45 * t);
        const comp = tam * entre(r, 0.85, 1.2) * (0.85 + 0.15 * t);
        nova(p, frente, comp, comp * entre(r, 0.74, 0.88), r() < 0.72 ? escolher(r, LEQUES) : escolher(r, CHEIOS), 0, entre(r, 0.04, 0.3), lado * entre(r, -0.1, 0.55) + (r() - 0.5) * 0.4, alc);
      }
      if (r() < 0.5) {
        // por cima: segue o galho e levanta um pouco, com giro livre (dá corpo acima do prato do galho)
        const frente = T.clone().addScaledVector(cimaMundo, entre(r, 0.12, 0.5)).addScaledVector(lateral, (r() - 0.5) * 1.0);
        const comp = tam * entre(r, 0.7, 1.0);
        nova(p.clone(), frente, comp, comp * entre(r, 0.72, 0.85), escolher(r, LEQUES), 0.03, entre(r, 0.1, 0.4), (r() - 0.5) * 1.6, alc);
      }
      if (t > 0.42 && r() < (principal ? 0.5 : 0.35)) {
        // pendente: cai por baixo do galho e tapa a fenda para o andar de baixo
        const frente = T.clone().multiplyScalar(0.6).addScaledVector(lateral, (r() - 0.5) * 0.9);
        frente.y = -entre(r, 0.6, 1.0);
        const comp = tam * entre(r, 0.8, 1.1);
        nova(p.clone(), frente, comp, comp * entre(r, 0.72, 0.85), escolher(r, LEQUES), -0.04, entre(r, 0.0, 0.2), (r() - 0.5) * 1.0, alc);
      }
      lado = -lado;
    }

    // a ponta do galho: um tufo em estrela (o guia, dois de lado, um por cima e um por baixo)
    {
      const T = tangente(1);
      const pT = ponto(Math.max(0, 1 - (0.12 * tam) / L));
      const guia = T.clone();
      guia.y += entre(r, -0.16, 0.12);
      const comp = tam * entre(r, 1.05, 1.3);
      nova(pT, guia, comp, comp * entre(r, 0.72, 0.85), escolher(r, PONTAS), 0.1, entre(r, 0.0, 0.25), (r() - 0.5) * 0.7, alc, true);
      for (const s of [-1, 1]) {
        const abre = s * entre(r, 0.4, 0.75);
        const frente = T.clone().multiplyScalar(Math.cos(abre)).addScaledVector(lateral, Math.sin(abre));
        frente.y -= entre(r, 0.1, 0.4);
        const c2 = tam * entre(r, 0.8, 1.05);
        nova(pT.clone(), frente, c2, c2 * entre(r, 0.72, 0.85), escolher(r, LEQUES), 0.06, entre(r, 0.0, 0.25), s * entre(r, 0.0, 0.6), alc, principal);
      }
      if (r() < 0.7) {
        const frente = T.clone().addScaledVector(cimaMundo, entre(r, 0.3, 0.6));
        const c2 = tam * entre(r, 0.65, 0.9);
        nova(pT.clone(), frente, c2, c2 * 0.78, escolher(r, PONTAS), 0.08, 0.1, (r() - 0.5) * 2.4, alc);
      }
      if (r() < 0.7) {
        const frente = T.clone().addScaledVector(cimaMundo, -entre(r, 0.55, 0.95));
        const c2 = tam * entre(r, 0.7, 0.95);
        nova(pT.clone(), frente, c2, c2 * 0.78, escolher(r, LEQUES), 0, 0.05, (r() - 0.5) * 1.6, alc);
      }
      const fim = pT.clone().addScaledVector(guia.normalize(), comp * 0.8);
      if (principal) pontas.push({ posicao: fim, fora: dir.clone() });
      return fim;
    }
  };

  const env = (u: number) => (R - 0.1 * k) * Math.pow(1 - u, 0.9) + 0.1 * k;
  let y = yPrimeiro;
  let camada = 0;
  while (y < yUltimo) {
    const u = (y - yPrimeiro) / (yUltimo - yPrimeiro);
    const tam = THREE.MathUtils.lerp(0.25, 0.15, Math.pow(u, 1.1)) * k; // ramos menores para o alto
    // copa cônica com leve barriga; cada andar entra ou sai um pouco
    const alcance = Math.max(0.1 * k, env(u) * (1 + 0.045 * Math.sin(camada * 2.4 + 1)));
    const sobe = THREE.MathUtils.lerp(0.1, 1.05, Math.pow(u, 2.2));
    const cai = THREE.MathUtils.lerp(0.3, 0.0, Math.pow(u, 0.7));
    const passoY = THREE.MathUtils.lerp(0.185, 0.1, Math.pow(u, 0.8)) * k * entre(r, 0.9, 1.1);
    const n = Math.max(5, Math.round((2 * Math.PI * alcance) / (0.33 * k)));
    const fase = r() * Math.PI * 2;
    let somaY = 0;
    let somaR = 0;
    for (let i = 0; i < n; i++) {
      const ang = fase + ((i + (r() - 0.5) * 0.7) / n) * Math.PI * 2;
      // pontas desiguais; alguns galhos curtos. No primeiro andar o alcance varia menos (a base não pesa para um lado)
      const irregular = camada === 0 ? entre(r, 0.92, 1.03) : entre(r, 0.88, 1.07) * (r() < 0.1 ? 0.82 : 1);
      const fim = galho(ang, y + (r() - 0.5) * 0.12 * k, alcance * irregular, sobe, cai, tam, true);
      somaY += fim.y;
      somaR += Math.hypot(fim.x, fim.z);
    }
    // meio andar: galhos curtos entre este verticilo e o próximo, que tapam as fendas entre os andares
    const nMeio = Math.round(n * (u < 0.5 ? 0.6 : 0.4));
    for (let i = 0; i < nMeio; i++) {
      const ang = fase + 0.5 + ((i + (r() - 0.5) * 0.8) / nMeio) * Math.PI * 2;
      galho(ang, y + passoY * entre(r, 0.35, 0.65), alcance * entre(r, 0.6, 0.84), sobe + 0.05, cai * 0.8, tam * 0.92, false);
    }
    // miolo: leques grandes e escuros perto do tronco, em volta toda, que fecham a vista para o outro lado
    const nMiolo = Math.max(4, Math.round((2 * Math.PI * alcance * 0.4) / (0.2 * k)));
    for (let i = 0; i < nMiolo; i++) {
      const ang = fase + 0.9 + ((i + r() * 0.6) / nMiolo) * Math.PI * 2;
      const dir = new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang));
      const base = dir.clone().multiplyScalar(alcance * entre(r, 0.1, 0.3));
      base.y = y + (r() - 0.5) * passoY;
      const frente = dir.clone().addScaledVector(new THREE.Vector3(-dir.z, 0, dir.x), (r() - 0.5) * 1.0);
      frente.y = entre(r, -0.25, 0.45);
      const comp = Math.min(alcance * 0.62, tam * entre(r, 1.5, 2.0));
      nova(base, frente, comp, comp * entre(r, 0.85, 1.0), MIOLO, -0.06, 0.15, (r() - 0.5) * 2.2, alcance, true, 1);
    }
    // segundo anel, a meio caminho: leques cheios e sombrios que fecham os buracos entre o miolo e as pontas
    const nAnel = Math.round((2 * Math.PI * alcance * 0.5) / (0.24 * k));
    for (let i = 0; i < nAnel; i++) {
      const ang = fase + 0.3 + ((i + r() * 0.7) / Math.max(1, nAnel)) * Math.PI * 2;
      const dir = new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang));
      const base = dir.clone().multiplyScalar(alcance * entre(r, 0.3, 0.5));
      base.y = y + passoY * entre(r, -0.2, 0.7) + alcance * 0.4 * (sobe - cai * 0.4);
      const frente = dir.clone().addScaledVector(new THREE.Vector3(-dir.z, 0, dir.x), (r() - 0.5) * 0.9);
      frente.y = entre(r, -0.3, 0.25);
      const comp = Math.min(alcance * 0.5, tam * entre(r, 1.15, 1.5));
      nova(base, frente, comp, comp * entre(r, 0.8, 0.95), escolher(r, CHEIOS), -0.04, 0.15, (r() - 0.5) * 1.6, alcance, true, 1);
    }
    // junto ao tronco, do meio para cima, raminhos ascendentes cobrem o lenho (ele só aparece em frestas)
    if (u > 0.3) {
      const quantos = u > 0.75 ? 4 : 3;
      for (let i = 0; i < quantos; i++) {
        const ang = fase + 1.3 + ((i + r() * 0.6) / quantos) * Math.PI * 2;
        const abre = entre(r, 0.45, 0.95);
        const frente = new THREE.Vector3(Math.cos(ang) * abre, 1, Math.sin(ang) * abre);
        const comp = tam * entre(r, 1.0, 1.4);
        const base = new THREE.Vector3(0, y + (r() - 0.5) * 0.08 * k, 0);
        nova(base, frente, comp, comp * 0.66, escolher(r, CHEIOS), 0, 0.1, (r() - 0.5) * 2, alcance * 0.75, true, 0.5 + 0.5 * suave(0.75, 1, u));
      }
    }
    perfil.push([somaY / n, somaR / n]);
    y += passoY;
    camada++;
  }

  // a guia do topo: leques estreitos quase na vertical em volta do último palmo de folhagem; o topo afina
  const yGuia = H - 0.34 * k;
  for (let i = 0; i < 5; i++) {
    const ang = (i / 5) * Math.PI * 2 + r();
    const abre = i < 2 ? 0.1 : 0.34;
    const frente = new THREE.Vector3(Math.cos(ang) * abre, 1, Math.sin(ang) * abre).normalize();
    const comp = (i < 2 ? 0.3 : 0.24) * k;
    const base = new THREE.Vector3(0, yGuia - comp * (i < 2 ? 0.95 : 1.25) + i * 0.008, 0);
    frondes.push({
      base,
      frente,
      cima: new THREE.Vector3(Math.cos(ang), 0.2, Math.sin(ang)),
      comprimento: comp,
      largura: comp * (i < 2 ? 0.55 : 0.7),
      variante: PONTAS[i % PONTAS.length],
      tinta: tintaDe(0.08),
      sombraBase: 0.7,
      sombraPonta: 1,
      curva: -0.04,
      centro: new THREE.Vector3(0, base.y - 0.2, 0),
      essencial: true,
    });
  }

  // o broto-guia: um leque estreito e em pé no eixo, que sobe por trás da luva da estrela (a estrela fica
  // espetada na guia, sem haste nua à mostra)
  {
    const comp = 0.36 * k;
    const base = new THREE.Vector3(0, yGuia - 0.22 * k, 0);
    frondes.push({
      base,
      frente: new THREE.Vector3(0.02, 1, 0.03).normalize(),
      cima: new THREE.Vector3(0, 0.1, 1),
      comprimento: comp,
      largura: comp * 0.42,
      variante: PONTAS[0],
      tinta: new THREE.Color(0.9, 0.9, 0.9),
      sombraBase: 0.75,
      sombraPonta: 1,
      curva: -0.02,
      centro: new THREE.Vector3(0, base.y - 0.2, 0),
      essencial: true,
    });
  }

  perfil.sort((a, b) => a[0] - b[0]);
  const raioEm = (yy: number): number => {
    if (yy <= perfil[0][0]) return perfil[0][1];
    for (let i = 1; i < perfil.length; i++)
      if (yy <= perfil[i][0]) {
        const [y0, r0] = perfil[i - 1];
        const [y1, r1] = perfil[i];
        return r0 + ((r1 - r0) * (yy - y0)) / Math.max(1e-4, y1 - y0);
      }
    const [yF, rF] = perfil[perfil.length - 1];
    return Math.max(0.02, rF * (1 - (yy - yF) / Math.max(0.05, yGuia - yF)));
  };
  return { frondes, galhos, pontas, raioEm, yCopa: perfil[0][0], yGuia };
}
