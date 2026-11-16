# Gnomos visitantes: notas (segunda rodada)

`buildVisitors(ctx)` (em `src/world/cast/visitors.ts`) devolve `{ createVisitor(seed), setQuality(level) }`.
Cada semente vira um gnomo natalino original, sempre o mesmo para a mesma semente. A referência
(`lab/referencia-gnomo.png`) serviu só de estilo: volume, escala da cabeça e tipo de material. Não há gorro
azul com túnica laranja, nem alças cruzadas com fivela, nem brincos, nem cara brava.

Esta rodada atacou a crítica (nota 5) do mais grave para o mais leve. Foram 18 ciclos de foto, olhar e
melhorar (`d00` a `d17`). Os `c01` a `c17` e `sala-c*` são da primeira rodada.

## O que mudou, na ordem da crítica

| # | problema | o que foi feito |
|---|---|---|
| 1 | pose de segurar quebrada | IK de dois ossos com alvo no espaço da raiz e polo para trás. As mãos ficam nas laterais do presente, com a palma virada para ele (base montada com `makeBasis`) e os dedos dobrados num osso próprio. O ombro sobe um pouco. O gorro dobra para trás para não atravessar o presente. |
| 2 | gorro como cone rígido | Curvas de controle por forma (mole, pontudo, caído, touca) e raio que incha no meio. Dobras de pano com fbm, rugas de compressão perto da aba, e aba inclinada que "engole" a cabeça. Uma faixa de cabelo sai por baixo. 6 ossos (G0 a G5) com molas em cascata, mais um pêndulo para pompom ou sino. |
| 3 | rosto sonolento ou bravo | Pálpebra de cima mais aberta e erguida, íris maior com reflexo. Sobrancelhas em arco, mais altas no meio. Bochechas cheias com rubor. Boca aberta (osso BOCA) por cima da barba, com lábio de baixo, que abre na alegria e ao segurar. |
| 4 | desempenho (31 chamadas e 53 mil triângulos por gnomo, somando os passes) | 8 materiais viraram 4, e um atributo `tipo` escolhe a variante dentro do shader. A sombra vem de um corpo simplificado separado. As malhas visíveis não projetam sombra, e o AO pula o corpo da sombra. A esfera de recorte é fixa. O detalhe foi reduzido. Na sala A: de 657 para 369 chamadas e de 1,83 M para 1,41 M triângulos. |
| 5 | barba de lascas de madeira | As mechas e os cards viraram um único volume lobado (5 a 7 lobos com sulcos). Tem AO de vértice e pontas mais claras. A barba curta acompanha a esfera da cabeça. |
| 6 | tricô grosso e regular (lia como veludo cotelê) | O suéter e as mangas usam um ponto 0,6x menor. Cada ponto tem altura e tom sorteados, e cada carreira desliza um pouco. Há um normal de detalhe (knitted_fleece, Poly Haven) e o sombreamento do ponto ficou mais suave. |
| 7 | massas escuras na sala | O sheen é tingido pela cor do fio e as cores de gorro são mais claras (verde #2E6B50, azul #2D4A73, vinho #94283A). O avental é de lona clara. |
| 8 | pele laranja de resina | A pele é mais clara e menos saturada. O rubor puxa para o rosa, e a translucidez é por espessura (alfa da cor de vértice: orelhas e nariz). A luz envolvente varia por canal e há sheen rosado. |
| 9 | molas rígidas | Subpassos de 1/120 s e frequência caindo da base para a ponta (2,6 a 1,2 Hz). A ponta pega o chicote da aceleração vertical. Barriga, barba, tranças e cachecol têm mola. |
| 10 | mãos de salsicha | Mão nua com dedos afinando para a ponta. A luva tem polegar em trilho e punho canelado mais longo. Osso de dedos para dobrar. |
| 11 | colete e avental | O colete tem debrum em tubo, botões e UV por comprimento de arco. O avental é de lona, curto e claro, com caimento. |
| 12 | variedade de silhueta | Formas de gorro com peso (mais mole e touca), braços maiores, barrigas mais marcadas (redondo e alto) e vovô mais curvado. |
| 13 | tempo de criação | Alta de cerca de 45 ms para cerca de 30 ms. Média e baixa ficam bem mais baratas (veja os números). |
| 14 | âncoras | `labelAnchor` fica preso à posição da cabeça no mundo, acima do gorro, sem balançar com a ponta. `giftAnchor` fica acima da cabeça, entre as mãos. |

**Mantido, porque foi elogiado:** o sistema de sementes, a paleta, a gnoma com tranças, o jovem ruivo, o
esqueleto e os materiais compartilhados, os shaders ajustados, as molas, os bigodes, as botas de couro e a
silhueta geral.

## Arquivos

| arquivo | o que faz |
|---|---|
| `src/world/cast/visitors.ts` | Cache de geometrias por `semente\|nível` com contagem de uso. Cache do corpo de sombra por semente (não existe no nível baixo). Troca de qualidade nos gnomos vivos. `liberarVisitantes()`. |
| `gnomos/util.ts` | Hash FNV, sorteio mulberry32, ruído e fbm 3D, `escolher`, `suave`. |
| `gnomos/aparencia.ts` | Transforma a semente numa `Aparencia`: corpo, proporções, cores, gorro, barba, roupa, acessórios e ritmo. |
| `gnomos/modelagem.ts` | Constrói toda a malha por superfícies paramétricas, com pesos de pele, cor de vértice (AO, rubor) e o atributo `tipo`. |
| `gnomos/malha.ts` | `Acumulador` (um buffer por material físico), `Canal` (material e tipo), superfícies P(u,v), `Trilho` (varredura com transporte paralelo), tampas e `geometriaDeSombra`. |
| `gnomos/esqueleto.ts` | 40 ossos e seus pais (gorro G0 a G5, BOCA, DEDOS_E, DEDOS_D). |
| `gnomos/gnomo.ts` | Monta os SkinnedMesh e o corpo de sombra, e anima: poses, IK com orientação da mão, molas, olhar curioso, piscar, respiração e âncoras. |
| `gnomos/materiais.ts` | 4 materiais compartilhados (pele, tecido, barba, duro), suas versões leves e o material só de sombra. |
| `gnomos/texturas.ts` | Texturas procedurais (DataTexture, sem canvas): tricô, feltro, fios, atlas de olhos, poros e cards. |

## Técnica

**Malha.** O corpo inteiro vem de código. Não há modelo baixado. Cada peça é uma superfície P(u,v) ou um
tubo varrido ao longo de uma Bézier, com quadros de transporte paralelo.

- Tronco e saia: perfil de pera (Catmull-Rom) e barra canelada. Faixas de jacquard com costura nítida
  (amostras de v duplicadas).
- Mangas: cotovelo inchado com rugas. Luvas com polegar, ou mão nua com quatro dedos afinados.
- Botas: couro, com cano e biqueira.
- Cabeça:
  - bochechas cheias, nariz de pera e orelhas;
  - olhos em globo, com pálpebras que são calotas presas a ossos próprios, mais um tubo de cílio;
  - boca com interior escuro e língua, mais o lábio de baixo.
- Gorro: curva central por forma. O raio incha pelo comprimento de arco. Tem dobras com fbm, rugas de
  compressão e aba elíptica com ruído, num plano inclinado. Embaixo, uma faixa de cabelo com 7 lobos.
- Barba: um volume lobado sobre a raiz que contorna o queixo. O bigode é arredondado (morsa, guidão ou cheio).
  A gnoma tem tranças e franja.
- Roupa: colete com debrum e botões, avental de lona, cinto com fivela, cachecol listrado com franja e
  lanterninha.

As normais vêm de diferença finita e são orientadas por voto.

**Pele (skinning).** Há um SkinnedMesh por material físico (até 4), e todos usam um único esqueleto de 40
ossos. A pose de ligação tem rotação identidade. Os pesos vêm de transições suaves ao longo de um
parâmetro: altura no corpo, comprimento na manga, no gorro e na barba.

**Materiais** (4, compartilhados por todos os gnomos). A cor vem da cor de vértice (RGBA), e o atributo
`tipo` escolhe a variante no shader. Por isso a fila inteira usa os mesmos programas de shader.

- `pele` (MeshPhysical), em dois tipos:
  - tipo 0, pele: luz envolvente diferente por canal, translucidez pela espessura (alfa da cor de
    vértice), sheen rosado e poros em normal map;
  - tipo 1, olhos: atlas 2x2 de íris com reflexo pintado e verniz (clearcoat).
- `tecido` (MeshPhysical), em dois tipos:
  - tipo 0, tricô: ponto de meia procedural em duas escalas (grossa no gorro e cachecol, fina no suéter),
    jacquard por alfa, normal de detalhe knitted_fleece e sheen tingido pelo fio;
  - tipo 1, feltro: lã batida com fibras.
- `barba` (MeshPhysical): brilho anisotrópico ao longo da mecha, com tangentes geradas e saneadas.
- `duro` (MeshStandard), em três tipos:
  - tipo 0, couro: brown_leather do Poly Haven, tingido. Carrega em segundo plano.
  - tipo 1, metal: latão e ferro.
  - tipo 2, vidro aceso da lanterna (emissivo).
- `leves`: as mesmas variantes em MeshStandard, para o nível baixo (sem sheen nem anisotropia).
- `sombra`: MeshBasic com `colorWrite` e `depthWrite` desligados. Desenha só no passe de sombra.

**Animação** (`update(dt, t)`). Só `dt` e `t` mexem no gnomo. Não há Math.random, Date.now nem timers.
A semente define o ritmo de respirar, piscar, gingar e olhar para trás.

- `walk`: passo com rolagem do calcanhar à ponta, ginga e balanço dos braços.
- `jump`: altura do pulo com esticar e achatar pela velocidade (menos quando está segurando).
- `hold`: IK de dois ossos até as laterais do presente, com esticão de cartum de até 1,4x. A mão é orientada
  com a palma para dentro e os dedos dobram. O gorro dobra para trás.
- `joy`: braços para o alto com as palmas abertas, olhos sorrindo, boca aberta e pulinho.
- `lookUp`: a cabeça e os olhos sobem.
- Olhar curioso: de tempos em tempos o gnomo olha por cima do ombro (cerca de 1/3 do tempo).
- Molas amortecidas em 2 eixos, com subpassos de 1/120 s:
  - gorro: 5 molas em cascata, mais o pêndulo da ponta;
  - barriga;
  - barba, tranças e cachecol pendem no sentido contrário, então não sobem quando o gnomo olha para cima.

**Âncoras.**

- `labelAnchor`: posição da cabeça no mundo, mais a altura do topo do gorro. Não balança com a ponta.
- `giftAnchor`: acima da cabeça, entre as mãos levantadas, acompanhando o pulo.
- Altura: topo do gorro, presa entre 1,16 e 1,34 m por uma escala de base. Sem a escala, os modelos vão de
  1,02 a 1,44 m.

## Como a variação funciona

`hashTexto(semente)` alimenta um sorteio mulberry32. Todas as escolhas saem desse sorteio em sequência, então
sementes vizinhas mudam em tudo.

- **Corpo:** médio, redondo, alto, gnoma (saia, tranças, franja e cachecol), jovem ou vovô (curvado, nariz
  maior). Há variação fina de barriga, cabeça, nariz, braço e escala.
- **Gorro:**
  - forma, com peso: mole 30%, touca 28%, pontudo 22%, caído 20%;
  - padrão: liso, listras, jacquard ou feltro;
  - ponta: pompom, sino ou nada;
  - azevinho, cor e comprimento.
- **Barba:** cheia, larga, bifurcada, trançada, curta ou nenhuma (para a gnoma). Cores: branco, creme,
  grisalho, ruivo ou castanho (ruivo e castanho somam cerca de 30%).
- **Bigode:** morsa, guidão ou cheio.
- **Roupa:**
  - suéter liso ou com faixa de jacquard;
  - colete de feltro ou avental (nunca os dois);
  - cinto (68%);
  - cachecol;
  - luvas ou mãos nuas;
  - botas em vários tons de couro.
- **Cores:** sempre da paleta: vermelho #B62835, verde #174D3B, dourado #E8BC65, neve #F7F4EF, azul
  #17253B, mais os tons derivados e os neutros de lã.
- **Rosto:** tom de pele, cor da íris e ritmo de piscar, respirar e olhar.

Teste em 1000 sementes, com a assinatura grossa (corpo, forma, padrão e cor do gorro, barba, cor do suéter,
colete, avental, cachecol):

- As 24 primeiras sementes (`final-folha-24.png`) dão 24 assinaturas diferentes.
- Em 1000 janelas de 12 sementes seguidas (uma fila), nenhuma tem repetição.
- Só com corpo, gorro e barba, 58 janelas repetiriam. A roupa desempata.
- Cada corpo aparece de 16,2% a 17,3% das vezes.
- A mesma semente dá a mesma `Aparencia` (conferido com JSON).

## Números

Os triângulos e o tempo são medidos com `modelar()` em 40 sementes, em Node, com a CPU daqui carregada
(load de 4 a 7).

| nível | detalhe | triângulos (média / máx.) | malhas visíveis | tempo de modelagem |
|---|---|---|---|---|
| alta | 0,76 | 10.786 / 12.210 | até 4 | ~30 ms |
| media | 0,50 | 4.886 / 5.614 | até 4 | ~13 ms |
| baixa | 0,26 | 1.994 / 2.386 | até 4 | ~5 ms |
| corpo de sombra | 0,20 | 1.585 / 1.962 | 1 | ~5 ms |

**Cena.**

- Estúdio com 18 gnomos: 94 chamadas no nível alto e no médio, 50 no baixo. Na primeira rodada eram 243.
- Sala A com 12 na fila mais 1 na entrega (13 com sombra): 369 a 371 chamadas e 1,41 M triângulos, contando
  todos os passes. A sala sozinha dá cerca de 252 chamadas e 1,14 M. Na primeira rodada eram 657 chamadas e
  1,83 M.
- Por gnomo, somando todos os passes: cerca de 9 chamadas e cerca de 20 mil triângulos (antes: 31 e 53 mil).

**Por gnomo.**

- Até 4 malhas visíveis (pele, tecido, barba, duro) mais 1 corpo de sombra.
- 40 ossos.
- `createVisitor` é síncrono.
- Uma semente nova custa cerca de 35 ms no nível alto (malha mais sombra). Uma semente já em cache só monta
  o esqueleto.

**Peso.**

- Código: cerca de 165 KB de TypeScript (3974 linhas, antes de minificar).
- Disco: brown_leather (cerca de 600 KB) e knitted_fleece/nor.jpg (cerca de 210 KB), ambos do Poly Haven
  (CC0) e já em `public/assets/texturas`.
- Memória de vídeo:
  - texturas procedurais: cerca de 5,6 MB (cerca de 7,5 MB com mipmaps), geradas uma vez e compartilhadas;
  - texturas do Poly Haven: 4 de 1024x1024, cerca de 16 MB com mipmaps.

**Descarte.** O `dispose()` do rig libera o esqueleto e solta a geometria do cache. Quando o último gnomo
de uma semente e nível sai, a geometria é descartada, e o corpo de sombra também, quando não houver mais
quem o use. Materiais e texturas têm contagem própria (`pegarMateriais`/`soltarMateriais`) e o export
`liberarVisitantes()`.

## Fotos

| foto | o que mostra |
|---|---|
| `final-estudio.png` | 1080x1920. 6 gnomos: parados (frente), andando (meio), alegria e segurando presente (fundo). |
| `final-noite.png` | O mesmo, com luz de noite. |
| `final-retrato-rosto.png` | Rosto, barba e bigode (semente 0). |
| `final-retrato-gorro.png` | Gorro listrado com pompom e o tricô de perto (semente 3). |
| `final-retrato-lado.png` | Corpo inteiro de perfil (semente 1, jovem ruivo com cachecol). |
| `final-sala.png` (e `-mini`) | Fila na sala A, 1080x1920. |
| `final-sala-entrega.png` (e `-mini`) | O momento da entrega, 1080x1920. |
| `final-folha-24.png` | As 24 primeiras sementes. |

Para refazer o estúdio:

```
node tools/shot.cjs estudio --param mostrar=visitantes --param porLinha=2 --param linhas=3 --param cam=0,3.9,9.6,0,0.5,-0.5,33 --out lab/fotos/gnomos/final-estudio.png
```

O enquadramento padrão (6 por fileira) corta os gnomos das pontas em 9:16. A cena da vila em resolução cheia
ainda estoura às vezes o limite de 30 s do `page.screenshot`; repetir resolve.

## Correções que valem lembrar

- **Dobra do gorro dentro das molas.** Ela era amplificada pela cascata. Agora é somada por fora das molas.
- **Boca escondida.** Estava enterrada na gola ou coberta pelo bigode. Agora fica por cima da barba
  (`frenteBoca`), e o entalhe da raiz da barba é pequeno.
- **Cards de frizz na barba.** Liam como saia de palha. Foram trocados pelo volume lobado. O material ainda
  aceita cards (tipo 1, alphaTest), caso se queira voltar a eles.
- **Tufos de cabelo na nuca.** Pareciam garras de madeira. Viraram a faixa de cabelo sob a aba.
- **Avental de couro.** Lia como calça escura. Agora é de lona clara e mais curto.
- **Anisotropia sem tangentes gera NaN** (manchas de bloom). A barba gera tangentes saneadas.
- **Molas de peças penduradas.** Barba, tranças e cachecol usam o sinal contrário ao do gorro.

## Pontos fracos e o que eu faria a seguir

- **Barba de perto.** O volume lobado é macio a distância. No retrato de rosto, os sulcos ainda lembram
  entalhe, sem fios soltos. Uma camada fina de cards nas bordas resolveria (o material já aceita).
- **Sobrancelhas e bigode de perto.** São mechas em camadas que ainda parecem lascas achatadas.
- **Ponto do tricô no gorro.** De perto (retrato do gorro), o ponto é grande e com muito relevo. Na fila
  funciona.
- **Nariz.** De perto é liso demais, uma bola rosa sem poros visíveis.
- **Fila na sala.** É vista de costas, então só se leem gorros e costas. Na luz quente, as roupas escuras
  ainda pesam.
- **Pose de segurar.**
  - Os braços esticam visivelmente (até 1,4x).
  - Com presentes grandes, as mãos entram um pouco na caixa.
- **Avental.** Ainda é uma placa com dobras simples.
- **Mão nua.** Melhorou, mas segue simples.
- **Montagem.** Leva ~35 ms por semente nova no nível alto e pode custar um quadro. Dá para pré-aquecer o
  cache com as próximas sementes da fila. Hoje o cache só guarda o que tem gnomo vivo, então seria preciso
  um `preaquecer(seed)` no visitors que segure a geometria até o gnomo nascer.
- **Fora da minha área.**
  - Na entrega, o visitante fica em parte atrás do Noel e da cadeira, e o brilho do presente cobre o rosto
    do Noel. Isso é posicionamento e efeito do set/Noel/presentes.
