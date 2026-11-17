import { useEffect, useState } from 'react';
import { Layers, Save } from 'lucide-react';
import { academicRuleSchema, INITIAL_ACADEMIC_VALUES, resolveAcademicRule, type AcademicRule, type AcademicValues } from '@shared/academicRules';
import { SEGMENT_KEYS, SEGMENT_LABEL, type SegmentKey } from '@shared/segments';
import type { Unit } from '@shared/types';
import type { ScheduleData } from '@/api/hooks';
import { useDeleteAcademicRule, useSaveAcademicRule } from '@/api/academicRules';
import { errorMessage } from '@/api/client';
import { Button, Combobox, ConfirmDialog, Input, Modal, Segmented, useToast } from '@/components/ui';
export interface AcademicRuleTarget {unitId?:number;scope?:AcademicRule['scope'];segment?:SegmentKey;classId?:number}
export function AcademicRulesManager({open,onClose,year,units,rules,data,target}:{open:boolean;onClose:()=>void;year:number;units:Unit[];rules:AcademicRule[];data:ScheduleData;target:AcademicRuleTarget}){
 const [unitId,setUnitId]=useState(target.unitId??units[0]?.id??0),[scope,setScope]=useState<AcademicRule['scope']>(target.scope??'unit'),[segment,setSegment]=useState<SegmentKey>(target.segment??'fund1'),[classId,setClassId]=useState<number|null>(target.classId??null);
 const [saveState,setSaveState]=useState({visible:false,enabled:false});
 const [dirty,setDirty]=useState(false),[busy,setBusy]=useState(false),[pending,setPending]=useState<(()=>void)|null>(null);
 const unit=units.find(u=>u.id===unitId),classes=data.classes.filter(c=>c.unitId===unitId),base=rules.find(r=>r.unitId===unitId&&r.year===year&&r.scope==='unit');
 function change(action:()=>void){if(busy)return;if(dirty)setPending(()=>action);else action();}
 return <><Modal open={open} onClose={()=>change(onClose)} size="xl" dismissible={!busy} title={<span className="text-2xl">Personalizar cálculo da grade</span>} description={<span className="text-base leading-relaxed">Defina uma vez e salve. As regras ficam no sistema e são usadas nos relatórios de {year}.</span>} footer={<><p className="mr-auto text-base text-muted">{dirty?'Há alterações não salvas. Use “Salvar regra”.':'O cálculo segue: unidade → segmento → turma.'}</p><Button size="lg" disabled={busy} onClick={()=>change(onClose)}>Concluir</Button>{saveState.visible&&<Button type="submit" form="academic-rule-editor" variant="primary" size="lg" icon={<Save className="size-5"/>} disabled={!saveState.enabled||busy}>Salvar regra</Button>}</>}>
  <div className="space-y-5 text-base [&_button]:text-base [&_input]:text-base [&_select]:text-base">
   <div className="rounded-xl border border-[#bdd6f4] bg-[#edf5ff] p-4 leading-relaxed"><strong>Como funciona</strong><p className="mt-1">O padrão da unidade vale para todas as turmas. No segmento ou na turma, personalize apenas o que for diferente. Os demais campos continuam seguindo o padrão.</p></div>
   <label className="block font-bold">Unidade · {year}<select aria-label="Unidade da regra" disabled={busy} className="mt-2 h-12 w-full rounded-lg border border-line-strong bg-surface px-3" value={unitId} onChange={e=>change(()=>{setUnitId(Number(e.target.value));setClassId(null);})}>{units.map(u=><option key={u.id} value={u.id}>{u.code} · {u.name}</option>)}</select></label>
   <Segmented size="lg" label="Personalizar por" value={scope} onChange={value=>change(()=>setScope(value))} options={[{value:'unit',label:'1. Padrão da unidade'},{value:'segment',label:'2. Segmento'},{value:'class',label:'3. Turma'}]}/>
   {scope==='segment'&&<label className="block font-bold">Segmento<select aria-label="Segmento da regra" disabled={busy} className="mt-2 h-12 w-full rounded-lg border border-line-strong bg-surface px-3" value={segment} onChange={e=>change(()=>setSegment(e.target.value as SegmentKey))}>{SEGMENT_KEYS.map(s=><option key={s} value={s}>{SEGMENT_LABEL[s]}</option>)}</select></label>}
   {scope==='class'&&<div><label htmlFor="academic-rule-class" className="mb-2 block font-bold">Turma para personalizar</label><Combobox spacious id="academic-rule-class" disabled={busy} value={classId} onChange={value=>change(()=>setClassId(value))} options={classes.map(c=>({value:c.id,label:c.name,description:c.grade}))} placeholder="Pesquise e escolha uma turma"/></div>}
   {unit&&scope!=='unit'&&!base?<div className="rounded-xl border border-line bg-brand-soft p-5"><h3 className="text-lg font-bold">Comece pelo padrão da unidade</h3><p className="mt-2 leading-relaxed">Salve os dias letivos e a duração padrão. Depois personalize os segmentos e turmas que forem diferentes.</p><Button className="mt-4" onClick={()=>change(()=>setScope('unit'))}>Configurar padrão da unidade</Button></div>:unit&&(scope!=='class'||classId)&&<AcademicRuleEditor key={`${unitId}-${year}-${scope}-${scope==='class'?classId:scope==='segment'?segment:''}`} unitId={unitId} year={year} scope={scope} segment={scope==='segment'?segment:null} classId={scope==='class'?classId:null} rules={rules} data={data} onDirty={setDirty} onBusy={setBusy} onSaveState={setSaveState} onSaved={()=>{setDirty(false);onClose();}}/>}
  </div>
 </Modal><ConfirmDialog open={pending!==null} title="Descartar alterações não salvas?" confirmLabel="Descartar alterações" cancelLabel="Continuar editando" onClose={()=>setPending(null)} onConfirm={()=>{const action=pending;setPending(null);setDirty(false);action?.();}}><p>As alterações desta regra ainda não foram salvas. As regras já salvas no sistema serão mantidas.</p></ConfirmDialog></>;
}
function AcademicRuleEditor({unitId,year,scope,segment,classId,rules,data,onDirty,onBusy,onSaveState,onSaved}:{unitId:number;year:number;scope:AcademicRule['scope'];segment:SegmentKey|null;classId:number|null;rules:AcademicRule[];data:ScheduleData;onDirty:(value:boolean)=>void;onBusy:(value:boolean)=>void;onSaveState:(state:{visible:boolean;enabled:boolean})=>void;onSaved:()=>void}){
 const toast=useToast(),save=useSaveAcademicRule(),remove=useDeleteAcademicRule();
 const [original]=useState(()=>rules.find(r=>r.unitId===unitId&&r.year===year&&r.scope===scope&&(scope==='class'?r.classId===classId:r.segment===segment)));
 const previous=rules.filter(r=>r.unitId===unitId&&r.scope==='unit'&&r.year<year).sort((a,b)=>b.year-a.year)[0];
 const [initial]=useState(()=>original?.values??(scope==='unit'?{...INITIAL_ACADEMIC_VALUES,...previous?.values}:{}));
 const [values,setValues]=useState<Record<string,string>>(()=>Object.fromEntries(Object.entries(initial).map(([key,value])=>[key,String(value)])));
 const [classSegment,setClassSegment]=useState<SegmentKey|''>(original?.segment??''),[confirmRemove,setConfirmRemove]=useState(false);
 const schoolClass=data.classes.find(c=>c.id===classId);
 const base=rules.find(r=>r.unitId===unitId&&r.year===year&&r.scope==='unit');
 const parent=scope==='class'&&schoolClass?resolveAcademicRule(schoolClass,[...rules.filter(r=>!(r.scope==='class'&&r.classId===classId)),{id:-1,unitId,year,scope:'class',classId,segment:classSegment||null,values:{},updatedAt:''}],year).projection:{year,...INITIAL_ACADEMIC_VALUES,...base?.values};
 const parsedValues=Object.fromEntries(Object.entries(values).map(([key,value])=>[key,key==='basis'?value:Number(value)])) as Partial<AcademicValues>;
 const effective={...parent,...parsedValues};
 const dirty=JSON.stringify(values)!==JSON.stringify(Object.fromEntries(Object.entries(initial).map(([key,value])=>[key,String(value)])))||classSegment!==(original?.segment??'');
 const busy=save.isPending||remove.isPending;
 useEffect(()=>{onDirty(dirty);},[dirty,onDirty]);useEffect(()=>()=>onDirty(false),[onDirty]);useEffect(()=>{onBusy(busy||confirmRemove);},[busy,confirmRemove,onBusy]);useEffect(()=>()=>onBusy(false),[onBusy]);
 const input={unitId,year,scope,segment:scope==='class'?classSegment||null:segment,classId,values:parsedValues,expectedUpdatedAt:original?.updatedAt??null};
 const validation=academicRuleSchema.safeParse(input);
 const canSave=validation.success&&!busy&&(dirty||!original);
 useEffect(()=>{onSaveState({visible:true,enabled:canSave});},[canSave,onSaveState]);
 useEffect(()=>()=>onSaveState({visible:false,enabled:false}),[onSaveState]);
 function update(key:string,value:string){setValues(previous=>({...previous,[key]:value}));}
 const fields=[{key:'schoolDays',label:'Dias letivos no ano',min:1,max:366},{key:'daysPerWeek',label:'Dias de aula por semana',min:1,max:6},{key:'weeks',label:'Semanas do módulo/semestre',min:0.1,max:60},{key:'minutesPerPeriod',label:'Minutos pedagógicos por tempo',min:1,max:240}];
 return <form id="academic-rule-editor" className="space-y-5" onSubmit={async event=>{event.preventDefault();if(!canSave)return;try{await save.mutateAsync(input);toast.success('Regra salva no sistema','Os relatórios deste ano já usam a configuração.');onSaved();}catch(e){toast.error('Não foi possível salvar',errorMessage(e));}}}>
  <h3 className="flex items-center gap-2 text-xl font-bold"><Layers className="size-5"/>{scope==='unit'?'Padrão da unidade':scope==='segment'?`Personalizar ${SEGMENT_LABEL[segment!]}`:'Personalizar esta turma'}</h3>
  {!original&&scope==='unit'&&<p className="rounded-lg bg-brand-soft p-3 leading-relaxed">{previous?`Usamos o padrão de ${previous.year} como ponto de partida. Revise e salve para ${year}.`:'Sugestão inicial: 201 dias, 5 dias por semana e 50 minutos por tempo. O cliente pode alterar todos esses valores antes de salvar.'}</p>}
  {scope==='class'&&<label className="block font-semibold">Segmento desta turma no PPP<select aria-label="Segmento da turma no PPP" className="mt-2 h-12 w-full rounded-lg border border-line-strong bg-surface px-3" value={classSegment} onChange={e=>setClassSegment(e.target.value as SegmentKey|'')}><option value="">Identificar pelo cadastro da turma</option>{SEGMENT_KEYS.map(s=><option key={s} value={s}>{SEGMENT_LABEL[s]}</option>)}</select><span className="mt-2 block text-sm font-normal text-muted">Essa identificação é usada somente nas regras do PPP.</span></label>}
  <div className="grid gap-4 sm:grid-cols-2">
   {[{key:'basis',label:'Base do cálculo',min:0,max:0},...fields].filter(f=>f.key!=='weeks'||effective.basis==='weeks').filter(f=>f.key!=='schoolDays'||effective.basis==='days').map(field=>{const own=values[field.key]!==undefined,value=values[field.key]??String(parent[field.key as keyof AcademicValues]);return <div key={field.key} className={`rounded-xl border p-4 ${scope!=='unit'&&own?'border-[#245991] bg-[#edf5ff]':'border-line bg-surface'}`}>
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><label htmlFor={`rule-${field.key}`} className="font-bold">{field.label}</label>{scope!=='unit'&&<label className="flex cursor-pointer items-center gap-2 text-sm"><input className="size-5 accent-ink" type="checkbox" aria-label={`Personalizar ${field.label.toLowerCase()}`} checked={own} onChange={()=>setValues(previous=>{const next={...previous};if(own)delete next[field.key];else next[field.key]=String(parent[field.key as keyof AcademicValues]);return next;})}/>Personalizar</label>}</div>
    {field.key==='basis'?<select id="rule-basis" disabled={scope!=='unit'&&!own} className="h-12 w-full rounded-lg border border-line-strong bg-surface px-3 disabled:bg-subtle" value={value} onChange={e=>update('basis',e.target.value)}><option value="days">Ano · Dias letivos</option><option value="weeks">Módulo/semestre · Semanas</option></select>:<Input id={`rule-${field.key}`} type="number" min={field.min} max={field.max} step={field.key==='weeks'?0.1:1} disabled={scope!=='unit'&&!own} className="h-12 text-base" value={value} onChange={e=>update(field.key,e.target.value)}/>}
    {scope!=='unit'&&<p className="mt-2 text-sm text-muted">{own?'Valor personalizado aqui.':'Usando a regra herdada. Ela acompanha as alterações do padrão.'}</p>}
   </div>;})}
  </div>
  <div className="rounded-xl border border-[#b9dfc7] bg-[#eaf7ef] p-4 leading-relaxed"><strong>Como ficará o cálculo</strong><p className="mt-1">{effective.minutesPerPeriod} min por tempo · {effective.basis==='days'?`${effective.schoolDays} dias ÷ ${effective.daysPerWeek} dias por semana`:`${effective.weeks} semanas no período`}.</p><p>Carga semanal = tempos da grade × minutos por tempo. Carga total = carga semanal × semanas do período.</p></div>
  {!validation.success&&dirty&&<p role="alert" className="text-base text-danger">{validation.error.issues[0].message}</p>}
  <div className="flex flex-wrap gap-3">{original&&scope!=='unit'&&<Button size="lg" disabled={busy} onClick={()=>setConfirmRemove(true)}>Remover personalização</Button>}</div>
  <ConfirmDialog open={confirmRemove} title="Voltar a usar a regra herdada?" tone="primary" confirmLabel="Remover personalização" loading={remove.isPending} onClose={()=>{if(!remove.isPending)setConfirmRemove(false);}} onConfirm={async()=>{try{await remove.mutateAsync(original!.id);toast.success('Personalização removida');setConfirmRemove(false);onSaved();}catch(e){toast.error('Não foi possível remover',errorMessage(e));}}}><p>Somente esta personalização será removida. O cálculo volta a seguir o padrão da unidade ou do segmento. Nenhuma aula será alterada.</p></ConfirmDialog>
 </form>;
}
