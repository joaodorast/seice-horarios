import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ChevronLeft, ChevronRight, ExternalLink, GraduationCap, Plus, Printer, Users } from 'lucide-react';
import { Page } from '@/components/layout/Page';
import { DataGate } from '@/components/layout/DataGate';
import { Button, ButtonLink, Card, Combobox, EmptyState, IconButton, StatusBadge } from '@/components/ui';
import { EntitySchedule } from '@/components/schedule/EntitySchedule';
import { useScheduleActions } from '@/components/schedule/ScheduleActions';
import { useScheduleData } from '@/api/hooks';
import { useScheduleIndex } from '@/hooks/useScheduleIndex';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { SHIFT_LABEL } from '@shared/labels';
import { durationMinutes } from '@shared/time';
import { formatHours } from '@/lib/format';

/** Página "Horários por professor" ou "Horários por turma": escolha rápida + grade + impressão. */
export function EntitySchedulePage({ kind }: { kind: 'teacher' | 'class' }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const schedule = useScheduleData();
  const index = useScheduleIndex(schedule.data);
  const actions = useScheduleActions();
  const [last, setLast] = useLocalStorage<number | null>(`seice:last-${kind}`, null);
  const base = kind === 'teacher' ? '/horarios/professor' : '/horarios/turma';

  const list = kind === 'teacher' ? schedule.data?.teachers ?? [] : schedule.data?.classes ?? [];
  const sorted = [...list].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, 'pt-BR', { numeric: true }));
  const selectedId = id ? Number(id) : null;
  const selected = sorted.find((e) => e.id === selectedId);

  useEffect(() => {
    if (!schedule.data) return;
    if (!id) {
      const fallback = sorted.find((e) => e.id === last) ?? sorted.find((e) => e.active);
      if (fallback) navigate(`${base}/${fallback.id}`, { replace: true });
    } else if (selected) {
      setLast(selected.id);
    }
  }, [id, schedule.data, selected?.id]);

  const pos = selected ? sorted.findIndex((e) => e.id === selected.id) : -1;
  const prev = pos > 0 ? sorted[pos - 1] : undefined;
  const next = pos >= 0 && pos < sorted.length - 1 ? sorted[pos + 1] : undefined;

  const lessons = selected ? (schedule.data?.lessons ?? []).filter((l) => (kind === 'teacher' ? l.teacherId : l.classId) === selected.id) : [];
  const minutes = lessons.reduce((s, l) => s + durationMinutes(l.start, l.end), 0);
  const related = new Set(lessons.map((l) => (kind === 'teacher' ? l.classId : l.teacherId))).size;

  const title = kind === 'teacher' ? 'Horários por professor' : 'Horários por turma';
  const noun = kind === 'teacher' ? 'professor' : 'turma';

  return (
    <Page
      title={title}
      width="wide"
      breadcrumbs={[
        { label: 'Quadro de horários', to: '/horarios' },
        { label: kind === 'teacher' ? 'Por professor' : 'Por turma', to: selected ? base : undefined },
        ...(selected ? [{ label: selected.name }] : []),
      ]}
      actions={
        selected && (
          <>
            <ButtonLink to={`/imprimir/${kind === 'teacher' ? 'professor' : 'turma'}/${selected.id}`} target="_blank" icon={<Printer className="size-4" />}>
              Imprimir ou PDF
            </ButtonLink>
            {selected.active && (
              <Button
                variant="primary"
                icon={<Plus className="size-4" />}
                onClick={() => actions.createLesson(kind === 'teacher' ? { teacherId: selected.id } : { classId: selected.id })}
              >
                Nova aula
              </Button>
            )}
          </>
        )
      }
    >
      <DataGate data={schedule.data} isLoading={schedule.isLoading} error={schedule.error} onRetry={schedule.refetch}>
        {(data) =>
          sorted.length === 0 ? (
            <Card>
              <EmptyState
                icon={kind === 'teacher' ? <Users /> : <GraduationCap />}
                title={kind === 'teacher' ? 'Nenhum professor cadastrado' : 'Nenhuma turma cadastrada'}
                description={`Cadastre ${kind === 'teacher' ? 'professores' : 'turmas'} para visualizar e organizar os horários.`}
                action={
                  <ButtonLink variant="primary" to={kind === 'teacher' ? '/professores' : '/turmas'}>
                    Ir para {kind === 'teacher' ? 'Professores' : 'Turmas'}
                  </ButtonLink>
                }
              />
            </Card>
          ) : (
            <div className="flex flex-col gap-5">
              <Card className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center">
                <div className="flex items-center gap-2 lg:w-[420px]">
                  <IconButton label={`${noun === 'turma' ? 'Turma anterior' : 'Professor anterior'}`} disabled={!prev} onClick={() => prev && navigate(`${base}/${prev.id}`)}>
                    <ChevronLeft className="size-5" />
                  </IconButton>
                  <div className="min-w-0 flex-1">
                    <label htmlFor="entity-picker" className="sr-only">
                      Selecionar {noun}
                    </label>
                    <Combobox
                      id="entity-picker"
                      value={selected?.id ?? null}
                      onChange={(v) => v && navigate(`${base}/${v}`)}
                      placeholder={`Selecione ${kind === 'teacher' ? 'o professor' : 'a turma'}`}
                      options={sorted.map((e) => ({
                        value: e.id,
                        label: e.name,
                        description:
                          kind === 'teacher'
                            ? [('area' in e && e.area) || null, !e.active && 'Inativo'].filter(Boolean).join(' · ') || undefined
                            : 'grade' in e
                              ? `${e.grade} · ${SHIFT_LABEL[e.shift]}${e.active ? '' : ' · Inativa'}`
                              : undefined,
                      }))}
                    />
                  </div>
                  <IconButton label={`${noun === 'turma' ? 'Próxima turma' : 'Próximo professor'}`} disabled={!next} onClick={() => next && navigate(`${base}/${next.id}`)}>
                    <ChevronRight className="size-5" />
                  </IconButton>
                </div>
                {selected && (
                  <div className="flex flex-1 flex-wrap items-center gap-x-6 gap-y-2 text-sm lg:justify-end">
                    <StatusBadge active={selected.active} />
                    <span className="text-muted">
                      <strong className="tabular font-bold text-ink">{lessons.length}</strong> aulas
                    </span>
                    <span className="text-muted">
                      <strong className="tabular font-bold text-ink">{formatHours(minutes)}</strong> semanais
                    </span>
                    <span className="text-muted">
                      <strong className="tabular font-bold text-ink">{related}</strong> {kind === 'teacher' ? 'turma(s)' : 'professor(es)'}
                    </span>
                    <Link
                      to={kind === 'teacher' ? `/professores/${selected.id}` : `/turmas/${selected.id}`}
                      className="inline-flex items-center gap-1 font-semibold text-ink hover:underline underline-offset-2"
                    >
                      Ver cadastro <ExternalLink className="size-3.5" />
                    </Link>
                  </div>
                )}
              </Card>

              {selected ? (
                <EntitySchedule key={`${kind}-${selected.id}`} kind={kind} id={selected.id} data={data} index={index} />
              ) : id ? (
                <Card>
                  <EmptyState title={`${kind === 'teacher' ? 'Professor não encontrado' : 'Turma não encontrada'}`} description="Selecione outro registro na lista acima." />
                </Card>
              ) : null}
            </div>
          )
        }
      </DataGate>
    </Page>
  );
}

export const TeacherSchedulePage = () => <EntitySchedulePage kind="teacher" />;
export const ClassSchedulePage = () => <EntitySchedulePage kind="class" />;
