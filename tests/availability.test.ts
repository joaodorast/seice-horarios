import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestServer, type TestServer } from './helpers.js';
import { isAvailable, unavailableReason } from '../shared/availability.js';

describe('dias e horários do professor na escola', () => {
  let server: TestServer;
  let ana: number;
  let bruno: number;
  let classId: number;
  const lesson = (teacherId: number, weekday: number, start: string, end: string) => ({ teacherId, classId, subjectId: null, weekday, start, end });

  beforeAll(async () => {
    server = await startTestServer();
    ana = (await server.call('POST', '/teachers', { name: 'Ana Paula Souza', subjectIds: [] })).body.id;
    bruno = (await server.call('POST', '/teachers', { name: 'Bruno Lima', subjectIds: [] })).body.id;
    classId = (await server.call('POST', '/classes', { name: '6º A', grade: '6º ano', shift: 'manha' })).body.id;
  });

  afterAll(() => server.close());

  it('guarda os dias e une intervalos que se encostam', async () => {
    const slots = [1, 2, 3, 4].flatMap((weekday) => [
      { weekday, start: '07:00', end: '09:30' },
      { weekday, start: '09:30', end: '12:20' },
    ]);
    const res = await server.call('PUT', `/teachers/${ana}/availability`, { slots });
    expect(res.status).toBe(200);
    expect(res.body.availability).toHaveLength(4);
    expect(res.body.availability[0]).toEqual({ weekday: 1, start: '07:00', end: '12:20' });
  });

  it('não deixa colocar o professor num dia em que ele não vem', async () => {
    const res = await server.call('POST', '/lessons', lesson(ana, 5, '07:00', '07:50'));
    expect(res.status).toBe(409);
    expect(res.body.error.issues.map((i: { code: string }) => i.code)).toContain('teacher-unavailable');
    expect(res.body.error.issues.find((i: { code: string }) => i.code === 'teacher-unavailable').message).toContain('não está na escola na sexta-feira');
  });

  it('não deixa colocar fora do horário do dia, mas aceita dentro', async () => {
    expect((await server.call('POST', '/lessons', lesson(ana, 1, '13:00', '13:50'))).status).toBe(409);
    expect((await server.call('POST', '/lessons', lesson(ana, 1, '07:00', '07:50'))).status).toBe(201);
  });

  it('também bloqueia na reorganização em lote (Montar quadro, trocar, repassar)', async () => {
    const res = await server.call('POST', '/lessons/batch', { creates: [lesson(ana, 5, '08:00', '08:50')] });
    expect(res.status).toBe(409);
  });

  it('professor sem dias informados pode ir em qualquer horário; limpar volta a liberar', async () => {
    expect((await server.call('POST', '/lessons', lesson(bruno, 5, '07:00', '07:50'))).status).toBe(201);
    await server.call('PUT', `/teachers/${ana}/availability`, { slots: [] });
    expect((await server.call('POST', '/lessons', lesson(ana, 5, '08:00', '08:50'))).status).toBe(201);
  });

  it('recusa saída antes da chegada', async () => {
    const res = await server.call('PUT', `/teachers/${ana}/availability`, { slots: [{ weekday: 1, start: '12:00', end: '07:00' }] });
    expect(res.status).toBe(422);
  });

  it('explica o motivo em linguagem simples', () => {
    const t = { availability: [{ weekday: 1 as const, start: '07:00', end: '12:20' }] };
    expect(isAvailable(t, 1, '07:00', '07:50')).toBe(true);
    expect(isAvailable(t, 1, '12:00', '12:50')).toBe(false);
    expect(unavailableReason(t, 5)).toBe('não vem na sexta');
    expect(unavailableReason(t, 1)).toBe('segunda: só 07:00 às 12:20');
    expect(isAvailable({ availability: [] }, 5, '07:00', '07:50')).toBe(true);
  });
});
