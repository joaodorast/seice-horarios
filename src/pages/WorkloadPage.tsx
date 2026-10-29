import { Fragment, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ChevronDown, ChevronRight, Download, Info, PencilRuler } from 'lucide-react';
import { Page } from '@/components/layout/Page';
import { DataGate } from '@/components/layout/DataGate';
import { Button, Card, Segmented, useToast } from '@/components/ui';
import { useScheduleData, type ScheduleData } from '@/api/hooks';
import { computeWorkload, type Load } from '@shared/workload';
import { SHIFT_LABEL, shiftsOfClass } from '@shared/labels';
import { overlaps } from '@shared/time';
import { CLASS_SHIFTS, type ClassShift, type Lesson, type ShiftKey } from '@shared/types';
import { SUBJECT_STYLE } from '@/lib/subjectColors';
import { formatHours } from '@/lib/format';
import { downloadTable } from '@/lib/spreadsheet';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { errorMessage } from '@/api/client';
import { cn } from '@/lib/cn';
import { GUIDES } from '@/lib/guides';

type ShiftFilter = ClassShift | 'todos';

/** Semanas consideradas em um mês (4,5 é o padrão usado na carga horária mensal de professores). */
const WEEKS_OPTIONS = [4, 4.5, 5] as const;
type Weeks = (typeof WEEKS_OPTIONS)[number];

const num = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
const aulas = (n: number) => `${num(n)} ${n === 1 ? 'aula' : 'aulas'}`;

/** Carga horária: aulas de cada professor em cada turma, com os totais por semana e por mês. */
export function WorkloadPage() {
  const schedule = useScheduleData();
  return (
    <Page
      title="Carga horária"
      width="wide"
      guide={GUIDES.workload}
      breadcrumbs={[{ label: 'Quadro de horários', to: '/horarios' }, { label: 'Carga horária' }]}
      description="Quantas aulas cada professor dá em cada turma, com o total de cada professor por semana e por mês."
    >
      <DataGate data={schedule.data} isLoading={schedule.isLoading} error={schedule.error} onRetry={schedule.refetch}>
        {(data) => <WorkloadView data={data} />}
      </DataGate>
    </Page>
  );
}

function WorkloadView({ data }: { data: ScheduleData }) {
  const [shift, setShift] = useState<ShiftFilter>('todos');
  const [weeks, setWeeks] = useLocalStorage<Weeks>('seice:carga-semanas', 4.5);
  const [open, setOpen] = useState<Set<number>>(new Set());
  const [exporting, setExporting] = useState(false);
  const toast = useToast();

  const shifts = CLASS_SHIFTS.filter((s) => data.classes.some((c) => c.active && c.shift === s));
  const w = useMemo(
    () =>
      computeWorkload(data.lessons, data.teachers, data.classes, shift === 'todos' ? undefined : (c) => c.shift === shift, (l) =>
        // Aula dupla vale duas: conta os períodos de aula que ela ocupa.
        Math.max(1, data.periods.filter((p) => p.kind === 'aula' && overlaps(p.start, p.end, l.start, l.end) && periodShiftFits(p.shift, l, data)).length),
      ),
    [data, shift],
  );
  const maxTotal = Math.max(1, ...w.rows.map((r) => r.total.lessons));
  // Atribuição de aulas: o combinado, para comparar com o que já está no quadro (só nas turmas visíveis).
  const visible = new Set(w.classes.map((c) => c.id));
  const assignedOf = (teacherId: number, classId?: number) =>
    data.assignments
      .filter((a) => a.teacherId === teacherId && visible.has(a.classId) && (classId === undefined || a.classId === classId))
      .reduce((n, a) => n + a.weeklyLessons, 0);
  const assignedGrand = data.assignments.filter((a) => visible.has(a.classId)).reduce((n, a) => n + a.weeklyLessons, 0);
  const withLessons = w.rows.filter((r) => r.total.lessons > 0);
  const subjectName = (id: number | null) => (id === null ? 'Sem disciplina' : (data.subjects.find((s) => s.id === id)?.name ?? '—'));
  const monthHours = (l: Load) => formatHours(Math.round(l.minutes * weeks));

  const toggle = (id: number) =>
    setOpen((all) => {
      const next = new Set(all);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function exportExcel() {
    setExporting(true);
    try {
      const header = ['Professor', ...w.classes.map((c) => c.name), 'Aulas por semana', 'Horas por semana', 'Aulas atribuídas por semana', 'Aulas por mês', 'Horas por mês'];
      const totals = (l: Load, assigned: number) => [l.lessons, formatHours(l.minutes), assigned, l.lessons * weeks, monthHours(l)];
      const rows = w.rows.map((r) => [r.teacher.name, ...w.classes.map((c) => r.byClass.get(c.id)?.lessons ?? 0), ...totals(r.total, assignedOf(r.teacher.id))]);
      const footer = ['Total da turma (aulas por semana)', ...w.classes.map((c) => w.classTotals.get(c.id)?.lessons ?? 0), ...totals(w.grand, assignedGrand)];
      await downloadTable(`carga-horaria${shift === 'todos' ? '' : `-${shift}`}`, 'Carga horária', header, rows, footer);
    } catch (error) {
      toast.error('Não foi possível exportar', errorMessage(error));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Resumo da escola */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Aulas por semana" value={num(w.grand.lessons)} hint={`${formatHours(w.grand.minutes)} de aula`} />
        <Stat label="Aulas por mês" value={num(w.grand.lessons * weeks)} hint={`${monthHours(w.grand)} de aula`} accent />
        <Stat label="Professores com aulas" value={`${withLessons.length} de ${w.rows.length}`} />
        <Stat label="Média por professor" value={withLessons.length ? aulas(Math.round((w.grand.lessons / withLessons.length) * 10) / 10) : '—'} hint="por semana" />
      </div>

      {/* Controles */}
      <Card className="flex flex-wrap items-center gap-x-5 gap-y-3 p-3">
        {shifts.length > 1 && (
          <Segmented
            label="Turno das turmas"
            value={shift}
            onChange={(v) => setShift(v)}
            options={[{ value: 'todos' as ShiftFilter, label: 'Todas as turmas' }, ...shifts.map((s) => ({ value: s as ShiftFilter, label: SHIFT_LABEL[s] }))]}
          />
        )}
        <div className="flex items-center gap-2">
          <span className="text-[13.5px] font-semibold text-ink-2">Mês com</span>
          <Segmented
            label="Semanas por mês"
            value={weeks}
            onChange={setWeeks}
            options={WEEKS_OPTIONS.map((n) => ({ value: n, label: `${num(n)} semanas` }))}
          />
        </div>
        <Button className="ml-auto" icon={<Download className="size-4" />} loading={exporting} onClick={() => void exportExcel()} disabled={w.rows.length === 0}>
          Exportar Excel
        </Button>
      </Card>

      {w.classes.length === 0 || w.rows.length === 0 ? (
        <Card className="p-8 text-center text-muted">Cadastre professores e turmas e monte o quadro para ver a carga horária.</Card>
      ) : (
        <>
          <p className="flex items-start gap-2 text-[14px] text-ink-2">
            <Info className="mt-0.5 size-4 shrink-0" />
            <span>
              <strong className="text-ink">Como ler:</strong> cada número é quantas aulas o professor dá naquela turma <strong className="text-ink">por semana</strong>. As
              colunas amarelas somam tudo: o total da semana, quantas aulas foram <strong className="text-ink">atribuídas</strong> ao professor e o total do mês{' '}
              ({num(weeks)} semanas). Quando o quadro ainda não bate com a atribuição, aparece em laranja, como <strong className="text-warning">2 de 3</strong>. Aula
              dupla conta como duas.
            </span>
          </p>

          <div className="overflow-x-auto rounded-xl bg-surface shadow-raise ring-1 ring-line-strong scrollbar-thin">
            <table className="w-full border-separate border-spacing-0 text-[14px]">
              <caption className="sr-only">Carga horária por professor e turma, com totais por semana e por mês</caption>
              <thead>
                <tr>
                  <th rowSpan={2} scope="col" className="sticky left-0 z-10 min-w-[230px] bg-nav px-4 py-3 text-left align-bottom text-[13px] font-bold text-white">
                    Professor
                  </th>
                  <th colSpan={w.classes.length} scope="colgroup" className="border-l border-nav-line bg-nav px-3 pt-3 pb-1.5 text-center text-xs font-bold tracking-wide text-nav-text uppercase">
                    Aulas por semana em cada turma
                  </th>
                  <th colSpan={3} scope="colgroup" className="border-l-4 border-canvas bg-brand px-3 pt-3 pb-1.5 text-center text-xs font-extrabold tracking-wide text-ink uppercase">
                    Total do professor
                  </th>
                </tr>
                <tr>
                  {w.classes.map((c) => (
                    <th key={c.id} scope="col" className="min-w-[84px] border-l border-nav-line bg-nav px-2 pt-1 pb-3 text-center">
                      <Link to={`/horarios/montar/turma/${c.id}`} className="block text-[15px] font-bold text-white hover:text-brand hover:underline" title={`Montar o quadro da ${c.name}`}>
                        {c.name}
                      </Link>
                      <span className="block text-[11px] font-semibold text-nav-text">{SHIFT_LABEL[c.shift]}</span>
                    </th>
                  ))}
                  <th scope="col" className="min-w-[132px] border-l-4 border-canvas bg-brand px-3 pt-1 pb-3 text-center text-[14px] font-bold text-ink">
                    Por semana
                  </th>
                  <th scope="col" className="min-w-[120px] border-l border-ink/15 bg-brand px-3 pt-1 pb-3 text-center text-[14px] font-bold text-ink">
                    Atribuídas
                  </th>
                  <th scope="col" className="min-w-[132px] border-l border-ink/15 bg-brand px-3 pt-1 pb-3 text-center text-[14px] font-bold text-ink">
                    Por mês
                  </th>
                </tr>
              </thead>
              <tbody>
                {w.rows.map((r, i) => {
                  const expanded = open.has(r.teacher.id);
                  const zebra = i % 2 === 1 ? 'bg-subtle/60' : 'bg-surface';
                  return (
                    <Fragment key={r.teacher.id}>
                      <tr className="group">
                        <th scope="row" className={cn('sticky left-0 z-10 border-b border-line px-2 py-0 text-left group-hover:bg-brand-soft', zebra === 'bg-surface' ? 'bg-surface' : 'bg-subtle')}>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => toggle(r.teacher.id)}
                              aria-expanded={expanded}
                              disabled={r.bySubject.length === 0}
                              className="flex min-h-[58px] min-w-0 flex-1 items-center gap-1.5 rounded-md px-1 text-left disabled:cursor-default"
                              title={r.bySubject.length ? 'Ver por disciplina' : undefined}
                            >
                              {r.bySubject.length ? (
                                expanded ? <ChevronDown className="size-4 shrink-0 text-ink-2" /> : <ChevronRight className="size-4 shrink-0 text-ink-2" />
                              ) : (
                                <span className="size-4 shrink-0" />
                              )}
                              <span className="min-w-0">
                                <span className="block truncate text-[15px] font-bold text-ink">{r.teacher.name}</span>
                                <span className="block truncate text-xs font-medium text-ink-2">
                                  {r.teacher.active ? (r.bySubject.length ? r.bySubject.map((s) => subjectName(s.subjectId)).join(', ') : 'Sem aulas') : 'Inativo'}
                                </span>
                              </span>
                            </button>
                            <Link
                              to={`/horarios/montar/professor/${r.teacher.id}`}
                              className="grid size-8 shrink-0 place-items-center rounded-md text-ink-2 opacity-0 group-hover:opacity-100 hover:bg-surface hover:text-ink focus-visible:opacity-100"
                              aria-label={`Montar o quadro de ${r.teacher.name}`}
                              title="Montar o quadro deste professor"
                            >
                              <PencilRuler className="size-4" />
                            </Link>
                          </div>
                        </th>
                        {w.classes.map((c) => (
                          <td key={c.id} className={cn('border-b border-l border-line text-center group-hover:bg-brand-soft/50', zebra)}>
                            <CountCell load={r.byClass.get(c.id)} assigned={assignedOf(r.teacher.id, c.id)} />
                          </td>
                        ))}
                        <td className="border-b border-l-4 border-b-line border-l-canvas bg-brand-soft px-3 py-2">
                          <span className="tabular block text-center text-[16px] font-extrabold text-ink">{aulas(r.total.lessons)}</span>
                          <span className="tabular block text-center text-xs font-semibold text-ink-2">{formatHours(r.total.minutes)}</span>
                          <span className="mx-auto mt-1 block h-1.5 w-full max-w-[96px] overflow-hidden rounded-full bg-ink/10">
                            <span className="block h-full rounded-full bg-ink/70" style={{ width: `${(r.total.lessons / maxTotal) * 100}%` }} />
                          </span>
                        </td>
                        <td className="border-b border-l border-line bg-brand-soft px-3 py-2 text-center">
                          <AssignedTotal placed={r.total.lessons} assigned={assignedOf(r.teacher.id)} />
                        </td>
                        <td className="border-b border-l border-line bg-brand-soft px-3 py-2 text-center">
                          <span className="tabular block text-[16px] font-extrabold text-ink">{aulas(r.total.lessons * weeks)}</span>
                          <span className="tabular block text-xs font-semibold text-ink-2">{monthHours(r.total)}</span>
                        </td>
                      </tr>
                      {expanded &&
                        r.bySubject.map((s) => {
                          const subject = s.subjectId === null ? undefined : data.subjects.find((x) => x.id === s.subjectId);
                          return (
                            <tr key={`${r.teacher.id}-${s.subjectId}`} className="text-[13px]">
                              <th scope="row" className="sticky left-0 z-10 border-b border-line bg-canvas/60 py-2 pr-2 pl-9 text-left font-semibold text-ink-2">
                                <span className="flex items-center gap-2">
                                  <span className={cn('size-2.5 shrink-0 rounded-full', subject ? SUBJECT_STYLE[subject.color].dot : 'bg-line-strong')} />
                                  <span className="truncate">{subjectName(s.subjectId)}</span>
                                </span>
                              </th>
                              {w.classes.map((c) => (
                                <td key={c.id} className="tabular border-b border-l border-line bg-canvas/60 px-2 text-center font-semibold text-ink-2">
                                  {s.byClass.get(c.id)?.lessons ?? ''}
                                </td>
                              ))}
                              <td className="tabular border-b border-l-4 border-b-line border-l-canvas bg-canvas/60 px-3 text-center font-bold text-ink">{aulas(s.total.lessons)}</td>
                              <td className="border-b border-l border-line bg-canvas/60" />
                              <td className="tabular border-b border-l border-line bg-canvas/60 px-3 text-center font-bold text-ink">{aulas(s.total.lessons * weeks)}</td>
                            </tr>
                          );
                        })}
                    </Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row" className="sticky left-0 z-10 bg-ink-2 px-4 py-3 text-left text-white">
                    <span className="block text-[14px] font-bold">Total da turma</span>
                    <span className="block text-xs font-medium text-white/70">aulas por semana</span>
                  </th>
                  {w.classes.map((c) => {
                    const t = w.classTotals.get(c.id);
                    return (
                      <td key={c.id} className="border-l border-white/15 bg-ink-2 px-2 py-3 text-center text-white">
                        <span className="tabular block text-[16px] font-extrabold">{t?.lessons ?? 0}</span>
                        <span className="tabular block text-xs font-medium text-white/70">{formatHours(t?.minutes ?? 0)}</span>
                      </td>
                    );
                  })}
                  <td className="border-l-4 border-canvas bg-brand px-3 py-3 text-center text-ink">
                    <span className="block text-[11px] font-bold tracking-wide uppercase">Escola · semana</span>
                    <span className="tabular block text-[17px] font-extrabold">{aulas(w.grand.lessons)}</span>
                    <span className="tabular block text-xs font-semibold">{formatHours(w.grand.minutes)}</span>
                  </td>
                  <td className="border-l border-ink/15 bg-brand px-3 py-3 text-center text-ink">
                    <span className="block text-[11px] font-bold tracking-wide uppercase">Atribuídas</span>
                    <span className="tabular block text-[17px] font-extrabold">{assignedGrand ? aulas(assignedGrand) : '—'}</span>
                    {assignedGrand > 0 && <span className="tabular block text-xs font-semibold">{w.grand.lessons} no quadro</span>}
                  </td>
                  <td className="border-l border-ink/15 bg-brand px-3 py-3 text-center text-ink">
                    <span className="block text-[11px] font-bold tracking-wide uppercase">Escola · mês</span>
                    <span className="tabular block text-[17px] font-extrabold">{aulas(w.grand.lessons * weeks)}</span>
                    <span className="tabular block text-xs font-semibold">{monthHours(w.grand)}</span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Aulas do professor numa turma: número grande e horas embaixo; vazio quando não dá aula ali.
 * Se o quadro não bate com a atribuição, mostra "2 de 3" em laranja (faltam) ou vermelho (passou).
 */
function CountCell({ load, assigned }: { load: Load | undefined; assigned: number }) {
  const n = load?.lessons ?? 0;
  if (n === 0 && assigned === 0) return <span className="text-[15px] text-line-strong">—</span>;
  const off = assigned > 0 && n !== assigned;
  return (
    <span
      className={cn(
        'inline-flex min-w-[52px] flex-col items-center rounded-lg px-2 py-1 ring-1 ring-inset',
        !off ? 'bg-brand-soft ring-brand/40' : n < assigned ? 'bg-warning-soft ring-warning/40' : 'bg-danger-soft ring-danger/40',
      )}
      title={assigned ? `${n} no quadro de ${assigned} atribuídas por semana` : undefined}
    >
      <span className="tabular text-[16px] leading-tight font-extrabold text-ink">{n}</span>
      {off ? (
        <span className={cn('tabular text-[11px] font-bold', n < assigned ? 'text-warning' : 'text-danger')}>de {assigned}</span>
      ) : (
        <span className="tabular text-[11px] font-semibold text-ink-2">{formatHours(load?.minutes ?? 0)}</span>
      )}
    </span>
  );
}

/** Total atribuído ao professor comparado com o que já está no quadro. */
function AssignedTotal({ placed, assigned }: { placed: number; assigned: number }) {
  if (assigned === 0) return <span className="text-[12.5px] font-semibold text-ink-2">sem atribuição</span>;
  const missing = assigned - placed;
  return (
    <>
      <span className="tabular block text-[16px] font-extrabold text-ink">{aulas(assigned)}</span>
      <span className={cn('tabular block text-xs font-bold', missing === 0 ? 'text-success' : missing > 0 ? 'text-warning' : 'text-danger')}>
        {missing === 0 ? '✓ tudo no quadro' : missing > 0 ? `faltam ${missing}` : `${-missing} a mais`}
      </span>
    </>
  );
}

/** Considera só os períodos do turno da turma (manhã e tarde podem ter horários que se cruzam). */
function periodShiftFits(shift: ShiftKey, l: Lesson, data: ScheduleData) {
  const c = data.classes.find((x) => x.id === l.classId);
  return !c || shiftsOfClass(c.shift).includes(shift);
}

function Stat({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <Card className={cn('px-4 py-3', accent && 'bg-brand-soft ring-1 ring-brand/50')}>
      <p className="text-[13px] font-semibold text-ink-2">{label}</p>
      <p className="tabular mt-0.5 text-2xl font-extrabold text-ink">{value}</p>
      {hint && <p className="tabular text-xs font-medium text-ink-2">{hint}</p>}
    </Card>
  );
}
