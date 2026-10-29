export const WEEKDAYS = [1, 2, 3, 4, 5, 6] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export const SHIFT_KEYS = ['manha', 'tarde', 'noite'] as const;
export type ShiftKey = (typeof SHIFT_KEYS)[number];

export const CLASS_SHIFTS = ['manha', 'tarde', 'noite', 'integral'] as const;
export type ClassShift = (typeof CLASS_SHIFTS)[number];

export const SUBJECT_COLORS = [
  'amber',
  'orange',
  'green',
  'indigo',
  'rose',
  'sky',
  'teal',
  'violet',
  'slate',
  'lime',
] as const;
export type SubjectColor = (typeof SUBJECT_COLORS)[number];

export type PeriodKind = 'aula' | 'intervalo';

export interface Teacher {
  id: number;
  name: string;
  code: string | null;
  area: string | null;
  phone: string | null;
  notes: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  /** Data da foto atual (usada para atualizar a imagem em cache), ou null sem foto. */
  photoUpdatedAt: string | null;
  /** Disciplinas que o professor leciona (pode ser mais de uma). */
  subjectIds: number[];
  /** Dias e horários em que o professor está na escola. Vazio = não informado (qualquer horário). */
  availability: AvailabilitySlot[];
}

/** Um intervalo em que o professor está na escola (ex.: segunda, 07:00 às 12:20). */
export interface AvailabilitySlot {
  weekday: Weekday;
  start: string;
  end: string;
}

export interface SchoolClass {
  id: number;
  name: string;
  grade: string;
  shift: ClassShift;
  notes: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Subject {
  id: number;
  name: string;
  color: SubjectColor;
  createdAt: string;
}

export interface Period {
  id: number;
  shift: ShiftKey;
  label: string;
  start: string;
  end: string;
  kind: PeriodKind;
  sortOrder: number;
}

export interface Settings {
  enabledDays: Weekday[];
  enabledShifts: ShiftKey[];
  lessonDuration: number;
}

export interface Lesson {
  id: number;
  teacherId: number;
  classId: number;
  subjectId: number | null;
  weekday: Weekday;
  start: string;
  end: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Atribuição: quem leciona a disciplina na turma e quantas aulas por semana (aula dupla conta como duas). */
export interface Assignment {
  id: number;
  teacherId: number;
  classId: number;
  subjectId: number;
  weeklyLessons: number;
  updatedAt: string;
}

export type IssueCode =
  | 'invalid-time'
  | 'teacher-overlap'
  | 'class-overlap'
  | 'teacher-inactive'
  | 'class-inactive'
  | 'teacher-missing'
  | 'class-missing'
  | 'subject-missing'
  | 'day-disabled'
  | 'outside-grid'
  | 'teacher-unavailable';

export interface LessonIssue {
  code: IssueCode;
  severity: 'error' | 'warning';
  message: string;
  hint: string;
  relatedLessonId?: number;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string>;
    issues?: LessonIssue[];
    details?: Record<string, unknown>;
  };
}
