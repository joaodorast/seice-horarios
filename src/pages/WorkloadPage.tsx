import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ChevronDown, Download, Printer, Users, GraduationCap } from 'lucide-react';
import { Page } from '@/components/layout/Page';
import { DataGate } from '@/components/layout/DataGate';
import { Button, Card, Combobox, Input, SearchInput, Segmented, useToast } from '@/components/ui';
import { useScheduleData, type ScheduleData } from '@/api/hooks';
import { useUnits } from '@/api/units';
import { computeWorkload, lessonTimeCount, monthWeekdayCounts } from '@shared/workload';
import { CLASS_SHIFTS, type ClassShift, type Weekday } from '@shared/types';
import { SHIFT_LABEL, WEEKDAY_LABEL, WEEKDAY_SHORT } from '@shared/labels';
import { formatHours } from '@/lib/format';
import { downloadTable } from '@/lib/spreadsheet';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { matches } from '@/lib/text';
import { errorMessage } from '@/api/client';
import { GUIDES } from '@/lib/guides';

type Scope = 'dia' | 'semana' | 'mes';
type View = 'professor' | 'turma';
const num = (value: number) => value.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
const paidHours = (minutes: number) => Number.isInteger(minutes)
  ? formatHours(minutes)
  : `${formatHours(Math.floor(minutes))} ${Math.round((minutes % 1) * 60)}s`;

export function WorkloadPage() {
  const schedule = useScheduleData();
  return (
    <Page title="Carga horária" width="wide" guide={GUIDES.workload}
      breadcrumbs={[{ label: 'Quadro de horários', to: '/horarios' }, { label: 'Carga horária' }]}
      description="Confira os tempos e minutos pagos por professor, turma e disciplina. Escolha o dia, a semana ou o mês do calendário.">
      <DataGate data={schedule.data} isLoading={schedule.isLoading} error={schedule.error} onRetry={schedule.refetch}>
        {(data) => <WorkloadView data={data} />}
      </DataGate>
    </Page>
  );
}

function WorkloadView({ data }: { data: ScheduleData }) {
  const [query, setQuery] = useState('');
  const [view, setView] = useState<View>('professor');
  const [scope, setScope] = useState<Scope>('semana');
  const [day, setDay] = useState<Weekday>(data.settings.enabledDays[0] ?? 1);
  const [classId, setClassId] = useState<number | null>(null);
  const [subjectId, setSubjectId] = useState<number | null>(null);
  const [unitId, setUnitId] = useState<number | null>(null);
  const [shift, setShift] = useState<ClassShift | 'todos'>('todos');
  const [includeEmpty, setIncludeEmpty] = useState(false);
  const [paidMinutes, setPaidMinutes] = useLocalStorage('seice:paid-minutes', data.settings.lessonDuration);
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const weekdayCounts = useMemo(() => monthWeekdayCounts(month, data.settings.enabledDays, data.settings.excludedDates),
    [month, data.settings.enabledDays, data.settings.excludedDates]);
  const [exporting, setExporting] = useState(false);
  const { data: units = [] } = useUnits();
  const toast = useToast();

  const workload = useMemo(() => {
    const teachers = data.teachers.filter((teacher) => matches([teacher.name, teacher.code ?? ''], query));
    const classes = data.classes.filter((schoolClass) =>
      (!classId || schoolClass.id === classId)
      && (!unitId || schoolClass.unitId === unitId)
      && (shift === 'todos' || schoolClass.shift === shift),
    );
    const lessons = data.lessons.filter((lesson) =>
      (scope !== 'dia' || lesson.weekday === day)
      && (!subjectId || lesson.subjectId === subjectId),
    );
    return computeWorkload(lessons, teachers, classes, undefined,
      (lesson) => lessonTimeCount(lesson, data.periods, data.classes),
      (lesson) => scope === 'mes' ? weekdayCounts[lesson.weekday] : 1);
  }, [data, query, classId, unitId, shift, scope, day, subjectId, weekdayCounts]);

  const periodLabel = scope === 'dia' ? WEEKDAY_LABEL[day] : scope === 'mes' ? `Calendário de ${month.split('-').reverse().join('/')}` : 'Semana completa';
  const rows = workload.rows.filter((row) => includeEmpty || row.total.lessons > 0);
  const visibleClasses = workload.classes.filter((schoolClass) =>
    includeEmpty || (workload.classTotals.get(schoolClass.id)?.lessons ?? 0) > 0);
  const subjectName = (id: number | null) => data.subjects.find((subject) => subject.id === id)?.name ?? 'Sem disciplina';
  const unitName = (id: number | undefined) => units.find((unit) => unit.id === id)?.code ?? '';
  const className = (id: number) => {
    const schoolClass = data.classes.find((item) => item.id === id);
    return schoolClass ? [unitName(schoolClass.unitId), schoolClass.name].filter(Boolean).join(' · ') : 'Turma';
  };

  async function exportExcel() {
    setExporting(true);
    try {
      // Somente linhas de detalhe. Cada tempo aparece uma vez na soma da planilha.
      const details = workload.rows.flatMap((row) => row.bySubject.flatMap((subject) =>
        [...subject.byClass].map(([id, load]) => [
          row.teacher.name, className(id), subjectName(subject.subjectId), periodLabel,
          load.lessons, load.lessons * paidMinutes,
          paidHours(load.lessons * paidMinutes),
        ]),
      ));
      await downloadTable('carga-horaria', 'Carga horária',
        ['Professor', 'Turma', 'Disciplina', 'Período', 'Tempos', 'Minutos pagos', 'Horas pagas'],
        details, ['Total do recorte', '', '', periodLabel, workload.grand.lessons,
          workload.grand.lessons * paidMinutes, paidHours(workload.grand.lessons * paidMinutes)]);
    } catch (error) {
      toast.error('Não foi possível exportar', errorMessage(error));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <Card className="flex flex-col gap-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Segmented label="Período do cálculo" value={scope} onChange={setScope}
            options={[{ value: 'dia', label: 'Diário' }, { value: 'semana', label: 'Semanal' }, { value: 'mes', label: 'Mensal' }]} />
          {scope === 'dia' && (
            <Segmented label="Dia do cálculo" value={day} onChange={setDay}
              options={data.settings.enabledDays.map((value) => ({ value, label: WEEKDAY_SHORT[value] }))} />
          )}
          {scope === 'mes' && (
            <label className="flex items-center gap-2 text-sm font-semibold">
              Mês do calendário
              <Input aria-label="Mês do calendário" type="month" min="1000-01" max="9999-12" value={month} onChange={(event) => {
                if (/^\d{4}-(0[1-9]|1[0-2])$/.test(event.target.value)) setMonth(event.target.value);
              }} />
            </label>
          )}
        </div>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <label className="min-w-0 text-xs font-semibold text-muted">Professor
            <SearchInput value={query} onChange={setQuery} placeholder="Nome ou matrícula" className="mt-1 w-full" />
          </label>
          <label className="min-w-0 text-xs font-semibold text-muted">Turma
            <Combobox value={classId} onChange={setClassId} clearable placeholder="Todas as turmas"
              options={data.classes.filter((item) => !unitId || item.unitId === unitId).map((item) => ({ value: item.id, label: className(item.id) }))} />
          </label>
          <label className="min-w-0 text-xs font-semibold text-muted">Disciplina
            <Combobox value={subjectId} onChange={setSubjectId} clearable placeholder="Todas as disciplinas"
              options={data.subjects.map((item) => ({ value: item.id, label: item.name }))} />
          </label>
          <label className="min-w-0 text-xs font-semibold text-muted">Unidade
            <Combobox value={unitId} onChange={(value) => { setUnitId(value); setClassId(null); }} clearable placeholder="Todas as unidades"
              options={units.map((unit) => ({ value: unit.id, label: `${unit.code} · ${unit.name}` }))} />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-4 border-t border-line pt-3">
          <Segmented label="Turno do cálculo" value={shift} onChange={setShift}
            options={[{ value: 'todos' as const, label: 'Todos os turnos' }, ...CLASS_SHIFTS.map((value) => ({ value, label: SHIFT_LABEL[value] }))]} />
          <label className="flex items-center gap-2 text-sm text-ink-2">Minutos pagos por tempo
            <Input type="number" min={1} max={180} value={paidMinutes} className="w-20" onChange={(event) => {
              const value = Number(event.target.value);
              if (Number.isInteger(value) && value >= 1 && value <= 180) setPaidMinutes(value);
            }} />
          </label>
          <Button className="ml-auto" icon={<Download className="size-4" />} loading={exporting}
            onClick={() => void exportExcel()} disabled={workload.grand.lessons === 0}>Exportar este recorte</Button>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Total de tempos neste recorte" value={num(workload.grand.lessons)} hint={periodLabel} />
        <Metric label="Total de minutos pagos neste recorte" value={num(workload.grand.lessons * paidMinutes)} hint={`${paidMinutes} minutos por tempo`} accent />
        <Metric label="Total de horas pagas neste recorte" value={paidHours(workload.grand.lessons * paidMinutes)}
          hint={`${workload.rows.filter((row) => row.total.lessons > 0).length} professores com aulas`} />
      </div>
      <p className="text-sm leading-relaxed text-ink-2">
        Todos os totais abaixo consideram os mesmos filtros. A busca por professor também filtra o total.
        {scope === 'mes' && <> O mensal aplica a grade semanal atual às datas reais do mês e desconta as datas sem aula registradas pela administração.</>}
      </p>
      {scope === 'mes' && (
        <Card className="p-4">
          <h3 className="text-sm font-bold">Dias letivos considerados no mês</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {data.settings.enabledDays.map((weekday) => (
              <span key={weekday} className="rounded-lg bg-subtle px-3 py-2 text-sm">
                {WEEKDAY_SHORT[weekday]} <strong className="tabular">{weekdayCounts[weekday]}</strong>
              </span>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">Feriados e recessos devem estar cadastrados em Configurações → Calendário e turnos → Datas sem aula. Essas datas valem para as duas unidades.</p>
        </Card>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented label="Agrupar carga horária" value={view} onChange={setView}
          options={[{ value: 'professor', label: <><Users className="size-4" />Por professor</> }, { value: 'turma', label: <><GraduationCap className="size-4" />Por turma</> }]} />
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={includeEmpty} onChange={(event) => setIncludeEmpty(event.target.checked)} />Incluir cadastros sem aulas
        </label>
      </div>

      {view === 'professor' ? (
        <div className="flex flex-col gap-3">
          {rows.map((row) => (
            <details key={row.teacher.id} className="group overflow-hidden rounded-xl border border-line-strong bg-surface shadow-raise">
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-4 p-4 hover:bg-subtle">
                <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" />
                <div className="min-w-0 flex-1 basis-40">
                  <h2 className="font-bold text-ink">{row.teacher.name}</h2>
                  <p className="mt-1 text-xs text-muted">{row.byClass.size} turmas · {row.bySubject.length} disciplinas · toque para detalhar</p>
                </div>
                <LoadNumbers count={row.total.lessons} minutesPerTime={paidMinutes} />
              </summary>
              <div className="flex flex-col gap-4 border-t border-line bg-subtle/50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold">Disciplinas de {row.teacher.name}</h3>
                  <Link to={`/imprimir/professor/${row.teacher.id}`} target="_blank" className="inline-flex items-center gap-2 rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm font-semibold">
                    <Printer className="size-4" />Imprimir semana do professor
                  </Link>
                </div>
                {row.bySubject.map((subject) => (
                  <div key={subject.subjectId ?? 'none'} className="rounded-lg border border-line bg-surface p-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h4 className="font-semibold">{subjectName(subject.subjectId)}</h4>
                      <LoadNumbers count={subject.total.lessons} minutesPerTime={paidMinutes} compact />
                    </div>
                    <ul className="mt-3 divide-y divide-line border-t border-line">
                      {[...subject.byClass].map(([id, load]) => (
                        <li key={id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                          <span className="min-w-0 flex-1 basis-48 break-words text-ink-2">{className(id)}</span>
                          <LoadNumbers count={load.lessons} minutesPerTime={paidMinutes} compact />
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-brand-soft p-3">
                  <strong>Total de {row.teacher.name} · {periodLabel}</strong>
                  <LoadNumbers count={row.total.lessons} minutesPerTime={paidMinutes} />
                </div>
              </div>
            </details>
          ))}
          {rows.length === 0 && <Card className="p-8 text-center text-muted">Nenhum professor corresponde a este recorte.</Card>}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {visibleClasses.map((schoolClass) => {
            const total = workload.classTotals.get(schoolClass.id)?.lessons ?? 0;
            const teachers = workload.rows.filter((row) => row.byClass.has(schoolClass.id));
            return (
              <details key={schoolClass.id} className="group overflow-hidden rounded-xl border border-line-strong bg-surface shadow-raise">
                <summary className="flex cursor-pointer list-none flex-wrap items-center gap-4 p-4 hover:bg-subtle">
                  <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" />
                  <div className="min-w-0 flex-1 basis-48"><h2 className="break-words font-bold">{className(schoolClass.id)}</h2>
                    <p className="mt-1 text-xs text-muted">{teachers.length} professores neste recorte · {SHIFT_LABEL[schoolClass.shift]}</p></div>
                  <LoadNumbers count={total} minutesPerTime={paidMinutes} />
                </summary>
                <div className="flex flex-col gap-3 border-t border-line bg-subtle/50 p-4">
                  {teachers.map((row) => (
                    <div key={row.teacher.id} className="rounded-lg border border-line bg-surface p-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <h3 className="font-semibold">{row.teacher.name}</h3>
                        <LoadNumbers count={(row.byClass.get(schoolClass.id)?.lessons ?? 0)} minutesPerTime={paidMinutes} compact />
                      </div>
                      <ul className="mt-2 divide-y divide-line">
                        {row.bySubject.filter((subject) => subject.byClass.has(schoolClass.id)).map((subject) => (
                          <li key={subject.subjectId ?? 'none'} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm text-ink-2">
                            <span>{subjectName(subject.subjectId)}</span>
                            <LoadNumbers count={(subject.byClass.get(schoolClass.id)?.lessons ?? 0)} minutesPerTime={paidMinutes} compact />
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-brand-soft p-3">
                    <strong>Total desta turma no recorte</strong><LoadNumbers count={total} minutesPerTime={paidMinutes} />
                  </div>
                </div>
              </details>
            );
          })}
          {visibleClasses.length === 0 && <Card className="p-8 text-center text-muted">Nenhuma turma corresponde a este recorte.</Card>}
        </div>
      )}
    </div>
  );
}

function LoadNumbers({ count, minutesPerTime, compact = false }: { count: number; minutesPerTime: number; compact?: boolean }) {
  return (
    <div className={`flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 tabular ${compact ? 'text-xs' : 'text-sm'}`}>
      <span><strong className="text-ink">{num(count)}</strong> tempos</span>
      <span><strong className="text-ink">{num(count * minutesPerTime)}</strong> min pagos</span>
      <span className="text-muted">{paidHours(count * minutesPerTime)}</span>
    </div>
  );
}

function Metric({ label, value, hint, accent = false }: { label: string; value: string; hint: string; accent?: boolean }) {
  return (
    <Card className={`p-4 ${accent ? 'bg-brand-soft' : ''}`}>
      <p className="text-sm font-semibold text-ink-2">{label}</p>
      <p className="mt-2 text-3xl font-extrabold tabular">{value}</p>
      <p className="mt-1 text-xs text-muted">{hint}</p>
    </Card>
  );
}
