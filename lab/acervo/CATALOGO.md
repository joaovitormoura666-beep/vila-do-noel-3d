# Acervo da sala do Noel: catálogo

Móveis, objetos e materiais de arquitetura escolhidos para a sala. Tudo vem do Poly Haven (CC0),
baixado com `tools/polyhaven.mjs`, e está creditado em `public/assets/CREDITOS.md`.
Este catálogo não monta cenário: ele diz o que existe, quanto mede, quanto pesa e como se comporta
sob a luz da lareira, para quem for montar a sala.

- Modelos mantidos por mim: 31 arquivos, 11.077 kB. Texturas mantidas por mim: 10 pastas, 5.043 kB.
- Total do acervo novo: 16.120 kB (15,7 MB; teto combinado: 28 MB). Maior arquivo: `vintage_cabinet_01.glb`, 1.098 kB (teto: 3 MB).
- Conjunto recomendado (seção 3): 9.400 kB, dos quais 698 kB já estavam no projeto.
- Foram baixados e fotografados 86 modelos e 34 texturas, em 7 rodadas de modelos e 7 de texturas; ficaram 31 e 10.

Todas as medidas são do GLB como ele está no disco, em metros, na ordem L x A x P (largura em X,
altura em Y, profundidade em Z), tiradas pelo estúdio (linhas `[acervo]` do console).
Os pesos são do arquivo no disco, em kB de 1.024 bytes.

## 0. Como conferir (estúdio de amostras)

O estúdio fica em `src/world/set-kit-acervo/index.ts` e abre pelo laboratório com `set=kit-acervo`.
Luz de conferência: um refletor âmbar (`#ffb060`, com sombra) no papel da lareira, um preenchimento
azul fraco no papel da janela e um hemisfério; `luz=neutra` troca por luz branca difusa.

```
# prateleira de modelos (até 8 por foto), com etiqueta de medida e triângulos
node tools/shot.cjs sala --param set=kit-acervo --param modelos=ArmChair_01,Ottoman_01 --out lab/acervo/x.png
# painéis verticais de 1,5 m, luz rasante, repetição certa pelo ladrilho real
node tools/shot.cjs sala --param set=kit-acervo --param texturas=dark_wooden_planks,painted_plaster_wall --out lab/acervo/x.png
# amostras de piso deitadas (3 x 2,4 m) vistas contra a luz: mostra o brilho da cera
node tools/shot.cjs sala --param set=kit-acervo --param pisos=dark_wooden_planks,wood_floor_worn --param rug=0.6 --out lab/acervo/x.png
```

Parâmetros: `colunas`, `yaw` (radianos), `rasante` (graus), `luz=neutra`, `cor=hex` (multiplica a cor
das texturas), `rug=0.6` (multiplica a rugosidade), `semarm=a,b` (texturas sem mapa arm), `res=2k`
(pasta `<id>_2k`), `olho=x,y,z,ax,ay,az,fov` (câmera manual), `vidro=0.14` (troca os vidros por vidro
claro), `ocultar=glass` (esconde malhas pelo nome do material), `tinta=id:hex` (multiplica a cor de um modelo).
O módulo exporta `LADRILHOS` (lado real do ladrilho de cada textura, em metros) e `buildVillageSet`.

`lab/acervo/ferramentas/simplificar.mjs` reduz um GLB já baixado com tolerância maior que a do
baixador: `node lab/acervo/ferramentas/simplificar.mjs <id> --tri 5000 [--erro 0.08] [--tex 512] [--saida nome]`.

## 1. Modelos mantidos

Caminho de todos: `public/assets/modelos/<id>.glb` (URL no jogo: `assets/modelos/<id>.glb`, via `loadModel`).
A base de cada modelo fica em y = 0 e o centro em x = z = 0, salvo quando a tabela diz outra coisa.

### Assentos e mesas — fotos `final-a-assentos-mesas-fogo.png`, `r1-assentos-fogo.png`, `r1-assentos-dia.png`, `r3-mesas-fogo.png`, `r3-mesas-neutra.png`, `final-visualizador-noite.png`

| id | L x A x P (m) | triângulos | kB | uso na sala | observações |
| --- | --- | --- | --- | --- | --- |
| `ArmChair_01` (já existia) | 0,85 x 1,07 x 0,77 | 5.626 | 585 | poltrona do Noel | Assento a 0,50 m. Na escala real é pequena para um Noel de 2,2 m: usar escala 1,5 a 1,6 (1,27 a 1,36 m de largura, assento a 0,75–0,80 m). Estofado cru com laterais azul-acinzentadas e moldura escura entalhada; o tecido claro recebe bem o âmbar do fogo. |
| `GreenChair_01` | 0,67 x 1,06 x 0,66 | 4.213 | 373 | segunda poltrona (visitante) | Tecido verde-oliva e moldura entalhada, assento a 0,46 m; na escala real serve ao visitante de 1,2 m. Alternativa, fora do conjunto recomendado. |
| `Rockingchair_01` | 0,71 x 0,99 x 0,83 | 9.998 | 457 | cadeira de balanço junto à janela | A base está em y = +0,102: descer 0,10 m ao posicionar. Assento a 0,53 m (0,43 depois de descer). Madeira escura com balaústres torneados e encosto de tábua clara. Alternativa. |
| `Ottoman_01` | 0,88 x 0,62 x 0,62 | 4.240 | 435 | descanso de pés diante da poltrona | Pufe de couro escuro com costuras e vincos, que pegam o brilho do fogo. Tampo a 0,62 m: com a poltrona em 1,5 fica abaixo do assento; não ampliar. |
| `painted_wooden_bench` | 1,17 x 0,89 x 0,50 | 630 | 331 | banco-aparador rústico (junto à porta ou sob a janela) | Tampo a 0,66 m com encosto recortado e prateleira baixa a 0,20 m: é mais aparador do que assento. Só 630 triângulos, mas a silhueta e a textura seguram. Aparece na foto `final-b-moveis-grandes-fogo.png`. Alternativa. |
| `painted_wooden_stool` (já existia) | 0,39 x 0,58 x 0,41 | 676 | 113 | banquinho do visitante | Já estava no projeto; fica. |
| `side_table_tall_01` | 0,38 x 0,76 x 0,38 | 6.000 | 266 | mesinha alta ao lado da poltrona | Esguia, de tampo redondo, pernas finas e prateleira baixa, verniz escuro. Com a poltrona em 1,5, usar escala 1,2 (tampo a 0,91 m, 0,46 m de diâmetro): cabe o lampião e pouco mais. |
| `round_wooden_table_01` | 1,40 x 1,01 x 1,40 | 8.640 | 308 | mesa redonda de canto (chá, biscoitos) | Mogno, coluna torneada e pés em garra. Grande e alta na escala real (tampo a 1,00 m): usar escala 0,60 a 0,75 (0,84 a 1,05 m de diâmetro). Alternativa à mesinha. |

### Móveis grandes — fotos `final-b-moveis-grandes-fogo.png`, `r2-armarios-fogo.png`, `r2-armarios-neutra.png`, `r2-zoom-cristaleira-relogio-neutra.png` (cristaleira com 12 mil triângulos, portas tortas), `r2-zoom-cristaleira30k-relogio-semvidro.png`, `r7-retoques-vidro-tinta-fogo.png`, `r4-rusticos-fogo.png`, `r5-diversos-fogo.png`, `r6-zoom-cha-roca-quadro-bau-fogo.png`, `final-visualizador-dia.png`

| id | L x A x P (m) | triângulos | kB | uso na sala | observações |
| --- | --- | --- | --- | --- | --- |
| `wooden_bookshelf_worn` | 1,37 x 2,06 x 0,58 | 10.106 | 787 | estante de livros e brinquedos | A madeira vem cinza-clara: multiplicar a cor por `#9a7858` (testado; vira carvalho quente). Tampo das prateleiras em y = 0,10; 0,40; 0,68; 0,96; 1,28; 1,66; vão útil de 0,25 a 0,37 m, largura interna de cerca de 1,25 m, fundo de 0,50 m. Vem vazia. |
| `vintage_grandfather_clock_01` | 0,63 x 2,19 x 0,43 | 8.582 | 558 | relógio de pé (parede lateral) | O material `vintage_grandfather_clock_01_glass` vem opaco e esconde o mostrador e o pêndulo: trocar por vidro claro ou esconder a malha (receita abaixo). |
| `GothicCommode_01` | 1,20 x 1,21 x 0,58 | 3.897 | 306 | cômoda (apoio de objetos sob quadro) | Madeira castanho-avermelhada, três gavetas com puxadores escuros e arcos ogivais discretos na de cima, sem ar de igreja; tampo a 1,21 m. Alternativa. |
| `vintage_cabinet_01` | 2,02 x 2,24 x 0,67 | 30.002 | 1.098 | cristaleira (parede do fundo) | Precisa de 30 mil triângulos: com 12 mil as portas entortavam. Três malhas; o vidro (`vintage_cabinet_01_glass`) pede a mesma troca. Prateleiras em y = 0,92 (balcão), 1,36 e 1,60. Peça grande e pesada: alternativa à estante, fora do conjunto recomendado. |
| `spinning_wheel_01` | 0,49 x 0,97 x 1,02 | 11.965 | 789 | roca de fiar (canto, peça de caráter) | O eixo comprido está em Z: girar 90° para ver a roda de perfil. Raios finos: manter os 12 mil triângulos. Alternativa. |
| `treasure_chest` | 0,96 x 0,62 x 0,52 | 5.915 | 737 | baú de brinquedos (ao pé da árvore ou da parede) | Tampa abaulada fechada, couro e madeira com cintas e ferragens de metal trabalhado. Foto `final-d-baus-livros-quadros-fogo.png`. |

### Luz, relógio e latão — fotos `final-c-luzes-relogio-fogo.png`, `r3-luminarias-fogo.png`, `r3-lustres-fogo.png`, `r6-velas-neutra.png`, `r4-objetos-fogo.png`

| id | L x A x P (m) | triângulos | kB | uso na sala | observações |
| --- | --- | --- | --- | --- | --- |
| `vintage_oil_lamp` | 0,22 x 0,80 x 0,22 | 5.002 | 199 | lampião na mesinha (segunda fonte de luz quente) | Bojo de porcelana pintada com rosas, base de latão. Três malhas: corpo, `vintage_oil_lamp_glass` (chaminé, vem preta: trocar por vidro claro) e `vintage_oil_lamp_flame` (dar emissivo âmbar e uma luz pontual fraca). |
| `wooden_lantern_01` | 0,22 x 0,53 x 0,23 | 5.018 | 268 | lanterna pendurada na viga ou no chão junto à porta | Caixa de madeira com alça de arame. Material `wooden_lantern_01_glass` escuro: trocar. Base em y = −0,011. Alternativa. |
| `mantel_clock_01` | 0,34 x 0,16 x 0,13 | 4.997 | 196 | relógio sobre o console da lareira | Duas malhas; o vidro (`mantel_clock_01_glass`) já vem translúcido (alfa 0,3). |
| `brass_candleholders` | 1,05 x 0,81 x 0,36 | 7.988 | 754 | castiçais do console da lareira | Três castiçais em um só GLB, lado a lado: nós `brass_candleholder_01` (simples, 449 triângulos), `brass_candleholder_02` (três braços, com velas, cerca de 0,45 m de altura) e `brass_candleholder_03` (cinco braços, 6.119 triângulos, 0,81 m, com chama). Separar pelos nós e usar um ou dois; para a contenção pedida, o de três braços e o simples. Centro do conjunto em x = 0,077. |
| `wooden_candlestick` | 0,10 x 0,22 x 0,10 | 4.999 | 223 | castiçal de madeira (estante, mesinha) | Torneado, com vela derretida. Alternativa aos de latão. |
| `brass_vase_01` | 0,23 x 0,69 x 0,23 | 4.000 | 118 | vaso alto de latão no chão ou na cômoda | O latão depende do mapa de ambiente da sala: sem reflexo quente fica marrom fosco. Alternativa. |

### Guardados, livros e quadros — fotos `final-d-baus-livros-quadros-fogo.png`, `r4-cestos-baus-fogo.png`, `r4-quadros-fogo.png`, `r5-lenha-fogo.png`, `r5-diversos-fogo.png`, `r6-duvidas-neutra.png`, `r6-livros-comparacao.png`

| id | L x A x P (m) | triângulos | kB | uso na sala | observações |
| --- | --- | --- | --- | --- | --- |
| `wooden_bucket_02` | 0,62 x 0,35 x 0,62 | 6.000 | 506 | tina para a lenha, ao lado da lareira | Aduelas com aros de ferro. Não existe modelo de lenha no Poly Haven: as achas ficam por conta de quem faz a lareira (texturas `pine_bark` e `bark_willow`, que já estão no projeto). |
| `wicker_basket_01` | 0,38 x 0,12 x 0,29 | 5.998 | 500 | bandeja de vime (biscoitos, novelos) | Vime escuro, raso. Com escala 1,6 serve de cesto baixo. Alternativa. |
| `book_encyclopedia_set_01` | 0,55 x 0,24 x 0,16 | 4.998 | 255 | fileiras de livros na estante | Fileira de 20 e poucos volumes de lombada castanho-alaranjada. O pivô está na ponta esquerda (centro em x = 0,256). Usar várias cópias (mesma geometria e material) e variar com giro de 180° e pequenos deslocamentos. Reduzido de 23.150 triângulos e 1.145 kB com `simplificar.mjs`; as letras das lombadas ficam borradas de perto (textura de 512). |
| `fancy_picture_frame_01` | 0,60 x 0,46 x 0,02 | 938 | 131 | quadro de paisagem na parede | Moldura dourada estreita, paisagem a óleo com casa de campo. Pivô no centro (base em y = −0,23). A tela é uma malha separada (`fancy_picture_frame_01_canvas`, 2 triângulos): a pintura pode ser trocada. |
| `fancy_picture_frame_02` | 0,66 x 0,77 x 0,09 | 5.001 | 238 | quadro em pé | Moldura dourada rebuscada, cena de rua a óleo. Pivô no centro (base em y = −0,39); tela em malha separada. A moldura chama atenção: usar no máximo um. Alternativa. |

### Objetos de prateleira — fotos `final-e-objetos-fogo.png`, `r5-louca-vasos-fogo.png`, `r5-objetos2-fogo.png`, `r4-objetos-fogo.png`, `r6-zoom-cha-roca-quadro-bau-fogo.png`

| id | L x A x P (m) | triângulos | kB | uso na sala | observações |
| --- | --- | --- | --- | --- | --- |
| `antique_ceramic_vase_01` | 0,26 x 0,44 x 0,26 | 4.998 | 140 | vaso de porcelana (estante, cômoda) | Porcelana branca com ramagem azul; o branco vira creme sob o fogo e destaca a peça na estante escura. |
| `horse_statue_01` | 0,17 x 0,22 x 0,11 | 3.997 | 206 | cavalinho empinado (enfeite na estante) | Porcelana branca; pequeno, mas o branco o faz ler de longe. |
| `carved_wooden_elephant` | 0,11 x 0,10 x 0,06 | 2.752 | 152 | bichinho entalhado | Pequeno: só aparece em plano próximo. |
| `wooden_bowl_01` | 0,31 x 0,09 x 0,31 | 4.000 | 141 | tigela rústica (nozes, biscoitos) | Madeira escavada à mão, de borda irregular. |
| `carved_wooden_plate` | 0,27 x 0,04 x 0,27 | 2.112 | 101 | prato raso de madeira clara | Borda entalhada; deitado quase não aparece, vale mais apoiado em pé na estante. |
| `jug_01` | 0,28 x 0,21 x 0,17 | 4.000 | 102 | jarra de louça (leite, chocolate) | Louça branca com decalque de flores. |
| `brass_pot_01` | 0,30 x 0,29 x 0,30 | 3.760 | 123 | pote de cobre escuro com tampa, junto à lareira | Mesmo cuidado do latão: precisa do ambiente quente. |
| `tea_set_01` | 0,92 x 0,17 x 0,48 | 12.000 | 278 | jogo de chá sobre a mesa redonda | Porcelana branca com azul: bule, açucareiro, xícaras e pires. Malha única com as peças espalhadas em 0,92 m: só cabe na mesa redonda (ou na cômoda), não na mesinha. |

### Receita para os vidros

Os materiais com `glass` no nome saem escuros ou opacos. Testado no estúdio (`vidro=0.14`, foto `r7-retoques-vidro-tinta-fogo.png`):

```ts
// para cada malha cujo material tem "glass" no nome
mat.map = null; mat.roughnessMap = null; mat.metalnessMap = null;
mat.color.set('#fff2dc'); mat.roughness = 0.08; mat.metalness = 0;
mat.transparent = true; mat.opacity = 0.14; mat.depthWrite = false;
malha.castShadow = false;
```

Vale para `vintage_grandfather_clock_01`, `vintage_oil_lamp`, `wooden_lantern_01` e `vintage_cabinet_01`.
A alternativa mais barata é esconder a malha (`ocultar=glass`, foto `r2-zoom-cristaleira30k-relogio-semvidro.png`).

## 2. Texturas mantidas

Caminho de todas: `public/assets/texturas/<id>/{diff,nor,arm}.jpg` (no jogo: `loadPbr('assets/texturas/<id>', ...)`).
Repetição: `repeat = medida da superfície / ladrilho` (o módulo exporta a tabela `LADRILHOS`).
Fotos gerais: `final-t-texturas-fogo.png` e `final-t-texturas-neutra.png`.

| id | ladrilho real | mapas | kB | onde usar | como reage à luz quente |
| --- | --- | --- | --- | --- | --- |
| `dark_wooden_planks` | 2 x 2 m | diff, nor, arm em **2k** | 1.279 | **piso** (protagonista); também faces de viga | Tábuas largas serradas, 8 a 9 por ladrilho (cerca de 0,23 m cada). Cinza-acastanhado na luz neutra; sob o fogo vira castanho profundo, com as frestas e o veio em relevo. Vem como madeira crua: multiplicar a rugosidade por 0,60 a 0,65 para o brilho de cera contra a luz. Fotos `t1-pisos-paineis.png`, `t1-pisos-paineis-neutra.png`, `t1-pisos-contraluz-a.png`, `t2-pisos-finalistas-contraluz.png`, `t3-piso-1k-perto.png`, `t3-piso-2k-perto.png`, `final-t-pisos-encerados-contraluz.png`. |
| `wood_floor_worn` | 2 x 2 m | diff, nor, arm 1k | 228 | piso alternativo | Pinho cor de mel, tábuas largas (cerca de 9 por ladrilho), brilho liso. Sob o fogo puxa para o laranja-avermelhado: escurecer (cor por volta de `#b9977a`). Fotos `t1-pisos-contraluz-b.png`, `t2-pisos-finalistas-contraluz.png`. |
| `painted_plaster_wall` | 2 x 2 m | diff, nor, arm 1k | 228 | **parede** (parte alta) | Reboco pintado com manchas e marcas de desempenadeira, que a luz rasante revela sem virar ruína. Quase branco de origem; sob o fogo vira rosa-salmão. Tingir de leve para creme: `#e2c49c` foi testado e fica laranja forte demais (foto `final-t-parede-tingida-fogo.png`); a sugestão é um tom mais claro, por volta de `#efe0c6`, que não foi fotografado. Fotos `t4-paredes-fogo.png`, `t4-paredes-neutra.png`. |
| `old_planks_02` | 2 x 2 m | diff, nor, arm 1k | 285 | **lambri** rústico (parte baixa da parede) | Tábuas verticais com friso, 7 por ladrilho (cerca de 0,29 m). Cinza na luz neutra, castanho profundo sob o fogo; o friso desenha linhas de sombra. Fotos `t6-vigas2-fogo.png`, `t6-vigas2-neutra.png`. |
| `wooden_panels` | 2,1 x 2,1 m | diff, nor, arm 1k | 274 | lambri nobre (alternativa) | Almofadas rebaixadas de cerejeira, 2 colunas por 5 fileiras por ladrilho (almofada de cerca de 1,05 x 0,42 m). Sob o fogo fica vermelho-quente e brilhante, mais solene: usar só se a sala pedir ar de biblioteca. Fotos `t4-paredes-fogo.png`. |
| `wood_trunk_wall` | 1,25 x 1,25 m | diff, nor, arm 1k | 265 | **vigas e pilares** | Toras escuras falquejadas, cerca de 7 por ladrilho (0,18 m cada): mapear uma tora por face de viga. Quase preta na sombra, com o lombo aceso pelo fogo; dá a profundidade do teto. Fotos `t5-vigas-forro-fogo.png`, `t5-vigas-forro-neutra.png`. |
| `weathered_brown_planks` | 1,8 x 1,8 m | diff, nor, arm 1k | 446 | **forro** do teto | Tábuas horizontais gastas, cerca de 13 por ladrilho (0,14 m). Manchadas de cinza e ferrugem na luz neutra; sob o fogo ficam castanho-avermelhadas e foscas, sem brilhar. Fotos `t5-vigas-forro-fogo.png`, `t5-vigas-forro-neutra.png`. |
| `brown_leather` | 0,4 x 0,4 m | diff, nor, arm 1k | 593 | couro (assento, almofada, capa de livro grande) | Couro castanho liso, de grão fino: em superfície grande lê como cor chapada (castanho-avermelhado sob o fogo); o grão só aparece de perto e com reflexo. Usar em peças pequenas. Fotos `t7-tecidos-fogo.png`, `t7-tecidos-neutra.png`. |
| `wool_boucle` | 0,31 x 0,39 m | diff, nor, arm 1k | 884 | manta xadrez sobre a poltrona | Xadrez claro (cru, com fios cinza e ocre); sob o fogo vira xadrez salmão e destaca sobre a poltrona. A trama miúda só se lê de perto. Fotos `t7-tecidos-fogo.png`, `t7-tecidos-neutra.png`. |
| `gingham_check` | 0,28 x 0,30 m | diff, nor, arm 1k | 556 | toalha ou almofada xadrez verde | Xadrez miúdo branco e verde; sob o fogo o verde escurece para oliva e o branco vira creme. Usar em uma peça só. Alternativa. |

Texturas que já estavam no projeto e servem à sala (não são minhas; conferidas nas mesmas fotos):
`dark_wood` (2 m, mogno liso: rodapé e guarnições), `clay_plaster` (2 m, reboco de barro com relevo forte, sem
mapa arm: alternativa de parede mais rústica), `wood_floor` (1,7 m, carvalho claro: precisa escurecer),
`rough_wood` (0,5 m, cinza: repete em peças longas), `dark_planks` (2 m, tábuas sobrepostas de fachada),
`velour_velvet` e `knitted_fleece` (tecidos).

## 3. Conjunto recomendado (contido)

Sete móveis, nove objetos, seis materiais. O piso do meio fica livre para o Noel e os visitantes.

| papel | recurso | caminho | medida no disco (m) | como usar | kB |
| --- | --- | --- | --- | --- | --- |
| poltrona do Noel | `ArmChair_01` | `assets/modelos/ArmChair_01.glb` | 0,85 x 1,07 x 0,77 | escala 1,5 (1,27 x 1,60 x 1,15) | 585 |
| descanso de pés | `Ottoman_01` | `assets/modelos/Ottoman_01.glb` | 0,88 x 0,62 x 0,62 | escala 1 | 435 |
| mesinha lateral | `side_table_tall_01` | `assets/modelos/side_table_tall_01.glb` | 0,38 x 0,76 x 0,38 | escala 1,2 (tampo a 0,91) | 266 |
| lampião sobre a mesinha | `vintage_oil_lamp` | `assets/modelos/vintage_oil_lamp.glb` | 0,22 x 0,80 x 0,22 | escala 0,7 a 1; vidro claro; chama emissiva | 199 |
| estante | `wooden_bookshelf_worn` | `assets/modelos/wooden_bookshelf_worn.glb` | 1,37 x 2,06 x 0,58 | cor x `#9a7858` | 787 |
| livros (4 a 6 cópias) | `book_encyclopedia_set_01` | `assets/modelos/book_encyclopedia_set_01.glb` | 0,55 x 0,24 x 0,16 | pivô na ponta esquerda; prateleiras em y 0,96, 1,28 e 1,66 | 255 |
| vaso na estante | `antique_ceramic_vase_01` | `assets/modelos/antique_ceramic_vase_01.glb` | 0,26 x 0,44 x 0,26 | sobre a estante ou na prateleira de 1,66 (vão 0,37: usar escala 0,8) | 140 |
| brinquedo na estante | `horse_statue_01` | `assets/modelos/horse_statue_01.glb` | 0,17 x 0,22 x 0,11 | prateleira à altura do visitante (0,68 ou 0,96) | 206 |
| tigela | `wooden_bowl_01` | `assets/modelos/wooden_bowl_01.glb` | 0,31 x 0,09 x 0,31 | na mesinha ou na estante | 141 |
| relógio de pé | `vintage_grandfather_clock_01` | `assets/modelos/vintage_grandfather_clock_01.glb` | 0,63 x 2,19 x 0,43 | vidro claro ou oculto | 558 |
| relógio do console | `mantel_clock_01` | `assets/modelos/mantel_clock_01.glb` | 0,34 x 0,16 x 0,13 | centro do console da lareira | 196 |
| castiçais do console | `brass_candleholders` | `assets/modelos/brass_candleholders.glb` | 1,05 x 0,81 x 0,36 (os três) | separar os nós; usar `_02` e `_01` | 754 |
| tina da lenha | `wooden_bucket_02` | `assets/modelos/wooden_bucket_02.glb` | 0,62 x 0,35 x 0,62 | ao lado da lareira, com achas feitas pela peça da lareira | 506 |
| baú | `treasure_chest` | `assets/modelos/treasure_chest.glb` | 0,96 x 0,62 x 0,52 | encostado na parede ou perto da árvore | 737 |
| quadro | `fancy_picture_frame_01` | `assets/modelos/fancy_picture_frame_01.glb` | 0,60 x 0,46 x 0,02 | pivô no centro; escala 1,3 a 1,5 em parede grande | 131 |
| banquinho do visitante | `painted_wooden_stool` | `assets/modelos/painted_wooden_stool.glb` | 0,39 x 0,58 x 0,41 | escala 1 | 113 |
| piso | `dark_wooden_planks` (2k) | `assets/texturas/dark_wooden_planks` | ladrilho 2 m | rugosidade x 0,6 a 0,65 | 1.279 |
| parede alta | `painted_plaster_wall` | `assets/texturas/painted_plaster_wall` | ladrilho 2 m | cor x `#efe0c6` | 228 |
| lambri (até 0,9–1,1 m) | `old_planks_02` | `assets/texturas/old_planks_02` | ladrilho 2 m | tábuas na vertical | 285 |
| vigas e pilares | `wood_trunk_wall` | `assets/texturas/wood_trunk_wall` | ladrilho 1,25 m | uma tora (0,18 m) por face | 265 |
| forro | `weathered_brown_planks` | `assets/texturas/weathered_brown_planks` | ladrilho 1,8 m | tábuas atravessadas às vigas | 446 |
| manta da poltrona | `wool_boucle` | `assets/texturas/wool_boucle` | ladrilho 0,31 x 0,39 m (0,35 na tabela `LADRILHOS`) | uma peça só | 884 |

**Peso total do conjunto: 9.400 kB (9,2 MB)** — 6.009 kB de modelos e 3.390 kB de texturas (soma em bytes; as linhas arredondam)
(698 kB, da poltrona e do banquinho, já estavam no projeto). Rodapé e guarnições: `dark_wood`, que já existe.
Geometria: cerca de 84 mil triângulos com uma cópia de cada modelo (cerca de 104 mil com cinco fileiras de livros)
e 27 malhas (cada malha é uma chamada de desenho por passada; as cópias dos livros devem ser instanciadas).

Trocas possíveis sem mudar o peso de forma relevante: a mesa redonda (`round_wooden_table_01`, escala 0,65) com
o jogo de chá no lugar da mesinha; a cômoda (`GothicCommode_01`) no lugar do baú; a roca (`spinning_wheel_01`)
como peça de caráter em um canto; `wooden_lantern_01` pendurada em uma viga. Acrescentar uma de cada vez:
o dono pediu contenção.

## 4. Descartados e por quê

Os arquivos e as linhas de crédito dos descartados foram apagados.

### Modelos

| id | motivo | foto |
| --- | --- | --- |
| `Sofa_01` | bom modelo, mas um sofá de 1,57 m ocuparia o piso livre dos visitantes; a poltrona da mesma família fica | `r1-assentos-fogo.png` |
| `wooden_stool_01` | banquinho de oficina, 626 kB; o `painted_wooden_stool` cumpre o papel com 113 kB | `r4-rusticos-fogo.png` |
| `wooden_stool_02` | banquinho de 27 cm; sem leitura na tela | `r5-lenha-fogo.png` |
| `folding_wooden_stool` | banco dobrável de acampamento | `r5-diversos-fogo.png` |
| `GothicCabinet_01` | portas brancas com rendilhado gótico de igreja; pesado (1,7 x 2,4 m) e solene demais | `r2-armarios-fogo.png` |
| `ClassicConsole_01` | preto laqueado e barroco; some no escuro e destoa da casa de campo | `r2-armarios-fogo.png` |
| `ClassicNightstand_01` | caixa preta aberta; vira uma mancha escura sob a lareira | `r3-mesas-fogo.png` |
| `painted_wooden_cabinet` | armário caiado descascado: mancha clara e fria; a cômoda cumpre o papel com madeira quente | `r5-mesas2-fogo.png` |
| `painted_wooden_nightstand` | pintura azul-acinzentada fria, tampo manchado e só 470 triângulos | `r5-mesas2-fogo.png`, `r6-duvidas-neutra.png` |
| `drawer_cabinet` | estante de ferro e pinho claro: industrial e moderna | `r5-mesas2-fogo.png` |
| `vintage_wooden_drawer_01` | arquivo de escritório com gavetas abertas | `r5-mesas2-fogo.png` |
| `WoodenTable_03` | armário de galpão caiado com tela metálica; cara de oficina | `r3-mesas-fogo.png` |
| `side_table_01` | pinho claro de linhas modernas | `r3-mesas-fogo.png` |
| `small_wooden_table_01` | linhas modernas (anos 60), madeira clara | `r3-mesas-fogo.png` |
| `CoffeeTable_01` | preta laqueada e baixa; ocuparia o piso livre | `r3-mesas-fogo.png` |
| `round_wooden_table_02` | base de chapa e pés de ferro: industrial | `r3-mesas-fogo.png` |
| `coffee_table_round_01` | tampo de mármore branco e ferro: moderna | `r5-mesas2-fogo.png` |
| `gothic_coffee_table` | mesa de centro gótica preta de 1,44 m: pesada e escura | `r5-mesas2-fogo.png` |
| `chinese_tea_table` | mesa de chá chinesa: outro universo visual | `r5-mesas2-fogo.png` |
| `gallinera_table` | caixa ripada escura de estilo filipino; some no escuro | `r5-mesas2-fogo.png` |
| `wooden_table_02` | 196 triângulos: quinas vivas e tampo chapado denunciam a primitiva | `r5-mesas2-neutra.png` |
| `WoodenTable_02` | banqueta escura de 30 cm; sem função na sala | `r5-mesas2-neutra.png` |
| `Chandelier_01`, `Chandelier_02` | lustres de cúpulas de tecido: cara de apartamento, luz elétrica | `r3-lustres-fogo.png` |
| `Chandelier_03` | latão com cristais e lâmpadas de vela: brilho demais (o dono pediu contenção) | `r3-lustres-fogo.png` |
| `chinese_chandelier` | lanterna chinesa com borlas: outro universo visual | `r3-lustres-fogo.png` |
| `lantern_chandelier_01` | lanterna de ferro rebuscada com lâmpada elétrica à mostra | `r3-lustres-fogo.png` |
| `brass_diya_lantern` | lanterna de templo, minúscula, com corrente | `r3-luminarias-fogo.png` |
| `Lantern_01` | lampião de 29 cm: some na tela; `wooden_lantern_01` lê melhor | `r3-luminarias-fogo.png`, `r6-duvidas-neutra.png` |
| `brass_goblets` | taças escuras de ar gótico; quase pretas sob a luz quente | `r5-louca-vasos-fogo.png` |
| `brass_vase_02` | jarro de bico longo, de ar oriental; `brass_vase_01` já cobre o latão | `r5-louca-vasos-fogo.png` |
| `ceramic_vase_01` | vaso branco liso de linhas modernas; sem caráter artesanal | `r4-objetos-fogo.png` |
| `ceramic_vase_02`, `ceramic_vase_03` | vaso branco liso e vaso quadrado moderno, sem caráter | `r5-louca-vasos-fogo.png` |
| `wooden_bowl_02` | cuia pequena, redundante com `wooden_bowl_01` | `r5-objetos2-fogo.png` |
| `pot_enamel_01` | panela esmaltada com estampa de chamas: cozinha, e a estampa parece desenho de brinquedo | `r5-objetos2-fogo.png` |
| `metal_jug` | latão de leite amassado: assunto de curral | `r5-objetos2-fogo.png` |
| `throw_pillows_01` | estampa em zigue-zague moderna e chamativa; 1 MB | `r4-cestos-baus-fogo.png` |
| `Ukulele_01` | instrumento pequeno e moderno; sem leitura na tela | `r5-lenha-fogo.png` |
| `ornate_mirror_01` | espelho depende de reflexo de verdade: sem ele vira uma chapa cinza ou preta | `r4-quadros-fogo.png`, `r6-duvidas-neutra.png` |
| `hanging_picture_frame_02` | moldura branca com miolo preto | `r4-quadros-fogo.png` |
| `standing_picture_frame_02` | moldura branca com miolo preto | `r5-objetos2-fogo.png` |
| `hanging_picture_frame_03` | o vidro sobre a foto gera moiré e a foto antiga não combina | `r4-quadros-fogo.png` |
| `standing_picture_frame_01` | porta-retrato escuro com miolo preto; não se lê | `r4-quadros-fogo.png` |
| `vintage_suitcase` | malas com adesivos de viagem: assunto estranho à sala | `r4-rusticos-fogo.png` |
| `wicker_basket_02` | cesto de bambu claro com tampa, de ar oriental; 704 kB | `r4-cestos-baus-fogo.png`, `r6-duvidas-neutra.png` |
| `wooden_crate_01` | caixa fechada; redundante com o baú | `r4-cestos-baus-fogo.png` |
| `wooden_crate_02` | arca de marinheiro; redundante com o baú | `r5-diversos-fogo.png` |
| `wooden_bucket_01` | balde com alça; redundante com a tina, que serve melhor à lenha | `r4-rusticos-fogo.png` |
| `wine_barrel_01` | barril de adega: assunto de porão | `r5-lenha-fogo.png` |
| `wooden_axe` | machado dentro da sala do Noel: fora do clima acolhedor | `r4-quadros-fogo.png` |
| `tree_stump_01` | toco com monte de terra: objeto de exterior | `r4-rusticos-fogo.png` |
| `dry_branches_medium_01` | gravetos finos; simplificados viram riscos | `r4-rusticos-fogo.png` |
| `dead_quiver_trunk`, `dead_tree_trunk` | troncos de 2 e 3 m: não servem de lenha | `r5-lenha-fogo.png` |
| `decorative_book_set_01` | o Poly Haven não oferece glTF deste modelo (só fbx e usd): não foi baixado | — |

Cada foto de rodada mostra os candidatos lado a lado, com a etiqueta do id; a maioria tem a versão `-neutra` ao lado da `-fogo`.

### Texturas

| id | motivo | foto |
| --- | --- | --- |
| `plank_flooring_02` | pinho amarelo saturado e cheio de nós: laranja estourado sob a lareira | `t1-pisos-paineis.png`, `t1-pisos-contraluz-a.png` |
| `plank_flooring_04` | réguas estreitas e escuras de deck envernizado, não tábuas largas | `t1-pisos-paineis.png`, `t1-pisos-contraluz-a.png` |
| `wooden_floor_02` | tacos curtos e claros, com cara de piso novo | `t1-pisos-paineis.png`, `t1-pisos-contraluz-b.png` |
| `old_wooden_floor_01` | réguas curtas de assoalho de ginásio | `t1-pisos-paineis.png`, `t1-pisos-contraluz-b.png` |
| `old_wood_floor` | ripas estreitas e cinzentas de deck externo | `t1-pisos-paineis.png`, `t1-pisos-contraluz-b.png` |
| `plastered_wall` | claro e uniforme demais; `painted_plaster_wall` tem as manchas que dão vida sob a luz rasante | `t4-paredes-fogo.png` |
| `beige_wall_001` | parede pintada lisa: cor chapada sob a lareira | `t4-paredes-fogo.png` |
| `white_stucco` | branco liso, sem relevo que a luz rasante revele | `t4-paredes-fogo.png` |
| `medieval_wall_01` | crosta muito irregular, de ruína ou caverna | `t4-paredes-fogo.png` |
| `dark_paneled_wood` | almofadas quadradas miúdas (porta entalhada): padrão ocupado demais para parede | `t4-paredes-fogo.png` |
| `medieval_wood` | sarrafos roliços com cravos (paliçada), cinzentos | `t5-vigas-forro-fogo.png` |
| `oak_veneer_01` | folheado claro e limpo: laranja uniforme, cara de móvel novo | `t5-vigas-forro-fogo.png` |
| `roof_planks` | tábuas alaranjadas com frestas pretas; contraste duro | `t5-vigas-forro-fogo.png` |
| `brown_planks_09` | tábuas cruas e claras de galpão | `t5-vigas-forro-fogo.png` |
| `wood_plank_wall` | ripas estreitas envernizadas com ladrilho de 1 m (repete muito) | `t4-paredes-fogo.png`, `t6-vigas2-fogo.png` |
| `stained_pine` | pinho tingido de vermelho; redundante com `dark_wood` | `t6-vigas2-fogo.png` |
| `smoked_walnut_veneer` | folheado claro e liso | `t6-vigas2-fogo.png` |
| `wood_table` | veios alaranjados muito marcados; padrão agitado | `t6-vigas2-fogo.png` |
| `brown_planks_05` | tábuas pintadas de branco (fachada) | `t6-vigas2-fogo.png` |
| `planks_brown_10` | tábuas cruas claras sobrepostas, de galpão | `t6-vigas2-fogo.png` |
| `fabric_leather_02` | couro com costuras a cada 50 cm: a repetição aparece em superfície maior | `t7-tecidos-fogo.png` |
| `rough_linen` | linho azul-claro liso: sem leitura e frio | `t7-tecidos-fogo.png` |
| `quatrefoil_jacquard_fabric` | vermelho saturado cujo desenho some à distância; `velour_velvet` cobre o vermelho | `t7-tecidos-fogo.png` |
| `floral_jacquard` | cinza; o desenho some à distância | `t7-tecidos-fogo.png` |

## 5. Pontos de atenção

- Não achei modelo de lenha cortada no Poly Haven (os troncos testados eram árvores mortas de 2 e 3 m): as achas da tina têm de ser construídas.
- Os quadros trazem pinturas a óleo antigas nas telas; a tela é malha separada e pode receber outra imagem.
- Latão e verniz dependem do mapa de ambiente da sala; no estúdio eles foram vistos com um ambiente quente simples.
- As cores das fotos "fogo" são as do refletor âmbar do estúdio, não as da sala final: o tom exato muda com a luz real.
- Nada foi conferido dentro da sala montada nem com o Noel ao lado: as escalas sugeridas saem das medidas, não de uma foto de conjunto.
