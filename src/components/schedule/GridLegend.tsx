import { cn } from '@/lib/cn';

/**
 * "Como ler a grade": explica em uma linha as cores e os símbolos das grades de horário.
 * - day: quadro geral de um dia (vazio aparece ao passar o mouse);
 * - week: quadro geral da semana inteira (vagos aparecem tracejados);
 * - entity: semana de um professor ou de uma turma.
 */
export function GridLegend({ variant, canCreate = true, className }: { variant: 'day' | 'week' | 'entity'; canCreate?: boolean; className?: string }) {
  const item = (swatch: string, label: string, text: string) => (
    <span className="inline-flex items-center gap-2">
      <span className={cn('inline-block h-4 w-6 shrink-0 rounded', swatch)} aria-hidden="true" />
      <span>
        <strong className="text-ink">{label}</strong>: {text}
      </span>
    </span>
  );
  const empty =
    variant === 'week'
      ? 'turma sem aula. Clique para lançar uma'
      : canCreate
        ? 'horário livre. Passe o mouse e clique em + para lançar uma aula'
        : 'horário livre';
  return (
    <div className={cn('flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl bg-surface px-4 py-2.5 text-[13px] text-ink-2 ring-1 ring-line', className)}>
      <span className="font-bold text-ink">Como ler a grade:</span>
      {item('bg-sub-sky-bg ring-1 ring-sub-sky/45 ring-inset', 'Colorido', 'aula marcada (a cor é a da disciplina). Clique para ver, editar ou excluir')}
      {item('border border-dashed border-line-strong bg-subtle', variant === 'week' ? 'Vago' : 'Vazio', empty)}
      {item('bg-surface ring-2 ring-danger ring-inset', 'Borda vermelha', 'conflito de horário')}
    </div>
  );
}
