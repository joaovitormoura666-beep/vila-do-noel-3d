# Laboratório 3D da Vila do Noel

Este documento é o guia de quem trabalha na arte 3D e no motor do jogo. Leia inteiro antes de começar.

## O que estamos fazendo

A Vila do Noel é um jogo para lives verticais do TikTok (9:16, 1080x1920). Quem participa vira um
personagem com nome e foto, entra em uma fila visível, anda até o Papai Noel, ouve "Vamos ver qual é o
seu presente!" e recebe um presente decorativo com uma animação de revelação.

A primeira versão era 2D (veja `lab/referencia-2d.png`). O dono achou **"visualmente fraco"** e pediu 3D.
Depois definiu a direção de arte. O que vale agora, nas palavras dele:

> A referência agora é uma animação natalina clássica com inverno noturno, neve azulada, janelas com
> iluminação dourada e um contraste cinematográfico entre frio exterior e calor interior. Quero
> reconstruir o cenário principal como uma **sala natalina 3D encantada**. [...] Prioridade absoluta:
> qualidade artística, iluminação e fidelidade à atmosfera das referências.

E a exigência mais recente, que manda em tudo:

> **A prioridade é qualidade cinematográfica, não apenas conseguir construir os objetos em Three.js.
> Não quero paredes, lareira, móveis ou árvores com aparência de primitivas geométricas ou brinquedos
> de plástico.** Pode usar modelos 3D originais ou com licenças adequadas, materiais PBR, texturas de
> madeira, pedra, tecidos e iluminação dinâmica. Não precisa construir tudo exclusivamente por código.
> [...] Evite excesso de decoração e brilho artificial. Quero que o ambiente pareça um **cenário de
> animação cinematográfica, com materiais ricos, profundidade e atmosfera, não um jogo mobile genérico.**

**Primeira entrega (é só isto por enquanto):** uma cena de demonstração 3D, vertical 9:16, só com o
cenário. **Sem fila, sem presentes, sem interface e sem Papai Noel na cena**: o dono quer aprovar o
visual primeiro. A cena precisa ser bonita sozinha, sem personagens.

### A composição 9:16 pedida pelo dono

- Uma **lareira imponente em um dos lados** (não no centro), com fogo animado e luz dinâmica.
- **Uma janela grande** revelando o inverno azul-escuro (vila nevada à noite, neve caindo).
- Uma **árvore de Natal tradicional e volumosa**, com luzes individuais.
- Uma **área central reservada para o Papai Noel** (o modelo 3D do dono, que entra depois).
- **Espaço livre** para a aproximação dos visitantes (e, mais tarde, a fila).
- **A luz da lareira refletindo nos móveis e no chão.**
- Estrutura de madeira, tapete, móveis e objetos artesanais, **sem excesso de decoração**.
- Luz dourada quente dentro, azul fria fora.
- Duas composições estão sendo testadas, com a lareira, a janela e a árvore em posições diferentes
  e o mesmo padrão de qualidade.

### O que as referências mostram (análise aprovada pelo dono)

O vídeo de referência é uma coletânea de cenas de animações natalinas clássicas. Ele contém
personagens e cenários de obras existentes, então **serve só como referência de clima e luz: nada dele
pode ser copiado** (nenhum personagem, nenhuma cena, nenhuma composição reconhecível). Alguns quadros,
sem personagens, estão em `lab/referencia-clima.png`: olhe com a ferramenta Read para calibrar cor e
luz. O que extrair:

- **Atmosfera.** Véspera de Natal silenciosa. A emoção vem do contraste entre o frio azul da rua e o
  calor dourado de dentro de casa.
- **Luz de fora.** Quase monocromática em azul cobalto: céu azul quase preto, neve azul clara com
  sombras azul-escuras, pequenas poças de luz âmbar das janelas e dos lampiões sobre a neve, flocos
  grandes caindo devagar.
- **Luz de dentro.** Âmbar, mel e laranja, com sombras marrom-avermelhadas (nunca cinza ou preto). A
  luz nasce de pontos baixos e quentes (lareira, luminária), e a janela aparece como um recorte azul
  na parede quente. A árvore tem luzinhas individuais branco-quentes.
- **Materiais.** Piso de tábuas largas, vigas e estantes de madeira escura, pedra na lareira, tijolo,
  reboco creme, cortinas de veludo vermelho, guirlanda verde com laços vermelhos, tapete, poltrona
  estofada, louça em prateleiras, brinquedos artesanais ao pé da árvore.
- **Arquitetura lá fora.** Casas de telhado íngreme carregado de neve, janelas acesas, cercas, árvores
  nuas em silhueta, vila no vale com igrejinha, lampiões com halo.

### O Papai Noel do dono (só referência, não entra nesta entrega)

Veja `lab/referencia-noel-tripo.png` (quadros de um vídeo do modelo que o dono gerou). É um personagem
estilizado de animação 3D atual: corpo de pera, cabeça grande, óculos redondos dourados, barba em
mechas, casaco vermelho aveludado com pelo branco felpudo, cinto preto com fivela dourada. Os materiais
dele são ricos e táteis (veludo, pelúcia, couro, metal). **A sala precisa ter o nível de um cenário de
longa de animação em que esse personagem caberia**: materiais reais (madeira com veios e verniz gasto,
pedra com relevo, tecido com trama), proporções acolhedoras, luz de cinema. Não é low-poly, não é
brinquedo de plástico, não é jogo mobile; também não precisa ser fotografia: o "estilizado" vem da
composição, da cor e da luz, não de formas simplificadas. **Não coloque nenhum Papai Noel na cena**
(nem genérico, nem provisório): deixe o lugar dele reservado e evidente (tapete, poça de luz, a
poltrona grande dele ao lado), com 2,2 m de altura livres.

### Regras fixas

- Paleta base do briefing: vermelho `#B62835`, verde pinheiro `#174D3B`, dourado `#E8BC65`, neve
  `#F7F4EF`, azul noite `#17253B`. Os tons derivados (madeiras, âmbar, mel, azuis) são bem-vindos; a
  paleta orienta os acentos (veludo vermelho, verde da árvore e das guirlandas, dourado dos metais e da
  luz, branco da neve, azul da noite).
- **Recursos permitidos:** modelos e texturas do **Poly Haven** (licença CC0, uso livre), baixados com
  `tools/polyhaven.mjs`, mais geometria e shaders próprios. Nenhuma outra fonte: a rede só libera o Poly
  Haven, e nada pago ou de licença duvidosa entra. Cada recurso baixado fica registrado sozinho em
  `public/assets/CREDITOS.md`.
- **Originalidade:** nada que lembre personagem, cenário, jogo, filme ou marca existente. As referências
  são só clima.
- **Contenção:** poucos objetos, bem escolhidos e bem iluminados. Brilho (bloom) só no que realmente
  emite luz e com parcimônia. Nada de purpurina, néon, lens flare ou partículas por toda parte.
- Textos na tela em português do Brasil. Comentários do código em português, como no resto do projeto.

## Como o projeto está organizado

```
src/world/contracts.ts       contratos entre o jogo e a arte (LEIA: é a fonte da verdade)
src/world/kit/               peças compartilhadas da sala (árvore, lareira e fogo, exterior da janela...)
src/world/set-kit-<peça>/    cenário mínimo de estúdio para fotografar uma peça do kit sozinha
src/world/set-a/, set-b/     composições candidatas da sala (mesmo contrato, cada uma na sua pasta)
src/world/set/               cenário oficial do jogo (por enquanto os blocos; recebe a composição aprovada)
src/world/provisorio/        cenário e elenco de blocos, exemplos mínimos dos contratos (não edite)
src/engine/Stage.ts          palco: renderizador, câmera, oclusão, brilho, acabamento, qualidade
src/engine/assets.ts         carregadores: loadModel, loadPbr, loadTexture, loadEnvironment
tools/polyhaven.mjs          busca e baixa modelos, texturas e ambientes do Poly Haven
tools/shot.cjs               ferramenta de fotos
public/assets/               modelos (GLB), texturas (JPG) e créditos que vão junto com o jogo
lab/acervo/CATALOGO.md       catálogo do que já foi baixado, com fotos e medidas (se existir, leia)
lab/                         este laboratório (página, fotos, este guia)
```

Unidades em metros, Y para cima, câmera olhando de +Z para -Z. Visitante com perto de 1,2 m; Noel com
perto de 2,2 m (ele é grande e é o foco). `yaw` = rotação em Y, 0 = de frente para +Z.

A versão do three é a **0.187**. A API muda entre versões: confira assinaturas no código em
`node_modules/three/src` e `node_modules/three/examples/jsm` em vez de confiar na memória (por exemplo,
`PCFSoftShadowMap` não existe mais; o palco usa `PCFShadowMap`). `buildVillageSet` pode ser `async`.

## Modelos e texturas reais (Poly Haven, CC0)

```
node tools/polyhaven.mjs buscar armchair sofa --tipo models     procura (id, nome, etiquetas, triângulos, medidas)
node tools/polyhaven.mjs buscar stone wall --tipo textures
node tools/polyhaven.mjs info ArmChair_01                        dados completos de um recurso
node tools/polyhaven.mjs modelo ArmChair_01 --tri 12000 --tex 1024
      baixa, simplifica a malha até --tri triângulos (padrão 20000; só reduz se tiver mais), converte as
      texturas para WebP de até --tex pixels e grava public/assets/modelos/<id>.glb
node tools/polyhaven.mjs textura rustic_stone_wall --mapas diff,nor,arm,disp --res 1k
      grava public/assets/texturas/<id>/<mapa>.jpg (padrão diff,nor,arm; arm = oclusão, rugosidade e metal
      em um arquivo). A saída mostra o tamanho real em metros do ladrilho: use para acertar o `repeat`.
```

Os catálogos completos estão em `assets-src/catalogo/{models,textures,hdris}.json` (522 modelos, 869
texturas). Não há lareira nem árvore de Natal prontas no acervo: essas são peças do kit, construídas
com geometria própria e texturas reais.

No código (`src/engine/assets.ts`):

```ts
const poltrona = await loadModel('assets/modelos/ArmChair_01.glb');           // cópia; em metros, base em y = 0
const pedra = new THREE.MeshStandardMaterial({ ...(await loadPbr('rustic_stone_wall', { repeat: [2, 1.5] })) });
```

`loadPbr` devolve `map`, `normalMap` e, com `arm`, `aoMap` + `roughnessMap` + `metalnessMap` (deixe
`roughness: 1` e, se a superfície não for metal, `metalness: 0`). Com `maps: [..., 'disp']` vem o
`displacementMap`: em uma malha bem subdividida ele dá relevo de verdade no contorno das pedras.

Como ver um modelo antes de usar (medidas na etiqueta, boneco de 1,2 m ao lado como régua):

```
node tools/shot.cjs estudio --param mostrar=modelo --param url=assets/modelos/ArmChair_01.glb --param girar=0 --half --out lab/fotos/<sua-area>/poltrona.png
node tools/shot.cjs estudio --param mostrar=modelo --param url=assets/modelos/a.glb,assets/modelos/b.glb,assets/modelos/c.glb --param girar=0 --param luz=noite ...   (vários lado a lado)
```

Cuidados:

- **Simplificar estraga folhagem** (agulhas e folhas viram farrapos): para plantas, use `--tri` alto ou
  outra técnica. Móveis e objetos aguentam bem 4 a 15 mil triângulos.
- **Peso.** A prévia que o dono abre no navegador precisa carregar rápido: todos os recursos do cenário
  final somados devem ficar **abaixo de 40 MB**, nenhum arquivo acima de 10 MB. Texturas em 1k por
  padrão; 2k só em até três superfícies protagonistas (piso, pedra da lareira). Não baixe o que não vai
  usar e apague o que desistiu de usar (o arquivo e a linha em `CREDITOS.md`).
- Modelos baixados costumam vir com cara de fotografia de dia: **quem dá a unidade é a luz da sala**.
  Ajuste nos materiais só o necessário (`envMapIntensity`, um leve escurecimento ou aquecimento da cor).
- Quem usa o mesmo modelo várias vezes deve instanciar (`InstancedMesh`) ou ao menos compartilhar
  geometria e material (o `loadModel` já devolve cópias que compartilham).

## Como ver o que você fez

O servidor do laboratório já está ligado em `http://127.0.0.1:5180` (se cair: `cd /home/user/vila-do-noel-3d
&& nohup npm run lab > /tmp/lab.log 2>&1 &`). Não o reinicie sem necessidade: outras pessoas usam.
Arquivos novos em `public/assets/` aparecem na hora.

```
node tools/shot.cjs sala --param set=a --half --guias       rascunho rápido (540x960) com as zonas da tela desenhadas
node tools/shot.cjs sala --param set=a --mini               foto final 1080x1920 + miniatura 270x480
node tools/shot.cjs sala --param set=a --clip 200,700,700,700   recorte para olhar um detalhe de perto
node tools/shot.cjs sala --param set=a --t 2,8,14           três instantes (para conferir a animação: fogo, luzes, neve)
node tools/shot.cjs sala --param set=a --q baixa            nível de qualidade baixo (e --q media)
node tools/shot.cjs sala --param set=a --param fantasmas=1  silhuetas do Noel (2,2 m) e de um visitante (1,2 m) nos lugares reservados
node tools/shot.cjs sala --param set=a --param cam=2,1.6,6,0,1.2,0,30   outra câmera só para a foto (posição x,y,z, alvo x,y,z, fov)
node tools/shot.cjs sala --param set=a --param ao=0         sem a oclusão de ambiente (ou ao=0.5,1 para forçar raio e força)
node tools/shot.cjs sala --param set=a --param efeito=SLEIGH_PASS --param progresso=0.5   efeito especial congelado em um ponto
node tools/shot.cjs sala --param set=a --param tocar=TREE_SPARKLE --param aos=1 --t 1.5,3,6   efeito tocando pela agenda
node tools/shot.cjs vila --param set=a --half               sala com bonecos provisórios e fila de 12 (só para conferir se a fila cabe)
```

Depois de cada foto, **abra o PNG com a ferramenta Read e olhe de verdade**. A saída JSON traz chamadas
de desenho, triângulos e erros do console. Uma foto em 1080x1920 leva de 5 a 40 segundos (o desenho aqui
é por software, sem placa de vídeo); `--half` é quatro vezes mais rápido. Há outra pessoa fotografando
ao mesmo tempo: se uma foto falhar por tempo, tente de novo.

`set=a` usa `src/world/set-a/`; `set=b`, `src/world/set-b/`; `set=kit-arvore`, `src/world/set-kit-arvore/`;
sem `set`, `src/world/set/`; `set=provisorio`, os blocos. A cena `sala` mostra só o cenário, que é a
entrega atual. `entrega=1` liga o destaque da área de entrega.

Salve as fotos dentro de `lab/fotos/<sua-area>/` com `--out`.

Conferência de tipos: `npx tsc --noEmit` (TypeScript estrito, com `noUnusedLocals` e
`noUnusedParameters`). Outras pessoas editam outras pastas ao mesmo tempo, então olhe só os erros dos
seus arquivos. Não edite arquivos fora da sua área; se precisar de uma mudança em um contrato ou em um
arquivo comum, anote no seu relatório em vez de mudar.

## A tela da live

Zonas em pixels de projeto (use `--guias` para ver). Nesta entrega não há interface, mas a sala já
precisa ser composta para ela:

- 0 a 190: barra do TikTok. Nada importante (teto, vigas).
- 190 a 420: aqui ficará o título do jogo. Pode ter cenário (vigas, alto da janela, topo da árvore),
  mas nada que brigue com um letreiro.
- 430 a 1480, de x 60 a 1020: **área de jogo**. O Noel, a entrega e, depois, a fila precisam caber
  aqui. A lareira, a janela e a árvore, que são as estrelas desta entrega, também aparecem nesta faixa.
- 1480 a 1920: o chat e os botões do TikTok cobrem. Só piso e objetos de primeiro plano.

O público vê isso em um celular, pequeno: confira sempre a miniatura (`--mini`).

## Qualidade cinematográfica: como chegar lá

**1. Materiais ricos, sem primitivas.** O que denuncia uma "demo de three.js" é caixa lisa, cilindro
liso, cor chapada e aresta viva. Regras práticas:

- Toda superfície grande usa um conjunto PBR real (cor + normal + rugosidade/oclusão), com a escala
  certa (o `repeat` calculado a partir do tamanho real do ladrilho) e sem repetição evidente (gire ou
  desloque as UV entre peças, misture duas texturas, escureça com cor de vértice).
- Arquitetura com espessura e montagem de verdade: tábuas e vigas separadas com chanfro e folga, pedras
  com relevo no contorno (deslocamento em malha subdividida, ou pedras modeladas uma a uma), rodapé,
  moldura, peitoril, caixilho com perfil, verga sobre a janela, lajota na base da lareira. Arestas
  sempre chanfradas ou arredondadas (um brilho fino na quina é o que faz o material parecer real).
- Móveis e objetos: modelos reais do acervo. O que for construído à mão (lareira, janela, árvore,
  cortina, tapete, guirlanda, meias) precisa do mesmo nível: silhueta irregular, dobras, espessura,
  textura real por cima.
- Tecidos com trama e queda (veludo, lã, feltro); metais com reflexo (latão dos castiçais); vidro com
  reflexo sutil e geada nos cantos; madeira encerada com brilho baixo e variado.

**2. Luz de cinema.** A luz é o assunto do quadro.

- A **lareira é a luz principal**: âmbar, baixa, lateral, tremulando de forma orgânica (dois ou três
  ruídos somados, nunca um seno regular), **projetando sombras longas** dos móveis pelo piso. O piso
  encerado e os móveis **refletem o fogo**: rugosidade baixa e variada no piso, mais um mapa de ambiente
  gerado da própria sala (`PMREMGenerator.fromScene` ou `CubeCamera`, depois de montada e com o fogo
  aceso) entregue em `VillageSet.environment`, com a força em `look.environmentIntensity`.
- O **azul entra só pela janela**: luar desenhando no piso e nos móveis o recorte da janela com as
  travessas (luz com sombra passando pelo caixilho), a parede em volta esfriando.
- A árvore, as velas e uma ou duas luminárias dão os acentos; um preenchimento quente bem baixo mantém
  as sombras marrom-avermelhadas em vez de pretas. Onde a luz não chega, escurece com cor.
- Profundidade: planos em camadas (primeiro plano escuro em silhueta, meio iluminado, fundo com a
  janela), neblina leve de interior, poeira dourada discreta no facho do fogo, vinheta suave.
- `look.ao` (oclusão de ambiente, só no nível alto) assenta os móveis e marca os cantos; `look.bloom`
  com limiar alto e força baixa; `look.finish` para vinheta, separação quente e frio e granulado fino.
  Exposição e tone mapping escolhidos olhando a foto: sem áreas estouradas, sem preto chapado.

**3. Composição.** Lareira de um lado, a janela grande como o grande recorte frio, a árvore como a
terceira massa, o centro limpo para o Noel, piso livre embaixo. Câmera de cinema: lente média a longa
(FOV 24 a 36), altura de um adulto ou pouco acima, leve mergulho. A tela é muito alta: o pé-direito com
vigas preenche o alto; o piso com o tapete e as sombras longas preenche a base. O olho deve cair no
fogo, passear pela árvore e descansar na janela. Tem de ser bonito **sem personagens**.

**4. Vida, com contenção.** Fogo vivo (chamas em camadas com shader, brasas, faíscas raras subindo),
luzinhas da árvore pulsando devagar cada uma no seu ritmo, neve lá fora, uma vela, talvez um pêndulo.
Tudo em função de `t` e `dt` (sem `setTimeout`, sem `Date.now`, sem `Math.random` durante a animação;
use gerador com semente para a disposição, para a cena sair igual em toda foto).

**5. Acabamento.** Sem z-fighting, sem objetos flutuando ou enterrados, sem vazamento de luz pelas
paredes, sem "acne" ou serrilhado de sombra, sem texturas esticadas ou borradas, sem repetição visível,
sem cantos vazios nem entulhados.

## Orçamento de desempenho

A meta é 60 FPS em um PC comum com o OBS aberto. No nível `alta`, para o cenário sozinho (depois ainda
entram o Noel, até 13 visitantes e os efeitos):

- até cerca de 300 chamadas de desenho e 900 mil triângulos (a árvore pode levar um terço disso);
- até **duas luzes com sombra** (a do fogo, em spot apontado para a sala, e a do luar pela janela), com
  mapas de até 2048; nenhuma sombra de luz pontual (custa seis desenhos);
- até 10 luzes em tempo real no total; o resto se resolve com emissivo, mapa de ambiente e "poças de
  luz" pintadas (textura ou cor de vértice);
- muitos objetos iguais = `InstancedMesh`; geometria estática de mesmo material = `mergeGeometries`;
  partículas = um único `Points` ou `InstancedMesh` animado no shader;
- materiais compartilhados; poucos planos transparentes grandes.

`setQuality('media' | 'baixa')` precisa reduzir de verdade: em `media`, uma sombra só e menos
partículas; em `baixa`, sem sombras e sem luzes supérfluas. O palco já baixa a resolução e, em `baixa`,
desliga oclusão, brilho e acabamento: a cena precisa continuar bonita assim.

## Relatório

Ao terminar, escreva `lab/fotos/<sua-area>/NOTAS.md`: o que foi feito, quais recursos baixados foram
usados, o que ficou fraco, números do quadro e peso dos arquivos, e o que mudaria com mais tempo. Seja
honesto: quem vem depois decide com base nisso.
