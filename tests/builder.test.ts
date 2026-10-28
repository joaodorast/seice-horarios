import { describe, expect, it } from 'vitest';
import { buildCells, cellKey, planSave, type CellValue } from '../shared/builder.js';
import type { Lesson, Period } from '../shared/types.js';

const ts = '2026-01-01T00:00:00.000Z';
const period = (id: number, start: string, end: string): Period => ({ id, shift: 'manha', label: `${id}º`, start, end, kind: 'aula', sortOrder: id });
// 1º, 2º e 3º colados; 4º depois do intervalo.
const periods = [period(1, '07:30', '08:20'), period(2, '08:20', '09:10'), period(3, '09:10', '10:00'), period(4, '10:20', '11:10')];
const days = [1, 2] as const;
const lesson = (id: number, teacherId: number, subjectId: number | null, weekday: 1 | 2, start: string, end: string, notes: string | null = null): Lesson => ({
  id, teacherId, classId: 50, subjectId, weekday, start, end, notes, createdAt: ts, updatedAt: ts,
});

describe('montar quadro: células e salvamento', () => {
  const lessons = [
    lesson(1, 7, 100, 1, '07:30', '09:10', 'Sala 3'), // aula dupla: 1º + 2º
    lesson(2, 8, 101, 1, '10:20', '11:10'),
    lesson(3, 9, 102, 2, '07:45', '08:30'), // fora da grade
  ];
  const cells = buildCells('class', periods, [...days], lessons);

  it('transforma aulas em células (aula dupla ocupa duas; fora da grade fica travada)', () => {
    expect(cells.get(cellKey(1, 1))).toMatchObject({ otherId: 7, subjectId: 100, lessonId: 1, locked: false });
    expect(cells.get(cellKey(1, 2))).toMatchObject({ otherId: 7, lessonId: 1 });
    expect(cells.get(cellKey(1, 3))).toMatchObject({ otherId: null, lessonId: null });
    expect(cells.get(cellKey(2, 1))).toMatchObject({ lessonId: 3, locked: true });
  });

  it('sem alterações, não planeja nada', () => {
    const plan = planSave({ kind: 'class', ownerId: 50, periods, days: [...days], cells, edits: new Map(), lessons });
    expect(plan).toMatchObject({ removeIds: [], creates: [] });
  });

  it('preenche uma célula vazia e une com a vizinha igual quando ela também muda', () => {
    const edits = new Map<string, CellValue>([[cellKey(2, 3), { otherId: 8, subjectId: 101 }], [cellKey(2, 4), { otherId: 8, subjectId: 101 }]]);
    const plan = planSave({ kind: 'class', ownerId: 50, periods, days: [...days], cells, edits, lessons });
    expect(plan.removeIds).toEqual([]);
    // 3º e 4º não são colados (há intervalo): duas aulas separadas.
    expect(plan.creates.map((c) => [c.start, c.end])).toEqual([['09:10', '10:00'], ['10:20', '11:10']]);
  });

  it('trocar metade de uma aula dupla divide a aula e mantém a observação', () => {
    const edits = new Map<string, CellValue>([[cellKey(1, 2), { otherId: 9, subjectId: 102 }]]);
    const plan = planSave({ kind: 'class', ownerId: 50, periods, days: [...days], cells, edits, lessons });
    expect(plan.removeIds).toEqual([1]);
    expect(plan.creates.map((c) => [c.teacherId, c.start, c.end, c.notes])).toEqual([
      [7, '07:30', '08:20', 'Sala 3'],
      [9, '08:20', '09:10', 'Sala 3'],
    ]);
  });

  it('estender uma aula dupla para o período seguinte vira uma aula só (tripla), mantendo a observação', () => {
    const edits = new Map<string, CellValue>([[cellKey(1, 3), { otherId: 7, subjectId: 100 }]]);
    const plan = planSave({ kind: 'class', ownerId: 50, periods, days: [...days], cells, edits, lessons });
    expect(plan.removeIds).toEqual([1]);
    expect(plan.creates).toEqual([expect.objectContaining({ start: '07:30', end: '10:00', notes: 'Sala 3' })]);
  });

  it('limpar uma célula remove a aula; disciplina sem professor é apontada como erro', () => {
    const edits = new Map<string, CellValue>([
      [cellKey(1, 4), { otherId: null, subjectId: null }],
      [cellKey(2, 3), { otherId: null, subjectId: 100 }],
    ]);
    const plan = planSave({ kind: 'class', ownerId: 50, periods, days: [...days], cells, edits, lessons });
    expect(plan.removeIds).toEqual([2]);
    expect(plan.creates).toEqual([]);
    expect(plan.errors.get(cellKey(2, 3))).toMatch(/professor/);
  });

  it('no quadro do professor, o "outro" é a turma', () => {
    const own = [lesson(10, 7, 100, 1, '07:30', '08:20')];
    const tc = buildCells('teacher', periods, [...days], own);
    expect(tc.get(cellKey(1, 1))?.otherId).toBe(50);
    const plan = planSave({ kind: 'teacher', ownerId: 7, periods, days: [...days], cells: tc, edits: new Map([[cellKey(1, 2), { otherId: 51, subjectId: 100 }]]), lessons: own });
    expect(plan.creates[0]).toMatchObject({ teacherId: 7, classId: 51, start: '08:20' });
  });
});
