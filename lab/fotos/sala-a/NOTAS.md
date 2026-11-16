# Sala natalina 3D, composição A

Código em `src/world/set-a/` (`node tools/shot.cjs sala --param set=a`). Esta é a composição escolhida pelo dono.

## Conceito

Lareira imponente na parede esquerda, janela grande em arco no fundo, árvore à direita. A câmera fica alta como
um adulto de pé sobre um degrau (3,5 m), à direita, e olha para o canto esquerdo do fundo com lente longa
(FOV 32): a parede esquerda entra em perspectiva e a lareira aparece em três quartos, da soleira até o forro,
com o fogo de lado jogando luz âmbar no piso da esquerda para a direita. A janela é o grande recorte azul no
meio do quadro, com a lua no alto do arco. Diante dela, sobre o tapete redondo, fica **a poltrona grande do
Noel** (ArmChair_01 em escala 1,5): é o trono dele, no centro da área de jogo, de frente para a câmera e um
pouco virado para a direita, de onde o visitante chega. Atrás do encosto só há o vidro azul (nenhum móvel,
nenhuma árvore): o Noel vermelho e branco vai se recortar contra a noite. A árvore fecha o quadro à direita,
cobrindo só a cortina. No canto de baixo à esquerda, uma cadeira de balanço escura em silhueta faz o primeiro plano.

O olho cai no fogo e no reflexo dele no piso, sobe pela árvore e descansa na janela com a lua; o trono fica no
meio desse caminho.

## Planta (metros, Y para cima)

| O quê | Onde |
| --- | --- |
| Paredes | esquerda x = -3,6; fundo z = -5,5; pé-direito 5,6 (forro), paredes de 0,4 m |
| Lareira (kit) | costas em x = -3,6, centro z = -3,65, largura 3,2, console a 1,78, até o forro; boca para +X |
| Janela em arco (kit) | centro x = -1,55, largura 2,6 (mínimo da peça), altura 3,7, peitoril 0,7; vidro em z = -5,8 |
| Árvore (kit) | (1,02; -3,85), 3,6 m, raio 1,0, 230 luzes, 4 presentes |
| Poltrona do Noel (trono) | (-0,30; -2,85), giro 0,68 rad, escala 1,5 |
| Tapete redondo (kit) | (-0,05; -2,40), 3,1 m |
| Lanterna acesa | (-1,5; -2,45), no piso, à esquerda do trono |
| Cadeira de balanço (1º plano) | (2,85; 5,35), madeira escurecida a 32 % |
| Câmera | (7,5; 3,5; 11,6) olhando (-1,4; 1,25; -5,2), FOV 32, balanço 0,06 m |

### Âncoras (`ancoras.ts`)

- `santa`: (-0,30; 0; -2,85), o centro da poltrona no piso; yaw 0,68 (o mesmo giro da poltrona).
- `delivery`: (1,04; 0; -2,08), 1,55 m do centro da poltrona na direção 1,05 rad: à frente e à direita do
  trono; o visitante fica de perfil para a câmera, de frente para o Noel, sem tapá-lo. yaw ≈ -2,09.
- `reveal`: (0,37; 2,85; -2,46), acima e entre os dois, contra o vão azul da janela.
- `queuePath`: entra por baixo da tela e serpenteia em três fileiras atravessadas à câmera (a 2,7, 3,8 e 4,9 m
  da entrega na direção da câmera), chegando à entrega pela direita. 15,6 m de caminho; espaço 1,05 m e
  folga da frente 1,35 m: as 12 pessoas cabem com os pés entre y 1400 e 1760 e as cabeças entre 1120 e 1360
  (x de 180 a 960). Conferido na cena `vila` (fotos `c37-vila.png` e `final-vila.png`): ninguém atravessa
  móvel; a fila passa a 0,6 m da cadeira de balanço e longe da lareira e da árvore.
- `exitPath`: da entrega para a direita, por trás da primeira fileira (sem cruzá-la), a 0,8 m da árvore, e sai pela borda direita.

### O assento do Noel (`ASSENTO_DO_NOEL`, exportado em `ancoras.ts`)

Medido no GLB da ArmChair_01 (perfil do assento no meio da poltrona) e multiplicado pela escala 1,5:

| Medida | Valor |
| --- | --- |
| Altura do tampo do assento | 0,75 m |
| Profundidade útil (borda da frente ao encosto) | 0,975 m |
| Largura livre entre os braços | 0,93 m |
| Altura do topo dos braços | 0,99 m |
| Altura do topo do encosto | 1,60 m |
| Quadril do Noel sentado (mundo) | (-0,41; 0,78; -2,99): um terço do assento a partir do encosto, 3 cm acima da almofada |
| Giro | 0,68 rad (o de `santa.yaw`) |

O modelo sentado do Noel vai com a raiz em `santa.position`, girado de `santa.yaw`, e o quadril em
`ASSENTO_DO_NOEL.quadril`. Com a silhueta de 2,2 m em pé (`final-fantasmas.png`), a poltrona e o espaço em volta
comportam um Noel grande: a cápsula cobre a poltrona e não encosta na lareira nem na árvore.

## Como a luz foi construída (tudo em `ajustes.ts`)

1. **Fogo (principal, com sombra).** `lareira.luz` do kit com castShadow, multiplicada por `LAREIRA.ganhoLuz`
   (2,3) e com o alvo puxado para o lado da câmera e para baixo (`LAREIRA.alvoLuz`): o cone âmbar atravessa o
   piso diante do trono e faz o reflexo comprido no assoalho encerado. `LAREIRA.forca` 1,4 (fogo e luz).
2. **Luar com sombra pela janela.** Spot estreito e distante (raios quase paralelos), mapa 2048, só no cone que
   passa pelo vão; direção tirada de onde a câmera vê a lua pela janela (`vista.ts`), elevação 33°. Cor e força
   copiadas de `exterior.luzExterna` a cada quadro, vezes `LUZ.luar.ganho` (0,22): desenha o recorte da janela
   com as travessas no tapete e no piso, com a sombra comprida do trono. A parede e o caixilho só projetam
   sombra nos quadros em que o mapa do luar é refeito (um a cada 6). Na noite mágica a mancha fica verde-água.
3. **Árvore**: a PointLight da peça (força 1,0) e as luzinhas.
4. **Acentos**: lanterna acesa ao lado do trono (pontual curta, `LUZ.lampiao`), velas do castiçal (emissivas),
   poça quente do lugar do Noel (spot do alto, `LUZ.noel`, força 15) e o destaque da entrega (`LUZ.entrega`, só
   aceso com setDeliveryActive; apagado ele sai da conta de luzes).
5. **Preenchimento**: hemisférica quente (céu `#ffb47a`, chão `#7a3c1c`, 0,3) e um clarão quente no alto
   (`LUZ.rebatida`) que devolve às vigas o que o piso rebate: sombras marrom-avermelhadas, nunca pretas.
6. **Luz pintada no reboco** (`MATERIAL.rebocoLuz`, `materiais.ts`): a parede escurece para o alto e para longe
   da lareira, em coordenadas do mundo (degradê quente da referência; a parede deixou de ser iluminada por igual).
7. **Reflexos da própria sala**: `PMREMGenerator.fromScene` da sala montada com o fogo aceso (`ambiente.ts`,
   `AMBIENTE`), entregue em `VillageSet.environment` e em `arvore.setEnvMap`.
8. **Look**: ACES, exposição 1,12, environmentIntensity 0,9, AO raio 0,5, bloom 0,2 / limiar 1,0, vinheta 0,36
   marrom, warmth 0,16, grão 0,1.

Luzes: 10 no total (3 da lareira, 1 da árvore, luar, hemisférica, lanterna, clarão, poça do Noel, entrega),
9 enquanto a entrega está apagada. Sombras: alta 2 (fogo e luar), média 1 (fogo; o luar vira poça pintada em
textura), baixa 0.

## Efeitos (setAmbient)

- `TREE_SPARKLE` → `arvore.setCintilar` (lampejo da estrela e ondas nas luzinhas; lê na miniatura).
- `FIREPLACE_MAGIC` → `lareira.setMagia` **e**, da composição, `magia.ts`: poeira dourada subindo da soleira
  diante do peito da chaminé (160 grãos, um Points sem estado) e o fogo 40 % mais forte (`MAGIA`). A magia da
  peça sozinha não lia nesta câmera (a boca é vista de lado).
- `SLEIGH_PASS` → `exterior.setTreno`: o trenó cruza o disco da lua dentro do arco da janela entre progress ≈ 0,3
  e 0,6 (passa sobre a lua por volta de 0,4; em 0,5 está logo à direita dela; em 0,7 só o rastro na borda).
- `MAGICAL_NIGHT` → `exterior.setNoiteMagica`; o luar e a neve da janela acompanham `luzExterna` (verde-água).

## Arquivos

`ajustes.ts` (todos os números), `index.ts` (montagem e contrato), `arquitetura.ts`, `geo.ts`, `materiais.ts`,
`moveis.ts`, `luzes.ts`, `ambiente.ts`, `ancoras.ts` (âncoras e ASSENTO_DO_NOEL), `vista.ts` (o que a janela
mostra), `neve.ts` (flocos grandes atrás do vidro), `magia.ts` (reforço da FIREPLACE_MAGIC), `pecas.ts`
(carregamento tolerante das peças do kit).

## Recursos usados e peso

Da sala (Poly Haven, CC0, já no acervo): texturas `dark_wooden_planks` (2k, piso), `painted_plaster_wall`,
`old_planks_02`, `wood_trunk_wall`, `weathered_brown_planks`, `dark_wood`, `pine_bark`; modelos `ArmChair_01`,
`wooden_lantern_01`, `wooden_bucket_02`, `mantel_clock_01`, `brass_candleholders`, `Rockingchair_01`:
**6,05 MB**. Das peças do kit (lareira, árvore, exterior, janela e tecidos): **7,34 MB**. Total ≈ **13,4 MB**
(limite 40 MB), maior arquivo 2k do piso. Nada novo baixado. Saíram da sala: `side_table_tall_01` e
`vintage_oil_lamp` (continuam no acervo).

## Números (lab, 1080x1920)

| Nível | Chamadas | Triângulos (todas as passadas) | Sombras |
| --- | --- | --- | --- |
| alta | 167 (169 com trenó ou magia) | 853–886 mil | 2 |
| média | 109 | 516 mil | 1 |
| baixa | 91 | 409 mil | 0 |

A árvore deixou de projetar sombra (o fogo a pega de frente e a sombra cairia fora do quadro): isso tirou uns
130 mil triângulos da passada de sombra. Desenho por software do laboratório: cerca de 13 s por quadro em meia
resolução com a máquina carregada (só serve para comparar). Fotos finais sem erro de console. Na cena `vila` (sala + Noel provisório sentado + 12 bonecos): 657 chamadas, 1,82 milhão de triângulos, em meia resolução.

## Fotos

`final.png` (+ `final-mini.png`), `final-guias.png`, `final-fantasmas.png`, `final-t2.png`, `final-t14.png`,
`final-media.png`, `final-baixa.png`, `final-efeito-*.png` (quatro efeitos), `final-perto-lareira.png`,
`final-perto-janela.png`, `final-perto-arvore.png`, `final-perto-lugar-do-noel.png`, `final-vila.png` (fila).
Ciclos de trabalho: `c20` a `c44`. Obs.: `--guias` não desenhou as zonas em nenhuma foto desta pasta (a camada do laboratório não aparece); as zonas foram conferidas por projeção numérica dos pontos (fogo y≈1150, janela 380–1030, árvore 550–1300, trono 950–1300, fila 1120–1760).

## O que ficou fraco

- O fogo é visto de lado e fica pequeno no quadro; a lareira lê pela pedra e pelo reflexo no piso, menos pelas
  chamas. Uma câmera mais à direita mostraria mais a boca, mas empurraria a árvore para fora.
- O forro e as vigas no alto quase não aparecem (ficam escuros; é a faixa da barra do TikTok e do letreiro).
- A parede à direita, acima da árvore, é uma área lisa e escura.
- Com a fila de 12 bonecos de 1,2 m, as cabeças da fileira da frente tapam a soleira da lareira e os pés do trono:
  com a câmera a 3,5 m não há como evitar sobreposição numa fila tão grande.
- O vidro reflete o fogo num ponto quente logo atrás do encosto do trono (aliviado com rugosidade 0,2 no vidro);
  com o Noel sentado ele some atrás dos ombros.
- A sombra do luar no piso é forte e fria; na média vira poça pintada mais fraca.
- No nível baixo o fogo e o assoalho ficam mais apagados (sem brilho de palco).

## Pedidos ao kit

Veja o relatório do trabalho (campo pedidosAoKit); resumo: janela com largura mínima de 2,6 m; magia da lareira
pouco visível com a boca de lado; vidro com reflexo especular forte do fogo; reflexo do fogo controlável.
