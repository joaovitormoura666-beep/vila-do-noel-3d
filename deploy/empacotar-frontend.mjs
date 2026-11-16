// npm run pacote:frontend
// Gera pacotes/frontend/: as páginas estáticas prontas para a Cloudflare Pages
// (tela do jogo, painel e a demonstração da sala 3D), com config.json de exemplo,
// _headers, _redirects e o LEIA-ME. Também gera pacotes/vila-do-noel-frontend.zip.
//
// Na Cloudflare ligada a um repositório: comando de build "npm run pacote:frontend",
// pasta de saída "pacotes/frontend".
import { build } from 'vite';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listFiles, zipDirectory } from './zip.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'pacotes', 'frontend');
const ZIP = join(ROOT, 'pacotes', 'vila-do-noel-frontend.zip');
const MODELOS = join(ROOT, 'deploy', 'frontend');
const semZip = process.argv.includes('--sem-zip');

// Limites da Cloudflare Pages (plano gratuito)
const MIB = 1024 * 1024;
const LIMITE_ARQUIVO = 25 * MIB;
const LIMITE_ARRASTAR = 1000; // envio pelo painel da Cloudflare (arrastar a pasta ou o .zip)
const LIMITE_SITE = 20000;

console.log('\n📦 Empacotando o front-end (Cloudflare Pages)…');

await build({
  root: ROOT,
  configFile: join(ROOT, 'vite.config.ts'),
  mode: 'production',
  logLevel: 'warn',
  build: {
    outDir: OUT,
    emptyOutDir: true,
    // código compilado em /app (nomes com hash, cache de um ano);
    // /assets fica só para a arte de public/assets (nomes fixos)
    assetsDir: 'app',
    rollupOptions: {
      // a tela do jogo e o painel já vêm do vite.config.ts; aqui entra a sala 3D
      input: { sala: join(ROOT, 'demo-sala.html') },
    },
  },
});

for (const page of ['index.html', 'painel.html', 'demo-sala.html']) {
  if (!existsSync(join(OUT, page))) throw new Error(`a página ${page} não foi gerada`);
  // a política de segurança (_headers) não permite scripts escritos dentro do HTML
  const html = readFileSync(join(OUT, page), 'utf8');
  if (/<script(?![^>]*\bsrc=)[^>]*>\s*\S/i.test(html)) console.warn(`  ⚠ ${page} tem um <script> embutido: confira a Content-Security-Policy do _headers.`);
}

for (const f of ['_headers', '_redirects', 'config.json', 'LEIA-ME.md']) copyFileSync(join(MODELOS, f), join(OUT, f));

// Lista dos áudios opcionais: os arquivos ficam aqui no front, então a lista também
// (no computador quem lista é o servidor, em /api/audio).
const audioDir = join(OUT, 'audio');
const list = (dir) => {
  try {
    return readdirSync(join(audioDir, dir));
  } catch {
    return [];
  }
};
mkdirSync(audioDir, { recursive: true });
// Os LEIA-ME.txt de public/audio falam do modo local ("rode npm start de novo"); no pacote
// da Cloudflare o caminho é outro, então eles são trocados por estes.
const COMO_ADICIONAR =
  'Na Cloudflare, colocar um arquivo direto nesta pasta NÃO funciona: o jogo só toca o que\n' +
  'está em audio/lista.json, que é gerado pelo "npm run pacote:frontend".\n\n' +
  'Para adicionar:\n' +
  '  1. no computador do projeto, salve o arquivo em public/audio/{pasta}/\n' +
  '  2. rode "npm run pacote:frontend"\n' +
  '  3. coloque de novo o endereço do back-end no config.json da pasta nova\n' +
  '  4. envie a pasta para a Cloudflare (LEIA-ME.md, passo 6)\n';
const AUDIO_LEIAME = {
  musica:
    'Música de fundo (opcional)\n==========================\n\nNome do arquivo: fundo.mp3 (ou fundo.ogg / fundo.wav).\n' +
    'Use somente músicas com licença que permita transmissões ao vivo.\n\n' +
    COMO_ADICIONAR.replace('{pasta}', 'musica'),
  voz:
    'Frases pré-gravadas do Papai Noel (opcional)\n============================================\n\n' +
    'Arquivos .mp3 com o nome do identificador da frase (lista em public/audio/voz/LEIA-ME.txt\n' +
    'e em src/santa/phrases.ts, no projeto).\n\n' +
    COMO_ADICIONAR.replace('{pasta}', 'voz'),
};
for (const [dir, text] of Object.entries(AUDIO_LEIAME)) {
  mkdirSync(join(audioDir, dir), { recursive: true });
  writeFileSync(join(audioDir, dir, 'LEIA-ME.txt'), text);
}
writeFileSync(
  join(audioDir, 'lista.json'),
  JSON.stringify({
    musica: list('musica').find((f) => /^fundo\.(mp3|ogg|wav)$/i.test(f)) ?? null,
    vozes: list('voz').filter((f) => /\.mp3$/i.test(f)).map((f) => f.replace(/\.mp3$/i, '')),
  }) + '\n',
);

// Conferência dos limites da Cloudflare Pages
const files = listFiles(OUT);
let total = 0;
const grandes = [];
for (const f of files) {
  const size = statSync(f).size;
  total += size;
  if (size > LIMITE_ARQUIVO * 0.8) grandes.push(`${relative(OUT, f).split(sep).join('/')} (${(size / MIB).toFixed(1)} MiB)`);
}
const mib = (n) => `${(n / MIB).toFixed(1)} MiB`;
console.log(`  ✔ ${OUT}`);
console.log(`    ${files.length} arquivos, ${mib(total)} no total`);
if (grandes.length) {
  console.warn(`  ⚠ Arquivos perto ou acima do limite de 25 MiB por arquivo da Cloudflare Pages:\n     ${grandes.join('\n     ')}`);
}
if (files.length > LIMITE_SITE) console.warn(`  ⚠ Mais de ${LIMITE_SITE} arquivos: passa do limite da Cloudflare Pages.`);
else if (files.length > LIMITE_ARRASTAR * 0.8) {
  console.warn(`  ⚠ ${files.length} arquivos: o envio arrastando no painel da Cloudflare aceita até ${LIMITE_ARRASTAR}. Use o Wrangler (veja o LEIA-ME).`);
}

// LEIA-ME com a conferência desta geração
const maior = files.map((f) => ({ f, size: statSync(f).size })).sort((a, b) => b.size - a.size)[0];
const alertas = [
  ...(grandes.length ? [`arquivos perto ou acima de 25 MiB: ${grandes.join(', ')}`] : []),
  ...(files.length > LIMITE_ARRASTAR * 0.8 ? [`${files.length} arquivos: perto ou acima do limite de ${LIMITE_ARRASTAR} do envio arrastando (use o Wrangler)`] : []),
];
const situacao = alertas.length ? `ATENÇÃO: ${alertas.join('; ')}.` : 'tudo dentro dos limites, com folga.';
const conferencia = [
  `**Conferência desta pasta** (gerada em ${new Date().toLocaleDateString('pt-BR')}): ${files.length} arquivos, ${mib(total)} no total;`,
  `o maior é \`${relative(OUT, maior.f).split(sep).join('/')}\` (${mib(maior.size)}). Resultado: ${situacao}`,
].join('\n');
const leiame = readFileSync(join(MODELOS, 'LEIA-ME.md'), 'utf8').replace('{{CONFERENCIA}}', conferencia);
writeFileSync(join(OUT, 'LEIA-ME.md'), leiame);

if (!semZip) {
  mkdirSync(dirname(ZIP), { recursive: true });
  if (existsSync(ZIP)) rmSync(ZIP);
  // sem pasta dentro do zip: a Cloudflare espera o index.html na raiz
  const zip = zipDirectory(OUT, ZIP);
  console.log(`  ✔ ${ZIP}  (${zip.files} arquivos, ${mib(zip.bytes)})`);
}
console.log('  Próximo passo: pacotes/frontend/LEIA-ME.md\n');
