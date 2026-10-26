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

/** Erros que não se resolvem tentando de novo (credenciais ou banco inexistente). */
const PERMANENT = new Set(['28P01', '28000', '3D000', 'ENOTFOUND']);
const MAX_ATTEMPTS = 12;

/**
 * Conecta ao banco na nuvem tentando de novo em falhas passageiras (rede oscilando, pooler ocupado),
 * com espera crescente de 2 s a 15 s, por cerca de 2 minutos no total.
 */
async function connect(databaseUrl: string) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await openDatabase(databaseUrl);
    } catch (error) {
      const code = (error as { code?: string }).code ?? '';
      const last = attempt >= MAX_ATTEMPTS || PERMANENT.has(code);
      console.error(`\n  SEICE — não foi possível conectar ao banco de dados (tentativa ${attempt}): ${(error as Error).message}`);
      if (last) {
        console.error('  Confira a DATABASE_URL no arquivo .env e a conexão com a internet.\n');
        process.exit(1);
      }
      const wait = Math.min(2000 * 1.5 ** (attempt - 1), 15_000);
      console.error(`  Tentando de novo em ${Math.round(wait / 1000)} s…`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}

const db = await connect(url);

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
