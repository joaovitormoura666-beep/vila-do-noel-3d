/**
 * A FORMA do Noel em funções analíticas: tronco em pera (superelipse por altura), a saia do casaco que
 * cai sobre o colo e o assento, a barra. As peças de veludo, de pelúcia e a barba amostram estas mesmas
 * funções, então tudo assenta junto (a faixa branca acompanha a barriga, a barba pousa no peito).
 *
 * θ = 0 é a frente (+Z); θ = π/2 é a esquerda dele (+X).
 */
import * as THREE from 'three';
import { ASSENTO, CORPO, DY, JOELHO_Y } from './medidas';
import { chaves, limitar, misturar, sino, suave } from './util';

const Y = [0.74, 0.79, 0.88, 1.0, 1.13, 1.24, 1.36, 1.47, 1.56, 1.64, 1.72, 1.765].map((y) => y + DY);
const LADO = chaves(Y, [0.1, 0.3, 0.42, 0.46, 0.465, 0.455, 0.42, 0.36, 0.3, 0.23, 0.13, 0.02]);
const FRENTE = chaves(Y, [0.1, 0.27, 0.4, 0.5, 0.55, 0.55, 0.49, 0.39, 0.3, 0.21, 0.12, 0.02]);
const TRAS = chaves(Y, [0.1, 0.28, 0.31, 0.32, 0.33, 0.34, 0.34, 0.33, 0.3, 0.25, 0.14, 0.02]);
const CZ = chaves(Y, [-0.16, -0.16, -0.15, -0.14, -0.13, -0.12, -0.13, -0.15, -0.16, -0.17, -0.17, -0.17]);

export const TRONCO_Y0 = Y[0];
export const TRONCO_Y1 = Y[Y.length - 1];
const EXPN = 2.3;

/** Aperto do cinto: o veludo afunda um pouco no cinto e estufa logo acima e abaixo. */
function aperto(y: number) {
  const d = y - CORPO.cinto;
  return 1 - 0.03 * sino(d, 0.05) + 0.012 * sino(d - 0.09, 0.05) + 0.008 * sino(d + 0.09, 0.05);
}

/** Raios do tronco na altura y: [lado, frente/trás na direção θ, centro z]. */
export function raiosTronco(theta: number, y: number) {
  const c = Math.cos(theta);
  const k = aperto(y);
  const rz = (TRAS(y) + (FRENTE(y) - TRAS(y)) * suave(-0.35, 0.35, c)) * k;
  return { rx: LADO(y) * k, rz, cz: CZ(y) };
}

/** Ponto do tronco em (θ, y). `extra` empurra para fora (metros), na direção radial. */
export function tronco(theta: number, y: number, out: THREE.Vector3, extra = 0) {
  const { rx, rz, cz } = raiosTronco(theta, y);
  // superelipse suave (n > 2 = um pouco quadrada), sem vinco na frente
  const sn = Math.sin(theta);
  const cs = Math.cos(theta);
  const k = Math.pow(Math.pow(Math.abs(sn), EXPN) + Math.pow(Math.abs(cs), EXPN), -1 / EXPN);
  out.set(sn * k * rx, y, cz + cs * k * rz);
  if (extra) {
    const dx = out.x;
    const dz = out.z - cz;
    const l = Math.hypot(dx, dz) || 1;
    out.x += (dx / l) * extra;
    out.z += (dz / l) * extra;
  }
  return out;
}

const T1 = new THREE.Vector3();
/**
 * Quanto um ponto está DENTRO do tronco (metros; negativo = fora). Aproximação radial na altura do ponto:
 * serve para a barba e as mãos não atravessarem a barriga.
 */
export function dentroDoTronco(p: THREE.Vector3): number {
  if (p.y < TRONCO_Y0 || p.y > TRONCO_Y1) return -1;
  const cz = CZ(p.y);
  const theta = Math.atan2(p.x, p.z - cz);
  tronco(theta, p.y, T1);
  const rSup = Math.hypot(T1.x, T1.z - cz);
  const rP = Math.hypot(p.x, p.z - cz);
  return rSup - rP;
}

/** Empurra um ponto para fora do tronco, deixando `folga` metros. */
export function foraDoTronco(p: THREE.Vector3, folga: number) {
  const d = dentroDoTronco(p) + folga;
  if (d <= 0) return p;
  const cz = CZ(p.y);
  const dx = p.x;
  const dz = p.z - cz;
  const l = Math.hypot(dx, dz) || 1;
  p.x += (dx / l) * d;
  p.z += (dz / l) * d;
  return p;
}

/* ------------------------------------------------------------------ saia do casaco e barra */

/* A barra deita SOBRE as coxas: para cada direção θ, a altura é o topo da coxa (ou o assento, fora delas)
 * mais a folga do anel de pelúcia; depois um borrão em θ faz o pano "ponte" no vão entre as coxas e cair
 * um pouco por gravidade, em vez de afundar até o assento. Tabela calculada uma vez. */
const RAIO_BARRA = 0.064;
const N_BARRA = 256;
const COXA_Q = [new THREE.Vector3(CORPO.quadril.x, CORPO.quadril.y, CORPO.quadril.z), new THREE.Vector3(-CORPO.quadril.x, CORPO.quadril.y, CORPO.quadril.z)];
const COXA_J = [new THREE.Vector3(0.265, JOELHO_Y, 0.5), new THREE.Vector3(-0.265, JOELHO_Y, 0.5)];
function rzBarra(c: number) {
  return 0.36 + (0.64 - 0.36) * suave(-0.3, 0.4, c);
}
/** Topo da coxa (ou do assento) sob o ponto (x, z). */
function apoio(x: number, z: number) {
  let y = ASSENTO.altura + 0.02;
  for (let k = 0; k < 2; k++) {
    const q = COXA_Q[k];
    const j = COXA_J[k];
    const dx = j.x - q.x;
    const dz = j.z - q.z;
    const s = limitar(((x - q.x) * dx + (z - q.z) * dz) / (dx * dx + dz * dz), -0.2, 1.05);
    const ax = q.x + dx * s;
    const az = q.z + dz * s;
    const ay = q.y + (j.y - q.y) * s;
    const r = misturar(CORPO.coxa, 0.152, limitar(s, 0, 1)) + 0.012;
    const d = Math.hypot(x - ax, (z - az) * 0.35);
    if (d < r) y = Math.max(y, ay + Math.sqrt(r * r - d * d));
  }
  return y;
}
const ALTURA_BARRA = (() => {
  const bruta = new Float32Array(N_BARRA);
  for (let i = 0; i < N_BARRA; i++) {
    const th = (i / N_BARRA) * Math.PI * 2;
    bruta[i] = apoio(0.47 * Math.sin(th), -0.13 + rzBarra(Math.cos(th)) * Math.cos(th));
  }
  // "fechamento" (máximo e depois mínimo numa janela): o pano faz ponte sobre os vãos mais estreitos
  // que a janela (entre as coxas), sem subir onde o apoio já é alto; depois um borrão suave
  const janela = Math.round((0.55 / (Math.PI * 2)) * N_BARRA);
  const filtro = (a: Float32Array, f: (x: number, y: number) => number) => {
    const out = new Float32Array(N_BARRA);
    for (let i = 0; i < N_BARRA; i++) {
      let m = a[i];
      for (let j = -janela; j <= janela; j++) m = f(m, a[(i + j + N_BARRA) % N_BARRA]);
      out[i] = m;
    }
    return out;
  };
  const fechada = filtro(filtro(bruta, Math.max), Math.min);
  const final = new Float32Array(N_BARRA);
  const sigma = 0.16;
  for (let i = 0; i < N_BARRA; i++) {
    let soma = 0;
    let peso = 0;
    for (let j = -30; j <= 30; j++) {
      const dth = (j / N_BARRA) * Math.PI * 2;
      const w = Math.exp(-(dth * dth) / (2 * sigma * sigma));
      soma += w * fechada[(i + j + N_BARRA) % N_BARRA];
      peso += w;
    }
    // a ponte cede um pouco no meio (gravidade), mas nunca afunda no apoio
    final[i] = Math.max(bruta[i], soma / peso - 0.025) + RAIO_BARRA * 0.9;
  }
  return final;
})();

/** Ponto da barra (a borda de baixo do casaco) em θ: deita nas coxas na frente e no assento dos lados. */
export function bainha(thetaBruto: number, out: THREE.Vector3) {
  const th = ((thetaBruto % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const x = (th / (Math.PI * 2)) * N_BARRA;
  const i = Math.floor(x) % N_BARRA;
  const f = x - Math.floor(x);
  const y = ALTURA_BARRA[i] * (1 - f) + ALTURA_BARRA[(i + 1) % N_BARRA] * f;
  const c = Math.cos(th);
  out.set(0.47 * Math.sin(th), y, -0.13 + rzBarra(c) * c);
  return out;
}

const SB = new THREE.Vector3();
const SH = new THREE.Vector3();
/** Ponto da saia em (θ, s): s = 0 logo abaixo do cinto, s = 1 na barra. */
export function saia(theta: number, s: number, out: THREE.Vector3) {
  tronco(theta, CORPO.cinto - CORPO.alturaCinto * 0.42, SB, 0.012);
  bainha(theta, SH);
  out.copy(SB).lerp(SH, s);
  // a saia estufa por cima da barriga de baixo e dos quadris
  const c = Math.cos(theta);
  const cz = -0.13;
  const dx = out.x;
  const dz = out.z - cz;
  const l = Math.hypot(dx, dz) || 1;
  const bojo = (0.05 + 0.02 * Math.max(c, 0)) * Math.pow(Math.sin(Math.PI * s), 0.75);
  // dobras suaves do veludo caindo
  const dobra = 0.007 * Math.sin(theta * 9 + 0.7) * s + 0.005 * Math.sin(theta * 17 + 2.1) * s * s;
  out.x += (dx / l) * (bojo + dobra);
  out.z += (dz / l) * (bojo + dobra);
  // na frente a saia deita sobre o colo: sobe um pouco no meio do caminho (as coxas por baixo)
  out.y += 0.035 * Math.sin(Math.PI * s) * Math.pow(Math.max(c, 0), 2);
  return out;
}
