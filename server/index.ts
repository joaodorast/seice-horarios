import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { openDatabase } from './db.js';
import { createApp } from './app.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envFile = join(root, '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error('\n  SEICE — DATABASE_URL não configurada.');
  console.error('  Crie o arquivo .env na pasta do projeto (veja .env.example) com a URL de conexão do Supabase.\n');
  process.exit(1);
}

const port = Number(process.env.PORT ?? 3333);

let db: Awaited<ReturnType<typeof openDatabase>>;
try {
  db = await openDatabase(url);
} catch (error) {
  console.error('\n  SEICE — não foi possível conectar ao banco de dados na nuvem.');
  console.error(`  ${(error as Error).message}`);
  console.error('  Confira a DATABASE_URL no arquivo .env e a conexão com a internet.\n');
  process.exit(1);
}

const { app } = createApp(db, { staticDir: join(root, 'dist') });
const host = (() => {
  try {
    return new URL(url).hostname;
  } catch {
    return 'banco configurado';
  }
})();

const server = app.listen(port, () => {
  console.log(`\n  SEICE — servidor ativo em http://localhost:${port}`);
  console.log(`  Banco de dados: Supabase (${host})\n`);
});

function shutdown() {
  server.close(() => {
    void db.close().finally(() => process.exit(0));
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
