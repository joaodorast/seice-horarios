import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { AlertTriangle, CheckCircle2, ClipboardCheck, WandSparkles } from 'lucide-react';
import { Button, Card, Combobox, Modal, SearchInput, useToast } from '@/components/ui';
import { keys, type ScheduleData } from '@/api/hooks';
import { useUnits } from '@/api/units';
import { errorMessage, request } from '@/api/client';
import { reviewAssignments, type AssignmentSuggestion } from '@shared/assignmentReview';
import type { AssignmentReviewInput } from '@shared/schemas';
import type { Assignment } from '@shared/types';
import { matches, plural } from '@/lib/text';

export function AssignmentReview({ data }: { data: ScheduleData }) {
  const [open, setOpen] = useState(false);
  const rows = useMemo(() => reviewAssignments(data), [data]);
  const missing = rows.filter(r => r.status === 'missing').length;
  const different = rows.filter(r => r.status === 'different').length;
  const blocked = rows.filter(r => r.status === 'blocked').length;
  const pending = missing + different + blocked;
  return <>
    <Card className="mb-5 flex flex-wrap items-center gap-4 border border-line p-5">
      <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand-soft text-ink"><WandSparkles className="size-6" /></span>
      <div className="min-w-0 flex-1">
        <h2 className="text-lg font-extrabold">{pending ? 'A grade tem atribuições para conferir' : 'Grade e atribuições conferidas'}</h2>
        <p className="mt-1 text-base text-ink-2">{pending ? `${missing} sem atribuição · ${different} com quantidade diferente · ${blocked} precisam de atenção.` : 'As aulas da grade já têm atribuições correspondentes.'}</p>
        <p className="mt-1 text-sm text-ink-2">Use as aulas existentes para preencher o planejamento. Você revisa tudo antes de confirmar.</p>
      </div>
      <Button size="lg" variant={pending ? 'primary' : 'secondary'} icon={<ClipboardCheck className="size-5" />} onClick={() => setOpen(true)}>Revisar atribuições automáticas</Button>
    </Card>
    {open && <ReviewModal data={data} initialRows={rows} onClose={() => setOpen(false)} />}
  </>;
}

function ReviewModal({ data, initialRows, onClose }: { data: ScheduleData; initialRows: AssignmentSuggestion[]; onClose: () => void }) {
  const [rows] = useState(initialRows);
  const [picked, setPicked] = useState(() => new Set(rows.filter(r => r.status === 'missing' || r.status === 'different' && r.scheduled > (r.planned ?? 0)).map(r => r.key)));
  const [amounts, setAmounts] = useState<Record<string,string>>(() => Object.fromEntries(rows.map(r => [r.key, String(r.scheduled)])));
  const [unit, setUnit] = useState<number | null>(null);
  const [teacher, setTeacher] = useState<number | null>(null);
  const [schoolClass, setSchoolClass] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [showComplete, setShowComplete] = useState(false);
  const units = useUnits();
  const toast = useToast(), qc = useQueryClient();
  const classes = data.classes.filter(c => !unit || c.unitId === unit);
  const names = (r: AssignmentSuggestion) => ({
    schoolClass: data.classes.find(c => c.id === r.classId)?.name ?? 'Turma indisponível',
    subject: data.subjects.find(s => s.id === r.subjectId)?.name ?? 'Sem disciplina',
    teacher: r.teacherIds.map(id => data.teachers.find(t => t.id === id)?.name ?? 'Professor indisponível').join(', ') || 'Sem professor',
  });
  const visible = rows.filter(r => {
    const c = data.classes.find(c => c.id === r.classId), n = names(r);
    return (!unit || c?.unitId === unit) && (!schoolClass || r.classId === schoolClass) && (!teacher || r.teacherIds.includes(teacher)) &&
      (showComplete || r.status !== 'complete') && matches([n.schoolClass,n.subject,n.teacher],query);
  });
  const selectable = visible.filter(r => r.status !== 'blocked' && r.status !== 'complete');
  // Somente a seleção visível é confirmada: filtros nunca escondem alterações que serão salvas.
  const selected = selectable.filter(r => picked.has(r.key));
  const valid = selected.every(r => Number.isInteger(Number(amounts[r.key])) && Number(amounts[r.key]) >= 1 && Number(amounts[r.key]) <= 40);
  const allSelected = selectable.length > 0 && selectable.every(r => picked.has(r.key));
  const live = reviewAssignments(data);
  const stale = selected.some(r => live.find(l => l.key === r.key)?.expected !== r.expected);
  const save = useMutation({
    mutationFn: (input: AssignmentReviewInput) => request<Assignment[]>('POST','/assignments/reconcile',input),
    onSuccess: async assignments => {
      qc.setQueryData(keys.assignments,assignments);
      await qc.invalidateQueries({ queryKey: keys.teachers });
      toast.success('Atribuições confirmadas', 'O planejamento foi atualizado. As aulas e os horários da grade foram preservados.');
      onClose();
    },
    onError: error => {
      toast.error('Não foi possível confirmar a revisão',errorMessage(error));
      for (const key of [keys.assignments,keys.lessons,keys.periods,keys.classes,keys.teachers]) void qc.invalidateQueries({queryKey:key});
    },
  });
  const close = () => { if (!save.isPending) onClose(); };
  const confirm = () => {
    if (!selected.length || !valid || stale || save.isPending) return;
    save.mutate({items:selected.map(r => ({classId:r.classId,subjectId:r.subjectId!,teacherId:r.teacherId!,weeklyLessons:Number(amounts[r.key]),expected:r.expected}))});
  };
  return <Modal open onClose={close} dismissible={false} size="xl" title="Revisar atribuições da grade" description="Confira as sugestões, ajuste o planejamento se precisar e confirme as linhas selecionadas."
    footer={<>
      <div className="mr-auto text-base"><strong>{plural(selected.length, 'atribuição selecionada', 'atribuições selecionadas')}</strong><p className="text-sm text-ink-2">Somente as linhas marcadas e visíveis serão salvas.</p></div>
      <Button disabled={save.isPending} onClick={close}>Voltar sem salvar</Button>
      <Button variant="primary" loading={save.isPending} disabled={!selected.length || !valid || stale || selected.length > 500} onClick={confirm}>Confirmar atribuições</Button>
    </>}>
    <div className="space-y-5">
      <div className="rounded-2xl border border-line bg-brand-soft p-4 text-base leading-relaxed">
        <strong>1. Filtre → 2. Confira → 3. Confirme</strong>
        <p className="mt-1">Lemos as aulas que já estão na grade para sugerir professor, turma, disciplina e quantidade semanal. Nenhuma aula será criada ou movida. Horas e regras do RH permanecem iguais.</p>
      </div>
      <fieldset disabled={save.isPending} className="grid gap-3 sm:grid-cols-3">
        <label className="space-y-1 text-sm font-semibold">Unidade<Combobox value={unit} onChange={v => {setUnit(v);setSchoolClass(null);}} placeholder="Todas as unidades" options={(units.data ?? []).map(u => ({value:u.id,label:u.name}))} /></label>
        <label className="space-y-1 text-sm font-semibold">Professor<Combobox value={teacher} onChange={setTeacher} placeholder="Todos os professores" options={data.teachers.filter(t => rows.some(r => r.teacherIds.includes(t.id))).map(t => ({value:t.id,label:t.name}))} /></label>
        <label className="space-y-1 text-sm font-semibold">Turma<Combobox value={schoolClass} onChange={setSchoolClass} placeholder="Todas as turmas" options={classes.filter(c => rows.some(r => r.classId === c.id)).map(c => ({value:c.id,label:c.name}))} /></label>
        <div className="sm:col-span-3"><SearchInput value={query} onChange={setQuery} placeholder="Pesquisar professor, turma ou disciplina" /></div>
      </fieldset>
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <Button size="sm" disabled={save.isPending} onClick={() => {setUnit(null);setTeacher(null);setSchoolClass(null);setQuery('');}}>Limpar filtros</Button>
        <label className="flex items-center gap-2"><input className="size-4 accent-yellow-500" type="checkbox" checked={showComplete} disabled={save.isPending} onChange={e => setShowComplete(e.target.checked)} />Mostrar atribuições que já estão certas</label>
        <span className="ml-auto font-semibold">{plural(visible.length, 'item encontrado', 'itens encontrados')}</span>
      </div>
      {stale && <p role="alert" className="rounded-xl border border-amber-400 bg-amber-50 p-4 text-base text-ink">Os dados mudaram durante a revisão. Volte sem salvar e abra a revisão novamente para conferir as informações atuais.</p>}
      {selected.length > 500 && <p role="alert">Selecione até 500 atribuições por vez. Use os filtros para dividir a revisão.</p>}
      <label className="flex items-center gap-3 rounded-xl bg-subtle p-3 text-base font-bold"><input type="checkbox" className="size-5 accent-yellow-500" disabled={!selectable.length || save.isPending} checked={allSelected} onChange={() => setPicked(before => {const next=new Set(before);for(const r of selectable)allSelected?next.delete(r.key):next.add(r.key);return next;})} />{allSelected ? 'Desmarcar sugestões visíveis' : 'Selecionar sugestões visíveis'}</label>
      <div className="space-y-3">
        {visible.length === 0 && <div className="rounded-2xl border border-line p-7 text-center"><CheckCircle2 className="mx-auto mb-2 size-8 text-green-700" /><h3 className="text-lg font-bold">Nenhuma pendência neste filtro</h3><p className="mt-1 text-base text-ink-2">Mostre as atribuições já certas ou ajuste os filtros. Aulas sem grade cadastrada não geram sugestões.</p></div>}
        {visible.map(r => {const n=names(r),blocked=r.status==='blocked',complete=r.status==='complete',checked=picked.has(r.key),less=r.planned!==null&&r.planned>r.scheduled;return <article key={r.key} className={`rounded-2xl border p-4 ${blocked?'border-amber-300 bg-amber-50':complete?'border-green-200 bg-green-50':checked?'border-yellow-400 bg-yellow-50/40':'border-line bg-surface'}`}>
          <div className="flex items-start gap-3">
            <input type="checkbox" aria-label={`Selecionar ${n.subject} — ${n.schoolClass}`} className="mt-1 size-5 shrink-0 accent-yellow-500" checked={!blocked&&!complete&&checked} disabled={blocked||complete||save.isPending} onChange={() => setPicked(before=>{const next=new Set(before);next.has(r.key)?next.delete(r.key):next.add(r.key);return next;})} />
            <div className="min-w-0 flex-1"><div className="flex flex-wrap gap-2"><h3 className="text-lg font-extrabold">{n.subject}</h3><span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-ink ring-1 ring-line">{blocked?'Conferência necessária':complete?'Já está certo':r.status==='missing'?'Atribuição ausente':'Quantidade diferente'}</span></div><p className="mt-1 text-base font-semibold">{n.teacher}</p><p className="mt-1 text-sm leading-relaxed text-ink-2">{n.schoolClass}</p></div>
          </div>
          <div className="mt-4 grid gap-3 rounded-xl bg-white/80 p-3 sm:grid-cols-3">
            <div><span className="text-sm text-ink-2">Aulas já na grade</span><strong className="mt-1 block text-xl">{r.scheduled} por semana</strong></div>
            <div><span className="text-sm text-ink-2">Atribuição atual</span><strong className="mt-1 block text-xl">{r.planned===null?'Não cadastrada':`${r.planned} por semana`}</strong></div>
            {!blocked&&!complete&&<label className="text-sm font-semibold">Planejamento a salvar<input type="number" min={1} max={40} step={1} aria-label={`Aulas por semana de ${n.subject} — ${n.schoolClass}`} className="mt-1 block h-11 w-28 rounded-lg border border-line-strong bg-white px-3 text-lg font-bold" value={amounts[r.key]??''} disabled={save.isPending} onChange={e=>setAmounts(before=>({...before,[r.key]:e.target.value}))} /></label>}
          </div>
          {blocked&&<p className="mt-3 flex items-start gap-2 text-base"><AlertTriangle className="mt-0.5 size-5 shrink-0" />{r.reason}</p>}
          {!blocked&&!complete&&less&&<p className="mt-3 text-sm leading-relaxed text-ink-2">O planejamento atual é maior que a grade. Deixamos esta linha desmarcada para você conferir se ainda faltam aulas a lançar.</p>}
          {!blocked&&!complete&&checked&&Number(amounts[r.key])!==r.scheduled&&<p className="mt-3 text-sm font-semibold text-ink-2">Você escolheu um planejamento diferente da grade. Somente a atribuição será atualizada.</p>}
          {!blocked&&!complete&&checked&&(!Number.isInteger(Number(amounts[r.key]))||Number(amounts[r.key])<1||Number(amounts[r.key])>40)&&<p role="alert" className="mt-2 text-sm text-danger">Informe uma quantidade inteira entre 1 e 40.</p>}
          <Link onClick={e=>{if(save.isPending)e.preventDefault();}} to={`/horarios/turma/${r.classId}`} className="mt-3 inline-block text-sm font-bold underline underline-offset-4">Conferir horários da turma</Link>
        </article>})}
      </div>
    </div>
  </Modal>;
}
