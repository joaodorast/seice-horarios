import { useEffect, useState } from 'react';
import { Button, Card, Input, useToast } from '@/components/ui';
import { useUnits } from '@/api/units';
import { useSaveTeacherPayroll, type ScheduleData } from '@/api/hooks';
import { errorMessage } from '@/api/client';
import type { Teacher, TeacherPayrollProfile } from '@shared/types';
import { SEGMENT_KEYS, SEGMENT_LABEL, type SegmentKey } from '@shared/segments';
import { academicClassSegment } from '@shared/academicRules';
import { computePayrollWorkload, regencyWeeklyMinutes } from '@shared/payroll';
import { formatHours } from '@/lib/format';
import { WEEKDAY_SHORT } from '@shared/labels';

type Props = {
  teacher: Teacher;
  data: ScheduleData;
  onDirtyChange: (dirty: boolean) => void;
  onBusyChange: (busy: boolean) => void;
  onRequestChange: (action: () => void) => void;
  onOpenDetails: () => void;
};

export function QuickPayrollSettings(props: Props) {
  const {data: units = []} = useUnits();
  const available = units.filter((unit) => props.teacher.unitIds?.includes(unit.id) || props.teacher.unitId === unit.id);
  const [chosenUnit, setChosenUnit] = useState<number | null>(null);
  const unit = available.find((unit) => unit.id === chosenUnit) ?? available[0];
  return <Card className="border-2 border-line-strong p-4 sm:p-5">
    <h2 className="text-xl font-bold">Alterar carga horária</h2>
    <p className="mt-1 text-lg font-semibold">{props.teacher.name}</p>
    {available.length > 1 && <label className="mt-3 block font-semibold">Unidade
      <select className="mt-1 h-11 w-full rounded border border-line-strong px-3" value={unit?.id ?? ''}
      onChange={(event) => {const value = Number(event.target.value); props.onRequestChange(() => setChosenUnit(value));}}>
        {available.map((unit) => <option key={unit.id} value={unit.id}>{unit.code} — {unit.name}</option>)}
      </select>
    </label>}
    {unit && <QuickPayrollForm key={`${unit.id}-${props.teacher.updatedAt}`} {...props} unitId={unit.id} />}
    <Button className="mt-4" onClick={props.onOpenDetails}>Configuração completa · turma, segmento e dias</Button>
  </Card>;
}

function QuickPayrollForm({teacher, data, unitId, onDirtyChange, onBusyChange, onRequestChange}: Props & {unitId: number}) {
  const profile: TeacherPayrollProfile = teacher.payrollProfiles?.find((profile) => profile.unitId === unitId) ?? {unitId, references: [], regencies: []};
  const classes = data.classes.filter((schoolClass) => schoolClass.unitId === unitId && schoolClass.active);
  const [classId, setClassId] = useState(profile.regencies[0]?.classId ?? 0);
  const saved = profile.regencies.find((regency) => regency.classId === classId);
  const schoolClass = classes.find((schoolClass) => schoolClass.id === classId);
  const initialMinutes = saved ? regencyWeeklyMinutes(saved) : profile.defaultWeeklyMinutes ?? 1350;
  const initialSegment = saved?.segment ?? profile.defaultRegencySegment ?? (schoolClass && academicClassSegment(schoolClass)) ?? 'fund1';
  const [editing, setEditing] = useState(false);
  const [fixed, setFixed] = useState(saved ? saved.enabled !== false : false);
  const [hours, setHours] = useState(Math.floor(initialMinutes / 60));
  const [minutes, setMinutes] = useState(initialMinutes % 60);
  const [segment, setSegment] = useState<SegmentKey>(initialSegment);
  const save = useSaveTeacherPayroll();
  const toast = useToast();
  const totalMinutes = hours * 60 + minutes;
  const valid = Number.isInteger(hours) && hours >= 0 && Number.isInteger(minutes) && minutes >= 0 && minutes < 60 && totalMinutes > 0 && totalMinutes <= 10080;
  const wasFixed = saved ? saved.enabled !== false : false;
  const dirty = fixed !== wasFixed || (fixed && (totalMinutes !== initialMinutes || segment !== initialSegment));
  useEffect(() => {onDirtyChange(dirty);}, [dirty, onDirtyChange]);
  useEffect(() => {onBusyChange(save.isPending);}, [save.isPending, onBusyChange]);
  useEffect(() => () => {onDirtyChange(false); onBusyChange(false);}, [onDirtyChange, onBusyChange]);

  const workload = computePayrollWorkload(data.lessons, [teacher], classes, data.subjects, data.periods, data.settings,
    {scope: 'semana', day: 1, month: new Date().toISOString().slice(0,7)});
  const payroll = workload.rows[0]?.payroll;
  const currentLabel = payroll?.regencyMinutes ? (payroll.regularMinutes + payroll.technicalMinutes > 0 ? 'Carga fixa + grade' : 'Carga fixa') : 'Pela grade';

  function resetValues(nextClassId = classId, preserveMode = false) {
    const entry = profile.regencies.find((regency) => regency.classId === nextClassId);
    const nextClass = classes.find((schoolClass) => schoolClass.id === nextClassId);
    const nextSegment = entry?.segment ?? (nextClass && academicClassSegment(nextClass)) ?? profile.defaultRegencySegment ?? 'fund1';
    const value = entry ? regencyWeeklyMinutes(entry) : profile.defaultWeeklyMinutes ?? (nextSegment === 'infantil' ? 1200 : 1350);
    setClassId(nextClassId);
    setFixed(entry ? entry.enabled !== false : preserveMode ? fixed : false);
    setHours(Math.floor(value / 60));
    setMinutes(value % 60);
    setSegment(nextSegment);
  }

  async function saveChanges() {
    if (save.isPending || !dirty) return;
    if (fixed && (!classId || !valid)) {
      toast.error('Confira a carga', 'Escolha a turma e informe horas e minutos válidos.');
      return;
    }
    const regencies = [...profile.regencies];
    if (saved) {
      const index = regencies.indexOf(saved);
      regencies[index] = fixed ? {...saved, enabled: true, weeklyMinutes: totalMinutes, segment} : {...saved, enabled: false};
    } else if (fixed) {
      regencies.push({classId, segment, weeklyMinutes: totalMinutes, enabled: true, weekdays: [...data.settings.enabledDays]});
    }
    try {
      await save.mutateAsync({id: teacher.id, input: {...profile, regencies}});
      toast.success('Carga horária atualizada');
      setEditing(false);
    } catch (error) {
      toast.error('Não foi possível salvar', errorMessage(error));
    }
  }

  return <div className="mt-4 space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-brand-soft p-4">
      <div><p className="text-sm font-semibold">Carga atual na unidade</p><p className="text-xl font-bold">{currentLabel} · {formatHours(workload.grand.minutes)} por semana</p></div>
      {!editing && <Button variant="primary" size="lg" onClick={() => setEditing(true)}>Alterar carga horária</Button>}
    </div>
    {editing && <fieldset disabled={save.isPending} className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button aria-pressed={!fixed} variant={!fixed ? 'primary' : 'secondary'} onClick={() => setFixed(false)}>De acordo com a grade</Button>
        <Button aria-pressed={fixed} variant={fixed ? 'primary' : 'secondary'} onClick={() => setFixed(true)}>Horário fixo</Button>
      </div>
      <label className="block font-semibold">Turma para alterar
        <select className="mt-1 h-11 w-full rounded border border-line-strong px-3" value={classId}
          onChange={(event) => {const value = Number(event.target.value); if (!classId) resetValues(value, true); else onRequestChange(() => resetValues(value, true));}}>
          <option value={0}>Escolha a turma</option>
          {classes.map((schoolClass) => <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name}</option>)}
          {saved && !schoolClass && <option value={saved.classId}>Turma {saved.classId}</option>}
        </select>
      </label>
      {fixed ? <>
        <div className="grid grid-cols-2 gap-3">
          <label className="font-semibold">Horas por semana<Input type="number" min={0} max={168} value={hours} onChange={(event) => setHours(Number(event.target.value))} /></label>
          <label className="font-semibold">Minutos<Input type="number" min={0} max={59} value={minutes} onChange={(event) => setMinutes(Number(event.target.value))} /></label>
        </div>
        <details className="rounded border border-line p-3"><summary className="cursor-pointer font-semibold">Conferir segmento e dias</summary>
          <label className="mt-3 block font-semibold">Segmento<select className="mt-1 h-11 w-full rounded border border-line-strong px-3" value={segment} onChange={(event) => setSegment(event.target.value as SegmentKey)}>
            {SEGMENT_KEYS.map((segment) => <option key={segment} value={segment}>{SEGMENT_LABEL[segment]}</option>)}
          </select></label>
          <p className="mt-2 text-sm">Dias de regência: {(saved?.weekdays ?? data.settings.enabledDays).map((day) => WEEKDAY_SHORT[day]).join(', ')}. A carga semanal é distribuída nesses dias.</p>
        </details>
      </> : <p className="text-sm text-muted">As horas desta turma serão calculadas pelos tempos cadastrados na grade.</p>}
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" loading={save.isPending} disabled={!dirty || (fixed && (!valid || !classId))} onClick={saveChanges}>Salvar alteração</Button>
        <Button onClick={() => onRequestChange(() => {resetValues(); setEditing(false);})}>Cancelar</Button>
      </div>
    </fieldset>}
  </div>;
}
