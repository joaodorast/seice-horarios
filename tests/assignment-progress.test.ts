import { describe, expect, it } from 'vitest';
import { assignmentProgress, classCapacity, lessonUnits } from '../shared/assignments.js';
import type { Assignment, Lesson, Period, SchoolClass } from '../shared/types.js';

const ts = '2026-01-01T00:00:00.000Z';
const period = (id: number, shift: Period['shift'], start: string, end: string, kind: Period['kind'] = 'aula'): Period => ({ id, shift, label: `${id}º`, start, end, kind, sortOrder: id });
const periods = [
  period(1, 'manha', '07:00', '07:50'),
  period(2, 'manha', '07:50', '08:40'),
  period(3, 'manha', '08:40', '09:00', 'intervalo'),
  period(4, 'manha', '09:00', '09:50'),
  period(5, 'tarde', '07:30', '08:20'), // cruza com a manhã: não deve contar para turma da manhã
];
const klass: SchoolClass = { id: 10, name: '6º A', grade: '6º ano', shift: 'manha', notes: null, active: true, createdAt: ts, updatedAt: ts };
const lesson = (id: number, teacherId: number, subjectId: number | null, start: string, end: string): Lesson => ({
  id, teacherId, classId: 10, subjectId, weekday: 1, start, end, notes: null, createdAt: ts, updatedAt: ts,
});
const assignment = (teacherId: number, subjectId: number, weeklyLessons: number): Assignment => ({ id: subjectId, teacherId, classId: 10, subjectId, weeklyLessons, updatedAt: ts });

describe('progresso das atribuições', () => {
  it('conta a aula dupla como duas, só com os períodos do turno da turma', () => {
    expect(lessonUnits(lesson(1, 1, 100, '07:00', '08:40'), periods, [klass])).toBe(2);
    expect(lessonUnits(lesson(2, 1, 100, '07:00', '07:50'), periods, [klass])).toBe(1);
  });

  it('compara o atribuído com o que já está no quadro, por professor', () => {
    const lessons = [lesson(1, 1, 100, '07:00', '08:40'), lesson(2, 2, 101, '09:00', '09:50'), lesson(3, 9, 102, '07:00', '07:50')];
    const p = assignmentProgress([assignment(1, 100, 2), assignment(2, 101, 3), assignment(3, 102, 2), assignment(4, 103, 1)], lessons, periods, [klass]);
    expect(p.get('10:100')).toMatchObject({ placed: 2, missing: 0, status: 'complete' });
    expect(p.get('10:101')).toMatchObject({ placed: 1, missing: 2, status: 'partial' });
    // A aula de 102 é de outro professor: não conta para a atribuição.
    expect(p.get('10:102')).toMatchObject({ placed: 0, status: 'empty' });
    expect(assignmentProgress([assignment(1, 100, 1)], lessons, periods, [klass]).get('10:100')?.status).toBe('over');
  });

  it('calcula os horários disponíveis da turma na semana', () => {
    expect(classCapacity(klass, periods, [1, 2, 3, 4, 5])).toBe(15);
  });
});
