import { z } from 'zod';
import { SEGMENT_KEYS, SEGMENT_LABEL, type SegmentKey } from './segments.js';
import { computeAcademicWorkload, type AcademicProjection, type AcademicWorkload } from './academicWorkload.js';
import type { Lesson, Period, SchoolClass, Weekday } from './types.js';
export type AcademicValues = Omit<AcademicProjection,'year'>;
export interface AcademicRule { id:number;unitId:number;year:number;scope:'unit'|'segment'|'class';segment:SegmentKey|null;classId:number|null;values:Partial<AcademicValues>;updatedAt:string }
export const INITIAL_ACADEMIC_VALUES:AcademicValues={basis:'days',schoolDays:201,daysPerWeek:5,weeks:24,minutesPerPeriod:50};
const valuesSchema=z.object({basis:z.enum(['days','weeks']).optional(),schoolDays:z.number().int().min(1).max(366).optional(),daysPerWeek:z.number().int().min(1).max(6).optional(),weeks:z.number().positive().max(60).optional(),minutesPerPeriod:z.number().int().min(1).max(240).optional()}).strict();
export const academicRuleSchema=z.object({unitId:z.number().int().positive(),year:z.number().int().min(2000).max(9999),scope:z.enum(['unit','segment','class']),segment:z.enum(SEGMENT_KEYS).nullable().default(null),classId:z.number().int().positive().nullable().default(null),values:valuesSchema,expectedUpdatedAt:z.string().nullable().optional()}).strict().superRefine((v,ctx)=>{
 if(v.scope==='unit'&&(v.classId!==null||v.segment!==null))ctx.addIssue({code:'custom',message:'O padrão da unidade não usa turma ou segmento.'});
 if(v.scope==='segment'&&(!v.segment||v.classId!==null))ctx.addIssue({code:'custom',message:'Escolha o segmento, sem indicar turma.'});
 if(v.scope==='class'&&!v.classId)ctx.addIssue({code:'custom',message:'Escolha uma turma.'});
 if(v.scope==='unit'&&Object.keys(INITIAL_ACADEMIC_VALUES).some(key=>v.values[key as keyof AcademicValues]===undefined))ctx.addIssue({code:'custom',message:'Preencha todos os parâmetros do padrão da unidade.'});
 if(v.scope!=='unit'&&!Object.keys(v.values).length&&!(v.scope==='class'&&v.segment))ctx.addIssue({code:'custom',message:'Personalize pelo menos um campo ou remova a personalização.'});
});
export type AcademicRuleInput=z.input<typeof academicRuleSchema>;
const fold=(v:string)=>v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
/** Reconhece o segmento no cadastro da turma; uma regra específica pode corrigir a identificação para o PPP. */
export function academicClassSegment(c:SchoolClass):SegmentKey|null {
 const text=fold(`${c.grade} ${c.name}`);
 if(/tecnico|enfermagem|administracao|informatica/.test(text))return 'tecnico';
 if(/infantil|maternal|bercario|pre[- ]?escola/.test(text))return 'infantil';
 if(/fund(?:amental)?\.?\s*(ii\b|2\b)/.test(text))return 'fund2';
 if(/fund(?:amental)?\.?\s*(i\b|1\b)/.test(text))return 'fund1';
 if(/medio/.test(text))return 'medio';
 return null;
}
export function resolveAcademicRule(c:SchoolClass,rules:AcademicRule[],year:number){
 const own=rules.filter(r=>r.year===year&&r.unitId===c.unitId),base=own.find(r=>r.scope==='unit');
 const specific=own.find(r=>r.scope==='class'&&r.classId===c.id),segment=specific?.segment??academicClassSegment(c);
 const segmentRule=own.find(r=>r.scope==='segment'&&r.segment===segment);
 const projection:AcademicProjection={year,...INITIAL_ACADEMIC_VALUES,...base?.values,...segmentRule?.values,...specific?.values};
 const source=specific?'Personalização da turma':segmentRule?`Regra de ${SEGMENT_LABEL[segment!]}`:'Padrão da unidade';
 return {projection,segment,source,configured:Boolean(base),base,segmentRule,specific};
}
export function configuredAcademicWorkload(lessons:Lesson[],classes:SchoolClass[],periods:Period[],days:Weekday[],rules:AcademicRule[],year:number):AcademicWorkload {
 const resolved=classes.map(c=>({classId:c.id,...resolveAcademicRule(c,rules,year)}));
 const results=resolved.filter(r=>r.configured).map(r=>computeAcademicWorkload(lessons,classes.filter(c=>c.id===r.classId),periods,days,r.projection));
 const rows=results.flatMap(w=>w.rows),reference=results[0]??computeAcademicWorkload([],[],periods,days,{year,...INITIAL_ACADEMIC_VALUES});
 return {...reference,rows,total:rows.reduce((sum,row)=>({weeklyPeriods:sum.weeklyPeriods+row.weeklyPeriods,weeklyMinutes:sum.weeklyMinutes+row.weeklyMinutes,projectedPeriods:sum.projectedPeriods+row.projectedPeriods,projectedMinutes:sum.projectedMinutes+row.projectedMinutes}),{weeklyPeriods:0,weeklyMinutes:0,projectedPeriods:0,projectedMinutes:0}),outsideDays:results.reduce((sum,w)=>sum+w.outsideDays,0),classProjections:resolved.filter(r=>r.configured).map(r=>({classId:r.classId,projection:r.projection,source:r.source})),missingClasses:resolved.filter(r=>!r.configured).map(r=>r.classId)};
}
