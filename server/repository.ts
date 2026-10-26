import { LESSON_LOCK_KEY, type Database, type Row } from './db.js';
import type {
  ClassInput,
  LessonInput,
  PeriodsReplaceInput,
  SettingsInput,
  SubjectInput,
  TeacherInput,
} from '../shared/schemas.js';
import type { Lesson, Period, SchoolClass, Settings, ShiftKey, Subject, SubjectColor, Teacher } from '../shared/types.js';

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v));
const text = (v: unknown) => (v === null || v === undefined ? null : String(v));

function toTeacher(r: Row): Teacher {
  return {
    id: Number(r.id),
    name: String(r.name),
    code: text(r.code),
    area: text(r.area),
    phone: text(r.phone),
    notes: text(r.notes),
    active: Boolean(r.active),
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
    photoUpdatedAt: r.photo_updated_at ? iso(r.photo_updated_at) : null,
  };
}

/** Professores com a data da foto (se houver), sem carregar a imagem em si. */
const TEACHER_SELECT = 'SELECT t.*, p.updated_at AS photo_updated_at FROM teachers t LEFT JOIN teacher_photos p ON p.teacher_id = t.id';

export interface TeacherPhoto {
  mime: string;
  data: Buffer;
  updatedAt: string;
}

function toClass(r: Row): SchoolClass {
  return {
    id: Number(r.id),
    name: String(r.name),
    grade: String(r.grade),
    shift: r.shift as SchoolClass['shift'],
    notes: text(r.notes),
    active: Boolean(r.active),
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
  };
}

function toSubject(r: Row): Subject {
  return { id: Number(r.id), name: String(r.name), color: r.color as SubjectColor, createdAt: iso(r.created_at) };
}

function toPeriod(r: Row): Period {
  return {
    id: Number(r.id),
    shift: r.shift as ShiftKey,
    label: String(r.label),
    start: String(r.start_time),
    end: String(r.end_time),
    kind: r.kind as Period['kind'],
    sortOrder: Number(r.sort_order),
  };
}

function toLesson(r: Row): Lesson {
  return {
    id: Number(r.id),
    teacherId: Number(r.teacher_id),
    classId: Number(r.class_id),
    subjectId: r.subject_id === null || r.subject_id === undefined ? null : Number(r.subject_id),
    weekday: Number(r.weekday) as Lesson['weekday'],
    start: String(r.start_time),
    end: String(r.end_time),
    notes: text(r.notes),
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
  };
}

const collapse = (name: string) => name.replace(/\s+/g, ' ').trim();

/**
 * Acesso aos dados. Recebe o banco ou uma transação: `createRepository(tx)` dentro de
 * `db.transaction` faz todas as leituras e gravações enxergarem o mesmo estado.
 */
export function createRepository(db: Database) {
  const one = async (sql: string, params: unknown[]) => (await db.query(sql, params))[0];

  return {
    // ---------- Professores ----------
    async listTeachers(): Promise<Teacher[]> {
      return (await db.query(`${TEACHER_SELECT} ORDER BY lower(t.name), t.id`)).map(toTeacher);
    },
    async getTeacher(id: number): Promise<Teacher | undefined> {
      const r = await one(`${TEACHER_SELECT} WHERE t.id = $1`, [id]);
      return r ? toTeacher(r) : undefined;
    },
    async findTeacherByCode(code: string): Promise<Teacher | undefined> {
      const r = await one(`${TEACHER_SELECT} WHERE lower(t.code) = lower($1)`, [code]);
      return r ? toTeacher(r) : undefined;
    },
    async createTeacher(input: TeacherInput): Promise<Teacher> {
      const r = await one('INSERT INTO teachers (name, code, area, phone, notes, active) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id', [
        input.name,
        input.code,
        input.area,
        input.phone,
        input.notes,
        input.active,
      ]);
      return (await this.getTeacher(Number(r!.id)))!;
    },
    async updateTeacher(id: number, input: TeacherInput): Promise<Teacher | undefined> {
      await db.query('UPDATE teachers SET name = $1, code = $2, area = $3, phone = $4, notes = $5, active = $6, updated_at = now() WHERE id = $7', [
        input.name,
        input.code,
        input.area,
        input.phone,
        input.notes,
        input.active,
        id,
      ]);
      return this.getTeacher(id);
    },
    async setTeacherActive(id: number, active: boolean): Promise<Teacher | undefined> {
      await db.query('UPDATE teachers SET active = $1, updated_at = now() WHERE id = $2', [active, id]);
      return this.getTeacher(id);
    },
    async getTeacherPhoto(id: number): Promise<TeacherPhoto | undefined> {
      const r = await one('SELECT mime, data, updated_at FROM teacher_photos WHERE teacher_id = $1', [id]);
      return r ? { mime: String(r.mime), data: Buffer.from(r.data as Uint8Array), updatedAt: iso(r.updated_at) } : undefined;
    },
    async setTeacherPhoto(id: number, mime: string, data: Buffer): Promise<void> {
      await db.query(
        `INSERT INTO teacher_photos (teacher_id, mime, data) VALUES ($1, $2, $3)
         ON CONFLICT (teacher_id) DO UPDATE SET mime = excluded.mime, data = excluded.data, updated_at = now()`,
        [id, mime, data],
      );
    },
    async deleteTeacherPhoto(id: number): Promise<boolean> {
      return (await db.query('DELETE FROM teacher_photos WHERE teacher_id = $1 RETURNING teacher_id', [id])).length > 0;
    },
    async deleteTeacher(id: number, withLessons: boolean): Promise<void> {
      if (withLessons) await db.query('DELETE FROM lessons WHERE teacher_id = $1', [id]);
      await db.query('DELETE FROM teachers WHERE id = $1', [id]);
    },

    // ---------- Turmas ----------
    async listClasses(): Promise<SchoolClass[]> {
      return (await db.query('SELECT * FROM classes ORDER BY lower(name), id')).map(toClass);
    },
    async getClass(id: number): Promise<SchoolClass | undefined> {
      const r = await one('SELECT * FROM classes WHERE id = $1', [id]);
      return r ? toClass(r) : undefined;
    },
    async findClassByName(name: string): Promise<SchoolClass | undefined> {
      const r = await one("SELECT * FROM classes WHERE lower(regexp_replace(btrim(name), '\\s+', ' ', 'g')) = lower($1)", [collapse(name)]);
      return r ? toClass(r) : undefined;
    },
    async createClass(input: ClassInput): Promise<SchoolClass> {
      const r = await one('INSERT INTO classes (name, grade, shift, notes, active) VALUES ($1, $2, $3, $4, $5) RETURNING *', [
        collapse(input.name),
        input.grade,
        input.shift,
        input.notes,
        input.active,
      ]);
      return toClass(r!);
    },
    async updateClass(id: number, input: ClassInput): Promise<SchoolClass | undefined> {
      const r = await one(
        'UPDATE classes SET name = $1, grade = $2, shift = $3, notes = $4, active = $5, updated_at = now() WHERE id = $6 RETURNING *',
        [collapse(input.name), input.grade, input.shift, input.notes, input.active, id],
      );
      return r ? toClass(r) : undefined;
    },
    async setClassActive(id: number, active: boolean): Promise<SchoolClass | undefined> {
      const r = await one('UPDATE classes SET active = $1, updated_at = now() WHERE id = $2 RETURNING *', [active, id]);
      return r ? toClass(r) : undefined;
    },
    async deleteClass(id: number, withLessons: boolean): Promise<void> {
      if (withLessons) await db.query('DELETE FROM lessons WHERE class_id = $1', [id]);
      await db.query('DELETE FROM classes WHERE id = $1', [id]);
    },

    // ---------- Disciplinas ----------
    async listSubjects(): Promise<Subject[]> {
      return (await db.query('SELECT * FROM subjects ORDER BY lower(name), id')).map(toSubject);
    },
    async getSubject(id: number): Promise<Subject | undefined> {
      const r = await one('SELECT * FROM subjects WHERE id = $1', [id]);
      return r ? toSubject(r) : undefined;
    },
    async findSubjectByName(name: string): Promise<Subject | undefined> {
      const r = await one('SELECT * FROM subjects WHERE lower(btrim(name)) = lower($1)', [name.trim()]);
      return r ? toSubject(r) : undefined;
    },
    async createSubject(input: SubjectInput): Promise<Subject> {
      const r = await one('INSERT INTO subjects (name, color) VALUES ($1, $2) RETURNING *', [input.name, input.color]);
      return toSubject(r!);
    },
    async updateSubject(id: number, input: SubjectInput): Promise<Subject | undefined> {
      const r = await one('UPDATE subjects SET name = $1, color = $2 WHERE id = $3 RETURNING *', [input.name, input.color, id]);
      return r ? toSubject(r) : undefined;
    },
    async deleteSubject(id: number, detachLessons: boolean): Promise<void> {
      if (detachLessons) await db.query('UPDATE lessons SET subject_id = NULL, updated_at = now() WHERE subject_id = $1', [id]);
      await db.query('DELETE FROM subjects WHERE id = $1', [id]);
    },

    // ---------- Períodos ----------
    async listPeriods(): Promise<Period[]> {
      return (await db.query('SELECT * FROM periods ORDER BY shift, start_time, sort_order')).map(toPeriod);
    },
    /** Substitui os períodos de um turno. Deve rodar dentro de uma transação. */
    async replacePeriods(shift: ShiftKey, input: PeriodsReplaceInput): Promise<void> {
      await db.query('DELETE FROM periods WHERE shift = $1', [shift]);
      const sorted = [...input.periods].sort((a, b) => a.start.localeCompare(b.start));
      for (const [i, p] of sorted.entries()) {
        await db.query('INSERT INTO periods (shift, label, start_time, end_time, kind, sort_order) VALUES ($1, $2, $3, $4, $5, $6)', [
          shift,
          p.label,
          p.start,
          p.end,
          p.kind,
          i,
        ]);
      }
    },

    // ---------- Configurações ----------
    async getSettings(): Promise<Settings> {
      const rows = await db.query<{ key: string; value: unknown }>('SELECT key, value FROM settings');
      const map = Object.fromEntries(rows.map((r) => [r.key, r.value])) as Partial<Settings>;
      return {
        enabledDays: map.enabledDays ?? [1, 2, 3, 4, 5],
        enabledShifts: map.enabledShifts ?? ['manha', 'tarde'],
        lessonDuration: map.lessonDuration ?? 50,
      };
    },
    /** Grava as configurações. Deve rodar dentro de uma transação. */
    async updateSettings(input: SettingsInput): Promise<void> {
      const sql = 'INSERT INTO settings (key, value) VALUES ($1, $2::jsonb) ON CONFLICT (key) DO UPDATE SET value = excluded.value';
      await db.query(sql, ['enabledDays', JSON.stringify(input.enabledDays)]);
      await db.query(sql, ['enabledShifts', JSON.stringify(input.enabledShifts)]);
      await db.query(sql, ['lessonDuration', JSON.stringify(input.lessonDuration)]);
    },

    // ---------- Aulas ----------
    async listLessons(): Promise<Lesson[]> {
      return (await db.query('SELECT * FROM lessons ORDER BY weekday, start_time, id')).map(toLesson);
    },
    async getLesson(id: number): Promise<Lesson | undefined> {
      const r = await one('SELECT * FROM lessons WHERE id = $1', [id]);
      return r ? toLesson(r) : undefined;
    },
    async countLessonsBy(column: 'teacher_id' | 'class_id' | 'subject_id', id: number): Promise<number> {
      const r = await one(`SELECT COUNT(*) AS n FROM lessons WHERE ${column} = $1`, [id]);
      return Number(r?.n ?? 0);
    },
    async createLesson(input: LessonInput): Promise<Lesson> {
      const r = await one(
        'INSERT INTO lessons (teacher_id, class_id, subject_id, weekday, start_time, end_time, notes) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
        [input.teacherId, input.classId, input.subjectId, input.weekday, input.start, input.end, input.notes],
      );
      return toLesson(r!);
    },
    async updateLesson(id: number, input: LessonInput): Promise<Lesson | undefined> {
      const r = await one(
        'UPDATE lessons SET teacher_id = $1, class_id = $2, subject_id = $3, weekday = $4, start_time = $5, end_time = $6, notes = $7, updated_at = now() WHERE id = $8 RETURNING *',
        [input.teacherId, input.classId, input.subjectId, input.weekday, input.start, input.end, input.notes, id],
      );
      return r ? toLesson(r) : undefined;
    },
    async deleteLesson(id: number): Promise<boolean> {
      return (await db.query('DELETE FROM lessons WHERE id = $1 RETURNING id', [id])).length > 0;
    },
    async deleteLessonsBy(column: 'teacher_id' | 'class_id', ids: number[]): Promise<number> {
      if (ids.length === 0) return 0;
      return (await db.query(`DELETE FROM lessons WHERE ${column} = ANY($1::int[]) RETURNING id`, [ids])).length;
    },
    /**
     * Serializa as gravações de aulas até o fim da transação atual, para que a validação de conflitos
     * e a gravação vejam o mesmo quadro mesmo com vários usuários salvando ao mesmo tempo.
     */
    async lockLessons(): Promise<void> {
      await db.query('SELECT pg_advisory_xact_lock($1)', [LESSON_LOCK_KEY]);
    },
  };
}

export type Repository = ReturnType<typeof createRepository>;
