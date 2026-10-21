import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { DatabaseSync as DatabaseSyncType } from 'node:sqlite';

export type Database = DatabaseSyncType;

const require = createRequire(import.meta.url);

const SCHEMA_VERSION = 1;

const SCHEMA = /* sql */ `
CREATE TABLE IF NOT EXISTS teachers (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL CHECK (length(trim(name)) >= 3),
  code        TEXT UNIQUE COLLATE NOCASE,
  area        TEXT,
  phone       TEXT,
  notes       TEXT,
  active      INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS classes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL UNIQUE COLLATE NOCASE,
  grade       TEXT NOT NULL,
  shift       TEXT NOT NULL CHECK (shift IN ('manha', 'tarde', 'noite', 'integral')),
  notes       TEXT,
  active      INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS subjects (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL UNIQUE COLLATE NOCASE,
  color       TEXT NOT NULL DEFAULT 'slate',
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS periods (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  shift       TEXT NOT NULL CHECK (shift IN ('manha', 'tarde', 'noite')),
  label       TEXT NOT NULL,
  start_time  TEXT NOT NULL,
  end_time    TEXT NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('aula', 'intervalo')),
  sort_order  INTEGER NOT NULL DEFAULT 0,
  CHECK (end_time > start_time)
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS lessons (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  teacher_id  INTEGER NOT NULL REFERENCES teachers(id) ON DELETE RESTRICT,
  class_id    INTEGER NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  subject_id  INTEGER REFERENCES subjects(id) ON DELETE RESTRICT,
  weekday     INTEGER NOT NULL CHECK (weekday BETWEEN 1 AND 6),
  start_time  TEXT NOT NULL,
  end_time    TEXT NOT NULL,
  notes       TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_lessons_teacher_day ON lessons (teacher_id, weekday);
CREATE INDEX IF NOT EXISTS idx_lessons_class_day ON lessons (class_id, weekday);

-- Última linha de defesa: o próprio banco recusa aulas sobrepostas para o mesmo professor ou turma,
-- independentemente de qual interface ou script esteja gravando os dados.
CREATE TRIGGER IF NOT EXISTS lessons_no_overlap_insert
BEFORE INSERT ON lessons
WHEN EXISTS (
  SELECT 1 FROM lessons
  WHERE weekday = NEW.weekday
    AND (teacher_id = NEW.teacher_id OR class_id = NEW.class_id)
    AND start_time < NEW.end_time AND NEW.start_time < end_time
)
BEGIN
  SELECT RAISE(ABORT, 'LESSON_OVERLAP');
END;

CREATE TRIGGER IF NOT EXISTS lessons_no_overlap_update
BEFORE UPDATE OF teacher_id, class_id, weekday, start_time, end_time ON lessons
WHEN EXISTS (
  SELECT 1 FROM lessons
  WHERE id <> NEW.id
    AND weekday = NEW.weekday
    AND (teacher_id = NEW.teacher_id OR class_id = NEW.class_id)
    AND start_time < NEW.end_time AND NEW.start_time < end_time
)
BEGIN
  SELECT RAISE(ABORT, 'LESSON_OVERLAP');
END;
`;

/** Configuração inicial editável em Configurações. Não representa a grade oficial da instituição. */
const DEFAULT_PERIODS: Array<[string, string, string, string, 'aula' | 'intervalo']> = [
  ['manha', '1º horário', '07:00', '07:50', 'aula'],
  ['manha', '2º horário', '07:50', '08:40', 'aula'],
  ['manha', '3º horário', '08:40', '09:30', 'aula'],
  ['manha', 'Intervalo', '09:30', '09:50', 'intervalo'],
  ['manha', '4º horário', '09:50', '10:40', 'aula'],
  ['manha', '5º horário', '10:40', '11:30', 'aula'],
  ['manha', '6º horário', '11:30', '12:20', 'aula'],
  ['tarde', '1º horário', '13:00', '13:50', 'aula'],
  ['tarde', '2º horário', '13:50', '14:40', 'aula'],
  ['tarde', '3º horário', '14:40', '15:30', 'aula'],
  ['tarde', 'Intervalo', '15:30', '15:50', 'intervalo'],
  ['tarde', '4º horário', '15:50', '16:40', 'aula'],
  ['tarde', '5º horário', '16:40', '17:30', 'aula'],
  ['noite', '1º horário', '18:30', '19:15', 'aula'],
  ['noite', '2º horário', '19:15', '20:00', 'aula'],
  ['noite', 'Intervalo', '20:00', '20:15', 'intervalo'],
  ['noite', '3º horário', '20:15', '21:00', 'aula'],
  ['noite', '4º horário', '21:00', '21:45', 'aula'],
];

export function openDatabase(file: string): Database {
  const { DatabaseSync } = require('node:sqlite') as typeof import('node:sqlite');
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = ON;');
  if (file !== ':memory:') db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA busy_timeout = 5000;');
  migrate(db);
  return db;
}

function migrate(db: Database) {
  const row = db.prepare('PRAGMA user_version').get() as { user_version: number };
  if (row.user_version >= SCHEMA_VERSION) return;
  transaction(db, () => {
    db.exec(SCHEMA);
    const hasSettings = db.prepare('SELECT COUNT(*) AS n FROM settings').get() as { n: number };
    if (hasSettings.n === 0) {
      const put = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
      put.run('enabledDays', JSON.stringify([1, 2, 3, 4, 5]));
      put.run('enabledShifts', JSON.stringify(['manha', 'tarde']));
      put.run('lessonDuration', JSON.stringify(50));
    }
    const hasPeriods = db.prepare('SELECT COUNT(*) AS n FROM periods').get() as { n: number };
    if (hasPeriods.n === 0) {
      const insert = db.prepare(
        'INSERT INTO periods (shift, label, start_time, end_time, kind, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
      );
      DEFAULT_PERIODS.forEach(([shift, label, start, end, kind], i) => insert.run(shift, label, start, end, kind, i));
    }
    db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  });
}

export function transaction<T>(db: Database, fn: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
