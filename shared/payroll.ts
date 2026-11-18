import { computeWorkload, lessonTimeCount, monthWeekdayCounts, type Load, type Workload } from './workload.js';
import { SEGMENT_SUBJECTS } from './segments.js';
import type { Lesson, Period, SchoolClass, Settings, Subject, Teacher, Weekday } from './types.js';
const fold=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const subjectKey=(value:string)=>fold(value).replace(/\b(de|da|do|dos|das|a|as)\b/g,' ').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
const technicalNames = new Set(SEGMENT_SUBJECTS.tecnico.filter(name=>!['projeto de vida','projeto integrador'].includes(fold(name))).map(subjectKey));
const regularNames=new Set([...SEGMENT_SUBJECTS.infantil,...SEGMENT_SUBJECTS.fund1,...SEGMENT_SUBJECTS.fund2,...SEGMENT_SUBJECTS.medio].map(subjectKey));
/** Estar em uma turma/segmento técnico não torna Matemática, Gramática etc. disciplinas técnicas. */
export function subjectDefaultWorkloadKind(subject:Subject|undefined):'regular'|'technical' {
  if(subject?.workloadKind==='regular'||subject?.workloadKind==='technical')return subject.workloadKind;
  if(!subject)return 'regular';
  const name=subjectKey(subject.name);
  if(technicalNames.has(name)||/ingles tecnico/.test(name))return 'technical';
  if(regularNames.has(name))return 'regular';
  return subject.segments?.length===1&&subject.segments[0]==='tecnico'?'technical':'regular';
}
export function isEarlyClass(schoolClass: SchoolClass | undefined) {
  const name=fold(`${schoolClass?.name ?? ''} ${schoolClass?.grade ?? ''}`);
  return /infantil|maternal|bercario|fund\.?\s*(i\b|1\b)|fundamental\s*(i\b|1\b)/.test(name);
}
export function lessonWorkloadKind(lesson: Lesson, subjects: Subject[]): 'regular'|'technical'|'excluded' {
  if(lesson.teacherId===null || lesson.workloadKind==='excluded')return 'excluded';
  if(lesson.workloadKind==='regular' || lesson.workloadKind==='technical')return lesson.workloadKind;
  return subjectDefaultWorkloadKind(subjects.find((s)=>s.id===lesson.subjectId));
}
export function minutesPerLesson(lesson:Lesson, classes:SchoolClass[],subjects:Subject[]) {
  return lessonWorkloadKind(lesson,subjects)==='technical' ? 50 : isEarlyClass(classes.find((c)=>c.id===lesson.classId)) ? 60 : 50;
}
export interface PayrollScope { scope:'dia'|'semana'|'mes'; day:Weekday; month:string; includeRegency?:boolean;includeReferences?:boolean }
export function computePayrollWorkload(lessons:Lesson[],teachers:Teacher[],classes:SchoolClass[],subjects:Subject[],periods:Period[],settings:Settings,scope:PayrollScope):Workload {
  const counts=monthWeekdayCounts(scope.month,settings.enabledDays,settings.excludedDates);
  const occurs=(l:Lesson)=>scope.scope==='mes'?counts[l.weekday]:1;
  const filtered=lessons.filter((l)=>scope.scope!=='dia'||l.weekday===scope.day);
  const classIds=new Set(classes.map((c)=>c.id));
  const regencyClasses=new Map(teachers.map((t)=>[t.id,t.payrollProfiles?.flatMap((p)=>p.regencies) ?? []]));
  const billable=filtered.filter((l)=>lessonWorkloadKind(l,subjects)!=='excluded' && !regencyClasses.get(l.teacherId!)?.some((r)=>r.classId===l.classId&&r.weekdays.includes(l.weekday)));
  const units=(l:Lesson)=>lessonTimeCount(l,periods,classes);
  const w=computeWorkload(billable,teachers,classes,undefined,units,occurs,(l)=>units(l)*minutesPerLesson(l,classes,subjects));
  for(const row of w.rows) {
    const own=filtered.filter((l)=>l.teacherId===row.teacher.id&&classIds.has(l.classId));
    const billableOwn=billable.filter((l)=>l.teacherId===row.teacher.id&&classIds.has(l.classId));
    const days=new Set(own.filter((l)=>occurs(l)>0).map((l)=>l.weekday));
    const payroll={regularLessons:0,technicalLessons:0,regularMinutes:0,technicalMinutes:0,regencyMinutes:0,days:[] as Weekday[],attendanceDays:0,referenceRegular:0,referenceTechnical:0,hasReference:false};
    const grouped=new Map<string,import('./workload.js').SubjectLoad>();
    for(const l of billableOwn) {
      const technical=lessonWorkloadKind(l,subjects)==='technical';
      const count=units(l)*occurs(l),minutes=count*minutesPerLesson(l,classes,subjects);
      const kind=technical?'technical':'regular',key=`${l.subjectId}-${kind}`;
      if(!grouped.has(key))grouped.set(key,{subjectId:l.subjectId,workloadKind:kind,label:`${subjects.find((s)=>s.id===l.subjectId)?.name ?? 'Sem disciplina'} - ${technical?'Técnico':'Regular'}`,byClass:new Map(),total:{lessons:0,minutes:0}});
      const subject=grouped.get(key)!;
      const classLoad=subject.byClass.get(l.classId)??{lessons:0,minutes:0};classLoad.lessons+=count;classLoad.minutes+=minutes;subject.byClass.set(l.classId,classLoad);subject.total.lessons+=count;subject.total.minutes+=minutes;
      if(technical){payroll.technicalLessons+=count;payroll.technicalMinutes+=minutes;}
      else {payroll.regularLessons+=count;payroll.regularMinutes+=minutes;}
    }
    row.bySubject=[...grouped.values()];
    for(const profile of row.teacher.payrollProfiles ?? []) {
      if(!classes.some((c)=>c.unitId===profile.unitId))continue;
      for(const reference of (scope.includeReferences===false ? [] : profile.references)) {
        payroll.hasReference=true;
        if(reference.kind==='technical')payroll.referenceTechnical+=reference.weeklyLessons;else payroll.referenceRegular+=reference.weeklyLessons;
      }
      for(const regency of profile.regencies.filter((r)=>scope.includeRegency!==false && classIds.has(r.classId) && w.classTotals.has(r.classId))) {
        const daysCount=scope.scope==='dia' ? Number(regency.weekdays.includes(scope.day)) : scope.scope==='mes' ? regency.weekdays.reduce((sum,d)=>sum+counts[d],0) : regency.weekdays.length;
        const minutes=daysCount*(regency.segment==='infantil'?240:270);
        if(!minutes)continue;
        for(const day of regency.weekdays)if((scope.scope!=='dia'||day===scope.day)&&(scope.scope!=='mes'||counts[day]>0))days.add(day);
        const load:Load={lessons:0,minutes};
        const current=row.byClass.get(regency.classId)??{lessons:0,minutes:0};current.minutes+=minutes;row.byClass.set(regency.classId,current);
        row.total.minutes+=minutes;w.grand.minutes+=minutes;
        const classLoad=w.classTotals.get(regency.classId)!;classLoad.minutes+=minutes;
        payroll.regencyMinutes+=minutes;
        row.bySubject.push({subjectId:null,workloadKind:'regency',label:`Regência - ${regency.segment==='infantil'?'Infantil (4h/dia)':'Fundamental I (4h30/dia)'}`,byClass:new Map([[regency.classId,load]]),total:load});
      }
    }
    payroll.days=[...days].sort();
    payroll.attendanceDays=scope.scope==='mes'?payroll.days.reduce((sum,d)=>sum+counts[d],0):payroll.days.length;
    row.payroll=payroll;
  }
  return w;
}

export interface PayrollClassBreakdown {
  regularLessons:number;regularMinutes:number;technicalLessons:number;technicalMinutes:number;regencyMinutes:number;totalLessons:number;totalMinutes:number;
}
/** Mesma separação em todos os relatórios, inclusive quando a turma mistura os dois tipos. */
export function payrollClassBreakdown(row:import('./workload.js').TeacherLoad,classId:number):PayrollClassBreakdown {
 const result:PayrollClassBreakdown={regularLessons:0,regularMinutes:0,technicalLessons:0,technicalMinutes:0,regencyMinutes:0,totalLessons:row.byClass.get(classId)?.lessons??0,totalMinutes:row.byClass.get(classId)?.minutes??0};
 for(const subject of row.bySubject){const load=subject.byClass.get(classId);if(!load)continue;if(subject.workloadKind==='regency')result.regencyMinutes+=load.minutes;else if(subject.workloadKind==='technical'){result.technicalLessons+=load.lessons;result.technicalMinutes+=load.minutes;}else{result.regularLessons+=load.lessons;result.regularMinutes+=load.minutes;}}
 return result;
}
