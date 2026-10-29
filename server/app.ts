import express, { type NextFunction, type Request, type Response } from 'express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { ZodType } from 'zod';
import type { Database } from './db.js';
import { createRepository, type Repository } from './repository.js';
import { ImportFailure, runImport } from './import.js';
import { AuthError, createAuth, sameOriginGuard } from './auth.js';
import {
  classSchema,
  importRequestSchema,
  assignmentBatchSchema,
  lessonBatchSchema,
  loginSchema,
  lessonSchema,
  periodsReplaceSchema,
  settingsSchema,
  shiftParamSchema,
  statusSchema,
  subjectSchema,
  teacherSchema,
  type LessonInput,
} from '../shared/schemas.js';
import { hasBlockingIssues, validateLesson } from '../shared/conflicts.js';
import { IMPORT_KINDS, type ImportKind } from '../shared/import.js';
import type { LessonIssue } from '../shared/types.js';

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

const PHOTO_MAX_BYTES = 300_000;
/** Assinaturas dos formatos aceitos: confere o conteúdo, não só o tipo declarado. */
const PHOTO_SIGNATURES: Record<string, (b: Buffer) => boolean> = {
  'image/webp': (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP',
  'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/png': (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
};

function decodePhoto(dataUrl: unknown): { mime: string; data: Buffer } {
  const match = typeof dataUrl === 'string' ? /^data:(image\/(?:webp|jpeg|png));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl) : null;
  if (!match) throw new HttpError(422, 'invalid_photo', 'Envie uma imagem nos formatos WEBP, JPEG ou PNG.');
  const data = Buffer.from(match[2], 'base64');
  if (data.length > PHOTO_MAX_BYTES) throw new HttpError(413, 'photo_too_large', 'A foto ficou grande demais. Escolha outra imagem.');
  if (!PHOTO_SIGNATURES[match[1]](data)) throw new HttpError(422, 'invalid_photo', 'O arquivo enviado não é uma imagem válida.');
  return { mime: match[1], data };
}

export function createApp(db: Database, options: { staticDir?: string } = {}) {
  const repo = createRepository(db);
  const auth = createAuth(db);
  const app = express();
  app.disable('x-powered-by');
  // Atrás de proxy (Vercel), para reconhecer HTTPS e marcar o cookie de sessão como seguro.
  app.set('trust proxy', true);
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    next();
  });
  // Importações de planilhas trazem milhares de linhas (a Vercel aceita corpos de até 4,5 MB).
  app.use('/api/import', express.json({ limit: '4mb' }));
  // Fotos chegam já reduzidas pelo navegador; o limite folgado cobre a codificação base64.
  app.use(/^\/api\/teachers\/\d+\/photo$/, express.json({ limit: '1mb' }));
  app.use(express.json({ limit: '200kb' }));

  const api = express.Router();
  api.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  api.use(sameOriginGuard);

  api.get('/health', async (_req, res) => {
    await db.query('SELECT 1');
    res.json({ ok: true, database: db.kind });
  });

  // ---------------- Acesso ----------------
  api.post('/auth/login', async (req, res) => {
    const { email, password, remember } = parse(loginSchema, req.body);
    res.json({ user: await auth.login(req, res, email, password, remember) });
  });

  api.post('/auth/logout', (req, res) => {
    auth.logout(req, res);
    res.status(204).end();
  });

  api.get('/auth/me', async (req, res) => {
    const user = await auth.sessionUser(req, res);
    if (!user) throw new HttpError(401, 'unauthorized', 'Entre com seu e-mail e senha.');
    res.json({ user });
  });

  api.use(auth.middleware);

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
    res.status(201).json(await db.transaction((tx) => createRepository(tx).createTeacher(input)));
  });

  api.put('/teachers/:id', async (req, res) => {
    const id = idParam(req);
    if (!(await repo.getTeacher(id))) throw new HttpError(404, 'not_found', 'Professor não encontrado.');
    const input = parse(teacherSchema, req.body);
    await assertTeacherCodeFree(input.code, id);
    res.json(await db.transaction((tx) => createRepository(tx).updateTeacher(id, input)));
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

  // ---------------- Fotos dos professores ----------------
  api.get('/teachers/:id/photo', async (req, res) => {
    const photo = await repo.getTeacherPhoto(idParam(req));
    if (!photo) throw new HttpError(404, 'not_found', 'Este professor não tem foto.');
    // O endereço da foto muda a cada troca (?v=data), então ela pode ficar em cache no navegador.
    res.setHeader('Cache-Control', req.query.v ? 'private, max-age=31536000, immutable' : 'private, no-cache');
    res.setHeader('ETag', `"${Date.parse(photo.updatedAt)}"`);
    res.type(photo.mime).send(photo.data);
  });

  api.put('/teachers/:id/photo', async (req, res) => {
    const id = idParam(req);
    if (!(await repo.getTeacher(id))) throw new HttpError(404, 'not_found', 'Professor não encontrado.');
    const { mime, data } = decodePhoto(req.body?.dataUrl);
    await repo.setTeacherPhoto(id, mime, data);
    res.json(await repo.getTeacher(id));
  });

  api.delete('/teachers/:id/photo', async (req, res) => {
    const id = idParam(req);
    if (!(await repo.getTeacher(id))) throw new HttpError(404, 'not_found', 'Professor não encontrado.');
    await repo.deleteTeacherPhoto(id);
    res.json(await repo.getTeacher(id));
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

  // ---------------- Leitura em lote ----------------
  // Uma única requisição para vários conjuntos de dados (a interface agrupa as consultas feitas juntas).
  const RESOURCES = {
    teachers: () => repo.listTeachers(),
    classes: () => repo.listClasses(),
    subjects: () => repo.listSubjects(),
    periods: () => repo.listPeriods(),
    settings: () => repo.getSettings(),
    lessons: () => repo.listLessons(),
    assignments: () => repo.listAssignments(),
  } as const;
  type Resource = keyof typeof RESOURCES;

  api.get('/data', async (req, res) => {
    const names = String(req.query.include ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const unknown = names.filter((n) => !(n in RESOURCES));
    if (names.length === 0 || unknown.length) {
      throw new HttpError(400, 'invalid_include', `Conjuntos de dados inválidos: ${unknown.join(', ') || '(nenhum)'}.`);
    }
    const unique = [...new Set(names)] as Resource[];
    const values = await Promise.all(unique.map((n) => RESOURCES[n]()));
    res.json(Object.fromEntries(unique.map((n, i) => [n, values[i]])));
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

  // Reorganização do quadro: tudo ou nada, validando cada passo sobre o quadro já atualizado pelos anteriores.
  api.post('/lessons/batch', async (req, res) => {
    const batch = parse(lessonBatchSchema, req.body);
    if (!batch.removeIds.length && !batch.updates.length && !batch.creates.length) {
      throw new HttpError(422, 'empty_batch', 'Nenhuma alteração para aplicar.');
    }
    const result = await writeLesson(async (tx) => {
      for (const id of batch.removeIds) {
        if (!(await tx.deleteLesson(id))) throw new HttpError(409, 'stale', 'Uma das aulas foi alterada por outra pessoa. Feche e abra o quadro novamente.');
      }
      const updated = [];
      for (const { id, input } of batch.updates) {
        if (!(await tx.getLesson(id))) throw new HttpError(409, 'stale', 'Uma das aulas foi alterada por outra pessoa. Feche e abra o quadro novamente.');
        await validateOrThrow(tx, input, id);
        updated.push((await tx.updateLesson(id, input))!);
      }
      const created = [];
      for (const input of batch.creates) {
        await validateOrThrow(tx, input);
        created.push(await tx.createLesson(input));
      }
      return { removed: batch.removeIds.length, updated, created };
    });
    res.json(result);
  });

  api.delete('/lessons/:id', async (req, res) => {
    const id = idParam(req);
    if (!(await repo.deleteLesson(id))) throw new HttpError(404, 'not_found', 'Aula não encontrada.');
    res.status(204).end();
  });

  // ---------------- Atribuição de aulas ----------------
  api.get('/assignments', async (_req, res) => {
    res.json(await repo.listAssignments());
  });

  api.post('/assignments/batch', async (req, res) => {
    const batch = parse(assignmentBatchSchema, req.body);
    if (!batch.upserts.length && !batch.removes.length) throw new HttpError(422, 'empty_batch', 'Nenhuma alteração para aplicar.');
    const keys = batch.upserts.map((a) => `${a.classId}:${a.subjectId}`);
    if (new Set(keys).size !== keys.length) {
      throw new HttpError(422, 'duplicate', 'A mesma disciplina aparece duas vezes para uma turma. Cada turma tem um professor por disciplina.');
    }
    const [teachers, classes, subjects] = await Promise.all([repo.listTeachers(), repo.listClasses(), repo.listSubjects()]);
    for (const a of batch.upserts) {
      if (!teachers.some((t) => t.id === a.teacherId)) throw new HttpError(422, 'not_found', 'Um dos professores não existe mais. Atualize a página.');
      if (!classes.some((c) => c.id === a.classId)) throw new HttpError(422, 'not_found', 'Uma das turmas não existe mais. Atualize a página.');
      if (!subjects.some((s) => s.id === a.subjectId)) throw new HttpError(422, 'not_found', 'Uma das disciplinas não existe mais. Atualize a página.');
    }
    await db.transaction((tx) => createRepository(tx).applyAssignments(batch));
    res.json(await repo.listAssignments());
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
    if (error instanceof AuthError) {
      res.status(error.status).json({ error: { code: error.code, message: error.message } });
      return;
    }
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
