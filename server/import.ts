import type { ZodError } from 'zod';
import type { Database } from './db.js';
import { createRepository, type Repository } from './repository.js';
import {
  IMPORT_SPECS,
  clean,
  fold,
  parseActive,
  parseClassShift,
  parseColor,
  parseOrdinal,
  parsePeriodKind,
  parseShift,
  parseTime,
  parseTimeRange,
  parseWeekday,
  type ImportKind,
  type ImportOptions,
  type ImportReport,
  type ImportRequest,
  type ImportRowInput,
  type ImportRowResult,
  type ImportRowStatus,
} from '../shared/import.js';
import { classSchema, periodsReplaceSchema, subjectSchema, teacherSchema, type ClassInput, type TeacherInput } from '../shared/schemas.js';
import { validateLesson } from '../shared/conflicts.js';
import { periodsForClassShift } from '../shared/grid.js';
import { SHIFT_LABEL, WEEKDAY_SHORT } from '../shared/labels.js';
import { formatRange, toMinutes } from '../shared/time.js';
import { SUBJECT_COLORS, type Lesson, type SchoolClass, type ShiftKey, type Subject, type SubjectColor, type Teacher, type Weekday } from '../shared/types.js';

/** Erro que impede a importação inteira (ex.: professor fixo inexistente). */
export class ImportFailure extends Error {}

class DryRunRollback extends Error {}

interface Ctx {
  tx: Database;
  repo: Repository;
  results: ImportRowResult[];
  removed: number;
  createdSubjects: string[];
  /** Modo protegido: cada linha grava dentro de um savepoint, isolando recusas inesperadas do banco. */
  safe: boolean;
}

/** Erro do banco no caminho rápido: a importação é refeita no modo protegido. */
class FastPathFailure extends Error {
  constructor(public cause: unknown) {
    super('Falha no caminho rápido da importação.');
  }
}

/**
 * Executa a importação numa única transação. Na prévia (dryRun) roda exatamente a mesma lógica,
 * incluindo as gravações, e desfaz tudo no final — o relatório da prévia é o que de fato aconteceria.
 */
export async function runImport(db: Database, kind: ImportKind, request: ImportRequest): Promise<ImportReport> {
  let ctx: Ctx | undefined;
  const run = async (safe: boolean) => {
    try {
      await db.transaction(async (tx) => {
        ctx = { tx, repo: createRepository(tx), results: [], removed: 0, createdSubjects: [], safe };
        await HANDLERS[kind](ctx, request.rows, request.options ?? {});
        if (request.dryRun) throw new DryRunRollback();
      });
    } catch (error) {
      if (!(error instanceof DryRunRollback)) throw error;
    }
  };
  // Como cada linha é validada antes de gravar, recusas do banco são raras: grava direto (uma ida ao banco
  // por linha) e, se o banco recusar algo, desfaz tudo e refaz linha a linha com savepoints.
  try {
    await run(false);
  } catch (error) {
    if (!(error instanceof FastPathFailure)) throw error;
    await run(true);
  }
  const results = [...ctx!.results].sort((a, b) => a.line - b.line);
  const summary: Record<ImportRowStatus, number> = { create: 0, update: 0, skip: 0, error: 0 };
  for (const r of results) summary[r.status]++;
  return { kind, dryRun: Boolean(request.dryRun), summary, removed: ctx!.removed, createdSubjects: ctx!.createdSubjects, rows: results };
}

// ------------------------------------------------------------------ Utilitários

function push(ctx: Ctx, line: number, status: ImportRowStatus, label: string, messages: string[] = [], warnings: string[] = []) {
  ctx.results.push({ line, status, label, messages, warnings });
}

/**
 * Grava uma linha. No caminho rápido, uma recusa do banco interrompe e reinicia a importação no modo
 * protegido; no modo protegido, a linha recusada é desfeita sozinha e a transação continua.
 */
async function attempt(ctx: Ctx, fn: () => Promise<void>): Promise<string | null> {
  if (!ctx.safe) {
    try {
      await fn();
      return null;
    } catch (error) {
      throw new FastPathFailure(error);
    }
  }
  await ctx.tx.exec('SAVEPOINT import_row');
  try {
    await fn();
    await ctx.tx.exec('RELEASE SAVEPOINT import_row');
    return null;
  } catch (error) {
    await ctx.tx.exec('ROLLBACK TO SAVEPOINT import_row');
    const message = error instanceof Error ? error.message : '';
    if (message.includes('LESSON_OVERLAP')) return 'Conflito de horário com outra aula do professor ou da turma.';
    if (/duplicate key|unique/i.test(message)) return 'Já existe um registro com estes dados.';
    console.error('[SEICE] Falha ao importar linha:', error);
    return 'O banco de dados recusou esta linha.';
  }
}

function zodMessages(error: ZodError, kind: ImportKind): string[] {
  const labels = Object.fromEntries(IMPORT_SPECS[kind].columns.map((c) => [c.key, c.label]));
  return error.issues.map((i) => {
    const label = labels[String(i.path[0])];
    return label ? `${label}: ${i.message}` : i.message;
  });
}

const valueOf = (row: ImportRowInput) => (key: string) => clean(row.values[key]);

function groupBy<T>(items: T[], key: (t: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    map.set(k, [...(map.get(k) ?? []), item]);
  }
  return map;
}

const nameKey = (name: string) => fold(name);

// ------------------------------------------------------------------ Professores

async function importTeachers(ctx: Ctx, rows: ImportRowInput[], options: ImportOptions) {
  const all = await ctx.repo.listTeachers();
  const byCode = new Map(all.filter((t) => t.code).map((t) => [fold(t.code!), t]));
  const byName = groupBy(all, (t) => nameKey(t.name));
  const seen = new Map<string, number>();

  for (const row of rows) {
    const v = valueOf(row);
    const name = v('name');
    const code = v('code');
    const label = name || code || 'Linha sem nome';
    const errors: string[] = [];

    const active = parseActive(v('active'));
    if (active === null) errors.push('Situação: use Ativo ou Inativo.');

    const key = code ? `c:${fold(code)}` : `n:${nameKey(name)}`;
    if (seen.has(key)) errors.push(`Professor repetido na planilha (já aparece na linha ${seen.get(key)}).`);
    else seen.set(key, row.line);

    let match: Teacher | undefined = code ? byCode.get(fold(code)) : undefined;
    if (!match && name) {
      const sameName = (byName.get(nameKey(name)) ?? []).filter((t) => !code || !t.code);
      if (sameName.length === 1) match = sameName[0];
      else if (sameName.length > 1) errors.push(`Há ${sameName.length} professores com este nome. Informe a matrícula para identificar qual atualizar.`);
    }

    if (errors.length) {
      push(ctx, row.line, 'error', label, errors);
      continue;
    }

    if (match && options.existing === 'skip') {
      push(ctx, row.line, 'skip', match.name, ['Já cadastrado. Mantido sem alterações.']);
      continue;
    }

    const raw = match
      ? {
          name: name || match.name,
          code: code || match.code,
          area: v('area') || match.area,
          phone: v('phone') || match.phone,
          notes: v('notes') || match.notes,
          active: active ?? match.active,
        }
      : { name, code, area: v('area'), phone: v('phone'), notes: v('notes'), active: active ?? true };
    const parsed = teacherSchema.safeParse(raw);
    if (!parsed.success) {
      push(ctx, row.line, 'error', label, zodMessages(parsed.error, 'teachers'));
      continue;
    }
    const input: TeacherInput = parsed.data;
    const owner = input.code ? byCode.get(fold(input.code)) : undefined;
    if (owner && owner.id !== match?.id) {
      push(ctx, row.line, 'error', label, [`Matrícula: já utilizada por ${owner.name}.`]);
      continue;
    }

    if (match) {
      const same = (['name', 'code', 'area', 'phone', 'notes', 'active'] as const).every((k) => input[k] === match![k]);
      if (same) {
        push(ctx, row.line, 'skip', match.name, ['Já cadastrado com os mesmos dados.']);
        continue;
      }
    }

    const target = match;
    const failure = await attempt(ctx, async () => {
      const saved = target ? await ctx.repo.updateTeacher(target.id, input) : await ctx.repo.createTeacher(input);
      if (target?.code) byCode.delete(fold(target.code));
      if (saved!.code) byCode.set(fold(saved!.code), saved!);
      if (!target) byName.set(nameKey(saved!.name), [...(byName.get(nameKey(saved!.name)) ?? []), saved!]);
    });
    if (failure) push(ctx, row.line, 'error', label, [failure]);
    else push(ctx, row.line, target ? 'update' : 'create', input.name);
  }
}

// ------------------------------------------------------------------ Turmas

async function importClasses(ctx: Ctx, rows: ImportRowInput[], options: ImportOptions) {
  const byName = new Map((await ctx.repo.listClasses()).map((c) => [nameKey(c.name), c]));
  const seen = new Map<string, number>();

  for (const row of rows) {
    const v = valueOf(row);
    const name = v('name');
    const label = name || 'Linha sem turma';
    const errors: string[] = [];

    const shiftText = v('shift');
    const shift = shiftText ? parseClassShift(shiftText) : undefined;
    if (shift === null) errors.push(`Turno: "${shiftText}" não reconhecido. Use Manhã, Tarde, Noite ou Integral.`);
    const active = parseActive(v('active'));
    if (active === null) errors.push('Situação: use Ativa ou Inativa.');

    const key = nameKey(name);
    if (name && seen.has(key)) errors.push(`Turma repetida na planilha (já aparece na linha ${seen.get(key)}).`);
    else if (name) seen.set(key, row.line);

    if (errors.length) {
      push(ctx, row.line, 'error', label, errors);
      continue;
    }

    const match = name ? byName.get(key) : undefined;
    if (match && options.existing === 'skip') {
      push(ctx, row.line, 'skip', match.name, ['Já cadastrada. Mantida sem alterações.']);
      continue;
    }

    const raw = match
      ? { name: name || match.name, grade: v('grade') || match.grade, shift: shift ?? match.shift, notes: v('notes') || match.notes, active: active ?? match.active }
      : { name, grade: v('grade'), shift, notes: v('notes'), active: active ?? true };
    const parsed = classSchema.safeParse(raw);
    if (!parsed.success) {
      push(ctx, row.line, 'error', label, zodMessages(parsed.error, 'classes'));
      continue;
    }
    const input: ClassInput = parsed.data;

    if (match && (['grade', 'shift', 'notes', 'active'] as const).every((k) => input[k] === match[k]) && input.name.replace(/\s+/g, ' ') === match.name) {
      push(ctx, row.line, 'skip', match.name, ['Já cadastrada com os mesmos dados.']);
      continue;
    }

    const failure = await attempt(ctx, async () => {
      const saved = match ? await ctx.repo.updateClass(match.id, input) : await ctx.repo.createClass(input);
      byName.set(nameKey(saved!.name), saved!);
    });
    if (failure) push(ctx, row.line, 'error', label, [failure]);
    else push(ctx, row.line, match ? 'update' : 'create', input.name);
  }
}

// ------------------------------------------------------------------ Disciplinas

/** Escolhe a cor menos usada, para que disciplinas importadas sem cor fiquem distinguíveis. */
function nextColor(subjects: Subject[]): SubjectColor {
  const usage = new Map<SubjectColor, number>(SUBJECT_COLORS.map((c) => [c, 0]));
  for (const s of subjects) usage.set(s.color, (usage.get(s.color) ?? 0) + 1);
  return [...SUBJECT_COLORS].sort((a, b) => usage.get(a)! - usage.get(b)!)[0];
}

async function importSubjects(ctx: Ctx, rows: ImportRowInput[], options: ImportOptions) {
  const subjects = await ctx.repo.listSubjects();
  const byName = new Map(subjects.map((s) => [nameKey(s.name), s]));
  const seen = new Map<string, number>();

  for (const row of rows) {
    const v = valueOf(row);
    const name = v('name');
    const label = name || 'Linha sem disciplina';
    const errors: string[] = [];
    const colorText = v('color');
    const color = colorText ? parseColor(colorText) : undefined;
    if (color === null) errors.push(`Cor: "${colorText}" não reconhecida. Deixe em branco para o sistema escolher.`);
    const key = nameKey(name);
    if (name && seen.has(key)) errors.push(`Disciplina repetida na planilha (já aparece na linha ${seen.get(key)}).`);
    else if (name) seen.set(key, row.line);
    if (errors.length) {
      push(ctx, row.line, 'error', label, errors);
      continue;
    }

    const match = name ? byName.get(key) : undefined;
    if (match && (options.existing === 'skip' || !color || color === match.color)) {
      push(ctx, row.line, 'skip', match.name, [options.existing === 'skip' ? 'Já cadastrada. Mantida sem alterações.' : 'Já cadastrada com os mesmos dados.']);
      continue;
    }

    const parsed = subjectSchema.safeParse({ name: match ? match.name : name, color: color ?? nextColor(subjects) });
    if (!parsed.success) {
      push(ctx, row.line, 'error', label, zodMessages(parsed.error, 'subjects'));
      continue;
    }
    const failure = await attempt(ctx, async () => {
      const saved = match ? await ctx.repo.updateSubject(match.id, parsed.data) : await ctx.repo.createSubject(parsed.data);
      byName.set(nameKey(saved!.name), saved!);
      if (match) subjects.splice(subjects.indexOf(match), 1, saved!);
      else subjects.push(saved!);
    });
    if (failure) push(ctx, row.line, 'error', label, [failure]);
    else push(ctx, row.line, match ? 'update' : 'create', parsed.data.name);
  }
}

// ------------------------------------------------------------------ Horários dos turnos

async function importPeriods(ctx: Ctx, rows: ImportRowInput[]) {
  interface Parsed {
    row: ImportRowInput;
    shift: ShiftKey;
    period: { label: string; start: string; end: string; kind: 'aula' | 'intervalo' };
  }
  const valid: Parsed[] = [];
  const failedShifts = new Set<ShiftKey>();

  for (const row of rows) {
    const v = valueOf(row);
    const errors: string[] = [];
    const shift = parseShift(v('shift'));
    if (!shift) errors.push(v('shift') ? `Turno: "${v('shift')}" não reconhecido. Use Manhã, Tarde ou Noite.` : 'Turno: informe o turno.');
    const label = v('label');
    const start = parseTime(v('start'));
    const end = parseTime(v('end'));
    if (!start) errors.push(v('start') ? `Início: "${v('start')}" não é um horário válido (use HH:MM).` : 'Início: informe o horário.');
    if (!end) errors.push(v('end') ? `Término: "${v('end')}" não é um horário válido (use HH:MM).` : 'Término: informe o horário.');
    const kind = parsePeriodKind(v('kind'), label);
    if (!kind) errors.push('Tipo: use Aula ou Intervalo.');
    const title = [shift ? SHIFT_LABEL[shift] : v('shift'), label, start && end ? formatRange(start, end) : ''].filter(Boolean).join(' · ');
    if (errors.length) {
      if (shift) failedShifts.add(shift);
      push(ctx, row.line, 'error', title || 'Linha incompleta', errors);
      continue;
    }
    valid.push({ row, shift: shift!, period: { label, start: start!, end: end!, kind: kind! } });
  }

  for (const [shift, items] of groupBy(valid, (p) => p.shift)) {
    const key = shift as ShiftKey;
    const title = (p: Parsed) => `${SHIFT_LABEL[key]} · ${p.period.label || 'Sem nome'} · ${formatRange(p.period.start, p.period.end)}`;
    if (failedShifts.has(key)) {
      for (const p of items) push(ctx, p.row.line, 'skip', title(p), [`O turno ${SHIFT_LABEL[key]} não foi alterado porque há erros em outras linhas dele.`]);
      continue;
    }
    const parsed = periodsReplaceSchema.safeParse({ periods: items.map((p) => p.period) });
    if (!parsed.success) {
      const byIndex = new Map<number, string[]>();
      for (const issue of parsed.error.issues) {
        const idx = typeof issue.path[1] === 'number' ? issue.path[1] : -1;
        byIndex.set(idx, [...(byIndex.get(idx) ?? []), issue.message]);
      }
      items.forEach((p, i) => {
        const own = byIndex.get(i);
        if (own) push(ctx, p.row.line, 'error', title(p), own);
        else push(ctx, p.row.line, 'skip', title(p), [...(byIndex.get(-1) ?? []), `O turno ${SHIFT_LABEL[key]} não foi alterado por causa dos erros apontados.`]);
      });
      continue;
    }
    const failure = await attempt(ctx, () => ctx.repo.replacePeriods(key, parsed.data));
    for (const p of items) push(ctx, p.row.line, failure ? 'error' : 'create', title(p), failure ? [failure] : []);
  }
}

// ------------------------------------------------------------------ Aulas

async function importLessons(ctx: Ctx, rows: ImportRowInput[], options: ImportOptions) {
  const { repo } = ctx;
  await repo.lockLessons();
  const [teachers, classes, subjects, settings, periods] = await Promise.all([
    repo.listTeachers(),
    repo.listClasses(),
    repo.listSubjects(),
    repo.getSettings(),
    repo.listPeriods(),
  ]);
  let lessons = await repo.listLessons();

  const fixedTeacher = options.fixedTeacherId ? teachers.find((t) => t.id === options.fixedTeacherId) : undefined;
  const fixedClass = options.fixedClassId ? classes.find((c) => c.id === options.fixedClassId) : undefined;
  if (options.fixedTeacherId && !fixedTeacher) throw new ImportFailure('O professor desta página não foi encontrado.');
  if (options.fixedClassId && !fixedClass) throw new ImportFailure('A turma desta página não foi encontrada.');

  const teacherByCode = new Map(teachers.filter((t) => t.code).map((t) => [fold(t.code!), t]));
  const teachersByName = groupBy(teachers, (t) => nameKey(t.name));
  const classByName = new Map(classes.map((c) => [nameKey(c.name), c]));
  const subjectByName = new Map(subjects.map((s) => [nameKey(s.name), s]));

  interface Resolved {
    row: ImportRowInput;
    label: string;
    teacher: Teacher;
    schoolClass: SchoolClass;
    subject: Subject | { pending: string } | null;
    weekday: Weekday;
    start: string;
    end: string;
    notes: string | null;
  }
  const resolved: Resolved[] = [];

  for (const row of rows) {
    const v = valueOf(row);
    const errors: string[] = [];

    let teacher = fixedTeacher;
    if (!teacher) {
      const t = v('teacher');
      if (!t) errors.push('Professor: informe o nome ou a matrícula.');
      else {
        teacher = teacherByCode.get(fold(t));
        if (!teacher) {
          const same = teachersByName.get(nameKey(t)) ?? [];
          if (same.length === 1) teacher = same[0];
          else if (same.length > 1) errors.push(`Professor: há ${same.length} professores chamados "${t}". Use a matrícula.`);
          else errors.push(`Professor: "${t}" não está cadastrado. Importe ou cadastre o professor antes.`);
        }
      }
    }

    let schoolClass = fixedClass;
    if (!schoolClass) {
      const c = v('class');
      if (!c) errors.push('Turma: informe a turma.');
      else {
        schoolClass = classByName.get(nameKey(c));
        if (!schoolClass) errors.push(`Turma: "${c}" não está cadastrada. Importe ou cadastre a turma antes.`);
      }
    }

    let subject: Resolved['subject'] = null;
    const subjectText = v('subject');
    if (subjectText) {
      subject = subjectByName.get(nameKey(subjectText)) ?? null;
      if (!subject) {
        if (options.createMissingSubjects) subject = { pending: subjectText };
        else errors.push(`Disciplina: "${subjectText}" não está cadastrada. Ative "criar disciplinas que não existem" ou cadastre-a antes.`);
      }
    }

    const dayText = v('weekday');
    const weekday = parseWeekday(dayText);
    if (!weekday) errors.push(dayText ? `Dia: "${dayText}" não reconhecido. Use, por exemplo, Segunda ou Terça-feira.` : 'Dia: informe o dia da semana.');

    let start: string | null = null;
    let end: string | null = null;
    const startText = v('start');
    const endText = v('end');
    const slotText = v('slot');
    if (startText || endText) {
      start = parseTime(startText);
      end = parseTime(endText);
      if (!start) errors.push(startText ? `Início: "${startText}" não é um horário válido (use HH:MM).` : 'Início: informe o horário de início.');
      if (!end) errors.push(endText ? `Término: "${endText}" não é um horário válido (use HH:MM).` : 'Término: informe o horário de término.');
    } else if (slotText) {
      const range = parseTimeRange(slotText);
      if (range) ({ start, end } = range);
      else if (schoolClass) {
        const lessonPeriods = periodsForClassShift(periods, schoolClass.shift).filter((p) => p.kind === 'aula');
        const ordinal = parseOrdinal(slotText);
        const period =
          lessonPeriods.find((p) => fold(p.label) === fold(slotText)) ?? (ordinal ? lessonPeriods[ordinal - 1] : undefined);
        if (period) ({ start, end } = period);
        else
          errors.push(
            `Horário: "${slotText}" não corresponde a nenhum período de aula do turno ${SHIFT_LABEL[schoolClass.shift]}${
              lessonPeriods.length ? ` (há ${lessonPeriods.length})` : ''
            }. Use o nome do período ou uma faixa como 07:00–07:50.`,
          );
      }
    } else errors.push('Horário: informe o período (ex.: 1º horário) ou as colunas Início e Término.');

    if (start && end && toMinutes(end) <= toMinutes(start)) errors.push('O término precisa ser depois do início.');

    const label = [
      schoolClass?.name ?? v('class'),
      weekday ? WEEKDAY_SHORT[weekday] : dayText,
      start && end ? formatRange(start, end) : slotText,
      subject ? ('pending' in subject ? subject.pending : subject.name) : null,
      teacher?.name ?? v('teacher'),
    ]
      .filter(Boolean)
      .join(' · ');

    if (errors.length) {
      push(ctx, row.line, 'error', label || 'Linha incompleta', errors);
      continue;
    }
    resolved.push({ row, label, teacher: teacher!, schoolClass: schoolClass!, subject, weekday: weekday!, start: start!, end: end!, notes: v('notes') || null });
  }

  if (options.replaceExisting && resolved.length > 0) {
    ctx.removed = fixedTeacher
      ? await repo.deleteLessonsBy('teacher_id', [fixedTeacher.id])
      : await repo.deleteLessonsBy('class_id', fixedClass ? [fixedClass.id] : [...new Set(resolved.map((r) => r.schoolClass.id))]);
    lessons = await repo.listLessons();
  }

  const importedLine = new Map<number, number>();

  for (const r of resolved) {
    const pendingSubject = r.subject && 'pending' in r.subject ? r.subject.pending : null;
    const subjectId = r.subject && !('pending' in r.subject) ? r.subject.id : null;

    const twin = lessons.find(
      (l) => l.teacherId === r.teacher.id && l.classId === r.schoolClass.id && l.weekday === r.weekday && l.start === r.start && l.end === r.end,
    );
    if (twin && (pendingSubject === null ? twin.subjectId === subjectId : false)) {
      const from = importedLine.get(twin.id);
      push(ctx, r.row.line, 'skip', r.label, [from ? `Aula repetida na planilha (igual à linha ${from}).` : 'Esta aula já está cadastrada.']);
      continue;
    }

    const candidate = { teacherId: r.teacher.id, classId: r.schoolClass.id, subjectId, weekday: r.weekday, start: r.start, end: r.end };
    const issues = validateLesson(candidate, { lessons, teachers, classes, subjects, settings, periods });
    const errors = issues.filter((i) => i.severity === 'error').map((i) => i.message);
    const warnings = issues.filter((i) => i.severity === 'warning').map((i) => i.message);
    if (errors.length) {
      push(ctx, r.row.line, 'error', r.label, errors);
      continue;
    }

    const failure = await attempt(ctx, async () => {
      let finalSubjectId = subjectId;
      if (pendingSubject) {
        let created = subjectByName.get(nameKey(pendingSubject));
        if (!created) {
          created = await repo.createSubject({ name: pendingSubject, color: nextColor(subjects) });
          subjects.push(created);
          subjectByName.set(nameKey(created.name), created);
          ctx.createdSubjects.push(created.name);
        }
        finalSubjectId = created.id;
      }
      const lesson: Lesson = await repo.createLesson({ ...candidate, subjectId: finalSubjectId, notes: r.notes });
      lessons = [...lessons, lesson];
      importedLine.set(lesson.id, r.row.line);
    });
    if (failure) push(ctx, r.row.line, 'error', r.label, [failure]);
    else
      push(
        ctx,
        r.row.line,
        'create',
        r.label,
        pendingSubject && ctx.createdSubjects.some((s) => nameKey(s) === nameKey(pendingSubject)) ? [`Disciplina "${pendingSubject}" criada.`] : [],
        warnings,
      );
  }
}

const HANDLERS: Record<ImportKind, (ctx: Ctx, rows: ImportRowInput[], options: ImportOptions) => Promise<void>> = {
  teachers: importTeachers,
  classes: importClasses,
  subjects: importSubjects,
  periods: (ctx, rows) => importPeriods(ctx, rows),
  lessons: importLessons,
};
