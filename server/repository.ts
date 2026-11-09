import { LESSON_LOCK_KEY, type Database, type Row } from './db.js';
import type {
  AssignmentBatchInput,
  AvailabilityInput,
  ClassInput,
  LessonInput,
  PeriodsReplaceInput,
  SettingsInput,
  SubjectInput,
  TeacherInput,
} from '../shared/schemas.js';
import type { Assignment, AvailabilitySlot, Lesson, Period, SchoolClass, Settings, ShiftKey, Subject, SubjectColor, Teacher, Unit } from '../shared/types.js';
import type { SegmentKey } from '../shared/segments.js';
import type { UnitInput } from '../shared/schemas.js';

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
    unitId: Number(r.unit_id),
    unitIds: Array.isArray(r.unit_ids) ? (r.unit_ids as unknown[]).map(Number) : [],
    segments: Array.isArray(r.segments) ? (r.segments as string[]).filter(Boolean) as SegmentKey[] : [],
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
    photoUpdatedAt: r.photo_updated_at ? iso(r.photo_updated_at) : null,
    subjectIds: Array.isArray(r.subject_ids) ? (r.subject_ids as unknown[]).map(Number) : [],
    availability: (typeof r.availability === 'string' ? JSON.parse(r.availability) : (r.availability ?? [])) as AvailabilitySlot[],
  };
}

/** Professores com a data da foto (se houver), sem carregar a imagem em si. */
const TEACHER_SELECT = `SELECT t.*, p.updated_at AS photo_updated_at,
  (SELECT COALESCE(array_agg(tu.unit_id ORDER BY tu.unit_id), '{}') FROM teacher_units tu WHERE tu.teacher_id = t.id) AS unit_ids,
  (SELECT COALESCE(array_agg(tsg.segment ORDER BY tsg.segment), '{}') FROM teacher_segments tsg WHERE tsg.teacher_id = t.id) AS segments,
  (SELECT COALESCE(array_agg(ts.subject_id ORDER BY ts.subject_id), '{}') FROM teacher_subjects ts WHERE ts.teacher_id = t.id) AS subject_ids,
  (SELECT COALESCE(json_agg(json_build_object('weekday', a.weekday, 'start', a.start_time, 'end', a.end_time) ORDER BY a.weekday, a.start_time), '[]'::json)
     FROM teacher_availability a WHERE a.teacher_id = t.id) AS availability
  FROM teachers t LEFT JOIN teacher_photos p ON p.teacher_id = t.id`;

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
    unitId: Number(r.unit_id),
    notes: text(r.notes),
    active: Boolean(r.active),
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
  };
}

function toUnit(r: Row): Unit {
  return {
    id: Number(r.id),
    code: String(r.code),
    name: String(r.name),
    city: text(r.city),
    active: Boolean(r.active),
  };
}

function toSubject(r: Row): Subject {
  return {
    id: Number(r.id),
    name: String(r.name),
    color: r.color as SubjectColor,
    segments: Array.isArray(r.segments) ? (r.segments as string[]).filter(Boolean) as SegmentKey[] : [],
    createdAt: iso(r.created_at),
  };
}

/** Disciplinas com os segmentos em que aparecem (vazio = em todos). */
const SUBJECT_SELECT = `SELECT s.*, (SELECT COALESCE(array_agg(ss.segment ORDER BY ss.segment), '{}') FROM subject_segments ss WHERE ss.subject_id = s.id) AS segments
  FROM subjects s`;

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
    unitId: Number(r.unit_id),
    weekday: Number(r.weekday) as Lesson['weekday'],
    start: String(r.start_time),
    end: String(r.end_time),
    notes: text(r.notes),
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
  };
}

function toAssignment(r: Row): Assignment {
  return {
    id: Number(r.id),
    teacherId: Number(r.teacher_id),
    classId: Number(r.class_id),
    subjectId: Number(r.subject_id),
    weeklyLessons: Number(r.weekly_lessons),
    updatedAt: iso(r.updated_at),
  };
}

/** Une intervalos do mesmo dia que se cruzam ou se encostam (ex.: 07:00–09:30 e 09:30–12:20 viram 07:00–12:20). */
function mergeSlots(slots: AvailabilitySlot[]): AvailabilitySlot[] {
  const sorted = [...slots].sort((a, b) => a.weekday - b.weekday || a.start.localeCompare(b.start));
  const out: AvailabilitySlot[] = [];
  for (const s of sorted) {
    const last = out[out.length - 1];
    if (last && last.weekday === s.weekday && s.start <= last.end) last.end = s.end > last.end ? s.end : last.end;
    else out.push({ ...s });
  }
  return out;
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
      const r = await one(
        'INSERT INTO teachers (name, code, area, phone, notes, active, unit_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
        [input.name, input.code, input.area, input.phone, input.notes, input.active, input.unitId ?? 1],
      );
      const id = Number(r!.id);
      await this.setTeacherUnits(id, input.unitIds.length ? input.unitIds : [input.unitId ?? 1]);
      await this.setTeacherSubjects(id, input.subjectIds);
      await this.setTeacherSegments(id, input.segments ?? []);
      return (await this.getTeacher(id))!;
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
      // Só mexe nas unidades quando o formulário as enviou (as demais telas não enviam).
      if (input.unitIds.length) await this.setTeacherUnits(id, input.unitIds);
      await this.setTeacherSubjects(id, input.subjectIds);
      // Só mexe nos segmentos quando o formulário os enviou (as demais telas não enviam).
      if (input.segments?.length) await this.setTeacherSegments(id, input.segments);
      return this.getTeacher(id);
    },
    /** Substitui os segmentos em que o professor leciona. */
    async setTeacherSegments(id: number, segments: SegmentKey[]): Promise<void> {
      await db.query('DELETE FROM teacher_segments WHERE teacher_id = $1', [id]);
      if (!segments.length) return;
      await db.query('INSERT INTO teacher_segments (teacher_id, segment) SELECT $1, s FROM unnest($2::text[]) AS s ON CONFLICT DO NOTHING', [id, segments]);
    },
    /** Substitui as unidades em que o professor atua (ids inexistentes são ignorados). */
    async setTeacherUnits(id: number, unitIds: number[]): Promise<void> {
      const valid = (await db.query('SELECT id FROM units WHERE id = ANY($1::int[])', [unitIds])).map((r) => Number(r.id));
      if (!valid.length) return;
      await db.query('DELETE FROM teacher_units WHERE teacher_id = $1 AND unit_id <> ALL($2::int[])', [id, valid]);
      await db.query('INSERT INTO teacher_units (teacher_id, unit_id) SELECT $1, u FROM unnest($2::int[]) AS u ON CONFLICT DO NOTHING', [id, valid]);
      await db.query('UPDATE teachers SET unit_id = $1, updated_at = now() WHERE id = $2 AND unit_id <> ALL($3::int[])', [valid[0], id, valid]);
    },
    /** Substitui as disciplinas do professor (ids inexistentes são ignorados). */
    async setTeacherSubjects(id: number, subjectIds: number[]): Promise<void> {
      await db.query('DELETE FROM teacher_subjects WHERE teacher_id = $1', [id]);
      if (subjectIds.length === 0) return;
      await db.query(
        'INSERT INTO teacher_subjects (teacher_id, subject_id) SELECT $1, s.id FROM subjects s WHERE s.id = ANY($2::int[]) ON CONFLICT DO NOTHING',
        [id, subjectIds],
      );
    },
    /** Registra que o professor leciona a disciplina (usado ao salvar aulas). */
    async linkTeacherSubject(teacherId: number, subjectId: number | null): Promise<void> {
      if (!subjectId) return;
      await db.query('INSERT INTO teacher_subjects (teacher_id, subject_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [teacherId, subjectId]);
    },
    // ---------- Unidades ----------
    async listUnits(): Promise<Unit[]> {
      return (await db.query('SELECT * FROM units ORDER BY id')).map(toUnit);
    },
    async getUnit(id: number): Promise<Unit | undefined> {
      const r = await one('SELECT * FROM units WHERE id = $1', [id]);
      return r ? toUnit(r) : undefined;
    },
    async findUnitByCode(code: string): Promise<Unit | undefined> {
      const r = await one('SELECT * FROM units WHERE code = $1', [code.trim().toUpperCase()]);
      return r ? toUnit(r) : undefined;
    },
    async createUnit(input: UnitInput): Promise<Unit> {
      const r = await one('INSERT INTO units (code, name, city, active) VALUES ($1, $2, $3, $4) RETURNING *', [
        input.code,
        input.name,
        input.city,
        input.active,
      ]);
      return toUnit(r!);
    },
    async updateUnit(id: number, input: UnitInput): Promise<Unit | undefined> {
      const r = await one('UPDATE units SET code = $1, name = $2, city = $3, active = $4, updated_at = now() WHERE id = $5 RETURNING *', [
        input.code,
        input.name,
        input.city,
        input.active,
        id,
      ]);
      return r ? toUnit(r) : undefined;
    },
    /** Quais unidades o professor atende (usado para bloquear aula em unidade em que ele não atua). */
    async teacherUnitIds(teacherId: number): Promise<number[]> {
      return (await db.query('SELECT unit_id FROM teacher_units WHERE teacher_id = $1 ORDER BY unit_id', [teacherId])).map((r) => Number(r.unit_id));
    },
    /** Substitui os dias e horários do professor na escola. Deve rodar dentro de uma transação. */
    async setTeacherAvailability(id: number, input: AvailabilityInput): Promise<void> {
      await db.query('DELETE FROM teacher_availability WHERE teacher_id = $1', [id]);
      for (const s of mergeSlots(input.slots)) {
        await db.query('INSERT INTO teacher_availability (teacher_id, weekday, start_time, end_time) VALUES ($1, $2, $3, $4)', [id, s.weekday, s.start, s.end]);
      }
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
      const r = await one('INSERT INTO classes (name, grade, shift, notes, active, unit_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *', [
        collapse(input.name),
        input.grade,
        input.shift,
        input.notes,
        input.active,
        input.unitId ?? 1,
      ]);
      return toClass(r!);
    },
    async updateClass(id: number, input: ClassInput): Promise<SchoolClass | undefined> {
      const r = await one(
        'UPDATE classes SET name = $1, grade = $2, shift = $3, notes = $4, active = $5, unit_id = COALESCE($6, unit_id), updated_at = now() WHERE id = $7 RETURNING *',
        [collapse(input.name), input.grade, input.shift, input.notes, input.active, input.unitId ?? null, id],
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
      return (await db.query(`${SUBJECT_SELECT} ORDER BY lower(s.name), s.id`)).map(toSubject);
    },
    async getSubject(id: number): Promise<Subject | undefined> {
      const r = await one(`${SUBJECT_SELECT} WHERE s.id = $1`, [id]);
      return r ? toSubject(r) : undefined;
    },
    async findSubjectByName(name: string): Promise<Subject | undefined> {
      const r = await one(`${SUBJECT_SELECT} WHERE lower(btrim(s.name)) = lower($1)`, [name.trim()]);
      return r ? toSubject(r) : undefined;
    },
    async createSubject(input: SubjectInput): Promise<Subject> {
      const r = await one('INSERT INTO subjects (name, color) VALUES ($1, $2) RETURNING id', [input.name, input.color]);
      const id = Number(r!.id);
      await this.setSubjectSegments(id, input.segments ?? []);
      return (await this.getSubject(id))!;
    },
    async updateSubject(id: number, input: SubjectInput): Promise<Subject | undefined> {
      await db.query('UPDATE subjects SET name = $1, color = $2 WHERE id = $3', [input.name, input.color, id]);
      await this.setSubjectSegments(id, input.segments ?? []);
      return this.getSubject(id);
    },
    /** Substitui os segmentos de uma disciplina (vazio = aparece em todos). */
    async setSubjectSegments(id: number, segments: SegmentKey[]): Promise<void> {
      await db.query('DELETE FROM subject_segments WHERE subject_id = $1', [id]);
      if (!segments.length) return;
      await db.query('INSERT INTO subject_segments (subject_id, segment) SELECT $1, s FROM unnest($2::text[]) AS s ON CONFLICT DO NOTHING', [id, segments]);
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

    // ---------- Atribuições ----------
    async listAssignments(): Promise<Assignment[]> {
      return (await db.query('SELECT * FROM assignments ORDER BY class_id, subject_id')).map(toAssignment);
    },
    /**
     * Remove e grava atribuições (uma por turma e disciplina). Quem recebe uma disciplina passa a constar
     * como professor dela. Deve rodar dentro de uma transação.
     */
    async applyAssignments(batch: AssignmentBatchInput): Promise<void> {
      for (const r of batch.removes) {
        await db.query('DELETE FROM assignments WHERE class_id = $1 AND subject_id = $2', [r.classId, r.subjectId]);
      }
      for (const a of batch.upserts) {
        await db.query(
          `INSERT INTO assignments (teacher_id, class_id, subject_id, weekly_lessons) VALUES ($1, $2, $3, $4)
           ON CONFLICT (class_id, subject_id) DO UPDATE
             SET teacher_id = excluded.teacher_id, weekly_lessons = excluded.weekly_lessons, updated_at = now()`,
          [a.teacherId, a.classId, a.subjectId, a.weeklyLessons],
        );
        await this.linkTeacherSubject(a.teacherId, a.subjectId);
      }
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
      await this.linkTeacherSubject(input.teacherId, input.subjectId);
      return toLesson(r!);
    },
    async updateLesson(id: number, input: LessonInput): Promise<Lesson | undefined> {
      const r = await one(
        'UPDATE lessons SET teacher_id = $1, class_id = $2, subject_id = $3, weekday = $4, start_time = $5, end_time = $6, notes = $7, updated_at = now() WHERE id = $8 RETURNING *',
        [input.teacherId, input.classId, input.subjectId, input.weekday, input.start, input.end, input.notes, id],
      );
      if (r) await this.linkTeacherSubject(input.teacherId, input.subjectId);
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
