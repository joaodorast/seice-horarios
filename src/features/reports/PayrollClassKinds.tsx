import { payrollClassBreakdown } from '@shared/payroll';
import type { TeacherLoad } from '@shared/workload';
import { formatHours } from '@/lib/format';
export function PayrollClassKinds({row,classId}:{row:TeacherLoad;classId:number}) {
 const p=payrollClassBreakdown(row,classId);
 const names=(kind:'regular'|'technical')=>[...new Set(row.bySubject.filter(subject=>subject.workloadKind===kind&&subject.byClass.has(classId)).map(subject=>subject.label?.replace(/ - (Técnico|Regular)$/,'')??'Sem disciplina'))].join('; ');
 return <div className="space-y-2 text-sm leading-relaxed">
  {p.regularLessons>0&&<div className="rounded-lg border border-[#bdd6f4] bg-[#edf5ff] px-3 py-2 text-[#163d68]"><strong>{p.regularLessons} {p.regularLessons===1?'tempo regular (normal)':'tempos regulares (normais)'}</strong><span className="block">{p.regularMinutes.toLocaleString('pt-BR')} min · {formatHours(p.regularMinutes)}</span><span className="mt-1 block text-xs">{names('regular')}</span></div>}
  {p.technicalLessons>0&&<div className="rounded-lg border border-[#ecd891] bg-[#fff7db] px-3 py-2 text-[#725000]"><strong>{p.technicalLessons} {p.technicalLessons===1?'tempo técnico':'tempos técnicos'}</strong><span className="block">{p.technicalMinutes.toLocaleString('pt-BR')} min · {formatHours(p.technicalMinutes)}</span><span className="mt-1 block text-xs">{names('technical')}</span></div>}
  {p.regencyMinutes>0&&<div className="rounded-lg border border-[#b9dfc7] bg-[#eaf7ef] px-3 py-2 text-[#14532d]"><strong>CARGA FIXA DE REGÊNCIA</strong><span className="block">{p.regencyMinutes.toLocaleString('pt-BR')} min · {formatHours(p.regencyMinutes)}</span></div>}
 </div>;
}
