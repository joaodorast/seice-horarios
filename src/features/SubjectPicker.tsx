import { Link } from 'react-router';
import { Check } from 'lucide-react';
import { useSubjects } from '@/api/hooks';
import { SUBJECT_STYLE } from '@/lib/subjectColors';
import { cn } from '@/lib/cn';

/** Escolha de várias disciplinas por botões que ligam e desligam (ex.: Geografia + Projeto de Vida). */
export function SubjectPicker({ value, onChange, onNavigate }: { value: number[]; onChange: (ids: number[]) => void; onNavigate?: () => void }) {
  const { data: subjects = [] } = useSubjects();
  const toggle = (id: number) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  if (subjects.length === 0) {
    return (
      <p className="rounded-lg bg-subtle px-3.5 py-2.5 text-[13.5px] text-muted">
        Nenhuma disciplina cadastrada.{' '}
        <Link to="/disciplinas" onClick={onNavigate} className="font-semibold text-ink underline underline-offset-2">
          Cadastrar disciplinas
        </Link>
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Disciplinas que leciona">
      {subjects.map((s) => {
        const on = value.includes(s.id);
        return (
          <button
            key={s.id}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(s.id)}
            className={cn(
              'inline-flex h-9 items-center gap-2 rounded-full border px-3 text-[13.5px] font-semibold transition-[background-color,border-color,color] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink',
              on ? 'border-ink bg-ink text-white' : 'border-line-strong bg-surface text-ink-2 hover:border-soft hover:bg-subtle',
            )}
          >
            {on ? <Check className="size-3.5 text-brand" strokeWidth={3} /> : <span className={cn('size-2.5 rounded-full', SUBJECT_STYLE[s.color].dot)} aria-hidden="true" />}
            {s.name}
          </button>
        );
      })}
    </div>
  );
}

/** Etiquetas das disciplinas de um professor (mostra as primeiras e resume o restante). */
export function SubjectChips({ ids, max = 3, fallback }: { ids: number[]; max?: number; fallback?: string | null }) {
  const { data: subjects = [] } = useSubjects();
  const list = ids.map((id) => subjects.find((s) => s.id === id)).filter((s) => s !== undefined);
  if (list.length === 0) return fallback ? <span className="text-ink-2">{fallback}</span> : <span className="text-soft">—</span>;
  const shown = list.slice(0, max);
  return (
    <span className="flex flex-wrap gap-1.5" title={list.map((s) => s.name).join(', ')}>
      {shown.map((s) => (
        <span key={s.id} className={cn('inline-flex h-6 items-center gap-1.5 rounded-full px-2 text-xs font-semibold', SUBJECT_STYLE[s.color].chip)}>
          <span className={cn('size-1.5 rounded-full', SUBJECT_STYLE[s.color].dot)} aria-hidden="true" />
          {s.name}
        </span>
      ))}
      {list.length > max && <span className="inline-flex h-6 items-center rounded-full bg-subtle px-2 text-xs font-semibold text-muted">+{list.length - max}</span>}
    </span>
  );
}
