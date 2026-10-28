import { Fragment, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ChevronDown, ChevronRight, Download, PencilRuler } from 'lucide-react';
import { Page } from '@/components/layout/Page';
import { DataGate } from '@/components/layout/DataGate';
import { Button, Card, Segmented, useToast } from '@/components/ui';
import { useScheduleData, type ScheduleData } from '@/api/hooks';
import { computeWorkload, type Load } from '@shared/workload';
import { SHIFT_LABEL } from '@shared/labels';
import { CLASS_SHIFTS, type ClassShift } from '@shared/types';
import { SUBJECT_STYLE } from '@/lib/subjectColors';
import { formatHours } from '@/lib/format';
import { downloadTable } from '@/lib/spreadsheet';
import { errorMessage } from '@/api/client';
import { cn } from '@/lib/cn';
import { overlaps } from '@shared/time';
import { shiftsOfClass } from '@shared/labels';
import type { Lesson, ShiftKey } from '@shared/types';
import { GUIDES } from '@/lib/guides';

type Unit = 'lessons' | 'hours';
type ShiftFilter = ClassShift | 'todos';

/** Carga horária: aulas (ou horas) de cada professor em cada turma, com os totais. */
export function WorkloadPage() {
  const schedule = useScheduleData();
  return (
    <Page
      title="Carga horária"
      width="wide"
      guide={GUIDES.workload}
      breadcrumbs={[{ label: 'Quadro de horários', to: '/horarios' }, { label: 'Carga horária' }]}
      description="Quantas aulas cada professor dá em cada turma por semana, com o total de cada professor, de cada turma e da escola."
    >
      <DataGate data={schedule.data} isLoading={schedule.isLoading} error={schedule.error} onRetry={schedule.refetch}>
        {(data) => <WorkloadView data={data} />}
      </DataGate>
    </Page>
  );
}

function WorkloadView({ data }: { data: ScheduleData }) {
  const [unit, setUnit] = useState<Unit>('lessons');
  const [shift, setShift] = useState<ShiftFilter>('todos');
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
  const fmt = (l: Load | undefined) => (!l || l.lessons === 0 ? '' : unit === 'lessons' ? String(l.lessons) : formatHours(l.minutes));
  const max = Math.max(1, ...w.rows.flatMap((r) => [...r.byClass.values()].map((l) => l.lessons)));
  const withLessons = w.rows.filter((r) => r.total.lessons > 0);
  const subjectName = (id: number | null) => (id === null ? 'Sem disciplina' : (data.subjects.find((s) => s.id === id)?.name ?? '—'));

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
      const header = ['Professor', ...w.classes.map((c) => c.name), unit === 'lessons' ? 'Total de aulas' : 'Total de horas'];
      const value = (l: Load | undefined) => (unit === 'lessons' ? (l?.lessons ?? 0) : formatHours(l?.minutes ?? 0));
      const rows = w.rows.map((r) => [r.teacher.name, ...w.classes.map((c) => value(r.byClass.get(c.id))), value(r.total)]);
      const totals = ['Total da turma', ...w.classes.map((c) => value(w.classTotals.get(c.id))), value(w.grand)];
      await downloadTable(`carga-horaria${shift === 'todos' ? '' : `-${shift}`}`, 'Carga horária', header, rows, totals);
    } catch (error) {
      toast.error('Não foi possível exportar', errorMessage(error));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Resumo */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Aulas por semana" value={String(w.grand.lessons)} />
        <Stat label="Horas por semana" value={formatHours(w.grand.minutes)} />
        <Stat label="Professores com aulas" value={`${withLessons.length} de ${w.rows.length}`} />
        <Stat label="Média por professor" value={withLessons.length ? `${(w.grand.lessons / withLessons.length).toFixed(1).replace('.', ',')} aulas` : '—'} />
      </div>

      {/* Controles */}
      <Card className="flex flex-wrap items-center gap-3 p-3">
        <Segmented
          label="Mostrar"
          value={unit}
          onChange={setUnit}
          options={[
            { value: 'lessons', label: 'Aulas' },
            { value: 'hours', label: 'Horas' },
          ]}
        />
        {shifts.length > 1 && (
          <Segmented
            label="Turno das turmas"
            value={shift}
            onChange={(v) => setShift(v)}
            options={[{ value: 'todos' as ShiftFilter, label: 'Todas as turmas' }, ...shifts.map((s) => ({ value: s as ShiftFilter, label: SHIFT_LABEL[s] }))]}
          />
        )}
        <Button className="ml-auto" icon={<Download className="size-4" />} loading={exporting} onClick={() => void exportExcel()} disabled={w.rows.length === 0}>
          Exportar Excel
        </Button>
      </Card>

      {w.classes.length === 0 || w.rows.length === 0 ? (
        <Card className="p-8 text-center text-muted">Cadastre professores e turmas e monte o quadro para ver a carga horária.</Card>
      ) : (
        <div className="overflow-x-auto rounded-xl bg-surface shadow-raise ring-1 ring-line-strong scrollbar-thin">
          <table className="w-full border-separate border-spacing-0 text-[14px]">
            <caption className="sr-only">Carga horária semanal por professor e turma</caption>
            <thead>
              <tr>
                <th scope="col" className="sticky left-0 z-10 min-w-[220px] bg-nav px-4 py-3 text-left text-xs font-bold tracking-wide text-nav-text uppercase">
                  Professor
                </th>
                {w.classes.map((c) => (
                  <th key={c.id} scope="col" className="min-w-[76px] border-l border-nav-line bg-nav px-2 py-3 text-center font-bold text-white">
                    <Link to={`/horarios/montar/turma/${c.id}`} className="hover:text-brand hover:underline" title={`Montar o quadro da ${c.name}`}>
                      {c.name}
                    </Link>
                  </th>
                ))}
                <th scope="col" className="min-w-[92px] border-l border-nav-line bg-brand px-3 py-3 text-center text-xs font-extrabold tracking-wide text-ink uppercase">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {w.rows.map((r) => {
                const expanded = open.has(r.teacher.id);
                return (
                  <Fragment key={r.teacher.id}>
                    <tr className="group">
                      <th scope="row" className="sticky left-0 z-10 border-b border-line-strong bg-subtle px-2 py-0 text-left group-hover:bg-brand-soft">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => toggle(r.teacher.id)}
                            aria-expanded={expanded}
                            disabled={r.bySubject.length === 0}
                            className="flex min-h-11 min-w-0 flex-1 items-center gap-1.5 rounded-md px-1 text-left font-bold text-ink disabled:cursor-default"
                            title={r.bySubject.length ? 'Ver por disciplina' : undefined}
                          >
                            {r.bySubject.length ? (
                              expanded ? <ChevronDown className="size-4 shrink-0" /> : <ChevronRight className="size-4 shrink-0" />
                            ) : (
                              <span className="size-4 shrink-0" />
                            )}
                            <span className="truncate">{r.teacher.name}</span>
                            {!r.teacher.active && <span className="shrink-0 text-xs font-semibold text-muted">(inativo)</span>}
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
                      {w.classes.map((c) => {
                        const l = r.byClass.get(c.id);
                        const strength = l ? 0.18 + 0.62 * (l.lessons / max) : 0;
                        return (
                          <td
                            key={c.id}
                            className="tabular border-b border-l border-line-strong px-2 text-center font-bold text-ink"
                            style={l ? { background: `color-mix(in srgb, var(--color-brand) ${Math.round(strength * 100)}%, var(--color-surface))` } : undefined}
                          >
                            {fmt(l) || <span className="font-normal text-line-strong">·</span>}
                          </td>
                        );
                      })}
                      <td className="tabular border-b border-l border-line-strong bg-ink-2 px-3 text-center text-[15px] font-extrabold text-white">{fmt(r.total) || '0'}</td>
                    </tr>
                    {expanded &&
                      r.bySubject.map((s) => {
                        const subject = s.subjectId === null ? undefined : data.subjects.find((x) => x.id === s.subjectId);
                        return (
                          <tr key={`${r.teacher.id}-${s.subjectId}`} className="text-[13px]">
                            <th scope="row" className="sticky left-0 z-10 border-b border-line bg-surface py-2 pr-2 pl-9 text-left font-semibold text-ink-2">
                              <span className="flex items-center gap-2">
                                <span className={cn('size-2.5 shrink-0 rounded-full', subject ? SUBJECT_STYLE[subject.color].dot : 'bg-line-strong')} />
                                <span className="truncate">{subjectName(s.subjectId)}</span>
                              </span>
                            </th>
                            {w.classes.map((c) => (
                              <td key={c.id} className="tabular border-b border-l border-line bg-surface px-2 text-center font-semibold text-ink-2">
                                {fmt(s.byClass.get(c.id))}
                              </td>
                            ))}
                            <td className="tabular border-b border-l border-line bg-subtle px-3 text-center font-bold text-ink">{fmt(s.total)}</td>
                          </tr>
                        );
                      })}
                  </Fragment>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row" className="sticky left-0 z-10 bg-ink-2 px-4 py-3 text-left text-xs font-bold tracking-wide text-white uppercase">
                  Total da turma
                </th>
                {w.classes.map((c) => (
                  <td key={c.id} className="tabular border-l border-white/15 bg-ink-2 px-2 py-3 text-center text-[15px] font-extrabold text-white">
                    {fmt(w.classTotals.get(c.id)) || '0'}
                  </td>
                ))}
                <td className="tabular border-l border-white/15 bg-brand px-3 py-3 text-center text-base font-extrabold text-ink">{fmt(w.grand) || '0'}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <p className="text-[13px] text-muted">
        Cada número é a quantidade de {unit === 'lessons' ? 'aulas (uma aula dupla conta como duas)' : 'horas'} por semana. Quanto mais forte o amarelo, maior a carga do professor naquela turma.
      </p>
    </div>
  );
}

/** Considera só os períodos do turno da turma (manhã e tarde podem ter horários que se cruzam). */
function periodShiftFits(shift: ShiftKey, l: Lesson, data: ScheduleData) {
  const c = data.classes.find((x) => x.id === l.classId);
  return !c || shiftsOfClass(c.shift).includes(shift);
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="px-4 py-3">
      <p className="text-[13px] font-semibold text-ink-2">{label}</p>
      <p className="tabular mt-0.5 text-2xl font-extrabold text-ink">{value}</p>
    </Card>
  );
}
