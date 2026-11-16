# Exterior: a vila nevada vista pela janela (segunda rodada, depois da crítica)

Peça: `src/world/kit/exterior/index.ts` (`criarExterior`). Estúdio: `src/world/set-kit-exterior/index.ts`.
Arquivos: `index.ts`, `pinheiros.ts` (novo), `arvores.ts`, `casas.ts`, `ceu.ts`, `luar.ts`, `particulas.ts`,
`relevo.ts`, `sombras.ts`, `terreno.ts`, `treno.ts`, `util.ts`.

## O que mudou nesta rodada (na ordem da crítica)

1. **Neve invadindo a sala (crítico)**: a malha do terreno começa em z = -0,02 (nunca passa do vidro), com uma
   saia que desce 0,8 m no mesmo z, e o shader do terreno descarta z > 0. Tirei o ponto [-1, 0,2] do perfil.
   Nova opção `alturaNeveNaParede` (padrão 0,36 m) para peitoris baixos.
2. **Bosque de cones (crítico)**: troquei a técnica. Um pinheiro carregado é construído em 4 feitios e
   fotografado UMA vez (cor + normal, 4 x 512 x 1024) para um atlas; o bosque é um `InstancedMesh` de cartões
   que giram para a câmera (impostores), iluminados pelo luar com a normal fotografada, com sombra assada pelo
   mesmo recorte. 620 árvores (460 / 300) por 2 triângulos cada: saiu de 14 000 para 1 240 triângulos, e cada
   árvore tem agulhas, verticilos caídos e neve em camadas.
3. **Pinheiro do primeiro plano (crítico)**: ramos refeitos como tiras curvas recortadas por alfa de um atlas de
   raminhos pintado em canvas (centenas de agulhas finas por raminho), duas tiras por ramo, normais "de volume";
   manto de neve próprio com falhas, borda que escorre irregular e pontas das agulhas de fora; ponta com guia
   fino e punhado torto.
4. **Vista em ângulo (crítico)**: nova opção `azimuteVista` (graus). Tudo além do jardim gira para o eixo de
   quem olha (vila, igreja, ponte, bosque, morros, neblina, céu, lua, aurora, trenó e a direção do luar); o
   jardim fica colado à parede e a árvore nua, os pinheiros e o lampião deslizam para os lados do cone de visão.
   O estúdio passa `azimuteVista = giro`. Fotos: `final-angulo-40.png`, `final-angulo-m35.png`,
   `final-angulo-40-treno.png` (igreja, lua e trenó dentro do vão).
5. **Lampião**: poste de ferro fundido torneado (`Malha.torno`, perfil com base, anel, fuste que afina e
   colarinho), braço redondo, lanterna sextavada de caixilho fino, chapéu de seis águas com remate, vidro fosco
   âmbar (miolo nunca branco, fuligem nos cantos), neve fina que acompanha o chapéu. Emissão, halo e luz local
   reduzidos (cerca de 40 %).
6. **Luz quente virando lilás**: a luz quente agora substitui parte do luar em vez de somar (`mix(luz, luz*0,3,
   q) + quente`) e `uQuente` passou a (1, 0,6, 0,19). A luz da sala na neve deixou de ser pintada: é calculada no
   shader (`luzDaSala`, em `luar.ts`) atravessando o vão da janela, com o trapézio que se abre e amolece e a sombra
   da cruz do caixilho; só no chão e no que é baixo. Controlável a cada quadro por `exterior.luzSala`
   (`final-luz-da-sala.png`).
7. **Profundidade por valor**: névoa por distância de 0,02 para 0,026, bruma de vale de 0,55 para 0,8, e uma
   faixa de oclusão pintada (que também segura o luar) nos primeiros metros junto da parede.
8. **Janelas e poças**: cada cômodo aceso tem força (0,35 a 1) e matiz (mel, âmbar, raras cortinas avermelhada ou
   esverdeada); cerca de 40 % das janelas apagadas; emissão limitada (sem miolo branco); uma poça por janela acesa,
   em trapézio que nasce no pé da parede, proporcional à força, só para fachadas voltadas para a sala (some o
   filete laranja atrás dos telhados); halos menores e mais fracos.
9. **Árvore nua**: cada galho tem o seu gerador (semente derivada da do pai) e uma linha de controle fixa de
   quatro trechos reamostrada por Catmull-Rom centrípeta; 12 lados no tronco, 8 e 6 nos níveis 1 e 2; colarinho
   na base de cada filho; neve em arco de cinco pontos com falhas e pontas arredondadas. O nível de detalhe só
   muda lados e segmentos (e corta o último nível): a silhueta é a mesma em alto, médio e baixo.
10. **Níveis**: `setQuality` agora sobe e desce o bosque (`count = min(total, alvo)`).
11. **Trenó**: 1,7 vez maior; arco novo, entrando pela esquerda no céu limpo, passando rente ao alto da lua
    perto de 0,45 e saindo à direita por entre os galhos já esmaecendo; silhueta quase preta com fio de luar no
    dorso; a rena de trás de cada parelha um tom mais clara; rastro dourado (1, 0,75, 0,35) que nasce na
    traseira do patim, com pontos maiores junto do trenó.
12. **Fumaça**: novelos de duas oitavas rolando para cima (sem estrias), bordas dissolvidas, alfa máximo 0,26,
    cor do céu com um toque quente na base, só em 42 % das chaminés, altura e inclinação próprias.
13. **Aurora**: cortinas rolando em sentidos opostos, borda de baixo ondulando por ruído no tempo e mais larga.
14. **Ponte** oblíqua ao eixo (o arco aparece de perfil); **mourões** com tampas tortas e irregulares;
    **cordão de neve** da cerca com falhas; **riacho** amostrado a cada 0,5 m; **fio de luar** nas quinas de
    madeira, pedra e casca (a textura da casca agora trabalha).

## API (inalterada; só opções e campos novos com padrão)

```ts
import { criarExterior } from '../kit/exterior';

const exterior = await criarExterior(ctx, {
  semente: 7,
  largura: 260, profundidade: 120,   // diorama (m)
  ganho: 1,                          // brilho geral (também em exterior.ganho)
  luzDaSala: 0.5,                    // força inicial da luz da sala na neve (depois: exterior.luzSala)
  janela: { largura: 3.2, altura: 3.4, peitoril: 0.75 },   // vão real, para o recorte da luz da sala
  alturaNeveNaParede: 0.36,          // neve encostada na parede de fora (abaixe se o peitoril for baixo)
  azimuteVista: 0,                   // graus: de onde a câmera olha pela janela (vista em ângulo)
  condutor: false,
});
cena.add(exterior.root);             // vidro em z = 0, piso da sala em y = 0; gire o root junto com a parede

const luz = new THREE.DirectionalLight(exterior.luar.cor, exterior.luar.intensidade);
luz.position.copy(exterior.luar.direcao).multiplyScalar(12);   // espaço da peça; já inclui azimuteVista

// a cada quadro
exterior.update(dt, t);
luz.color.copy(exterior.luzExterna.cor);
luz.intensity = exterior.luzExterna.intensidade;
exterior.luzSala.intensidade = 0.5 * tremulacaoDaLareira;    // opcional: a sala respira na neve

exterior.setTreno(progress, intensity);   // SLEIGH_PASS: 0 entra à esquerda, 1 sai à direita
exterior.setNoiteMagica(intensity);       // MAGICAL_NIGHT: 0..1
exterior.setQuality('media');
exterior.dispose();
```

Retorno: `Peca` + `luar { cor, direcao, intensidade, direcaoLua }`, `luzExterna { cor, intensidade }`,
`luzSala { cor, intensidade }` (novo), `setTreno`, `setNoiteMagica`, `ganho`, `numeros()`.
Mudança de comportamento (não de assinatura): o trenó agora vai da esquerda para a direita.

Estúdio (endereço): `efeito`, `progresso`, `intensidade`, `semente`, `prof`, `larg`, `ganho`, `giro` (gira peça e
parede e passa `azimuteVista`), `parede=0`, `condutor=1`, `numeros=1` (escreve um aviso no console: só para
medir, nunca nas fotos finais).

## Recursos (Poly Haven, CC0, 1k, JPG; nada novo baixado nesta rodada)

| Recurso | Uso | Peso |
| --- | --- | --- |
| `snow_02` (diff + nor) | neve do chão e neve pousada | 91 + 203 kB |
| `clay_plaster` (diff + nor) | reboco | 18 + 92 kB |
| `dark_planks` (diff + nor) | tábuas, cercas, lampiões | 115 + 52 kB |
| `stone_wall_04` (diff + nor) | pedra | 211 + 254 kB |
| `bark_willow` (diff + nor) | casca | 149 + 338 kB |

Total 1 523 kB; as cinco linhas estão em `public/assets/CREDITOS.md`. Atlas de raminhos, atlas do bosque, atlas de
vidros e mapa de luz são gerados na construção (canvas e uma fotografia de render target).

## Números (estúdio, 1080 x 1920)

- Alto: 17 chamadas próprias (quadro 37), 138 441 triângulos (quadro 138 506; 140 932 com o trenó). Parcelas:
  neve pousada 43 142, galhos 31 745, terreno 28 776, madeira 19 070, pinheiros 6 144, céu 3 080, pedra 1 854,
  morros 1 536, bosque 1 240.
- Médio: quadro 123 441 triângulos. Baixo: 21 chamadas no quadro, 95 458 triângulos.
- Pontos: 5 244 (estrelas, flocos, halos) + 340 do rastro.
- Luzes reais: 0. Sombras: 2 mapas assados uma vez. Render targets extras: atlas do bosque (2 x 2048 x 1024 no
  alto, 1024 x 512 no baixo).
- Console limpo em todas as fotos finais.

## Fotos

`final.png` (+ `final-mini.png`), `final-media.png`, `final-baixa.png`; recortes `final-vila.png`,
`final-pinheiro-lampiao.png`, `final-arvore-nua.png`, `final-igreja.png`, `final-jardim-cerca.png`;
`final-perto-do-vidro.png`, `final-luz-da-sala.png` (câmera alta, poça da sala com a cruz do caixilho);
`final-angulo-40.png`, `final-angulo-m35.png`, `final-angulo-40-treno.png`; `final-treno-0.3/0.5/0.7.png`,
`final-treno-perto.png` (0,45); `final-noite-magica.png`; `final-anim-t2/t8/t14.png`.

## O que ainda está fraco

1. Os raminhos do último nível da árvore nua são varetas retas com quinas (2 segmentos): de teleobjetiva se nota.
   Cartões com raminhos pintados dariam a renda fina por menos triângulos.
2. Os mantos de neve do pinheiro do jardim ainda são lisos e claros demais perto do lampião (lembram placas).
3. O cordão de neve sobre a régua da cerca, visto de perto, parece uma tábua branca de borda reta.
4. Impostores do bosque: de cima (câmera muito alta) os cartões verticais se denunciam; o bosque ainda é um campo
   de brilho parecido, poderia escurecer mais na crista.
5. Na vista em ângulo forte, o trecho do terreno entre o jardim e o vale torce (é onde o giro se mistura); não
   aparece nas fotos, mas uma câmera alta veria.
6. A luz da sala na neve é forte no padrão (0,5): a composição deve calibrar com a lareira.
7. Telhados: o manto ainda tem facetas leves em teleobjetiva fechada.
