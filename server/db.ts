import { MIGRATIONS } from './migrations.js';

export type Row = Record<string, unknown>;

/**
 * Interface mínima de acesso ao PostgreSQL usada pelo repositório.
 * Em uso real, o banco é sempre o Supabase (via `pg`). Os testes usam um PostgreSQL em memória
 * (PGlite, ver tests/helpers.ts) com o mesmo SQL, sem tocar na nuvem.
 */
export interface Database {
  query<T extends Row = Row>(text: string, params?: unknown[]): Promise<T[]>;
  /** Executa vários comandos SQL de uma vez (sem parâmetros). */
  exec(sql: string): Promise<void>;
  /** Executa `fn` numa transação: confirma se terminar sem erro, desfaz se lançar. */
  transaction<T>(fn: (tx: Database) => Promise<T>): Promise<T>;
  close(): Promise<void>;
  readonly kind: 'cloud' | 'embedded';
}

/** Schema dedicado: isola as tabelas do sistema e as mantém fora da API pública do Supabase. */
export const SCHEMA = 'seice';

/**
 * Chave do bloqueio que serializa gravações de aulas, para que duas gravações simultâneas não criem conflito.
 * Valor exclusivo do SEICE (0x5E1CE000 + 1), para não coincidir com bloqueios de outros sistemas no mesmo banco.
 */
export const LESSON_LOCK_KEY = 1_578_950_657;

// ---------------------------------------------------------------- Nuvem (Supabase / PostgreSQL)

/** Falhas de conexão que costumam se resolver na tentativa seguinte. */
function isTransientError(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code ?? '';
  return (
    ['ECONNRESET', 'ETIMEDOUT', 'EPIPE', '57P01', '08006', '08003', '08000'].includes(code) ||
    (error instanceof Error && /Connection terminated|connection timeout|Client has encountered a connection error/i.test(error.message))
  );
}

async function openCloud(url: string): Promise<Database> {
  const { default: pg } = await import('pg');
  const local = /@(localhost|127\.0\.0\.1)(:|\/)/.test(url);
  const serverless = Boolean(process.env.VERCEL);
  const pool = new pg.Pool({
    connectionString: url,
    // O Supabase exige conexão criptografada; o certificado do pooler é emitido pela CA própria do Supabase.
    ssl: local ? undefined : { rejectUnauthorized: false },
    // Abaixo do limite de conexões do usuário no banco (5), para conviver com outros sistemas no mesmo projeto.
    // Na Vercel cada instância da função atende poucas requisições por vez e o pooler do Supabase
    // (modo transação, porta 6543) multiplexa as conexões entre as instâncias.
    max: Number(process.env.SEICE_DB_POOL ?? (serverless ? 2 : 4)),
    idleTimeoutMillis: serverless ? 10_000 : 30_000,
    connectionTimeoutMillis: 15_000,
    application_name: 'seice-horarios',
    // Todas as conexões enxergam apenas o schema do SEICE.
    options: `-c search_path=${SCHEMA}`,
  });
  pool.on('error', (error) => console.error('[SEICE] Conexão com o banco interrompida:', error.message));

  const wrap = (runner: { query: (text: string, params?: unknown[]) => Promise<{ rows: Row[] }> }): Database => {
    // Uma conexão executa um comando por vez: consultas disparadas em paralelo na mesma transação entram em fila.
    let queue: Promise<unknown> = Promise.resolve();
    const run = (text: string, params?: unknown[]) => {
      const next = queue.then(() => runner.query(text, params));
      queue = next.catch(() => undefined);
      return next;
    };
    return {
      kind: 'cloud',
      async query<T extends Row>(text: string, params?: unknown[]) {
        return (await run(text, params)).rows as T[];
      },
      async exec(sql: string) {
        await run(sql);
      },
      transaction: () => {
        throw new Error('Transações aninhadas não são suportadas.');
      },
      close: async () => undefined,
    };
  };

  const db: Database = {
    ...wrapPool(),
    async transaction<T>(fn: (tx: Database) => Promise<T>) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await fn(wrap(client));
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
  return db;

  /**
   * Fora de transações, cada consulta usa qualquer conexão livre do pool (sem fila).
   * Leituras são repetidas uma vez se a conexão cair (ex.: conexão ociosa encerrada pelo pooler);
   * gravações nunca são repetidas, para não correr o risco de aplicá-las duas vezes.
   */
  function wrapPool(): Database {
    return {
      kind: 'cloud',
      async query<T extends Row>(text: string, params?: unknown[]) {
        try {
          return (await pool.query(text, params)).rows as T[];
        } catch (error) {
          if (!/^\s*(select|with)\b/i.test(text) || !isTransientError(error)) throw error;
          return (await pool.query(text, params)).rows as T[];
        }
      },
      async exec(sql: string) {
        await pool.query(sql);
      },
      transaction: () => {
        throw new Error('Use db.transaction.');
      },
      close: async () => undefined,
    };
  }
}

// ---------------------------------------------------------------- Abertura e migrações

/**
 * Conecta ao Supabase pela URL PostgreSQL. Por padrão aplica as migrações pendentes; nas funções
 * serverless (Vercel) isso é dispensado, pois as migrações são aplicadas uma vez com `npm run db:migrate`.
 */
export async function openDatabase(url: string, options: { migrate?: boolean } = {}): Promise<Database> {
  const db = await openCloud(url);
  if (options.migrate === false) return db;
  return prepareDatabase(db);
}

/** Aplica as migrações pendentes; fecha a conexão se algo falhar. */
export async function prepareDatabase(db: Database): Promise<Database> {
  try {
    await migrate(db);
  } catch (error) {
    await db.close().catch(() => undefined);
    throw error;
  }
  return db;
}

async function migrate(db: Database) {
  const [schema] = await db.query<{ ok: boolean }>('SELECT to_regnamespace($1) IS NOT NULL AS ok', [SCHEMA]);
  if (!schema.ok) await db.exec(`CREATE SCHEMA ${SCHEMA}`);

  await db.transaction(async (tx) => {
    // Impede que duas instâncias do servidor apliquem a mesma migração ao mesmo tempo.
    await tx.query('SELECT pg_advisory_xact_lock($1)', [LESSON_LOCK_KEY + 1]);
    await tx.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version     integer PRIMARY KEY,
        name        text NOT NULL,
        applied_at  timestamptz NOT NULL DEFAULT now()
      )`);
    const applied = new Set((await tx.query<{ version: number }>('SELECT version FROM schema_migrations')).map((r) => r.version));
    for (const migration of MIGRATIONS) {
      if (applied.has(migration.version)) continue;
      await tx.exec(migration.sql);
      await tx.query('INSERT INTO schema_migrations (version, name) VALUES ($1, $2)', [migration.version, migration.name]);
    }
  });
}
