# Cenário: a sala natalina

A sala em uso é a **composição A**, escolhida pelo dono em 15/11/2026: lareira na parede da esquerda,
janela grande em arco no fundo, árvore à direita e a poltrona grande do Noel no meio, diante da janela.

- Código: `src/world/set-a/` (todos os números em `src/world/set-a/ajustes.ts`).
- Cenário oficial do jogo: `src/world/set/index.ts`, que reexporta a composição A e o `ASSENTO_DO_NOEL`.
- Notas completas, com fotos e números: `lab/fotos/sala-a/NOTAS.md` (escrita em 16/11/2026 por volta de
  01:26 UTC). Atenção: depois dela o jogo 3D mudou `ajustes.ts` (entrega, revelação, folga da fila e uma
  luz nova), e a nota ainda traz os valores antigos. Neste documento, os valores conferidos no código em
  16/11/2026, por volta de 03:38 UTC, estão marcados assim; quando houver diferença, vale o código.
- Composição B (não escolhida, fica como referência): `src/world/set-b/`, fotos em `lab/fotos/sala-b/`.
- Ver: `http://127.0.0.1:5180/demo-sala.html` ou `node tools/shot.cjs sala --param set=a --half`.

## A ideia da imagem

Quente por dentro, azul frio por fora. O olho cai no fogo e no reflexo dele no piso encerado, sobe pela
árvore e descansa na janela com a lua. O trono do Noel fica no meio desse caminho, recortado contra o
vidro azul (atrás do encosto não há móvel nem árvore). No canto de baixo à esquerda, uma cadeira de
balanço escura em silhueta faz o primeiro plano. A sala precisa ser bonita mesmo vazia.

## Planta (metros, Y para cima)

| O quê | Onde |
| --- | --- |
| Paredes | esquerda em x = -3,6; fundo em z = -5,5; forro a 5,6 m; paredes de 0,4 m |
| Lareira (kit) | costas em x = -3,6, centro em z = -3,65, largura 3,2 m, console a 1,78 m, até o forro; boca para +X |
| Janela em arco (kit) | centro em x = -1,55, largura 2,6 m, altura 3,7 m, peitoril a 0,7 m, com cortinas de veludo |
| Árvore (kit) | (1,02; -3,85), 3,6 m de altura, 230 luzinhas, 4 presentes ao pé |
| Poltrona do Noel (trono) | `ArmChair_01` em (-0,30; -2,85), giro 0,68 rad, escala 1,5 |
| Tapete redondo (kit) | (-0,05; -2,40), 3,1 m |
| Lanterna acesa | (-1,5; -2,45), no piso, à esquerda do trono |
| Cadeira de balanço (primeiro plano) | (2,85; 5,35), madeira escurecida |
| No console e em volta da lareira | relógio de console, castiçais de latão, tina com achas, duas meias na viga, uma guirlanda no peito da chaminé |
| Câmera | posição (7,5; 3,5; 11,6), olhando para (-1,4; 1,25; -5,2), FOV 32, balanço lento de 0,06 m |

## Peças do kit (`src/world/kit/`)

O kit são peças prontas que qualquer composição pode posicionar. Convenção (`src/world/kit/tipos.ts`):
metros, Y para cima, base em y = 0, frente para +Z; cada peça devolve `root`, `update(dt, t)`,
`setQuality(level)` e `dispose()`. Na sala A elas são carregadas com tolerância a falhas
(`src/world/set-a/pecas.ts`): se uma peça falhar, a sala sobe sem ela e o erro vai para o console.

| Peça | Pasta | O que é | Notas |
| --- | --- | --- | --- |
| Lareira e fogo | `kit/lareira/` | Pedra bruta com relevo real, aduelas lavradas uma a uma, viga lavrada, lenha rachada que queima no shader, fogo em volume (fatias num campo de temperatura 3D) e três luzes. | `lab/fotos/kit-lareira/NOTAS.md` |
| Árvore e folhagem | `kit/arvore/` | Abeto com cerca de 6.150 frondes instanciadas (texturas de ramo tiradas do modelo Fir Sapling), luzinhas presas aos ramos, enfeites, estrela, saia e presentes; também a guirlanda e o festão. | `lab/fotos/kit-arvore/NOTAS.md` |
| Janela | `kit/janela/` | Janela de marcenaria com marco, folhas, pinázios, bandeira em arco, peitoril, ferragens de latão, vidro com reflexo, geada e neve acumulada; devolve o contorno para a parede abrir o vão. | `lab/fotos/kit-janela/NOTAS.md` |
| Exterior | `kit/exterior/` | Diorama 3D da vila nevada à noite visto pela janela: jardim com cerca, árvore nua, pinheiro e lampião; vale com riacho e ponte; vila com igreja; bosque em impostores; céu com lua, estrelas, aurora e o trenó. Ilumina tudo no próprio shader (não usa as luzes da sala). | `lab/fotos/kit-exterior/NOTAS.md` |
| Tecidos | `kit/tecidos/` | Cortina de veludo com pregas irregulares, tapete de lã (redondo ou retangular), meia de Natal de tricô, almofada e manta. | `lab/fotos/kit-janela/NOTAS.md` |
| Estúdio | `kit/estudio.ts` | Canto de sala neutro para fotografar uma peça sozinha (usado pelos `set-kit-*`). | |

Críticas de direção de arte das peças, antes da segunda rodada: árvore 5,5; lareira 6; janela 5;
exterior 6,5 (`lab/fotos/kit-*-critica/CRITICA.json`). A segunda rodada de cada peça atacou essas
críticas; os pontos que ainda ficaram fracos estão no fim de cada `NOTAS.md`.

## Luzes (tudo em `ajustes.ts`)

1. **Fogo (principal, com sombra).** O spot âmbar da lareira, com o alvo puxado para a câmera e para baixo:
   o cone atravessa o piso diante do trono e faz o reflexo comprido no assoalho encerado. Tremula com
   ruídos somados.
2. **Luar com sombra pela janela.** Spot estreito e distante, mapa 2048, que desenha no tapete e no piso o
   recorte da janela com as travessas e a sombra comprida do trono. Cor e força copiadas do exterior a
   cada quadro (na noite mágica a mancha fica verde-água).
3. **Árvore:** uma luz pontual sem sombra e as luzinhas (emissivas).
4. **Acentos:** a lanterna ao lado do trono, as velas do castiçal (emissivas), uma poça quente no lugar
   do Noel e o destaque da entrega (só aceso com `setDeliveryActive(true)`).
5. **Preenchimento da fila (`LUZ.fila`, acrescentada pelo jogo 3D):** spot quente, largo e fraco, sem
   sombra, do lado da câmera, sobre o piso da fila. A fila é vista de costas e o fogo pega o outro lado
   dos visitantes; sem esta luz as costas viram uma massa escura. No código ela se chama
   `preenchimento-da-fila` (`src/world/set-a/luzes.ts`).
6. **Preenchimento:** hemisférica quente e um clarão quente no alto, para as sombras ficarem
   marrom-avermelhadas, nunca pretas.
7. **Luz pintada no reboco:** a parede escurece para o alto e para longe da lareira.
8. **Reflexos da própria sala:** um mapa de ambiente gerado da sala montada com o fogo aceso
   (`ambiente.ts`), entregue em `VillageSet.environment`.
9. **Acabamento (`LOOK`):** ACES, exposição 1,12, oclusão de raio 0,5, brilho 0,2 com limiar 1,0,
   vinheta marrom 0,36, separação quente e frio 0,16, granulado 0,1.

Contagem (código em 16/11/2026, cabeçalho de `luzes.ts`): 11 luzes no total, sempre (a entrega apagada fica com força zero)
(três da lareira, uma da árvore e sete da sala: luar, hemisférica, lanterna, clarão do alto, poça do Noel,
entrega e fila). Isso passa do teto de 10 luzes do `AGENTS.md` (seção 7), que registra a exceção. O
comentário de `LUZ` em `ajustes.ts` ainda diz "dez no total". Sombras: 2 no nível alto (fogo e luar), 1 no
médio (o luar vira poça pintada), 0 no baixo.

## Efeitos ambientes (`setAmbient`)

A agenda (`src/ambient/AmbientDirector.ts`) calcula o estado; a sala só desenha (`src/world/set-a/index.ts`).

| Efeito | O que acontece na sala A |
| --- | --- |
| `TREE_SPARKLE` | A estrela da árvore dá um lampejo e ondas sobem pelas luzinhas (`arvore.setCintilar`). |
| `FIREPLACE_MAGIC` | A lareira fica dourada e solta faíscas (`lareira.setMagia`); a composição soma poeira dourada subindo diante da chaminé (`set-a/magia.ts`, 160 grãos) e 40% mais força no fogo, porque nesta câmera a boca é vista de lado. |
| `SLEIGH_PASS` | Um trenó cruza o disco da lua dentro do arco da janela (`exterior.setTreno`), passando sobre a lua por volta de `progress` 0,4. |
| `MAGICAL_NIGHT` | A luz de fora muda e surge uma aurora (`exterior.setNoiteMagica`); o luar da sala e a neve acompanham. |

## Câmera e enquadramento

Câmera alta (3,5 m), à direita, olhando para o canto esquerdo do fundo com lente longa (FOV 32). A parede
esquerda entra em perspectiva e a lareira aparece em três quartos, da soleira até o forro. Conferido por
projeção dos pontos (16/11 por volta de 01:26 UTC, antes dos ajustes do jogo 3D): fogo em y de cerca de
1150 px, janela de 380 a 1030, árvore de 550 a 1300, trono de 950 a 1300, fila de 1120 a 1760. A câmera
não mudou depois disso, mas a entrega e a fila mudaram: refaça a conferência com foto.

## Âncoras (`src/world/set-a/ancoras.ts`)

Valores calculados com `criarAncoras()` no código de 16/11/2026, por volta de 03:38 UTC (depois dos ajustes
do jogo 3D, que está em construção; podem mudar de novo).

| Âncora | Valor | Para que serve |
| --- | --- | --- |
| `santa` | (-0,30; 0; -2,85), yaw 0,68 | Centro da poltrona no piso, com o giro dela. O Noel entra aqui, sentado. |
| `delivery` | cerca de (1,47; 0; -2,30), yaw cerca de -1,87 | 1,85 m do centro da poltrona na direção 1,27 rad (`LUGAR.distanciaDaEntrega` e `LUGAR.direcaoDaEntrega` em `ajustes.ts`). À frente e à direita do trono: o visitante fica de perfil para a câmera, de frente para o Noel, sem se esconder atrás da poltrona. |
| `reveal` | cerca de (0,80; 2,50; -2,51) | 62% do caminho do Noel ao visitante, a 2,5 m de altura (`FILA.revelacao` em `ajustes.ts`), contra o vão azul da janela: onde o presente aparece grande. |
| `queuePath` | cerca de 16,1 m de caminho (14 pontos; a curva suavizada do `Path3` dá cerca de 16,4 m) | Entra por baixo da tela e serpenteia em três fileiras atravessadas à câmera; chega à entrega pela direita. Espaço de 1,05 m entre pessoas (`FILA.espaco`) e folga de 1,15 m na frente (`FILA.folgaDaFrente`). O jogo 3D mostra até 13 pessoas esperando (`FILA3D.tetoVisiveis` em `src/jogo3d/config.ts`); o painel escolhe quantas (padrão 11). Conferir de novo com foto. |
| `exitPath` | | Da entrega para a direita, por trás da primeira fileira, a 0,8 m da árvore, saindo pela borda direita. |

As fileiras da fila continuam compostas a partir do ponto de entrega antigo (1,55 m na direção 1,05 rad),
que no código virou `LUGAR.referenciaDaFila`. Esse ponto antigo, (1,04; -2,08), é o que ainda aparece em
`lab/fotos/sala-a/NOTAS.md` e no desenho em texto no topo de `ajustes.ts`. O Noel aponta o gesto de
entregar para a entrega atual por `VISITANTE` em `src/world/cast/noel/medidas.ts` (0,59 rad e 1,85 m, vistos
por ele), gravado à mão: se a entrega mudar, ele precisa mudar junto.

`ASSENTO_DO_NOEL` (também em `ancoras.ts`), medido no GLB da poltrona vezes 1,5: assento a 0,75 m,
profundidade útil 0,975 m, 0,93 m entre os braços, braços a 0,99 m, encosto a 1,60 m, quadril do Noel
sentado em (-0,41; 0,78; -2,99).

## Números (laboratório, 1080x1920)

Medido em 16/11/2026 por volta de 01:26 UTC (`lab/fotos/sala-a/NOTAS.md`), **antes** dos ajustes do jogo 3D
(luz da fila, entrega nova). A nota dos gnomos, de por volta de 02:32 UTC, diz que "a sala sozinha" dá
cerca de 252 chamadas e 1,14 milhão de triângulos, sem detalhar o que entrou na conta. As duas notas não
batem: refaça a medição antes de confiar nesses números.

| Nível | Chamadas de desenho | Triângulos (todas as passadas) | Sombras |
| --- | --- | --- | --- |
| alta | 167 (169 com trenó ou magia) | 853 a 886 mil | 2 |
| média | 109 | 516 mil | 1 |
| baixa | 91 | 409 mil | 0 |

Peso dos recursos: cerca de 6 MB da sala e 7,3 MB das peças do kit, total de cerca de 13,4 MB (limite de
40 MB).

## Pontos fracos conhecidos (de `lab/fotos/sala-a/NOTAS.md`)

- O fogo é visto de lado e fica pequeno no quadro; a lareira lê mais pela pedra e pelo reflexo no piso.
- O forro e as vigas no alto quase não aparecem (ficam escuros, na faixa da barra do TikTok e do título).
- A parede à direita, acima da árvore, é uma área lisa e escura.
- Com 12 gnomos na fila, as cabeças da fileira da frente tapam a soleira da lareira e os pés do trono
  (visto antes dos ajustes do jogo 3D; conferir com foto).
- O vidro reflete o fogo num ponto quente atrás do encosto do trono (com o Noel sentado, some atrás dele).
- A sombra do luar no piso é forte e fria; no nível médio vira uma poça pintada mais fraca.
- No nível baixo o fogo e o assoalho ficam mais apagados.

## Como mexer

- Mudar posição, luz, câmera ou acabamento: só `src/world/set-a/ajustes.ts`. Fotografe antes e depois.
- Fazer outra composição: crie `src/world/set-<nome>/index.ts` exportando `buildVillageSet` e fotografe com
  `--param set=<nome>`. Para virar a sala do jogo, `src/world/set/index.ts` passa a reexportá-la (decisão do
  dono).
- Mudar uma peça do kit: trabalhe no estúdio dela (`--param set=kit-lareira`, `kit-arvore`, `kit-janela`,
  `kit-exterior`) e depois confira na sala A, porque as composições ajustam ganhos de luz em cima da peça.
