import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestServer, type TestServer } from './helpers.js';
import { ASSIGNMENTS_FROM_LESSONS } from '../server/migrations.js';

describe('atribuição de aulas', () => {
  let server: TestServer;
  let math: number;
  let port: number;
  let ana: number;
  let bruno: number;
  let a6: number;
  let a7: number;
  const rows = (values: Record<string, string>[]) => values.map((v, i) => ({ line: i + 2, values: v }));

  beforeAll(async () => {
    server = await startTestServer();
    math = (await server.call('POST', '/subjects', { name: 'Matemática', color: 'sky' })).body.id;
    port = (await server.call('POST', '/subjects', { name: 'Língua Portuguesa', color: 'rose' })).body.id;
    ana = (await server.call('POST', '/teachers', { name: 'Ana Paula Souza', subjectIds: [] })).body.id;
    bruno = (await server.call('POST', '/teachers', { name: 'Bruno Lima', subjectIds: [port] })).body.id;
    a6 = (await server.call('POST', '/classes', { name: '6º A', grade: '6º ano', shift: 'manha' })).body.id;
    a7 = (await server.call('POST', '/classes', { name: '7º A', grade: '7º ano', shift: 'manha' })).body.id;
  });

  afterAll(() => server.close());

  it('atribui o professor a várias turmas de uma vez e passa a constar a disciplina dele', async () => {
    const res = await server.call('POST', '/assignments/batch', {
      upserts: [a6, a7].map((classId) => ({ teacherId: ana, classId, subjectId: math, weeklyLessons: 5 })),
    });
    expect(res.status).toBe(200);
    expect(res.body.map((a: { classId: number; weeklyLessons: number }) => [a.classId, a.weeklyLessons])).toEqual([
      [a6, 5],
      [a7, 5],
    ]);
    expect((await server.call('GET', `/teachers/${ana}`)).body.subjectIds).toEqual([math]);
  });

  it('cada turma tem um professor por disciplina: atribuir de novo troca o professor', async () => {
    const res = await server.call('POST', '/assignments/batch', { upserts: [{ teacherId: bruno, classId: a7, subjectId: math, weeklyLessons: 4 }] });
    const a7math = res.body.find((a: { classId: number; subjectId: number }) => a.classId === a7 && a.subjectId === math);
    expect(a7math).toMatchObject({ teacherId: bruno, weeklyLessons: 4 });
    expect(res.body).toHaveLength(2);
  });

  it('remove, recusa duplicadas e valores fora do limite', async () => {
    const removed = await server.call('POST', '/assignments/batch', { removes: [{ classId: a7, subjectId: math }] });
    expect(removed.body).toHaveLength(1);
    const dup = await server.call('POST', '/assignments/batch', {
      upserts: [
        { teacherId: ana, classId: a6, subjectId: port, weeklyLessons: 2 },
        { teacherId: bruno, classId: a6, subjectId: port, weeklyLessons: 2 },
      ],
    });
    expect(dup.status).toBe(422);
    const big = await server.call('POST', '/assignments/batch', { upserts: [{ teacherId: ana, classId: a6, subjectId: port, weeklyLessons: 41 }] });
    expect(big.status).toBe(422);
    const missing = await server.call('POST', '/assignments/batch', { upserts: [{ teacherId: 9999, classId: a6, subjectId: port, weeklyLessons: 2 }] });
    expect(missing.status).toBe(422);
  });

  it('importa a planilha com várias turmas na mesma linha', async () => {
    const res = await server.call('POST', '/import/assignments', {
      rows: rows([
        { teacher: 'Bruno Lima', class: '6º A, 7º A', subject: 'Língua Portuguesa', weekly: '5' },
        { teacher: 'Ana Paula', class: '6º A', subject: 'Matemática', weekly: '5' },
        { teacher: 'Ana Paula Souza', class: '8º Z', subject: 'Matemática', weekly: '3' },
      ]),
    });
    expect(res.body.summary).toMatchObject({ create: 1, error: 2 });
    expect(res.body.rows[1].messages[0]).toContain('não está cadastrado');
    expect(res.body.rows[2].messages[0]).toContain('8º Z');
    const all = (await server.call('GET', '/assignments')).body as { classId: number; subjectId: number; teacherId: number }[];
    expect(all.filter((a) => a.subjectId === port).map((a) => [a.classId, a.teacherId])).toEqual([
      [a6, bruno],
      [a7, bruno],
    ]);
  });

  it('ao excluir a turma, as atribuições dela saem junto', async () => {
    await server.call('DELETE', `/classes/${a7}`);
    const all = (await server.call('GET', '/assignments')).body as { classId: number }[];
    expect(all.every((a) => a.classId !== a7)).toBe(true);
  });

  it('aprende as atribuições com as aulas já lançadas (aula dupla conta como duas)', async () => {
    await server.call('POST', '/assignments/batch', { removes: [{ classId: a6, subjectId: math }] });
    await server.call('POST', '/lessons', { teacherId: ana, classId: a6, subjectId: math, weekday: 1, start: '07:00', end: '08:40' });
    await server.call('POST', '/lessons', { teacherId: ana, classId: a6, subjectId: math, weekday: 2, start: '07:00', end: '07:50' });
    await server.db.exec(`SET search_path TO seice; ${ASSIGNMENTS_FROM_LESSONS}`);
    const all = (await server.call('GET', '/assignments')).body as { classId: number; subjectId: number; teacherId: number; weeklyLessons: number }[];
    expect(all.find((a) => a.classId === a6 && a.subjectId === math)).toMatchObject({ teacherId: ana, weeklyLessons: 3 });
    // Não sobrescreve atribuições existentes.
    expect(all.find((a) => a.classId === a6 && a.subjectId === port)).toMatchObject({ teacherId: bruno, weeklyLessons: 5 });
  });
});
