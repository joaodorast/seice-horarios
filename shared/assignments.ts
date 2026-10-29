import { shiftsOfClass } from './labels.js';
import { overlaps } from './time.js';
import type { Assignment, Lesson, Period, SchoolClass, Weekday } from './types.js';

/** Quantas aulas um registro vale: os períodos de aula do turno da turma que ele ocupa (aula dupla = 2). */
export function lessonUnits(l: Lesson, periods: Period[], classes: SchoolClass[]): number {
  const c = classes.find((x) => x.id === l.classId);
  const shifts = c ? shiftsOfClass(c.shift) : undefined;
  const n = periods.filter((p) => p.kind === 'aula' && (!shifts || shifts.includes(p.shift)) && overlaps(p.start, p.end, l.start, l.end)).length;
  return Math.max(1, n);
}

export const assignmentKey = (classId: number, subjectId: number) => `${classId}:${subjectId}`;

/** Situação de uma atribuição no quadro: quantas aulas o professor já tem lançadas na turma, nessa disciplina. */
export interface AssignmentProgress {
  assignment: Assignment;
  placed: number;
  /** Aulas que faltam lançar (negativo quando passou do atribuído). */
  missing: number;
  status: 'empty' | 'partial' | 'complete' | 'over';
}

export function assignmentProgress(assignments: Assignment[], lessons: Lesson[], periods: Period[], classes: SchoolClass[]): Map<string, AssignmentProgress> {
  const placed = new Map<string, number>();
  for (const l of lessons) {
    if (l.subjectId === null) continue;
    const key = `${assignmentKey(l.classId, l.subjectId)}:${l.teacherId}`;
    placed.set(key, (placed.get(key) ?? 0) + lessonUnits(l, periods, classes));
  }
  const result = new Map<string, AssignmentProgress>();
  for (const a of assignments) {
    const n = placed.get(`${assignmentKey(a.classId, a.subjectId)}:${a.teacherId}`) ?? 0;
    const missing = a.weeklyLessons - n;
    result.set(assignmentKey(a.classId, a.subjectId), {
      assignment: a,
      placed: n,
      missing,
      status: n === 0 ? 'empty' : missing > 0 ? 'partial' : missing === 0 ? 'complete' : 'over',
    });
  }
  return result;
}

/** Horários de aula disponíveis na semana da turma (períodos de aula do turno × dias letivos). */
export function classCapacity(c: SchoolClass, periods: Period[], days: Weekday[]): number {
  const shifts = shiftsOfClass(c.shift);
  return periods.filter((p) => p.kind === 'aula' && shifts.includes(p.shift)).length * days.length;
}
