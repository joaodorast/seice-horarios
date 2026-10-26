import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeftRight, Clock, Copy, LayoutGrid, Settings2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Alert, Button, Combobox, Field, Input, Modal, Segmented, Textarea, useToast, type ComboOption } from '@/components/ui';
import { useSaveLesson, type ScheduleData } from '@/api/hooks';
import { ApiError, errorMessage } from '@/api/client';
import { lessonSchema, type LessonInput } from '@shared/schemas';
import { hasBlockingIssues, validateLesson } from '@shared/conflicts';
import { periodsForClassShift, periodsForShifts } from '@shared/grid';
import { SHIFT_LABEL, WEEKDAY_LABEL, WEEKDAY_SHORT } from '@shared/labels';
import { overlaps, TIME_PATTERN, toMinutes } from '@shared/time';
import { SUBJECT_STYLE } from '@/lib/subjectColors';
import { periodRange, selectPeriod, suggestSubject } from '@shared/suggest';
import { ConflictResolver, type Occupant } from './ConflictResolver';
import type { Lesson, LessonIssue, Period, Weekday } from '@shared/types';

export interface LessonPrefill {
  classId?: number | null;
  teacherId?: number | null;
  subjectId?: number | null;
  weekday?: Weekday;
  start?: string;
  end?: string;
  notes?: string | null;
}

export type EditorRequest =
  | { mode: 'create'; prefill?: LessonPrefill; duplicateOf?: Lesson }
  | { mode: 'edit'; lesson: Lesson };

interface FormState {
  classId: number | null;
  teacherId: number | null;
  subjectId: number | null;
  weekday: Weekday;
  timeMode: 'period' | 'custom';
  start: string;
  end: string;
  notes: string;
  /** "auto": a disciplina acompanha a sugestão; "manual": escolhida pela pessoa e nunca trocada pelo sistema. */
  subjectSource: 'auto' | 'manual';
}

function initialState(req: EditorRequest, data: ScheduleData): FormState {
  const firstDay = data.settings.enabledDays[0] ?? 1;
  if (req.mode === 'edit') {
    const l = req.lesson;
    return {
      classId: l.classId,
      teacherId: l.teacherId,
      subjectId: l.subjectId,
      weekday: l.weekday,
      timeMode: matchesPeriod(data, l.classId, l.start, l.end) ? 'period' : 'custom',
      start: l.start,
      end: l.end,
      notes: l.notes ?? '',
      subjectSource: 'manual',
    };
  }
  const p = req.prefill ?? {};
  const start = p.start ?? '';
  const end = p.end ?? '';
  return {
    classId: p.classId ?? null,
    teacherId: p.teacherId ?? null,
    subjectId: p.subjectId ?? null,
    weekday: p.weekday ?? firstDay,
    timeMode: !start || matchesPeriod(data, p.classId ?? null, start, end) ? 'period' : 'custom',
    start,
    end,
    notes: p.notes ?? '',
    subjectSource: p.subjectId !== undefined && p.subjectId !== null ? 'manual' : 'auto',
  };
}

/** O horário corresponde a um ou mais períodos seguidos da grade da turma (ex.: aula dupla)? */
function matchesPeriod(data: ScheduleData, classId: number | null, start: string, end: string) {
  const shifts = classId === null ? data.settings.enabledShifts : classShiftKeys(data, classId);
  const periods = periodsForShifts(data.periods, shifts as typeof data.settings.enabledShifts).filter((p) => p.kind === 'aula');
  return periodRange(periods, start, end) !== null;
}

function classShiftKeys(data: ScheduleData, classId: number) {
  const c = data.classes.find((x) => x.id === classId);
  if (!c) return [];
  return c.shift === 'integral' ? ['manha', 'tarde'] : [c.shift];
}

export function LessonEditor({
  request,
  data,
  onClose,
}: {
  request: EditorRequest | null;
  data: ScheduleData;
  onClose: () => void;
}) {
  return (
    <Modal
      open={request !== null}
      onClose={onClose}
      dismissible={false}
      size="lg"
      title={request?.mode === 'edit' ? 'Editar aula' : request?.duplicateOf ? 'Duplicar aula' : 'Nova aula'}
      description={
        request?.mode === 'create' && request.duplicateOf
          ? 'Os dados da aula original foram copiados. Escolha o novo dia ou horário — os conflitos são verificados novamente.'
          : 'Os conflitos de professor e turma são verificados enquanto você preenche.'
      }
    >
      {request && <LessonForm key={JSON.stringify(request)} request={request} data={data} onClose={onClose} />}
    </Modal>
  );
}

function LessonForm({ request, data, onClose }: { request: EditorRequest; data: ScheduleData; onClose: () => void }) {
  const [form, setForm] = useState<FormState>(() => initialState(request, data));
  const [touched, setTouched] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverIssues, setServerIssues] = useState<LessonIssue[] | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const save = useSaveLesson();
  const toast = useToast();
  const editingId = request.mode === 'edit' ? request.lesson.id : undefined;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setServerIssues(null);
    setFormError(null);
    setFieldErrors((e) => {
      if (!e[key]) return e;
      const next = { ...e };
      delete next[key];
      return next;
    });
  };

  const schoolClass = form.classId ? data.classes.find((c) => c.id === form.classId) : undefined;
  const teacher = form.teacherId ? data.teachers.find((t) => t.id === form.teacherId) : undefined;

  const dayOptions = useMemo(() => {
    const days = new Set<Weekday>(data.settings.enabledDays);
    if (request.mode === 'edit') days.add(request.lesson.weekday);
    return [...days].sort().map((d) => ({ value: d, label: WEEKDAY_SHORT[d] }));
  }, [data.settings.enabledDays, request]);

  const availablePeriods: Period[] = useMemo(() => {
    const base = schoolClass
      ? periodsForClassShift(data.periods, schoolClass.shift)
      : periodsForShifts(data.periods, data.settings.enabledShifts);
    return base.filter((p) => p.kind === 'aula');
  }, [data.periods, data.settings.enabledShifts, schoolClass]);

  // Ao trocar de turma, se o horário escolhido não pertencer ao novo turno, limpa a seleção do período.
  useEffect(() => {
    if (form.timeMode !== 'period' || !form.start) return;
    if (!availablePeriods.some((p) => p.start === form.start && p.end === form.end)) {
      setForm((f) => ({ ...f, start: '', end: '' }));
    }
  }, [availablePeriods, form.timeMode, form.start, form.end]);

  const otherLessons = useMemo(() => data.lessons.filter((l) => l.id !== editingId), [data.lessons, editingId]);

  const suggestion = useMemo(
    () =>
      suggestSubject({
        teacher,
        subjects: data.subjects,
        lessons: data.lessons,
        classId: form.classId,
        weekday: form.weekday,
        start: form.start,
        end: form.end,
        excludeLessonId: editingId,
      }),
    [teacher, data.subjects, data.lessons, form.classId, form.weekday, form.start, form.end, editingId],
  );

  // Enquanto a disciplina não for escolhida pela pessoa, ela acompanha a sugestão (professor, turma, dia e horário).
  useEffect(() => {
    if (form.subjectSource === 'auto' && form.subjectId !== suggestion.subjectId) {
      setForm((f) => ({ ...f, subjectId: suggestion.subjectId }));
    }
  }, [form.subjectSource, form.subjectId, suggestion.subjectId]);

  const chooseSubject = (id: number | null) => {
    setForm((f) => ({ ...f, subjectId: id, subjectSource: 'manual' }));
    setServerIssues(null);
  };

  function periodStatus(p: Period) {
    const sameDay = otherLessons.filter((l) => l.weekday === form.weekday && overlaps(l.start, l.end, p.start, p.end));
    const classBusy = form.classId !== null && sameDay.some((l) => l.classId === form.classId);
    const teacherBusy = form.teacherId !== null && sameDay.some((l) => l.teacherId === form.teacherId);
    return { classBusy, teacherBusy };
  }

  const timesReady = TIME_PATTERN.test(form.start) && TIME_PATTERN.test(form.end);

  const liveIssues = useMemo(() => {
    if (!form.classId || !form.teacherId || !timesReady) return [];
    return validateLesson(
      { id: editingId, teacherId: form.teacherId, classId: form.classId, subjectId: form.subjectId, weekday: form.weekday, start: form.start, end: form.end },
      data,
    );
  }, [form, data, editingId, timesReady]);

  const issues = serverIssues ?? liveIssues;
  const blocking = hasBlockingIssues(issues);
  const errorsList = issues.filter((i) => i.severity === 'error');
  const warningsList = issues.filter((i) => i.severity === 'warning');

  // Horário ocupado (e nenhum outro impedimento): em vez de travar, oferece substituir ou trocar.
  const onlyOccupied = errorsList.length > 0 && errorsList.every((i) => (i.code === 'teacher-overlap' || i.code === 'class-overlap') && i.relatedLessonId);
  const occupants: Occupant[] = useMemo(() => {
    const map = new Map<number, Occupant>();
    for (const i of errorsList) {
      const lesson = i.relatedLessonId ? data.lessons.find((l) => l.id === i.relatedLessonId) : undefined;
      if (!lesson) continue;
      const o = map.get(lesson.id) ?? { lesson, classConflict: false, teacherConflict: false };
      if (i.code === 'class-overlap') o.classConflict = true;
      if (i.code === 'teacher-overlap') o.teacherConflict = true;
      map.set(lesson.id, o);
    }
    return [...map.values()];
  }, [errorsList, data.lessons]);
  const [resolving, setResolving] = useState<LessonInput | null>(null);

  const teacherOptions: ComboOption[] = data.teachers.map((t) => ({
    value: t.id,
    label: t.name,
    description: [t.area, t.code ? `Matrícula ${t.code}` : null].filter(Boolean).join(' · ') || undefined,
    disabled: !t.active && t.id !== form.teacherId,
    disabledReason: 'Professor inativo',
  }));
  const classOptions: ComboOption[] = data.classes.map((c) => ({
    value: c.id,
    label: c.name,
    description: `${c.grade} · ${SHIFT_LABEL[c.shift]}`,
    disabled: !c.active && c.id !== form.classId,
    disabledReason: 'Turma inativa',
  }));
  const teacherFirstName = teacher?.name.trim().split(/\s+/)[0] ?? '';
  const subjectOptions: ComboOption[] = [...data.subjects]
    .sort((a, b) => Number(suggestion.candidates.includes(b.id)) - Number(suggestion.candidates.includes(a.id)))
    .map((s) => ({
      value: s.id,
      label: s.name,
      description: suggestion.candidates.includes(s.id) ? `Disciplina de ${teacherFirstName}` : undefined,
      leading: <span className={cn('size-2.5 shrink-0 rounded-full', SUBJECT_STYLE[s.color].dot)} aria-hidden="true" />,
    }));
  const candidateSubjects = suggestion.candidates.map((id) => data.subjects.find((s) => s.id === id)).filter((s) => s !== undefined);

  async function submit(another: boolean) {
    setTouched(true);
    const parsed = lessonSchema.safeParse({
      teacherId: form.teacherId ?? 0,
      classId: form.classId ?? 0,
      subjectId: form.subjectId,
      weekday: form.weekday,
      start: form.start,
      end: form.end,
      notes: form.notes,
    });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? '_');
        if (!errs[key]) errs[key] = issue.message;
      }
      if ((errs.start || errs.end) && form.timeMode === 'period') errs.period = 'Selecione um período da grade.';
      setFieldErrors(errs);
      return;
    }
    if (blocking) {
      if (onlyOccupied) setResolving(parsed.data);
      return;
    }
    try {
      const result = await save.mutateAsync({ id: editingId, input: parsed.data });
      const desc = `${data.classes.find((c) => c.id === parsed.data.classId)?.name} · ${WEEKDAY_LABEL[parsed.data.weekday]}, ${parsed.data.start}–${parsed.data.end}`;
      toast.success(editingId ? 'Aula atualizada' : 'Aula adicionada', desc);
      if (result.warnings.some((w) => w.code === 'outside-grid')) {
        toast.info('Aula fora da grade', 'Ela aparece na lista "Fora da grade" do quadro até que os períodos sejam ajustados.');
      }
      if (another) {
        setForm((f) => ({ ...f, start: '', end: '', notes: '', subjectSource: 'auto' }));
        setTouched(false);
      } else {
        onClose();
      }
    } catch (error) {
      if (error instanceof ApiError && error.issues?.length) {
        setServerIssues(error.issues);
      } else if (error instanceof ApiError && error.fields) {
        setFieldErrors(error.fields);
      } else {
        setFormError(errorMessage(error));
      }
    }
  }

  const selectedRange = form.start ? periodRange(availablePeriods, form.start, form.end) : null;
  const selectedIds = new Set(selectedRange?.map((p) => p.id) ?? []);
  const lastSelected = selectedRange?.[selectedRange.length - 1];
  const nextContiguous = lastSelected ? availablePeriods[availablePeriods.indexOf(lastSelected) + 1] : undefined;
  const canExtend = Boolean(nextContiguous && lastSelected && nextContiguous.start === lastSelected.end);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit(false);
      }}
      noValidate
    >
      <div className="grid gap-5 md:grid-cols-[1fr_1.15fr]">
        {/* Coluna 1: quem e o quê */}
        <div className="flex flex-col gap-4">
          <Field label="Turma" required error={fieldErrors.classId}>
            <Combobox
              options={classOptions}
              value={form.classId}
              onChange={(v) => set('classId', v)}
              placeholder="Selecione a turma"
              emptyText="Nenhuma turma encontrada"
              autoFocusTarget={!form.classId}
            />
          </Field>
          <Field label="Professor" required error={fieldErrors.teacherId}>
            <Combobox
              options={teacherOptions}
              value={form.teacherId}
              onChange={(v) => set('teacherId', v)}
              placeholder="Selecione o professor"
              emptyText="Nenhum professor encontrado"
              autoFocusTarget={Boolean(form.classId) && !form.teacherId}
            />
          </Field>
          <Field
            label="Disciplina"
            optional
            error={fieldErrors.subjectId}
            hint={
              data.subjects.length === 0 ? (
                <>
                  Nenhuma disciplina cadastrada.{' '}
                  <Link to="/disciplinas" onClick={onClose} className="font-semibold text-ink underline underline-offset-2">
                    Cadastrar disciplinas
                  </Link>
                </>
              ) : undefined
            }
          >
            <Combobox
              options={subjectOptions}
              value={form.subjectId}
              onChange={chooseSubject}
              placeholder={data.subjects.length ? 'Selecione a disciplina' : 'Sem disciplinas cadastradas'}
              clearable
              disabled={data.subjects.length === 0}
            />
          </Field>
          <SubjectHelp
            teacherName={teacherFirstName}
            candidates={candidateSubjects}
            selected={form.subjectId}
            auto={form.subjectSource === 'auto'}
            reason={suggestion.reason}
            onPick={chooseSubject}
            learning={Boolean(teacher && form.subjectId !== null && !suggestion.candidates.includes(form.subjectId))}
          />
          <Field label="Observações" optional error={fieldErrors.notes}>
            <Textarea
              rows={2}
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder="Ex.: laboratório de ciências, sala 12"
              maxLength={500}
            />
          </Field>
        </div>

        {/* Coluna 2: quando */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-ink-2" id="lesson-day-label">
              Dia da semana <span className="text-danger">*</span>
            </span>
            <Segmented label="Dia da semana" value={form.weekday} onChange={(v) => set('weekday', v)} options={dayOptions} className="w-full" />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-semibold text-ink-2">
                Horário <span className="text-danger">*</span>
              </span>
              <Segmented
                size="sm"
                label="Forma de definir o horário"
                value={form.timeMode}
                onChange={(v) => {
                  setForm((f) => ({ ...f, timeMode: v }));
                  setServerIssues(null);
                }}
                options={[
                  { value: 'period', label: <><LayoutGrid className="size-3.5" />Período</> },
                  { value: 'custom', label: <><Clock className="size-3.5" />Personalizado</> },
                ]}
              />
            </div>

            {form.timeMode === 'period' ? (
              availablePeriods.length === 0 ? (
                <Alert tone="warning" title="Nenhum período de aula configurado">
                  {schoolClass ? `O turno ${SHIFT_LABEL[schoolClass.shift].toLowerCase()} ainda não tem períodos. ` : ''}
                  Cadastre os períodos em{' '}
                  <Link to="/configuracoes" onClick={onClose} className="font-semibold underline underline-offset-2">
                    Configurações
                  </Link>{' '}
                  ou use um horário personalizado.
                </Alert>
              ) : (
                <div
                  role="radiogroup"
                  aria-label="Período da grade"
                  aria-invalid={Boolean(fieldErrors.period) || undefined}
                  className="scrollbar-thin flex max-h-[300px] flex-col gap-1.5 overflow-y-auto pr-1"
                >
                  {availablePeriods.map((p, i) => {
                    const status = periodStatus(p);
                    const selected = selectedIds.has(p.id);
                    const showShift = i === 0 || availablePeriods[i - 1].shift !== p.shift;
                    const shiftCount = new Set(availablePeriods.map((x) => x.shift)).size;
                    return (
                      <div key={p.id} className={cn('contents')}>
                        {showShift && shiftCount > 1 && (
                          <p className="mt-1 text-xs font-bold text-muted first:mt-0">{SHIFT_LABEL[p.shift]}</p>
                        )}
                        <button
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => {
                            setForm((f) => ({ ...f, ...selectPeriod(availablePeriods, { start: f.start, end: f.end }, p) }));
                            setServerIssues(null);
                            setFieldErrors((e) => ({ ...e, period: '', start: '', end: '' }));
                          }}
                          className={cn(
                            'flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-left transition-[border-color,background-color,box-shadow] duration-150 focus-visible:outline-2 focus-visible:outline-ink',
                            selected
                              ? 'border-ink bg-brand-soft shadow-[inset_0_0_0_1px_var(--color-ink)]'
                              : 'border-line-strong bg-surface hover:border-soft hover:bg-subtle',
                          )}
                        >
                          <span className="flex min-w-0 items-baseline gap-3">
                            <span className="text-[13px] font-bold whitespace-nowrap text-ink">{p.label}</span>
                            <span className="tabular text-xs whitespace-nowrap text-muted">
                              {p.start}–{p.end}
                            </span>
                          </span>
                          <PeriodTag classBusy={status.classBusy} teacherBusy={status.teacherBusy} ready={Boolean(form.classId || form.teacherId)} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Início" error={fieldErrors.start}>
                  <Input type="time" value={form.start} onChange={(e) => set('start', e.target.value)} className="tabular" />
                </Field>
                <Field label="Término" error={fieldErrors.end}>
                  <Input type="time" value={form.end} onChange={(e) => set('end', e.target.value)} className="tabular" />
                </Field>
              </div>
            )}
            {form.timeMode === 'period' && selectedRange && (
              <p className="text-[13px] text-muted" role="status">
                {selectedRange.length > 1 ? (
                  <>
                    <strong className="text-ink">Aula de {selectedRange.length} períodos</strong> · {form.start}–{form.end}.{' '}
                    <button
                      type="button"
                      className="font-semibold text-ink underline underline-offset-2"
                      onClick={() => setForm((f) => ({ ...f, start: selectedRange[0].start, end: selectedRange[0].end }))}
                    >
                      Voltar para um período
                    </button>
                  </>
                ) : canExtend && nextContiguous ? (
                  <>
                    Aula dupla? Clique também em <strong className="text-ink">{nextContiguous.label}</strong> ({nextContiguous.start}–{nextContiguous.end}).
                  </>
                ) : null}
              </p>
            )}
            {fieldErrors.period && form.timeMode === 'period' && (
              <p className="text-[13px] font-medium text-danger">{fieldErrors.period}</p>
            )}
            {form.timeMode === 'custom' && timesReady && toMinutes(form.end) > toMinutes(form.start) && (
              <p className="tabular text-xs text-muted">Duração: {toMinutes(form.end) - toMinutes(form.start)} minutos</p>
            )}
          </div>
        </div>
      </div>

      {/* Conflitos e avisos */}
      <div className="mt-5 flex flex-col gap-2" aria-live="polite">
        {errorsList.length > 0 && (
          <Alert
            tone="danger"
            title={onlyOccupied ? 'Este horário já está ocupado' : errorsList.length === 1 ? 'Há um conflito a resolver antes de salvar' : `Há ${errorsList.length} problemas a resolver antes de salvar`}
            action={
              onlyOccupied && (
                <Button size="sm" variant="dark" icon={<ArrowLeftRight className="size-4" />} onClick={() => void submit(false)}>
                  Ver opções
                </Button>
              )
            }
          >
            <ul className="mt-1 space-y-1.5">
              {errorsList.map((issue, i) => (
                <li key={`${issue.code}-${i}`}>
                  <span className="font-medium">{issue.message}</span>
                  <span className="block text-[13px] opacity-80">{issue.hint}</span>
                  {issue.code === 'day-disabled' && (
                    <Link to="/configuracoes" onClick={onClose} className="mt-0.5 inline-flex items-center gap-1 text-[13px] font-semibold underline underline-offset-2">
                      <Settings2 className="size-3.5" /> Abrir configurações
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </Alert>
        )}
        {warningsList.map((issue, i) => (
          <Alert key={`w-${i}`} tone="warning" title={issue.message}>
            {issue.hint}
          </Alert>
        ))}
        {!blocking && form.classId && form.teacherId && timesReady && warningsList.length === 0 && (
          <Alert tone="success" title="Horário livre">
            {teacher?.name} e a turma {schoolClass?.name} estão disponíveis em {WEEKDAY_LABEL[form.weekday].toLowerCase()}, {form.start}–{form.end}.
          </Alert>
        )}
        {formError && <Alert tone="danger" title={formError} />}
        {touched && Object.values(fieldErrors).some(Boolean) && !formError && errorsList.length === 0 && (
          <p className="sr-only" role="alert">
            Revise os campos destacados.
          </p>
        )}
      </div>

      <div className="sticky -bottom-5 z-10 -mx-5 mt-6 -mb-5 flex flex-col-reverse gap-2 border-t border-line bg-subtle px-5 py-3.5 sm:-mx-6 sm:flex-row sm:items-center sm:px-6">
        <Button onClick={onClose} disabled={save.isPending}>
          Cancelar
        </Button>
        <div className="flex-1" />
        {request.mode === 'create' && (
          <Button
            icon={<Copy className="size-4" />}
            onClick={() => void submit(true)}
            disabled={blocking || save.isPending}
            className="hidden sm:inline-flex"
            title="Salva e mantém turma, professor e disciplina para a próxima aula"
          >
            Salvar e adicionar outra
          </Button>
        )}
        <Button type="submit" variant="primary" loading={save.isPending} disabled={blocking && !onlyOccupied}>
          {blocking && onlyOccupied ? 'Substituir ou trocar…' : request.mode === 'edit' ? 'Salvar alterações' : 'Salvar aula'}
        </Button>
      </div>

      <ConflictResolver
        open={resolving !== null}
        data={data}
        draft={resolving ?? ({} as LessonInput)}
        original={request.mode === 'edit' ? request.lesson : undefined}
        occupants={occupants}
        onCancel={() => setResolving(null)}
        onDone={onClose}
      />
    </form>
  );
}

function PeriodTag({ classBusy, teacherBusy, ready }: { classBusy: boolean; teacherBusy: boolean; ready: boolean }) {
  if (!ready) return null;
  if (classBusy && teacherBusy) return <Tag tone="danger">Ocupado</Tag>;
  if (classBusy) return <Tag tone="danger">Turma ocupada</Tag>;
  if (teacherBusy) return <Tag tone="danger">Prof. ocupado</Tag>;
  return <Tag tone="success">Livre</Tag>;
}

function Tag({ tone, children }: { tone: 'danger' | 'success'; children: string }) {
  return (
    <span
      className={cn(
        'shrink-0 rounded px-1.5 py-0.5 text-[11px] font-bold',
        tone === 'danger' ? 'bg-danger-soft text-danger' : 'bg-success-soft text-success',
      )}
    >
      {children}
    </span>
  );
}

/** Explica a disciplina escolhida e oferece as do professor como escolha rápida. */
function SubjectHelp({
  teacherName,
  candidates,
  selected,
  auto,
  reason,
  onPick,
  learning,
}: {
  teacherName: string;
  candidates: { id: number; name: string; color: keyof typeof SUBJECT_STYLE }[];
  selected: number | null;
  auto: boolean;
  reason: 'unica' | 'horario' | null;
  onPick: (id: number) => void;
  learning: boolean;
}) {
  if (!teacherName) return null;
  const several = candidates.length > 1;
  return (
    <div className="-mt-2 flex flex-col gap-2">
      {several && (
        <div className="rounded-lg bg-subtle px-3 py-2.5">
          <p className="text-[13px] font-semibold text-ink-2">
            {teacherName} leciona {candidates.length} disciplinas. Qual será nesta aula?
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {candidates.map((c) => {
              const on = c.id === selected;
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onPick(c.id)}
                  className={cn(
                    'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink',
                    on ? 'border-ink bg-ink text-white' : 'border-line-strong bg-surface text-ink-2 hover:bg-surface hover:border-soft',
                  )}
                >
                  <span className={cn('size-2 rounded-full', SUBJECT_STYLE[c.color].dot)} aria-hidden="true" />
                  {c.name}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {auto && selected !== null && reason && (
        <p className="flex items-start gap-1.5 text-xs text-muted">
          <Sparkles className="mt-px size-3.5 shrink-0 text-brand-ink" />
          {reason === 'unica'
            ? `Preenchida automaticamente: é a disciplina de ${teacherName}.`
            : `Sugerida pelo horário: ${teacherName} dá esta disciplina para a turma em horário colado ou no mesmo horário de outro dia. Confira.`}
        </p>
      )}
      {learning && (
        <p className="text-xs text-muted">Ao salvar, esta disciplina passa a constar no cadastro de {teacherName}.</p>
      )}
    </div>
  );
}
