/**
 * Assento de janela (opcional): caixa de madeira almofadada sob o peitoril, com frente em quadros e
 * almofadas (painéis rebaixados), rodapé e um almofadão de veludo por cima. Encosta na parede em
 * z = zParede e avança para a sala.
 */
import * as THREE from 'three';
import type { KitContext, Peca } from '../tipos';
import { VERDE_VELUDO, geometriaAlmofadao } from '../tecidos/almofada';
import { materialCordao, materialVeludo } from '../tecidos/cortina';
import { LADRILHO_MADEIRA, materialMadeira } from './materiais';
import { criarSorteio, escalarUv, juntar, pintar } from './util';

/** Altura do almofadão que vai sobre o tampo do assento. */
export const ALTURA_ALMOFADAO = 0.1;

export interface BancoOpcoes {
  largura: number;
  /** Altura do tampo de madeira (o almofadão vai por cima). */
  altura: number;
  zParede: number;
  profundidade?: number;
  corTecido?: THREE.ColorRepresentation;
  semente?: number;
}

/** Quadro com furos (montantes e travessas) e painéis rebaixados com a borda chanfrada, no plano XY, de frente para +Z. */
function frenteEmQuadros(largura: number, altura: number, paineis: number, r: () => number): THREE.BufferGeometry[] {
  const geos: THREE.BufferGeometry[] = [];
  const montante = 0.075;
  const s = new THREE.Shape();
  s.moveTo(-largura / 2, 0);
  s.lineTo(largura / 2, 0);
  s.lineTo(largura / 2, altura);
  s.lineTo(-largura / 2, altura);
  s.closePath();
  const lp = (largura - montante * (paineis + 1)) / paineis;
  for (let i = 0; i < paineis; i++) {
    const x0 = -largura / 2 + montante + i * (lp + montante);
    const y0 = montante + 0.02;
    const y1 = altura - montante;
    const furo = new THREE.Path();
    furo.moveTo(x0, y0);
    furo.lineTo(x0, y1);
    furo.lineTo(x0 + lp, y1);
    furo.lineTo(x0 + lp, y0);
    furo.closePath();
    s.holes.push(furo);
    // painel: tábua rebaixada com a borda em chanfro largo (almofada de marcenaria)
    const p = new THREE.Shape();
    p.moveTo(x0 - 0.004, y0 - 0.004);
    p.lineTo(x0 + lp + 0.004, y0 - 0.004);
    p.lineTo(x0 + lp + 0.004, y1 + 0.004);
    p.lineTo(x0 - 0.004, y1 + 0.004);
    p.closePath();
    const painel = new THREE.ExtrudeGeometry(p, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.009, bevelSize: 0.03, bevelOffset: -0.03, bevelSegments: 2, steps: 1 });
    painel.translate(0, 0, -0.014);
    escalarUv(painel, 1 / LADRILHO_MADEIRA, 1 / LADRILHO_MADEIRA, r() * 5, r() * 5);
    geos.push(pintar(painel, '#ffffff', 0.9 + r() * 0.1));
  }
  const quadro = new THREE.ExtrudeGeometry(s, { depth: 0.016, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelOffset: -0.004, bevelSegments: 2, steps: 1 });
  quadro.translate(0, 0, -0.012);
  escalarUv(quadro, 1 / LADRILHO_MADEIRA, 1 / LADRILHO_MADEIRA, r() * 5, r() * 5);
  geos.push(pintar(quadro, '#ffffff', 0.98));
  return geos;
}

export async function criarBancoDaJanela(_ctx: KitContext, o: BancoOpcoes): Promise<Peca> {
  const L = o.largura;
  const prof = o.profundidade ?? 0.5;
  const r = criarSorteio((o.semente ?? 1) * 131 + 3);
  const tampo = 0.036;
  const hCaixa = o.altura - tampo;
  const zFrente = o.zParede + prof - 0.03;
  const madeiras: THREE.BufferGeometry[] = [];

  // frente e dois lados em quadros com painéis
  const nPaineis = Math.max(2, Math.round(L / 0.8));
  for (const g of frenteEmQuadros(L - 0.04, hCaixa, nPaineis, r)) {
    g.translate(0, 0, zFrente);
    madeiras.push(g);
  }
  for (const lado of [-1, 1]) {
    for (const g of frenteEmQuadros(prof - 0.03, hCaixa, 1, r)) {
      g.rotateY((lado * Math.PI) / 2);
      g.translate(lado * (L / 2 - 0.02), 0, o.zParede + (prof - 0.03) / 2);
      madeiras.push(g);
    }
  }
  // tampo com o nariz arredondado
  {
    const s = new THREE.Shape();
    s.moveTo(-L / 2, o.zParede);
    s.lineTo(L / 2, o.zParede);
    s.lineTo(L / 2, o.zParede + prof);
    s.lineTo(-L / 2, o.zParede + prof);
    s.closePath();
    const ch = 0.012;
    const g = new THREE.ExtrudeGeometry(s, { depth: tampo - 2 * ch, bevelEnabled: true, bevelThickness: ch, bevelSize: ch, bevelOffset: -ch, bevelSegments: 3, steps: 1 });
    g.rotateX(Math.PI / 2);
    g.computeBoundingBox();
    g.translate(0, o.altura - g.boundingBox!.max.y, 0);
    escalarUv(g, 1 / LADRILHO_MADEIRA, 1 / LADRILHO_MADEIRA, r() * 5, r() * 5);
    madeiras.push(pintar(g, '#ffffff', 1.02));
  }
  // rodapé
  {
    const s = new THREE.Shape();
    s.moveTo(-L / 2 + 0.008, o.zParede);
    s.lineTo(L / 2 - 0.008, o.zParede);
    s.lineTo(L / 2 - 0.008, zFrente + 0.016);
    s.lineTo(-L / 2 + 0.008, zFrente + 0.016);
    s.closePath();
    const ch = 0.008;
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.085 - ch, bevelEnabled: true, bevelThickness: ch, bevelSize: ch, bevelOffset: -ch, bevelSegments: 2, steps: 1 });
    g.rotateX(Math.PI / 2);
    g.computeBoundingBox();
    g.translate(0, 0.085 - g.boundingBox!.max.y, 0);
    escalarUv(g, 1 / LADRILHO_MADEIRA, 1 / LADRILHO_MADEIRA, r() * 5, r() * 5);
    madeiras.push(pintar(g, '#ffffff', 0.9));
  }

  const root = new THREE.Group();
  root.name = 'banco-janela';
  const lixo: Array<{ dispose(): void }> = [];
  const madeira = new THREE.Mesh(juntar(madeiras, true), await materialMadeira());
  madeira.name = 'banco-madeira';
  madeira.castShadow = true;
  madeira.receiveShadow = true;
  root.add(madeira);
  lixo.push(madeira.geometry);

  // almofadão de veludo sobre o tampo
  const hAlm = ALTURA_ALMOFADAO;
  const { pano, vivos } = geometriaAlmofadao(L - 0.06, prof - 0.05, hAlm, o.semente ?? 1);
  const veludo = await materialVeludo(o.corTecido ?? VERDE_VELUDO, 0.35);
  const alm = new THREE.Mesh(pano, veludo);
  alm.name = 'banco-almofadao';
  alm.position.set(0, o.altura, o.zParede + prof / 2 + 0.005);
  alm.castShadow = true;
  alm.receiveShadow = true;
  const viv = new THREE.Mesh(pintar(vivos, '#ffffff'), materialCordao());
  viv.name = 'banco-vivos';
  viv.position.copy(alm.position);
  root.add(alm, viv);
  lixo.push(pano, vivos, veludo);

  return {
    root,
    update() {},
    setQuality() {},
    dispose() {
      for (const l of lixo) l.dispose();
    },
  };
}
