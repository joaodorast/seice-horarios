import { AlertTriangle, UserX } from 'lucide-react';
import { cn } from '@/lib/cn';
import { NO_SUBJECT_STYLE, SUBJECT_STYLE } from '@/lib/subjectColors';
import type { ScheduleIndex } from '@/hooks/useScheduleIndex';
import type { Lesson, Period } from '@shared/types';

export type ChipPerspective = 'teacher' | 'class' | 'overview';

interface LessonChipProps {
  lesson: Lesson;
  index: ScheduleIndex;
  perspective: ChipPerspective;
  period?: Period;
  onClick?: (lesson: Lesson) => void;
  dimmed?: boolean;
  compact?: boolean;
}

/** Bloco de aula usado em todas as grades: cor da disciplina na borda, informação principal em destaque. */
export function LessonChip({ lesson, index, perspective, period, onClick, dimmed, compact }: LessonChipProps) {
  const subject = lesson.subjectId ? index.subjectById.get(lesson.subjectId) : undefined;
  const teacher = index.teacherById.get(lesson.teacherId);
  const schoolClass = index.classById.get(lesson.classId);
  const style = subject ? SUBJECT_STYLE[subject.color] : NO_SUBJECT_STYLE;
  const conflict = index.conflictLessonIds.has(lesson.id);
  const inactive = (teacher && !teacher.active) || (schoolClass && !schoolClass.active);
  const customTime = period && (period.start !== lesson.start || period.end !== lesson.end);

  const title = subject?.name ?? 'Sem disciplina';
  const secondary =
    perspective === 'teacher'
      ? `Turma ${schoolClass?.name ?? '—'}`
      : teacher?.name ?? '—';

  const label = [
    title,
    perspective !== 'class' ? `turma ${schoolClass?.name}` : null,
    perspective !== 'teacher' ? `professor ${teacher?.name}` : null,
    `${lesson.start} às ${lesson.end}`,
    conflict ? 'em conflito' : null,
    inactive ? 'com cadastro inativo' : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(lesson);
      }}
      aria-label={`Aula: ${label}`}
      className={cn(
        'group/chip relative flex w-full min-w-0 overflow-hidden rounded-md text-left transition-[box-shadow,opacity,transform] duration-150 hover:-translate-y-px hover:shadow-raise focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink',
        style.chip,
        conflict && 'ring-2 ring-danger',
        dimmed && 'opacity-35 hover:opacity-100',
      )}
    >
      <span className={cn('w-[3px] shrink-0', conflict ? 'bg-danger' : style.bar)} aria-hidden="true" />
      <span className={cn('min-w-0 flex-1', compact ? 'px-2 py-1.5' : 'px-2.5 py-2')}>
        <span className="flex items-center gap-1">
          <span className={cn('truncate font-bold', compact ? 'text-xs' : 'text-[13px]')}>{title}</span>
          {conflict && <AlertTriangle className="size-3.5 shrink-0 text-danger" aria-hidden="true" />}
          {inactive && !conflict && <UserX className="size-3.5 shrink-0 opacity-70" aria-hidden="true" />}
        </span>
        <span className={cn('block truncate opacity-80', compact ? 'text-[11px]' : 'text-xs')}>{secondary}</span>
        {customTime && <span className="tabular mt-0.5 block text-[11px] font-semibold opacity-75">{lesson.start}–{lesson.end}</span>}
      </span>
    </button>
  );
}
