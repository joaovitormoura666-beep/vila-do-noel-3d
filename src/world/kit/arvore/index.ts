/**
 * Árvore de Natal e folhagem natalina do kit da sala.
 *   criarArvore(ctx, opcoes)     abeto tradicional e volumoso, com lampadinhas, enfeites, estrela, saia e presentes
 *   criarGuirlanda(ctx, opcoes)  guirlanda de porta ou parede com a mesma folhagem
 *   criarFestao(ctx, opcoes)     festão de folhagem ao longo de uma curva
 * A folhagem são frondes instanciadas: leques de abeto modelados agulha por agulha e assados em cartões
 * (veja folhagem.ts e ferramentas/assar.ts).
 */
import * as THREE from 'three';
import { loadTexture } from '../../../engine/assets';
import type { Level } from '../../contracts';
import type { KitContext, Peca } from '../tipos';
import { ambienteDosEnfeites } from './ambiente';
import { criarEnfeites, criarFagulhas, espalharNaCopa, type BolaPendurada, type PontoDaCopa } from './enfeites';
import { gerarEsqueleto, type Esqueleto } from './esqueleto';
import { criarPresentes, criarSaia } from './pe';
import { carregarFolhagem, criarMalhaFolhagem, type Fronde } from './folhagem';
import { Malhador, tubo } from './geometria';
import { criarCordao, type Lampada } from './luzes';
import { manchaRedonda } from './texturas';
import { acaso, criarRelogio, criarSorteio, ondulacao, type Sorteio } from './util';

export { criarFestao, criarGuirlanda, type Festao, type OpcoesFestao, type OpcoesGuirlanda } from './guirlanda';

export interface OpcoesArvore {
  /** Altura até a ponta da estrela, em metros. Padrão 3,4. */
  altura?: number;
  /** Raio da base da copa. Padrão 0,35 da altura. */
  raio?: number;
  semente?: number;
  /** Quantidade de lampadinhas (de 150 a 300). Padrão 220. */
  luzes?: number;
  /** Bolas de vidro e laços de veludo. Padrão: ligados. */
  enfeites?: boolean;
  /** Saia e presentes ao pé. true = quatro presentes; um número de 3 a 5 escolhe quantos. Padrão: ligados. */
  presentes?: boolean | number;
  /** Estrela dourada no topo. Padrão: ligada. */
  estrela?: boolean;
  /** Ambiente para os reflexos dos enfeites. Sem isso, a árvore usa um ambiente próprio de salinha quente. */
  envMap?: THREE.Texture | null;
}

export interface ArvoreDeNatal extends Peca {
  altura: number;
  /** Raio da base da copa. */
  raio: number;
  /** Ponta da árvore, no espaço local. */
  topo: THREE.Vector3;
  /** Luz real, quente e suave, com que a árvore ilumina o que está perto. A composição pode ajustar. */
  luz: THREE.PointLight;
  /** Efeito TREE_SPARKLE: 0 = pisca-pisca calmo, 1 = luzes pulsando em ondas douradas que sobem. */
  setCintilar(intensidade: number): void;
  /** Troca o ambiente refletido pelos enfeites (por exemplo, o ambiente gerado da sala pronta). */
  setEnvMap(tex: THREE.Texture | null): void;
}

/** Um lugar de verdade onde pousar uma lâmpada ou pendurar um enfeite: um ponto sobre uma fronde de fora. */
interface Apoio {
  fronde: Fronde;
  /** Ponto a três quartos do talo. */
  p: THREE.Vector3;
  usado: boolean;
}

/** Índice espacial dos apoios (frondes que aparecem por fora), para achar o mais próximo de um ponto. */
function criarApoios(frondes: Fronde[]) {
  const CEL = 0.25;
  const grade = new Map<string, Apoio[]>();
  const chave = (x: number, y: number, z: number) => `${Math.floor(x / CEL)},${Math.floor(y / CEL)},${Math.floor(z / CEL)}`;
  for (const f of frondes) {
    if (f.sombraPonta < 0.45) continue;
    const p = f.base.clone().addScaledVector(f.frente, f.comprimento * 0.75);
    const c = chave(p.x, p.y, p.z);
    const a: Apoio = { fronde: f, p, usado: false };
    const lista = grade.get(c);
    if (lista) lista.push(a);
    else grade.set(c, [a]);
  }
  /** O apoio livre mais próximo de `alvo`, até `max` metros; `serve` filtra as frondes aceitas. */
  return (alvo: THREE.Vector3, max: number, serve?: (f: Fronde) => boolean): Apoio | null => {
    let melhor: Apoio | null = null;
    let dMelhor = max * max;
    const alcance = Math.ceil(max / CEL);
    for (let a = -alcance; a <= alcance; a++)
      for (let b = -alcance; b <= alcance; b++)
        for (let c = -alcance; c <= alcance; c++) {
          const lista = grade.get(chave(alvo.x + a * CEL, alvo.y + b * CEL, alvo.z + c * CEL));
          if (!lista) continue;
          for (const ap of lista) {
            if (ap.usado || (serve && !serve(ap.fronde))) continue;
            const d = ap.p.distanceToSquared(alvo);
            if (d < dMelhor) {
              dMelhor = d;
              melhor = ap;
            }
          }
        }
    return melhor;
  };
}

type BuscaApoio = ReturnType<typeof criarApoios>;

/**
 * Distribui as lâmpadas ao longo de um fio que sobe em espiral pela copa, com densidade uniforme por área.
 * Cada posição da espiral é levada para uma fronde de verdade (a lâmpada pousa sobre o ramo, não fica no
 * ar); o fio ora passa pelas pontas, ora se mete entre os ramos (essas lâmpadas ficam meio escondidas e
 * iluminam as agulhas em volta). Posição sem fronde por perto é descartada.
 */
function distribuirLampadas(n: number, esq: Esqueleto, yBase: number, yTopo: number, apoioPerto: BuscaApoio, r: Sorteio): Lampada[] {
  const raioEm = esq.raioEm;
  const passos = 240;
  const acumulado: number[] = [0];
  for (let i = 1; i <= passos; i++) {
    const y = yBase + ((yTopo - yBase) * (i - 0.5)) / passos;
    acumulado.push(acumulado[i - 1] + raioEm(y) * ((yTopo - yBase) / passos));
  }
  const area = acumulado[passos];
  const espaco = Math.sqrt((2 * Math.PI * area * 1.08) / n); // distância entre lâmpadas ao longo do fio
  const lampadas: Lampada[] = [];
  let ang = r() * Math.PI * 2;
  let j = 0;
  const alvo = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const a = ((i + 0.5) / n) * area;
    while (j < passos && acumulado[j + 1] < a) j++;
    const f = (a - acumulado[j]) / Math.max(1e-6, acumulado[j + 1] - acumulado[j]);
    const y = yBase + ((yTopo - yBase) * (j + f)) / passos + ondulacao(i * 0.83, 2) * 0.05;
    const raioCopa = raioEm(y);
    // serpenteia: ora por fora das pontas, ora metida entre os ramos
    const fundo = 0.5 + 0.5 * ondulacao(i * 0.61, 7);
    const raio = raioCopa * (0.96 - 0.24 * fundo * fundo);
    ang += (espaco / Math.max(0.12, raioCopa)) * (0.85 + 0.3 * r());
    alvo.set(Math.cos(ang) * raio, y, Math.sin(ang) * raio);
    const sorte = [r(), r(), r(), r()];
    const apoio = apoioPerto(alvo, 0.2);
    if (!apoio) continue;
    apoio.usado = true;
    const fr = apoio.fronde;
    // pousa sobre o leque, entre o meio e a ponta do talo, um dedo acima das agulhas
    const cima = fr.cima.clone().addScaledVector(fr.frente, -fr.cima.dot(fr.frente)).normalize();
    if (cima.y < 0) cima.negate();
    const p = fr.base.clone().addScaledVector(fr.frente, fr.comprimento * (0.55 + 0.35 * sorte[0])).addScaledVector(cima, 0.014);
    const fora = new THREE.Vector3(p.x, 0, p.z).normalize();
    const dir = new THREE.Vector3(sorte[1] - 0.5, sorte[2] - 0.8, sorte[3] - 0.5).multiplyScalar(1.5).addScaledVector(fora, 0.7).normalize();
    lampadas.push({ x: p.x, y: p.y, z: p.z, id: 0, dir, halo: Math.hypot(p.x, p.z) < raioEm(p.y) * 0.88 });
  }
  // ordem de corte (parte inteira do id): embaralhada, para as lâmpadas que apagam nos níveis baixos ficarem
  // espalhadas pela árvore inteira
  const ordem = lampadas.map((_, i) => i).sort((a, b) => acaso(a, 5) - acaso(b, 5));
  ordem.forEach((indice, posto) => {
    lampadas[indice].id = posto + 1 + 0.07 + 0.8 * acaso(indice, 9);
  });
  return lampadas;
}

/** Núcleo escuro da copa: um cone irregular quase preto que fecha a vista para o outro lado da árvore. */
function criarNucleo(esq: Esqueleto, yBase: number, yTopo: number, r: Sorteio) {
  const aneis = 9;
  const voltas = 22;
  const pos: number[] = [];
  const idx: number[] = [];
  const fases = [r() * 6, r() * 6, r() * 6];
  for (let j = 0; j <= aneis; j++) {
    const y = yBase + ((yTopo - yBase) * j) / aneis;
    for (let i = 0; i <= voltas; i++) {
      const a = (i / voltas) * Math.PI * 2;
      const torto = 1 + 0.14 * Math.sin(a * 3 + fases[0] + j * 0.9) + 0.09 * Math.sin(a * 7 + fases[1] - j * 1.7) + 0.06 * Math.sin(j * 2.3 + fases[2]);
      const raio = j === aneis ? 0.01 : esq.raioEm(y) * 0.42 * torto;
      pos.push(Math.cos(a) * raio, y, Math.sin(a) * raio);
    }
  }
  const linha = voltas + 1;
  for (let j = 0; j < aneis; j++)
    for (let i = 0; i < voltas; i++) {
      const a = j * linha + i;
      idx.push(a, a + linha, a + 1, a + 1, a + linha, a + linha + 1);
    }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  const mat = new THREE.MeshBasicMaterial({ color: '#0a1b12', side: THREE.DoubleSide });
  const malha = new THREE.Mesh(geo, mat);
  malha.name = 'nucleo-escuro';
  malha.userData.semAO = true;
  return { malha, geo, mat };
}

export async function criarArvore(ctx: KitContext, opcoes: OpcoesArvore = {}): Promise<ArvoreDeNatal> {
  const altura = opcoes.altura ?? 3.4;
  const raio = opcoes.raio ?? altura * 0.35;
  const k = altura / 3.4;
  const semente = opcoes.semente ?? 7;
  const r = criarSorteio(semente);
  const root = new THREE.Group();
  root.name = 'arvore-de-natal';
  const descartaveis: Array<{ dispose(): void }> = [];
  const relogio = criarRelogio(altura);

  const [rec, cascaCor, cascaNormal, veludoCor, veludoNormal] = await Promise.all([
    carregarFolhagem(),
    loadTexture('assets/arvore/casca_cor.jpg', { srgb: true }),
    loadTexture('assets/arvore/casca_normal.jpg', { srgb: false }),
    loadTexture('assets/arvore/veludo_cor.jpg', { srgb: true }),
    loadTexture('assets/arvore/veludo_normal.jpg', { srgb: false }),
  ]);
  const envMap = opcoes.envMap ?? ambienteDosEnfeites(ctx.renderer);
  const comEstrela = opcoes.estrela ?? true;
  const raioEstrela = 0.17 * k;

  const esqueleto = gerarEsqueleto({ altura, raio }, r);

  // tronco e galhos: uma malha só, com casca de pinheiro. O tronco continua, fino, acima da folhagem:
  // é a haste em que a estrela encaixa.
  const lenho = new Malhador();
  const tronco: THREE.Vector3[] = [];
  const yHaste = altura - 0.34 * k;
  for (let i = 0; i <= 14; i++) {
    const t = i / 14;
    tronco.push(new THREE.Vector3(Math.sin(t * 5.1) * 0.012 * k * (1 - t), t * yHaste, Math.cos(t * 3.7) * 0.012 * k * (1 - t)));
  }
  tubo(lenho, tronco, (i) => THREE.MathUtils.lerp(0.075, 0.007, Math.pow(i / 14, 0.55)) * k, 10, 0.5);
  for (const g of esqueleto.galhos) tubo(lenho, g.pontos, (i) => g.grossura * (1 - 0.75 * (i / (g.pontos.length - 1))), 4, 0.3);
  const lenhoGeo = lenho.geometria();
  const lenhoMat = new THREE.MeshStandardMaterial({ map: cascaCor, normalMap: cascaNormal, color: '#4d3d31', roughness: 0.95 });
  const lenhoMalha = new THREE.Mesh(lenhoGeo, lenhoMat);
  // tronco e galhos ficam fora da passada de sombra: escondidos na folhagem, as sombras retas dos galhos sob a
  // luz rasante viravam riscos escuros sobre as agulhas (e a sombra da copa na parede já vem da folhagem)
  lenhoMalha.castShadow = false;
  lenhoMalha.receiveShadow = true;
  lenhoMalha.name = 'tronco-e-galhos';
  root.add(lenhoMalha);
  descartaveis.push(lenhoGeo, lenhoMat);

  const apoioPerto = criarApoios(esqueleto.frondes);
  const nLuzes = THREE.MathUtils.clamp(Math.round(opcoes.luzes ?? 220), 0, 300);
  const lampadas = nLuzes > 0 ? distribuirLampadas(nLuzes, esqueleto, esqueleto.yCopa + 0.1 * k, esqueleto.yGuia - 0.1 * k, apoioPerto, criarSorteio(semente + 101)) : [];
  const cordao = lampadas.length ? criarCordao(lampadas, relogio, { escala: k }) : null;
  if (cordao) {
    root.add(cordao.grupo);
    descartaveis.push(cordao);
  }

  const folhagem = criarMalhaFolhagem(rec, relogio, esqueleto.frondes, lampadas, r, { lampadasAtivas: cordao?.ativas });
  root.add(folhagem.malha);
  descartaveis.push(folhagem);

  const nucleo = criarNucleo(esqueleto, esqueleto.yCopa + 0.22 * k, esqueleto.yGuia - 0.2 * k, criarSorteio(semente + 505));
  root.add(nucleo.malha);
  descartaveis.push(nucleo.geo, nucleo.mat);

  // enfeites: poucas bolas de vidro penduradas sob os ramos, alguns laços de veludo e a estrela
  const rEnfeites = criarSorteio(semente + 202);
  const ocupados: THREE.Vector3[] = [];
  const comEnfeites = opcoes.enfeites ?? true;
  const deitada = (f: Fronde) => Math.abs(f.frente.y) < 0.55;
  const lacos: PontoDaCopa[] = [];
  const bolas: BolaPendurada[] = [];
  if (comEnfeites) {
    // o nó do laço encosta em um ramo de verdade, um pouco para dentro das pontas
    for (const alvo of espalharNaCopa(7, esqueleto.yCopa + 0.35 * k, altura * 0.74, esqueleto.raioEm, rEnfeites, 0.9, ocupados, 0.5 * k)) {
      const apoio = apoioPerto(alvo.posicao, 0.3, deitada);
      if (!apoio) continue;
      apoio.usado = true;
      lacos.push({ posicao: apoio.p.clone().addScaledVector(alvo.fora, 0.02 * k), fora: alvo.fora });
    }
    // cada bola pende de um ganchinho preso a um ramo, meio aninhada nas agulhas
    for (const alvo of espalharNaCopa(26, esqueleto.yCopa + 0.2 * k, esqueleto.yGuia - 0.35 * k, esqueleto.raioEm, rEnfeites, 0.93, ocupados, 0.27 * k)) {
      const apoio = apoioPerto(alvo.posicao, 0.3, deitada);
      if (!apoio) continue;
      apoio.usado = true;
      bolas.push({ gancho: apoio.p.clone().add(new THREE.Vector3(0, -0.012 * k, 0)) });
    }
  }
  const enfeites = criarEnfeites({ bolas, lacos, estrela: comEstrela ? { centro: new THREE.Vector3(0, altura - raioEstrela, 0), raio: raioEstrela } : null, envMap, veludo: { cor: veludoCor, normal: veludoNormal }, k }, rEnfeites);
  root.add(enfeites.grupo);
  descartaveis.push(enfeites);

  // fagulhas douradas do efeito de cintilar (invisíveis fora dele)
  const fagulhas = criarFagulhas(26, esqueleto.yCopa + 0.3 * k, esqueleto.yGuia, esqueleto.raioEm, relogio, criarSorteio(semente + 606), k);
  root.add(fagulhas.malha);
  descartaveis.push(fagulhas.geo, fagulhas.mat);

  // ao pé: saia de veludo e poucos presentes
  const quantos = opcoes.presentes === false ? 0 : typeof opcoes.presentes === 'number' ? opcoes.presentes : 4;
  const saia = quantos > 0 ? criarSaia(raio * 0.86, { cor: veludoCor, normal: veludoNormal }, criarSorteio(semente + 303), k) : null;
  const presentes = quantos > 0 ? criarPresentes(quantos, raio, envMap, veludoNormal, semente + 404) : null;
  if (saia && presentes) {
    root.add(saia.grupo, presentes.grupo);
    descartaveis.push(saia, presentes);
  }

  // sombra de contato pintada no piso, só no nível baixo (sem sombras de verdade a árvore flutuaria)
  const manchaTex = manchaRedonda(64, 1.4);
  const contatoGeo = new THREE.CircleGeometry(raio * 1.45, 40);
  const contatoMat = new THREE.MeshBasicMaterial({ color: '#050201', alphaMap: manchaTex, transparent: true, opacity: 0.62, depthWrite: false });
  const contato = new THREE.Mesh(contatoGeo, contatoMat);
  contato.rotation.x = -Math.PI / 2;
  contato.position.y = 0.004;
  contato.renderOrder = -1;
  contato.userData.semAO = true;
  contato.name = 'sombra-de-contato';
  root.add(contato);
  descartaveis.push(manchaTex, contatoGeo, contatoMat);

  // a luz real fica alta e alcança pouco: lambe a parede e o piso em volta, não chapa o que está embaixo da copa
  const luz = new THREE.PointLight('#ffc27a', 1.4, 4.5 * k, 1.8);
  luz.position.set(0, altura * 0.55, 0);
  root.add(luz);

  let cintilar = 0;
  let luzBase = luz.intensity;
  let luzAnimada = false;
  const setQuality = (level: Level) => {
    folhagem.setQuality(level);
    cordao?.setQuality(level);
    // nos níveis médio e baixo há menos frondes: o núcleo escuro garante o miolo fechado
    nucleo.malha.visible = level !== 'alta';
    contato.visible = level === 'baixa';
    // sem sombras no nível baixo, o pano debaixo da copa recebe a penumbra pintada
    saia?.setPenumbra(level === 'baixa' ? 0.3 : 1);
  };
  setQuality(ctx.level);

  return {
    root,
    altura,
    raio,
    topo: new THREE.Vector3(0, altura, 0),
    luz,
    setCintilar(v) {
      cintilar = THREE.MathUtils.clamp(v, 0, 1);
    },
    setEnvMap(tex) {
      enfeites.setEnvMap(tex);
      presentes?.setEnvMap(tex);
    },
    update(_dt, t) {
      relogio.uTempo.value = t;
      relogio.uCintilar.value = cintilar;
      fagulhas.malha.visible = cintilar > 0.01;
      if (cintilar > 0) {
        // a luz real acompanha as ondas (três ritmos que não se repetem juntos, variação contida)
        if (!luzAnimada) {
          luzBase = luz.intensity;
          luzAnimada = true;
        }
        luz.intensity = luzBase * (1 + cintilar * (0.16 + 0.14 * Math.sin(t * 1.7) + 0.09 * Math.sin(t * 2.93 + 1) + 0.05 * Math.sin(t * 4.31 + 2)));
        // a estrela respira devagar, com um ou outro lampejo mais forte
        const lampejo = Math.pow(0.5 + 0.5 * Math.sin(t * 1.3 + 0.6), 3) * 0.6 + Math.pow(0.5 + 0.5 * Math.sin(t * 2.17 + 2), 6) * 0.5;
        enfeites.setLampejo(cintilar * Math.min(1, 0.3 + lampejo));
      } else if (luzAnimada) {
        luz.intensity = luzBase;
        luzAnimada = false;
        enfeites.setLampejo(0);
      }
    },
    setQuality,
    dispose() {
      for (const d of descartaveis) d.dispose();
    },
  };
}
