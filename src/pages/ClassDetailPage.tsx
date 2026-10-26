import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { GraduationCap, Pencil, Plus, Power, Printer, Trash2 } from 'lucide-react';
import { Page } from '@/components/layout/Page';
import { DataGate } from '@/components/layout/DataGate';
import { Button, ButtonLink, Card, CardHeader, EmptyState, Menu, StatusBadge } from '@/components/ui';
import { EntitySchedule } from '@/components/schedule/EntitySchedule';
import { useScheduleActions } from '@/components/schedule/ScheduleActions';
import { ClassFormModal } from '@/features/ClassForm';
import { useEntityActions } from '@/features/EntityActions';
import { ImportButton } from '@/features/import/ImportDialog';
import { useScheduleData } from '@/api/hooks';
import { useScheduleIndex } from '@/hooks/useScheduleIndex';
import { computeSlotStats } from '@shared/grid';
import { SHIFT_LABEL } from '@shared/labels';
import { SUBJECT_STYLE } from '@/lib/subjectColors';
import { cn } from '@/lib/cn';
import { Info, Stat } from './TeacherDetailPage';
import { Avatar } from './TeachersPage';
import { GUIDES } from '@/lib/guides';

export function ClassDetailPage() {
  const { id } = useParams();
  const classId = Number(id);
  const schedule = useScheduleData();
  const index = useScheduleIndex(schedule.data);
  const schoolClass = index.classById.get(classId);
  const [editing, setEditing] = useState(false);
  const { toggleStatus, requestDelete, dialogs } = useEntityActions({ afterDeleteTo: '/turmas' });
  const actions = useScheduleActions();

  const lessons = useMemo(() => schedule.data?.lessons.filter((l) => l.classId === classId) ?? [], [schedule.data, classId]);

  const team = useMemo(() => {
    const map = new Map<number, { count: number; subjects: Set<number | null> }>();
    for (const l of lessons) {
      const cur = map.get(l.teacherId) ?? { count: 0, subjects: new Set<number | null>() };
      cur.count++;
      cur.subjects.add(l.subjectId);
      map.set(l.teacherId, cur);
    }
    return [...map.entries()].sort((a, b) => b[1].count - a[1].count);
  }, [lessons]);

  const slots =
    schedule.data && schoolClass
      ? computeSlotStats([{ ...schoolClass, active: true }], schedule.data.lessons, schedule.data.periods, schedule.data.settings)
      : null;

  if (schedule.data && !schoolClass) {
    return (
      <Page title="Turma não encontrada" breadcrumbs={[{ label: 'Turmas', to: '/turmas' }, { label: 'Não encontrada' }]}>
        <Card>
          <EmptyState
            icon={<GraduationCap />}
            title="Esta turma não existe mais"
            description="Ela pode ter sido excluída. Volte à lista para localizar outra turma."
            action={<ButtonLink to="/turmas">Ver turmas</ButtonLink>}
          />
        </Card>
      </Page>
    );
  }

  return (
    <Page
      title={schoolClass ? `Turma ${schoolClass.name}` : 'Turma'}
      guide={GUIDES.classDetail}
      width="wide"
      titleAddon={schoolClass && <StatusBadge active={schoolClass.active} />}
      breadcrumbs={[{ label: 'Turmas', to: '/turmas' }, { label: schoolClass?.name ?? '…' }]}
      description={schoolClass ? `${schoolClass.grade} · Turno ${SHIFT_LABEL[schoolClass.shift].toLowerCase()}` : undefined}
      actions={
        schoolClass && (
          <>
            <Button icon={<Pencil className="size-4" />} onClick={() => setEditing(true)}>
              Editar
            </Button>
            <ButtonLink to={`/imprimir/turma/${schoolClass.id}`} target="_blank" icon={<Printer className="size-4" />}>
              Imprimir
            </ButtonLink>
            <ImportButton kind="lessons" label="Importar aulas" fixed={{ classId: schoolClass.id, label: schoolClass.name }} />
            {schoolClass.active && (
              <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => actions.createLesson({ classId: schoolClass.id })}>
                Nova aula
              </Button>
            )}
            <Menu
              size="md"
              label="Mais ações"
              items={[
                {
                  label: schoolClass.active ? 'Inativar' : 'Reativar',
                  icon: <Power />,
                  onSelect: () => toggleStatus({ kind: 'class', entity: schoolClass, lessonCount: lessons.length }),
                },
                {
                  label: 'Excluir',
                  icon: <Trash2 />,
                  tone: 'danger',
                  onSelect: () => requestDelete({ kind: 'class', entity: schoolClass, lessonCount: lessons.length }),
                },
              ]}
            />
          </>
        )
      }
    >
      <DataGate data={schedule.data} isLoading={schedule.isLoading} error={schedule.error} onRetry={schedule.refetch}>
        {(data) =>
          schoolClass && (
            <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_340px]">
              <div className="flex min-w-0 flex-col gap-6">
                <Card className="flex flex-col gap-5 p-5 md:flex-row md:items-center">
                  <dl className="grid flex-1 gap-x-8 gap-y-3 text-sm sm:grid-cols-3">
                    <Info label="Ano, série ou etapa">{schoolClass.grade}</Info>
                    <Info label="Turno">{SHIFT_LABEL[schoolClass.shift]}</Info>
                    <Info label="Observações" empty="Nenhuma">
                      {schoolClass.notes}
                    </Info>
                  </dl>
                  <div className="flex gap-6 border-line md:border-l md:pl-8">
                    <Stat value={lessons.length} label={lessons.length === 1 ? 'aula na semana' : 'aulas na semana'} />
                    <Stat value={slots?.emptySlots ?? 0} label="horários vagos" />
                  </div>
                </Card>
                <section aria-labelledby="horario-turma">
                  <h2 id="horario-turma" className="mb-3 text-base font-bold">
                    Quadro semanal
                  </h2>
                  <EntitySchedule kind="class" id={schoolClass.id} data={data} index={index} />
                </section>
              </div>

              <Card className="self-start">
                <CardHeader title="Professores e disciplinas" description={team.length ? `${team.length} professor(es) nesta turma` : undefined} />
                {team.length === 0 ? (
                  <p className="px-5 pb-5 text-sm text-muted">Nenhuma aula atribuída ainda. Clique em um horário vazio da grade para adicionar.</p>
                ) : (
                  <ul className="grid border-t border-line sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-1 [&>li]:border-b [&>li]:border-line">
                    {team.map(([teacherId, info]) => {
                      const t = index.teacherById.get(teacherId);
                      if (!t) return null;
                      return (
                        <li key={teacherId} className="flex items-start gap-3 px-5 py-3">
                          <Avatar name={t.name} muted={!t.active} />
                          <div className="min-w-0 flex-1">
                            <Link to={`/professores/${t.id}`} className="block truncate text-sm font-semibold hover:underline underline-offset-2">
                              {t.name}
                            </Link>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {[...info.subjects].map((sid) => {
                                const s = sid ? index.subjectById.get(sid) : undefined;
                                return (
                                  <span
                                    key={sid ?? 'none'}
                                    className={cn('rounded px-1.5 py-0.5 text-[11px] font-semibold', s ? SUBJECT_STYLE[s.color].chip : 'bg-subtle text-muted')}
                                  >
                                    {s?.name ?? 'Sem disciplina'}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                          <span className="tabular shrink-0 text-xs text-muted">{info.count} aula(s)</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Card>
            </div>
          )
        }
      </DataGate>
      <ClassFormModal open={editing} schoolClass={schoolClass} onClose={() => setEditing(false)} />
      {dialogs}
    </Page>
  );
}
