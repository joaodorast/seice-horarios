/**
 * Aplica as migrações pendentes no banco da DATABASE_URL.
 * Uso: `npm run db:migrate` (necessário antes de publicar uma versão com migrações novas na Vercel).
 */
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase } from '../server/db.js';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
if (existsSync(join(root, '.env'))) process.loadEnvFile(join(root, '.env'));

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error('\n  ✗ DATABASE_URL não configurada no .env. Rode `npm run db:setup` primeiro.\n');
  process.exit(1);
}

const db = await openDatabase(url);
const rows = await db.query<{ version: number; name: string; applied_at: Date }>('SELECT version, name, applied_at FROM schema_migrations ORDER BY version');
await db.close();
console.log('\n  Migrações aplicadas:');
for (const r of rows) console.log(`    ${r.version}. ${r.name}  (${new Date(r.applied_at).toLocaleString('pt-BR')})`);
console.log('');
