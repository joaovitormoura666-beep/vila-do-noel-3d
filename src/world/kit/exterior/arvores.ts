/**
 * Árvores do exterior, todas geradas por código com semente:
 *  - árvore nua, de galhos de verdade (ramificação recursiva de tubos que afinam, entortam e buscam a luz),
 *    com neve pousada em cima dos galhos grossos;
 *  (os pinheiros e o bosque ficam em pinheiros.ts)
 */
import * as THREE from 'three';
import { type Malha, type CorVertice, type Rng, criarRng, faixa, fbm } from './util';

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const CIMA = new THREE.Vector3(0, 1, 0);

export interface ArvoreNuaOpc {
  altura: number;
  raioTronco: number;
  /** Níveis de ramificação além do tronco (4 = árvore de primeiro plano; 2 ou 3 = árvores da vila). */
  niveis: number;
  semente: number;
  /** Quanto a copa se abre (1 = normal). */
  abertura?: number;
  /** Raio mínimo de galho que recebe neve em cima (em metros locais). 0 = sem neve. */
  neveAcimaDe?: number;
  /** Inclinação do tronco: vetor horizontal pequeno somado à direção inicial. */
  inclina?: [number, number];
  /** 'baixo' = menos lados, segmentos e filhos por galho (árvores pequenas na tela). */
  detalhe?: 'alto' | 'baixo';
}

/** Semente de um filho a partir da do pai e do índice: cada galho tem o seu próprio gerador. */
const sementeFilho = (pai: number, i: number) => (Math.imul(pai ^ 0x9e3779b9, 0x85ebca6b) + Math.imul(i + 1, 0xc2b2ae35)) >>> 0;

/**
 * Árvore nua. A matriz dá posição, giro e escala; a geometria vai para `casca` e a neve dos galhos para `neve`.
 * Cada galho tem o seu gerador e uma linha de controle fixa (quatro trechos) que é reamostrada por Catmull-Rom:
 * o nível de detalhe muda só lados e segmentos (e pode cortar o último nível), nunca a forma.
 */
export function construirArvoreNua(casca: Malha, neve: Malha | null, M: THREE.Matrix4, opc: ArvoreNuaOpc) {
  const abre = opc.abertura ?? 1;
  const baixo = opc.detalhe === 'baixo';
  const filhos = baixo ? [3, 3, 3, 2, 2] : [4, 4, 4, 2, 2];
  const segs = baixo ? [5, 4, 3, 2, 2] : [12, 9, 7, 4, 2];
  const lados = baixo ? [7, 5, 4, 3, 3] : [12, 8, 6, 4, 3];
  const torto = [0.12, 0.3, 0.36, 0.42, 0.45];
  const sobe = [0.0, 0.13, 0.17, 0.13, 0.07];
  const limiarNeve = opc.neveAcimaDe ?? 0;
  const escalaM = new THREE.Vector3().setFromMatrixScale(M).x;
  casca.definir(M);
  neve?.definir(M);
  const NC = 4;

  const ramo = (inicio: THREE.Vector3, dir: THREE.Vector3, comp: number, raio: number, nivel: number, sem: number) => {
    const rng = criarRng(sem);
    const nv = Math.min(nivel, 4);
    // linha de controle: sempre quatro trechos e três sorteios por trecho
    const ctrl: THREE.Vector3[] = [inicio.clone()];
    const d = dir.clone().normalize();
    const p = inicio.clone();
    for (let s = 1; s <= NC; s++) {
      const k = torto[nv];
      d.x += (rng() - 0.5) * 2 * k;
      d.y += (rng() - 0.5) * 2 * k * 0.6 + sobe[nv] * 1.4;
      d.z += (rng() - 0.5) * 2 * k;
      d.normalize();
      p.addScaledVector(d, comp / NC);
      ctrl.push(p.clone());
    }
    const curvaR = new THREE.CatmullRomCurve3(ctrl, false, 'centripetal');
    const n = segs[nv];
    const pts = curvaR.getPoints(n);
    const raioEm = (t: number) => (nivel === 0 ? raio * (1 - 0.34 * t) * (1 + 0.25 * Math.exp(-t * 14)) : raio * (1 - 0.62 * Math.pow(t, 0.85)) * (1 + 0.32 * Math.exp(-t * 18)));
    const raios = pts.map((_, i) => raioEm(i / n));
    const c: CorVertice | undefined = nivel >= 3 ? { r: 0.8, g: 0.8, b: 0.85 } : undefined;
    casca.tubo(pts, raios, lados[nv], nivel === 0 ? 1.0 : 0.7, c, nivel > 0);

    // neve pousada: tira em arco (cinco pontos) por cima dos trechos que não são quase verticais, com falhas
    const semNeve = rng() * 40;
    if (neve && limiarNeve > 0 && raio > limiarNeve && nivel > 0) {
      const lado = new THREE.Vector3();
      const cimaP = new THREE.Vector3();
      const tg = new THREE.Vector3();
      neve.grade(
        n + 1,
        5,
        (i, j, out) => {
          if (i < n) tg.subVectors(pts[i + 1], pts[i]);
          else tg.subVectors(pts[i], pts[i - 1]);
          tg.normalize();
          cimaP.copy(CIMA).addScaledVector(tg, -tg.y);
          const deitado = cimaP.length(); // 1 = horizontal, 0 = vertical
          cimaP.normalize();
          lado.crossVectors(tg, cimaP);
          const r = raios[i];
          const t = i / n;
          // pontas arredondadas e trechos sem neve onde o ruído cai
          const pontas = Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.05)), 0.5);
          const falha = THREE.MathUtils.smoothstep(fbm(t * 3.4 + semNeve, semNeve, 2), 0.32, 0.5);
          const esp = Math.min(0.085 / escalaM, r * 1.5 + 0.012) * (0.4 + 0.9 * fbm(t * 6 + semNeve, semNeve * 0.3, 2)) * Math.max(0, deitado * 1.5 - 0.5) * pontas * falha;
          const a = ((j - 2) / 2) * 1.25;
          const meio = Math.cos(((j - 2) / 2) * Math.PI * 0.5);
          out.copy(pts[i])
            .addScaledVector(cimaP, Math.cos(a) * r * 1.02 + esp * meio)
            .addScaledVector(lado, Math.sin(a) * (r * 1.02 + esp * 0.35));
        },
        0.9,
      );
    }

    if (nivel >= opc.niveis) return;
    // filhos ao longo do ramo, girando em volta dele pelo ângulo de ouro; mais um na ponta, que o continua
    const nf = filhos[nv];
    const eixo = new THREE.Vector3();
    const perp = new THREE.Vector3();
    const origem = new THREE.Vector3();
    const tg = new THREE.Vector3();
    let az = rng() * Math.PI * 2;
    for (let f = 0; f <= nf; f++) {
      const ponta = f === nf;
      const t = ponta ? 1 : nivel === 0 ? faixa(rng, 0.72, 0.98) : 0.28 + (0.66 * (f + rng() * 0.7)) / nf;
      curvaR.getPoint(Math.min(t, 0.999), origem);
      curvaR.getTangent(Math.min(t, 0.999), tg);
      const rAqui = raioEm(t);
      az += 2.39996 + (rng() - 0.5) * 0.8;
      perp.set(0.3, 0.9, 0.2).cross(tg).normalize();
      eixo.copy(perp).applyAxisAngle(tg, az);
      const ang = ponta ? faixa(rng, 0.05, 0.3) : (nivel === 0 ? faixa(rng, 0.45, 0.95) : faixa(rng, 0.55, 1.1)) * abre;
      const nd = tg.clone().applyAxisAngle(eixo, ang);
      // nada de galho apontando para o chão
      if (nd.y < -0.15) nd.y *= -0.4;
      const fatorComp = ponta ? faixa(rng, 0.55, 0.7) : faixa(rng, 0.52, 0.78) * (nivel === 0 ? 1.25 : 1 - 0.3 * t);
      const fatorRaio = ponta ? 0.95 : nivel === 0 ? faixa(rng, 0.5, 0.66) : faixa(rng, 0.5, 0.68);
      // o filho nasce um pouco para dentro do pai: a junção não fica espetada
      const o2 = origem.clone().addScaledVector(nd, -rAqui * 0.5);
      ramo(o2, nd, comp * fatorComp, Math.max(0.006 / escalaM, rAqui * fatorRaio), nivel + 1, sementeFilho(sem, f));
    }
  };

  const r0 = criarRng(opc.semente);
  const dir0 = V(opc.inclina?.[0] ?? (r0() - 0.5) * 0.16, 1, opc.inclina?.[1] ?? (r0() - 0.5) * 0.16);
  ramo(V(0, -0.35, 0), dir0, opc.altura * 0.4 + 0.35, opc.raioTronco, 0, sementeFilho(opc.semente, 99));
}

export type { Rng };
