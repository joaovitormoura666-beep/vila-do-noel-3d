/**
 * Estúdio do exterior: a vila nevada vista de dentro de uma sala escura provisória, por um vão de janela de
 * 3,2 m x 3,4 m com o peitoril a 0,75 m, com a câmera onde o jogo a põe.
 *   node tools/shot.cjs sala --param set=kit-exterior --out lab/fotos/kit-exterior/foto.png
 * Parâmetros extras do endereço (só deste estúdio):
 *   efeito=SLEIGH_PASS&progresso=0.5      trenó congelado em um ponto do arco
 *   efeito=MAGICAL_NIGHT&intensidade=1    aurora plena
 *   semente=7                             outra vila
 *   parede=0                              sem a parede provisória (para ver o diorama de fora, por cima)
 *   giro=30                               gira a peça e a parede em volta do centro da janela (vista em ângulo, em graus)
 *   prof=160 larg=200                     opções de profundidade e largura
 *   ganho=1.2                             brilho do exterior
 *   numeros=1                             escreve no console (como aviso) as malhas e os triângulos da peça
 */
import * as THREE from 'three';
import type { BuildVillageSet } from '../contracts';
import { criarEstudio } from '../kit/estudio';
import type { Peca } from '../kit/tipos';
import { criarExterior } from '../kit/exterior';

export const buildVillageSet: BuildVillageSet = async (ctx) => {
  const params = new URLSearchParams(location.search);
  const num = (chave: string, padrao: number) => (params.has(chave) && Number.isFinite(Number(params.get(chave))) ? Number(params.get(chave)) : padrao);
  const exterior = await criarExterior(ctx, {
    semente: num('semente', 7),
    profundidade: params.has('prof') ? num('prof', 120) : undefined,
    largura: params.has('larg') ? num('larg', 260) : undefined,
    ganho: num('ganho', 1),
    condutor: params.get('condutor') === '1',
    // a composição informa de onde a câmera olha pela janela (aqui, o mesmo giro da parede)
    azimuteVista: num('giro', 0),
  });
  if (params.get('numeros') === '1') {
    const n = exterior.numeros();
    console.warn(`[numeros] exterior: ${n.malhas} chamadas de desenho próprias, ${n.triangulos} triângulos (${n.detalhe})`);
  }

  // parede e piso provisórios, só do estúdio: escuros, para o recorte frio da janela ser o assunto
  const sala: Peca = { root: new THREE.Group(), update() {}, setQuality() {}, dispose() {} };
  const matParede = new THREE.MeshStandardMaterial({ color: '#2a1c15', roughness: 0.95 });
  const matPiso = new THREE.MeshStandardMaterial({ color: '#241710', roughness: 0.8 });
  const descartaveis: Array<{ dispose(): void }> = [matParede, matPiso];
  if (params.get('parede') !== '0') {
    const L = 3.2;
    const A = 3.4;
    const P = 0.75;
    const esp = 0.36;
    const bloco = (x: number, y: number, w: number, h: number) => {
      const g = new THREE.BoxGeometry(w, h, esp);
      const mesh = new THREE.Mesh(g, matParede);
      mesh.position.set(x, y, esp / 2 - 0.1);
      sala.root.add(mesh);
      descartaveis.push(g);
    };
    bloco(-(L / 2 + 7), 5, 14, 10); // esquerda
    bloco(L / 2 + 7, 5, 14, 10); // direita
    bloco(0, P / 2, L, P); // peitoril
    bloco(0, P + A + (10 - P - A) / 2, L, 10 - P - A); // verga
    const gp = new THREE.PlaneGeometry(31, 14);
    const piso = new THREE.Mesh(gp, matPiso);
    piso.rotation.x = -Math.PI / 2;
    piso.position.set(0, 0, 7.2);
    sala.root.add(piso);
    descartaveis.push(gp);
  }
  sala.dispose = () => descartaveis.forEach((d) => d.dispose());

  // vista em ângulo: gira a peça e a parede juntas, como a composição fará com uma janela em parede lateral
  const giro = (num('giro', 0) * Math.PI) / 180;
  exterior.root.rotation.y = giro;
  sala.root.rotation.y = giro;

  // a luz da janela, como a composição fará: direcional azul com a direção sugerida, copiando luzExterna a cada quadro
  const luzJanela = new THREE.DirectionalLight(exterior.luar.cor, exterior.luar.intensidade);
  const luzes: Peca = {
    root: new THREE.Group(),
    update() {
      luzJanela.color.copy(exterior.luzExterna.cor);
      luzJanela.intensity = exterior.luzExterna.intensidade;
    },
    setQuality() {},
    dispose() {},
  };
  luzJanela.position.copy(exterior.luar.direcao).applyAxisAngle(new THREE.Vector3(0, 1, 0), giro).multiplyScalar(12);
  luzes.root.add(luzJanela);

  return criarEstudio(ctx, {
    pecas: [exterior, sala, luzes],
    fundo: 'vazio',
    luzQuente: 0,
    luzFria: 0,
    camera: { fov: 30, position: [0.6, 2.0, 7], target: [0, 2.2, 0], sway: 0.12 },
    look: {
      background: '#05070d',
      exposure: 1,
      ao: null,
      bloom: { strength: 0.22, radius: 0.5, threshold: 0.95 },
      finish: { vignette: 0.3, vignetteColor: '#080507', warmth: 0.12, grain: 0.1 },
    },
    onAmbient(efeito, estado) {
      if (efeito === 'SLEIGH_PASS') exterior.setTreno(estado.progress, estado.intensity);
      if (efeito === 'MAGICAL_NIGHT') exterior.setNoiteMagica(estado.intensity);
    },
  });
};
