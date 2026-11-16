# Vila do Noel 3D: leia primeiro

Este é o ponto de partida da documentação da versão 3D. Foi escrito para o dono do projeto, que não é
programador, e para quem for continuar o trabalho (pessoas ou agentes de código). Atualizado em
16/11/2026.

## Em poucas palavras

A Vila do Noel é um jogo para lives verticais do TikTok. Quem participa vira um personagem com nome e
foto, entra numa fila, anda até o Papai Noel, ouve "Vamos ver qual é o seu presente!" e ganha um
presente decorativo (só animação, sem valor nenhum).

A primeira versão, em 2D, funciona inteira, mas o visual foi considerado fraco. Por isso o jogo está
sendo refeito em 3D: uma sala natalina encantada, quente por dentro e azul fria lá fora, com o seu
Papai Noel sentado numa poltrona grande e gnomos natalinos como visitantes.

## O que já está pronto e o que está em construção

| Parte | Situação | Onde ver |
| --- | --- | --- |
| Sala 3D, composição A (lareira à esquerda, janela em arco ao fundo, árvore à direita) | Pronta | `demo-sala.html` |
| Quatro efeitos ambientes (árvore brilhando, lareira mágica, trenó, noite mágica) | Prontos na sala, com botões de teste | `demo-sala.html` |
| O seu Papai Noel em 3D, sentado, com sete poses | Pronto (segunda rodada, depois da crítica) | laboratório, cena `estudio` com `mostrar=noel` |
| Gnomos visitantes, cada pessoa um gnomo diferente | Prontos (segunda rodada) | laboratório, cena `estudio` |
| Os 12 presentes em 3D e a caixa | Em construção | laboratório, `mostrar=presentes` |
| Jogo 3D jogável (fila, entrega, nomes, título) | Em construção | `jogo3d.html?demo=1` |
| Separar o servidor (VM) e as páginas (Cloudflare Pages) | Em construção (os pacotes já são gerados; o jogo 3D ainda não entra neles) | `deploy/` e `pacotes/` |
| Ligar os efeitos ao painel e ao servidor | Ainda não feito | |
| Integração com o TikTok de verdade | De propósito, só depois da sua aprovação visual | |

## Como ver no seu PC (Windows)

1. Instale o Node.js 22 LTS (ou mais novo) em <https://nodejs.org>.
2. Pegue o código. Ele já está no seu repositório privado do GitHub, no ramo `main`: no VS Code, use
   Controle do Código-Fonte → Clonar repositório, com o endereço que está no `CONTINUAR-NO-VSCODE.md` da
   pasta compartilhada. Depois abra a pasta clonada (Arquivo > Abrir Pasta).
3. No terminal do VS Code (Terminal > Novo Terminal), rode uma vez: `npm install`.
4. Rode `npm run lab` e deixe esse terminal aberto.
5. No Chrome ou no Edge, abra:
   - <http://127.0.0.1:5180/demo-sala.html>: a sala com os botões dos quatro efeitos;
   - <http://127.0.0.1:5180/jogo3d.html?demo=1>: o jogo 3D em demonstração (em construção);
   - <http://127.0.0.1:5180/lab/index.html?cena=vila&set=a>: o laboratório com a sala, o Noel e a fila.
6. O jogo 2D antigo continua funcionando com `iniciar.bat` ou `npm start` (<http://localhost:3000>).

Para parar, feche o terminal ou aperte `Ctrl+C` nele.

Um aviso: o código no GitHub não leva as fotos de trabalho do laboratório nem as duas imagens de
referência de obras de terceiros (`lab/referencia-clima.png` e `lab/referencia-gnomo.png`), porque são
pesadas ou não podem ser publicadas. Se um agente precisar delas, ele pode refazer as fotos sozinho; as
duas referências ficam com você ou na pasta compartilhada.

## Os documentos desta pasta

| Documento | Para que serve |
| --- | --- |
| [HISTORICO.md](HISTORICO.md) | O que foi feito, em ordem, com as suas decisões e as datas. |
| [ARQUITETURA.md](ARQUITETURA.md) | Como o jogo é organizado por dentro: eventos, fila, efeitos, palco 3D, cenário, personagens, interface. |
| [CENARIO.md](CENARIO.md) | A sala A: peças, luzes, efeitos, câmera e os pontos onde o Noel e a fila ficam. |
| [PERSONAGENS.md](PERSONAGENS.md) | O Noel e os gnomos: como são feitos, poses, números, pontos fracos e como trocar o Noel por um modelo GLB. |
| [LABORATORIO.md](LABORATORIO.md) | Como fotografar as cenas e conferir o visual. |
| [RECURSOS-E-LICENCAS.md](RECURSOS-E-LICENCAS.md) | De onde vêm os modelos, texturas, fontes e sons, e as licenças. |
| [PUBLICACAO.md](PUBLICACAO.md) | Como rodar no PC e como separar o servidor e as páginas. |
| [PROXIMOS-PASSOS.md](PROXIMOS-PASSOS.md) | O que falta fazer e as perguntas que esperam a sua decisão. |

Outros documentos importantes:

- `AGENTS.md` (na raiz): as regras que todo agente de código precisa seguir, as regras de git e o que
  estava em andamento quando a última sessão parou.
- `CONTINUAR-NO-VSCODE.md`, na pasta compartilhada do projeto (fora do repositório): o passo a passo para
  você continuar no VS Code.
- `lab/LEIA-ME.md`: o guia técnico detalhado da arte 3D e do laboratório.
- `lab/fotos/<parte>/NOTAS.md`: as anotações de cada parte (sala, Noel, gnomos, peças do kit).
- `docs/*.md`: os documentos da versão 2D (áudio, integração, direção criativa, pendências), que
  continuam valendo para o que é comum aos dois.

## Como pedir ajuda a um agente de código

Se a sessão atual parar e você for continuar no VS Code com outro agente, comece pedindo:

> Leia o AGENTS.md e o docs/3D/LEIA-PRIMEIRO.md antes de qualquer coisa. Rode git status para ver o que
> ficou pela metade. Depois me diga, em português simples, o que está pronto e o que falta.

O `AGENTS.md` já diz ao agente o que ele não pode fazer (trocar o seu Noel por um genérico, usar
imagens protegidas, ligar o TikTok antes da sua aprovação, decidir sozinho questões criativas).
