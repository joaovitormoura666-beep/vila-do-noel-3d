/**
 * Ambiente próprio para os reflexos dos enfeites (bolas de vidro, estrela, fitas): uma salinha esquemática
 * com o clarão quente de uma lareira de um lado, o recorte azul de uma janela do outro e os pontinhos das
 * lampadinhas em volta. Serve enquanto a composição não entrega o ambiente da sala de verdade
 * (opção `envMap` das peças). É gerado uma vez por renderizador.
 */
import * as THREE from 'three';
import { acaso } from './util';

const prontos = new WeakMap<THREE.WebGLRenderer, THREE.Texture>();

export function ambienteDosEnfeites(renderer: THREE.WebGLRenderer): THREE.Texture {
  const pronto = prontos.get(renderer);
  if (pronto) return pronto;
  const cena = new THREE.Scene();
  const lixo: Array<{ dispose(): void }> = [];
  const painel = (cor: string, forca: number, w: number, h: number, pos: [number, number, number]) => {
    const g = new THREE.PlaneGeometry(w, h);
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(cor).multiplyScalar(forca), side: THREE.DoubleSide });
    const malha = new THREE.Mesh(g, m);
    malha.position.set(...pos);
    malha.lookAt(0, 0, 0);
    cena.add(malha);
    lixo.push(g, m);
  };
  // paredes: casca escura e quente, um pouco mais clara em cima
  const cascaGeo = new THREE.SphereGeometry(20, 24, 16);
  const cores: number[] = [];
  const p = cascaGeo.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const t = p.getY(i) / 20;
    const c = new THREE.Color('#2a160d').lerp(new THREE.Color('#5a3520'), THREE.MathUtils.clamp(t * 0.5 + 0.5, 0, 1));
    if (t < -0.2) c.lerp(new THREE.Color('#3a1c0e'), 0.6); // piso encerado
    cores.push(c.r, c.g, c.b);
  }
  cascaGeo.setAttribute('color', new THREE.Float32BufferAttribute(cores, 3));
  const cascaMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide });
  cena.add(new THREE.Mesh(cascaGeo, cascaMat));
  lixo.push(cascaGeo, cascaMat);
  painel('#ff9a45', 9, 5, 4, [14, -2, 9]); // lareira: baixa, de lado
  painel('#ffc27a', 2.2, 9, 5, [10, 4, 12]); // parede aquecida pelo fogo
  painel('#5f86e8', 3.2, 4, 6, [-13, 4, 6]); // janela com o luar
  painel('#ffd9a0', 1.2, 14, 3, [0, 13, 0]); // forro claro
  // as lampadinhas em volta
  const pontoGeo = new THREE.SphereGeometry(0.28, 6, 4);
  const pontoMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffc880').multiplyScalar(14) });
  for (let i = 0; i < 46; i++) {
    const a = acaso(i, 1) * Math.PI * 2;
    const y = (acaso(i, 2) - 0.5) * 16;
    const d = 9 + acaso(i, 3) * 5;
    const m = new THREE.Mesh(pontoGeo, pontoMat);
    m.position.set(Math.cos(a) * d, y, Math.sin(a) * d);
    cena.add(m);
  }
  lixo.push(pontoGeo, pontoMat);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(cena, 0.03).texture;
  pmrem.dispose();
  for (const l of lixo) l.dispose();
  prontos.set(renderer, tex);
  return tex;
}
