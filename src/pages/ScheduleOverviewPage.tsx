import { Fragment, useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router';
import { CalendarClock, Coffee, FilterX, Plus, Printer, X } from 'lucide-react';
import { Page } from '@/components/layout/Page';
import { DataGate } from '@/components/layout/DataGate';
import { Alert, Button, ButtonLink, Card, Combobox, EmptyState, Menu, Segmented } from '@/components/ui';
import { LessonChip } from '@/components/schedule/LessonChip';
import { EmptySlot } from '@/components/schedule/WeekGrid';
import { OutsideGrid } from '@/components/schedule/EntitySchedule';
import { useScheduleActions } from '@/components/schedule/ScheduleActions';
import { ImportButton } from '@/features/import/ImportDialog';
import { useScheduleData, type ScheduleData } from '@/api/hooks';
import { useScheduleIndex, type ScheduleIndex } from '@/hooks/useScheduleIndex';
import { useHotkey } from '@/hooks/useHotkey';
import { cn } from '@/lib/cn';
import { plural } from '@/lib/text';
import { SUBJECT_STYLE } from '@/lib/subjectColors';
import { lessonsInPeriod, lessonsOutsideGrid, periodsForShifts } from '@shared/grid';
import { SHIFT_LABEL, WEEKDAY_LABEL, WEEKDAY_SHORT, shiftsOfClass } from '@shared/labels';
import type { Lesson, Period, SchoolClass, ShiftKey, Weekday } from '@shared/types';
import { GUIDES } from '@/lib/guides';

export function ScheduleOverviewPage() {
  const schedule = useScheduleData();
  const index = useScheduleIndex(schedule.data);
  const actions = useScheduleActions();
  const newLesson = useCallback(() => actions.createLesson(), [actions]);
  useHotkey('n', newLesson, actions.ready);

  return (
    <Page
      title="Quadro de horários"
      guide={GUIDES.schedule}
      width="wide"
      breadcrumbs={[{ label: 'Início', to: '/' }, { label: 'Quadro de horários' }]}
      description="Visão consolidada da escola por dia e turno. Clique em um horário vazio para alocar uma aula ou em uma aula para ver detalhes."
      actions={
        <>
          <PrintMenu />
          <ImportButton kind="lessons" label="Importar aulas" />
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={newLesson} disabled={!actions.ready} title="Atalho: N">
            Nova aula
          </Button>
        </>
      }
    >
      <DataGate data={schedule.data} isLoading={schedule.isLoading} error={schedule.error} onRetry={schedule.refetch}>
        {(data) => <Overview data={data} index={index} />}
      </DataGate>
    </Page>
  );
}

function PrintMenu() {
  return (
    <Menu
      label="Imprimir"
      trigger={<><Printer className="size-4" />Imprimir</>}
      items={[
        { label: 'Imprimir todas as turmas', icon: <Printer />, onSelect: () => window.open('/imprimir/turma/todas', '_blank') },
        { label: 'Imprimir todos os professores', icon: <Printer />, onSelect: () => window.open('/imprimir/professor/todos', '_blank') },
      ]}
    />
  );
}

function todayOr(days: Weekday[]): Weekday {
  const d = new Date().getDay();
  return (days.includes(d as Weekday) ? d : days[0] ?? 1) as Weekday;
}

function Overview({ data, index }: { data: ScheduleData; index: ScheduleIndex }) {
  const actions = useScheduleActions();
  const [params, setParams] = useSearchParams();
  const days = data.settings.enabledDays;
  const shifts = data.settings.enabledShifts;

  const day = (() => {
    const v = Number(params.get('dia'));
    return (days.includes(v as Weekday) ? v : todayOr(days)) as Weekday;
  })();
  const shift = (() => {
    const v = params.get('turno') as ShiftKey | null;
    if (v && shifts.includes(v)) return v;
    const h = new Date().getHours();
    const guess: ShiftKey = h >= 18 ? 'noite' : h >= 12 ? 'tarde' : 'manha';
    return shifts.includes(guess) ? guess : shifts[0];
  })();
  const teacherId = Number(params.get('professor')) || null;
  const classId = Number(params.get('turma')) || null;
  const subjectId = Number(params.get('disciplina')) || null;

  const set = (key: string, value: string | number | null) =>
    setParams(
      (p) => {
        if (value === null || value === '') p.delete(key);
        else p.set(key, String(value));
        return p;
      },
      { replace: true },
    );
  const clearFilters = () =>
    setParams(
      (p) => {
        p.delete('professor');
        p.delete('turma');
        p.delete('disciplina');
        return p;
      },
      { replace: true },
    );

  const lessonFilter = (l: Lesson) =>
    (!teacherId || l.teacherId === teacherId) && (!classId || l.classId === classId) && (!subjectId || l.subjectId === subjectId);
  const narrowing = Boolean(teacherId || subjectId);
  const hasFilters = Boolean(teacherId || classId || subjectId);

  const periods = periodsForShifts(data.periods, [shift]);
  const lessonPeriods = periods.filter((p) => p.kind === 'aula');

  const dayLessons = useMemo(() => data.lessons.filter((l) => l.weekday === day && lessonFilter(l)), [data.lessons, day, teacherId, classId, subjectId]);

  const rows: SchoolClass[] = data.classes
    .filter((c) => shiftsOfClass(c.shift).includes(shift))
    .filter((c) => c.active || data.lessons.some((l) => l.classId === c.id && l.weekday === day))
    .filter((c) => !classId || c.id === classId)
    .filter((c) => !narrowing || dayLessons.some((l) => l.classId === c.id))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true }));

  const countByDay = new Map<Weekday, number>(days.map((d) => [d, data.lessons.filter((l) => l.weekday === d && lessonFilter(l)).length]));
  const countByShift = new Map<ShiftKey, number>(
    shifts.map((s) => [
      s,
      data.lessons.filter((l) => l.weekday === day && lessonFilter(l) && periodsForShifts(data.periods, [s]).some((p) => p.kind === 'aula' && lessonsInPeriod([l], day, p).length)).length,
    ]),
  );

  let emptyCount = 0;
  if (!narrowing) {
    for (const c of rows.filter((r) => r.active)) for (const p of lessonPeriods) if (!lessonsInPeriod(dayLessons.filter((l) => l.classId === c.id), day, p).length) emptyCount++;
  }

  const visibleCount = dayLessons.filter((l) => rows.some((r) => r.id === l.classId)).length;
  const outside = lessonsOutsideGrid(data.lessons.filter(lessonFilter), data.periods, days);
  const conflictLessons = data.lessons.filter((l) => index.conflictLessonIds.has(l.id));

  const teacherOptions = data.teachers.map((t) => ({ value: t.id, label: t.name, description: t.active ? t.area ?? undefined : 'Inativo' }));
  const classOptions = data.classes.map((c) => ({ value: c.id, label: c.name, description: `${c.grade} · ${SHIFT_LABEL[c.shift]}` }));
  const subjectOptions = data.subjects.map((s) => ({
    value: s.id,
    label: s.name,
    leading: <span className={cn('size-2.5 rounded-full', SUBJECT_STYLE[s.color].dot)} />,
  }));

  if (data.classes.length === 0 || data.teachers.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<CalendarClock />}
          title="Cadastre professores e turmas para montar o quadro"
          description="O quadro de horários é formado pelas aulas que ligam um professor a uma turma em um dia e horário."
          action={
            <>
              {data.teachers.length === 0 && (
                <ButtonLink variant="primary" to="/professores">
                  Cadastrar professores
                </ButtonLink>
              )}
              {data.classes.length === 0 && <ButtonLink to="/turmas">Cadastrar turmas</ButtonLink>}
            </>
          }
        />
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {conflictLessons.length > 0 && (
        <Alert
          tone="danger"
          title={`${conflictLessons.length} aula(s) em conflito na programação`}
          action={
            <Button size="sm" onClick={() => actions.openLesson(conflictLessons[0])}>
              Revisar
            </Button>
          }
        >
          Aulas marcadas em vermelho se sobrepõem a outra aula do mesmo professor ou da mesma turma.
        </Alert>
      )}

      {/* Barra de navegação e filtros */}
      <Card className="flex flex-col gap-4 p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <Segmented
            label="Dia da semana"
            className="w-full xl:w-auto"
            fill
            value={day}
            onChange={(v) => set('dia', v)}
            options={days.map((d) => ({ value: d, label: <><span className="sm:hidden">{WEEKDAY_SHORT[d]}</span><span className="hidden sm:inline">{WEEKDAY_LABEL[d].replace('-feira', '')}</span></>, count: countByDay.get(d) }))}
          />
          {shifts.length > 1 && (
            <Segmented label="Turno" value={shift} onChange={(v) => set('turno', v)} options={shifts.map((s) => ({ value: s, label: SHIFT_LABEL[s], count: countByShift.get(s) }))} />
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto]">
          <FilterCombo label="Professor" options={teacherOptions} value={teacherId} onChange={(v) => set('professor', v)} placeholder="Todos os professores" />
          <FilterCombo label="Turma" options={classOptions} value={classId} onChange={(v) => set('turma', v)} placeholder="Todas as turmas" />
          <FilterCombo
            label="Disciplina"
            options={subjectOptions}
            value={subjectId}
            onChange={(v) => set('disciplina', v)}
            placeholder={data.subjects.length ? 'Todas as disciplinas' : 'Nenhuma disciplina cadastrada'}
            disabled={data.subjects.length === 0}
          />
          <div className="flex items-end">
            <Button variant="ghost" icon={<FilterX className="size-4" />} onClick={clearFilters} disabled={!hasFilters} className="w-full lg:w-auto">
              Limpar filtros
            </Button>
          </div>
        </div>
        {hasFilters && (
          <div className="flex flex-wrap items-center gap-2 text-[13px]" aria-label="Filtros aplicados">
            <span className="text-muted">Filtrando por:</span>
            {teacherId && <FilterChip label={`Professor: ${index.teacherById.get(teacherId)?.name ?? '—'}`} onRemove={() => set('professor', null)} />}
            {classId && <FilterChip label={`Turma: ${index.classById.get(classId)?.name ?? '—'}`} onRemove={() => set('turma', null)} />}
            {subjectId && <FilterChip label={`Disciplina: ${index.subjectById.get(subjectId)?.name ?? '—'}`} onRemove={() => set('disciplina', null)} />}
          </div>
        )}
      </Card>

      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-bold">
          {WEEKDAY_LABEL[day]} · {SHIFT_LABEL[shift]}
        </h2>
        <p className="text-[13px] text-muted">
          <strong className="tabular font-semibold text-ink">{visibleCount}</strong> {visibleCount === 1 ? 'aula' : 'aulas'}
          {!narrowing && (
            <>
              {' · '}
              <strong className="tabular font-semibold text-ink">{emptyCount}</strong> {emptyCount === 1 ? 'horário vago' : 'horários vagos'}
            </>
          )}
          {' · '}
          {plural(rows.length, 'turma', 'turmas')}
        </p>
      </div>

      {lessonPeriods.length === 0 ? (
        <Card>
          <EmptyState
            icon={<CalendarClock />}
            title={`O turno ${SHIFT_LABEL[shift].toLowerCase()} não tem períodos de aula`}
            description="Configure os horários do turno para organizar as aulas."
            action={<ButtonLink to="/configuracoes">Configurar períodos</ButtonLink>}
          />
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState
            compact
            title={hasFilters ? 'Nenhuma aula corresponde aos filtros' : `Nenhuma turma no turno ${SHIFT_LABEL[shift].toLowerCase()}`}
            description={hasFilters ? 'Troque o dia, o turno ou limpe os filtros.' : 'Turmas deste turno aparecerão aqui assim que forem cadastradas.'}
            action={
              hasFilters ? (
                <Button icon={<FilterX className="size-4" />} onClick={clearFilters}>
                  Limpar filtros
                </Button>
              ) : (
                <ButtonLink to="/turmas">Cadastrar turma</ButtonLink>
              )
            }
          />
        </Card>
      ) : (
        <>
          <MatrixDesktop rows={rows} periods={periods} day={day} lessons={dayLessons} index={index} narrowing={narrowing} />
          <MatrixMobile rows={rows} periods={lessonPeriods} day={day} lessons={dayLessons} index={index} narrowing={narrowing} />
        </>
      )}

      {outside.length > 0 && <OutsideGrid lessons={outside} index={index} perspective="overview" onOpen={actions.openLesson} />}
    </div>
  );
}

interface MatrixProps {
  rows: SchoolClass[];
  periods: Period[];
  day: Weekday;
  lessons: Lesson[];
  index: ScheduleIndex;
  narrowing: boolean;
}

function MatrixDesktop({ rows, periods, day, lessons, index, narrowing }: MatrixProps) {
  const actions = useScheduleActions();
  return (
    <div className="hidden overflow-x-auto rounded-xl bg-surface shadow-raise scrollbar-thin md:block">
      <table className="w-full border-separate border-spacing-0">
        <caption className="sr-only">
          Quadro de horários de {WEEKDAY_LABEL[day]}: turmas nas linhas e períodos nas colunas
        </caption>
        <thead>
          <tr>
            <th scope="col" className="sticky top-0 left-0 z-20 min-w-[132px] border-b border-line bg-surface px-4 py-3 text-left text-xs font-semibold text-muted">
              Turma
            </th>
            {periods.map((p) =>
              p.kind === 'intervalo' ? (
                <th key={p.id} scope="col" className="w-9 border-b border-l border-line bg-subtle px-1 py-3" title={`${p.label} ${p.start}–${p.end}`}>
                  <Coffee className="mx-auto size-3.5 text-muted" aria-hidden="true" />
                  <span className="sr-only">{p.label}</span>
                </th>
              ) : (
                <th key={p.id} scope="col" className="min-w-[148px] border-b border-l border-line px-3 py-2.5 text-left">
                  <span className="block text-[13px] font-bold">{p.label}</span>
                  <span className="tabular block text-xs font-medium text-muted">
                    {p.start}–{p.end}
                  </span>
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => {
            const classLessons = lessons.filter((l) => l.classId === c.id);
            return (
              <tr key={c.id}>
                <th scope="row" className="sticky left-0 z-10 border-b border-line bg-surface px-4 py-2 text-left align-middle">
                  <Link to={`/horarios/turma/${c.id}`} className="text-sm font-bold hover:underline underline-offset-2">
                    {c.name}
                  </Link>
                  <span className="block max-w-[150px] truncate text-[11px] text-muted">{c.grade}</span>
                </th>
                {periods.map((p) =>
                  p.kind === 'intervalo' ? (
                    <td key={p.id} className="border-b border-l border-line bg-[repeating-linear-gradient(135deg,transparent_0_6px,rgb(29_32_37/0.04)_6px_12px)]" />
                  ) : (
                    <td key={p.id} className="h-[68px] border-b border-l border-line p-1.5 align-top">
                      <Cell
                        lessons={lessonsInPeriod(classLessons, day, p)}
                        index={index}
                        period={p}
                        canCreate={c.active && !narrowing}
                        onCreate={() => actions.createLesson({ classId: c.id, weekday: day, start: p.start, end: p.end })}
                        label={`turma ${c.name}, ${p.label}`}
                      />
                    </td>
                  ),
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function MatrixMobile({ rows, periods, day, lessons, index, narrowing }: MatrixProps) {
  const actions = useScheduleActions();
  return (
    <div className="flex flex-col gap-3 md:hidden">
      {rows.map((c) => {
        const classLessons = lessons.filter((l) => l.classId === c.id);
        return (
          <Card key={c.id} className="overflow-hidden">
            <div className="flex items-baseline justify-between border-b border-line px-4 py-2.5">
              <Link to={`/horarios/turma/${c.id}`} className="font-bold">
                Turma {c.name}
              </Link>
              <span className="text-xs text-muted">{c.grade}</span>
            </div>
            <ul>
              {periods.map((p) => {
                const ls = lessonsInPeriod(classLessons, day, p);
                if (narrowing && ls.length === 0) return null;
                return (
                  <li key={p.id} className="flex gap-3 border-b border-line px-4 py-2 last:border-b-0">
                    <span className="w-16 shrink-0 pt-1.5">
                      <span className="block text-xs font-bold">{p.label}</span>
                      <span className="tabular block text-[11px] text-muted">{p.start}</span>
                    </span>
                    <div className="min-w-0 flex-1">
                      <Cell
                        lessons={ls}
                        index={index}
                        period={p}
                        canCreate={c.active && !narrowing}
                        alwaysVisible
                        onCreate={() => actions.createLesson({ classId: c.id, weekday: day, start: p.start, end: p.end })}
                        label={`turma ${c.name}, ${p.label}`}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        );
      })}
    </div>
  );
}

function Cell({
  lessons,
  index,
  period,
  canCreate,
  onCreate,
  label,
  alwaysVisible,
}: {
  lessons: Lesson[];
  index: ScheduleIndex;
  period: Period;
  canCreate: boolean;
  onCreate: () => void;
  label: string;
  alwaysVisible?: boolean;
}) {
  const actions = useScheduleActions();
  if (lessons.length === 0) {
    return canCreate ? <EmptySlot label={`Adicionar aula: ${label}`} onClick={onCreate} alwaysVisible={alwaysVisible} /> : null;
  }
  return (
    <div className="flex flex-col gap-1">
      {lessons.map((l) => (
        <Fragment key={l.id}>
          <LessonChip lesson={l} index={index} perspective="class" period={period} onClick={actions.openLesson} compact />
        </Fragment>
      ))}
    </div>
  );
}

function FilterCombo({
  label,
  ...props
}: {
  label: string;
  options: { value: number; label: string; description?: string; leading?: React.ReactNode }[];
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder: string;
  disabled?: boolean;
}) {
  const id = `filtro-${label.toLowerCase()}`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-semibold text-muted">
        {label}
      </label>
      <Combobox id={id} clearable {...props} />
    </div>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex h-7 items-center gap-1 rounded-pill bg-brand-soft pr-1 pl-3 font-semibold text-brand-ink">
      {label}
      <button type="button" onClick={onRemove} aria-label={`Remover filtro ${label}`} className="grid size-5 place-items-center rounded-full hover:bg-brand/40">
        <X className="size-3" />
      </button>
    </span>
  );
}

