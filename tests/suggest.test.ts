import { describe, expect, it } from 'vitest';
import { periodRange, selectPeriod, suggestSubject, teacherSubjectIds } from '../shared/suggest.js';
import type { Lesson, Period, Subject, Teacher } from '../shared/types.js';

const ts = '2026-01-01T00:00:00.000Z';
const GEO = 1;
const PV = 2;
const MAT = 3;
const subjects: Subject[] = [
  { id: GEO, name: 'Geografia', color: 'teal', createdAt: ts },
  { id: PV, name: 'Projeto de Vida', color: 'indigo', createdAt: ts },
  { id: MAT, name: 'Matemática', color: 'sky', createdAt: ts },
];
const teacher = (subjectIds: number[], area: string | null = null): Teacher => ({
  id: 7, name: 'Bruno Lima', code: null, area, phone: null, notes: null, active: true, createdAt: ts, updatedAt: ts, photoUpdatedAt: null, subjectIds, availability: [],
});
const lesson = (id: number, subjectId: number, weekday: Lesson['weekday'], start: string, end: string, classId = 10): Lesson => ({
  id, teacherId: 7, classId, subjectId, weekday, start, end, notes: null, createdAt: ts, updatedAt: ts,
});
const base = { subjects, classId: 10, weekday: 1 as const };

describe('sugestão da disciplina da aula', () => {
  it('usa as disciplinas do cadastro; sem elas, a área de atuação com o mesmo nome', () => {
    expect(teacherSubjectIds(teacher([GEO, PV]), subjects)).toEqual([GEO, PV]);
    expect(teacherSubjectIds(teacher([], 'matemática'), subjects)).toEqual([MAT]);
    expect(teacherSubjectIds(teacher([], 'Humanas'), subjects)).toEqual([]);
  });

  it('com uma única disciplina, sugere sempre ela', () => {
    const s = suggestSubject({ ...base, teacher: teacher([GEO]), lessons: [], start: '07:30', end: '08:20' });
    expect(s).toMatchObject({ subjectId: GEO, reason: 'unica' });
  });

  it('com várias e sem histórico, não sugere: a pessoa escolhe', () => {
    const s = suggestSubject({ ...base, teacher: teacher([GEO, PV]), lessons: [], start: '07:30', end: '08:20' });
    expect(s).toMatchObject({ subjectId: null, candidates: [GEO, PV] });
  });

  it('continua a disciplina da aula colada no mesmo dia (aula dupla)', () => {
    const lessons = [lesson(1, GEO, 1, '07:30', '08:20'), lesson(2, PV, 1, '09:10', '10:00')];
    expect(suggestSubject({ ...base, teacher: teacher([GEO, PV]), lessons, start: '08:20', end: '09:10' })).toMatchObject({ subjectId: GEO, reason: 'horario' });
    expect(suggestSubject({ ...base, teacher: teacher([GEO, PV]), lessons, start: '10:00', end: '10:50' })).toMatchObject({ subjectId: PV, reason: 'horario' });
  });

  it('repete a disciplina do mesmo horário em outros dias', () => {
    const lessons = [lesson(1, GEO, 2, '07:30', '08:20'), lesson(2, PV, 3, '09:10', '10:00')];
    expect(suggestSubject({ ...base, teacher: teacher([GEO, PV]), lessons, start: '09:10', end: '10:00' })).toMatchObject({ subjectId: PV, reason: 'horario' });
  });

  it('com várias disciplinas, não chuta pela frequência na turma quando o horário não dá pista', () => {
    const lessons = [lesson(1, GEO, 2, '07:30', '08:20'), lesson(2, GEO, 3, '07:30', '08:20'), lesson(3, PV, 4, '10:00', '10:50')];
    expect(suggestSubject({ ...base, teacher: teacher([GEO, PV]), lessons, start: '', end: '' }).subjectId).toBeNull();
    expect(suggestSubject({ ...base, teacher: teacher([GEO, PV]), lessons, start: '13:00', end: '13:50' }).subjectId).toBeNull();
  });

  it('ignora o histórico de outras turmas e a própria aula em edição', () => {
    const lessons = [lesson(1, GEO, 1, '07:30', '08:20', 99), lesson(2, PV, 1, '07:30', '08:20')];
    const s = suggestSubject({ ...base, teacher: teacher([GEO, PV]), lessons, start: '07:30', end: '08:20', excludeLessonId: 2 });
    expect(s.subjectId).toBeNull();
  });
});

const period = (id: number, start: string, end: string, label = `${id}º`): Period => ({ id, shift: 'manha', label, start, end, kind: 'aula', sortOrder: id });
// 1º e 2º colados; intervalo 09:10–09:30 (fora da lista de aulas); 3º e 4º colados.
const periods = [period(1, '07:30', '08:20'), period(2, '08:20', '09:10'), period(3, '09:30', '10:20'), period(4, '10:20', '11:10')];

describe('aula dupla: seleção de períodos seguidos', () => {
  it('reconhece horários formados por períodos colados', () => {
    expect(periodRange(periods, '07:30', '09:10')?.map((p) => p.id)).toEqual([1, 2]);
    expect(periodRange(periods, '07:30', '08:20')?.map((p) => p.id)).toEqual([1]);
    expect(periodRange(periods, '08:20', '10:20')).toBeNull(); // atravessaria o intervalo
    expect(periodRange(periods, '07:45', '08:20')).toBeNull();
  });

  it('estende ao clicar no período seguinte ou anterior, e reinicia em outro qualquer', () => {
    const one = selectPeriod(periods, { start: '', end: '' }, periods[0]);
    expect(one).toEqual({ start: '07:30', end: '08:20' });
    const two = selectPeriod(periods, one, periods[1]);
    expect(two).toEqual({ start: '07:30', end: '09:10' });
    expect(selectPeriod(periods, two, periods[2])).toEqual({ start: '09:30', end: '10:20' }); // não atravessa o intervalo
    expect(selectPeriod(periods, { start: '10:20', end: '11:10' }, periods[2])).toEqual({ start: '09:30', end: '11:10' });
  });
});
