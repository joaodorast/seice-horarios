import { useMemo } from 'react';
import { findScheduleConflicts } from '@shared/conflicts';
import type { ScheduleData } from '@/api/hooks';
import type { SchoolClass, Subject, Teacher } from '@shared/types';

export interface ScheduleIndex {
  teacherById: Map<number, Teacher>;
  classById: Map<number, SchoolClass>;
  subjectById: Map<number, Subject>;
  conflictLessonIds: Set<number>;
  conflictCount: number;
}

/** Mapas de consulta rápida e o conjunto de aulas em conflito, recalculados só quando os dados mudam. */
export function useScheduleIndex(data: ScheduleData | undefined): ScheduleIndex {
  return useMemo(() => {
    const teacherById = new Map((data?.teachers ?? []).map((t) => [t.id, t]));
    const classById = new Map((data?.classes ?? []).map((c) => [c.id, c]));
    const subjectById = new Map((data?.subjects ?? []).map((s) => [s.id, s]));
    const conflicts = findScheduleConflicts(data?.lessons ?? []);
    const conflictLessonIds = new Set<number>();
    for (const c of conflicts) {
      conflictLessonIds.add(c.a.id);
      conflictLessonIds.add(c.b.id);
    }
    return { teacherById, classById, subjectById, conflictLessonIds, conflictCount: conflicts.length };
  }, [data]);
}
