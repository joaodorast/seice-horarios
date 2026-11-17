import { useEffect, useId, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { CheckCircle2, ClipboardCheck, GraduationCap, Settings2 } from 'lucide-react';
import { Button, Card, Combobox, ConfirmDialog, Modal } from '@/components/ui';
import { request } from '@/api/client';
import type { ScheduleData } from '@/api/hooks';
import type { PayrollReference } from '@shared/types';
import { formatHours } from '@/lib/format';
import { PayrollReferenceReview } from './PayrollReferenceReview';
import { TeacherPayrollSettings } from './TeacherPayrollSettings';

type Step = 'references' | 'regencies';

export function PayrollSetupAssistant({ data }: { data: ScheduleData }) {
  const query = useQuery({ queryKey: ['payroll-references'], queryFn: () => request<PayrollReference[]>('GET', '/payroll-references') });
  const [searchParams, setSearchParams] = useSearchParams();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('references');
  const [teacherId, setTeacherId] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);
  const [regencyBusy, setRegencyBusy] = useState(false);
  const [referenceBusy, setReferenceBusy] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const id = useId();
  const items = query.data ?? [];
  const confirmed = items.filter((item) => item.teacherId !== null).length;
  const pending = items.length - confirmed;
  const configured = data.teachers.filter((teacher) => teacher.payrollProfiles?.some((profile) => profile.regencies.length));
  const regencyCount = configured.reduce((sum, teacher) => sum + (teacher.payrollProfiles?.reduce((count, profile) => count + profile.regencies.length, 0) ?? 0), 0);
  const selected = data.teachers.find((teacher) => teacher.id === teacherId);
  const busy = regencyBusy || referenceBusy;

  useEffect(() => {
    const destination = searchParams.get('configurar');
    if (destination !== 'professores' && destination !== 'regencias') return;
    setStep(destination === 'regencias' ? 'regencies' : 'references');
    setOpen(true);
    // Consome o atalho para que fechar o assistente não o reabra na próxima renderização.
    setSearchParams((current) => { const next = new URLSearchParams(current); next.delete('configurar'); return next; }, { replace: true });
  }, [searchParams, setSearchParams]);

  function requestChange(action: () => void) {
    if (busy) return;
    if (dirty) setPendingAction(() => action);
    else action();
  }
  function changeStep(value: Step) {
    if (value !== step) requestChange(() => setStep(value));
  }
  function selectTeacher(value: number | null) {
    if (value !== teacherId) requestChange(() => setTeacherId(value));
  }
  function launch(value: Step) {
    setStep(value);
    setOpen(true);
  }

  return <>
    <Card className="overflow-hidden border border-line-strong">
      <div className="flex flex-wrap items-start gap-4 p-5 sm:p-6">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-brand-soft text-ink"><Settings2 className="size-6" /></span>
        <div className="min-w-0 flex-1 basis-64">
          <h2 className="text-xl font-bold">Configurar cargas e professores</h2>
          <p className="mt-1 text-base leading-relaxed text-ink-2">Confira os nomes da lista e personalize as regências. As configurações salvas atualizam os relatórios.</p>
        </div>
        <Button variant="primary" size="lg" className="w-full sm:w-auto" icon={<Settings2 className="size-5" />} onClick={() => launch('references')}>Configurar cargas e professores</Button>
      </div>
      <div className="grid gap-3 border-t border-line bg-subtle/60 p-5 sm:grid-cols-3 sm:p-6">
        <button type="button" onClick={() => launch('references')} className="rounded-xl border border-line bg-surface p-4 text-left transition-colors hover:border-line-strong">
          <span className="flex items-center gap-2 text-base font-semibold"><ClipboardCheck className="size-5 text-success" />Referências confirmadas</span>
          <strong className="mt-2 block text-2xl tabular">{query.isError ? '—' : query.isLoading ? '…' : `${confirmed} de ${items.length}`}</strong>
          <span className="mt-2 block h-2 overflow-hidden rounded-full bg-subtle" role="progressbar" aria-label="Progresso da conferência" aria-valuemin={0} aria-valuemax={Math.max(1, items.length)} aria-valuenow={confirmed} aria-valuetext={items.length ? `${confirmed} de ${items.length} referências confirmadas` : 'Nenhuma referência recebida'}>
            <span className="block h-full rounded-full bg-brand transition-[width]" style={{ width: `${items.length ? confirmed / items.length * 100 : 0}%` }} />
          </span>
        </button>
        <button type="button" onClick={() => launch('references')} className="rounded-xl border border-line bg-surface p-4 text-left transition-colors hover:border-line-strong">
          <span className="text-base font-semibold">Aguardando conferência</span><strong className="mt-2 block text-2xl tabular">{query.isError ? '—' : query.isLoading ? '…' : pending}</strong>
          <span className="mt-1 block text-base text-muted">Confira o cadastro antes de vincular.</span>
        </button>
        <button type="button" onClick={() => launch('regencies')} className="rounded-xl border border-line bg-surface p-4 text-left transition-colors hover:border-line-strong">
          <span className="flex items-center gap-2 text-base font-semibold"><GraduationCap className="size-5" />Turmas com regência</span><strong className="mt-2 block text-2xl tabular">{regencyCount}</strong>
          <span className="mt-1 block text-base text-muted">{configured.length} {configured.length===1?'professor configurado':'professores configurados'}.</span>
        </button>
      </div>
      {query.isError && <p className="border-t border-line px-5 py-3 text-base text-danger">Não foi possível carregar as referências. <button type="button" className="font-semibold underline" onClick={() => void query.refetch()}>Tentar novamente</button></p>}
    </Card>

    <Modal open={open} onClose={() => requestChange(() => setOpen(false))} size="xl" dismissible={!busy}
      title={<span className="text-2xl">Configurar cargas e professores</span>}
      description={<span className="text-base leading-relaxed">Confira os professores e personalize as regências, sem alterar os horários já cadastrados.</span>}
      footer={<><p className="mr-auto text-base text-muted">{dirty ? 'Há alterações não salvas. Use “Salvar regências” antes de sair.' : 'Os relatórios usam as configurações que você salvar.'}</p><Button size="lg" disabled={busy} onClick={() => requestChange(() => setOpen(false))}>Concluir</Button></>}>
      <div className="text-base [&_p]:text-base [&_label]:text-base [&_button]:text-base [&_input]:text-lg [&_select]:text-base [&_li[role=option]]:text-lg">
        <div role="tablist" aria-label="Etapas da configuração" className="sticky -top-5 z-20 mb-5 grid gap-2 rounded-xl border border-line bg-subtle p-2 shadow-raise sm:grid-cols-2">
          {([{value:'references',label:'1. Conferir professores',Icon:ClipboardCheck},{value:'regencies',label:'2. Configurar regências',Icon:GraduationCap}] as const).map(({value,label,Icon}) => <button type="button" role="tab" key={value} id={`${id}-${value}-tab`} aria-controls={`${id}-${value}-panel`} aria-selected={step===value} tabIndex={step===value?0:-1} disabled={busy}
            onClick={() => changeStep(value)} onKeyDown={(event) => { if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();const target=event.key==='Home'?'references':event.key==='End'?'regencies':step==='references'?'regencies':'references';if(target!==step)requestChange(()=>{setStep(target);requestAnimationFrame(()=>document.getElementById(`${id}-${target}-tab`)?.focus());});} }}
            className={`flex min-h-12 items-center justify-center gap-2 rounded-lg px-3 py-3 text-base font-bold transition-colors ${step===value?'bg-ink text-white shadow-raise':'text-ink-2 hover:bg-surface'}`}><Icon className="size-5 shrink-0" />{label}</button>)}
        </div>
        {step==='references' ? <div role="tabpanel" id={`${id}-references-panel`} aria-labelledby={`${id}-references-tab`}>
          <details className="mb-5 rounded-2xl border border-line bg-subtle p-4 sm:p-5"><summary className="cursor-pointer text-lg font-bold">Como conferir um professor <span className="font-normal text-ink-2">— veja o passo a passo</span></summary><p className="mt-2 text-base leading-relaxed text-ink-2">Escolha um nome, confira o cadastro da mesma pessoa e confirme o vínculo.</p><ol className="mt-3 grid gap-3 sm:grid-cols-3">{[
            ['Escolha um nome da lista', 'Clique em “Conferir cadastro” no professor que deseja revisar.'],
            ['Encontre a mesma pessoa', 'Pesquise o cadastro e confira nome, matrícula e unidade. Nome parecido precisa de atenção.'],
            ['Confirme o vínculo', 'Marque a confirmação e salve. A carga da lista será vinculada; nome e horários serão mantidos.'],
          ].map(([title,description],index)=><li key={title} className="rounded-xl border border-line bg-surface p-4"><span className="mb-3 grid size-8 place-items-center rounded-full bg-brand font-bold">{index+1}</span><strong className="block text-lg">{title}</strong><p className="mt-2 text-base leading-relaxed text-ink-2">{description}</p></li>)}</ol></details>
          {query.isLoading ? <p className="p-6 text-center text-muted">Carregando referências…</p> : query.isError ? <Button onClick={() => void query.refetch()}>Tentar carregar referências novamente</Button> : <PayrollReferenceReview data={data} items={items} onBusyChange={setReferenceBusy} />}
        </div> : <div role="tabpanel" id={`${id}-regencies-panel`} aria-labelledby={`${id}-regencies-tab`} className="space-y-5">
          <details className="rounded-2xl border border-line bg-subtle p-4 sm:p-5"><summary className="cursor-pointer text-lg font-bold">Como configurar uma regência <span className="font-normal text-ink-2">— veja o passo a passo</span></summary><h3 className="mt-4 text-xl font-bold">O que é regência?</h3><p className="mt-2 text-base leading-relaxed text-ink-2">É a carga fixa do professor responsável por uma turma de Infantil ou Fundamental I. Ela é contada pelos dias de regência, sem somar novamente cada disciplina dessa turma.</p><ol className="mt-4 space-y-3 text-base leading-relaxed"><li><strong>1. Escolha o professor e a unidade.</strong> Depois, clique em “Adicionar turma de regência”.</li><li><strong>2. Escolha a turma e o segmento.</strong> Marque os dias em que ele é regente dessa turma.</li><li><strong>3. Confira as horas e clique em “Salvar regências”.</strong> O total muda conforme os dias marcados e passa a valer nos relatórios.</li></ol></details>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-[#bdd6f4] bg-[#edf5ff] p-4"><h3 className="text-lg font-bold">Educação Infantil</h3><p className="mt-1">4h por dia · <strong>20h em cinco dias</strong></p></div>
            <div className="rounded-xl border border-[#b9dfc7] bg-[#eaf7ef] p-4"><h3 className="text-lg font-bold">Fundamental I</h3><p className="mt-1">4h30 por dia · <strong>22h30 em cinco dias</strong></p></div>
          </div>
          <div><label htmlFor={`${id}-teacher`} className="mb-2 block text-base font-bold">Escolha o professor para configurar</label><Combobox spacious id={`${id}-teacher`} value={teacherId} onChange={selectTeacher} clearable disabled={busy} placeholder="Pesquise e escolha o professor" options={data.teachers.map((teacher)=>({value:teacher.id,label:teacher.name,description:teacher.payrollProfiles?.some((p)=>p.regencies.length)?'Já possui regência configurada':undefined}))} /></div>
          {selected ? <TeacherPayrollSettings key={selected.id} teacher={selected} data={data} regencyOnly onDirtyChange={setDirty} onBusyChange={setRegencyBusy} onRequestChange={requestChange} /> : <p className="rounded-xl border border-dashed border-line p-6 text-center leading-relaxed text-muted">Escolha um professor acima para indicar a turma, o segmento e os dias da semana. O total será mostrado antes de salvar.</p>}
          {configured.length>0 && <section><h3 className="mb-3 flex items-center gap-2 text-lg font-bold"><CheckCircle2 className="size-5 text-success" />Regências já configuradas</h3><div className="grid gap-2 sm:grid-cols-2">{configured.map((teacher)=>{
            const regencies=teacher.payrollProfiles?.flatMap((p)=>p.regencies)??[];
            const minutes=regencies.reduce((sum,r)=>sum+r.weekdays.length*(r.segment==='infantil'?240:270),0);
            return <button key={teacher.id} type="button" disabled={busy} onClick={()=>selectTeacher(teacher.id)} className="rounded-xl border border-line p-4 text-left hover:bg-subtle"><strong className="block break-words">{teacher.name}</strong><span className="mt-1 block text-base text-muted">{regencies.length} {regencies.length===1?'turma':'turmas'} · {formatHours(minutes)} semanais de regência</span></button>;
          })}</div></section>}
        </div>}
      </div>
    </Modal>
    <ConfirmDialog open={pendingAction!==null} title="Descartar alterações não salvas?" confirmLabel="Descartar alterações" cancelLabel="Continuar editando" onClose={()=>setPendingAction(null)} onConfirm={()=>{const action=pendingAction;setPendingAction(null);setDirty(false);action?.();}}>
      <p>A configuração de regência ainda não foi salva. Se continuar, estas alterações serão descartadas. Os dados já salvos serão mantidos.</p>
    </ConfirmDialog>
  </>;
}
