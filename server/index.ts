import './silence-warnings';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { openDatabase } from './db';
import { createApp } from './app';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dbFile = process.env.SEICE_DB ? resolve(process.env.SEICE_DB) : join(root, 'data', 'seice.db');
const port = Number(process.env.PORT ?? 3333);

const db = openDatabase(dbFile);
const { app } = createApp(db, { staticDir: join(root, 'dist') });

const server = app.listen(port, () => {
  console.log(`\n  SEICE — servidor ativo em http://localhost:${port}`);
  console.log(`  Banco de dados: ${dbFile}\n`);
});

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
