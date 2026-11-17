import type { TeacherLoad } from '@shared/workload';
import { WEEKDAY_LABEL } from '@shared/labels';
import { formatHours } from '@/lib/format';
export function PayrollBreakdown({row,scope}:{row:TeacherLoad;scope:'dia'|'semana'|'mes'}) {
  const p=row.payroll;if(!p)return null;
  return <div className="rounded-xl border border-line bg-surface p-4">
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-lg bg-[#edf5ff] p-3"><p className="text-sm font-bold">Regulares (normais)</p><p className="mt-1 text-lg font-bold">{p.regularLessons} tempos · {formatHours(p.regularMinutes)}</p></div>
      <div className="rounded-lg bg-[#fff7db] p-3"><p className="text-sm font-bold">Técnicos</p><p className="mt-1 text-lg font-bold">{p.technicalLessons} tempos · {formatHours(p.technicalMinutes)}</p></div>
      <div className="rounded-lg bg-[#eaf7ef] p-3"><p className="text-sm font-bold">Regência com carga fixa</p><p className="mt-1 text-lg font-bold">{formatHours(p.regencyMinutes)}</p></div>
    </div>
    <p className="mt-3 text-sm leading-relaxed"><strong>Dias no colégio neste recorte:</strong> {p.days.length ? p.days.map((d)=>WEEKDAY_LABEL[d]).join(', ') : 'Nenhuma aula ou regência informada.'}</p>
    <p className="mt-1 text-sm text-muted">{p.attendanceDays} {scope==='mes'?'datas no mês':'dias distintos'} para conferência do vale-transporte. Cada dia conta uma vez, mesmo com várias aulas. Não é um registro de presença.</p>
    {p.hasReference && <p className="mt-3 rounded-lg border border-line p-3 text-sm"><strong>Carga semanal informada pela escola:</strong> {p.referenceRegular} tempos regulares + {p.referenceTechnical} técnicos = {p.referenceRegular+p.referenceTechnical} tempos. A grade e os totais acima mostram o que está cadastrado neste recorte.</p>}
  </div>;
}
