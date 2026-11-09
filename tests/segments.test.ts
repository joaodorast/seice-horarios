import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestServer, type TestServer } from './helpers.js';

/** Segmentos de ensino: o professor pode lecionar em mais de um, e a disciplina pertence a segmentos. */
describe('segmentos de ensino', () => {
  let server: TestServer;

  beforeAll(async () => {
    server = await startTestServer();
  });

  afterAll(() => server.close());

  it('aceita mais de um segmento no professor', async () => {
    const res = await server.call('POST', '/teachers', {
      name: 'Nayssa Alves',
      segments: ['medio', 'fund2'],
      subjectIds: [],
      active: true,
    });
    expect(res.status).toBe(201);
    // Sempre na ordem canônica (Fund. II antes de Médio).
    expect(res.body.segments).toEqual(['fund2', 'medio']);
  });

  it('recusa segmento desconhecido', async () => {
    const res = await server.call('POST', '/teachers', { name: 'Teste Segmento', segments: ['superior'], subjectIds: [], active: true });
    expect(res.status).toBe(422);
  });

  it('guarda os segmentos da disciplina e permite nenhum (aparece em todos)', async () => {
    const musica = await server.call('POST', '/subjects', { name: 'Música', segments: ['infantil', 'fund1'] });
    expect(musica.body.segments).toEqual(['fund1', 'infantil']);

    const geografia = await server.call('POST', '/subjects', { name: 'Geografia', segments: [] });
    expect(geografia.body.segments).toEqual([]);

    const lista = await server.call('GET', '/subjects');
    expect(lista.body.find((s: { name: string }) => s.name === 'Música').segments).toEqual(['fund1', 'infantil']);
  });

  it('a importação lê os segmentos e avisa quando não reconhece', async () => {
    const res = await server.call('POST', '/import/teachers', {
      rows: [
        { line: 2, values: { name: 'Daphne Passos', segments: 'Fund. I' } },
        { line: 3, values: { name: 'Pessoa Errada', segments: 'Superior' } },
      ],
      options: {},
    });
    expect(res.body.summary.create).toBe(1);
    expect(res.body.summary.error).toBe(1);
    expect(res.body.rows[1].messages[0]).toContain('não reconhecido');

    const professores = await server.call('GET', '/teachers');
    const daphne = professores.body.find((t: { name: string }) => t.name === 'Daphne Passos');
    expect(daphne.segments).toEqual(['fund1']);
  });
});
