# Lareira com o fogo (kit)

Código em `src/world/kit/lareira/` (`index.ts`, `fogo.ts`, `pedra.ts`, `lenha.ts`, `ruido.ts`).
Estúdio de fotos em `src/world/set-kit-lareira/index.ts` (`--param set=kit-lareira`; parâmetros de
estudo: `semchamas=1`, `lz=1,0,0` liga ou desliga cada luz da peça, `forca=1.3`).

Fotos desta revisão: `final.png` (1080x1920) e `final-mini.png`, `final-baixa.png` (`--q baixa`),
`perto-boca.png`, `perto-viga.png`, `perto-pedra.png` (recortes da foto final), `tres-quartos.png`
(outro ângulo, rascunho 540x960) e `efeito-magia-t2/t3/t4.png` (`efeito=FIREPLACE_MAGIC intensidade=1`).
Nenhuma com erro de console.

## Técnica

- **Pedra em duas camadas.** Pele de alvenaria (malha em U subdividida a cada 4 cm até os ombros e
  7 cm acima, deslocada na CPU com o mapa de altura real de `rock_wall_10`) e, por cima, pedras
  lavradas uma a uma: aduelas de larguras diferentes com chave mais alta e saliente, pés-direitos,
  cunhais alternados, ombros em fiadas de degrau com pedra de capa, mísulas de perfil em quarto de
  círculo. Fuligem, sombra pintada da viga e sujeira do pé por cor de vértice; rugosidade variada por
  atributo (quina gasta mais lisa, fundo de junta fosco). Sombra de contato pintada na parede.
- **Soleira** de lajes lascadas com leque de cinza e fuligem; **câmara** de tijolo preta no alto e
  calcinada atrás do fogo; **viga** lavrada a enxó com fenda de secagem e topos com anéis.
- **Lenha rachada** (meia tora, quartos, tora roliça) apoiada umas nas outras, casca real só no arco
  de fora, faces de racha com fibra. Queima no shader: carvão em "pele de jacaré" quase preto e fosco,
  pouca cinza, brasa só em trechos das frestas com um halo estreito, pulsando com ruído lento.
  Leito de cinzas com relevo e carvões angulosos (uma malha só).
- **Fogo em volume** (`criarFogo`): campo de temperatura 3D desenhado em fatias paralelas à tela
  (96 / 48 / 32 nos níveis alto / médio / baixo), uma chamada de desenho. As línguas nascem do dorso
  das toras e das frestas (mapa da lenha), se dobram com o ar quente, se separam e somem; miolo
  branco-dourado só na base, corpo laranja, pontas vermelho-fuligem; nada passa do fundo, dos lados
  ou do teto da câmara (conta analítica no shader). A lenha e os cães recortam o fogo pelo teste de
  profundidade. Faíscas: riscos curtos em rajadas raras.
- **Luz** (três): spot âmbar principal na boca, à frente da lenha e rente à soleira (sombra 2048,
  bias −0,0008, normalBias 0,04, far 14, ligada pela composição); pontual curta acima do fogo dentro
  da câmara; spot "rebatido" sem sombra rente ao piso apontado de volta para a pedra. As três tremem
  juntas com três ruídos somados, em intensidade e em posição. Detalhados não projetam sombra: quem
  projeta é uma malha substituta invisível de poucas dezenas de triângulos.
- **FIREPLACE_MAGIC**: suavizado (`1 − e^(−5·dt)`); o miolo vai para o branco-dourado e as bordas
  para o âmbar, clarão dourado na câmara e na luz rebatida na entrada, a luz respira; 84 partículas
  (56 / 30) douradas, de tamanhos em lei de potência, com rastro curto, sobem em espiral da boca e se
  soltam pela sala até 2,4 m. Volta a 0 sem salto.

## O que esta revisão mudou (continuação da revisão interrompida)

1. **Lenha que parecia bétula ou jornal** (cinza-clara com a malha do carvão desenhada): a luz
   principal estava dentro da pilha e lavava as toras à queima-roupa, o carvão tinha brilho especular
   de Fresnel e cinza demais. Agora a luz fica à frente da lenha (as toras ficam atrás do cone), a luz
   da câmara subiu para cima do fogo, o carvão é mais escuro e fosco, a lenha usa
   `MeshPhysicalMaterial` com `specularIntensity` 0,22, menos cinza, células menores.
2. **Brasa de "lava"** (cada bloco aceso em laranja com contorno): o corpo dos blocos só cora em
   vermelho escuro; a claridade fica em trechos das frestas (nem toda fresta acende), com halo curto.
3. **Reflexo do fogo no piso**: a luz principal desceu para 12 cm acima da soleira, à frente da
   lenha, com decay 1,25 e intensidade 5,4; com a sombra ligada, a borda da soleira corta o começo
   do piso. A mediana da mancha no piso caiu de 226 para 189 (0 a 255) e a mancha deixou de ser uma
   coluna branca maior que o fogo; o canto mais claro ainda chega a 255 em poucos pixels.
4. **Fogo granulado** (trama visível nas bordas): mais fatias no volume (64 para 96; 40 para 48;
   24 para 32).
5. **Magia**: as partículas eram fios cinzentos (pareciam riscos de chuva); agora são pontos dourados
   de 1 a 3,4 cm com halo e rastro curto. A chama dourada mistura menos (0,65) e mantém a rampa.

## API

```ts
import { criarLareira, criarFogo } from '../kit/lareira';

const lareira = await criarLareira(ctx, {
  largura: 3.2,          // corpo de pedra
  alturaConsole: 1.95,   // tampo da viga
  alturaTotal: 6,        // até o teto
  profundidade: 0.95,    // quanto avança da parede
  semente: 7,
  sombraNaParede: true,  // sombra de contato pintada na parede z = 0 (desligue se a parede não estiver ali)
});
lareira.root.position.set(x, 0, zDaParede); // costas em z = 0, boca para +Z, base em y = 0
lareira.root.rotation.y = Math.PI / 2;      // para uma parede lateral
lareira.luz.castShadow = true;              // nasce desligado; a sombra já vem configurada
cena.add(lareira.root);
// a cada quadro
lareira.update(dt, t);
// efeito
lareira.setMagia(estado.intensity);         // 0..1, suavizado por dentro
lareira.forca = 0.6;                        // fogo e luz mais fracos (1 = normal)
lareira.setQuality('media');                // menos fatias e partículas; em 'baixa' a luz perde a sombra
```

`Lareira` é uma `Peca` (`root`, `update(dt, t)`, `setQuality(level)`, `dispose()`) com:
`luz` (SpotLight principal; `update` reescreve a intensidade a cada quadro, então quem quiser mudar o
ganho multiplica depois do `update`), `luzes` (as três: principal, `luz-da-camara`, `luz-rebatida`),
`bocaDoFogo` (Vector3 local), `console` (`{ y, largura, profundidade, z }` do tampo da viga),
`forca`, `setMagia(0..1)` e `fogo`.

Fogo sozinho: `criarFogo(ctx, { largura, altura, profundidade, semente, alcanceMagia, lenha, fundo,
lados, teto })` devolve uma `Peca` com `forca`, `setMagia`, `magia` (suavizada), `clarao` e `tremor`
(`{ brilho, dx, dy, dz }`) para prender uma luz própria ao mesmo pulso. Não cria luzes. `lenha` é a
lista de toras (`{ a, b, raio, alto }`, locais ao fogo); `fundo`, `lados` e `teto` são as paredes da
câmara que nenhuma chama atravessa.

O que a peça espera da composição: um preenchimento quente mínimo (hemisfério ou mapa de ambiente)
para o tampo da viga e as laterais; piso com rugosidade de 0,45 para cima na faixa de 2 m diante da
boca (o reflexo do fogo vira mancha quente e não espelho); nenhum objeto alto nos 2 m à frente da
soleira (a luz rebatida o acenderia por baixo).

## Recursos baixados (Poly Haven, CC0, via `tools/polyhaven.mjs`)

| Recurso | Uso | Peso |
| --- | --- | --- |
| `texturas/rock_wall_10` (cor e normal 2k, ARM e altura 1k) | pele de alvenaria e relevo | perto de 1,9 MB |
| `texturas/rock_08` (1k) | pedras lavradas e lajes | 516 kB |
| `texturas/brick_wall_10` (1k) | câmara | 408 kB |
| `texturas/pine_bark` (1k, cor e normal) | casca da lenha | 412 kB |
| `texturas/rough_wood` (1k) | viga e faces de racha | 428 kB |
| `modelos/painted_wooden_stool.glb` | só no estúdio (objeto para a sombra) | 112 kB |

Texturas da peça: 3,7 MB (limite 7 MB). Créditos conferidos em `public/assets/CREDITOS.md`. Nada novo
baixado nesta revisão. A poltrona `ArmChair_01.glb` do estúdio já estava no projeto.

## Números

- Lareira no nível alto: perto de 81 mil triângulos (limite 120 mil), 11 chamadas de desenho (9
  malhas, chamas, faíscas; 12 com a magia; mais a malha substituta de sombra, que só entra no mapa de
  sombra), 3 luzes. As fatias do fogo são 96 quadriláteros (192 triângulos).
- Quadro inteiro do estúdio, como o laboratório informa: alto 63 chamadas e 252 mil triângulos (com
  sombra, oclusão e pós); baixo 19 chamadas e 50 mil triângulos.

## O que ainda está fraco

- O reflexo da luz principal no piso encerado do estúdio ainda tem um ponto que chega ao branco em
  vista rasante; resolve de vez só com rugosidade do piso (é da composição) ou com luz de área.
- Mudei a intensidade, a queda e a posição da luz principal: as composições que multiplicam
  `luz.intensity` por um ganho próprio vão ver o piso perto da boca uns 25% mais escuro e a sala longe
  quase igual; o ganho pode precisar de um retoque.
- A pequena luz principal, rente à soleira, deixa um ponto quente na laje logo diante da boca.
- As pedras lavradas ficam um pouco brilhantes (cara de molhadas) sob a luz rebatida rasante.
- A acha de pé, encostada à esquerda, ainda é clara demais (pouco carvão por estar longe do miolo).
- Em close extremo o carvão ainda mostra o desenho regular de células; e no nível baixo o fogo,
  sem pós-processamento, mostra a trama das fatias nas bordas.
- O fogo em volume é o desenho mais caro da peça (96 fatias com várias leituras de textura 3D por
  pixel): no laboratório por software, um close de perto em 1080x1920 chega a passar do tempo da
  ferramenta de fotos. Não medi tempo de quadro em placa de vídeo.
