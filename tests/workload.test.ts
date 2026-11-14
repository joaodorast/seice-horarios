import { describe, expect, it } from 'vitest';
import { computeWorkload, lessonTimeCount, monthWeekdayCounts } from '../shared/workload.js';
import type { Lesson, Period, SchoolClass, Teacher } from '../shared/types.js';

const ts = '2026-01-01T00:00:00.000Z';
const teacher = (id: number, name: string, active = true): Teacher => ({
  id, name, code: null, area: null, phone: null, notes: null, active, createdAt: ts, updatedAt: ts, photoUpdatedAt: null, subjectIds: [], availability: [],
});
const klass = (id: number, name: string, shift: SchoolClass['shift'] = 'manha', active = true): SchoolClass => ({
  id, name, grade: '', shift, notes: null, active, createdAt: ts, updatedAt: ts,
});
let seq = 1;
const lesson = (teacherId: number, classId: number, subjectId: number | null, start: string, end: string): Lesson => ({
  id: seq++, teacherId, classId, subjectId, weekday: 1, start, end, notes: null, createdAt: ts, updatedAt: ts,
});

describe('carga horária', () => {
  const teachers = [teacher(1, 'Bruno'), teacher(2, 'Ana'), teacher(3, 'Inativa sem aulas', false), teacher(4, 'Inativo com aula', false)];
  const classes = [klass(10, '7º A'), klass(11, '6º A'), klass(12, '9º A', 'tarde')];
  const lessons = [
    lesson(1, 10, 100, '07:00', '07:50'),
    lesson(1, 10, 101, '07:50', '08:40'),
    lesson(1, 11, 100, '08:40', '09:30'),
    lesson(2, 12, 100, '13:00', '14:40'), // aula dupla: 100 minutos
    lesson(4, 11, null, '10:00', '10:50'),
  ];

  it('soma aulas e horas por turma, por professor e no total', () => {
    const w = computeWorkload(lessons, teachers, classes);
    expect(w.classes.map((c) => c.name)).toEqual(['6º A', '7º A', '9º A']);
    expect(w.rows.map((r) => r.teacher.name)).toEqual(['Ana', 'Bruno', 'Inativo com aula']);
    const bruno = w.rows.find((r) => r.teacher.id === 1)!;
    expect(bruno.byClass.get(10)).toEqual({ lessons: 2, minutes: 100 });
    expect(bruno.total).toEqual({ lessons: 3, minutes: 150 });
    expect(w.classTotals.get(11)).toEqual({ lessons: 2, minutes: 100 });
    expect(w.grand).toEqual({ lessons: 5, minutes: 300 }); // 4 aulas de 50 min + 1 dupla de 100 min
  });

  it('detalha por disciplina dentro de cada professor', () => {
    const bruno = computeWorkload(lessons, teachers, classes).rows.find((r) => r.teacher.id === 1)!;
    expect(bruno.bySubject.map((s) => [s.subjectId, s.total.lessons])).toEqual([[100, 2], [101, 1]]);
    expect(bruno.bySubject[0].byClass.get(11)).toEqual({ lessons: 1, minutes: 50 });
  });

  it('pode contar a aula dupla como duas aulas', () => {
    const w = computeWorkload(lessons, teachers, classes, undefined, (l) => (l.end === '14:40' ? 2 : 1));
    expect(w.rows.find((r) => r.teacher.id === 2)!.total).toEqual({ lessons: 2, minutes: 100 });
    expect(w.grand.lessons).toBe(6);
  });

  it('filtra as turmas (ex.: só o turno da tarde) e recalcula os totais', () => {
    const w = computeWorkload(lessons, teachers, classes, (c) => c.shift === 'tarde');
    expect(w.classes.map((c) => c.name)).toEqual(['9º A']);
    expect(w.grand).toEqual({ lessons: 1, minutes: 100 });
    expect(w.rows.find((r) => r.teacher.id === 1)!.total.lessons).toBe(0);
  });
});

describe('tempos semanais usados no pagamento', () => {
  const periods: Period[] = [
    { id: 1, shift: 'manha', label: '1º', start: '07:30', end: '08:20', kind: 'aula', sortOrder: 0 },
    { id: 2, shift: 'manha', label: '2º', start: '08:20', end: '09:10', kind: 'aula', sortOrder: 1 },
    { id: 3, shift: 'manha', label: 'Intervalo', start: '09:10', end: '09:30', kind: 'intervalo', sortOrder: 2 },
    { id: 4, shift: 'tarde', label: 'Outro turno', start: '07:30', end: '09:10', kind: 'aula', sortOrder: 0 },
  ];

  it('conta uma aula dupla como dois tempos e ignora outro turno e intervalo', () => {
    const count = lessonTimeCount(lesson(1, 10, 100, '07:30', '09:30'), periods, [klass(10, 'Turma manhã')]);
    expect(count).toBe(2);
    expect(count * 50).toBe(100);
  });

  it('mantém um tempo para uma aula personalizada fora da grade', () => {
    expect(lessonTimeCount(lesson(1, 10, 100, '12:00', '12:45'), periods, [klass(10, 'Turma manhã')])).toBe(1);
  });
});

describe('totais do professor e da turma no mesmo recorte', () => {
  const teachers = [teacher(1, 'Luana'), teacher(2, 'Milena'), teacher(3, 'Matheus')];
  const classes = [klass(10, '1001 CE')];
  const lessons = [
    ...Array.from({ length: 20 }, (_, index) => ({
      ...lesson(1, 10, index < 5 ? 100 : 101, '07:30', '08:20'), weekday: (index % 5 + 1) as Lesson['weekday'],
    })),
    lesson(2, 10, 102, '07:30', '08:20'),
    lesson(2, 10, 102, '08:20', '09:10'),
    lesson(3, 10, 103, '09:10', '10:00'),
  ];

  it('mostra 20 tempos de Luana e 23 da turma com a contribuição dos demais professores', () => {
    const workload = computeWorkload(lessons, teachers, classes);
    expect(workload.rows.find((row) => row.teacher.id === 1)?.total.lessons).toBe(20);
    expect(workload.classTotals.get(10)?.lessons).toBe(23);
    expect(workload.rows.reduce((sum, row) => sum + row.total.lessons, 0)).toBe(workload.grand.lessons);
  });

  it('a busca por Luana faz o total do recorte bater com o professor e suas disciplinas', () => {
    const workload = computeWorkload(lessons, [teachers[0]], classes);
    expect(workload.grand.lessons).toBe(20);
    expect(workload.grand.lessons * 50).toBe(1000);
    expect(workload.classTotals.get(10)?.lessons).toBe(20);
    expect(workload.rows[0].bySubject.reduce((sum, subject) => sum + subject.total.lessons, 0)).toBe(20);
    const daily = computeWorkload(lessons.filter((item) => item.weekday === 1), [teachers[0]], classes);
    expect(daily.grand.lessons).toBe(4);
    expect(daily.grand.lessons * 50).toBe(200);
    expect(workload.grand.lessons * 4).toBe(80);
    expect(workload.grand.lessons * 4 * 50).toBe(4000);
  });
});


describe('cálculo pelo calendário mensal', () => {
  it('conta as ocorrências reais e desconta datas sem aula sem duplicar exclusões', () => {
    expect(monthWeekdayCounts('2027-03', [1,2,3,4,5])).toEqual({1:5,2:5,3:5,4:4,5:4,6:0});
    expect(monthWeekdayCounts('2027-03', [1,2,3,4,5], ['2027-03-01','2027-03-01','2027-04-01'])[1]).toBe(4);
    expect(monthWeekdayCounts('2027-13', [1])).toEqual({1:0,2:0,3:0,4:0,5:0,6:0});
    expect(monthWeekdayCounts('2028-02', [1,2,3,4,5])[2]).toBe(5);
  });
  it('soma professor, disciplina e turma usando as datas do mês', () => {
    const lessons = Array.from({length:20}, (_, i) => ({...lesson(1,10,100,'07:30','08:20'), weekday:(i%5+1) as Lesson['weekday']}));
    const counts = monthWeekdayCounts('2027-03', [1,2,3,4,5]);
    const workload = computeWorkload(lessons,[teacher(1,'Luana')],[klass(10,'1001')],undefined,()=>1,(l)=>counts[l.weekday]);
    expect(workload.grand).toEqual({lessons:92,minutes:4600});
    expect(workload.rows[0].bySubject[0].total).toEqual(workload.grand);
    expect(workload.classTotals.get(10)).toEqual(workload.grand);
    const excluded = monthWeekdayCounts('2027-03',[1,2,3,4,5],['2027-03-01']);
    expect(computeWorkload(lessons,[teacher(1,'Luana')],[klass(10,'1001')],undefined,()=>1,(l)=>excluded[l.weekday]).grand).toEqual({lessons:88,minutes:4400});
  });
});
