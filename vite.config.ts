import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(new URL('./shared', import.meta.url)),
    },
  },
  build: {
    // O leitor de planilhas (ExcelJS) é grande, mas só é baixado quando alguém abre uma importação.
    chunkSizeWarningLimit: 1000,
  },
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:3333' },
  },
  preview: {
    proxy: { '/api': 'http://localhost:3333' },
  },
});
