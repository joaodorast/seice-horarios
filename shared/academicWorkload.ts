import { shiftsOfClass } from './labels.js';
import { overlaps } from './time.js';
import type { Lesson, Period, SchoolClass, Weekday } from './types.js';

export interface AcademicProjection {
  year: number;
  basis: 'days' | 'weeks';
  schoolDays: number;
  daysPerWeek: number;
  weeks: number;
  minutesPerPeriod: number;
}
export interface AcademicLoad {
  classId: number;
  subjectId: number | null;
  minutesPerPeriod?: number;
  equivalentWeeks?: number;
  weeklyPeriods: number;
  weeklyMinutes: number;
  projectedPeriods: number;
  projectedMinutes: number;
}
export interface AcademicWorkload {
  classProjections?: {classId:number;projection:AcademicProjection;source:string}[];
  missingClasses?: number[];
  projection: AcademicProjection;
  equivalentWeeks: number;
  rows: AcademicLoad[];
  total: Omit<AcademicLoad,'classId'|'subjectId'>;
  outsideDays: number;
}
export function validateAcademicProjection(p: AcademicProjection): string | null {
  if(!Number.isInteger(p.year)||p.year<2000||p.year>9999)return 'Informe um ano entre 2000 e 9999.';
  if(!Number.isInteger(p.minutesPerPeriod)||p.minutesPerPeriod<1||p.minutesPerPeriod>240)return 'Informe de 1 a 240 minutos inteiros por tempo.';
  if(!Number.isInteger(p.daysPerWeek)||p.daysPerWeek<1||p.daysPerWeek>6)return 'Informe de 1 a 6 dias de aula por semana.';
  if(p.basis==='days'&&(!Number.isInteger(p.schoolDays)||p.schoolDays<1||p.schoolDays>366))return 'Informe de 1 a 366 dias letivos.';
  if(p.basis==='weeks'&&(!Number.isFinite(p.weeks)||p.weeks<=0||p.weeks>60))return 'Informe mais de zero e até 60 semanas.';
  return null;
}
/** Projeção pedagógica da grade atual. Não usa horas de pagamento nem cargas fixas de regência. */
export function computeAcademicWorkload(lessons: Lesson[],classes: SchoolClass[],periods: Period[],enabledDays: Weekday[],projection: AcademicProjection): AcademicWorkload {
  const error=validateAcademicProjection(projection);if(error)throw new Error(error);
  const weeks=projection.basis==='days'?projection.schoolDays/projection.daysPerWeek:projection.weeks;
  const visible=new Map(classes.map((c)=>[c.id,c]));
  const groups=new Map<string,{classId:number;subjectId:number|null;slots:Set<string>}>();
  let outsideDays=0;
  for(const lesson of lessons) {
    const schoolClass=visible.get(lesson.classId);if(!schoolClass)continue;
    if(!enabledDays.includes(lesson.weekday)){outsideDays++;continue;}
    const key=`${lesson.classId}:${lesson.subjectId}`;
    if(!groups.has(key))groups.set(key,{classId:lesson.classId,subjectId:lesson.subjectId,slots:new Set()});
    const group=groups.get(key)!;
    const slots=periods.filter((p)=>p.kind==='aula'&&shiftsOfClass(schoolClass.shift).includes(p.shift)&&overlaps(p.start,p.end,lesson.start,lesson.end));
    // Dois professores na mesma disciplina/tempo não duplicam a carga da turma.
    if(slots.length)for(const slot of slots)group.slots.add(`${lesson.weekday}:period:${slot.id}`);
    else group.slots.add(`${lesson.weekday}:custom:${lesson.start}:${lesson.end}`);
  }
  const rows=[...groups.values()].map(({classId,subjectId,slots})=>{
    const weeklyPeriods=slots.size,weeklyMinutes=weeklyPeriods*projection.minutesPerPeriod;
    return {classId,subjectId,minutesPerPeriod:projection.minutesPerPeriod,equivalentWeeks:weeks,weeklyPeriods,weeklyMinutes,projectedPeriods:weeklyPeriods*weeks,projectedMinutes:Math.round(weeklyMinutes*weeks)};
  });
  const total=rows.reduce((sum,row)=>({weeklyPeriods:sum.weeklyPeriods+row.weeklyPeriods,weeklyMinutes:sum.weeklyMinutes+row.weeklyMinutes,projectedPeriods:sum.projectedPeriods+row.projectedPeriods,projectedMinutes:sum.projectedMinutes+row.projectedMinutes}),{weeklyPeriods:0,weeklyMinutes:0,projectedPeriods:0,projectedMinutes:0});
  return {projection,equivalentWeeks:weeks,rows,total,outsideDays};
}
