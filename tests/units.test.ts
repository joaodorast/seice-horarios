import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestServer, type TestServer } from './helpers.js';
import { upsertUser } from '../server/auth.js';

/**
 * Duas unidades: CE (Campos Elíseos) e JP (Jardim Primavera).
 * O coordenador só enxerga e altera a própria unidade; a administração enxerga as duas.
 */
describe('unidades e permissões', () => {
  let server: TestServer;
  let ce: number;
  let jp: number;

  const call = (cookie: string) => async (method: string, path: string, body?: unknown) => {
    const res = await fetch(`${server.base}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', cookie },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, body: (await res.json().catch(() => null)) as any };
  };

  async function login(email: string, password: string) {
    const res = await fetch(`${server.base}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, remember: false }),
    });
    const raw = res.headers.getSetCookie?.()[0] ?? res.headers.get('set-cookie') ?? '';
    return raw.split(';')[0];
  }

  let admin: ReturnType<typeof call>;
  let coordCe: ReturnType<typeof call>;
  let coordJp: ReturnType<typeof call>;

  beforeAll(async () => {
    server = await startTestServer();
    const units = await server.db.query<{ id: number; code: string }>('SELECT id, code FROM units ORDER BY id');
    ce = units.find((u) => u.code === 'CE')!.id;
    jp = units.find((u) => u.code === 'JP')!.id;

    await upsertUser(server.db, 'ce@teste.com', 'Coordenação CE', 'senha-de-teste-123');
    await upsertUser(server.db, 'jp@teste.com', 'Coordenação JP', 'senha-de-teste-123');
    await server.db.query("UPDATE users SET role = 'coordenador', unit_id = $1 WHERE email = 'ce@teste.com'", [ce]);
    await server.db.query("UPDATE users SET role = 'coordenador', unit_id = $1 WHERE email = 'jp@teste.com'", [jp]);

    admin = call(await login('admin@teste.com', 'senha-de-teste-123'));
    coordCe = call(await login('ce@teste.com', 'senha-de-teste-123'));
    coordJp = call(await login('jp@teste.com', 'senha-de-teste-123'));
  });

  afterAll(() => server.close());

  it('nasce com Campos Elíseos e Jardim Primavera', async () => {
    const res = await admin('GET', '/units');
    expect(res.body.map((u: { code: string }) => u.code)).toEqual(['CE', 'JP']);
  });

  it('o coordenador enxerga apenas a própria unidade', async () => {
    expect((await coordCe('GET', '/units')).body.map((u: { code: string }) => u.code)).toEqual(['CE']);
    expect((await coordJp('GET', '/units')).body.map((u: { code: string }) => u.code)).toEqual(['JP']);
    const me = await coordJp('GET', '/auth/me');
    expect(me.body.user).toMatchObject({ role: 'coordenador', unitId: jp, unit: { code: 'JP' } });
  });

  it('a turma do coordenador nasce na unidade dele e ele não cria na outra', async () => {
    const criada = await coordJp('POST', '/classes', { name: '6º A JP', grade: '6º ano', shift: 'manha', notes: null, active: true });
    expect(criada.status).toBe(201);
    expect(criada.body.unitId).toBe(jp);

    const proibida = await coordJp('POST', '/classes', { name: '6º A CE', grade: '6º ano', shift: 'manha', unitId: ce, notes: null, active: true });
    expect(proibida.status).toBe(403);
    expect(proibida.body.error.code).toBe('wrong_unit');
  });

  it('o coordenador não edita turma, professor nem aula da outra unidade', async () => {
    const turmaCe = await admin('POST', '/classes', { name: '7º A CE', grade: '7º ano', shift: 'manha', unitId: ce, notes: null, active: true });
    expect(turmaCe.status).toBe(201);

    const edicao = await coordJp('PUT', `/classes/${turmaCe.body.id}`, { name: '7º A invadida', grade: '7º ano', shift: 'manha', notes: null, active: true });
    expect(edicao.status).toBe(403);

    const professorCe = await admin('POST', '/teachers', { name: 'Professor CE', code: null, area: null, phone: null, notes: null, active: true, unitId: ce, unitIds: [ce], subjectIds: [] });
    const edicaoProfessor = await coordJp('PUT', `/teachers/${professorCe.body.id}`, { name: 'Professor alterado', code: null, area: null, phone: null, notes: null, active: true, subjectIds: [] });
    expect(edicaoProfessor.status).toBe(403);

    const turmaJp = await coordJp('GET', '/classes');
    const aulaJp = await coordJp('POST', '/lessons', {
      teacherId: professorCe.body.id,
      classId: turmaJp.body.find((c: { name: string }) => c.name === '6º A JP').id,
      subjectId: null,
      weekday: 1,
      start: '07:00',
      end: '07:50',
      notes: null,
    });
    expect(aulaJp.status).toBe(409);
  });

  it('professor compartilhado só é montado pela administração', async () => {
    // Tentar cadastrar escolhendo a outra unidade é recusado.
    const tentativa = await coordJp('POST', '/teachers', {
      name: 'Naissa Souza',
      code: null,
      area: 'Química',
      phone: null,
      notes: null,
      active: true,
      unitId: ce,
      unitIds: [ce, jp],
      subjectIds: [],
    });
    expect(tentativa.status).toBe(403);
    expect(tentativa.body.error.code).toBe('wrong_unit');

    // Sem escolher unidade, o professor entra só na unidade de quem cadastrou.
    const semUnidade = await coordJp('POST', '/teachers', {
      name: 'Naissa do JP',
      code: null,
      area: 'Química',
      phone: null,
      notes: null,
      active: true,
      subjectIds: [],
    });
    expect(semUnidade.status).toBe(201);
    expect(semUnidade.body.unitIds).toEqual([jp]);

    const compartilhado = await admin('POST', '/teachers', {
      name: 'Naissa Compartilhada',
      code: null,
      area: 'Química',
      phone: null,
      notes: null,
      active: true,
      unitId: ce,
      unitIds: [ce, jp],
      subjectIds: [],
    });
    expect(compartilhado.body.unitIds).toEqual([ce, jp]);
  });

  it('o coordenador enxerga apenas os dados da própria unidade, mas vê o professor compartilhado', async () => {
    // A administração monta as duas unidades: professor só CE, professor compartilhado e uma aula no CE.
    await admin('POST', '/teachers', { name: 'Só Campos Elíseos', code: null, area: null, phone: null, notes: null, active: true, unitId: ce, unitIds: [ce], subjectIds: [] });
    const compartilhado = await admin('POST', '/teachers', { name: 'Naissa Compartilhada', code: null, area: 'Química', phone: null, notes: null, active: true, unitId: ce, unitIds: [ce, jp], subjectIds: [] });
    const turmaCe = await admin('POST', '/classes', { name: '8º A CE', grade: '8º ano', shift: 'manha', unitId: ce, notes: null, active: true });
    // Quinta 07:00 fica livre nas duas unidades, então só pode haver conflito pelo professor compartilhado.
    await server.db.query('DELETE FROM lessons WHERE weekday = 4 AND start_time = \'07:00\'');
    const aula = await admin('POST', '/lessons', { teacherId: compartilhado.body.id, classId: turmaCe.body.id, subjectId: null, weekday: 4, start: '07:00', end: '07:50', notes: null });
    expect(aula.status).toBe(201);

    const professores = await coordJp('GET', '/teachers');
    const nomes = professores.body.map((t: { name: string }) => t.name);
    expect(nomes).toContain('Naissa Compartilhada');
    expect(nomes).not.toContain('Só Campos Elíseos');

    const turmas = await coordJp('GET', '/classes');
    expect(turmas.body.every((c: { unitId: number }) => c.unitId === jp)).toBe(true);

    const aulas = await coordJp('GET', '/lessons');
    expect(aulas.body.every((l: { unitId: number }) => l.unitId === jp)).toBe(true);

    const lote = await coordJp('GET', '/data?include=teachers,classes,lessons');
    expect(lote.body.lessons.every((l: { unitId: number }) => l.unitId === jp)).toBe(true);
    expect(lote.body.teachers.map((t: { name: string }) => t.name)).not.toContain('Só Campos Elíseos');
  });

  it('o coordenador de JP é avisado de que a compartilhada já tem aula no CE', async () => {
    // Cada teste monta o seu cenário: limpa as aulas da quinta 07:00 antes de começar.
    await server.db.query("DELETE FROM lessons WHERE weekday = 4 AND start_time = '07:00'");
    const compartilhado = (await admin('GET', '/teachers')).body.find((t: { name: string }) => t.name === 'Naissa Compartilhada');
    const turmaCe = (await admin('GET', '/classes')).body.find((c: { name: string }) => c.name === '8º A CE');
    const aulaCe = await admin('POST', '/lessons', { teacherId: compartilhado.id, classId: turmaCe.id, subjectId: null, weekday: 4, start: '07:00', end: '07:50', notes: null });
    expect(aulaCe.status).toBe(201);
    // Turma nova no JP, para o conflito ser só do professor compartilhado (e não de uma aula já lançada).
    const nova = await coordJp('POST', '/classes', { name: '9º A JP', grade: '9º ano', shift: 'manha', notes: null, active: true });
    const turmaJp = nova.body;

    const conflito = await coordJp('POST', '/lessons', {
      teacherId: compartilhado.id,
      classId: turmaJp.id,
      subjectId: null,
      weekday: 4,
      start: '07:00',
      end: '07:50',
      notes: null,
    });
    expect(conflito.status).toBe(409);
    const mensagem = conflito.body.error.issues[0].message as string;
    expect(mensagem).toContain('já tem aula neste horário');

    const livre = await coordJp('POST', '/lessons', {
      teacherId: compartilhado.id,
      classId: turmaJp.id,
      subjectId: null,
      weekday: 4,
      start: '08:00',
      end: '08:50',
      notes: null,
    });
    expect(livre.status).toBe(201);
    expect(livre.body.lesson.unitId).toBe(jp);
  });

  it('só a administração cria unidade', async () => {
    const res = await coordCe('POST', '/units', { code: 'XX', name: 'Unidade Teste', active: true });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('admin_only');
  });
});
