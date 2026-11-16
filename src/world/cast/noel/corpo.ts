/**
 * ESCULTURA do Noel: todas as peças, uma superfície paramétrica por peça, acumuladas por material.
 *
 *   veludo   tronco em pera, saia do casaco, mangas, calças (coxas e canelas), gorro
 *   pelo     faixa da frente (peito e saia), barra, punhos, barras da calça, aba e pompom do gorro
 *            (vira pelúcia em cascas no material; o lado escondido da barra e da aba fica só na base)
 *   mechas   barba curta e larga, bigode, sobrancelhas, costeletas e o cabelo atrás da cabeça
 *   pele     cabeça com bochechas, nariz de bolota, orelhas, pálpebras, boca, língua e lábio
 *   luva     luvas grandes de quatro dedos
 *   couro    botas marrom-escuras com sola, cinto carvão e a placa da fivela (cor por vértice)
 *   ouro     moldura da fivela e óculos
 *   olhos    olhos com esclera, íris e pupila (cada um no próprio osso, para o olhar)
 *
 * As dobras ganham sombra por cor de vértice (oclusão aproximada por cápsulas, veja `oclusao`).
 * A forma do tronco, da saia e da barra vem de forma.ts; os ossos, de esqueleto.ts.
 */
import * as THREE from 'three';
import { anel, mecha } from './aneis';
import type { Esqueleto } from './esqueleto';
import { bainha, dentroDoTronco, foraDoTronco, raiosTronco, saia, tronco, TRONCO_Y0, TRONCO_Y1 } from './forma';
import { Acumulador, Caminho, elipsoide, tubo, type Cor, type Pesos } from './malha';
import { CORES, CORPO, DY, PUFE } from './medidas';
import { criarSorteio, fbm3, limitar, misturar, sino, suave } from './util';

export interface PartesNoel {
  veludo: Acumulador;
  /** Pelúcia em cascas: faixa, barra, punhos, aba e pompom. */
  pelo: Acumulador;
  /** Mechas da barba, do bigode e das sobrancelhas (pelúcia sem cascas, com sombra). */
  mechas: Acumulador;
  pele: Acumulador;
  luva: Acumulador;
  couro: Acumulador;
  ouro: Acumulador;
  olhos: Acumulador;
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const Q = new THREE.Vector3();
const lin = (hex: string): Cor => {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
};
const mixCor = (a: Cor, b: Cor, t: number): Cor => [misturar(a[0], b[0], t), misturar(a[1], b[1], t), misturar(a[2], b[2], t)];
const cinza = (k: number): Cor => [k, k, k];

export function esculpir(esq: Esqueleto): PartesNoel {
  const I = esq.i;
  const veludo = new Acumulador();
  const pelo = new Acumulador();
  const mechas = new Acumulador();
  const pele = new Acumulador();
  const luva = new Acumulador();
  const couro = new Acumulador();
  const ouro = new Acumulador();
  const olhos = new Acumulador();
  const c = CORPO.cabeca;
  const um = (nome: string): Pesos => [[I[nome], 1]];

  /* =============================================================== tronco */
  const pesosTronco = (p: THREE.Vector3): Pesos => {
    const y = p.y - DY;
    const wq = 1 - suave(0.98, 1.14, y);
    const wc = suave(0.98, 1.14, y) * (1 - suave(1.3, 1.46, y));
    const wp = suave(1.3, 1.46, y) * (1 - suave(1.6, 1.72, y));
    const wn = suave(1.6, 1.72, y);
    const { rz, cz } = raiosTronco(Math.atan2(p.x, p.z - -0.13), p.y);
    const frente = (p.z - cz) / Math.max(0.05, rz);
    const mb = suave(0.15, 0.6, frente) * sino(y - 1.2, 0.2) * 0.85;
    const lado = Math.sign(p.x) >= 0 ? 'E' : 'D';
    const mo = suave(0.22, 0.4, Math.abs(p.x)) * suave(1.38, 1.54, y) * 0.55;
    const resto = (1 - mb) * (1 - mo);
    return [
      [I.quadril, wq * resto],
      [I.coluna, wc * resto],
      [I.peito, wp * resto],
      [I.pescoco, wn * resto],
      [I.barriga, mb * (1 - mo)],
      [I[`clavicula${lado}`], mo],
    ];
  };
  /* Oclusão de ambiente por cor de vértice: escurece as dobras onde uma peça encosta na outra (axilas,
   * sob a barriga, atrás dos braços, entre as coxas, sob a barba). Cada "oclusor" é uma cápsula ou o
   * próprio tronco; a peça ignora o próprio oclusor. Calculado uma vez, na pose de ligação. */
  type Oclusor = { nome: string; dist(p: THREE.Vector3): number };
  const capsula = (nome: string, a: THREE.Vector3, b: THREE.Vector3, r: number): Oclusor => {
    const ab = b.clone().sub(a);
    const l2 = ab.lengthSq();
    const q = V(0, 0, 0);
    return {
      nome,
      dist(p) {
        const t = limitar(q.subVectors(p, a).dot(ab) / l2, 0, 1);
        return q.copy(a).addScaledVector(ab, t).distanceTo(p) - r;
      },
    };
  };
  const oclusores: Oclusor[] = [
    { nome: 'tronco', dist: (p) => (p.y < TRONCO_Y0 || p.y > TRONCO_Y1 ? 1 : -dentroDoTronco(p)) },
    capsula('bracoE', esq.braco.E.ombro, esq.braco.E.pulso, 0.105),
    capsula('bracoD', esq.braco.D.ombro, esq.braco.D.pulso, 0.105),
    capsula('coxaE', esq.perna.E.quadril, esq.perna.E.joelho, 0.165),
    capsula('coxaD', esq.perna.D.quadril, esq.perna.D.joelho, 0.165),
    capsula('barba', V(c.x, c.y - 0.12, c.z + 0.12), V(c.x, c.y - 0.3, c.z + 0.16), 0.13),
    capsula('cabeca', V(c.x, c.y, c.z), V(c.x, c.y - 0.05, c.z), 0.22),
  ];
  const oclusao = (p: THREE.Vector3, ignorar: string, forca = 1): number => {
    let ao = 1;
    for (const o of oclusores) {
      if (o.nome === ignorar) continue;
      const d = Math.max(0, o.dist(p));
      ao *= 1 - 0.55 * forca * Math.exp(-(d * d) / (0.055 * 0.055));
    }
    return Math.max(0.35, ao);
  };
  // cor do veludo: variação suave de tom e, nas dobras, sombra que puxa para o vinho (não para o cinza)
  const corVeludo = (p: THREE.Vector3, extra = 0, ignorar = 'tronco'): Cor => {
    const n = fbm3(p.x * 6, p.y * 6, p.z * 6, 2, 3);
    const ao = oclusao(p, ignorar);
    const k = Math.max(0.2, (0.95 + 0.07 * n - extra) * ao);
    return [k, k * Math.pow(ao, 0.6) * 0.96, k * Math.pow(ao, 0.3) * 0.98];
  };
  veludo.adicionar({
    nu: 40,
    nv: 30,
    ponto(u, v, out) {
      const y = misturar(TRONCO_Y0, TRONCO_Y1, v);
      const th = u * Math.PI * 2;
      tronco(th, y, out);
      // pregas suaves do veludo no peito e acima do cinto (o tecido sobra quando ele senta)
      const acima = sino(y - (CORPO.cinto + 0.08), 0.06);
      // vincos do pano dobrando sobre o cinto e repuxando nas cavas dos braços
      const cava = sino(Math.abs(Math.sin(th)) - 0.95, 0.12) * sino(y - 1.36 - DY, 0.09);
      const d = 0.008 * Math.sin(th * 11 + y * 30) * acima + 0.003 * Math.sin(th * 23 + 1.3) * sino(y - 1.45 - DY, 0.12) + 0.007 * Math.sin(y * 70 + th * 3) * cava;
      const cz = raiosTronco(th, y).cz;
      const dx = out.x;
      const dz = out.z - cz;
      const l = Math.hypot(dx, dz) || 1;
      out.x += (dx / l) * d;
      out.z += (dz / l) * d;
    },
    pesos: (_u, _v, p) => pesosTronco(p),
    cor: (_u, v, p) => {
      const y = misturar(TRONCO_Y0, TRONCO_Y1, v);
      const sob = 0.18 * sino(y - (CORPO.cinto + 0.065), 0.035);
      return corVeludo(p, sob);
    },
  });

  /* ---------------------------------------------------------- saia do casaco */
  // a saia acompanha o tronco perto do cinto e o colo (quadril e coxas) na barra: quando ele se inclina,
  // a barra fica deitada nas coxas em vez de virar um prato inclinado
  const pesosSaia = (v: number, p: THREE.Vector3): Pesos => {
    const t = suave(0.15, 0.85, v);
    const lado = p.x >= 0 ? 'E' : 'D';
    const frente = suave(0.0, 0.25, p.z);
    const meio = 1 - suave(0.05, 0.2, Math.abs(p.x));
    const coxa = 0.6 * frente * (1 - 0.5 * meio);
    const base = pesosTronco(p).map(([i, w]) => [i, w * (1 - t)] as const);
    return [...base, [I.quadril, t * (1 - coxa)], [I[`coxa${lado}`], t * coxa]];
  };
  veludo.adicionar({
    nu: 40,
    nv: 10,
    ponto: (u, v, out) => saia(u * Math.PI * 2, v, out),
    pesos: (_u, v, p) => pesosSaia(v, p),
    cor: (_u, v, p) => corVeludo(p, 0.12 * (1 - v) * (1 - v)),
  });

  /* ----------------------------------------------------------------- cinto */
  const hc = CORPO.alturaCinto;
  const corCinto = lin(CORES.cinto);
  couro.adicionar({
    nu: 56,
    nv: 6,
    ponto(u, v, out) {
      const y = CORPO.cinto + (v - 0.5) * hc;
      const borda = Math.pow(Math.sin(Math.PI * v), 0.35);
      tronco(u * Math.PI * 2, y, out, 0.004 + 0.015 * borda);
    },
    pesos: (_u, _v, p) => pesosTronco(p),
    // pesponto mais claro junto das bordas
    cor: (u, v) => {
      const borda = sino(v - 0.14, 0.03) + sino(v - 0.86, 0.03);
      const pesp = borda * (Math.sin(u * Math.PI * 2 * 140) > 0.2 ? 1 : 0);
      const k = 1 + 0.9 * pesp;
      return [corCinto[0] * k, corCinto[1] * k, corCinto[2] * k];
    },
  });

  /* ---------------------------------------------------------------- fivela */
  {
    const centro = tronco(0, CORPO.cinto, V(0, 0, 0), 0.03);
    const a = tronco(0.02, CORPO.cinto, V(0, 0, 0));
    const b = tronco(-0.02, CORPO.cinto, V(0, 0, 0));
    const lado = a.sub(b).normalize();
    const cima = tronco(0, CORPO.cinto + 0.02, V(0, 0, 0)).sub(tronco(0, CORPO.cinto - 0.02, V(0, 0, 0))).normalize();
    const frente = new THREE.Vector3().crossVectors(lado, cima).normalize();
    const L = 0.088;
    const H = 0.074;
    // moldura grossa e chanfrada: retângulo de cantos redondos varrido por uma seção quase quadrada
    const curva = (t: number, out: THREE.Vector3) => {
      const ang = t * Math.PI * 2;
      const e = 0.2;
      const x = Math.sign(Math.cos(ang)) * Math.pow(Math.abs(Math.cos(ang)), e) * L;
      const y = Math.sign(Math.sin(ang)) * Math.pow(Math.abs(Math.sin(ang)), e) * H;
      out.copy(centro).addScaledVector(lado, x).addScaledVector(cima, y);
    };
    ouro.adicionar({
      nu: 12,
      nv: 40,
      ponto: anel(
        curva,
        (_t, p, out) => out.subVectors(p, centro).normalize(),
        () => [0.0175, 0.0085],
        0.45,
      ),
      pesos: (_u, _v, p) => pesosTronco(p),
    });
    // placa preta fosca no miolo da fivela (como na referência)
    couro.adicionar({
      nu: 20,
      nv: 6,
      ponto(u, v, out) {
        const ang = u * Math.PI * 2;
        const e = 0.24;
        const r = Math.sin(Math.min(1, v * 1.6) * Math.PI * 0.5);
        const x = Math.sign(Math.sin(ang)) * Math.pow(Math.abs(Math.sin(ang)), e) * (L - 0.012) * r;
        const y = Math.sign(Math.cos(ang)) * Math.pow(Math.abs(Math.cos(ang)), e) * (H - 0.012) * r;
        out.copy(centro).addScaledVector(lado, x).addScaledVector(cima, y).addScaledVector(frente, -0.004 - 0.006 * (1 - r));
      },
      pesos: (_u, _v, p) => pesosTronco(p),
      cor: () => [0.0045, 0.0042, 0.004] as Cor,
      orientar: 1,
    });
    // a ponta do cinto que passa pela fivela (couro, um pouco à frente)
    couro.adicionar({
      nu: 4,
      nv: 6,
      fechadoU: false,
      ponto(u, v, out) {
        out.copy(centro)
          .addScaledVector(lado, (u - 0.5) * L * 1.7)
          .addScaledVector(cima, (v - 0.5) * hc * 0.92)
          .addScaledVector(frente, -0.014 + 0.004 * Math.sin(Math.PI * v));
      },
      pesos: (_u, _v, p) => pesosTronco(p),
      cor: () => corCinto,
      orientar: 1,
    });
  }

  /* ------------------------------------------- faixa felpuda da frente do casaco */
  // larga (≈ 16 cm à vista), saltada do veludo, do pescoço ao cinto e de novo do cinto até a barra
  const meiaFaixa = 0.095;
  const perfilFaixa = (u: number) => Math.pow(Math.max(0, 1 - Math.pow(Math.abs(2 * u - 1), 3)), 0.5);
  pelo.adicionar({
    nu: 8,
    nv: 22,
    fechadoU: false,
    ponto(u, v, out) {
      const y = misturar(CORPO.cinto + 0.07, 1.67 + DY, v);
      const { rz } = raiosTronco(0, y);
      // estreita um pouco no pescoço
      const meia = meiaFaixa * (1 - 0.3 * suave(1.5 + DY, 1.67 + DY, y));
      const th = ((u - 0.5) * 2 * meia) / Math.max(0.1, rz);
      const fofo = 1 + 0.3 * fbm3(u * 3, y * 9, 1.7, 2, 21);
      tronco(th, y, out, -0.004 + 0.034 * perfilFaixa(u) * fofo);
    },
    pesos: (_u, _v, p) => pesosTronco(p),
    cor: (u, _v, p) => cinza((0.9 + 0.1 * Math.sin(Math.PI * u)) * oclusao(p, 'tronco', 0.4)),
    // o pelo some nas bordas (onde a faixa entra no veludo): nada de pontas soltas sobre o vermelho
    pelo: (u) => [0.03 * suave(0.05, 0.45, perfilFaixa(u)), 1, 0.1],
    orientar: 1,
  });
  // a faixa continua na saia, do cinto até a barra
  {
    const q = V(0, 0, 0);
    const n = V(0, 0, 0);
    pelo.adicionar({
      nu: 10,
      nv: 8,
      fechadoU: false,
      ponto(u, v, out) {
        const s0 = misturar(0.12, 0.92, v);
        const th = (u - 0.5) * 2 * 0.2;
        saia(th, s0, out);
        // normal aproximada: para fora no plano horizontal e um pouco para cima na barra
        saia(th, Math.min(1, s0 + 0.02), q);
        n.set(out.x, 0, out.z + 0.13).normalize();
        const k = -0.004 + 0.03 * perfilFaixa(u) * (1 + 0.3 * fbm3(u * 3, v * 4, 4.4, 2, 22));
        out.addScaledVector(n, k);
      },
      pesos: (_u, v, p) => pesosSaia(misturar(0.12, 0.92, v), p),
      cor: (u, _v, p) => cinza((0.9 + 0.1 * Math.sin(Math.PI * u)) * oclusao(p, 'tronco', 0.2)),
      pelo: (u) => [0.03 * suave(0.05, 0.45, perfilFaixa(u)), 1, 0.15],
      orientar: 1,
    });
  }
  /* ------------------------------------------------------- barra felpuda (bainha) */
  // fofura periódica em t (o anel fecha sem costura) e em u
  const fofura = (t: number, u: number, s: number, escala = 1) => {
    const a = t * Math.PI * 2;
    const b = u * Math.PI * 2;
    const tufos = fbm3(Math.cos(a) * 2.1 + s, Math.sin(a) * 2.1, Math.cos(b) * 0.35 + Math.sin(b) * 0.35, 3, 5);
    const ondas = fbm3(Math.cos(a) * 6 + s, Math.sin(a) * 6, Math.cos(b) * 0.8, 2, 15);
    return 1 + escala * (0.2 * tufos + 0.1 * ondas + 0.06 * Math.sin(a * 11 + s) * Math.sin(b * 2 + a * 2));
  };
  // a barra grossa e ondulada; o trecho de trás (encostado no assento e no encosto) não leva as cascas
  const barra = (t0: number, t1: number, soBase: boolean, nv: number) =>
    pelo.adicionar({
      nu: 8,
      nv,
      fechadoU: true,
      soBase,
      ponto: (u, v, out) =>
        anel(
          (t, o) => {
            bainha(t * Math.PI * 2, o);
            const n = V(o.x, 0, o.z + 0.13).normalize();
            o.addScaledVector(n, 0.03);
            // ondula a borda (baixa frequência), como pelúcia grossa assentada
            o.y += 0.012 * fbm3(Math.cos(t * Math.PI * 2) * 3, Math.sin(t * Math.PI * 2) * 3, 0.5, 2, 61);
          },
          (t, _p, o) => {
            const th = t * Math.PI * 2;
            o.set(Math.sin(th), 0.2, Math.cos(th)).normalize();
          },
          (uu, t) => {
            // na frente a barra deita no colo (larga e baixa); dos lados cai em pé (alta e estreita)
            const f = fofura(t, uu, 1.3, 1.1);
            const frente = Math.max(0, Math.cos(t * Math.PI * 2));
            return [misturar(0.058, 0.082, frente) * f, misturar(0.075, 0.052, frente) * f];
          },
        )(u, (t0 + (t1 - t0) * v + 1) % 1, out),
      pesos: (_u, _v, p) => pesosSaia(1, p),
      cor: (u, _v, p) => cinza((0.88 + 0.12 * suave(-0.6, 0.8, Math.cos(u * Math.PI * 2))) * oclusao(p, 'tronco', 0.18)),
      // sem pelo na parte que encosta nas coxas e no veludo (as cascas sairiam do outro lado)
      pelo: (u, v, p) => {
        bainha((t0 + (t1 - t0) * v) * Math.PI * 2, Q);
        return [0.034 * suave(-0.045, 0.0, p.y - Q.y) * suave(-0.6, 0.0, Math.cos(u * Math.PI * 2)), 1, 0.3];
      },
    });
  barra(-0.3, 0.3, false, 44);
  barra(0.3, 0.7, true, 20);

  /* ================================================================ pernas */
  for (const lado of [1, -1] as const) {
    const L = lado > 0 ? 'E' : 'D';
    const pr = esq.perna[L];
    const dirCoxa = pr.joelho.clone().sub(pr.quadril).normalize();
    const dirCanela = pr.tornozelo.clone().sub(pr.joelho).normalize();
    // perna curta e atarracada: a canela vai do joelho ao cano da bota (a bota apoia no pufe)
    const pontos = [
      pr.quadril.clone().addScaledVector(dirCoxa, -0.14),
      pr.quadril.clone(),
      pr.joelho.clone().addScaledVector(dirCoxa, -0.12),
      pr.joelho.clone().addScaledVector(dirCoxa, 0.02).addScaledVector(dirCanela, 0.02),
      pr.joelho.clone().addScaledVector(dirCanela, 0.11),
      pr.tornozelo.clone().addScaledVector(dirCanela, 0.01),
    ];
    const cam = new Caminho(pontos, { amostras: 96, normalInicial: V(0, 1, 0) });
    // posição do joelho ao longo do caminho (v)
    let vJoelho = 0.5;
    {
      let melhor = 1e9;
      const q = V(0, 0, 0);
      for (let i = 0; i <= 200; i++) {
        cam.em(i / 200, q);
        const d = q.distanceTo(pr.joelho);
        if (d < melhor) {
          melhor = d;
          vJoelho = i / 200;
        }
      }
    }
    // onde fica a barra felpuda da calça: uns 9 cm acima do tornozelo, para o cano da bota aparecer embaixo
    const ctr = V(0, 0, 0);
    const tg = V(0, 0, 0);
    let vCano = 0.9;
    for (let i = 0; i <= 100; i++) {
      cam.em(i / 100, ctr);
      if (ctr.y < pr.tornozelo.y + 0.09) {
        vCano = i / 100;
        break;
      }
    }
    const raioPerna = (u: number, v: number): readonly [number, number] => {
      // a calça é folgada: afina pouco no joelho e volta a abrir sobre a bota
      const r0 = v < vJoelho ? misturar(CORPO.coxa, 0.155, suave(0, vJoelho, v)) : misturar(0.152, CORPO.canela, suave(vJoelho, 1, v)) + 0.006 * suave(0.8, 1, v);
      // abaixo da barra felpuda a calça afina e some dentro do cano da bota (que é o que aparece ali)
      const r = misturar(r0, 0.06, suave(vCano - 0.005, vCano + 0.04, v));
      // rugas do tecido atrás do joelho e franzido sobre a bota
      const ang = u * Math.PI * 2;
      const atras = Math.max(0, -Math.cos(ang));
      const ruga = 0.008 * Math.sin(ang * 5 + v * 50) * sino(v - vJoelho, 0.07) * (0.4 + atras) + 0.006 * Math.sin(ang * 7 + v * 90) * suave(0.8, 0.97, v);
      return [r + ruga, r * 1.02 + ruga];
    };
    const pesosPerna = (v: number): Pesos => {
      const t = suave(vJoelho - 0.05, vJoelho + 0.05, v);
      const q = 1 - suave(0.0, 0.12, v);
      return [
        [I.quadril, q * 0.6],
        [I[`coxa${L}`], (1 - t) * (1 - q * 0.6)],
        [I[`canela${L}`], t],
      ];
    };
    veludo.adicionar({
      nu: 18,
      nv: 24,
      ponto: tubo(cam, raioPerna, { calota: 0.06 }),
      pesos: (_u, v) => pesosPerna(v),
      cor: (u, v, p) => {
        const ang = u * Math.PI * 2;
        const atras = Math.max(0, -Math.cos(ang));
        return corVeludo(p, 0.16 * atras * sino(v - vJoelho, 0.08) + 0.08 * (1 - suave(0.05, 0.25, v)), `coxa${L}`);
      },
    });

    // barra felpuda da calça, na altura do cano da bota (cobre o encontro da calça com a bota)
    cam.em(vCano, ctr, tg);
    const ex = V(1, 0, 0).sub(tg.clone().multiplyScalar(tg.x)).normalize();
    const ez = new THREE.Vector3().crossVectors(ex, tg).normalize();
    pelo.adicionar({
      nu: 8,
      nv: 20,
      ponto: anel(
        (t, out) => {
          const a = t * Math.PI * 2;
          out.copy(ctr).addScaledVector(ex, Math.cos(a) * 0.152).addScaledVector(ez, Math.sin(a) * 0.156);
        },
        (_t, p, out) => out.subVectors(p, ctr).normalize(),
        (u, t) => {
          const f = fofura(t, u, 7.1 + lado);
          return [0.056 * f, 0.066 * f];
        },
      ),
      pesos: () => um(`canela${L}`),
      cor: (u) => cinza(0.88 + 0.12 * suave(-0.6, 0.8, Math.cos(u * Math.PI * 2))),
      pelo: (u) => [0.032 * suave(-0.25, 0.45, Math.cos(u * Math.PI * 2)), 1, 0.4 + lado * 0.1],
    });

    /* ------------------------------------------------------------- botas */
    // couro marrom muito escuro, acetinado; bico redondo e comprido (bota de Noel, não sapato); sola separada com salto
    const tz = pr.tornozelo;
    const x = tz.x;
    const Y0 = PUFE.altura;
    const corBota = lin(CORES.bota);
    const corSola = lin(CORES.sola);
    const camBota = new Caminho(
      [V(x, tz.y + 0.12, tz.z - 0.02), V(x, tz.y + 0.02, tz.z - 0.01), V(x + lado * 0.004, Y0 + 0.06, tz.z + 0.06), V(x + lado * 0.01, Y0 + 0.052, tz.z + 0.185), V(x + lado * 0.014, Y0 + 0.056, tz.z + 0.27)],
      { amostras: 64, lateral: V(1, 0, 0) },
    );
    couro.adicionar({
      nu: 20,
      nv: 24,
      ponto: tubo(
        camBota,
        (u, v) => {
          // cano redondo; o pé alarga e achata; o bico é redondo e um pouco levantado
          const ang = u * Math.PI * 2;
          const pe = suave(0.35, 0.6, v);
          const largura = misturar(0.1, 0.07, pe) + 0.008 * sino(v - 0.82, 0.12);
          const altura = misturar(0.1, 0.056, pe) + 0.006 * sino(v - 0.8, 0.15);
          // vinco do cano (couro dobrando no tornozelo) e no peito do pé
          const vinco = 0.004 * Math.sin(ang * 5 + v * 40) * sino(v - 0.3, 0.07) + 0.003 * Math.sin(ang * 3 + 1) * sino(v - 0.62, 0.05);
          return [altura + vinco, largura + vinco];
        },
        {
          pontas: [false, true],
          calota: 0.18,
          deformar: (p) => {
            // assenta reto sobre a sola
            const chao = Y0 + 0.02;
            if (p.y < chao) p.y = chao + (p.y - chao) * 0.05;
          },
        },
      ),
      pesos: () => um(`pe${L}`),
      cor: (_u, v) => {
        // bico e calcanhar um pouco mais claros (couro gasto), cano mais escuro
        const k = 1 + 0.35 * sino(v - 0.93, 0.08) - 0.15 * (1 - suave(0, 0.2, v));
        return [corBota[0] * k, corBota[1] * k, corBota[2] * k];
      },
    });
    // sola com salto: laje de cantos redondos, um pouco maior que o pé, com borda chanfrada
    {
      const cz = tz.z + 0.1;
      const a = 0.085;
      const b = 0.205;
      const cx = x + lado * 0.008;
      const espessura = (zz: number) => (zz < tz.z - 0.005 ? 0.034 : 0.022);
      const contorno = (t: number, o: THREE.Vector3) => {
        const th = t * Math.PI * 2;
        const sn = Math.sin(th);
        const cs = Math.cos(th);
        // a frente (bico) é mais redonda que o calcanhar
        const e = cs > 0 ? 0.75 : 0.5;
        o.set(Math.sign(sn) * Math.pow(Math.abs(sn), e) * a * (cs > 0 ? 1 - 0.12 * cs : 1), 0, Math.sign(cs) * Math.pow(Math.abs(cs), e) * b);
        return o;
      };
      const q = V(0, 0, 0);
      couro.adicionar({
        nu: 24,
        nv: 8,
        ponto(u, v, out) {
          contorno(u, q);
          const r = q.length();
          const ch = 0.008;
          const dirx = q.x / (r || 1);
          const dirz = q.z / (r || 1);
          const h = espessura(cz + q.z);
          // salto: o calcanhar desce até o tampo e o meio do pé fica um pouco acima (arco)
          const y0 = Y0;
          let rr: number;
          let y: number;
          if (v < 0.15) {
            rr = (v / 0.15) * (r - ch);
            y = y0;
          } else if (v > 0.85) {
            rr = (1 - (v - 0.85) / 0.15) * (r - ch);
            y = y0 + h;
          } else {
            const ph = -Math.PI / 2 + ((v - 0.15) / 0.7) * Math.PI;
            rr = r - ch + ch * Math.cos(ph);
            y = y0 + h / 2 + (h / 2) * Math.sin(ph);
          }
          out.set(cx + dirx * rr, y, cz + dirz * rr);
        },
        pesos: () => um(`pe${L}`),
        cor: (u, v) => {
          // vinco entre o salto e a sola
          contorno(u, q);
          const vinco = sino(cz + q.z - (tz.z - 0.005), 0.006) * suave(0.3, 0.6, v) * (1 - suave(0.8, 0.9, v));
          const k = 1 - 0.6 * vinco;
          return [corSola[0] * k, corSola[1] * k, corSola[2] * k];
        },
        orientar: 1,
      });
    }
  }

  /* ================================================================= braços */
  for (const lado of [1, -1] as const) {
    const L = lado > 0 ? 'E' : 'D';
    const br = esq.braco[L];
    const a = br.eixo;
    const total = CORPO.braco + CORPO.antebraco;
    const ini = br.ombro.clone().addScaledVector(a, -0.03);
    const fim = br.pulso.clone().addScaledVector(a, -0.045);
    const cam = new Caminho([ini, ini.clone().lerp(fim, 0.5), fim], { amostras: 48, normalInicial: br.palma.clone().negate() });
    const vCot = (CORPO.braco + 0.03) / (total - 0.015);
    const raioManga = (u: number, v: number): readonly [number, number] => {
      const r = v < 0.12 ? misturar(0.118, 0.116, v / 0.12) : v < vCot ? misturar(0.116, 0.104, suave(0.12, vCot, v)) : misturar(0.104, 0.1, suave(vCot, 0.9, v)) + 0.01 * suave(0.9, 1, v);
      const ang = u * Math.PI * 2;
      // dobra do cotovelo: rugas do lado de dentro
      const dentro = Math.max(0, Math.cos(ang));
      const ruga = 0.007 * Math.sin(ang * 4 + v * 70) * sino(v - vCot, 0.08) * (0.5 + dentro) + 0.004 * Math.sin(ang * 6 + v * 110) * suave(0.85, 1, v);
      return [r + ruga, r + ruga];
    };
    veludo.adicionar({
      nu: 18,
      nv: 26,
      ponto: tubo(cam, raioManga, { pontas: [true, false], calota: 0.12 }),
      pesos: (_u, v) => {
        const t = suave(vCot - 0.07, vCot + 0.07, v);
        return [
          [I[`braco${L}`], 1 - t],
          [I[`antebraco${L}`], t],
        ];
      },
      cor: (u, v, p) => {
        const dentro = Math.max(0, Math.cos(u * Math.PI * 2));
        return corVeludo(p, 0.16 * dentro * sino(v - vCot, 0.1) + 0.1 * (1 - suave(0, 0.25, v)) * dentro, `braco${L}`);
      },
    });

    // punho felpudo
    const ctr = br.pulso.clone().addScaledVector(a, -0.04);
    const e1 = br.palma.clone();
    const e2 = new THREE.Vector3().crossVectors(a, e1).normalize();
    pelo.adicionar({
      nu: 8,
      nv: 20,
      ponto: anel(
        (t, out) => {
          const ang = t * Math.PI * 2;
          out.copy(ctr).addScaledVector(e1, Math.cos(ang) * 0.108).addScaledVector(e2, Math.sin(ang) * 0.108);
        },
        (_t, p, out) => out.subVectors(p, ctr).normalize(),
        (u, t) => {
          const f = fofura(t, u, 3.3 + lado);
          return [0.042 * f, 0.05 * f];
        },
      ),
      pesos: () => um(`antebraco${L}`),
      cor: (u) => cinza(0.88 + 0.12 * suave(-0.6, 0.8, Math.cos(u * Math.PI * 2))),
      pelo: (u) => [0.028 * suave(-0.25, 0.45, Math.cos(u * Math.PI * 2)), 1, 0.5 + lado * 0.1],
    });

    /* ----------------------------------------------------------- luvas */
    const W = br.pulso;
    // luvas GRANDES como na referência: tudo é esculpido no tamanho base e ampliado em volta do pulso no fim
    const inicioLuva = luva.vertices;
    // punho da luva: enche a boca da manga (nada de veludo aparecendo quando a mão dobra)
    {
      const cp = new Caminho([W.clone().addScaledVector(a, -0.09), W.clone().addScaledVector(a, -0.03), W.clone().addScaledVector(a, 0.03)], { amostras: 8 });
      luva.adicionar({
        nu: 14,
        nv: 6,
        ponto: tubo(cp, (_u, v) => [0.072 - 0.01 * v, 0.068 - 0.01 * v], { pontas: [true, false], calota: 0.2 }),
        pesos: (_u, v) => [
          [I[`antebraco${L}`], 1 - suave(0.5, 1, v)],
          [I[`mao${L}`], suave(0.5, 1, v)],
        ],
        cor: () => cinza(0.85),
      });
    }
    const pal = br.palma; // normal da palma (para baixo)
    const pol = br.polegar; // lado do polegar
    const palmaC = W.clone().addScaledVector(a, 0.07);
    const qBase = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(pol, pal.clone().negate(), a));
    // palma: elipsoide achatado (x = lado do polegar, y = costas da mão, z = dedos)
    luva.adicionar({
      nu: 18,
      nv: 12,
      ponto: elipsoide(palmaC, V(0.066, 0.038, 0.08), {
        base: qBase,
        deformar: (d) => 1 + 0.1 * Math.max(0, -d.z) - 0.08 * Math.max(0, -d.y) * Math.max(0, d.z) + 0.04 * Math.max(0, d.y),
      }),
      pesos: (_u, _v, p) => {
        const t = suave(-0.02, 0.05, p.clone().sub(W).dot(a));
        return [
          [I[`antebraco${L}`], (1 - t) * 0.4],
          [I[`mao${L}`], 1 - (1 - t) * 0.4],
        ];
      },
      cor: () => cinza(1),
    });
    // três dedos gordos
    const dedos: Array<[number, number]> = [
      [0.04, 0.088],
      [0.0, 0.094],
      [-0.04, 0.084],
    ];
    for (const [off, len] of dedos) {
      const base = W.clone().addScaledVector(a, 0.1).addScaledVector(pol, off);
      const meio = base.clone().addScaledVector(a, len * 0.55).addScaledVector(pol, off * 0.15).addScaledVector(pal, 0.006);
      const ponta = base.clone().addScaledVector(a, len).addScaledVector(pol, off * 0.3).addScaledVector(pal, 0.02);
      const cd = new Caminho([base, meio, ponta], { amostras: 16, normalInicial: pal.clone().negate() });
      luva.adicionar({
        nu: 9,
        nv: 10,
        ponto: tubo(cd, (_u, v) => [0.025 - 0.003 * v, 0.027 - 0.003 * v], { calota: 0.22 }),
        pesos: (_u, v) => [
          [I[`mao${L}`], 1 - suave(0.1, 0.45, v)],
          [I[`dedos${L}`], suave(0.1, 0.45, v)],
        ],
        cor: (_u, v) => cinza(0.86 + 0.14 * suave(0.05, 0.35, v)),
      });
    }
    // polegar
    {
      const base = W.clone().addScaledVector(a, 0.03).addScaledVector(pol, 0.04).addScaledVector(pal, 0.008);
      const meio = W.clone().addScaledVector(a, 0.075).addScaledVector(pol, 0.088).addScaledVector(pal, 0.022);
      const ponta = W.clone().addScaledVector(a, 0.115).addScaledVector(pol, 0.098).addScaledVector(pal, 0.04);
      const cd = new Caminho([base, meio, ponta], { amostras: 16, normalInicial: pal.clone().negate() });
      luva.adicionar({
        nu: 10,
        nv: 10,
        ponto: tubo(cd, (_u, v) => [0.027 - 0.004 * v, 0.029 - 0.004 * v], { calota: 0.22 }),
        pesos: (_u, v) => [
          [I[`mao${L}`], 1 - suave(0.15, 0.5, v)],
          [I[`polegar${L}`], suave(0.15, 0.5, v)],
        ],
        cor: (_u, v) => cinza(0.86 + 0.14 * suave(0.05, 0.35, v)),
      });
    }
    const ESCALA_LUVA = 1.2;
    for (let k = inicioLuva * 3; k < luva.pos.length; k += 3) {
      luva.pos[k] = W.x + (luva.pos[k] - W.x) * ESCALA_LUVA;
      luva.pos[k + 1] = W.y + (luva.pos[k + 1] - W.y) * ESCALA_LUVA;
      luva.pos[k + 2] = W.z + (luva.pos[k + 2] - W.z) * ESCALA_LUVA;
    }
  }

  /* ================================================================= cabeça */
  const centroCab = V(c.x, c.y, c.z);
  const corPele = lin(CORES.pele);
  const corBochecha = lin(CORES.bochecha);
  const corNariz = lin(CORES.nariz);
  const dirBochE = V(0.52, -0.24, 0.8).normalize();
  const dirBochD = V(-0.52, -0.24, 0.8).normalize();
  const dirOlhoE = esq.olho.E.clone().sub(centroCab).normalize();
  const dirOlhoD = esq.olho.D.clone().sub(centroCab).normalize();
  const ang = (a: THREE.Vector3, b: THREE.Vector3) => Math.acos(limitar(a.dot(b), -1, 1));
  pele.adicionar({
    nu: 36,
    nv: 26,
    ponto: elipsoide(centroCab, V(c.rx, c.ry, c.rz), {
      deformar: (d) => {
        let k = 1;
        // bochechas redondas e altas, que sobem por cima do bigode
        k += 0.17 * Math.exp(-Math.pow(ang(d, dirBochE) / 0.4, 2)) + 0.17 * Math.exp(-Math.pow(ang(d, dirBochD) / 0.4, 2));
        // cavidade dos olhos
        k -= 0.04 * Math.exp(-Math.pow(ang(d, dirOlhoE) / 0.19, 2)) + 0.04 * Math.exp(-Math.pow(ang(d, dirOlhoD) / 0.19, 2));
        // testa
        k += 0.03 * Math.exp(-Math.pow(ang(d, V(0, 0.45, 0.9).normalize()) / 0.35, 2));
        k -= 0.04 * Math.max(0, -d.z) * Math.max(0, d.y);
        return k;
      },
    }),
    pesos: () => um('cabeca'),
    cor: (_u, _v, p) => {
      const d = p.clone().sub(centroCab).normalize();
      const b = Math.exp(-Math.pow(ang(d, dirBochE) / 0.36, 2)) + Math.exp(-Math.pow(ang(d, dirBochD) / 0.36, 2));
      // rubor forte e alto nas bochechas; pele mais quente (avermelhada) para as bordas do rosto, como
      // a luz que atravessa a pele; um pouco de rosa na testa e no queixo
      const borda = 1 - Math.max(0, d.z);
      const base = mixCor(corPele, [corPele[0], corPele[1] * 0.8, corPele[2] * 0.75], 0.35 * borda);
      return mixCor(base, corBochecha, Math.min(0.92, b * 1.15));
    },
  });
  // nariz de bolota
  const narizC = V(0, c.y - 0.05, c.z + 0.252);
  pele.adicionar({
    nu: 22,
    nv: 16,
    ponto: elipsoide(narizC, V(0.064, 0.058, 0.056), { deformar: (d) => 1 + 0.07 * Math.max(0, -d.y) - 0.05 * Math.max(0, -d.z) }),
    pesos: () => um('cabeca'),
    cor: (_u, _v, p) => {
      const d = p.clone().sub(narizC).normalize();
      // ponta mais clara (brilho de pele) e base mais corada
      const t = Math.max(0, d.dot(V(0, 0.45, 0.89).normalize()));
      return mixCor(corNariz, mixCor(corPele, [1, 0.8, 0.75], 0.3), Math.pow(t, 5) * 0.5);
    },
  });
  // orelhas
  for (const lado of [1, -1] as const) {
    const oc = V(lado * 0.236, c.y - 0.005, c.z + 0.0);
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.1, lado * 0.3, lado * -0.15));
    pele.adicionar({
      nu: 14,
      nv: 12,
      ponto: elipsoide(oc, V(0.034, 0.07, 0.054), {
        base: q,
        deformar: (d) => 1 - 0.45 * Math.max(0, d.x * lado) * Math.exp(-(d.y * d.y + d.z * d.z) / 0.35),
      }),
      pesos: () => um('cabeca'),
      cor: (_u, _v, p) => mixCor(corPele, corBochecha, 0.5 + 0.35 * suave(0, 0.02, (p.x - oc.x) * lado)),
    });
  }

  /* ---------------------------------------------------------- olhos e pálpebras */
  // olhos simpáticos: esclera branco-quente, íris castanha com aro escuro, pupila; cada olho gira no
  // próprio osso (o olhar segue o visitante). A pálpebra de cima cobre um pouco em repouso.
  const corEsclera = lin('#f6efe6');
  const corIris = lin(CORES.iris);
  const corAro = lin('#2a170c');
  const corPupila = lin('#070302');
  const RAIO_OLHO = 0.045;
  for (const lado of [1, -1] as const) {
    const L = lado > 0 ? 'E' : 'D';
    const oc = esq.olho[L];
    const frente = V(0, 0.02, 1).normalize();
    olhos.adicionar({
      nu: 20,
      nv: 16,
      ponto: elipsoide(oc, V(RAIO_OLHO, RAIO_OLHO, RAIO_OLHO)),
      pesos: () => um(`olho${L}`),
      cor: (_u, _v, p) => {
        const d = p.clone().sub(oc).normalize();
        const a2 = ang(d, frente);
        if (a2 < 0.27) return corPupila;
        if (a2 < 0.56) return mixCor(corIris, corAro, suave(0.44, 0.56, a2) * 0.9 + 0.2 * (1 - suave(0.27, 0.34, a2)));
        if (a2 < 0.6) return mixCor(corAro, corEsclera, suave(0.56, 0.6, a2));
        // esclera um pouco mais escura para as bordas (sombra da pálpebra)
        return mixCor(corEsclera, lin('#d8c2b4'), suave(0.9, 1.6, a2));
      },
    });
    // pálpebra de cima: calota de pele sobre o olho (gira para piscar; em repouso já cobre a borda de cima)
    const rp = RAIO_OLHO * 1.12;
    pele.adicionar({
      nu: 18,
      nv: 6,
      ponto: (u, v, out) => {
        const th = u * Math.PI * 2;
        const ph = v * 0.95;
        // a borda da pálpebra engrossa um pouco (cílio sugerido pela cor)
        const r = rp * (1 + 0.06 * suave(0.85, 1, v));
        out.set(Math.sin(ph) * Math.sin(th) * r * 1.04, Math.cos(ph) * r, Math.sin(ph) * Math.cos(th) * r).add(oc);
      },
      pesos: () => um(`palpebra${L}`),
      cor: (_u, v) => (v > 0.9 ? mixCor(corPele, lin('#7a4a3a'), 0.6) : mixCor(corPele, corBochecha, 0.12 + 0.18 * v)),
    });
  }

  /* --------------------------------------------------------------------- boca */
  // fundo da boca em pele vinho-escura (sem brilho de vidro), língua e lábio
  const bocaC = V(0, c.y - 0.142, c.z + 0.2);
  pele.adicionar({
    nu: 16,
    nv: 10,
    ponto: elipsoide(bocaC, V(0.05, 0.034, 0.034)),
    pesos: (_u, _v, p) => (p.y < bocaC.y ? um('queixo') : um('cabeca')),
    cor: () => lin('#2c0b0c'),
    orientar: 1,
  });
  pele.adicionar({
    nu: 12,
    nv: 8,
    ponto: elipsoide(bocaC.clone().add(V(0, -0.02, 0.012)), V(0.034, 0.012, 0.022)),
    pesos: () => um('queixo'),
    cor: () => lin('#b8505a'),
  });
  // lábio de baixo, cheio
  {
    const pts = [V(-0.044, bocaC.y - 0.022, bocaC.z + 0.012), V(0, bocaC.y - 0.033, bocaC.z + 0.032), V(0.044, bocaC.y - 0.022, bocaC.z + 0.012)];
    const cam = new Caminho(pts, { amostras: 16 });
    pele.adicionar({ nu: 12, nv: 14, ponto: tubo(cam, (_u, v) => [0.014 * (0.75 + 0.25 * Math.sin(Math.PI * v)), 0.015 * (0.75 + 0.25 * Math.sin(Math.PI * v))], { calota: 0.2 }), pesos: () => um('queixo'), cor: () => lin('#d9776f') });
  }

  /* ----------------------------------------------------------------- óculos */
  {
    const aros: THREE.Vector3[] = [];
    const raioAro = 0.061;
    for (const lado of [1, -1] as const) {
      const L = lado > 0 ? 'E' : 'D';
      const ac = esq.olho[L].clone().add(V(lado * 0.006, -0.002, 0.062));
      aros.push(ac);
      const giro = new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), lado * 0.22);
      const ex = V(1, 0, 0).applyQuaternion(giro);
      const ey = V(0, 1, 0);
      ouro.adicionar({
        nu: 6,
        nv: 32,
        ponto: anel(
          (t, out) => {
            const a2 = t * Math.PI * 2;
            out.copy(ac).addScaledVector(ex, Math.cos(a2) * raioAro).addScaledVector(ey, Math.sin(a2) * raioAro * 0.97);
          },
          (_t, p, out) => out.subVectors(p, ac).normalize(),
          () => [0.0055, 0.0045],
        ),
        pesos: () => um('cabeca'),
      });
      // haste até a orelha
      const ini = ac.clone().addScaledVector(ex, raioAro);
      const haste = new Caminho([ini, ini.clone().add(V(lado * 0.025, 0.004, -0.05)), V(lado * 0.238, c.y + 0.02, c.z + 0.02), V(lado * 0.238, c.y - 0.01, c.z - 0.06)], { amostras: 20 });
      ouro.adicionar({ nu: 6, nv: 20, ponto: tubo(haste, () => [0.0042, 0.0042], { calota: 0.06 }), pesos: () => um('cabeca') });
    }
    // ponte em arco sobre o nariz
    const ex0 = V(1, 0, 0).applyQuaternion(new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), 0.22));
    const e = aros[0].clone().addScaledVector(ex0, -raioAro).add(V(0, 0.008, 0));
    const d = V(-e.x, e.y, e.z);
    const ponte = new Caminho([e, V(0, e.y + 0.014, e.z + 0.014), d], { amostras: 16 });
    ouro.adicionar({ nu: 6, nv: 16, ponto: tubo(ponte, () => [0.0045, 0.0045], { calota: 0.05 }), pesos: () => um('cabeca') });
  }

  /* ================================================== barba, bigode e sobrancelhas */
  // fios: raiz um pouco mais escura (oclusão entre as mechas), ponta clara
  const corFio = (v: number, p?: THREE.Vector3): Cor => cinza((0.66 + 0.3 * suave(0.0, 0.5, v)) * (p ? oclusao(p, 'barba', 0.25) : 1));
  let sementeMecha = 0;
  const sorteio = criarSorteio(77);
  const addMecha = (
    pts: THREE.Vector3[],
    raio: number,
    fora: THREE.Vector3,
    pesos: (v: number, p: THREE.Vector3) => Pesos,
    opts: { achatar?: number; afinar?: number; barriga?: number; folga?: number; nu?: number; nv?: number; lobos?: number } = {},
  ) => {
    const s = sementeMecha++;
    // não deixa a mecha entrar no peito
    if (opts.folga !== undefined) for (const p of pts) foraDoTronco(p, opts.folga);
    const cam = new Caminho(pts, { amostras: 40 });
    const lobos = opts.lobos ?? 0;
    mechas.adicionar({
      nu: opts.nu ?? 12,
      nv: opts.nv ?? 10,
      ponto: mecha({ caminho: cam, raio, achatar: opts.achatar ?? 0.7, fora, afinar: opts.afinar, barriga: opts.barriga }, (u, v) => {
        // relevo de fios grossos ao longo da mecha e, na ponta, a mecha se abre em 2 ou 3 tufinhos (lóbulos)
        const a = u * Math.PI * 2;
        // ondulação larga (3 cristas em volta): o fio fino fica no mapa de normal, senão facetaria
        const fio = 0.035 * Math.sin(a * 3 + s * 1.3 + v * 2) * (0.4 + 0.6 * v);
        const ponta = lobos ? 0.22 * suave(0.45, 0.95, v) * Math.max(-0.4, Math.cos(a * lobos + s)) : 0;
        return 0.08 * fbm3(u * 4, v * 3, s * 1.7, 2, 31) + fio + ponta;
      }),
      pesos: (_u, v, p) => pesos(v, p),
      cor: (_u, v, p) => corFio(v, p),
      uv: (u, v) => [u * 0.5 + s * 0.17, v * 0.25 + s * 0.31],
    });
  };
  // a barba nasce no rosto (cabeça e queixo) e pousa no peito: quanto mais baixo o ponto, mais ele segue
  // o osso da barba (filho do peito); assim a cabeça pode virar e baixar sem a barba entrar no corpo
  const pesoBarba = (raizY: number) => (_v: number, p: THREE.Vector3): Pesos => {
    const j = suave(c.y - 0.08, c.y - 0.16, raizY);
    const t = suave(c.y - 0.12, c.y - 0.36, p.y);
    return [
      [I.cabeca, (1 - t) * (1 - j)],
      [I.queixo, (1 - t) * j],
      [I.barba, t],
    ];
  };
  const C = (x: number, y: number, z: number) => V(c.x + x, c.y + y, c.z + z);

  // massa da barba por baixo das mechas: larga e redonda como um babador (nada de buraco entre elas)
  mechas.adicionar({
    nu: 20,
    nv: 14,
    ponto: elipsoide(C(0, -0.19, 0.1), V(0.215, 0.18, 0.125), {
      deformar: (d) => {
        const ponta = Math.max(0, -d.y - 0.3);
        return 1 - 0.25 * ponta * Math.abs(d.x) * 2 + 0.06 * fbm3(d.x * 3, d.y * 3, d.z * 3, 2, 5);
      },
    }),
    pesos: (_u, _v, p) => pesoBarba(p.y + 0.05)(0.5, p),
    cor: () => cinza(0.72),
    uv: (u, v) => [u * 1.6, v * 0.5],
  });
  // costeletas: descem da aba do gorro pela lateral do rosto, À FRENTE das orelhas (que aparecem)
  for (const lado of [1, -1] as const) {
    // fina sob a aba e engrossando para baixo, onde vira barba; acompanha a curva da bochecha e ondula
    addMecha([C(lado * 0.212, 0.1, 0.045), C(lado * 0.232, 0.02, 0.085), C(lado * 0.226, -0.07, 0.115), C(lado * 0.19, -0.16, 0.14)], 0.043, V(lado, 0, 0.5), pesoBarba(c.y - 0.05), { achatar: 0.75, afinar: 0.25, barriga: 0.75, nu: 12, nv: 12, lobos: 3 });
  }
  // fileiras de cachos, de cima (mandíbula) para baixo; cada fileira um pouco à frente da de cima. Barba
  // CURTA e larga, como na referência: termina no alto do peito, com a borda de baixo em 4 ou 5 pontas
  const fileiras = [
    { y: -0.1, meia: 0.215, n: 7, comp: 0.16, raio: 0.088, z: 0.13 },
    { y: -0.17, meia: 0.185, n: 6, comp: 0.15, raio: 0.086, z: 0.16 },
    { y: -0.235, meia: 0.135, n: 5, comp: 0.13, raio: 0.08, z: 0.175 },
    { y: -0.29, meia: 0.06, n: 2, comp: 0.115, raio: 0.074, z: 0.182 },
  ];
  for (const f of fileiras) {
    for (let k = 0; k < f.n; k++) {
      const s = f.n === 1 ? 0 : (k / (f.n - 1)) * 2 - 1; // -1 .. 1
      const jit = () => sorteio() * 2 - 1;
      const x = s * f.meia + 0.01 * jit();
      const raiz = C(x, f.y + 0.035 * s * s + 0.008 * jit(), f.z - 0.11 * s * s);
      const comp = f.comp * (1 + 0.12 * jit()) * (1 - 0.18 * s * s);
      const sai = V(s * 0.6, 0.1, 1).normalize();
      // desce, abre um pouco para o lado e enrola a ponta para a frente e para dentro (cacho macio)
      // as mechas de baixo terminam em ponta macia (a borda da barba em ondas), as de cima se fundem na massa
      const baixo = f.y < -0.2 || Math.abs(s) > 0.8;
      const p1 = raiz.clone().add(V(s * 0.02, -comp * 0.45, 0.02));
      const p2 = raiz.clone().add(V(s * 0.024, -comp * 0.82, 0.032));
      const p3 = raiz.clone().add(V(s * 0.008 - x * 0.1, -comp * 1.05, 0.036));
      addMecha([raiz, p1, p2, p3], f.raio * (1 + 0.08 * jit()), sai, pesoBarba(raiz.y), { folga: 0.05, achatar: 0.55, afinar: baixo ? 0.62 : 0.5, barriga: 0.38, nu: 12, nv: 12, lobos: baixo ? 0 : 2 });
    }
  }
  // massa do cabelo atrás da cabeça, de orelha a orelha, sob a aba (as mechas da nuca saem dela)
  {
    const cc = C(0, -0.01, -0.012);
    mechas.adicionar({
      nu: 44,
      nv: 9,
      fechadoU: false,
      ponto(u, v, out) {
        const th = Math.PI * (0.6 + 0.8 * u);
        // borda de baixo em ondas (pontas de mechas), não um corte reto
        const onda = 0.5 + 0.5 * Math.sin(u * Math.PI * 11 + 0.8);
        const ph = Math.PI * (0.3 + (0.33 + 0.07 * onda) * v);
        const k = 1 + 0.04 * fbm3(Math.cos(th) * 3, ph * 2, 1.3, 2, 71) + 0.05 * suave(0.4, 1, v) * (0.6 + 0.4 * onda) + 0.02 * Math.sin(u * Math.PI * 11 + 0.8) * v - 0.04 * (1 - v);
        out.set(Math.sin(ph) * Math.sin(th) * 0.24 * k, Math.cos(ph) * 0.235 * k, Math.sin(ph) * Math.cos(th) * 0.233 * k).add(cc);
      },
      pesos: () => um('cabeca'),
      cor: (_u, v) => cinza(0.7 + 0.2 * v),
      uv: (u, v) => [u * 1.4, v * 0.4],
      orientar: -1,
    });
  }
  // bigode: dois tufos grandes que saem de baixo do nariz e se curvam para fora e para cima
  for (const lado of [1, -1] as const) {
    const pts = [C(lado * 0.01, -0.113, 0.278), C(lado * 0.075, -0.135, 0.27), C(lado * 0.145, -0.135, 0.232), C(lado * 0.192, -0.106, 0.176), C(lado * 0.206, -0.068, 0.143)];
    addMecha(pts, 0.054, V(lado * 0.2, 0.2, 1), (v) => [
      [I.cabeca, 1 - 0.3 * v],
      [I.queixo, 0.3 * v],
    ], { achatar: 0.78, afinar: 0.7, barriga: 0.3, nu: 16, nv: 12, lobos: 2 });
    const pts2 = [C(lado * 0.02, -0.133, 0.263), C(lado * 0.08, -0.153, 0.25), C(lado * 0.14, -0.158, 0.21), C(lado * 0.175, -0.143, 0.165)];
    addMecha(pts2, 0.042, V(lado * 0.2, -0.3, 1), () => [
      [I.cabeca, 0.7],
      [I.queixo, 0.3],
    ], { achatar: 0.75, nu: 12, nv: 10 });
  }
  // sobrancelhas fartas: um arco largo e achatado por lado, que cai macio para fora sobre o aro, e duas
  // mechas finas por cima com as pontas soltas para fora e para baixo (nada de gomos repetidos)
  for (const lado of [1, -1] as const) {
    const L = lado > 0 ? 'E' : 'D';
    const arco = [C(lado * 0.022, 0.088, 0.236), C(lado * 0.07, 0.108, 0.228), C(lado * 0.12, 0.1, 0.205), C(lado * 0.158, 0.066, 0.165), C(lado * 0.17, 0.04, 0.14)];
    addMecha(arco, 0.04, V(0, 0.5, 1), () => um(`sobrancelha${L}`), { achatar: 0.5, afinar: 0.55, barriga: 0.35, nu: 14, nv: 12, lobos: 2 });
    for (let k = 0; k < 2; k++) {
      const x0 = lado * (0.04 + k * 0.05);
      const raiz = C(x0, 0.112 - 0.004 * k, 0.228 - 0.02 * k);
      const meio = raiz.clone().add(V(lado * 0.04, 0.012 - 0.006 * k, -0.008));
      const ponta = raiz.clone().add(V(lado * 0.085, -0.02 - 0.012 * k, -0.03));
      addMecha([raiz, meio, ponta], 0.022, V(0, 0.6, 1), () => um(`sobrancelha${L}`), { achatar: 0.55, afinar: 0.8, barriga: 0.3, nu: 8, nv: 8 });
    }
  }

  /* =================================================================== gorro */
  const g = esq.gorro;
  const camGorro = new Caminho(g, { amostras: 64, normalInicial: V(0, 0, 1) });
  const vsG = [0, 0.18, 0.4, 0.62, 0.82];
  const nomesG = ['cabeca', 'gorro1', 'gorro2', 'gorro3', 'gorro4'];
  const pesosGorro = (v: number): Pesos => {
    const out: Array<[number, number]> = [];
    for (let k = 0; k < vsG.length; k++) {
      const w = Math.max(0, 1 - Math.abs(v - vsG[k]) / 0.2);
      if (w > 0) out.push([I[nomesG[k]], w]);
    }
    return out;
  };
  veludo.adicionar({
    nu: 24,
    nv: 28,
    ponto: tubo(
      camGorro,
      (u, v) => {
        // pano mole: bem largo na base (envolve a cabeça), afina devagar e só fecha perto da ponta
        const base = 0.238 * Math.pow(1 - v, 0.72) + 0.026 * v;
        const ang2 = u * Math.PI * 2;
        // 2 ou 3 dobras de tecido do lado de dentro da curva (para onde o gorro tomba)
        const dentro = Math.max(0, -Math.cos(ang2));
        const vinco = 0.014 * Math.sin(v * 26 + 0.5) * sino(v - 0.5, 0.2) * dentro + 0.006 * Math.sin(ang2 * 3 + v * 9) * sino(v - 0.45, 0.2);
        return [base + vinco, base * 0.97 + vinco];
      },
      { pontas: [false, true], calota: 0.06 },
    ),
    pesos: (_u, v) => pesosGorro(v),
    cor: (u, v, p) => {
      const dentro = Math.max(0, -Math.cos(u * Math.PI * 2));
      return corVeludo(p, 0.1 * (1 - suave(0, 0.15, v)) + 0.14 * dentro * sino(v - 0.5, 0.22), 'cabeca');
    },
  });
  // aba felpuda (o terço de trás, que só se vê por trás, fica sem as cascas)
  const abaC = V(c.x, c.y + 0.162, c.z - 0.008);
  const aba = (t0: number, t1: number, soBase: boolean, nv: number) =>
    pelo.adicionar({
      nu: 8,
      nv,
      soBase,
      ponto: (u, v, out) =>
        anel(
          (t, o) => {
            const a2 = t * Math.PI * 2;
            const frente = Math.cos(a2);
            o.set(abaC.x + Math.sin(a2) * 0.23, abaC.y - 0.012 * frente, abaC.z + Math.cos(a2) * 0.224);
          },
          (t, _p, o) => {
            const a2 = t * Math.PI * 2;
            o.set(Math.sin(a2), 0, Math.cos(a2));
          },
          (uu, t) => {
            const f = fofura(t, uu, 9.1, 1.25);
            return [0.054 * f, 0.07 * f];
          },
        )(u, (t0 + (t1 - t0) * v + 1) % 1, out),
      pesos: () => um('cabeca'),
      cor: (u) => cinza(0.88 + 0.12 * suave(-0.6, 0.8, Math.cos(u * Math.PI * 2))),
      pelo: (u) => [0.028 * suave(-0.25, 0.45, Math.cos(u * Math.PI * 2)), 1, 0.7],
    });
  aba(-0.36, 0.36, false, 32);
  aba(0.36, 0.64, true, 12);
  // pompom
  const pomC = g[g.length - 1].clone().add(V(0.01, -0.045, 0));
  pelo.adicionar({
    nu: 14,
    nv: 10,
    ponto: elipsoide(pomC, V(0.072, 0.072, 0.072), { deformar: (d) => 1 + 0.14 * fbm3(d.x * 2.5, d.y * 2.5, d.z * 2.5, 3, 41) }),
    pesos: () => um('gorro4'),
    cor: () => cinza(0.96),
    pelo: () => [0.028, 1, 0.8],
  });

  return { veludo, pelo, mechas, pele, luva, couro, ouro, olhos };
}
