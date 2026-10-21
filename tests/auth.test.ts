import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ADMIN, startTestServer, type TestServer } from './helpers.js';
import { hashPassword, upsertUser, verifyPassword } from '../server/auth.js';

describe('autenticação', () => {
  let server: TestServer;

  beforeAll(async () => {
    server = await startTestServer();
  });

  afterAll(() => server.close());

  it('guarda apenas o hash da senha', async () => {
    const hash = await hashPassword('minha senha');
    expect(hash).not.toContain('minha senha');
    expect(await verifyPassword('minha senha', hash)).toBe(true);
    expect(await verifyPassword('outra', hash)).toBe(false);
    const [row] = await server.db.query<{ password_hash: string }>('SELECT password_hash FROM users');
    expect(row.password_hash.startsWith('scrypt$')).toBe(true);
  });

  it('exige sessão em toda a API, exceto saúde e login', async () => {
    expect((await server.anonymous('GET', '/teachers')).status).toBe(401);
    expect((await server.anonymous('POST', '/import/teachers', { rows: [] })).status).toBe(401);
    expect((await server.anonymous('GET', '/auth/me')).status).toBe(401);
    expect((await server.anonymous('GET', '/health')).status).toBe(200);
    expect((await server.call('GET', '/teachers')).status).toBe(200);
    expect((await server.call('GET', '/auth/me')).body.user.email).toBe(ADMIN.email);
  });

  it('não diferencia e-mail inexistente de senha errada', async () => {
    const wrong = await server.anonymous('POST', '/auth/login', { email: ADMIN.email, password: 'errada' });
    const unknown = await server.anonymous('POST', '/auth/login', { email: 'ninguem@teste.com', password: 'errada' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error.message).toBe(unknown.body.error.message);
  });

  it('aceita o e-mail com maiúsculas e espaços e emite cookie HttpOnly', async () => {
    const res = await server.anonymous('POST', '/auth/login', { email: `  ${ADMIN.email.toUpperCase()} `, password: ADMIN.password });
    expect(res.status).toBe(200);
    const cookie = res.headers.get('set-cookie') ?? '';
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
  });

  it('recusa cookie adulterado', async () => {
    const res = await server.anonymous('POST', '/auth/login', { email: ADMIN.email, password: ADMIN.password });
    const cookie = res.headers.get('set-cookie')!.split(';')[0];
    const [name, value] = cookie.split('=');
    const [data, mac] = decodeURIComponent(value).split('.');
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(data, 'base64url').toString()), u: 999 })).toString('base64url');
    const r = await server.anonymous('GET', '/teachers', undefined, { Cookie: `${name}=${encodeURIComponent(`${forged}.${mac}`)}` });
    expect(r.status).toBe(401);
  });

  it('recusa alterações vindas de outro site', async () => {
    const r = await server.call('POST', '/teachers', { name: 'Fulano de Tal' }, { Origin: 'https://site-malicioso.com' });
    expect(r.status).toBe(403);
  });

  it('aceita a origem repassada por proxy (servidor de desenvolvimento e Vercel)', async () => {
    const r = await server.anonymous('POST', '/auth/login', { email: ADMIN.email, password: ADMIN.password }, {
      Origin: 'http://localhost:5173',
      'X-Forwarded-Host': 'localhost:5173',
    });
    expect(r.status).toBe(200);
  });

  it('trocar a senha encerra as sessões abertas', async () => {
    await upsertUser(server.db, 'outro@teste.com', 'Outro', 'senha-antiga-1');
    const login = await server.anonymous('POST', '/auth/login', { email: 'outro@teste.com', password: 'senha-antiga-1' });
    const cookie = login.headers.get('set-cookie')!.split(';')[0];
    expect((await server.anonymous('GET', '/auth/me', undefined, { Cookie: cookie })).status).toBe(200);
    await upsertUser(server.db, 'outro@teste.com', 'Outro', 'senha-nova-2');
    expect((await server.anonymous('GET', '/auth/me', undefined, { Cookie: cookie })).status).toBe(401);
  });

  it('bloqueia após 5 tentativas erradas, mesmo com a senha certa depois', async () => {
    await upsertUser(server.db, 'alvo@teste.com', 'Alvo', 'senha-correta-9');
    const attempt = (password: string) => server.anonymous('POST', '/auth/login', { email: 'alvo@teste.com', password });
    for (let i = 0; i < 4; i++) expect((await attempt('x')).status).toBe(401);
    expect((await attempt('x')).status).toBe(429);
    const blocked = await attempt('senha-correta-9');
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.message).toMatch(/bloqueado/);
  });

  it('logout apaga o cookie', async () => {
    const r = await server.call('POST', '/auth/logout');
    expect(r.status).toBe(204);
    expect(r.headers.get('set-cookie')).toMatch(/Max-Age=0/);
  });
});
