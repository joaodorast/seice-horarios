import type { ClassShift, ShiftKey, Weekday } from './types.js';

export const WEEKDAY_LABEL: Record<Weekday, string> = {
  1: 'Segunda-feira',
  2: 'Terça-feira',
  3: 'Quarta-feira',
  4: 'Quinta-feira',
  5: 'Sexta-feira',
  6: 'Sábado',
};

export const WEEKDAY_SHORT: Record<Weekday, string> = {
  1: 'Seg',
  2: 'Ter',
  3: 'Qua',
  4: 'Qui',
  5: 'Sex',
  6: 'Sáb',
};

export const SHIFT_LABEL: Record<ClassShift, string> = {
  manha: 'Manhã',
  tarde: 'Tarde',
  noite: 'Noite',
  integral: 'Integral',
};

/** Turnos de grade (períodos) que compõem cada turno de turma. */
export function shiftsOfClass(shift: ClassShift): ShiftKey[] {
  return shift === 'integral' ? ['manha', 'tarde'] : [shift];
}
