import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // Cada arquivo sobe um PostgreSQL em memória (PGlite); em máquinas mais lentas isso passa de 10 s.
    hookTimeout: 30_000,
    testTimeout: 15_000,
  },
});
