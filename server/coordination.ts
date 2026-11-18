import type {SchoolClass} from '../shared/types.js';
export type CoordinationSegment='infantil'|'fund1'|'fund2'|'medio'|'tecnico';
export interface ClassScopeRule {segment:CoordinationSegment;years?:number[]}
export function parseClassScope(v:unknown):ClassScopeRule[]|null {
 if(v==null)return null;
 if(!Array.isArray(v)||v.some(r=>!r||!['infantil','fund1','fund2','medio','tecnico'].includes(r.segment)||(r.years!==undefined&&(!Array.isArray(r.years)||r.years.some((n:unknown)=>!Number.isInteger(n)||Number(n)<1||Number(n)>9)))))return [];
 return v.map(r=>({segment:r.segment,...(r.years?{years:r.years}:{})}));
}
const fold=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
/** A identificação da turma prevalece: o primeiro ano comum CE tem etapa genérica Médio Técnico. */
export function coordinationClass(c:Pick<SchoolClass,'name'|'grade'>):{segment:CoordinationSegment|null;year:number|null}{
 const m=fold(`${c.name} ${c.grade}`).match(/\b([1-9])\s*[º°ªo]?\s*(?:ano|serie)\b/),year=m?Number(m[1]):null;
 const detect=(s:string):CoordinationSegment|null=>{
  if(/infantil|maternal|bercario|\bpre\s*[-.]?\s*(i{1,2}|[12]|escola)\b/.test(s))return 'infantil';
  if(/fund(?:amental)?\.?\s*(ii\b|2\b)/.test(s))return 'fund2';
  if(/fund(?:amental)?\.?\s*(i\b|1\b)/.test(s))return 'fund1';
  if(/tecnico|\btec\.|enfermagem|informatica|administracao/.test(s))return 'tecnico';
  if(/medio/.test(s))return 'medio';return null;
 };
 return {segment:detect(fold(c.name))??detect(fold(c.grade))??(year!==null?(year>=6?'fund2':'fund1'):null),year};
}
export function matchesClassScope(scope:ClassScopeRule[]|null|undefined,c:Pick<SchoolClass,'name'|'grade'>){if(scope==null)return true;const {segment,year}=coordinationClass(c);return scope.some(r=>r.segment===segment&&(!r.years||year!==null&&r.years.includes(year)));}
