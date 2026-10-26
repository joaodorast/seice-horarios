import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // Cada arquivo sobe um PostgreSQL em memória (PGlite), em paralelo; com a máquina ocupada isso pode passar de 30 s.
    hookTimeout: 60_000,
    testTimeout: 15_000,
  },
});
