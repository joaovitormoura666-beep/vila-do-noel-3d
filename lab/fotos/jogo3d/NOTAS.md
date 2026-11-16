# Jogo 3D jogável: notas (16/11/2026, segunda rodada, ~05:45 UTC)

O jogo 3D (`jogo3d.html`, código em `src/jogo3d/`) roda de ponta a ponta. Ele mostra:

- o Noel sentado na poltrona da sala A;
- a fila de gnomos andando de verdade;
- a entrega: caixa, presente 3D, voz, balão e nomes.

Esta rodada corrigiu o que a crítica da primeira apontou. A lista do que entrou e do que ficou de fora está no fim.

## Como abrir

Com o laboratório ligado (`npm run lab`, porta 5180):

| Endereço | O que é |
| --- | --- |
| `http://127.0.0.1:5180/jogo3d.html` | Jogo ligado ao servidor. Sem servidor, liga a demonstração sozinho. |
| `http://127.0.0.1:5180/jogo3d.html?demo=1` | Demonstração sem servidor, com barra de botões. |
| `http://127.0.0.1:5180/jogo3d.html?obs` | Só o que vai para a live. |
| `http://127.0.0.1:5180/jogo3d.html?manual=1&fila=12` | Captura: nada anda sozinho; `window.__jogo3d.frame(dt)` avança. |

### Parâmetros

Os de antes continuam:

- `demo=1`, `obs`, `manual=1`, `q=alta|media|baixa`, `fila=N`, `visiveis=N`, `auto=0|1`;
- `semente=…`, `velocidade=…`, `efeito=…`, `pr=0.5`, `limpar`, `fps`;
- `depurar`: o `info()` traz as áreas proibidas, as etiquetas, o motivo de cada um dos 6 primeiros ter ou não
  nome (`motivos`) e a posição de cada gnomo na tela.

Novos nesta rodada:

- `fov=29`: abertura da câmera do jogo.
- `cam=x,y,z`: posição da câmera do jogo.
- `alvo=x,y,z`: para onde a câmera do jogo olha.
- `presente=bengala`: fixa o presente (para fotografar um presente específico).

A câmera do jogo padrão está em `CAMERA_JOGO` (`src/jogo3d/config.ts`).

### Como refazer as fotos

Em 1080x1920, no modo manual, os tempos são absolutos desde a carga, com `fila=12`:

| Tempo | Foto |
| --- | --- |
| 1,5 | `final-1-fila` |
| 3,0 | `final-2-saudacao` |
| 4,5 | `final-3-fala` |
| 7,2 | `final-4-abre` |
| 7,9 | `final-5-revelacao` |
| 9,0 | `final-6-entrega` |
| 9,9 | `final-7-festa` |
| 10,7 | `final-8-saida` |
| 13,0 | `final-9-proximo` |

Exemplo:

`node tools/shot.cjs jogo3d.html --param manual=1 --param fila=12 --t 1.5,3,4.5,7.2,7.9,9,9.9,10.7,13 --mini --timeout 150 --out lab/fotos/jogo3d/final.png`

A carga em 1080x1920 leva ~30 s no SwiftShader.

## Fotos (1080x1920; as `-mini` são de celular, 270x480)

| Foto | O que mostra |
| --- | --- |
| `final-1-fila.png` (+ mini) | Fila cheia (11 esperando, 13 na tela). A primeira vai até o Noel. Pílula "AGORA Sofia_rena" no alto, ao lado do contador "11 na fila · 1 a caminho". |
| `final-2-saudacao.png` | Balão à esquerda do Noel, com a cauda na boca. |
| `final-3-fala.png` (+ mini) | "Vamos ver qual é o seu presente!". |
| `final-4-abre.png` | A caixa abre; a câmera fecha um pouco (zoom). |
| `final-5-revelacao.png` (+ mini) | Estrela no alto e a faixa "Sofia_rena ganhou / Estrela Dourada". |
| `final-6-entrega.png` | O presente desce girando e chega de frente para a câmera. |
| `final-7-festa.png` (+ mini) | Festa: o visitante dá uns passinhos para a câmera com a estrela maior, as mãos encostadas nela e um halo fraco. |
| `final-8-saida.png` | Parada para mostrar o presente antes de sair. |
| `final-9-proximo.png` | A próxima (Ana Clara_luz) já vai à entrega. |
| `baixa-fala.png`, `baixa-revelacao.png` | Nível `baixa` (540x960). |
| `noel-antes.png`, `noel-depois.png`, `noel-botas.png`, `noel-barba.png` | Estúdio: `cena=estudio&mostrar=noel&pose=parado&yaw=-0.3`, com `cam` próprio. |

## Números (SwiftShader, 16/11/2026 ~05:40 UTC; servem só para comparar)

| Momento | Chamadas | Triângulos |
| --- | --- | --- |
| Fila com 13 na tela + Noel (alta) | 346 a 358 | 1,36 a 1,38 M |
| Mesmos momentos em `baixa` | 148 a 156 | 0,47 a 0,48 M |

- **Programas de sombreamento**, entre o começo e a primeira entrega: 258 → 264 → 268. Antes, acender o
  destaque da entrega mudava o número de luzes e recompilava todos os materiais (+~250). As 6 a 10 compilações
  que sobram são da caixa, do halo e das faíscas.
- **Fila vazia**: quem entra levava ~33 s para chegar ao Noel. Agora leva 13,2 s, porque anda mais rápido quando
  está longe (`ANDAR.pressa` 2,6). São ~12 m de caminho.
- **Cadência por pessoa**:
  - fila cheia: ~12,4 s (agenda de 9,25 s, mais a parada da saída e o passo do próximo);
  - fila curta: ~14 s.
- **Uma entrega** vai de 2,3 s a 10,4 s no tempo da captura (chegada a fim da festa).
- **Testes**: 7 arquivos, 102 testes passando. `tsc --noEmit` sem erros.

## O que mudou nesta rodada (da crítica mais grave para a menos grave)

1. **Retângulo do Noel**:
   - É fixo. Sai de uma amostra dos vértices do corpo (já na pose sentada) mais a caixa da poltrona, sem o saco e
     o pufe.
   - É calculado uma vez e só é projetado de novo quando a abertura da câmera muda.
   - Vai do pompom até os joelhos. O saco tem área própria, só na boca dele.
2. **Etiquetas presas a quem nomeiam** (`etiquetas.ts`, `CamadaNomes.ts`):
   - Nenhum lugar a mais de 90 px da cabeça na vertical (`longeMax`) ou 160 px na horizontal (`ladoMax`).
   - Acabou a opção "abaixo dos pés".
   - Quem tem a cabeça escondida atrás de outro gnomo não mostra o nome.
   - Quem está sendo atendido não tem etiqueta no mundo: o nome dele aparece na pílula "AGORA" do HUD.
   - Sem lugar, a etiqueta some.
3. **Presente nas mãos**:
   - Cresce de 0,46 para 0,70 na festa. Cada presente tem um fator na tabela `ESCALA_PRESENTE` (bengala 1,25,
     pinheirinho 1,2 e outros).
   - O gnomo dá 0,6 m de passinhos para a câmera.
   - Um halo fraco acompanha a alegria (`PRESENTE.halo.naMao`).
   - O presente desce girando até ficar de frente para a câmera.
4. **Mãos no presente**: o contrato `VisitorPose` ganhou `holdWidth`, `holdLift` e `turn` (opcionais). O gnomo
   encosta as mãos nos lados do presente, e o presente assenta acima do gorro.
5. **Noel** (fotos `noel-*`):
   - Barra do casaco mais estreita (meia largura 0,43). Nos lados ela cai reta até o assento, sem tubo suspenso.
   - Pelúcia mais clara (`#F4EFE6`), com menos sombra pintada.
   - Barba `#F6F2EA`, com sheen no lugar da anisotropia (era a origem dos pixels NaN) e massa de baixo mais cheia.
   - Botas com bico 25% mais comprido e sola maior. A calça afina sob a barra felpuda, e aparece o cano da bota.
6. **Câmera própria do jogo**:
   - `fov` 29, alvo mais baixo, mais perto do Noel.
   - Zoom leve (fov × 0,9) da abertura da caixa até o começo da festa.
7. **Luz da entrega sempre na conta**: apagada, fica com força zero (`set-a/luzes.ts`). Isso evita recompilar
   tudo na primeira entrega. São 11 luzes sempre; a exceção está registrada no AGENTS.md.
8. **Caminho novo da fila** (`set-a/ajustes.ts`, `FILA.caminho`):
   - Um ponto por lugar, a 1 m um do outro; cabem 10 esperando na tela.
   - Nenhum lugar na faixa da tela entre a câmera e a entrega: a fila não tampa mais quem está sendo atendido.
   - Os pés ficam acima do chat; o último lugar da direita encosta em y 1492.
9. **HUD**:
   - Título em 84 px com contorno de 5 px.
   - Dica curta com uma rosa em SVG (original).
   - Faixa com contorno de 7 px.
   - O selo "+N" saiu: o contador diz "11 na fila · 1 a caminho".
   - Balão à esquerda do Noel, com no máximo 470 px e letra de 40 px.
10. **Outras correções**:
    - Troca de qualidade aos poucos: um gnomo por quadro (`Cast.stepQuality`).
    - `?q=` agora vale também para a qualidade automática.
    - Frases preenchidas com o nome e com o id certo para a voz.
    - Aquecimento dos 12 presentes na carga.
    - `preparar()` nunca roda no mesmo quadro em que se monta um gnomo; com a fila cheia, os gnomos são montados
      em quadros alternados.
    - Apelidos limpos (`limparApelido`).
    - A etiqueta só reescreve o `transform` quando se move.
    - Nos modos manual e demonstração, o console fica sem os 404 (`semListaDoServidor`).
11. **Saída com parada**: quem recebeu o presente para 0,85 s de frente para a câmera antes de sair. O próximo
    espera ele passar.

## Pendências e pontos fracos

- **Poucos nomes na coluna da direita.** Os três primeiros da fila ficam empilhados na borda direita, atrás de
  quem está sendo atendido. Com a regra "colado à cabeça" e "não cobrir o atendido", em geral só um deles mostra
  o nome. Ficam visíveis de 3 a 4 nomes durante a entrega. Para mais, seria preciso redesenhar a subida da fila.
  Isso é composição: vale combinar com a direção criativa.
- **Etiquetas sobre as canelas e o pufe.** A área proibida do Noel termina nos joelhos. Sem isso, os nomes da
  fileira da frente não tinham lugar nenhum.
- **Estrela escura nas mãos.** O metal da estrela só reflete o ambiente escuro. O halo fraco ajuda pouco no fim
  da festa, quando a alegria cai.
- **Gnomo cortado na borda direita.** O último lugar da direita fica rente à borda e aparece cortado pela metade.
- **Estrela sobre a árvore na saída.** Quem sai passa por trás da árvore, e o presente aparece por cima dela.
- **Entrada com a fila vazia** ainda leva ~13 s. Para menos, seria preciso encurtar o caminho de entrada.
- **Ficou de fora:**
  - A pegada da bengala com uma mão só: os presentes estão sendo revisados em outro trabalho
    (`cast/presentes/`, proibido aqui).
  - A pré-compilação (`compileAsync`) do nível de qualidade mais baixo.
  - O middleware do `lab/vite.config.ts` (`/config.json` e `/api/audio` sem servidor). Ele só vale quando o
    laboratório for reiniciado; não o reiniciei para não derrubar o servidor de quem está usando.
  - Os itens que eram só do jogo 2D.
- `vite.config.ts` (proibido aqui) ainda não inclui `jogo3d.html` no `npm run build`.
- O FPS em placa de vídeo de verdade (Windows + OBS) ainda não foi medido.
