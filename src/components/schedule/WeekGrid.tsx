import { Fragment, useMemo, useState } from 'react';
import { Coffee, Plus } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Segmented } from '@/components/ui';
import { lessonsInPeriod } from '@shared/grid';
import { SHIFT_LABEL, WEEKDAY_LABEL, WEEKDAY_SHORT } from '@shared/labels';
import type { Lesson, Period, Weekday } from '@shared/types';
import type { ScheduleIndex } from '@/hooks/useScheduleIndex';
import { LessonChip, type ChipPerspective } from './LessonChip';

interface WeekGridProps {
  periods: Period[];
  days: Weekday[];
  lessons: Lesson[];
  index: ScheduleIndex;
  perspective: ChipPerspective;
  onCreate?: (day: Weekday, period: Period) => void;
  onOpen?: (lesson: Lesson) => void;
  caption: string;
}

const todayWeekday = (): Weekday | null => {
  const d = new Date().getDay();
  return d >= 1 && d <= 6 ? (d as Weekday) : null;
};

/**
 * Grade semanal: dias nas colunas e períodos nas linhas.
 * Em telas estreitas, troca para uma visão por dia, mantendo todas as informações legíveis.
 */
export function WeekGrid({ periods, days, lessons, index, perspective, onCreate, onOpen, caption }: WeekGridProps) {
  const today = todayWeekday();
  const [mobileDay, setMobileDay] = useState<Weekday>(() => (today && days.includes(today) ? today : days[0] ?? 1));
  const activeMobileDay = days.includes(mobileDay) ? mobileDay : days[0];
  const multiShift = new Set(periods.map((p) => p.shift)).size > 1;

  const countByDay = useMemo(() => {
    const m = new Map<Weekday, number>();
    for (const d of days) m.set(d, lessons.filter((l) => l.weekday === d).length);
    return m;
  }, [lessons, days]);

  return (
    <>
      {/* Desktop e tablet largo */}
      <div className="hidden overflow-x-auto rounded-xl bg-surface shadow-raise ring-1 ring-line-strong scrollbar-thin md:block">
        <table className="w-full min-w-[720px] table-fixed border-separate border-spacing-0">
          <caption className="sr-only">{caption}</caption>
          <colgroup>
            <col className="w-[120px]" />
            {days.map((d) => (
              <col key={d} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 z-10 bg-nav px-4 py-3 text-left text-xs font-bold tracking-wide text-nav-text uppercase">
                Horário
              </th>
              {days.map((d) => (
                <th
                  key={d}
                  scope="col"
                  className={cn('border-l border-nav-line px-3 py-3 text-left', d === today ? 'bg-brand text-ink' : 'bg-nav text-white')}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-[14px] font-bold">
                      <span className="xl:hidden">{WEEKDAY_SHORT[d]}</span>
                      <span className="hidden xl:inline">{WEEKDAY_LABEL[d]}</span>
                    </span>
                    <span className={cn('tabular rounded-full px-1.5 text-xs font-bold', d === today ? 'bg-ink/10' : 'bg-white/10 text-nav-text')} title="Aulas no dia">
                      {countByDay.get(d) ?? 0}
                    </span>
                  </span>
                  {d === today && <span className="mt-0.5 block text-[11px] font-bold">Hoje</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {periods.map((period, i) => {
              const showShift = multiShift && (i === 0 || periods[i - 1].shift !== period.shift);
              return (
                <Fragment key={period.id}>
                  {showShift && (
                    <tr>
                      <th
                        colSpan={days.length + 1}
                        scope="colgroup"
                        className="border-y border-line-strong bg-ink-2 px-4 py-2 text-left text-xs font-bold tracking-wide text-white uppercase"
                      >
                        {SHIFT_LABEL[period.shift]}
                      </th>
                    </tr>
                  )}
                  {period.kind === 'intervalo' ? (
                    <tr>
                      <th scope="row" className="sticky left-0 z-10 border-b border-line-strong bg-canvas px-4 py-2 text-left">
                        <span className="tabular block text-xs font-bold text-ink-2">
                          {period.start}–{period.end}
                        </span>
                      </th>
                      <td
                        colSpan={days.length}
                        className="border-b border-l border-line-strong bg-canvas bg-[repeating-linear-gradient(135deg,transparent_0_8px,rgb(29_32_37/0.05)_8px_16px)] px-3 py-2"
                      >
                        <span className="inline-flex items-center gap-2 text-xs font-bold text-ink-2">
                          <Coffee className="size-3.5" aria-hidden="true" />
                          {period.label}
                        </span>
                      </td>
                    </tr>
                  ) : (
                    <tr>
                      <th scope="row" className="sticky left-0 z-10 border-b border-line-strong bg-subtle px-4 py-3 text-left align-top">
                        <span className="block text-[14px] font-bold text-ink">{period.label}</span>
                        <span className="tabular block text-xs font-semibold text-ink-2">
                          {period.start}–{period.end}
                        </span>
                      </th>
                      {days.map((d) => {
                        const cellLessons = lessonsInPeriod(lessons, d, period);
                        return (
                          <td
                            key={d}
                            className={cn('h-[78px] border-b border-l border-line-strong p-1.5 align-top', d === today ? 'bg-brand-soft/40' : 'bg-subtle/70')}
                          >
                            <div className="flex h-full flex-col gap-1">
                              {cellLessons.map((l) => (
                                <LessonChip key={l.id} lesson={l} index={index} perspective={perspective} period={period} onClick={onOpen} />
                              ))}
                              {cellLessons.length === 0 && onCreate && (
                                <EmptySlot label={`Adicionar aula: ${WEEKDAY_LABEL[d]}, ${period.label}`} onClick={() => onCreate(d, period)} />
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Celular: um dia por vez */}
      <div className="md:hidden">
        <Segmented
          label="Dia da semana"
          className="mb-3 w-full"
          fill
          value={activeMobileDay}
          onChange={setMobileDay}
          options={days.map((d) => ({ value: d, label: WEEKDAY_SHORT[d], count: countByDay.get(d) }))}
        />
        <div className="overflow-hidden rounded-xl bg-surface shadow-raise ring-1 ring-line-strong">
          <h3 className="bg-nav px-4 py-3 text-sm font-bold text-white">{WEEKDAY_LABEL[activeMobileDay]}</h3>
          <ul>
            {periods.map((period, i) => {
              const showShift = multiShift && (i === 0 || periods[i - 1].shift !== period.shift);
              const cellLessons = period.kind === 'aula' ? lessonsInPeriod(lessons, activeMobileDay, period) : [];
              return (
                <Fragment key={period.id}>
                  {showShift && <li className="bg-ink-2 px-4 py-1.5 text-xs font-bold tracking-wide text-white uppercase">{SHIFT_LABEL[period.shift]}</li>}
                  <li className={cn('flex gap-3 border-b border-line px-4 py-2.5 last:border-b-0', period.kind === 'intervalo' && 'bg-subtle')}>
                    <div className="w-20 shrink-0 pt-1">
                      <span className="block text-xs font-bold text-ink">{period.label}</span>
                      <span className="tabular block text-[11px] text-muted">
                        {period.start}–{period.end}
                      </span>
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      {period.kind === 'intervalo' ? (
                        <span className="pt-1 text-xs font-semibold text-muted">Intervalo</span>
                      ) : cellLessons.length > 0 ? (
                        cellLessons.map((l) => (
                          <LessonChip key={l.id} lesson={l} index={index} perspective={perspective} period={period} onClick={onOpen} />
                        ))
                      ) : onCreate ? (
                        <EmptySlot
                          label={`Adicionar aula: ${WEEKDAY_LABEL[activeMobileDay]}, ${period.label}`}
                          onClick={() => onCreate(activeMobileDay, period)}
                          alwaysVisible
                        />
                      ) : (
                        <span className="pt-1 text-xs text-soft">Livre</span>
                      )}
                    </div>
                  </li>
                </Fragment>
              );
            })}
          </ul>
        </div>
      </div>
    </>
  );
}

export function EmptySlot({ label, onClick, alwaysVisible }: { label: string; onClick: () => void; alwaysVisible?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        'group/slot flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-md border border-dashed text-xs font-semibold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-ink',
        alwaysVisible
          ? 'border-line-strong bg-surface text-ink-2'
          : 'border-transparent text-transparent hover:border-ink/40 hover:bg-surface hover:text-ink focus-visible:border-ink/40 focus-visible:bg-surface focus-visible:text-ink',
      )}
    >
      <Plus className="size-3.5" aria-hidden="true" />
      Adicionar
    </button>
  );
}
