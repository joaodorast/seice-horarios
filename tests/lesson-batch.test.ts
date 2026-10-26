import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestServer, type TestServer } from './helpers.js';

interface L {
  id: number;
  teacherId: number;
  classId: number;
  weekday: number;
  start: string;
  end: string;
}

describe('reorganizar o quadro: substituir, trocar horários e passar aula para outro professor', () => {
  let server: TestServer;
  let ana: number;
  let bruno: number;
  let carla: number;
  let t6: number;
  let t7: number;
  const lessons = async () => (await server.call('GET', '/lessons')).body as L[];
  const at = (list: L[], classId: number, weekday: number, start: string) => list.find((l) => l.classId === classId && l.weekday === weekday && l.start === start);
  const create = async (teacherId: number, classId: number, start: string, end: string, weekday = 1) =>
    (await server.call('POST', '/lessons', { teacherId, classId, weekday, start, end })).body.lesson as L;

  beforeAll(async () => {
    server = await startTestServer();
    ana = (await server.call('POST', '/teachers', { name: 'Ana Souza' })).body.id;
    bruno = (await server.call('POST', '/teachers', { name: 'Bruno Lima' })).body.id;
    carla = (await server.call('POST', '/teachers', { name: 'Carla Mendes' })).body.id;
    t6 = (await server.call('POST', '/classes', { name: '6º A', grade: '6º ano', shift: 'manha' })).body.id;
    t7 = (await server.call('POST', '/classes', { name: '7º A', grade: '7º ano', shift: 'manha' })).body.id;
  });

  afterAll(() => server.close());

  it('substitui a aula que ocupava o horário da turma', async () => {
    const old = await create(ana, t6, '07:00', '07:50');
    const res = await server.call('POST', '/lessons/batch', {
      removeIds: [old.id],
      creates: [{ teacherId: bruno, classId: t6, weekday: 1, start: '07:00', end: '07:50' }],
    });
    expect(res.status).toBe(200);
    expect(at(await lessons(), t6, 1, '07:00')?.teacherId).toBe(bruno);
  });

  it('troca duas aulas de horário (a outra vai para o horário antigo)', async () => {
    const moving = await create(carla, t6, '08:40', '09:30'); // Carla às 08:40
    const occupant = at(await lessons(), t6, 1, '07:00')!; // Bruno às 07:00
    const res = await server.call('POST', '/lessons/batch', {
      removeIds: [occupant.id],
      updates: [{ id: moving.id, input: { teacherId: carla, classId: t6, weekday: 1, start: '07:00', end: '07:50' } }],
      creates: [{ teacherId: bruno, classId: t6, weekday: 1, start: '08:40', end: '09:30' }],
    });
    expect(res.status).toBe(200);
    const list = await lessons();
    expect(at(list, t6, 1, '07:00')?.teacherId).toBe(carla);
    expect(at(list, t6, 1, '08:40')?.teacherId).toBe(bruno);
  });

  it('passa a aula de outra turma para outro professor e coloca o professor desejado', async () => {
    const other = await create(ana, t7, '10:00', '10:50'); // Ana ocupada na 7º A
    const res = await server.call('POST', '/lessons/batch', {
      updates: [{ id: other.id, input: { teacherId: bruno, classId: t7, weekday: 1, start: '10:00', end: '10:50' } }],
      creates: [{ teacherId: ana, classId: t6, weekday: 1, start: '10:00', end: '10:50' }],
    });
    expect(res.status).toBe(200);
    const list = await lessons();
    expect(at(list, t7, 1, '10:00')?.teacherId).toBe(bruno);
    expect(at(list, t6, 1, '10:00')?.teacherId).toBe(ana);
  });

  it('é tudo ou nada: se um passo gera conflito, nenhum é aplicado', async () => {
    const before = await lessons();
    const victim = at(before, t6, 1, '07:00')!;
    const res = await server.call('POST', '/lessons/batch', {
      removeIds: [victim.id],
      // Ana já está às 10:00 na 6º A: conflito no segundo passo.
      creates: [
        { teacherId: ana, classId: t6, weekday: 1, start: '07:00', end: '07:50' },
        { teacherId: ana, classId: t7, weekday: 1, start: '10:00', end: '10:50' },
      ],
    });
    expect(res.status).toBe(409);
    expect(res.body.error.issues.length).toBeGreaterThan(0);
    expect(await lessons()).toEqual(before);
  });

  it('recusa aulas que já não existem (alteradas por outra pessoa)', async () => {
    const res = await server.call('POST', '/lessons/batch', { removeIds: [999999] });
    expect(res.status).toBe(409);
    expect((await server.call('POST', '/lessons/batch', {})).status).toBe(422);
  });
});
