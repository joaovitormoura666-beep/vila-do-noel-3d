/**
 * Estúdio da janela e dos tecidos: uma parede de reboco com o vão aberto, um fundo azul noturno em
 * degradê atrás (a paisagem de verdade é de outra peça), o luar entrando pela janela com sombra, uma
 * luz quente baixa de lado (como a de uma lareira fora do quadro), o tapete no piso à frente e duas
 * meias penduradas em uma tábua.
 *   node tools/shot.cjs sala --param set=kit-janela --out lab/fotos/kit-janela/final.png
 * Parâmetros extras do endereço (só deste estúdio):
 *   luar=0            desliga o luar (para ver só a luz quente)      quente=0   desliga a luz quente
 *   arco=0            verga reta                                      banco=1    assento de janela
 *   abertura=0.3      quanto as cortinas estão recolhidas             cortinas=0 sem cortinas
 *   tapete=retangular tapete retangular em vez do redondo             colunas=6, linhas=4, largura=3.4, altura=3.6
 *   extras=1          almofada e manta no piso (peças opcionais)
 *   numeros=1         escreve no console (como aviso) as malhas e os triângulos de cada peça
 */
import * as THREE from 'three';
import type { BuildVillageSet } from '../contracts';
import { loadPbr } from '../../engine/assets';
import { criarEstudio } from '../kit/estudio';
import type { Peca } from '../kit/tipos';
import { criarJanela } from '../kit/janela';
import { arredondar, barra } from '../kit/janela/marcenaria';
import { LADRILHO_MADEIRA, materialMadeira } from '../kit/janela/materiais';
import { contarPeca, escalarUv, pintar } from '../kit/janela/util';
import { criarAlmofada, criarManta, criarMeia, criarTapete } from '../kit/tecidos';

/** Fundo noturno simples: degradê do azul quase preto do alto ao azul da neve embaixo. */
function fundoNoturno(largura: number, altura: number): THREE.Mesh {
  const canvas = document.createElement('canvas');
  canvas.width = 8;
  canvas.height = 256;
  const c = canvas.getContext('2d')!;
  const g = c.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#040817');
  g.addColorStop(0.4, '#0a1630');
  g.addColorStop(0.62, '#132650');
  g.addColorStop(0.8, '#213b6c');
  g.addColorStop(1, '#2c4a7e');
  c.fillStyle = g;
  c.fillRect(0, 0, 8, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(largura, altura), new THREE.MeshBasicMaterial({ map: tex, fog: false }));
  m.name = 'fundo-noturno';
  m.userData.semAO = true;
  return m;
}

export const buildVillageSet: BuildVillageSet = async (ctx) => {
  const params = new URLSearchParams(location.search);
  const num = (nome: string, padrao: number) => (params.has(nome) ? Number(params.get(nome)) : padrao);
  const tamanho = 22;
  const altura = 8;
  const zParede = -5; // o vidro fica neste z
  const xJanela = -0.45;

  const janela = await criarJanela(ctx, {
    largura: num('largura', 3),
    altura: num('altura', 3.2),
    peitoril: num('peitoril', 0.75),
    arco: params.get('arco') !== '0',
    colunas: num('colunas', 4),
    linhas: num('linhas', 3),
    banco: params.get('banco') === '1',
    cortinas: params.get('cortinas') !== '0',
    aberturaCortinas: num('abertura', 0.85),
    semente: num('semente', 1),
  });
  janela.root.position.set(xJanela, 0, zParede);

  // adereços do estúdio: parede com o vão, rodapé, fundo noturno e a tábua das meias
  const cenario: Peca = { root: new THREE.Group(), update() {}, setQuality() {}, dispose() {} };
  cenario.root.name = 'estudio-janela';
  {
    const forma = new THREE.Shape();
    forma.moveTo(-tamanho / 2, 0);
    forma.lineTo(tamanho / 2, 0);
    forma.lineTo(tamanho / 2, altura);
    forma.lineTo(-tamanho / 2, altura);
    forma.closePath();
    const furo = new THREE.Path(janela.contorno().map((p) => new THREE.Vector2(p.x + xJanela, p.y)));
    forma.holes.push(furo);
    const esp = janela.vao.zDentro - janela.vao.zFora;
    const geo = new THREE.ExtrudeGeometry(forma, { depth: esp, bevelEnabled: false, curveSegments: 24 });
    geo.translate(0, 0, zParede + janela.vao.zFora);
    escalarUv(geo, 1 / 1.7, 1 / 1.7);
    const reboco = new THREE.MeshStandardMaterial({ ...(await loadPbr('clay_plaster', { maps: ['diff', 'nor'] })), roughness: 0.93, metalness: 0 });
    reboco.color.setRGB(3.3, 4.0, 5.6); // o reboco baixado é barro escuro: clareia para o creme da referência
    reboco.normalScale.set(0.55, 0.55);
    const parede = new THREE.Mesh(geo, reboco);
    parede.name = 'parede-reboco';
    parede.castShadow = true;
    parede.receiveShadow = true;
    cenario.root.add(parede);

    const madeira = await materialMadeira();
    const zFace = zParede + janela.vao.zDentro;
    // rodapé de madeira com perfil
    const rodape = barra(
      new THREE.Vector2(-tamanho / 2, 0.075),
      new THREE.Vector2(tamanho / 2, 0.075),
      arredondar(
        [
          [-0.075, zFace],
          [0.075, zFace],
          [0.075, zFace + 0.012],
          [0.05, zFace + 0.022],
          [-0.075, zFace + 0.024],
        ],
        [0, 0, 0.004, 0.006, 0.004],
      ),
      { ladrilho: LADRILHO_MADEIRA },
    );
    const malhaRodape = new THREE.Mesh(pintar(rodape, '#ffffff', 0.9), madeira);
    malhaRodape.receiveShadow = true;
    cenario.root.add(malhaRodape);

    const fundo = fundoNoturno(tamanho, 12);
    fundo.position.set(0, 4.2, zParede - 2.6);
    cenario.root.add(fundo);
    // chão de neve lá fora, só uma cor (o que se vê por baixo dos vidros)
    const chao = new THREE.Mesh(new THREE.PlaneGeometry(tamanho, 2.6), new THREE.MeshBasicMaterial({ color: '#2a4577', fog: false }));
    chao.rotation.x = -Math.PI / 2;
    chao.position.set(0, 0.45, zParede + janela.vao.zFora - 1.3);
    chao.userData.semAO = true;
    cenario.root.add(chao);
  }

  // tapete no piso, à frente da janela, onde cai o recorte do luar
  const tapete = await criarTapete(ctx, params.get('tapete') === 'retangular' ? { forma: 'retangular', largura: 2.5, comprimento: 3.3, semente: 2 } : { forma: 'redondo', largura: 2.9, semente: 2 });
  tapete.root.position.set(0.25, 0, -2.25);
  tapete.root.rotation.y = params.get('tapete') === 'retangular' ? Math.PI / 2 + 0.04 : 0.3;

  // tábua com duas meias, na parede ao lado da janela
  const meias: Peca[] = [];
  {
    const madeira = await materialMadeira();
    const zFace = zParede + janela.vao.zDentro;
    const xTabua = 2.42;
    const yTabua = 1.72;
    const tabua = barra(
      new THREE.Vector2(xTabua - 0.44, yTabua),
      new THREE.Vector2(xTabua + 0.44, yTabua),
      arredondar(
        [
          [-0.07, zFace],
          [0.07, zFace],
          [0.07, zFace + 0.028],
          [-0.07, zFace + 0.028],
        ],
        [0, 0, 0.008, 0.008],
        3,
      ),
      { ladrilho: LADRILHO_MADEIRA, uvU: 0.4, uvV: 0.3 },
    );
    const malhaTabua = new THREE.Mesh(pintar(tabua, '#ffffff', 1), madeira);
    malhaTabua.castShadow = true;
    malhaTabua.receiveShadow = true;
    cenario.root.add(malhaTabua);
    const m1 = await criarMeia(ctx, { corDetalhe: '#d9cfb8', virada: 'direita', semente: 1 });
    m1.root.position.set(xTabua - 0.2, yTabua - 0.01, zFace + 0.028);
    const m2 = await criarMeia(ctx, { cor: '#1d5240', corDetalhe: '#b9343c', virada: 'direita', semente: 4, tamanho: 0.43 });
    m2.root.position.set(xTabua + 0.2, yTabua - 0.01, zFace + 0.028);
    meias.push(m1, m2);
  }

  const pecas: Peca[] = [cenario, janela, tapete, ...meias];
  if (params.get('extras') === '1') {
    // peças opcionais, sobre um caixote simples só para apoiar: almofada, manta dobrada e manta jogada em uma barra
    const almofada = await criarAlmofada(ctx, { lado: 0.46 });
    almofada.root.position.set(2.0, 0, -3.2);
    almofada.root.rotation.y = 0.5;
    const dobrada = await criarManta(ctx, { modo: 'dobrada', semente: 2 });
    dobrada.root.position.set(2.9, 0, -3.3);
    dobrada.root.rotation.y = -0.3;
    const jogada = await criarManta(ctx, { modo: 'jogada', cor: '#6a1b24', semente: 3 });
    jogada.root.position.set(2.5, 0.75, -4.0);
    jogada.root.rotation.y = Math.PI / 2;
    const barraApoio = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 1.3, 20), await materialMadeira());
    barraApoio.geometry.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(barraApoio.geometry.getAttribute('position').count * 3).fill(1), 3));
    barraApoio.rotation.z = Math.PI / 2;
    barraApoio.position.set(2.5, 0.75 - 0.11, -4.0);
    barraApoio.castShadow = true;
    cenario.root.add(barraApoio);
    pecas.push(almofada, dobrada, jogada);
  }
  if (params.has('reflexo')) (janela.vidro.material as THREE.MeshPhysicalMaterial).envMapIntensity = num('reflexo', 2.2); // só para conferir o reflexo do vidro
  if (params.get('numeros') === '1') {
    for (const [nome, p] of [['janela com cortinas', janela], ['tapete', tapete], ['meia', meias[0]]] as Array<[string, Peca]>) {
      const n = contarPeca(p.root);
      console.warn(`[numeros] ${nome}: ${n.malhas} malhas, ${n.triangulos} triangulos (${n.lista})`);
    }
  }

  const set = await criarEstudio(ctx, {
    pecas,
    tamanho,
    altura,
    luzQuente: 0,
    luzFria: 0,
    camera: { fov: 34, position: [0.2, 2.1, 11.4], target: [0.2, 1.45, -5] },
    look: {
      background: '#0a0706',
      exposure: 1.08,
      environmentIntensity: 0.55,
      ao: { radius: 0.4, intensity: 1 },
      bloom: { strength: 0.16, radius: 0.5, threshold: 1.0 },
      finish: { vignette: 0.36, vignetteColor: '#120805', warmth: 0.18, grain: 0.1 },
    },
  });

  // luar: luz azul com sombra, vinda de fora e do alto, atravessando a janela. Por padrão é um spot estreito e
  // distante, sem queda com a distância (raios quase paralelos): equivale a uma direcional, mas só ilumina o cone
  // que passa pela janela. Com luar=direcional usa-se a DirectionalLight (o que ficar fora do quadro da sombra
  // dela recebe luz sem sombra: a composição precisa cobrir a sala inteira com a câmera de sombra).
  const forcaLuar = params.get('luar') === '0' ? 0 : num('forcaLuar', 2.0);
  const alvo = new THREE.Vector3(xJanela + 0.35, 1.2, zParede + 1.6);
  const rumo = new THREE.Vector3(-0.2, 0.74, -0.86).normalize();
  let luar: THREE.DirectionalLight | THREE.SpotLight;
  if (params.get('luar') === 'direcional') {
    const d = new THREE.DirectionalLight('#2c74cc', forcaLuar);
    // a direcional ilumina tudo o que a sombra não cobre: o quadro da sombra pega a sala inteira e um teto
    // invisível (só entra no mapa de sombra) fecha o que passaria por cima da parede
    d.shadow.camera.left = -13;
    d.shadow.camera.right = 13;
    d.shadow.camera.top = 13;
    d.shadow.camera.bottom = -13;
    d.shadow.camera.near = 2;
    d.shadow.camera.far = 60;
    const teto = new THREE.Mesh(new THREE.BoxGeometry(tamanho + 4, 0.2, tamanho + 4), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
    teto.name = 'teto-de-sombra';
    teto.position.set(0, altura + 0.1, zParede + (tamanho + 4) / 2 - 0.5);
    teto.castShadow = true;
    teto.userData.semAO = true;
    set.root.add(teto);
    luar = d;
  } else {
    luar = janela.luar({ forca: forcaLuar, alvo: alvo.clone().sub(janela.root.position), deOnde: rumo });
  }
  if (luar instanceof THREE.DirectionalLight) {
    luar.position.copy(alvo).addScaledVector(rumo, 26);
    luar.target.position.copy(alvo);
    luar.castShadow = true;
    luar.shadow.mapSize.set(2048, 2048); // o nível de qualidade ajusta (ver setQuality no fim)
    luar.shadow.bias = -0.0004;
    luar.shadow.normalBias = 0.02;
    luar.shadow.radius = 3; // penumbra: a lua não é um ponto
  }
  // luz quente baixa, de lado: a "lareira" fora do quadro, à direita
  const quente = new THREE.SpotLight('#ffbe85', params.get('quente') === '0' ? 0 : num('quente', 125), 30, 0.68, 0.85, 1.5);
  quente.position.set(5.2, 2.3, 3.2);
  quente.target.position.set(-0.6, 1.7, -5);
  quente.castShadow = true;
  quente.shadow.mapSize.set(2048, 2048);
  quente.shadow.bias = -0.0004;
  quente.shadow.normalBias = 0.03;
  quente.shadow.radius = 2.5;
  quente.shadow.camera.near = 2;
  quente.shadow.camera.far = 16;
  // preenchimento quente bem baixo, para as sombras ficarem marrons e não pretas
  const preenchimento = new THREE.HemisphereLight('#ffc890', '#3a2014', 0.36);
  if (luar instanceof THREE.DirectionalLight) set.root.add(luar, luar.target);
  set.root.add(quente, quente.target, preenchimento);

  // reflexos: ambiente gerado da própria cena do estúdio (latão, vidro, cera da madeira)
  const cena = new THREE.Scene();
  cena.background = new THREE.Color('#1a0f0a');
  cena.add(set.root);
  // o estúdio não tem o resto da sala: painéis luminosos fazem as vezes do clarão do fogo e das paredes
  // quentes atrás da câmera, só para os reflexos (não entram na cena fotografada)
  const painel = (cor: string, forca: number, w: number, h: number, pos: [number, number, number]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(cor).multiplyScalar(forca), side: THREE.DoubleSide }));
    m.position.set(...pos);
    m.lookAt(0.2, 1.6, -1.5);
    cena.add(m);
    return m;
  };
  const paineis = [painel('#ff9a45', 5, 1.6, 1.2, [6.5, 0.9, 3.5]), painel('#6a3d22', 1, 18, 7, [0, 3.5, 9]), painel('#ffd9a0', 1.4, 0.5, 0.7, [-3.5, 2.2, 7])];
  set.root.updateMatrixWorld(true);
  const pmrem = new THREE.PMREMGenerator(ctx.renderer);
  const ambiente = pmrem.fromScene(cena, 0.02, 0.1, 40, { position: new THREE.Vector3(0.2, 1.6, -1.5) });
  pmrem.dispose();
  cena.remove(set.root);
  for (const m of paineis) {
    m.geometry.dispose();
    (m.material as THREE.Material).dispose();
  }
  set.environment = ambiente.texture;

  const qualidadeBase = set.setQuality;
  set.setQuality = (level) => {
    qualidadeBase(level);
    // o recorte do luar é o que a peça tem a mostrar: a sombra fica ligada em todo nível, só com o mapa menor na baixa
    const lado = (level === 'baixa' ? 1024 : 2048) * (luar instanceof THREE.DirectionalLight ? 2 : 1);
    if (luar.shadow.mapSize.x !== lado) {
      luar.shadow.mapSize.set(lado, lado);
      luar.shadow.map?.dispose();
      luar.shadow.map = null;
    }
    quente.castShadow = level === 'alta';
  };
  set.setQuality(ctx.level);
  const descartar = set.dispose;
  set.dispose = () => {
    descartar();
    ambiente.dispose();
  };
  return set;
};
