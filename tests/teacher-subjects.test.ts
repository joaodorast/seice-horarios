import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestServer, type TestServer } from './helpers.js';

describe('professores com várias disciplinas', () => {
  let server: TestServer;
  let geo: number;
  let pv: number;
  let math: number;
  let teacherId: number;
  let classId: number;

  beforeAll(async () => {
    server = await startTestServer();
    geo = (await server.call('POST', '/subjects', { name: 'Geografia', color: 'teal' })).body.id;
    pv = (await server.call('POST', '/subjects', { name: 'Projeto de Vida', color: 'indigo' })).body.id;
    math = (await server.call('POST', '/subjects', { name: 'Matemática', color: 'sky' })).body.id;
    classId = (await server.call('POST', '/classes', { name: '8º A', grade: '8º ano', shift: 'manha' })).body.id;
  });

  afterAll(() => server.close());

  it('cadastra o professor com duas disciplinas', async () => {
    const res = await server.call('POST', '/teachers', { name: 'Bruno Lima', subjectIds: [pv, geo, geo] });
    expect(res.status).toBe(201);
    teacherId = res.body.id;
    expect(res.body.subjectIds).toEqual([geo, pv].sort((a, b) => a - b));
  });

  it('edita as disciplinas do professor', async () => {
    const res = await server.call('PUT', `/teachers/${teacherId}`, { name: 'Bruno Lima', subjectIds: [geo] });
    expect(res.body.subjectIds).toEqual([geo]);
  });

  it('aprende a disciplina quando uma aula é salva', async () => {
    const lesson = await server.call('POST', '/lessons', { teacherId, classId, subjectId: math, weekday: 1, start: '07:00', end: '07:50' });
    expect(lesson.status).toBe(201);
    const teacher = (await server.call('GET', `/teachers/${teacherId}`)).body;
    expect(teacher.subjectIds).toEqual([geo, math].sort((a, b) => a - b));
  });

  it('importa a coluna Disciplinas, avisa nomes desconhecidos e não apaga as atuais quando vazia', async () => {
    const rows = (values: Record<string, string>[]) => values.map((v, i) => ({ line: i + 2, values: v }));
    const created = await server.call('POST', '/import/teachers', {
      rows: rows([{ name: 'Carla Mendes', subjects: 'Geografia; Projeto de Vida, Astronomia' }]),
    });
    expect(created.body.summary.create).toBe(1);
    expect(created.body.rows[0].warnings[0]).toContain('Astronomia');
    const carla = ((await server.call('GET', '/teachers')).body as { name: string; subjectIds: number[] }[]).find((t) => t.name === 'Carla Mendes')!;
    expect(carla.subjectIds).toEqual([geo, pv].sort((a, b) => a - b));

    await server.call('POST', '/import/teachers', { rows: rows([{ name: 'Carla Mendes', area: 'Humanas', subjects: '' }]) });
    const after = ((await server.call('GET', '/teachers')).body as { name: string; subjectIds: number[]; area: string }[]).find((t) => t.name === 'Carla Mendes')!;
    expect(after.area).toBe('Humanas');
    expect(after.subjectIds).toEqual([geo, pv].sort((a, b) => a - b));
  });

  it('remove o vínculo quando a disciplina é excluída', async () => {
    await server.call('DELETE', `/subjects/${pv}`);
    const carla = ((await server.call('GET', '/teachers')).body as { name: string; subjectIds: number[] }[]).find((t) => t.name === 'Carla Mendes')!;
    expect(carla.subjectIds).toEqual([geo]);
  });
});
