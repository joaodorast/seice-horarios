import { describe, expect, it } from 'vitest';
import { computeWorkload } from '../shared/workload.js';
import type { Lesson, SchoolClass, Teacher } from '../shared/types.js';

const ts = '2026-01-01T00:00:00.000Z';
const teacher = (id: number, name: string, active = true): Teacher => ({
  id, name, code: null, area: null, phone: null, notes: null, active, createdAt: ts, updatedAt: ts, photoUpdatedAt: null, subjectIds: [], availability: [],
});
const klass = (id: number, name: string, shift: SchoolClass['shift'] = 'manha', active = true): SchoolClass => ({
  id, name, grade: '', shift, notes: null, active, createdAt: ts, updatedAt: ts,
});
let seq = 1;
const lesson = (teacherId: number, classId: number, subjectId: number | null, start: string, end: string): Lesson => ({
  id: seq++, teacherId, classId, subjectId, weekday: 1, start, end, notes: null, createdAt: ts, updatedAt: ts,
});

describe('carga horária', () => {
  const teachers = [teacher(1, 'Bruno'), teacher(2, 'Ana'), teacher(3, 'Inativa sem aulas', false), teacher(4, 'Inativo com aula', false)];
  const classes = [klass(10, '7º A'), klass(11, '6º A'), klass(12, '9º A', 'tarde')];
  const lessons = [
    lesson(1, 10, 100, '07:00', '07:50'),
    lesson(1, 10, 101, '07:50', '08:40'),
    lesson(1, 11, 100, '08:40', '09:30'),
    lesson(2, 12, 100, '13:00', '14:40'), // aula dupla: 100 minutos
    lesson(4, 11, null, '10:00', '10:50'),
  ];

  it('soma aulas e horas por turma, por professor e no total', () => {
    const w = computeWorkload(lessons, teachers, classes);
    expect(w.classes.map((c) => c.name)).toEqual(['6º A', '7º A', '9º A']);
    expect(w.rows.map((r) => r.teacher.name)).toEqual(['Ana', 'Bruno', 'Inativo com aula']);
    const bruno = w.rows.find((r) => r.teacher.id === 1)!;
    expect(bruno.byClass.get(10)).toEqual({ lessons: 2, minutes: 100 });
    expect(bruno.total).toEqual({ lessons: 3, minutes: 150 });
    expect(w.classTotals.get(11)).toEqual({ lessons: 2, minutes: 100 });
    expect(w.grand).toEqual({ lessons: 5, minutes: 300 }); // 4 aulas de 50 min + 1 dupla de 100 min
  });

  it('detalha por disciplina dentro de cada professor', () => {
    const bruno = computeWorkload(lessons, teachers, classes).rows.find((r) => r.teacher.id === 1)!;
    expect(bruno.bySubject.map((s) => [s.subjectId, s.total.lessons])).toEqual([[100, 2], [101, 1]]);
    expect(bruno.bySubject[0].byClass.get(11)).toEqual({ lessons: 1, minutes: 50 });
  });

  it('pode contar a aula dupla como duas aulas', () => {
    const w = computeWorkload(lessons, teachers, classes, undefined, (l) => (l.end === '14:40' ? 2 : 1));
    expect(w.rows.find((r) => r.teacher.id === 2)!.total).toEqual({ lessons: 2, minutes: 100 });
    expect(w.grand.lessons).toBe(6);
  });

  it('filtra as turmas (ex.: só o turno da tarde) e recalcula os totais', () => {
    const w = computeWorkload(lessons, teachers, classes, (c) => c.shift === 'tarde');
    expect(w.classes.map((c) => c.name)).toEqual(['9º A']);
    expect(w.grand).toEqual({ lessons: 1, minutes: 100 });
    expect(w.rows.find((r) => r.teacher.id === 1)!.total.lessons).toBe(0);
  });
});
