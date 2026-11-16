# Publicação: rodar no PC e separar servidor e páginas

Há dois jeitos de rodar o jogo: tudo no PC da live (o jeito atual, sem nada para configurar) ou separado,
com o servidor numa máquina virtual (VM) na internet e as páginas na Cloudflare Pages. A separação está
**em construção**: os pacotes já são gerados para a versão 2D e para a sala 3D, mas o jogo 3D
(`jogo3d.html`) ainda não entra neles.

## 1. Rodar no PC com Windows

O que precisa: Windows 10 ou 11, Node.js 22 LTS ou mais novo (<https://nodejs.org>), Chrome ou Edge e,
para transmitir, o OBS Studio ou o TikTok LIVE Studio. Nenhum serviço pago. (O `package.json` ainda aceita
o Node 20, mas o suporte dele acabou em 30/04/2026; o back-end da VM também usa o Node 22.)

Primeira vez: pegue o código (seção 3) e, no terminal do VS Code, dentro da pasta do projeto, rode:

```
npm install
```

### Ver o 3D

```
npm run lab
```

Depois abra no navegador (deixe o terminal aberto):

- <http://127.0.0.1:5180/demo-sala.html>: a sala 3D com os botões dos quatro efeitos;
- <http://127.0.0.1:5180/jogo3d.html?demo=1>: o jogo 3D em demonstração, com visitantes fictícios (em
  construção);
- <http://127.0.0.1:5180/lab/index.html?cena=vila&set=a>: o laboratório.

O laboratório não liga o servidor de eventos: o jogo 3D percebe isso e entra sozinho em demonstração.

### Jogo 3D com o servidor e o painel (em construção)

```
npm run dev
```

Liga o servidor (porta 3000) e o Vite em <http://127.0.0.1:5173>, que repassa `/ws` e `/api` ao servidor.
Abra o painel em <http://127.0.0.1:5173/painel.html> e o jogo 3D em <http://127.0.0.1:5173/jogo3d.html>.
O jogo 3D usa a mesma conexão do 2D (papel `game`), então o simulador e os comandos do painel (pular,
limpar, testar voz, recarregar, configurações) chegam a ele. Os botões dos efeitos ambientes ainda não
existem no painel. Como esta parte está em construção, confira antes de usar numa live.

### O jogo 2D (versão 1.0, que funciona)

Dois cliques em `iniciar.bat`, ou `npm start`. O painel abre em <http://localhost:3000/painel.html> e a tela
da live em <http://localhost:3000/?obs>. O passo a passo completo, com o OBS e o LIVE Studio, está no
`README.md`. Observação: `npm start` compila só o 2D e o painel (`vite.config.ts`); a página do jogo 3D ainda
não é servida pela porta 3000.

### OBS

Fonte **Navegador**, largura 1080, altura 1920, com o endereço da tela do jogo e `?obs` no fim (esconde
botões e avisos de operação). Marque **Controlar áudio via OBS**. Com o 3D, ligue a aceleração por hardware
da fonte de navegador (Configurações → Avançado) e confira o FPS: a meta é 60 FPS com o OBS aberto, e isso
ainda não foi medido numa placa de vídeo real.

## 2. Separar: servidor na VM e páginas na Cloudflare Pages

```
 OBS (tela do jogo) ──┐
                      ├──► Cloudflare Pages (front-end): páginas, painel e config.json
 Navegador (painel) ──┘          │  o config.json diz onde está o back-end
                                 ▼
                      wss:// (tempo real) e https:// (/api)
                                 │
                                 ▼
                      VM Linux: Caddy (HTTPS) ──► servidor.mjs  ◄── eventos da live (POST /api/evento)
```

### Gerar os pacotes

```
npm run pacotes
```

(ou `npm run pacote:backend` e `npm run pacote:frontend`, um de cada vez). Os scripts ficam em `deploy/`
(`empacotar-backend.mjs`, `empacotar-frontend.mjs`, `zip.mjs`) e os modelos de configuração em
`deploy/backend/` e `deploy/frontend/`. O resultado vai para `pacotes/` (pasta gerada, fora do GitHub):

| Pacote | Conteúdo | Passo a passo |
| --- | --- | --- |
| `pacotes/backend/` e `pacotes/vila-do-noel-backend.zip` | o servidor num arquivo só (`servidor.mjs`), `package.json`, `.env.example`, serviço do systemd, `Caddyfile`, `Dockerfile` opcional | `deploy/backend/LEIA-ME.md` |
| `pacotes/frontend/` e `pacotes/vila-do-noel-frontend.zip` | tela do jogo 2D (`index.html`), painel, sala 3D (`demo-sala.html`, também em `/sala`), `config.json`, `_headers`, `_redirects`, os recursos de `public/` | `deploy/frontend/LEIA-ME.md` |

### Back-end na VM (resumo de `deploy/backend/LEIA-ME.md`)

- VM Linux com Ubuntu 22.04 ou 24.04, a menor serve, com IP fixo; liberar só as portas 22, 80 e 443.
- Node.js 22 (LTS), o Caddy na frente para o HTTPS automático e gratuito, e o serviço do systemd para o
  servidor ficar sempre ligado.
- Um domínio ou subdomínio que o dono controle (por exemplo `api.seu-dominio.com.br`).
- Configurações no `.env` (modelo comentado em `deploy/backend/.env.example`): `TOKEN_ADMIN` (senha do
  painel, gerada na hora e nunca escrita em documento), `ORIGENS_PERMITIDAS` (o endereço das páginas na
  Cloudflare), `PORT`, `HOST`, `DATA_DIR`. Opcionais, explicadas no próprio modelo: `TOKEN_TELA`,
  `TOKEN_EVENTOS`, `SERVIR_FRONT`, `PASTA_FRONT`, `AVATAR_HOSTS_PERMITIDOS` (de onde podem vir as fotos de
  perfil, repassadas por `server/avatars.ts`), `PROXY_CONFIAVEL` e os limites de conexão e de tamanho.

### Front-end na Cloudflare Pages (resumo de `deploy/frontend/LEIA-ME.md`)

- Editar o `config.json` com o endereço do back-end (`https://...`, sem barra no fim).
- Criar um projeto no plano gratuito da Cloudflare Pages com envio direto e arrastar a pasta (não o `.zip`).
- Liberar o endereço das páginas em `ORIGENS_PERMITIDAS` no back-end.
- Abrir o painel, entrar com a senha e copiar dele o endereço do OBS, que leva a chave da tela
  (`https://SEU-PROJETO.pages.dev/?obs&tela=...`).
- Com a Cloudflare ligada a um repositório: comando de build `npm run pacote:frontend`, pasta de saída
  `pacotes/frontend`.

Nesse modo o painel pede a senha, a tela do jogo só recebe dados (e precisa da chave da tela) e o servidor só
aceita as páginas listadas em `ORIGENS_PERMITIDAS`. Os testes `tests/painel-auth.test.ts`,
`tests/seguranca.test.ts` e `tests/front-config.test.ts` cobrem essas regras.

### O que ainda falta na separação

- Incluir o jogo 3D (`jogo3d.html`) no pacote do front-end e nos endereços da Cloudflare (em construção).
- Decidir qual página é a tela principal da live: hoje `index.html` é o 2D; o plano é passar o 3D para a
  principal e deixar o 2D como versão clássica (decisão do dono).
- Conferir o peso do pacote do front-end: ele copia todo `public/assets/` (cerca de 26 MB), incluindo
  modelos do acervo que a sala A não usa.

## 3. O código no GitHub (repositório privado)

O código já está num repositório **privado** no GitHub, no ramo `main`. O primeiro envio foi em
16/11/2026, por volta de 03:21 UTC, e logo depois entrou o commit da separação back-end/front-end.

Para continuar no VS Code:

1. Pegue o endereço do repositório com o dono ou no `CONTINUAR-NO-VSCODE.md` da pasta compartilhada do
   projeto. (O endereço tem o login do dono no GitHub, por isso não fica escrito aqui.)
2. No VS Code: Controle do Código-Fonte → Clonar repositório (ou `git clone` no terminal) e abra a pasta.
3. No terminal do VS Code, rode `npm install`.
4. Peça ao agente de código que leia o `AGENTS.md` antes de qualquer coisa.

O que o `.gitignore` já deixa de fora: `node_modules/`, as pastas geradas (`dist/`, `dist-*/`, `pacotes/`),
`assets-src/`, `.env` e `.env.*` (menos `.env.example` e `.env.demo`), `data/`, as fotos de trabalho
(`lab/fotos/**/*.png`, `*.jpg`, `*.mp4`), as fotos do acervo (`lab/acervo/*.png`) e as duas referências de
obras de terceiros (`lab/referencia-clima.png`, `lab/referencia-gnomo.png`). As `NOTAS.md` e as
`CRITICA.json` vão para o git. O `.env.demo` da raiz só tem `VITE_AUTONOMO=1` e pode ir.

Por isso um clone novo **não tem** essas imagens. Quando uma `NOTAS.md` mandar abrir uma foto, refaça a
foto com `tools/shot.cjs` (veja `LABORATORIO.md`). As duas referências de terceiros ficam só no computador
do dono ou na pasta compartilhada. O zip `vila-do-noel-3d-codigo.zip` da pasta compartilhada também não
traz as fotos de trabalho.

Regras de git para quem continua (detalhes no `AGENTS.md`, seção 11): mensagens de commit em português;
um ramo por agente quando houver mais de um trabalhando; `npm run typecheck` e `npm test` antes de cada
commit; nunca `git add -f` em fotos nem em `.env`; nenhuma senha em arquivo do repositório.
