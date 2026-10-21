import '../server/silence-warnings';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase, type Database } from '../server/db';
import { createApp } from '../server/app';

let server: Server;
let base = '';
let db: Database;
let dir = '';

async function call(method: string, path: string, body?: unknown) {
  const res = await fetch(base + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'seice-test-'));
  db = openDatabase(join(dir, 'test.db'));
  const { app } = createApp(db);
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});

afterAll(() => {
  server.close();
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('API SEICE', () => {
  let ana: { id: number };
  let bruno: { id: number };
  let t6a: { id: number };
  let t6b: { id: number };
  let math: { id: number };
  let lessonId: number;

  it('cria configuração inicial com dias e períodos', async () => {
    const settings = await call('GET', '/settings');
    expect(settings.body.enabledDays).toEqual([1, 2, 3, 4, 5]);
    const periods = await call('GET', '/periods');
    expect(periods.body.length).toBeGreaterThan(5);
  });

  it('valida e cadastra professores, com matrícula única', async () => {
    const invalid = await call('POST', '/teachers', { name: 'A', phone: 'abc' });
    expect(invalid.status).toBe(422);
    expect(Object.keys(invalid.body.error.fields).sort()).toEqual(['name', 'phone']);

    ana = (await call('POST', '/teachers', { name: 'Ana Souza', code: 'M-01', area: 'Matemática', phone: '(21) 99999-0000' })).body;
    bruno = (await call('POST', '/teachers', { name: 'Bruno Lima', code: '' })).body;
    expect(ana.id).toBeGreaterThan(0);
    expect((bruno as unknown as { code: string | null }).code).toBeNull();

    const dup = await call('POST', '/teachers', { name: 'Outra Pessoa', code: 'm-01' });
    expect(dup.status).toBe(409);
    expect(dup.body.error.fields.code).toContain('Ana Souza');
  });

  it('cadastra turmas sem duplicidade', async () => {
    t6a = (await call('POST', '/classes', { name: '6º A', grade: '6º ano', shift: 'manha' })).body;
    t6b = (await call('POST', '/classes', { name: '6º B', grade: '6º ano', shift: 'manha' })).body;
    const dup = await call('POST', '/classes', { name: ' 6º  a ', grade: '6º ano', shift: 'tarde' });
    expect(dup.status).toBe(409);
  });

  it('cadastra disciplina', async () => {
    math = (await call('POST', '/subjects', { name: 'Matemática', color: 'indigo' })).body;
    expect(math.id).toBeGreaterThan(0);
  });

  it('cria aula e bloqueia conflitos de professor e turma', async () => {
    const created = await call('POST', '/lessons', {
      teacherId: ana.id, classId: t6a.id, subjectId: math.id, weekday: 1, start: '07:00', end: '07:50',
    });
    expect(created.status).toBe(201);
    lessonId = created.body.lesson.id;

    const teacherClash = await call('POST', '/lessons', {
      teacherId: ana.id, classId: t6b.id, subjectId: null, weekday: 1, start: '07:30', end: '08:20',
    });
    expect(teacherClash.status).toBe(409);
    expect(teacherClash.body.error.issues[0].code).toBe('teacher-overlap');

    const classClash = await call('POST', '/lessons', {
      teacherId: bruno.id, classId: t6a.id, subjectId: null, weekday: 1, start: '07:00', end: '07:50',
    });
    expect(classClash.status).toBe(409);
    expect(classClash.body.error.issues[0].code).toBe('class-overlap');

    const badTime = await call('POST', '/lessons', {
      teacherId: bruno.id, classId: t6b.id, weekday: 1, start: '09:00', end: '08:00',
    });
    expect(badTime.status).toBe(422);
  });

  it('o banco recusa sobreposição mesmo sem passar pela API', () => {
    expect(() =>
      db
        .prepare('INSERT INTO lessons (teacher_id, class_id, weekday, start_time, end_time) VALUES (?, ?, 1, ?, ?)')
        .run(ana.id, t6b.id, '07:10', '07:40'),
    ).toThrow(/LESSON_OVERLAP/);
  });

  it('edita a aula sem conflitar consigo mesma', async () => {
    const res = await call('PUT', `/lessons/${lessonId}`, {
      teacherId: ana.id, classId: t6a.id, subjectId: math.id, weekday: 1, start: '07:00', end: '07:50', notes: 'Sala 3',
    });
    expect(res.status).toBe(200);
    expect(res.body.lesson.notes).toBe('Sala 3');
  });

  it('impede aula com professor inativo e protege exclusão com aulas', async () => {
    await call('PATCH', `/teachers/${bruno.id}/status`, { active: false });
    const res = await call('POST', '/lessons', {
      teacherId: bruno.id, classId: t6b.id, weekday: 2, start: '07:00', end: '07:50',
    });
    expect(res.status).toBe(409);
    expect(res.body.error.issues[0].code).toBe('teacher-inactive');

    const del = await call('DELETE', `/teachers/${ana.id}`);
    expect(del.status).toBe(409);
    expect(del.body.error.details.lessonCount).toBe(1);
  });

  it('alterar períodos não altera aulas existentes', async () => {
    const res = await call('PUT', '/periods/manha', { periods: [{ label: '1º', start: '08:00', end: '09:00', kind: 'aula' }] });
    expect(res.status).toBe(200);
    const lessons = await call('GET', '/lessons');
    expect(lessons.body).toHaveLength(1);
    expect(lessons.body[0].start).toBe('07:00');

    const overlapping = await call('PUT', '/periods/manha', {
      periods: [
        { label: '1º', start: '08:00', end: '09:00', kind: 'aula' },
        { label: '2º', start: '08:30', end: '09:30', kind: 'aula' },
      ],
    });
    expect(overlapping.status).toBe(422);
  });

  it('exclui disciplina desvinculando aulas somente quando confirmado', async () => {
    expect((await call('DELETE', `/subjects/${math.id}`)).status).toBe(409);
    expect((await call('DELETE', `/subjects/${math.id}?detachLessons=true`)).status).toBe(204);
    const lessons = await call('GET', '/lessons');
    expect(lessons.body[0].subjectId).toBeNull();
  });

  it('exclui professor com aulas quando confirmado', async () => {
    expect((await call('DELETE', `/teachers/${ana.id}?withLessons=true`)).status).toBe(204);
    expect((await call('GET', '/lessons')).body).toHaveLength(0);
  });

  it('valida configurações', async () => {
    expect((await call('PUT', '/settings', { enabledDays: [], enabledShifts: ['manha'], lessonDuration: 50 })).status).toBe(422);
    const ok = await call('PUT', '/settings', { enabledDays: [6, 1, 2], enabledShifts: ['tarde', 'manha'], lessonDuration: 45 });
    expect(ok.body).toEqual({ enabledDays: [1, 2, 6], enabledShifts: ['manha', 'tarde'], lessonDuration: 45 });
  });

  it('responde 404 em rota desconhecida', async () => {
    expect((await call('GET', '/nada')).status).toBe(404);
  });
});
