import {describe,expect,it} from 'vitest';
import {computeAcademicWorkload,validateAcademicProjection,type AcademicProjection} from '../shared/academicWorkload';
import type {Lesson,Period,SchoolClass} from '../shared/types';
const projection:AcademicProjection={year:2027,basis:'days',schoolDays:201,daysPerWeek:5,weeks:24,minutesPerPeriod:50};
const classes=[{id:1,name:'1001 CE',shift:'manha',unitId:1},{id:2,name:'1002 JP',shift:'tarde',unitId:2}] as SchoolClass[];
const periods=[{id:1,shift:'manha',kind:'aula',start:'07:30',end:'08:20'},{id:2,shift:'manha',kind:'aula',start:'08:20',end:'09:10'},{id:3,shift:'manha',kind:'intervalo',start:'09:10',end:'09:30'}] as Period[];
const lesson={id:1,classId:1,subjectId:1,teacherId:1,weekday:1,start:'07:30',end:'08:20'} as Lesson;
const calc=(lessons:Lesson[],p=projection,cc=classes)=>computeAcademicWorkload(lessons,cc,periods,[1,2,3,4,5],p);
describe('carga pedagógica por turma e disciplina',()=>{
 it('dois tempos de 50 min dão 1h40 por semana e 67h em 201 dias',()=>{const w=calc([lesson,{...lesson,id:2,weekday:2}]);expect(w.equivalentWeeks).toBe(40.2);expect(w.rows[0]).toMatchObject({weeklyPeriods:2,weeklyMinutes:100,projectedMinutes:4020});});
 it('reproduz 1h40 semanal e 40h no módulo de 24 semanas',()=>{expect(calc([{...lesson,end:'09:10'}],{...projection,basis:'weeks',weeks:24}).rows[0]).toMatchObject({weeklyPeriods:2,weeklyMinutes:100,projectedMinutes:2400});});
 it('soma as outras disciplinas e turmas sem misturar seus dados',()=>{const w=calc([lesson,{...lesson,id:2,subjectId:2},{...lesson,id:3,classId:2,start:'13:00',end:'13:50'}]);expect(w.rows).toHaveLength(3);expect(w.total).toMatchObject({weeklyPeriods:3,weeklyMinutes:150,projectedMinutes:6030});expect(calc([lesson,{...lesson,classId:2} ],projection,[classes[0]]).rows).toHaveLength(1);});
 it('não duplica a carga com dois professores ou registros sobrepostos no mesmo tempo',()=>{const w=calc([lesson,{...lesson,id:2,teacherId:2},{...lesson,id:3,start:'07:40',end:'08:10'}]);expect(w.total.weeklyPeriods).toBe(1);});
 it('conta aula dupla, ignora intervalo e usa a duração pedagógica escolhida',()=>{const w=calc([{...lesson,end:'09:30'}],{...projection,minutesPerPeriod:60});expect(w.total.weeklyPeriods).toBe(2);expect(w.total.weeklyMinutes).toBe(120);});
 it('inclui disciplina com professor não definido ou sem pagamento: PPP não é folha de pagamento',()=>{const w=calc([{...lesson,teacherId:null,workloadKind:'excluded'}]);expect(w.total.weeklyPeriods).toBe(1);});
 it('mantém aulas sem disciplina identificadas e avisa dias fora do calendário semanal',()=>{const w=calc([{...lesson,subjectId:null},{...lesson,id:2,weekday:6}]);expect(w.rows[0].subjectId).toBeNull();expect(w.outsideDays).toBe(1);expect(w.total.weeklyPeriods).toBe(1);});
 it('valida parâmetros sem gerar NaN ou totais negativos',()=>{for(const p of [{...projection,schoolDays:0},{...projection,daysPerWeek:0},{...projection,minutesPerPeriod:NaN},{...projection,minutesPerPeriod:50.5},{...projection,basis:'weeks' as const,weeks:-1}]){expect(validateAcademicProjection(p)).not.toBeNull();expect(()=>calc([lesson],p)).toThrow();}});
});
