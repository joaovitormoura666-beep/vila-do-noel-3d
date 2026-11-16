# Integração com a live

Nesta versão o jogo **não está ligado ao TikTok**. O briefing pede para validar o
protótipo visual antes, e para não presumir acesso irrestrito à API oficial. O que
existe hoje é o encaixe pronto: qualquer fonte de eventos que fale o formato abaixo já
movimenta o jogo.

## Caminho de um evento

```
Fonte de eventos  (hoje: simulador do painel; depois: TikTok)
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

## Caminhos para ligar ao TikTok depois

Nenhum deles está ativo. A escolha fica para depois da validação visual.

**1. Uma ferramenta de lives enviando eventos para a entrada local.** Programas que
criadores já usam para alertas e automações costumam conseguir chamar um endereço HTTP
quando chega um presente ou um comando. Bastaria configurar a ferramenta para chamar
`http://localhost:3000/api/evento` no formato acima. Não exige código novo no jogo.
Precisa ser confirmado na ferramenta escolhida: se ela envia os campos necessários
(identificador, nome e foto) e quanto custa.

**2. Uma biblioteca não oficial que lê os eventos públicos da live.** Funciona sem
ferramenta intermediária, mas não é oficial: pode parar de funcionar sem aviso e pode
contrariar os termos de uso do TikTok. O risco para a conta precisa ser avaliado antes.

**3. Programas oficiais do TikTok para desenvolvedores,** se e quando a conta tiver
acesso.

Em qualquer caminho, o trabalho é converter o evento recebido para o formato deste
documento.

## Para quem for programar a integração

- O contrato está em `server/integrations/LiveSource.ts`: uma fonte tem `name`,
  `start(emit)` e `stop()`, e chama `emit(evento)` a cada evento.
- `server/integrations/SimulatorSource.ts` é um exemplo completo.
- `server/integrations/TikTokSource.stub.ts` é o esboço do encaixe do TikTok, com a
  conversão de cada tipo de evento.
- A fonte é registrada em `server/app.ts`, como o simulador:
  `fonte.start((ev) => hub.ingest(ev))`.
- Em combos de presente, passe o identificador da sequência em `streakId`, ou envie só
  o evento do fim do combo.
- Duplicados, regras e fila já são tratados pelo servidor e pelo jogo. A fonte só
  precisa entregar os eventos.
