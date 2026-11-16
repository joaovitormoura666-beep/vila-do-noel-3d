#!/usr/bin/env node
/**
 * Ajudante dos atalhos do Windows (iniciar.bat, parar.bat e abrir-janela-da-live.bat). Fica num arquivo à parte
 * porque fazer estas contas dentro de um .bat é frágil (aspas, acentos, netstat traduzido no Windows em português).
 *
 *   node tools/windows.cjs precisa-instalar      sai com 0 se falta rodar "npm install" (primeira vez, pasta
 *                                                node_modules incompleta ou package.json/package-lock.json mudaram)
 *   node tools/windows.cjs marcar-instalado      anota que a instalação terminou (para não repetir à toa)
 *   node tools/windows.cjs porta [3000]          0 = porta livre; 1 = a Vila do Noel já está no ar nela;
 *                                                2 = outro programa está usando a porta
 *   node tools/windows.cjs parar [3000]          encerra a Vila do Noel que está no ar nessa porta (só ela)
 *   node tools/windows.cjs abrir-janela [3000] [540|1080]
 *                                                abre a tela do jogo numa janela própria do Edge (ou do Chrome),
 *                                                sem barra de endereço, em 9:16, com o som liberado sem clique e sem
 *                                                pausar quando outra janela fica na frente: é a janela que o TikTok
 *                                                LIVE Studio captura
 *
 * Não usa pacote nenhum (roda antes do npm install) e funciona com o Node 20 ou mais novo.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const net = require('net');
const http = require('http');
const crypto = require('crypto');
const { execFileSync, spawn } = require('child_process');

const RAIZ = path.resolve(__dirname, '..');
const MARCA = path.join(RAIZ, 'node_modules', '.vila-instalacao');
const [comando, ...resto] = process.argv.slice(2);
const porta = Number(resto[0] || process.env.PORT || 3000) || 3000;

/** Impressão do que o npm install depende: se mudar, é preciso instalar de novo. */
function impressao() {
  const h = crypto.createHash('sha256');
  for (const f of ['package.json', 'package-lock.json']) {
    const p = path.join(RAIZ, f);
    h.update(f);
    if (fs.existsSync(p)) h.update(fs.readFileSync(p));
  }
  h.update(process.versions.node.split('.')[0]); // trocar o Node de versão grande também pede reinstalação
  return h.digest('hex');
}

function precisaInstalar() {
  // pacotes sem os quais o jogo nem compila: se faltar um, a instalação anterior não terminou
  for (const p of ['vite', 'three', 'tsx', 'ws', 'phaser']) {
    if (!fs.existsSync(path.join(RAIZ, 'node_modules', p, 'package.json'))) return true;
  }
  try {
    return fs.readFileSync(MARCA, 'utf8').trim() !== impressao();
  } catch {
    return true;
  }
}

/** Alguém atende nessa porta? */
function portaOcupada(n) {
  return new Promise((ok) => {
    const s = net.connect({ host: '127.0.0.1', port: n });
    const fim = (v) => {
      s.destroy();
      ok(v);
    };
    s.setTimeout(1500, () => fim(true)); // não recusou: tem alguém lá, só demorando
    s.once('connect', () => fim(true));
    s.once('error', (e) => fim(e && e.code !== 'ECONNREFUSED'));
  });
}

/** Quem atende nessa porta é o servidor da Vila do Noel? (GET /api/saude responde { ok, versao, tempoNoArSeg }) */
function ehAVila(n) {
  return new Promise((ok) => {
    const req = http.get({ host: '127.0.0.1', port: n, path: '/api/saude', timeout: 2500 }, (res) => {
      let corpo = '';
      res.setEncoding('utf8');
      res.on('data', (d) => {
        if (corpo.length < 10000) corpo += d;
      });
      res.on('end', () => {
        try {
          const j = JSON.parse(corpo);
          ok(res.statusCode === 200 && j && j.ok === true && 'versao' in j && 'tempoNoArSeg' in j);
        } catch {
          ok(false);
        }
      });
    });
    req.on('timeout', () => req.destroy());
    req.on('error', () => ok(false));
  });
}

/** Processos que escutam na porta, pelo netstat do Windows (as colunas não dependem do idioma do Windows). */
function pidsNaPorta(n) {
  const saida = execFileSync('netstat', ['-ano', '-p', 'TCP'], { encoding: 'utf8', windowsHide: true });
  const pids = new Set();
  for (const linha of saida.split(/\r?\n/)) {
    const c = linha.trim().split(/\s+/);
    if (c.length < 5 || c[0].toUpperCase() !== 'TCP') continue;
    const [, local, remoto] = c;
    const pid = Number(c[c.length - 1]);
    // quem escuta tem o endereço remoto zerado (0.0.0.0:0 ou [::]:0)
    if (local.endsWith(`:${n}`) && /^(0\.0\.0\.0|\[::\]):0$/.test(remoto) && pid > 0) pids.add(pid);
  }
  return [...pids];
}

function acharNavegador() {
  const pf = process.env.ProgramFiles || 'C:\\Program Files';
  const pf86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  const local = process.env.LOCALAPPDATA || '';
  const candidatos = [
    path.join(pf86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(pf, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    local && path.join(local, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(pf, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(pf86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    local && path.join(local, 'Google', 'Chrome', 'Application', 'chrome.exe'),
  ].filter(Boolean);
  return candidatos.find((c) => fs.existsSync(c)) || null;
}

async function main() {
  switch (comando) {
    case 'precisa-instalar':
      process.exit(precisaInstalar() ? 0 : 1);
      break;
    case 'marcar-instalado':
      fs.mkdirSync(path.dirname(MARCA), { recursive: true });
      fs.writeFileSync(MARCA, impressao() + '\n');
      break;
    case 'porta': {
      if (!(await portaOcupada(porta))) process.exit(0);
      process.exit((await ehAVila(porta)) ? 1 : 2);
      break;
    }
    case 'parar': {
      if (!(await portaOcupada(porta))) {
        console.log(`  Nada para encerrar: a Vila do Noel nao esta aberta na porta ${porta}.`);
        process.exit(0);
      }
      if (!(await ehAVila(porta))) {
        console.log(`  A porta ${porta} esta com outro programa (nao e a Vila do Noel). Nada foi encerrado.`);
        process.exit(2);
      }
      if (process.platform !== 'win32') {
        console.log('  Este atalho e so para o Windows. Aqui, encerre com Ctrl + C na janela do servidor.');
        process.exit(2);
      }
      const pids = pidsNaPorta(porta);
      for (const pid of pids) {
        try {
          execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
        } catch {
          /* já tinha fechado */
        }
      }
      console.log(pids.length ? '  Pronto: a Vila do Noel foi encerrada.' : '  Nao achei o processo do servidor; feche a janela do iniciar.bat.');
      break;
    }
    case 'abrir-janela': {
      const tamanho = resto[1] === '1080' ? 1080 : 540;
      if (!(await ehAVila(porta))) {
        console.log(`  A Vila do Noel nao esta aberta na porta ${porta}. Abra primeiro o iniciar.bat e deixe a janela dele aberta.`);
        process.exit(2);
      }
      const nav = acharNavegador();
      if (!nav) {
        console.log('  Nao achei o Edge nem o Chrome neste computador. Abra a tela do jogo pelo botao do painel.');
        process.exit(2);
      }
      const url = `http://localhost:${porta}/?obs&janela=${tamanho}`;
      // perfil próprio: as opções abaixo só valem num navegador aberto do zero (não no Edge que já está aberto)
      const perfil = path.join(process.env.LOCALAPPDATA || RAIZ, 'VilaDoNoel', 'janela-da-live');
      // tamanho da janela com as bordas e a barra de título (a página ainda acerta a área de dentro em 9:16)
      const w = tamanho === 1080 ? 1096 : 556;
      const h = tamanho === 1080 ? 1960 : 1000;
      const filho = spawn(
        nav,
        [
          `--app=${url}`,
          `--user-data-dir=${perfil}`,
          `--window-size=${w},${h}`,
          '--window-position=40,10',
          '--no-first-run',
          '--no-default-browser-check',
          // som liberado sem clique (a janela é só para a live)
          '--autoplay-policy=no-user-gesture-required',
          // continua animando mesmo com outra janela na frente (a captura de janela pega a imagem mesmo assim)
          '--disable-background-timer-throttling',
          '--disable-renderer-backgrounding',
          '--disable-backgrounding-occluded-windows',
        ],
        { detached: true, stdio: 'ignore', windowsHide: false },
      );
      filho.unref();
      console.log(`  Janela da live aberta (${path.basename(nav)}): ${url}`);
      break;
    }
    default:
      console.log('Uso: node tools/windows.cjs precisa-instalar | marcar-instalado | porta [n] | parar [n] | abrir-janela [n] [540|1080]');
      process.exit(64);
  }
}

main().catch((e) => {
  console.error('  [!] ' + (e && e.message ? e.message : String(e)));
  process.exit(70);
});
