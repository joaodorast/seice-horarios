import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { request } from './client';
import { load } from './batch';
import type { ClassInput, LessonBatchInput, LessonInput, SettingsInput, SubjectInput, TeacherInput } from '@shared/schemas';
import type { ImportKind, ImportReport, ImportRequest } from '@shared/import';
import type { Lesson, LessonIssue, Period, PeriodKind, SchoolClass, Settings, ShiftKey, Subject, Teacher } from '@shared/types';

export const keys = {
  teachers: ['teachers'] as const,
  classes: ['classes'] as const,
  subjects: ['subjects'] as const,
  periods: ['periods'] as const,
  settings: ['settings'] as const,
  lessons: ['lessons'] as const,
};

// As leituras passam pelo agrupador: consultas feitas juntas viram uma única requisição.
export const useTeachers = () => useQuery({ queryKey: keys.teachers, queryFn: () => load<Teacher[]>('teachers') });
export const useClasses = () => useQuery({ queryKey: keys.classes, queryFn: () => load<SchoolClass[]>('classes') });
export const useSubjects = () => useQuery({ queryKey: keys.subjects, queryFn: () => load<Subject[]>('subjects') });
export const usePeriods = () => useQuery({ queryKey: keys.periods, queryFn: () => load<Period[]>('periods') });
export const useSettings = () => useQuery({ queryKey: keys.settings, queryFn: () => load<Settings>('settings') });
export const useLessons = () => useQuery({ queryKey: keys.lessons, queryFn: () => load<Lesson[]>('lessons') });

export interface ScheduleData {
  teachers: Teacher[];
  classes: SchoolClass[];
  subjects: Subject[];
  periods: Period[];
  settings: Settings;
  lessons: Lesson[];
}

/** Reúne todos os dados necessários para montar grades e validar conflitos. */
export function useScheduleData() {
  const queries = [useTeachers(), useClasses(), useSubjects(), usePeriods(), useSettings(), useLessons()] as const;
  const [teachers, classes, subjects, periods, settings, lessons] = queries;
  const isLoading = queries.some((q) => q.isPending);
  const error = queries.find((q) => q.error)?.error ?? null;
  const data: ScheduleData | undefined =
    teachers.data && classes.data && subjects.data && periods.data && settings.data && lessons.data
      ? {
          teachers: teachers.data,
          classes: classes.data,
          subjects: subjects.data,
          periods: periods.data,
          settings: settings.data,
          lessons: lessons.data,
        }
      : undefined;
  const refetch = () => queries.forEach((q) => q.error && q.refetch());
  return { data, isLoading, error, refetch };
}

// -------- Professores --------
export function useSaveTeacher() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: number; input: TeacherInput }) =>
      id ? request<Teacher>('PUT', `/teachers/${id}`, input) : request<Teacher>('POST', '/teachers', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.teachers }),
  });
}

export function useSetTeacherStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) => request<Teacher>('PATCH', `/teachers/${id}/status`, { active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.teachers }),
  });
}

export function useDeleteTeacher() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, withLessons }: { id: number; withLessons?: boolean }) =>
      request<void>('DELETE', `/teachers/${id}${withLessons ? '?withLessons=true' : ''}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.teachers });
      qc.invalidateQueries({ queryKey: keys.lessons });
    },
  });
}

export function useSetTeacherPhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dataUrl }: { id: number; dataUrl: string }) => request<Teacher>('PUT', `/teachers/${id}/photo`, { dataUrl }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.teachers }),
  });
}

export function useRemoveTeacherPhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request<Teacher>('DELETE', `/teachers/${id}/photo`),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.teachers }),
  });
}

// -------- Turmas --------
export function useSaveClass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: number; input: ClassInput }) =>
      id ? request<SchoolClass>('PUT', `/classes/${id}`, input) : request<SchoolClass>('POST', '/classes', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.classes }),
  });
}

export function useSetClassStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) =>
      request<SchoolClass>('PATCH', `/classes/${id}/status`, { active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.classes }),
  });
}

export function useDeleteClass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, withLessons }: { id: number; withLessons?: boolean }) =>
      request<void>('DELETE', `/classes/${id}${withLessons ? '?withLessons=true' : ''}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.classes });
      qc.invalidateQueries({ queryKey: keys.lessons });
    },
  });
}

// -------- Disciplinas --------
export function useSaveSubject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: number; input: SubjectInput }) =>
      id ? request<Subject>('PUT', `/subjects/${id}`, input) : request<Subject>('POST', '/subjects', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.subjects }),
  });
}

export function useDeleteSubject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, detachLessons }: { id: number; detachLessons?: boolean }) =>
      request<void>('DELETE', `/subjects/${id}${detachLessons ? '?detachLessons=true' : ''}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.subjects });
      qc.invalidateQueries({ queryKey: keys.lessons });
    },
  });
}

// -------- Configurações --------
export function useSaveSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SettingsInput) => request<Settings>('PUT', '/settings', input),
    onSuccess: (data) => qc.setQueryData(keys.settings, data),
  });
}

export interface PeriodDraft {
  label: string;
  start: string;
  end: string;
  kind: PeriodKind;
}

export function useSavePeriods() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ shift, periods }: { shift: ShiftKey; periods: PeriodDraft[] }) =>
      request<Period[]>('PUT', `/periods/${shift}`, { periods }),
    onSuccess: (data) => qc.setQueryData(keys.periods, data),
  });
}

// -------- Aulas --------
interface LessonResult {
  lesson: Lesson;
  warnings: LessonIssue[];
}

export function useSaveLesson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: number; input: LessonInput }) =>
      id ? request<LessonResult>('PUT', `/lessons/${id}`, input) : request<LessonResult>('POST', '/lessons', input),
    onSettled: () => qc.invalidateQueries({ queryKey: keys.lessons }),
  });
}

/** Aplica várias mudanças de aulas de uma vez (substituir, trocar horários, passar para outro professor). */
export function useLessonBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (batch: LessonBatchInput) => request<{ removed: number; updated: Lesson[]; created: Lesson[] }>('POST', '/lessons/batch', batch),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: keys.lessons });
      qc.invalidateQueries({ queryKey: keys.teachers });
    },
  });
}

export function useDeleteLesson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request<void>('DELETE', `/lessons/${id}`),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: keys.lessons });
      const previous = qc.getQueryData<Lesson[]>(keys.lessons);
      qc.setQueryData<Lesson[]>(keys.lessons, (old) => old?.filter((l) => l.id !== id));
      return { previous };
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.previous) qc.setQueryData(keys.lessons, ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: keys.lessons }),
  });
}

// -------- Importação de planilhas --------
/** Dados que cada importação pode alterar, para atualizar as telas depois de gravar. */
const IMPORT_AFFECTS: Record<ImportKind, (keyof typeof keys)[]> = {
  teachers: ['teachers'],
  classes: ['classes'],
  subjects: ['subjects'],
  periods: ['periods'],
  lessons: ['lessons', 'subjects'],
};

export function useImport(kind: ImportKind) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ImportRequest) => request<ImportReport>('POST', `/import/${kind}`, body),
    onSuccess: (report) => {
      if (!report.dryRun) for (const k of IMPORT_AFFECTS[kind]) qc.invalidateQueries({ queryKey: keys[k] });
    },
  });
}
