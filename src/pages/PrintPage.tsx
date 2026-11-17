import { computePayrollWorkload, lessonWorkloadKind } from '@shared/payroll';
import { displayPeriods, ScheduleDisplay, useScheduleDisplay } from '@/components/schedule/ScheduleDisplay';
import { useEffect } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, Printer } from 'lucide-react';
import { Button, ErrorState, LoadingBlock } from '@/components/ui';
import { useScheduleData, type ScheduleData } from '@/api/hooks';
import { useScheduleIndex, type ScheduleIndex } from '@/hooks/useScheduleIndex';
import { errorMessage } from '@/api/client';
import { lessonsInPeriod, lessonsOutsideGrid, periodsForClassShift, periodsForShifts } from '@shared/grid';
import { SHIFT_LABEL, WEEKDAY_LABEL } from '@shared/labels';
import { overlaps } from '@shared/time';
import type { Lesson, Period, ShiftKey } from '@shared/types';
import { SUBJECT_STYLE } from '@/lib/subjectColors';
import { formatHours } from '@/lib/format';
import { cn } from '@/lib/cn';

type Kind = 'professor' | 'turma';

/** Versão para impressão e PDF: sem navegação, com identificação da escola e grade em A4 paisagem. */
export function PrintPage() {
  const { kind, id } = useParams() as { kind: Kind; id: string };
  const schedule = useScheduleData();
  const index = useScheduleIndex(schedule.data);
  const all = id === 'todos' || id === 'todas';

  const targets = (() => {
    const d = schedule.data;
    if (!d) return [];
    if (kind === 'professor') return all ? d.teachers.filter((t) => t.active) : d.teachers.filter((t) => t.id === Number(id));
    return all ? d.classes.filter((c) => c.active).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true })) : d.classes.filter((c) => c.id === Number(id));
  })();

  const docTitle = all
    ? kind === 'professor'
      ? 'Horários dos professores'
      : 'Horários das turmas'
    : targets[0]
      ? `Horário — ${kind === 'turma' ? 'Turma ' : ''}${targets[0].name}`
      : 'Quadro de horários';

  useEffect(() => {
    document.title = `${docTitle} · Colégio SEICE`;
  }, [docTitle]);

  return (
    <div className="min-h-app bg-canvas print:bg-white">
      <div className="no-print sticky top-0 z-10 border-b border-line bg-surface">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-3 px-4 py-3">
          <Link
            to={kind === 'professor' ? (all ? '/professores' : `/horarios/professor/${id}`) : all ? '/turmas' : `/horarios/turma/${id}`}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-2 hover:text-ink"
          >
            <ArrowLeft className="size-4" /> Voltar ao sistema
          </Link>
          <p className="text-[13px] text-muted sm:ml-4">
            Para gerar um PDF, escolha <strong className="text-ink-2">Salvar como PDF</strong> na janela de impressão.
          </p>
          <ScheduleDisplay />
          <Button variant="primary" className="ml-auto" icon={<Printer className="size-4" />} onClick={() => window.print()} disabled={!targets.length}>
            Imprimir ou salvar PDF
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-[1280px] px-4 py-8 print:max-w-none print:p-0">
        {schedule.error && !schedule.data ? (
          <ErrorState message={errorMessage(schedule.error)} onRetry={schedule.refetch} />
        ) : !schedule.data ? (
          <LoadingBlock label="Preparando documento…" />
        ) : targets.length === 0 ? (
          <div className="rounded-xl bg-surface p-10 text-center shadow-raise">
            <p className="font-bold">Nada para imprimir</p>
            <p className="mt-1 text-sm text-muted">O cadastro não foi encontrado ou não há registros ativos.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-8 print:gap-0">
            {targets.map((t) => (
              <Sheet key={t.id} kind={kind} entityId={t.id} data={schedule.data!} index={index} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Sheet({ kind, entityId, data, index }: { kind: Kind; entityId: number; data: ScheduleData; index: ScheduleIndex }) {
  const { showTimes, showBreaks } = useScheduleDisplay();

  const teacher = kind === 'professor' ? index.teacherById.get(entityId) : undefined;
  const schoolClass = kind === 'turma' ? index.classById.get(entityId) : undefined;
  const lessons = data.lessons.filter((l) => (kind === 'professor' ? l.teacherId === entityId : l.classId === entityId));
  const days = data.settings.enabledDays;
  const payrollWorkload=computePayrollWorkload(data.lessons,teacher?[teacher]:data.teachers,schoolClass?[schoolClass]:data.classes,data.subjects,data.periods,data.settings,{scope:'semana',day:1,month:new Date().toISOString().slice(0,7)});
  const payrollRow=teacher ? payrollWorkload.rows.find((r)=>r.teacher.id===teacher.id) : undefined;
  const timeCount=payrollWorkload.grand.lessons;
  const paidTotal=payrollWorkload.grand.minutes;
  const fixedTotal=payrollWorkload.rows.reduce((sum,row)=>sum+(row.payroll?.regencyMinutes??0),0);
  const fixedForClass=(classId:number)=>payrollRow?.bySubject.filter((subject)=>subject.workloadKind==='regency'&&subject.byClass.has(classId))??[];

  // Para professores, imprime cada turno em que há aulas (ou os turnos habilitados, se a grade estiver vazia).
  let sections: { title?: string; periods: Period[] }[];
  if (schoolClass) {
    sections = [{ periods: periodsForClassShift(data.periods, schoolClass.shift) }];
  } else {
    const used = (['manha', 'tarde', 'noite'] as ShiftKey[]).filter((s) =>
      data.periods.some((p) => p.shift === s && p.kind === 'aula' && lessons.some((l) => overlaps(p.start, p.end, l.start, l.end))),
    );
    const shifts = used.length ? used : data.settings.enabledShifts;
    sections = shifts.map((s) => ({ title: shifts.length > 1 ? `Turno ${SHIFT_LABEL[s].toLowerCase()}` : undefined, periods: periodsForShifts(data.periods, [s]) }));
  }
  sections = sections.map((section) => ({ ...section, periods: displayPeriods(section.periods, showBreaks) }));
  const outside = lessonsOutsideGrid(lessons, data.periods, days);
  const related = kind==='professor' ? (payrollRow?.byClass.size ?? 0) : new Set(lessons.map((l)=>l.teacherId).filter((id)=>id!==null)).size;

  return (
    <article className="rounded-xl bg-white p-8 shadow-raise print:break-after-page print:rounded-none print:p-0 print:shadow-none print:last:break-after-auto">
      <header className="flex items-start justify-between gap-6 border-b-2 border-ink pb-4 print:pb-2">
        <div className="flex items-center gap-4">
          <img src="/logo-seice.webp" alt="Colégio SEICE" className="h-14 w-auto print:h-12" />
        </div>
        <div className="text-right">
          <p className="text-sm print:text-xs font-semibold text-muted">Colégio SEICE · Sistema de Ensino Integrado de Campos Elíseos</p>
          <h1 className="mt-1 text-xl font-extrabold tracking-tight">
            {teacher ? teacher.name : `Turma ${schoolClass?.name}`}
          </h1>
          <p className="text-sm print:text-xs text-ink-2">
            {teacher
              ? ['Quadro de horários do professor', teacher.area].filter(Boolean).join(' · ')
              : `${schoolClass?.grade} · Turno ${schoolClass ? SHIFT_LABEL[schoolClass.shift].toLowerCase() : ''}`}
          </p>
        </div>
      </header>

      <div className="mt-3 print:mt-2 mb-4 print:mb-2 flex flex-wrap gap-x-6 gap-y-1 text-sm print:text-xs text-ink-2">
        <span>
          {timeCount>0?<><strong>{timeCount}</strong> tempos regulares/técnicos na semana</>:fixedTotal>0?'Carga semanal de regência fixa':'Nenhuma aula remunerada neste recorte'}
        </span>
        <span>
          <strong>{paidTotal} minutos para pagamento</strong> por semana
        </span>
        <span>
          <strong>{related}</strong> {kind === 'professor' ? 'turma(s)' : 'professor(es)'}
        </span>
        <span className="ml-auto text-muted">Emitido em {new Date().toLocaleDateString('pt-BR')}</span>
      </div>

      <div className="mb-4 print:mb-2 grid gap-2 text-sm print:text-xs sm:grid-cols-3">
        <p className="rounded-lg border border-[#bdd6f4] bg-[#edf5ff] p-2"><strong>Regulares (normais)</strong><br />{payrollRow?.payroll?.regularLessons ?? payrollWorkload.rows.reduce((sum,r)=>sum+(r.payroll?.regularLessons??0),0)} tempos · {formatHours(payrollRow?.payroll?.regularMinutes ?? payrollWorkload.rows.reduce((sum,r)=>sum+(r.payroll?.regularMinutes??0),0))}</p>
        <p className="rounded-lg border border-[#ecd891] bg-[#fff7db] p-2"><strong>Técnicos</strong><br />{payrollRow?.payroll?.technicalLessons ?? payrollWorkload.rows.reduce((sum,r)=>sum+(r.payroll?.technicalLessons??0),0)} tempos · {formatHours(payrollRow?.payroll?.technicalMinutes ?? payrollWorkload.rows.reduce((sum,r)=>sum+(r.payroll?.technicalMinutes??0),0))}</p>
        <p className="rounded-lg border-2 border-[#27824c] bg-[#eaf7ef] p-3 text-[#14532d]"><strong>CARGA FIXA DE REGÊNCIA</strong><br /><span className="text-lg font-extrabold">{formatHours(fixedTotal)}</span> · <strong>{fixedTotal.toLocaleString('pt-BR')} min</strong><br /><span>{fixedTotal>0?'Incluída no total, sem repetir por disciplina.':'Nenhuma regência fixa neste recorte.'}</span></p>
      </div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border-2 border-[#245991] bg-[#eaf2ff] p-3 text-[#163d68] print:break-inside-avoid"><strong>TOTAL SEMANAL PARA PAGAMENTO</strong><span className="text-xl font-extrabold">{formatHours(paidTotal)} = {paidTotal.toLocaleString('pt-BR')} minutos</span></div>
      {payrollRow?.payroll && <p className="mb-3 rounded-lg border border-line p-2 text-sm print:text-xs"><strong>Dias no colégio:</strong> {payrollRow.payroll.days.map((d)=>WEEKDAY_LABEL[d]).join(', ') || 'Sem dias cadastrados'}. <strong>{payrollRow.payroll.attendanceDays} dias na semana para conferir vale-transporte.</strong> Várias aulas no mesmo dia contam uma vez; não é registro de presença.</p>}
      {payrollRow?.payroll?.hasReference && <p className="mb-3 text-sm print:text-xs"><strong>Carga semanal informada pela escola:</strong> {payrollRow.payroll.referenceRegular} tempos regulares + {payrollRow.payroll.referenceTechnical} técnicos. A grade abaixo mostra os horários cadastrados.</p>}
      {teacher && (
        <section className="mb-4 print:mb-2 break-inside-avoid">
          <h2 className="mb-2 text-sm font-bold">Resumo semanal por turma</h2>
          <table className="w-full border-collapse text-sm print:text-sm">
            <thead><tr className="bg-subtle"><th className="border border-line p-2 text-left">Turma</th><th className="border border-line p-2 text-left">Tipo de carga</th><th className="border border-line p-2 text-right">Minutos para pagamento</th><th className="border border-line p-2 text-right">Total em horas</th></tr></thead>
            <tbody>{[...(payrollRow?.byClass ?? [])].map(([classId,load])=>{
              const fixed=fixedForClass(classId),fixedMinutes=fixed.reduce((sum,subject)=>sum+(subject.byClass.get(classId)?.minutes??0),0);
              return <tr key={classId} className={fixedMinutes>0?'bg-[#eaf7ef] text-[#14532d]':''}>
                <td className="border border-line p-2">{index.classById.get(classId)?.name ?? 'Turma'}</td>
                <td className="border border-line p-2"><strong>{fixedMinutes>0?'CARGA FIXA':'Por tempos'}</strong>{fixed.map((subject)=><span key={subject.label} className="mt-1 block">{subject.label?.includes('Infantil')?'Educação Infantil':'Fundamental I'}: {formatHours(subject.total.minutes)}</span>)}{load.lessons>0&&<span className="mt-1 block">{fixedMinutes>0?'+ ':''}{load.lessons} tempos regulares/técnicos</span>}</td>
                <td className="border border-line p-2 text-right text-base font-bold">{load.minutes.toLocaleString('pt-BR')} min</td><td className="border border-line p-2 text-right text-base font-extrabold">{formatHours(load.minutes)}</td>
              </tr>;
            })}</tbody>
            <tfoot><tr className="bg-[#163d68] text-white"><th className="border border-[#163d68] p-3 text-left">TOTAL DO PROFESSOR NA SEMANA</th><th className="border border-[#163d68] p-3 text-left">{fixedTotal>0?'Carga fixa'+(timeCount>0?' + tempos':''):`${timeCount} tempos`}</th><th className="border border-[#163d68] p-3 text-right text-base">{paidTotal.toLocaleString('pt-BR')} min</th><th className="border border-[#163d68] p-3 text-right text-lg">{formatHours(paidTotal)}</th></tr></tfoot>
          </table>
          <p className="mt-2 text-sm leading-relaxed text-ink-2"><strong className="text-[#14532d]">Verde: carga fixa de regência.</strong> <strong className="text-[#163d68]">Azul: total para pagamento.</strong> As horas já estão convertidas em minutos (1 hora = 60 minutos). A carga fixa é contada uma vez por turma, sem multiplicar pelas disciplinas.</p>
        </section>
      )}
      {sections.map((section, si) => (
        <section key={si} className={cn('print:break-inside-avoid', sections.length > 1 ? 'mb-2.5' : 'mb-4 print:mb-2')}>
          {section.title && <h2 className="mb-1.5 text-[13px] font-bold">{section.title}</h2>}
          {section.periods.length === 0 ? (
            <p className="rounded border border-line p-4 text-sm text-muted">Nenhum período configurado para este turno.</p>
          ) : (
            <table className="w-full table-fixed border-collapse text-sm print:text-xs">
              <thead>
                <tr>
                  <th className="w-[92px] border border-ink/30 bg-ink/[0.06] px-2 py-1.5 text-left font-bold">Tempo</th>
                  {days.map((d) => (
                    <th key={d} className="border border-ink/30 bg-ink/[0.06] px-2 py-1.5 text-left font-bold">
                      {WEEKDAY_LABEL[d]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {section.periods.map((p) =>
                  p.kind === 'intervalo' ? (
                    <tr key={p.id}>
                      <td className="border border-ink/30 bg-ink/[0.04] px-2 py-1 tabular text-muted">
                        {p.start}–{p.end}
                      </td>
                      <td colSpan={days.length} className="border border-ink/30 bg-ink/[0.04] px-2 py-1 text-center font-semibold text-muted">
                        {p.label}
                      </td>
                    </tr>
                  ) : (
                    <tr key={p.id}>
                      <td className={cn('border border-ink/30 px-2 align-top', sections.length > 1 ? 'py-0' : 'py-1.5')}>
                        <span className="block font-bold">{p.label}</span>
                        <span hidden={!showTimes} className="tabular text-muted">
                          {p.start}–{p.end}
                        </span>
                      </td>
                      {days.map((d) => (
                        <td key={d} className={cn('border border-ink/30 px-1.5 py-1 align-top', sections.length > 1 ? 'h-[26px]' : 'h-[42px]')}>
                          {lessonsInPeriod(lessons, d, p).map((l) => (
                            <PrintLesson key={l.id} lesson={l} index={index} kind={kind} period={p} showTimes={showTimes} />
                          ))}
                        </td>
                      ))}
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          )}
        </section>
      ))}

      {outside.length > 0 && (
        <section className="mb-4 print:mb-2 break-inside-avoid">
          <h2 className="mb-1.5 text-[13px] font-bold">Aulas em horários especiais</h2>
          <ul className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-sm print:text-xs">
            {outside.map((l) => (
              <li key={l.id}>
                {WEEKDAY_LABEL[l.weekday]}, {l.start}–{l.end}: {describe(l, index, kind)}
              </li>
            ))}
          </ul>
        </section>
      )}

      {(teacher?.notes || schoolClass?.notes) && (
        <p className="mt-2 text-sm print:text-xs text-ink-2">
          <strong>Observações:</strong> {teacher?.notes ?? schoolClass?.notes}
        </p>
      )}
    </article>
  );
}

function describe(l: Lesson, index: ScheduleIndex, kind: Kind) {
  const s = l.subjectId ? index.subjectById.get(l.subjectId)?.name : undefined;
  const other = kind === 'professor' ? `Turma ${index.classById.get(l.classId)?.name}` : index.teacherById.get(l.teacherId ?? -1)?.name;
  return [s, other].filter(Boolean).join(' — ');
}

function PrintLesson({ lesson, index, kind, period, showTimes }: { lesson: Lesson; index: ScheduleIndex; kind: Kind; period: Period; showTimes: boolean }) {
  const subject = lesson.subjectId ? index.subjectById.get(lesson.subjectId) : undefined;
  const relatedClass = index.classById.get(lesson.classId);
  const codes = relatedClass?.name.match(/\b\d{4}\b/g);
  const classReference = codes?.length ? `Turma ${codes[codes.length - 1]}${relatedClass?.name.match(/\b(CE|JP)\b/) ? ` · ${relatedClass.name.match(/\b(CE|JP)\b/)![1]}` : ''}` : relatedClass?.name;
  const other = kind === 'professor' ? classReference : index.teacherById.get(lesson.teacherId ?? -1)?.name ?? '— Sem professor';
  const loadKind=lessonWorkloadKind(lesson,[...index.subjectById.values()]);
  const custom = lesson.start !== period.start || lesson.end !== period.end;
  return (
    <div className="flex gap-1.5 leading-tight" style={{breakInside:'avoid'}} title={other}>
      <span className={cn('mt-0.5 w-[3px] shrink-0 self-stretch rounded-full', subject ? SUBJECT_STYLE[subject.color].bar : 'bg-ink/30')} />
      <div className="min-w-0">
        <span className="block font-bold">{subject?.name ?? 'Aula'}{loadKind==='technical'?' · Técnico':''}</span>
        <span className="block break-words">{other}</span>
        {showTimes && custom && <span className="tabular block text-xs print:text-[11px] text-muted">{lesson.start}–{lesson.end}</span>}
        {lesson.notes && <span className="block break-words text-xs print:text-[11px] text-muted">{lesson.notes}</span>}
      </div>
    </div>
  );
}
