import { useMemo, useState, type ReactNode } from 'react';
import { ArrowLeftRight, CalendarX2, CheckCircle2, Replace, UserRoundCog } from 'lucide-react';
import { Alert, Button, Combobox, Modal, useToast, type ComboOption } from '@/components/ui';
import { useLessonBatch, type ScheduleData } from '@/api/hooks';
import { ApiError, errorMessage } from '@/api/client';
import { hasBlockingIssues, validateLesson } from '@shared/conflicts';
import { WEEKDAY_LABEL } from '@shared/labels';
import type { LessonInput } from '@shared/schemas';
import type { Lesson } from '@shared/types';
import { cn } from '@/lib/cn';

/** Aula que ocupa o horário desejado, e se ocupa por causa da turma, do professor ou de ambos. */
export interface Occupant {
  lesson: Lesson;
  classConflict: boolean;
  teacherConflict: boolean;
}

type Choice = { kind: 'replace' } | { kind: 'remove' } | { kind: 'swap' } | { kind: 'reassign'; teacherId: number | null };

const asInput = (l: Lesson): LessonInput => ({
  teacherId: l.teacherId,
  classId: l.classId,
  subjectId: l.subjectId,
  weekday: l.weekday,
  start: l.start,
  end: l.end,
  notes: l.notes,
});

/**
 * Quando o horário escolhido já está ocupado, pergunta o que fazer com cada aula que está nele:
 * substituir, trocar de horário (ao mover uma aula existente) ou passar a aula para outro professor.
 * Tudo é aplicado de uma vez, e só se não sobrar nenhum conflito.
 */
export function ConflictResolver({
  open,
  data,
  draft,
  original,
  occupants,
  onCancel,
  onDone,
}: {
  open: boolean;
  data: ScheduleData;
  /** Aula que se quer salvar. */
  draft: LessonInput;
  /** Aula sendo editada (permite "trocar horários"); ausente ao criar uma aula nova. */
  original?: Lesson;
  occupants: Occupant[];
  onCancel: () => void;
  onDone: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      size="md"
      dismissible={false}
      title="Este horário já está ocupado"
      description="Escolha o que fazer com a aula que está neste horário. Nada muda até você confirmar."
    >
      {open && <ResolverBody data={data} draft={draft} original={original} occupants={occupants} onCancel={onCancel} onDone={onDone} />}
    </Modal>
  );
}

function ResolverBody({
  data,
  draft,
  original,
  occupants,
  onCancel,
  onDone,
}: {
  data: ScheduleData;
  draft: LessonInput;
  original?: Lesson;
  occupants: Occupant[];
  onCancel: () => void;
  onDone: () => void;
}) {
  const [choices, setChoices] = useState<Record<number, Choice | undefined>>({});
  const [error, setError] = useState<string | null>(null);
  const batch = useLessonBatch();
  const toast = useToast();

  const teacherName = (id: number) => data.teachers.find((t) => t.id === id)?.name ?? 'professor removido';
  const className = (id: number) => data.classes.find((c) => c.id === id)?.name ?? 'turma removida';
  const subjectName = (id: number | null) => (id ? data.subjects.find((s) => s.id === id)?.name : undefined);
  const when = (l: { weekday: Lesson['weekday']; start: string; end: string }) => `${WEEKDAY_LABEL[l.weekday].toLowerCase()}, ${l.start}–${l.end}`;
  const describe = (l: Lesson) => [subjectName(l.subjectId) ?? 'Aula', `com ${teacherName(l.teacherId)}`, `na turma ${className(l.classId)}`].join(' ');

  const occupantIds = new Set(occupants.map((o) => o.lesson.id));
  /** Quadro sem a aula editada nem as aulas em conflito: base para conferir as alternativas. */
  const baseLessons = useMemo(
    () => data.lessons.filter((l) => l.id !== original?.id && !occupantIds.has(l.id)),
    [data.lessons, original?.id, occupants],
  );

  /** "Trocar horários": a aula em conflito cabe no horário antigo da aula que está sendo movida? */
  const canSwap = (l: Lesson) => {
    if (!original || (original.weekday === draft.weekday && original.start === draft.start)) return false;
    const moved = { ...asInput(l), weekday: original.weekday, start: original.start, end: original.end };
    return !hasBlockingIssues(validateLesson(moved, { ...data, lessons: baseLessons }));
  };

  /** Professores livres para assumir a aula em conflito (quem leciona a disciplina aparece primeiro). */
  const freeTeachers = (l: Lesson): ComboOption[] =>
    data.teachers
      .filter((t) => t.active && t.id !== draft.teacherId && t.id !== l.teacherId)
      .filter((t) => !hasBlockingIssues(validateLesson({ ...asInput(l), teacherId: t.id }, { ...data, lessons: data.lessons.filter((x) => x.id !== l.id) })))
      .sort((a, b) => Number(l.subjectId !== null && b.subjectIds.includes(l.subjectId)) - Number(l.subjectId !== null && a.subjectIds.includes(l.subjectId)) || a.name.localeCompare(b.name, 'pt-BR'))
      .map((t) => ({
        value: t.id,
        label: t.name,
        description: l.subjectId !== null && t.subjectIds.includes(l.subjectId) ? `Leciona ${subjectName(l.subjectId)} · livre neste horário` : 'Livre neste horário',
      }));

  const complete = occupants.every((o) => {
    const c = choices[o.lesson.id];
    return c && (c.kind !== 'reassign' || c.teacherId !== null);
  });

  // Resumo em linguagem simples do que será feito.
  const summary: string[] = [];
  for (const o of occupants) {
    const c = choices[o.lesson.id];
    if (!c) continue;
    if (c.kind === 'replace' || c.kind === 'remove') summary.push(`${describe(o.lesson)} (${when(o.lesson)}) será removida.`);
    if (c.kind === 'swap' && original) summary.push(`${describe(o.lesson)} vai para ${when(original)}.`);
    if (c.kind === 'reassign' && c.teacherId) summary.push(`A aula da turma ${className(o.lesson.classId)} (${when(o.lesson)}) passa para ${teacherName(c.teacherId)}.`);
  }
  summary.push(
    original
      ? `A aula de ${teacherName(draft.teacherId)} na turma ${className(draft.classId)} vai para ${when(draft)}.`
      : `A nova aula${subjectName(draft.subjectId ?? null) ? ` de ${subjectName(draft.subjectId ?? null)}` : ''} com ${teacherName(draft.teacherId)} na turma ${className(draft.classId)} será salva em ${when(draft)}.`,
  );

  async function apply() {
    setError(null);
    const removeIds: number[] = [];
    const updates: { id: number; input: LessonInput }[] = [];
    const creates: LessonInput[] = [];
    for (const o of occupants) {
      const c = choices[o.lesson.id]!;
      if (c.kind === 'replace' || c.kind === 'remove') removeIds.push(o.lesson.id);
      if (c.kind === 'reassign') updates.push({ id: o.lesson.id, input: { ...asInput(o.lesson), teacherId: c.teacherId! } });
      if (c.kind === 'swap' && original) {
        removeIds.push(o.lesson.id);
        creates.push({ ...asInput(o.lesson), weekday: original.weekday, start: original.start, end: original.end });
      }
    }
    // A aula principal vem depois das trocas de professor, que liberam o horário.
    if (original) updates.push({ id: original.id, input: draft });
    else creates.unshift(draft);
    try {
      await batch.mutateAsync({ removeIds, updates, creates });
      toast.success('Quadro reorganizado', `${summary.length} ${summary.length === 1 ? 'mudança aplicada' : 'mudanças aplicadas'}.`);
      onDone();
    } catch (err) {
      setError(err instanceof ApiError && err.issues?.length ? err.issues[0].message : errorMessage(err));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {occupants.map((o) => {
        const l = o.lesson;
        const choice = choices[l.id];
        const set = (c: Choice) => setChoices((all) => ({ ...all, [l.id]: c }));
        const sameClass = o.classConflict;
        const teachers = !sameClass ? freeTeachers(l) : [];
        return (
          <section key={l.id} className="rounded-xl border border-line-strong bg-surface">
            <header className="border-b border-line px-4 py-3">
              <p className="text-[13px] font-semibold text-danger">
                {sameClass ? `A turma ${className(l.classId)} já tem aula neste horário` : `${teacherName(l.teacherId)} já dá aula neste horário em outra turma`}
              </p>
              <p className="mt-0.5 text-[15px] font-bold text-ink">
                {describe(l)} <span className="font-medium text-muted">· {when(l)}</span>
              </p>
            </header>
            <div className="flex flex-col gap-2 p-3" role="radiogroup" aria-label={`O que fazer com ${describe(l)}`}>
              {sameClass ? (
                <Option
                  icon={<Replace />}
                  active={choice?.kind === 'replace'}
                  onSelect={() => set({ kind: 'replace' })}
                  title="Substituir"
                  text={`${original ? 'Esta aula' : 'A nova aula'} fica neste horário e a aula de ${teacherName(l.teacherId)} sai do quadro.`}
                />
              ) : (
                <>
                  <Option
                    icon={<UserRoundCog />}
                    active={choice?.kind === 'reassign'}
                    onSelect={() => set({ kind: 'reassign', teacherId: choice?.kind === 'reassign' ? choice.teacherId : null })}
                    title="Passar essa aula para outro professor"
                    text={
                      teachers.length
                        ? `A turma ${className(l.classId)} continua com a aula, com um professor que está livre neste horário.`
                        : 'Nenhum outro professor está livre neste horário.'
                    }
                    disabled={!teachers.length}
                  >
                    {choice?.kind === 'reassign' && (
                      <div className="mt-2.5" onClick={(e) => e.stopPropagation()}>
                        <Combobox
                          options={teachers}
                          value={choice.teacherId}
                          onChange={(v) => set({ kind: 'reassign', teacherId: v })}
                          placeholder="Escolha quem vai dar essa aula"
                          autoFocusTarget
                        />
                      </div>
                    )}
                  </Option>
                  <Option
                    icon={<CalendarX2 />}
                    active={choice?.kind === 'remove'}
                    onSelect={() => set({ kind: 'remove' })}
                    title="Remover essa aula"
                    text={`A turma ${className(l.classId)} fica sem aula neste horário.`}
                  />
                </>
              )}
              {canSwap(l) && original && (
                <Option
                  icon={<ArrowLeftRight />}
                  active={choice?.kind === 'swap'}
                  onSelect={() => set({ kind: 'swap' })}
                  title="Trocar os horários"
                  text={`Essa aula vai para o horário antigo: ${when(original)}.`}
                />
              )}
            </div>
          </section>
        );
      })}

      {complete && (
        <div className="rounded-xl bg-subtle px-4 py-3" aria-live="polite">
          <p className="flex items-center gap-2 text-[13px] font-bold text-ink">
            <CheckCircle2 className="size-4 text-success" /> O que vai acontecer
          </p>
          <ul className="mt-1.5 list-disc space-y-1 pl-6 text-[14px] text-ink-2">
            {summary.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      )}
      {error && <Alert tone="danger" title="Não foi possível aplicar">{error}</Alert>}

      <div className="-mx-5 -mb-5 flex flex-col-reverse gap-2 border-t border-line bg-subtle px-5 py-3.5 sm:-mx-6 sm:flex-row sm:items-center sm:justify-end sm:px-6">
        {!complete && (
          <p className="text-[13px] text-muted sm:mr-auto" role="status">
            {occupants.some((o) => choices[o.lesson.id]?.kind === 'reassign')
              ? 'Escolha o professor que vai assumir a aula.'
              : 'Escolha uma opção para cada aula acima.'}
          </p>
        )}
        <Button onClick={onCancel} disabled={batch.isPending}>
          Escolher outro horário
        </Button>
        <Button variant="primary" onClick={() => void apply()} disabled={!complete} loading={batch.isPending}>
          Confirmar e salvar
        </Button>
      </div>
    </div>
  );
}

function Option({
  icon,
  title,
  text,
  active,
  onSelect,
  disabled,
  children,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  active: boolean;
  onSelect: () => void;
  disabled?: boolean;
  children?: ReactNode;
}) {
  return (
    <div
      role="radio"
      aria-checked={active}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : 0}
      onClick={() => !disabled && onSelect()}
      onKeyDown={(e) => {
        // Só o próprio cartão: teclas digitadas na lista de professores (dentro dele) não podem desfazer a escolha.
        if (e.target !== e.currentTarget) return;
        if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        'flex cursor-pointer gap-3 rounded-lg border px-3.5 py-3 text-left transition-[border-color,background-color] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink',
        active ? 'border-ink bg-brand-soft shadow-[inset_0_0_0_1px_var(--color-ink)]' : 'border-line bg-surface hover:border-soft hover:bg-subtle',
        disabled && 'cursor-not-allowed opacity-50 hover:border-line hover:bg-surface',
      )}
    >
      <span className={cn('mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg [&>svg]:size-[18px]', active ? 'bg-ink text-brand' : 'bg-subtle text-ink-2')}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14.5px] font-bold text-ink">{title}</span>
        <span className="mt-0.5 block text-[13.5px] leading-snug text-muted">{text}</span>
        {children}
      </span>
    </div>
  );
}
