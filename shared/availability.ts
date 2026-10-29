import { WEEKDAY_LABEL } from './labels.js';
import type { AvailabilitySlot, Lesson, Teacher, Weekday } from './types.js';

/**
 * Dias e horários do professor na escola. Sem nada cadastrado, o professor pode receber aulas em qualquer
 * horário; com algo cadastrado, só dentro desses intervalos.
 */
export const hasAvailability = (t: Pick<Teacher, 'availability'> | undefined) => Boolean(t?.availability?.length);

/** O professor está na escola durante todo o intervalo? */
export function isAvailable(t: Pick<Teacher, 'availability'> | undefined, weekday: Weekday, start: string, end: string): boolean {
  if (!hasAvailability(t)) return true;
  return t!.availability.some((a) => a.weekday === weekday && a.start <= start && a.end >= end);
}

export const slotsOfDay = (t: Pick<Teacher, 'availability'> | undefined, weekday: Weekday): AvailabilitySlot[] =>
  (t?.availability ?? []).filter((a) => a.weekday === weekday).sort((a, b) => a.start.localeCompare(b.start));

/** "07:00 às 12:20" ou "07:00 às 12:20 e 13:00 às 17:30". */
export const rangesText = (slots: { start: string; end: string }[]) => slots.map((s) => `${s.start} às ${s.end}`).join(' e ');

/** Por que o professor não pode dar aula neste horário, em uma frase curta (para listas e dicas). */
export function unavailableReason(t: Pick<Teacher, 'availability'> | undefined, weekday: Weekday): string {
  const day = slotsOfDay(t, weekday);
  const name = WEEKDAY_LABEL[weekday].replace('-feira', '').toLowerCase();
  return day.length ? `${name}: só ${rangesText(day)}` : `não vem ${weekday === 6 ? 'no sábado' : `na ${name}`}`;
}

/** Aulas do professor que ficam fora dos dias e horários informados. */
export const lessonsOutsideAvailability = (t: Pick<Teacher, 'id' | 'availability'>, lessons: Lesson[]) =>
  lessons.filter((l) => l.teacherId === t.id && !isAvailable(t, l.weekday, l.start, l.end));
