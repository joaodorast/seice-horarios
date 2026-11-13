import { useEffect } from 'react';
import { Link } from 'react-router';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import type { Period } from '@shared/types';

export function useScheduleDisplay() {
  const [showTimes, setShowTimes] = useLocalStorage('seice:show-times', false);
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
    <div className="no-print flex flex-wrap items-center gap-4 text-sm">
      <label className="inline-flex items-center gap-2">
        <input type="checkbox" checked={showTimes} onChange={(event) => setShowTimes(event.target.checked)} />
        Mostrar horários
      </label>
      <label className="inline-flex items-center gap-2">
        <input type="checkbox" checked={showBreaks} onChange={(event) => setShowBreaks(event.target.checked)} />
        Mostrar intervalos
      </label>
      {allowConfigure && (
        <Link className="font-semibold underline" to="/configuracoes?aba=periodos">
          Personalizar intervalos
        </Link>
      )}
    </div>
  );
}
