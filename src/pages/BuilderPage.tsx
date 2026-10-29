import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useBlocker, useNavigate, useParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Check, ChevronLeft, ClipboardList, Eye, ChevronRight, Coffee, Lock, Save, Settings2, Undo2, X } from 'lucide-react';
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
import { SHIFT_KEYS, type Lesson, type Period, type ShiftKey, type Weekday } from '@shared/types';
import { SUBJECT_STYLE } from '@/lib/subjectColors';
import { CellPicker, type PickerGroup } from '@/components/schedule/CellPicker';
import { formatHours } from '@/lib/format';
import { plural } from '@/lib/text';
import { cn } from '@/lib/cn';
import { useLocalStorage } from '@/hooks/useLocalStorage';
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
  // Quadro do professor: aulas de outros professores visíveis na grade (todos, nenhum ou os escolhidos).
  const [peek, setPeek] = useLocalStorage<PeekChoice>('seice:montar-ver-outros', 'all');
  const peekAt = (day: Weekday, p: Period) =>
    kind !== 'teacher' || peek === 'none'
      ? []
      : others
          .filter((l) => l.weekday === day && overlaps(l.start, l.end, p.start, p.end) && (peek === 'all' || peek.includes(l.teacherId)))
          .sort((a, b) => byName(data.classes.find((c) => c.id === a.classId) ?? { name: '' }, data.classes.find((c) => c.id === b.classId) ?? { name: '' }));

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
  /** Horários da grade (já com as alterações não salvas) com este professor/turma e disciplina. */
  const countCells = (otherId: number, subjectId: number) => {
    let n = 0;
    for (const d of days) for (const p of lessonPeriods) {
      const v = valueOf(cellKey(d, p.id));
      if (v.otherId === otherId && v.subjectId === subjectId) n++;
    }
    return n;
  };
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

      <AssignmentsBar kind={kind} ownerId={ownerId} data={data} countOf={(otherId, subjectId) => countCells(otherId, subjectId)} />

      {teacher && <TeacherSubjectsBar teacherId={teacher.id} data={data} />}

      {teacher && <PeekBar ownerId={teacher.id} data={data} value={peek} onChange={setPeek} />}

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
                              peek={peekAt(d, p)}
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
  peek,
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
  peek: Lesson[];
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
  // Quadro do professor: turmas do turno que já têm aula com outro professor neste horário.
  let busyClasses: { name: string; with: string }[] = [];
  let freeClasses = 0;
  if (kind === 'class') {
    const assignedId = value.subjectId !== null ? assignedTeacher(data, ownerId, value.subjectId) : undefined;
    const active = data.teachers.filter((t) => t.active || t.id === value.otherId).sort(byName);
    const assigned = active.find((t) => t.id === assignedId);
    const teaches = active.filter((t) => t !== assigned && value.subjectId !== null && teacherSubjectIds(t, data.subjects).includes(value.subjectId) && !busy.has(t.id));
    const free = active.filter((t) => t !== assigned && !teaches.includes(t) && !busy.has(t.id));
    const occupied = active.filter((t) => t !== assigned && busy.has(t.id));
    const groups: PickerGroup[] = [];
    if (assigned && subject)
      groups.push({
        label: `Atribuído para ${subject.name} nesta turma`,
        options: [{ value: assigned.id, label: assigned.name, hint: busy.has(assigned.id) ? `ocupado na ${busy.get(assigned.id)}` : 'atribuído', disabled: busy.has(assigned.id) && assigned.id !== value.otherId }],
      });
    if (teaches.length && subject) groups.push({ label: `Também lecionam ${subject.name}`, options: teaches.map((t) => ({ value: t.id, label: t.name, hint: 'livre' })) });
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
    busyClasses = fits.filter((c) => busy.has(c.id)).map((c) => ({ name: c.name, with: firstName(busy.get(c.id)!) }));
    freeClasses = fits.length - busyClasses.length;
    otherSelect = (
      <CellPicker
        label={`Turma · ${where}`}
        placeholder="Turma"
        value={value.otherId}
        invalid={Boolean(error)}
        onChange={(otherId) => {
          // Uma única disciplina atribuída ao professor nesta turma: já vem preenchida.
          const own = otherId ? data.assignments.filter((a) => a.teacherId === ownerId && a.classId === otherId) : [];
          onChange({ otherId, subjectId: value.subjectId ?? (own.length === 1 ? own[0].subjectId : null) });
        }}
        groups={[
          {
            label: 'Turmas atribuídas a este professor',
            options: fits
              .filter((c) => !busy.has(c.id) && data.assignments.some((a) => a.teacherId === ownerId && a.classId === c.id))
              .map((c) => ({ value: c.id, label: c.name, hint: subjectNames(data, ownerId, c.id) })),
          },
          {
            label: 'Outras turmas livres',
            options: fits.filter((c) => !busy.has(c.id) && !data.assignments.some((a) => a.teacherId === ownerId && a.classId === c.id)).map((c) => ({ value: c.id, label: c.name })),
          },
          {
            label: 'Já têm aula com outro professor neste horário',
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
  // Atribuições: no quadro da turma, as disciplinas da turma (sem professor escolhido ou com o professor atribuído);
  // no quadro do professor, as dele na turma escolhida.
  const assignedSubjects = data.assignments
    .filter((a) =>
      kind === 'class'
        ? a.classId === ownerId && (value.otherId === null || a.teacherId === value.otherId)
        : a.teacherId === ownerId && value.otherId !== null && a.classId === value.otherId,
    )
    .sort((a, b) => byName(data.subjects.find((x) => x.id === a.subjectId)!, data.subjects.find((x) => x.id === b.subjectId)!));
  const preferred = subjects.filter((s) => mine.includes(s.id) && !assignedSubjects.some((a) => a.subjectId === s.id));
  const rest = subjects.filter((s) => !mine.includes(s.id) && !assignedSubjects.some((a) => a.subjectId === s.id));
  const subjectSelect = (
    <CellPicker
      label={`Disciplina · ${where}`}
      placeholder="Disciplina"
      value={value.subjectId}
      strong
      groups={[
        ...(assignedSubjects.length
          ? [
              {
                label: kind === 'class' ? 'Atribuídas nesta turma' : 'Atribuídas a este professor nesta turma',
                options: assignedSubjects.map((a) => ({
                  ...subjectOption(data.subjects.find((x) => x.id === a.subjectId)!),
                  hint: kind === 'class' ? firstName(data.teachers.find((t) => t.id === a.teacherId)?.name ?? '') : undefined,
                })),
              },
            ]
          : []),
        ...(preferred.length && teacherForSubjects ? [{ label: `Disciplinas de ${firstName(teacherForSubjects.name)}`, options: preferred.map(subjectOption) }] : []),
        { label: assignedSubjects.length || preferred.length ? 'Outras disciplinas' : 'Disciplinas', options: rest.map(subjectOption) },
      ]}
      onChange={(subjectId) => {
        // Quadro da turma: o professor atribuído (se estiver livre) ou um único professor livre que leciona a disciplina.
        if (kind === 'class' && value.otherId === null && subjectId !== null) {
          const assignedId = assignedTeacher(data, ownerId, subjectId);
          if (assignedId && !busy.has(assignedId)) return onChange({ subjectId, otherId: assignedId });
          const candidates = data.teachers.filter((t) => t.active && !busy.has(t.id) && teacherSubjectIds(t, data.subjects).includes(subjectId));
          return onChange({ subjectId, otherId: candidates.length === 1 ? candidates[0].id : null });
        }
        onChange({ ...value, subjectId });
      }}
    />
  );

  // Professor livre, mas nenhuma turma livre neste horário: não há o que escolher, então a célula explica o motivo.
  if (kind === 'teacher' && isEmpty(value) && freeClasses === 0) {
    return (
      <td className="h-[92px] border-b border-l border-line-strong bg-subtle/70 p-1.5 align-top">
        <div
          className="flex h-full flex-col justify-center rounded-md border border-dashed border-line-strong px-2 py-1.5 text-[12px] leading-snug text-ink-2"
          title={busyClasses.map((c) => `${c.name}: aula com ${c.with}`).join(' · ')}
        >
          <span className="font-bold text-ink">Sem turma livre</span>
          {peek.length ? (
            <PeekList lessons={peek} data={data} />
          ) : busyClasses.length ? (
            <span className="truncate">{busyClasses.map((c) => `${c.name} com ${c.with}`).join(' · ')}</span>
          ) : (
            <span>Nenhuma turma deste turno</span>
          )}
        </div>
      </td>
    );
  }

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
        {peek.length > 0 && <PeekList lessons={peek} data={data} />}
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

// ------------------------------------------------------------------ Aulas de outros professores

type PeekChoice = 'all' | 'none' | number[];

/** Aulas de outros professores no mesmo horário, só para consulta. */
function PeekList({ lessons, data }: { lessons: Lesson[]; data: ScheduleData }) {
  const shown = lessons.slice(0, 3);
  return (
    <ul className="mt-0.5 flex flex-col gap-0.5" aria-label="Aulas de outros professores neste horário">
      {shown.map((l) => {
        const subject = l.subjectId ? data.subjects.find((x) => x.id === l.subjectId) : undefined;
        const c = data.classes.find((x) => x.id === l.classId);
        const t = data.teachers.find((x) => x.id === l.teacherId);
        return (
          <li
            key={l.id}
            className="flex min-w-0 items-center gap-1.5 rounded bg-surface/70 px-1.5 py-0.5 text-[11.5px] leading-tight text-ink-2 ring-1 ring-line ring-inset"
            title={`${c?.name} · ${subject?.name ?? 'Sem disciplina'} · ${t?.name} · ${l.start}–${l.end}`}
          >
            <span className={cn('size-1.5 shrink-0 rounded-full', subject ? SUBJECT_STYLE[subject.color].dot : 'bg-line-strong')} />
            <span className="shrink-0 font-bold text-ink">{c?.name}</span>
            <span className="truncate">{t ? firstName(t.name) : '—'}</span>
          </li>
        );
      })}
      {lessons.length > shown.length && <li className="px-1.5 text-[11px] font-semibold text-ink-2">+{lessons.length - shown.length} turmas</li>}
    </ul>
  );
}

/** Escolha de quais outros professores aparecem na grade do professor. */
function PeekBar({ ownerId, data, value, onChange }: { ownerId: number; data: ScheduleData; value: PeekChoice; onChange: (v: PeekChoice) => void }) {
  const teachers = data.teachers.filter((t) => t.active && t.id !== ownerId).sort(byName);
  const picked = Array.isArray(value) ? value : [];
  const toggle = (id: number) => {
    const next = picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id];
    onChange(next.length ? next : 'none');
  };
  const chip = (active: boolean) =>
    cn(
      'inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold ring-1 ring-inset transition-colors',
      active ? 'bg-nav text-white ring-nav' : 'bg-surface text-ink ring-line-strong hover:ring-ink',
    );
  return (
    <Card className="flex flex-wrap items-center gap-2 px-4 py-3">
      <span className="mr-1 inline-flex items-center gap-1.5 text-[14px] font-bold text-ink">
        <Eye className="size-4" /> Ver na grade as aulas de:
      </span>
      <button type="button" aria-pressed={value === 'all'} className={chip(value === 'all')} onClick={() => onChange('all')}>
        Todos
      </button>
      <button type="button" aria-pressed={value === 'none'} className={chip(value === 'none')} onClick={() => onChange('none')}>
        Ninguém
      </button>
      <span className="mx-1 h-5 w-px bg-line-strong" aria-hidden="true" />
      {teachers.map((t) => (
        <button key={t.id} type="button" aria-pressed={picked.includes(t.id)} className={chip(picked.includes(t.id))} onClick={() => toggle(t.id)}>
          {picked.includes(t.id) && <Check className="size-3.5 text-brand" strokeWidth={3} />}
          {firstName(t.name)}
        </button>
      ))}
    </Card>
  );
}

// ------------------------------------------------------------------ Atribuições

const assignedTeacher = (data: ScheduleData, classId: number, subjectId: number) =>
  data.assignments.find((a) => a.classId === classId && a.subjectId === subjectId)?.teacherId;

const subjectNames = (data: ScheduleData, teacherId: number, classId: number) =>
  data.assignments
    .filter((a) => a.teacherId === teacherId && a.classId === classId)
    .map((a) => data.subjects.find((s) => s.id === a.subjectId)?.name)
    .filter(Boolean)
    .join(', ');

/** O que foi atribuído à turma (ou ao professor) e quanto já está na grade, contando as alterações ainda não salvas. */
function AssignmentsBar({
  kind,
  ownerId,
  data,
  countOf,
}: {
  kind: BuilderKind;
  ownerId: number;
  data: ScheduleData;
  countOf: (otherId: number, subjectId: number) => number;
}) {
  const list = data.assignments
    .filter((a) => (kind === 'class' ? a.classId === ownerId : a.teacherId === ownerId))
    .map((a) => {
      const subject = data.subjects.find((s) => s.id === a.subjectId)!;
      const otherId = kind === 'class' ? a.teacherId : a.classId;
      const other = kind === 'class' ? data.teachers.find((t) => t.id === otherId)?.name : data.classes.find((c) => c.id === otherId)?.name;
      return { a, subject, other: other ?? '—', placed: countOf(otherId, a.subjectId) };
    })
    .sort((x, y) => byName(x.subject, y.subject));
  const editLink = kind === 'class' ? `/atribuicoes/turma/${ownerId}` : `/atribuicoes/professor/${ownerId}`;
  const done = list.filter((x) => x.placed >= x.a.weeklyLessons).length;

  return (
    <Card className="px-4 py-3">
      <div className="mb-2.5 flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 className="text-[14px] font-bold text-ink">{kind === 'class' ? 'Atribuição desta turma' : 'Atribuição deste professor'}</h2>
        {list.length > 0 && (
          <span className="tabular rounded-full bg-subtle px-2.5 py-0.5 text-[12.5px] font-bold text-ink-2 ring-1 ring-line">
            {done} de {list.length} {kind === 'class' ? (list.length === 1 ? 'disciplina completa' : 'disciplinas completas') : list.length === 1 ? 'turma completa' : 'turmas completas'}
          </span>
        )}
        <Link to={editLink} className="ml-auto inline-flex items-center gap-1.5 text-[13px] font-bold text-ink underline-offset-4 hover:underline">
          <ClipboardList className="size-4" /> {list.length ? 'Editar atribuições' : 'Atribuir aulas'}
        </Link>
      </div>
      {list.length > 0 && (
        <p className="mb-2.5 text-[13px] text-ink-2">
          O número em cada etiqueta mostra quantas aulas {kind === 'class' ? 'da disciplina' : 'daquela turma'} já estão nesta grade, do total combinado por semana. Fica{' '}
          <strong className="text-success">verde</strong> quando bate.
        </p>
      )}
      {list.length === 0 ? (
        <p className="text-[13.5px] text-ink-2">
          Nenhuma atribuição ainda. Atribua {kind === 'class' ? 'os professores de cada disciplina desta turma' : 'as turmas deste professor'} para que o quadro sugira tudo sozinho.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {list.map(({ a, subject, other, placed }) => {
            const style = SUBJECT_STYLE[subject.color];
            const status = placed === a.weeklyLessons ? 'done' : placed > a.weeklyLessons ? 'over' : 'todo';
            return (
              <li
                key={a.id}
                className={cn('inline-flex h-9 items-center gap-2 rounded-full pr-1 pl-3 text-[13px] ring-1 ring-inset', style.chip, style.ring)}
                title={`${subject.name} · ${other}: ${placed} de ${a.weeklyLessons} aulas na grade`}
              >
                <span className={cn('size-2 rounded-full', style.dot)} />
                <span className="font-bold">{subject.name}</span>
                <span className="font-medium opacity-90">· {kind === 'class' ? firstName(other) : other}</span>
                <span
                  className={cn(
                    'tabular inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-xs font-extrabold',
                    status === 'done' ? 'bg-success text-white' : status === 'over' ? 'bg-danger text-white' : 'bg-surface text-ink ring-1 ring-line-strong',
                  )}
                >
                  {status === 'done' && <Check className="size-3.5" strokeWidth={3} />}
                  {placed} de {a.weeklyLessons}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
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

