/**
 * Guirlanda de porta ou parede e festão ao longo de uma curva, com a MESMA folhagem da árvore
 * (frondes instanciadas de ramos reais assados), em tamanho menor.
 */
import * as THREE from 'three';
import type { Level } from '../../contracts';
import type { KitContext, Peca } from '../tipos';
import { carregarFolhagem, criarMalhaFolhagem, LEQUES, type Fronde } from './folhagem';
import { Malhador, tubo } from './geometria';
import { juntarLaco } from './laco';
import { criarCordao, type Lampada } from './luzes';
import { carregarVeludo, materialVeludo } from './materiais';
import { acaso, criarRelogio, criarSorteio, entre, type Sorteio } from './util';

/** Tinta base das frondes: neutra (a cor verde-pinheiro já vem do atlas, como na árvore). */
const VERDE = new THREE.Color(0.84, 0.86, 0.82);

function tintaVariada(r: Sorteio, clara = 0): THREE.Color {
  const hsl = { h: 0, s: 0, l: 0 };
  VERDE.getHSL(hsl);
  return new THREE.Color().setHSL(hsl.h + (r() - 0.5) * 0.06, THREE.MathUtils.clamp(hsl.s + (r() - 0.5) * 0.12, 0, 1), THREE.MathUtils.clamp(hsl.l * (1 + (r() - 0.5) * 0.1 + clara), 0, 1));
}

/** Bagas vermelhas em cachinhos: esferas instanciadas com verniz. */
function criarBagas(centros: THREE.Vector3[], tamanho: number, r: Sorteio) {
  const geo = new THREE.SphereGeometry(1, 12, 8);
  const mat = new THREE.MeshPhysicalMaterial({ color: '#a3101c', roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.2 });
  const porCacho = 6;
  const malha = new THREE.InstancedMesh(geo, mat, centros.length * porCacho);
  const m = new THREE.Matrix4();
  let i = 0;
  for (const c of centros)
    for (let j = 0; j < porCacho; j++) {
      const raio = tamanho * entre(r, 0.8, 1.15);
      m.makeScale(raio, raio, raio).setPosition(c.x + (r() - 0.5) * tamanho * 3, c.y + (r() - 0.5) * tamanho * 3, c.z + r() * tamanho * 1.5);
      malha.setMatrixAt(i++, m);
    }
  malha.instanceMatrix.needsUpdate = true;
  malha.castShadow = true;
  malha.computeBoundingSphere();
  malha.name = 'bagas';
  return { malha, geo, mat };
}

export interface OpcoesGuirlanda {
  /** Raio de fora da guirlanda, em metros (uma de porta tem perto de 0,28). */
  raio: number;
  /** Laço de veludo vermelho embaixo. Padrão: ligado. */
  laco?: boolean;
  /** Cachinhos de bagas vermelhas. Padrão: 3. */
  bagas?: number;
  semente?: number;
}

/**
 * Guirlanda em pé, de frente para +Z, com as costas em z = 0 (encosta na porta ou na parede) e o ponto mais
 * baixo da folhagem em y = 0. O centro do aro fica em (0, raio, 0); as pontas do laço descem um pouco além.
 */
export async function criarGuirlanda(ctx: KitContext, o: OpcoesGuirlanda): Promise<Peca> {
  const r = criarSorteio(o.semente ?? 21);
  const root = new THREE.Group();
  root.name = 'guirlanda';
  const lixo: Array<{ dispose(): void }> = [];
  const [rec, veludo] = await Promise.all([carregarFolhagem(), carregarVeludo()]);
  const relogio = criarRelogio(o.raio * 2);
  const R = o.raio;
  const aro = R * 0.7; // raio da linha do meio
  const corpo = R * 0.38; // meia espessura da folhagem
  const centro = new THREE.Vector3(0, R, corpo * 0.75);

  const frondes: Fronde[] = [];
  const n = Math.round((2 * Math.PI * aro) / 0.0085);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r() * 0.02;
    const radial = new THREE.Vector3(Math.cos(a), Math.sin(a), 0);
    const tangente = new THREE.Vector3(-Math.sin(a), Math.cos(a), 0);
    // três camadas: fundo (escuro, colado à parede), meio e pontas de fora (mais claras, para a frente).
    // Todos os raminhos penteados no mesmo sentido da volta, abrindo pouco para fora ou para dentro.
    const camada = i % 3;
    const abre = (r() - 0.5) * 1.0 * (camada === 0 ? 1.3 : 1);
    const frenteZ = camada === 0 ? entre(r, 0.0, 0.2) : camada === 1 ? entre(r, 0.2, 0.5) : entre(r, 0.45, 0.8);
    const frente = tangente.clone().addScaledVector(radial, abre).addScaledVector(new THREE.Vector3(0, 0, 1), frenteZ).normalize();
    const base = centro.clone().addScaledVector(radial, aro + (r() - 0.5) * corpo * (camada === 0 ? 0.9 : 0.55));
    base.z += (camada === 0 ? -0.55 : camada === 1 ? -0.15 : 0.15) * corpo + (r() - 0.5) * corpo * 0.25;
    const comp = R * entre(r, 0.3, 0.42) * (camada === 0 ? 1.15 : 1);
    const pontaFora = camada === 2 || Math.abs(abre) > 0.4;
    frondes.push({
      base,
      frente,
      cima: new THREE.Vector3(0, 0, 1).applyAxisAngle(frente, (r() - 0.5) * 1.2),
      comprimento: comp,
      largura: comp * entre(r, 0.85, 1.1),
      variante: LEQUES[Math.floor(r() * LEQUES.length) % LEQUES.length],
      tinta: tintaVariada(r, camada === 2 ? 0.05 : camada === 0 ? -0.12 : 0),
      sombraBase: camada === 0 ? 0.16 : 0.26,
      sombraPonta: camada === 0 ? 0.55 : pontaFora ? 1 : 0.78,
      curva: entre(r, -0.05, 0.22),
      centro: centro.clone().addScaledVector(radial, aro).add(new THREE.Vector3(0, 0, -corpo * 0.6)),
      essencial: camada !== 1,
    });
  }
  const folhagem = criarMalhaFolhagem(rec, relogio, frondes, [], r, { fracao: { alta: 1, media: 0.8, baixa: 0.6 } });
  root.add(folhagem.malha);
  lixo.push(folhagem);

  // aro de cipó por trás da folhagem
  const lenho = new Malhador();
  for (let v = 0; v < 3; v++) {
    const pontos: THREE.Vector3[] = [];
    for (let i = 0; i <= 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      const rr = aro + Math.sin(a * 5 + v * 2.1) * corpo * 0.12;
      pontos.push(new THREE.Vector3(Math.cos(a) * rr, R + Math.sin(a) * rr, corpo * 0.5 + Math.cos(a * 5 + v * 2.1) * corpo * 0.12));
    }
    tubo(lenho, pontos, () => R * 0.022, 5, 0.1, undefined, false);
  }
  const lenhoGeo = lenho.geometria();
  const lenhoMat = new THREE.MeshStandardMaterial({ color: '#3a2a1e', roughness: 0.95 });
  const lenhoMalha = new THREE.Mesh(lenhoGeo, lenhoMat);
  lenhoMalha.name = 'aro-de-galhos';
  lenhoMalha.castShadow = true;
  root.add(lenhoMalha);
  lixo.push(lenhoGeo, lenhoMat);

  if (o.laco ?? true) {
    const m = new Malhador();
    const base = new THREE.Matrix4().makeTranslation(R * 0.06, R - aro * 0.98, corpo * 2.0).multiply(new THREE.Matrix4().makeRotationZ(-0.08));
    juntarLaco(m, { largura: R * 0.95, pontas: 0.7, queda: 0.4, cor: new THREE.Color(1, 1, 1) }, r, base);
    const geo = m.geometria();
    const mat = materialVeludo(veludo);
    const laco = new THREE.Mesh(geo, mat);
    laco.castShadow = true;
    laco.receiveShadow = true;
    laco.name = 'laco';
    root.add(laco);
    lixo.push(geo, mat);
  }

  const cachos = o.bagas ?? 3;
  if (cachos > 0) {
    const centros: THREE.Vector3[] = [];
    for (let i = 0; i < cachos; i++) {
      // espalhados pelos lados e pelo alto, longe do laço (que fica embaixo)
      const a = 0.45 + (i / Math.max(1, cachos - 1)) * 2.9 + (acaso(i, 4) - 0.5) * 0.3;
      const rr = aro + (acaso(i, 5) - 0.5) * corpo * 0.6;
      centros.push(new THREE.Vector3(Math.cos(a) * rr, R + Math.sin(a) * rr, corpo * 1.25));
    }
    const b = criarBagas(centros, R * 0.035, r);
    root.add(b.malha);
    lixo.push(b.geo, b.mat, b.malha);
  }

  const setQuality = (level: Level) => folhagem.setQuality(level);
  setQuality(ctx.level);
  return {
    root,
    update(_dt, t) {
      relogio.uTempo.value = t;
    },
    setQuality,
    dispose() {
      for (const l of lixo) l.dispose();
    },
  };
}

export interface OpcoesFestao {
  /** Pontos de apoio, em ordem, no espaço local da peça (por exemplo, as pontas e o meio do console). */
  pontos: THREE.Vector3[];
  /** Diâmetro aproximado do festão, em metros. Padrão 0,2. */
  espessura?: number;
  /** Lampadinhas enroladas no festão: true = uma a cada 14 cm; um número escolhe quantas. Padrão: sem luzes. */
  luzes?: boolean | number;
  /** Quanto o festão pende entre dois apoios, em fração do vão. Padrão 0,14. */
  barriga?: number;
  semente?: number;
}

export interface Festao extends Peca {
  /** Efeito TREE_SPARKLE também nas luzinhas do festão (0 a 1). */
  setCintilar(intensidade: number): void;
}

/** Festão de folhagem que passa pelos pontos de apoio e pende naturalmente entre eles. */
export async function criarFestao(ctx: KitContext, o: OpcoesFestao): Promise<Festao> {
  const r = criarSorteio(o.semente ?? 33);
  const root = new THREE.Group();
  root.name = 'festao';
  const lixo: Array<{ dispose(): void }> = [];
  const rec = await carregarFolhagem();
  const esp = o.espessura ?? 0.2;
  const barriga = o.barriga ?? 0.14;

  // caminho: entre dois apoios o festão desce em arco (aproximação de catenária)
  const caminho: THREE.Vector3[] = [];
  for (let s = 0; s < o.pontos.length - 1; s++) {
    const a = o.pontos[s];
    const b = o.pontos[s + 1];
    const vao = a.distanceTo(b);
    const passos = Math.max(4, Math.round(vao / 0.03));
    for (let i = s === 0 ? 0 : 1; i <= passos; i++) {
      const t = i / passos;
      const p = a.clone().lerp(b, t);
      p.y -= vao * barriga * 4 * t * (1 - t);
      caminho.push(p);
    }
  }
  let yMin = Infinity;
  let yMax = -Infinity;
  for (const p of caminho) {
    yMin = Math.min(yMin, p.y);
    yMax = Math.max(yMax, p.y);
  }
  const relogio = criarRelogio(Math.max(0.5, yMax - yMin + esp));
  const tangenteEm = (i: number) => caminho[Math.min(caminho.length - 1, i + 1)].clone().sub(caminho[Math.max(0, i - 1)]).normalize();

  const lampadas: Lampada[] = [];
  let comprimento = 0;
  for (let i = 1; i < caminho.length; i++) comprimento += caminho[i].distanceTo(caminho[i - 1]);
  const nLuzes = o.luzes === true ? Math.round(comprimento / 0.14) : typeof o.luzes === 'number' ? Math.round(o.luzes) : 0;
  for (let k = 0; k < nLuzes; k++) {
    const i = Math.min(caminho.length - 1, Math.round(((k + 0.5) / nLuzes) * (caminho.length - 1)));
    const t = tangenteEm(i);
    // em hélice em volta do festão, de preferência pela frente e por baixo
    const lado = new THREE.Vector3(0, 0, 1).applyAxisAngle(t, k * 2.1 + (r() - 0.5));
    if (lado.z < -0.2) lado.z = -lado.z;
    const p = caminho[i].clone().addScaledVector(lado, esp * entre(r, 0.28, 0.42));
    const dir = lado.clone().multiplyScalar(0.6).add(new THREE.Vector3(r() - 0.5, r() - 0.9, r() - 0.5)).normalize();
    lampadas.push({ x: p.x, y: p.y, z: p.z, id: k + 1 + Math.floor(acaso(k, 9) * 3) * 0.37, dir });
  }

  const frondes: Fronde[] = [];
  const passo = 0.012;
  let acumulado = 0;
  let sentido = 1;
  for (let i = 1; i < caminho.length; i++) {
    acumulado += caminho[i].distanceTo(caminho[i - 1]);
    while (acumulado > passo) {
      acumulado -= passo;
      const t = tangenteEm(i).multiplyScalar(sentido);
      // raminhos em espinha, abrindo em volta do eixo; os dois sentidos se alternam para não haver "pelo penteado"
      if (r() < 0.3) sentido = -sentido;
      const eixo = new THREE.Vector3(0, 1, 0).cross(t);
      if (eixo.lengthSq() < 1e-4) eixo.set(1, 0, 0);
      eixo.normalize().applyAxisAngle(t, r() * Math.PI * 2);
      const frente = t.clone().addScaledVector(eixo, entre(r, 0.35, 1.0)).normalize();
      const comp = esp * entre(r, 0.75, 1.15);
      const base = caminho[i].clone().addScaledVector(eixo, esp * 0.06);
      const paraFora = frente.clone().sub(t.clone().multiplyScalar(frente.dot(t))).length();
      frondes.push({
        base,
        frente,
        cima: eixo.clone().applyAxisAngle(frente, (r() - 0.5) * 2),
        comprimento: comp,
        largura: comp * entre(r, 0.85, 1.1),
        variante: LEQUES[Math.floor(r() * LEQUES.length) % LEQUES.length],
        tinta: tintaVariada(r, paraFora > 0.6 ? 0.06 : 0),
        sombraBase: 0.2,
        sombraPonta: 0.75 + 0.25 * paraFora,
        curva: entre(r, 0.0, 0.3),
        centro: caminho[i].clone(),
      });
    }
  }
  const folhagem = criarMalhaFolhagem(rec, relogio, frondes, lampadas, r, { fracao: { alta: 1, media: 0.8, baixa: 0.6 }, haloRaio: 0.06 });
  root.add(folhagem.malha);
  lixo.push(folhagem);

  const cordao = lampadas.length ? criarCordao(lampadas, relogio, { escala: 0.9 }) : null;
  if (cordao) {
    root.add(cordao.grupo);
    lixo.push(cordao);
  }

  let cintilar = 0;
  const setQuality = (level: Level) => {
    folhagem.setQuality(level);
    cordao?.setQuality(level);
  };
  setQuality(ctx.level);
  return {
    root,
    setCintilar(v) {
      cintilar = THREE.MathUtils.clamp(v, 0, 1);
    },
    update(_dt, t) {
      relogio.uTempo.value = t;
      relogio.uCintilar.value = cintilar;
    },
    setQuality,
    dispose() {
      for (const l of lixo) l.dispose();
    },
  };
}
