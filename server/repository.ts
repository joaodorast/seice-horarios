import type { Database } from './db';
import { transaction } from './db';
import type {
  ClassInput,
  LessonInput,
  PeriodsReplaceInput,
  SettingsInput,
  SubjectInput,
  TeacherInput,
} from '../shared/schemas';
import type { Lesson, Period, SchoolClass, Settings, ShiftKey, Subject, SubjectColor, Teacher } from '../shared/types';

type Row = Record<string, unknown>;

const now = () => new Date().toISOString();

function toTeacher(r: Row): Teacher {
  return {
    id: Number(r.id),
    name: String(r.name),
    code: (r.code as string | null) ?? null,
    area: (r.area as string | null) ?? null,
    phone: (r.phone as string | null) ?? null,
    notes: (r.notes as string | null) ?? null,
    active: Number(r.active) === 1,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

function toClass(r: Row): SchoolClass {
  return {
    id: Number(r.id),
    name: String(r.name),
    grade: String(r.grade),
    shift: r.shift as SchoolClass['shift'],
    notes: (r.notes as string | null) ?? null,
    active: Number(r.active) === 1,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

function toSubject(r: Row): Subject {
  return { id: Number(r.id), name: String(r.name), color: r.color as SubjectColor, createdAt: String(r.created_at) };
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
    notes: (r.notes as string | null) ?? null,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

export function createRepository(db: Database) {
  return {
    // ---------- Professores ----------
    listTeachers(): Teacher[] {
      return (db.prepare('SELECT * FROM teachers ORDER BY name COLLATE NOCASE').all() as Row[]).map(toTeacher);
    },
    getTeacher(id: number): Teacher | undefined {
      const r = db.prepare('SELECT * FROM teachers WHERE id = ?').get(id) as Row | undefined;
      return r ? toTeacher(r) : undefined;
    },
    findTeacherByCode(code: string): Teacher | undefined {
      const r = db.prepare('SELECT * FROM teachers WHERE code = ? COLLATE NOCASE').get(code) as Row | undefined;
      return r ? toTeacher(r) : undefined;
    },
    createTeacher(input: TeacherInput): Teacher {
      const ts = now();
      const res = db
        .prepare(
          'INSERT INTO teachers (name, code, area, phone, notes, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .run(input.name, input.code, input.area, input.phone, input.notes, input.active ? 1 : 0, ts, ts);
      return this.getTeacher(Number(res.lastInsertRowid))!;
    },
    updateTeacher(id: number, input: TeacherInput): Teacher | undefined {
      db.prepare(
        'UPDATE teachers SET name = ?, code = ?, area = ?, phone = ?, notes = ?, active = ?, updated_at = ? WHERE id = ?',
      ).run(input.name, input.code, input.area, input.phone, input.notes, input.active ? 1 : 0, now(), id);
      return this.getTeacher(id);
    },
    setTeacherActive(id: number, active: boolean): Teacher | undefined {
      db.prepare('UPDATE teachers SET active = ?, updated_at = ? WHERE id = ?').run(active ? 1 : 0, now(), id);
      return this.getTeacher(id);
    },
    deleteTeacher(id: number, withLessons: boolean): void {
      transaction(db, () => {
        if (withLessons) db.prepare('DELETE FROM lessons WHERE teacher_id = ?').run(id);
        db.prepare('DELETE FROM teachers WHERE id = ?').run(id);
      });
    },

    // ---------- Turmas ----------
    listClasses(): SchoolClass[] {
      return (db.prepare('SELECT * FROM classes ORDER BY name COLLATE NOCASE').all() as Row[]).map(toClass);
    },
    getClass(id: number): SchoolClass | undefined {
      const r = db.prepare('SELECT * FROM classes WHERE id = ?').get(id) as Row | undefined;
      return r ? toClass(r) : undefined;
    },
    findClassByName(name: string): SchoolClass | undefined {
      const normalized = name.replace(/\s+/g, ' ').trim();
      const r = db
        .prepare("SELECT * FROM classes WHERE lower(trim(name)) = lower(?)")
        .get(normalized) as Row | undefined;
      return r ? toClass(r) : undefined;
    },
    createClass(input: ClassInput): SchoolClass {
      const ts = now();
      const res = db
        .prepare('INSERT INTO classes (name, grade, shift, notes, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(input.name.replace(/\s+/g, ' '), input.grade, input.shift, input.notes, input.active ? 1 : 0, ts, ts);
      return this.getClass(Number(res.lastInsertRowid))!;
    },
    updateClass(id: number, input: ClassInput): SchoolClass | undefined {
      db.prepare('UPDATE classes SET name = ?, grade = ?, shift = ?, notes = ?, active = ?, updated_at = ? WHERE id = ?').run(
        input.name.replace(/\s+/g, ' '),
        input.grade,
        input.shift,
        input.notes,
        input.active ? 1 : 0,
        now(),
        id,
      );
      return this.getClass(id);
    },
    setClassActive(id: number, active: boolean): SchoolClass | undefined {
      db.prepare('UPDATE classes SET active = ?, updated_at = ? WHERE id = ?').run(active ? 1 : 0, now(), id);
      return this.getClass(id);
    },
    deleteClass(id: number, withLessons: boolean): void {
      transaction(db, () => {
        if (withLessons) db.prepare('DELETE FROM lessons WHERE class_id = ?').run(id);
        db.prepare('DELETE FROM classes WHERE id = ?').run(id);
      });
    },

    // ---------- Disciplinas ----------
    listSubjects(): Subject[] {
      return (db.prepare('SELECT * FROM subjects ORDER BY name COLLATE NOCASE').all() as Row[]).map(toSubject);
    },
    getSubject(id: number): Subject | undefined {
      const r = db.prepare('SELECT * FROM subjects WHERE id = ?').get(id) as Row | undefined;
      return r ? toSubject(r) : undefined;
    },
    findSubjectByName(name: string): Subject | undefined {
      const r = db.prepare('SELECT * FROM subjects WHERE lower(trim(name)) = lower(?)').get(name.trim()) as Row | undefined;
      return r ? toSubject(r) : undefined;
    },
    createSubject(input: SubjectInput): Subject {
      const res = db.prepare('INSERT INTO subjects (name, color, created_at) VALUES (?, ?, ?)').run(input.name, input.color, now());
      return this.getSubject(Number(res.lastInsertRowid))!;
    },
    updateSubject(id: number, input: SubjectInput): Subject | undefined {
      db.prepare('UPDATE subjects SET name = ?, color = ? WHERE id = ?').run(input.name, input.color, id);
      return this.getSubject(id);
    },
    deleteSubject(id: number, detachLessons: boolean): void {
      transaction(db, () => {
        if (detachLessons) db.prepare('UPDATE lessons SET subject_id = NULL, updated_at = ? WHERE subject_id = ?').run(now(), id);
        db.prepare('DELETE FROM subjects WHERE id = ?').run(id);
      });
    },

    // ---------- Períodos ----------
    listPeriods(): Period[] {
      return (db.prepare('SELECT * FROM periods ORDER BY shift, start_time, sort_order').all() as Row[]).map(toPeriod);
    },
    replacePeriods(shift: ShiftKey, input: PeriodsReplaceInput): Period[] {
      transaction(db, () => {
        db.prepare('DELETE FROM periods WHERE shift = ?').run(shift);
        const insert = db.prepare(
          'INSERT INTO periods (shift, label, start_time, end_time, kind, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
        );
        [...input.periods]
          .sort((a, b) => a.start.localeCompare(b.start))
          .forEach((p, i) => insert.run(shift, p.label, p.start, p.end, p.kind, i));
      });
      return this.listPeriods();
    },

    // ---------- Configurações ----------
    getSettings(): Settings {
      const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
      const map = Object.fromEntries(rows.map((r) => [r.key, JSON.parse(r.value)]));
      return {
        enabledDays: map.enabledDays ?? [1, 2, 3, 4, 5],
        enabledShifts: map.enabledShifts ?? ['manha', 'tarde'],
        lessonDuration: map.lessonDuration ?? 50,
      };
    },
    updateSettings(input: SettingsInput): Settings {
      transaction(db, () => {
        const put = db.prepare(
          'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        );
        put.run('enabledDays', JSON.stringify(input.enabledDays));
        put.run('enabledShifts', JSON.stringify(input.enabledShifts));
        put.run('lessonDuration', JSON.stringify(input.lessonDuration));
      });
      return this.getSettings();
    },

    // ---------- Aulas ----------
    listLessons(): Lesson[] {
      return (db.prepare('SELECT * FROM lessons ORDER BY weekday, start_time').all() as Row[]).map(toLesson);
    },
    getLesson(id: number): Lesson | undefined {
      const r = db.prepare('SELECT * FROM lessons WHERE id = ?').get(id) as Row | undefined;
      return r ? toLesson(r) : undefined;
    },
    countLessonsBy(column: 'teacher_id' | 'class_id' | 'subject_id', id: number): number {
      const r = db.prepare(`SELECT COUNT(*) AS n FROM lessons WHERE ${column} = ?`).get(id) as { n: number };
      return Number(r.n);
    },
    createLesson(input: LessonInput): Lesson {
      const ts = now();
      const res = db
        .prepare(
          'INSERT INTO lessons (teacher_id, class_id, subject_id, weekday, start_time, end_time, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .run(input.teacherId, input.classId, input.subjectId, input.weekday, input.start, input.end, input.notes, ts, ts);
      return this.getLesson(Number(res.lastInsertRowid))!;
    },
    updateLesson(id: number, input: LessonInput): Lesson | undefined {
      db.prepare(
        'UPDATE lessons SET teacher_id = ?, class_id = ?, subject_id = ?, weekday = ?, start_time = ?, end_time = ?, notes = ?, updated_at = ? WHERE id = ?',
      ).run(input.teacherId, input.classId, input.subjectId, input.weekday, input.start, input.end, input.notes, now(), id);
      return this.getLesson(id);
    },
    deleteLesson(id: number): boolean {
      const res = db.prepare('DELETE FROM lessons WHERE id = ?').run(id);
      return Number(res.changes) > 0;
    },

    /** Executa a escrita dentro de uma transação, garantindo que a validação e a gravação vejam o mesmo estado. */
    inTransaction<T>(fn: () => T): T {
      return transaction(db, fn);
    },
  };
}

export type Repository = ReturnType<typeof createRepository>;
