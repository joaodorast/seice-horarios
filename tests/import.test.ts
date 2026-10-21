import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestServer, type TestServer } from './helpers.js';
import type { Database } from '../server/db.js';
import {
  IMPORT_SPECS,
  guessMapping,
  parseActive,
  parseClassShift,
  parseColor,
  parseOrdinal,
  parseTime,
  parseTimeRange,
  parseWeekday,
  type ImportReport,
} from '../shared/import.js';

describe('interpretação de valores da planilha', () => {
  it('reconhece horários em vários formatos', () => {
    expect(parseTime('7:00')).toBe('07:00');
    expect(parseTime('07:00:00')).toBe('07:00');
    expect(parseTime('7h30')).toBe('07:30');
    expect(parseTime('7h')).toBe('07:00');
    expect(parseTime('0750')).toBe('07:50');
    expect(parseTime('25:00')).toBeNull();
    expect(parseTime('manhã')).toBeNull();
    expect(parseTimeRange('07:00 às 07:50')).toEqual({ start: '07:00', end: '07:50' });
    expect(parseTimeRange('7h–7h50')).toEqual({ start: '07:00', end: '07:50' });
    expect(parseTimeRange('1º horário')).toBeNull();
  });

  it('reconhece dias, turnos, situação, cores e ordem do período', () => {
    expect(parseWeekday('Segunda-feira')).toBe(1);
    expect(parseWeekday('TERÇA')).toBe(2);
    expect(parseWeekday('qua.')).toBe(3);
    expect(parseWeekday('5ª')).toBe(4);
    expect(parseWeekday('Sábado')).toBe(6);
    expect(parseWeekday('2')).toBeNull();
    expect(parseClassShift('Manhã')).toBe('manha');
    expect(parseClassShift('vespertino')).toBe('tarde');
    expect(parseClassShift('Integral')).toBe('integral');
    expect(parseActive('Inativo')).toBe(false);
    expect(parseActive('')).toBeUndefined();
    expect(parseActive('talvez')).toBeNull();
    expect(parseColor('Verde-água')).toBe('teal');
    expect(parseColor('indigo')).toBe('indigo');
    expect(parseOrdinal('3º horário')).toBe(3);
    expect(parseOrdinal('Aula 2')).toBe(2);
    expect(parseOrdinal('07:00')).toBeNull();
  });

  it('associa cabeçalhos às colunas sem depender de acentos ou da ordem', () => {
    const mapping = guessMapping(IMPORT_SPECS.teachers, ['TELEFONE', 'Nome Completo', 'Matrícula', 'Área', 'Outra coisa']);
    expect(mapping).toMatchObject({ name: 1, code: 2, area: 3, phone: 0, notes: null, active: null });
    const lessons = guessMapping(IMPORT_SPECS.lessons, ['Turma', 'Professor(a)', 'Disciplina', 'Dia da semana', 'Horário']);
    expect(lessons).toMatchObject({ class: 0, teacher: 1, subject: 2, weekday: 3, slot: 4 });
  });
});

describe('API de importação', () => {
  let server: TestServer;
  let db: Database;

  async function importRows(kind: string, rows: Record<string, string>[], options: Record<string, unknown> = {}, dryRun = false) {
    const res = await server.call('POST', `/import/${kind}`, { rows: rows.map((values, i) => ({ line: i + 2, values })), options, dryRun });
    return { status: res.status, body: res.body as ImportReport & { error?: { message: string } } };
  }

  beforeAll(async () => {
    server = await startTestServer();
    db = server.db;
  });

  afterAll(() => server.close());

  it('a prévia valida tudo sem gravar nada', async () => {
    const { body } = await importRows('teachers', [{ name: 'Ana Souza', code: 'P1' }], {}, true);
    expect(body.dryRun).toBe(true);
    expect(body.summary.create).toBe(1);
    expect(await db.query('SELECT * FROM teachers')).toHaveLength(0);
  });

  it('importa professores, aponta erros por linha e atualiza na reimportação', async () => {
    const first = await importRows('teachers', [
      { name: 'Ana Souza', code: 'P1', area: 'Matemática', phone: '(21) 99999-0001' },
      { name: 'Bruno Lima', code: 'P2' },
      { name: 'Bruno Lima', code: 'P2' },
      { name: 'Ca', code: '', phone: 'abc' },
      { name: 'Carla Dias', active: 'talvez' },
    ]);
    expect(first.body.summary).toEqual({ create: 2, update: 0, skip: 0, error: 3 });
    expect(first.body.rows[2].messages[0]).toContain('linha 3');
    expect(first.body.rows[3].messages.join(' ')).toMatch(/Nome|Telefone/);

    const second = await importRows('teachers', [
      { name: 'Ana Souza', code: 'P1', area: '' },
      { name: 'Bruno Lima', code: 'P2', area: 'História' },
    ]);
    expect(second.body.summary).toMatchObject({ update: 1, skip: 1 });
    const [ana] = await db.query<{ area: string }>("SELECT area FROM teachers WHERE code = 'P1'");
    expect(ana.area).toBe('Matemática');

    const skipped = await importRows('teachers', [{ name: 'Bruno Lima', code: 'P2', area: 'Geografia' }], { existing: 'skip' });
    expect(skipped.body.summary.skip).toBe(1);
  });

  it('importa turmas e disciplinas com cor automática', async () => {
    const classes = await importRows('classes', [
      { name: '6º A', grade: '6º ano', shift: 'Manhã' },
      { name: '7º A', grade: '7º ano', shift: 'Integral' },
      { name: '8º A', grade: '8º ano', shift: 'Madrugada' },
    ]);
    expect(classes.body.summary).toMatchObject({ create: 2, error: 1 });

    const subjects = await importRows('subjects', [{ name: 'Matemática', color: 'Azul' }, { name: 'História' }, { name: 'Artes', color: 'xadrez' }]);
    expect(subjects.body.summary).toMatchObject({ create: 2, error: 1 });
    const colors = await db.query<{ color: string }>('SELECT color FROM subjects ORDER BY id');
    expect(colors.map((c) => c.color)).toEqual(['sky', 'amber']);
  });

  it('importa aulas por período ou faixa, bloqueia conflitos e não duplica na reimportação', async () => {
    const rows: Record<string, string>[] = [
      { class: '6º A', teacher: 'Ana Souza', subject: 'Matemática', weekday: 'Segunda', slot: '1º horário' },
      { class: '6º A', teacher: 'P2', subject: 'Física', weekday: 'Segunda', slot: '07:50 às 08:40' },
      { class: '7º A', teacher: 'ana souza', subject: '', weekday: 'Segunda', start: '07:30', end: '08:00' },
      { class: '6º A', teacher: 'Ana Souza', subject: 'Matemática', weekday: 'Domingo', slot: '1º horário' },
      { class: '9º Z', teacher: 'Ninguém', weekday: 'Terça', slot: '2º horário' },
    ];
    const withoutCreate = await importRows('lessons', rows, {}, true);
    expect(withoutCreate.body.rows[1].messages[0]).toContain('Física');

    const result = await importRows('lessons', rows, { createMissingSubjects: true });
    expect(result.body.summary).toEqual({ create: 2, update: 0, skip: 0, error: 3 });
    expect(result.body.createdSubjects).toEqual(['Física']);
    expect(result.body.rows[2].messages[0]).toMatch(/já tem aula/);
    expect(result.body.rows[4].messages.length).toBe(2);

    const lessons = await db.query<{ start_time: string; end_time: string }>('SELECT start_time, end_time FROM lessons ORDER BY start_time');
    expect(lessons).toEqual([
      { start_time: '07:00', end_time: '07:50' },
      { start_time: '07:50', end_time: '08:40' },
    ]);

    const again = await importRows('lessons', rows.slice(0, 2), { createMissingSubjects: true });
    expect(again.body.summary.skip).toBe(2);
    expect(await db.query('SELECT id FROM lessons')).toHaveLength(2);
  });

  it('substitui as aulas da turma quando solicitado e respeita o professor fixo', async () => {
    const [ana] = await db.query<{ id: number }>("SELECT id FROM teachers WHERE code = 'P1'");
    const replaced = await importRows(
      'lessons',
      [{ class: '6º A', weekday: 'Terça', slot: '2º horário', subject: 'Matemática' }],
      { fixedTeacherId: ana.id, replaceExisting: true },
    );
    expect(replaced.body.removed).toBe(1);
    expect(replaced.body.summary.create).toBe(1);
    expect(await db.query('SELECT id FROM lessons')).toHaveLength(2);

    const missing = await importRows('lessons', [{ class: '6º A', weekday: 'Terça', slot: '3º horário' }], { fixedTeacherId: 99999 });
    expect(missing.status).toBe(422);
  });

  it('substitui os horários apenas dos turnos presentes e valida sobreposição', async () => {
    const bad = await importRows('periods', [
      { shift: 'Noite', label: '1º', start: '18:00', end: '19:00' },
      { shift: 'Noite', label: '2º', start: '18:30', end: '19:30' },
    ]);
    expect(bad.body.summary.error).toBe(1);
    expect(bad.body.summary.skip).toBe(1);

    const ok = await importRows('periods', [
      { shift: 'Noite', label: '1º horário', start: '18:00', end: '18:45' },
      { shift: 'Noite', label: 'Recreio', start: '18:45', end: '19:00' },
      { shift: 'Noite', label: '2º horário', start: '19:00', end: '19:45' },
    ]);
    expect(ok.body.summary.create).toBe(3);
    const night = await db.query<{ kind: string }>("SELECT kind FROM periods WHERE shift = 'noite' ORDER BY start_time");
    expect(night.map((p) => p.kind)).toEqual(['aula', 'intervalo', 'aula']);
    expect((await db.query("SELECT id FROM periods WHERE shift = 'manha'")).length).toBeGreaterThan(0);
  });

  it('se o banco recusar uma linha inesperadamente, refaz no modo protegido e grava as demais', async () => {
    // Regra que só existe no banco (a validação da aplicação não a conhece).
    await db.exec("ALTER TABLE teachers ADD CONSTRAINT teste_area CHECK (area IS DISTINCT FROM 'Proibida')");
    const result = await importRows('teachers', [
      { name: 'Diana Prado', code: 'P10' },
      { name: 'Eduardo Reis', code: 'P11', area: 'Proibida' },
      { name: 'Fernanda Luz', code: 'P12' },
    ]);
    await db.exec('ALTER TABLE teachers DROP CONSTRAINT teste_area');
    expect(result.body.summary).toMatchObject({ create: 2, error: 1 });
    expect(result.body.rows[1].messages[0]).toMatch(/recusou/);
    const names = await db.query<{ name: string }>("SELECT name FROM teachers WHERE code IN ('P10', 'P11', 'P12') ORDER BY code");
    expect(names.map((n) => n.name)).toEqual(['Diana Prado', 'Fernanda Luz']);
  });

  it('recusa pedidos inválidos', async () => {
    expect((await importRows('nada', [{ a: '1' }])).status).toBe(404);
    const empty = await server.call('POST', '/import/teachers', { rows: [] });
    expect(empty.status).toBe(422);
  });
});
