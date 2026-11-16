# Próximos passos e perguntas em aberto

Atualizado em 16/11/2026. A ordem combinada com o dono continua valendo: primeiro o visual (sala, Noel,
gnomos, presentes), depois os efeitos ligados ao painel, e o TikTok real só depois da aprovação visual.

## Em construção agora

1. **Jogo 3D jogável** (`jogo3d.html`, `src/jogo3d/`): fila de gnomos andando, entrega com o Noel sentado
   ("Vamos ver qual é o seu presente!"), caixa que abre, presente que aparece, gnomo que comemora e sai,
   nomes que não se amontoam na frente do Noel. Usa a lógica do 2D (veja `ARQUITETURA.md`).
2. **Os 12 presentes 3D e a caixa** (`src/world/cast/presentes/`). As notas vão para
   `lab/fotos/presentes/NOTAS.md`.
3. **Separação do back-end (VM) e do front-end (Cloudflare Pages)** (`deploy/`, `pacotes/`).
4. Depois desses: crítica de arte, revisão, um vídeo do fluxo e uma prévia ao vivo com os botões.

Situação desses trabalhos em 16/11/2026, por volta de 03:38 UTC: havia mudanças ainda não commitadas no
jogo 3D e nos presentes, `tests/jogo3d.test.ts` e `lab/fotos/presentes/` estavam fora do git e
`lab/fotos/jogo3d/` não tinha `NOTAS.md`. Quem continuar deve rodar `git status` antes e não supor que o
jogo 3D está terminado (lista completa no `AGENTS.md`, seção 12).

## Pendências técnicas

- **Página principal.** Trocar `index.html` do 2D para o 3D, deixando o 2D como versão clássica (precisa do
  aval do dono). Incluir o jogo 3D no `npm start`/`npm run build` (`vite.config.ts`) e no pacote do front-end.
- **Efeitos ambientes no painel e no servidor.** Hoje os quatro efeitos só tocam pelos botões das páginas de
  demonstração e pelo endereço. Falta: botões no painel, a mensagem `ambient` saindo do servidor (o jogo 3D
  já sabe recebê-la), duração e prioridade configuráveis no painel e, no futuro, ligar cada efeito a um tipo
  de evento da live (decisão criativa).
- **FPS de verdade.** Medir no PC do dono, com Windows, OBS aberto e placa de vídeo real, nos três níveis. O
  laboratório desenha por software e não serve para isso.
- **Peso do pacote.** Tirar do pacote do front-end os modelos do acervo que a sala A não usa (hoje vai todo
  `public/assets/`, cerca de 26 MB).
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

## Integração com o TikTok (só depois da aprovação visual)

O ponto de encaixe é `server/integrations/LiveSource.ts`, com o esboço em
`server/integrations/TikTokSource.stub.ts`. Os caminhos possíveis e os riscos estão em `docs/INTEGRACAO.md`:
uma ferramenta de lives chamando `POST /api/evento` (já funciona hoje), uma biblioteca não oficial (risco
para a conta) ou um programa oficial do TikTok, se a conta tiver acesso. Não presuma acesso irrestrito à API
oficial. A forma gratuita de entrar pelo chat continua obrigatória.

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
| Onde ficam o chat e os botões do TikTok na conta do dono? | Zonas padrão: título de 190 a 420 px, jogo de 430 a 1480 px, chat abaixo de 1480 px | `src/jogo3d/hud.ts`, `lab/dados.ts` |
| Quais eventos da live disparam cada efeito ambiente, e com que duração? | Nenhum ainda (só botões de teste) | `shared/ambient.ts` e, depois, o painel |
| Outras escolhas provisórias | Fonte Fredoka, comandos `!presente`, `!noel` e `!fila`, fila com limite de 150, 11 visíveis, valsa de caixinha de música | Painel e `docs/DIRECAO-CRIATIVA.md` |

Quando uma pergunta for respondida, registre a decisão e a data em `HISTORICO.md`.
