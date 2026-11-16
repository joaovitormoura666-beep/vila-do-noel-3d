# Recursos e licenças

Regra do projeto: a arte é original. Modelos, texturas e ambientes de terceiros vêm só do **Poly Haven,
com licença CC0**. Fontes, só com licença livre (hoje a Fredoka, OFL 1.1). Bibliotecas, só de código
aberto, pelo npm. Nada pago, nada de licença duvidosa, nenhuma imagem protegida.

## Poly Haven (CC0)

O Poly Haven (<https://polyhaven.com>) publica modelos, texturas e ambientes com licença **CC0 1.0**:
domínio público, uso livre inclusive comercial, sem exigência de crédito. Mesmo assim o projeto lista
cada recurso e os autores, por reconhecimento, em **`public/assets/CREDITOS.md`** (essa lista vai junto
com o jogo).

### Como baixar (`tools/polyhaven.mjs`)

```
node tools/polyhaven.mjs buscar armchair sofa --tipo models          procura no catálogo
node tools/polyhaven.mjs buscar stone wall --tipo textures
node tools/polyhaven.mjs info ArmChair_01                            dados completos de um recurso
node tools/polyhaven.mjs modelo ArmChair_01 --tri 12000 --tex 1024   baixa, simplifica e grava public/assets/modelos/<id>.glb
node tools/polyhaven.mjs textura rustic_stone_wall --mapas diff,nor,arm,disp --res 1k
                                                                     grava public/assets/texturas/<id>/<mapa>.jpg
node tools/polyhaven.mjs hdri <id> --res 1k                          grava public/assets/hdri/<id>.hdr
```

- A ferramenta guarda os originais em `assets-src/` (não vai para o GitHub nem para o jogo), simplifica a
  malha com o meshoptimizer, converte as texturas do modelo para WebP com o sharp e **acrescenta a linha do
  recurso em `public/assets/CREDITOS.md` sozinha**.
- A saída da textura mostra o tamanho real do ladrilho em metros: use para acertar o `repeat`.
- Simplificar estraga folhagem: para plantas, use `--tri` alto.
- Ela baixa com o `curl` do sistema (o Windows 10 e 11 já têm). Se uma tentativa falhar, ela espera e tenta
  de novo sozinha (até 4 vezes), também no Windows.
- No código: `loadModel('assets/modelos/<id>.glb')` e `loadPbr('<id>', { repeat: [x, y] })`
  (`src/engine/assets.ts`).
- Antes de baixar, veja se já existe no acervo: `lab/acervo/CATALOGO.md`.
- Desistiu de um recurso? Apague o arquivo **e** a linha dele em `CREDITOS.md`.

### O que está no projeto hoje

Lista completa, com autores e páginas: `public/assets/CREDITOS.md`. Resumo por tipo (ids do Poly Haven):

**Modelos (33 arquivos em `public/assets/modelos/`):** `ArmChair_01`, `GreenChair_01`, `Rockingchair_01`,
`Ottoman_01`, `painted_wooden_stool`, `painted_wooden_bench`, `side_table_tall_01`, `round_wooden_table_01`,
`wooden_bookshelf_worn`, `vintage_cabinet_01`, `vintage_grandfather_clock_01`, `GothicCommode_01`,
`mantel_clock_01`, `wooden_candlestick`, `vintage_oil_lamp`, `wooden_lantern_01`, `brass_candleholders`,
`book_encyclopedia_set_01`, `wicker_basket_01`, `treasure_chest`, `horse_statue_01`, `carved_wooden_elephant`,
`brass_vase_01`, `jug_01`, `wooden_bowl_01`, `fancy_picture_frame_01`, `fancy_picture_frame_02`, `tea_set_01`,
`antique_ceramic_vase_01`, `carved_wooden_plate`, `brass_pot_01`, `wooden_bucket_02`, `spinning_wheel_01`.

**Texturas (28 pastas em `public/assets/texturas/`):** `wood_floor`, `wood_floor_worn`, `dark_wooden_planks`,
`dark_planks`, `old_planks_02`, `weathered_brown_planks`, `rough_wood`, `dark_wood`, `wooden_panels`,
`wood_trunk_wall`, `black_walnut_veneer_02`, `pine_bark`, `bark_willow`, `rock_wall_10`, `rock_08`,
`stone_wall_04`, `brick_wall_10`, `clay_plaster`, `painted_plaster_wall`, `snow_02`, `velour_velvet`,
`knitted_fleece`, `curly_teddy_natural`, `brown_leather`, `wool_boucle`, `gingham_check`, `hessian_230`,
`dirty_carpet`.

**Derivados:** `public/assets/arvore/` tem os atlas de ramo da árvore (`ramo_cor.webp`, `ramo_normal.webp`),
fotografados do modelo `fir_sapling` (o modelo em si não vai no jogo), e texturas de casca e veludo da
árvore.

**O que a sala A usa** (de `lab/fotos/sala-a/NOTAS.md`): texturas `dark_wooden_planks` (2k, piso),
`painted_plaster_wall`, `old_planks_02`, `wood_trunk_wall`, `weathered_brown_planks`, `dark_wood`,
`pine_bark`; modelos `ArmChair_01`, `wooden_lantern_01`, `wooden_bucket_02`, `mantel_clock_01`,
`brass_candleholders`, `Rockingchair_01`; mais as texturas das peças do kit e dos personagens. Os outros
modelos são do acervo (testados para a sala, não usados agora). Total de `public/assets/`: cerca de 26 MB.

Limites de peso: todos os recursos do cenário final abaixo de 40 MB, nenhum arquivo acima de 10 MB,
texturas em 1k por padrão (2k só em até três superfícies protagonistas).

## Arte feita por código

O Noel, os gnomos, os presentes, a lareira, a árvore, a janela, o exterior, os tecidos e as texturas
procedurais (tricô, pelúcia, fios, olhos, papel de presente) são originais, escritos no próprio projeto.
As fotos de perfil fictícias do simulador são SVGs originais (`shared/simAvatar.ts`, `lab/dados.ts`).

## Imagens de referência (só consulta)

As imagens de `lab/` servem só para consulta e **não vão no jogo**:

- `lab/referencia-noel-tripo.png` e `lab/referencia-noel/`: quadros do Noel que o dono criou no Tripo.
  É o personagem dele. Se um dia o GLB do Tripo entrar no jogo, confira os termos de uso do Tripo para lives.
- `lab/referencia-clima.png`: quadros de animações natalinas clássicas, só para calibrar cor e luz. São
  obras protegidas: nada pode ser copiado e a imagem não pode ir para páginas publicadas.
- `lab/referencia-gnomo.png`: o exemplo de estilo do dono (personagem de filme), só referência de volume e
  material. Mesma regra: nada copiado, nada publicado.
- Por isso essas duas ficam de fora do git (`.gitignore`) e não vêm num clone do repositório: quem precisar
  delas pede ao dono. As do Noel e `lab/referencia-2d.png` vão no git.
- `lab/referencia-2d.png`: a tela da versão 2D.

## Fontes

- **Fredoka** (pacote `@fontsource/fredoka` 5.3.0), licença SIL Open Font License 1.1: gratuita, pode ser
  usada e distribuída com o jogo. Vai embutida nas páginas, sem depender de serviço externo.

## Áudio

Detalhes em `docs/AUDIO.md`. Resumo:

- **Música:** caixinha de música original em valsa, gerada por código (`src/audio/music.ts`).
- **Efeitos:** sininhos, tambor, brilhos e o trenó, gerados por código (`src/audio/sfx.ts`).
- **Voz do Noel:** a voz sintetizada do navegador (gratuita) ou frases que o dono gravar em
  `public/audio/voz/`. A escolha da voz é uma pergunta criativa em aberto.
- Nenhum arquivo de áudio de terceiros vem com o projeto. Música de terceiros só com licença para lives.

## Bibliotecas

Todas gratuitas e de código aberto, instaladas pelo `npm install`: Three.js 0.187 (MIT), Phaser 3.90 (MIT),
Vite 6, TypeScript 5.9, ws, tsx, Vitest, concurrently, glTF Transform, meshoptimizer e sharp (as três
últimas só para preparar recursos).
