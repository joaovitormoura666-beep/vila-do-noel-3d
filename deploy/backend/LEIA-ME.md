# Vila do Noel Live — back-end na VM

Esta pasta é o **servidor** do jogo, pronto para rodar numa máquina virtual (VM) Linux na
internet. Ele recebe os eventos da live, guarda as configurações do painel e conversa em
tempo real com a tela do jogo (OBS) e com o painel. As páginas (front-end) ficam na
Cloudflare Pages: veja o `LEIA-ME.md` do pacote `frontend`.

```
OBS (tela do jogo) ──┐                        ┌──────────────────────────────┐
                     ├─ abre as páginas ────► │ Cloudflare Pages (front-end) │
Navegador (painel) ──┘                        └──────────────────────────────┘
        │
        │ wss://api.seu-dominio.com.br/ws  e  https://api.seu-dominio.com.br/api/...
        ▼
┌──────────────────────── VM Linux ────────────────────────┐
│ Caddy (HTTPS, portas 80/443) ──► servidor.mjs (porta 3000)│ ◄── live / ferramenta de eventos
└───────────────────────────────────────────────────────────┘     (POST /api/evento, com senha)
```

## O que tem aqui

| Arquivo | Para que serve |
| --- | --- |
| `servidor.mjs` | O servidor inteiro, num arquivo só. |
| `package.json` | Lista a única peça que precisa ser instalada (`ws`) e o comando `npm start`. |
| `.env.example` | Modelo das configurações, com explicação de cada uma. Vira o `.env`. |
| `vila-do-noel.service` | Deixa o servidor ligado sempre (systemd), inclusive depois de reiniciar a VM. |
| `Caddyfile` | Configuração do Caddy: HTTPS automático e gratuito na frente do servidor. |
| `Dockerfile` | Opcional, para quem preferir rodar em Docker. |
| `data/` | Onde o servidor guarda as configurações do painel. |

Você vai precisar de: uma VM com **Ubuntu 22.04 ou 24.04**, um **domínio** (ou subdomínio)
que você controle, e uns 40 minutos. Os comandos abaixo são para copiar e colar no
terminal da VM, um bloco de cada vez.

---

## 1. Criar a VM

Qualquer provedor serve (Oracle Cloud, Google Cloud, AWS Lightsail, DigitalOcean,
Hetzner, Magalu Cloud…). Escolha:

- Sistema: **Ubuntu 24.04 LTS** (ou 22.04).
- Tamanho: o menor já basta (1 processador, 1 GB de memória).
- **IP público fixo** (no provedor pode se chamar "IP estático", "IP reservado" ou "Elastic IP").
- No **firewall do provedor** (às vezes "grupo de segurança" ou "lista de segurança"),
  libere a entrada nas portas **22** (acesso), **80** e **443** (HTTPS). Não libere a 3000.

Anote o IP público da VM. Nos exemplos ele aparece como `203.0.113.10`.

## 2. Entrar na VM

No Windows, abra o **PowerShell** e digite (troque o usuário e o IP pelos seus; muitos
provedores usam o usuário `ubuntu`):

```
ssh ubuntu@203.0.113.10
```

Na primeira vez ele pergunta se confia na máquina: digite `yes`. Daqui para frente, os
comandos são digitados nessa janela, que agora está "dentro" da VM.

## 3. Instalar o Node.js 22

```
sudo apt update && sudo apt upgrade -y
sudo apt install -y ca-certificates curl unzip openssl
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v
```

O último comando deve mostrar `v22.` alguma coisa.

> Se no meio do `apt upgrade` aparecer uma tela roxa ou azul perguntando quais serviços
> reiniciar (**"Which services should be restarted?"** ou "Daemons using outdated
> libraries"), não mexa em nada: só aperte **Enter**. Se perguntar sobre um arquivo de
> configuração, aperte Enter também (mantém a versão atual).

O Node 22 é uma versão LTS (de suporte longo) e recebe correções de segurança até **30 de abril
de 2027**. Antes disso, troque para a próxima LTS: rode de novo os comandos acima com
`setup_24.x` no lugar de `setup_22.x` e reinicie o serviço (`sudo systemctl restart vila-do-noel`).
Para atualizar o próprio Node 22 com as correções que saírem até lá:
`sudo apt update && sudo apt upgrade -y`.

## 4. Copiar o servidor para a VM

Mande o arquivo `vila-do-noel-backend.zip` do seu computador para a VM. Abra um **segundo**
PowerShell já na pasta onde está o zip: no Explorador de Arquivos, abra essa pasta, clique na
barra de endereço lá em cima, apague o que estiver escrito, digite `powershell` e aperte
Enter. (Outro jeito: num PowerShell qualquer, digite `cd` e o caminho da pasta, por exemplo
`cd $HOME\Downloads`.) Nele, rode:

```
scp vila-do-noel-backend.zip ubuntu@203.0.113.10:~
```

De volta à janela da VM, descompacte, coloque em `/opt/vila-do-noel`, crie um usuário só
para o serviço e instale a dependência:

```
unzip -o vila-do-noel-backend.zip
sudo mkdir -p /opt/vila-do-noel
sudo cp -r vila-do-noel-backend/. /opt/vila-do-noel/
sudo useradd --system --home /opt/vila-do-noel --shell /usr/sbin/nologin vila || true
cd /opt/vila-do-noel
sudo npm install --omit=dev --no-audit --no-fund
sudo chown -R vila:vila /opt/vila-do-noel/data
```

## 5. Configurar (arquivo .env)

Primeiro gere a **senha do painel**. Este comando mostra uma senha aleatória e longa:

```
openssl rand -hex 24
```

Copie o resultado (selecione com o mouse; no PowerShell, o botão direito cola). Agora crie
o `.env` a partir do modelo e abra no editor:

```
cd /opt/vila-do-noel
sudo cp .env.example .env
sudo nano .env
```

No editor, ajuste estas linhas (use as setas para andar):

- `TOKEN_ADMIN=` cole a senha gerada acima. **Guarde essa senha**: é ela que você digita
  no painel.
- `ORIGENS_PERMITIDAS=` o endereço do seu front na Cloudflare, por exemplo
  `https://vila-do-noel.pages.dev,https://*.vila-do-noel.pages.dev`. Se ainda não criou o
  projeto na Cloudflare, deixe o exemplo e volte aqui depois (passo 10).
- `HOST=127.0.0.1`, `PORT=3000` e `DATA_DIR=data` podem ficar como estão.

Para salvar: `Ctrl + O`, `Enter`. Para sair: `Ctrl + X`. Depois proteja o arquivo
(só o administrador e o serviço conseguem ler):

```
sudo chown root:vila .env
sudo chmod 640 .env
```

## 6. Primeiro teste, à mão

```
cd /opt/vila-do-noel
sudo -u vila node servidor.mjs
```

Deve aparecer `Vila do Noel Live — servidor no ar`. Se aparecer `[erro]`, a mensagem diz
o que corrigir no `.env`. Para parar: `Ctrl + C`.

## 7. Deixar ligado sempre (systemd)

```
sudo cp /opt/vila-do-noel/vila-do-noel.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now vila-do-noel
sudo systemctl status vila-do-noel --no-pager
```

Deve mostrar `active (running)` em verde. Confira por dentro da VM:

```
curl http://127.0.0.1:3000/api/saude
```

Resposta esperada: `{"ok":true,"servico":"vila-do-noel","versao":"…","tempoNoArSeg":…}`.

Comandos do dia a dia:

| Para | Comando |
| --- | --- |
| Ver se está rodando | `sudo systemctl status vila-do-noel` |
| Ver o registro (Ctrl + C sai) | `sudo journalctl -u vila-do-noel -f` |
| Reiniciar (depois de mudar o `.env`) | `sudo systemctl restart vila-do-noel` |
| Parar | `sudo systemctl stop vila-do-noel` |

## 8. Apontar um domínio para a VM

O front na Cloudflare usa `https`, e o navegador só deixa uma página `https` conversar
com um servidor também em `https`. Para isso o servidor precisa de um nome (domínio).

No lugar onde você administra o seu domínio (Registro.br, Cloudflare, GoDaddy…), crie um
registro de DNS:

| Tipo | Nome | Valor |
| --- | --- | --- |
| `A` | `api` | o IP da VM (ex.: `203.0.113.10`) |

Isso cria o endereço `api.seu-dominio.com.br`. Se o domínio estiver na Cloudflare, deixe
a nuvem **cinza ("somente DNS")** neste registro, e deixe assim. O Caddy precisa falar direto
com a VM para tirar o certificado, e com a nuvem laranja o servidor passaria a ver o
endereço da Cloudflare em vez do de cada visitante. Aí as proteções por endereço (limite de
conexões e bloqueio por senha errada) juntariam pessoas diferentes, e alguém de fora poderia
bloquear o seu painel. Se um dia quiser mesmo a nuvem laranja, o `Caddyfile` traz, comentado,
o bloco que precisa ser ligado, e o modo SSL/TLS da Cloudflare deve ser **"Completo (estrito)"**.

A mudança de DNS pode levar de alguns minutos a algumas horas. Para conferir, no
PowerShell: `nslookup api.seu-dominio.com.br` deve mostrar o IP da VM.

> **Sem domínio, só para testar:** o serviço gratuito sslip.io dá um nome para qualquer IP.
> Para o IP `203.0.113.10`, use `203-0-113-10.sslip.io` no lugar de
> `api.seu-dominio.com.br` nos passos seguintes. Para a live, prefira um domínio seu.

## 9. Ativar o HTTPS com o Caddy

Instale o Caddy (repositório oficial):

```
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
```

Coloque a configuração e troque o domínio de exemplo pelo seu:

```
sudo cp /opt/vila-do-noel/Caddyfile /etc/caddy/Caddyfile
sudo nano /etc/caddy/Caddyfile
```

Troque `api.seu-dominio.com.br` pelo seu endereço, salve (`Ctrl + O`, `Enter`, `Ctrl + X`) e:

```
sudo systemctl reload caddy
```

Ligue o firewall da própria VM, deixando passar só o acesso e o HTTPS:

```
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
```

> Na **Oracle Cloud**, as imagens do Ubuntu têm regras próprias de firewall (iptables).
> Se o HTTPS não responder, rode também:
> `sudo iptables -I INPUT 6 -p tcp -m multiport --dports 80,443 -j ACCEPT && sudo netfilter-persistent save`

## 10. Conferir pela internet

Abra no navegador do seu computador:

```
https://api.seu-dominio.com.br/api/saude
```

Deve aparecer `{"ok":true, …}` com o cadeado de site seguro. Pronto: o back-end está no ar.

Agora siga o `LEIA-ME.md` do **front-end**: ele pede para colocar
`https://api.seu-dominio.com.br` no `config.json` e o endereço do front em
`ORIGENS_PERMITIDAS` aqui no `.env`. Sempre que mudar o `.env`:

```
sudo systemctl restart vila-do-noel
```

## 11. Ligar a live (mais tarde)

A entrada de eventos fica em:

```
POST https://api.seu-dominio.com.br/api/evento
Authorization: Bearer <TOKEN_ADMIN ou TOKEN_EVENTOS>
Content-Type: application/json
```

O melhor é criar uma senha só para isso (`TOKEN_EVENTOS` no `.env`, gerada com
`openssl rand -hex 24`), para não entregar a senha do painel à ferramenta. Ferramentas que não
deixam configurar cabeçalhos podem mandar a senha no endereço:
`https://api.seu-dominio.com.br/api/evento?token=<TOKEN_EVENTOS>`. No endereço só vale o
`TOKEN_EVENTOS`: a senha do painel (`TOKEN_ADMIN`) nunca é aceita ali, porque endereços acabam
em históricos e registros de outros programas.

Errar a senha do painel não atrapalha a entrada de eventos (e vice-versa): cada uma conta as
tentativas erradas separadamente.

Teste pelo PowerShell (troque a senha):

```
Invoke-RestMethod -Method Post -Uri https://api.seu-dominio.com.br/api/evento -Headers @{Authorization='Bearer SUA_SENHA'} -ContentType 'application/json' -Body '{"type":"gift","userId":"teste1","nickname":"Maria","giftName":"Rosa"}'
```

O formato dos eventos e os caminhos para ligar ao TikTok estão no arquivo
`docs/INTEGRACAO.md` do projeto.

## 12. Atualizar para uma versão nova

No computador do projeto, gere o pacote de novo (`npm run pacote:backend`), mande o zip
para a VM (passo 4, só o `scp` e o `unzip`) e:

```
sudo cp vila-do-noel-backend/servidor.mjs vila-do-noel-backend/package.json /opt/vila-do-noel/
cd /opt/vila-do-noel && sudo npm install --omit=dev --no-audit --no-fund
sudo systemctl restart vila-do-noel
```

O `.env` e a pasta `data/` (configurações do painel) continuam como estavam.

## Problemas comuns

| O que aparece | O que fazer |
| --- | --- |
| `[erro] … TOKEN_ADMIN não está definido` (no registro) | Falta a senha no `.env` (passo 5). |
| `TOKEN_ADMIN ainda está com o valor de exemplo` | Troque pela senha gerada com `openssl rand -hex 24`. |
| `A porta 3000 já está em uso` | Outro programa usa a porta. Troque `PORT=` no `.env` e no `Caddyfile`. |
| `/api/saude` dá erro 502 | O Caddy está no ar, mas o servidor não: `sudo systemctl status vila-do-noel` e `sudo journalctl -u vila-do-noel -n 50`. |
| Navegador diz que o site não é seguro, ou não abre | DNS ainda não aponta para a VM, portas 80/443 fechadas no provedor, ou nuvem laranja da Cloudflare ligada cedo demais. Veja `sudo journalctl -u caddy -n 50`. |
| Painel: "não aceita esta página" | O endereço do front não está em `ORIGENS_PERMITIDAS`. Copie o endereço que o aviso mostra, coloque no `.env` e reinicie. |
| Painel: "Senha errada" | Confira `TOKEN_ADMIN` no `.env` (maiúsculas e minúsculas contam). |
| Painel: "Muitas tentativas erradas" | O painel ficou bloqueado para o seu endereço por 10 minutos. A live continua: os eventos e a tela do jogo têm contagem própria. Para liberar na hora: `sudo systemctl restart vila-do-noel`. |
| Eventos da live param com erro 429 | A ferramenta de eventos errou a senha 8 vezes e foi bloqueada por 10 minutos. Corrija a senha na ferramenta e rode `sudo systemctl restart vila-do-noel` para liberar na hora. |
| Tela do jogo (OBS): "precisa da chave da tela" ou "chave errada" | Abra o painel, copie o **Endereço para o OBS** (ele leva `?tela=...`) e cole na fonte do OBS. Trocar `TOKEN_ADMIN` troca a chave também. |
| Painel: "não conseguiu gravar as configurações" | A pasta `DATA_DIR` está sem permissão: deixe `DATA_DIR=data` e rode `sudo chown -R vila:vila /opt/vila-do-noel/data`. |

## Segurança: o que já vem ligado

- **Senha do painel** (`TOKEN_ADMIN`): sem ela, ninguém muda configurações, usa o simulador,
  comanda a fila nem manda eventos. O servidor não sobe na VM sem uma senha forte (pelo menos
  16 caracteres, sem repetição). A comparação da senha não dá pistas de quantos caracteres
  acertou, e 8 tentativas erradas seguidas bloqueiam aquele endereço por 10 minutos (painel,
  tela do jogo e eventos contam separado).
- A **tela do jogo** (OBS) só recebe dados: não consegue comandar nada. Ela conecta com a
  **chave da tela** que vai no endereço do OBS (o painel mostra o endereço pronto). A chave só
  serve para mostrar o jogo; quem a tiver não abre o painel. Sem ela, ninguém de fora consegue
  abrir telas falsas para ocupar vagas ou encher o registro do painel. No máximo 4 telas ao
  mesmo tempo (`MAX_TELAS`), e o painel mostra a situação da mais antiga.
- **Origens permitidas**: só as páginas listadas em `ORIGENS_PERMITIDAS` conseguem conectar.
- **Limites**: tamanho máximo das mensagens e dos pedidos, número de conexões (no total e por
  endereço; no IPv6, por bloco /64) e de mensagens por segundo. Se o servidor lotar, conexões
  que não se identificaram dão lugar ao painel e à tela do jogo.
- **Proxy de fotos** (`/api/avatar`): só baixa imagens (`jpeg`, `png`, `webp`, `gif`, `avif`)
  dos servidores de fotos do TikTok (ajustável em `AVATAR_HOSTS_PERMITIDOS`), em `https`, até
  2 MB e 6 segundos, e nunca da rede interna da VM (o endereço é conferido na hora da conexão).
  No máximo 16 downloads ao mesmo tempo, 4 por endereço, e as fotos já baixadas ficam guardadas
  por 10 minutos.
- Erros não mostram caminhos de arquivos nem detalhes internos.
- O serviço roda com um usuário próprio, sem poder de administrador, e só escreve em `data/`.

Para trocar a senha: mude `TOKEN_ADMIN` no `.env` e reinicie. O painel vai pedir a nova.
Nunca mande o `.env` para ninguém.

## Alternativa: Docker

Se a VM já usa Docker, pule os passos 3, 6 e 7, e no passo 4 pule só a linha
`sudo npm install …` (quem instala a dependência é o próprio Docker). Depois do passo 5:

```
cd /opt/vila-do-noel
sudo docker build -t vila-do-noel-backend .
sudo docker run -d --name vila-do-noel --restart unless-stopped \
  --env-file .env -e HOST=0.0.0.0 -e PROXY_CONFIAVEL=172.17.0.1 \
  -p 127.0.0.1:3000:3000 -v vila-dados:/app/data vila-do-noel-backend
```

O Caddy (passo 9) continua igual. No `.env` para Docker, escreva os valores sem aspas.

## Todas as configurações

Estão explicadas, uma por uma, no `.env.example`. As principais:

| Nome | Padrão na VM | O que é |
| --- | --- | --- |
| `TOKEN_ADMIN` | (obrigatório) | Senha do painel e dos eventos. |
| `ORIGENS_PERMITIDAS` | (vazio) | Endereços do front que podem conectar, separados por vírgula. |
| `PORT` / `HOST` | `3000` / `127.0.0.1` | Onde o servidor escuta (o Caddy repassa para cá). |
| `DATA_DIR` | `data` | Pasta das configurações do painel. |
| `TOKEN_EVENTOS` | (vazio) | Senha só para `POST /api/evento` (a única aceita em `?token=`). |
| `TOKEN_TELA` | (calculada do `TOKEN_ADMIN`) | Chave da tela do jogo, que vai no endereço do OBS. |
| `MAX_TELAS` | `4` | Telas do jogo conectadas ao mesmo tempo. |
| `SERVIR_FRONT` | `0` | `1` para este servidor também servir as páginas. |
| `AVATAR_HOSTS_PERMITIDOS` | servidores do TikTok | De onde o proxy de fotos pode baixar. |
