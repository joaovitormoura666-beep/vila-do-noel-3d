/**
 * O fogo da lareira, que também pode ser usado sozinho (criarFogo).
 *
 * - Chamas em VOLUME, não em cartões: um campo de temperatura 3D (línguas que nascem do dorso das
 *   toras e das frestas entre elas, dobram com o ar quente, se separam e somem no alto) desenhado
 *   em fatias paralelas à tela, de trás para a frente. Como cada fatia passa pelo teste de
 *   profundidade, a lenha, os cães de ferro e o arco recortam o fogo de verdade: há chama atrás,
 *   entre e na frente das toras, de qualquer ângulo. Miolo branco-dourado só na base (é onde o
 *   brilho do palco pega), corpo laranja, pontas vermelho-fuligem; borda nítida no corpo e mole
 *   só nas pontas. Nenhuma chama passa do fundo de tijolo nem do teto da câmara (conta analítica).
 * - Faíscas: riscos curtos ao longo da velocidade, laranja esfriando para vermelho, em rajadas raras.
 * - Magia (FIREPLACE_MAGIC): o miolo vai para o branco-dourado e as bordas para o âmbar, e poucas
 *   partículas douradas, de tamanhos bem diferentes, sobem em espiral da boca com um risco contínuo.
 * - Tremor: três ruídos somados (nunca um seno regular) que a lareira usa para a luz, no mesmo
 *   pulso das chamas.
 *
 * Origem do grupo: centro da base do fogo, no nível do leito de brasas. +Z é a frente (a boca).
 * Tudo é função de t: nada de relógio próprio nem de sorteio durante a animação.
 */
import * as THREE from 'three';
import type { Level } from '../../contracts';
import type { KitContext, Peca } from '../tipos';
import { criarRng, gerarVolumeDeRuido, ruido1 } from './ruido';

/** Uma tora vista pelo fogo, em coordenadas locais do fogo: o eixo (dois pontos), a meia largura vista de cima e a altura do dorso acima do eixo. */
export interface SegmentoDeLenha {
  a: THREE.Vector3;
  b: THREE.Vector3;
  /** Meia largura horizontal. */
  raio: number;
  /** Altura do dorso acima do eixo (padrão: igual ao raio, tora roliça). */
  alto?: number;
}

export interface FogoOpcoes {
  /** Largura da fogueira ao longo de X, em metros. Padrão 0,9. */
  largura?: number;
  /** Altura das chamas mais altas, em metros. Padrão 0,78. */
  altura?: number;
  /** Profundidade da fogueira em Z. Padrão 0,4. */
  profundidade?: number;
  semente?: number;
  /** Até onde as partículas mágicas avançam para a sala (+Z), em metros. Padrão 2,4. */
  alcanceMagia?: number;
  /** A lenha: as chamas nascem do dorso de cada tora e das frestas entre elas. Sem lenha, nascem do chão. */
  lenha?: SegmentoDeLenha[];
  /** Parede do fundo, em coordenadas locais: z = z0 até yInclina e, acima, avança `inclinacao` metros por metro. Nenhuma chama passa dela. */
  fundo?: { z0: number; yInclina: number; inclinacao: number };
  /** Paredes dos lados da câmara, em leque: meia largura `x0` no fundo (em z = fundo.z0), abrindo `abertura` metros por metro para a frente. */
  lados?: { x0: number; abertura: number };
  /** Altura local do teto (garganta da câmara): as chamas somem suavemente nos últimos 12 cm. */
  teto?: number;
}

export interface TremorDoFogo {
  /** Multiplicador da luz (perto de 1, variando uns 25% para cima e para baixo). */
  brilho: number;
  /** Pequeno deslocamento da fonte de luz, em metros. */
  dx: number;
  dy: number;
  dz: number;
}

export interface Fogo extends Peca {
  /** Tamanho e brilho gerais do fogo (1 = normal; 0 = apagado; até perto de 1,6). Pode ser mudado a qualquer momento. */
  forca: number;
  /** Efeito FIREPLACE_MAGIC: 0 desligado, 1 no auge. */
  setMagia(intensidade: number): void;
  /** Magia já suavizada (para quem quer acompanhar com luzes). */
  readonly magia: number;
  /** Clarão da entrada da magia: sobe quando o efeito começa e decai em cerca de um segundo (0 a 1). */
  readonly clarao: number;
  /** Tremor do quadro atual, atualizado em update(). */
  readonly tremor: TremorDoFogo;
}

const CHAMA_VERT = /* glsl */ `
uniform vec3 uMin;
uniform vec3 uMax;
uniform float uFatias;
varying vec3 vLocal;
varying vec3 vOlho;
varying float vPasso;
void main() {
  // caixa do fogo no espaço da câmera: as fatias são planos paralelos à tela que a atravessam
  vec3 mn = vec3(1e9);
  vec3 mx = vec3(-1e9);
  for (int i = 0; i < 8; i++) {
    vec3 c = vec3((i & 1) == 0 ? uMin.x : uMax.x, (i & 2) == 0 ? uMin.y : uMax.y, (i & 4) == 0 ? uMin.z : uMax.z);
    vec3 v = (modelViewMatrix * vec4(c, 1.0)).xyz;
    mn = min(mn, v);
    mx = max(mx, v);
  }
  mx.z = min(mx.z, -0.06);
  mn.z = min(mn.z, mx.z - 0.01);
  // a fatia 0 é a mais distante: a ordem dos índices já é de trás para a frente
  float f = (position.z + 0.5) / uFatias;
  vec3 v = vec3(mix(mn.xy, mx.xy, position.xy * 0.5 + 0.5), mix(mn.z, mx.z, f));
  mat4 inv = inverse(modelViewMatrix);
  vLocal = (inv * vec4(v, 1.0)).xyz;
  vOlho = (inv * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  vPasso = (mx.z - mn.z) / uFatias;
  gl_Position = projectionMatrix * vec4(v, 1.0);
}`;

const CHAMA_FRAG = /* glsl */ `
precision highp sampler3D;
uniform sampler3D uRuido;
uniform sampler2D uLenha;
uniform vec3 uMin;
uniform vec3 uMax;
uniform vec4 uMapa; // origem (x, z) e tamanho (x, z) do mapa da lenha
uniform float uTopoLenha;
uniform float uAltura;
uniform float uTempo;
uniform float uForca;
uniform float uMagia;
uniform float uPulso;
uniform float uBrilho;
uniform vec3 uFundo;
uniform vec2 uLados;
uniform float uTeto;
uniform vec3 uSem;
varying vec3 vLocal;
varying vec3 vOlho;
varying float vPasso;

void main() {
  // cada pixel desloca a amostra ao longo do raio (esconde o degrau entre as fatias)
  vec3 dir = normalize(vLocal - vOlho);
  // (ruído sem desenho somado a meia trama regular: nem hachura, nem poeira em grumos)
  uvec2 px = uvec2(gl_FragCoord.xy);
  uint hs = px.x * 0x9E3779B9u ^ (px.y * 0x85EBCA6Bu);
  hs ^= hs >> 15; hs *= 0x2C1B3C6Du; hs ^= hs >> 12; hs *= 0x297A2D39u; hs ^= hs >> 15;
  float trama = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))) + 0.5 * float(hs >> 8) / 16777216.0);
  vec3 p = vLocal + dir * ((trama - 0.5) * vPasso);
  if (any(lessThan(p, uMin)) || any(greaterThan(p, uMax))) discard;

  // de onde a chama nasce: dorso da tora que está embaixo deste ponto (ou o leito de brasas)
  vec2 uvL = (p.xz - uMapa.xy) / uMapa.zw;
  float base = texture2D(uLenha, uvL).r * uTopoLenha;
  float h = p.y - base;
  if (h < -0.012) discard;
  float alt = uAltura * (0.42 + 0.58 * uForca) * (1.0 + 0.1 * uMagia) * (1.0 + 0.05 * uPulso);
  float hn = h / alt;
  float t = uTempo;

  // o ar quente dobra as línguas, e a dobra sobe com o gás (a chama fica presa pela base)
  vec3 w = texture(uRuido, vec3(p.x * 0.62, p.y * 0.5 - t * 0.6, p.z * 0.62) + uSem).rgb - 0.5;
  vec3 w2 = texture(uRuido, vec3(p.x * 1.45, p.y * 1.1 - t * 1.25, p.z * 1.45) + uSem.zxy).rgb - 0.5;
  float dobra = 0.03 + 0.5 * max(h, 0.0);
  vec2 xz = p.xz + w.xy * dobra + w2.xz * dobra * 0.3;
  // puxada para o centro: as chamas convergem para o alto
  xz *= 1.0 + 0.55 * max(hn, 0.0);

  vec4 lenha = texture2D(uLenha, (xz - uMapa.xy) / uMapa.zw);
  float fonte = lenha.g;
  // línguas: onde estão e a altura de cada uma (mudam devagar e andam de lado)
  float c1 = texture(uRuido, vec3(xz.x * 0.85 + t * 0.05, t * 0.21, xz.y * 0.85) + uSem.yzx).g;
  float c2 = texture(uRuido, vec3(xz.x * 2.3, t * 0.33 + 3.7, xz.y * 2.3 - t * 0.04) + uSem).b;
  float pico = smoothstep(0.22, 0.8, c1 * 0.72 + c2 * 0.28);
  // sobre o dorso das toras o fogo é contínuo (um lençol baixo); fora delas só há línguas onde o ruído manda,
  // e entre uma língua e outra se vê a lenha
  float meio = 1.0 - smoothstep(0.4, 0.85, abs(xz.x) / uMax.x); // as pontas das toras quase não ardem
  // labaredas baixas sobre o dorso das toras: soltas, cada uma por um instante (não um lençol com o
  // contorno da tora); a borda da fonte também é roída pelo ruído
  float lamber = texture(uRuido, vec3(xz.x * 3.1 + 0.2, t * 0.9 + 1.3, xz.y * 3.1)).r;
  fonte = smoothstep(0.3, 0.8, fonte + (c2 - 0.5) * 0.4); // ou arde de verdade ou não arde: sem película fina nas pontas
  float alturaLocal = fonte * max(0.17 * lenha.b * meio * smoothstep(0.42, 0.78, c2 * 0.45 + lamber * 0.55), pico * pico * 1.14 - 0.14);
  float calor = 1.0 - hn / max(alturaLocal, 0.03);

  // erosão que rola para cima mais depressa que as línguas: rasga as pontas em labaredas soltas
  float n1 = texture(uRuido, vec3(xz.x * 1.7, p.y * 0.95 - t * 1.45, xz.y * 1.7) + 0.37).a;
  float n2 = texture(uRuido, vec3(xz.x * 3.9 + 0.5, p.y * 1.9 - t * 2.3, xz.y * 3.9)).r;
  float alto = smoothstep(0.0, 0.75, hn);
  calor += ((n1 - 0.5) * 1.0 + (n2 - 0.5) * 0.4) * (0.12 + 0.88 * alto) - 0.1 * alto;
  // pé ralo: junto da madeira a chama é fina e deixa ver a tora
  calor *= smoothstep(-0.012, 0.05, h);
  // nada passa do fundo de tijolo nem do teto da câmara
  float zFundo = uFundo.x + max(0.0, p.y - uFundo.y) * uFundo.z;
  // e nada é cortado a seco pelas paredes dos lados nem pela caixa: a chama rareia antes de chegar
  float parede = uLados.x + (p.z - uFundo.x) * uLados.y - abs(p.x);
  float limite = smoothstep(0.0, 0.08, p.z - zFundo) * smoothstep(0.0, 0.1, min(min(min(p.x - uMin.x, uMax.x - p.x), uMax.z - p.z), parede));
  calor *= 0.4 + 0.6 * limite;
  calor -= smoothstep(uTeto - 0.14, uTeto, p.y) * 1.2;
  if (calor <= 0.0) discard;

  // só as línguas grandes têm miolo amarelo-branco: o lençol baixo sobre as toras é laranja e ralo
  // (chama fina é transparente e saturada, não leitosa)
  float q = clamp(calor, 0.0, 1.0) * mix(0.42, 1.0, smoothstep(0.12, 0.55, alturaLocal));
  q = q * (0.55 + 0.45 * q); // o miolo quente fica só bem na base
  // borda nítida no corpo, mole só nas pontas
  float corpo = smoothstep(0.0, mix(0.1, 0.26, alto), calor);
  // uma fatia sozinha nunca cobre muito: lâminas finas de chama ficam translúcidas (como são) e só o
  // corpo espesso fecha; assim também não aparece a trama entre as fatias
  float densidade = corpo * limite * smoothstep(0.04, 0.15, alturaLocal) * mix(9.0, 30.0, smoothstep(0.05, 0.6, q));
  float a = min(0.5, 1.0 - exp(-densidade * vPasso));

  // rampa: vermelho-fuligem nas pontas, laranja no corpo, amarelo e, só no miolo da base, branco-dourado
  vec3 cor = mix(vec3(0.36, 0.022, 0.0), vec3(0.95, 0.16, 0.012), smoothstep(0.0, 0.2, q));
  cor = mix(cor, vec3(1.0, 0.36, 0.035), smoothstep(0.16, 0.42, q));
  cor = mix(cor, vec3(1.0, 0.56, 0.1) * 1.1, smoothstep(0.38, 0.66, q));
  cor = mix(cor, vec3(1.0, 0.84, 0.5) * 1.8, smoothstep(0.66, 0.95, q));
  // magia: o miolo vai para o branco-dourado e as bordas para o âmbar saturado (a rampa continua)
  vec3 ouro = mix(vec3(0.7, 0.2, 0.0), vec3(1.0, 0.5, 0.05), smoothstep(0.0, 0.3, q));
  ouro = mix(ouro, vec3(1.0, 0.74, 0.22) * 1.3, smoothstep(0.28, 0.6, q));
  ouro = mix(ouro, vec3(1.0, 0.9, 0.6) * 2.0, smoothstep(0.58, 0.9, q));
  cor = mix(cor, ouro, uMagia * 0.65);
  cor *= uBrilho * (0.7 + 0.3 * uForca) * (1.0 + 0.1 * uPulso);

  // a cor passa pelo tratamento de imagem ANTES de ser multiplicada pela cobertura (no nível baixo o
  // tone mapping acontece aqui; nos outros, no fim do quadro)
  gl_FragColor = vec4(cor, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  // pré-multiplicado, cobrindo quase tudo e somando um pouco: onde as camadas se empilham a cor
  // converge para a do miolo em vez de estourar em branco chapado
  gl_FragColor = vec4(gl_FragColor.rgb * a, a * 0.92);
}`;

/** Trecho comum das fitas (faíscas e magia): estica um quadrilátero ao longo do caminho, sempre de frente para a câmera. */
const FITA_GLSL = /* glsl */ `
uniform float uAltPx;
varying float vLado;
varying float vAlfa;
float h1(float n) { return fract(sin(n * 127.1) * 43758.5453); }
// p0 = ponto desta seção da fita; p1 = um pouco antes no caminho; meia = meia largura em metros
void esticar(vec3 p0, vec3 p1, float meia, float lado) {
  vec4 v0 = modelViewMatrix * vec4(p0, 1.0);
  vec4 v1 = modelViewMatrix * vec4(p1, 1.0);
  vec2 tg = v0.xy / max(0.05, -v0.z) - v1.xy / max(0.05, -v1.z);
  float l = length(tg);
  tg = l > 1e-7 ? tg / l : vec2(0.0, 1.0);
  // nunca mais fina que um pixel e meio: abaixo disso a fita perde brilho em vez de serrilhar
  float pixel = 2.0 * max(0.05, -v0.z) / (projectionMatrix[1][1] * uAltPx);
  float m = max(meia, 0.75 * pixel);
  vAlfa *= clamp(meia / m, 0.0, 1.0);
  v0.xy += vec2(-tg.y, tg.x) * lado * m;
  vLado = lado;
  gl_Position = projectionMatrix * v0;
}`;

const FAISCA_VERT = /* glsl */ `
attribute vec4 aSem;
attribute vec2 aFita; // x = posição ao longo do risco (0 cabeça, 1 cauda); y = lado (-1 ou 1)
uniform float uTempo;
uniform float uForca;
uniform float uMagia;
uniform vec3 uCaixa; // largura, altura, profundidade do fogo
varying float vQuente;
${FITA_GLSL}
vec3 caminho(float k, float r1, float r2, float r3) {
  vec3 p = vec3((r1 - 0.5) * uCaixa.x * 0.7, 0.2 + r2 * 0.14, (r3 - 0.5) * uCaixa.z * 0.5);
  p.y += k * (0.75 + 0.7 * r2) * uCaixa.y * (0.8 + 0.4 * uForca);
  // caminho torto: empurrada pelo ar quente, abrindo para os lados e um pouco para a sala
  p.x += (r1 - 0.5) * 0.5 * k + sin(k * 9.0 + r3 * 40.0) * 0.035 * k;
  p.z += (0.12 + 0.4 * r3) * k * k + cos(k * 7.0 + r1 * 30.0) * 0.03 * k;
  return p;
}
void main() {
  // rajadas: as faíscas de uma mesma rajada saem quase juntas (um estalo da lenha) e depois há silêncio
  float rajada = floor(aSem.w * 3.999);
  float periodo = mix(3.6, 7.2, h1(rajada * 3.3 + 1.0)) / (1.0 + 0.8 * uMagia);
  float ciclo = uTempo / periodo + h1(rajada * 7.7 + 2.0) + aSem.y * 0.045;
  float volta = floor(ciclo);
  float idade = fract(ciclo) * periodo; // segundos desde o estalo
  float vida = mix(0.55, 1.15, aSem.z);
  float cauda = 0.05 / vida; // o risco cobre 0,05 s de caminho
  float k = idade / vida;
  float kk = max(0.0, k - aFita.x * cauda);
  float r1 = h1(volta * 1.7 + aSem.x * 91.0);
  float r2 = h1(volta * 3.1 + aSem.x * 57.0);
  float r3 = h1(volta * 5.3 + aSem.x * 23.0);
  float ativa = step(0.4, h1(volta * 9.1 + aSem.x * 13.0)); // nem toda faísca sai em toda rajada
  vAlfa = ativa * step(k, 1.0) * smoothstep(0.0, 0.05, k) * (1.0 - smoothstep(0.5, 1.0, k)) * min(1.0, uForca * 1.4) * (1.0 - 0.75 * aFita.x);
  vQuente = 1.0 - k;
  float tam = mix(0.003, 0.006, aSem.z) * (0.6 + 0.4 * vQuente);
  esticar(caminho(kk, r1, r2, r3), caminho(max(0.0, kk - 0.02), r1, r2, r3) - vec3(0.0, 1e-4, 0.0), tam * 0.5, aFita.y);
}`;

const FAISCA_FRAG = /* glsl */ `
varying float vAlfa;
varying float vLado;
varying float vQuente;
void main() {
  float a = exp(-vLado * vLado * 3.0) * vAlfa;
  if (a < 0.004) discard;
  // laranja de brasa esfriando para o vermelho no fim da vida (nada de branco)
  vec3 c = mix(vec3(0.9, 0.1, 0.01), vec3(1.0, 0.45, 0.08), smoothstep(0.2, 0.8, vQuente)) * 1.1;
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  gl_FragColor = vec4(gl_FragColor.rgb * a, a);
}`;

const MAGIA_VERT = /* glsl */ `
attribute vec4 aSem;
attribute vec2 aFita; // x = posição ao longo do rastro (0 ponta, 1 fim da cauda); y = lado
uniform float uTempo;
uniform float uMagia;
uniform float uAlcance;
varying float vTom;
varying float vAoLongo;
${FITA_GLSL}
vec3 caminho(float a) {
  // linha central: sai da boca para a sala e vai subindo (rápido no começo, devagar no fim)
  float avanca = 1.0 - pow(1.0 - a, 2.4);
  float zc = avanca * uAlcance * mix(0.55, 1.0, aSem.z);
  float yc = 0.3 + 0.36 * pow(a, 0.7) + mix(0.4, 1.5, aSem.w) * a * a;
  // três fitas em espiral em volta da linha central: apertadas na boca, abrindo e se desfazendo na sala
  float fita = floor(aSem.z * 2.999);
  float solta = smoothstep(0.35, 0.95, a);
  float ang = fita * 2.0944 + uTempo * 0.55 + a * 6.2832 * 1.7 + (aSem.w - 0.5) * (0.4 + 3.4 * solta);
  float raio = 0.06 + 0.3 * smoothstep(0.0, 0.34, a) + mix(0.1, 1.0, aSem.x) * a * a;
  vec3 p = vec3(cos(ang) * raio, yc + sin(ang) * raio * 0.55, zc + sin(ang) * raio * 0.3);
  // vagueio suave no fim da vida
  p.x += sin(uTempo * 0.5 + aSem.x * 40.0) * 0.1 * solta;
  p.y += cos(uTempo * 0.6 + aSem.w * 31.0) * 0.07 * solta;
  return p;
}
void main() {
  float vida = mix(4.2, 6.4, aSem.x);
  float fase = uTempo / vida + aSem.y;
  float cabeca = fract(fase);
  // tamanhos em lei de potência: quase todas pequenas (1 a 1,5 cm, com o halo), raras grandes (até 3,4 cm);
  // rastro curto (uns 2 a 4 % da vida): lê como um ponto de luz que deixa um fio, não como risco de chuva
  float tam = mix(0.01, 0.034, pow(aSem.w, 4.0));
  float cauda = mix(0.01, 0.02, aSem.z) * (0.7 + 0.3 * tam / 0.034);
  float a = cabeca - aFita.x * cauda;
  float vivo = step(0.0, a);
  a = max(a, 0.0);
  // cintilação lenta, cada uma no seu ritmo
  float cintila = 0.7 + 0.3 * sin(uTempo * (0.9 + aSem.x * 1.3) + aSem.w * 50.0);
  vAlfa = vivo * uMagia * smoothstep(0.0, 0.07, cabeca) * (1.0 - smoothstep(0.45, 1.0, cabeca)) * cintila;
  vAoLongo = aFita.x;
  vTom = aSem.y;
  // perfil: ponta arredondada, corpo cheio, cauda afinando até sumir
  float s = aFita.x;
  float perfil = s < 0.14 ? sqrt(max(0.0, 1.0 - pow((0.14 - s) / 0.14, 2.0))) : mix(1.0, 0.12, (s - 0.14) / 0.86);
  esticar(caminho(a), caminho(max(0.0, a - 0.004)) - vec3(0.0, 1e-4, 0.0), tam * 0.5 * perfil * (1.0 - 0.3 * cabeca), aFita.y);
}`;

const MAGIA_FRAG = /* glsl */ `
varying float vAlfa;
varying float vLado;
varying float vTom;
varying float vAoLongo;
void main() {
  float cab = 1.0 - smoothstep(0.0, 0.3, vAoLongo); // perto da ponta
  // miolo claro e fino com uma auréola suave; a cauda é só um risco que apaga
  float a = (exp(-vLado * vLado * 4.0) * mix(0.25, 1.0, cab) * (1.0 - vAoLongo)) * vAlfa;
  if (a < 0.003) discard;
  // dourado, do âmbar ao branco-quente, cada partícula com o seu tom; o miolo da cabeça é o que acende
  vec3 quente = mix(vec3(1.0, 0.56, 0.12), vec3(1.0, 0.78, 0.4), smoothstep(0.25, 0.9, vTom));
  vec3 c = mix(vec3(1.0, 0.4, 0.05), quente, cab) * mix(0.9, 1.9, cab * exp(-vLado * vLado * 7.0));
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  gl_FragColor = vec4(gl_FragColor.rgb * a, a);
}`;

/** Fatias do volume, faíscas e partículas mágicas em cada nível. */
const CONTAGEM: Record<Level, { fatias: number; faiscas: number; magia: number; brilho: number }> = {
  alta: { fatias: 96, faiscas: 16, magia: 84, brilho: 1 },
  media: { fatias: 48, faiscas: 12, magia: 56, brilho: 1 },
  // sem pós-processamento o fogo é desenhado direto na tela: um pouco menos de brilho para não endurecer
  baixa: { fatias: 32, faiscas: 8, magia: 30, brilho: 0.8 },
};
const SECOES_FAISCA = 3;
const SECOES_MAGIA = 7;

/** Geometria de fitas: `n` partículas, cada uma com `secoes` cortes transversais de dois vértices. */
function criarFitas(n: number, secoes: number, rng: () => number): THREE.BufferGeometry {
  const porFita = secoes * 2;
  const sem = new Float32Array(n * porFita * 4);
  const fita = new Float32Array(n * porFita * 2);
  const indices: number[] = [];
  for (let i = 0; i < n; i++) {
    const s = [rng(), rng(), rng(), rng()];
    for (let k = 0; k < secoes; k++)
      for (let lado = 0; lado < 2; lado++) {
        const v = i * porFita + k * 2 + lado;
        sem.set(s, v * 4);
        fita[v * 2] = k / (secoes - 1);
        fita[v * 2 + 1] = lado ? 1 : -1;
      }
    for (let k = 0; k < secoes - 1; k++) {
      const b = i * porFita + k * 2;
      indices.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * porFita * 3), 3));
  geo.setAttribute('aSem', new THREE.BufferAttribute(sem, 4));
  geo.setAttribute('aFita', new THREE.BufferAttribute(fita, 2));
  geo.setIndex(indices);
  return geo;
}

export function criarFogo(ctx: KitContext, opcoes: FogoOpcoes = {}): Fogo {
  const largura = opcoes.largura ?? 0.9;
  const altura = opcoes.altura ?? 0.78;
  const fundura = opcoes.profundidade ?? 0.4;
  const semente = opcoes.semente ?? 11;
  const rng = criarRng(semente);
  const root = new THREE.Group();
  root.name = 'fogo';

  /* ---- caixa do volume ---- */
  const fundo = opcoes.fundo ?? { z0: -fundura / 2 - 0.4, yInclina: 100, inclinacao: 0 };
  const teto = opcoes.teto ?? altura * 1.5;
  const cxMin = new THREE.Vector3(-largura / 2 - 0.1, 0, Math.max(fundo.z0, -fundura / 2 - 0.06));
  const cxMax = new THREE.Vector3(largura / 2 + 0.1, Math.min(teto, altura * 1.3), fundura / 2 + 0.1);

  /* ---- mapa da lenha: altura do dorso das toras e força da fonte em cada ponto do chão ---- */
  const MW = 96;
  const MH = 48;
  const lenha = opcoes.lenha ?? [];
  let topoLenha = 0.05;
  for (const s of lenha) topoLenha = Math.max(topoLenha, Math.max(s.a.y, s.b.y) + (s.alto ?? s.raio));
  topoLenha += 0.01;
  const mapa = new Uint8Array(MW * MH * 4);
  for (let j = 0; j < MH; j++)
    for (let i = 0; i < MW; i++) {
      const x = cxMin.x + ((i + 0.5) / MW) * (cxMax.x - cxMin.x);
      const z = cxMin.z + ((j + 0.5) / MH) * (cxMax.z - cxMin.z);
      let topo = 0.02;
      let perto = 0; // 1 em cima de uma tora ou colado nela
      let sobre = 0; // 1 só em cima de uma tora
      let zFrente = -1e9; // até onde vai a lenha, para a frente, nesta posição
      for (const s of lenha) {
        const ex = s.b.x - s.a.x;
        const ez = s.b.z - s.a.z;
        const l2 = ex * ex + ez * ez || 1e-6;
        const u = Math.min(1, Math.max(0, ((x - s.a.x) * ex + (z - s.a.z) * ez) / l2));
        const d = Math.hypot(x - (s.a.x + ex * u), z - (s.a.z + ez * u));
        const ponta = Math.min(1, Math.min(u, 1 - u) / 0.14); // menos fogo nas pontas da tora
        if (d < s.raio) {
          const k = d / s.raio;
          topo = Math.max(topo, s.a.y + (s.b.y - s.a.y) * u + (s.alto ?? s.raio) * Math.sqrt(1 - k * k));
          sobre = Math.max(sobre, ponta * Math.min(1, (1 - k) / 0.4));
        }
        // as chamas preferem as frestas e os flancos: até 9 cm além da tora
        const k = 1 - Math.min(1, Math.max(0, (d - s.raio) / 0.09));
        perto = Math.max(perto, k * (0.3 + 0.7 * ponta));
        if (Math.abs(ex) > 1e-4) {
          const ux = (x - s.a.x) / ex;
          if (ux > -0.05 && ux < 1.05) zFrente = Math.max(zFrente, s.a.z + ez * ux + s.raio * 0.5);
        }
      }
      const r = Math.hypot(x / (largura / 2), z / (fundura / 2));
      const elipse = 1 - Math.min(1, Math.max(0, (r - 0.5) / 0.52));
      let fonte = elipse * elipse * (3 - 2 * elipse) * (lenha.length ? 0.45 + 0.55 * perto : 1);
      // nada nasce do chão à frente da última tora: ali a chama seria só uma película colada na madeira
      if (lenha.length && sobre <= 0) fonte *= 1 - Math.min(1, Math.max(0, (z - (zFrente > -1e8 ? zFrente : 0.05)) / 0.04));
      const o = (j * MW + i) * 4;
      mapa[o] = Math.round(Math.min(1, topo / topoLenha) * 255);
      mapa[o + 1] = Math.round(Math.min(1, fonte) * 255);
      mapa[o + 2] = Math.round((lenha.length ? sobre : 1) * 255);
      mapa[o + 3] = 255;
    }
  const texLenha = new THREE.DataTexture(mapa, MW, MH, THREE.RGBAFormat);
  texLenha.magFilter = THREE.LinearFilter;
  texLenha.minFilter = THREE.LinearFilter;
  texLenha.wrapS = texLenha.wrapT = THREE.ClampToEdgeWrapping;
  texLenha.needsUpdate = true;

  const TAM_RUIDO = 64;
  const texRuido = new THREE.Data3DTexture(gerarVolumeDeRuido(TAM_RUIDO, semente + 77), TAM_RUIDO, TAM_RUIDO, TAM_RUIDO);
  texRuido.format = THREE.RGBAFormat;
  texRuido.magFilter = THREE.LinearFilter;
  texRuido.minFilter = THREE.LinearFilter;
  texRuido.wrapS = texRuido.wrapT = texRuido.wrapR = THREE.RepeatWrapping;
  texRuido.needsUpdate = true;

  /* ---- chamas: fatias do volume ---- */
  const maxFatias = CONTAGEM.alta.fatias;
  const fPos = new Float32Array(maxFatias * 4 * 3);
  const fIdx: number[] = [];
  for (let i = 0; i < maxFatias; i++) {
    fPos.set([-1, -1, i, 1, -1, i, 1, 1, i, -1, 1, i], i * 12);
    fIdx.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3);
  }
  const geoChamas = new THREE.BufferGeometry();
  geoChamas.setAttribute('position', new THREE.BufferAttribute(fPos, 3));
  geoChamas.setIndex(fIdx);
  const uniformes = {
    uTempo: { value: 0 },
    uForca: { value: 1 },
    uMagia: { value: 0 },
    uPulso: { value: 0 },
    uAltPx: { value: 1920 },
    uCaixa: { value: new THREE.Vector3(largura, altura, fundura) },
    uAlcance: { value: opcoes.alcanceMagia ?? 2.4 },
  };
  const uniformesChama = {
    ...uniformes,
    uRuido: { value: texRuido },
    uLenha: { value: texLenha },
    uMin: { value: cxMin },
    uMax: { value: cxMax },
    uMapa: { value: new THREE.Vector4(cxMin.x, cxMin.z, cxMax.x - cxMin.x, cxMax.z - cxMin.z) },
    uTopoLenha: { value: topoLenha },
    uAltura: { value: altura },
    uFatias: { value: maxFatias },
    uBrilho: { value: 1 },
    uFundo: { value: new THREE.Vector3(fundo.z0, fundo.yInclina, fundo.inclinacao) },
    uLados: { value: new THREE.Vector2(opcoes.lados?.x0 ?? 100, opcoes.lados?.abertura ?? 0) },
    uTeto: { value: teto },
    uSem: { value: new THREE.Vector3(rng(), rng(), rng()) },
  };
  const mistura = {
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.OneFactor,
    blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
  } as const;
  const matChamas = new THREE.ShaderMaterial({ uniforms: uniformesChama, vertexShader: CHAMA_VERT, fragmentShader: CHAMA_FRAG, ...mistura });
  const chamas = new THREE.Mesh(geoChamas, matChamas);
  chamas.frustumCulled = false;
  chamas.renderOrder = 10;
  chamas.name = 'chamas';

  /* ---- faíscas e partículas mágicas: fitas esticadas ao longo do caminho, somadas à imagem ---- */
  const aditivo = { ...mistura, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor } as const;
  const geoFaiscas = criarFitas(CONTAGEM.alta.faiscas, SECOES_FAISCA, rng);
  const matFaiscas = new THREE.ShaderMaterial({ uniforms: uniformes, vertexShader: FAISCA_VERT, fragmentShader: FAISCA_FRAG, ...aditivo });
  const faiscas = new THREE.Mesh(geoFaiscas, matFaiscas);
  faiscas.frustumCulled = false;
  faiscas.renderOrder = 11;
  faiscas.name = 'faiscas';

  const geoMagia = criarFitas(CONTAGEM.alta.magia, SECOES_MAGIA, rng);
  const matMagia = new THREE.ShaderMaterial({ uniforms: uniformes, vertexShader: MAGIA_VERT, fragmentShader: MAGIA_FRAG, ...aditivo });
  const magiaFitas = new THREE.Mesh(geoMagia, matMagia);
  magiaFitas.frustumCulled = false;
  magiaFitas.renderOrder = 12;
  magiaFitas.visible = false;
  magiaFitas.name = 'magia';

  root.add(chamas, faiscas, magiaFitas);

  let alvoMagia = 0;
  let magia = 0;
  let clarao = 0;
  const tremor: TremorDoFogo = { brilho: 1, dx: 0, dy: 0, dz: 0 };
  const tamanhoTela = new THREE.Vector2();

  const aplicarNivel = (level: Level) => {
    const c = CONTAGEM[level];
    geoChamas.setDrawRange(0, c.fatias * 6);
    uniformesChama.uFatias.value = c.fatias;
    uniformesChama.uBrilho.value = c.brilho;
    geoFaiscas.setDrawRange(0, c.faiscas * (SECOES_FAISCA - 1) * 6);
    geoMagia.setDrawRange(0, c.magia * (SECOES_MAGIA - 1) * 6);
  };
  aplicarNivel(ctx.level);

  const fogo: Fogo = {
    root,
    forca: 1,
    tremor,
    get magia() {
      return magia;
    },
    get clarao() {
      return clarao;
    },
    setMagia(intensidade: number) {
      alvoMagia = Math.min(1, Math.max(0, intensidade));
    },
    update(dt: number, t: number) {
      // a magia chega e vai embora sem salto, mesmo que quem chama mude o valor de uma vez
      const antes = magia;
      magia += (alvoMagia - magia) * (1 - Math.exp(-dt * 5));
      if (Math.abs(alvoMagia - magia) < 0.0005) magia = alvoMagia;
      // clarão de entrada: acompanha a subida da magia e decai sozinho
      clarao = Math.min(1, clarao * Math.exp(-dt * 1.6) + Math.max(0, magia - antes) * 1.6);
      // tremor orgânico: três ruídos de ritmos diferentes somados
      const lento = ruido1(t * 1.9, semente + 1);
      const medio = ruido1(t * 5.7, semente + 2);
      const rapido = ruido1(t * 13.1, semente + 3);
      const pulso = lento * 0.5 + medio * 0.33 + rapido * 0.17;
      // com a magia a luz respira devagar (duas ondas lentas de períodos diferentes)
      const respira = magia * (0.15 + 0.07 * Math.sin(t * 2.1) + 0.04 * Math.sin(t * 3.4 + 1.3));
      tremor.brilho = (1 + 0.42 * pulso * (1 - 0.4 * magia)) * (1 + respira);
      tremor.dx = 0.04 * ruido1(t * 3.3, semente + 4);
      tremor.dy = 0.03 * ruido1(t * 4.1, semente + 5) + 0.03 * pulso;
      tremor.dz = 0.02 * ruido1(t * 2.7, semente + 6);
      uniformes.uTempo.value = t;
      uniformes.uForca.value = Math.max(0, fogo.forca);
      uniformes.uMagia.value = magia;
      uniformes.uPulso.value = pulso * 2;
      ctx.renderer.getSize(tamanhoTela);
      uniformes.uAltPx.value = tamanhoTela.y * ctx.renderer.getPixelRatio();
      magiaFitas.visible = magia > 0.002;
      chamas.visible = fogo.forca > 0.02;
      faiscas.visible = chamas.visible;
    },
    setQuality: aplicarNivel,
    dispose() {
      geoChamas.dispose();
      geoFaiscas.dispose();
      geoMagia.dispose();
      matChamas.dispose();
      matFaiscas.dispose();
      matMagia.dispose();
      texLenha.dispose();
      texRuido.dispose();
    },
  };
  return fogo;
}
