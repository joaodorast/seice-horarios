import { useEffect } from 'react';
import { Clock, Coffee, Settings2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Link } from 'react-router';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import type { Period } from '@shared/types';

export function useScheduleDisplay() {
  const [showTimes, setShowTimes] = useLocalStorage('seice:show-times-default-visible', true);
  const [showBreaks, setShowBreaks] = useLocalStorage('seice:show-breaks', false);
  return { showTimes, setShowTimes, showBreaks, setShowBreaks };
}

export function displayPeriods(periods: Period[], showBreaks: boolean): Period[] {
  const counts = new Map<string, number>();
  return periods.map((period) => {
    if (period.kind !== 'aula') return period;
    const number = (counts.get(period.shift) ?? 0) + 1;
    counts.set(period.shift, number);
    return { ...period, label: `${number}º tempo` };
  }).filter((period) => showBreaks || period.kind === 'aula');
}

export function ScheduleDisplay({ allowConfigure = false }: { allowConfigure?: boolean }) {
  const { showTimes, setShowTimes, showBreaks, setShowBreaks } = useScheduleDisplay();
  useEffect(() => {
    window.dispatchEvent(new Event('seice:schedule-display'));
  }, [showTimes, showBreaks]);
  return (
    <div className="no-print flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface p-3 shadow-raise">
      <label className={cn("inline-flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors", showTimes ? "border-brand bg-brand-soft text-ink" : "border-line-strong bg-subtle text-ink-2")}>
        <Clock className="size-4" aria-hidden="true" />
        <input className="size-4 accent-yellow-500" type="checkbox" checked={showTimes} onChange={(event) => setShowTimes(event.target.checked)} />
        Mostrar horários
      </label>
      <label className={cn("inline-flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors", showBreaks ? "border-brand bg-brand-soft text-ink" : "border-line-strong bg-subtle text-ink-2")}>
        <Coffee className="size-4" aria-hidden="true" />
        <input className="size-4 accent-yellow-500" type="checkbox" checked={showBreaks} onChange={(event) => setShowBreaks(event.target.checked)} />
        Mostrar intervalos
      </label>
      {allowConfigure && (
        <Link className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-nav px-4 py-2.5 text-sm font-bold text-white shadow-raise hover:bg-ink-2" to="/configuracoes?aba=periodos">
          <Settings2 className="size-4" aria-hidden="true" /> Personalizar intervalos
        </Link>
      )}
    </div>
  );
}
