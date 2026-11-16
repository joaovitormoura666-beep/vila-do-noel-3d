# Como rodar a Vila do Noel na live (no seu PC com Windows)

Este é o passo a passo para usar o jogo numa live de verdade, rodando tudo no seu computador.
Não precisa saber programar. A tela da live agora é a **Vila do Noel 3D** (a sala com o Noel
na poltrona e os gnomos). A versão antiga, em 2D, continua guardada como "versão clássica".

Resumo:

1. Instalar o Node.js (uma vez só).
2. Baixar o projeto e extrair a pasta.
3. Dois cliques no `iniciar.bat`: o painel abre sozinho.
4. Testar com o simulador.
5. No painel, escrever o @ da sua conta e clicar em **Conectar**.
6. Levar a tela do jogo para a live: pelo **TikTok LIVE Studio** ou pelo **OBS**.

> **Aviso importante:** o jogo lê os comentários e os presentes da live com uma biblioteca
> **não oficial** e gratuita (`tiktok-live-connector`). Ela não é do TikTok: pode parar de
> funcionar quando o TikTok mudar alguma coisa, e esse tipo de leitura pode não estar de acordo
> com os termos de uso do TikTok. O jogo **nunca** pede nem guarda a senha da sua conta. Os
> detalhes estão em `docs/INTEGRACAO.md`, na parte "Riscos".

---

## 1. Instalar o Node.js (uma vez só)

O Node.js é o programa gratuito que faz o servidor do jogo funcionar.

1. Abra <https://nodejs.org> no navegador.
2. Baixe a versão **LTS** (a recomendada). Ela precisa ser a **22 ou mais nova**: a leitura da
   live do TikTok não funciona com versões mais velhas. Em novembro de 2026 o site oferece a 24,
   que serve.
3. Abra o instalador e vá clicando em "Next"/"Avançar", aceitando o que ele sugerir.
4. Pronto. Não precisa abrir nada depois.

Se você esquecer este passo, ou se o Node.js do computador for antigo, o `iniciar.bat` avisa e
abre o site do Node.js sozinho.

## 2. Baixar o projeto

Escolha **um** destes jeitos:

- **Do GitHub** (o repositório é privado, então entre com a sua conta do GitHub): na página
  do projeto, clique no botão verde **Code** e depois em **Download ZIP**.
- **Da pasta compartilhada do projeto:** baixe o arquivo `.zip` do código.

Antes de extrair, **desbloqueie** o zip (isso evita um aviso de segurança em cada `.bat`):

1. Clique com o botão direito no arquivo `.zip` e escolha **Propriedades**.
2. Embaixo, na aba **Geral**, se aparecer a caixa **Desbloquear**, marque e clique em **OK**.
   (Se a caixa não aparecer, tudo bem: siga em frente.)

Depois **extraia** o zip (não dá para rodar de dentro dele):

1. Clique com o botão direito no arquivo `.zip` e escolha **Extrair tudo...**.
2. Clique em **Procurar...**, escolha o disco **C:**, crie uma pasta nova chamada `VilaDoNoel`,
   selecione essa pasta e clique em **Extrair**. Use uma pasta assim, fora de **Documentos** e
   da **Área de Trabalho**: no Windows 11 essas duas costumam ficar dentro do **OneDrive**, e a
   instalação (milhares de arquivos) fica lenta, pode dar erro e vai parar na nuvem.
3. Abra a pasta extraída. Se dentro dela houver **só outra pasta com o mesmo nome** (o zip do
   GitHub vem assim), entre nela. É ali que fica o arquivo `iniciar.bat`.

**Para atualizar depois** (quando houver uma versão nova): baixe e extraia numa pasta nova.
Se quiser manter as configurações do painel (inclusive o @ da live), copie a pasta `data`
da pasta antiga para a nova. Se você gravou frases ou música, copie também `public\audio`.

## 3. Abrir o jogo: dois cliques no `iniciar.bat`

1. Dê dois cliques em `iniciar.bat`.
2. O Windows pode mostrar um aviso, porque o arquivo veio da internet:
   - "O Windows protegeu o computador" (tela azul): clique em **Mais informações** e depois em
     **Executar assim mesmo**;
   - "Aviso de Segurança - Abrir Arquivo" (janelinha com o botão **Executar**): clique em
     **Executar**.
   Se você desbloqueou o zip no passo 2, esses avisos normalmente não aparecem.
3. Abre uma **janela preta** chamada "Vila do Noel - servidor (nao feche)". Na primeira vez
   ela instala os componentes do jogo: leva alguns minutos e precisa de internet. Nas outras
   vezes isso é pulado. **Não dê dois cliques no `iniciar.bat` de novo enquanto isso**: se der,
   a segunda janela só avisa que a primeira já está preparando o jogo.
4. Depois ela prepara o jogo (cerca de um minuto) e o **painel de controle** abre sozinho no
   seu navegador, no endereço <http://localhost:3000/painel.html>.

**Deixe a janela preta aberta** o tempo todo da live: ela é o servidor do jogo. Para
encerrar o jogo, feche a janela preta (ou dê dois cliques em `parar.bat`).

O que a janela preta já resolve sozinha:

- Se o jogo **já estiver aberto**, ela só abre o painel de novo.
- Se **outro programa** estiver usando a porta 3000, ela explica e pergunta se pode usar a
  porta 3100. Nesse caso, em todos os endereços deste documento troque `3000` por `3100`.
- Se faltar o Node.js, ou se ele for antigo demais (antes do 22), ela explica e abre o site
  para baixar.
- Se o servidor parar por um erro no meio do caminho, ela pergunta **"Abrir o jogo de novo
  agora?"**. Aperte **S**: o servidor volta em poucos segundos, e o painel e a tela do jogo
  se reconectam sozinhos.

## 4. Testar com o simulador (antes de entrar ao vivo)

1. No painel, clique em **Abrir a tela do jogo**. Abre uma janela em pé com a Vila do Noel 3D.
   Na primeira vez a sala leva alguns segundos para aparecer.
2. Clique uma vez dentro da tela do jogo para **ligar o som** (o navegador exige esse clique).
   O aviso "Clique na tela para ligar o som" some depois do clique.
3. No painel, clique em **Simular rosa**. Um gnomo entra na fila, anda até o Noel, o Noel diz
   "Vamos ver qual é o seu presente!", a caixa abre e o presente aparece. Depois o gnomo
   comemora e vai embora.
4. Teste também:
   - **Testar voz**: o Noel fala. O painel diz se a voz está funcionando nesta tela.
   - **+10 pessoas**: a fila enche.
   - Os botões da parte **Efeitos da sala** (árvore, lareira, trenó, noite mágica) e o
     **Presente grande** do simulador, que acende um efeito como um presente caro da live.
5. No topo do painel, o selo **Tela do jogo** precisa dizer que ela está aberta.

**Uma escolha antes da primeira live: a espera para participar de novo.** No painel, no
cartão **Ritmo**, o campo **Espera para participar de novo (s)** vem com **0**. Com 0, quem
acabou de receber o presente pode digitar `!presente` de novo e voltar para o fim da fila na
hora, e uma mesma pessoa pode ganhar várias vezes na mesma live. Se você preferir dar a vez
para gente nova, coloque, por exemplo, **180** (3 minutos) ou **300** (5 minutos). É uma
escolha sua (do ritmo da live); o valor fica salvo para as próximas vezes.

## 5. Ligar a leitura da live

1. No painel, na parte **Live do TikTok**, escreva o **@ da sua conta** (a conta que vai fazer
   a live; com ou sem o @).
2. Clique em **Conectar**.
3. Olhe o selo ao lado:

| O selo diz | O que significa | O que fazer |
| --- | --- | --- |
| Esperando a live começar | Você ainda não está ao vivo (ou o TikTok ainda não mostrou a live). A mensagem pode ser "não está ao vivo agora" ou "Ainda não encontrei a live": antes da live, as duas são normais. | Nada: quando a live começar, o jogo conecta sozinho (ele confere de novo a cada 30 segundos; depois de 10 minutos, a cada minuto). Para não esperar a próxima conferência, clique em **Conferir agora**. |
| Ao vivo | O jogo está recebendo os comentários e os presentes. | Nada. |
| Reconectando | A conexão caiu; o jogo tenta de novo sozinho. | Esperar, ou clicar em **Conferir agora**. Se demorar, confira a internet. |
| Precisa de atenção | Algo que não se resolve sozinho (por exemplo, @ escrito errado ou Node.js antigo). | Ler a mensagem, corrigir e clicar em **Conectar de novo**. |

Cuidado com o botão grande ao lado do @: enquanto o jogo espera a live ou reconecta, ele diz
**Desconectar** e **desliga** a leitura. Para tentar de novo na hora, use **Conferir agora**.

**Clique em Conectar no máximo uns 10 minutos antes de começar a live.** Enquanto espera, cada
conferência passa pelo serviço gratuito que libera a conexão (Euler Stream), que tem um limite
de pedidos. Esperar a live por horas gasta esse limite à toa.

**Se o selo continuar em "Esperando a live começar" depois que você já entrou ao vivo:**

1. Clique em **Conferir agora** (ou espere: a conferência é feita de 30 em 30 segundos).
2. Confira se o @ escrito é exatamente o da conta que está ao vivo.
3. Confira a internet do computador.
4. Se nada disso resolver, o TikTok pode estar recusando a leitura naquele momento. O jogo
   continua funcionando: você pode colocar pessoas na fila pelo simulador do painel enquanto
   isso. A explicação técnica está em `docs/INTEGRACAO.md`.

Os números embaixo do selo mostram o que está chegando da live: comentários, presentes,
curtidas e quem entrou na fila. Logo abaixo ficam seguidores, compartilhamentos e efeitos
pedidos por presentes. Na primeira live, olhe se esses números sobem: é o jeito de confirmar
que cada tipo de evento está chegando.

Como as pessoas entram na fila durante a live:

- mandando **qualquer presente** (a rosa é o mais simples);
- de graça, pelo chat, escrevendo **!presente**, **!noel** ou **!fila**.

Os presentes do jogo são só animação: não valem dinheiro, não são sorteio e não têm resgate.

## 6. Levar a tela do jogo para a live

Há dois jeitos. Use o que a sua conta do TikTok permitir.

### Jeito A: TikTok LIVE Studio (captura de janela)

O LIVE Studio é o programa do TikTok para fazer live pelo computador. O jeito mais seguro é ele
**capturar uma janela** com a tela do jogo.

1. **Feche a janela do jogo que você abriu pelo painel no passo 4.** Só pode ficar uma tela do
   jogo aberta: com duas, a fila aparece em dobro e a música, os efeitos e a voz do Noel tocam
   duas vezes no som do computador, que é o som que vai para a live. No painel, o selo deve
   dizer "Tela do jogo: aberta" (sem "(2)").
2. Com o jogo aberto (janela preta aberta), dê dois cliques em **`abrir-janela-da-live.bat`**.
   Abre uma janela em pé, sem barra de endereço, só com a Vila do Noel, no tamanho 540x960.
   Essa janela já sai com o **som liberado** (não precisa clicar) e **continua animando mesmo
   com outra janela na frente**.
   - Ela usa o Microsoft Edge (que já vem no Windows) ou o Chrome.
   - Se ainda houver outra tela do jogo aberta, a janelinha preta do `.bat` avisa por alguns
     segundos: feche a outra.
   - Para uma janela maior (1080x1920, mais nítida, só cabe em telas grandes, como monitores
     4K ou de pé), use **`abrir-janela-da-live-grande.bat`** no lugar.
3. No LIVE Studio, deixe a live no formato **em pé (retrato, vertical)**.
4. Adicione uma fonte do tipo **captura de janela** (procure a opção de capturar uma janela ou
   um aplicativo aberto) e escolha a janela que mostra **a sala do Noel** (o nome dela é
   "Vila do Noel Live"). **Não** escolha a janela preta ("Vila do Noel - servidor").
5. Aumente a fonte até ocupar a tela toda da live.
6. **Som:** a janela toca a música, os efeitos e a voz do Noel no seu computador. Confira no
   LIVE Studio se o som do computador (ou o som dessa janela) está sendo enviado para a live:
   procure nas opções de áudio do LIVE Studio. Faça um teste antes de entrar ao vivo.
7. Não **minimize** a janela do jogo. Ela pode ficar atrás de outras janelas, mas minimizada o
   Windows pode parar de mostrar a imagem.

Outras opções no LIVE Studio:

- **Fonte "Link" (página da internet):** em várias versões fica em **+ Adicionar fonte** (Add Source) →
  **Link**. Se a sua tiver: use o endereço `http://localhost:3000/?obs` com o tamanho 1080x1920. Teste o
  som: dependendo da versão, a voz sintetizada do Noel pode não funcionar nesse tipo de fonte
  (a música e os efeitos funcionam).
- **Sem o `.bat`:** a janela que o botão **Abrir a tela do jogo** do painel abre também serve
  para a captura de janela. Nela, clique uma vez dentro da tela para ligar o som. Para uma
  janela sem avisos, abra o endereço `http://localhost:3000/?obs&janela=1`: nela o pedido de
  clique para o som aparece só no título da janela (fora da imagem) e some depois do clique.

### Jeito B: OBS Studio com chave de transmissão

Use este jeito se o TikTok liberou para a sua conta o **endereço do servidor** e a **chave de
transmissão** (a chave muda; pegue a atual no TikTok antes de cada live).

1. Instale o OBS Studio (gratuito, <https://obsproject.com>).
2. Em **Configurações → Transmissão**: escolha o serviço **Personalizado** e cole o endereço do
   servidor e a chave de transmissão que o TikTok mostrou.
3. Em **Configurações → Vídeo**: resolução de base **1080x1920** e resolução de saída
   **1080x1920** (ou 720x1280 se o computador for mais fraco).
4. Em **Fontes**, clique em **+**, escolha **Navegador** e preencha:
   - URL: `http://localhost:3000/?obs` (o painel mostra esse endereço pronto no cartão
     **Endereço para o OBS**, com o botão **Copiar**);
   - largura **1080** e altura **1920**;
   - marque **Controlar áudio via OBS**;
   - deixe desmarcado "Desligar a fonte quando não estiver visível".
5. **Som:** a música e os efeitos saem pelo OBS sozinhos, sem clique (aparecem no mixer de
   áudio do OBS). A **voz do Noel** normalmente **não** funciona na fonte de navegador do OBS:
   o jogo percebe e segue só com os balões de fala, e o painel avisa no cartão **Áudio**. Para
   ter a voz no OBS, grave as frases em arquivos (veja `docs/AUDIO.md`) ou use uma captura de
   janela com a janela do `abrir-janela-da-live.bat` no lugar da fonte de navegador.
6. Se o jogo travar no OBS, ligue a aceleração por hardware da fonte de navegador nas
   configurações avançadas do OBS.

### O som em cada jeito

| Jeito | Música e efeitos | Voz do Noel | Precisa clicar? |
| --- | --- | --- | --- |
| Janela do `abrir-janela-da-live.bat` + captura de janela | Sim | Sim (vozes do Windows/Edge) | Não |
| Janela do painel + captura de janela | Sim | Sim | Sim, uma vez dentro da tela |
| OBS, fonte de navegador | Sim | Normalmente não (use frases gravadas) | Não |
| LIVE Studio, fonte de página da internet | Sim | Depende da versão: teste | Teste |

Em todos os casos, o volume de cada som (geral, música, efeitos, voz) se ajusta no painel.

## 7. Durante a live

- Deixe abertos: a janela preta, o painel e a tela do jogo (só **uma** tela do jogo: duas telas
  abertas mostram a fila em dobro).
- O painel tem **Pular atual** (passa a vez de quem está sendo atendido), **Pausar
  atendimentos**, **Limpar fila**, os **Efeitos da sala** e as configurações.
- A qualidade da imagem começa no máximo e **baixa sozinha** se o computador não der conta
  (para não travar). Dá para fixar a qualidade no painel, em "Desempenho".
- Para ver o FPS (quadros por segundo) e o nível de qualidade na tela, acrescente `&depurar`
  ao endereço (por exemplo `http://localhost:3000/?obs&depurar`). Use só para conferir, não
  durante a live.

## 8. Encerrar

Feche a janela preta do `iniciar.bat` (ou dê dois cliques em `parar.bat`). Pode fechar o
painel e a janela do jogo também.

## 9. Problemas comuns

- **Apareceu "O Windows protegeu o computador":** clique em **Mais informações** e em
  **Executar assim mesmo**.
- **A janela preta abre e fecha rápido, ou diz que não achou os arquivos:** você abriu o
  `iniciar.bat` de dentro do zip. Extraia o zip primeiro (passo 2).
- **"Falta instalar o Node.js" ou "O Node.js deste computador é antigo demais":** faça o
  passo 1 (versão LTS, 22 ou mais nova) e abra o `iniciar.bat` de novo. Se você acabou de
  instalar, feche e abra a janela de novo (ou reinicie o computador).
- **"A Vila do Noel já está sendo preparada em outra janela preta":** você deu dois cliques
  no `iniciar.bat` duas vezes. Feche a janela que mostrou esse aviso e espere a outra
  terminar; o painel abre sozinho.
- **A instalação está muito lenta ou dá erro de permissão (EPERM, EBUSY):** a pasta do jogo
  provavelmente está dentro do OneDrive (Documentos ou Área de Trabalho). Extraia de novo em
  `C:\VilaDoNoel` (passo 2).
- **A instalação deu erro:** confira a internet e abra o `iniciar.bat` de novo. Se continuar,
  apague a pasta `node_modules` (dentro da pasta do jogo) e tente outra vez.
- **"Outro programa está usando a porta 3000":** feche o outro programa, ou aceite a porta
  3100 quando a janela perguntar (e use 3100 nos endereços), ou reinicie o computador.
- **O painel não abriu sozinho:** abra o navegador e digite `http://localhost:3000/painel.html`.
- **A tela do jogo ficou escura com "Carregando a Vila do Noel...":** espere uns segundos na
  primeira vez. Se não sair disso, aperte F5 na janela do jogo. Se aparecer "Não foi possível
  abrir a Vila do Noel 3D neste navegador", use o Chrome ou o Edge atualizados (o jogo 3D
  precisa de WebGL, que esses navegadores têm).
- **Sem som:** clique uma vez dentro da tela do jogo. O painel avisa quando a tela está sem
  som. No OBS, marque "Controlar áudio via OBS".
- **O Noel não fala:** veja o aviso no cartão **Áudio** do painel e o `docs/AUDIO.md`.
- **O selo fica em "Esperando a live começar" com a live no ar:** veja o passo 5.
- **Ninguém entra na fila durante a live:** confira se o selo da live diz "Ao vivo" e se o
  selo da tela do jogo diz que ela está aberta. Veja o registro do painel: ele mostra o que
  aconteceu com cada pessoa.
- **Os gnomos aparecem em dobro, ou o som sai duas vezes (eco):** há duas telas do jogo
  abertas. Deixe só uma.
- **Os gnomos aparecem só com a letra do nome, sem a foto de perfil:** a foto não chegou (o
  jogo segue normalmente com a inicial). A janela preta mostra, no máximo uma vez por minuto,
  uma linha `[fotos]` dizendo quantas fotos carregaram e por que as outras não vieram
  (`rede` = internet ou TikTok fora; `recusado` = endereço de foto que o jogo não aceita).
- **A imagem trava ou fica lenta:** feche outros programas pesados; no painel, em
  "Desempenho", escolha a qualidade Média ou Baixa; no OBS, ligue a aceleração por hardware
  da fonte de navegador.
- **Na captura de janela aparecem faixas escuras dos lados:** deixe a janela do jogo mais
  estreita (ou use a janela do `abrir-janela-da-live.bat`, que já sai em pé) ou corte as
  faixas na fonte do LIVE Studio. O jogo sempre fica em 9:16 no meio da janela.
- **Quero voltar para a versão 2D:** ela continua em `http://localhost:3000/classico.html`
  (no OBS: `http://localhost:3000/classico.html?obs`).

## 10. Endereços úteis

Com o jogo aberto pelo `iniciar.bat`:

| Endereço | O que é |
| --- | --- |
| `http://localhost:3000/painel.html` | Painel de controle (só para você). |
| `http://localhost:3000/` | Tela do jogo 3D num navegador comum (pede um clique para o som). |
| `http://localhost:3000/?obs` | Tela do jogo para o OBS: sem avisos nem botões. |
| `http://localhost:3000/?obs&janela=1` | Tela do jogo para captura de janela, sem avisos na imagem. |
| `http://localhost:3000/classico.html` | Versão clássica em 2D (com `?obs` para o OBS). |

Atalhos de teclado na tela do jogo: `R` coloca um visitante de teste na fila. Não use durante
a live.

## 11. Outro jeito: servidor na internet

Também dá para rodar o servidor numa máquina virtual (VM) e as páginas na Cloudflare Pages, sem
depender do seu computador para o servidor. É a segunda opção, mais trabalhosa; o passo a passo
está em `deploy/backend/LEIA-ME.md` e `deploy/frontend/LEIA-ME.md` (os pacotes saem com
`npm run pacotes`).
