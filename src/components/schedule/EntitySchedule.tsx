import { useMemo, useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { Alert, Card, Segmented } from '@/components/ui';
import { lessonsOutsideGrid, periodsForClassShift, periodsForShifts } from '@shared/grid';
import { SHIFT_LABEL, WEEKDAY_LABEL, shiftsOfClass } from '@shared/labels';
import { overlaps } from '@shared/time';
import { SHIFT_KEYS, type Lesson, type ShiftKey } from '@shared/types';
import type { ScheduleData } from '@/api/hooks';
import type { ScheduleIndex } from '@/hooks/useScheduleIndex';
import { WeekGrid } from './WeekGrid';
import { GridLegend } from './GridLegend';
import { LessonChip } from './LessonChip';
import { useScheduleActions } from './ScheduleActions';

interface EntityScheduleProps {
  kind: 'teacher' | 'class';
  id: number;
  data: ScheduleData;
  index: ScheduleIndex;
}

/** Grade semanal de um professor ou de uma turma, com criação contextual de aulas. */
export function EntitySchedule({ kind, id, data, index }: EntityScheduleProps) {
  const actions = useScheduleActions();
  const lessons = useMemo(
    () => data.lessons.filter((l) => (kind === 'teacher' ? l.teacherId === id : l.classId === id)),
    [data.lessons, kind, id],
  );
  const schoolClass = kind === 'class' ? index.classById.get(id) : undefined;
  const teacher = kind === 'teacher' ? index.teacherById.get(id) : undefined;

  // Turnos disponíveis para o professor: os habilitados e aqueles em que ele já tem aulas.
  const teacherShifts = useMemo(() => {
    if (kind !== 'teacher') return [];
    const withLessons = new Set<ShiftKey>();
    for (const l of lessons) {
      const p = data.periods.find((p) => p.kind === 'aula' && overlaps(p.start, p.end, l.start, l.end));
      if (p) withLessons.add(p.shift);
    }
    return SHIFT_KEYS.filter((s) => data.settings.enabledShifts.includes(s) || withLessons.has(s)).map((s) => ({
      shift: s,
      count: lessons.filter((l) => data.periods.some((p) => p.shift === s && p.kind === 'aula' && overlaps(p.start, p.end, l.start, l.end))).length,
    }));
  }, [kind, lessons, data.periods, data.settings.enabledShifts]);

  const [chosenShift, setChosenShift] = useState<ShiftKey | null>(null);
  const activeShift: ShiftKey =
    chosenShift && teacherShifts.some((s) => s.shift === chosenShift)
      ? chosenShift
      : (teacherShifts.find((s) => s.count > 0)?.shift ?? teacherShifts[0]?.shift ?? 'manha');

  const periods =
    kind === 'class' && schoolClass
      ? periodsForClassShift(data.periods, schoolClass.shift)
      : periodsForShifts(data.periods, [activeShift]);

  const gridPeriods = kind === 'class' && schoolClass ? data.periods.filter((p) => shiftsOfClass(schoolClass.shift).includes(p.shift)) : data.periods;
  const outside = lessonsOutsideGrid(lessons, gridPeriods, data.settings.enabledDays);
  const canCreate = kind === 'teacher' ? Boolean(teacher?.active) : Boolean(schoolClass?.active);

  const caption =
    kind === 'teacher'
      ? `Horário semanal de ${teacher?.name} — turno ${SHIFT_LABEL[activeShift].toLowerCase()}`
      : `Horário semanal da turma ${schoolClass?.name}`;

  return (
    <div className="flex flex-col gap-4">
      {kind === 'teacher' && teacherShifts.length > 1 && (
        <Segmented
          label="Turno"
          className="self-start"
          value={activeShift}
          onChange={setChosenShift}
          options={teacherShifts.map((s) => ({ value: s.shift, label: SHIFT_LABEL[s.shift], count: s.count }))}
        />
      )}

      {!canCreate && (
        <Alert tone="warning" title={kind === 'teacher' ? 'Professor inativo' : 'Turma inativa'}>
          Novas aulas não podem ser adicionadas enquanto o cadastro estiver inativo. As aulas existentes continuam visíveis.
        </Alert>
      )}

      {periods.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center px-6 py-12 text-center">
            <CalendarClock className="mb-3 size-8 text-muted" />
            <p className="font-bold">Nenhum período configurado para este turno</p>
            <p className="mt-1 text-sm text-muted">Defina os horários das aulas em Configurações para montar a grade.</p>
          </div>
        </Card>
      ) : (
        <>
          <GridLegend variant="entity" canCreate={canCreate} />
          <WeekGrid
            caption={caption}
            periods={periods}
            days={data.settings.enabledDays}
            lessons={lessons}
            index={index}
            perspective={kind}
            onOpen={actions.openLesson}
            onCreate={
              canCreate
                ? (day, period) =>
                    actions.createLesson({
                      weekday: day,
                      start: period.start,
                      end: period.end,
                      ...(kind === 'teacher' ? { teacherId: id } : { classId: id }),
                    })
                : undefined
            }
          />
        </>
      )}

      {outside.length > 0 && <OutsideGrid lessons={outside} index={index} perspective={kind} onOpen={actions.openLesson} />}
    </div>
  );
}

export function OutsideGrid({
  lessons,
  index,
  perspective,
  onOpen,
}: {
  lessons: Lesson[];
  index: ScheduleIndex;
  perspective: 'teacher' | 'class' | 'overview';
  onOpen: (l: Lesson) => void;
}) {
  return (
    <Card className="p-4">
      <h3 className="text-sm font-bold">Fora da grade ({lessons.length})</h3>
      <p className="mt-0.5 mb-3 text-[13px] text-muted">
        Aulas em dias desabilitados ou em horários que não coincidem com os períodos configurados. Nada foi apagado — edite a aula ou ajuste os períodos.
      </p>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {lessons.map((l) => (
          <li key={l.id} className="flex items-center gap-3">
            <span className="w-24 shrink-0 text-xs">
              <span className="block font-semibold">{WEEKDAY_LABEL[l.weekday]}</span>
              <span className="tabular text-muted">
                {l.start}–{l.end}
              </span>
            </span>
            <div className="min-w-0 flex-1">
              <LessonChip lesson={l} index={index} perspective={perspective} onClick={onOpen} compact />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
