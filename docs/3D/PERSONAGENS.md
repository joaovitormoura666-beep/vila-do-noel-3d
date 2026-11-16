# Personagens: o Noel, os gnomos e os presentes

Todos os personagens são esculpidos por código em Three.js (superfícies paramétricas presas a um
esqueleto), sem modelo pronto e sem imagem gerada por IA. Eles cumprem os contratos de
`src/world/contracts.ts` (`SantaRig`, `VisitorRig`, `GiftBox`, `Cast`), então o jogo não precisa saber
como foram feitos.

Ponto de troca: `src/world/cast/index.ts` junta três partes independentes:

| Parte | Arquivo de entrada | Pasta |
| --- | --- | --- |
| Papai Noel | `src/world/cast/santa.ts` | `src/world/cast/noel/` |
| Visitantes (gnomos) | `src/world/cast/visitors.ts` | `src/world/cast/gnomos/` |
| Presentes e caixa (em construção) | `src/world/cast/gifts.ts` | `src/world/cast/presentes/` |

---

## O Papai Noel

**É o personagem do dono.** Ele criou o Noel no Tripo; como o GLB não pôde ser exportado, o dono pediu que
o Noel fosse refeito em 3D, fiel ao desenho dele (`lab/referencia-noel-tripo.png` e os quadros de
`lab/referencia-noel/`). Nunca substitua por um Noel genérico.

Notas completas: `lab/fotos/noel/NOTAS.md` (16/11/2026, por volta de 02:28 UTC). Fotos da crítica:
`lab/fotos/noel-critica/` (as fotos ficam só no computador onde foram tiradas; um clone do GitHub não as
traz, então refaça com os comandos da própria nota).

### Como ele é

Corpo de pera muito barrigudo, cabeça grande, nariz de bolota, óculos redondos dourados, barba curta e
redonda em mechas, bigode e sobrancelhas em mechas, gorro caído com pompom, casaco de veludo carmim com
faixa e barra de pelúcia branca, cinto com fivela dourada, luvas brancas e botas de couro marrom-escuro.
Fica **sentado** na poltrona grande da sala (ArmChair_01 em escala 1,5), com as botas num pufe de veludo
verde e o saco de presentes no chão, do lado de onde o visitante chega.

### Como é feito

| Arquivo | O que faz |
| --- | --- |
| `noel/index.ts` | `buildNoel`: monta geometrias e materiais uma vez e cria as cópias (`createSanta`). |
| `noel/medidas.ts` | Todos os números para ajustar: `CORPO`, `PUFE`, `SACO`, `CORES`, `VISITANTE`, `ANIMA`. |
| `noel/forma.ts` | Tronco em pera (superelipse), saia e barra do casaco; impede barba e mãos de entrarem na barriga. |
| `noel/corpo.ts` | A escultura (barba, gorro, rosto, roupa). |
| `noel/malha.ts`, `noel/aneis.ts` | Superfícies paramétricas acumuladas por material. |
| `noel/esqueleto.ts` | 37 ossos; um esqueleto compartilhado por 8 malhas com pele (uma por material). |
| `noel/animacao.ts` | Poses, IK de dois ossos, olhar, piscadas, respiração, mola do pompom. |
| `noel/materiais.ts`, `noel/texturas.ts` | Veludo com brilho de borda, pelúcia em cascas, mechas com brilho ao longo dos fios, couro, ouro, pele. |
| `noel/saco.ts`, `noel/pufe.ts` | O saco de presentes e o pufe. |
| `noel/util.ts` | Sorteio com semente (mulberry32), ruído suave, curvas por chaves e pequenas contas; nada de `Math.random`. |

### Poses (`SantaPose`, cada uma de 0 a 1, misturadas)

`wave` (acenar), `talk` (falar: mãos alternadas, queixo mexendo), `rummage` (procurar no saco), `present`
(apresentar o presente), `give` (estender os braços para o visitante), `cheer` (comemorar). Sem nenhuma, ele
fica parado, respirando e piscando. O olhar procura um alvo: a câmera da sala no repouso, o visitante no
`give`, `talk` e `present`, a boca do saco no `rummage` e para cima no `cheer`.

Âncoras: `sackMouth` (de onde a caixa sai) e `bubbleAnchor` (para onde o balão de fala aponta).

### Números (uma cópia, com saco e pufe; medidos em 16/11/2026, por volta de 02:28 UTC)

| Nível | Cascas de pelúcia | Triângulos |
| --- | --- | --- |
| alta | 5 | 59.448 |
| media | 3 | 52.872 |
| baixa | 2 | 49.584 |

14 chamadas de desenho (8 malhas com pele, 4 do saco, 2 do pufe). Texturas do Poly Haven:
`velour_velvet`, `curly_teddy_natural`, `brown_leather`, `knitted_fleece`, `hessian_230`; as demais são
geradas por código. A animação não aloca nada por quadro.

### Pontos fracos conhecidos

- Na câmera da sala, etiquetas de nome e gnomos da fila passam na frente do saco.
- A pelúcia, de muito perto, ainda lembra toalha fina; na distância da sala lê bem.
- A ponta das mechas da barba mostra poucas facetas em close extremo.
- A barra do casaco ainda é um anel contínuo grosso.
- Botas simples, sem cadarço nem costura.
- O alvo de repouso do olhar e a posição do visitante estão gravados à mão para a sala A (`VISITANTE` em
  `medidas.ts`, `olhar()` em `animacao.ts`). Em outra sala, ou se a entrega da sala A mudar, é preciso
  ajustar os dois. Conferido em 16/11/2026, por volta de 03:38 UTC: `VISITANTE` (0,59 rad e 1,85 m, vistos
  pelo Noel) bate com a âncora `delivery` atual, cerca de (1,47; -2,30). A `NOTAS.md` do Noel ainda cita o
  valor antigo, 0,37 rad, de antes de a entrega ir para a direita.

### Como trocar o Noel por um GLB no futuro

O contrato foi feito para isso. Passos sugeridos para quem for fazer (confirme com o dono antes):

1. **Arquivo.** O GLB do dono vai em `public/assets/modelos/` (por exemplo `noel-do-dono.glb`). Ele precisa
   ter esqueleto e animações, ou ao menos uma pose sentada. Para reduzir o peso, use
   `lab/acervo/ferramentas/simplificar.mjs`, que simplifica um GLB que já está em `public/assets/modelos/`
   (o `tools/polyhaven.mjs` só processa o que ele mesmo baixa):
   `node lab/acervo/ferramentas/simplificar.mjs noel-do-dono --tri 60000 --tex 1024` (há também `--erro`
   e `--saida`). Meta: até 10 MB e por volta de 60 mil triângulos, como o Noel atual. Cuidado: simplificar
   uma malha com esqueleto pode estragar os pesos da pele; confira todas as poses depois. Use a opção `--saida` para gravar a versão leve com outro nome e manter o
   original; se estragar, tente com menos redução. Confira com o dono os termos de uso do Tripo para lives
   e anote a origem do arquivo em `public/assets/CREDITOS.md`.
2. **Código.** Crie, por exemplo, `src/world/cast/noel-glb.ts` com uma função que devolve
   `{ createSanta(): SantaRig; setQuality(level) }`, e troque a linha de `src/world/cast/santa.ts` que
   chama `buildNoel` para usar a nova função. Deixe a pasta `noel/` intacta, como reserva.
3. **`createSanta()` é síncrono**, mas `loadModel` é assíncrono. Faça como a poltrona de ensaio de
   `noel/index.ts`: crie o `root` na hora e acrescente o modelo quando ele chegar (ou carregue o GLB antes
   de o jogo começar).
4. **Encaixe na poltrona.** `root` vai em `anchors.santa.position`, girado de `anchors.santa.yaw`. O quadril
   do modelo sentado precisa cair em `ASSENTO_DO_NOEL.quadril` (`src/world/set-a/ancoras.ts`): assento a
   0,75 m do piso, 0,93 m entre os braços. Inclua o saco ao lado (o saco atual, `noel/saco.ts`, pode ser
   reaproveitado).
5. **Poses.** Ligue cada número de `SantaPose` ao peso de um clipe de animação do GLB (por exemplo com
   `THREE.AnimationMixer`, um `AnimationAction` por pose e `setEffectiveWeight` a cada `update(dt, t)`).
   As sete situações precisam existir: parado, acenar, falar, procurar no saco, apresentar, entregar,
   comemorar.
6. **Âncoras.** Preencha `sackMouth` (boca do saco), `bubbleAnchor` (topo da cabeça) e `height`.
7. **`setQuality` e `dispose`.** Reduza o que for caro nos níveis baixos e libere esqueleto e materiais no
   `dispose`. Nada de `Math.random` ou relógio próprio na animação.
8. **Conferir.** Fotografe `node tools/shot.cjs estudio --param mostrar=noel --half` (as sete poses) e
   `node tools/shot.cjs vila --param set=a --estado entrega --half`, e compare com as fotos do Noel atual.

---

## Os gnomos visitantes

Cada pessoa da live vira um **gnomo natalino original**, sempre o mesmo para o mesmo nome (a semente é o
identificador da pessoa). O exemplo de estilo do dono (`lab/referencia-gnomo.png`, um personagem de filme)
serviu só para volume, escala da cabeça e tipo de material: nada dele foi copiado.

Notas completas: `lab/fotos/gnomos/NOTAS.md` (16/11/2026, por volta de 02:32 UTC). Fotos da crítica:
`lab/fotos/gnomos-critica/`. A imagem `lab/referencia-gnomo.png` é de uma obra de terceiros: fica fora do
git e não vem num clone; quem precisar dela pede ao dono.

### Como são feitos

| Arquivo | O que faz |
| --- | --- |
| `cast/visitors.ts` | `buildVisitors(ctx)`: `createVisitor(seed)` e `setQuality`; cache de geometria por semente e nível, com contagem de uso. |
| `gnomos/aparencia.ts` | A semente vira uma aparência: corpo, proporções, cores, gorro, barba, roupa, acessórios e ritmo. |
| `gnomos/modelagem.ts` | Constrói a malha por superfícies paramétricas, com pesos de pele e cor de vértice. |
| `gnomos/malha.ts` | Acumulador por material, superfícies, tubos varridos e o corpo simplificado de sombra. |
| `gnomos/esqueleto.ts` | 40 ossos (incluindo 6 no gorro, boca e dedos). |
| `gnomos/gnomo.ts` | Monta as malhas e anima: poses, IK das mãos, molas, olhar, piscar, respiração e âncoras. |
| `gnomos/materiais.ts`, `gnomos/texturas.ts` | 4 materiais compartilhados por todos (pele, tecido, barba, duro), versões leves e texturas procedurais. |
| `gnomos/util.ts` | Hash FNV, sorteio mulberry32, ruído. |

Variação: seis tipos de corpo (médio, redondo, alto, gnoma com tranças, jovem, vovô), quatro formas de
gorro (mole, touca, pontudo, caído), padrões, pontas (pompom, sino), barbas, bigodes, suéter, colete ou
avental, cinto, cachecol, luvas, botas. As cores saem sempre da paleta do briefing e de tons derivados. Em
1.000 janelas de 12 sementes seguidas (uma fila), nenhuma repetiu a aparência.

### Poses (`VisitorPose`)

`walk` e `phase` (andar, com a fase avançando pela distância para o pé não patinar), `jump` (pulinho),
`hold` (segurar o presente acima da cabeça, com IK), `joy` (comemorar), `lookUp` (olhar para cima).
Âncoras: `labelAnchor` (acima do gorro, sem balançar com a ponta) e `giftAnchor` (acima da cabeça, entre as
mãos). Altura entre 1,16 e 1,34 m.

### Números (medidos em 16/11/2026, por volta de 02:32 UTC, antes dos ajustes do jogo 3D na sala)

| Nível | Triângulos (média / máximo) | Tempo para montar uma semente nova |
| --- | --- | --- |
| alta | 10.786 / 12.210 | cerca de 30 ms |
| media | 4.886 / 5.614 | cerca de 13 ms |
| baixa | 1.994 / 2.386 | cerca de 5 ms |

Por gnomo, somando todas as passadas: cerca de 9 chamadas e 20 mil triângulos. Sala A com 12 na fila e 1 na
entrega: cerca de 370 chamadas e 1,41 milhão de triângulos. Por isso o jogo 3D monta no máximo um gnomo por
quadro e com antecedência (`src/jogo3d/elenco.ts`). Texturas do Poly Haven: `brown_leather`,
`knitted_fleece`.

### Pontos fracos conhecidos

- Barba, sobrancelhas e bigode de perto ainda lembram entalhe, sem fios soltos.
- O ponto do tricô no gorro é grande demais de perto (na fila funciona).
- Nariz liso demais de perto.
- Na sala a fila é vista de costas: leem-se gorros e costas; roupas escuras pesam na luz quente.
- Na pose de segurar, os braços esticam visivelmente (até 1,4x) e, com presentes grandes, as mãos entram
  um pouco na caixa.
- Na entrega, o visitante ficava em parte atrás do Noel e da poltrona, e o brilho do presente cobria o
  rosto do Noel (posicionamento e efeito, fora da pasta dos gnomos). Isso foi anotado antes de a entrega ir
  para a direita (1,85 m na direção 1,27 rad) e de a revelação baixar para 2,5 m, mudanças feitas pelo jogo
  3D (em construção) justamente para isso. Conferir com foto antes de dizer que continua.

---

## Os presentes e a caixa (em construção)

Os 12 presentes de `src/gifts/giftCatalog.ts` (Estrela Dourada, Bola de Natal, Bengala Doce, Boneco de
Neve, Ursinho de Pelúcia, Sino Dourado, Meia Natalina, Biscoito de Gengibre, Globo de Neve, Pinheirinho,
Chocolate Quente e Trenzinho) estão sendo esculpidos por código em `src/world/cast/presentes/`, um arquivo
por presente, mais a caixa (`caixa.ts`). O contrato está no cabeçalho de `presentes/index.ts`:

- `createGift(id)` devolve um objeto centrado na origem, cabendo num cubo de 1 m (quem chama cuida da
  escala). Opcionalmente traz `userData.update(dt, t)` (o sino balança, o trem anda, a neve do globo
  rodopia) e `userData.dispose()`.
- `createGiftBox()` devolve a caixa em tamanho real (cerca de 42 x 42 cm), com o pivô da tampa no centro de
  cima do corpo.
- Orçamento por presente no nível alto: até cerca de 8 mil triângulos e 4 chamadas de desenho.

Notas, fotos e números: `lab/fotos/presentes/NOTAS.md` (em construção; em 16/11/2026, por volta de 03:38
UTC, a nota já existia, mas ainda fora do git). Cada presente fica abaixo de 8 mil triângulos.

Os presentes têm um estúdio próprio, `src/world/set-kit-presentes/`, com uma luz parecida com a da sala A:

```
node tools/shot.cjs sala --param set=kit-presentes --half --out lab/fotos/presentes/folha.png        os 12 lado a lado
node tools/shot.cjs sala --param set=kit-presentes --param mostrar=um --param presente=sino --half --out ...
node tools/shot.cjs sala --param set=kit-presentes --param mostrar=varios --param presente=sino,bola,globo --half --out ...
node tools/shot.cjs sala --param set=kit-presentes --param mostrar=caixa --half --out ...           caixa fechada e aberta
node tools/shot.cjs sala --param set=kit-presentes --param medir=1 --half --out ...                 triângulos e chamadas de cada um
```

Outros parâmetros do estúdio (`giro`, `girar=1`, `escala`, `olho`, `abrir`, `rotulos=0`) estão no
cabeçalho de `src/world/set-kit-presentes/index.ts`.
