import { z } from 'zod';
import { CLASS_SHIFTS, SHIFT_KEYS, SUBJECT_COLORS, WEEKDAYS } from './types.js';
import { TIME_PATTERN, toMinutes } from './time.js';
import { MAX_IMPORT_ROWS } from './import.js';

function optionalText(max: number, label: string) {
  return z
    .union([z.string(), z.null()])
    .optional()
    .transform((v) => {
      const t = (v ?? '').trim();
      return t === '' ? null : t;
    })
    .pipe(z.string().max(max, { error: `${label} pode ter no máximo ${max} caracteres.` }).nullable());
}

const requiredText = (max: number, label: string, min = 1) =>
  z
    .string({ error: `Informe ${label}.` })
    .trim()
    .min(min, { error: min > 1 ? `${capitalize(label)} deve ter pelo menos ${min} caracteres.` : `Informe ${label}.` })
    .max(max, { error: `${capitalize(label)} pode ter no máximo ${max} caracteres.` });

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const time = (label: string) =>
  z.string({ error: `Informe o horário de ${label}.` }).regex(TIME_PATTERN, { error: `Horário de ${label} inválido (use HH:MM).` });

export const teacherSchema = z.object({
  name: requiredText(120, 'o nome completo', 3),
  code: optionalText(30, 'A matrícula'),
  area: optionalText(80, 'A área de atuação'),
  phone: optionalText(20, 'O telefone').refine(
    (v) => v === null || (/^[\d\s()+-]+$/.test(v) && v.replace(/\D/g, '').length >= 8),
    { error: 'Informe um telefone válido, com DDD. Ex.: (21) 99999-0000.' },
  ),
  notes: optionalText(1000, 'As observações'),
  active: z.boolean().default(true),
  /** Disciplinas que o professor leciona. */
  subjectIds: z
    .array(z.number().int().positive())
    .max(30, { error: 'Selecione no máximo 30 disciplinas.' })
    .default([])
    .transform((ids) => [...new Set(ids)].sort((a, b) => a - b)),
});
export type TeacherInput = z.output<typeof teacherSchema>;
export type TeacherFormValues = z.input<typeof teacherSchema>;

export const classSchema = z.object({
  name: requiredText(40, 'a identificação da turma'),
  grade: requiredText(60, 'o ano, série ou etapa'),
  shift: z.enum(CLASS_SHIFTS, { error: 'Selecione o turno.' }),
  notes: optionalText(1000, 'As observações'),
  active: z.boolean().default(true),
});
export type ClassInput = z.output<typeof classSchema>;
export type ClassFormValues = z.input<typeof classSchema>;

export const subjectSchema = z.object({
  name: requiredText(60, 'o nome da disciplina'),
  color: z.enum(SUBJECT_COLORS).default('slate'),
});
export type SubjectInput = z.output<typeof subjectSchema>;

export const statusSchema = z.object({ active: z.boolean() });

const weekday = z.coerce
  .number()
  .int()
  .refine((v): v is (typeof WEEKDAYS)[number] => (WEEKDAYS as readonly number[]).includes(v), { error: 'Dia da semana inválido.' });

export const lessonSchema = z
  .object({
    teacherId: z.coerce.number({ error: 'Selecione o professor.' }).int().positive({ error: 'Selecione o professor.' }),
    classId: z.coerce.number({ error: 'Selecione a turma.' }).int().positive({ error: 'Selecione a turma.' }),
    subjectId: z
      .union([z.coerce.number().int().positive(), z.null(), z.literal('')])
      .optional()
      .transform((v) => (v === '' || v === undefined ? null : v)),
    weekday,
    start: time('início'),
    end: time('término'),
    notes: optionalText(500, 'As observações'),
  })
  .superRefine((v, ctx) => {
    if (TIME_PATTERN.test(v.start) && TIME_PATTERN.test(v.end) && toMinutes(v.end) <= toMinutes(v.start)) {
      ctx.addIssue({ code: 'custom', path: ['end'], message: 'O término deve ser depois do início.' });
    }
  });
export type LessonInput = z.output<typeof lessonSchema>;

/**
 * Reorganização do quadro numa única operação (ex.: substituir uma aula, trocar horários ou passar uma aula
 * para outro professor). Ordem de aplicação: remoções, alterações e, por fim, novas aulas.
 */
export const lessonBatchSchema = z.object({
  removeIds: z.array(z.number().int().positive()).max(20).default([]),
  updates: z.array(z.object({ id: z.number().int().positive(), input: lessonSchema })).max(20).default([]),
  creates: z.array(lessonSchema).max(20).default([]),
});
export type LessonBatchInput = z.output<typeof lessonBatchSchema>;

const positiveId = (what: string) => z.coerce.number({ error: `Selecione ${what}.` }).int().positive({ error: `Selecione ${what}.` });

export const assignmentSchema = z.object({
  teacherId: positiveId('o professor'),
  classId: positiveId('a turma'),
  subjectId: positiveId('a disciplina'),
  weeklyLessons: z.coerce
    .number({ error: 'Informe quantas aulas por semana.' })
    .int({ error: 'Use um número inteiro de aulas.' })
    .min(1, { error: 'Pelo menos 1 aula por semana.' })
    .max(40, { error: 'No máximo 40 aulas por semana.' }),
});
export type AssignmentInput = z.output<typeof assignmentSchema>;

/** Gravação de várias atribuições de uma vez. Cada turma tem um professor por disciplina. */
export const assignmentBatchSchema = z.object({
  upserts: z.array(assignmentSchema).max(500).default([]),
  removes: z.array(z.object({ classId: positiveId('a turma'), subjectId: positiveId('a disciplina') })).max(500).default([]),
});
export type AssignmentBatchInput = z.output<typeof assignmentBatchSchema>;

export const periodSchema = z
  .object({
    id: z.number().int().positive().optional(),
    label: requiredText(30, 'o nome do período'),
    start: time('início'),
    end: time('término'),
    kind: z.enum(['aula', 'intervalo']),
  })
  .superRefine((v, ctx) => {
    if (TIME_PATTERN.test(v.start) && TIME_PATTERN.test(v.end) && toMinutes(v.end) <= toMinutes(v.start)) {
      ctx.addIssue({ code: 'custom', path: ['end'], message: 'O término deve ser depois do início.' });
    }
  });

export const periodsReplaceSchema = z
  .object({ periods: z.array(periodSchema).max(20, { error: 'Limite de 20 períodos por turno.' }) })
  .superRefine((v, ctx) => {
    const sorted = [...v.periods].map((p, i) => ({ ...p, i })).sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
    for (let k = 1; k < sorted.length; k++) {
      if (toMinutes(sorted[k].start) < toMinutes(sorted[k - 1].end)) {
        ctx.addIssue({
          code: 'custom',
          path: ['periods', sorted[k].i, 'start'],
          message: `Sobrepõe o período "${sorted[k - 1].label}" (${sorted[k - 1].start}–${sorted[k - 1].end}).`,
        });
      }
    }
  });
export type PeriodsReplaceInput = z.output<typeof periodsReplaceSchema>;

export const shiftParamSchema = z.enum(SHIFT_KEYS);

export const settingsSchema = z.object({
  enabledDays: z
    .array(weekday)
    .min(1, { error: 'Habilite pelo menos um dia da semana.' })
    .transform((days) => [...new Set(days)].sort()),
  enabledShifts: z
    .array(z.enum(SHIFT_KEYS))
    .min(1, { error: 'Habilite pelo menos um turno.' })
    .transform((s) => SHIFT_KEYS.filter((k) => s.includes(k))),
  lessonDuration: z.coerce
    .number()
    .int()
    .min(20, { error: 'A duração mínima é de 20 minutos.' })
    .max(180, { error: 'A duração máxima é de 180 minutos.' }),
});
export type SettingsInput = z.output<typeof settingsSchema>;

export const importRequestSchema = z.object({
  rows: z
    .array(
      z.object({
        line: z.number().int().positive(),
        values: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]).transform((v) => (v === null ? '' : String(v)))),
      }),
    )
    .min(1, { error: 'A planilha não tem linhas para importar.' })
    .max(MAX_IMPORT_ROWS, { error: `Importe no máximo ${MAX_IMPORT_ROWS.toLocaleString('pt-BR')} linhas por vez.` }),
  options: z
    .object({
      existing: z.enum(['update', 'skip']).default('update'),
      createMissingSubjects: z.boolean().default(false),
      replaceExisting: z.boolean().default(false),
      fixedTeacherId: z.number().int().positive().optional(),
      fixedClassId: z.number().int().positive().optional(),
    })
    .default({ existing: 'update', createMissingSubjects: false, replaceExisting: false }),
  dryRun: z.boolean().default(false),
});

export const loginSchema = z.object({
  email: z.string({ error: 'Informe o e-mail.' }).trim().min(1, { error: 'Informe o e-mail.' }).max(200),
  password: z.string({ error: 'Informe a senha.' }).min(1, { error: 'Informe a senha.' }).max(200),
  remember: z.boolean().default(false),
});
