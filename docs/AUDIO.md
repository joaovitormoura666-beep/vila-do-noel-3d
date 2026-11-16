# Áudio

O jogo tem três tipos de som, cada um com volume próprio no painel, mais o volume geral:

| Tipo | De onde vem | Licença |
| --- | --- | --- |
| Música | Caixinha de música original, gerada por código | Sem restrição |
| Efeitos | Sininhos, tambor e brilhos, gerados por código | Sem restrição |
| Voz do Noel | Voz sintetizada do navegador, ou frases gravadas por você | Depende do que você gravar |

Nenhum arquivo de áudio de terceiros vem com o projeto.

## Voz do Papai Noel

Para cada fala o jogo procura, nesta ordem:

1. Um arquivo gravado para aquela frase em `public/audio/voz/`.
2. A voz sintetizada do navegador, que é gratuita.

Se nenhuma das duas existir, a fala aparece só no balão e a entrega segue no ritmo
normal.

### Voz sintetizada

- Usa as vozes em português do Brasil instaladas no Windows e no navegador, dando
  preferência às masculinas.
- No Edge costumam aparecer vozes mais naturais, que dependem de internet. Vale abrir a
  tela do jogo no Chrome e no Edge e comparar com o botão **Testar voz** do painel.
- Se não houver nenhuma voz em português: Configurações do Windows → Hora e idioma →
  Fala → Gerenciar vozes → Adicionar vozes → Português (Brasil).
- O tom é mais grave que o normal para lembrar o Noel. Para ajustar, mude `u.pitch` e
  `u.rate` em `src/audio/voice.ts`.
- Antes de falar um nome, o jogo tira emojis, números e símbolos e usa só as duas
  primeiras palavras, para a voz não soletrar coisas como "underline 2026". A fala do
  nome pode ser desligada no painel.

### A voz no OBS

A fonte de navegador do OBS normalmente não tem voz sintetizada. O jogo percebe quando
a fala não começa, para de tentar por um minuto de cada vez e segue no ritmo normal. O
painel mostra o aviso "Esta tela não tem voz sintetizada".

Três saídas, da melhor para a mais simples:

**A. Gravar as frases.** Os arquivos tocam em qualquer lugar, inclusive na fonte de
navegador do OBS, e a voz fica com a personalidade que a direção criativa escolher. É o
caminho que recomendo para a live. Veja a lista abaixo.

**B. Capturar uma janela do Chrome ou do Edge.** Abra a tela do jogo pelo botão do
painel e, no OBS, use "Captura de janela" no lugar da fonte de navegador, junto com a
captura do áudio do computador ou do aplicativo. A voz sintetizada funciona, mas a
imagem fica do tamanho da janela (menos nítida que 1080x1920) e a janela precisa ficar
visível o tempo todo.

**C. Ficar sem voz.** Desligue "Voz do Papai Noel ligada" no painel. Ficam os balões, a
música e os efeitos.

### Frases gravadas

Salve cada frase como `.mp3` em `public/audio/voz/`, com o nome do identificador, e rode
`npm start` de novo. Pode gravar só algumas: as outras continuam na voz sintetizada.

| Arquivo | Frase no balão | O que gravar |
| --- | --- | --- |
| `principal.mp3` | Vamos ver qual é o seu presente! | Igual |
| `ola-1.mp3` | Ho, ho, ho! Olá, {nome}! | Ho, ho, ho! Olá! |
| `ola-2.mp3` | Que alegria te ver, {nome}! | Que alegria te ver! |
| `ola-3.mp3` | Seja bem-vindo à vila, {nome}! | Seja bem-vindo à vila! |
| `ola-4.mp3` | {nome}, você chegou na hora certa! | Você chegou na hora certa! |
| `ola-5.mp3` | Ho, ho, ho! Olha quem apareceu: {nome}! | Ho, ho, ho! Olha quem apareceu! |
| `ola-6.mp3` | Feliz Natal, {nome}! Chegue mais perto! | Feliz Natal! Chegue mais perto! |
| `ola-7.mp3` | Eu estava esperando por você, {nome}! | Eu estava esperando por você! |
| `ola-8.mp3` | {nome}! Que bom que você veio! | Que bom que você veio! |
| `revela-1.mp3` a `revela-6.mp3` | Olha só: {presente}! (e variações) | Uma exclamação sem o nome do presente, como "Olha só que lindo!" |
| `tchau-1.mp3` | Feliz Natal, {nome}! | Feliz Natal! |
| `tchau-2.mp3` | Volte sempre à vila! | Igual |
| `tchau-3.mp3` | Cuide bem do seu presente! | Igual |
| `tchau-4.mp3` | Obrigado pela visita, {nome}! | Obrigado pela visita! |
| `tchau-5.mp3` | Até a próxima, {nome}! | Até a próxima! |
| `espera-1.mp3` | Quem será o próximo a ganhar um presente? | Igual |
| `espera-2.mp3` | Ho, ho, ho! A vila está aberta! | Igual |
| `espera-3.mp3` | Tem presente para todo mundo! | Igual |
| `espera-4.mp3` | Entre na fila e venha me visitar! | Igual |
| `teste-voz.mp3` | Ho, ho, ho! Feliz Natal! | Igual (é a frase do botão "Testar voz") |

Um arquivo gravado substitui a fala inteira, então ele não consegue dizer o nome da
pessoa nem o presente sorteado. O nome continua aparecendo no balão e na faixa da
revelação. Juntar frases gravadas com o nome falado é uma pendência.

Dicas: frases curtas, de 1 a 3 segundos, todas no mesmo volume. Use a sua voz, a de um
locutor, ou uma voz gerada cuja licença permita uso em transmissões.

A lista de frases fica em `src/santa/phrases.ts`. Se a direção criativa mudar um texto,
mantenha o identificador ou renomeie o arquivo junto.

## Música de fundo

Por padrão toca uma caixinha de música original, em valsa lenta. Ela é gerada por
código e não é nenhuma canção existente.

Para usar outra música, salve o arquivo como `public/audio/musica/fundo.mp3` (também
aceita `.ogg` e `.wav`) e rode `npm start` de novo. Ela toca em repetição no lugar da
caixinha.

Use só música com licença que permita transmissões ao vivo: domínio público, Creative
Commons adequada ou licença comprada. Música protegida pode fazer a plataforma silenciar
ou derrubar a live.

## Efeitos sonoros

| Momento | Som |
| --- | --- |
| Alguém entra na fila | Dois sininhos |
| A pessoa chega ao Noel | Sinos com guizos |
| O Noel procura no saco | Farfalhar |
| A caixa sobe | Escala de sininhos |
| Suspense | Trinado rápido |
| Revelação | Acorde de sinos com guizos |
| Comemoração | Pulinho |
| Fila cheia | Duas notas descendo |

Para ajustar, edite `src/audio/sfx.ts`.

## O som não sai

- Aberta direto em uma aba, a tela do jogo precisa de um clique para liberar o áudio.
  O painel avisa quando isso acontece.
- No OBS, marque "Controlar áudio via OBS" na fonte de navegador e confira o mixer.
- Confira os volumes no cartão "Áudio" do painel.
