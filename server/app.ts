import express, { type NextFunction, type Request, type Response } from 'express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { ZodType } from 'zod';
import type { Database } from './db';
import { createRepository, type Repository } from './repository';
import {
  classSchema,
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

function isUniqueError(error: unknown) {
  return error instanceof Error && /UNIQUE constraint failed/i.test(error.message);
}

export function createApp(db: Database, options: { staticDir?: string } = {}) {
  const repo = createRepository(db);
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '200kb' }));

  const api = express.Router();

  api.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  // ---------------- Professores ----------------
  api.get('/teachers', (_req, res) => {
    res.json(repo.listTeachers());
  });

  api.get('/teachers/:id', (req, res) => {
    const teacher = repo.getTeacher(idParam(req));
    if (!teacher) throw new HttpError(404, 'not_found', 'Professor não encontrado.');
    res.json(teacher);
  });

  function assertTeacherCodeFree(code: string | null, ignoreId?: number) {
    if (!code) return;
    const existing = repo.findTeacherByCode(code);
    if (existing && existing.id !== ignoreId) {
      throw new HttpError(409, 'duplicate', 'Já existe um professor com esta matrícula.', {
        fields: { code: `Matrícula já utilizada por ${existing.name}.` },
      });
    }
  }

  api.post('/teachers', (req, res) => {
    const input = parse(teacherSchema, req.body);
    assertTeacherCodeFree(input.code);
    res.status(201).json(repo.createTeacher(input));
  });

  api.put('/teachers/:id', (req, res) => {
    const id = idParam(req);
    if (!repo.getTeacher(id)) throw new HttpError(404, 'not_found', 'Professor não encontrado.');
    const input = parse(teacherSchema, req.body);
    assertTeacherCodeFree(input.code, id);
    res.json(repo.updateTeacher(id, input));
  });

  api.patch('/teachers/:id/status', (req, res) => {
    const id = idParam(req);
    if (!repo.getTeacher(id)) throw new HttpError(404, 'not_found', 'Professor não encontrado.');
    const { active } = parse(statusSchema, req.body);
    res.json(repo.setTeacherActive(id, active));
  });

  api.delete('/teachers/:id', (req, res) => {
    const id = idParam(req);
    const teacher = repo.getTeacher(id);
    if (!teacher) throw new HttpError(404, 'not_found', 'Professor não encontrado.');
    const lessonCount = repo.countLessonsBy('teacher_id', id);
    const withLessons = req.query.withLessons === 'true';
    if (lessonCount > 0 && !withLessons) {
      throw new HttpError(409, 'has_lessons', `${teacher.name} possui ${lessonCount} aula(s) no quadro.`, {
        details: { lessonCount },
      });
    }
    repo.deleteTeacher(id, withLessons);
    res.status(204).end();
  });

  // ---------------- Turmas ----------------
  api.get('/classes', (_req, res) => {
    res.json(repo.listClasses());
  });

  api.get('/classes/:id', (req, res) => {
    const schoolClass = repo.getClass(idParam(req));
    if (!schoolClass) throw new HttpError(404, 'not_found', 'Turma não encontrada.');
    res.json(schoolClass);
  });

  function assertClassNameFree(name: string, ignoreId?: number) {
    const existing = repo.findClassByName(name);
    if (existing && existing.id !== ignoreId) {
      throw new HttpError(409, 'duplicate', 'Já existe uma turma com esta identificação.', {
        fields: { name: `Já existe a turma "${existing.name}". Use uma identificação diferente.` },
      });
    }
  }

  api.post('/classes', (req, res) => {
    const input = parse(classSchema, req.body);
    assertClassNameFree(input.name);
    res.status(201).json(repo.createClass(input));
  });

  api.put('/classes/:id', (req, res) => {
    const id = idParam(req);
    if (!repo.getClass(id)) throw new HttpError(404, 'not_found', 'Turma não encontrada.');
    const input = parse(classSchema, req.body);
    assertClassNameFree(input.name, id);
    res.json(repo.updateClass(id, input));
  });

  api.patch('/classes/:id/status', (req, res) => {
    const id = idParam(req);
    if (!repo.getClass(id)) throw new HttpError(404, 'not_found', 'Turma não encontrada.');
    const { active } = parse(statusSchema, req.body);
    res.json(repo.setClassActive(id, active));
  });

  api.delete('/classes/:id', (req, res) => {
    const id = idParam(req);
    const schoolClass = repo.getClass(id);
    if (!schoolClass) throw new HttpError(404, 'not_found', 'Turma não encontrada.');
    const lessonCount = repo.countLessonsBy('class_id', id);
    const withLessons = req.query.withLessons === 'true';
    if (lessonCount > 0 && !withLessons) {
      throw new HttpError(409, 'has_lessons', `A turma ${schoolClass.name} possui ${lessonCount} aula(s) no quadro.`, {
        details: { lessonCount },
      });
    }
    repo.deleteClass(id, withLessons);
    res.status(204).end();
  });

  // ---------------- Disciplinas ----------------
  api.get('/subjects', (_req, res) => {
    res.json(repo.listSubjects());
  });

  function assertSubjectNameFree(name: string, ignoreId?: number) {
    const existing = repo.findSubjectByName(name);
    if (existing && existing.id !== ignoreId) {
      throw new HttpError(409, 'duplicate', 'Esta disciplina já está cadastrada.', {
        fields: { name: `A disciplina "${existing.name}" já existe.` },
      });
    }
  }

  api.post('/subjects', (req, res) => {
    const input = parse(subjectSchema, req.body);
    assertSubjectNameFree(input.name);
    res.status(201).json(repo.createSubject(input));
  });

  api.put('/subjects/:id', (req, res) => {
    const id = idParam(req);
    if (!repo.getSubject(id)) throw new HttpError(404, 'not_found', 'Disciplina não encontrada.');
    const input = parse(subjectSchema, req.body);
    assertSubjectNameFree(input.name, id);
    res.json(repo.updateSubject(id, input));
  });

  api.delete('/subjects/:id', (req, res) => {
    const id = idParam(req);
    const subject = repo.getSubject(id);
    if (!subject) throw new HttpError(404, 'not_found', 'Disciplina não encontrada.');
    const lessonCount = repo.countLessonsBy('subject_id', id);
    const detach = req.query.detachLessons === 'true';
    if (lessonCount > 0 && !detach) {
      throw new HttpError(409, 'has_lessons', `${subject.name} está em ${lessonCount} aula(s).`, { details: { lessonCount } });
    }
    repo.deleteSubject(id, detach);
    res.status(204).end();
  });

  // ---------------- Períodos e configurações ----------------
  api.get('/periods', (_req, res) => {
    res.json(repo.listPeriods());
  });

  api.put('/periods/:shift', (req, res) => {
    const shift = parse(shiftParamSchema, req.params.shift);
    const input = parse(periodsReplaceSchema, req.body);
    // As aulas guardam seus próprios horários: alterar períodos nunca modifica ou remove aulas.
    res.json(repo.replacePeriods(shift, input));
  });

  api.get('/settings', (_req, res) => {
    res.json(repo.getSettings());
  });

  api.put('/settings', (req, res) => {
    const input = parse(settingsSchema, req.body);
    res.json(repo.updateSettings(input));
  });

  // ---------------- Aulas ----------------
  api.get('/lessons', (_req, res) => {
    res.json(repo.listLessons());
  });

  function validateOrThrow(input: LessonInput, id?: number) {
    const issues = validateLesson(
      { ...input, id },
      {
        lessons: repo.listLessons(),
        teachers: repo.listTeachers(),
        classes: repo.listClasses(),
        subjects: repo.listSubjects(),
        settings: repo.getSettings(),
        periods: repo.listPeriods(),
      },
    );
    if (hasBlockingIssues(issues)) {
      throw new HttpError(409, 'lesson_conflict', 'A aula não pode ser salva por causa de conflitos.', { issues });
    }
    return issues;
  }

  function writeLesson<T>(fn: () => T): T {
    try {
      return repo.inTransaction(fn);
    } catch (error) {
      if (isOverlapError(error)) {
        throw new HttpError(409, 'lesson_conflict', 'Já existe uma aula sobreposta para este professor ou turma.');
      }
      throw error;
    }
  }

  api.post('/lessons', (req, res) => {
    const input = parse(lessonSchema, req.body);
    const result = writeLesson(() => {
      const warnings = validateOrThrow(input);
      return { lesson: repo.createLesson(input), warnings };
    });
    res.status(201).json(result);
  });

  api.put('/lessons/:id', (req, res) => {
    const id = idParam(req);
    if (!repo.getLesson(id)) throw new HttpError(404, 'not_found', 'Aula não encontrada.');
    const input = parse(lessonSchema, req.body);
    const result = writeLesson(() => {
      const warnings = validateOrThrow(input, id);
      return { lesson: repo.updateLesson(id, input)!, warnings };
    });
    res.json(result);
  });

  api.delete('/lessons/:id', (req, res) => {
    const id = idParam(req);
    if (!repo.deleteLesson(id)) throw new HttpError(404, 'not_found', 'Aula não encontrada.');
    res.status(204).end();
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
    if (isUniqueError(error)) {
      res.status(409).json({ error: { code: 'duplicate', message: 'Já existe um registro com estes dados.' } });
      return;
    }
    console.error('[SEICE] Erro inesperado:', error);
    res.status(500).json({ error: { code: 'internal', message: 'Não foi possível concluir a operação. Tente novamente.' } });
  });

  return { app, repo: repo as Repository };
}
