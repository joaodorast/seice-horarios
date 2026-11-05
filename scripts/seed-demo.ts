/**
 * Conta de demonstração do site publicado.
 *
 * Uso: `npx tsx scripts/seed-demo.ts` (grava no banco da DATABASE_URL, ou seja, no Supabase real).
 *
 * O que faz, e só isso:
 *  - cria (ou redefine a senha de) a conta teste@seice.com / teste1234, perfil "demo";
 *  - cria a unidade "DEMO — Demonstração" com professores, turmas, disciplinas e aulas fictícias;
 *  - NUNCA toca em professores, turmas, aulas ou usuários das unidades reais (CE e JP).
 *
 * Rodar de novo apaga e recria só os dados da unidade DEMO.
 */
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase } from '../server/db.js';
import { hashPassword, normalizeEmail } from '../server/auth.js';
import { runImport } from '../server/import.js';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
if (existsSync(join(root, '.env'))) process.loadEnvFile(join(root, '.env'));

const LOGIN = { email: 'teste@seice.com', password: 'teste1234', name: 'Conta de Demonstração' };
const UNIT = { code: 'DEMO', name: 'Demonstração', city: 'Dados fictícios' };

const db = await openDatabase(process.env.DATABASE_URL!, { migrate: false });
const rows = (list: Record<string, string>[]) => list.map((values, i) => ({ line: i + 2, values }));

// ---------------------------------------------------------------- Unidade DEMO
await db.query(
  `INSERT INTO units (code, name, city) VALUES ($1, $2, $3)
   ON CONFLICT (code) DO UPDATE SET name = excluded.name, city = excluded.city, active = true`,
  [UNIT.code, UNIT.name, UNIT.city],
);
const [unit] = await db.query<{ id: number }>('SELECT id FROM units WHERE code = $1', [UNIT.code]);
const unitId = Number(unit.id);

// ---------------------------------------------------------------- Usuário de demonstração
const hash = await hashPassword(LOGIN.password);
await db.query(
  `INSERT INTO users (email, name, password_hash, role, unit_id)
   VALUES ($1, $2, $3, 'demo', $4)
   ON CONFLICT ((lower(email))) DO UPDATE
     SET name = excluded.name, password_hash = excluded.password_hash, role = 'demo',
         unit_id = excluded.unit_id, session_version = users.session_version + 1,
         failed_attempts = 0, locked_until = NULL, updated_at = now()`,
  [normalizeEmail(LOGIN.email), LOGIN.name, hash, unitId],
);

// ---------------------------------------------------------------- Dados fictícios (só da unidade DEMO)
const clearDemo = async () => {
  await db.query('DELETE FROM lessons WHERE unit_id = $1', [unitId]);
  await db.query('DELETE FROM assignments WHERE class_id IN (SELECT id FROM classes WHERE unit_id = $1)', [unitId]);
  await db.query('DELETE FROM classes WHERE unit_id = $1', [unitId]);
  await db.query('DELETE FROM teachers WHERE unit_id = $1', [unitId]);
};

const SUBJECTS: Record<string, string>[] = [
  { name: 'Matemática', color: 'Azul' },
  { name: 'Língua Portuguesa', color: 'Rosa' },
  { name: 'Ciências', color: 'Verde' },
  { name: 'História', color: 'Amarelo' },
  { name: 'Geografia', color: 'Verde-água' },
  { name: 'Inglês', color: 'Violeta' },
  { name: 'Artes', color: 'Laranja' },
  { name: 'Educação Física', color: 'Verde-limão' },
  { name: 'Projeto de Vida', color: 'Azul-arroxeado' },
];

const TEACHERS: Record<string, string>[] = [
  { name: 'Ana Paula Souza', code: 'D-01', area: 'Matemática', units: 'DEMO' },
  { name: 'Bruno Lima', code: 'D-02', area: 'Língua Portuguesa', units: 'DEMO' },
  { name: 'Carla Mendes', code: 'D-03', area: 'Ciências', units: 'DEMO' },
  { name: 'Diego Ferreira', code: 'D-04', area: 'História', units: 'DEMO' },
  { name: 'Eduarda Costa', code: 'D-05', area: 'Ciências Humanas', subjects: 'Geografia, Projeto de Vida', units: 'DEMO' },
  { name: 'Fábio Nogueira', code: 'D-06', area: 'Inglês', units: 'DEMO' },
  { name: 'Gabriela Rocha', code: 'D-07', area: 'Artes', units: 'DEMO' },
  { name: 'Henrique Alves', code: 'D-08', area: 'Educação Física', units: 'DEMO' },
];

const CLASSES: Record<string, string>[] = [
  { name: '6º A (demo)', grade: '6º ano', shift: 'Manhã', units: 'DEMO' },
  { name: '7º A (demo)', grade: '7º ano', shift: 'Manhã', units: 'DEMO' },
  { name: '8º A (demo)', grade: '8º ano', shift: 'Tarde', units: 'DEMO' },
  { name: '9º A (demo)', grade: '9º ano', shift: 'Tarde', units: 'DEMO' },
];

/** Grade parcial de propósito: sobram horários vazios para testar o lançamento de aulas. */
function lessonPlan() {
  const teacherOf: Record<string, string> = Object.fromEntries(TEACHERS.map((t) => [t.area, t.name]));
  teacherOf['Geografia'] = 'Eduarda Costa';
  teacherOf['Projeto de Vida'] = 'Eduarda Costa';
  const rotation = ['Matemática', 'Língua Portuguesa', 'Ciências', 'História', 'Geografia', 'Inglês', 'Artes', 'Educação Física', 'Projeto de Vida'];
  const days = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];
  const plan: Record<string, string>[] = [];
  CLASSES.forEach((c, ci) => {
    days.forEach((day, di) => {
      for (let slot = 1; slot <= 4; slot++) {
        if ((ci + di + slot) % 4 === 0) continue;
        const area = rotation[(ci * 2 + di * 3 + slot) % rotation.length];
        plan.push({ class: c.name, teacher: teacherOf[area], subject: area, weekday: day, slot: `${slot}º horário` });
      }
    });
  });
  return plan;
}

await clearDemo();

// Disciplinas antes dos professores (a coluna Disciplinas usa os nomes já cadastrados).
await runImport(db, 'subjects', { rows: rows(SUBJECTS), options: {} });
await runImport(db, 'teachers', { rows: rows(TEACHERS), options: {} });
await runImport(db, 'classes', { rows: rows(CLASSES), options: {} });
await runImport(db, 'lessons', { rows: rows(lessonPlan()), options: {} });

// Atribuições a partir das aulas, com algumas turmas pedindo mais aulas do que já existem.
await db.exec(`
  INSERT INTO assignments (teacher_id, class_id, subject_id, weekly_lessons)
  SELECT DISTINCT ON (l.class_id, l.subject_id) l.teacher_id, l.class_id, l.subject_id,
         (SELECT count(*) FROM lessons x WHERE x.class_id = l.class_id AND x.subject_id = l.subject_id)::smallint
  FROM lessons l
  JOIN classes c ON c.id = l.class_id
  WHERE c.unit_id = ${unitId} AND l.subject_id IS NOT NULL
  ON CONFLICT (class_id, subject_id) DO NOTHING
`);
await db.query('UPDATE assignments SET weekly_lessons = LEAST(weekly_lessons + 1, 40) WHERE id % 3 = 0');

// Dias e horários na escola: Fábio só vem segunda, quarta e sexta; Gabriela não vem às sextas.
await db.exec(`
  INSERT INTO teacher_availability (teacher_id, weekday, start_time, end_time)
  SELECT t.id, d.weekday, d.start_time, d.end_time FROM teachers t
  JOIN (VALUES ('D-06', 1, '07:00', '17:30'), ('D-06', 3, '07:00', '17:30'), ('D-06', 5, '07:00', '17:30'),
               ('D-07', 1, '07:00', '17:30'), ('D-07', 2, '07:00', '17:30'), ('D-07', 3, '07:00', '17:30'), ('D-07', 4, '07:00', '17:30'))
    AS d (code, weekday, start_time, end_time) ON d.code = t.code
  WHERE t.unit_id = ${unitId}
`);

const [resumo] = await db.query<{ teachers: number; classes: number; lessons: number }>(`
  SELECT (SELECT count(*) FROM teachers WHERE unit_id = ${unitId})::int AS teachers,
         (SELECT count(*) FROM classes WHERE unit_id = ${unitId})::int AS classes,
         (SELECT count(*) FROM lessons WHERE unit_id = ${unitId})::int AS lessons
`);

await db.close();

console.log('\n  Conta de demonstração pronta no banco:');
console.log(`    login: ${LOGIN.email}   senha: ${LOGIN.password}`);
console.log(`    unidade: ${UNIT.code} — ${UNIT.name}`);
console.log(`    ${resumo.teachers} professores · ${resumo.classes} turmas · ${resumo.lessons} aulas fictícias`);
console.log('    as unidades CE e JP não foram tocadas.\n');
