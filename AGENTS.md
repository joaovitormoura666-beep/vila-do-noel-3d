# AGENTS.md: regras e mapa para agentes de código

Este arquivo é lido por agentes de código (Claude Code, Copilot, Codex e outros) antes de mexer no
projeto. Leia inteiro. Depois leia `docs/3D/LEIA-PRIMEIRO.md` e, se for mexer na arte 3D,
`lab/LEIA-ME.md`.

## 1. O que é o projeto

**Vila do Noel Live** é um jogo natalino para lives verticais (9:16, 1080x1920) do TikTok. Quem
participa da live vira um personagem com nome e foto de perfil. O personagem entra numa fila visível,
anda até o Papai Noel, ouve "Vamos ver qual é o seu presente!" e recebe um presente decorativo com uma
animação de revelação. Depois comemora e vai embora, liberando a vez do próximo.

Há duas versões no mesmo repositório:

- **Versão 1.0, em 2D (Phaser 3.90).** Funciona de ponta a ponta: servidor de eventos, painel de
  controle, simulador, testes. O dono achou o visual fraco e mantém essa versão como arquivo e como
  fonte da lógica que já funciona (fila, regras, frases, áudio). Página: `index.html`.
- **Versão 3D (Three.js 0.187), em construção.** Uma sala natalina encantada com o Noel do dono
  sentado numa poltrona, gnomos visitantes e presentes 3D. A sala e os quatro efeitos ambientes estão
  prontos; o jogo 3D jogável (`jogo3d.html`, `src/jogo3d/`) está em construção.

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
3. **Arte original e recursos gratuitos.** A arte é original. Recursos de terceiros só do
   **Poly Haven (licença CC0)**, baixados com `tools/polyhaven.mjs`, que registra os créditos em
   `public/assets/CREDITOS.md`. Nenhuma imagem, modelo, música ou fonte protegida. Referências (filmes,
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
index.html               tela da live 2D (Phaser)
painel.html              painel de controle (serve ao 2D e ao 3D)
demo.html                demonstração 2D sem servidor (npm run demo)
demo-sala.html           sala 3D sozinha com botões dos quatro efeitos (npm run sala)
jogo3d.html              jogo 3D (em construção)
iniciar.bat              atalho do Windows: npm install + npm start (2D)

shared/                  tipos usados pelo servidor e pelas telas
  types.ts               eventos da live, participante, configurações (DEFAULT_SETTINGS)
  ambient.ts             os quatro efeitos ambientes e a configuração padrão deles
  simAvatar.ts           fotos de perfil fictícias em SVG para o simulador
server/                  servidor Node 20 + ws (eventos, painel, regras, segurança)
  integrations/          fontes de eventos: simulador e o esboço do TikTok (não ativo)
src/                     telas, em TypeScript
  2D (Phaser):           main.ts, config.ts, render/, characters/, santa/Santa.ts, ui/,
                         animations/, queue/QueueDirector.ts, effects/Snow.ts
  lógica comum 2D e 3D:  queue/QueueManager.ts (fila), events/ (barramento e conexão),
                         settingsState.ts, gifts/giftCatalog.ts (12 presentes),
                         santa/phrases.ts (frases), audio/ (voz, música, efeitos),
                         effects/PerformanceMonitor.ts (qualidade automática),
                         ambient/AmbientDirector.ts (agenda dos efeitos ambientes)
  admin/                 código do painel de controle
  engine/                motor 3D: Stage.ts (palco), assets.ts (carregadores), Path3.ts (caminhos)
  world/                 arte 3D
    contracts.ts         CONTRATOS entre o jogo e a arte (fonte da verdade)
    kit/                 peças da sala: lareira, arvore, janela, exterior, tecidos, estudio.ts
    set-a/               composição A da sala (a escolhida pelo dono)
    set-b/               composição B (não escolhida; fica como referência)
    set/                 cenário oficial do jogo: hoje reexporta set-a
    set-kit-*/           estúdios para fotografar uma peça sozinha
    cast/                elenco: noel/, gnomos/, presentes/ (em construção), index.ts
    provisorio/          blocos de exemplo dos contratos (não edite, não entregue)
  jogo3d/                jogo 3D jogável (em construção)
  demo/sala.ts           código da página demo-sala.html
lab/                     laboratório 3D: página de fotos, guia (LEIA-ME.md), fotos e acervo
tools/                   shot.cjs (fotos), polyhaven.mjs (baixar recursos CC0)
public/assets/           modelos GLB, texturas e CREDITOS.md que vão com o jogo
public/audio/            frases gravadas e música opcionais do dono
tests/                   testes automáticos (Vitest)
deploy/                  modelos e scripts para separar back-end (VM) e front-end (Cloudflare)
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
| `npm start` | Compila o 2D e liga o servidor em `http://localhost:3000` (é o que o `iniciar.bat` usa). |
| `npm run servidor` | Liga só o servidor (sem compilar as páginas). |
| `npm run dev` | Servidor + Vite em `http://127.0.0.1:5173`, recarregando ao salvar. |
| `npm test` | Roda os testes (Vitest). Em 16/11/2026: 6 arquivos, 78 testes passando. |
| `npm run typecheck` | Confere os tipos (`tsc --noEmit`). |
| `npm run build` | Compila o 2D e o painel em `dist/`. |
| `npm run demo` | Gera a demonstração 2D sem servidor em `dist-demo/`. |
| `npm run pacotes` | Gera em `pacotes/` o back-end para a VM e o front-end para a Cloudflare. Também `npm run pacote:backend` e `npm run pacote:frontend`. |
| `node tools/shot.cjs <cena> ...` | Fotografa uma cena do laboratório (veja `docs/3D/LABORATORIO.md`). |
| `node tools/polyhaven.mjs ...` | Procura e baixa recursos CC0 do Poly Haven (veja `docs/3D/RECURSOS-E-LICENCAS.md`). |

Endereços úteis com `npm run lab` ligado:

- `http://127.0.0.1:5180/demo-sala.html`: a sala com os botões dos quatro efeitos.
- `http://127.0.0.1:5180/lab/index.html?cena=sala&set=a`: o laboratório (parâmetros em `lab/LEIA-ME.md`).
- `http://127.0.0.1:5180/jogo3d.html?demo=1`: o jogo 3D em demonstração (em construção).

## 5. Como conferir o visual

O visual só conta depois de olhado. O fluxo é: fotografar antes, mudar, fotografar depois, abrir as
duas imagens e comparar.

- O laboratório precisa estar ligado (`npm run lab`, porta 5180). Não o reinicie sem necessidade se
  outra pessoa estiver usando.
- `node tools/shot.cjs sala --param set=a --half --out lab/fotos/<area>/<nome>.png` tira um rascunho
  rápido (540x960). Sem `--half` sai em 1080x1920; com `--mini` sai também a miniatura de celular.
- A ferramenta usa o Playwright com o Chromium e desenha por **software (SwiftShader)**: uma foto leva de
  5 a 40 segundos e o FPS medido ali não vale para o PC do dono. Use `--timeout 90` se estourar o tempo.
- O Playwright não está no `package.json`. Instale sem alterar o arquivo:
  `npm install --no-save playwright` e `npx playwright install chromium`.
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
- Até 10 luzes em tempo real no total.
- Objetos repetidos com `InstancedMesh`; geometria estática do mesmo material com `mergeGeometries`;
  partículas num único `Points` ou `InstancedMesh`.
- Materiais e geometrias compartilhados entre cópias (gnomos, presentes).
- Um visitante atendido por vez; até 13 personagens na tela; montar no máximo um gnomo novo por quadro.
- `setQuality('media' | 'baixa')` precisa reduzir de verdade (menos sombras, partículas e luzes).
  O palco baixa a resolução (alta 1, média 0,8, baixa 0,64) e, em `baixa`, desliga oclusão, brilho e
  acabamento. A qualidade automática (`src/effects/PerformanceMonitor.ts`) troca o nível pelo FPS.

Medidas atuais (laboratório, sala A): cenário 167 chamadas e cerca de 860 mil triângulos em `alta`;
sala com o Noel e 13 gnomos, cerca de 370 chamadas e 1,41 milhão de triângulos. O FPS em placa de vídeo
real ainda não foi medido.

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
2. Fotografe o estado atual antes de mudar a arte.
3. Faça a mudança dentro da sua área. Se precisar mudar um contrato ou um arquivo comum, anote e pergunte.
4. Rode `npm run typecheck` e `npm test`. Os dois precisam passar.
5. Fotografe depois, em `alta` e também em `--q baixa`, e compare.
6. Atualize a `NOTAS.md` da área (o que mudou, números, o que ficou fraco) e os documentos de `docs/3D/`
   que ficaram desatualizados.
7. Explique ao dono, em português simples, o que mudou e o que ele precisa olhar ou decidir.

## 10. O que NÃO fazer

- Não commitar `node_modules/`, `assets-src/` (originais baixados, 27 MB), `data/` (configurações do
  painel), `.env` (senhas), `dist/`, `dist-demo/`, `dist-sala/`, `pacotes/` (gerados) nem as fotos
  pesadas de `lab/fotos/` e `lab/acervo/` (centenas de MB). Das fotos, só as `NOTAS.md`, as
  `CRITICA.json` e, se o dono quiser, algumas `final-*.png` leves. Confira o `.gitignore` antes do
  primeiro envio ao GitHub.
- Não colocar segredos (senhas, chaves, `TOKEN_ADMIN`) em código ou documentos.
- Não trocar o Noel do dono por um genérico, nem colocar um Noel provisório na cena.
- Não usar imagens, modelos, músicas ou fontes protegidas, nem copiar personagens de filmes.
- Não ligar o TikTok real, não adicionar serviço pago, não criar mecânica com valor em dinheiro.
- Não apagar o jogo 2D nem a lógica do servidor.
- Não editar `src/world/provisorio/` nem entregar blocos como arte.
