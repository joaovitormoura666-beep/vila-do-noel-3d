# Pendências e limitações — MVP 1.0

Registro do que está pronto, do que ficou de fora de propósito e do que ainda precisa
ser validado no computador da live.

## 1. O que está pronto

| Item do briefing | Situação |
| --- | --- |
| Cenário natalino animado em 9:16 (1080x1920, se ajusta à janela) | Pronto. Neve em duas camadas, luzes piscando, fumaça da chaminé, estrelas e brilhos. |
| Paleta obrigatória | Pronto. As cinco cores estão em `src/config.ts`. |
| Papai Noel com animações básicas | Pronto. Acena, procura no saco, apresenta, entrega, comemora, pisca e mexe a boca ao falar. |
| Personagens com nome e avatar ou foto | Pronto. 24 visuais diferentes. Etiqueta com a foto de perfil, ou a inicial colorida quando não há foto. |
| Fila automática e movimentação | Pronto. Entrada, avanço, subida até o Noel e saída. |
| Animação de entrega do presente | Pronto. Caixa sai do saco, suspense, revelação com o nome da pessoa, entrega e comemoração. |
| Biblioteca de frases do Papai Noel | Pronto. 24 frases em português (cumprimentos, a frase principal, revelações, despedidas e convites) e 8 reações dos visitantes. |
| Sistema de presentes decorativos | Pronto. 12 presentes, sem repetir os últimos sorteados. |
| Simulador local (1, 10, 50 ou 100 participantes) | Pronto, no painel. Também simula comando do chat, seguidor, evento duplicado e a mesma pessoa de novo. |
| Interface vertical pronta para OBS | Pronto. Fonte de navegador em `http://localhost:3000/?obs`. |
| Painel de controle separado da transmissão | Pronto, em `/painel.html`. |
| Tratamento de eventos duplicados e fila cheia | Pronto, com aviso na tela e no registro. |
| Áudio: voz em português, falas variadas, efeitos, volumes por categoria | Pronto, com as ressalvas da seção 3. |
| Interface de integração para o futuro | Pronto: contrato `LiveSource` e entrada local de eventos. Veja `docs/INTEGRACAO.md`. |
| Instruções de instalação no Windows e comandos | Pronto, no `README.md`. |

Além do pedido: qualidade automática por FPS, aceleração automática com a fila grande,
fila que sobrevive a um recarregamento da página, aviso no painel quando a voz não
funciona ou quando há duas telas abertas, 28 testes automáticos e uma demonstração que
roda sem servidor (`npm run demo`).

## 2. O que foi testado e como

Feito por mim em Linux, com o Chromium controlado por script:

- Fluxo completo pelo painel: "Simular rosa", entrada na fila, subida até o Noel, fala,
  revelação, entrega e saída. Sem erros no console.
- 10 e 100 participantes de uma vez: todos aceitos, 11 visíveis e o resto esperando
  fora da tela.
- Onze casos pelo painel: pausa, evento duplicado, mesma pessoa, comando gratuito,
  seguidor com a opção desligada, fila cheia, registro, retomar, pular, limpar e
  restaurar padrões.
- Foto de perfil vinda de um endereço externo de verdade, e bloqueio de endereços
  inválidos.
- Instalação do zero a partir do pacote entregue (`npm ci` e `npm start`).
- Ritmo medido quadro a quadro, com a voz desligada: 10,3 segundos por pessoa na
  velocidade 1,0x e 5,2 segundos em 2,0x. Com a voz ligada o Noel espera cada fala
  terminar, o que acrescenta alguns segundos por pessoa em 1,0x (não medi com voz).
- Os dois exemplos de `docs/INTEGRACAO.md` (PowerShell e Prompt de Comando), enviados
  com o mesmo conteúdo a partir do Linux: as duas pessoas entraram na fila.
- O arquivo de versões instala os componentes de Windows quando pedido para esse
  sistema (conferido com `npm ci --os=win32 --cpu=x64`).

Sobre o vídeo e as capturas de tela: foram gravados quadro a quadro, com o relógio do
navegador controlado, e por isso saem fluidos mesmo sem placa de vídeo. A trilha do
vídeo usa a música e os efeitos do próprio jogo. A voz do Noel não está no vídeo,
porque ela é falada pelo navegador e não entra nesse tipo de gravação. A captura do
painel mostra "FPS: 6" e qualidade "Baixa" pelo mesmo motivo da limitação 2 abaixo.

## 3. Limitações conhecidas

1. **Não testei em um Windows de verdade.** O código não depende de sistema, o arquivo
   de versões inclui os componentes para Windows e o `iniciar.bat` foi escrito com
   cuidado, mas a primeira execução real em Windows será a sua. Se algo falhar na
   instalação, me mande a mensagem que aparecer na janela preta.
2. **FPS em placa de vídeo real não medido.** O ambiente de teste desenha por software
   e fica em 6 a 8 FPS, o que não diz nada sobre o seu computador. A lógica do jogo
   custa de 1 a 2 ms por quadro, bem abaixo dos 16 ms de um quadro a 60 FPS. A meta de
   60 FPS precisa ser confirmada no PC da live, com o OBS aberto (ligue "Mostrar FPS"
   no painel).
3. **Voz do Noel depende do navegador.** No Chrome e no Edge ela usa as vozes do
   Windows. Na fonte de navegador do OBS normalmente não há voz sintetizada: o jogo
   percebe e segue sem ela. Veja as saídas em `docs/AUDIO.md`.
4. **O som precisa de um clique** quando a tela é aberta direto em uma aba do
   navegador. Abrindo pelo botão do painel ou pelo OBS isso não é necessário.
5. **A tela do jogo precisa estar visível.** Navegadores pausam abas escondidas e
   janelas minimizadas. A fonte de navegador do OBS não tem esse problema.
6. **Uma tela do jogo por vez.** Duas telas abertas mostram a fila em dobro. O painel
   avisa.
7. **Com a tela do jogo fechada, os eventos se perdem.** O registro mostra o erro, mas
   quem tentou entrar naquele momento não fica guardado.
8. **A fila é guardada no navegador por até 2 horas.** O Chrome e o OBS guardam cada um
   a sua; trocar de um para o outro começa com a fila vazia.
9. **Nomes não são filtrados.** Ainda não há bloqueio de palavrões nem lista de nomes
   proibidos. A fala do nome pode ser desligada no painel.
10. **Áreas cobertas pelo TikTok.** O aplicativo desenha chat, botões e informações por
    cima do vídeo. Posicionei os elementos principais na faixa central, mas isso precisa
    ser conferido em uma live de teste.
11. **Sem prioridade por presente.** A ordem é a de chegada, para quem mandou presente e
    para quem usou o comando gratuito.
12. **Curtidas, compartilhamentos e entradas na live** são aceitos pela entrada de
    eventos, mas ainda não fazem nada no jogo.
13. **Frases gravadas não dizem o nome.** Se uma frase com nome tiver arquivo gravado, o
    arquivo toca no lugar da voz sintetizada, sem o nome.

## 4. Fora desta versão, de propósito

- **Integração real com o TikTok.** O briefing pede para validar o protótipo visual
  antes. O encaixe está pronto e documentado em `docs/INTEGRACAO.md`.
- **Qualquer coisa com valor:** sorteio, prêmio, resgate ou moeda. Os presentes são
  animações.
- **Música de terceiros.** O jogo toca uma caixinha de música original. Você pode
  colocar um arquivo seu, desde que tenha licença para lives.

## 5. Próximos passos sugeridos

1. Validar o visual com a direção criativa, usando `docs/DIRECAO-CRIATIVA.md` como lista.
2. Rodar no computador da live: instalação, FPS com o OBS aberto e som.
3. Decidir a voz do Noel: gravar as frases, ou manter a síntese capturando uma janela.
4. Fazer uma live de teste para conferir as áreas cobertas pela interface do TikTok.
5. Escolher o caminho da integração real e ativá-lo.
6. Filtro de nomes e lista de bloqueio.
7. Regras por tipo de presente, se a direção criativa quiser (prioridade, presentes
   especiais, efeitos extras).
8. Reaproveitar a base em outros jogos: servidor de eventos, regras, fila, painel e
   simulador não dependem do tema de Natal.
