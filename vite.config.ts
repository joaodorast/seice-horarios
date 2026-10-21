import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

/** Identificador da versão publicada: o commit na Vercel ou o horário do build. */
const appVersion = (process.env.VERCEL_GIT_COMMIT_SHA ?? Date.now().toString(36)).slice(0, 12);

/** Publica /version.json, consultado pelo sistema aberto para saber quando há versão nova. */
function versionFile(): Plugin {
  return {
    name: 'seice-version',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version: appVersion }) });
    },
  };
}

/** Endereço da API local (configurável para rodar mais de uma cópia do sistema ao mesmo tempo). */
const apiTarget = process.env.SEICE_API_URL ?? 'http://localhost:3333';

export default defineConfig({
  plugins: [react(), tailwindcss(), versionFile()],
  define: { __APP_VERSION__: JSON.stringify(appVersion) },
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
    // changeOrigin desligado: a API recebe o mesmo endereço que o navegador usa (necessário para a
    // proteção contra requisições de outros sites e para o cookie de sessão).
    proxy: { '/api': { target: apiTarget, changeOrigin: false, xfwd: true } },
  },
  preview: {
    proxy: { '/api': { target: apiTarget, changeOrigin: false, xfwd: true } },
  },
});
