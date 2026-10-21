/**
 * Prepara o banco do SEICE no Supabase, de ponta a ponta:
 *   1. usa o projeto indicado em SUPABASE_PROJECT_REF (pode ser compartilhado com outro sistema)
 *      ou cria o projeto "seice-horarios" na organização do token;
 *   2. aguarda o banco ficar disponível;
 *   3. cria o schema "seice" e o usuário exclusivo da aplicação, com acesso só a esse schema
 *      e limite de conexões, sem alterar nada fora dele;
 *   4. grava a DATABASE_URL (Session pooler) no arquivo .env, aplica as migrações e
 *      confere que o usuário da aplicação não enxerga nenhuma tabela de outro sistema.
 *
 * Uso: preencha SUPABASE_ACCESS_TOKEN (e, opcionalmente, SUPABASE_PROJECT_REF) no .env e rode `npm run db:setup`.
 * Pode ser executado de novo com segurança: etapas já feitas são reaproveitadas.
 */
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase, SCHEMA } from '../server/db';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const envFile = join(root, '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

const PROJECT_NAME = process.env.SUPABASE_PROJECT_NAME ?? 'seice-horarios';
const REGION = process.env.SUPABASE_REGION ?? 'sa-east-1';
const APP_ROLE = 'seice_app';
/** Teto de conexões do usuário da aplicação: preserva as conexões de outros sistemas no mesmo banco. */
const CONNECTION_LIMIT = 5;
const API = 'https://api.supabase.com/v1';
const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();

function fail(message: string): never {
  console.error(`\n  ✗ ${message}\n`);
  process.exit(1);
}

if (!token) fail('Preencha SUPABASE_ACCESS_TOKEN no arquivo .env (gere em https://supabase.com/dashboard/account/tokens).');

async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(API + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(data?.message ?? `${method} ${path} → HTTP ${res.status}`);
  return data as T;
}

const sql = <T = Record<string, unknown>>(ref: string, query: string) => api<T[]>('POST', `/projects/${ref}/database/query`, { query });

const secret = (bytes = 24) => randomBytes(bytes).toString('base64url');

function setEnv(values: Record<string, string>) {
  let text = existsSync(envFile) ? readFileSync(envFile, 'utf8') : '';
  for (const [key, value] of Object.entries(values)) {
    const pattern = new RegExp(`^${key}=.*$`, 'm');
    const line = `${key}=${value}`;
    text = pattern.test(text) ? text.replace(pattern, line) : `${text.trimEnd()}\n${line}\n`;
  }
  writeFileSync(envFile, text);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Project {
  id: string;
  name: string;
  status: string;
  organization_id: string;
}

async function resolveProject(): Promise<Project> {
  const ref = process.env.SUPABASE_PROJECT_REF?.trim();
  if (ref) {
    // Projeto existente (possivelmente de outro sistema): nunca é criado, reativado ou reconfigurado aqui.
    const project = await api<Project>('GET', `/projects/${ref}`);
    console.log(`\n  Usando o projeto existente "${project.name}" (${project.id}).`);
    if (project.status !== 'ACTIVE_HEALTHY') fail(`O projeto não está ativo (status: ${project.status}). Ative-o no painel do Supabase.`);
    return project;
  }

  const orgs = await api<{ id: string; name: string }[]>('GET', '/organizations');
  const org = process.env.SUPABASE_ORG_ID ? orgs.find((o) => o.id === process.env.SUPABASE_ORG_ID) : orgs[0];
  if (!org) fail('Nenhuma organização encontrada para este token.');
  console.log(`\n  Organização: ${org.name}`);

  let project = (await api<Project[]>('GET', '/projects')).find((p) => p.name === PROJECT_NAME && p.organization_id === org.id);
  if (!project) {
    const adminPassword = process.env.SUPABASE_DB_PASSWORD || secret();
    setEnv({ SUPABASE_DB_PASSWORD: adminPassword });
    console.log(`  Criando o projeto "${PROJECT_NAME}" em ${REGION}…`);
    project = await api<Project>('POST', '/projects', { name: PROJECT_NAME, organization_id: org.id, region: REGION, db_pass: adminPassword });
  } else console.log(`  Projeto "${PROJECT_NAME}" já existe (${project.id}).`);

  if (project.status === 'INACTIVE') {
    console.log('  O projeto está pausado; reativando…');
    await api('POST', `/projects/${project.id}/restore`);
  }

  process.stdout.write('  Aguardando o banco ficar disponível');
  for (let i = 0; ; i++) {
    const p = await api<Project>('GET', `/projects/${project.id}`);
    if (p.status === 'ACTIVE_HEALTHY') break;
    if (i > 120) fail(`O projeto não ficou disponível a tempo (status: ${p.status}). Rode o comando de novo em alguns minutos.`);
    process.stdout.write('.');
    await sleep(5000);
  }
  console.log(' pronto.');
  return project;
}

async function main() {
  const project = await resolveProject();

  // Usuário exclusivo da aplicação: dono apenas do schema "seice". Nada fora desse schema é criado ou alterado.
  const appPassword = secret();
  await sql(
    project.id,
    `DO $$
     BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${APP_ROLE}') THEN
         CREATE ROLE ${APP_ROLE} LOGIN NOINHERIT CONNECTION LIMIT ${CONNECTION_LIMIT} PASSWORD '${appPassword}';
       ELSE
         ALTER ROLE ${APP_ROLE} LOGIN NOINHERIT CONNECTION LIMIT ${CONNECTION_LIMIT} PASSWORD '${appPassword}';
       END IF;
     END $$;
     -- No PostgreSQL 16+, quem cria um usuário precisa ser membro dele para lhe passar a posse de objetos.
     GRANT ${APP_ROLE} TO postgres;
     CREATE SCHEMA IF NOT EXISTS ${SCHEMA} AUTHORIZATION ${APP_ROLE};
     ALTER ROLE ${APP_ROLE} SET search_path = ${SCHEMA};
     ALTER ROLE ${APP_ROLE} SET statement_timeout = '30s';
     ALTER ROLE ${APP_ROLE} SET idle_in_transaction_session_timeout = '60s';`,
  );
  console.log(`  Usuário "${APP_ROLE}" configurado: schema "${SCHEMA}", até ${CONNECTION_LIMIT} conexões, consultas de no máximo 30 s.`);

  const poolers = await api<{ db_host: string; db_name: string; database_type: string }[]>('GET', `/projects/${project.id}/config/database/pooler`);
  const pooler = poolers.find((p) => p.database_type === 'PRIMARY') ?? poolers[0];
  if (!pooler) fail('Não foi possível obter o endereço do pooler do Supabase.');
  // Session pooler (porta 5432): conexões persistentes do servidor, compatível com IPv4.
  const url = `postgresql://${APP_ROLE}.${project.id}:${encodeURIComponent(appPassword)}@${pooler.db_host}:5432/${pooler.db_name || 'postgres'}`;
  setEnv({ DATABASE_URL: url, SUPABASE_PROJECT_REF: project.id });
  console.log(`  DATABASE_URL gravada no .env (${pooler.db_host}).`);

  // O pooler pode levar alguns segundos para reconhecer um usuário novo ou uma senha nova.
  for (let attempt = 1; ; attempt++) {
    try {
      const db = await openDatabase(url);
      const [{ n }] = await db.query<{ n: string }>('SELECT COUNT(*) AS n FROM schema_migrations');
      await db.close();
      console.log(`  Migrações aplicadas (${n}).`);
      break;
    } catch (error) {
      if (attempt >= 12) fail(`Não foi possível conectar com o usuário da aplicação: ${(error as Error).message}`);
      await sleep(5000);
    }
  }

  // Conferência de isolamento: o usuário da aplicação não pode ler nem alterar tabelas de outros schemas.
  const leaks = await sql<{ tabela: string }>(
    project.id,
    `SELECT n.nspname || '.' || c.relname AS tabela
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind IN ('r', 'p', 'v', 'm', 'f')
        AND n.nspname NOT IN ('${SCHEMA}', 'pg_catalog', 'information_schema')
        -- Estatísticas de desempenho do Supabase, legíveis por qualquer usuário; não contêm dados de sistemas.
        AND c.relname NOT IN ('pg_stat_statements', 'pg_stat_statements_info')
        AND has_table_privilege('${APP_ROLE}', c.oid, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE')
      ORDER BY 1`,
  );
  if (leaks.length) {
    console.warn(`  ⚠ O usuário "${APP_ROLE}" tem acesso a ${leaks.length} tabela(s) fora do schema "${SCHEMA}" por permissões públicas:`);
    for (const l of leaks) console.warn(`    - ${l.tabela}`);
  } else console.log(`  Isolamento conferido: "${APP_ROLE}" não acessa nenhuma tabela fora do schema "${SCHEMA}".`);

  console.log(`\n  Banco pronto! Painel: https://supabase.com/dashboard/project/${project.id}/editor  (schema "${SCHEMA}")`);
  console.log('  Inicie o sistema com: npm run dev\n');
}

main().catch((error) => fail((error as Error).message));
