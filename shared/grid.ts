import { shiftsOfClass } from './labels.js';
import { overlaps, toMinutes } from './time.js';
import type { ClassShift, Lesson, Period, SchoolClass, Settings, ShiftKey, Weekday } from './types.js';

export function sortPeriods(periods: Period[]): Period[] {
  return [...periods].sort((a, b) => toMinutes(a.start) - toMinutes(b.start) || a.sortOrder - b.sortOrder);
}

export function periodsForShifts(periods: Period[], shifts: ShiftKey[]): Period[] {
  return sortPeriods(periods.filter((p) => shifts.includes(p.shift)));
}

export function periodsForClassShift(periods: Period[], shift: ClassShift): Period[] {
  return periodsForShifts(periods, shiftsOfClass(shift));
}

export function lessonsInPeriod(lessons: Lesson[], weekday: Weekday, period: Period): Lesson[] {
  return lessons
    .filter((l) => l.weekday === weekday && overlaps(l.start, l.end, period.start, period.end))
    .sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
}

/** Aulas que não cabem em nenhum período de aula dos turnos informados ou estão em dias desabilitados. */
export function lessonsOutsideGrid(lessons: Lesson[], periods: Period[], enabledDays: Weekday[]): Lesson[] {
  const lessonPeriods = periods.filter((p) => p.kind === 'aula');
  return lessons.filter(
    (l) =>
      !enabledDays.includes(l.weekday) ||
      !lessonPeriods.some((p) => overlaps(p.start, p.end, l.start, l.end)),
  );
}

export interface SlotStats {
  totalSlots: number;
  filledSlots: number;
  emptySlots: number;
  emptyByClass: { classId: number; empty: number; total: number }[];
}

/** Calcula, para cada turma ativa, quantos períodos de aula da semana ainda não têm aula. */
export function computeSlotStats(
  classes: SchoolClass[],
  lessons: Lesson[],
  periods: Period[],
  settings: Settings,
): SlotStats {
  let totalSlots = 0;
  let filledSlots = 0;
  const emptyByClass: SlotStats['emptyByClass'] = [];
  for (const schoolClass of classes.filter((c) => c.active)) {
    const shifts = shiftsOfClass(schoolClass.shift).filter((s) => settings.enabledShifts.includes(s));
    const classPeriods = periodsForShifts(periods, shifts).filter((p) => p.kind === 'aula');
    const classLessons = lessons.filter((l) => l.classId === schoolClass.id);
    let total = 0;
    let filled = 0;
    for (const day of settings.enabledDays) {
      for (const period of classPeriods) {
        total++;
        if (lessonsInPeriod(classLessons, day, period).length > 0) filled++;
      }
    }
    totalSlots += total;
    filledSlots += filled;
    emptyByClass.push({ classId: schoolClass.id, empty: total - filled, total });
  }
  return { totalSlots, filledSlots, emptySlots: totalSlots - filledSlots, emptyByClass };
}
