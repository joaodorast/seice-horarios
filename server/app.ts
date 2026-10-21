import express, { type NextFunction, type Request, type Response } from 'express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { ZodType } from 'zod';
import type { Database } from './db';
import { createRepository, type Repository } from './repository';
import { ImportFailure, runImport } from './import';
import {
  classSchema,
  importRequestSchema,
  lessonSchema,
  periodsReplaceSchema,
  settingsSchema,
  shiftParamSchema,
  statusSchema,
  subjectSchema,
  teacherSchema,
  type LessonInput,
} from '../shared/schemas';
import { hasBlockingIssues, validateLesson } from '../shared/conflicts';
import { IMPORT_KINDS, type ImportKind } from '../shared/import';
import type { LessonIssue } from '../shared/types';

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public extra: { fields?: Record<string, string>; issues?: LessonIssue[]; details?: Record<string, unknown> } = {},
  ) {
    super(message);
  }
}

function parse<T>(schema: ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const fields: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join('.') || '_';
      if (!fields[key]) fields[key] = issue.message;
    }
    throw new HttpError(422, 'validation_error', 'Alguns campos precisam ser corrigidos.', { fields });
  }
  return result.data;
}

function idParam(req: Request): number {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'invalid_id', 'Identificador inválido.');
  return id;
}

function isOverlapError(error: unknown) {
  return error instanceof Error && error.message.includes('LESSON_OVERLAP');
}

/** Violação de índice único no PostgreSQL (código 23505). */
function isUniqueError(error: unknown) {
  return (error as { code?: string } | null)?.code === '23505';
}

/** Falha de conexão com o banco na nuvem (rede, credenciais ou banco indisponível). */
function isConnectionError(error: unknown) {
  const code = (error as { code?: string } | null)?.code ?? '';
  return (
    ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET', 'EAI_AGAIN', '28P01', '57P01', '53300'].includes(code) ||
    (error instanceof Error && /timeout exceeded when trying to connect|Connection terminated/i.test(error.message))
  );
}

export function createApp(db: Database, options: { staticDir?: string } = {}) {
  const repo = createRepository(db);
  const app = express();
  app.disable('x-powered-by');
  // Importações de planilhas trazem milhares de linhas; o restante da API trabalha com corpos pequenos.
  app.use('/api/import', express.json({ limit: '8mb' }));
  app.use(express.json({ limit: '200kb' }));

  const api = express.Router();

  api.get('/health', async (_req, res) => {
    await db.query('SELECT 1');
    res.json({ ok: true, database: db.kind });
  });

  // ---------------- Professores ----------------
  api.get('/teachers', async (_req, res) => {
    res.json(await repo.listTeachers());
  });

  api.get('/teachers/:id', async (req, res) => {
    const teacher = await repo.getTeacher(idParam(req));
    if (!teacher) throw new HttpError(404, 'not_found', 'Professor não encontrado.');
    res.json(teacher);
  });

  async function assertTeacherCodeFree(code: string | null, ignoreId?: number) {
    if (!code) return;
    const existing = await repo.findTeacherByCode(code);
    if (existing && existing.id !== ignoreId) {
      throw new HttpError(409, 'duplicate', 'Já existe um professor com esta matrícula.', {
        fields: { code: `Matrícula já utilizada por ${existing.name}.` },
      });
    }
  }

  api.post('/teachers', async (req, res) => {
    const input = parse(teacherSchema, req.body);
    await assertTeacherCodeFree(input.code);
    res.status(201).json(await repo.createTeacher(input));
  });

  api.put('/teachers/:id', async (req, res) => {
    const id = idParam(req);
    if (!(await repo.getTeacher(id))) throw new HttpError(404, 'not_found', 'Professor não encontrado.');
    const input = parse(teacherSchema, req.body);
    await assertTeacherCodeFree(input.code, id);
    res.json(await repo.updateTeacher(id, input));
  });

  api.patch('/teachers/:id/status', async (req, res) => {
    const id = idParam(req);
    if (!(await repo.getTeacher(id))) throw new HttpError(404, 'not_found', 'Professor não encontrado.');
    const { active } = parse(statusSchema, req.body);
    res.json(await repo.setTeacherActive(id, active));
  });

  api.delete('/teachers/:id', async (req, res) => {
    const id = idParam(req);
    const teacher = await repo.getTeacher(id);
    if (!teacher) throw new HttpError(404, 'not_found', 'Professor não encontrado.');
    const lessonCount = await repo.countLessonsBy('teacher_id', id);
    const withLessons = req.query.withLessons === 'true';
    if (lessonCount > 0 && !withLessons) {
      throw new HttpError(409, 'has_lessons', `${teacher.name} possui ${lessonCount} aula(s) no quadro.`, {
        details: { lessonCount },
      });
    }
    await db.transaction((tx) => createRepository(tx).deleteTeacher(id, withLessons));
    res.status(204).end();
  });

  // ---------------- Turmas ----------------
  api.get('/classes', async (_req, res) => {
    res.json(await repo.listClasses());
  });

  api.get('/classes/:id', async (req, res) => {
    const schoolClass = await repo.getClass(idParam(req));
    if (!schoolClass) throw new HttpError(404, 'not_found', 'Turma não encontrada.');
    res.json(schoolClass);
  });

  async function assertClassNameFree(name: string, ignoreId?: number) {
    const existing = await repo.findClassByName(name);
    if (existing && existing.id !== ignoreId) {
      throw new HttpError(409, 'duplicate', 'Já existe uma turma com esta identificação.', {
        fields: { name: `Já existe a turma "${existing.name}". Use uma identificação diferente.` },
      });
    }
  }

  api.post('/classes', async (req, res) => {
    const input = parse(classSchema, req.body);
    await assertClassNameFree(input.name);
    res.status(201).json(await repo.createClass(input));
  });

  api.put('/classes/:id', async (req, res) => {
    const id = idParam(req);
    if (!(await repo.getClass(id))) throw new HttpError(404, 'not_found', 'Turma não encontrada.');
    const input = parse(classSchema, req.body);
    await assertClassNameFree(input.name, id);
    res.json(await repo.updateClass(id, input));
  });

  api.patch('/classes/:id/status', async (req, res) => {
    const id = idParam(req);
    if (!(await repo.getClass(id))) throw new HttpError(404, 'not_found', 'Turma não encontrada.');
    const { active } = parse(statusSchema, req.body);
    res.json(await repo.setClassActive(id, active));
  });

  api.delete('/classes/:id', async (req, res) => {
    const id = idParam(req);
    const schoolClass = await repo.getClass(id);
    if (!schoolClass) throw new HttpError(404, 'not_found', 'Turma não encontrada.');
    const lessonCount = await repo.countLessonsBy('class_id', id);
    const withLessons = req.query.withLessons === 'true';
    if (lessonCount > 0 && !withLessons) {
      throw new HttpError(409, 'has_lessons', `A turma ${schoolClass.name} possui ${lessonCount} aula(s) no quadro.`, {
        details: { lessonCount },
      });
    }
    await db.transaction((tx) => createRepository(tx).deleteClass(id, withLessons));
    res.status(204).end();
  });

  // ---------------- Disciplinas ----------------
  api.get('/subjects', async (_req, res) => {
    res.json(await repo.listSubjects());
  });

  async function assertSubjectNameFree(name: string, ignoreId?: number) {
    const existing = await repo.findSubjectByName(name);
    if (existing && existing.id !== ignoreId) {
      throw new HttpError(409, 'duplicate', 'Esta disciplina já está cadastrada.', {
        fields: { name: `A disciplina "${existing.name}" já existe.` },
      });
    }
  }

  api.post('/subjects', async (req, res) => {
    const input = parse(subjectSchema, req.body);
    await assertSubjectNameFree(input.name);
    res.status(201).json(await repo.createSubject(input));
  });

  api.put('/subjects/:id', async (req, res) => {
    const id = idParam(req);
    if (!(await repo.getSubject(id))) throw new HttpError(404, 'not_found', 'Disciplina não encontrada.');
    const input = parse(subjectSchema, req.body);
    await assertSubjectNameFree(input.name, id);
    res.json(await repo.updateSubject(id, input));
  });

  api.delete('/subjects/:id', async (req, res) => {
    const id = idParam(req);
    const subject = await repo.getSubject(id);
    if (!subject) throw new HttpError(404, 'not_found', 'Disciplina não encontrada.');
    const lessonCount = await repo.countLessonsBy('subject_id', id);
    const detach = req.query.detachLessons === 'true';
    if (lessonCount > 0 && !detach) {
      throw new HttpError(409, 'has_lessons', `${subject.name} está em ${lessonCount} aula(s).`, { details: { lessonCount } });
    }
    await db.transaction((tx) => createRepository(tx).deleteSubject(id, detach));
    res.status(204).end();
  });

  // ---------------- Períodos e configurações ----------------
  api.get('/periods', async (_req, res) => {
    res.json(await repo.listPeriods());
  });

  api.put('/periods/:shift', async (req, res) => {
    const shift = parse(shiftParamSchema, req.params.shift);
    const input = parse(periodsReplaceSchema, req.body);
    // As aulas guardam seus próprios horários: alterar períodos nunca modifica ou remove aulas.
    await db.transaction((tx) => createRepository(tx).replacePeriods(shift, input));
    res.json(await repo.listPeriods());
  });

  api.get('/settings', async (_req, res) => {
    res.json(await repo.getSettings());
  });

  api.put('/settings', async (req, res) => {
    const input = parse(settingsSchema, req.body);
    await db.transaction((tx) => createRepository(tx).updateSettings(input));
    res.json(await repo.getSettings());
  });

  // ---------------- Aulas ----------------
  api.get('/lessons', async (_req, res) => {
    res.json(await repo.listLessons());
  });

  async function validateOrThrow(tx: Repository, input: LessonInput, id?: number) {
    const [lessons, teachers, classes, subjects, settings, periods] = await Promise.all([
      tx.listLessons(),
      tx.listTeachers(),
      tx.listClasses(),
      tx.listSubjects(),
      tx.getSettings(),
      tx.listPeriods(),
    ]);
    const issues = validateLesson({ ...input, id }, { lessons, teachers, classes, subjects, settings, periods });
    if (hasBlockingIssues(issues)) {
      throw new HttpError(409, 'lesson_conflict', 'A aula não pode ser salva por causa de conflitos.', { issues });
    }
    return issues;
  }

  /** Valida e grava a aula na mesma transação, com as gravações de aulas serializadas. */
  async function writeLesson<T>(fn: (tx: Repository) => Promise<T>): Promise<T> {
    try {
      return await db.transaction(async (handle) => {
        const tx = createRepository(handle);
        await tx.lockLessons();
        return fn(tx);
      });
    } catch (error) {
      if (isOverlapError(error)) {
        throw new HttpError(409, 'lesson_conflict', 'Já existe uma aula sobreposta para este professor ou turma.');
      }
      throw error;
    }
  }

  api.post('/lessons', async (req, res) => {
    const input = parse(lessonSchema, req.body);
    const result = await writeLesson(async (tx) => {
      const warnings = await validateOrThrow(tx, input);
      return { lesson: await tx.createLesson(input), warnings };
    });
    res.status(201).json(result);
  });

  api.put('/lessons/:id', async (req, res) => {
    const id = idParam(req);
    if (!(await repo.getLesson(id))) throw new HttpError(404, 'not_found', 'Aula não encontrada.');
    const input = parse(lessonSchema, req.body);
    const result = await writeLesson(async (tx) => {
      const warnings = await validateOrThrow(tx, input, id);
      return { lesson: (await tx.updateLesson(id, input))!, warnings };
    });
    res.json(result);
  });

  api.delete('/lessons/:id', async (req, res) => {
    const id = idParam(req);
    if (!(await repo.deleteLesson(id))) throw new HttpError(404, 'not_found', 'Aula não encontrada.');
    res.status(204).end();
  });

  // ---------------- Importação de planilhas ----------------
  api.post('/import/:kind', async (req, res) => {
    const kind = req.params.kind as ImportKind;
    if (!(IMPORT_KINDS as readonly string[]).includes(kind)) throw new HttpError(404, 'not_found', 'Tipo de importação desconhecido.');
    const request = parse(importRequestSchema, req.body);
    try {
      res.json(await runImport(db, kind, request));
    } catch (error) {
      if (error instanceof ImportFailure) throw new HttpError(422, 'import_failed', error.message);
      throw error;
    }
  });

  api.use((_req, _res, next) => next(new HttpError(404, 'not_found', 'Recurso não encontrado.')));

  app.use('/api', api);

  if (options.staticDir && existsSync(join(options.staticDir, 'index.html'))) {
    const dir = options.staticDir;
    app.use(express.static(dir, { index: false, maxAge: '1h' }));
    app.get(/^(?!\/api\/).*/, (_req, res) => {
      res.sendFile(join(dir, 'index.html'));
    });
  }

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof HttpError) {
      res.status(error.status).json({ error: { code: error.code, message: error.message, ...error.extra } });
      return;
    }
    if (error instanceof SyntaxError && 'body' in error) {
      res.status(400).json({ error: { code: 'bad_request', message: 'Requisição inválida.' } });
      return;
    }
    if ((error as { type?: string } | null)?.type === 'entity.too.large') {
      res.status(413).json({ error: { code: 'too_large', message: 'O arquivo é grande demais. Divida a planilha em partes menores.' } });
      return;
    }
    if (isUniqueError(error)) {
      res.status(409).json({ error: { code: 'duplicate', message: 'Já existe um registro com estes dados.' } });
      return;
    }
    if (isConnectionError(error)) {
      console.error('[SEICE] Banco de dados indisponível:', (error as Error).message);
      res.status(503).json({
        error: { code: 'database_unavailable', message: 'Não foi possível acessar o banco de dados na nuvem. Verifique a conexão com a internet e tente novamente.' },
      });
      return;
    }
    console.error('[SEICE] Erro inesperado:', error);
    res.status(500).json({ error: { code: 'internal', message: 'Não foi possível concluir a operação. Tente novamente.' } });
  });

  return { app, repo };
}
