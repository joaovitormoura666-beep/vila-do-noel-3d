/**
 * Manta de lã xadrez (padrão próprio, desenhado por código, com o relevo de tricô de knitted_fleece):
 *   'dobrada' : pilha de dobras macias, para um assento, um baú ou o piso. Base em y = 0, centrada.
 *   'jogada'  : caída sobre o braço de uma poltrona (ou o encosto de uma cadeira). A ORIGEM fica no
 *               alto do braço, no meio da manta; o braço corre ao longo de Z e a manta cai para os
 *               dois lados em X (um lado mais comprido), com dobras e franja nas pontas.
 */
import * as THREE from 'three';
import { loadTexture } from '../../../engine/assets';
import type { KitContext, Peca } from '../tipos';
import { acaso2, criarSorteio, entre, fbm2, limitar, misturar, suave } from '../janela/util';

export interface MantaOpcoes {
  modo?: 'dobrada' | 'jogada';
  /** Largura da manta (ao longo do braço, no modo 'jogada'). Padrão 0,8. */
  largura?: number;
  /** Comprimento total da manta. Padrão 1,5. */
  comprimento?: number;
  /** Raio do braço sobre o qual ela cai (modo 'jogada'). Padrão 0,11. */
  raioBraco?: number;
  /** Cor principal do xadrez. Padrão: verde pinheiro. */
  cor?: THREE.ColorRepresentation;
  semente?: number;
}

/** Xadrez de lã: fundo na cor pedida, faixas largas vinho, filetes creme e dourado; cada fio com seu tom. */
function texturaXadrez(cor: THREE.Color, semente: number): THREE.CanvasTexture {
  const n = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = n;
  const c = canvas.getContext('2d')!;
  const img = c.createImageData(n, n);
  const vinho = new THREE.Color('#6a1b24');
  const creme = new THREE.Color('#c9bc9c');
  const ouro = new THREE.Color('#a5854a');
  const fio = (t: number): THREE.Color => {
    // t de 0 a 1 dentro do módulo do xadrez
    if (Math.abs(t - 0.5) < 0.012) return ouro;
    if (t > 0.34 && t < 0.66) return vinho;
    if (Math.abs(t - 0.14) < 0.018 || Math.abs(t - 0.86) < 0.018) return creme;
    return cor;
  };
  const paraSrgb = (v: number) => Math.round(255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055));
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      // sarja: urdidura e trama se alternam em diagonal, misturando as duas cores
      const urdidura = fio(x / n);
      const trama = fio(y / n);
      const porCima = (x + y) % 4 < 2;
      const a = porCima ? urdidura : trama;
      const b = porCima ? trama : urdidura;
      const tom = 0.9 + 0.2 * acaso2(porCima ? x : y, porCima ? 0 : 1, semente);
      const i = (y * n + x) * 4;
      img.data[i] = paraSrgb(limitar((a.r * 0.78 + b.r * 0.22) * tom, 0, 1));
      img.data[i + 1] = paraSrgb(limitar((a.g * 0.78 + b.g * 0.22) * tom, 0, 1));
      img.data[i + 2] = paraSrgb(limitar((a.b * 0.78 + b.b * 0.22) * tom, 0, 1));
      img.data[i + 3] = 255;
    }
  }
  c.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

const MODULO = 0.3; // tamanho do módulo do xadrez, em metros

/** Franja curta (fios de lã soltos) ao longo de uma beira: `borda(t)` dá o ponto da beira, os fios caem na direção `cai`. */
function franja(borda: (t: number) => THREE.Vector3, comprimentoBeira: number, cai: THREE.Vector3, semente: number, pos: number[], uv: number[], idx: number[]) {
  const n = Math.max(12, Math.round(comprimentoBeira / 0.0075));
  const p0 = borda(0);
  const ao = borda(1).sub(p0).normalize();
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const base = borda(t);
    const comp = 0.034 * (0.75 + 0.5 * acaso2(i, semente, 3));
    const dir = cai
      .clone()
      .addScaledVector(ao, (acaso2(i, semente, 5) - 0.5) * 0.22)
      .normalize();
    const b = pos.length / 3;
    const meia = 0.0017;
    // cada fio sai de dentro do pano (um pouco acima da beira) e enverga de leve
    const curva = (acaso2(i, semente, 7) - 0.5) * 0.008;
    for (let s = 0; s <= 2; s++) {
      const k = s / 2;
      const q = base.clone().addScaledVector(dir, comp * k - 0.003).addScaledVector(ao, curva * k * k);
      pos.push(q.x - ao.x * meia, q.y - ao.y * meia, q.z - ao.z * meia, q.x + ao.x * meia, q.y + ao.y * meia, q.z + ao.z * meia);
      // a franja usa a cor do fio que termina ali
      const u = (t * comprimentoBeira) / MODULO;
      uv.push(u, 0.07, u, 0.07);
    }
    for (let s = 0; s < 2; s++) {
      const a = b + s * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
}

export async function criarManta(_ctx: KitContext, o: MantaOpcoes = {}): Promise<Peca> {
  const modo = o.modo ?? 'dobrada';
  const largura = o.largura ?? 0.8;
  const comprimento = o.comprimento ?? 1.5;
  const semente = o.semente ?? 1;
  const r = criarSorteio(semente * 457 + 11);
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const ESP = 0.012; // espessura da lã

  /** Acrescenta uma folha (grade) à geometria. `ponto` devolve posição para (a de 0 a 1 no comprimento, b de 0 a 1 na largura). */
  const folha = (na: number, nb: number, ponto: (a: number, b: number) => THREE.Vector3, uvDe: (a: number, b: number) => [number, number]) => {
    const base = pos.length / 3;
    for (let i = 0; i <= na; i++) {
      for (let j = 0; j <= nb; j++) {
        const p = ponto(i / na, j / nb);
        pos.push(p.x, p.y, p.z);
        uv.push(...uvDe(i / na, j / nb));
      }
    }
    for (let i = 0; i < na; i++) {
      for (let j = 0; j < nb; j++) {
        const a = base + i * (nb + 1) + j;
        const b = a + 1;
        const c = a + nb + 1;
        const d = c + 1;
        idx.push(a, b, c, b, d, c);
      }
    }
  };

  if (modo === 'dobrada') {
    // a manta dobrada em três no comprimento e ao meio na largura: uma fita em S vista de lado, macia
    const ladoX = comprimento / 3; // comprimento de cada dobra
    const ladoZ = largura / 2;
    const camadas = 3;
    const passoY = ESP * 2.2; // cada dobra tem duas espessuras (dobrada ao meio)
    const curva = passoY / 2;
    const total = camadas * ladoX;
    const torto = entre(r, -0.03, 0.03);
    folha(
      90,
      10,
      (a, b) => {
        const s = a * total;
        const k = Math.min(camadas - 1, Math.floor(s / ladoX));
        const f = s / ladoX - k; // 0 a 1 dentro da dobra
        const indo = k % 2 === 0;
        // trecho reto com as pontas virando em meia-volta para a dobra seguinte
        let x = (indo ? f : 1 - f) * ladoX - ladoX / 2;
        let y = curva + k * passoY;
        const volta = 0.1;
        if (f > 1 - volta && k < camadas - 1) {
          const ang = ((f - (1 - volta)) / volta) * (Math.PI / 2);
          x = (indo ? 1 : -1) * (ladoX / 2 - volta * ladoX + Math.sin(ang) * (volta * ladoX * 0.6 + curva));
          y += (1 - Math.cos(ang)) * curva;
        } else if (f < volta && k > 0) {
          const ang = ((volta - f) / volta) * (Math.PI / 2);
          x = (indo ? -1 : 1) * (ladoX / 2 - volta * ladoX + Math.sin(ang) * (volta * ladoX * 0.6 + curva));
          y -= (1 - Math.cos(ang)) * curva;
        }
        // cada dobra sai um pouco fora de esquadro e afunda no meio
        const z = (b - 0.5) * ladoZ + torto * (k - 1) * (x / ladoX) + 0.012 * (k - 1);
        const mole = 0.006 * fbm2(x * 6 + k * 3, z * 6, 2, semente) - 0.008 * (1 - Math.pow(Math.abs(b - 0.5) * 2, 3)) * (k + 1) * 0.5;
        // as beiras em z arredondam para baixo (a dobra ao meio da largura)
        const beira = Math.pow(Math.abs(b - 0.5) * 2, 6);
        return new THREE.Vector3(x, y + ESP + mole - beira * ESP * 0.9, z);
      },
      (a, b) => [(a * total) / MODULO, (b * ladoZ) / MODULO],
    );
    // saia lateral: fecha as duas beiras compridas até a camada de baixo (esconde o vão entre as dobras)
    for (const lado of [-1, 1]) {
      folha(
        camadas * 2,
        1,
        (a, b) => new THREE.Vector3((b - 0.5) * ladoX * 0.96, curva * 0.4 + a * (camadas * passoY), lado * (ladoZ / 2 - 0.004 + 0.006 * Math.sin(a * Math.PI * camadas * 2))),
        (a, b) => [(b * ladoX) / MODULO, 0.2 + a * 0.2],
      );
    }
    {
      const yF = curva + (camadas - 1) * passoY + ESP;
      const f0 = new THREE.Vector3(-ladoX / 2 + 0.01, yF, -ladoZ / 2);
      const f1 = new THREE.Vector3(-ladoX / 2 + 0.01, yF, ladoZ / 2);
      franja((t) => f0.clone().lerp(f1, t), ladoZ, new THREE.Vector3(-1, -0.25, 0).normalize(), semente, pos, uv, idx);
    }
  } else {
    // jogada sobre um braço: passa por cima de um cilindro e cai dos dois lados, um mais comprido
    const R = (o.raioBraco ?? 0.11) + ESP;
    const arco = Math.PI * R; // pano gasto na meia-volta por cima do braço
    const sobra = comprimento - arco;
    const ladoA = sobra * entre(r, 0.34, 0.42); // lado de fora (-X), mais curto
    const enviesa = entre(r, -0.12, 0.12);
    const ponto = (a: number, b: number) => {
      const s = a * comprimento; // distância ao longo do pano, do fim do lado A ao fim do lado B
      const zBase = (b - 0.5) * largura;
      let x: number;
      let y: number;
      let fora = 0; // quanto o pano se afasta do braço (dobras)
      let queda = 0; // distância abaixo do braço
      if (s < ladoA) {
        queda = ladoA - s;
        x = -R;
        y = -R - queda + R; // desce a partir da altura do centro do braço
        y = -queda;
        fora = -1;
      } else if (s < ladoA + arco) {
        const ang = ((s - ladoA) / arco) * Math.PI; // 0 no lado A, pi no lado B
        x = -Math.cos(ang) * R;
        y = Math.sin(ang) * R;
      } else {
        queda = s - ladoA - arco;
        x = R;
        y = -queda;
        fora = 1;
      }
      // dobras verticais que crescem com a queda, e o pano abrindo para fora embaixo
      const cresce = suave(0, 0.35, queda);
      const fase = zBase * 7.5 + 1.9 * fora + 2.6 * fbm2(zBase * 1.6, queda * 1.2 + fora * 3, 2, semente);
      const dobra = Math.sin(fase) * 0.05 + Math.sin(fase * 2.3 + 1.1) * 0.014 + 0.02 * fbm2(zBase * 5, queda * 3 + fora * 7, 2, semente + 4);
      x += fora * (0.012 + cresce * (0.06 + dobra) + queda * 0.05);
      // a barra não é reta: nas dobras o pano sobe e desce um pouco
      y += cresce * 0.035 * Math.cos(fase) * suave(0.1, 0.5, queda);
      // o pano franze um pouco para o meio ao cair e vem enviesado
      const z = zBase * misturar(1, 0.9, cresce) + enviesa * queda * fora + 0.01 * fbm2(zBase * 4, s * 3, 2, semente + 9);
      // por cima do braço a lã assenta, com ruguinhas
      if (fora === 0) y += 0.004 * fbm2(zBase * 9, s * 9, 2, semente + 2);
      return new THREE.Vector3(x, y - R, z);
    };
    folha(110, 40, ponto, (a, b) => [(a * comprimento) / MODULO, (b * largura) / MODULO]);
    franja((t) => ponto(0, t), largura, new THREE.Vector3(-0.12, -1, 0).normalize(), semente, pos, uv, idx);
    franja((t) => ponto(1, t), largura, new THREE.Vector3(0.12, -1, 0).normalize(), semente + 1, pos, uv, idx);
    // a origem fica no alto do braço: sobe a peça de volta
    for (let i = 1; i < pos.length; i += 3) pos[i] += R;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const cor = new THREE.Color(o.cor ?? '#1f4a3a');
  const xadrez = texturaXadrez(cor, semente);
  const trico = await loadTexture('assets/texturas/knitted_fleece/nor.jpg', { repeat: [0.9, 0.9] });
  const mat = new THREE.MeshPhysicalMaterial({
    map: xadrez,
    normalMap: trico,
    roughness: 0.96,
    metalness: 0,
    sheen: 0.45,
    sheenColor: new THREE.Color('#e9dcc8'),
    sheenRoughness: 0.8,
    side: THREE.DoubleSide,
    envMapIntensity: 0.3,
    name: 'manta-la',
  });
  mat.normalScale.set(1.4, 1.4);
  const root = new THREE.Group();
  root.name = 'manta';
  const malha = new THREE.Mesh(geo, mat);
  malha.name = 'manta-la';
  malha.castShadow = true;
  malha.receiveShadow = true;
  root.add(malha);
  return {
    root,
    update() {},
    setQuality() {},
    dispose() {
      geo.dispose();
      mat.dispose();
      xadrez.dispose();
      trico.dispose();
    },
  };
}
