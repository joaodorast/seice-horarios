import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { AlertTriangle, ArrowRight, Check, CheckCircle2, ChevronLeft, ChevronRight, Minus, PencilRuler, Plus, Trash2, UserPlus, Users } from 'lucide-react';
import { Page } from '@/components/layout/Page';
import { DataGate } from '@/components/layout/DataGate';
import { Button, Card, Combobox, EmptyState, Modal, SearchInput, Segmented, Spinner, useToast } from '@/components/ui';
import { useSaveAssignments, useScheduleData, type ScheduleData } from '@/api/hooks';
import { errorMessage } from '@/api/client';
import { ImportButton } from '@/features/import/ImportDialog';
import { CellPicker, type PickerGroup } from '@/components/schedule/CellPicker';
import { Avatar } from '@/pages/TeachersPage';
import { assignmentKey, assignmentProgress, classCapacity, type AssignmentProgress } from '@shared/assignments';
import { SHIFT_LABEL } from '@shared/labels';
import { hasAvailability, rangesText, slotsOfDay } from '@shared/availability';
import { teacherSubjectIds } from '@shared/suggest';
import type { AssignmentBatchInput } from '@shared/schemas';
import { CLASS_SHIFTS, type Assignment, type SchoolClass, type Subject, type Teacher } from '@shared/types';
import { SUBJECT_STYLE } from '@/lib/subjectColors';
import { teacherPhotoUrl } from '@/lib/image';
import { matches, plural } from '@/lib/text';
import { cn } from '@/lib/cn';
import { GUIDES } from '@/lib/guides';

type View = 'teacher' | 'class';
const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true });
const firstName = (name: string) => name.trim().split(/\s+/)[0];
const DEFAULT_WEEKLY = 2;

/** Atribuição de aulas: quem dá cada disciplina em cada turma e quantas aulas por semana. */
export function AssignmentsPage({ view }: { view: View }) {
  const schedule = useScheduleData();
  const navigate = useNavigate();
  return (
    <Page
      title="Atribuição de aulas"
      width="wide"
      guide={GUIDES.assignments}
      breadcrumbs={[{ label: 'Quadro de horários', to: '/horarios' }, { label: 'Atribuição de aulas' }]}
      description="Defina quais turmas cada professor assume, em qual disciplina e com quantas aulas por semana. Depois, no Montar quadro, o professor certo já aparece sozinho."
      actions={
        <>
          <ImportButton kind="assignments" label="Importar planilha" />
          <Segmented
            label="Ver atribuições"
            value={view}
            onChange={(v) => navigate(v === 'teacher' ? '/atribuicoes/professor' : '/atribuicoes/turma')}
            options={[
              { value: 'teacher', label: 'Por professor' },
              { value: 'class', label: 'Por turma' },
            ]}
          />
        </>
      }
    >
      <DataGate data={schedule.data} isLoading={schedule.isLoading} error={schedule.error} onRetry={schedule.refetch}>
        {(data) =>
          data.teachers.length === 0 || data.classes.length === 0 || data.subjects.length === 0 ? (
            <Card>
              <EmptyState
                icon={<Users />}
                title="Cadastre professores, turmas e disciplinas primeiro"
                description="A atribuição liga um professor a uma turma em uma disciplina."
              />
            </Card>
          ) : view === 'teacher' ? (
            <TeacherView data={data} />
          ) : (
            <ClassView data={data} />
          )
        }
      </DataGate>
    </Page>
  );
}

export const TeacherAssignmentsPage = () => <AssignmentsPage view="teacher" />;
export const ClassAssignmentsPage = () => <AssignmentsPage view="class" />;

// ------------------------------------------------------------------ Gravação

function useAssignmentWriter() {
  const save = useSaveAssignments();
  const toast = useToast();
  return {
    pending: save.isPending,
    async apply(batch: Partial<AssignmentBatchInput>, success?: string) {
      try {
        await save.mutateAsync({ upserts: batch.upserts ?? [], removes: batch.removes ?? [] });
        if (success) toast.success(success);
        return true;
      } catch (error) {
        toast.error('Não foi possível salvar a atribuição', errorMessage(error));
        return false;
      }
    },
  };
}

function useProgress(data: ScheduleData) {
  return useMemo(() => assignmentProgress(data.assignments, data.lessons, data.periods, data.classes), [data]);
}

// ------------------------------------------------------------------ Por professor

function TeacherView({ data }: { data: ScheduleData }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const teachers = useMemo(() => data.teachers.filter((t) => t.active).sort(byName), [data.teachers]);
  const selected = teachers.find((t) => t.id === Number(id));

  useEffect(() => {
    if (!selected && teachers.length) navigate(`/atribuicoes/professor/${teachers[0].id}`, { replace: true });
  }, [selected, teachers, navigate]);

  const totals = (t: Teacher) => {
    const own = data.assignments.filter((a) => a.teacherId === t.id);
    return { lessons: own.reduce((s, a) => s + a.weeklyLessons, 0), classes: new Set(own.map((a) => a.classId)).size };
  };
  const visible = teachers.filter((t) => matches([t.name, t.code], query));

  return (
    <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)]">
      <Card className="flex flex-col overflow-hidden lg:sticky lg:top-4 lg:max-h-[calc(100dvh/var(--ui-zoom,1)-2rem)] lg:self-start">
        <div className="border-b border-line p-3">
          <SearchInput value={query} onChange={setQuery} placeholder="Pesquisar professor" />
        </div>
        <ul className="scrollbar-thin flex-1 overflow-y-auto p-2" aria-label="Professores">
          {visible.map((t) => {
            const { lessons, classes } = totals(t);
            const active = t.id === selected?.id;
            return (
              <li key={t.id}>
                <Link
                  to={`/atribuicoes/professor/${t.id}`}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-2.5 py-2 transition-colors',
                    active ? 'bg-nav text-white' : 'text-ink hover:bg-subtle',
                  )}
                >
                  <Avatar name={t.name} photo={teacherPhotoUrl(t)} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-bold">{t.name}</span>
                    <span className={cn('block truncate text-xs font-medium', active ? 'text-nav-text' : 'text-ink-2')}>
                      {lessons ? `${plural(lessons, 'aula', 'aulas')} · ${plural(classes, 'turma', 'turmas')}` : 'Nenhuma turma atribuída'}
                    </span>
                  </span>
                  {lessons > 0 && (
                    <span className={cn('tabular grid h-7 min-w-7 place-items-center rounded-full px-2 text-xs font-extrabold', active ? 'bg-brand text-ink' : 'bg-subtle text-ink ring-1 ring-line')}>
                      {lessons}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
          {visible.length === 0 && <li className="px-3 py-8 text-center text-[13.5px] text-muted">Nenhum professor encontrado.</li>}
        </ul>
      </Card>

      {selected && <TeacherPanel key={selected.id} teacher={selected} data={data} />}
    </div>
  );
}

function TeacherPanel({ teacher, data }: { teacher: Teacher; data: ScheduleData }) {
  const progress = useProgress(data);
  const writer = useAssignmentWriter();
  const [editing, setEditing] = useState<{ subjectId: number | null } | null>(null);
  const own = data.assignments.filter((a) => a.teacherId === teacher.id);
  const subjectIds = [...new Set(own.map((a) => a.subjectId))];
  const subjects = subjectIds.map((sid) => data.subjects.find((s) => s.id === sid)!).filter(Boolean).sort(byName);
  const mySubjects = data.subjects.filter((s) => teacherSubjectIds(teacher, data.subjects).includes(s.id)).sort(byName);
  const totalWeekly = own.reduce((s, a) => s + a.weeklyLessons, 0);
  const totalPlaced = own.reduce((s, a) => s + Math.min(a.weeklyLessons, progress.get(assignmentKey(a.classId, a.subjectId))?.placed ?? 0), 0);
  const className = (id: number) => data.classes.find((c) => c.id === id);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {/* Cabeçalho do professor */}
      <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <Avatar name={teacher.name} photo={teacherPhotoUrl(teacher)} size="lg" />
          <div className="min-w-0">
            <h2 className="truncate text-xl font-extrabold text-ink">{teacher.name}</h2>
            <p className="mt-1 text-[13.5px] text-ink-2">
              <strong className="text-ink">Na escola:</strong> {availabilitySummary(teacher)}{' '}
              <Link to={`/professores/${teacher.id}`} className="font-semibold text-ink underline underline-offset-2 hover:text-brand-ink">
                alterar
              </Link>
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {mySubjects.length ? (
                mySubjects.map((s) => <SubjectTag key={s.id} subject={s} />)
              ) : (
                <span className="text-[13px] text-muted">Sem disciplinas cadastradas</span>
              )}
            </div>
          </div>
        </div>
        <Button variant="primary" size="lg" icon={<UserPlus className="size-5" />} onClick={() => setEditing({ subjectId: null })}>
          Atribuir turmas
        </Button>
      </Card>

      {/* Números da semana */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Aulas atribuídas por semana" value={String(totalWeekly)} />
        <Stat label="Turmas" value={String(new Set(own.map((a) => a.classId)).size)} />
        <Card className="px-4 py-3">
          <p className="text-[13px] font-semibold text-ink-2">Já lançadas no quadro</p>
          <p className="tabular mt-0.5 text-2xl font-extrabold text-ink">
            {totalPlaced} <span className="text-base font-bold text-ink-2">de {totalWeekly}</span>
          </p>
          <Bar value={totalPlaced} max={totalWeekly} />
        </Card>
      </div>

      {own.length === 0 ? (
        <Card>
          <EmptyState
            icon={<UserPlus />}
            title={`${firstName(teacher.name)} ainda não tem turmas`}
            description="Escolha a disciplina e marque as turmas que este professor vai assumir. Dá para marcar várias de uma vez."
            action={
              <Button variant="primary" icon={<UserPlus className="size-4" />} onClick={() => setEditing({ subjectId: null })}>
                Atribuir turmas
              </Button>
            }
          />
        </Card>
      ) : (
        subjects.map((s) => {
          const rows = own.filter((a) => a.subjectId === s.id).sort((a, b) => byName(className(a.classId)!, className(b.classId)!));
          const sum = rows.reduce((n, a) => n + a.weeklyLessons, 0);
          return (
            <Card key={s.id} className="overflow-hidden">
              <div className="flex flex-wrap items-center gap-3 border-b border-line bg-subtle px-4 py-3">
                <span className={cn('size-3 rounded-full', SUBJECT_STYLE[s.color].dot)} />
                <h3 className="text-[16px] font-extrabold text-ink">{s.name}</h3>
                <span className="text-[13px] font-semibold text-ink-2">
                  {plural(rows.length, 'turma', 'turmas')} · {plural(sum, 'aula', 'aulas')} por semana
                </span>
                <Button size="sm" className="ml-auto" icon={<Plus className="size-4" />} onClick={() => setEditing({ subjectId: s.id })}>
                  Turmas de {s.name}
                </Button>
              </div>
              <ul className="divide-y divide-line">
                {rows.map((a) => {
                  const c = className(a.classId)!;
                  return (
                    <li key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                      <span className="min-w-[120px] flex-1">
                        <span className="block text-[16px] font-extrabold text-ink">{c.name}</span>
                        <span className="block text-xs font-semibold text-ink-2">
                          {c.grade} · {SHIFT_LABEL[c.shift]}
                        </span>
                      </span>
                      <WeeklyStepper
                        value={a.weeklyLessons}
                        label={`Aulas por semana de ${s.name} no ${c.name}`}
                        onCommit={(weeklyLessons) => writer.apply({ upserts: [{ teacherId: a.teacherId, classId: a.classId, subjectId: a.subjectId, weeklyLessons }] })}
                      />
                      <ProgressPill progress={progress.get(assignmentKey(a.classId, a.subjectId))} />
                      <span className="flex items-center gap-1">
                        <Link
                          to={`/horarios/montar/turma/${c.id}`}
                          className="grid size-9 place-items-center rounded-lg text-ink-2 hover:bg-subtle hover:text-ink"
                          title={`Montar o quadro do ${c.name}`}
                          aria-label={`Montar o quadro do ${c.name}`}
                        >
                          <PencilRuler className="size-[18px]" />
                        </Link>
                        <button
                          type="button"
                          className="grid size-9 place-items-center rounded-lg text-ink-2 hover:bg-danger-soft hover:text-danger"
                          title="Tirar esta turma do professor"
                          aria-label={`Tirar ${c.name} de ${teacher.name}`}
                          onClick={() => writer.apply({ removes: [{ classId: a.classId, subjectId: a.subjectId }] }, `${c.name} saiu da atribuição de ${firstName(teacher.name)}`)}
                        >
                          <Trash2 className="size-[18px]" />
                        </button>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Card>
          );
        })
      )}

      {editing && <AssignClassesModal teacher={teacher} data={data} initialSubjectId={editing.subjectId} onClose={() => setEditing(null)} />}
    </div>
  );
}

// ------------------------------------------------------------------ Modal: atribuir turmas

function AssignClassesModal({ teacher, data, initialSubjectId, onClose }: { teacher: Teacher; data: ScheduleData; initialSubjectId: number | null; onClose: () => void }) {
  const writer = useAssignmentWriter();
  const mine = data.subjects.filter((s) => teacherSubjectIds(teacher, data.subjects).includes(s.id)).sort(byName);
  const [subjectId, setSubjectId] = useState<number | null>(initialSubjectId ?? mine[0]?.id ?? null);
  const [weekly, setWeekly] = useState(DEFAULT_WEEKLY);
  const current = (sid: number | null) => new Map(data.assignments.filter((a) => a.teacherId === teacher.id && a.subjectId === sid).map((a) => [a.classId, a.weeklyLessons]));
  const [picked, setPicked] = useState<Map<number, number>>(() => current(subjectId));

  const chooseSubject = (sid: number | null) => {
    setSubjectId(sid);
    setPicked(current(sid));
  };

  const subject = data.subjects.find((s) => s.id === subjectId);
  const classes = data.classes.filter((c) => c.active).sort(byName);
  const holderOf = (classId: number) => data.assignments.find((a) => a.classId === classId && a.subjectId === subjectId);
  const before = current(subjectId);

  const upserts = [...picked]
    .filter(([cid, n]) => before.get(cid) !== n)
    .map(([classId, weeklyLessons]) => ({ teacherId: teacher.id, classId, subjectId: subjectId!, weeklyLessons }));
  const removes = [...before.keys()].filter((cid) => !picked.has(cid)).map((classId) => ({ classId, subjectId: subjectId! }));
  const takeovers = [...picked.keys()].filter((cid) => {
    const h = holderOf(cid);
    return h && h.teacherId !== teacher.id;
  });
  const total = [...picked.values()].reduce((s, n) => s + n, 0);

  const toggle = (c: SchoolClass) =>
    setPicked((all) => {
      const next = new Map(all);
      if (next.has(c.id)) next.delete(c.id);
      else next.set(c.id, before.get(c.id) ?? weekly);
      return next;
    });

  async function confirm() {
    if (!subjectId) return;
    if (!upserts.length && !removes.length) return onClose();
    const ok = await writer.apply({ upserts, removes }, `Atribuição de ${firstName(teacher.name)} atualizada`);
    if (ok) onClose();
  }

  const shifts = CLASS_SHIFTS.filter((s) => classes.some((c) => c.shift === s));

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title={`Atribuir turmas a ${teacher.name}`}
      description="Escolha a disciplina e marque todas as turmas em que o professor vai dar essa aula."
      footer={
        <>
          <p className="mr-auto text-[13.5px] text-ink-2">
            {subject ? (
              <>
                <strong className="text-ink">{firstName(teacher.name)}</strong> com <strong className="text-ink">{subject.name}</strong> em{' '}
                <strong className="text-ink">{plural(picked.size, 'turma', 'turmas')}</strong> · {plural(total, 'aula', 'aulas')} por semana
              </>
            ) : (
              'Escolha a disciplina.'
            )}
          </p>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" icon={<Check className="size-4" />} loading={writer.pending} disabled={!subjectId} onClick={() => void confirm()}>
            Salvar atribuição
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        {/* 1. Disciplina */}
        <section>
          <StepTitle n={1}>Disciplina</StepTitle>
          <div className="flex flex-wrap items-center gap-2">
            {mine.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => chooseSubject(s.id)}
                aria-pressed={s.id === subjectId}
                className={cn(
                  'inline-flex h-10 items-center gap-2 rounded-full px-4 text-[14px] font-bold ring-1 ring-inset transition-colors',
                  s.id === subjectId ? 'bg-nav text-white ring-nav' : 'bg-surface text-ink ring-line-strong hover:ring-ink',
                )}
              >
                <span className={cn('size-2.5 rounded-full', SUBJECT_STYLE[s.color].dot)} />
                {s.name}
                {s.id === subjectId && <Check className="size-4 text-brand" />}
              </button>
            ))}
            <div className="w-full sm:w-64">
              <Combobox
                value={subjectId && !mine.some((s) => s.id === subjectId) ? subjectId : null}
                onChange={(v) => v && chooseSubject(v)}
                placeholder={mine.length ? 'Outra disciplina…' : 'Escolha a disciplina'}
                options={data.subjects
                  .filter((s) => !mine.some((m) => m.id === s.id))
                  .sort(byName)
                  .map((s) => ({ value: s.id, label: s.name, leading: <span className={cn('size-2.5 rounded-full', SUBJECT_STYLE[s.color].dot)} /> }))}
              />
            </div>
          </div>
        </section>

        {/* 2. Turmas */}
        <section className={cn(!subjectId && 'pointer-events-none opacity-40')}>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <StepTitle n={2}>Turmas</StepTitle>
            <div className="mb-3 flex items-center gap-3">
              <span className="text-[13px] font-semibold text-ink-2">Aulas por semana para novas turmas</span>
              <Stepper value={weekly} onChange={setWeekly} label="Aulas por semana para novas turmas" />
            </div>
          </div>
          <div className="flex flex-col gap-4">
            {shifts.map((shift) => (
              <div key={shift}>
                <div className="mb-2 flex items-center gap-3">
                  <h4 className="text-xs font-bold tracking-wide text-ink-2 uppercase">{SHIFT_LABEL[shift]}</h4>
                  <button
                    type="button"
                    className="text-xs font-bold text-ink underline-offset-2 hover:underline"
                    onClick={() =>
                      setPicked((all) => {
                        const next = new Map(all);
                        for (const c of classes.filter((x) => x.shift === shift)) if (!next.has(c.id)) next.set(c.id, before.get(c.id) ?? weekly);
                        return next;
                      })
                    }
                  >
                    Marcar todas
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                  {classes
                    .filter((c) => c.shift === shift)
                    .map((c) => {
                      const on = picked.has(c.id);
                      const holder = holderOf(c.id);
                      const other = holder && holder.teacherId !== teacher.id ? data.teachers.find((t) => t.id === holder.teacherId) : undefined;
                      return (
                        <div
                          key={c.id}
                          className={cn(
                            'flex min-h-[76px] items-center gap-3 rounded-xl px-3 py-2.5 ring-inset transition-[background-color,box-shadow]',
                            on ? 'bg-brand-soft ring-2 ring-brand' : 'bg-surface ring-1 ring-line-strong hover:ring-ink/50',
                          )}
                        >
                          <button type="button" role="checkbox" aria-checked={on} onClick={() => toggle(c)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                            <span className={cn('grid size-6 shrink-0 place-items-center rounded-md ring-2 ring-inset', on ? 'bg-ink text-brand ring-ink' : 'bg-surface ring-line-strong')}>
                              {on && <Check className="size-4" strokeWidth={3} />}
                            </span>
                            <span className="min-w-0">
                              <span className="block text-[16px] font-extrabold text-ink">{c.name}</span>
                              <span
                                className={cn(
                                  'block truncate text-xs font-semibold',
                                  before.has(c.id) && !on ? 'text-danger' : other ? 'text-warning' : 'text-ink-2',
                                )}
                              >
                                {before.has(c.id)
                                  ? on
                                    ? 'Já atribuída'
                                    : 'Vai sair da atribuição'
                                  : other
                                    ? on
                                      ? `Sai de ${firstName(other.name)} e passa para ${firstName(teacher.name)}`
                                      : `Hoje com ${other.name}`
                                    : on
                                      ? 'Nova turma'
                                      : 'Sem professor'}
                              </span>
                            </span>
                          </button>
                          {on && (
                            <Stepper
                              size="sm"
                              value={picked.get(c.id)!}
                              label={`Aulas por semana no ${c.name}`}
                              onChange={(n) => setPicked((all) => new Map(all).set(c.id, n))}
                            />
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>
        </section>

        {takeovers.length > 0 && subject && (
          <p className="flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2.5 text-[13.5px] font-medium text-ink">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
            {plural(takeovers.length, 'turma passa', 'turmas passam')} a ter {subject.name} com {firstName(teacher.name)}. Cada turma tem um professor por disciplina, então o professor anterior sai dessa atribuição. As aulas já lançadas no quadro não mudam.
          </p>
        )}
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------------ Por turma

function ClassView({ data }: { data: ScheduleData }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const writer = useAssignmentWriter();
  const progress = useProgress(data);
  const classes = useMemo(() => data.classes.filter((c) => c.active).sort(byName), [data.classes]);
  const selected = classes.find((c) => c.id === Number(id));

  useEffect(() => {
    if (!selected && classes.length) navigate(`/atribuicoes/turma/${classes[0].id}`, { replace: true });
  }, [selected, classes, navigate]);
  if (!selected) return null;

  const pos = classes.indexOf(selected);
  const own = data.assignments.filter((a) => a.classId === selected.id);
  const total = own.reduce((s, a) => s + a.weeklyLessons, 0);
  const capacity = classCapacity(selected, data.periods, data.settings.enabledDays);
  const subjects = [...data.subjects].sort((a, b) => {
    const ia = own.some((x) => x.subjectId === a.id) ? 0 : 1;
    const ib = own.some((x) => x.subjectId === b.id) ? 0 : 1;
    return ia - ib || byName(a, b);
  });
  // Carga de cada professor (todas as turmas), para mostrar na lista.
  const loadOf = (teacherId: number) => data.assignments.filter((a) => a.teacherId === teacherId).reduce((s, a) => s + a.weeklyLessons, 0);

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center">
        <div className="flex items-center gap-2 lg:w-[400px]">
          <Button size="sm" variant="ghost" aria-label="Turma anterior" disabled={pos <= 0} onClick={() => navigate(`/atribuicoes/turma/${classes[pos - 1].id}`)}>
            <ChevronLeft className="size-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <Combobox value={selected.id} onChange={(v) => v && navigate(`/atribuicoes/turma/${v}`)} options={classes.map((c) => ({ value: c.id, label: c.name, description: `${c.grade} · ${SHIFT_LABEL[c.shift]}` }))} />
          </div>
          <Button size="sm" variant="ghost" aria-label="Próxima turma" disabled={pos >= classes.length - 1} onClick={() => navigate(`/atribuicoes/turma/${classes[pos + 1].id}`)}>
            <ChevronRight className="size-5" />
          </Button>
        </div>
        <div className="flex-1 lg:max-w-md lg:ml-auto">
          <div className="flex items-baseline justify-between gap-3 text-[13.5px]">
            <span className="font-semibold text-ink-2">Aulas atribuídas na semana</span>
            <span className="tabular">
              <strong className={cn('text-lg', total > capacity ? 'text-danger' : 'text-ink')}>{total}</strong>
              <span className="font-semibold text-ink-2"> de {capacity} horários</span>
            </span>
          </div>
          <Bar value={total} max={capacity} danger={total > capacity} />
          {total > capacity && <p className="mt-1 text-xs font-bold text-danger">Mais aulas atribuídas do que horários na grade da turma.</p>}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="hidden grid-cols-[minmax(160px,1.1fr)_minmax(200px,1.4fr)_200px_minmax(170px,1fr)_56px] gap-4 border-b border-line bg-nav px-4 py-3 text-xs font-bold tracking-wide text-nav-text uppercase md:grid">
          <span>Disciplina</span>
          <span>Professor</span>
          <span>Aulas por semana</span>
          <span>No quadro</span>
          <span className="sr-only">Ações</span>
        </div>
        <ul className="divide-y divide-line">
          {subjects.map((s) => {
            const a = own.find((x) => x.subjectId === s.id);
            const groups = teacherGroups(data, s, a, loadOf);
            return (
              <li
                key={s.id}
                className={cn(
                  'grid grid-cols-2 items-center gap-x-4 gap-y-2 px-4 py-3 md:grid-cols-[minmax(160px,1.1fr)_minmax(200px,1.4fr)_200px_minmax(170px,1fr)_56px]',
                  !a && 'bg-subtle/60',
                )}
              >
                <span className="col-span-2 flex items-center gap-2.5 md:col-span-1">
                  <span className={cn('size-3 shrink-0 rounded-full', SUBJECT_STYLE[s.color].dot)} />
                  <span className={cn('text-[15px] font-bold', a ? 'text-ink' : 'text-ink-2')}>{s.name}</span>
                </span>
                <span className="col-span-2 md:col-span-1">
                  <CellPicker
                    label={`Professor de ${s.name} no ${selected.name}`}
                    placeholder="Escolher professor"
                    value={a?.teacherId ?? null}
                    groups={groups}
                    onChange={(teacherId) =>
                      teacherId
                        ? writer.apply({ upserts: [{ teacherId, classId: selected.id, subjectId: s.id, weeklyLessons: a?.weeklyLessons ?? DEFAULT_WEEKLY }] })
                        : writer.apply({ removes: [{ classId: selected.id, subjectId: s.id }] })
                    }
                  />
                </span>
                <span>
                  {a ? (
                    <WeeklyStepper
                      value={a.weeklyLessons}
                      label={`Aulas por semana de ${s.name}`}
                      onCommit={(weeklyLessons) => writer.apply({ upserts: [{ ...pick(a), weeklyLessons }] })}
                    />
                  ) : (
                    <span className="text-[13px] text-muted">—</span>
                  )}
                </span>
                <span>{a ? <ProgressPill progress={progress.get(assignmentKey(selected.id, s.id))} /> : <span className="text-[13px] text-muted">Sem professor</span>}</span>
                <span className="col-span-2 flex justify-end gap-1 md:col-span-1">
                  {a && (
                    <button
                      type="button"
                      className="grid size-9 place-items-center rounded-lg text-ink-2 hover:bg-danger-soft hover:text-danger"
                      title="Tirar o professor desta disciplina"
                      aria-label={`Tirar o professor de ${s.name}`}
                      onClick={() => writer.apply({ removes: [{ classId: selected.id, subjectId: s.id }] })}
                    >
                      <Trash2 className="size-[18px]" />
                    </button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SaveStatus pending={writer.pending} />
        <Link to={`/horarios/montar/turma/${selected.id}`} className="inline-flex items-center gap-2 text-[14px] font-bold text-ink underline-offset-4 hover:underline">
          Montar o quadro do {selected.name} <ArrowRight className="size-4" />
        </Link>
      </div>
    </div>
  );
}

const pick = (a: Assignment) => ({ teacherId: a.teacherId, classId: a.classId, subjectId: a.subjectId });

/** Professores para a disciplina na turma: quem leciona a disciplina primeiro, com a carga atual de cada um. */
function teacherGroups(data: ScheduleData, s: Subject, current: Assignment | undefined, loadOf: (id: number) => number): PickerGroup[] {
  const active = data.teachers.filter((t) => t.active || t.id === current?.teacherId).sort(byName);
  const teaches = active.filter((t) => teacherSubjectIds(t, data.subjects).includes(s.id));
  const others = active.filter((t) => !teaches.includes(t));
  const option = (t: Teacher) => ({ value: t.id, label: t.name, hint: `${loadOf(t.id)} aulas` });
  return [
    ...(teaches.length ? [{ label: `Lecionam ${s.name}`, options: teaches.map(option) }] : []),
    { label: teaches.length ? 'Outros professores' : 'Professores', options: others.map(option) },
  ];
}

// ------------------------------------------------------------------ Peças

const DAY_SHORT: Record<number, string> = { 1: 'seg', 2: 'ter', 3: 'qua', 4: 'qui', 5: 'sex', 6: 'sáb' };

/** "seg, qua e sex (07:00 às 12:20)" — resumo dos dias e horários do professor na escola. */
function availabilitySummary(t: Teacher): string {
  if (!hasAvailability(t)) return 'ainda não informado (qualquer horário)';
  const byText = new Map<string, number[]>();
  for (const d of [...new Set(t.availability.map((a) => a.weekday))].sort()) {
    const text = rangesText(slotsOfDay(t, d));
    byText.set(text, [...(byText.get(text) ?? []), d]);
  }
  const list = (ds: number[]) => (ds.length > 1 ? `${ds.slice(0, -1).map((d) => DAY_SHORT[d]).join(', ')} e ${DAY_SHORT[ds.at(-1)!]}` : DAY_SHORT[ds[0]]);
  return [...byText].map(([text, ds]) => `${list(ds)} (${text})`).join('; ');
}

function StepTitle({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <h3 className="mb-3 flex items-center gap-2.5 text-[15px] font-extrabold text-ink">
      <span className="grid size-7 place-items-center rounded-full bg-nav text-[13px] text-brand">{n}</span>
      {children}
    </h3>
  );
}

function SubjectTag({ subject }: { subject: Subject }) {
  const style = SUBJECT_STYLE[subject.color];
  return (
    <span className={cn('inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold ring-1 ring-inset', style.chip, style.ring)}>
      <span className={cn('size-2 rounded-full', style.dot)} />
      {subject.name}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="px-4 py-3">
      <p className="text-[13px] font-semibold text-ink-2">{label}</p>
      <p className="tabular mt-0.5 text-2xl font-extrabold text-ink">{value}</p>
    </Card>
  );
}

function Bar({ value, max, danger }: { value: number; max: number; danger?: boolean }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <span className="mt-2 block h-2 overflow-hidden rounded-full bg-ink/10" role="presentation">
      <span className={cn('block h-full rounded-full transition-[width] duration-300', danger ? 'bg-danger' : value >= max && max > 0 ? 'bg-success' : 'bg-brand')} style={{ width: `${pct}%` }} />
    </span>
  );
}

/** Situação no quadro: quantas aulas atribuídas já foram lançadas. */
function ProgressPill({ progress }: { progress: AssignmentProgress | undefined }) {
  if (!progress) return null;
  const { placed, assignment, missing, status } = progress;
  const tone = {
    empty: 'bg-subtle text-ink-2 ring-line-strong',
    partial: 'bg-warning-soft text-warning ring-warning/30',
    complete: 'bg-success-soft text-success ring-success/30',
    over: 'bg-danger-soft text-danger ring-danger/30',
  }[status];
  const text = {
    empty: 'nenhuma no quadro',
    partial: `faltam ${missing}`,
    complete: 'completo',
    over: `${-missing} a mais`,
  }[status];
  return (
    <span className={cn('inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-bold ring-1 ring-inset', tone)} title="Aulas já lançadas no quadro de horários">
      {status === 'complete' ? <CheckCircle2 className="size-4" /> : null}
      <span className="tabular">
        {placed} de {assignment.weeklyLessons}
      </span>
      <span className="font-semibold opacity-90">· {text}</span>
    </span>
  );
}

function Stepper({ value, onChange, label, size = 'md' }: { value: number; onChange: (n: number) => void; label: string; size?: 'sm' | 'md' }) {
  const box = size === 'sm' ? 'size-8' : 'size-9';
  return (
    <span role="group" aria-label={label} className="inline-flex shrink-0 items-center rounded-lg bg-surface ring-1 ring-line-strong">
      <button type="button" className={cn('grid place-items-center rounded-l-lg text-ink hover:bg-subtle disabled:opacity-30', box)} aria-label="Menos uma aula" disabled={value <= 1} onClick={() => onChange(value - 1)}>
        <Minus className="size-4" />
      </button>
      <span className={cn('tabular grid min-w-9 place-items-center border-x border-line px-1 font-extrabold text-ink', size === 'sm' ? 'text-[15px]' : 'text-[17px]')} aria-live="polite">
        {value}
      </span>
      <button type="button" className={cn('grid place-items-center rounded-r-lg text-ink hover:bg-subtle disabled:opacity-30', box)} aria-label="Mais uma aula" disabled={value >= 40} onClick={() => onChange(value + 1)}>
        <Plus className="size-4" />
      </button>
    </span>
  );
}

/** Contador que grava sozinho, um instante depois do último clique (vários cliques viram uma gravação só). */
function WeeklyStepper({ value, onCommit, label }: { value: number; onCommit: (n: number) => Promise<boolean>; label: string }) {
  const [local, setLocal] = useState(value);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (timer.current === undefined) setLocal(value);
  }, [value]);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const change = (n: number) => {
    setLocal(n);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      timer.current = undefined;
      if (n !== value && !(await onCommit(n))) setLocal(value);
    }, 450);
  };
  return (
    <span className="inline-flex items-center gap-2">
      <Stepper value={local} onChange={change} label={label} />
      <span className="text-xs font-semibold text-ink-2">aulas/sem.</span>
    </span>
  );
}

function SaveStatus({ pending }: { pending: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-ink-2" aria-live="polite">
      {pending ? (
        <>
          <Spinner className="size-4" /> Salvando…
        </>
      ) : (
        <>
          <CheckCircle2 className="size-4 text-success" /> As alterações são salvas automaticamente.
        </>
      )}
    </span>
  );
}
