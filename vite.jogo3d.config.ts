/**
 * Demonstração estática do JOGO 3D (sem servidor), em dist-jogo3d/.
 *
 *   npx vite build -c vite.jogo3d.config.ts
 *
 * O resultado é uma pasta que abre em qualquer hospedagem de arquivos estáticos (ou num servidor local simples):
 * - index.html é a página do jogo 3D (jogo3d.html) em modo demonstração: visitantes fictícios e a barra de botões
 *   (Entrar 1, Entrar 10, os quatro efeitos e Som). O modo vem do .env.demo (VITE_AUTONOMO=1), o mesmo da
 *   demonstração 2D: a página não tenta falar com servidor nenhum.
 * - Todos os caminhos são relativos (base './'): a pasta funciona em qualquer subendereço.
 * - Vão junto só os arquivos de public/ que o jogo 3D carrega de verdade (lista em vite.jogo3d.recursos.json,
 *   gerada por tools/listar-recursos-jogo3d.cjs), mais o public/assets/CREDITOS.md. O acervo não usado fica fora.
 *
 * Limites conferidos no fim da construção (a construção falha se algum for passado): cada arquivo abaixo de 15 MB,
 * o total abaixo de 60 MB e no máximo 200 arquivos.
 *
 * Este arquivo não mexe no vite.config.ts nem no package.json: é uma configuração à parte.
 */
import { defineConfig, type Plugin } from 'vite';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const RAIZ = __dirname;
const SAIDA = resolve(RAIZ, 'dist-jogo3d');
const PUBLICA = resolve(RAIZ, 'public');
const LISTA = resolve(RAIZ, 'vite.jogo3d.recursos.json');
const MB = 1024 * 1024;
const LIMITES = { arquivo: 15 * MB, total: 60 * MB, arquivos: 200 };

/** Copia só os recursos usados, troca jogo3d.html por index.html e confere os limites no fim. */
function demonstracaoJogo3d(): Plugin {
  return {
    name: 'demonstracao-jogo3d',
    enforce: 'post',
    generateBundle(_opcoes, bundle) {
      // a página do jogo sai como index.html (fica na mesma pasta, então os caminhos relativos continuam valendo)
      const pagina = bundle['jogo3d.html'];
      if (!pagina || pagina.type !== 'asset') this.error('a página jogo3d.html não saiu na construção');
      delete bundle['jogo3d.html'];
      this.emitFile({ type: 'asset', fileName: 'index.html', source: pagina.source });

      if (!existsSync(LISTA)) this.error('falta vite.jogo3d.recursos.json: rode node tools/listar-recursos-jogo3d.cjs com o laboratório ligado');
      const { arquivos } = JSON.parse(readFileSync(LISTA, 'utf8')) as { arquivos: string[] };
      for (const p of [...arquivos, 'assets/CREDITOS.md']) {
        const origem = resolve(PUBLICA, p);
        if (!origem.startsWith(PUBLICA + '/') && !origem.startsWith(PUBLICA + '\\')) this.error(`caminho fora de public/: ${p}`);
        if (!existsSync(origem)) this.error(`recurso da lista não existe em public/: ${p} (rode de novo tools/listar-recursos-jogo3d.cjs)`);
        this.emitFile({ type: 'asset', fileName: p, source: readFileSync(origem) });
      }
    },
    closeBundle() {
      const lista: Array<{ caminho: string; bytes: number }> = [];
      const andar = (pasta: string) => {
        for (const nome of readdirSync(pasta)) {
          const c = join(pasta, nome);
          if (statSync(c).isDirectory()) andar(c);
          else lista.push({ caminho: relative(SAIDA, c), bytes: statSync(c).size });
        }
      };
      if (!existsSync(SAIDA)) return;
      andar(SAIDA);
      const total = lista.reduce((s, a) => s + a.bytes, 0);
      const grandes = lista.filter((a) => a.bytes >= LIMITES.arquivo);
      const problemas: string[] = [];
      if (grandes.length) problemas.push(`arquivos com 15 MB ou mais: ${grandes.map((a) => a.caminho).join(', ')}`);
      if (total >= LIMITES.total) problemas.push(`total de ${(total / MB).toFixed(1)} MB (limite 60 MB)`);
      if (lista.length > LIMITES.arquivos) problemas.push(`${lista.length} arquivos (limite 200)`);
      console.log(`\n[jogo 3D estático] ${lista.length} arquivos, ${(total / MB).toFixed(1)} MB em ${relative(RAIZ, SAIDA)}/`);
      if (problemas.length) throw new Error(`a demonstração passou dos limites: ${problemas.join('; ')}`);
    },
  };
}

export default defineConfig({
  // o modo "demo" carrega o .env.demo (VITE_AUTONOMO=1): demonstração sem servidor
  mode: 'demo',
  base: './',
  // nada de copiar a pasta public inteira: o plugin acima copia só o que o jogo 3D usa
  publicDir: false,
  build: {
    outDir: SAIDA,
    emptyOutDir: true,
    chunkSizeWarningLimit: 3000,
    // fontes embutidas no CSS e nomes fixos: poucos arquivos, fácil de hospedar
    assetsInlineLimit: 200_000,
    rollupOptions: {
      input: { jogo3d: resolve(RAIZ, 'jogo3d.html') },
      output: { entryFileNames: 'app/[name].js', chunkFileNames: 'app/[name].js', assetFileNames: 'app/[name][extname]' },
    },
  },
  plugins: [demonstracaoJogo3d()],
});
