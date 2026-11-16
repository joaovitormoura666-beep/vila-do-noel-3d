/**
 * Meia de Natal de tricô (cores ponto a ponto e relevo de meia-malha desenhados por código), com punho de pelúcia branca, calcanhar e biqueira de outra cor, pendurada
 * pela alça em um ganchinho de latão. A forma é orgânica: perna um pouco torta, calcanhar cheio, pé
 * caído com o peso, pano mole (achatada, com barriga e ruguinhas).
 *
 * Convenções: a ORIGEM é o ponto onde o gancho se prende (na face do console da lareira ou de uma
 * tábua); a meia pende para baixo (y negativo), encostada no plano z = 0, de frente para +Z.
 * `virada` escolhe para que lado o pé aponta.
 */
import * as THREE from 'three';
import { loadTexture } from '../../../engine/assets';
import type { KitContext, Peca } from '../tipos';
import { materialLatao } from '../janela/materiais';
import { criarSorteio, entre, fbm2, juntar, misturar, suave } from '../janela/util';

export interface MeiaOpcoes {
  /** Cor do tricô. Padrão: vermelho da paleta. */
  cor?: THREE.ColorRepresentation;
  /** Cor do calcanhar e da biqueira. Padrão: creme. */
  corDetalhe?: THREE.ColorRepresentation;
  /** Para que lado o pé aponta. Padrão 'direita' (+X). */
  virada?: 'esquerda' | 'direita';
  /** Altura total aproximada, em metros. Padrão 0,46. */
  tamanho?: number;
  semente?: number;
}

let texturas: Promise<{ peloCor: THREE.Texture; peloNormal: THREE.Texture }> | null = null;
function mapas() {
  texturas ??= (async () => {
    const [peloCor, peloNormal] = await Promise.all([
      loadTexture('assets/texturas/curly_teddy_natural/diff.jpg', { srgb: true }),
      loadTexture('assets/texturas/curly_teddy_natural/nor.jpg'),
    ]);
    return { peloCor, peloNormal };
  })();
  return texturas;
}

const COLUNAS = 48; // pontos em volta da meia
const CARREIRAS = 84; // carreiras ao longo da meia

let tricoNormal: THREE.DataTexture | null = null;
/** Relevo do tricô (meia-malha): cada ponto é um "V" de duas pernas inclinadas. Ladrilho de 4 x 4 pontos. */
function normalTrico(): THREE.DataTexture {
  if (tricoNormal) return tricoNormal;
  const n = 128;
  const pontos = 4;
  const alt = new Float32Array(n * n);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const u = ((x / n) * pontos) % 1; // dentro do ponto
      const v = ((y / n) * pontos) % 1;
      // duas pernas do V: elipses inclinadas, uma de cada lado do meio
      const perna = (cx: number, inc: number) => {
        const dx = u - cx - (v - 0.5) * inc;
        const d = Math.pow(dx / 0.2, 2) + Math.pow((v - 0.5) / 0.62, 2);
        return Math.max(0, 1 - d);
      };
      alt[y * n + x] = Math.sqrt(Math.max(perna(0.27, -0.35), perna(0.73, 0.35)));
    }
  const dados = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const h = (xx: number, yy: number) => alt[((yy + n) % n) * n + ((xx + n) % n)];
      const v3 = new THREE.Vector3(-(h(x + 1, y) - h(x - 1, y)) * 3, -(h(x, y + 1) - h(x, y - 1)) * 3, 1).normalize();
      const i = (y * n + x) * 4;
      dados[i] = Math.round((v3.x * 0.5 + 0.5) * 255);
      dados[i + 1] = Math.round((v3.y * 0.5 + 0.5) * 255);
      dados[i + 2] = Math.round((v3.z * 0.5 + 0.5) * 255);
      dados[i + 3] = 255;
    }
  tricoNormal = new THREE.DataTexture(dados, n, n);
  tricoNormal.wrapS = tricoNormal.wrapT = THREE.RepeatWrapping;
  tricoNormal.magFilter = THREE.LinearFilter;
  tricoNormal.minFilter = THREE.LinearMipmapLinearFilter;
  tricoNormal.generateMipmaps = true;
  tricoNormal.needsUpdate = true;
  return tricoNormal;
}

let ruidoPelo: THREE.DataTexture | null = null;
/** Ruído fino para as cascas de pelo do punho: cada texel é um tufo com altura própria. */
function texturaRuidoPelo(): THREE.DataTexture {
  if (ruidoPelo) return ruidoPelo;
  const n = 128;
  const r = criarSorteio(9137);
  const dados = new Uint8Array(n * n * 4);
  for (let i = 0; i < n * n; i++) {
    const v = Math.round(255 * Math.pow(r(), 0.8));
    dados.set([v, v, v, 255], i * 4);
  }
  ruidoPelo = new THREE.DataTexture(dados, n, n);
  ruidoPelo.wrapS = ruidoPelo.wrapT = THREE.RepeatWrapping;
  ruidoPelo.magFilter = THREE.NearestFilter;
  ruidoPelo.minFilter = THREE.NearestFilter;
  ruidoPelo.needsUpdate = true;
  return ruidoPelo;
}

/**
 * Cores do tricô, ponto a ponto (um texel por ponto): listras, calcanhar e biqueira mudam de cor
 * seguindo as carreiras, com o contorno em degraus de ponto, como no tricô de verdade.
 */
function texturaCoresTrico(base: THREE.Color, det: THREE.Color, semente: number): THREE.DataTexture {
  const dados = new Uint8Array(COLUNAS * CARREIRAS * 4);
  const r = criarSorteio(semente * 71 + 5);
  const listra1 = 0.255 + r() * 0.02;
  const listra2 = listra1 + 0.04;
  for (let k = 0; k < CARREIRAS; k++) {
    const t = (k + 0.5) / CARREIRAS; // 0 na boca, 1 na ponta
    for (let c = 0; c < COLUNAS; c++) {
      const u = (c + 0.5) / COLUNAS; // 0,5 = atrás (calcanhar)
      const atras = Math.cos((u - 0.5) * Math.PI * 2); // 1 atrás
      // calcanhar: concha atrás, entre o fim da perna e o começo do pé
      const calc = atras > 0.5 && Math.abs(t - 0.635) < 0.04 + 0.035 * (atras - 0.5);
      const bico = t > 0.865 - 0.02 * Math.cos((u - 0.5) * Math.PI * 2);
      const listra = Math.abs(t - listra1) < 0.011 || Math.abs(t - listra2) < 0.006;
      const c0 = calc || bico || listra ? det : base;
      // fio tingido de modo desigual: cada ponto um nada diferente
      const f = 0.93 + 0.1 * r() + 0.04 * fbm2(c * 0.3, k * 0.15, 2, semente);
      const i = (k * COLUNAS + c) * 4; // DataTexture sem flipY: a linha 0 é v = 0 (a boca)
      dados[i] = Math.round(Math.min(1, Math.pow(c0.r, 1 / 2.2) * f) * 255);
      dados[i + 1] = Math.round(Math.min(1, Math.pow(c0.g, 1 / 2.2) * f) * 255);
      dados[i + 2] = Math.round(Math.min(1, Math.pow(c0.b, 1 / 2.2) * f) * 255);
      dados[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(dados, COLUNAS, CARREIRAS);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.magFilter = THREE.NearestFilter; // cada texel é um ponto: a borda da cor fica em degraus de ponto
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

export async function criarMeia(_ctx: KitContext, o: MeiaOpcoes = {}): Promise<Peca> {
  const semente = o.semente ?? 1;
  const r = criarSorteio(semente * 389 + 17);
  const escala = (o.tamanho ?? 0.46) / 0.46;
  const lado = (o.virada ?? 'direita') === 'direita' ? 1 : -1;
  const corBase = new THREE.Color(o.cor ?? '#8e1c27');
  const corDet = new THREE.Color(o.corDetalhe ?? '#d9cfb8');

  // linha central da meia no plano XY: perna descendo, tornozelo, calcanhar e pé caído com o peso
  const caida = entre(r, -0.01, 0.014);
  const eixo = new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(entre(r, -0.006, 0.008), -0.1, 0),
      new THREE.Vector3(entre(r, -0.004, 0.006), -0.2, 0),
      new THREE.Vector3(0.012, -0.27, 0),
      new THREE.Vector3(0.058, -0.318 + caida * 0.3, 0),
      new THREE.Vector3(0.116, -0.343 + caida * 0.7, 0),
      new THREE.Vector3(0.168, -0.362 + caida, 0),
    ],
    false,
    'centripetal',
  );
  const aneis = 52;
  const gomos = 28;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const Z = new THREE.Vector3(0, 0, 1);
  for (let a = 0; a <= aneis; a++) {
    const t = a / aneis;
    const p = eixo.getPointAt(t);
    const tan = eixo.getTangentAt(t);
    const n = new THREE.Vector3().crossVectors(Z, tan).normalize(); // no plano, para "a frente do pé"
    // raio ao longo da meia: perna, tornozelo mais fino, calcanhar cheio, pé e biqueira arredondada
    let raio = misturar(0.064, 0.055, suave(0, 0.5, t));
    raio += 0.01 * Math.exp(-Math.pow((t - 0.63) / 0.09, 2));
    raio = misturar(raio, 0.05, suave(0.7, 0.9, t));
    const ponta = Math.max(0, (t - 0.86) / 0.14);
    raio *= Math.sqrt(Math.max(0, 1 - Math.pow(ponta, 2.6))) * 0.999 + 0.001;
    // dobra do tornozelo: o pano vazio vinca onde a perna vira pé
    const ruga = 1 - 0.06 * Math.exp(-Math.pow((t - 0.5) / 0.025, 2)) - 0.035 * Math.exp(-Math.pow((t - 0.565) / 0.022, 2));
    raio *= ruga * (1 + 0.05 * fbm2(t * 4.5, semente * 1.3, 2, semente + 11)); // enchimento desigual
    for (let g = 0; g <= gomos; g++) {
      const ang = (g / gomos) * Math.PI * 2;
      const ca = Math.cos(ang);
      const sa = Math.sin(ang);
      // calcanhar: barriga para trás (lado de -n) na dobra
      const calc = Math.exp(-Math.pow((t - 0.62) / 0.085, 2)) * Math.max(0, -ca);
      const mole = 1 + 0.05 * fbm2(t * 7 + Math.cos(ang) * 0.8, Math.sin(ang) * 0.8 + semente, 2, semente);
      const larg = raio * (1 + 0.38 * calc) * mole;
      // pano mole e vazio: achatada (de 0,32 na perna a 0,5 no pé, que tem mais corpo)
      const fundo = raio * misturar(0.34, 0.5, suave(0.55, 0.85, t)) * mole;
      // ruguinhas atravessadas na frente da perna (o tricô vazio sanfona um pouco)
      const sanfona = 0.0018 * Math.sin(t * 95 + fbm2(g * 0.2, t * 3, 1, semente) * 2) * suave(0.3, 0.45, t) * (1 - suave(0.5, 0.6, t)) * Math.max(0, sa);
      const q = p
        .clone()
        .addScaledVector(n, ca * larg)
        .addScaledVector(Z, sa * (fundo + sanfona));
      pos.push(q.x * lado * escala, q.y * escala, q.z * escala);
      // u em pontos (a emenda fica na frente), v em carreiras
      uv.push((g / gomos) * COLUNAS, t * CARREIRAS);
    }
  }
  for (let a = 0; a < aneis; a++) {
    for (let g = 0; g < gomos; g++) {
      const p0 = a * (gomos + 1) + g;
      const p1 = p0 + 1;
      const q0 = p0 + gomos + 1;
      const q1 = q0 + 1;
      if (lado > 0) idx.push(p0, p1, q0, p1, q1, q0);
      else idx.push(p0, q0, p1, p1, q0, q1);
    }
  }
  const corpo = new THREE.BufferGeometry();
  corpo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  corpo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  corpo.setIndex(idx);
  corpo.computeVertexNormals();

  // alça: fita do mesmo tricô, saindo do canto de trás do punho e subindo até o gancho
  const xAlca = -0.05 * lado * escala;
  const alcaCurva = new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(xAlca, 0.0, 0.0),
      new THREE.Vector3(xAlca - 0.012 * lado, 0.04 * escala, 0.003 * escala),
      new THREE.Vector3(xAlca, 0.068 * escala, 0.006 * escala),
      new THREE.Vector3(xAlca + 0.012 * lado, 0.04 * escala, 0.009 * escala),
      new THREE.Vector3(xAlca + 0.004 * lado, 0.0, 0.012 * escala),
    ],
    false,
  );
  const alca = new THREE.TubeGeometry(alcaCurva, 16, 0.0046 * escala, 5, false);
  // punho de pelúcia: rolo gordo virado para fora em volta da boca da meia, fechado por dentro, com o
  // contorno fofo e irregular (ruído de 3 a 4 mm na direção da normal)
  const pp: number[] = [];
  const pu: number[] = [];
  const pi: number[] = [];
  const voltas = 36;
  const secao = 15;
  // seção do rolo: (raio relativo ao da perna, altura), uma volta quase elíptica que fecha por dentro
  const perfil: Array<[number, number]> = [];
  for (let j = 0; j <= secao; j++) {
    const a = -Math.PI / 2 + (j / secao) * Math.PI * 1.75;
    const rel = 1.14 + 0.29 * Math.cos(a) + 0.03 * Math.sin(2 * a);
    const y = -0.036 + 0.058 * Math.sin(a) * (Math.sin(a) > 0 ? 0.95 : 1.05);
    perfil.push([rel, y]);
  }
  perfil.push([0.86, 0.006], [0.0, -0.02]);
  const salP = semente * 13 + 5;
  perfil.forEach(([rel, y], j) => {
    for (let g = 0; g <= voltas; g++) {
      const ang = (g / voltas) * Math.PI * 2;
      const borda = rel > 0.9 ? 1 : 0;
      const cx = Math.cos(ang);
      const sx = Math.sin(ang);
      const fofo = borda * (0.0035 * fbm2(cx * 3 + j * 0.55, sx * 3 + semente, 3, salP) + 0.0015 * fbm2(cx * 9 + j * 1.3, sx * 9, 2, salP + 3));
      const rx = 0.064 * rel;
      const rz = 0.064 * (rel > 0.95 ? 0.52 * rel + 0.18 : 0.5 * rel);
      // a normal da seção, para o fofo crescer para fora
      const ny = j < secao ? Math.sin(-Math.PI / 2 + (j / secao) * Math.PI * 1.75) : 0;
      const nr = j < secao ? Math.cos(-Math.PI / 2 + (j / secao) * Math.PI * 1.75) : 0;
      const yy = y + ny * fofo + borda * 0.006 * fbm2(cx * 1.6, sx * 1.6 + 2, 2, salP + 7);
      pp.push(cx * (rx + nr * fofo) * lado * escala, yy * escala, sx * (rz + nr * fofo) * escala);
      pu.push((g / voltas) * 1.4, j * 0.045);
    }
  });
  for (let j = 0; j < perfil.length - 1; j++) {
    for (let g = 0; g < voltas; g++) {
      const a = j * (voltas + 1) + g;
      const b = a + 1;
      const c = a + voltas + 1;
      const d = c + 1;
      if (lado > 0) pi.push(a, c, b, b, c, d);
      else pi.push(a, b, c, b, d, c);
    }
  }
  const punho = new THREE.BufferGeometry();
  punho.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3));
  punho.setAttribute('uv', new THREE.Float32BufferAttribute(pu, 2));
  punho.setIndex(pi);
  punho.computeVertexNormals();

  const { peloCor, peloNormal } = await mapas();
  const cores = texturaCoresTrico(corBase, corDet, semente);
  cores.repeat.set(1 / COLUNAS, 1 / CARREIRAS);
  const relevo = normalTrico();
  const matTrico = new THREE.MeshPhysicalMaterial({
    color: '#ffffff',
    map: cores,
    roughness: 0.95,
    metalness: 0,
    normalMap: relevo,
    sheen: 0.45,
    sheenColor: corBase.clone().lerp(new THREE.Color('#ffe2d0'), 0.5),
    sheenRoughness: 0.8,
    envMapIntensity: 0.3,
    name: 'meia-trico',
  });
  relevo.repeat.set(0.25, 0.25); // ladrilho de 4 x 4 pontos
  matTrico.normalScale.set(1.1, 1.1);
  const matPelo = new THREE.MeshPhysicalMaterial({
    color: '#f3eee6',
    map: peloCor,
    normalMap: peloNormal,
    roughness: 1,
    metalness: 0,
    sheen: 0.7,
    sheenColor: new THREE.Color('#ffffff'),
    sheenRoughness: 0.7,
    envMapIntensity: 0.3,
    name: 'meia-pelucia',
  });
  matPelo.normalScale.set(1.6, 1.6);
  // cascas de pelo: a mesma malha do punho repetida para fora pela normal, cada casca com menos tufos
  const CASCAS = 4;
  const matCasca = matPelo.clone();
  matCasca.name = 'meia-pelucia-cascas';
  matCasca.alphaTest = 0.5;
  matCasca.sheen = 1;
  matCasca.onBeforeCompile = (sh) => {
    sh.uniforms.ruidoPelo = { value: texturaRuidoPelo() };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vCasca;')
      .replace(
        '#include <begin_vertex>',
        /* glsl */ `#include <begin_vertex>
        vCasca = ( float( gl_InstanceID ) + 1.0 ) / ${CASCAS.toFixed(1)};
        transformed += objectNormal * vCasca * ${(0.0042 * escala).toFixed(5)};`,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vCasca;\nuniform sampler2D ruidoPelo;')
      .replace(
        '#include <alphatest_fragment>',
        /* glsl */ `float tufo = texture2D( ruidoPelo, vMapUv * vec2( 9.0, 15.0 ) ).r;
        if ( tufo < 0.2 + 0.75 * vCasca ) discard;
        diffuseColor.rgb *= mix( 0.92, 1.04, vCasca );`,
      );
  };
  matCasca.customProgramCacheKey = () => 'meia-cascas';

  // o conjunto pende do gancho pela alça, com o peso do pé puxando: a perna inclina um pouco, desencosta
  // da parede embaixo e gira um nada (cada meia do seu jeito)
  const pendente = new THREE.Group();
  const inclinacao = (0.1 + entre(r, -0.03, 0.05)) * lado;
  const malhaCorpo = new THREE.Mesh(juntar([corpo, alca]), matTrico);
  malhaCorpo.name = 'meia-trico';
  const malhaPunho = new THREE.Mesh(punho, matPelo);
  malhaPunho.name = 'meia-punho';
  for (const m of [malhaCorpo, malhaPunho]) {
    m.castShadow = true;
    m.receiveShadow = true;
  }
  const cascas = new THREE.InstancedMesh(punho, matCasca, CASCAS);
  for (let i = 0; i < CASCAS; i++) cascas.setMatrixAt(i, new THREE.Matrix4());
  cascas.name = 'meia-pelo';
  cascas.castShadow = false;
  cascas.receiveShadow = true;
  cascas.userData.semAO = true;
  pendente.add(malhaCorpo, malhaPunho, cascas);
  // o topo da alça coincide com o bico do gancho
  const topoAlca = new THREE.Vector3(xAlca, 0.068 * escala, 0.006 * escala);
  pendente.rotation.order = 'ZXY';
  pendente.rotation.z = inclinacao;
  pendente.rotation.x = -entre(r, 0.05, 0.075); // o pé desencosta 2 a 3 cm da parede
  pendente.rotation.y = -lado * entre(r, 0.04, 0.2); // o pé vira para fora, nunca para dentro da parede
  const giro = topoAlca.clone().applyEuler(pendente.rotation);
  const bico = new THREE.Vector3(0, -0.012, 0.022);
  pendente.position.copy(bico).sub(giro);
  pendente.position.z = 0.036 * escala; // encostada na face de onde pende

  // gancho de latão: rosetinha na face e haste que sai e vira para cima
  const base = new THREE.CylinderGeometry(0.009, 0.011, 0.004, 10, 1);
  base.rotateX(Math.PI / 2);
  base.translate(0, 0, 0.002);
  const hasteCurva = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0.002), new THREE.Vector3(0, -0.006, 0.014), new THREE.Vector3(0, -0.016, 0.024), new THREE.Vector3(0, -0.018, 0.036), new THREE.Vector3(0, -0.008, 0.042), new THREE.Vector3(0, 0.002, 0.04)]);
  const haste = new THREE.TubeGeometry(hasteCurva, 14, 0.0026, 6, false);
  const bolinha = new THREE.SphereGeometry(0.0036, 8, 6);
  bolinha.translate(0, 0.002, 0.04);
  const gancho = new THREE.Mesh(juntar([base, haste, bolinha]), materialLatao());
  gancho.name = 'meia-gancho';
  gancho.castShadow = true;

  const root = new THREE.Group();
  root.name = 'meia';
  root.add(pendente, gancho);
  const lixo: Array<{ dispose(): void }> = [malhaCorpo.geometry, punho, matTrico, matPelo, matCasca, cores, gancho.geometry];
  return {
    root,
    update() {},
    setQuality() {},
    dispose() {
      for (const l of lixo) l.dispose();
    },
  };
}
