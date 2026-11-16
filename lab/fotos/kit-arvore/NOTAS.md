# Kit da árvore de Natal e das folhagens

Código em `src/world/kit/arvore/`, estúdio em `src/world/set-kit-arvore/`, texturas em `public/assets/arvore/`.
Esta é a revisão depois da crítica em `lab/fotos/kit-arvore-critica/CRITICA.json` (nota 5,5). A API pública não mudou.

## Técnica

**Folhagem (a mesma na árvore, na guirlanda e no festão).** Ramos de verdade do modelo "Fir Sapling" do Poly Haven
(CC0) foram fotografados de cima, com câmera ortográfica, em um atlas 3x3 (2048 px, nove variantes: quatro leques
abertos, duas pontas estreitas, dois leques cheios e um de miolo), com 6% de margem para nenhum ramo tocar a borda:
cor + recorte em `ramo_cor.webp`; normal (RG) + altura da agulha (B) em `ramo_normal.webp`. O modelo não vai no jogo,
só o atlas. A ferramenta que fez isso fica em `src/world/kit/arvore/ferramentas/` (`assar.html`, `assar.ts`,
`assar.cjs`) e não entra no pacote.

Cada "fronde" (0,16 a 0,28 m) é uma instância de dois cartões cruzados: o leque deitado, abaulado e vergando com o
peso, e um cartão estreito em pé que dá a espessura de escova vista de lado. Todas em UMA malha instanciada
(cerca de 6.150 frondes de 18 triângulos). O sombreador (MeshStandardMaterial alterado por `onBeforeCompile`) faz:
- recorte com alpha to coverage no nível alto (bordas macias, sem degrau de pixel) e compensação de cobertura por mip;
- cartão visto de quina some aos poucos (não aparece a lâmina);
- normal das agulhas misturada com a normal do volume da copa, luz envolvente e translucidez verde fraca;
- brilho especular só nas agulhas de cima e de fora (máscara de altura x oclusão pintada), rugosidade 0,78;
- oclusão pintada por instância: base da fronde e miolo escuros, pontas claras;
- halo das lampadinhas: cada fronde conhece as 3 lâmpadas mais próximas; o brilho de cada uma é calculado no
  vértice e no pixel fica só a queda com a distância, modulada pela normal e pela altura da agulha. O halo é a cor
  da lâmpada vezes o albedo da agulha (âmbar-esverdeado), com teto. Nenhuma PointLight extra;
- material de profundidade próprio: a sombra projetada tem o recorte das agulhas.

**Esqueleto.** `esqueleto.ts` gera, a partir da semente, verticilos de galhos irregulares (subindo no topo,
pendendo embaixo), frondes ao longo do galho, tufos em estrela na ponta de cada galho (é o que dá a leitura de
escova de abeto na silhueta), frondes escuras de miolo e um broto-guia vertical no topo, no qual a estrela fica
espetada. Tronco e galhos são tubos com a casca `pine_bark`. Nos níveis médio e baixo, só as frondes não essenciais
são cortadas (miolo e pontas ficam), e um núcleo escuro irregular (cone de ~400 triângulos) fecha a vista.

**Luzinhas.** `luzes.ts`: bulbo de vidro leitoso + soquete, instanciados. Cada lâmpada é presa a uma fronde de verdade
(pousada a 55 a 90% do talo); posição sem fronde por perto é descartada. O fio é uma curva Catmull-Rom pelos soquetes,
com barriga só para baixo e, entre lâmpadas distantes, mergulhando para dentro da copa (some entre os ramos).
Emissão HDR moderada; cada lâmpada respira no seu ritmo (5 a 12 s, entre 56% e 100%) e uma em seis quase apaga e
volta; cerca de um terço é mais âmbar. No nível baixo (sem brilho de palco) o fio some e o bulbo fica âmbar.

**Efeito TREE_SPARKLE.** `setCintilar(0..1)` mistura o pisca-pisca calmo com duas ondas que sobem pela árvore e
lampejos curtos em parte das lâmpadas, puxando para o dourado; a luz real pulsa com três ritmos que não se repetem
juntos (variação de no máximo 30%); a estrela ganha emissão própria e um halo redondo e macio que respira (sem cruz
de lente); 26 fagulhas douradas minúsculas sobem devagar perto da copa (só durante o efeito).

**Enfeites.** 26 bolas de vidro instanciadas (esfera + tampinha + argola + ganchinho), penduradas sob uma fronde,
meio aninhadas, com MeshPhysicalMaterial, verniz e envMap; cor sorteada (vermelho fundo, ouro velho, vermelho
escuro), parte acetinada. Sete laços de veludo com o nó encostado num galho. Estrela de latão envelhecido com quinas
arredondadas, rugosidade variada por mapa gerado e normal de metal batido, com luva. O ambiente refletido é gerado por
código (`ambiente.ts`, PMREM de uma salinha quente) e pode ser trocado por `setEnvMap`.

**Pé.** Saia de veludo vinho (MeshPhysicalMaterial com sheen, especular baixo) com pregas largas e macias (ruídos
somados, sem senos regulares), franzido baixo em gomos junto ao tronco, oclusão pintada em cor de vértice e barra de
pelúcia creme (rolo irregular com normal de pelo). Presentes em UMA malha de papel (estampas numa textura em camadas
gerada por código: kraft com carimbo de estrelinhas, liso vinho, listras, bolinhas, xadrez) e uma de fitas: caixas com
cantos arredondados e faces levemente estufadas, vincos retos no papel, abas dobradas nas laterais, fita de cetim com
bainha (espessura) e laço duplo virado para a frente da peça. A sombra que a luz da árvore não projeta vem pintada
(saia e presentes escurecem para o tronco). No nível baixo: penumbra pintada na saia e mancha de sombra de contato.

## API

```ts
import { criarArvore, criarGuirlanda, criarFestao } from '../kit/arvore';

const arvore = await criarArvore(ctx, { altura: 3.4, semente: 7, luzes: 220, enfeites: true, presentes: 4, estrela: true });
arvore.root.position.set(-1.6, 0, -1.2);
scene.add(arvore.root);
arvore.setEnvMap(ambienteDaSala);      // opcional: reflexo da sala pronta nas bolas, na estrela e nos presentes
arvore.luz.intensity = 1.2;            // luz real quente (PointLight, sem sombra), ajustável pela composição
// no update da composição:  arvore.update(dt, t)
// no onAmbient:             if (efeito === 'TREE_SPARKLE') arvore.setCintilar(estado.intensity)   // 0 = calmo
// troca de nível:           arvore.setQuality('media')
// ao sair:                  arvore.dispose()

const guirlanda = await criarGuirlanda(ctx, { raio: 0.3, laco: true });           // costas em z = 0, base em y = 0
const festao = await criarFestao(ctx, { pontos: [a, b, c], espessura: 0.2, luzes: true });
```

- `criarArvore(ctx, opcoes?) => Promise<ArvoreDeNatal>`
  opções: `altura` (3,4, até a ponta da estrela), `raio` (0,35 da altura), `semente` (7), `luzes` (220; de 0 a 300),
  `enfeites` (true), `presentes` (true = 4; número de 3 a 5; false tira saia e presentes), `estrela` (true), `envMap`.
  devolve `Peca` (`root`, `update(dt, t)`, `setQuality(level)`, `dispose()`) mais `altura`, `raio`, `topo` (Vector3
  local da ponta), `luz` (PointLight quente a 0,55 da altura, alcance 4,5 m), `setCintilar(0..1)`, `setEnvMap(tex | null)`.
- `criarGuirlanda(ctx, { raio, laco?, bagas?, semente? }) => Promise<Peca>`: em pé, de frente para +Z, centro do aro em
  (0, raio, 0); as pontas do laço descem um pouco abaixo de y = 0. `bagas` = número de cachinhos (padrão 3).
- `criarFestao(ctx, { pontos, espessura?, luzes?, barriga?, semente? }) => Promise<Festao>`: passa pelos pontos e pende
  entre eles; `luzes: true` põe uma lâmpada a cada 14 cm (ou um número); `Festao` = `Peca` + `setCintilar`.

Base em y = 0, metros, frente para +Z, sem relógio próprio (só `dt` e `t`), sorteio com semente. Escala, origem e
orientação iguais às da versão anterior.

## Recursos (Poly Haven, CC0) que vão no jogo: 1,28 MB no total

| Arquivo | Peso | Origem |
| --- | --- | --- |
| `public/assets/arvore/ramo_cor.webp` | 656 kB | ramos fotografados do modelo Fir Sapling |
| `public/assets/arvore/ramo_normal.webp` | 491 kB | idem (normal + altura) |
| `public/assets/arvore/casca_cor.jpg` | 43 kB | textura Pine Bark, reduzida |
| `public/assets/arvore/casca_normal.jpg` | 60 kB | idem |
| `public/assets/arvore/veludo_cor.jpg` | 16 kB | textura Velour Velvet, reduzida |
| `public/assets/arvore/veludo_normal.jpg` | 18 kB | idem |

`public/assets/modelos/fir_sapling.glb` não existe (o modelo, em `assets-src/modelos/fir_sapling/`, só foi usado para
fotografar os ramos); em `public/assets/CREDITOS.md` há a linha do Fir Sapling dizendo isso, além das de Pine Bark e
Velour Velvet. Nada novo foi baixado nesta revisão.

## Números

Medidos no estúdio com `--param numeros=1` (malhas e triângulos da própria peça na passada principal; cada malha
é uma chamada de desenho) e pela saída do `shot.cjs` (quadro inteiro do estúdio: piso e duas paredes + a peça, com
sombra e, no alto, oclusão).

| Nível | Malhas da árvore | Triângulos da árvore (passada principal) | Quadro inteiro do estúdio |
| --- | --- | --- | --- |
| alta | 11 | 208.666 (folhagem 110.646; bulbos 18.480; galhos 13.446; laços 13.524; bolas 11.336; fitas 11.268; fio 10.062; saia 9.984; barra 3.072; papel 4.832; estrela 2.016) | 45 chamadas, 309.623 triângulos (32 / 263.463 sem oclusão) |
| média | 12 | 179.554 (folhagem 84.834, 176 lâmpadas, núcleo escuro) | 33 chamadas, 234.351 triângulos |
| baixa | 13 | 155.048 contados (folhagem desenhada só com o leque deitado; 132 lâmpadas; núcleo; mancha de contato) | 16 chamadas, 130.460 triângulos |

- Na passada de sombra entram só a folhagem (leque deitado, frondes essenciais + 45% das outras), a saia e o papel
  dos presentes; galhos, bolas, laços, estrela, fitas, fio e bulbos ficam fora da sombra e da oclusão.
- Luzes reais: 1 PointLight sem sombra. 220 lâmpadas na alta, 176 na média, 132 na baixa.
- Guirlanda (raio 0,3): 4 malhas, 8.946 triângulos. Festão de 1 m com luzes: 3 malhas, 2.508. Festão simples: 1 malha, 1.404.
- Texturas geradas por código (só memória): estampas dos papéis (textura em camadas), normal de papel, de pelúcia e
  de metal batido, rugosidade do latão, manchas redondas, ambiente PMREM.

## Fotos (todas sem erro de console)

- `final.png` (alta, 1080x1920) e `final-mini.png`; `final-media.png`, `final-baixa.png`
- `perto-meio.png` (540x960: em 1080x1920 a foto estourava o tempo de captura com a máquina cheia), `perto-pe.png`,
  `perto-topo.png`, `angulo-lado.png` (1080x1920, câmeras de perto e de lado)
- `escuro.png` (sala quase apagada: as luzes da própria árvore dominam)
- `cintilar-t2.png`, `cintilar-t3.png`, `cintilar-t4.png` (TREE_SPARKLE, intensidade 1), `cintilar-baixa.png`
- `folhagens.png` e `perto-guirlanda.png` (guirlanda, festão com luzes, festão simples)
- `assar/`: conferência do atlas de ramos; `r2/` e `rascunho/`: rascunhos dos ciclos desta revisão
- `final.png`, `escuro.png`, `angulo-lado.png`, `perto-meio.png` e `perto-guirlanda.png` saíram com o código final;
  `perto-pe.png`, `perto-topo.png`, `final-media.png`, `final-baixa.png` e os `cintilar-*` saíram um passo antes
  (só muda que ali os galhos ainda projetavam sombra; no nível baixo não há sombra, então é idêntico)

Como refazer: `node tools/shot.cjs sala --param set=kit-arvore [--param escuro=1] [--param peca=folhagens]
[--param efeito=TREE_SPARKLE --param intensidade=1 --t 2,3,4] [--q baixa] [--param cam=x,y,z,ax,ay,az,fov]
[--param numeros=1]` (com `numeros=1` o estúdio escreve no console as malhas e triângulos próprios da peça).

## O que foi resolvido da crítica

- Folhagem: atlas reassado com ramos densos em 9 variantes; frondes menores e muitas, tufos de ponta, giro em volta
  do talo. Lê como abeto, não como tuia.
- Cor: verde-pinheiro único no atlas, sem tinta azul; translucidez verde fraca; halo âmbar-esverdeado com teto;
  especular só nas agulhas de fora (a face com luz quente continua verde).
- Nível baixo: frondes essenciais nunca cortadas, núcleo escuro, sombra de contato pintada, soquete sem ponto preto,
  saia na penumbra (cor, sheen e especular), halos só dentro da copa.
- Saia: pano mais grosso com pregas macias, franzido baixo em gomos (sem o cilindro vermelho no tronco), veludo vinho
  com especular baixo (antes a luz rasante a deixava rosa-salmão), barra de pelúcia em rolo.
- Estrela: latão com quinas arredondadas, broto-guia por trás da luva (sem haste nua), lampejo sem cruz.
- Presentes: malha única, vincos de papel, faces estufadas, fitas com bainha, laços duplos virados para a frente
  (antes, de lado, liam como argolas de arame); kraft com carimbo de estrelinhas.
- Lâmpadas presas a frondes reais; fio que mergulha na copa entre lâmpadas distantes.
- Bolas: penduradas por ganchinho sob uma fronde, cor sorteada, foscas acetinadas (não pingue-pongue).
- Custo: bolas, laços, estrela e fitas fora da sombra e da oclusão; brilho das lâmpadas no vértice; presentes em uma
  malha só.
- Guirlanda: corpo mais gordo, raminhos curtos penteados no sentido da volta em três camadas, tinta neutra (o verde
  vem do atlas, como na árvore), cachos de seis bagas.

## O que ainda está fraco

- Muito de perto (câmera a menos de 1 m) o cartão em pé de algumas frondes ainda aparece como um risco de agulhas
  mais regular que o resto; e o fio, no topo, ainda faz um ou outro trecho reto no ar.
- Os laços de veludo (árvore e guirlanda) de muito perto mostram a bainha escura no corte em V e um sombreado
  um pouco liso, de cetim; à distância normal leem bem.
- A guirlanda não tem pinhas (só bagas).
- O pé da árvore no nível baixo é mais vermelho e mais claro que no alto (sem sombra de verdade, só a penumbra pintada).
- O custo do quadro alto com sombra e oclusão passa um pouco do orçamento de triângulos da peça (a folhagem entra
  de novo na passada de sombra, só com o leque deitado e parte das frondes).

Com mais tempo: segundo nível de detalhe de agulhas para close, pinhas modeladas (escamas instanciadas), impostor da
árvore para o nível baixo e um mapa de ambiente da sala pronta passado pela composição.
