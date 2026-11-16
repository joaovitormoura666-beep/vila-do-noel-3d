/**
 * Arquitetura da sala A: assoalho encerado, paredes com espessura (reboco em cima, lambri de tábuas
 * embaixo, rodapé e moldura), pilares, frechais, vigas mestras, caibros e forro de tábuas.
 * Tudo com as texturas PBR do acervo no tamanho real (UV em metros) e arestas arredondadas.
 * Cada material vira UMA malha (geometrias fundidas): seis chamadas de desenho para a sala inteira.
 *
 * A sala é um salão maior que o quadro: o detalhe (lambri, pilares, vigas) vai até SALA.xDetalhe e
 * SALA.zDetalhe; além disso só existem piso, paredes lisas e forro, para fechar a luz e os reflexos.
 */
import * as THREE from 'three';
import { JANELA, LAREIRA, SALA, TETO } from './ajustes';
import { EMENDAS_LAMBRI, caixa, colocar, criarSorteio, fundir, perfilReto, preparar, ruido2, tingir, tingirPor, uvPorFace, vigaDeUmaTora, type Sorteio } from './geo';
import type { MateriaisDaSala } from './materiais';

export interface Arquitetura {
  root: THREE.Group;
  dispose(): void;
}

const suave = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Assoalho: uma grade com cor de vértice (cera gasta no meio, sujeira junto das paredes). Tábuas ao longo de Z. */
function geometriaPiso(): THREE.BufferGeometry {
  const x0 = SALA.xEsq - 0.2;
  const x1 = SALA.xDir + 0.2;
  const z0 = SALA.zFundo - 0.2;
  const z1 = SALA.zFrente + 0.2;
  const passo = 0.45;
  const plano = new THREE.PlaneGeometry(x1 - x0, z1 - z0, Math.round((x1 - x0) / passo), Math.round((z1 - z0) / passo));
  plano.rotateX(-Math.PI / 2);
  plano.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
  const g = preparar(plano);
  const pos = g.getAttribute('position');
  const uv = g.getAttribute('uv');
  const cor = g.getAttribute('color');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    uv.setXY(i, z, x); // o veio da textura (U) corre ao longo de Z
    // manchas largas de cera e desgaste, mais um escurecimento de canto junto das paredes
    const mancha = 0.84 + 0.22 * ruido2(x * 0.55 + 3.1, z * 0.55 + 7.7, 5) + 0.08 * ruido2(x * 1.9, z * 1.9, 9);
    const canto = 0.7 + 0.3 * suave(0, 1.1, Math.min(x - SALA.xEsq, z - SALA.zFundo));
    const k = mancha * canto;
    // um nada mais quente onde se pisa mais (o meio da sala)
    cor.setXYZ(i, k * 1.02, k * 0.99, k * 0.96);
  }
  return g;
}

/** Forro de tábuas (ao longo de X), visto por baixo; escurece para longe do fogo. */
function geometriaForro(): THREE.BufferGeometry {
  const x0 = SALA.xEsq - 0.1;
  const x1 = SALA.xDir + 0.1;
  const z0 = SALA.zFundo - 0.1;
  const z1 = SALA.zFrente + 0.1;
  const plano = new THREE.PlaneGeometry(x1 - x0, z1 - z0, Math.round((x1 - x0) / 0.9), Math.round((z1 - z0) / 0.9));
  plano.rotateX(Math.PI / 2);
  plano.translate((x0 + x1) / 2, SALA.altura, (z0 + z1) / 2);
  const g = preparar(plano);
  const pos = g.getAttribute('position');
  const uv = g.getAttribute('uv');
  const cor = g.getAttribute('color');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    uv.setXY(i, x, z);
    const k = 0.8 + 0.25 * ruido2(x * 0.7, z * 0.7, 21);
    cor.setXYZ(i, k, k * 0.97, k * 0.93);
  }
  return g;
}

/** Paredes de reboco com espessura; a do fundo tem o vão da janela (contorno informado pela peça). */
function geometriaParedes(furo: THREE.Vector2[]): THREE.BufferGeometry {
  const { xEsq, xDir, zFundo, zFrente, altura, espessura } = SALA;
  const topo = altura + 0.3;
  const pecas: THREE.BufferGeometry[] = [];
  // fundo: placa extrudada com o furo da janela
  const forma = new THREE.Shape();
  forma.moveTo(xEsq, 0);
  forma.lineTo(xDir + espessura, 0);
  forma.lineTo(xDir + espessura, topo);
  forma.lineTo(xEsq, topo);
  forma.closePath();
  forma.holes.push(new THREE.Path(furo.map((p) => new THREE.Vector2(p.x + JANELA.x, p.y))));
  const fundo = preparar(new THREE.ExtrudeGeometry(forma, { depth: espessura, bevelEnabled: false, curveSegments: 24 }));
  fundo.translate(0, 0, zFundo - espessura);
  uvPorFace(fundo, { veio: 'x', du: 0.37, dv: 0.11 });
  pecas.push(fundo);
  // esquerda (a da lareira), direita e frente: blocos simples
  const bloco = (w: number, d: number, cx: number, cz: number, veio: 'x' | 'z', du: number) => {
    const g = preparar(new THREE.BoxGeometry(w, topo, d));
    uvPorFace(g, { veio, du, dv: 0.53 });
    g.translate(cx, topo / 2, cz);
    pecas.push(g);
  };
  const comprimentoZ = zFrente - zFundo + 2 * espessura;
  bloco(espessura, comprimentoZ, xEsq - espessura / 2, (zFundo + zFrente) / 2, 'z', 1.31);
  bloco(espessura, comprimentoZ, xDir + espessura / 2, (zFundo + zFrente) / 2, 'z', 4.9);
  bloco(xDir - xEsq, espessura, (xEsq + xDir) / 2, zFrente + espessura / 2, 'x', 2.2);
  const g = fundir(pecas);
  // o reboco escurece e amarela um pouco para o alto (fumaça de muitos invernos) e junto do piso
  tingirPor(g, (_x, y) => 0.9 + 0.1 * suave(0, 0.5, y) - 0.14 * suave(3.6, altura, y));
  return g;
}

/**
 * Um trecho de lambri: tábuas verticais separadas, cada uma com uma tábua inteira da textura (as larguras
 * seguem as emendas reais da textura), folga entre elas e um tom próprio. Corre ao longo de +X local, a
 * partir de x = 0; a face da parede é z = 0 e as tábuas avançam para +Z.
 */
function trechoDeLambri(comprimento: number, altura: number, r: Sorteio): THREE.BufferGeometry[] {
  const ESP = 0.02;
  const FOLGA = 0.004;
  const tabuas: THREE.BufferGeometry[] = [];
  let x = 0;
  let k = Math.floor(r() * 7);
  while (x < comprimento - 0.01) {
    k = (k + 1 + Math.floor(r() * 5)) % 7;
    const larguraTextura = (EMENDAS_LAMBRI[k + 1] - EMENDAS_LAMBRI[k]) * 2;
    let w = larguraTextura;
    if (x + w > comprimento - 0.07) w = comprimento - x; // a última é cortada para caber
    const g = caixa(w - FOLGA, altura, ESP, 0.005);
    // a face da frente mostra a tábua k da textura, com um trecho sorteado na altura
    uvPorFace(g, { veio: 'y', veioEmV: true, du: EMENDAS_LAMBRI[k] * 2 + w / 2, dv: r() * 2 });
    const tom = 0.82 + 0.3 * r();
    tingir(g, tom, tom * (0.97 + 0.05 * r()), tom * (0.94 + 0.06 * r()));
    // mais escuro junto do rodapé (umidade, sapatos) e um pouco no alto, sob a moldura
    tingirPor(g, (_x, y) => 0.78 + 0.22 * suave(-altura / 2, -altura / 2 + 0.45, y));
    g.translate(x + w / 2, altura / 2, ESP / 2 + 0.001);
    tabuas.push(g);
    x += w;
  }
  return tabuas;
}

/** Perfil do rodapé (x = quanto avança da parede, y = altura). */
const PERFIL_RODAPE: Array<[number, number]> = [
  [0, 0],
  [0.04, 0],
  [0.04, 0.105],
  [0.035, 0.128],
  [0.027, 0.14],
  [0.027, 0.158],
  [0.02, 0.165],
  [0, 0.165],
];
/** Perfil da moldura que arremata o topo do lambri (a "cadeira"). */
const PERFIL_MOLDURA: Array<[number, number]> = [
  [0, 0],
  [0.027, 0],
  [0.036, 0.012],
  [0.05, 0.02],
  [0.054, 0.036],
  [0.054, 0.05],
  [0.04, 0.058],
  [0.03, 0.07],
  [0, 0.07],
];

export function criarArquitetura(mat: MateriaisDaSala, furoDaJanela: THREE.Vector2[], peitoril: number, semente = 11): Arquitetura {
  const r = criarSorteio(semente);
  const root = new THREE.Group();
  root.name = 'arquitetura';
  const { xEsq, zFundo, altura, lambri, xDetalhe, zDetalhe } = SALA;
  const lixo: THREE.BufferGeometry[] = [];
  const malha = (nome: string, geo: THREE.BufferGeometry, material: THREE.Material, projeta: boolean) => {
    const m = new THREE.Mesh(geo, material);
    m.name = nome;
    m.castShadow = projeta;
    m.receiveShadow = true;
    root.add(m);
    lixo.push(geo);
    return m;
  };

  malha('piso', geometriaPiso(), mat.piso, false);
  malha('forro', geometriaForro(), mat.forro, false);
  malha('paredes', geometriaParedes(furoDaJanela), mat.reboco, true);

  /* ------------------------------------------------------------ lambri, rodapé e moldura */
  const tabuas: THREE.BufferGeometry[] = [];
  const frisos: THREE.BufferGeometry[] = [];
  const Y_TABUA = 0.03;
  // parede do fundo: trechos [x0, x1] com a altura das tábuas (sob a janela elas param na saia do peitoril)
  const jx0 = JANELA.x - JANELA.largura / 2;
  const jx1 = JANELA.x + JANELA.largura / 2;
  const trechosFundo: Array<{ x0: number; x1: number; h: number; moldura: boolean }> = [
    { x0: xEsq + 0.02, x1: jx0 - 0.172, h: lambri, moldura: true },
    { x0: jx0 - 0.1, x1: jx1 + 0.1, h: peitoril - 0.1, moldura: false },
    { x0: jx1 + 0.172, x1: xDetalhe, h: lambri, moldura: true },
  ];
  for (const t of trechosFundo) {
    for (const g of trechoDeLambri(t.x1 - t.x0, t.h - Y_TABUA, r)) tabuas.push(colocar(g, t.x0, Y_TABUA, zFundo));
    if (t.moldura) frisos.push(colocar(perfilReto(PERFIL_MOLDURA, t.x1 - t.x0, r), t.x1, lambri - 0.028, zFundo, -Math.PI / 2));
  }
  // rodapé do fundo, de ponta a ponta
  frisos.push(colocar(perfilReto(PERFIL_RODAPE, xDetalhe - xEsq, r), xDetalhe, 0, zFundo, -Math.PI / 2));
  // parede esquerda: antes e depois da lareira (a pedra encosta direto no reboco)
  const lz0 = LAREIRA.z - LAREIRA.largura / 2 - 0.06;
  const lz1 = LAREIRA.z + LAREIRA.largura / 2 + 0.06;
  const trechosEsq: Array<[number, number]> = [
    [zFundo + 0.02, lz0],
    [lz1, zDetalhe],
  ];
  for (const [z0, z1] of trechosEsq) {
    if (z1 - z0 < 0.1) continue;
    for (const g of trechoDeLambri(z1 - z0, lambri - Y_TABUA, r)) tabuas.push(colocar(g, xEsq, Y_TABUA, z1, Math.PI / 2));
    frisos.push(colocar(perfilReto(PERFIL_MOLDURA, z1 - z0, r), xEsq, lambri - 0.028, z0));
    frisos.push(colocar(perfilReto(PERFIL_RODAPE, z1 - z0, r), xEsq, 0, z0));
  }
  malha('lambri', fundir(tabuas), mat.lambri, false).userData.semAO = true; // tábuas a 2 cm da parede: a oclusão vem da parede
  malha('frisos', fundir(frisos), mat.madeiraEscura, false);

  /* ------------------------------------------------------------ estrutura de madeira */
  const madeira: THREE.BufferGeometry[] = [];
  const P = TETO.pilar;
  const yCaibro = altura - TETO.caibroAltura; // face de baixo dos caibros = topo das vigas e dos frechais
  const yViga = yCaibro - TETO.vigaAltura; // face de baixo das vigas mestras
  const FRECHAL_ALT = 0.26;
  const FRECHAL_LARG = 0.2;
  const yFrechal = yCaibro - FRECHAL_ALT;
  const escurecerNoAlto = (g: THREE.BufferGeometry) => tingirPor(g, (_x, y) => 1 - 0.25 * suave(3.2, altura, y));
  // frechais: a viga deitada no topo das paredes, onde os caibros se apoiam
  madeira.push(colocar(vigaDeUmaTora(xDetalhe - xEsq, FRECHAL_ALT, FRECHAL_LARG, 'x', r), (xEsq + xDetalhe) / 2, yFrechal + FRECHAL_ALT / 2, zFundo + FRECHAL_LARG / 2 - 0.03));
  madeira.push(colocar(vigaDeUmaTora(FRECHAL_LARG, FRECHAL_ALT, zDetalhe - zFundo, 'z', r), xEsq + FRECHAL_LARG / 2 - 0.03, yFrechal + FRECHAL_ALT / 2, (zFundo + zDetalhe) / 2));
  // pilar de canto e pilares da parede do fundo, com duas mãos-francesas cada (no plano da parede)
  const pilar = (x: number, z: number, larguraX: number, larguraZ: number) => colocar(vigaDeUmaTora(larguraX, yFrechal, larguraZ, 'y', r, { raio: 0.022 }), x, yFrechal / 2, z);
  madeira.push(pilar(xEsq + P / 2 - 0.02, zFundo + P / 2 - 0.02, P, P));
  const MAO = 0.95; // quanto a mão-francesa abre para o lado e desce
  for (const x of TETO.pilaresFundoX) {
    madeira.push(pilar(x, zFundo + 0.07, P, 0.2));
    for (const lado of [-1, 1]) {
      const g = vigaDeUmaTora(MAO * Math.SQRT2 + 0.1, 0.13, 0.12, 'x', r, { raio: 0.016 });
      g.rotateZ((lado * Math.PI) / 4);
      madeira.push(colocar(g, x + (lado * (MAO + P * 0.4)) / 2, yFrechal - MAO / 2 + 0.02, zFundo + 0.08));
    }
  }
  // pilares da parede esquerda sob as vigas mestras, com uma mão-francesa para dentro da sala
  for (const z of TETO.pilaresEsqZ) {
    madeira.push(colocar(vigaDeUmaTora(0.2, yViga, P, 'y', r, { raio: 0.022 }), xEsq + 0.07, yViga / 2, z));
    const g = vigaDeUmaTora(MAO * Math.SQRT2 + 0.1, 0.13, 0.12, 'x', r, { raio: 0.016 });
    g.rotateZ(Math.PI / 4);
    madeira.push(colocar(g, xEsq + 0.1 + MAO / 2, yViga - MAO / 2 + 0.02, z));
  }
  // vigas mestras, de parede a parede
  for (const z of TETO.vigasZ) {
    const comprimento = xDetalhe + 0.6 - xEsq;
    madeira.push(colocar(vigaDeUmaTora(comprimento, TETO.vigaAltura, TETO.vigaLargura, 'x', r, { raio: 0.03 }), xEsq + comprimento / 2, yViga + TETO.vigaAltura / 2, z));
  }
  // caibros sobre as vigas, do fundo para a frente (o primeiro fica depois do peito da chaminé)
  for (let x = xEsq + 0.9; x < xDetalhe + 0.5; x += TETO.caibroPasso) {
    const comprimento = zDetalhe - zFundo;
    madeira.push(colocar(vigaDeUmaTora(TETO.caibroLargura, TETO.caibroAltura, comprimento, 'z', r, { raio: 0.012 }), x + (r() - 0.5) * 0.03, yCaibro + TETO.caibroAltura / 2, zFundo + comprimento / 2));
  }
  for (const g of madeira) escurecerNoAlto(g);
  malha('estrutura', fundir(madeira), mat.viga, false); // vigas e pilares ficam fora do cone do fogo e do luar

  return {
    root,
    dispose() {
      for (const g of lixo) g.dispose();
    },
  };
}
