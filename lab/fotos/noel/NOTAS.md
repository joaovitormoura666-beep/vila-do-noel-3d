# Papai Noel 3D: notas de trabalho (segunda rodada, depois da crítica)

É o Papai Noel do Tripo refeito em Three.js 0.187, todo em código: sem modelo pronto e sem imagem gerada
por IA. Ele fica sentado na ArmChair_01 (escala 1,5) da sala A. As botas descansam num pufe de veludo
verde diante da poltrona. O saco de presentes fica no chão, à esquerda dele (+X), do lado de onde o
visitante chega.

## Fotos finais

| arquivo | o que mostra |
|---|---|
| `final-sala.png` (e `final-sala-mini.png`) | 1080x1920 na sala A (vila, estado fila) e a miniatura de celular 270x480 |
| `final-sala-perto.png` | recorte de `final-sala.png` em volta do Noel, ampliado 1,5x |
| `final-entrega.png` | vila com `--estado entrega`: ele estende os braços para o visitante, à direita da tela |
| `final-poses.png` | as 7 poses no estúdio, com a poltrona, mais o perfil. O giro é o mesmo da sala (`yaw=0.185`) |
| `final-rosto.png` | retrato de perto: óculos, olhos com íris, nariz em bolota, bigode, barba curta |
| `final-lado.png` | corpo inteiro sentado, de lado: costas no encosto, mão no braço da poltrona, botas no pufe |

- Os rascunhos desta rodada são `d01` a `d26`: 26 ciclos de fotografar, olhar e melhorar.
- `c*`, `p*` e `r00` são da primeira rodada.
- As fotos do crítico estão em `lab/fotos/noel-critica/`.

## O que mudou com a crítica (do mais importante para o menos)

1. **Barba**. Antes ela descia em cordas até a barriga. Agora é curta, larga e redonda, como um babador, e
   termina no alto do peito, com a borda em ondas.
   - São 4 fileiras de mechas (7, 6, 5 e 2), com raízes de -0,10 a -0,29 e comprimentos de 0,16 a 0,115.
   - A massa de baixo é larga e baixa: centro (0, -0,19, 0,1) e raios (0,215, 0,15, 0,125).
   - As mechas de baixo terminam em ponta macia (calota redonda). As de cima se abrem em 2 lóbulos.
2. **Pelo das mechas** (barba, bigode, sobrancelhas). O relevo largo que parecia sabão saiu. Entrou:
   - um mapa de normal de fios finos (256², 1 a 2 px, repetição 12x3);
   - brilho anisotrópico ao longo dos fios (anisotropy 0,6, rotação π/2);
   - anéis em espaçamento de cosseno (mais anéis nas pontas);
   - o **contorno em fios**: um shader com alpha-to-coverage deixa só os fios mais altos do mapa onde a
     mecha vira silhueta. A borda deixa de ser um polígono liso, sem nenhum triângulo a mais.
3. **Veludo**.
   - Carmim profundo (`#7a0912`), roughness 0,92 e specular 0,15.
   - Sheen 0,8 com `#e85466` e sheenRoughness 0,42: o brilho fica nas bordas.
   - A normal da `velour_velvet` está em 1,0, com repetição 6,5.
   - Sombra de dobra por cor de vértice: uma **oclusão aproximada por cápsulas** (tronco, braços, coxas,
     barba e cabeça) escurece axilas, sob a barba, atrás dos braços e entre as coxas, puxando para o vinho.
   - Há vincos nas cavas dos braços e sobre o cinto.
   - Na sala, o vermelho já não é o objeto mais claro do quadro.
4. **Pernas e botas**.
   - A canela é curta: do joelho à sola são 0,42 m (`CORPO.joelhoASola`).
   - As botas apoiam num **pufe** de veludo verde-pinheiro capitonê, com vivo e pés de bola dourados
     (`noel/pufe.ts`). A altura dele é `PUFE.altura` = joelho - 0,42, então acompanha o
     `ASSENTO_DO_NOEL` da sala.
   - As botas são de couro marrom muito escuro (`#2b1a12`), acetinadas (clearcoat 0,35), cerca de 30%
     menores, com sola separada mais escura, borda chanfrada, salto e vinco no cano.
   - A barra da calça desceu para cobrir o encontro da calça com a bota.
5. **Barra do casaco**. Ela deita sobre as coxas.
   - Para cada ângulo, a altura é o topo da coxa (ou o assento). Um "fechamento" (máximo e depois mínimo
     numa janela de 0,55 rad) faz o pano fazer ponte entre as coxas. Depois vem um borrão e uma queda
     de 2,5 cm.
   - A seção é achatada e larga na frente (deita no colo) e alta dos lados (cai em pé). A borda ondula
     com ruído.
   - A saia tem pesos de pele que passam do tronco para o quadril e as coxas na barra. No rummage a barra
     fica no colo, e não inclina como um prato.
6. **Pelúcia em cascas**.
   - A máscara agora é de **tufos**: cerca de 150 tufos de 7 a 11 fios por ladrilho, que afinam para a
     ponta, com penugem baixa entre eles. `uDensidade` é 8,5.
   - A borda dos fios usa alpha-to-coverage (MSAA do nível alta), sem o corte seco.
   - A casca de fora só guarda as pontas dos tufos.
   - O pelo some onde a peça encosta: nas bordas da faixa, sob a barra e no lado de dentro dos anéis. Isso
     acaba com a "poeira" de pixels sobre o veludo.
7. **Faixa da frente**. Ficou larga (cerca de 16 cm à vista), saltada (3 a 4 cm) e com borda irregular.
   Ela vai do pescoço ao cinto e continua na saia até a barra.
8. **Olhos**.
   - São esferas 30% maiores e mais juntas, com esclera branco-quente, íris castanha de aro escuro,
     pupila e brilho do clearcoat.
   - A pálpebra de cima cobre a borda em repouso.
   - Cada olho tem o próprio osso (37 ossos agora). O olhar procura um alvo:
     - a câmera da sala no repouso;
     - o visitante no give, no talk e no present;
     - a boca do saco no rummage;
     - para cima no cheer.
   - O olhar tem micro-sacadas determinísticas e é limitado a ±0,4 rad de giro e ±0,3 rad de inclinação.
9. **Sobrancelhas**. Cada uma é um arco largo e achatado que cai para fora sobre o aro, com 2 mechas finas
   por cima. Elas sobem 1 a 2 cm no talk, no present e no cheer.
10. **Poses talk e give**.
    - **talk**: pulsos para fora (±0,66, 1,22, 0,2), mãos de perfil e palmas para cima, uma mão de cada
      vez (fases opostas).
    - **give**: alvos girados de `VISITANTE.direcao` (0,37 rad para a esquerda dele), braços quase retos e
      palmas para cima. O tronco gira 0,13 + 0,12 rad e a cabeça vira para o visitante.
    - A mão que acena e a que remexe o saco deixam de misturar a fala, então o punho não fica mais de
      frente para a câmera.
11. **Gorro**. É 30% mais curto, mole e largo na base. A ponta tomba para a esquerda dele e um pouco para
    trás, e o pompom fica pendurado perto da orelha, quase na altura da aba. Há dobras do lado de dentro
    da curva.
12. **Triângulos**. Agora são 59,4 mil no nível alta (eram 71,9 mil). Veja "Números".
13. **Detalhes**.
    - Cinto cinza-carvão acetinado.
    - Fivela com moldura grossa chanfrada (seção quase quadrada) e placa preta fosca no miolo.
    - Nariz 13% menor e mais corado.
    - Rubor mais forte e alto.
    - Pele com sheen avermelhado (0,7, `#ff8a7a`) e cor mais quente nas bordas do rosto.
    - Orelhas à mostra: as costeletas passaram para a frente delas.
    - Boca com fundo vinho fosco no material de pele, língua e lábio de baixo cheio.
    - Cabelo da nuca numa massa só, com a borda em ondas.
    - Luvas 20% maiores e punhos menores.
    - Saco com dobras verticais e o fundo assentado e espalhado no piso.
    - Fitas dos presentes em cetim dourado fosco (material próprio, sem bloom).
14. **Coleta de lixo**. A animação não aloca nada por quadro: usa temporários de módulo, e a rotação de
    ligação dos ossos do IK é calculada uma vez.

## Técnica (base mantida)

- **Forma analítica** (`forma.ts`): um tronco em pera por superelipse. `foraDoTronco()` impede a barba e
  as mãos de entrarem na barriga.
- **Superfícies paramétricas** (`malha.ts`, `aneis.ts`), acumuladas por material. A peça marcada
  `soBase` entra só na casca de baixo do pelo (o drawRange corta as de cima).
- **Esqueleto**: 37 ossos e um Skeleton compartilhado por 8 SkinnedMesh, um por material.
- **IK de dois ossos**, com as poses misturadas nos alvos.
- **Mola do pompom**.
- **Respiração, piscadas, cabeça viva e queixo na fala**.
- **Determinismo**: só dt e t, e todo sorteio usa semente.

## Como ajustar

- **Proporções e encaixe** em `medidas.ts`:
  - `CORPO` (cabeça, braço, quadril, coxa, canela, `pe`, `joelhoASola`);
  - `PUFE` (altura derivada, centro, medidas e cores);
  - `SACO` (x 0,97, z 0,5, giro -0,85).
- **Cores** em `CORES`: veludo, veludoBrilho, bota, sola, cinto, iris, nariz e bochecha.
- **Olhar e visitante**:
  - `VISITANTE` (direção, distância, altura do rosto);
  - `ANIMA.olhar` (limites e intervalo das sacadas);
  - `ANIMA.palpebraRepouso`;
  - o alvo de repouso, que é a câmera da sala A, em `animacao.ts`, `olhar()`.
- **Barba** em `corpo.ts`, array `fileiras` (y, meia largura, quantidade, comprimento, raio, z). A massa
  é o `elipsoide(C(0, -0,19, 0,1) ...)`.
- **Pelúcia**: `uDensidade` e `uGravidade` em `materiais.ts`, os tufos em `texturas.ts` →
  `mascaraDePelo`, e as cascas por nível em `index.ts` → `CASCAS` (alta 5, media 3, baixa 2).
- **Contorno das mechas**: em `materiais.ts`, o `smoothstep` de `cobreM` (quanto do contorno vira fio).
- **Barra do casaco**: `forma.ts` (`RAIO_BARRA`, janela do fechamento, queda) e a seção em `corpo.ts`
  (`barra`).
- **Poses**: em `animacao.ts`, `lado()` e os alvos de rummage e wave.
- **Poltrona no estúdio**: `--param poltrona=1`, e fotografe com `--t 1,6`, porque ela carrega depois.

## Números (Noel + saco + pufe, uma cópia)

| nível | cascas | triângulos |
|---|---|---|
| alta | 5 | 59.448 |
| media | 3 | 52.872 |
| baixa | 2 | 49.584 |

- **Por material** (base, uma camada):
  - veludo 8.144;
  - pelo 3.800, mais 3.288 por casca de cima (barra de trás e aba de trás só na base);
  - mechas 10.424;
  - pele 4.528;
  - luva 2.680;
  - couro 3.648;
  - ouro 2.400;
  - olhos 1.280;
  - saco 6.832 (juta 2.272, papel 1.440, veludo 1.584, fita 1.536);
  - pufe 2.560 (veludo verde 2.176, pés 384).
- **Draw calls**: 14, sendo 8 SkinnedMesh, 4 malhas do saco e 2 do pufe.
  - A sombra soma 12, porque o pelo em cascas e os olhos não projetam sombra.
  - Quadro inteiro da sala A em alta: cerca de 370 draw calls e 1,41 M de triângulos.
- **Texturas**:
  - geradas em código: máscara de tufos 256², fios (cor e normal) 256² e papel 256²;
  - Poly Haven: `velour_velvet`, `curly_teddy_natural`, `brown_leather`, `knitted_fleece` e
    `hessian_230`.
- **Materiais compartilhados** por todas as cópias. `rig.dispose()` descarta o Skeleton, e
  `criarMateriais().dispose()` libera os materiais e as texturas.

## O que ainda está fraco

- **Saco na sala A**: está no lugar certo (do lado do visitante, à frente do braço da poltrona), mas na
  câmera da sala as etiquetas de nome da fila e os gnomos passam na frente dele. Mudar de lado não
  resolve, porque há etiquetas dos dois lados.
- **Pelúcia de muito perto** (rosto em tela cheia): a aba e a barra ainda lembram uma toalha fina, não
  tufos longos. Na distância da sala ela lê bem.
- **Mechas da barba em close extremo**: a ponta das mechas de baixo ainda mostra poucas facetas. O
  contorno em fios ajuda, mas não são fios soltos de verdade.
- **Barra do casaco**: deita no colo e ondula, mas ainda é um anel contínuo grosso.
- **Botas**: simples (bico redondo, sola e salto). Não há cadarço nem costura.
- **Olhar**: o alvo de repouso é fixo na câmera da sala A, e o visitante é a âncora da sala A gravada em
  `VISITANTE`. Em outra sala é preciso ajustar os dois.
- **Give no estúdio**: com o giro padrão do estúdio, os braços apontam para a câmera e encurtam. Por isso
  `final-poses` usa o giro da sala.
