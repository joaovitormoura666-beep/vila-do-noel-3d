# Próximos passos e perguntas em aberto

Atualizado em 16/11/2026, por volta de 14:00 UTC. O visual do jogo 3D foi dado como aprovado pelo dono (registro de 16/11/2026) e ele
pediu para ir para a live. O caminho da **primeira live** é o **PC do dono** (`iniciar.bat`, servidor em
`http://localhost:3000`, sem VM); a VM com a Cloudflare continua como segunda opção. Passo a passo para o
dono: `docs/COMO-RODAR-NA-LIVE.md`.

## Situação agora

1. **Jogo 3D é a tela principal** (`index.html` = `jogo3d.html`, `src/jogo3d/`): fila de gnomos, entrega com
   o Noel sentado, 12 presentes 3D, HUD, efeitos da sala. O 2D ficou como versão clássica (`classico.html`).
2. **Leitura da live do TikTok** pronta (`server/integrations/TikTokSource.ts`, cartão "Live do TikTok" do
   painel), com a biblioteca gratuita e não oficial `tiktok-live-connector` 2.5.0. Exige o **Node 22**.
3. **Efeitos da sala no painel**: quatro botões (passam por cima do descanso do efeito) e a regra
   provisória "presente da live → efeito".
4. **Atalhos do Windows**: `iniciar.bat` (Node 22, porta, trava contra duas janelas, reabrir depois de um
   erro), `parar.bat`, `abrir-janela-da-live.bat` e `abrir-janela-da-live-grande.bat`.
5. **Pacotes**: o front-end leva o 3D e só a arte usada; o back-end leva um `package-lock.json` e instala
   com `npm ci`.

Tudo isso foi testado neste ambiente com um conector **falso** (o contêiner não alcança o TikTok nem o Euler
Stream). Quem continuar deve rodar `git status` antes (lista no `AGENTS.md`, seção 12).

## O que só dá para confirmar no PC do dono, na primeira live

- **A conexão de verdade** com o TikTok e o Euler Stream: o selo chega a "Ao vivo"? Aparecem o título da live
  e os espectadores (lidos de `roomInfo.data.title`/`user_count` e do evento `roomUser.total`)?
- **Live ainda desligada**: o selo mostra "Esperando a live começar" (e não "Reconectando")? Com a conta fora
  do ar, a biblioteca às vezes diz "Failed to retrieve Room ID from all sources"; o jogo agora trata isso como
  live desligada.
- **Presentes**: nome e valor (`gift.name`/`diamondCount` ou `extendedGiftInfo`) chegam certos? O combo de rosas
  conta uma vez só? O presente grande toca a Noite mágica?
- **Seguidores e compartilhamentos** chegam (linha pequena embaixo dos contadores do painel)?
- **Fotos de perfil** do TikTok carregam pelo proxy? A janela preta mostra uma linha `[fotos]` por minuto
  quando alguma falha, com o motivo.
- **Os `.bat` num Windows de verdade**: `choice` S/N, a trava `.vila-iniciando` (dois cliques seguidos no
  `iniciar.bat`), o `netstat`/`taskkill` do `parar.bat`, o Edge em modo `--app` com `--window-size` e
  `--autoplay-policy`, o aviso de tela em dobro do `abrir-janela-da-live.bat`.
- **Som** na captura de janela do TikTok LIVE Studio (nomes de menu variam por versão) e no OBS.
- **FPS** numa placa de vídeo real com o OBS aberto (`?obs&depurar`), nos três níveis.
- **Node**: o `iniciar.bat` recusa versões antes da 22. Conferir com a LTS que o nodejs.org oferece (24 em
  novembro de 2026).

## Pendências técnicas

- **Duração e prioridade dos efeitos no painel.** Hoje ficam em `DEFAULT_AMBIENT` (`shared/ambient.ts`). O botão
  do painel passa por cima do descanso; os presentes da live respeitam. Uma resposta do jogo ao servidor
  ("tocou", "na espera", "descartado") ainda não existe: o registro do painel diz só "pedido enviado à tela".
- **Fotos de perfil que falham** ainda deixam um "Failed to load resource: 404" no console da tela (uma
  linha por pessoa sem foto). A tela fica certa (aparece a inicial). Responder 204 ou uma imagem vazia mudaria
  o comportamento do 2D, por isso ficou como está; o motivo agora vai no cabeçalho `X-Avatar-Erro`.
- **Erros inesperados no servidor** viram aviso na janela preta (`unhandledRejection`/`uncaughtException` em
  `server/index.ts`), para a biblioteca não oficial não derrubar a fila no meio da live.
- **FPS de verdade.** Medir no PC do dono, com Windows, OBS aberto e placa de vídeo real, nos três níveis. O
  laboratório desenha por software e não serve para isso.
- **Peso do pacote.** Feito em 16/11/2026: o pacote do front-end leva só a arte listada em
  `vite.jogo3d.recursos.json`.
- **Montagem dos gnomos.** Um gnomo novo custa cerca de 30 ms no nível alto; o jogo 3D já monta com
  antecedência, mas vale conferir engasgos com a fila enchendo rápido.
- **`.gitignore` e envio ao GitHub.** Feito em 16/11/2026: o `.gitignore` deixa de fora as pastas geradas e
  as fotos, e o código está no repositório privado (veja `PUBLICACAO.md`, seção 3).
- **Playwright.** A ferramenta de fotos depende dele e ele não está no `package.json`. Decidir se entra
  como dependência de desenvolvimento. Enquanto não entra: se o `shot.cjs` der `Cannot find module
  'playwright'` depois de um `npm install`, instale de novo com `npm install --no-save playwright`.
- **Luzes da sala A acima do teto.** São 11 com a entrega acesa (o jogo 3D acrescentou a luz da fila), e o
  `AGENTS.md` fixa 10. Decidir com quem cuida da sala se fica assim ou se uma sai.
- **Números da sala desatualizados.** `lab/fotos/sala-a/NOTAS.md` (e o desenho no topo de
  `src/world/set-a/ajustes.ts`) ainda trazem a entrega antiga, a folga antiga e 10 luzes. Refazer as fotos
  e a medição de chamadas e triângulos da sala A depois que o jogo 3D terminar.
- **Limitações herdadas do 2D** que continuam valendo (`docs/PENDENCIAS.md`): voz sintetizada ausente na fonte
  de navegador do OBS, uma tela do jogo por vez, eventos perdidos com a tela fechada, nomes sem filtro de
  palavrões, áreas cobertas pelo TikTok a conferir numa live de teste.

## Pontos fracos de arte já conhecidos

Resumo; os detalhes estão nas `NOTAS.md` de cada área.

- **Sala A:** fogo visto de lado e pequeno; forro e vigas escuros; parede lisa acima da árvore; com a fila
  cheia, as cabeças da frente tapam a soleira e os pés do trono; reflexo quente no vidro atrás do trono.
- **Noel:** saco coberto por etiquetas e gnomos na câmera da sala; pelúcia e ponta da barba em close
  extremo; barra do casaco contínua; botas simples.
- **Gnomos:** barba, sobrancelhas e bigode de perto; ponto do tricô grande de perto; fila vista de costas;
  braços esticando na pose de segurar. Também foi anotado que, na entrega, o visitante ficava em parte
  atrás do Noel e o brilho do presente cobria o rosto do Noel, mas isso foi visto **antes** de a entrega
  ir para a direita e de a revelação baixar para 2,5 m (jogo 3D, em construção): conferir com foto.
- **Peças do kit:** veja o fim de `lab/fotos/kit-lareira/NOTAS.md`, `kit-arvore`, `kit-janela` e
  `kit-exterior`.

## Integração com o TikTok

O dono aprovou o visual (16/11/2026) e a leitura da live está feita: `server/integrations/TikTokSource.ts`,
ligada no painel ("Live do TikTok"), com a biblioteca gratuita e não oficial `tiktok-live-connector`. Como
funciona, os riscos (biblioteca não oficial, serviço Euler Stream, licença AGPL) e o que ainda falta conferir
numa live de verdade estão em `docs/INTEGRACAO.md`. A forma gratuita de entrar pelo chat continua obrigatória.
A regra "presente da live → efeito da sala" é **provisória** e está na tabela de perguntas abaixo.

## Perguntas criativas em aberto (para o dono e a direção criativa)

Estas decisões não são dos agentes de código. Hoje o jogo usa as escolhas provisórias do 2D, todas trocáveis
sem mexer na lógica.

| Pergunta | Escolha provisória hoje | Onde muda |
| --- | --- | --- |
| Qual o título do jogo? Fica na tela? | "Vila do Noel" | `src/jogo3d/hud.ts` (3D), `src/ui/Hud.ts` (2D) |
| Os presentes estão bons? Tirar, trocar ou acrescentar? | 12 presentes (Estrela Dourada, Bola de Natal, Bengala Doce, Boneco de Neve, Ursinho de Pelúcia, Sino Dourado, Meia Natalina, Biscoito de Gengibre, Globo de Neve, Pinheirinho, Chocolate Quente, Trenzinho) | `src/gifts/giftCatalog.ts` e `src/world/cast/presentes/` |
| As frases do Noel estão boas? | 24 frases, mais a obrigatória "Vamos ver qual é o seu presente!" | `src/santa/phrases.ts` (lista em `docs/DIRECAO-CRIATIVA.md`) |
| Quem manda presente deve ter alguma vantagem sobre quem usa o comando gratuito? | Não: ordem de chegada para todos | `src/queue/QueueManager.ts` |
| O ritmo está bom? | Cerca de 10 s por pessoa, acelerando sozinho com a fila grande (até o dobro) | Painel, cartão "Ritmo"; agenda do 3D em `src/jogo3d/agenda.ts` |
| Como deve ser a voz do Noel: gravada, gerada ou a do navegador? | Voz sintetizada do navegador, mais grave | `docs/AUDIO.md` |
| O texto de instrução pode pedir presente na tela? (conferir as regras atuais do TikTok) | "Digite !presente no chat ou envie uma 🌹 para entrar na fila" | Painel, cartão "Como as pessoas entram" |
| Qual presente da live dispara qual efeito da sala? | Pelo valor do envio: 5 moedas Árvore, 30 Lareira, 100 Trenó, 500 Noite mágica; a rosa só põe na fila | Painel, cartão "Efeitos da sala" (`DEFAULT_AMBIENT_GIFTS` em `shared/ambient.ts`) |
| Onde ficam o chat e os botões do TikTok na conta do dono? | Zonas padrão: título de 190 a 420 px, jogo de 430 a 1480 px, chat abaixo de 1480 px | `src/jogo3d/hud.ts`, `lab/dados.ts` |
| Quanto tempo a mesma pessoa espera para participar de novo depois de receber o presente? | **0 s** (pode voltar para o fim da fila na hora e ganhar de novo na mesma live). Sugestão para o dono decidir antes da primeira live: 180 a 300 s | Painel, cartão "Ritmo", campo "Espera para participar de novo" (`rejoinCooldownSec` em `DEFAULT_SETTINGS`, `shared/types.ts`) |
| Quanto tempo dura cada efeito da sala e quanto descansa? | Valores de `DEFAULT_AMBIENT` (provisórios) | `shared/ambient.ts` (ainda não está no painel) |
| Outras escolhas provisórias | Fonte Fredoka, comandos `!presente`, `!noel` e `!fila`, fila com limite de 150, 11 visíveis, valsa de caixinha de música | Painel e `docs/DIRECAO-CRIATIVA.md` |

Quando uma pergunta for respondida, registre a decisão e a data em `HISTORICO.md`.
