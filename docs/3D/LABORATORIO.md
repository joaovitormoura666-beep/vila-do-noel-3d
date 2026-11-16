# Laboratório e fotos

O laboratório é uma página que monta cenas fixas da arte 3D, sem servidor e sem a lógica do jogo, para
fotografar e comparar. É assim que cada mudança visual é conferida. O guia técnico completo, com a
direção de arte, está em `lab/LEIA-ME.md`; aqui fica o resumo prático.

## Ligar o laboratório

```
npm run lab
```

Liga um servidor Vite em `http://127.0.0.1:5180` (porta fixa; se estiver ocupada, ele não sobe). A
configuração é `lab/vite.config.ts`: serve o projeto inteiro, sem recarregar sozinho ao salvar (recarregue
a página) e serve `public/assets/` direto do disco, então recursos baixados com o servidor ligado aparecem
na hora. Deixe esse terminal aberto.

Páginas servidas por ele:

| Endereço | O que é |
| --- | --- |
| `/lab/index.html?cena=sala&set=a` | Só o cenário (sem personagens). |
| `/lab/index.html?cena=vila&set=a` | Cenário, Noel, fila de gnomos com nomes e título. |
| `/lab/index.html?cena=estudio&mostrar=noel` | Palco neutro: as sete poses do Noel. |
| `/lab/index.html?cena=estudio` | Palco neutro: 18 gnomos (parados, andando, comemorando e segurando presente). |
| `/lab/index.html?cena=estudio&mostrar=presentes` | Os 12 presentes e a caixa (em construção). |
| `/lab/index.html?cena=sala&set=kit-presentes` | Estúdio próprio dos presentes, com luz parecida com a da sala A (em construção; parâmetros abaixo). |
| `/lab/index.html?cena=estudio&mostrar=modelo&url=assets/modelos/ArmChair_01.glb` | Confere um modelo baixado, com medidas e um boneco de 1,2 m como régua. |
| `/demo-sala.html` | A sala com os botões dos quatro efeitos. |
| `/jogo3d.html?demo=1` | O jogo 3D em demonstração (em construção). |

## Tirar fotos (`tools/shot.cjs`)

A ferramenta abre a página num Chromium sem janela (Playwright), espera ficar pronta, congela o tempo no
instante pedido e grava um PNG. Ela imprime uma linha JSON com o tempo de carga, chamadas de desenho,
triângulos e os erros do console.

**Antes da primeira vez**, instale o Playwright (ele não está no `package.json`):

```
npm install --no-save playwright
npx playwright install chromium
```

Se depois de um `npm install` o `shot.cjs` der `Cannot find module 'playwright'`, é porque o npm (versão 7 ou
mais nova) removeu o pacote que não está no `package.json`. Instale de novo com
`npm install --no-save playwright`.

**Desenho por software.** A ferramenta força o SwiftShader (`--use-gl=swiftshader`), que desenha sem placa
de vídeo. Isso vale em qualquer computador, inclusive no PC com Windows do dono, mesmo que ele tenha placa
de vídeo. Uma foto em 1080x1920 leva de 5 a 40 segundos, e o FPS medido ali não diz nada sobre o PC do
dono: para medir FPS de verdade, abra a página no Chrome, no Edge ou na fonte de navegador do OBS. Use
`--half` para rascunhos (quatro vezes menos pixels) e `--timeout 90` se a foto estourar o tempo.

### Exemplos

```
node tools/shot.cjs sala --param set=a --half --out lab/fotos/<area>/rascunho.png     rascunho 540x960
node tools/shot.cjs sala --param set=a --mini --out lab/fotos/<area>/final.png        1080x1920 e miniatura 270x480
node tools/shot.cjs sala --param set=a --clip 200,700,700,700 --out ...               recorte de um detalhe
node tools/shot.cjs sala --param set=a --t 2,8,14 --half --out ...                    três instantes (fogo, luzes, neve)
node tools/shot.cjs sala --param set=a --q baixa --half --out ...                     nível baixo (também --q media)
node tools/shot.cjs sala --param set=a --param fantasmas=1 --half --out ...           silhuetas do Noel (2,2 m) e de um visitante (1,2 m)
node tools/shot.cjs sala --param set=a --param efeito=SLEIGH_PASS --param progresso=0.5 --half --out ...
node tools/shot.cjs sala --param set=a --param tocar=TREE_SPARKLE --param aos=1 --t 1.5,3,6 --half --out ...
node tools/shot.cjs vila --param set=a --half --out ...                               sala com o Noel e a fila
node tools/shot.cjs vila --param set=a --estado entrega --half --out ...              momento da entrega
node tools/shot.cjs estudio --param mostrar=noel --half --out ...                     as poses do Noel
node tools/shot.cjs jogo3d.html --param manual=1 --param fila=8 --t 10 --half --out ...   o jogo 3D (em construção)
```

Salve sempre dentro de `lab/fotos/<sua-area>/`. Sem `--out`, a foto vai para `lab/fotos/<cena>.png`.

### Opções da ferramenta

| Opção | O que faz |
| --- | --- |
| `<cena>` | `sala`, `vila`, `estudio`, ou o nome de uma página da raiz terminada em `.html`. |
| `--t 6` | Instante em segundos (padrão 6). Aceita lista: `--t 2,6,12`. |
| `--out arquivo.png` | Destino. Com vários instantes vira `arquivo-t2.png` e assim por diante. |
| `--half` | Rascunho em 540x960. |
| `--mini` | Grava também a miniatura 270x480: como aparece no celular. Confira sempre. |
| `--clip x,y,l,a` | Recorta uma região, em pixels de projeto (1080x1920). |
| `--q baixa` | Nível de qualidade (`alta`, `media`, `baixa`). |
| `--estado revelacao` | Momento da cena `vila`: `fila` (padrão), `entrega`, `revelacao` ou `caixa`. |
| `--guias` | Desenha as zonas da live por cima (barra do TikTok, título, área de jogo, chat). Na sala A ele não apareceu nas fotos; as zonas foram conferidas por projeção numérica. |
| `--param chave=valor` | Parâmetro extra no endereço (pode repetir). |
| `--bench 12` | Mede o tempo médio de 12 quadros por software (só para comparar versões). |
| `--timeout 90` | Limite de cada passo, em segundos (padrão 30). |

### Parâmetros das cenas (`--param`)

| Parâmetro | Cena | O que faz |
| --- | --- | --- |
| `set=a`, `set=b`, `set=kit-arvore`... | sala, vila | Escolhe o cenário: `src/world/set-<nome>/`. Sem `set`, usa `src/world/set/` (o oficial); `set=provisorio` usa os blocos. |
| `cast=provisorio` | vila, estudio | Usa o elenco de blocos. |
| `cam=x,y,z,ax,ay,az,fov` | sala, estudio | Outra câmera só para a foto. |
| `ao=0` ou `ao=0.5,1` | sala | Desliga a oclusão de ambiente ou força raio e força. |
| `entrega=1` | sala | Liga o destaque da área de entrega. |
| `fantasmas=1` | sala | Silhuetas de escala nos lugares do Noel e do visitante. |
| `efeito=ID&progresso=0.5&intensidade=1` | sala, vila | Congela um efeito ambiente num ponto. |
| `tocar=ID1,ID2&aos=2` | sala, vila | Pede os efeitos à agenda no instante indicado. |
| `fila=12`, `andando=0` | vila | Tamanho da fila; tira o visitante que chega andando. |
| `presente=ursinho`, `escala=1.5` | vila | Presente mostrado na revelação ou na entrega. |
| `mostrar=visitantes\|noel\|presentes\|modelo` | estudio | O que mostrar. |
| `pose=wave`, `yaw=0.185`, `poltrona=1` | estudio (Noel) | Uma pose só; giro; a poltrona da sala junto (fotografe com `--t 1,6`). |
| `porLinha=6`, `linhas=3`, `semente=0` | estudio (gnomos) | Grade de gnomos e a semente inicial. |
| `luz=noite` | estudio | Luz noturna. |
| `url=a.glb,b.glb`, `girar=0` | estudio (modelo) | Modelos lado a lado; sem girar. |
| `mostrar=folha\|um\|varios\|caixa`, `presente=id[,id...]`, `medir=1` | sala com `set=kit-presentes` | Estúdio dos presentes: os 12 em folha (padrão), um de perto, alguns juntos, ou a caixa fechada e aberta; `medir=1` escreve no console os triângulos e as chamadas de cada presente. Outros (`giro`, `girar=1`, `escala`, `olho`, `abrir`, `rotulos=0`) no cabeçalho de `src/world/set-kit-presentes/index.ts`. |
| `numeros=1`, `planta=1`, `semchamas=1`... | estúdios de peça | Parâmetros de estudo de cada `set-kit-*` e da sala B (veja o cabeçalho do `index.ts` de cada um). |

O estúdio do acervo (`set=kit-acervo`) tem parâmetros próprios (`modelos=`, `texturas=`, `pisos=`, `luz=neutra`
e outros), descritos em `lab/acervo/CATALOGO.md`.

## Como conferir de verdade

1. Fotografe **antes** de mudar.
2. Mude uma coisa de cada vez.
3. Fotografe **depois**, com o mesmo enquadramento e o mesmo instante (`--t`).
4. Abra as duas imagens e compare. Olhe também a miniatura (`--mini`) e o nível baixo (`--q baixa`).
5. Confira a linha JSON: nenhum erro de console, chamadas e triângulos dentro do orçamento (`AGENTS.md`).
6. Anote na `NOTAS.md` da área o que mudou, os números e o que ficou fraco.

As fotos de trabalho são pesadas (a pasta `lab/fotos/` passa de 600 MB). O `.gitignore` já deixa de fora
todas as fotos (`lab/fotos/**/*.png`, `*.jpg`, `*.mp4` e `lab/acervo/*.png`); só as `NOTAS.md` e as
`CRITICA.json` vão para o GitHub. Não use `git add -f` para fotos (veja `AGENTS.md`, seções 10 e 11).

Por isso, num clone novo do repositório, as fotos citadas nas `NOTAS.md` (por exemplo `final-vila.png`) não
existem. Para comparar antes e depois, refaça a foto com o comando que a própria `NOTAS.md` traz, antes de
mudar qualquer coisa. As referências `lab/referencia-clima.png` e `lab/referencia-gnomo.png` (obras de
terceiros) também ficam fora do git: peça ao dono. As do Noel (`lab/referencia-noel-tripo.png` e
`lab/referencia-noel/`) vão no git.

## Simplificar um modelo que já está no projeto

`lab/acervo/ferramentas/simplificar.mjs` simplifica de novo um GLB que já está em `public/assets/modelos/`,
com mais tolerância de erro que o `tools/polyhaven.mjs`. Ele lê e grava `public/assets/modelos/<id>.glb`
(ou `<saida>.glb`) e não mexe nos créditos:

```
node lab/acervo/ferramentas/simplificar.mjs book_encyclopedia_set_01 --tri 5000 --erro 0.08 --tex 512
node lab/acervo/ferramentas/simplificar.mjs <id> --tri 60000 --tex 1024 --saida <id>-leve
```

Em malhas com esqueleto (um Noel em GLB, por exemplo), a simplificação pode estragar os pesos da pele:
confira a animação depois.

## Captura determinística

A cena sai igual em toda foto porque tudo é função do tempo `t` e de sementes. A página expõe
`window.__proto.freeze(t)` (avança em passos de 1/30 s até `t` e desenha), que a ferramenta usa. No jogo 3D,
`?manual=1` desliga o relógio e `window.__jogo3d.frame(dt)` avança a simulação, sem voz nem som.
