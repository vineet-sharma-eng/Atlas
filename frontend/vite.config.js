import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const frontendRoot = fileURLToPath(new URL('./', import.meta.url));
const apiTarget = process.env.VITE_API_PROXY_TARGET || 'http://localhost:5001';

export default defineConfig({
  root: frontendRoot,
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/finance': apiTarget,
      '/gym': apiTarget,
      '/health': apiTarget,
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
