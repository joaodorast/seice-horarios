import type { SubjectColor } from '@shared/types';

/** Classes estáticas (o Tailwind precisa enxergá-las no código) para cada cor de disciplina. */
export const SUBJECT_STYLE: Record<SubjectColor, { chip: string; bar: string; dot: string; name: string }> = {
  amber: { chip: 'bg-sub-amber-bg text-sub-amber-ink', bar: 'bg-sub-amber', dot: 'bg-sub-amber', name: 'Amarelo' },
  orange: { chip: 'bg-sub-orange-bg text-sub-orange-ink', bar: 'bg-sub-orange', dot: 'bg-sub-orange', name: 'Laranja' },
  green: { chip: 'bg-sub-green-bg text-sub-green-ink', bar: 'bg-sub-green', dot: 'bg-sub-green', name: 'Verde' },
  indigo: { chip: 'bg-sub-indigo-bg text-sub-indigo-ink', bar: 'bg-sub-indigo', dot: 'bg-sub-indigo', name: 'Azul-arroxeado' },
  rose: { chip: 'bg-sub-rose-bg text-sub-rose-ink', bar: 'bg-sub-rose', dot: 'bg-sub-rose', name: 'Rosa' },
  sky: { chip: 'bg-sub-sky-bg text-sub-sky-ink', bar: 'bg-sub-sky', dot: 'bg-sub-sky', name: 'Azul' },
  teal: { chip: 'bg-sub-teal-bg text-sub-teal-ink', bar: 'bg-sub-teal', dot: 'bg-sub-teal', name: 'Verde-água' },
  violet: { chip: 'bg-sub-violet-bg text-sub-violet-ink', bar: 'bg-sub-violet', dot: 'bg-sub-violet', name: 'Violeta' },
  slate: { chip: 'bg-sub-slate-bg text-sub-slate-ink', bar: 'bg-sub-slate', dot: 'bg-sub-slate', name: 'Cinza' },
  lime: { chip: 'bg-sub-lime-bg text-sub-lime-ink', bar: 'bg-sub-lime', dot: 'bg-sub-lime', name: 'Verde-limão' },
};

export const NO_SUBJECT_STYLE = { chip: 'bg-subtle text-ink-2', bar: 'bg-line-strong', dot: 'bg-line-strong', name: '' };
