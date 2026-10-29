import { useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { NEW_PARAM } from '@/hooks/useOpenFromUrl';
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarOff,
  CheckCircle2,
  CalendarPlus,
  CircleDashed,
  ClipboardList,
  Clock,
  FileUp,
  GraduationCap,
  Plus,
  Table2,
  UserX,
  Users,
} from 'lucide-react';
import { Page } from '@/components/layout/Page';
import { DataGate } from '@/components/layout/DataGate';
import { Button, ButtonLink, Card, CardHeader } from '@/components/ui';
import { useScheduleActions } from '@/components/schedule/ScheduleActions';
import { useScheduleData, type ScheduleData } from '@/api/hooks';
import { useScheduleIndex, type ScheduleIndex } from '@/hooks/useScheduleIndex';
import { computeSlotStats, lessonsInPeriod, lessonsOutsideGrid, periodsForShifts } from '@shared/grid';
import { assignmentProgress } from '@shared/assignments';
import { SHIFT_LABEL, WEEKDAY_LABEL, WEEKDAY_SHORT, shiftsOfClass } from '@shared/labels';
import { findScheduleConflicts } from '@shared/conflicts';
import { toMinutes } from '@shared/time';
import type { Weekday } from '@shared/types';
import { cn } from '@/lib/cn';
import { plural } from '@/lib/text';
import { todayLabel } from '@/lib/format';
import { useSession } from '@/api/auth';
import { ImportDialog } from '@/features/import/ImportDialog';
import type { SlotStats } from '@shared/grid';
import { GUIDES } from '@/lib/guides';

export function DashboardPage() {
  const schedule = useScheduleData();
  const index = useScheduleIndex(schedule.data);
  const navigate = useNavigate();
  // Atalhos de cadastro levam à página correspondente, que já abre o formulário.
  const onNew = (kind: NewKind) => navigate(`${NEW_TARGET[kind]}?${NEW_PARAM}=1`);

  return (
    <Page
      title="Dashboard"
      guide={GUIDES.dashboard}
      width="wide"
      description="Visão geral do Colégio SEICE: cadastros, preenchimento da grade e o que precisa de atenção."
      actions={
        <>
          <Button icon={<Plus className="size-4" />} onClick={() => onNew('teacher')}>
            Novo professor
          </Button>
          <Button icon={<Plus className="size-4" />} onClick={() => onNew('class')}>
            Nova turma
          </Button>
        </>
      }
    >
      <DataGate data={schedule.data} isLoading={schedule.isLoading} error={schedule.error} onRetry={schedule.refetch} loadingLabel="Calculando indicadores…">
        {(data) => <Dashboard data={data} index={index} onNew={onNew} />}
      </DataGate>
    </Page>
  );
}

type NewKind = 'teacher' | 'class' | 'subject';
const NEW_TARGET: Record<NewKind, string> = { teacher: '/professores', class: '/turmas', subject: '/disciplinas' };

function Dashboard({ data, index, onNew }: { data: ScheduleData; index: ScheduleIndex; onNew: (m: NewKind) => void }) {
  const activeTeachers = data.teachers.filter((t) => t.active);
  const activeClasses = data.classes.filter((c) => c.active);
  const slots = useMemo(() => computeSlotStats(data.classes, data.lessons, data.periods, data.settings), [data]);
  const conflicts = useMemo(() => findScheduleConflicts(data.lessons), [data.lessons]);
  const outside = useMemo(() => lessonsOutsideGrid(data.lessons, data.periods, data.settings.enabledDays), [data]);
  const setupDone = data.teachers.length > 0 && data.classes.length > 0 && data.lessons.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <Welcome data={data} slots={slots} conflicts={conflicts.length} />
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

function greeting(date: Date) {
  const h = date.getHours();
  return h < 5 ? 'Boa noite' : h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}

/** Situação da escola em uma frase, sem jargão: o que está bem e o que falta. */
function statusSentence(data: ScheduleData, slots: SlotStats, conflicts: number): { text: string; tone: 'ok' | 'warn' | 'alert' | 'start' } {
  if (!data.teachers.length || !data.classes.length) {
    return { text: 'Vamos começar: cadastre os professores e as turmas para montar o quadro de horários.', tone: 'start' };
  }
  if (conflicts) {
    return { text: `Atenção: ${plural(conflicts, 'conflito de horário precisa', 'conflitos de horário precisam')} de correção.`, tone: 'alert' };
  }
  if (slots.totalSlots && slots.emptySlots) {
    const pct = Math.round((slots.filledSlots / slots.totalSlots) * 100);
    return { text: `A grade está ${pct}% preenchida. Faltam ${plural(slots.emptySlots, 'horário', 'horários')} para completar, e não há conflitos.`, tone: 'warn' };
  }
  return { text: 'A grade está completa e sem conflitos. Tudo em ordem!', tone: 'ok' };
}

/** Abertura do Dashboard: saudação, situação da escola em linguagem simples e atalhos para as tarefas do dia. */
function Welcome({ data, slots, conflicts }: { data: ScheduleData; slots: SlotStats; conflicts: number }) {
  const { data: user } = useSession();
  const actions = useScheduleActions();
  const navigate = useNavigate();
  const [importing, setImporting] = useState(false);
  const now = new Date();
  const name = user?.name.trim().split(/\s+/)[0] ?? '';
  const status = statusSentence(data, slots, conflicts);
  const pct = slots.totalSlots ? Math.round((slots.filledSlots / slots.totalSlots) * 100) : 0;
  const today = now.getDay();
  const canLaunch = actions.ready && data.teachers.some((t) => t.active) && data.classes.some((c) => c.active);

  return (
    <section aria-labelledby="boas-vindas" className="relative overflow-hidden rounded-2xl bg-nav text-white shadow-[0_24px_48px_-28px_rgb(29_32_37/0.7)]">
      <div className="bg-grid absolute inset-0 [mask-image:radial-gradient(ellipse_at_20%_30%,black_10%,transparent_70%)]" aria-hidden="true" />
      <div className="absolute -top-28 -left-20 size-80 rounded-full bg-brand/20 blur-[90px]" aria-hidden="true" />
      <img src="/emblema-seice.webp" alt="" aria-hidden="true" className="pointer-events-none absolute -right-10 -bottom-14 size-64 opacity-[0.06] grayscale" />

      <div className="relative grid gap-7 p-6 sm:p-8 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
        <div className="min-w-0">
          <p className="text-xs font-bold tracking-[0.16em] text-brand uppercase">{todayLabel()}</p>
          <h2 id="boas-vindas" className="mt-2 font-display text-[2rem] leading-tight font-semibold tracking-[-0.02em] sm:text-[2.5rem]">
            {greeting(now)}
            {name && (
              <>
                , <span className="text-brand">{name}</span>
              </>
            )}
          </h2>
          <p className="mt-3 max-w-[58ch] text-[15px] leading-relaxed text-nav-text">{status.text}</p>
          {slots.totalSlots > 0 && (
            <div className="mt-5 max-w-md">
              <div className="flex items-baseline justify-between text-xs font-semibold text-nav-text">
                <span>Preenchimento da grade</span>
                <span className="tabular text-sm font-bold text-white">{pct}%</span>
              </div>
              <div
                className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/10"
                role="progressbar"
                aria-label="Preenchimento da grade"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className={cn('h-full rounded-full transition-[width] duration-700', status.tone === 'alert' ? 'bg-[#ff8f80]' : 'bg-brand')}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <ul className="grid gap-3 sm:grid-cols-3 xl:w-[540px]">
          <QuickAction icon={<CalendarPlus />} title="Lançar aula" text="Escolha turma, professor e horário" onClick={() => actions.createLesson()} disabled={!canLaunch} />
          <QuickAction
            icon={<Table2 />}
            title="Quadro de hoje"
            text="Veja as aulas do dia por turno"
            onClick={() => navigate(today >= 1 && today <= 6 ? `/horarios?dia=${today}` : '/horarios')}
          />
          <QuickAction icon={<FileUp />} title="Importar planilha" text="Aulas a partir de Excel ou CSV" onClick={() => setImporting(true)} />
        </ul>
      </div>
      <ImportDialog kind="lessons" open={importing} onClose={() => setImporting(false)} />
    </section>
  );
}

function QuickAction({ icon, title, text, onClick, disabled }: { icon: ReactNode; title: string; text: string; onClick: () => void; disabled?: boolean }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="group flex h-full w-full flex-col items-start gap-3 rounded-xl border border-white/10 bg-white/[0.05] p-4 text-left transition-[background-color,border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-brand/50 hover:bg-white/[0.09] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:pointer-events-none disabled:opacity-45"
      >
        <span className="grid size-10 place-items-center rounded-lg bg-brand text-ink transition-transform duration-200 group-hover:scale-105 [&>svg]:size-5">{icon}</span>
        <span>
          <span className="block text-[15px] font-bold text-white">{title}</span>
          <span className="mt-0.5 block text-[13px] leading-snug text-nav-text">{text}</span>
        </span>
      </button>
    </li>
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

function SetupGuide({ data, onNew }: { data: ScheduleData; onNew: (m: NewKind) => void }) {
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
      action: <Button size="sm" onClick={() => onNew('subject')}>Cadastrar disciplinas</Button>,
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
  // Atribuições: aulas combinadas que ainda não estão no quadro, por turma (a com mais faltas abre direto no Montar quadro).
  const missingByClass = new Map<number, number>();
  for (const p of assignmentProgress(data.assignments, data.lessons, data.periods, data.classes).values()) {
    if (p.missing > 0 && index.classById.get(p.assignment.classId)?.active) missingByClass.set(p.assignment.classId, (missingByClass.get(p.assignment.classId) ?? 0) + p.missing);
  }
  const missingTotal = [...missingByClass.values()].reduce((s, n) => s + n, 0);
  if (missingTotal) {
    const worst = [...missingByClass].sort((a, b) => b[1] - a[1]);
    items.push({
      tone: 'warning',
      icon: <ClipboardList />,
      title: `Faltam ${plural(missingTotal, 'aula atribuída', 'aulas atribuídas')} para colocar no quadro`,
      text: worst
        .slice(0, 4)
        .map(([id, n]) => `${index.classById.get(id)?.name} (${n})`)
        .join(', ') + (worst.length > 4 ? '…' : '') + ' · clique para montar',
      to: `/horarios/montar/turma/${worst[0][0]}`,
    });
  } else if (data.assignments.length === 0 && data.teachers.some((t) => t.active) && data.classes.some((c) => c.active)) {
    items.push({ tone: 'info', icon: <ClipboardList />, title: 'Nenhuma aula atribuída ainda', text: 'Diga quem dá cada disciplina em cada turma para o quadro sugerir tudo sozinho.', to: '/atribuicoes' });
  }
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
