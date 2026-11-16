# Integração com a live

O dono aprovou o visual do jogo 3D, e o servidor agora **lê a live do TikTok** pelo @ da
conta, ligado e desligado no painel (seção "Live do TikTok", logo abaixo). A leitura usa
uma biblioteca gratuita e **não oficial**; os riscos estão explicados em "Riscos".
Qualquer outra fonte de eventos que fale o formato deste documento (simulador, ferramenta de
lives chamando `/api/evento`) continua funcionando junto.

## Live do TikTok

### Como ligar (no computador do dono)

1. Abra o jogo pelo `iniciar.bat`. O painel abre sozinho.
2. No topo do painel, em **Live do TikTok**, escreva o @ da sua conta (com ou sem o @; o
   endereço `https://www.tiktok.com/@suaconta/live` também serve) e clique em **Conectar**.
3. O selo mostra a situação:

| Selo | O que quer dizer | O que fazer |
| --- | --- | --- |
| Desligado | O jogo não está lendo a live. | Escreva o @ e clique em Conectar. |
| Conectando… | Abrindo a conexão (alguns segundos). | Esperar. |
| Esperando a live começar | A live ainda não começou: a biblioteca disse "não está ao vivo" (`UserOfflineError`) ou não achou o número da sala ("Failed to retrieve Room ID from all sources", o que acontece com a conta fora do ar). Confere de novo a cada 30 s (depois de 10 minutos, a cada 1 minuto). | Pode deixar ligado antes de entrar ao vivo (no máximo uns 10 minutos antes, para não gastar o limite gratuito do Euler Stream): ele conecta sozinho. **Conferir agora** tenta na hora. |
| Ao vivo | Recebendo comentários e presentes. Mostra o título da live e quantas pessoas assistem. | Nada. Os contadores sobem. |
| Reconectando | A conexão caiu, faltou internet, o Euler Stream pediu pausa ou o TikTok recusou desta vez. Tenta de novo sozinho, esperando 2 s, 4 s, 8 s, 16 s, 32 s e depois 1 minuto (ou o tempo que o Euler Stream pedir). | **Conferir agora** tenta na hora. Se não voltar, confira a internet. |
| Precisa de atenção | Algo que não se resolve sozinho (ex.: o TikTok não aceitou o @, a biblioteca não está instalada, ou o Node.js é anterior ao 22). | Ler a mensagem, corrigir e clicar em "Conectar de novo". |

Enquanto o jogo espera a live ou reconecta, o botão principal diz **Desconectar** (desliga a
leitura). O botão **Conferir agora**, que só aparece nesses dois estados, manda ao servidor o
mesmo @ ligado de novo, e o servidor trata isso como pedido de tentativa imediata.

Os contadores do painel mostram comentários, presentes (um combo de 10 rosas conta 1),
curtidas e quantas pessoas da live a tela do jogo aceitou na fila; numa linha menor, seguidores,
compartilhamentos e efeitos pedidos por presentes. Eles zeram ao trocar de @.

A biblioteca precisa do **Node.js 22 ou mais novo** (o `got` 15, que ela usa, exige o 22). O
`iniciar.bat` não abre com um Node mais velho, e o servidor avisa na janela preta; se mesmo
assim a leitura for ligada num Node antigo, o painel mostra "Precisa de atenção" com o que fazer,
em vez de ficar tentando.

A escolha fica salva em `data/tiktok.json`: se o computador reiniciar com a leitura ligada,
ela liga sozinha de novo. Uma conexão por vez: trocar de @ ou desligar encerra a anterior.

### O que vira o quê

| Evento da live (biblioteca) | Vira (`LiveEvent`) | Entra na fila? |
| --- | --- | --- |
| `chat` | `chat`, com o texto em `comment` | Só se começar com `!presente`, `!noel` ou `!fila` (comandos do painel) |
| `gift` | `gift`, com `giftName`, `giftCount` (quantidade final do combo) e `diamondCount` (moedas por unidade) | Sim, se "Qualquer presente coloca na fila" estiver ligado (padrão) |
| `follow` | `follow` | Só se "Seguir o perfil coloca na fila" estiver ligado (padrão: não) |
| `like` | `like`, com a quantidade em `giftCount` | Não |
| `share` | `share` | Não |
| `member` (alguém entrou na live) | `join` | Não |
| `roomUser` | (não vira evento) número de espectadores no painel | - |
| `streamEnd` | (não vira evento) volta a "Esperando a live começar" | - |

- **Combos de presente:** presentes que vêm em sequência (`giftType` 1, como a rosa) chegam
  várias vezes enquanto a pessoa toca. Só o **fim da sequência** (`repeatEnd`) conta, com a
  quantidade final, e leva um `streakId` para não contar duas vezes. Se o fim se perder numa
  queda de conexão, o combo parado há 15 s é contado assim mesmo. Presentes sem sequência
  contam na hora.
- **Identificador da pessoa:** `tiktok:<id numérico do TikTok>` (estável mesmo se a pessoa
  trocar o @). O nome exibido é o apelido; sem apelido, o @.
- **Foto de perfil:** o endereço `https` da foto do TikTok. O proxy de fotos do servidor só
  baixa dos servidores de imagens do TikTok (`tiktokcdn.com`, `tiktokcdn-us.com`,
  `tiktokcdn-eu.com`, `ibyteimg.com`, `byteimg.com`, `muscdn.com` e subdomínios), no
  computador e na VM. Para aceitar qualquer site público de novo: `AVATAR_HOSTS_PERMITIDOS=*`.
- **Comentários antigos:** ao conectar, a biblioteca pode trazer as mensagens recentes da
  live. Elas são ignoradas (`processInitialData: false`), para ninguém entrar na fila por um
  comando de antes da conexão.

### Efeitos da sala pela live

O painel tem a seção **Efeitos da sala**, com um botão para cada efeito (Árvore brilhando,
Lareira mágica, Trenó, Noite mágica). O botão manda o efeito pelo servidor para a tela do
jogo 3D (mensagem `{ t: 'ambient', effect }`), que respeita a prioridade, o descanso e o
limite de efeitos ao mesmo tempo do `AmbientDirector`.

Na mesma seção fica a regra **presente da live → efeito**. Ela é **PROVISÓRIA**: qual
presente dispara qual efeito é decisão criativa do dono e da direção criativa. Padrão de
hoje (`DEFAULT_AMBIENT_GIFTS` em `shared/ambient.ts`):

| Valor do envio (moedas por unidade x quantidade) | Efeito |
| --- | --- |
| a partir de 500 | Noite mágica |
| a partir de 100 | Trenó |
| a partir de 30 | Lareira mágica |
| a partir de 5 | Árvore brilhando |
| menos de 5 | nenhum (só fila) |
| Rosa / Rose, em qualquer quantidade | nenhum (só fila) |

- O valor vem do próprio presente (`diamondCount`, informado pela biblioteca com
  `enableExtendedGiftInfo`). Presente sem valor conhecido só dispara efeito pelo nome (a
  regra aceita listas de nomes por efeito; o painel mostra a lista "só fila").
- Proteção contra excesso no servidor: no máximo um efeito pedido por presente a cada 4 s
  (com folga de 3 seguidos); o excesso é anotado no registro do painel. Depois, o jogo ainda
  aplica a sua própria fila de efeitos.
- O efeito vale também para quem já está na fila (mandar outro presente acende a sala mesmo
  sem entrar de novo). A pessoa entra na fila do mesmo jeito que com qualquer presente.
- O simulador do painel tem o botão **Presente grande** (500 moedas, valor de teste) para
  ver isso sem estar ao vivo. Os presentes do simulador têm valores de teste, não os da loja
  do TikTok.

### Configuração pelo .env (opcional)

No PC não precisa de nada: tudo se faz pelo painel. No `.env` (do PC ou da VM) dá para
deixar valores iniciais. O que for mudado no painel fica em `data/tiktok.json` e passa a
valer mais que o `.env`.

| Variável | Para que serve |
| --- | --- |
| `TIKTOK_USUARIO` | @ da conta (ex.: `TIKTOK_USUARIO=suaconta`). |
| `TIKTOK_LIGADO` | `1` liga a leitura ao subir o servidor; `0` deixa desligada. |
| `EULER_API_KEY` | Chave opcional do Euler Stream (veja abaixo). |

A chave (do `.env` ou salva pelo painel) **nunca volta para o navegador**: o painel só
mostra se ela existe e de onde veio. Ela fica em texto no `.env` ou no `data/tiktok.json`,
duas coisas que não vão para o git; não mande esses arquivos para ninguém. Mudar a
configuração do TikTok pelo painel segue as mesmas regras de senha do resto do painel
(com `TOKEN_ADMIN`, só quem tem a senha).

### Riscos (leia antes da primeira live)

- **Biblioteca não oficial.** A leitura usa o pacote `tiktok-live-connector` (versão
  2.5.0, gratuito, código aberto). Ele lê a live pública do mesmo jeito que o site do
  TikTok, **sem login e sem senha**: o jogo nunca pede nem guarda a senha ou os cookies da
  conta do dono (a opção `authenticateWs` da biblioteca não é usada). Não é um produto do
  TikTok: pode parar de funcionar sem aviso quando o TikTok mudar algo, e esse tipo de
  leitura pode não ser aprovado pelos termos de uso do TikTok. Se parar, o jogo continua
  funcionando pelo simulador e pela entrada `/api/evento`; o painel mostra "Reconectando" ou
  "Precisa de atenção".
- **Euler Stream.** Para abrir a conexão, a biblioteca pede uma assinatura ao serviço
  Euler Stream (eulerstream.com). Ele recebe **o @ da live, o número da sala, o tipo de
  navegador que a biblioteca anuncia e o endereço de internet do seu computador** (como
  qualquer site que você visita), além da chave, quando houver. **Não** recebe senha, cookie
  nem dados de quem assiste. Quando o TikTok não informa o número da sala, a biblioteca também
  pergunta ao Euler Stream (última tentativa), e isso conta no limite. Sem chave vale um limite
  gratuito da comunidade; se aparecer o aviso de limite no painel, uma chave gratuita do
  site aumenta esse limite. Nenhum recurso pago é usado. Se um dia o serviço passar a
  cobrar pelo que o jogo usa, a leitura para e o painel avisa.
- **Licença AGPL-3.0.** A biblioteca é AGPL. Usar no próprio computador ou na própria VM
  não exige nada. Se o servidor for distribuído para outras pessoas (ou oferecido a
  terceiros pela rede, com mudanças na biblioteca), é preciso oferecer o código-fonte junto,
  como a licença pede.
- **Privacidade.** O registro do servidor (a janela preta) mostra só o @ do criador e a
  situação da conexão. Os apelidos de quem participa aparecem só no registro do painel, como
  já acontecia com o simulador.

## Caminho de um evento

```
Fonte de eventos  (simulador do painel, /api/evento ou a live do TikTok)
        │  evento da live
        ▼
Servidor local
   1. Regras: este evento coloca alguém na fila?
   2. Descarta duplicados
        │  participante
        ▼
Tela do jogo ──► fila ──► Papai Noel ──► presente
        ▲
        │  comandos e configurações
Painel de controle
```

O jogo nunca conversa direto com o TikTok. Ele só recebe participantes já filtrados pelo
servidor local. Trocar a fonte de eventos não mexe no jogo.

## Formato de um evento

| Campo | Obrigatório | Descrição |
| --- | --- | --- |
| `type` | sim | `gift`, `chat`, `follow`, `like`, `share` ou `join` |
| `userId` | sim | Identificador único da pessoa (também aceita `uniqueId`) |
| `nickname` | não | Nome exibido. Sem ele, usa o identificador |
| `avatarUrl` | não | Endereço `https` da foto de perfil |
| `giftName` | não | Nome do presente enviado |
| `giftCount` | não | Quantidade |
| `diamondCount` | não | Moedas por unidade do presente (usado na regra presente → efeito) |
| `streakId` | não | Identificador da sequência de presentes. Um combo de várias rosas com o mesmo `streakId` conta uma vez |
| `comment` | não | Texto do chat (para `type: "chat"`) |
| `eventId` | não | Identificador único do evento. Se a fonte reenviar o mesmo, ele é descartado |

## Entrada local de eventos

O servidor aceita eventos por HTTP, no próprio computador:

```
POST http://localhost:3000/api/evento
Content-Type: application/json
```

Teste pelo PowerShell, com o jogo aberto:

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/evento -ContentType 'application/json' -Body '{"type":"gift","userId":"teste1","nickname":"Maria","giftName":"Rosa"}'
```

Ou pelo Prompt de Comando:

```
curl -X POST http://localhost:3000/api/evento -H "Content-Type: application/json" -d "{\"type\":\"chat\",\"userId\":\"teste2\",\"nickname\":\"Joao\",\"comment\":\"!presente\"}"
```

A resposta é `{"ok":true}` quando o evento foi recebido, e erro 400 quando o formato é
inválido. Receber não significa entrar na fila: o registro do painel mostra o que
aconteceu com cada pessoa.

No modo local o servidor só aceita conexões do próprio computador (`127.0.0.1`). Ele não
fica exposto na rede nem na internet, e a entrada de eventos não pede senha.

### Com o back-end numa VM

Quando o servidor roda na internet (veja "Rodar separado" no `README.md` e
`deploy/backend/LEIA-ME.md`), a entrada é a mesma, com HTTPS e **senha**:

```
POST https://api.seu-dominio.com.br/api/evento
Authorization: Bearer <TOKEN_ADMIN ou TOKEN_EVENTOS>
Content-Type: application/json
```

Dê à ferramenta uma senha só para eventos (`TOKEN_EVENTOS` no `.env` da VM, gerada com
`openssl rand -hex 24`) em vez da senha do painel. Para ferramentas que não deixam configurar
cabeçalhos, essa senha também pode ir no endereço:
`https://api.seu-dominio.com.br/api/evento?token=<TOKEN_EVENTOS>`. A senha do painel
(`TOKEN_ADMIN`) só vale no cabeçalho `Authorization`, nunca no endereço. Sem a senha a
resposta é 401; com 8 tentativas erradas seguidas a entrada de eventos fica bloqueada para
aquele endereço por 10 minutos (429), sem afetar o painel (que conta as tentativas à parte).
Para liberar na hora: `sudo systemctl restart vila-do-noel`. O corpo pode ter até 16 KB.

## Regras de participação

| Evento | Entra na fila quando |
| --- | --- |
| `gift` | "Qualquer presente coloca na fila" está ligado (padrão) |
| `chat` | A mensagem começa com um dos comandos gratuitos: `!presente`, `!noel` ou `!fila` |
| `follow` | "Seguir o perfil coloca na fila" está ligado (padrão: desligado) |
| `like`, `share`, `join` | Não entram nesta versão |

Proteções, nesta ordem:

1. O mesmo `eventId` ou o mesmo `streakId` chegando de novo é descartado.
2. Vários eventos da mesma pessoa em menos de 2,5 segundos contam como um.
3. Quem já está na fila não entra de novo.
4. Se "Espera para participar de novo" estiver configurada, a pessoa atendida precisa
   esperar esse tempo.
5. Com a fila no limite, a pessoa não entra e a tela avisa.

Nomes são limpos de caracteres invisíveis e cortados em 22 caracteres. A foto de perfil
é baixada pelo servidor local (só `https`, só imagem, até 2 MB) porque o navegador não
deixa usar imagens de outros sites dentro do jogo.

## Outros caminhos para a live

A leitura pela biblioteca (seção "Live do TikTok") é o caminho em uso. Os outros continuam
possíveis, por exemplo se a biblioteca parar:

**1. Uma ferramenta de lives enviando eventos para a entrada local.** Programas que
criadores já usam para alertas e automações costumam conseguir chamar um endereço HTTP
quando chega um presente ou um comando. Bastaria configurar a ferramenta para chamar
`http://localhost:3000/api/evento` no formato acima. Não exige código novo no jogo.
Precisa ser confirmado na ferramenta escolhida: se ela envia os campos necessários
(identificador, nome e foto) e quanto custa.

**2. Programas oficiais do TikTok para desenvolvedores,** se e quando a conta tiver
acesso.

Em qualquer caminho, o trabalho é converter o evento recebido para o formato deste
documento.

## Para quem for programar a integração

- O contrato está em `server/integrations/LiveSource.ts`: uma fonte tem `name`,
  `start(emit)` e `stop()`, e chama `emit(evento)` a cada evento.
- `server/integrations/SimulatorSource.ts` é um exemplo completo.
- `server/integrations/TikTokSource.ts` é a leitura da live do TikTok: conversão de cada
  tipo de evento (`ConversorTikTok`), combos, espera da live, reconexão com espera crescente
  e o estado mostrado no painel. A biblioteca é carregada só quando a leitura é ligada
  (`import()` dinâmico); os testes (`tests/tiktok.test.ts`) trocam a biblioteca por um
  conector falso pela opção `fabrica` (no servidor, `createVilaServer(config, { tiktokFactory })`).
- A configuração do TikTok fica em `TikTokConfigStore` (`server/settingsStore.ts`,
  arquivo `data/tiktok.json`), separada das configurações que vão para a tela do jogo.
- A regra presente → efeito está em `shared/ambient.ts` (`giftToAmbientEffect`) e é
  aplicada no `EventHub` a todo presente, de qualquer fonte.
- A fonte é registrada em `server/app.ts`, como o simulador:
  `fonte.start((ev) => hub.ingest(ev))`.
- No pacote da VM (`npm run pacote:backend`), a biblioteca fica fora do `servidor.mjs` e
  entra como dependência no `package.json` (instalada pelo `npm install` da VM).
- Em combos de presente, passe o identificador da sequência em `streakId`, ou envie só
  o evento do fim do combo.
- Duplicados, regras e fila já são tratados pelo servidor e pelo jogo. A fonte só
  precisa entregar os eventos.
