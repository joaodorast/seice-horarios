import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { PGlite } from '@electric-sql/pglite';
import { prepareDatabase, SCHEMA, type Database, type Row } from '../server/db.js';
import { createApp } from '../server/app.js';
import { upsertUser } from '../server/auth.js';

/** PostgreSQL descartável em memória (PGlite) com o mesmo esquema e migrações da nuvem. */
export async function openTestDatabase(): Promise<Database> {
  const pglite = await PGlite.create();
  await pglite.exec(`CREATE SCHEMA IF NOT EXISTS ${SCHEMA}; SET search_path TO ${SCHEMA};`);
  type Runner = Pick<typeof pglite, 'query' | 'exec'>;
  const wrap = (runner: Runner): Database => ({
    kind: 'embedded',
    async query<T extends Row>(text: string, params?: unknown[]) {
      return (await runner.query<T>(text, params)).rows;
    },
    async exec(sql: string) {
      await runner.exec(sql);
    },
    transaction: () => {
      throw new Error('Transações aninhadas não são suportadas.');
    },
    close: async () => undefined,
  });
  return prepareDatabase({
    ...wrap(pglite),
    transaction: (fn) => pglite.transaction((tx) => fn(wrap(tx))),
    close: () => pglite.close(),
  });
}

export const ADMIN = { email: 'admin@teste.com', password: 'senha-de-teste-123', name: 'Administração' };

export interface TestServer {
  db: Database;
  base: string;
  /** Chamada autenticada à API (com o cookie de sessão do administrador). */
  call: (method: string, path: string, body?: unknown, headers?: Record<string, string>) => Promise<{ status: number; body: any; headers: Headers }>;
  /** Chamada sem sessão. */
  anonymous: TestServer['call'];
  close: () => Promise<void>;
}

export async function startTestServer(): Promise<TestServer> {
  const db = await openTestDatabase();
  await upsertUser(db, ADMIN.email, ADMIN.name, ADMIN.password);
  const server: Server = createApp(db).app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;

  const request = (cookie?: string): TestServer['call'] => async (method, path, body, headers = {}) => {
    const res = await fetch(base + path, {
      method,
      headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...headers },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null, headers: res.headers };
  };

  const anonymous = request();
  const login = await anonymous('POST', '/auth/login', { email: ADMIN.email, password: ADMIN.password });
  const cookie = login.headers.get('set-cookie')?.split(';')[0];
  if (login.status !== 200 || !cookie) throw new Error('Falha ao autenticar o administrador de teste.');

  return {
    db,
    base,
    call: request(cookie),
    anonymous,
    close: async () => {
      server.close();
      await db.close();
    },
  };
}
