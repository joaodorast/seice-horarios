/**
 * Ambiente de TESTE do SEICE: o mesmo sistema, com um banco PostgreSQL em memória (PGlite) e dados fictícios.
 * Não se conecta ao Supabase: nada feito aqui chega ao sistema real. Ao encerrar, tudo é descartado;
 * ao iniciar de novo, os dados de exemplo voltam ao estado original.
 *
 * Uso: `npm run demo` e acesse http://localhost:5180 com teste@seice.com / teste1234.
 */
import { openTestDatabase } from '../tests/helpers.js';
import { createApp } from '../server/app.js';
import { upsertUser } from '../server/auth.js';
import { runImport } from '../server/import.js';
import { ASSIGNMENTS_FROM_LESSONS } from '../server/migrations.js';

export const DEMO_PORT = Number(process.env.SEICE_DEMO_PORT ?? 3402);
export const DEMO_LOGIN = { email: 'teste@seice.com', password: 'teste1234', name: 'Usuário de Teste' };

const rows = (list: Record<string, string>[]) => list.map((values, i) => ({ line: i + 2, values }));

const TEACHERS: Record<string, string>[] = [
  { name: 'Ana Paula Souza', code: 'T-01', area: 'Matemática' },
  { name: 'Bruno Lima', code: 'T-02', area: 'Língua Portuguesa' },
  { name: 'Carla Mendes', code: 'T-03', area: 'Ciências' },
  { name: 'Diego Ferreira', code: 'T-04', area: 'História' },
  { name: 'Eduarda Costa', code: 'T-05', area: 'Ciências Humanas', subjects: 'Geografia, Projeto de Vida' },
  { name: 'Fábio Nogueira', code: 'T-06', area: 'Inglês' },
  { name: 'Gabriela Rocha', code: 'T-07', area: 'Artes' },
  { name: 'Henrique Alves', code: 'T-08', area: 'Educação Física' },
];

const CLASSES = [
  { name: '6º A', grade: '6º ano', shift: 'Manhã' },
  { name: '7º A', grade: '7º ano', shift: 'Manhã' },
  { name: '8º A', grade: '8º ano', shift: 'Tarde' },
  { name: '9º A', grade: '9º ano', shift: 'Tarde' },
];

const SUBJECTS = [
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

/** Grade parcial: deixa horários vagos de propósito, para dar o que testar no lançamento de aulas. */
function lessonPlan() {
  const teacherOf: Record<string, string> = Object.fromEntries(TEACHERS.map((t) => [t.area, t.name]));
  // Eduarda dá duas disciplinas: Geografia e Projeto de Vida.
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

// Login do ambiente de teste: cookie com nome próprio (não derruba o login do sistema real no mesmo computador)
// e chave fixa, para o "Manter conectado" continuar valendo depois de reiniciar o ambiente. Só vale aqui:
// o banco é em memória, com dados fictícios.
process.env.SESSION_COOKIE_NAME = 'seice_teste_session';
process.env.SESSION_SECRET = 'seice-ambiente-de-teste-somente-dados-ficticios';

const db = await openTestDatabase();
await upsertUser(db, DEMO_LOGIN.email, DEMO_LOGIN.name, DEMO_LOGIN.password);
// Disciplinas antes dos professores: a coluna "Disciplinas" dos professores usa os nomes cadastrados.
await runImport(db, 'subjects', { rows: rows(SUBJECTS), options: {} });
await runImport(db, 'teachers', { rows: rows(TEACHERS), options: {} });
await runImport(db, 'classes', { rows: rows(CLASSES), options: {} });
const lessons = await runImport(db, 'lessons', { rows: rows(lessonPlan()), options: {} });
// Atribuições a partir das aulas, com algumas turmas pedindo mais aulas do que já há no quadro (para testar o que falta).
await db.exec(ASSIGNMENTS_FROM_LESSONS);
await db.exec('UPDATE assignments SET weekly_lessons = weekly_lessons + 1 WHERE id % 3 = 0');

createApp(db).app.listen(DEMO_PORT, () => {
  console.log('\n  SEICE — AMBIENTE DE TESTE (dados fictícios em memória, nada vai para o sistema real)');
  console.log(`  ${TEACHERS.length} professores · ${CLASSES.length} turmas · ${SUBJECTS.length} disciplinas · ${lessons.summary.create} aulas`);
  console.log(`  Acesse http://localhost:5180  ·  login: ${DEMO_LOGIN.email} / ${DEMO_LOGIN.password}\n`);
});
