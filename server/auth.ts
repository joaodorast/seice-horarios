import { createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type { Database, Row } from './db.js';

const scrypt = (password: string, salt: Buffer, keylen: number, options: ScryptOptions) =>
  new Promise<Buffer>((resolve, reject) => scryptCb(password, salt, keylen, options, (err, key) => (err ? reject(err) : resolve(key))));

// ------------------------------------------------------------------ Senhas

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

/** Gera o hash da senha no formato scrypt$N$r$p$sal$hash (nunca se guarda a senha em si). */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('base64url'), key.toString('base64url')].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, n, r, p, salt, hash] = stored.split('$');
  if (alg !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64url');
  const key = await scrypt(password, Buffer.from(salt, 'base64url'), expected.length, { N: Number(n), r: Number(r), p: Number(p) });
  return timingSafeEqual(key, expected);
}

/** Hash de uma senha aleatória: usado quando o e-mail não existe, para a resposta levar o mesmo tempo. */
let dummyHash: Promise<string> | undefined;

// ------------------------------------------------------------------ Usuários

export interface SessionUser {
  id: number;
  email: string;
  name: string;
}

interface UserRow extends SessionUser {
  passwordHash: string;
  sessionVersion: number;
  failedAttempts: number;
  lockedUntil: Date | null;
}

const toUser = (r: Row): UserRow => ({
  id: Number(r.id),
  email: String(r.email),
  name: String(r.name),
  passwordHash: String(r.password_hash),
  sessionVersion: Number(r.session_version),
  failedAttempts: Number(r.failed_attempts),
  lockedUntil: r.locked_until ? new Date(r.locked_until as string) : null,
});

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

/** Cria o usuário ou, se o e-mail já existir, troca nome e senha (e encerra as sessões abertas). */
export async function upsertUser(db: Database, email: string, name: string, password: string): Promise<SessionUser> {
  const hash = await hashPassword(password);
  const [r] = await db.query(
    `INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3)
     ON CONFLICT ((lower(email))) DO UPDATE
       SET name = excluded.name, password_hash = excluded.password_hash, session_version = users.session_version + 1,
           failed_attempts = 0, locked_until = NULL, updated_at = now()
     RETURNING *`,
    [normalizeEmail(email), name, hash],
  );
  const u = toUser(r);
  return { id: u.id, email: u.email, name: u.name };
}

// ------------------------------------------------------------------ Sessão (cookie assinado)

export const SESSION_COOKIE = 'seice_session';
const SESSION_HOURS = 12;
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

interface SessionPayload {
  u: number;
  v: number;
  e: number;
}

/** Segredo de assinatura das sessões: variável SESSION_SECRET ou, na falta dela, gerado uma vez e guardado no banco. */
async function loadSecret(db: Database): Promise<Buffer> {
  const fromEnv = process.env.SESSION_SECRET?.trim();
  if (fromEnv) return Buffer.from(fromEnv);
  await db.query("INSERT INTO app_config (key, value) VALUES ('session_secret', $1) ON CONFLICT (key) DO NOTHING", [
    randomBytes(32).toString('base64url'),
  ]);
  const [row] = await db.query<{ value: string }>("SELECT value FROM app_config WHERE key = 'session_secret'");
  return Buffer.from(row.value);
}

function readCookie(req: Request, name: string): string | undefined {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return undefined;
}

export class AuthError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export function createAuth(db: Database) {
  let secret: Promise<Buffer> | undefined;
  const getSecret = () => (secret ??= loadSecret(db).catch((error) => ((secret = undefined), Promise.reject(error))));

  const sign = async (data: string) => createHmac('sha256', await getSecret()).update(data).digest('base64url');

  async function issue(res: Response, req: Request, user: UserRow) {
    const payload: SessionPayload = { u: user.id, v: user.sessionVersion, e: Date.now() + SESSION_HOURS * 3600_000 };
    const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const value = `${data}.${await sign(data)}`;
    res.setHeader('Set-Cookie', cookie(req, value, SESSION_HOURS * 3600));
  }

  function cookie(req: Request, value: string, maxAge: number) {
    const secure = req.secure ? '; Secure' : '';
    return `${SESSION_COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
  }

  async function sessionUser(req: Request): Promise<SessionUser | null> {
    const raw = readCookie(req, SESSION_COOKIE);
    if (!raw) return null;
    const [data, mac] = raw.split('.');
    if (!data || !mac) return null;
    const expected = Buffer.from(await sign(data));
    const given = Buffer.from(mac);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
    let payload: SessionPayload;
    try {
      payload = JSON.parse(Buffer.from(data, 'base64url').toString());
    } catch {
      return null;
    }
    if (!payload.e || payload.e < Date.now()) return null;
    const [r] = await db.query('SELECT * FROM users WHERE id = $1', [payload.u]);
    if (!r) return null;
    const user = toUser(r);
    // Trocar a senha incrementa a versão e invalida as sessões antigas.
    if (user.sessionVersion !== payload.v) return null;
    return { id: user.id, email: user.email, name: user.name };
  }

  return {
    async login(req: Request, res: Response, email: string, password: string): Promise<SessionUser> {
      const [r] = await db.query('SELECT * FROM users WHERE lower(email) = $1', [normalizeEmail(email)]);
      const user = r ? toUser(r) : null;
      if (user?.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
        const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
        throw new AuthError(429, 'locked', `Acesso bloqueado por excesso de tentativas. Tente novamente em ${minutes} minuto(s).`);
      }
      const ok = await verifyPassword(password, user?.passwordHash ?? (await (dummyHash ??= hashPassword(randomBytes(16).toString('hex')))));
      if (!user || !ok) {
        if (user) {
          const attempts = user.failedAttempts + 1;
          const lock = attempts >= MAX_FAILED_ATTEMPTS;
          await db.query(
            `UPDATE users SET failed_attempts = $1, locked_until = ${lock ? `now() + interval '${LOCK_MINUTES} minutes'` : 'NULL'} WHERE id = $2`,
            [lock ? 0 : attempts, user.id],
          );
          if (lock) throw new AuthError(429, 'locked', `Acesso bloqueado por ${LOCK_MINUTES} minutos após ${MAX_FAILED_ATTEMPTS} tentativas incorretas.`);
        }
        throw new AuthError(401, 'invalid_credentials', 'E-mail ou senha incorretos.');
      }
      await db.query('UPDATE users SET failed_attempts = 0, locked_until = NULL, last_login_at = now() WHERE id = $1', [user.id]);
      await issue(res, req, user);
      return { id: user.id, email: user.email, name: user.name };
    },

    logout(req: Request, res: Response) {
      res.setHeader('Set-Cookie', cookie(req, '', 0));
    },

    sessionUser,

    /** Exige sessão válida em toda a API, exceto login, sessão atual e verificação de saúde. */
    middleware: async (req: Request, res: Response, next: NextFunction) => {
      if (req.path === '/health' || req.path.startsWith('/auth/')) return next();
      try {
        const user = await sessionUser(req);
        if (!user) {
          res.status(401).json({ error: { code: 'unauthorized', message: 'Sua sessão expirou. Entre novamente.' } });
          return;
        }
        res.locals.user = user;
        next();
      } catch (error) {
        next(error);
      }
    },
  };
}

/**
 * Proteção contra requisições de outros sites: alterações só são aceitas quando a origem
 * informada pelo navegador é o próprio sistema.
 */
export function sameOriginGuard(req: Request, res: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.headers.origin;
  if (origin) {
    let host: string;
    try {
      host = new URL(origin).host;
    } catch {
      host = '';
    }
    // Atrás de proxy (Vercel ou o servidor de desenvolvimento do Vite), o endereço original vem em X-Forwarded-Host.
    const forwarded = String(req.headers['x-forwarded-host'] ?? '').split(',')[0].trim();
    if (host !== req.headers.host && host !== forwarded) {
      res.status(403).json({ error: { code: 'forbidden_origin', message: 'Requisição recusada: origem não autorizada.' } });
      return;
    }
  }
  next();
}
