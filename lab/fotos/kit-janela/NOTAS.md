# Kit: janela grande e tecidos (segunda versão, depois da crítica)

Peças de `src/world/kit/janela/` e `src/world/kit/tecidos/`, fotografadas no estúdio
`src/world/set-kit-janela/` (`node tools/shot.cjs sala --param set=kit-janela ...`).
A API pública não mudou: só ganhou o método `janela.luar()` e opções novas com padrão.
Escala, origem e orientação das peças continuam as mesmas.

## Fotos desta pasta

| Arquivo | O que mostra |
| --- | --- |
| `final.png` (+ `final-mini.png`) | peça inteira no estúdio, 1080x1920, qualidade alta |
| `final-media.png`, `final-baixa.png` | o mesmo quadro em `--q media` e `--q baixa` |
| `angulo.png` | janela vista de lado: vão fundo, guarnição, plintos, cortina com profundidade |
| `perto-vidro-geada.png` | geada pintada vidro a vidro (sem carimbo), cristais em ramos, neve de fora |
| `perto-cortina.png`, `perto-cortina-pregas.png` | cabeçote de prega francesa, ganchos e argolas, pregas de largura e fundura desiguais, brilho rasante do veludo |
| `perto-peitoril-plinto.png` | encontro guarnição/peitoril resolvido com plinto, perfil do marco, nogueira com veio |
| `perto-perfil-cremona.png` | encontro das folhas, cremona de latão envelhecido, pinázios perfilados |
| `perto-tapete.png` | tapete redondo com cordão de arremate (sem franja), nós de 2,8 mm, beira levantada |
| `perto-franja.png` | tapete retangular: franja curta de feixes amarrados nas cabeceiras |
| `perto-meias.png` | meias de tricô (cores ponto a ponto, relevo de meia-malha) com punho de pelúcia em cascas |
| `final-luar-direcional.png` | teste pedido: DirectionalLight azul com sombra vinda de fora |
| `recorte-luar-de-cima.png` | o desenho da janela no piso visto de cima (arco, travessas, penumbra) |
| `variante-banco.png`, `variante-reta-tapete-retangular.png` | `banco: true`; `arco: false` com tapete retangular |
| `ciclos/` | rascunhos dos ciclos de trabalho |

Nenhuma das fotos finais teve mensagem de erro no console.

## O que mudou, na ordem da crítica

1. **Cortinas (geometria).** Saiu a senoide de período fixo. Agora a fase de cada fileira é a
   integral de uma frequência local com ruído (pregas de largura desigual, ±40%, que derivam com a
   altura); cada prega tem fundura própria, e um segundo ruído no índice da prega faz algumas
   morrerem no meio da queda e duas se fundirem. O cabeçote é de **prega francesa**: gomos estreitos
   costurados (uma argola e um gancho de latão por gomo), tecido liso entre eles, e o pano volta
   6 cm por trás (entretela), com a costura marcada. Uma ondulação larga (30 a 60 cm) muda o brilho
   das pregas ao longo da queda. No piso sobram 4,5 cm de pano, que dobram para a frente, com uma
   dobra deitada logo acima. A bainha vira para dentro. A tinta preta por vértice caiu para 0,86 no
   fundo da prega: o escuro vem da luz.
2. **Veludo (material).** Base carmim escura (`#5a0f19`); sheen na própria cor (rugosidade 0,5);
   em `onBeforeCompile` o difuso cai até 70% quando o pano encara a câmera (veludo é escuro de
   frente e acende de raspão); textura de "pelo escovado" (manchas verticais geradas por código)
   modula sheen e rugosidade; relevo de `velour_velvet` em ladrilho de 12 cm com força 1,3. O
   avesso (`!gl_FrontFacing`) é forro creme escuro, sem pelo: a vira da borda e o cabeçote mostram
   o forro. Na qualidade baixa o pano troca para um `MeshStandardMaterial`.
3. **Recorte do luar.** Cor cobalto (`#2c74cc`) e força 2 (antes `#a9c0ff` com 3,4), penumbra
   (`shadow.radius` 3) e cone com folga. A janela agora tem `janela.luar(opcoes)`, que devolve o
   SpotLight já acertado (veja a API). O estúdio usa esse método.
4. **Geada.** Uma textura para a janela inteira (440 px/m), com cada vidro pintado no lugar. A
   força sai de um campo no espaço da janela: fileira de baixo, cantos de fora e lado do vento mais
   carregados, um terço dos vidros quase limpo, um ou dois tomados até a metade. O corpo do gelo
   nasce dos cantos (soma de exponenciais das distâncias às bordas, contorno roído por ruído em
   duas escalas, granulado). Os cristais são ramos contínuos presos à borda, com 3 a 4 níveis de
   galhos alternados. O halo do topo saiu. O emissivo foi para 0,16 (`#3f5fae`), com rugosidade
   0,55. Uma chamada de desenho.
5. **Madeira.** Trocada por `black_walnut_veneer_02` (nogueira de veio reto e fino, com poro), em
   cor marrom e dessaturada no shader, sem o vinho. Arco e cantos em **aduelas e meia-esquadria**:
   `varrerPerfil` divide o caminho em peças (cada quina viva é uma emenda e cada arco vira peças de
   no máximo 24°), com o veio reto ao longo da corda de cada peça e começando em outro ponto da
   textura. A guarnição agora pousa em **plintos** sobre o peitoril (o encontro mordido sumiu).
6. **Meias.** Corpo achatado (0,34 na perna e 0,5 no pé), dobra no tornozelo, pé caído, perna
   desencostando 2 a 3 cm da parede embaixo, giro próprio. As cores vêm ponto a ponto de uma
   textura de 48 x 84 pontos (listras, calcanhar e biqueira em degraus de ponto, fio com tingimento
   desigual). O relevo de meia-malha ("V") é desenhado por código. O punho é um rolo virado para
   fora, com ruído de 3 a 4 mm, mais 4 cascas de pelo instanciadas (alphaTest sobre ruído): borda
   felpuda, sem facetas e sem a tinta escura de contorno.
7. **Neve de fora.** Montinhos só em parte dos vidros, puxados para o lado do vento, de 0,5 a 3
   cm. Cor azul-acinzentada (`#8396c0`, emissivo 0,15) com gradiente por vértice (base azul e
   escura, crista clara) e âmbar fraco nos 2 cm junto ao vidro. O monte do peitoril tem perfil
   contínuo (superelipse, 13 pontos, sem o vinco) e três cornijas pendendo da beirada. O relevo
   `snow_02` está em ladrilho de 8 cm.
8. **Cabeça, barra e varão.** Varão de raio 22 mm (antes 14) com ponteiras torneadas maiores;
   argolas de raio 38 mm e fio de 5 mm; ganchos ligando cada gomo à argola; suportes com braço
   horizontal e berço em U (a haste solta e os fios finíssimos saíram).
9. **Vidro.** Um quadro por vidro na mesma malha, cada um inclinado de 0,4 a 0,8°, mais um mapa
   de normais de vidro soprado: o reflexo quebra em cada pinázio.
10. **Tapete.** O redondo não tem mais franja: a borda é arrematada por um cordão de lã vinho
    enrolado em diagonal. O retangular tem franja curta (4,5 cm) de feixes amarrados a cada 1,2 cm
    (nó erguido, 6 a 10 fios em leque, 4 variações, giro de ±12°, `alphaTest` no lugar de
    transparência). A beira levanta em dois pontos sorteados (4 a 8 mm em 30 a 50 cm), além da ruga
    que já existia. Os nós têm 2,8 mm, na textura de 1024 (512 na baixa): fica 4 vezes mais barata
    de pintar e sem degraus visíveis.
11. **Latão.** Cor `#9a7b45`, rugosidade 0,62 com mapa de pátina por ruído (também como oclusão) e
    `envMapIntensity` 0,75: o halo no punho da cremona sumiu. Dobradiças, cremona e ponteiras têm 16
    a 28 lados.
12. **setQuality de verdade.** Na cortina: sombra do latão só na alta, sombra do cordão desligada
    na baixa e veludo Standard na baixa. Na janela: a neve e o varão não projetam sombra na baixa;
    a madeira projeta sempre (é o desenho da janela no piso). A geada é pintada em 300 px/m na
    baixa.
13. **Vida.** A barra da cortina balança 2,5 mm, devagar, no shader, em função de `t` (`update`
    da janela repassa `dt` e `t` às cortinas).
14. **Luz quente do estúdio.** Cone de 0,68 rad, `shadow.radius` 2,5, `normalBias` 0,03 e câmera de
    sombra justa: os degraus na sombra da cortina sumiram. Para a composição, **cortina e varão
    pedem pelo menos 1 texel de sombra por centímetro na parede**.

## API (sem mudanças que quebrem; acréscimos marcados)

```ts
import { criarJanela } from './world/kit/janela';
import { criarCortina, criarTapete, criarMeia } from './world/kit/tecidos';

const janela = await criarJanela(ctx, {
  largura: 3, altura: 3.2, peitoril: 0.75, arco: true, colunas: 4, linhas: 3,
  espessuraParede: 0.4, banco: false, cortinas: true, aberturaCortinas: 0.85,
  corTecido: '#5a0f19', inverno: true, semente: 7,
});
janela.root.position.set(x, 0, zDaParede);   // o vidro fica em z = 0 da peça; dentro é +Z
janela.vao;          // { largura, altura, base, flecha, zFora, zDentro }: a parede vai de zFora a zDentro
janela.contorno(28); // polígono do vão (XY local, anti-horário) para furar a parede
janela.vidro;        // malha do vidro (um quadro por vidro, castShadow false)
janela.geada;        // malha da geada (material.emissiveIntensity ajusta o azul que atravessa)
janela.cortinas;     // [esquerda, direita]
janela.limites;      // { xMin, xMax, yMax, zMax }
// NOVO (opcional): o luar já acertado, filho de janela.root (anda com a janela)
const luar = janela.luar({ forca: 2, cor: '#2c74cc', mapa: 2048, penumbra: 3 /*, deOnde, alvo */ });
cena.add(janela.root);
// no laço: janela.update(dt, t) (balanço da barra das cortinas); janela.setQuality(level)

const cortina = await criarCortina(ctx, { largura: 1.8, altura: 4.1, abertura: 0.85, lado: 'esquerda', cor: '#5a0f19' });
const tapete = await criarTapete(ctx, { forma: 'redondo', largura: 2.9, semente: 3 });           // cordão na borda
const tapete2 = await criarTapete(ctx, { forma: 'retangular', largura: 2.5, comprimento: 3.3 }); // franja nas cabeceiras
const meia = await criarMeia(ctx, { cor: '#8e1c27', corDetalhe: '#d9cfb8', virada: 'direita', semente: 1, tamanho: 0.46 }); // origem no gancho
```

`criarTapete` aceita `franja` (padrão: só no retangular). `materialVeludo(cor, brilhoRasante)` e
`geometriaVarao(...)` continuam exportados (o varão agora tem raio padrão de 22 mm).
`VERMELHO_VELUDO` passou a `#5a0f19`.

O luar tem de vir de fora (z negativo) com `castShadow`. O vidro e a geada não projetam sombra; a
madeira projeta.

## Recursos (Poly Haven, CC0), em `public/assets/texturas/`

| Recurso | Uso | Peso |
| --- | --- | --- |
| `black_walnut_veneer_02` (novo) | madeira da janela, banco, rodapé e tábua do estúdio | 180 kB |
| `velour_velvet` | relevo e rugosidade do veludo | 296 kB |
| `dirty_carpet` | relevo e rugosidade do tapete | 384 kB |
| `curly_teddy_natural` | punho da meia | 236 kB |
| `knitted_fleece` | só a manta (opcional); a meia não usa mais | 212 kB |
| `snow_02` (já existia) | relevo da neve de fora | (nor) |

Total das minhas texturas: cerca de 1,3 MB. As linhas estão em `public/assets/CREDITOS.md`.
`dark_wood` saiu destas peças, mas continua na pasta porque set-a e set-b a usam.
Baixei e apaguei `smoked_walnut_veneer` e `walnut_veneer` (testes), com as linhas dos créditos.
Geada, pelo do veludo, ondulação do vidro, pátina do latão, cores e relevo do tricô, franja e cordão
do tapete são texturas geradas por código na carga (nada em arquivo).

## Números (medidos com `--param numeros=1`)

| Peça | Malhas (chamadas) | Triângulos |
| --- | --- | --- |
| Janela com cortinas | 12 | 58 068 (orçamento: 60 mil e 25 chamadas) |
| Tapete redondo 2,9 m (com cordão) | 2 | 9 328 |
| Tapete retangular 2,5 x 3,3 m (com franja) | 2 | 7 044 |
| Meia | 4 | 5 808 + 3 cascas instanciadas de 1 224 (cerca de 9 500 desenhados) |

Dentro da janela: madeira 5 608 (com os plintos), vidro 84, latão 5 364, geada 84, neve 5 832,
cada cortina 18 744 (pano 13 328, latão 2 688, cordão 2 728), varão 3 608.

Quadro inteiro do estúdio (soma das passadas de sombra e de oclusão): alta 175 chamadas e 534 mil
triângulos; média 75 e 200 mil; baixa 41 e 128 mil. Luzes do estúdio: 3 (luar da janela com
sombra, luz quente com sombra só na alta, hemisférica). As peças só criam luz se `janela.luar()`
for chamado.

## O que ficou fraco

- **Cortina:** as pregas melhoraram, mas o desenho é analítico, sem simulação de pano. Na
  miniatura o feixe ainda lê um pouco como listras regulares, e abaixo da abraçadeira o pano lembra
  um maço. O próximo passo seria o relaxamento massa-mola sugerido na crítica.
- **Recorte do luar sobre o tapete vermelho:** azul sobre vinho dá um malva. No piso já lê como
  azul.
- **Vidro de frente:** o reflexo depende do ambiente da composição. No estúdio é fraco.
- **Madeira:** não há desgaste por vértice nas quinas; a rugosidade é a mesma no peitoril e no
  resto.
- **Banco e opcionais (almofada, manta, almofadão do banco):** não mexi. Continuam abaixo do nível
  e não devem entrar na composição como estão.
- A saia do peitoril ainda termina em corte seco (sem retorno para a parede).
