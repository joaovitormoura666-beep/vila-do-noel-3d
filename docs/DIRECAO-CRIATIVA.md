# Direção criativa — escolhas provisórias

O briefing pede para não assumir decisões criativas importantes sem consultar a direção
criativa. Para existir um protótipo que funcione, escolhi um ponto de partida para cada
item abaixo. **Nada aqui é definitivo.** Todos os itens foram feitos para serem trocados
sem mexer na lógica do jogo, e a última coluna diz onde.

O que veio definido e foi seguido à risca: a paleta (vermelho `#B62835`, verde
`#174D3B`, dourado `#E8BC65`, neve `#F7F4EF`, azul-noite `#17253B`), o formato 9:16, a
mecânica da fila e a frase "Vamos ver qual é o seu presente!".

## Escolhas para revisar

| Item | O que está no protótipo | Onde mudar |
| --- | --- | --- |
| Clima visual | Noite azul de conto de Natal, tirada do vídeo de referência só como clima: neve azulada ao luar, janelas em âmbar, árvores secas com neve emoldurando a cena, vilarejo com janelas acesas ao fundo, cercas e neve caindo. A arte é toda original. | `src/render/textures/scenery.ts` |
| Título | "Vila do Noel" no topo, em dourado com contorno vermelho. | `src/ui/Hud.ts` |
| Letra | Fredoka, arredondada e gratuita. | `src/config.ts` (`FONT`) |
| Papai Noel | Clássico e simpático: gorro, barba, bochechas rosadas, saco vermelho ao lado. | `src/render/textures/santa.ts` |
| Visitantes | Bonequinhos agasalhados. 24 combinações de casaco, cachecol, tom de pele e quatro tipos de cabeça: touca com pompom, gorro de duende, tiara de rena e protetor de orelha. | `src/render/textures/visitors.ts` |
| Etiqueta de nome | Pílula escura com borda dourada, foto de perfil redonda (ou inicial colorida) e o nome. Fica maior quando chega a vez da pessoa. | `src/characters/NameLabel.ts` |
| Presentes | 12: Estrela Dourada, Bola de Natal, Bengala Doce, Boneco de Neve, Ursinho de Pelúcia, Sino Dourado, Meia Natalina, Biscoito de Gengibre, Globo de Neve, Pinheirinho, Chocolate Quente e Trenzinho. | `src/gifts/giftCatalog.ts` |
| Revelação | A caixa sobe, treme em suspense e abre com raios e confete. Aparece a faixa "Fulano ganhou / nome do presente". | `src/animations/DeliverySequence.ts` |
| Frases do Noel | 24 frases, listadas abaixo. | `src/santa/phrases.ts` |
| Texto de instrução na tela | "Digite !presente no chat ou envie uma 🌹 para entrar na fila". | Painel, cartão "Como as pessoas entram" |
| Quem entra na fila | Qualquer presente e os comandos gratuitos `!presente`, `!noel` e `!fila`. Seguir o perfil não coloca na fila. | Painel |
| Ordem de atendimento | Ordem de chegada, sem prioridade para quem mandou presente. | `src/queue/QueueManager.ts` |
| Ritmo | Cerca de 10 segundos por pessoa, mais alguns segundos quando a voz do Noel está ligada (ele espera cada fala terminar). Com mais de 6 esperando o jogo acelera aos poucos, até o dobro com 40. | Painel, cartão "Ritmo" |
| Quantos aparecem | 11 personagens visíveis na fila; o resto espera fora da tela. | Painel |
| Fila cheia | Limite de 150 e o aviso "A fila está cheia! Tente de novo já, já 🎄". | Painel e `src/queue/QueueDirector.ts` |
| Música | Caixinha de música original, em valsa lenta, baixinha. | `src/audio/music.ts` ou um arquivo seu |
| Efeitos sonoros | Sininhos na entrada, tambor no suspense, brilho na revelação. Todos sintetizados. | `src/audio/sfx.ts` |
| Voz | Voz sintetizada do navegador, em tom mais grave. | Veja `docs/AUDIO.md` |

## Frases atuais do Papai Noel

`{nome}` vira o nome da pessoa e `{presente}` vira o presente sorteado.

Cumprimentos:

1. Ho, ho, ho! Olá, {nome}!
2. Que alegria te ver, {nome}!
3. Seja bem-vindo à vila, {nome}!
4. {nome}, você chegou na hora certa!
5. Ho, ho, ho! Olha quem apareceu: {nome}!
6. Feliz Natal, {nome}! Chegue mais perto!
7. Eu estava esperando por você, {nome}!
8. {nome}! Que bom que você veio!

Frase principal (obrigatória): Vamos ver qual é o seu presente!

Revelação (só na voz; na tela aparece a faixa com o nome do presente):

1. Olha só: {presente}!
2. É {presente}, só para você!
3. Ho, ho, ho! Saiu {presente}!
4. Que beleza! {presente}!
5. Para você, {nome}: {presente}!
6. Eu sabia! {presente}!

Despedidas:

1. Feliz Natal, {nome}!
2. Volte sempre à vila!
3. Cuide bem do seu presente!
4. Obrigado pela visita, {nome}!
5. Até a próxima, {nome}!

Com a fila vazia:

1. Quem será o próximo a ganhar um presente?
2. Ho, ho, ho! A vila está aberta!
3. Tem presente para todo mundo!
4. Entre na fila e venha me visitar!

Reações dos visitantes: Uau! · Amei! · Que lindo! · Obrigado, Noel! · Eba! · Adorei! ·
Que fofo! · Demais!

## Perguntas para a direção criativa

1. O clima visual está no caminho certo? O que falta para ficar com a cara que você
   imaginou?
2. O Papai Noel e os visitantes ficam neste estilo ou você tem outro em mente?
3. O título fica na tela? Com esse nome?
4. A lista de presentes e as frases estão boas? O que tirar, trocar ou acrescentar?
5. Quem manda presente deve ter alguma vantagem sobre quem usa o comando gratuito, ou a
   ordem de chegada vale para todos?
6. O ritmo de cerca de 10 segundos por pessoa está bom, ou a entrega deve ser mais curta
   ou mais longa?
7. Como deve ser a voz do Noel: gravada por alguém, gerada, ou a do navegador?
8. O texto de instrução pode pedir presente na tela? Vale conferir as regras atuais do
   TikTok sobre isso antes de usar em uma live. A entrada gratuita por comando continua
   valendo de qualquer jeito.
9. Onde ficam o chat e os botões do TikTok por cima do vídeo na sua conta? Isso define
   se o título e a fila precisam subir, descer ou encolher.
