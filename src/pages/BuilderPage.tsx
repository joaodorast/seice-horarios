import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useBlocker, useNavigate, useParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ChevronLeft, ChevronRight, Coffee, Lock, Save, Settings2, Undo2, X } from 'lucide-react';
import { Page } from '@/components/layout/Page';
import { DataGate } from '@/components/layout/DataGate';
import { Button, Card, Combobox, ConfirmDialog, Modal, Segmented, useToast } from '@/components/ui';
import { keys, useLessonBatch, useSaveTeacher, useScheduleData, type ScheduleData } from '@/api/hooks';
import { ApiError, errorMessage } from '@/api/client';
import { useScheduleActions } from '@/components/schedule/ScheduleActions';
import { SubjectPicker } from '@/features/SubjectPicker';
import { buildCells, cellKey, EMPTY, isEmpty, planSave, sameValue, type BuilderKind, type Cell, type CellValue } from '@shared/builder';
import { periodsForClassShift, periodsForShifts } from '@shared/grid';
import { SHIFT_LABEL, WEEKDAY_LABEL, WEEKDAY_SHORT, shiftsOfClass } from '@shared/labels';
import { teacherSubjectIds } from '@shared/suggest';
import { durationMinutes, overlaps } from '@shared/time';
import { SHIFT_KEYS, type Period, type ShiftKey, type Weekday } from '@shared/types';
import { SUBJECT_STYLE } from '@/lib/subjectColors';
import { CellPicker, type PickerGroup } from '@/components/schedule/CellPicker';
import { formatHours } from '@/lib/format';
import { plural } from '@/lib/text';
import { cn } from '@/lib/cn';
import { GUIDES } from '@/lib/guides';

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true });
const firstName = (name: string) => name.trim().split(/\s+/)[0];

/** "Montar quadro": preencher a semana de uma turma (disciplina + professor) ou de um professor (turma + disciplina) direto na grade. */
export function BuilderPage({ kind }: { kind: BuilderKind }) {
  const schedule = useScheduleData();
  const navigate = useNavigate();
  const { id } = useParams();
  const base = kind === 'class' ? '/horarios/montar/turma' : '/horarios/montar/professor';

  const list = useMemo(() => {
    const d = schedule.data;
    if (!d) return [];
    return (kind === 'class' ? d.classes : d.teachers).filter((e) => e.active).sort(byName);
  }, [schedule.data, kind]);
  const selectedId = Number(id) || null;
  const selected = list.find((e) => e.id === selectedId);

  useEffect(() => {
    if (schedule.data && !selected && list.length) navigate(`${base}/${list[0].id}`, { replace: true });
  }, [schedule.data, selected, list, base, navigate]);

  return (
    <Page
      title="Montar quadro"
      width="wide"
      guide={kind === 'class' ? GUIDES.builderClass : GUIDES.builderTeacher}
      breadcrumbs={[{ label: 'Quadro de horários', to: '/horarios' }, { label: 'Montar quadro' }, ...(selected ? [{ label: selected.name }] : [])]}
      description={
        kind === 'class'
          ? 'Preencha a semana da turma direto na grade: escolha a disciplina e o professor de cada horário. Nada é gravado até você clicar em Salvar.'
          : 'Preencha a semana do professor direto na grade: escolha a turma e a disciplina de cada horário. Nada é gravado até você clicar em Salvar.'
      }
      actions={
        <Segmented
          label="Montar quadro por"
          value={kind}
          onChange={(v) => navigate(v === 'class' ? '/horarios/montar/turma' : '/horarios/montar/professor')}
          options={[
            { value: 'class', label: 'Por turma' },
            { value: 'teacher', label: 'Por professor' },
          ]}
        />
      }
    >
      <DataGate data={schedule.data} isLoading={schedule.isLoading} error={schedule.error} onRetry={schedule.refetch}>
        {(data) =>
          !selected ? (
            <Card className="p-8 text-center text-muted">
              {list.length === 0 ? `Cadastre ${kind === 'class' ? 'turmas' : 'professores'} ativos para montar o quadro.` : 'Carregando…'}
            </Card>
          ) : (
            <Builder key={`${kind}-${selected.id}`} kind={kind} ownerId={selected.id} data={data} list={list} onPick={(eid) => navigate(`${base}/${eid}`)} />
          )
        }
      </DataGate>
    </Page>
  );
}

export const ClassBuilderPage = () => <BuilderPage kind="class" />;
export const TeacherBuilderPage = () => <BuilderPage kind="teacher" />;

// ------------------------------------------------------------------ Grade editável

function Builder({
  kind,
  ownerId,
  data,
  list,
  onPick,
}: {
  kind: BuilderKind;
  ownerId: number;
  data: ScheduleData;
  list: { id: number; name: string }[];
  onPick: (id: number) => void;
}) {
  const [edits, setEdits] = useState<Map<string, CellValue>>(new Map());
  const [errors, setErrors] = useState<Map<string, string>>(new Map());
  const [saveError, setSaveError] = useState<string | null>(null);
  const batch = useLessonBatch();
  const qc = useQueryClient();
  const toast = useToast();
  const actions = useScheduleActions();

  const schoolClass = kind === 'class' ? data.classes.find((c) => c.id === ownerId) : undefined;
  const teacher = kind === 'teacher' ? data.teachers.find((t) => t.id === ownerId) : undefined;
  const owned = useMemo(
    () => data.lessons.filter((l) => (kind === 'class' ? l.classId === ownerId : l.teacherId === ownerId)),
    [data.lessons, kind, ownerId],
  );
  const others = useMemo(() => data.lessons.filter((l) => !owned.includes(l)), [data.lessons, owned]);

  // Períodos: os do turno da turma; para o professor, os turnos habilitados e os em que ele já tem aulas.
  const allPeriods: Period[] = useMemo(() => {
    if (schoolClass) return periodsForClassShift(data.periods, schoolClass.shift);
    const withLessons = new Set<ShiftKey>();
    for (const l of owned) for (const p of data.periods) if (p.kind === 'aula' && overlaps(p.start, p.end, l.start, l.end)) withLessons.add(p.shift);
    return periodsForShifts(data.periods, SHIFT_KEYS.filter((s) => data.settings.enabledShifts.includes(s) || withLessons.has(s)));
  }, [schoolClass, data.periods, data.settings.enabledShifts, owned]);
  const lessonPeriods = useMemo(() => allPeriods.filter((p) => p.kind === 'aula'), [allPeriods]);
  const days = data.settings.enabledDays;
  const cells = useMemo(() => buildCells(kind, lessonPeriods, days, owned), [kind, lessonPeriods, days, owned]);

  const valueOf = (key: string): CellValue => edits.get(key) ?? cells.get(key) ?? EMPTY;
  const dirtyKeys = [...edits.keys()].filter((k) => !sameValue(edits.get(k)!, cells.get(k) ?? EMPTY));
  const dirty = dirtyKeys.length > 0;

  // Proteção contra sair com alterações não salvas (navegação interna e fechamento da aba).
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname);
  useEffect(() => {
    if (!dirty) return;
    const onUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, [dirty]);

  const setCell = (key: string, value: CellValue) => {
    setEdits((all) => new Map(all).set(key, value));
    setErrors((all) => {
      if (!all.has(key)) return all;
      const next = new Map(all);
      next.delete(key);
      return next;
    });
    setSaveError(null);
  };

  /** Quem está ocupado em outra turma (quadro da turma) ou turma ocupada por outro professor (quadro do professor). */
  const busyAt = (day: Weekday, p: Period) => {
    const map = new Map<number, string>();
    for (const l of others) {
      if (l.weekday !== day || !overlaps(l.start, l.end, p.start, p.end)) continue;
      if (kind === 'class') map.set(l.teacherId, data.classes.find((c) => c.id === l.classId)?.name ?? '');
      else map.set(l.classId, data.teachers.find((t) => t.id === l.teacherId)?.name ?? '');
    }
    return map;
  };

  // Totais da semana (já considerando as alterações ainda não salvas).
  let lessonsCount = 0;
  let minutes = 0;
  for (const d of days)
    for (const p of lessonPeriods) {
      const v = valueOf(cellKey(d, p.id));
      if (!isEmpty(v)) {
        lessonsCount++;
        minutes += durationMinutes(p.start, p.end);
      }
    }

  async function save() {
    const plan = planSave({ kind, ownerId, periods: lessonPeriods, days, cells, edits, lessons: owned });
    if (plan.errors.size) {
      setErrors(plan.errors);
      setSaveError(`${plural(plan.errors.size, 'horário precisa', 'horários precisam')} de ${kind === 'class' ? 'professor' : 'turma'} antes de salvar.`);
      return;
    }
    if (!plan.removeIds.length && !plan.creates.length) {
      setEdits(new Map());
      return;
    }
    try {
      await batch.mutateAsync({ removeIds: plan.removeIds, updates: [], creates: plan.creates });
      await qc.refetchQueries({ queryKey: keys.lessons });
      setEdits(new Map());
      setErrors(new Map());
      toast.success('Quadro salvo', `${plural(dirtyKeys.length, 'horário atualizado', 'horários atualizados')}.`);
    } catch (error) {
      setSaveError(error instanceof ApiError && error.issues?.length ? error.issues[0].message : errorMessage(error));
    }
  }

  const pos = list.findIndex((e) => e.id === ownerId);
  const ownerName = schoolClass?.name ?? teacher?.name ?? '';

  return (
    <div className="flex flex-col gap-4">
      {/* Escolha da turma / professor e resumo da semana */}
      <Card className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center">
        <div className="flex items-center gap-2 lg:w-[420px]">
          <Button size="sm" variant="ghost" aria-label="Anterior" disabled={pos <= 0} onClick={() => onPick(list[pos - 1].id)}>
            <ChevronLeft className="size-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <Combobox
              value={ownerId}
              onChange={(v) => v && onPick(v)}
              options={list.map((e) => ({ value: e.id, label: e.name }))}
              placeholder={kind === 'class' ? 'Escolha a turma' : 'Escolha o professor'}
            />
          </div>
          <Button size="sm" variant="ghost" aria-label="Próximo" disabled={pos < 0 || pos >= list.length - 1} onClick={() => onPick(list[pos + 1].id)}>
            <ChevronRight className="size-5" />
          </Button>
        </div>
        <div className="flex flex-1 flex-wrap items-center gap-x-6 gap-y-2 text-sm text-ink-2 lg:justify-end">
          {schoolClass && (
            <span>
              Turno <strong className="text-ink">{SHIFT_LABEL[schoolClass.shift]}</strong>
            </span>
          )}
          <span>
            <strong className="tabular text-lg text-ink">{lessonsCount}</strong> aulas na semana
          </span>
          <span>
            <strong className="tabular text-lg text-ink">{formatHours(minutes)}</strong> semanais
          </span>
        </div>
      </Card>

      {teacher && <TeacherSubjectsBar teacherId={teacher.id} data={data} />}

      {lessonPeriods.length === 0 ? (
        <Card className="p-8 text-center text-muted">Nenhum período de aula configurado. Defina os horários em Configurações.</Card>
      ) : (
        <div className="overflow-x-auto rounded-xl bg-surface shadow-raise ring-1 ring-line-strong scrollbar-thin">
          <table className="w-full min-w-[980px] table-fixed border-separate border-spacing-0">
            <caption className="sr-only">Montar o quadro semanal de {ownerName}</caption>
            <colgroup>
              <col className="w-[118px]" />
              {days.map((d) => (
                <col key={d} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th scope="col" className="sticky left-0 z-10 bg-nav px-3 py-3 text-left text-xs font-bold tracking-wide text-nav-text uppercase">
                  Horário
                </th>
                {days.map((d) => (
                  <th key={d} scope="col" className="border-l border-nav-line bg-nav px-3 py-3 text-left text-[14px] font-bold text-white">
                    <span className="xl:hidden">{WEEKDAY_SHORT[d]}</span>
                    <span className="hidden xl:inline">{WEEKDAY_LABEL[d]}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allPeriods.map((p, i) => {
                const shiftChange = kind === 'teacher' && (i === 0 || allPeriods[i - 1].shift !== p.shift) && new Set(allPeriods.map((x) => x.shift)).size > 1;
                return (
                  <Fragment key={p.id}>
                    {shiftChange && (
                      <tr>
                        <th colSpan={days.length + 1} className="border-y border-line-strong bg-ink-2 px-3 py-2 text-left text-xs font-bold tracking-wide text-white uppercase">
                          {SHIFT_LABEL[p.shift]}
                        </th>
                      </tr>
                    )}
                    {p.kind === 'intervalo' ? (
                      <tr>
                        <th scope="row" className="sticky left-0 z-10 border-b border-line-strong bg-canvas px-3 py-1.5 text-left text-xs font-bold text-ink-2">
                          {p.start}–{p.end}
                        </th>
                        <td colSpan={days.length} className="border-b border-l border-line-strong bg-canvas px-3 py-1.5 text-xs font-bold text-ink-2">
                          <span className="inline-flex items-center gap-1.5">
                            <Coffee className="size-3.5" /> {p.label}
                          </span>
                        </td>
                      </tr>
                    ) : (
                      <tr>
                        <th scope="row" className="sticky left-0 z-10 border-b border-line-strong bg-subtle px-3 py-2 text-left align-top">
                          <span className="block text-[14px] font-bold text-ink">{p.label}</span>
                          <span className="tabular block text-xs font-semibold text-ink-2">
                            {p.start}–{p.end}
                          </span>
                        </th>
                        {days.map((d) => {
                          const key = cellKey(d, p.id);
                          const cell = cells.get(key)!;
                          return (
                            <BuilderCell
                              key={key}
                              kind={kind}
                              data={data}
                              ownerId={ownerId}
                              day={d}
                              period={p}
                              cell={cell}
                              value={valueOf(key)}
                              changed={dirtyKeys.includes(key)}
                              error={errors.get(key)}
                              busy={busyAt(d, p)}
                              onChange={(v) => setCell(key, v)}
                              onOpenLocked={() => {
                                const l = owned.find((x) => x.id === cell.lessonId);
                                if (l) actions.openLesson(l);
                              }}
                            />
                          );
                        })}
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Barra de salvamento: aparece quando há alterações */}
      {dirty && (
        <div className="sticky bottom-4 z-30 flex justify-center">
          <div className="flex w-full max-w-3xl animate-toast-in flex-wrap items-center gap-3 rounded-2xl bg-nav px-4 py-3 text-white shadow-pop sm:flex-nowrap">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand font-extrabold text-ink tabular">{dirtyKeys.length}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-bold">{dirtyKeys.length === 1 ? 'alteração não salva' : 'alterações não salvas'}</span>
              <span className={cn('block truncate text-xs', saveError ? 'font-semibold text-[#ff9b8f]' : 'text-nav-text')}>
                {saveError ?? 'Os horários alterados estão destacados em amarelo.'}
              </span>
            </span>
            <Button size="sm" variant="ghost" className="text-white hover:bg-white/10 hover:text-white" icon={<Undo2 className="size-4" />} onClick={() => (setEdits(new Map()), setErrors(new Map()), setSaveError(null))} disabled={batch.isPending}>
              Descartar
            </Button>
            <Button variant="primary" icon={<Save className="size-4" />} loading={batch.isPending} onClick={() => void save()}>
              Salvar quadro
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={blocker.state === 'blocked'}
        title="Sair sem salvar?"
        confirmLabel="Sair sem salvar"
        onClose={() => blocker.reset?.()}
        onConfirm={() => blocker.proceed?.()}
      >
        <p>
          Há {plural(dirtyKeys.length, 'alteração', 'alterações')} no quadro de {ownerName} que ainda não foram salvas. Se sair agora, elas serão perdidas.
        </p>
      </ConfirmDialog>
    </div>
  );
}

// ------------------------------------------------------------------ Célula

function BuilderCell({
  kind,
  data,
  ownerId,
  day,
  period,
  cell,
  value,
  changed,
  error,
  busy,
  onChange,
  onOpenLocked,
}: {
  kind: BuilderKind;
  data: ScheduleData;
  ownerId: number;
  day: Weekday;
  period: Period;
  cell: Cell;
  value: CellValue;
  changed: boolean;
  error?: string;
  busy: Map<number, string>;
  onChange: (v: CellValue) => void;
  onOpenLocked: () => void;
}) {
  const subject = value.subjectId ? data.subjects.find((s) => s.id === value.subjectId) : undefined;
  const where = `${WEEKDAY_LABEL[day]}, ${period.label}`;
  const tint = subject ? SUBJECT_STYLE[subject.color].chip : '';

  if (cell.locked) {
    return (
      <td className="h-[92px] border-b border-l border-line-strong bg-subtle p-1.5 align-top">
        <button
          type="button"
          onClick={onOpenLocked}
          className="flex h-full w-full flex-col items-start gap-1 rounded-md bg-surface px-2 py-1.5 text-left text-xs ring-1 ring-line-strong hover:ring-ink"
          title="Aula com horário especial: abra para editar"
        >
          <span className="flex items-center gap-1 font-bold text-ink">
            <Lock className="size-3.5" /> Horário especial
          </span>
          <span className="text-ink-2">Clique para editar esta aula</span>
        </button>
      </td>
    );
  }

  // Opções de professor (quadro da turma) ou de turma (quadro do professor).
  let otherSelect: ReactNode;
  if (kind === 'class') {
    const active = data.teachers.filter((t) => t.active || t.id === value.otherId).sort(byName);
    const teaches = active.filter((t) => value.subjectId !== null && teacherSubjectIds(t, data.subjects).includes(value.subjectId) && !busy.has(t.id));
    const free = active.filter((t) => !teaches.includes(t) && !busy.has(t.id));
    const occupied = active.filter((t) => busy.has(t.id));
    const groups: PickerGroup[] = [];
    if (teaches.length && subject) groups.push({ label: `Lecionam ${subject.name}`, options: teaches.map((t) => ({ value: t.id, label: t.name, hint: 'livre' })) });
    groups.push({ label: teaches.length && subject ? 'Outros professores livres' : 'Professores livres', options: free.map((t) => ({ value: t.id, label: t.name })) });
    if (occupied.length)
      groups.push({
        label: 'Ocupados neste horário',
        options: occupied.map((t) => ({ value: t.id, label: t.name, hint: `na ${busy.get(t.id)}`, disabled: t.id !== value.otherId })),
      });
    otherSelect = (
      <CellPicker
        label={`Professor · ${where}`}
        placeholder="Professor"
        value={value.otherId}
        invalid={Boolean(error)}
        groups={groups}
        onChange={(otherId) => {
          // Professor com uma única disciplina: preenche a disciplina se ainda estiver vazia.
          const own = otherId ? teacherSubjectIds(data.teachers.find((t) => t.id === otherId), data.subjects) : [];
          onChange({ otherId, subjectId: value.subjectId ?? (own.length === 1 ? own[0] : null) });
        }}
      />
    );
  } else {
    const fits = data.classes
      .filter((c) => (c.active || c.id === value.otherId) && shiftsOfClass(c.shift).includes(period.shift))
      .sort(byName);
    otherSelect = (
      <CellPicker
        label={`Turma · ${where}`}
        placeholder="Turma"
        value={value.otherId}
        invalid={Boolean(error)}
        onChange={(otherId) => onChange({ ...value, otherId })}
        groups={[
          { label: 'Turmas livres', options: fits.filter((c) => !busy.has(c.id)).map((c) => ({ value: c.id, label: c.name })) },
          {
            label: 'Ocupadas neste horário',
            options: fits.filter((c) => busy.has(c.id)).map((c) => ({ value: c.id, label: c.name, hint: `com ${firstName(busy.get(c.id)!)}`, disabled: c.id !== value.otherId })),
          },
        ]}
      />
    );
  }

  // Disciplinas: as do professor primeiro.
  const teacherForSubjects = kind === 'teacher' ? data.teachers.find((t) => t.id === ownerId) : data.teachers.find((t) => t.id === value.otherId);
  const mine = teacherSubjectIds(teacherForSubjects, data.subjects);
  const subjects = [...data.subjects].sort(byName);
  const subjectOption = (s: (typeof subjects)[number]) => ({ value: s.id, label: s.name, dot: SUBJECT_STYLE[s.color].dot });
  const subjectSelect = (
    <CellPicker
      label={`Disciplina · ${where}`}
      placeholder="Disciplina"
      value={value.subjectId}
      strong
      groups={[
        ...(mine.length && teacherForSubjects ? [{ label: `Disciplinas de ${firstName(teacherForSubjects.name)}`, options: subjects.filter((s) => mine.includes(s.id)).map(subjectOption) }] : []),
        { label: mine.length ? 'Outras disciplinas' : 'Disciplinas', options: subjects.filter((s) => !mine.includes(s.id)).map(subjectOption) },
      ]}
      onChange={(subjectId) => {
        // Quadro da turma: um único professor livre que leciona a disciplina já é escolhido.
        if (kind === 'class' && value.otherId === null && subjectId !== null) {
          const candidates = data.teachers.filter((t) => t.active && !busy.has(t.id) && teacherSubjectIds(t, data.subjects).includes(subjectId));
          return onChange({ subjectId, otherId: candidates.length === 1 ? candidates[0].id : null });
        }
        onChange({ ...value, subjectId });
      }}
    />
  );

  return (
    <td
      className={cn(
        'relative h-[92px] border-b border-l border-line-strong p-1.5 align-top transition-colors',
        subject ? tint : isEmpty(value) ? 'bg-subtle/70' : 'bg-surface',
        changed && 'shadow-[inset_0_0_0_2px_var(--color-brand)]',
        error && 'shadow-[inset_0_0_0_2px_var(--color-danger)]',
      )}
      title={error}
    >
      <div className="flex flex-col gap-1">
        {kind === 'class' ? (
          <>
            {subjectSelect}
            {otherSelect}
          </>
        ) : (
          <>
            {otherSelect}
            {subjectSelect}
          </>
        )}
      </div>
      {!isEmpty(value) && (
        <button
          type="button"
          onClick={() => onChange(EMPTY)}
          aria-label={`Limpar ${where}`}
          title="Limpar este horário"
          className="absolute -top-px -right-px hidden size-5 place-items-center rounded-bl-md bg-ink/70 text-white hover:bg-danger [td:hover_&]:grid [td:focus-within_&]:grid"
        >
          <X className="size-3" />
        </button>
      )}
      {error && (
        <span className="mt-1 flex items-center gap-1 text-[11px] font-bold text-danger">
          <AlertTriangle className="size-3" /> {kind === 'class' ? 'Falta o professor' : 'Falta a turma'}
        </span>
      )}
    </td>
  );
}

// ------------------------------------------------------------------ Disciplinas do professor

/** Disciplinas do professor, sempre à vista no quadro dele, com atalho para configurar. */
function TeacherSubjectsBar({ teacherId, data }: { teacherId: number; data: ScheduleData }) {
  const teacher = data.teachers.find((t) => t.id === teacherId)!;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<number[]>(teacher.subjectIds);
  const save = useSaveTeacher();
  const toast = useToast();
  const mine = data.subjects.filter((s) => teacher.subjectIds.includes(s.id)).sort(byName);

  async function confirm() {
    try {
      await save.mutateAsync({
        id: teacher.id,
        input: { name: teacher.name, code: teacher.code, area: teacher.area, phone: teacher.phone, notes: teacher.notes, active: teacher.active, subjectIds: draft },
      });
      toast.success('Disciplinas atualizadas', teacher.name);
      setEditing(false);
    } catch (error) {
      toast.error('Não foi possível salvar', errorMessage(error));
    }
  }

  return (
    <Card className="flex flex-wrap items-center gap-3 px-4 py-3">
      <span className="text-[14px] font-bold text-ink">Disciplinas de {firstName(teacher.name)}:</span>
      {mine.length ? (
        mine.map((s) => (
          <span key={s.id} className={cn('inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold ring-1 ring-inset', SUBJECT_STYLE[s.color].chip, SUBJECT_STYLE[s.color].ring)}>
            <span className={cn('size-2 rounded-full', SUBJECT_STYLE[s.color].dot)} />
            {s.name}
          </span>
        ))
      ) : (
        <span className="text-[13.5px] text-muted">Nenhuma configurada. Configure para que apareçam primeiro na grade.</span>
      )}
      <Button size="sm" className="ml-auto" icon={<Settings2 className="size-4" />} onClick={() => (setDraft(teacher.subjectIds), setEditing(true))}>
        Configurar disciplinas
      </Button>
      <Modal open={editing} onClose={() => setEditing(false)} size="md" title={`Disciplinas de ${teacher.name}`} description="Marque todas as disciplinas que este professor leciona.">
        {editing && (
          <div className="flex flex-col gap-5">
            <SubjectPicker value={draft} onChange={setDraft} />
            <div className="-mx-5 -mb-5 flex flex-col-reverse gap-2 border-t border-line bg-subtle px-5 py-3.5 sm:-mx-6 sm:flex-row sm:justify-end sm:px-6">
              <Button onClick={() => setEditing(false)}>Cancelar</Button>
              <Button variant="primary" loading={save.isPending} onClick={() => void confirm()}>
                Salvar disciplinas
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </Card>
  );
}

