import { defineConfig } from 'vite';
import { resolve } from 'node:path';

const SERVER = 'http://127.0.0.1:3000';

export default defineConfig(({ mode }) => {
  // "npm run demo": demonstração autônoma (sem servidor), em arquivos estáticos na pasta dist-demo
  // "npm run sala": cena de demonstração da sala natalina 3D (sem servidor), na pasta dist-sala
  // Sem modo (npm start, npm run build): a tela da live em 3D (index.html), a versão clássica 2D (classico.html),
  // o painel e a cópia de public/ (modelos, texturas e áudios), na pasta dist servida pelo servidor na porta 3000.
  const sala = mode === 'sala';
  const demo = mode === 'demo' || sala;
  const input: Record<string, string> = sala
    ? { sala: resolve(__dirname, 'demo-sala.html') }
    : demo
      ? { demo: resolve(__dirname, 'demo.html') }
      : {
          // tela principal da live: o jogo 3D (index.html); jogo3d.html é a mesma página com o endereço antigo
          jogo: resolve(__dirname, 'index.html'),
          jogo3d: resolve(__dirname, 'jogo3d.html'),
          // versão clássica (2D, Phaser), que continua funcionando
          classico: resolve(__dirname, 'classico.html'),
          painel: resolve(__dirname, 'painel.html'),
        };
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
      // o código compilado vai para /app (nomes com código de versão, guardados em cache por um ano);
      // /assets fica só para a arte de public/assets (modelos e texturas, nomes fixos)
      assetsDir: demo ? 'assets' : 'app',
      chunkSizeWarningLimit: 3000,
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
