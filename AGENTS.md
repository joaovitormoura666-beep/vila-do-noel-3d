# AGENTS.md: regras e mapa para agentes de código

Este arquivo é lido por agentes de código (Claude Code, Copilot, Codex e outros) antes de mexer no
projeto. Leia inteiro. Depois leia `docs/3D/LEIA-PRIMEIRO.md` e, se for mexer na arte 3D,
`lab/LEIA-ME.md`. Antes de mudar qualquer coisa, rode `git status` e leia a seção 12 (trabalho em
andamento): partes do jogo 3D ainda estavam sendo feitas quando a sessão anterior parou.

## 1. O que é o projeto

**Vila do Noel Live** é um jogo natalino para lives verticais (9:16, 1080x1920) do TikTok. Quem
participa da live vira um personagem com nome e foto de perfil. O personagem entra numa fila visível,
anda até o Papai Noel, ouve "Vamos ver qual é o seu presente!" e recebe um presente decorativo com uma
animação de revelação. Depois comemora e vai embora, liberando a vez do próximo.

Há duas versões no mesmo repositório:

- **Versão 1.0, em 2D (Phaser 3.90).** Funciona de ponta a ponta: servidor de eventos, painel de
  controle, simulador, testes. O dono achou o visual fraco e mantém essa versão como arquivo e como
  fonte da lógica que já funciona (fila, regras, frases, áudio). Página: `classico.html` (era o
  `index.html` até 16/11/2026).
- **Versão 3D (Three.js 0.187), em construção.** Uma sala natalina encantada com o Noel do dono
  sentado numa poltrona, gnomos visitantes e presentes 3D. A sala e os quatro efeitos ambientes estão
  prontos; o jogo 3D jogável (`index.html` = `jogo3d.html`, `src/jogo3d/`) teve o visual aprovado pelo dono em
  16/11/2026 e virou a tela principal da live (`/` e `/?obs` no servidor local).

Papéis: o **dono** opera a conta do TikTok, roda tudo no PC com Windows e aprova o visual; o
**ChatGPT** faz a direção criativa; o **Claude** (e outros agentes) faz a engenharia de software. O
dono não é programador: explique o que fez em português simples.

## 2. Regras que não podem ser quebradas

Estas regras vêm do dono e do briefing. Se uma tarefa parecer exigir quebrar uma delas, pare e
pergunte.

1. **Idioma.** Tudo em português do Brasil: textos na tela, documentação, mensagens de commit e
   comentários do código. Frases completas e claras. Nomes de API e de bibliotecas ficam como são.
2. **Qualidade cinematográfica.** Nada com cara de primitiva geométrica (caixa lisa, cilindro liso,
   cor chapada, aresta viva) nem de brinquedo de plástico. O padrão é um cenário de longa-metragem de
   animação: materiais PBR ricos, luz de cinema, profundidade, contenção na decoração e no brilho.
   Blocos provisórios já foram rejeitados pelo dono; não os use como entrega.
3. **Arte original e recursos gratuitos.** A arte é original. Modelos, texturas e ambientes de
   terceiros: só do **Poly Haven (licença CC0)**, baixados com `tools/polyhaven.mjs`, que registra os
   créditos em `public/assets/CREDITOS.md`. Fontes só com licença livre (hoje a Fredoka, licença
   OFL 1.1, pelo pacote `@fontsource/fredoka`). Bibliotecas só de código aberto, instaladas pelo npm.
   Nenhuma imagem, modelo, música ou fonte protegida. Referências (filmes,
   vídeos, o exemplo de estilo dos gnomos) servem só como clima: nada pode ser copiado nem lembrar um
   personagem, cenário ou marca existente.
4. **Nenhum serviço pago.** Nada que exija assinatura, chave paga ou conta paga para funcionar.
5. **Presentes são só animação.** Sem valor em dinheiro, sem sorteio de prêmio, sem resgate, sem
   moeda. (No código, "sorteio" é só o gerador de números com semente, `src/jogo3d/sorteio.ts`.)
6. **Participação gratuita sempre.** Manter uma forma gratuita de entrar na fila pelo chat (comandos
   `!presente`, `!noel`, `!fila`), além dos presentes do TikTok.
7. **TikTok real só depois da aprovação visual.** Não integrar com a live real antes de o dono
   aprovar o visual 3D. Não presuma acesso irrestrito à API oficial do TikTok. O ponto de encaixe
   futuro é `server/integrations/LiveSource.ts` (veja `docs/INTEGRACAO.md`).
8. **Decisões criativas importantes são do dono e da direção criativa.** Título, presentes, frases,
   ritmo, voz, composição, estilo dos personagens: proponha e pergunte. Não decida sozinho. As
   perguntas em aberto estão em `docs/3D/PROXIMOS-PASSOS.md`.
9. **Meta de 60 FPS no Windows com o OBS aberto.** Respeite o orçamento de desempenho (seção 7).
10. **Camada visual separada da camada de eventos.** O jogo conversa com a arte só pelos contratos de
    `src/world/contracts.ts`. A arte não conhece fila, servidor nem TikTok; a lógica não conhece malhas.
11. **Não descartar a lógica que funciona.** O 2D e o servidor funcionam e têm testes. O 3D reaproveita
    a fila, as regras, as frases, os presentes, o áudio e a conexão do 2D. Não reescreva nem apague
    isso; acrescente ao lado.
12. **O Noel é o modelo do dono.** O Papai Noel é o personagem que o dono criou (referências em
    `lab/referencia-noel-tripo.png` e `lab/referencia-noel/`), refeito em 3D em
    `src/world/cast/noel/`. Nunca troque por um Noel genérico, nem provisório. Ele fica **sentado** na
    poltrona grande (o trono). Um GLB do dono pode substituí-lo no futuro (veja
    `docs/3D/PERSONAGENS.md`).

## 3. Mapa do código

```
AGENTS.md, CLAUDE.md     regras para agentes (este arquivo)
README.md                manual do jogo 2D para o dono (outro trabalho cuida dele)
.env.demo                só VITE_AUTONOMO=1, usado por npm run demo (sem segredo, vai no git)
index.html               tela da live: o jogo 3D (src/jogo3d/main.ts), servida em / pelo servidor
classico.html            versão clássica 2D (Phaser), em /classico.html
painel.html              painel de controle (serve ao 2D e ao 3D)
demo.html                demonstração 2D sem servidor (npm run demo)
demo-sala.html           sala 3D sozinha com botões dos quatro efeitos (npm run sala)
jogo3d.html              a mesma página do index.html (endereço antigo, usado pelo laboratório e pelas ferramentas)
iniciar.bat              atalho do Windows: confere o Node, npm install só quando precisa, npm start, abre o painel
parar.bat                encerra o servidor da Vila do Noel (só ele)
abrir-janela-da-live.bat janela própria do Edge/Chrome em 9:16 para a captura de janela do TikTok LIVE Studio
                         (os três .bat usam tools/windows.cjs; passo a passo em docs/COMO-RODAR-NA-LIVE.md)

shared/                  tipos usados pelo servidor e pelas telas
  types.ts               eventos da live, participante, configurações (DEFAULT_SETTINGS)
  ambient.ts             os quatro efeitos ambientes e a configuração padrão deles
  simAvatar.ts           fotos de perfil fictícias em SVG para o simulador
server/                  servidor Node (20 ou mais novo; 22 LTS recomendado) + ws
  index.ts, app.ts       liga o servidor; rotas HTTP, WebSocket /ws, senha do painel, POST /api/evento
  config.ts, env.ts      configuração do ambiente; env.ts lê o arquivo .env sem pacote extra
  security.ts            origens permitidas, senhas, limites de conexão e de tamanho
  avatars.ts             repassa as fotos de perfil, só de hosts permitidos (AVATAR_HOSTS_PERMITIDOS)
  static.ts              entrega os arquivos das páginas quando o servidor também serve o front
  EventHub.ts, rules.ts, dedup.ts, settingsStore.ts
                         eventos, regras de quem entra na fila, duplicados, configurações do painel
  integrations/          fontes de eventos: simulador e o esboço do TikTok (não ativo)
src/                     telas, em TypeScript
  2D (Phaser):           main.ts, config.ts, render/, characters/, santa/Santa.ts, ui/,
                         animations/, queue/QueueDirector.ts, effects/Snow.ts,
                         standalone.ts (demonstração 2D sem servidor, npm run demo)
  lógica comum 2D e 3D:  queue/QueueManager.ts (fila), events/ (barramento, conexão e
                         localSimulator.ts, o visitante fictício das teclas R e D),
                         settingsState.ts, gifts/giftCatalog.ts (12 presentes),
                         santa/phrases.ts (frases), audio/ (voz, música, efeitos),
                         effects/PerformanceMonitor.ts (qualidade automática),
                         ambient/AmbientDirector.ts (agenda dos efeitos ambientes)
  admin/                 código do painel de controle
  engine/                motor 3D: Stage.ts (palco), assets.ts (carregadores), Path3.ts (caminhos)
  world/                 arte 3D
    contracts.ts         CONTRATOS entre o jogo e a arte (fonte da verdade)
    kit/                 peças da sala: lareira, arvore, janela, exterior, tecidos, estudio.ts;
                         tipos.ts traz as convenções comuns das peças
    set-a/               composição A da sala (a escolhida pelo dono)
    set-b/               composição B (não escolhida; fica como referência)
    set/                 cenário oficial do jogo: hoje reexporta set-a
    set-kit-*/           estúdios para fotografar uma peça sozinha: kit-lareira, kit-arvore,
                         kit-janela, kit-exterior, kit-acervo e kit-presentes (os 12 presentes e a caixa)
    cast/                elenco: noel/, gnomos/, presentes/ (em construção), index.ts;
                         noel/util.ts e gnomos/util.ts têm o sorteio com semente e o ruído
    provisorio/          blocos de exemplo dos contratos (não edite, não entregue)
  jogo3d/                jogo 3D jogável (em construção)
  demo/sala.ts           código da página demo-sala.html
lab/                     laboratório 3D: página de fotos, guia (LEIA-ME.md), fotos e acervo
  acervo/ferramentas/simplificar.mjs   simplifica de novo um GLB que já está em public/assets/modelos/
tools/                   shot.cjs (fotos), polyhaven.mjs (baixar recursos CC0)
public/assets/           modelos GLB, texturas e CREDITOS.md que vão com o jogo
public/audio/            frases gravadas e música opcionais do dono
tests/                   testes automáticos (Vitest); tests/jogo3d.test.ts é do jogo 3D (em construção)
deploy/                  modelos e scripts para separar back-end (VM) e front-end (Cloudflare);
                         deploy/backend/.env.example é o modelo comentado de todas as configurações
docs/                    documentos do 2D; docs/3D/ documentos do 3D
```

Unidades da arte 3D: metros, Y para cima, câmera olhando de +Z para -Z, `yaw` 0 de frente para +Z.

## 4. Comandos

Todos rodam na pasta do projeto (no Windows, no terminal do VS Code). Rode `npm install` uma vez antes.

| Comando | O que faz |
| --- | --- |
| `npm install` | Instala as dependências. |
| `npm run lab` | Liga o laboratório 3D em `http://127.0.0.1:5180` (porta fixa). Serve `lab/index.html`, `demo-sala.html` e `jogo3d.html`. |
| `npm run sala` | Gera em `dist-sala/` a página estática da sala 3D com os efeitos. |
| `npm start` | Compila o jogo 3D (tela principal), o 2D clássico e o painel e liga o servidor em `http://localhost:3000` (é o que o `iniciar.bat` usa). |
| `npm run servidor` | Liga só o servidor (sem compilar as páginas). |
| `npm run dev` | Servidor + Vite em `http://127.0.0.1:5173`, recarregando ao salvar. |
| `npm test` | Roda os testes (Vitest). Todos precisam passar. (O número muda a cada etapa: em 16/11/2026, por volta de 03:37 UTC, eram 7 arquivos e 102 testes, contando o novo `tests/jogo3d.test.ts`.) |
| `npm run typecheck` | Confere os tipos (`tsc --noEmit`). |
| `npm run build` | Compila em `dist/` o jogo 3D, o 2D clássico e o painel (e copia `public/`). |
| `npm run demo` | Gera a demonstração 2D sem servidor em `dist-demo/`. |
| `npm run pacotes` | Gera em `pacotes/` o back-end para a VM e o front-end para a Cloudflare. Também `npm run pacote:backend` e `npm run pacote:frontend`. |
| `node tools/shot.cjs <cena> ...` | Fotografa uma cena do laboratório (veja `docs/3D/LABORATORIO.md`). |
| `node tools/polyhaven.mjs ...` | Procura e baixa recursos CC0 do Poly Haven (veja `docs/3D/RECURSOS-E-LICENCAS.md`). |
| `node tools/gravar-jogo3d.cjs ...` | Grava quadro a quadro um vídeo vertical do jogo 3D (MP4 com trilha e capa); uso no cabeçalho do arquivo. Precisa do laboratório ligado. |
| `npx vite build -c vite.jogo3d.config.ts` | Gera em `dist-jogo3d/` a demonstração estática do jogo 3D (sem servidor, caminhos relativos, só os recursos que o jogo usa, listados em `vite.jogo3d.recursos.json`; refaça a lista com `node tools/listar-recursos-jogo3d.cjs`). |

Endereços úteis com `npm run lab` ligado:

- `http://127.0.0.1:5180/demo-sala.html`: a sala com os botões dos quatro efeitos.
- `http://127.0.0.1:5180/lab/index.html?cena=sala&set=a`: o laboratório (parâmetros em `lab/LEIA-ME.md`).
- `http://127.0.0.1:5180/jogo3d.html?demo=1`: o jogo 3D em demonstração (em construção).

Configurações do servidor: no PC não precisa de nenhuma. Na VM, ficam num arquivo `.env` (que nunca vai
para o git). O modelo comentado é `deploy/backend/.env.example`: as obrigatórias são `TOKEN_ADMIN`,
`ORIGENS_PERMITIDAS`, `PORT`, `HOST` e `DATA_DIR`; as opcionais incluem `TOKEN_TELA`, `TOKEN_EVENTOS`,
`SERVIR_FRONT`, `PASTA_FRONT`, `AVATAR_HOSTS_PERMITIDOS`, `PROXY_CONFIAVEL` e os limites de conexão.
Leia o significado de cada uma no próprio modelo, não aqui.

## 5. Como conferir o visual

O visual só conta depois de olhado. O fluxo é: fotografar antes, mudar, fotografar depois, abrir as
duas imagens e comparar.

- O laboratório precisa estar ligado (`npm run lab`, porta 5180). Não o reinicie sem necessidade se
  outra pessoa estiver usando.
- `node tools/shot.cjs sala --param set=a --half --out lab/fotos/<area>/<nome>.png` tira um rascunho
  rápido (540x960). Sem `--half` sai em 1080x1920; com `--mini` sai também a miniatura de celular.
- A ferramenta usa o Playwright com o Chromium e desenha por **software (SwiftShader)**: ela força
  `--use-gl=swiftshader` sempre, até no PC do dono com placa de vídeo. Uma foto leva de 5 a 40 segundos e
  o FPS medido ali não vale nada. Para medir FPS de verdade, abra a página no Chrome, no Edge ou na fonte
  de navegador do OBS. Use `--timeout 90` se estourar o tempo.
- O Playwright não está no `package.json`. Instale sem alterar o arquivo:
  `npm install --no-save playwright` e `npx playwright install chromium`.
- Se o `shot.cjs` der `Cannot find module 'playwright'` depois de um `npm install`, é porque o npm
  (versão 7 ou mais nova) remove o pacote que não está no `package.json`. Instale de novo com
  `npm install --no-save playwright`.
- Um clone novo do repositório **não tem as fotos** (`lab/fotos/**/*.png`, as fotos de `lab/acervo/`) nem
  `lab/referencia-clima.png` e `lab/referencia-gnomo.png`. Quando uma `NOTAS.md` mandar abrir uma foto
  (por exemplo `final-vila.png`), refaça a foto com o comando que a própria `NOTAS.md` traz. As duas
  referências de terceiros ficam só no computador do dono ou na pasta compartilhada: peça a ele.
- Depois de cada foto, abra o PNG e olhe de verdade (um agente com leitura de imagens deve abri-lo).
  A saída JSON traz chamadas de desenho, triângulos e erros do console: erros de console são defeito.
- Detalhes e todos os parâmetros: `docs/3D/LABORATORIO.md` e `lab/LEIA-ME.md`.

## 6. Recursos (modelos e texturas)

- Só do Poly Haven, CC0, com `tools/polyhaven.mjs` (exemplos em `docs/3D/RECURSOS-E-LICENCAS.md`).
  Cada download é anotado sozinho em `public/assets/CREDITOS.md`.
- Antes de baixar, procure no acervo: `lab/acervo/CATALOGO.md` lista o que já existe, com medidas e
  fotos.
- Peso: todos os recursos do cenário final somados abaixo de 40 MB, nenhum arquivo acima de 10 MB.
  Texturas em 1k por padrão; 2k só em até três superfícies protagonistas.
- Apague o que desistiu de usar (o arquivo e a linha em `CREDITOS.md`).

## 7. Orçamento de desempenho

Meta: 60 FPS num PC comum com Windows e o OBS aberto. Números para o nível `alta`:

- Cenário sozinho: até cerca de 300 chamadas de desenho e 900 mil triângulos.
- Até **duas luzes com sombra** (fogo e luar), mapas de até 2048; nenhuma sombra de luz pontual.
- Até 10 luzes em tempo real no total. **Exceção registrada:** em 16/11/2026 a sala A tem 11 luzes com a
  entrega acesa ou apagada (desde a segunda rodada do jogo 3D o destaque da entrega fica sempre na conta, com
  força zero quando apagado, para não recompilar os materiais na primeira entrega), porque o jogo 3D acrescentou
  o spot de preenchimento da fila
  (`LUZ.fila` em `src/world/set-a/ajustes.ts`; cabeçalho de `src/world/set-a/luzes.ts`). Não acrescente
  outra luz sem tirar uma; se for preciso voltar a 10, combine com quem cuida da sala e fotografe a fila.
- Objetos repetidos com `InstancedMesh`; geometria estática do mesmo material com `mergeGeometries`;
  partículas num único `Points` ou `InstancedMesh`.
- Materiais e geometrias compartilhados entre cópias (gnomos, presentes).
- Um visitante atendido por vez; até 13 personagens na tela; montar no máximo um gnomo novo por quadro.
- `setQuality('media' | 'baixa')` precisa reduzir de verdade (menos sombras, partículas e luzes).
  O palco (`src/engine/Stage.ts`) baixa a resolução (alta 1, média 0,8, baixa 0,64). A oclusão (GTAO) e o
  MSAA só existem em `alta`; em `baixa` saem também o brilho e o acabamento. A qualidade automática
  (`src/effects/PerformanceMonitor.ts`) troca o nível pelo FPS.

Medidas anotadas (laboratório, sala A, por software). Atenção às datas: elas foram tiradas **antes** dos
ajustes que o jogo 3D fez na sala (entrega mais à direita, revelação mais baixa, luz da fila) e precisam
ser refeitas:

- cenário sozinho: 167 chamadas e cerca de 860 mil triângulos em `alta` (`lab/fotos/sala-a/NOTAS.md`, 16/11
  por volta de 01:26 UTC);
- sala com o Noel e 13 gnomos: cerca de 370 chamadas e 1,41 milhão de triângulos; a mesma nota diz que
  "a sala sozinha" dá cerca de 252 chamadas e 1,14 milhão (`lab/fotos/gnomos/NOTAS.md`, 16/11 por volta de
  02:32 UTC). Essa nota não detalha o que entrou nessa conta, e ela não bate com os 167 da nota da sala:
  as duas medições foram feitas em cenas e momentos diferentes. Refaça antes de usar qualquer um dos dois.

O FPS em placa de vídeo real ainda não foi medido.

## 8. Convenções de código

- **TypeScript estrito** (`strict`, `noUnusedLocals`, `noUnusedParameters`). Rode `npm run typecheck`.
- **Comentários em português**, explicando o porquê. Cada arquivo começa com um comentário dizendo o que
  ele faz.
- **Sem alocação por quadro.** Nada de `new THREE.Vector3()` dentro de `update`: use temporários de
  módulo ou do objeto.
- **Descarte (`dispose`).** Quem cria geometria, material, textura ou alvo de render libera. Cópias que
  compartilham geometria e material não descartam o que é compartilhado (veja `src/engine/assets.ts` e
  `src/world/cast/presentes/index.ts`).
- **Determinismo por semente.** Disposição e variação vêm de um gerador com semente (mulberry32 com hash
  FNV, como em `src/jogo3d/sorteio.ts`). Durante a animação: nada de `Math.random`, `Date.now`,
  `setTimeout` ou `setInterval` na arte. Tudo em função de `update(dt, t)`.
- **Contratos em `src/world/contracts.ts`.** Cenário (`VillageSet`), elenco (`Cast`, `SantaRig`,
  `VisitorRig`, `GiftBox`), poses e efeitos. Mudar um contrato afeta o jogo inteiro: proponha antes.
- Three.js é a **0.187**: confira assinaturas em `node_modules/three/src` e
  `node_modules/three/examples/jsm` em vez de confiar na memória.
- Números ajustáveis ficam em arquivos de ajustes (`set-a/ajustes.ts`, `cast/noel/medidas.ts`,
  `jogo3d/config.ts`), não espalhados no código.

## 9. Fluxo de trabalho esperado

1. Leia este arquivo, `docs/3D/LEIA-PRIMEIRO.md` e as `NOTAS.md` da área (`lab/fotos/<area>/NOTAS.md`).
   Rode `git status` e `git log --oneline -5` para saber o que mudou desde a última nota. Quando um
   número de uma `NOTAS.md` não bater com o código, vale o código.
2. Fotografe o estado atual antes de mudar a arte.
3. Faça a mudança dentro da sua área. Se precisar mudar um contrato ou um arquivo comum, anote e pergunte.
4. Rode `npm run typecheck` e `npm test`. Os dois precisam passar.
5. Fotografe depois, em `alta` e também em `--q baixa`, e compare.
6. Atualize a `NOTAS.md` da área (o que mudou, números, o que ficou fraco) e os documentos de `docs/3D/`
   que ficaram desatualizados. Todo número copiado de uma medição leva a data (e, se possível, a hora
   UTC), para o próximo agente saber se é de antes ou de depois de uma mudança.
7. Explique ao dono, em português simples, o que mudou e o que ele precisa olhar ou decidir.

## 10. O que NÃO fazer

- Não commitar `node_modules/`, `assets-src/` (originais baixados, 27 MB), `data/` (configurações do
  painel), `.env` (senhas), `dist/`, `dist-demo/`, `dist-sala/`, `pacotes/` (gerados) nem as fotos
  pesadas de `lab/fotos/` e `lab/acervo/` (centenas de MB). O `.gitignore` já deixa de fora essas pastas,
  as fotos (`lab/fotos/**/*.png`, `*.jpg`, `*.mp4`, `lab/acervo/*.png`) e as duas referências de terceiros
  (`lab/referencia-clima.png`, `lab/referencia-gnomo.png`). Das fotos, vão para o git só as `NOTAS.md` e
  as `CRITICA.json`. Não use `git add -f` para fotos, a não ser que o dono peça uma `final-*.png`
  específica, e nunca para `.env`.
- Não colocar segredos (senhas, chaves, `TOKEN_ADMIN`) em código ou documentos.
- Não trocar o Noel do dono por um genérico, nem colocar um Noel provisório na cena.
- Não usar imagens, modelos, músicas ou fontes protegidas, nem copiar personagens de filmes.
- Não ligar o TikTok real, não adicionar serviço pago, não criar mecânica com valor em dinheiro.
- Não apagar o jogo 2D nem a lógica do servidor.
- Não editar `src/world/provisorio/` nem entregar blocos como arte.

## 11. Git e GitHub

- O código já está num **repositório privado no GitHub**, ramo `main`. O primeiro envio foi em 16/11/2026,
  por volta de 03:21 UTC (commit `b5f8b18`), seguido do commit da separação back-end/front-end
  (`51d097e`).
- Para continuar no VS Code: Controle do Código-Fonte → Clonar repositório (ou `git clone`), depois
  `npm install`. O endereço do repositório não fica nestes documentos: pegue com o dono ou no
  `CONTINUAR-NO-VSCODE.md` da pasta compartilhada do projeto. Não copie esse endereço (ele tem o login do
  dono) para nenhum arquivo do repositório.
- Mensagens de commit em português do Brasil, dizendo o que mudou e por quê (o histórico já é assim).
- Quando houver mais de um agente trabalhando, cada um usa o seu ramo (por exemplo `jogo3d-entrega`) e
  não commita direto no `main`. Só envie (`git push`) ou junte ramos quando o dono pedir.
- Antes de cada commit: `npm run typecheck` e `npm test`, os dois passando. Confira com `git status` que
  nenhuma foto, `.env`, `data/`, `assets-src/` ou pasta gerada entrou.
- Nunca use `git add -f` em fotos nem em `.env`.
- Um clone novo não traz as fotos de trabalho nem as duas referências de terceiros (seção 5). O zip
  `vila-do-noel-3d-codigo.zip` da pasta compartilhada também não traz as fotos.

## 12. Trabalho em andamento (situação em 16/11/2026, por volta de 03:38 UTC)

Quando estes documentos foram escritos, outros trabalhos ainda estavam mexendo no código. Não suponha que
eles terminaram: confira com `git status` e `git log`.

- **Jogo 3D** (`jogo3d.html`, `src/jogo3d/`): em construção. Havia mudanças ainda não commitadas em
  `src/jogo3d/CamadaNomes.ts`, `src/jogo3d/Entrega3D.ts` e `src/jogo3d/config.ts`; o arquivo de testes
  `tests/jogo3d.test.ts` ainda estava fora do git; a pasta `lab/fotos/jogo3d/` tinha fotos mas nenhuma
  `NOTAS.md`.
- **Presentes 3D** (`src/world/cast/presentes/`, estúdio `src/world/set-kit-presentes/`): em construção.
  Havia mudanças não commitadas em `src/world/cast/presentes/trenzinho.ts` e
  `src/world/set-kit-presentes/index.ts`; `lab/fotos/presentes/NOTAS.md` existia, mas fora do git.
- **Separação back-end/front-end** (`server/`, `deploy/`, `README.md`): o primeiro commit já entrou
  (`51d097e`); o jogo 3D ainda não entra no pacote do front-end.
- **Documentação 3D** (`docs/3D/`): estava fora do git quando foi escrita.
- **Números desatualizados conhecidos:** `lab/fotos/sala-a/NOTAS.md` ainda traz a entrega antiga
  (1,04; -2,08), a folga da frente de 1,35 m e 10 luzes. O código atual (`src/world/set-a/ajustes.ts`) usa a
  entrega a 1,85 m da poltrona na direção 1,27 rad, folga de 1,15 m e 11 luzes. Os valores corretos estão
  em `docs/3D/CENARIO.md`. O desenho em texto no topo de `ajustes.ts` e o comentário de `LUZ` também ainda
  mostram a entrega antiga e "dez luzes". `lab/fotos/noel/NOTAS.md` ainda cita `VISITANTE.direcao` de
  0,37 rad; o código (`src/world/cast/noel/medidas.ts`) já usa 0,59 rad a 1,85 m, que corresponde à entrega
  atual (1,27 menos o giro da poltrona, 0,68). Se a entrega mudar de novo, `VISITANTE` precisa mudar junto,
  porque é gravado à mão para a sala A.
