# Vila do Noel Live — front-end na Cloudflare Pages

Esta pasta tem as **páginas** do jogo, prontas para publicar na Cloudflare Pages (gratuito):

| Página | Endereço depois de publicar | Para que serve |
| --- | --- | --- |
| Tela do jogo | `https://vila-do-noel.pages.dev/` | A que vai para a transmissão (OBS). |
| Painel de controle | `https://vila-do-noel.pages.dev/painel` | Só para você; pede a senha na primeira vez. |
| Sala 3D (demonstração) | `https://vila-do-noel.pages.dev/sala` | Prévia do cenário 3D, funciona sem servidor. |

As páginas não guardam senha nem segredo nenhum. Elas só precisam saber **onde está o
back-end** (o servidor na VM), e isso fica no arquivo `config.json`, que você edita sem
precisar compilar nada.

```
OBS e navegador ──► Cloudflare Pages (estas páginas + config.json)
        │
        └── wss:// e https:// ──► VM: back-end (servidor.mjs) ──► live
```

Antes de começar, o back-end precisa estar no ar em `https` (veja o `LEIA-ME.md` do pacote
`backend`). Você vai precisar do endereço dele, por exemplo `https://api.seu-dominio.com.br`,
e da senha do painel (`TOKEN_ADMIN`).

---

## 1. Dizer onde está o back-end (config.json)

Se você recebeu o arquivo `vila-do-noel-frontend.zip`, primeiro **extraia**: botão direito no
zip → **Extrair tudo…** → **Extrair**. O Windows cria uma pasta chamada
`vila-do-noel-frontend` (no computador do projeto, a mesma pasta se chama
`pacotes/frontend`). Daqui para frente, use sempre essa pasta extraída.

Abra o arquivo `config.json` dessa pasta com o **Bloco de Notas** (botão direito → Abrir com).
Ele vem assim:

```json
{
  "backend": "https://api.seu-dominio.com.br",
  "_ajuda": "…"
}
```

Troque `https://api.seu-dominio.com.br` pelo endereço do seu back-end, **com `https://` e
sem barra no fim**, e salve. Só isso.

Se publicar sem trocar, o painel avisa: "O config.json ainda está com o servidor de exemplo".

## 2. Criar o projeto na Cloudflare Pages (upload direto)

1. Entre em <https://dash.cloudflare.com> (crie a conta gratuita, se ainda não tiver).
2. No menu da esquerda, abra **Workers e Pages** (Workers & Pages) e clique em **Criar**
   (Create).
3. Escolha a aba **Pages** e a opção **Enviar ativos** (Upload assets / "Use direct upload").
4. Dê um nome ao projeto, por exemplo `vila-do-noel`. Ele vira o endereço
   `https://vila-do-noel.pages.dev` (se o nome já existir, a Cloudflare sugere outro: anote o
   endereço que ela mostrar).
5. **Arraste a pasta inteira** que você editou no passo 1 (`vila-do-noel-frontend`, ou
   `frontend` no computador do projeto) para a área de envio. **Não arraste o `.zip`**: ele
   foi gerado antes da sua edição e ainda tem o servidor de exemplo no `config.json`.
6. Clique em **Implantar site** (Deploy site) e espere terminar.

## 3. Liberar o endereço do front no back-end

Na VM, abra o `.env` do back-end e coloque o endereço do front em `ORIGENS_PERMITIDAS`
(troque `vila-do-noel` pelo nome do seu projeto):

```
ORIGENS_PERMITIDAS=https://vila-do-noel.pages.dev,https://*.vila-do-noel.pages.dev
```

A segunda parte (com `*.`) libera os endereços de teste que a Cloudflare cria a cada envio.
Reinicie o back-end:

```
sudo systemctl restart vila-do-noel
```

## 4. Abrir o painel

Abra `https://vila-do-noel.pages.dev/painel`. Na primeira vez ele pede a **senha do painel**:
digite o valor de `TOKEN_ADMIN` do `.env` da VM. A senha fica guardada só naquele
navegador, naquele computador. O botão **Sair**, no topo, esquece a senha.

Se aparecer um aviso vermelho no topo, ele diz o que falta:

| Aviso | O que fazer |
| --- | --- |
| "ainda está com o servidor de exemplo" | Edite o `config.json` da pasta (passo 1) e envie a pasta de novo (passo 6). |
| "o config.json tem um erro de digitação" | Confira as aspas e as vírgulas no `config.json` (compare com o modelo do passo 1) e envie de novo. |
| "Não foi possível falar com o servidor" | A VM ou o serviço estão desligados, ou o endereço no `config.json` está errado. Teste `https://SEU-BACKEND/api/saude` no navegador. |
| "está no ar, mas não aceita esta página" | Falta o endereço do front em `ORIGENS_PERMITIDAS` (passo 3). **Acrescente** o endereço no fim da linha, depois de uma vírgula, sem apagar os que já estão lá. |
| "o servidor também precisa estar em https" | O `config.json` está com `http://`. Ative o HTTPS na VM (Caddy) e use `https://`. |
| "Senha errada" | Confira o `TOKEN_ADMIN` no `.env` da VM. |

## 5. Colocar no OBS

Com o painel aberto e conectado, o quadro **Endereço para o OBS** mostra o endereço da tela do
jogo, parecido com `https://vila-do-noel.pages.dev/?obs&tela=3f9a…`. Clique em **Copiar**.

1. No OBS, em **Fontes**, clique em **+** e escolha **Navegador**.
2. URL: cole o endereço copiado · largura `1080` · altura `1920`.
3. Marque **Controlar áudio via OBS**.

O pedaço `tela=…` é a **chave da tela**: sem ela a tela do jogo não conecta (aparece um aviso
vermelho explicando). A chave só deixa mostrar o jogo; quem tiver esse endereço não consegue
abrir o painel nem mudar nada. Mesmo assim, não publique esse endereço. Se você trocar a senha
do painel (`TOKEN_ADMIN`), a chave muda: copie o endereço de novo no painel e atualize a fonte
no OBS. O botão "Abrir a tela do jogo" do painel já abre a tela com a chave.

No painel, o selo "Tela do jogo: aberta" confirma que a tela do OBS está conectada. As
outras opções de endereço (`?limpar=1`, `?demo`) continuam valendo, como no modo local.

Depois de publicar uma versão nova, se o OBS continuar mostrando a antiga: clique com o
botão direito na fonte → **Propriedades** → **Atualizar cache da página atual**.

## 6. Atualizar (versão nova ou outro endereço de back-end)

- **Só mudou o endereço do back-end:** edite o `config.json` e envie de novo.
- **Versão nova do jogo:** no computador do projeto rode `npm run pacote:frontend` e envie a
  pasta nova.

Para enviar de novo: na Cloudflare, abra o projeto → **Implantações** (Deployments) →
**Criar implantação** (Create deployment) → arraste a pasta. Os arquivos que não mudaram
nem são reenviados.

Para testar outro back-end sem mexer no `config.json`, acrescente `?servidor=` ao endereço:
`https://vila-do-noel.pages.dev/painel?servidor=https://outro-servidor.com`. O botão
"Abrir a tela do jogo" do painel leva junto o mesmo servidor. Com o back-end rodando no seu
próprio computador, também vale `?servidor=http://localhost:3000`.

## 7. Domínio próprio para o front (opcional)

No projeto da Cloudflare Pages, aba **Domínios personalizados** (Custom domains), adicione
por exemplo `vila.seu-dominio.com.br`. Depois inclua esse endereço em `ORIGENS_PERMITIDAS`
no back-end e reinicie.

## 8. Alternativa: ligar a um repositório (GitHub/GitLab)

Quando o projeto estiver num repositório, a Cloudflare pode compilar sozinha a cada mudança.
Na criação do projeto, escolha **Conectar ao Git** e preencha:

| Campo | Valor |
| --- | --- |
| Predefinição de framework | Nenhuma (None) |
| Comando de build | `npm run pacote:frontend` |
| Diretório de saída | `pacotes/frontend` |
| Variável de ambiente | `NODE_VERSION` = `22` |

Nesse caso o `config.json` publicado vem do arquivo `deploy/frontend/config.json` do
repositório: coloque nele o endereço real do back-end (não é segredo).

Com muitos arquivos (mais de 1.000), use o Wrangler em vez de arrastar:
`npx wrangler pages deploy pacotes/frontend --project-name vila-do-noel`.

## Limites da Cloudflare Pages (plano gratuito)

- Até **25 MiB por arquivo**.
- Até **1.000 arquivos** no envio arrastando pelo painel; até 20.000 por site (Wrangler ou Git).
- 500 compilações por mês, quando ligado a um repositório (passo 8).

{{CONFERENCIA}}

## Arquivos especiais desta pasta

| Arquivo | Para que serve |
| --- | --- |
| `config.json` | Endereço do back-end. Lido toda vez que uma página abre (sem cache). |
| `_headers` | Cabeçalhos da Cloudflare: segurança e tempo de cache. Páginas e `config.json` sem cache; código compilado (`/app`) por um ano; arte 3D (`/assets`) por 7 dias. |
| `_redirects` | Atalho `/sala` para a demonstração 3D. (`/painel` já funciona sozinho: a Cloudflare serve `painel.html` também sem o `.html`.) |
| `audio/lista.json` | Lista dos áudios opcionais (`audio/musica/fundo.mp3` e frases em `audio/voz/`), gerada pelo `npm run pacote:frontend`. Veja "Música e voz próprias" abaixo. |
| `LEIA-ME.md` | Este arquivo. Ele também é publicado (não tem nada secreto). |

A arte 3D em `assets/` fica guardada por 7 dias nos navegadores. Ao trocar um modelo ou
uma textura, prefira um **nome de arquivo novo**, para todo mundo receber a versão nova na hora.
Hoje essa pasta vai junto para o **jogo 3D que vem aí** (a tela do jogo atual e a sala de
demonstração ainda não usam esses arquivos). Quando o jogo 3D virar a tela da live, gere o
pacote de novo (`npm run pacote:frontend`) e envie a pasta nova.

## Música e voz próprias

O jogo só toca os áudios que estão na lista `audio/lista.json`, e essa lista é montada pelo
`npm run pacote:frontend` a partir da pasta `public/audio` do projeto. Por isso, **colocar um
arquivo direto nesta pasta não funciona** (ele é ignorado sem aviso). O caminho certo:

1. No computador do projeto, salve a música em `public/audio/musica/fundo.mp3` e as frases do
   Noel em `public/audio/voz/` (os nomes estão em `public/audio/voz/LEIA-ME.txt`).
2. Rode `npm run pacote:frontend`.
3. Faça o passo 1 de novo na pasta nova (o endereço do back-end no `config.json`) e envie a
   pasta para a Cloudflare (passo 6).

Use somente músicas com licença que permita transmissões ao vivo.
