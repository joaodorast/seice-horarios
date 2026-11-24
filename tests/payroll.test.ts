import {describe,expect,it} from 'vitest';
import {computePayrollWorkload,lessonWorkloadKind,payrollClassBreakdown,subjectDefaultWorkloadKind,regencyDayMinutes} from '../shared/payroll.js';
import {validateLesson} from '../shared/conflicts.js';
import type {Lesson,Teacher,SchoolClass,Subject,Settings} from '../shared/types.js';
const ts = '2026-01-01T00:00:00.000Z';
const teacher = (id: number, name: string, active = true): Teacher => ({
  id, name, code: null, area: null, phone: null, notes: null, active, createdAt: ts, updatedAt: ts, photoUpdatedAt: null, subjectIds: [], availability: [],
});
const klass = (id: number, name: string, shift: SchoolClass['shift'] = 'manha', active = true): SchoolClass => ({
  id, name, grade: '', shift, notes: null, active, createdAt: ts, updatedAt: ts,
});
let seq = 1;
const lesson = (teacherId: number | null, classId: number, subjectId: number | null, start: string, end: string): Lesson => ({
  id: seq++, teacherId, classId, subjectId, weekday: 1, start, end, notes: null, createdAt: ts, updatedAt: ts,
});


const settings:Settings={enabledDays:[1,2,3,4,5],enabledShifts:['manha'],lessonDuration:50};
const subjects:Subject[]=[{id:1,name:'Geografia',color:'sky',createdAt:ts},{id:2,name:'Projeto de Vida',color:'teal',createdAt:ts},{id:3,name:'Inglês Técnico II',color:'violet',createdAt:ts}];
const classes=[{...klass(10,'CE Fund I'),unitId:1},{...klass(11,'CE Ensino Médio'),unitId:1},{...klass(12,'CE Infantil'),unitId:1},{...klass(13,'JP Fund I'),unitId:2}];
const t={...teacher(1,'Professor'),unitId:1,unitIds:[1,2]};
const compute=(lessons:Lesson[],teachers:Teacher[]=[t],scope:any={scope:'semana',day:1,month:'2027-03'},ss=subjects,cc=classes,config=settings)=>computePayrollWorkload(lessons,teachers,cc,ss,[],config,scope);
describe('regras de pagamento e dias no colégio',()=>{
  it('separa 6 regulares e 6 técnicos, ambos de 50 minutos no médio',()=>{
    const lessons=[...Array.from({length:6},()=>lesson(1,11,1,'07:30','08:20')),...Array.from({length:6},()=>({...lesson(1,11,2,'08:20','09:10'),workloadKind:'technical' as const}))];
    const w=compute(lessons);expect(w.rows[0].payroll).toMatchObject({regularLessons:6,technicalLessons:6,regularMinutes:300,technicalMinutes:300,days:[1],attendanceDays:1});expect(w.grand).toEqual({lessons:12,minutes:600});
  });
  it('disciplina e aula podem trocar classificação sem mudar a grade',()=>{
    const l=lesson(1,11,2,'07:30','08:20');expect(lessonWorkloadKind(l,subjects)).toBe('regular');
    const changed=subjects.map((s)=>s.id===2?{...s,workloadKind:'technical' as const}:s);expect(compute([l],[t],undefined,changed).rows[0].payroll?.technicalLessons).toBe(1);
    expect(lessonWorkloadKind({...l,workloadKind:'regular'},changed)).toBe('regular');expect(lessonWorkloadKind({...l,workloadKind:'excluded'},changed)).toBe('excluded');
  });
  it('especialista do Infantil e Fund I usa 60 minutos; técnico usa 50',()=>{
    expect(compute([lesson(1,10,1,'07:30','08:20')]).grand.minutes).toBe(60);
    expect(compute([lesson(1,12,1,'07:30','08:20')]).grand.minutes).toBe(60);
    expect(compute([lesson(1,10,3,'07:30','08:20')]).grand.minutes).toBe(50);
  });
  it('separa o exemplo do Carlos por turma e também mistura tipos na mesma turma sem duplicar',()=>{
    const technical={...subjects[0],id:9,name:'Práticas de Laboratório I',workloadKind:'technical' as const};
    const ls=[lesson(1,11,9,'07:30','08:20'),{...lesson(1,11,9,'08:20','09:10'),weekday:2 as const},lesson(1,10,1,'07:30','08:20')];
    const w=compute(ls,[t],undefined,[...subjects,technical]);
    expect(payrollClassBreakdown(w.rows[0],11)).toMatchObject({regularLessons:0,technicalLessons:2,technicalMinutes:100,totalMinutes:100});
    expect(payrollClassBreakdown(w.rows[0],10)).toMatchObject({regularLessons:1,regularMinutes:60,technicalLessons:0});
    const mixed=compute([...ls,{...lesson(1,11,1,'09:10','10:00'),weekday:3 as const}],[t],undefined,[...subjects,technical]);
    const p=payrollClassBreakdown(mixed.rows[0],11);expect(p).toMatchObject({regularLessons:1,regularMinutes:50,technicalLessons:2,technicalMinutes:100,totalMinutes:150});
    expect(p.regularMinutes+p.technicalMinutes+p.regencyMinutes).toBe(p.totalMinutes);
  });
  it('não transforma disciplinas regulares em técnicas só pelo segmento e reconhece variantes de nomes',()=>{
    for(const name of ['Matemática','Gramática','Redação','Sociologia','Educação Física','Artes','Geografia'])expect(subjectDefaultWorkloadKind({...subjects[0],name,segments:['tecnico']})).toBe('regular');
    for(const name of ['Mídias Digitais I','Práticas Laboratório I','Inglês Técnico II','Introdução a Informática','Lógica de Programação','Redes de Computadores I','Sistemas Operacionais'])expect(subjectDefaultWorkloadKind({...subjects[0],name})).toBe('technical');
    expect(subjectDefaultWorkloadKind({...subjects[0],name:'Mídias Digitais I',workloadKind:'regular'})).toBe('regular');
    expect(subjectDefaultWorkloadKind({...subjects[0],name:'Módulo específico de Administração',segments:['tecnico']})).toBe('technical');
  });
  it('regência do Fund I soma 22h30, não multiplica as disciplinas',()=>{
    const regent={...t,payrollProfiles:[{unitId:1,references:[],regencies:[{classId:10,segment:'fund1' as const,weekdays:[1,2,3,4,5] as any}]}]};
    const w=compute(Array.from({length:20},()=>lesson(1,10,1,'07:30','08:20')),[regent]);expect(w.grand).toEqual({lessons:0,minutes:1350});expect(w.rows[0].payroll).toMatchObject({regencyMinutes:1350,attendanceDays:5});expect(w.rows[0].bySubject.reduce((sum,s)=>sum+s.total.minutes,0)).toBe(1350);
    expect(compute([],[regent],{scope:'dia',day:1,month:'2027-03'}).grand.minutes).toBe(270);
    expect(compute([],[regent],{scope:'dia',day:6,month:'2027-03'}).grand.minutes).toBe(0);
  });
  it('duas turmas Fund I somam 45h = 2700 minutos, sem somar novamente as disciplinas',()=>{
    const other={...klass(14,'1002 CE Fund I','tarde'),unitId:1};
    const regent={...t,payrollProfiles:[{unitId:1,references:[],regencies:[{classId:10,segment:'fund1' as const,weekdays:[1,2,3,4,5] as any},{classId:14,segment:'fund1' as const,weekdays:[1,2,3,4,5] as any}]}]};
    const w=compute([lesson(1,10,1,'07:30','08:20'),lesson(1,14,1,'13:00','13:50')],[regent],undefined,subjects,[...classes,other]);
    expect(w.rows[0].byClass.get(10)?.minutes).toBe(1350);expect(w.rows[0].byClass.get(14)?.minutes).toBe(1350);
    expect(w.grand).toEqual({lessons:0,minutes:2700});expect(w.rows[0].payroll?.regencyMinutes).toBe(2700);expect(w.rows[0].payroll?.attendanceDays).toBe(5);
    const infant={...regent,payrollProfiles:[{unitId:1,references:[],regencies:[{classId:12,segment:'infantil' as const,weekdays:[1,2,3,4,5] as any}]}]};
    expect(compute([],[infant]).grand.minutes).toBe(1200);
  });
  it('regência infantil soma 20h semanais e não cobra na unidade de outra turma',()=>{
    const regent={...t,payrollProfiles:[{unitId:1,references:[],regencies:[{classId:12,segment:'infantil' as const,weekdays:[1,2,3,4,5] as any}]}]};
    expect(compute([],[regent]).grand.minutes).toBe(1200);expect(compute([],[regent],undefined,subjects,[classes[3]]).grand.minutes).toBe(0);
  });
  it('mensal conta calendário real e desconta datas sem aula na regência',()=>{
    const regent={...t,payrollProfiles:[{unitId:1,references:[],regencies:[{classId:10,segment:'fund1' as const,weekdays:[1,2,3,4,5] as any}]}]};
    const w=compute([],[regent],{scope:'mes',day:1,month:'2027-03'},subjects,classes,{...settings,excludedDates:['2027-03-01']});expect(w.grand.minutes).toBe(22*270);expect(w.rows[0].payroll?.attendanceDays).toBe(22);
  });
  it('não converte referência da escola em aulas fictícias',()=>{
    const ref={...t,payrollProfiles:[{unitId:1,references:[{label:'Informática',kind:'technical' as const,weeklyLessons:10}],regencies:[]}]};
    const w=compute([],[ref]);expect(w.grand.lessons).toBe(0);expect(w.grand.minutes).toBe(0);expect(w.rows[0].payroll).toMatchObject({referenceTechnical:10,days:[],attendanceDays:0});
  });
  it('conta dias únicos mesmo com várias aulas e aulas sem pagamento',()=>{
    const l=lesson(1,11,1,'07:30','08:20');const w=compute([l,{...l,id:999,start:'08:20',end:'09:10'},{...l,id:1000,weekday:2,workloadKind:'excluded'}]);expect(w.rows[0].payroll?.days).toEqual([1,2]);expect(w.rows[0].payroll?.attendanceDays).toBe(2);expect(w.grand.lessons).toBe(2);
  });
  it('atividades sem professor não geram pagamento nem falso conflito de professor',()=>{
    const l=lesson(null,10,2,'07:30','08:20');expect(compute([l]).grand).toEqual({lessons:0,minutes:0});
    const issues=validateLesson({...l,id:100,classId:11},{lessons:[l],teachers:[t],classes,subjects,periods:[],settings});expect(issues.some((i)=>i.code==='teacher-missing'||i.code==='teacher-overlap')).toBe(false);
    expect(validateLesson({...l,id:100},{lessons:[l],teachers:[t],classes,subjects,periods:[],settings}).some((i)=>i.code==='class-overlap')).toBe(true);
  });
  it('filtrar disciplina não fraciona nem multiplica a regência',()=>{
    const regent={...t,payrollProfiles:[{unitId:1,references:[],regencies:[{classId:10,segment:'fund1' as const,weekdays:[1,2,3,4,5] as any}]}]};expect(compute([lesson(1,10,1,'07:30','08:20')],[regent],{scope:'semana',day:1,month:'2027-03',includeRegency:false}).grand.minutes).toBe(0);
  });
  it('referências semanais não aparecem como soma parcial de uma disciplina',()=>{
    const ref={...t,payrollProfiles:[{unitId:1,references:[{label:'Geografia',kind:'regular' as const,weeklyLessons:6}],regencies:[]}]};
    const w=compute([lesson(1,11,1,'07:30','08:20')],[ref],{scope:'semana',day:1,month:'2027-03',includeReferences:false});expect(w.rows[0].payroll?.hasReference).toBe(false);expect(w.grand.minutes).toBe(50);
  });

  it('aula fora dos dias de regência é contabilizada separadamente',()=>{
    const regent={...t,payrollProfiles:[{unitId:1,references:[],regencies:[{classId:10,segment:'fund1' as const,weekdays:[1,2,3,4,5] as any}]}]};
    const extra={...lesson(1,10,1,'07:30','08:20'),weekday:6 as const};const w=compute([extra],[regent]);expect(w.grand).toEqual({lessons:1,minutes:1410});expect(w.rows[0].payroll?.regularMinutes).toBe(60);
  });

});


describe('carga semanal fixa personalizada', () => {
  it('distribui minutos inteiros e preserva o total semanal de cargas indivisíveis', () => {
    const regency = {segment:'fund1' as const, weekdays:[1,2,3,4,5] as any, weeklyMinutes:1111};
    const minutes = regency.weekdays.map((day:any) => regencyDayMinutes(regency,day));
    expect(minutes).toEqual([223,222,222,222,222]);
    expect(minutes.reduce((sum:number,value:number) => sum+value,0)).toBe(1111);
    expect(regencyDayMinutes(regency,6)).toBe(0);
  });
  it('aplica o valor semanal informado e distribui os dias sem duplicar disciplinas', () => {
    const regent = {...t, payrollProfiles: [{unitId: 1, references: [], regencies: [{classId: 10, segment: 'fund1' as const, weekdays: [1,2,3,4,5] as any, weeklyMinutes: 1110}]}]};
    const result = compute([lesson(1,10,1,'07:30','08:20'), lesson(1,10,2,'08:20','09:10')], [regent]);
    expect(result.grand.minutes).toBe(1110);
    expect(result.rows[0].payroll?.regularMinutes).toBe(0);
    expect(compute([], [regent], {scope:'dia',day:1,month:'2027-03'}).grand.minutes).toBe(222);
    expect(compute([], [regent], {scope:'mes',day:1,month:'2027-03'}).grand.minutes).toBe(23*222);
  });
  it('permite 22h30 também na Educação Infantil', () => {
    const regent = {...t, payrollProfiles: [{unitId:1, references:[], regencies:[{classId:12, segment:'infantil' as const, weekdays:[1,2,3,4,5] as any, weeklyMinutes:1350}]}]};
    expect(compute([], [regent]).grand.minutes).toBe(1350);
  });
});
