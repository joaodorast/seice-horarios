import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button, ConfirmDialog, Input, useToast } from '@/components/ui';
import { request, errorMessage } from '@/api/client';
import { keys, type ScheduleData } from '@/api/hooks';
import { useUnits } from '@/api/units';
import { formatHours } from '@/lib/format';

export function BatchFixedHours({data, disabled, onBusyChange}: {data: ScheduleData; disabled: boolean; onBusyChange: (busy: boolean) => void}) {
  const {data: units = []} = useUnits();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [unitId, setUnitId] = useState(0);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [hours, setHours] = useState(22);
  const [minutes, setMinutes] = useState(30);
  const [search, setSearch] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const weeklyMinutes = hours * 60 + minutes;
  const valid = Number.isInteger(hours) && hours >= 0 && Number.isInteger(minutes) && minutes >= 0 && minutes < 60 && weeklyMinutes > 0 && weeklyMinutes <= 10080;
  const teachers = data.teachers.filter((teacher) => (teacher.unitIds ?? [teacher.unitId]).includes(unitId));
  const selected = teachers.filter((teacher) => selectedIds.includes(teacher.id));
  const fold = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const visible = teachers.filter((teacher) => fold(teacher.name).includes(fold(search)));

  async function applyHours() {
    if (!valid || !selected.length || saving || disabled) return;
    setSaving(true);
    onBusyChange(true);
    try {
      const result = await request<{updated: number}>('PUT', '/teachers/payroll-hours/batch', {unitId, teacherIds: selected.map((teacher) => teacher.id), weeklyMinutes});
      await queryClient.invalidateQueries({queryKey: keys.teachers});
      toast.success(`Carga fixa atualizada para ${result.updated} professores`);
      setConfirming(false);
      setSelectedIds([]);
    } catch (error) {
      toast.error('Não foi possível aplicar a carga', errorMessage(error));
    } finally {
      setSaving(false);
      onBusyChange(false);
    }
  }

  return <details className="rounded-xl border border-line-strong bg-subtle p-4">
    <summary className="cursor-pointer text-lg font-bold">Aplicar a mesma carga fixa a vários professores</summary>
    <p className="mt-3 text-sm text-muted">Escolha a unidade e os professores. O valor será aplicado às regências dessa unidade e ficará pré-definido para adicionar novas regências. O modo de contagem de cada turma é preservado.</p>
    <fieldset disabled={disabled || saving} className="mt-4 space-y-4">
      <label className="block text-sm font-semibold">Unidade<select className="mt-1 h-12 w-full rounded border border-line-strong px-3" value={unitId} onChange={(event) => {setUnitId(Number(event.target.value)); setSelectedIds([]);}}>
        <option value={0}>Escolha a unidade</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.code} — {unit.name}</option>)}
      </select></label>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm font-semibold">Horas fixas por semana<Input type="number" min={0} max={168} value={hours} onChange={(event) => setHours(Number(event.target.value))} /></label>
        <label className="text-sm font-semibold">Minutos adicionais<Input type="number" min={0} max={59} value={minutes} onChange={(event) => setMinutes(Number(event.target.value))} /></label>
      </div>
      {unitId > 0 && <>
        <Input aria-label="Pesquisar professores para carga em lote" placeholder="Pesquisar professor" value={search} onChange={(event) => setSearch(event.target.value)} />
        <p className="text-sm">{selected.length} professores selecionados</p>
        <div className="max-h-72 space-y-2 overflow-auto rounded border border-line bg-surface p-3">
          {visible.map((teacher) => <label key={teacher.id} className="flex items-start gap-3 rounded border border-line p-3">
            <input type="checkbox" className="mt-1 size-5" checked={selectedIds.includes(teacher.id)} onChange={(event) => setSelectedIds((ids) => event.target.checked ? [...ids, teacher.id] : ids.filter((id) => id !== teacher.id))} />
            <span><strong>{teacher.name}</strong><span className="mt-1 block text-sm text-muted">{teacher.payrollProfiles?.find((profile) => profile.unitId === unitId)?.regencies.map((regency) => `${data.classes.find((schoolClass) => schoolClass.id === regency.classId)?.name ?? 'Turma'} (${regency.enabled === false ? 'pela grade' : 'fixa'})`).join(' · ')||'Carga pré-definida para futuras regências'}</span></span>
          </label>)}
          {!visible.length && <p className="text-sm text-muted">Nenhum professor encontrado nesta unidade.</p>}
        </div>
      </>}
      <Button variant="primary" disabled={!valid || !selected.length} onClick={() => setConfirming(true)}>Conferir e aplicar a carga</Button>
    </fieldset>
    <ConfirmDialog open={confirming} title="Aplicar a mesma carga fixa?" confirmLabel="Aplicar horas e minutos" loading={saving} tone="primary" onClose={() => {if (!saving) setConfirming(false);}} onConfirm={applyHours}>
      <p>{formatHours(weeklyMinutes)} por semana para cada turma de regência dos {selected.length} professores selecionados nesta unidade. Turmas em contagem pela grade continuam nesse modo, com o valor fixo guardado.</p>
      <ul className="mt-3 max-h-48 list-inside list-disc overflow-auto">{selected.map((teacher) => <li key={teacher.id}>{teacher.name}</li>)}</ul>
    </ConfirmDialog>
  </details>;
}
