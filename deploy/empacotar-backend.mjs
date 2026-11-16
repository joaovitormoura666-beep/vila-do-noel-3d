// npm run pacote:backend
// Gera pacotes/backend/: o servidor num arquivo JavaScript só (servidor.mjs, com shared/ dentro),
// um package.json mínimo (só a dependência ws), os modelos de configuração da VM e o LEIA-ME.
// Também gera pacotes/vila-do-noel-backend.zip.
import { build } from 'esbuild';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { zipDirectory } from './zip.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'pacotes', 'backend');
const ZIP = join(ROOT, 'pacotes', 'vila-do-noel-backend.zip');
const MODELOS = join(ROOT, 'deploy', 'backend');

const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const wsVersion = String(pkg.dependencies.ws).replace(/^[\^~]/, '');

console.log('\n📦 Empacotando o back-end…');
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

await build({
  entryPoints: [join(ROOT, 'server', 'index.ts')],
  outfile: join(OUT, 'servidor.mjs'),
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  // ws fica como dependência normal (npm install); os opcionais dele não são necessários
  external: ['ws', 'bufferutil', 'utf-8-validate'],
  define: {
    __VILA_PACOTE__: 'true',
    __VILA_VERSAO__: JSON.stringify(pkg.version),
  },
  banner: {
    js: `// Vila do Noel Live — back-end ${pkg.version} (gerado por "npm run pacote:backend"; não edite: edite server/ e gere de novo).`,
  },
  legalComments: 'none',
  logLevel: 'warning',
  charset: 'utf8',
});

writeFileSync(
  join(OUT, 'package.json'),
  JSON.stringify(
    {
      name: 'vila-do-noel-backend',
      version: pkg.version,
      private: true,
      description: 'Vila do Noel Live - back-end (servidor de eventos, WebSocket e /api)',
      type: 'module',
      main: 'servidor.mjs',
      scripts: { start: 'node servidor.mjs' },
      engines: { node: '>=20' },
      dependencies: { ws: wsVersion },
    },
    null,
    2,
  ) + '\n',
);

for (const f of ['.env.example', 'vila-do-noel.service', 'Caddyfile', 'Dockerfile', '.dockerignore', 'LEIA-ME.md']) {
  copyFileSync(join(MODELOS, f), join(OUT, f));
}
mkdirSync(join(OUT, 'data'), { recursive: true });
writeFileSync(join(OUT, 'data', 'LEIA-ME.txt'), 'Aqui o servidor guarda as configurações do painel (configuracoes.json).\n');

// confere se o arquivo gerado é JavaScript válido
execFileSync(process.execPath, ['--check', join(OUT, 'servidor.mjs')], { stdio: 'inherit' });

mkdirSync(dirname(ZIP), { recursive: true });
if (existsSync(ZIP)) rmSync(ZIP);
const zip = zipDirectory(OUT, ZIP, { prefix: 'vila-do-noel-backend/' });

const kb = (n) => `${Math.round(n / 1024)} KB`;
console.log(`  ✔ ${OUT}`);
console.log(`    servidor.mjs: ${kb(readFileSync(join(OUT, 'servidor.mjs')).length)}  (ws ${wsVersion} via npm install)`);
console.log(`  ✔ ${ZIP}  (${zip.files} arquivos, ${kb(zip.bytes)})`);
console.log('  Próximo passo: pacotes/backend/LEIA-ME.md\n');
