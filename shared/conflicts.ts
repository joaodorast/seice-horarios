import { WEEKDAY_LABEL, shiftsOfClass } from './labels.js';
import { overlaps, toMinutes, TIME_PATTERN, formatRange } from './time.js';
import type {
  Lesson,
  LessonIssue,
  Period,
  SchoolClass,
  Settings,
  Subject,
  Teacher,
  Weekday,
} from './types.js';

export interface LessonCandidate {
  id?: number;
  teacherId: number;
  classId: number;
  subjectId: number | null;
  weekday: Weekday;
  start: string;
  end: string;
}

export interface ValidationContext {
  lessons: Lesson[];
  teachers: Teacher[];
  classes: SchoolClass[];
  subjects: Subject[];
  settings: Settings;
  periods: Period[];
}

function describeLesson(lesson: Lesson, ctx: ValidationContext, omit: 'teacher' | 'class'): string {
  const teacher = ctx.teachers.find((t) => t.id === lesson.teacherId);
  const schoolClass = ctx.classes.find((c) => c.id === lesson.classId);
  const subject = lesson.subjectId ? ctx.subjects.find((s) => s.id === lesson.subjectId) : undefined;
  const parts = [
    subject ? subject.name : 'aula',
    omit !== 'teacher' ? `com ${teacher?.name ?? 'professor removido'}` : null,
    omit !== 'class' ? `na turma ${schoolClass?.name ?? 'removida'}` : null,
    `(${WEEKDAY_LABEL[lesson.weekday].toLowerCase()}, ${formatRange(lesson.start, lesson.end)})`,
  ];
  return parts.filter(Boolean).join(' ');
}

/**
 * Valida uma aula antes de salvar. Erros impedem o salvamento; avisos apenas orientam.
 * É a mesma regra usada pela interface (checagem ao vivo) e pelo servidor (checagem definitiva).
 */
export function validateLesson(candidate: LessonCandidate, ctx: ValidationContext): LessonIssue[] {
  const issues: LessonIssue[] = [];
  const teacher = ctx.teachers.find((t) => t.id === candidate.teacherId);
  const schoolClass = ctx.classes.find((c) => c.id === candidate.classId);

  if (!teacher) {
    issues.push({
      code: 'teacher-missing',
      severity: 'error',
      message: 'O professor selecionado não foi encontrado.',
      hint: 'Selecione um professor da lista.',
    });
  } else if (!teacher.active) {
    issues.push({
      code: 'teacher-inactive',
      severity: 'error',
      message: `${teacher.name} está inativo(a) e não pode receber novas aulas.`,
      hint: 'Reative o cadastro do professor ou escolha outro professor.',
    });
  }

  if (!schoolClass) {
    issues.push({
      code: 'class-missing',
      severity: 'error',
      message: 'A turma selecionada não foi encontrada.',
      hint: 'Selecione uma turma da lista.',
    });
  } else if (!schoolClass.active) {
    issues.push({
      code: 'class-inactive',
      severity: 'error',
      message: `A turma ${schoolClass.name} está inativa e não pode receber aulas.`,
      hint: 'Reative a turma ou escolha outra turma.',
    });
  }

  if (candidate.subjectId !== null && !ctx.subjects.some((s) => s.id === candidate.subjectId)) {
    issues.push({
      code: 'subject-missing',
      severity: 'error',
      message: 'A disciplina selecionada não foi encontrada.',
      hint: 'Escolha outra disciplina ou deixe o campo em branco.',
    });
  }

  if (!ctx.settings.enabledDays.includes(candidate.weekday)) {
    issues.push({
      code: 'day-disabled',
      severity: 'error',
      message: `${WEEKDAY_LABEL[candidate.weekday]} não está habilitada no calendário escolar.`,
      hint: 'Escolha outro dia ou habilite este dia em Configurações.',
    });
  }

  const validTimes = TIME_PATTERN.test(candidate.start) && TIME_PATTERN.test(candidate.end);
  if (!validTimes) {
    issues.push({
      code: 'invalid-time',
      severity: 'error',
      message: 'Informe horários válidos no formato HH:MM.',
      hint: 'Exemplo: 07:30 às 08:20.',
    });
    return issues;
  }

  if (toMinutes(candidate.end) <= toMinutes(candidate.start)) {
    issues.push({
      code: 'invalid-time',
      severity: 'error',
      message: 'O horário de término precisa ser posterior ao horário de início.',
      hint: 'Ajuste o início ou o término da aula.',
    });
    return issues;
  }

  const sameDay = ctx.lessons.filter(
    (l) => l.weekday === candidate.weekday && l.id !== candidate.id && overlaps(l.start, l.end, candidate.start, candidate.end),
  );

  for (const other of sameDay) {
    if (other.teacherId === candidate.teacherId) {
      issues.push({
        code: 'teacher-overlap',
        severity: 'error',
        message: `${teacher?.name ?? 'Este professor'} já tem aula neste horário: ${describeLesson(other, ctx, 'teacher')}.`,
        hint: 'Escolha outro horário ou outro professor, ou edite a aula existente.',
        relatedLessonId: other.id,
      });
    }
    if (other.classId === candidate.classId) {
      issues.push({
        code: 'class-overlap',
        severity: 'error',
        message: `A turma ${schoolClass?.name ?? ''} já tem aula neste horário: ${describeLesson(other, ctx, 'class')}.`,
        hint: 'Escolha um horário livre da turma ou edite a aula existente.',
        relatedLessonId: other.id,
      });
    }
  }

  if (schoolClass) {
    const shifts = shiftsOfClass(schoolClass.shift);
    const classPeriods = ctx.periods.filter((p) => p.kind === 'aula' && shifts.includes(p.shift));
    const fitsGrid = classPeriods.some((p) => overlaps(p.start, p.end, candidate.start, candidate.end));
    if (!fitsGrid) {
      issues.push({
        code: 'outside-grid',
        severity: 'warning',
        message: 'Este horário não coincide com nenhum período de aula configurado para o turno da turma.',
        hint: 'A aula será salva, mas aparecerá na lista "Fora da grade" até que os períodos sejam ajustados.',
      });
    }
  }

  return issues;
}

export function hasBlockingIssues(issues: LessonIssue[]): boolean {
  return issues.some((i) => i.severity === 'error');
}

export interface ScheduleConflict {
  type: 'teacher' | 'class';
  a: Lesson;
  b: Lesson;
}

/** Varre toda a programação em busca de sobreposições (útil para auditoria e para o painel). */
export function findScheduleConflicts(lessons: Lesson[]): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];
  const byDay = new Map<number, Lesson[]>();
  for (const lesson of lessons) {
    const list = byDay.get(lesson.weekday) ?? [];
    list.push(lesson);
    byDay.set(lesson.weekday, list);
  }
  for (const dayLessons of byDay.values()) {
    const sorted = [...dayLessons].sort((x, y) => toMinutes(x.start) - toMinutes(y.start));
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const a = sorted[i];
        const b = sorted[j];
        if (toMinutes(b.start) >= toMinutes(a.end)) break;
        if (a.teacherId === b.teacherId) conflicts.push({ type: 'teacher', a, b });
        if (a.classId === b.classId) conflicts.push({ type: 'class', a, b });
      }
    }
  }
  return conflicts;
}
