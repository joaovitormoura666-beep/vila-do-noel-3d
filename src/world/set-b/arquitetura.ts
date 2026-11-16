/**
 * Arquitetura da sala B: piso de tábuas enceradas, as duas paredes do canto (reboco tingido em cima,
 * lambri de tábuas embaixo, rodapé e friso), pilares, frechal, tesouras, cumeeira, terças, caibros e forro.
 * Tudo com as texturas PBR do acervo no tamanho real (UV em metros / ladrilho) e fundido por material:
 * a arquitetura inteira custa seis chamadas de desenho.
 */
import * as THREE from 'three';
import { loadPbr } from '../../engine/assets';
import { MATERIAIS, PECAS, PLANTA } from './ajustes';
import { barra, criarSorteio, entre, escalarUv, juntar, ruido2, tingir } from './util';

export interface Arquitetura {
  root: THREE.Group;
  /** Altura do forro (face de baixo do telhado) em um z da sala. */
  alturaDoTelhado(z: number): number;
  alturaCumeeira: number;
  piso: THREE.Mesh;
  materialPiso: THREE.MeshStandardMaterial;
  /** Tamanho real (m) de uma repetição da textura do piso; o UV do piso é (z, x) / ladrilho. */
  ladrilhoPiso: number;
  dispose(): void;
}

export interface VaoParaFurar {
  /** Contorno do vão no plano da parede J (x local da janela, y), como janela.contorno() devolve. */
  contorno: THREE.Vector2[];
  /** Posição X do centro da janela na parede J. */
  x: number;
  /** Meia largura a deixar livre de friso e rodapé alto (vão + guarnição). */
  meiaLargura: number;
}

const LADRILHO = { piso: 2, reboco: 2, lambri: 2, vigas: 1.25, forro: 1.8, marcenaria: 2 };

export async function criarArquitetura(vao: VaoParaFurar): Promise<Arquitetura> {
  const root = new THREE.Group();
  root.name = 'sala-b-arquitetura';
  const r = criarSorteio(4127);
  const esp = PLANTA.espessura;
  const J = PLANTA.comprimentoJ;
  const B = PLANTA.comprimentoL;
  const beiral = PLANTA.beiral;
  const tan = Math.tan((PLANTA.inclinacao * Math.PI) / 180);
  const cumeeira = beiral + (B / 2) * tan;
  const telhado = (z: number) => beiral + Math.max(0, Math.min(z, B - z)) * tan;
  const descartaveis: Array<{ dispose(): void }> = [];

  const [mapasPiso, mapasReboco, mapasLambri, mapasVigas, mapasForro, mapasMarcenaria] = await Promise.all([
    loadPbr('dark_wooden_planks', { anisotropy: 16 }),
    loadPbr('painted_plaster_wall'),
    loadPbr('old_planks_02'),
    loadPbr('wood_trunk_wall'),
    loadPbr('weathered_brown_planks'),
    loadPbr('dark_wood'),
  ]);
  const material = (mapas: Awaited<ReturnType<typeof loadPbr>>, cor: string, extra: THREE.MeshStandardMaterialParameters = {}) => {
    const m = new THREE.MeshStandardMaterial({ ...mapas, color: cor, roughness: 1, metalness: 0, vertexColors: true, ...extra });
    descartaveis.push(m);
    for (const t of [mapas.map, mapas.normalMap, mapas.roughnessMap]) if (t) descartaveis.push(t);
    return m;
  };

  /* ------------------------------------------------------------------ piso */
  // tábuas largas correndo em Z (atravessadas à luz do fogo, que vem de +X: as frestas pegam a luz rasante)
  const pz = PLANTA.piso;
  const matPiso = material(mapasPiso, MATERIAIS.piso.cor, { roughness: MATERIAIS.piso.rugosidade, envMapIntensity: MATERIAIS.piso.reflexo });
  matPiso.normalScale.setScalar(MATERIAIS.piso.relevo);
  let piso: THREE.Mesh;
  {
    const larg = pz.xMax - pz.xMin;
    const prof = pz.zMax - pz.zMin;
    const nx = 56;
    const nz = 56;
    const pos: number[] = [];
    const uv: number[] = [];
    const cor: number[] = [];
    const idx: number[] = [];
    for (let j = 0; j <= nz; j++) {
      for (let i = 0; i <= nx; i++) {
        const x = pz.xMin + (larg * i) / nx;
        const z = pz.zMin + (prof * j) / nz;
        pos.push(x, 0, z);
        uv.push(z / LADRILHO.piso, x / LADRILHO.piso);
        // manchas largas de desgaste e cera, mais escuro junto das paredes (pó e pouca passagem)
        const mancha = 0.88 + 0.2 * ruido2(x * 0.42 + 3.1, z * 0.42 + 7.7) + 0.08 * ruido2(x * 1.3, z * 1.3);
        const borda = 1 - 0.22 * Math.exp(-Math.min(Math.abs(x), Math.abs(z)) / 0.45);
        const t = mancha * borda;
        cor.push(t, t * 0.985, t * 0.97);
      }
    }
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const a = j * (nx + 1) + i;
        const b = a + 1;
        const c = a + nx + 1;
        const d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(cor, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    descartaveis.push(g);
    piso = new THREE.Mesh(g, matPiso);
    piso.name = 'piso';
    piso.receiveShadow = true;
    root.add(piso);
  }

  /* ---------------------------------------------------------------- reboco */
  {
    // parede J: do fim da sala até passar do canto, com o furo da janela
    const forma = new THREE.Shape();
    forma.moveTo(-J, 0);
    forma.lineTo(esp, 0);
    forma.lineTo(esp, beiral);
    forma.lineTo(-J, beiral);
    forma.closePath();
    forma.holes.push(new THREE.Path(vao.contorno.map((p) => new THREE.Vector2(p.x + vao.x, p.y))));
    const gJ = new THREE.ExtrudeGeometry(forma, { depth: esp, bevelEnabled: false, curveSegments: 24 });
    gJ.translate(0, 0, -esp);
    // parede L (empena): desenhada em (z, y) e girada para o plano x = 0
    const empena = new THREE.Shape();
    empena.moveTo(0, 0);
    empena.lineTo(B, 0);
    empena.lineTo(B, beiral);
    empena.lineTo(B / 2, cumeeira + 0.3);
    empena.lineTo(0, beiral);
    empena.closePath();
    const gL = new THREE.ExtrudeGeometry(empena, { depth: esp, bevelEnabled: false });
    gL.translate(0, 0, -esp);
    gL.rotateY(-Math.PI / 2);
    const g = juntar([gJ, gL]);
    escalarUv(g, 1 / LADRILHO.reboco, 1 / LADRILHO.reboco);
    // o reboco escurece e avermelha de leve para o alto (fuligem de anos de lareira)
    tingir(g, (_x, y) => 1 - 0.1 * Math.min(1, Math.max(0, (y - 2.5) / 4)));
    descartaveis.push(g);
    const mat = material(mapasReboco, MATERIAIS.reboco);
    mat.normalScale.setScalar(MATERIAIS.rebocoNormal);
    const paredes = new THREE.Mesh(g, mat);
    paredes.name = 'reboco';
    paredes.castShadow = true;
    paredes.receiveShadow = true;
    root.add(paredes);
  }

  /* ---------------------------------------------------------------- lambri */
  const zLareira0 = PECAS.lareira.z - PECAS.lareira.largura / 2 - 0.12;
  const zLareira1 = PECAS.lareira.z + PECAS.lareira.largura / 2 + 0.12;
  {
    const tabuas: THREE.BufferGeometry[] = [];
    const yTopo = PLANTA.lambri;
    const opt = { chanfro: 0.005, faixas: 7, ladrilho: LADRILHO.lambri };
    // parede J: tábuas em pé, larguras desiguais, cada uma com um trecho diferente da textura
    for (let x = -J; x < -0.02; ) {
      const w = Math.min(entre(r, 0.17, 0.25), -0.02 - x);
      if (w > 0.05) {
        const cx = x + w / 2;
        tabuas.push(barra(new THREE.Vector3(cx, 0.02, 0.012), new THREE.Vector3(cx, yTopo, 0.012), w - 0.004, 0.024 + r() * 0.003, r, { ...opt, cima: new THREE.Vector3(0, 0, 1), tom: entre(r, 0.82, 1.06), semTampas: true }));
      }
      x += w;
    }
    // parede L: dos dois lados da lareira
    for (const [z0, z1] of [
      [0.02, zLareira0],
      [zLareira1, B],
    ]) {
      for (let z = z0; z < z1; ) {
        const w = Math.min(entre(r, 0.17, 0.25), z1 - z);
        if (w > 0.05) {
          const cz = z + w / 2;
          tabuas.push(barra(new THREE.Vector3(-0.012, 0.02, cz), new THREE.Vector3(-0.012, yTopo, cz), w - 0.004, 0.024 + r() * 0.003, r, { ...opt, cima: new THREE.Vector3(-1, 0, 0), tom: entre(r, 0.82, 1.06), semTampas: true }));
        }
        z += w;
      }
    }
    const g = juntar(tabuas);
    descartaveis.push(g);
    const lambri = new THREE.Mesh(g, material(mapasLambri, MATERIAIS.lambri));
    lambri.name = 'lambri';
    lambri.castShadow = false;
    lambri.receiveShadow = true;
    root.add(lambri);
  }

  /* ------------------------------------------------------ rodapé e friso */
  {
    // o veio de dark_wood corre em U: a textura é girada para acompanhar o comprimento das peças
    for (const t of [mapasMarcenaria.map, mapasMarcenaria.normalMap, mapasMarcenaria.roughnessMap]) {
      if (!t) continue;
      t.center.set(0.5, 0.5);
      t.rotation = Math.PI / 2;
    }
    const pecas: THREE.BufferGeometry[] = [];
    const opt = { faixas: 12, ladrilho: LADRILHO.marcenaria, semTampas: false };
    const cimaY = new THREE.Vector3(0, 1, 0);
    const trechoJ = (x0: number, x1: number, y: number, z: number, larg: number, alt: number, chanfro: number) => pecas.push(barra(new THREE.Vector3(x0, y, z), new THREE.Vector3(x1, y, z), larg, alt, r, { ...opt, chanfro, cima: cimaY, tom: entre(r, 0.9, 1.05) }));
    const trechoL = (z0: number, z1: number, y: number, x: number, larg: number, alt: number, chanfro: number) => pecas.push(barra(new THREE.Vector3(x, y, z0), new THREE.Vector3(x, y, z1), larg, alt, r, { ...opt, chanfro, cima: cimaY, tom: entre(r, 0.9, 1.05) }));
    // rodapé: tábua alta com a quina de cima quebrada, mais um cordão no pé
    trechoJ(-J, -0.05, 0.085, 0.036, 0.024, 0.17, 0.009);
    trechoJ(-J, -0.07, 0.022, 0.056, 0.022, 0.044, 0.008);
    trechoL(0.05, zLareira0, 0.085, -0.036, 0.024, 0.17, 0.009);
    trechoL(0.07, zLareira0, 0.022, -0.056, 0.022, 0.044, 0.008);
    trechoL(zLareira1, B, 0.085, -0.036, 0.024, 0.17, 0.009);
    trechoL(zLareira1, B, 0.022, -0.056, 0.022, 0.044, 0.008);
    // friso (roda-meio) sobre o lambri: tampo saliente e cordão embaixo; interrompido no vão da janela
    const yF = PLANTA.lambri;
    const friso = (fn: typeof trechoJ, a0: number, a1: number, sinal: number) => {
      fn(a0, a1, yF + 0.018, sinal * 0.034, 0.068, 0.036, 0.01);
      fn(a0, a1, yF - 0.022, sinal * 0.036, 0.022, 0.044, 0.008);
    };
    friso(trechoJ, -J, vao.x - vao.meiaLargura, 1);
    friso(trechoJ, vao.x + vao.meiaLargura, -0.02, 1);
    friso(trechoL, 0.02, zLareira0, -1);
    friso(trechoL, zLareira1, B, -1);
    const g = juntar(pecas);
    descartaveis.push(g);
    const marcenaria = new THREE.Mesh(g, material(mapasMarcenaria, MATERIAIS.marcenaria));
    marcenaria.name = 'rodape-e-friso';
    marcenaria.receiveShadow = true;
    root.add(marcenaria);
  }

  /* -------------------------------------------------- estrutura de madeira */
  {
    const pecas: THREE.BufferGeometry[] = [];
    const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
    const opt = (lavrado = 0.007) => ({ faixas: 7, ladrilho: LADRILHO.vigas, chanfro: 0.018, lavrado, tom: entre(r, 0.82, 1.08), pontasEscuras: 0.25 });
    const cimaZ = v(0, 0, 1);
    const cimaX = v(-1, 0, 0);
    const normalTelhadoA = v(0, 1, -tan).normalize(); // água de trás (da parede J até a cumeeira)
        // pilar do canto e pilares sob as tesouras, na parede J
    pecas.push(barra(v(-0.13, 0, 0.13), v(-0.13, beiral - 0.22, 0.13), 0.26, 0.26, r, { ...opt(0.009), cima: cimaZ }));
    for (const x of PLANTA.tesouras) pecas.push(barra(v(x, 0, 0.11), v(x, beiral - 0.22, 0.11), 0.22, 0.22, r, { ...opt(0.008), cima: cimaZ }));
    // frechal: a viga que coroa a parede J e recebe o telhado
    pecas.push(barra(v(-J, beiral - 0.11, 0.14), v(0.02, beiral - 0.11, 0.14), 0.28, 0.24, r, opt(0.008)));
    // viga de amarração na empena, à altura do beiral, dos dois lados do peito da chaminé
    const meioPeito = PECAS.lareira.largura * 0.32 + 0.1;
    pecas.push(barra(v(-0.1, beiral - 0.11, 0.26), v(-0.1, beiral - 0.11, PECAS.lareira.z - meioPeito), 0.2, 0.24, r, { ...opt(), cima: v(0, 1, 0) }));
    pecas.push(barra(v(-0.1, beiral - 0.11, PECAS.lareira.z + meioPeito), v(-0.1, beiral - 0.11, B), 0.2, 0.24, r, { ...opt(), cima: v(0, 1, 0) }));
    // pernas da empena acompanhando a água do telhado
    {
      const z1 = PECAS.lareira.z - meioPeito - 0.05;
      pecas.push(barra(v(-0.09, telhado(0.2) - 0.14, 0.2), v(-0.09, telhado(z1) - 0.14, z1), 0.18, 0.2, r, { ...opt(), cima: normalTelhadoA }));
      const z2 = PECAS.lareira.z + meioPeito + 0.05;
      pecas.push(barra(v(-0.09, telhado(z2) - 0.14, z2), v(-0.09, cumeeira - 0.3, B / 2), 0.18, 0.2, r, { ...opt(), cima: normalTelhadoA }));
    }
    // tesouras: linha (tirante), pendural, pernas, escoras e mãos-francesas
    for (const x of PLANTA.tesouras) {
      const yLinha = beiral + 0.15;
      pecas.push(barra(v(x, yLinha, -0.02), v(x, yLinha, B + 0.2), 0.24, 0.3, r, opt(0.01)));
      pecas.push(barra(v(x, yLinha + 0.15, B / 2), v(x, cumeeira - 0.3, B / 2), 0.2, 0.2, r, { ...opt(), cima: cimaX }));
      pecas.push(barra(v(x, yLinha + 0.1, 0.25), v(x, cumeeira - 0.26, B / 2 - 0.08), 0.2, 0.24, r, { ...opt(), cima: normalTelhadoA }));
      const zE = B * 0.27;
      pecas.push(barra(v(x, yLinha + 0.16, B / 2 - 0.25), v(x, telhado(zE) - 0.42, zE), 0.14, 0.16, r, { ...opt(0.005), cima: normalTelhadoA }));
      // mão-francesa do pilar à linha
      pecas.push(barra(v(x, beiral - 1.35, 0.2), v(x, yLinha - 0.12, 1.42), 0.15, 0.16, r, { ...opt(0.005), cima: v(0, 1, -1).normalize() }));
    }
    // cumeeira e terças
    pecas.push(barra(v(-J, cumeeira - 0.2, B / 2), v(0.0, cumeeira - 0.2, B / 2), 0.2, 0.3, r, opt(0.01)));
    for (const z of [B * 0.18, B * 0.34]) pecas.push(barra(v(-J, telhado(z) - 0.2, z), v(0, telhado(z) - 0.2, z), 0.17, 0.2, r, { ...opt(), cima: normalTelhadoA }));
    // caibros a cada 70 cm, na água de trás
    for (let x = -J + 0.35; x < -0.1; x += 0.7) {
      const dx = (r() - 0.5) * 0.04;
      pecas.push(barra(v(x + dx, telhado(0.3) - 0.075, 0.3), v(x + dx, cumeeira - 0.075 - 0.06 * tan, B / 2 - 0.06), 0.085, 0.13, r, { ...opt(0.004), chanfro: 0.008, cima: normalTelhadoA, semTampas: true }));
    }
    const g = juntar(pecas);
    descartaveis.push(g);
    const estrutura = new THREE.Mesh(g, material(mapasVigas, MATERIAIS.vigas));
    estrutura.name = 'estrutura-de-madeira';
    estrutura.castShadow = true;
    estrutura.receiveShadow = true;
    root.add(estrutura);
  }

  /* ----------------------------------------------------------------- forro */
  {
    // a água de trás, de tábuas atravessadas aos caibros (as tábuas correm em X, ao longo da cumeeira).
    // A água da frente não é construída: fica do lado da câmera, como a parede cortada de um estúdio.
    const aguas: THREE.BufferGeometry[] = [];
    const comprimentoAgua = Math.hypot(B / 2 + 0.4, (B / 2 + 0.4) * tan);
    for (const lado of [0]) {
      const zBeiral = -0.4;
      const yBeiral = beiral - 0.4 * tan;
      const nx = 12;
      const ns = 4;
      const pos: number[] = [];
      const uv: number[] = [];
      const idx: number[] = [];
      for (let j = 0; j <= ns; j++) {
        for (let i = 0; i <= nx; i++) {
          const x = -J + ((J + esp) * i) / nx;
          const f = j / ns;
          pos.push(x, yBeiral + (cumeeira - yBeiral) * f, zBeiral + (B / 2 - zBeiral) * f);
          uv.push(x / LADRILHO.forro, (f * comprimentoAgua) / LADRILHO.forro + lado * 0.37);
        }
      }
      for (let j = 0; j < ns; j++) {
        for (let i = 0; i < nx; i++) {
          const a = j * (nx + 1) + i;
          const b = a + 1;
          const c = a + nx + 1;
          const d = c + 1;
          idx.push(a, b, c, b, d, c);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx);
      g.computeVertexNormals();
      aguas.push(g);
    }
    const g = juntar(aguas);
    tingir(g, (x, _y, z) => 0.8 + 0.3 * ruido2(x * 0.5, z * 0.5));
    descartaveis.push(g);
    const forro = new THREE.Mesh(g, material(mapasForro, MATERIAIS.forro, { side: THREE.DoubleSide }));
    forro.name = 'forro';
    forro.castShadow = true;
    forro.receiveShadow = true;
    root.add(forro);
  }

  return {
    root,
    alturaDoTelhado: telhado,
    alturaCumeeira: cumeeira,
    piso,
    materialPiso: matPiso,
    ladrilhoPiso: LADRILHO.piso,
    dispose() {
      for (const d of descartaveis) d.dispose();
    },
  };
}
