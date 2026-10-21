import { describe, expect, it } from 'vitest';
import { findScheduleConflicts, hasBlockingIssues, validateLesson, type ValidationContext } from '../shared/conflicts.js';
import { overlaps } from '../shared/time.js';
import { computeSlotStats, lessonsOutsideGrid } from '../shared/grid.js';
import type { Lesson, Period, SchoolClass, Teacher } from '../shared/types.js';

const ts = '2026-01-01T00:00:00.000Z';
const teacher = (id: number, active = true): Teacher => ({
  id, name: `Prof ${id}`, code: null, area: null, phone: null, notes: null, active, createdAt: ts, updatedAt: ts,
});
const klass = (id: number, shift: SchoolClass['shift'] = 'manha', active = true): SchoolClass => ({
  id, name: `T${id}`, grade: '6º ano', shift, notes: null, active, createdAt: ts, updatedAt: ts,
});
const lesson = (id: number, teacherId: number, classId: number, weekday: Lesson['weekday'], start: string, end: string): Lesson => ({
  id, teacherId, classId, subjectId: null, weekday, start, end, notes: null, createdAt: ts, updatedAt: ts,
});
const period = (id: number, shift: Period['shift'], start: string, end: string, kind: Period['kind'] = 'aula'): Period => ({
  id, shift, label: `P${id}`, start, end, kind, sortOrder: id,
});

function ctx(lessons: Lesson[], extra: Partial<ValidationContext> = {}): ValidationContext {
  return {
    lessons,
    teachers: [teacher(1), teacher(2), teacher(3, false)],
    classes: [klass(10), klass(11), klass(12, 'manha', false), klass(13, 'integral')],
    subjects: [],
    settings: { enabledDays: [1, 2, 3, 4, 5], enabledShifts: ['manha', 'tarde'], lessonDuration: 50 },
    periods: [period(1, 'manha', '08:00', '09:00'), period(2, 'manha', '09:00', '10:00'), period(3, 'tarde', '13:00', '14:00')],
    ...extra,
  };
}

const codes = (issues: { code: string }[]) => issues.map((i) => i.code).sort();

describe('overlaps', () => {
  it('considera sobreposição parcial', () => {
    expect(overlaps('08:00', '09:30', '09:00', '10:00')).toBe(true);
  });
  it('aulas encostadas não conflitam', () => {
    expect(overlaps('08:00', '09:00', '09:00', '10:00')).toBe(false);
  });
  it('aula contida em outra conflita', () => {
    expect(overlaps('08:00', '11:00', '09:00', '09:30')).toBe(true);
  });
});

describe('validateLesson', () => {
  const base = { teacherId: 1, classId: 10, subjectId: null, weekday: 1 as const, start: '08:00', end: '09:00' };

  it('aceita aula sem conflitos', () => {
    expect(validateLesson(base, ctx([]))).toEqual([]);
  });

  it('detecta professor em duas turmas ao mesmo tempo, inclusive sobreposição parcial', () => {
    const existing = [lesson(1, 1, 11, 1, '08:00', '09:30')];
    const issues = validateLesson({ ...base, start: '09:00', end: '10:00' }, ctx(existing));
    expect(codes(issues)).toEqual(['teacher-overlap']);
    expect(issues[0].relatedLessonId).toBe(1);
    expect(hasBlockingIssues(issues)).toBe(true);
  });

  it('detecta turma com duas aulas simultâneas', () => {
    const issues = validateLesson(base, ctx([lesson(1, 2, 10, 1, '08:30', '09:20')]));
    expect(codes(issues)).toEqual(['class-overlap']);
  });

  it('detecta os dois conflitos ao mesmo tempo', () => {
    const issues = validateLesson(base, ctx([lesson(1, 1, 10, 1, '08:00', '09:00')]));
    expect(codes(issues)).toEqual(['class-overlap', 'teacher-overlap']);
  });

  it('não conflita em dias diferentes', () => {
    expect(validateLesson(base, ctx([lesson(1, 1, 10, 2, '08:00', '09:00')]))).toEqual([]);
  });

  it('ignora a própria aula durante a edição', () => {
    expect(validateLesson({ ...base, id: 1 }, ctx([lesson(1, 1, 10, 1, '08:00', '09:00')]))).toEqual([]);
  });

  it('recusa término anterior ou igual ao início', () => {
    expect(codes(validateLesson({ ...base, start: '09:00', end: '09:00' }, ctx([])))).toEqual(['invalid-time']);
    expect(codes(validateLesson({ ...base, start: '10:00', end: '09:00' }, ctx([])))).toEqual(['invalid-time']);
  });

  it('recusa professor ou turma inativos', () => {
    expect(codes(validateLesson({ ...base, teacherId: 3 }, ctx([])))).toEqual(['teacher-inactive']);
    expect(codes(validateLesson({ ...base, classId: 12 }, ctx([])))).toEqual(['class-inactive']);
  });

  it('recusa dia não habilitado', () => {
    expect(codes(validateLesson({ ...base, weekday: 6 }, ctx([])))).toEqual(['day-disabled']);
  });

  it('avisa (sem bloquear) quando a aula está fora da grade do turno', () => {
    const issues = validateLesson({ ...base, start: '15:00', end: '16:00' }, ctx([]));
    expect(codes(issues)).toEqual(['outside-grid']);
    expect(hasBlockingIssues(issues)).toBe(false);
  });

  it('turma integral usa os períodos da manhã e da tarde', () => {
    expect(validateLesson({ ...base, classId: 13, start: '13:00', end: '14:00' }, ctx([]))).toEqual([]);
  });
});

describe('findScheduleConflicts', () => {
  it('encontra pares sobrepostos por professor e por turma', () => {
    const found = findScheduleConflicts([
      lesson(1, 1, 10, 1, '08:00', '09:00'),
      lesson(2, 1, 11, 1, '08:30', '09:30'),
      lesson(3, 2, 11, 1, '09:00', '10:00'),
      lesson(4, 2, 12, 2, '09:00', '10:00'),
    ]);
    expect(found.map((c) => `${c.type}:${c.a.id}-${c.b.id}`).sort()).toEqual(['class:2-3', 'teacher:1-2']);
  });
});

describe('estatísticas da grade', () => {
  it('conta períodos vazios por turma ativa', () => {
    const c = ctx([]);
    const stats = computeSlotStats(c.classes, [lesson(1, 1, 10, 1, '08:00', '09:00')], c.periods, c.settings);
    // turmas ativas: 10 e 11 (manhã, 2 períodos × 5 dias) e 13 (integral, 3 períodos × 5 dias)
    expect(stats.totalSlots).toBe(10 + 10 + 15);
    expect(stats.filledSlots).toBe(1);
  });

  it('identifica aulas fora da grade ou em dias desabilitados', () => {
    const c = ctx([]);
    const out = lessonsOutsideGrid(
      [lesson(1, 1, 10, 1, '08:00', '09:00'), lesson(2, 1, 10, 1, '18:00', '19:00'), lesson(3, 1, 10, 6, '08:00', '09:00')],
      c.periods,
      c.settings.enabledDays,
    );
    expect(out.map((l) => l.id)).toEqual([2, 3]);
  });
});
