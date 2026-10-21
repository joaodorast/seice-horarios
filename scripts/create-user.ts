/**
 * Cria um usuário de acesso ao SEICE ou redefine a senha de um existente (encerrando as sessões abertas).
 *
 * Uso:
 *   npm run user:create -- <email> "<Nome exibido>"
 *
 * A senha é lida da variável SEICE_PASSWORD; sem ela, uma senha forte é gerada e exibida uma única vez.
 * A senha nunca é gravada em arquivo: o banco guarda apenas o hash (scrypt).
 */
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase } from '../server/db.js';
import { normalizeEmail, upsertUser } from '../server/auth.js';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
if (existsSync(join(root, '.env'))) process.loadEnvFile(join(root, '.env'));

const [email, name = 'Administração'] = process.argv.slice(2);
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error('\n  Uso: npm run user:create -- <email> "<Nome exibido>"\n');
  process.exit(1);
}
const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error('\n  ✗ DATABASE_URL não configurada no .env. Rode `npm run db:setup` primeiro.\n');
  process.exit(1);
}

const generated = !process.env.SEICE_PASSWORD;
const password = process.env.SEICE_PASSWORD ?? randomBytes(12).toString('base64url');
if (password.length < 8) {
  console.error('\n  ✗ A senha deve ter pelo menos 8 caracteres.\n');
  process.exit(1);
}

const db = await openDatabase(url);
const user = await upsertUser(db, email, name, password);
await db.close();

console.log(`\n  Usuário pronto: ${user.name} <${normalizeEmail(user.email)}>`);
if (generated) console.log(`  Senha gerada (anote agora, ela não será mostrada de novo): ${password}`);
console.log('');
