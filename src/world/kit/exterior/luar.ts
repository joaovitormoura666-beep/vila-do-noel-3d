/**
 * Iluminação própria do exterior. Nenhum material daqui usa as luzes da cena: o luar, o céu, o preenchimento,
 * as sombras (assadas uma vez em dois mapas de profundidade), os lampiões e a névoa são calculados no shader
 * a partir de uniformes compartilhados. Assim o fogo e as luminárias da sala não tingem a neve lá fora, e o
 * diorama não acrescenta luz nenhuma à sala. Tudo é calculado no espaço local da peça (pode girar com a parede).
 */
import * as THREE from 'three';

export const MAX_LAMPIOES = 8;

export interface UniformesLuar {
  [nome: string]: THREE.IUniform;
  uLuaDir: THREE.IUniform<THREE.Vector3>;
  uLuaCor: THREE.IUniform<THREE.Color>;
  uEnchDir: THREE.IUniform<THREE.Vector3>;
  uEnchCor: THREE.IUniform<THREE.Color>;
  uCeuAlto: THREE.IUniform<THREE.Color>;
  uCeuBaixo: THREE.IUniform<THREE.Color>;
  uNevoaCor: THREE.IUniform<THREE.Color>;
  uNevoa: THREE.IUniform<THREE.Vector4>;
  uVale: THREE.IUniform<THREE.Vector4>;
  uAuroraCor: THREE.IUniform<THREE.Color>;
  uNoite: THREE.IUniform<number>;
  uGanho: THREE.IUniform<number>;
  uTempo: THREE.IUniform<number>;
  uQuente: THREE.IUniform<THREE.Color>;
  uLamp: THREE.IUniform<THREE.Vector4[]>;
  uSombra0: THREE.IUniform<THREE.Texture | null>;
  uSombra1: THREE.IUniform<THREE.Texture | null>;
  uSombraMat0: THREE.IUniform<THREE.Matrix4>;
  uSombraMat1: THREE.IUniform<THREE.Matrix4>;
  uSombraParam: THREE.IUniform<THREE.Vector4>;
  /** Luz da sala que sai pela janela e cai na neve do jardim: rgb = cor (linear), w = intensidade. */
  uLuzSala: THREE.IUniform<THREE.Vector4>;
  /** Vão da janela da sala: x = largura, y = altura, z = peitoril (m), w = altura da travessa (fração do vão). */
  uJanelaSala: THREE.IUniform<THREE.Vector4>;
}

/** Cores em espaço linear, escolhidas olhando as fotos (ACES, exposição perto de 1). */
export function criarUniformesLuar(): UniformesLuar {
  return {
    uLuaDir: { value: new THREE.Vector3(-0.5, 0.42, -0.75).normalize() },
    uLuaCor: { value: new THREE.Color(0.25, 0.4, 0.9) },
    uEnchDir: { value: new THREE.Vector3(-0.45, 0.32, 0.83).normalize() },
    uEnchCor: { value: new THREE.Color(0.04, 0.075, 0.2) },
    uCeuAlto: { value: new THREE.Color(0.024, 0.052, 0.155) },
    uCeuBaixo: { value: new THREE.Color(0.021, 0.046, 0.135) },
    uNevoaCor: { value: new THREE.Color(0.024, 0.056, 0.17) },
    // x: distância em que a névoa começa; y: densidade; z: teto de opacidade
    uNevoa: { value: new THREE.Vector4(12, 0.0105, 0.93, 0) },
    // névoa de vale: x = altura em que some, y = altura em que está cheia, z = força, w = distância em que começa
    uVale: { value: new THREE.Vector4(1.5, -3.2, 0.55, 15) },
    uAuroraCor: { value: new THREE.Color(0.009, 0.06, 0.042) },
    uNoite: { value: 0 },
    uGanho: { value: 1 },
    uTempo: { value: 0 },
    // âmbar dourado: o verde fica sempre acima do azul, para a poça nunca puxar para o rosa sobre o luar
    uQuente: { value: new THREE.Color(1.0, 0.6, 0.19) },
    uLamp: { value: Array.from({ length: MAX_LAMPIOES }, () => new THREE.Vector4(0, -999, 0, 0)) },
    uSombra0: { value: null },
    uSombra1: { value: null },
    uSombraMat0: { value: new THREE.Matrix4() },
    uSombraMat1: { value: new THREE.Matrix4() },
    // x, y: tamanho de um texel de cada mapa; z, w: folga de profundidade de cada mapa
    uSombraParam: { value: new THREE.Vector4(1 / 2048, 1 / 2048, 0.0006, 0.0012) },
    uLuzSala: { value: new THREE.Vector4(1.0, 0.62, 0.24, 0.4) },
    uJanelaSala: { value: new THREE.Vector4(3.2, 3.4, 0.75, 0.62) },
  };
}

/** Ruído em GLSL, comum a vários shaders do exterior. */
export const GLSL_RUIDO = /* glsl */ `
  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float ruido(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x), mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float s = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      s += a * ruido(p);
      p = p * 2.03 + vec2(17.1, 9.7);
      a *= 0.5;
    }
    return s / 0.9375;
  }
`;

/** Declarações e funções de luz, sombra e névoa (fragmento). Espera vPos (posição local) e vCam (câmera local). */
export const GLSL_LUAR = /* glsl */ `
  uniform vec3 uLuaDir;
  uniform vec3 uLuaCor;
  uniform vec3 uEnchDir;
  uniform vec3 uEnchCor;
  uniform vec3 uCeuAlto;
  uniform vec3 uCeuBaixo;
  uniform vec3 uNevoaCor;
  uniform vec4 uNevoa;
  uniform vec4 uVale;
  uniform vec3 uAuroraCor;
  uniform float uNoite;
  uniform float uGanho;
  uniform float uTempo;
  uniform vec3 uQuente;
  uniform vec4 uLamp[${MAX_LAMPIOES}];
  uniform sampler2D uSombra0;
  uniform sampler2D uSombra1;
  uniform mat4 uSombraMat0;
  uniform mat4 uSombraMat1;
  uniform vec4 uSombraParam;
  uniform vec4 uLuzSala;
  uniform vec4 uJanelaSala;

  /**
   * Luz da sala derramada pela janela: o raio que sai de um ponto do jardim em direção ao miolo da sala precisa
   * atravessar o vão (com a cruz do caixilho fazendo sombra). Dá o trapézio de luz com as travessas na neve,
   * que se abre e amolece com a distância.
   */
  vec3 luzDaSala(vec3 p, vec3 n) {
    if (uLuzSala.w <= 0.0 || p.z > -0.02 || p.z < -16.0) return vec3(0.0);
    vec3 S = vec3(0.0, uJanelaSala.z + uJanelaSala.y * 0.38, 3.2);
    float t = -p.z / (S.z - p.z);
    vec3 q = p + (S - p) * t;
    float L = uJanelaSala.x * 0.5;
    float y0 = uJanelaSala.z;
    float y1 = uJanelaSala.z + uJanelaSala.y;
    float sv = 0.05 + 0.035 * (-p.z);
    float dentro = smoothstep(-L - sv, -L + sv, q.x) * (1.0 - smoothstep(L - sv, L + sv, q.x));
    dentro *= smoothstep(y0 - sv, y0 + sv, q.y) * (1.0 - smoothstep(y1 - sv, y1 + sv, q.y));
    // cruz do caixilho
    float mw = 0.045;
    float bx = 1.0 - smoothstep(mw + sv * 0.6, mw - sv * 0.2, abs(q.x)) * 0.8;
    float by = 1.0 - smoothstep(mw + sv * 0.6, mw - sv * 0.2, abs(q.y - (y0 + uJanelaSala.y * uJanelaSala.w))) * 0.8;
    vec3 d = S - p;
    float r2 = dot(d, d);
    float at = 60.0 / (r2 + 6.0);
    float dif = clamp(dot(n, normalize(d)) * 0.6 + 0.4, 0.0, 1.0);
    // só o chão e o que é baixo (cerca, montes): galhos altos tingidos de laranja chamariam o olho para fora da vila
    float baixo = 1.0 - smoothstep(0.6, 2.2, p.y);
    return uLuzSala.rgb * (uLuzSala.w * dentro * bx * by * at * dif * baixo);
  }

  float lerSombra(sampler2D mapa, vec3 s, float texel, float folga) {
    float z = s.z - folga;
    // nove amostras nos centros dos texels, pesadas pela fração (1-f, 1, f): a borda da sombra sai lisa, sem degraus
    vec2 uv = s.xy / texel - 1.0;
    vec2 f = fract(uv);
    vec2 base = (floor(uv) + 0.5) * texel;
    vec3 wx = vec3(1.0 - f.x, 1.0, f.x);
    vec3 wy = vec3(1.0 - f.y, 1.0, f.y);
    float soma = 0.0;
    for (int i = 0; i < 3; i++) {
      for (int j = 0; j < 3; j++) {
        soma += wx[i] * wy[j] * step(z, texture2D(mapa, base + vec2(float(i), float(j)) * texel).r);
      }
    }
    return soma * 0.25;
  }
  /** 1 = iluminado pela lua, 0 = na sombra. p e n no espaço local da peça. */
  float sombraLua(vec3 p, vec3 n) {
    vec3 s0 = (uSombraMat0 * vec4(p + n * 0.035, 1.0)).xyz;
    if (s0.x > 0.02 && s0.x < 0.98 && s0.y > 0.02 && s0.y < 0.98 && s0.z < 1.0) {
      return lerSombra(uSombra0, s0, uSombraParam.x, uSombraParam.z);
    }
    vec3 s1 = (uSombraMat1 * vec4(p + n * 0.16, 1.0)).xyz;
    if (s1.x > 0.0 && s1.x < 1.0 && s1.y > 0.0 && s1.y < 1.0 && s1.z < 1.0) {
      return lerSombra(uSombra1, s1, uSombraParam.y, uSombraParam.w);
    }
    return 1.0;
  }
  /** Luz ambiente do céu (azul de cima, rebatida da neve por baixo) mais o verde da aurora. */
  vec3 luzCeu(vec3 n) {
    float cima = n.y * 0.5 + 0.5;
    vec3 c = mix(uCeuBaixo, uCeuAlto, cima);
    c += uAuroraCor * uNoite * (0.25 + 0.75 * cima);
    return c;
  }
  /** Luz quente dos lampiões (posições locais em uLamp.xyz, força em w). */
  vec3 luzLampioes(vec3 p, vec3 n) {
    vec3 soma = vec3(0.0);
    for (int i = 0; i < ${MAX_LAMPIOES}; i++) {
      vec4 l = uLamp[i];
      if (l.w <= 0.0) continue;
      vec3 d = l.xyz - p;
      float r2 = dot(d, d);
      float alc = l.w * l.w * 30.0;
      float at = l.w / (0.25 + r2) * clamp(1.0 - r2 / alc, 0.0, 1.0);
      float dif = clamp(dot(n, d * inversesqrt(r2 + 1e-4)) * 0.75 + 0.25, 0.0, 1.0);
      soma += uQuente * at * dif;
    }
    return soma;
  }
  /** Perspectiva atmosférica: mistura com o azul do horizonte conforme a distância à janela, mais névoa baixa no vale. */
  vec3 aplicarNevoa(vec3 cor, vec3 p) {
    float d = length(p.xz);
    float f = 1.0 - exp(-max(d - uNevoa.x, 0.0) * uNevoa.y);
    float fv = smoothstep(uVale.x, uVale.y, p.y) * smoothstep(uVale.w, uVale.w + 10.0, d) * uVale.z;
    f = min(f + fv * (1.0 - f), uNevoa.z);
    vec3 nev = uNevoaCor + uAuroraCor * uNoite * 0.22;
    return mix(cor, nev, f);
  }
`;

export interface OpcoesMaterialLuar {
  mapa?: THREE.Texture | null;
  normal?: THREE.Texture | null;
  /** Cor que multiplica a textura (linear). */
  tinta?: THREE.ColorRepresentation;
  /** Puxa a textura para um tom neutro (0 = textura pura, 1 = só a tinta): tira a cara de fotografia de dia. */
  lavar?: number;
  forcaNormal?: number;
  /** 0 = superfície dura; perto de 0,4 = neve (a luz dá a volta). */
  envolve?: number;
  /** Brilho largo do luar (neve, gelo). */
  brilho?: number;
  brilhoPot?: number;
  /** Neve pousada por cima (pelo ângulo da normal mais ruído): 0 = nada, 1 = bastante. */
  poeira?: number;
  /** 'terreno': UV pelo chão, mapa de luz das janelas, caminho; 'morro': silhuetas distantes com mata pintada. */
  modo?: 'padrao' | 'terreno' | 'morro' | 'neve';
  /** Mapa de luz do terreno (R = luz quente, G = caminho, B = oclusão pintada). */
  mapaLuz?: THREE.Texture | null;
  lampioes?: boolean;
  sombras?: boolean;
  /** Recorte por alfa (ramos de agulhas): rgb multiplica a cor, a < 0,42 é descartado. Usa a uv da malha. */
  alfa?: THREE.Texture | null;
}

/** Material iluminado pelo luar. Geometria: position, normal, uv e aCor (rgb = tinta do vértice, a = luz quente local). */
export function materialLuar(U: UniformesLuar, o: OpcoesMaterialLuar = {}): THREE.ShaderMaterial {
  const modo = o.modo ?? 'padrao';
  const defines: Record<string, string | number> = {};
  if (o.mapa) defines.TEM_MAPA = 1;
  if (o.normal) defines.TEM_NORMAL = 1;
  if (modo === 'terreno') defines.TERRENO = 1;
  if (modo === 'morro') defines.MORRO = 1;
  if (modo === 'neve') defines.NEVE = 1;
  if (o.poeira) defines.POEIRA = 1;
  if (o.alfa) defines.TEM_ALFA = 1;
  if (o.lampioes ?? true) defines.LAMPIOES = 1;
  if (o.sombras ?? true) defines.SOMBRAS = 1;
  return new THREE.ShaderMaterial({
    name: `luar-${modo}`,
    defines,
    side: THREE.DoubleSide,
    uniforms: {
      ...U,
      uMapa: { value: o.mapa ?? null },
      uNormal: { value: o.normal ?? null },
      uMapaLuz: { value: o.mapaLuz ?? null },
      uAlfa: { value: o.alfa ?? null },
      uTinta: { value: new THREE.Color(o.tinta ?? '#ffffff') },
      uLavar: { value: o.lavar ?? 0 },
      uForcaNormal: { value: o.forcaNormal ?? 1 },
      uEnvolve: { value: o.envolve ?? 0 },
      uBrilho: { value: new THREE.Vector2(o.brilho ?? 0, o.brilhoPot ?? 24) },
      uPoeira: { value: o.poeira ?? 0 },
    },
    vertexShader: /* glsl */ `
      attribute vec4 aCor;
      #ifdef TERRENO
        attribute vec2 aLm;
        varying vec2 vLm;
      #endif
      varying vec3 vPos;
      varying vec3 vNor;
      varying vec3 vCam;
      varying vec2 vUv;
      varying vec4 vCor;
      #ifdef USE_INSTANCING
        varying float vVar;
      #endif
      void main() {
        vec4 p = vec4(position, 1.0);
        vec3 n = normal;
        #ifdef USE_INSTANCING
          p = instanceMatrix * p;
          n = mat3(instanceMatrix) * n;
          vVar = fract(sin(dot(instanceMatrix[3].xz, vec2(12.9898, 78.233))) * 43758.5453);
        #endif
        vPos = p.xyz;
        vNor = n;
        vUv = uv;
        vCor = aCor;
        #ifdef TERRENO
          vLm = aLm;
        #endif
        vCam = (inverse(modelMatrix) * vec4(cameraPosition, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * p;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMapa;
      uniform sampler2D uNormal;
      uniform sampler2D uMapaLuz;
      uniform sampler2D uAlfa;
      uniform vec3 uTinta;
      uniform float uLavar;
      uniform float uForcaNormal;
      uniform float uEnvolve;
      uniform vec2 uBrilho;
      uniform float uPoeira;
      varying vec3 vPos;
      varying vec3 vNor;
      varying vec3 vCam;
      varying vec2 vUv;
      varying vec4 vCor;
      #ifdef TERRENO
        varying vec2 vLm;
      #endif
      #ifdef USE_INSTANCING
        varying float vVar;
      #endif
      ${GLSL_RUIDO}
      ${GLSL_LUAR}

      // base tangente pelas derivadas da posição e da UV (não precisa de tangentes na malha)
      vec3 normalDoMapa(vec3 N, vec3 p, vec2 uv, vec3 m) {
        vec3 dp1 = dFdx(p);
        vec3 dp2 = dFdy(p);
        vec2 du1 = dFdx(uv);
        vec2 du2 = dFdy(uv);
        vec3 dp2perp = cross(dp2, N);
        vec3 dp1perp = cross(N, dp1);
        vec3 T = dp2perp * du1.x + dp1perp * du2.x;
        vec3 B = dp2perp * du1.y + dp1perp * du2.y;
        float inv = inversesqrt(max(max(dot(T, T), dot(B, B)), 1e-12));
        return normalize(T * (m.x * inv) + B * (m.y * inv) + N * m.z);
      }

      void main() {
        // normal geométrica voltada para quem olha: serve para desenhar os dois lados sem depender do sentido dos triângulos
        vec3 Ng = normalize(cross(dFdx(vPos), dFdy(vPos)));
        vec3 V = normalize(vCam - vPos);
        if (dot(Ng, V) < 0.0) Ng = -Ng;
        vec3 N = normalize(vNor);
        if (dot(N, Ng) < 0.0) N = -N;
        vec3 Nliso = N;
        float dist = length(vCam - vPos);

        #ifdef TERRENO
          if (vPos.z > 0.0) discard;
        #endif
        vec3 albedo = uTinta;
        #ifdef TEM_ALFA
          vec4 ta = texture2D(uAlfa, vUv);
          if (ta.a < 0.42) discard;
          albedo *= ta.rgb;
        #endif
        float oclusao = 1.0;
        float quente = vCor.a;
        #ifdef TERRENO
          // neve do chão: duas escalas da mesma textura, giradas, para a repetição não aparecer
          vec2 ua = vPos.xz / 2.6;
          vec2 ub = mat2(0.82, -0.57, 0.57, 0.82) * vPos.xz / 0.71 + vec2(0.37, 0.11);
          vec3 ta = texture2D(uMapa, ua).rgb;
          vec3 tb = texture2D(uMapa, ub).rgb;
          float grao = mix(ta.g, tb.g, 0.5);
          albedo = uTinta * mix(vec3(grao), vec3(0.86), uLavar);
          vec3 na = texture2D(uNormal, ua).xyz * 2.0 - 1.0;
          vec3 nb = texture2D(uNormal, ub).xyz * 2.0 - 1.0;
          float perto = 1.0 - smoothstep(14.0, 55.0, dist);
          vec2 nd = (na.xy * 0.9 + nb.xy * 0.7 * perto) * uForcaNormal;
          vec4 lm = texture2D(uMapaLuz, vLm);
          // caminho pisado: mais escuro, mais relevo; a oclusão pintada assenta casas e troncos
          nd *= 1.0 + lm.g * 1.6;
          albedo *= 1.0 - lm.g * 0.2;
          oclusao = 1.0 - lm.b * 0.75;
          quente += lm.r * 2.4;
          // ondas do vento na neve fofa (só perto: de longe viram ruído)
          float ond = 1.0 - smoothstep(9.0, 30.0, dist);
          vec2 po = vPos.xz * vec2(1.1, 3.4) + vec2(vPos.z * 0.35, 0.0);
          float o0 = fbm(po);
          vec2 go = vec2(fbm(po + vec2(0.12, 0.0)) - o0, fbm(po + vec2(0.0, 0.12)) - o0);
          nd += go * vec2(1.1, 3.4) * 1.5 * ond * (1.0 - lm.g);
          N = normalize(N + vec3(nd.x, 0.0, -nd.y));
        #else
          #ifdef TEM_MAPA
            vec3 t = texture2D(uMapa, vUv).rgb;
            #ifdef NEVE
              albedo = uTinta * mix(vec3(t.g), vec3(0.86), uLavar);
            #else
              float cinza = dot(t, vec3(0.3, 0.5, 0.2));
              albedo = uTinta * mix(t, vec3(cinza * 0.6 + 0.2), uLavar) * 1.6;
            #endif
          #endif
          #ifdef TEM_NORMAL
            vec3 m = texture2D(uNormal, vUv).xyz * 2.0 - 1.0;
            m.xy *= uForcaNormal;
            N = normalDoMapa(N, vPos, vUv, normalize(m));
          #endif
        #endif
        albedo *= vCor.rgb;

        float envolve = uEnvolve;
        vec2 brilho = uBrilho;
        #ifdef MORRO
          // morros distantes: neve azulada com manchas de mata escura (pintadas por ruído), mais densas embaixo
          float mata = fbm(vPos.xz * 0.045 + vec2(3.0, 7.0)) + 0.35 * ruido(vec2(vPos.x * 0.9 + vPos.z * 0.4, vPos.y * 1.6));
          float alt = vUv.y;
          float m2 = smoothstep(0.52, 0.74, mata + (0.5 - alt) * 0.35);
          albedo = mix(albedo, albedo * vec3(0.16, 0.2, 0.3), m2 * vCor.a);
          quente = 0.0;
        #endif
        #ifdef POEIRA
          // neve pousada nas faces voltadas para cima, com borda irregular
          float rp = ruido(vPos.xz * 7.0 + vPos.y * 3.0) * 0.5 + ruido(vPos.xy * 21.0) * 0.25;
          float pn = smoothstep(0.62 - uPoeira * 0.55, 0.9 - uPoeira * 0.4, Nliso.y + rp * 0.45);
          #ifdef USE_INSTANCING
            // cada árvore do bosque segura mais ou menos neve
            pn *= 0.35 + 0.65 * vVar;
          #endif
          albedo = mix(albedo, vec3(0.8, 0.84, 0.9), pn);
          envolve = mix(envolve, 0.4, pn);
          N = normalize(mix(N, Nliso, pn * 0.7));
        #endif

        vec3 L = normalize(uLuaDir);
        float ndl = dot(N, L);
        float dif = clamp((ndl + envolve) / (1.0 + envolve), 0.0, 1.0);
        float sombra = 1.0;
        #ifdef SOMBRAS
          sombra = sombraLua(vPos, Ng);
        #endif
        vec3 luz = uLuaCor * dif * sombra;
        #ifdef TERRENO
          // a oclusão pintada também segura o luar (pé das casas, faixa escura junto da parede da sala)
          luz *= mix(1.0, oclusao, 0.55);
        #endif
        luz += uEnchCor * clamp(dot(N, normalize(uEnchDir)) * 0.6 + 0.4, 0.0, 1.0);
        luz += luzCeu(N) * oclusao;
        // luz quente local (janelas, lampiões, sala): substitui parte do luar em vez de somar por cima,
        // senão âmbar + azul vira lilás
        vec3 luzQ = uQuente * quente * (0.55 + 0.45 * clamp(N.y, 0.0, 1.0));
        #ifdef LAMPIOES
          luzQ += luzLampioes(vPos, Nliso);
        #endif
        luzQ += luzDaSala(vPos, Nliso) * oclusao;
        float qf = clamp(max(luzQ.r, luzQ.g) * 2.6, 0.0, 1.0);
        luz = mix(luz, luz * 0.3, qf) + luzQ;
        vec3 cor = albedo * luz;

        // brilho largo do luar na neve e no gelo (contra a luz, o reflexo vem na direção de quem olha)
        vec3 H = normalize(L + V);
        float esp = pow(max(dot(N, H), 0.0), brilho.y) * brilho.x * sombra;
        cor += uLuaCor * esp;
        #ifdef TERRENO
          // cristais: pontos de brilho que acendem e apagam conforme o olhar se move (só perto da vidraça)
          vec2 cg = vPos.xz * 46.0;
          vec2 ci = floor(cg);
          float ch = hash21(ci);
          float cf = length(fract(cg) - 0.5 - (vec2(hash21(ci + 3.7), hash21(ci + 9.1)) - 0.5) * 0.5);
          float cv = fract(ch * 31.0 + dot(V.xz, vec2(9.0, 5.0)) + V.y * 7.0);
          float cristal = step(0.93, ch) * smoothstep(0.26, 0.0, cf) * smoothstep(0.7, 1.0, cv);
          cor += uLuaCor * cristal * 1.1 * sombra * (1.0 - smoothstep(4.0, 17.0, dist)) * clamp(dif * 1.6, 0.0, 1.0);
        #endif
        #if !defined(TERRENO) && !defined(NEVE) && !defined(MORRO)
          // fio de luar nas quinas voltadas para a lua (ripas, caixilhos, troncos): o brilho fino que faz o material parecer real
          float rim = pow(1.0 - max(dot(Nliso, V), 0.0), 4.0) * clamp(dot(Nliso, L) + 0.25, 0.0, 1.0) * sombra;
          cor += uLuaCor * rim * 0.22;
        #endif
        #if defined(TERRENO) || defined(NEVE)
          // a neve deixa a luz atravessar um pouco: borda clara quando a lua está por trás
          float contra = pow(clamp(dot(V, -L) * 0.5 + 0.5, 0.0, 1.0), 3.0) * pow(1.0 - max(dot(Nliso, V), 0.0), 2.0);
          cor += uLuaCor * albedo * contra * 0.35 * sombra;
        #endif

        cor = aplicarNevoa(cor, vPos);
        gl_FragColor = vec4(cor * uGanho, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}
