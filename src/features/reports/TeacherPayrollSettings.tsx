import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Input, useToast } from '@/components/ui';
import { useUnits } from '@/api/units';
import { useSaveTeacherPayroll, type ScheduleData } from '@/api/hooks';
import { errorMessage } from '@/api/client';
import type { Teacher, TeacherPayrollProfile, Weekday } from '@shared/types';
import { WEEKDAY_SHORT } from '@shared/labels';
import { formatHours } from '@/lib/format';
export function TeacherPayrollSettings({teacher,data,regencyOnly=false,onDirtyChange,onBusyChange,onRequestChange}:{teacher:Teacher;data:ScheduleData;regencyOnly?:boolean;onDirtyChange?:(dirty:boolean)=>void;onBusyChange?:(busy:boolean)=>void;onRequestChange?:(action:()=>void)=>void}) {
  const {data:units=[]}=useUnits();
  const [busy,setBusy]=useState(false);
  const reportBusy=useCallback((value:boolean)=>{setBusy(value);onBusyChange?.(value);},[onBusyChange]);
  const available=units.filter((unit)=>teacher.unitIds?.includes(unit.id)||teacher.unitId===unit.id);
  const [chosen,setChosen]=useState<number|null>(null);
  const unit=available.find((unit)=>unit.id===chosen)??available[0];
  return <Card className={regencyOnly ? "p-5 [&_select]:h-12 [&_input[type=checkbox]]:size-5 [&_fieldset_label]:rounded-lg [&_fieldset_label]:border [&_fieldset_label]:border-line [&_fieldset_label]:px-3 [&_fieldset_label]:py-3 [&_fieldset_label]:gap-2 [&_fieldset_label:has(input:checked)]:bg-brand-soft" : "p-5"}>
    <h2 className="text-lg font-bold">{regencyOnly ? `Regência de ${teacher.name}` : 'Carga horária para relatórios'}</h2>
    <p className="mt-1 text-sm text-muted">{regencyOnly ? 'Escolha a unidade, adicione as turmas e marque os dias. Confira o total antes de salvar.' : 'Informe a carga de referência da escola ou as turmas em que este professor é regente. Isso não cria nem altera aulas na grade.'}</p>
    {unit && <><label className="mt-4 block text-sm font-semibold">Unidade
      <select className="mt-1 h-10 w-full rounded-md border border-line-strong px-3" disabled={busy} value={unit.id} onChange={(event)=>{const id=Number(event.target.value),action=()=>setChosen(id);if(onRequestChange)onRequestChange(action);else action();}}>{available.map((u)=><option key={u.id} value={u.id}>{u.code} - {u.name}</option>)}</select>
    </label><PayrollForm key={`${unit.id}-${teacher.updatedAt}`} teacher={teacher} data={data} unitId={unit.id} regencyOnly={regencyOnly} onDirtyChange={onDirtyChange} onBusyChange={reportBusy} /></>}
  </Card>;
}
function PayrollForm({teacher,data,unitId,regencyOnly,onDirtyChange,onBusyChange}:{teacher:Teacher;data:ScheduleData;unitId:number;regencyOnly?:boolean;onDirtyChange?:(dirty:boolean)=>void;onBusyChange?:(busy:boolean)=>void}) {
  const [draft,setDraft]=useState<TeacherPayrollProfile>(()=>teacher.payrollProfiles?.find((p)=>p.unitId===unitId)??{unitId,references:[],regencies:[]});
  const save=useSaveTeacherPayroll();const toast=useToast();
  const original=teacher.payrollProfiles?.find((p)=>p.unitId===unitId)??{unitId,references:[],regencies:[]};
  const dirty=JSON.stringify(draft)!==JSON.stringify(original);
  useEffect(()=>{onDirtyChange?.(dirty);},[onDirtyChange,dirty]);
  useEffect(()=>{onBusyChange?.(save.isPending);},[onBusyChange,save.isPending]);
  useEffect(()=>()=>{onDirtyChange?.(false);onBusyChange?.(false);},[onDirtyChange,onBusyChange]);
  const classes=data.classes.filter((c)=>c.unitId===unitId&&c.active);
  return <div className="mt-5 space-y-5">
    {!regencyOnly&&<section><h3 className="font-bold">Carga semanal informada pela escola</h3><p className="mt-1 text-sm text-muted">Serve para conferir se a grade está completa. O relatório mantém a referência separada dos horários cadastrados.</p>
      <div className="mt-3 space-y-2">{draft.references.map((entry,index)=><div key={index} className="grid gap-2 rounded-lg border border-line p-3 sm:grid-cols-[1fr_150px_100px_auto]">
        <label className="text-sm font-semibold">Disciplina / curso<Input aria-label={`Referência ${index+1}`} value={entry.label} onChange={(e)=>setDraft({...draft,references:draft.references.map((v,i)=>i===index?{...v,label:e.target.value}:v)})} /></label>
        <label className="text-sm font-semibold">Tipo<select className="h-10 w-full rounded border border-line-strong px-2 text-sm" value={entry.kind} onChange={(e)=>setDraft({...draft,references:draft.references.map((v,i)=>i===index?{...v,kind:e.target.value as 'regular'|'technical'}:v)})}><option value="regular">Regular</option><option value="technical">Técnico</option></select></label>
        <label className="text-sm font-semibold">Tempos / semana<Input type="number" min={0} max={100} value={entry.weeklyLessons} onChange={(e)=>setDraft({...draft,references:draft.references.map((v,i)=>i===index?{...v,weeklyLessons:Number(e.target.value)}:v)})} /></label>
        <Button className="self-end" onClick={()=>setDraft({...draft,references:draft.references.filter((_,i)=>i!==index)})}>Remover</Button>
      </div>)}</div>
      <Button className="mt-3" onClick={()=>setDraft({...draft,references:[...draft.references,{label:'',kind:'regular',weeklyLessons:0}]})}>Adicionar carga de referência</Button>
    </section>}
    <section><h3 className="font-bold">Regência com carga fixa</h3><p className="mt-1 text-sm text-muted">{regencyOnly ? 'A carga é fixa para a turma e os dias marcados. As disciplinas não multiplicam essas horas.' : 'Somente para o regente da turma. Infantil: 4h/dia, 20h em 5 dias. Fundamental I: 4h30/dia, 22h30 em 5 dias. As disciplinas da turma não multiplicam essas horas. Infantil: manhã 7h30–11h30 ou tarde 13h–17h. Fund. I: manhã 7h30–12h ou tarde 13h–17h30.'}</p>
      <div className="mt-3 space-y-3">{draft.regencies.map((entry,index)=><div key={index} className="space-y-3 rounded-lg border border-line p-3">
        <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold">Turma de regência<select aria-label={`Turma de regência ${index+1}`} className="mt-1 h-10 w-full rounded border border-line-strong px-2 text-sm" value={entry.classId} onChange={(e)=>setDraft({...draft,regencies:draft.regencies.map((v,i)=>i===index?{...v,classId:Number(e.target.value)}:v)})}><option value={0}>Escolha a turma</option>{classes.map((c)=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label className="text-sm font-semibold">Regra de regência<select className="mt-1 h-10 w-full rounded border border-line-strong px-2 text-sm" value={entry.segment} onChange={(e)=>setDraft({...draft,regencies:draft.regencies.map((v,i)=>i===index?{...v,segment:e.target.value as 'infantil'|'fund1'}:v)})}><option value="infantil">Infantil - 4h por dia</option><option value="fund1">Fundamental I - 4h30 por dia</option></select></label></div>
        <fieldset><legend className="text-sm font-semibold">Dias de regência informados</legend><div className="mt-2 flex flex-wrap gap-3">{data.settings.enabledDays.map((day)=><label key={day} className="flex items-center gap-1 text-sm"><input type="checkbox" checked={entry.weekdays.includes(day)} onChange={()=>setDraft({...draft,regencies:draft.regencies.map((v,i)=>i===index?{...v,weekdays:v.weekdays.includes(day)?v.weekdays.filter((d)=>d!==day):[...v.weekdays,day].sort() as Weekday[]}:v)})} />{WEEKDAY_SHORT[day]}</label>)}</div></fieldset>
        <div className="flex flex-wrap items-center justify-between gap-2"><strong>{formatHours(entry.weekdays.length*(entry.segment==='infantil'?240:270))} por semana</strong><Button onClick={()=>setDraft({...draft,regencies:draft.regencies.filter((_,i)=>i!==index)})}>Remover regência</Button></div>
      </div>)}</div>
      <Button className="mt-3" disabled={!classes.length} onClick={()=>setDraft({...draft,regencies:[...draft.regencies,{classId:0,segment:'fund1',weekdays:[1,2,3,4,5]}]})}>Adicionar turma de regência</Button>
    </section>
    <Button variant="primary" disabled={!dirty} loading={save.isPending} onClick={async()=>{if(draft.regencies.some((r)=>!r.classId||!r.weekdays.length)){toast.error('Revise a regência','Escolha uma turma e pelo menos um dia para cada regência.');return;}try{await save.mutateAsync({id:teacher.id,input:draft});toast.success('Carga para relatórios salva');}catch(error){toast.error('Não foi possível salvar',errorMessage(error));}}}>{regencyOnly?'Salvar regências':'Salvar carga para relatórios'}</Button>
  </div>;
}
