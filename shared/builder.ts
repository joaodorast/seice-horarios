import type { LessonInput } from './schemas.js';
import type { Lesson, Period, Weekday } from './types.js';

/**
 * "Montar quadro": a semana de uma turma (ou de um professor) como uma grade de células dia × período,
 * em que cada célula guarda disciplina + professor (ou disciplina + turma). Este módulo converte as aulas
 * em células e planeja o salvamento das células alteradas como remoções e criações de aulas.
 */
export type BuilderKind = 'class' | 'teacher';

/** Valor de uma célula: "outro" é o professor (quadro da turma) ou a turma (quadro do professor). */
export interface CellValue {
  otherId: number | null;
  subjectId: number | null;
}

export interface Cell extends CellValue {
  /** Aula que hoje ocupa a célula (pode ocupar várias, numa aula dupla). */
  lessonId: number | null;
  /** Aula com horário fora dos períodos da grade: só pode ser alterada pelo formulário completo. */
  locked: boolean;
}

export const cellKey = (day: Weekday, periodId: number) => `${day}:${periodId}`;
export const EMPTY: CellValue = { otherId: null, subjectId: null };
export const sameValue = (a: CellValue, b: CellValue) => a.otherId === b.otherId && a.subjectId === b.subjectId;
export const isEmpty = (v: CellValue) => v.otherId === null && v.subjectId === null;

const otherOf = (kind: BuilderKind, l: Lesson) => (kind === 'class' ? l.teacherId : l.classId);

/** Períodos de aula cobertos por inteiro pela aula. */
function covered(periods: Period[], l: Lesson) {
  return periods.filter((p) => p.start >= l.start && p.end <= l.end);
}

/** Converte as aulas do dono (turma ou professor) em células da grade. */
export function buildCells(kind: BuilderKind, periods: Period[], days: Weekday[], lessons: Lesson[]): Map<string, Cell> {
  const cells = new Map<string, Cell>();
  for (const d of days) for (const p of periods) cells.set(cellKey(d, p.id), { ...EMPTY, lessonId: null, locked: false });
  for (const l of lessons) {
    if (!days.includes(l.weekday)) continue;
    const span = covered(periods, l);
    // Alinhada à grade: começa no início de um período e termina no fim de outro, sem buracos.
    const aligned =
      span.length > 0 &&
      span[0].start === l.start &&
      span[span.length - 1].end === l.end &&
      span.every((p, i) => i === 0 || span[i - 1].end === p.start);
    const touched = aligned ? span : periods.filter((p) => p.start < l.end && l.start < p.end);
    for (const p of touched) {
      cells.set(cellKey(l.weekday, p.id), { otherId: otherOf(kind, l), subjectId: l.subjectId, lessonId: l.id, locked: !aligned });
    }
  }
  return cells;
}

export interface SavePlan {
  removeIds: number[];
  creates: LessonInput[];
  /** Células com problema (ex.: disciplina sem professor), por chave. */
  errors: Map<string, string>;
}

/**
 * Planeja o salvamento das células alteradas: as aulas que ocupavam essas células saem, e as células
 * preenchidas viram aulas novas. Células coladas com o mesmo valor viram uma única aula (aula dupla),
 * e as observações da aula original são mantidas.
 */
export function planSave(args: {
  kind: BuilderKind;
  ownerId: number;
  periods: Period[];
  days: Weekday[];
  cells: Map<string, Cell>;
  edits: Map<string, CellValue>;
  lessons: Lesson[];
}): SavePlan {
  const { kind, ownerId, periods, days, cells, edits, lessons } = args;
  const errors = new Map<string, string>();
  const valueOf = (key: string): CellValue => edits.get(key) ?? cells.get(key) ?? EMPTY;

  const changed = [...edits.keys()].filter((k) => cells.get(k) && !sameValue(edits.get(k)!, cells.get(k)!));
  const affected = new Set<number>();
  for (const k of changed) {
    const id = cells.get(k)!.lessonId;
    if (id !== null) affected.add(id);
  }
  // Célula alterada igual à vizinha colada: a aula da vizinha entra na reconstrução para virar uma aula só (dupla, tripla…).
  for (const k of changed) {
    const v = valueOf(k);
    if (isEmpty(v)) continue;
    const [day, pid] = k.split(':').map(Number);
    const i = periods.findIndex((p) => p.id === pid);
    for (const j of [i - 1, i + 1]) {
      const n = periods[j];
      if (!n || !(n.end === periods[i].start || periods[i].end === n.start)) continue;
      const neighbor = cells.get(cellKey(day as Weekday, n.id));
      if (neighbor?.lessonId != null && !neighbor.locked && sameValue(valueOf(cellKey(day as Weekday, n.id)), v)) affected.add(neighbor.lessonId);
    }
  }
  // Células a reconstruir: as alteradas e todas as cobertas pelas aulas afetadas (ex.: a outra metade de uma aula dupla).
  const rebuild = new Set(changed);
  for (const [k, c] of cells) if (c.lessonId !== null && affected.has(c.lessonId)) rebuild.add(k);

  const notesOf = (key: string) => {
    const id = cells.get(key)?.lessonId;
    return id !== null && id !== undefined ? (lessons.find((l) => l.id === id)?.notes ?? null) : null;
  };

  const creates: LessonInput[] = [];
  for (const d of days) {
    let run: { key: string; period: Period; value: CellValue }[] = [];
    const flush = () => {
      if (run.length === 0) return;
      const v = run[0].value;
      const otherId = v.otherId!;
      creates.push({
        teacherId: kind === 'class' ? otherId : ownerId,
        classId: kind === 'class' ? ownerId : otherId,
        subjectId: v.subjectId,
        weekday: d,
        start: run[0].period.start,
        end: run[run.length - 1].period.end,
        notes: notesOf(run[0].key),
      });
      run = [];
    };
    for (const p of periods) {
      const key = cellKey(d, p.id);
      if (!rebuild.has(key)) {
        flush();
        continue;
      }
      const v = valueOf(key);
      if (isEmpty(v)) {
        flush();
        continue;
      }
      if (v.otherId === null) {
        errors.set(key, kind === 'class' ? 'Escolha o professor desta aula.' : 'Escolha a turma desta aula.');
        flush();
        continue;
      }
      const last = run[run.length - 1];
      const continues = last && last.period.end === p.start && sameValue(last.value, v);
      if (!continues) flush();
      run.push({ key, period: p, value: v });
    }
    flush();
  }
  return { removeIds: [...affected], creates, errors };
}
