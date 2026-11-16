import { defineConfig } from 'vite';
import { resolve } from 'node:path';

const SERVER = 'http://127.0.0.1:3000';

export default defineConfig(({ mode }) => {
  // "npm run demo": demonstração autônoma (sem servidor), em arquivos estáticos na pasta dist-demo
  // "npm run sala": cena de demonstração da sala natalina 3D (sem servidor), na pasta dist-sala
  const sala = mode === 'sala';
  const demo = mode === 'demo' || sala;
  const input: Record<string, string> = sala
    ? { sala: resolve(__dirname, 'demo-sala.html') }
    : demo
      ? { demo: resolve(__dirname, 'demo.html') }
      : { jogo: resolve(__dirname, 'index.html'), painel: resolve(__dirname, 'painel.html') };
  return {
    base: demo ? './' : '/',
    publicDir: demo && !sala ? false : 'public',
    server: {
      host: '127.0.0.1',
      port: 5173,
      proxy: {
        '/ws': { target: SERVER.replace('http', 'ws'), ws: true },
        '/api': SERVER,
      },
    },
    build: {
      outDir: sala ? 'dist-sala' : demo ? 'dist-demo' : 'dist',
      chunkSizeWarningLimit: 2000,
      // Na demonstração as fontes vão embutidas no CSS e os arquivos têm nomes fixos,
      // para a página poder ser hospedada em qualquer lugar com poucos arquivos.
      assetsInlineLimit: demo ? 200_000 : 4096,
      rollupOptions: {
        input,
        output: demo
          ? { entryFileNames: 'assets/[name].js', chunkFileNames: 'assets/[name].js', assetFileNames: 'assets/[name][extname]' }
          : {},
      },
    },
  };
});
