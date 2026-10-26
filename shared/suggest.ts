import type { Lesson, Period, Subject, Teacher, Weekday } from './types.js';

/** Normaliza nomes para comparação (sem acentos, maiúsculas ou espaços extras). */
const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

/**
 * Disciplinas que o professor leciona. Sem disciplinas cadastradas, usa a área de atuação
 * quando ela tem o mesmo nome de uma disciplina (comportamento anterior).
 */
export function teacherSubjectIds(teacher: Teacher | undefined, subjects: Subject[]): number[] {
  if (!teacher) return [];
  const linked = teacher.subjectIds.filter((id) => subjects.some((s) => s.id === id));
  if (linked.length) return linked;
  const byArea = teacher.area ? subjects.find((s) => fold(s.name) === fold(teacher.area!)) : undefined;
  return byArea ? [byArea.id] : [];
}

export type SuggestionReason = 'unica' | 'horario';

export interface SubjectSuggestion {
  subjectId: number | null;
  reason: SuggestionReason | null;
  /** Disciplinas do professor (para oferecer como escolha rápida). */
  candidates: number[];
}

/**
 * Sugere a disciplina de uma aula. Com uma única disciplina, é ela. Com várias, só sugere quando o horário
 * dá uma pista no histórico do professor com a mesma turma: aula colada no mesmo dia (aula dupla) ou o mesmo
 * horário em outros dias. Sem pista de horário, não sugere nada: a pessoa escolhe (evita chutar a disciplina errada).
 */
export function suggestSubject(args: {
  teacher: Teacher | undefined;
  subjects: Subject[];
  lessons: Lesson[];
  classId: number | null;
  weekday: Weekday;
  start: string;
  end: string;
  excludeLessonId?: number;
}): SubjectSuggestion {
  const candidates = teacherSubjectIds(args.teacher, args.subjects);
  if (candidates.length === 0) return { subjectId: null, reason: null, candidates };
  if (candidates.length === 1) return { subjectId: candidates[0], reason: 'unica', candidates };
  if (!args.teacher || !args.classId) return { subjectId: null, reason: null, candidates };

  const history = args.lessons.filter(
    (l) =>
      l.id !== args.excludeLessonId &&
      l.teacherId === args.teacher!.id &&
      l.classId === args.classId &&
      l.subjectId !== null &&
      candidates.includes(l.subjectId),
  );
  const score = new Map<number, { points: number; byTime: boolean }>();
  for (const l of history) {
    const current = score.get(l.subjectId!) ?? { points: 0, byTime: false };
    const sameDay = Boolean(args.start) && l.weekday === args.weekday;
    // Aula imediatamente anterior pesa mais que a seguinte: ao preencher em ordem, o comum é continuar a mesma disciplina.
    const continues = sameDay && l.end === args.start;
    const precedes = sameDay && l.start === args.end;
    const sameTime = Boolean(args.start) && l.weekday !== args.weekday && l.start === args.start;
    if (continues) current.points += 6;
    if (precedes) current.points += 4;
    if (sameTime) current.points += 3;
    current.points += 1;
    if (continues || precedes || sameTime) current.byTime = true;
    score.set(l.subjectId!, current);
  }
  const ranked = [...score.entries()].filter(([, v]) => v.byTime).sort((a, b) => b[1].points - a[1].points);
  if (ranked.length === 0) return { subjectId: null, reason: null, candidates };
  // Empate entre as melhores: não há pista suficiente, a pessoa escolhe.
  if (ranked.length > 1 && ranked[0][1].points === ranked[1][1].points) return { subjectId: null, reason: null, candidates };
  return { subjectId: ranked[0][0], reason: 'horario', candidates };
}

// ------------------------------------------------------------------ Aula dupla (vários períodos seguidos)

/** Dois períodos são "colados" quando um termina exatamente quando o outro começa (sem intervalo entre eles). */
const contiguous = (a: Period, b: Period) => a.end === b.start;

/**
 * Períodos de aula que formam exatamente o horário informado, em sequência colada.
 * Ex.: 07:30–09:10 = "1º horário" + "2º horário". Retorna null se não corresponder à grade.
 */
export function periodRange(periods: Period[], start: string, end: string): Period[] | null {
  const first = periods.findIndex((p) => p.start === start);
  if (first < 0) return null;
  const range: Period[] = [periods[first]];
  while (range[range.length - 1].end !== end) {
    const next = periods[first + range.length];
    if (!next || !contiguous(range[range.length - 1], next) || next.end > end) return null;
    range.push(next);
  }
  return range;
}

/**
 * Seleção de períodos por clique: clicar no período colado logo depois (ou antes) da seleção a estende
 * (aula dupla, tripla…); clicar em qualquer outro seleciona só ele.
 */
export function selectPeriod(periods: Period[], current: { start: string; end: string }, clicked: Period): { start: string; end: string } {
  const range = current.start ? periodRange(periods, current.start, current.end) : null;
  if (range) {
    const first = range[0];
    const last = range[range.length - 1];
    const i = periods.indexOf(clicked);
    if (periods[i - 1] === last && contiguous(last, clicked)) return { start: first.start, end: clicked.end };
    if (periods[i + 1] === first && contiguous(clicked, first)) return { start: clicked.start, end: last.end };
  }
  return { start: clicked.start, end: clicked.end };
}
