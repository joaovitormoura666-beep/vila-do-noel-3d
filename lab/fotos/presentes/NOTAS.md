# Presentes 3D: notas

Os 12 presentes definitivos e a caixa de presente, no padrão da sala e do Noel. Tudo é modelado por
código (superfícies paramétricas), com materiais compartilhados e texturas feitas no próprio navegador.
Nenhum arquivo novo foi baixado.

## Fotos desta pasta

| Arquivo | O que mostra |
| --- | --- |
Fotos refeitas na 2ª rodada (16/11/2026, por volta de 05:00 UTC):

| Arquivo | O que mostra |
| --- | --- |
| `folha-12.png` (+ `folha-12-mini.png`) | os 12 lado a lado no estúdio, em `alta`, 1080x1920 e a miniatura de celular 270x480, já com a `escalaVisual` (bengala, pinheirinho e meia maiores) |
| `folha-12-baixa.png` | os 12 em `baixa` (rascunho 540x960), para comparar |
| `close-globo.png`, `close-ursinho.png`, `close-trenzinho.png` | três de perto (globo com a calota cheia de neve e a borda do vidro reforçada; pelúcia em cascas; madeira pintada com latão) |
| `close-sino-de-baixo.png` | o sino visto de baixo, como na revelação: a boca agora é bronze escuro, sem "lâmpada" |
| `caixa-fechada-e-aberta.png` | a caixa nova (papel vermelho, fita dourado-creme) fechada e aberta por `abrir(1)`, com a estrela saindo |
| `caixa-abertura.png` | a mesma caixa em `abrir(0)`, `abrir(0.25)`, `abrir(0.5)` e `abrir(1)`: a tampa bascula na borda de trás e não se separa |
| `celular-revelacao.png` (+ `-mini.png`) | a sala A no momento da revelação (globo de neve), como aparece no celular |
| `jogo-caixa-vermelha.png` (+ `-mini.png`) | o jogo 3D (`jogo3d.html?obs&manual=1&fila=13&visiveis=12`, t = 7,45 s) com a caixa nova diante da árvore. **A tampa ainda voa: o movimento dela é do jogo** (veja "O que o jogo precisa fazer") |

Como refazer (laboratório ligado em `http://127.0.0.1:5180`):

```
node tools/shot.cjs sala --param set=kit-presentes --mini --timeout 250 --out lab/fotos/presentes/folha-12.png
node tools/shot.cjs sala --param set=kit-presentes --param mostrar=um --param presente=ursinho --out lab/fotos/presentes/close-ursinho.png
node tools/shot.cjs sala --param set=kit-presentes --param mostrar=um --param presente=sino --param olho=0,0.95,1.5,0,1.32,0,30 --out lab/fotos/presentes/close-sino-de-baixo.png
node tools/shot.cjs sala --param set=kit-presentes --param mostrar=caixa --out lab/fotos/presentes/caixa-fechada-e-aberta.png
node tools/shot.cjs sala --param set=kit-presentes --param mostrar=abertura --out lab/fotos/presentes/caixa-abertura.png
node tools/shot.cjs vila --param set=a --estado revelacao --param presente=globo --mini --timeout 280 --out lab/fotos/presentes/celular-revelacao.png
node tools/shot.cjs jogo3d.html --param obs --param manual=1 --param fila=13 --param visiveis=12 --t 7.45 --mini --timeout 280 --out lab/fotos/presentes/jogo-caixa-vermelha.png
```

`--param medir=1` faz o estúdio escrever no console (e o `shot.cjs` mostrar) os triângulos e as
chamadas de desenho de cada presente. `--param mostrar=varios --param presente=sino,bola,globo` mostra
alguns juntos; `giro`, `girar=1`, `escala`, `abrir` e `rotulos=0` estão no cabeçalho do estúdio.

## 2ª rodada: o que mudou (crítica do jogo montado, 16/11/2026)

Da mais grave para a mais leve. O que foi elogiado (a revelação contra a janela, os 12 lendo bem) ficou
como estava.

1. **Caixa (grave: a abertura não se lia).**
   - Papel **vermelho #B62835** com as mesmas estrelinhas douradas, pontinhos de neve e treliça (um véu
     diagonal mais escuro tira o chapado). Fita e laço em **cetim dourado-creme** (tecido, não metal: não
     estoura). Na sala, ela destaca da árvore verde (`jogo-caixa-vermelha.png`).
   - **Forro de cetim creme por dentro do corpo**: aberta, a boca da caixa fica clara e lê no celular. O
     lado de dentro da tampa é o papel na sombra, para servir de fundo escuro ao presente que sobe.
   - **`root.userData.abrir(f)`**: abertura em dobradiça na borda de trás, pronta para o jogo. A tampa
     solta do encaixe (até 7 cm, mais um pulinho de 4 cm: no máximo 0,11 m), gira até -1,9 rad em x em
     volta da borda de trás, com mola (passa uns 8% e volta), e fica presa à caixa. Sem alocação.
     Ajustes em `TAMPA_ABRE` (`presentes/index.ts`). `root.userData.inicioFaiscas = 0,3` e
     `root.userData.boca` (centro da boca, espaço de `root`) ajudam a soltar as faíscas na hora certa.
   - Defeitos achados nas fotos e corrigidos: as pontas do laço atravessavam o tampo e apareciam por
     dentro da tampa aberta (agora deitam sobre o tampo); uma fileira de ligação do perfil cruzava o
     tampo de dentro (brigava em profundidade); as cascas de dentro tinham as normais para fora.
2. **Globo (importante: "ilha flutuante").** A calota de baixo da redoma agora é **cheia de neve**:
   uma parede de neve leitosa (#cfd8e6, mais escura embaixo, com um tico de brilho próprio que imita
   luz atravessando a neve) desce colada no vidro, do monte até o tampo da base. O **Fresnel do vidro**
   ficou ~40% mais forte e um pouco mais largo (`pow 2,6`, `0,78`), e o contorno da esfera aparece.
3. **Sino (importante: boca acendendo como lâmpada).** Por dentro: **bronze sombreado** (cor 0,36 a
   0,10 do latão, mais escura que antes em ~35% ou mais), áspero (0,9) e só meio metálico, porque o
   reflexo de ambiente não sabe que ali é uma cavidade. Badalo de ferro escurecido. Por fora, a saia de
   baixo ficou um pouco mais escura e mais fosca (o realce da luz de frente se espalha). E
   `root.userData.fatorHalo = 0,5` (estrela 0,7) para o jogo reduzir o halo atrás dos metais: o halo do
   jogo fica a 0,25 m atrás do centro, isto é, **dentro** do sino, e aparece pela boca.
4. **Peso visual dos finos (detalhe).** `root.userData.escalaVisual`: bengala 1,25, pinheirinho 1,2,
   meia 1,15 (os outros 1). Tabela em `ESCALA_VISUAL` (`presentes/index.ts`). O ajuste ao cubo de 1 m
   continua igual (o contrato não muda); o jogo multiplica a escala da revelação e da mão por este número.
   A folha do estúdio já mostra assim (`visual=0` desliga).
5. **Animação própria no jogo (importante, mas do lado do jogo).** O catálogo já entrega
   `userData.update(dt, t)` em todos; quem precisa chamar é o jogo (abaixo).

### O que o jogo precisa fazer (arquivos que não são meus: `src/jogo3d/`)

- `Entrega3D.posicionarObjetos`: trocar as três linhas da tampa (`lid.position.y = tampaY + tampa*0,55`
  etc.) por `(caixa.root.userData.abrir as ((f: number) => void) | undefined)?.(q.caixa.tampa)`.
  Soltar as faíscas quando `q.caixa.tampa >= caixa.root.userData.inicioFaiscas`, a partir da boca
  (`root.userData.boca`, levada para o mundo com `localToWorld`), e subir `PointsMaterial.size` para 0,11.
- `config.ts`: a crítica pede `PRESENTE.caixa.altura` 1,45, `paraCamera` 0,55 e `escalaCaixa` 1,2 (a
  caixa na frente da parte de baixo da janela). Com o papel vermelho, o contraste já resolve contra a
  árvore; o tamanho continua pequeno no celular.
- Halo: `opacidade * (presente.userData.fatorHalo ?? 1)`.
- Escala: `PRESENTE.escalaRevelacao` e `escalaNaMao` vezes `(presente.userData.escalaVisual ?? 1)`.
- `Entrega3D.update` (enquanto o presente estiver visível) e `Caminhante.update` (enquanto houver
  `this.presente`): chamar `presente.userData.update?.(dt, t)` com o `t` do jogo. Sem isso o sino não
  balança, as rodas não giram, o globo não neva e o vapor não sobe.

## O que foi feito (1ª rodada)

- **Malha por superfícies** (`presentes/malha.ts`): cada peça é uma superfície P(u, v) (torno, tubo ao
  longo de curva, elipsoide deformado, superelipsoide) acumulada num `Molde` por material, com normais
  por diferenças finitas, cor por vértice e um atributo `acab` (metal, aspereza, verniz, brilho próprio)
  por vértice. Assim o latão, a laca e o esmalte de um presente saem numa chamada de desenho só.
- **Materiais compartilhados** (`presentes/materiais.ts`): um `MeshPhysicalMaterial` remendado no
  shader lê o `acab`. Pelúcia em cascas (a mesma técnica do pelo do Noel, com a textura CC0
  `curly_teddy_natural`), vidro com Fresnel falso (sem passe de transmissão), neve com a normal de
  `snow_02`, folhagem com o atlas de ramos de abeto da árvore da sala, flocos num único `Points`, vapor
  num shader próprio.
- **Texturas no navegador** (`presentes/texturas.ts`): normais de metal escovado, esmalte, madeira,
  tricô, cetim, massa, neve e feltro; desenhos da bola, da caneca, da bengala, da meia (tricô ponto a
  ponto, com faixa jacquard) e o papel da caixa (verde, estrelinhas douradas de quatro pontas, pontinhos
  de neve e treliça dourada fina). Paleta do projeto, arte original.
- **Os 12**: estrela de latão escovado com laço de cetim; bola de vidro laqueada pintada à mão com
  trança dourada; bengala listrada com azevinho; boneco de neve com gorro e cachecol de tricô; ursinho
  de pelúcia caramelo com laço; sino dourado com badalo que balança; meia de tricô com punho de
  pelúcia e guizo; biscoito de gengibre com glacê e balas; globo de neve com casinha iluminada e neve
  caindo; pinheirinho no vaso esmaltado com bolinhas e estrela; caneca de chocolate com chantili,
  canela e vapor; trenzinho de madeira pintada com rodas e bielas que giram.
- **Caixa** (`presentes/caixa.ts`): papel original com cantos arredondados e dobras, fita de cetim
  plana em cruz, laço duplo volumoso, sem tubos dourados. Por dentro é escura (aberta lê como caixa).
- **Estúdio** `src/world/set-kit-presentes/`: luz parecida com a da sala A, folha 3x4, um presente,
  vários, caixa fechada e aberta, e a medição.
- `tools/shot.cjs` ganhou `--timeout <segundos>` (opcional; o uso antigo não mudou).
- Ajustes desta última rodada: pinheirinho mais cheio (10 andares, mais ramos por andar), estrela do
  pinheirinho em latão mais escuro (não estoura mais), vidros da cabine do trem foscos e calotas e
  bielas em latão fosco (antes espelhavam o foco e estouravam no brilho), enquadramento da foto da
  caixa, e cortes de subdivisão para todos ficarem abaixo de 8 mil triângulos.

## Decisões de contrato (todas opcionais e compatíveis)

- `createGift(id)` devolve um `Group` centrado na origem, ajustado para caber num cubo de 1 m (a maior
  medida vira 0,92 m). Id desconhecido cai na estrela.
- `root.userData.update(dt, t)`: animação própria (sino balança, trem roda, globo neva, vapor sobe).
  Sem alocação por quadro. `root.userData.dispose()`: tira a cópia da cena e libera só o que é dela
  (flocos, vapor, `InstancedMesh`). **Geometrias e materiais são compartilhados entre cópias: não os
  descarte.** Quem libera tudo é o `dispose()` do catálogo.
- `createGiftBox()`: caixa de ~42 cm de lado, corpo de 30 cm, ~46 cm com o laço. **O pivô da tampa é o
  centro do topo do corpo** (`lid.userData.pivo = 'centro-de-cima'`); `lid.userData.bordaDeTras` dá a
  borda de trás (agora a de fora da tampa, z = -0,217). `root.userData.tamanho = { lado, alturaCorpo,
  alturaTotal }`. **Novo (2ª rodada, opcional):** `root.userData.abrir(f)`, `inicioFaiscas`, `boca`.
- **Novo (2ª rodada, opcional)** em cada presente: `userData.escalaVisual` e `userData.fatorHalo`.
  Os comentários de `contracts.ts` (`GiftBox` e `Cast.createGift`) citam os dois e o `abrir`; os tipos
  não mudaram.
- `setQuality(nivel)` troca a geometria das cópias vivas e reduz as cascas da pelúcia; os extras
  (flocos, vapor) seguem o nível na próxima cópia.
- Comentários de `src/world/contracts.ts` atualizados com isso (sem mudar tipos).

## Números

Triângulos e chamadas de desenho por presente (`medir=1` e contagem das malhas). A coluna `alta` foi
medida de novo em 16/11/2026 por volta de 04:55 UTC, e média e baixa por volta de 05:10 UTC (só o globo
mudou: a parede de neve soma 480 triângulos em alta):

| Presente | alta | média | baixa | chamadas |
| --- | ---: | ---: | ---: | ---: |
| estrela | 6.312 | 2.976 | 1.860 | 2 |
| bola | 7.984 | 4.640 | 3.384 | 2 |
| bengala | 6.280 | 3.710 | 2.960 | 3 |
| boneco | 7.996 | 5.042 | 4.144 | 3 |
| ursinho (4/3/2 cascas) | 7.956 | 3.976 | 3.048 | 3 |
| sino | 7.840 | 4.366 | 3.300 | 4 |
| meia | 6.664 | 3.268 | 1.924 | 4 |
| biscoito | 7.216 | 3.936 | 2.664 | 2 |
| globo (+ flocos 140/80/40 pontos) | 7.408 | 3.948 | 2.560 | 3 (+1 pontos) |
| pinheirinho | 6.004 | 3.108 | 2.372 | 2 |
| chocolate (+ vapor, não em baixa) | 6.656 | 3.360 | 2.192 | 2 |
| trenzinho (rodas e bielas instanciadas) | 7.964 | 5.978 | 5.452 | 3 |

- Os 12 juntos no estúdio, em `alta`: 152 chamadas e ~314 mil triângulos (com o estúdio e as sombras);
  em `baixa`: 47 chamadas e ~36 mil triângulos.
- Caixa fechada + aberta + estrela no estúdio: 65 chamadas, ~158 mil triângulos (com o estúdio; 2ª
  rodada, 16/11 por volta de 04:40 UTC). A caixa continua com 4 malhas: o forro entrou na malha do cetim.
- Sala A na revelação do globo (lab, 2ª rodada): 377 chamadas, ~1,44 milhão de triângulos.
- Sala A na revelação (Noel, 13 gnomos, presente): 380 chamadas, ~1,42 milhão de triângulos, sem erros
  de console.
- A geometria de cada presente é montada uma vez por nível (cache) e as cópias a reaproveitam.

## Peso dos arquivos

- Código novo: `src/world/cast/presentes/` com 19 arquivos, ~171 KB de TypeScript (antes de compactar);
  `gifts.ts` 1 KB; estúdio 8 KB.
- Recursos reaproveitados, sem download novo: `curly_teddy_natural` (diff 139 KB + nor 95 KB),
  `snow_02` (normal), atlas de ramos `assets/arvore/ramo_cor.webp` (656 KB) e `ramo_normal.webp`
  (491 KB), já usados na sala. O resto das texturas é gerado no navegador (canvas), em 256 a 512 px.

## Pontos fracos (o que eu mudaria)

- **2ª rodada:** o que mais pesa na nota (a tampa voando longe, a caixa pequena, o presente parado no
  jogo, o halo dentro do sino) depende de mudanças em `src/jogo3d/`, que não são minhas: a arte já
  oferece `abrir`, `escalaVisual`, `fatorHalo` e `update`, mas só vale quando o jogo usar (lista acima).
- No estúdio, a face da caixa que olha para a luz quente fica quase pêssego (a luz do estúdio é mais dura
  que a da sala); na sala o vermelho fica no ponto.
- O forro de cetim reflete um pouco do azul da janela no fundo da caixa aberta; lê como cetim, mas se a
  direção preferir um forro fosco, a troca custa uma chamada de desenho a mais por grupo (feltro).
- O sino ainda tem um realce largo e quente na frente sob a luz da entrega; não estoura mais, mas é o
  presente mais brilhante dos 12 (é latão).
- Os testes de `tests/jogo3d.test.ts` (etiquetas de nome) estavam falhando nesta hora por causa do
  trabalho em andamento em `src/jogo3d/CamadaNomes.ts`; nada a ver com os presentes.

- O estúdio tem a luz mais dura que a sala A; alguns realces (ponta da estrela, calota do sino) ainda
  ficam fortes nele, enquanto na sala ficam no ponto.
- O ursinho tem a silhueta um pouco facetada de perto (pés e orelhas) e o pelo lê mais como felpa curta
  do que como pelúcia longa. Precisaria de mais subdivisão no corpo ou de um contorno extra de pelo.
- Na revelação dentro da sala, o tamanho e o lugar do presente vêm do jogo, não da arte: na miniatura
  de celular o ursinho fica pequeno. Vale a direção criativa decidir uma escala maior na revelação.
- O ajuste ao cubo usa a maior medida: presentes finos (bengala, meia) ficam visualmente menores que os
  redondos. Uma escala por presente (tabela) resolveria.
- O vapor do chocolate passa um pouco do cubo de 1 m (documentado em `chocolate.ts`).
- `setQuality` não refaz os extras (flocos, vapor) das cópias já criadas; só as próximas mudam.
- A medição (`catalogo.medir`) monta uma cópia temporária; serve só para o laboratório.
- A bengala é fina para a miniatura de celular; lê pela forma e pelas listras, mas some um pouco.
