import { useMemo, useState } from 'react';
import { AlertTriangle, CalendarCheck, Plus, Save, Undo2, X } from 'lucide-react';
import { Alert, Button, Card, useToast } from '@/components/ui';
import { useSaveAvailability, type ScheduleData } from '@/api/hooks';
import { errorMessage } from '@/api/client';
import { lessonsOutsideAvailability, rangesText } from '@shared/availability';
import { SHIFT_LABEL, WEEKDAY_LABEL } from '@shared/labels';
import { toMinutes } from '@shared/time';
import { SHIFT_KEYS, type AvailabilitySlot, type ShiftKey, type Teacher, type Weekday } from '@shared/types';
import { plural } from '@/lib/text';
import { cn } from '@/lib/cn';

type Range = { start: string; end: string };
type Draft = Map<Weekday, Range[]>;

const toDraft = (slots: AvailabilitySlot[], days: Weekday[]): Draft =>
  new Map(days.map((d) => [d, slots.filter((s) => s.weekday === d).map(({ start, end }) => ({ start, end }))]));
const toSlots = (draft: Draft): AvailabilitySlot[] => [...draft].flatMap(([weekday, ranges]) => ranges.map((r) => ({ weekday, ...r })));
const sameRanges = (a: Range[], b: Range[]) => a.length === b.length && a.every((r, i) => r.start === b[i].start && r.end === b[i].end);

/**
 * Dias e horários em que o professor está na escola. O sistema não deixa colocar aulas fora deles
 * (no lançamento, no Montar quadro e na importação). Sem nada informado, vale qualquer horário.
 */
export function TeacherAvailability({ teacher, data }: { teacher: Teacher; data: ScheduleData }) {
  const days = data.settings.enabledDays;
  const save = useSaveAvailability();
  const toast = useToast();
  const informed = teacher.availability.length > 0;

  // Atalhos: o início e o fim de cada turno habilitado, a partir dos horários configurados.
  const shiftRanges = useMemo(() => {
    const out: { shift: ShiftKey; range: Range }[] = [];
    for (const shift of SHIFT_KEYS.filter((s) => data.settings.enabledShifts.includes(s))) {
      const ps = data.periods.filter((p) => p.shift === shift);
      if (!ps.length) continue;
      out.push({ shift, range: { start: ps.map((p) => p.start).sort()[0], end: ps.map((p) => p.end).sort().at(-1)! } });
    }
    return out;
  }, [data.periods, data.settings.enabledShifts]);
  const fullDay: Range | null = shiftRanges.length ? { start: shiftRanges[0].range.start, end: shiftRanges.at(-1)!.range.end } : null;

  const initial = useMemo(
    () => (informed ? toDraft(teacher.availability, days) : new Map(days.map((d) => [d, fullDay ? [fullDay] : []] as [Weekday, Range[]]))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [teacher.availability, days.join(), fullDay?.start, fullDay?.end],
  );
  const [draft, setDraft] = useState<Draft | null>(null);
  const current = draft ?? initial;
  const dirty = draft !== null && [...draft].some(([d, r]) => !sameRanges(r, initial.get(d) ?? []));
  const invalid = [...current.values()].flat().some((r) => !r.start || !r.end || r.end <= r.start);

  const setDay = (d: Weekday, ranges: Range[]) => setDraft(new Map(current).set(d, ranges));
  const outside = lessonsOutsideAvailability({ id: teacher.id, availability: toSlots(current) }, data.lessons);

  // Escala da linha do tempo: do primeiro ao último horário configurado.
  const scaleStart = toMinutes(fullDay?.start ?? '07:00');
  const scaleEnd = toMinutes(fullDay?.end ?? '18:00');
  const pos = (t: string) => `${Math.max(0, Math.min(100, ((toMinutes(t) - scaleStart) / Math.max(1, scaleEnd - scaleStart)) * 100))}%`;

  async function confirm(slots: AvailabilitySlot[]) {
    try {
      await save.mutateAsync({ id: teacher.id, input: { slots } });
      setDraft(null);
      toast.success('Dias e horários salvos', slots.length ? `${teacher.name} só recebe aulas nesses horários.` : `${teacher.name} pode receber aulas em qualquer horário.`);
    } catch (error) {
      toast.error('Não foi possível salvar', errorMessage(error));
    }
  }

  const chip = (active: boolean) =>
    cn(
      'inline-flex h-8 items-center rounded-full px-3 text-[13px] font-semibold ring-1 ring-inset transition-colors',
      active ? 'bg-nav text-white ring-nav' : 'bg-surface text-ink ring-line-strong hover:ring-ink',
    );

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-start gap-3 border-b border-line px-5 py-4">
        <CalendarCheck className="mt-0.5 size-5 shrink-0 text-ink" />
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold text-ink">Dias e horários na escola</h2>
          <p className="mt-0.5 text-[14px] text-ink-2">
            Marque quando {teacher.name.split(' ')[0]} está na escola. O sistema <strong className="text-ink">não deixa colocar aulas fora desses horários</strong> — nem no
            lançamento, nem no Montar quadro, nem na importação.
          </p>
        </div>
        {!informed && !dirty && (
          <span className="rounded-full bg-warning-soft px-3 py-1 text-[12.5px] font-bold text-warning ring-1 ring-warning/30">Ainda não informado: vale qualquer horário</span>
        )}
      </div>

      <ul className="divide-y divide-line">
        {days.map((d) => {
          const ranges = current.get(d) ?? [];
          const presetActive = (r: Range | null) => Boolean(r) && ranges.length === 1 && sameRanges(ranges, [r!]);
          const off = ranges.length === 0;
          const custom = !off && !presetActive(fullDay) && !shiftRanges.some((s) => presetActive(s.range));
          return (
            <li key={d} className="grid gap-3 px-5 py-3.5 lg:grid-cols-[150px_minmax(0,1fr)_minmax(220px,0.8fr)] lg:items-center">
              <span className={cn('text-[15px] font-bold', off ? 'text-ink-2' : 'text-ink')}>{WEEKDAY_LABEL[d]}</span>

              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap gap-1.5" role="group" aria-label={`${WEEKDAY_LABEL[d]}: quando está na escola`}>
                  <button type="button" className={chip(off)} aria-pressed={off} onClick={() => setDay(d, [])}>
                    Não vem
                  </button>
                  {shiftRanges.map((s) => (
                    <button key={s.shift} type="button" className={chip(presetActive(s.range))} aria-pressed={presetActive(s.range)} onClick={() => setDay(d, [s.range])}>
                      {SHIFT_LABEL[s.shift]}
                    </button>
                  ))}
                  {fullDay && shiftRanges.length > 1 && (
                    <button type="button" className={chip(presetActive(fullDay))} aria-pressed={presetActive(fullDay)} onClick={() => setDay(d, [fullDay])}>
                      Dia todo
                    </button>
                  )}
                  {custom && <span className={chip(true)}>Personalizado</span>}
                </div>
                {!off && (
                  <div className="flex flex-wrap items-center gap-2">
                    {ranges.map((r, i) => (
                      <span key={i} className="inline-flex items-center gap-1.5 rounded-lg bg-subtle px-2 py-1 ring-1 ring-line">
                        <TimeInput label={`${WEEKDAY_LABEL[d]}: chegada`} value={r.start} onChange={(v) => setDay(d, ranges.map((x, k) => (k === i ? { ...x, start: v } : x)))} />
                        <span className="text-[13px] font-semibold text-ink-2">às</span>
                        <TimeInput label={`${WEEKDAY_LABEL[d]}: saída`} value={r.end} onChange={(v) => setDay(d, ranges.map((x, k) => (k === i ? { ...x, end: v } : x)))} />
                        <button
                          type="button"
                          aria-label="Tirar este intervalo"
                          className="grid size-7 place-items-center rounded-md text-ink-2 hover:bg-danger-soft hover:text-danger"
                          onClick={() => setDay(d, ranges.filter((_, k) => k !== i))}
                        >
                          <X className="size-4" />
                        </button>
                      </span>
                    ))}
                    {ranges.length < 3 && (
                      <button
                        type="button"
                        className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[13px] font-semibold text-ink-2 hover:bg-subtle hover:text-ink"
                        onClick={() => setDay(d, [...ranges, { start: ranges.at(-1)?.end ?? fullDay?.start ?? '07:00', end: fullDay?.end ?? '12:00' }])}
                      >
                        <Plus className="size-4" /> outro intervalo
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Linha do tempo do dia: verde onde está na escola. */}
              <div aria-hidden="true">
                <div className="relative h-7 overflow-hidden rounded-md bg-subtle ring-1 ring-line">
                  {ranges
                    .filter((r) => r.start && r.end && r.end > r.start)
                    .map((r, i) => (
                      <span
                        key={i}
                        className="absolute inset-y-0 rounded-[5px] bg-success/80"
                        style={{ left: pos(r.start), width: `calc(${pos(r.end)} - ${pos(r.start)})` }}
                      />
                    ))}
                  {off && <span className="absolute inset-0 grid place-items-center text-[12px] font-semibold text-ink-2">não vem</span>}
                </div>
                <div className="mt-0.5 flex justify-between text-[11px] font-semibold text-ink-2 tabular">
                  <span>{fullDay?.start}</span>
                  <span>{off ? '' : rangesText(ranges.filter((r) => r.start && r.end))}</span>
                  <span>{fullDay?.end}</span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {(dirty || outside.length > 0) && (
        <div className="flex flex-col gap-3 border-t border-line bg-subtle/60 px-5 py-4">
          {outside.length > 0 && (
            <Alert tone="warning" title={`${plural(outside.length, 'aula já lançada fica', 'aulas já lançadas ficam')} fora desses horários`}>
              {outside
                .slice(0, 4)
                .map((l) => `${WEEKDAY_LABEL[l.weekday]} ${l.start} (${data.classes.find((c) => c.id === l.classId)?.name ?? ''})`)
                .join(' · ')}
              {outside.length > 4 ? '…' : ''}. Elas continuam no quadro e aparecem como pendência no Dashboard até você mudar de horário ou de professor.
            </Alert>
          )}
          {dirty && (
            <div className="flex flex-wrap items-center gap-2">
              {invalid && (
                <span className="mr-auto inline-flex items-center gap-1.5 text-[13px] font-bold text-danger">
                  <AlertTriangle className="size-4" /> Confira os horários: a saída precisa ser depois da chegada.
                </span>
              )}
              <Button className={invalid ? '' : 'ml-auto'} icon={<Undo2 className="size-4" />} onClick={() => setDraft(null)} disabled={save.isPending}>
                Descartar
              </Button>
              <Button variant="primary" icon={<Save className="size-4" />} loading={save.isPending} disabled={invalid} onClick={() => void confirm(toSlots(current))}>
                Salvar dias e horários
              </Button>
            </div>
          )}
        </div>
      )}

      {informed && !dirty && (
        <div className="border-t border-line px-5 py-3 text-right">
          <button type="button" className="text-[13px] font-semibold text-ink-2 underline-offset-2 hover:text-ink hover:underline" onClick={() => void confirm([])}>
            Apagar e liberar qualquer horário
          </button>
        </div>
      )}
    </Card>
  );
}

function TimeInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="time"
      step={300}
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="tabular h-8 w-[92px] rounded-md border border-line-strong bg-surface px-2 text-[14px] font-semibold text-ink outline-none focus:border-ink focus:ring-2 focus:ring-brand/50"
    />
  );
}
