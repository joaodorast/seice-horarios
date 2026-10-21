import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarOff,
  CheckCircle2,
  CircleDashed,
  Clock,
  GraduationCap,
  Plus,
  Table2,
  UserX,
  Users,
} from 'lucide-react';
import { Page } from '@/components/layout/Page';
import { DataGate } from '@/components/layout/DataGate';
import { Button, ButtonLink, Card, CardHeader } from '@/components/ui';
import { TeacherFormModal } from '@/features/TeacherForm';
import { ClassFormModal } from '@/features/ClassForm';
import { useScheduleActions } from '@/components/schedule/ScheduleActions';
import { useScheduleData, type ScheduleData } from '@/api/hooks';
import { useScheduleIndex, type ScheduleIndex } from '@/hooks/useScheduleIndex';
import { computeSlotStats, lessonsInPeriod, lessonsOutsideGrid, periodsForShifts } from '@shared/grid';
import { SHIFT_LABEL, WEEKDAY_LABEL, WEEKDAY_SHORT, shiftsOfClass } from '@shared/labels';
import { findScheduleConflicts } from '@shared/conflicts';
import { toMinutes } from '@shared/time';
import type { Weekday } from '@shared/types';
import { cn } from '@/lib/cn';
import { plural } from '@/lib/text';
import { todayLabel } from '@/lib/format';

export function DashboardPage() {
  const schedule = useScheduleData();
  const index = useScheduleIndex(schedule.data);
  const [modal, setModal] = useState<'teacher' | 'class' | null>(null);

  return (
    <Page
      title="Dashboard"
      width="wide"
      description={todayLabel()}
      actions={
        <>
          <Button icon={<Plus className="size-4" />} onClick={() => setModal('teacher')}>
            Novo professor
          </Button>
          <Button icon={<Plus className="size-4" />} onClick={() => setModal('class')}>
            Nova turma
          </Button>
          <ButtonLink to="/horarios" variant="primary" icon={<Table2 className="size-4" />}>
            Organizar horários
          </ButtonLink>
        </>
      }
    >
      <DataGate data={schedule.data} isLoading={schedule.isLoading} error={schedule.error} onRetry={schedule.refetch} loadingLabel="Calculando indicadores…">
        {(data) => <Dashboard data={data} index={index} onNew={setModal} />}
      </DataGate>
      <TeacherFormModal open={modal === 'teacher'} onClose={() => setModal(null)} />
      <ClassFormModal open={modal === 'class'} onClose={() => setModal(null)} />
    </Page>
  );
}

function Dashboard({ data, index, onNew }: { data: ScheduleData; index: ScheduleIndex; onNew: (m: 'teacher' | 'class') => void }) {
  const activeTeachers = data.teachers.filter((t) => t.active);
  const activeClasses = data.classes.filter((c) => c.active);
  const slots = useMemo(() => computeSlotStats(data.classes, data.lessons, data.periods, data.settings), [data]);
  const conflicts = useMemo(() => findScheduleConflicts(data.lessons), [data.lessons]);
  const outside = useMemo(() => lessonsOutsideGrid(data.lessons, data.periods, data.settings.enabledDays), [data]);
  const setupDone = data.teachers.length > 0 && data.classes.length > 0 && data.lessons.length > 0;

  return (
    <div className="flex flex-col gap-6">
      {!setupDone && <SetupGuide data={data} onNew={onNew} />}

      <Card className="grid grid-cols-2 divide-line overflow-hidden sm:grid-cols-3 lg:grid-cols-5 lg:divide-x">
        <Metric to="/professores" label="Professores ativos" value={activeTeachers.length} note={data.teachers.length - activeTeachers.length ? `${data.teachers.length - activeTeachers.length} inativo(s)` : undefined} />
        <Metric to="/turmas" label="Turmas ativas" value={activeClasses.length} note={data.classes.length - activeClasses.length ? `${data.classes.length - activeClasses.length} inativa(s)` : undefined} />
        <Metric to="/horarios" label="Aulas alocadas" value={data.lessons.length} note="por semana" />
        <Metric
          to="/turmas"
          label="Horários vagos"
          value={slots.totalSlots ? slots.emptySlots : '—'}
          note={slots.totalSlots ? `${Math.round((slots.filledSlots / slots.totalSlots) * 100)}% da grade preenchida` : 'Sem turmas ativas'}
          tone={slots.emptySlots > 0 ? 'warning' : undefined}
        />
        <Metric
          to="/horarios"
          label="Conflitos"
          value={conflicts.length}
          note={conflicts.length ? 'Exigem correção' : 'Nenhuma sobreposição'}
          tone={conflicts.length ? 'danger' : 'success'}
        />
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <WeeklyDistribution data={data} />
        <Pendencies data={data} index={index} conflictsCount={conflicts.length} outsideCount={outside.length} slots={slots} />
      </div>

      <Today data={data} index={index} />
    </div>
  );
}

function Metric({
  to,
  label,
  value,
  note,
  tone,
}: {
  to: string;
  label: string;
  value: ReactNode;
  note?: string;
  tone?: 'warning' | 'danger' | 'success';
}) {
  return (
    <Link
      to={to}
      className="group relative flex flex-col gap-1 border-b border-line px-5 py-4 transition-colors hover:bg-subtle focus-visible:z-10 lg:border-b-0"
    >
      <span className="flex items-center justify-between text-[13px] font-semibold text-muted">
        {label}
        <ArrowUpRight className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
      </span>
      <span className="tabular text-[2rem] leading-none font-extrabold tracking-[-0.03em] text-ink">{value}</span>
      {note && (
        <span
          className={cn(
            'flex items-center gap-1.5 text-xs font-medium',
            tone === 'danger' ? 'text-danger' : tone === 'warning' ? 'text-warning' : tone === 'success' ? 'text-success' : 'text-muted',
          )}
        >
          {tone && <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />}
          {note}
        </span>
      )}
    </Link>
  );
}

function SetupGuide({ data, onNew }: { data: ScheduleData; onNew: (m: 'teacher' | 'class') => void }) {
  const actions = useScheduleActions();
  const steps = [
    {
      done: data.periods.some((p) => p.kind === 'aula'),
      title: 'Revise os horários dos turnos',
      text: 'Confira os dias letivos e o início e término de cada período de aula.',
      action: <ButtonLink size="sm" to="/configuracoes?aba=periodos">Abrir configurações</ButtonLink>,
    },
    {
      done: data.teachers.length > 0,
      title: 'Cadastre os professores',
      text: 'Basta o nome completo; matrícula, área e telefone são opcionais.',
      action: <Button size="sm" onClick={() => onNew('teacher')}>Novo professor</Button>,
    },
    {
      done: data.classes.length > 0,
      title: 'Cadastre as turmas',
      text: 'Informe o turno de cada turma para que a grade use os períodos certos.',
      action: <Button size="sm" onClick={() => onNew('class')}>Nova turma</Button>,
    },
    {
      done: data.subjects.length > 0,
      optional: true,
      title: 'Cadastre as disciplinas',
      text: 'Opcional — dá cor às aulas e permite filtrar o quadro por disciplina.',
      action: <ButtonLink size="sm" to="/disciplinas">Cadastrar disciplinas</ButtonLink>,
    },
    {
      done: data.lessons.length > 0,
      title: 'Monte o quadro de horários',
      text: 'Clique em um horário vazio da grade para alocar professor e turma.',
      action: (
        <Button size="sm" variant="primary" disabled={!data.teachers.length || !data.classes.length} onClick={() => actions.createLesson()}>
          Adicionar aula
        </Button>
      ),
    },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Primeiros passos"
        description={`${doneCount} de ${steps.length} etapas concluídas. Siga a ordem abaixo para colocar o quadro de horários em uso.`}
      />
      <ol className="grid border-t border-line md:grid-cols-5 md:divide-x md:divide-line">
        {steps.map((s, i) => (
          <li key={s.title} className={cn('flex flex-col gap-2 border-b border-line p-5 md:border-b-0', s.done && 'bg-subtle/70')}>
            <span className="flex items-center gap-2 text-xs font-bold text-muted">
              {s.done ? <CheckCircle2 className="size-4 text-success" /> : <CircleDashed className="size-4" />}
              Etapa {i + 1}
              {s.optional && ' · opcional'}
            </span>
            <p className={cn('text-sm font-bold', s.done && 'text-muted line-through decoration-1')}>{s.title}</p>
            <p className="text-[13px] text-muted">{s.text}</p>
            {!s.done && <div className="mt-auto pt-2">{s.action}</div>}
          </li>
        ))}
      </ol>
    </Card>
  );
}

function WeeklyDistribution({ data }: { data: ScheduleData }) {
  const days = data.settings.enabledDays;
  const rows = days.map((d) => {
    const lessons = data.lessons.filter((l) => l.weekday === d).length;
    const stats = computeSlotStats(data.classes, data.lessons.filter((l) => l.weekday === d), data.periods, { ...data.settings, enabledDays: [d] });
    return { day: d, lessons, filled: stats.filledSlots, total: stats.totalSlots };
  });
  const max = Math.max(1, ...rows.map((r) => r.total));
  const today = new Date().getDay();

  return (
    <Card>
      <CardHeader
        title="Distribuição semanal"
        description="Horários preenchidos em relação à capacidade da grade das turmas ativas."
        actions={<ButtonLink to="/horarios" size="sm" variant="ghost">Ver quadro</ButtonLink>}
      />
      {rows.every((r) => r.total === 0) ? (
        <p className="px-5 pb-6 text-sm text-muted">A distribuição aparece quando houver turmas ativas com períodos configurados.</p>
      ) : (
        <ul className="flex flex-col gap-3.5 px-5 pb-5">
          {rows.map((r) => {
            const pct = r.total ? Math.round((r.filled / r.total) * 100) : 0;
            return (
              <li key={r.day} className="grid grid-cols-[52px_1fr_auto] items-center gap-3">
                <Link
                  to={`/horarios?dia=${r.day}`}
                  className={cn('text-[13px] font-bold hover:underline underline-offset-2', r.day === today ? 'text-ink' : 'text-ink-2')}
                >
                  {WEEKDAY_SHORT[r.day as Weekday]}
                  {r.day === today && <span className="ml-1 inline-block size-1.5 rounded-full bg-brand align-middle" title="Hoje" />}
                </Link>
                <div
                  className="relative h-7 overflow-hidden rounded-md bg-ink/[0.05]"
                  style={{ width: `${Math.max(12, (r.total / max) * 100)}%` }}
                  role="img"
                  aria-label={`${WEEKDAY_LABEL[r.day as Weekday]}: ${r.filled} de ${r.total} horários preenchidos`}
                >
                  <div className={cn('h-full rounded-md transition-[width] duration-500', pct === 100 ? 'bg-success' : 'bg-brand')} style={{ width: `${pct}%` }} />
                </div>
                <span className="tabular w-24 text-right text-xs text-muted">
                  <strong className="font-semibold text-ink">{r.filled}</strong>/{r.total} · {pct}%
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex flex-wrap gap-4 border-t border-line px-5 py-3 text-xs text-muted">
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-brand" />Preenchido</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-success" />Dia completo</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-ink/10" />Vago</span>
      </div>
    </Card>
  );
}

function Pendencies({
  data,
  index,
  conflictsCount,
  outsideCount,
  slots,
}: {
  data: ScheduleData;
  index: ScheduleIndex;
  conflictsCount: number;
  outsideCount: number;
  slots: ReturnType<typeof computeSlotStats>;
}) {
  const inactiveTeacherLessons = data.lessons.filter((l) => index.teacherById.get(l.teacherId)?.active === false);
  const inactiveClassLessons = data.lessons.filter((l) => index.classById.get(l.classId)?.active === false);
  const classesWithoutLessons = data.classes.filter((c) => c.active && !data.lessons.some((l) => l.classId === c.id));
  const teachersWithoutLessons = data.teachers.filter((t) => t.active && !data.lessons.some((l) => l.teacherId === t.id));
  const classesWithoutPeriods = data.classes.filter(
    (c) => c.active && periodsForShifts(data.periods, shiftsOfClass(c.shift)).filter((p) => p.kind === 'aula').length === 0,
  );
  const mostEmpty = slots.emptyByClass
    .filter((e) => e.empty > 0 && data.lessons.some((l) => l.classId === e.classId))
    .sort((a, b) => b.empty - a.empty)
    .slice(0, 3);

  const items: { tone: 'danger' | 'warning' | 'info'; icon: ReactNode; title: string; text: string; to: string }[] = [];
  if (conflictsCount)
    items.push({ tone: 'danger', icon: <AlertTriangle />, title: plural(conflictsCount, 'conflito de horário', 'conflitos de horário'), text: 'Aulas sobrepostas para o mesmo professor ou turma.', to: '/horarios' });
  if (inactiveTeacherLessons.length)
    items.push({ tone: 'warning', icon: <UserX />, title: `${plural(inactiveTeacherLessons.length, 'aula', 'aulas')} com professor inativo`, text: 'Reatribua essas aulas ou reative o cadastro.', to: `/horarios/professor/${inactiveTeacherLessons[0].teacherId}` });
  if (inactiveClassLessons.length)
    items.push({ tone: 'warning', icon: <UserX />, title: `${plural(inactiveClassLessons.length, 'aula', 'aulas')} em turma inativa`, text: 'Remova as aulas ou reative a turma.', to: `/horarios/turma/${inactiveClassLessons[0].classId}` });
  if (outsideCount)
    items.push({ tone: 'warning', icon: <CalendarOff />, title: `${plural(outsideCount, 'aula', 'aulas')} fora da grade`, text: 'Em dias desabilitados ou fora dos períodos configurados.', to: '/horarios' });
  if (classesWithoutPeriods.length)
    items.push({ tone: 'warning', icon: <Clock />, title: `${plural(classesWithoutPeriods.length, 'turma sem', 'turmas sem')} períodos no turno`, text: 'Configure os horários do turno correspondente.', to: '/configuracoes?aba=periodos' });
  if (classesWithoutLessons.length)
    items.push({
      tone: 'info',
      icon: <GraduationCap />,
      title: `${plural(classesWithoutLessons.length, 'turma ainda sem', 'turmas ainda sem')} aulas`,
      text: classesWithoutLessons.slice(0, 4).map((c) => c.name).join(', ') + (classesWithoutLessons.length > 4 ? '…' : ''),
      to: `/horarios/turma/${classesWithoutLessons[0].id}`,
    });
  if (teachersWithoutLessons.length)
    items.push({
      tone: 'info',
      icon: <Users />,
      title: `${plural(teachersWithoutLessons.length, 'professor ativo sem', 'professores ativos sem')} aulas`,
      text: teachersWithoutLessons.slice(0, 3).map((t) => t.name.split(' ')[0]).join(', ') + (teachersWithoutLessons.length > 3 ? '…' : ''),
      to: `/horarios/professor/${teachersWithoutLessons[0].id}`,
    });
  for (const e of mostEmpty) {
    const c = index.classById.get(e.classId);
    if (c) items.push({ tone: 'info', icon: <CircleDashed />, title: `Turma ${c.name}: ${plural(e.empty, 'horário vago', 'horários vagos')}`, text: `${e.total - e.empty} de ${e.total} preenchidos.`, to: `/horarios/turma/${c.id}` });
  }

  const toneClass = { danger: 'bg-danger-soft text-danger', warning: 'bg-warning-soft text-warning', info: 'bg-info-soft text-info' };

  return (
    <Card>
      <CardHeader title="Pendências" description={items.length ? 'Itens que precisam de atenção, do mais urgente ao informativo.' : undefined} />
      {items.length === 0 ? (
        <div className="flex items-center gap-3 px-5 pb-6">
          <CheckCircle2 className="size-5 text-success" />
          <p className="text-sm text-ink-2">Tudo em ordem. Não há conflitos nem aulas que precisem de revisão.</p>
        </div>
      ) : (
        <ul className="divide-y divide-line border-t border-line">
          {items.slice(0, 8).map((item) => (
            <li key={item.title}>
              <Link to={item.to} className="group flex items-start gap-3 px-5 py-3 transition-colors hover:bg-subtle">
                <span className={cn('mt-0.5 grid size-7 shrink-0 place-items-center rounded-md [&>svg]:size-4', toneClass[item.tone])} aria-hidden="true">
                  {item.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-ink">{item.title}</span>
                  <span className="block truncate text-[13px] text-muted">{item.text}</span>
                </span>
                <ArrowUpRight className="mt-1 size-4 shrink-0 text-soft group-hover:text-ink" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Today({ data, index }: { data: ScheduleData; index: ScheduleIndex }) {
  const actions = useScheduleActions();
  const now = new Date();
  const day = now.getDay() as Weekday;
  const minutes = now.getHours() * 60 + now.getMinutes();
  if (!data.settings.enabledDays.includes(day) || data.lessons.length === 0) return null;

  const periods = periodsForShifts(data.periods, data.settings.enabledShifts).filter((p) => p.kind === 'aula');
  const current = periods.find((p) => toMinutes(p.start) <= minutes && minutes < toMinutes(p.end));
  const next = periods.find((p) => toMinutes(p.start) > minutes);
  const focus = current ?? next;
  if (!focus) return null;

  const lessons = lessonsInPeriod(data.lessons, day, focus);

  return (
    <Card>
      <CardHeader
        title={current ? `Agora: ${focus.label} do turno ${SHIFT_LABEL[focus.shift].toLowerCase()}` : `Próximo: ${focus.label} do turno ${SHIFT_LABEL[focus.shift].toLowerCase()}`}
        description={`${WEEKDAY_LABEL[day]}, ${focus.start}–${focus.end} · ${plural(lessons.length, 'aula', 'aulas')}`}
        actions={<ButtonLink size="sm" variant="ghost" to={`/horarios?dia=${day}&turno=${focus.shift}`}>Ver o dia</ButtonLink>}
      />
      {lessons.length === 0 ? (
        <p className="px-5 pb-5 text-sm text-muted">Nenhuma aula alocada neste período.</p>
      ) : (
        <ul className="grid gap-2 px-5 pb-5 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-6">
          {lessons.map((l) => {
            const c = index.classById.get(l.classId);
            const t = index.teacherById.get(l.teacherId);
            const s = l.subjectId ? index.subjectById.get(l.subjectId) : undefined;
            return (
              <li key={l.id}>
                <button
                  type="button"
                  onClick={() => actions.openLesson(l)}
                  className="flex w-full items-center gap-3 rounded-lg border border-line px-3 py-2.5 text-left transition-colors hover:border-line-strong hover:bg-subtle"
                >
                  <span className="grid h-9 min-w-11 place-items-center rounded-md bg-nav px-2 text-xs font-bold text-brand">{c?.name}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{s?.name ?? 'Aula'}</span>
                    <span className="block truncate text-xs text-muted">{t?.name}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
