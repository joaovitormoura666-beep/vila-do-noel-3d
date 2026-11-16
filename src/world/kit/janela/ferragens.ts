/**
 * Ferragens de latão, discretas: dobradiças de pino com ponteiras e a cremona (haste vertical com
 * guias e um puxador oval) sobre o encontro das duas folhas. Tudo sai em uma geometria só.
 */
import * as THREE from 'three';
import { juntar } from './util';

function mover(g: THREE.BufferGeometry, x: number, y: number, z: number): THREE.BufferGeometry {
  g.translate(x, y, z);
  return g;
}

/** Perfil torneado (pares raio, altura) girado em volta de Y. */
function torneado(perfil: Array<[number, number]>, lados = 16): THREE.BufferGeometry {
  return new THREE.LatheGeometry(
    perfil.map(([r, y]) => new THREE.Vector2(Math.max(0.0001, r), y)),
    lados,
  );
}

/** Dobradiça de pino: canudo vertical com duas ponteiras em gota e as abas embutidas. Centro na origem. */
export function dobradica(altura = 0.1): THREE.BufferGeometry {
  const h = altura / 2;
  const corpo = torneado(
    [
      [0, -h - 0.016],
      [0.0045, -h - 0.013],
      [0.0062, -h - 0.007],
      [0.004, -h - 0.001],
      [0.0074, -h],
      [0.0074, -h * 0.34],
      [0.0066, -h * 0.33],
      [0.0066, -h * 0.31],
      [0.0074, -h * 0.3],
      [0.0074, h * 0.3],
      [0.0066, h * 0.31],
      [0.0066, h * 0.33],
      [0.0074, h * 0.34],
      [0.0074, h],
      [0.004, h + 0.001],
      [0.0062, h + 0.007],
      [0.0045, h + 0.013],
      [0, h + 0.016],
    ],
    10,
  );
  return corpo;
}

/**
 * Cremona: haste do pé ao alto da folha, guias, espelho e puxador oval.
 * x no encontro das folhas, de yBaixo a yAlto, com o puxador em yPuxador; z é a face da madeira.
 */
export function cremona(x: number, yBaixo: number, yAlto: number, yPuxador: number, z: number): THREE.BufferGeometry {
  const geos: THREE.BufferGeometry[] = [];
  const raioHaste = 0.0052;
  const zHaste = z + 0.011;
  // haste em dois trechos (acima e abaixo do espelho), com ponteiras
  const trecho = (y0: number, y1: number) => {
    const g = new THREE.CylinderGeometry(raioHaste, raioHaste, y1 - y0, 16, 1);
    geos.push(mover(g, x, (y0 + y1) / 2, zHaste));
  };
  trecho(yBaixo, yPuxador - 0.05);
  trecho(yPuxador + 0.05, yAlto);
  // guias: pequenas pontes arredondadas abraçando a haste
  const guia = (y: number) => {
    const g = new THREE.CapsuleGeometry(0.0085, 0.02, 4, 18);
    g.scale(1.25, 1, 1.15);
    geos.push(mover(g, x, y, z + 0.008));
  };
  const vao = yAlto - yBaixo;
  for (const f of [0.04, 0.22, 0.78, 0.96]) guia(yBaixo + vao * f);
  // batentes nas pontas (onde a haste entra no marco)
  for (const y of [yBaixo, yAlto]) {
    const g = new THREE.CapsuleGeometry(0.0105, 0.016, 4, 18);
    g.scale(1.3, 1, 1.1);
    geos.push(mover(g, x, y, z + 0.008));
  }
  // espelho: placa oval alongada
  const espelho = new THREE.SphereGeometry(1, 24, 12);
  espelho.scale(0.019, 0.062, 0.008);
  geos.push(mover(espelho, x, yPuxador, z + 0.004));
  // puxador: pescoço torneado saindo para a sala e pega oval deitada, um pouco caída
  const pescoco = torneado(
    [
      [0.011, 0],
      [0.011, 0.004],
      [0.0065, 0.008],
      [0.0055, 0.022],
      [0.0075, 0.026],
      [0.0075, 0.03],
    ],
    10,
  );
  pescoco.rotateX(Math.PI / 2);
  geos.push(mover(pescoco, x, yPuxador, z + 0.006));
  const pega = new THREE.SphereGeometry(1, 24, 14);
  pega.scale(0.014, 0.034, 0.0105);
  pega.rotateZ(0.5);
  geos.push(mover(pega, x + 0.004, yPuxador - 0.006, z + 0.041));
  return juntar(geos);
}
