import { useState } from 'react';
import { Check } from 'lucide-react';
import { Alert, Button, Card, CardHeader, ConfirmDialog, Field, Input, useToast } from '@/components/ui';
import { useSaveSettings, type ScheduleData } from '@/api/hooks';
import { errorMessage } from '@/api/client';
import { settingsSchema } from '@shared/schemas';
import { SHIFT_LABEL, WEEKDAY_LABEL, shiftsOfClass } from '@shared/labels';
import { SHIFT_KEYS, WEEKDAYS, type Settings, type ShiftKey, type Weekday } from '@shared/types';
import { cn } from '@/lib/cn';
import { plural } from '@/lib/text';

export function CalendarSettings({ data }: { data: ScheduleData }) {
  const [draft, setDraft] = useState<Settings>(data.settings);
  const [duration, setDuration] = useState(String(data.settings.lessonDuration));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState<string[] | null>(null);
  const save = useSaveSettings();
  const toast = useToast();

  const dirty =
    draft.enabledDays.join() !== data.settings.enabledDays.join() ||
    draft.enabledShifts.join() !== data.settings.enabledShifts.join() ||
    duration !== String(data.settings.lessonDuration);

  const toggleDay = (d: Weekday) =>
    setDraft((s) => ({ ...s, enabledDays: s.enabledDays.includes(d) ? s.enabledDays.filter((x) => x !== d) : [...s.enabledDays, d].sort() }));
  const toggleShift = (k: ShiftKey) =>
    setDraft((s) => ({
      ...s,
      enabledShifts: s.enabledShifts.includes(k) ? s.enabledShifts.filter((x) => x !== k) : SHIFT_KEYS.filter((x) => x === k || s.enabledShifts.includes(x)),
    }));

  function consequences(): string[] {
    const out: string[] = [];
    for (const d of data.settings.enabledDays.filter((d) => !draft.enabledDays.includes(d))) {
      const n = data.lessons.filter((l) => l.weekday === d).length;
      if (n) out.push(`${plural(n, 'aula', 'aulas')} de ${WEEKDAY_LABEL[d].toLowerCase()} deixarão de aparecer nas grades e ficarão na lista "Fora da grade".`);
    }
    for (const k of data.settings.enabledShifts.filter((k) => !draft.enabledShifts.includes(k))) {
      const classes = data.classes.filter((c) => c.active && shiftsOfClass(c.shift).includes(k)).length;
      if (classes)
        out.push(`${plural(classes, 'turma ativa usa', 'turmas ativas usam')} o turno ${SHIFT_LABEL[k].toLowerCase()}; ele deixará de ser exibido no quadro geral e nas pendências.`);
    }
    return out;
  }

  function submit() {
    const parsed = settingsSchema.safeParse({ ...draft, lessonDuration: duration });
    if (!parsed.success) {
      const e: Record<string, string> = {};
      for (const i of parsed.error.issues) e[String(i.path[0])] ??= i.message;
      setErrors(e);
      return;
    }
    setErrors({});
    const c = consequences();
    if (c.length) setConfirm(c);
    else void persist();
  }

  async function persist() {
    try {
      const parsed = settingsSchema.parse({ ...draft, lessonDuration: duration });
      const saved = await save.mutateAsync(parsed);
      setDraft(saved);
      setConfirm(null);
      toast.success('Configurações salvas');
    } catch (error) {
      toast.error('Não foi possível salvar', errorMessage(error));
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader title="Dias letivos" description="Dias da semana exibidos nas grades e disponíveis para novas aulas." />
        <div className="flex flex-wrap gap-2 px-5 pb-5">
          {WEEKDAYS.map((d) => (
            <ToggleChip key={d} checked={draft.enabledDays.includes(d)} onChange={() => toggleDay(d)}>
              {WEEKDAY_LABEL[d]}
            </ToggleChip>
          ))}
        </div>
        {errors.enabledDays && <p className="px-5 pb-5 text-[13px] font-medium text-danger">{errors.enabledDays}</p>}
      </Card>

      <Card>
        <CardHeader title="Turnos em funcionamento" description="Turnos que aparecem no quadro geral. Os horários de cada turno são definidos na aba Horários dos turnos." />
        <div className="flex flex-wrap gap-2 px-5 pb-5">
          {SHIFT_KEYS.map((k) => (
            <ToggleChip key={k} checked={draft.enabledShifts.includes(k)} onChange={() => toggleShift(k)}>
              {SHIFT_LABEL[k]}
            </ToggleChip>
          ))}
        </div>
        {errors.enabledShifts && <p className="px-5 pb-5 text-[13px] font-medium text-danger">{errors.enabledShifts}</p>}
        <p className="border-t border-line px-5 py-3 text-xs text-muted">Turmas em período integral utilizam os horários da manhã e da tarde.</p>
      </Card>

      <Card>
        <CardHeader title="Duração padrão da aula" description="Usada como sugestão ao adicionar ou gerar períodos." />
        <div className="max-w-[220px] px-5 pb-5">
          <Field label="Minutos" error={errors.lessonDuration}>
            <Input type="number" inputMode="numeric" min={20} max={180} step={5} value={duration} onChange={(e) => setDuration(e.target.value)} className="tabular" />
          </Field>
        </div>
      </Card>

      <div className="sticky bottom-0 z-10 -mx-4 flex items-center justify-end gap-3 border-t border-line bg-canvas/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border sm:bg-surface">
        {dirty && <span className="mr-auto text-[13px] font-medium text-warning">Há alterações não salvas</span>}
        <Button
          disabled={!dirty || save.isPending}
          onClick={() => {
            setDraft(data.settings);
            setDuration(String(data.settings.lessonDuration));
            setErrors({});
          }}
        >
          Descartar
        </Button>
        <Button variant="primary" disabled={!dirty} loading={save.isPending} onClick={submit}>
          Salvar configurações
        </Button>
      </div>

      <ConfirmDialog
        open={confirm !== null}
        tone="primary"
        title="Confirmar alterações no calendário?"
        confirmLabel="Salvar mesmo assim"
        loading={save.isPending}
        onClose={() => setConfirm(null)}
        onConfirm={() => void persist()}
      >
        <ul className="list-disc space-y-1.5 pl-5">{confirm?.map((c) => <li key={c}>{c}</li>)}</ul>
        <Alert tone="info">Nenhuma aula será excluída. Reativando o dia ou o turno, tudo volta a aparecer como antes.</Alert>
      </ConfirmDialog>
    </div>
  );
}

function ToggleChip({ checked, onChange, children }: { checked: boolean; onChange: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onChange}
      className={cn(
        'inline-flex h-10 items-center gap-2 rounded-md border px-3.5 text-sm font-semibold transition-colors duration-150',
        checked ? 'border-ink bg-ink text-white' : 'border-line-strong bg-surface text-ink-2 hover:border-soft hover:bg-subtle',
      )}
    >
      <span
        className={cn('grid size-4 place-items-center rounded-[4px] border', checked ? 'border-brand bg-brand text-ink' : 'border-line-strong')}
        aria-hidden="true"
      >
        {checked && <Check className="size-3" strokeWidth={3} />}
      </span>
      {children}
    </button>
  );
}
