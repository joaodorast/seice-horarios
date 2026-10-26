import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestServer, type TestServer } from './helpers.js';

/** PNG válido de 1×1 pixel. */
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
const dataUrl = (mime: string, bytes: Buffer) => `data:${mime};base64,${bytes.toString('base64')}`;

describe('fotos dos professores', () => {
  let server: TestServer;
  let teacherId: number;

  beforeAll(async () => {
    server = await startTestServer();
    teacherId = (await server.call('POST', '/teachers', { name: 'Professora Foto' })).body.id;
  });

  afterAll(() => server.close());

  it('começa sem foto', async () => {
    const t = (await server.call('GET', `/teachers/${teacherId}`)).body;
    expect(t.photoUpdatedAt).toBeNull();
    expect((await server.call('GET', `/teachers/${teacherId}/photo`)).status).toBe(404);
  });

  it('recebe a foto, devolve a imagem e informa a data na lista', async () => {
    const saved = await server.call('PUT', `/teachers/${teacherId}/photo`, { dataUrl: dataUrl('image/png', PNG) });
    expect(saved.status).toBe(200);
    expect(saved.body.photoUpdatedAt).toBeTruthy();

    const res = await fetch(`${server.base}/teachers/${teacherId}/photo?v=1`, { headers: { Cookie: await sessionCookie(server) } });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
    expect(res.headers.get('cache-control')).toMatch(/immutable/);
    expect(Buffer.from(await res.arrayBuffer()).equals(PNG)).toBe(true);

    const list = (await server.call('GET', '/teachers')).body as { id: number; photoUpdatedAt: string | null }[];
    expect(list.find((t) => t.id === teacherId)?.photoUpdatedAt).toBe(saved.body.photoUpdatedAt);
  });

  it('recusa arquivos que não são imagens de verdade ou grandes demais', async () => {
    const fake = await server.call('PUT', `/teachers/${teacherId}/photo`, { dataUrl: dataUrl('image/png', Buffer.from('não sou uma imagem')) });
    expect(fake.status).toBe(422);
    expect((await server.call('PUT', `/teachers/${teacherId}/photo`, { dataUrl: 'data:text/html;base64,PGgxPg==' })).status).toBe(422);
    const huge = Buffer.concat([PNG, Buffer.alloc(310_000)]);
    expect((await server.call('PUT', `/teachers/${teacherId}/photo`, { dataUrl: dataUrl('image/png', huge) })).status).toBe(413);
  });

  it('exige login para ver ou enviar fotos', async () => {
    expect((await server.anonymous('GET', `/teachers/${teacherId}/photo`)).status).toBe(401);
    expect((await server.anonymous('PUT', `/teachers/${teacherId}/photo`, { dataUrl: dataUrl('image/png', PNG) })).status).toBe(401);
  });

  it('remove a foto e apaga a foto junto com o professor', async () => {
    const removed = await server.call('DELETE', `/teachers/${teacherId}/photo`);
    expect(removed.body.photoUpdatedAt).toBeNull();
    expect((await server.call('GET', `/teachers/${teacherId}/photo`)).status).toBe(404);

    await server.call('PUT', `/teachers/${teacherId}/photo`, { dataUrl: dataUrl('image/png', PNG) });
    expect((await server.call('DELETE', `/teachers/${teacherId}`)).status).toBe(204);
    expect(await server.db.query('SELECT 1 FROM teacher_photos WHERE teacher_id = $1', [teacherId])).toHaveLength(0);
  });
});

/** Cookie de sessão de um login novo (para requisições feitas fora do auxiliar `call`). */
async function sessionCookie(server: TestServer) {
  const res = await server.anonymous('POST', '/auth/login', { email: 'admin@teste.com', password: 'senha-de-teste-123' });
  return res.headers.get('set-cookie')!.split(';')[0];
}
