import { exec } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { createVilaServer } from './app.js';
import { EMPACOTADO, ROOT, readConfig } from './config.js';
import { loadDotEnv } from './env.js';

// O arquivo .env (se existir) fica na raiz do projeto ou ao lado do servidor empacotado.
const envFile = resolve(ROOT, '.env');
const envLoaded = loadDotEnv(envFile);

/*
 * Proteção contra erros inesperados. A leitura da live usa uma biblioteca não oficial que faz
 * rede em segundo plano; uma promessa rejeitada sem tratamento ali derrubaria o Node 22 (e a
 * fila) no meio da live. Aqui o erro vira só um aviso na janela preta. Mostra só a mensagem,
 * cortada, e nunca o objeto inteiro: ele poderia trazer dados de quem assiste.
 */
const mensagemCurta = (e: unknown) => String((e as { message?: unknown } | null)?.message ?? e).slice(0, 200);
process.on('unhandledRejection', (e) => console.warn('[aviso] erro inesperado ignorado:', mensagemCurta(e)));
process.on('uncaughtException', (e) => console.warn('[aviso] erro inesperado ignorado:', mensagemCurta(e)));

const nodeMajor = Number(process.versions.node.split('.')[0]);
if (nodeMajor < 22) {
  console.warn(
    `[aviso] Este computador usa o Node.js ${process.versions.node}. O jogo abre, mas a leitura da live do TikTok precisa do Node.js 22 ou mais novo: instale a versão LTS em https://nodejs.org.`,
  );
}

const { config, errors, warnings } = readConfig(process.env);

if (errors.length) {
  console.error('\n[erro] O servidor não pode subir com esta configuração:\n');
  for (const e of errors) console.error(`  - ${e}\n`);
  console.error(`  Ajuste ${envLoaded ? 'o arquivo .env' : 'as variáveis de ambiente (ou crie um arquivo .env a partir do .env.example)'} e inicie de novo.\n`);
  process.exit(1);
}
for (const w of warnings) console.warn(`[aviso] ${w}`);

const app = createVilaServer(config);

app
  .listen()
  .then((addr) => {
    const local = !config.exposed;
    const base = local ? `http://localhost:${addr.port}` : `http://${config.host}:${addr.port}`;
    console.log(`\n🎄 Vila do Noel Live — servidor no ar (versão ${config.version})\n`);
    if (config.serveFront && existsSync(config.frontDir)) {
      console.log(`  Tela da live (OBS):  ${base}/`);
      console.log(`  Painel de controle:  ${base}/painel.html`);
    } else if (local) {
      console.log('  Modo desenvolvimento: abra http://localhost:5173/ e http://localhost:5173/painel.html');
    } else {
      console.log(`  Back-end ouvindo em ${config.host}:${addr.port} (o front fica na Cloudflare).`);
      console.log(`  Origens permitidas:  ${config.allowedOrigins.length ? config.allowedOrigins.join(', ') : '(nenhuma)'}`);
    }
    console.log(`  Verificação:         ${base}/api/saude`);
    console.log(`  Webhook de eventos:  POST ${base}/api/evento${config.adminToken ? '  (com a senha)' : ''}`);
    console.log(`  Senha do painel:     ${config.adminToken ? 'definida (TOKEN_ADMIN)' : 'nenhuma (só aceita este computador)'}`);
    if (config.screenKey) {
      console.log(
        `  Chave da tela (OBS): ${config.screenKeyFromEnv ? 'definida (TOKEN_TELA)' : 'calculada do TOKEN_ADMIN'}; o painel mostra o endereço do OBS pronto`,
      );
    }
    if (EMPACOTADO || config.exposed) console.log(`  Dados salvos em:     ${config.dataDir}`);
    console.log('\n  Para encerrar: Ctrl + C\n');
    // O iniciar.bat marca ".vila-iniciando" enquanto instala e compila (para uma segunda janela
    // não rodar outro npm install ao mesmo tempo). Com o servidor no ar, a marca não é mais necessária.
    if (!EMPACOTADO) {
      try {
        rmSync(resolve(ROOT, '.vila-iniciando'), { force: true });
      } catch {
        /* sem permissão: o iniciar.bat confere se a janela dona da marca ainda está aberta */
      }
    }
    // O iniciar.bat abre só o painel; a tela do jogo é aberta pelo botão do painel, numa
    // janela à parte (se as duas abrissem como abas, a que ficasse escondida pausaria).
    if (config.openBrowser && config.serveFront && existsSync(config.frontDir)) openInBrowser(`${base}/painel.html`);
  })
  .catch((err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(
        `\n[erro] A porta ${config.port} já está em uso. Feche a outra janela do jogo ou rode com outra porta:\n  set PORT=3100 && npm start\n`,
      );
    } else if (err.code === 'EACCES') {
      console.error(`\n[erro] Sem permissão para usar a porta ${config.port}. Use uma porta acima de 1024 (ex.: PORT=3000).\n`);
    } else if (err.code === 'EADDRNOTAVAIL') {
      console.error(`\n[erro] O endereço HOST=${config.host} não existe nesta máquina. Use 127.0.0.1 ou 0.0.0.0.\n`);
    } else {
      console.error('\n[erro] Não foi possível iniciar o servidor:', err.message, '\n');
    }
    process.exit(1);
  });

/** Abre uma página no navegador padrão (usado pelo iniciar.bat). */
function openInBrowser(url: string) {
  const cmd = process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
  exec(cmd, () => {
    /* se não conseguir abrir, o endereço já está impresso acima */
  });
}

function shutdown() {
  void app.close().then(() => process.exit(0));
  setTimeout(() => process.exit(0), 800).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
