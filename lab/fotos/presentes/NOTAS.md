# Presentes 3D: notas

Os 12 presentes definitivos e a caixa de presente, no padrão da sala e do Noel. Tudo é modelado por
código (superfícies paramétricas), com materiais compartilhados e texturas feitas no próprio navegador.
Nenhum arquivo novo foi baixado.

## Fotos desta pasta

| Arquivo | O que mostra |
| --- | --- |
| `folha-12.png` (+ `folha-12-mini.png`) | os 12 lado a lado no estúdio, em `alta`, 1080x1920 e a miniatura de celular 270x480 |
| `folha-12-baixa.png` | os 12 em `baixa` (rascunho 540x960), para comparar |
| `close-ursinho.png`, `close-trenzinho.png`, `close-globo.png` | três de perto (pelúcia em cascas, madeira pintada com latão, vidro com neve caindo) |
| `caixa-fechada-e-aberta.png` | a caixa fechada e a aberta, com a tampa no ar e a estrela saindo |
| `celular-revelacao.png` (+ `-mini.png`) | a sala A no momento da revelação (ursinho), como aparece no celular |

Como refazer (laboratório ligado em `http://127.0.0.1:5180`):

```
node tools/shot.cjs sala --param set=kit-presentes --mini --timeout 250 --out lab/fotos/presentes/folha-12.png
node tools/shot.cjs sala --param set=kit-presentes --param mostrar=um --param presente=ursinho --out lab/fotos/presentes/close-ursinho.png
node tools/shot.cjs sala --param set=kit-presentes --param mostrar=caixa --out lab/fotos/presentes/caixa-fechada-e-aberta.png
node tools/shot.cjs vila --param set=a --estado revelacao --param presente=ursinho --mini --timeout 280 --out lab/fotos/presentes/celular-revelacao.png
```

`--param medir=1` faz o estúdio escrever no console (e o `shot.cjs` mostrar) os triângulos e as
chamadas de desenho de cada presente. `--param mostrar=varios --param presente=sino,bola,globo` mostra
alguns juntos; `giro`, `girar=1`, `escala`, `abrir` e `rotulos=0` estão no cabeçalho do estúdio.

## O que foi feito

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
  borda de trás para quem quiser abrir como dobradiça. `root.userData.tamanho = { lado, alturaCorpo,
  alturaTotal }`.
- `setQuality(nivel)` troca a geometria das cópias vivas e reduz as cascas da pelúcia; os extras
  (flocos, vapor) seguem o nível na próxima cópia.
- Comentários de `src/world/contracts.ts` atualizados com isso (sem mudar tipos).

## Números

Triângulos e chamadas de desenho por presente (`medir=1` e contagem das malhas):

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
| globo (+ flocos 140/80/40 pontos) | 6.928 | 3.724 | 2.400 | 3 (+1 pontos) |
| pinheirinho | 6.004 | 3.108 | 2.372 | 2 |
| chocolate (+ vapor, não em baixa) | 6.656 | 3.360 | 2.192 | 2 |
| trenzinho (rodas e bielas instanciadas) | 7.964 | 5.978 | 5.452 | 3 |

- Os 12 juntos no estúdio, em `alta`: 152 chamadas e ~314 mil triângulos (com o estúdio e as sombras);
  em `baixa`: 47 chamadas e ~36 mil triângulos.
- Caixa fechada + aberta + estrela no estúdio: 65 chamadas, ~152 mil triângulos (com o estúdio).
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
