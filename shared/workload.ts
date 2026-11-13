import { shiftsOfClass } from './labels.js';
import { overlaps } from './time.js';
import { durationMinutes } from './time.js';
import type { Lesson, Period, SchoolClass, Teacher } from './types.js';

/** Quantidade de aulas e minutos semanais. */
export interface Load {
  lessons: number;
  minutes: number;
}

export interface SubjectLoad {
  subjectId: number | null;
  byClass: Map<number, Load>;
  total: Load;
}

export interface TeacherLoad {
  teacher: Teacher;
  byClass: Map<number, Load>;
  bySubject: SubjectLoad[];
  total: Load;
}

export interface Workload {
  rows: TeacherLoad[];
  classes: SchoolClass[];
  classTotals: Map<number, Load>;
  grand: Load;
}

const empty = (): Load => ({ lessons: 0, minutes: 0 });
const add = (load: Load, minutes: number, units: number) => {
  load.lessons += units;
  load.minutes += minutes;
};
const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true });

/**
 * Carga horária semanal: para cada professor, as aulas e horas em cada turma (e por disciplina),
 * com os totais por professor, por turma e geral. Entram os professores e turmas ativos e
 * também os inativos que ainda tenham aulas no quadro.
 */
export function computeWorkload(
  lessons: Lesson[],
  teachers: Teacher[],
  classes: SchoolClass[],
  classFilter?: (c: SchoolClass) => boolean,
  /** Quantas aulas cada registro vale (ex.: aula dupla = 2). Por padrão, 1. */
  unitsOf: (l: Lesson) => number = () => 1,
): Workload {
  const visibleClasses = classes.filter((c) => (c.active || lessons.some((l) => l.classId === c.id)) && (!classFilter || classFilter(c))).sort(byName);
  const visibleIds = new Set(visibleClasses.map((c) => c.id));
  const scoped = lessons.filter((l) => visibleIds.has(l.classId));

  const classTotals = new Map<number, Load>(visibleClasses.map((c) => [c.id, empty()]));
  const grand = empty();
  const rows: TeacherLoad[] = [];

  for (const teacher of [...teachers].sort(byName)) {
    const own = scoped.filter((l) => l.teacherId === teacher.id);
    if (!teacher.active && own.length === 0) continue;
    const row: TeacherLoad = { teacher, byClass: new Map(), bySubject: [], total: empty() };
    const subjects = new Map<number | null, SubjectLoad>();
    for (const l of own) {
      const minutes = durationMinutes(l.start, l.end);
      const units = unitsOf(l);
      if (!row.byClass.has(l.classId)) row.byClass.set(l.classId, empty());
      add(row.byClass.get(l.classId)!, minutes, units);
      add(row.total, minutes, units);
      add(classTotals.get(l.classId)!, minutes, units);
      add(grand, minutes, units);
      if (!subjects.has(l.subjectId)) subjects.set(l.subjectId, { subjectId: l.subjectId, byClass: new Map(), total: empty() });
      const s = subjects.get(l.subjectId)!;
      if (!s.byClass.has(l.classId)) s.byClass.set(l.classId, empty());
      add(s.byClass.get(l.classId)!, minutes, units);
      add(s.total, minutes, units);
    }
    row.bySubject = [...subjects.values()].sort((a, b) => b.total.lessons - a.total.lessons);
    rows.push(row);
  }
  return { rows, classes: visibleClasses, classTotals, grand };
}

/** Uma aula que abrange tempos consecutivos conta cada tempo uma vez. */
export function lessonTimeCount(lesson: Lesson, periods: Period[], classes: SchoolClass[]): number {
  const schoolClass = classes.find((item) => item.id === lesson.classId);
  return Math.max(1, periods.filter((period) =>
    period.kind === 'aula'
    && (!schoolClass || shiftsOfClass(schoolClass.shift).includes(period.shift))
    && overlaps(period.start, period.end, lesson.start, lesson.end),
  ).length);
}
