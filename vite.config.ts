import { defineConfig } from 'vite';

// Le client est servi par Vite en dev (port 5173) et le WebSocket est proxifié
// vers le serveur de jeu (port 3000). En prod, le serveur sert directement dist/.
export default defineConfig({
  root: 'src/client',
  publicDir: false,
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/ws': { target: 'ws://localhost:3000', ws: true },
    },
  },
});
