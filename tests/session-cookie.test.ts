import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestServer, ADMIN, type TestServer } from './helpers.js';

describe('cookie de sessão com nome próprio (ambiente de teste no mesmo computador)', () => {
  let server: TestServer;

  beforeAll(async () => {
    process.env.SESSION_COOKIE_NAME = 'seice_teste_session';
    server = await startTestServer();
  });

  afterAll(async () => {
    delete process.env.SESSION_COOKIE_NAME;
    await server.close();
  });

  it('usa o nome configurado e ignora o cookie do sistema real', async () => {
    const login = await server.anonymous('POST', '/auth/login', { email: ADMIN.email, password: ADMIN.password, remember: true });
    const setCookie = login.headers.get('set-cookie') ?? '';
    expect(setCookie.startsWith('seice_teste_session=')).toBe(true);
    expect(setCookie).toContain('Max-Age=2592000');
    const value = setCookie.split(';')[0].split('=').slice(1).join('=');

    const ok = await server.anonymous('GET', '/auth/me', undefined, { Cookie: `seice_teste_session=${value}` });
    expect(ok.status).toBe(200);
    const other = await server.anonymous('GET', '/auth/me', undefined, { Cookie: `seice_session=${value}` });
    expect(other.status).toBe(401);
  });
});
