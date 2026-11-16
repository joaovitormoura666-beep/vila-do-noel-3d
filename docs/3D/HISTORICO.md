# Histórico do projeto

O que foi feito, em ordem, com as decisões do dono. As datas e horas estão em UTC. As que vêm da
memória do projeto estão marcadas como confirmadas; as que vêm só das datas de gravação dos arquivos
estão marcadas como aproximadas.

## O briefing (antes de 15/11/2026)

O briefing definiu o que continua valendo:

- paleta: vermelho `#B62835`, verde `#174D3B`, dourado `#E8BC65`, neve `#F7F4EF` e azul-noite `#17253B`;
- formato vertical 9:16 (1080x1920);
- mecânica de fila: cada pessoa da live entra na fila e é atendida pelo Noel, uma de cada vez;
- fala obrigatória do Noel: "Vamos ver qual é o seu presente!";
- tela aconchegante e sem poluição visual.

Papéis combinados: o ChatGPT cuida da direção criativa; o Claude, da engenharia de software; o dono roda
tudo no PC com Windows e opera a conta do TikTok.

## 15/11/2026: versão 1.0 em 2D (confirmado)

Foi entregue o MVP 1.0 em 2D, com Phaser 3.90: servidor de eventos (Node com WebSocket), painel de
controle, simulador de eventos, 28 testes automáticos, um vídeo de 28 segundos e uma prévia ao vivo. Os
documentos dessa versão estão em `README.md` e `docs/` (`AUDIO.md`, `INTEGRACAO.md`, `DIRECAO-CRIATIVA.md`,
`PENDENCIAS.md`).

Escolhas provisórias do 2D, que seguem valendo até o dono decidir: fonte Fredoka, 12 presentes, 24 frases
do Noel, comandos gratuitos `!presente`, `!noel` e `!fila`, ordem de chegada, cerca de 10 segundos por
pessoa, fila com limite de 150 e música de caixinha de música em valsa.

**Decisão do dono:** o 2D ficou "visualmente fraco". Ele é mantido como arquivo e como fonte da lógica
que funciona; o jogo será refeito em 3D.

## 15/11/2026, 04:31: nova direção de arte (confirmado)

O dono definiu a direção de arte do 3D: uma **sala natalina encantada em 3D**, com lareira grande e fogo
animado, janelas para a vila nevada à noite, árvore com luzes, madeira, tapete e móveis. Quente por
dentro, azul frio por fora. A referência de animação natalina clássica serve só como clima, nunca para
copiar.

Pelas datas de gravação dos arquivos (aproximado), entre 04:30 e 05:00 ficaram prontos a agenda dos
efeitos ambientes (`src/ambient/AmbientDirector.ts`, `shared/ambient.ts`), a página de demonstração da
sala (`demo-sala.html`), o palco 3D (`src/engine/Stage.ts`), os carregadores de recursos
(`src/engine/assets.ts`) e o guia do laboratório (`lab/LEIA-ME.md`).

## 15/11/2026, 04:47: barra de qualidade cinematográfica (confirmado)

O dono subiu a exigência: qualidade de cinema, **nada de primitivas nem de plástico**. Ficou liberado usar
modelos e texturas PBR licenciados, do Poly Haven (CC0), que é o que a rede do ambiente permite. Pediu
para testar duas composições da sala.

**Ordem de trabalho definida:** primeiro só a sala 9:16, para julgar o visual; depois os quatro efeitos
ambientes (`TREE_SPARKLE`, `FIREPLACE_MAGIC`, `SLEIGH_PASS`, `MAGICAL_NIGHT`), independentes da fila, com
duração configurável, prioridade e proteção contra excesso, e um painel local; o TikTok real só depois.

## 15/11/2026, ao longo do dia: acervo e peças do kit (aproximado)

- Por volta de 10:15 a 10:48: o acervo de móveis e texturas do Poly Haven foi escolhido e fotografado
  (`lab/acervo/CATALOGO.md`; 86 modelos e 34 texturas testados, 31 e 10 mantidos).
- Composição B (`src/world/set-b/`) por volta de 19:12.
- Por volta de 22:36: crítica de direção de arte das quatro peças do kit
  (`lab/fotos/kit-*-critica/CRITICA.json`): árvore nota 5,5; lareira 6; janela 5; exterior 6,5.
- Entre 22:50 de 15/11 e 01:08 de 16/11: segunda rodada de cada peça depois da crítica (lareira, árvore,
  exterior, tecidos e janela). Notas em `lab/fotos/kit-*/NOTAS.md`.

## 15/11/2026, 22:43: escolha da composição A (confirmado)

O dono viu as prévias das duas composições e escolheu a **composição A**: lareira na parede da esquerda,
janela em arco ao fundo, árvore à direita. O Noel fica **sentado** na poltrona grande (`ArmChair_01` em
escala de cerca de 1,5), que funciona como trono.

## 15/11/2026, 22:54: o Noel do dono em 3D (confirmado)

O dono não conseguiu exportar o arquivo GLB do Noel que ele criou no Tripo. Escolheu que o Claude refaça o
Noel dele em 3D, fiel ao desenho do Tripo (referências em `lab/referencia-noel-tripo.png` e
`lab/referencia-noel/`). Um GLB pode substituí-lo depois. Tem de ser 3D de verdade: nas palavras dele,
"2D é uma animação feia".

## Visitantes: gnomos natalinos (confirmado, sem hora exata)

Os visitantes passaram a ser gnomos natalinos originais, construídos a partir de um exemplo de estilo do
dono (um personagem de filme, usado só como referência de volume, escala da cabeça e materiais). Os
bonecos de blocos provisórios foram rejeitados.

## 15 e 16/11/2026, madrugada: Noel, gnomos e sala pronta (aproximado)

- 23:22 e 23:34 de 15/11: primeiros rascunhos dos gnomos e do Noel (imagens em `andamento/` na pasta
  compartilhada).
- 01:26 a 01:27 de 16/11: sala A pronta, com os quatro efeitos (`lab/fotos/sala-a/NOTAS.md`).
- Crítica de direção de arte do Noel e dos gnomos (gnomos nota 5) e segunda rodada de cada um: Noel por
  volta de 02:28 a 02:30 (`lab/fotos/noel/NOTAS.md`), gnomos por volta de 02:32 a 02:33
  (`lab/fotos/gnomos/NOTAS.md`).

## 16/11/2026, madrugada: trabalhos em andamento (confirmado que estavam em construção)

- **Jogo 3D completo** (`jogo3d.html`, `src/jogo3d/`): fila de gnomos, entrega com o Noel sentado e os
  presentes 3D. Em construção.
- **12 presentes 3D e a caixa** (`src/world/cast/presentes/`). Em construção.
- **Separação do back-end e do front-end**: o servidor numa VM e as páginas na Cloudflare Pages
  (`deploy/`, `pacotes/`). Em construção.
- O dono pediu `AGENTS.md`, documentação completa e o envio para um repositório privado no GitHub. Esta
  pasta `docs/3D/` faz parte desse pedido.
- Por volta de 02:46: para o jogo 3D, a entrega foi para a direita (1,85 m do centro da poltrona, na direção
  1,27 rad) e a revelação baixou para 2,5 m, para o visitante não ficar atrás do Noel; o Noel passou a
  apontar para o novo lugar (`VISITANTE` em `noel/medidas.ts`). Por volta de 03:06 entrou a luz de
  preenchimento da fila (aproximado, pelas datas dos arquivos `ancoras.ts`, `medidas.ts`, `ajustes.ts` e
  `luzes.ts`).

## 16/11/2026, por volta de 03:21: código no GitHub (confirmado pelo git)

- O código foi enviado ao repositório privado no GitHub, ramo `main` (commit `b5f8b18`, "Vila do Noel
  Live: jogo 2D (versão 1.0) e reconstrução em 3D em andamento").
- Logo em seguida, por volta de 03:22, entrou o commit da separação back-end/front-end (`51d097e`).
- Os trabalhos do jogo 3D, dos presentes e desta documentação continuavam em andamento depois disso (veja
  `AGENTS.md`, seção 12).
