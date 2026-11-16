/**
 * Laço de fita com volume: duas alças cheias (apertadas no nó, abertas na ponta), um nó e duas pontas
 * caídas com corte em V. A fita tem leve arco na largura, para o veludo ou o cetim pegar a luz em dobras.
 * Usado nos laços da árvore, no da guirlanda e nos presentes.
 */
import * as THREE from 'three';
import { Malhador } from './geometria';
import type { Sorteio } from './util';

export interface OpcoesLaco {
  /** Largura total do laço, de alça a alça, em metros. */
  largura: number;
  /** Largura da fita. Padrão 0,3 da largura. */
  fita?: number;
  /** Comprimento das pontas caídas, em relação à largura. Padrão 0,75; 0 = sem pontas. */
  pontas?: number;
  /** Quanto as alças caem (0 = retas, 1 = bem caídas). */
  queda?: number;
  /** Inclinação do anel das alças para a frente, em radianos (0 = só se vê a fita de frente). Padrão 0,65. */
  inclina?: number;
  /** Alças mais cheias (mais fundas), de 0 a 1. Padrão 0. */
  cheio?: number;
  /** Segundo par de alças, menor e girado: laço mais cheio (presentes). */
  duplo?: boolean;
  /** Metros de fita por repetição da textura. */
  ladrilho?: number;
  cor?: THREE.Color;
}

/**
 * Faixa de fita ao longo de um caminho: `lado` é a direção da largura em cada ponto. Com `bainha` > 0 as duas
 * bordas dobram para baixo e para dentro (a fita ganha espessura: lê como tecido, não como papel recortado).
 */
export function faixa(m: Malhador, caminho: THREE.Vector3[], lado: THREE.Vector3[], largura: (t: number) => number, ladrilho: number, cor?: THREE.Color, bico = 0, pregas?: (t: number) => number, bainha = 0) {
  const n = caminho.length;
  const cols = pregas ? 12 : 4;
  const inicio = m.vertices;
  const t = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const p = new THREE.Vector3();
  const nn = new THREE.Vector3();
  const k0 = bainha > 0 ? -1 : 0;
  const k1 = bainha > 0 ? cols + 1 : cols;
  let comp = 0;
  for (let i = 0; i < n; i++) {
    if (i > 0) comp += caminho[i].distanceTo(caminho[i - 1]);
    t.subVectors(caminho[Math.min(n - 1, i + 1)], caminho[Math.max(0, i - 1)]).normalize();
    normal.crossVectors(lado[i], t).normalize();
    const w = largura(i / (n - 1));
    for (let k = k0; k <= k1; k++) {
      const dobra = k < 0 || k > cols; // vértice da bainha, por baixo da borda
      const u = THREE.MathUtils.clamp(k, 0, cols) / cols - 0.5;
      // arco na largura: o meio da fita estufa para fora; as bordas viram um pouco
      let arco = (0.25 - u * u) * 0.24 * w;
      // pregas: a fita franze onde é apertada (junto ao nó), em dobras macias que morrem ao se afastar
      if (pregas) arco += Math.sin(u * 9.5 + 0.6) * 0.065 * w * pregas(i / (n - 1)) * (1 - 2 * Math.abs(u) * 0.3);
      p.copy(caminho[i]).addScaledVector(lado[i], u * w).addScaledVector(normal, arco);
      if (dobra) p.addScaledVector(normal, -bainha).addScaledVector(lado[i], -Math.sign(u) * bainha * 0.9);
      // corte em V na ponta: o meio recua
      if (bico > 0 && i === n - 1) p.addScaledVector(t, -bico * (1 - Math.abs(u) * 2));
      nn.copy(normal).addScaledVector(lado[i], u * 0.9).normalize();
      m.vertice(p, nn, comp / ladrilho, (u * w) / ladrilho, cor);
    }
  }
  const linha = k1 - k0 + 1;
  for (let i = 0; i < n - 1; i++)
    for (let k = 0; k < linha - 1; k++) {
      const a = inicio + i * linha + k;
      m.quad(a, a + 1, a + linha + 1, a + linha); // sentido que concorda com as normais (material de dois lados)
    }
}

/**
 * Acrescenta um laço ao malhador. O laço nasce no plano XY, de frente para +Z, com o nó na origem;
 * `matriz` o leva ao lugar. `r` dá a irregularidade (alças desiguais, pontas tortas).
 */
export function juntarLaco(m: Malhador, o: OpcoesLaco, r: Sorteio, matriz?: THREE.Matrix4) {
  const L = o.largura;
  const fita = o.fita ?? L * 0.26;
  const ladrilho = o.ladrilho ?? 0.08;
  const local = new Malhador();
  const eixoZ = new THREE.Vector3(0, 0, 1);
  const alcas: Array<[number, number, number]> = [
    [-1, 1, 0],
    [1, 1, 0],
  ];
  if (o.duplo) alcas.push([-1, 0.72, 0.6], [1, 0.72, 0.6]);
  for (const [s, tamanho, giro] of alcas) {
    // alça: um anel em gota, apertado no nó. O anel é inclinado para a frente: de frente vê-se a volta de
    // cima da fita e, pelo vão, o lado de dentro da volta de trás (é isso que faz a alça ler como fita)
    const a = (L / 2) * (0.92 + 0.16 * r()) * tamanho;
    const b = a * (0.3 + 0.1 * r() + 0.25 * (o.cheio ?? 0));
    const sobe = 0.25 + 0.2 * r() - (o.queda ?? 0.3) * 0.6;
    const inclina = (o.inclina ?? 0.65) + (r() - 0.5) * 0.2;
    const fundoDir = new THREE.Vector3(0, Math.sin(inclina), Math.cos(inclina));
    const larguraDir = new THREE.Vector3(0, Math.cos(inclina), -Math.sin(inclina));
    const caminho: THREE.Vector3[] = [];
    const lado: THREE.Vector3[] = [];
    const passos = 20;
    for (let i = 0; i <= passos; i++) {
      const th = (i / passos) * Math.PI * 2;
      const x = (a * (1 - Math.cos(th))) / 2;
      // o anel fica quase todo na frente do plano do nó (o laço encosta em uma superfície sem atravessá-la)
      const fundo = b * Math.sin(th) * (0.55 + 0.45 * Math.sin(th / 2));
      // a alça sobe ao sair do nó e a ponta dela pende
      const y = x * sobe - (x / a) * (x / a) * a * (o.queda ?? 0.3) * 0.5;
      const p = new THREE.Vector3(s * x, y, b * 0.9 * Math.sin(th / 2)).addScaledVector(fundoDir, fundo);
      // a largura abre em leque para a ponta da alça
      const abre = (x / a) * 0.28 * s;
      const l = larguraDir.clone().add(new THREE.Vector3(-abre, 0, 0)).normalize();
      if (giro) {
        // segundo par: girado em torno do eixo do nó, para cima, e um pouco mais à frente
        p.applyAxisAngle(eixoZ, s * giro);
        l.applyAxisAngle(eixoZ, s * giro);
        p.z += b * 0.35;
      }
      caminho.push(p);
      lado.push(l);
    }
    faixa(local, caminho, lado, (t) => fita * (0.42 + 0.63 * Math.sin(Math.PI * t)), ladrilho, o.cor, 0, (t) => Math.pow(1 - Math.sin(Math.PI * t), 1.5), fita * 0.045);
  }
  const pontas = o.pontas ?? 0.75;
  if (pontas > 0) {
    for (const s of [-1, 1]) {
      const comp = L * pontas * (0.85 + 0.3 * r());
      const abre = 0.28 + 0.3 * r();
      const onda = (r() - 0.5) * 0.5;
      const caminho: THREE.Vector3[] = [];
      const lado: THREE.Vector3[] = [];
      const passos = 10;
      for (let i = 0; i <= passos; i++) {
        const t = i / passos;
        const x = s * comp * abre * (t + 0.25 * t * t);
        const y = -comp * t * (1 - 0.12 * t) - 0.02 * L;
        const z = 0.05 * L + Math.sin(t * 5 + onda * 6) * 0.05 * L * t + 0.12 * L * t;
        caminho.push(new THREE.Vector3(x, y, z));
        // a largura da ponta fica quase na horizontal, torcendo um pouco ao cair
        lado.push(new THREE.Vector3(1, 0.25 * s * (1 - t), onda * t).normalize().multiplyScalar(-s));
      }
      faixa(local, caminho, lado, (t) => fita * (0.5 + 0.45 * Math.min(1, t * 2.5)), ladrilho, o.cor, fita * 0.5, (t) => (1 - t) * (1 - t), fita * 0.045);
    }
  }
  // nó: uma volta de fita apertada
  {
    const no = new THREE.SphereGeometry(1, 14, 10);
    const mm = new THREE.Matrix4().makeScale(fita * 0.4, fita * 0.56, fita * 0.38).setPosition(0, 0, fita * 0.16);
    const uv = no.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * fita * 2) / ladrilho, (uv.getY(i) * fita) / ladrilho);
    local.juntar(no, mm, o.cor);
    no.dispose();
  }
  // normais recalculadas da malha (as pregas mudam a superfície); o sentido dos triângulos já concorda com elas
  const g = local.geometria();
  g.computeVertexNormals();
  m.juntar(g, matriz, o.cor);
  g.dispose();
}
