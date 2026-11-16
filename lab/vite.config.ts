import { defineConfig } from 'vite';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, normalize, resolve } from 'node:path';

const TIPOS: Record<string, string> = { '.glb': 'model/gltf-binary', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.hdr': 'application/octet-stream', '.md': 'text/markdown' };
const PUBLICA = resolve(__dirname, '..', 'public');

// Servidor do laboratório 3D (npm run lab): serve o projeto inteiro em http://127.0.0.1:5180
// sem pré-empacotar dependências, para que as capturas de tela sejam sempre reprodutíveis.
export default defineConfig({
  root: resolve(__dirname, '..'),
  publicDir: 'public',
  server: {
    host: '127.0.0.1',
    port: 5180,
    strictPort: true,
    hmr: false,
    watch: { ignored: ['**/fotos/**', '**/*.png', '**/*.md', '**/dist/**', '**/dist-demo/**', '**/data/**', '**/assets-src/**', '**/public/**', '**/dist-sala/**'] },
  },
  plugins: [
    {
      // Serve public/assets direto do disco: recursos baixados com o servidor ligado aparecem na hora
      // (o Vite só conhece os arquivos de public/ que existiam quando ele iniciou).
      name: 'lab-assets-ao-vivo',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const url = decodeURIComponent((req.url || '').split('?')[0]);
          if (!url.startsWith('/assets/')) return next();
          const file = normalize(resolve(PUBLICA, `.${url}`));
          if (!file.startsWith(PUBLICA) || !existsSync(file) || !statSync(file).isFile()) return next();
          res.setHeader('Content-Type', TIPOS[extname(file).toLowerCase()] || 'application/octet-stream');
          res.setHeader('Cache-Control', 'no-cache');
          createReadStream(file).pipe(res);
        });
      },
    },
  ],
  optimizeDeps: { noDiscovery: true, include: [] },
  appType: 'mpa',
});
