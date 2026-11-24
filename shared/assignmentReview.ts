import { assignmentKey, lessonUnits } from './assignments.js';
import type { Assignment, Lesson, Period, SchoolClass, Subject, Teacher } from './types.js';

export interface AssignmentReviewData {
  assignments: Assignment[]; lessons: Lesson[]; periods: Period[];
  classes: SchoolClass[]; teachers: Teacher[]; subjects: Subject[];
}
export interface AssignmentSuggestion {
  key: string; classId: number; subjectId: number | null; teacherId: number | null;
  teacherIds: number[]; scheduled: number; planned: number | null;
  status: 'missing' | 'different' | 'complete' | 'blocked'; reason: string | null;
  expected: string;
}
/** Somente lê a grade. Nunca cria aulas, altera horários ou calcula pagamentos. */
export function reviewAssignments(data: AssignmentReviewData): AssignmentSuggestion[] {
  const classIds = new Set(data.classes.map(c => c.id));
  const groups = new Map<string, Lesson[]>();
  for (const lesson of data.lessons) {
    if (!classIds.has(lesson.classId)) continue;
    const key = `${lesson.classId}:${lesson.subjectId}`;
    const group = groups.get(key) ?? []; group.push(lesson); groups.set(key, group);
  }
  return [...groups].map(([key, lessons]) => {
    const first = lessons[0], schoolClass = data.classes.find(c => c.id === first.classId)!;
    const teacherIds = [...new Set(lessons.flatMap(l => l.teacherId === null ? [] : [l.teacherId]))].sort((a,b) => a-b);
    const teacherId = teacherIds.length === 1 ? teacherIds[0] : null;
    const teacher = data.teachers.find(t => t.id === teacherId);
    const subject = data.subjects.find(s => s.id === first.subjectId);
    const current = first.subjectId === null ? undefined : data.assignments.find(a => assignmentKey(a.classId,a.subjectId) === key);
    const scheduled = lessons.reduce((sum,l) => sum + lessonUnits(l,data.periods,data.classes),0);
    let reason: string | null = null;
    if (!schoolClass.active) reason = 'Turma inativa. Confira o cadastro antes de atribuir.';
    else if (!subject) reason = 'Há aulas sem disciplina. Complete a disciplina na grade.';
    else if (lessons.some(l => l.teacherId === null)) reason = 'Há aulas sem professor. Escolha o professor na grade.';
    else if (teacherIds.length !== 1) reason = 'Mais de um professor nesta turma e disciplina. Confira a divisão na grade.';
    else if (!teacher?.active) reason = 'Professor inativo ou indisponível. Confira o cadastro.';
    else if (schoolClass.unitId && ![teacher.unitId,...(teacher.unitIds ?? [])].includes(schoolClass.unitId)) reason = 'O professor não está vinculado à unidade desta turma.';
    else if (current && current.teacherId !== teacherId) reason = 'Esta atribuição está com outro professor. Confira antes de substituir.';
    else if (scheduled > 40) reason = 'A grade ultrapassa o limite de 40 aulas por disciplina e turma. Confira os horários.';
    const status: AssignmentSuggestion['status'] = reason ? 'blocked' : !current ? 'missing' : current.weeklyLessons === scheduled ? 'complete' : 'different';
    const expected = JSON.stringify({
      lessons: [...lessons].sort((a,b) => a.id-b.id).map(l => [l.id,l.teacherId,l.subjectId,l.weekday,l.start,l.end,l.updatedAt]),
      periods: [...data.periods].sort((a,b) => a.id-b.id).map(p => [p.id,p.shift,p.kind,p.start,p.end]),
      class: [schoolClass.id,schoolClass.active,schoolClass.shift,schoolClass.unitId],
      teacher: teacher && [teacher.id,teacher.active,teacher.unitId,[...(teacher.unitIds ?? [])].sort((a,b)=>a-b)],
      assignment: current ? [current.id,current.teacherId,current.weeklyLessons,current.updatedAt] : null,
    });
    return { key,classId:first.classId,subjectId:first.subjectId,teacherId,teacherIds,scheduled,planned:current?.weeklyLessons ?? null,status,reason,expected };
  }).sort((a,b) => a.classId-b.classId || (a.subjectId ?? 0)-(b.subjectId ?? 0));
}
