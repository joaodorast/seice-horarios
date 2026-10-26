import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { Pencil, Plus, Power, Printer, Trash2, UserX } from 'lucide-react';
import { Page } from '@/components/layout/Page';
import { DataGate } from '@/components/layout/DataGate';
import { Button, ButtonLink, Card, EmptyState, Menu, StatusBadge } from '@/components/ui';
import { EntitySchedule } from '@/components/schedule/EntitySchedule';
import { useScheduleActions } from '@/components/schedule/ScheduleActions';
import { TeacherFormModal } from '@/features/TeacherForm';
import { useEntityActions } from '@/features/EntityActions';
import { ImportButton } from '@/features/import/ImportDialog';
import { useScheduleData } from '@/api/hooks';
import { useScheduleIndex } from '@/hooks/useScheduleIndex';
import { durationMinutes } from '@shared/time';
import { SHIFT_LABEL } from '@shared/labels';
import { TeacherPhotoField } from '@/features/TeacherPhoto';
import { SubjectChips } from '@/features/SubjectPicker';
import { formatHours } from '@/lib/format';
import { GUIDES } from '@/lib/guides';

export function TeacherDetailPage() {
  const { id } = useParams();
  const teacherId = Number(id);
  const schedule = useScheduleData();
  const index = useScheduleIndex(schedule.data);
  const teacher = index.teacherById.get(teacherId);
  const [editing, setEditing] = useState(false);
  const { toggleStatus, requestDelete, dialogs } = useEntityActions({ afterDeleteTo: '/professores' });
  const actions = useScheduleActions();

  const lessons = schedule.data?.lessons.filter((l) => l.teacherId === teacherId) ?? [];
  const minutes = lessons.reduce((sum, l) => sum + durationMinutes(l.start, l.end), 0);
  const classIds = [...new Set(lessons.map((l) => l.classId))];

  if (schedule.data && !teacher) {
    return (
      <Page title="Professor não encontrado" breadcrumbs={[{ label: 'Professores', to: '/professores' }, { label: 'Não encontrado' }]}>
        <Card>
          <EmptyState
            icon={<UserX />}
            title="Este cadastro não existe mais"
            description="Ele pode ter sido excluído. Volte à lista para localizar outro professor."
            action={<ButtonLink to="/professores">Ver professores</ButtonLink>}
          />
        </Card>
      </Page>
    );
  }

  return (
    <Page
      title={teacher?.name ?? 'Professor'}
      guide={GUIDES.teacherDetail}
      width="wide"
      titleAddon={teacher && <StatusBadge active={teacher.active} />}
      breadcrumbs={[{ label: 'Professores', to: '/professores' }, { label: teacher?.name ?? '…' }]}
      description={teacher?.area ?? undefined}
      actions={
        teacher && (
          <>
            <Button icon={<Pencil className="size-4" />} onClick={() => setEditing(true)}>
              Editar
            </Button>
            <ButtonLink to={`/imprimir/professor/${teacher.id}`} target="_blank" icon={<Printer className="size-4" />}>
              Imprimir
            </ButtonLink>
            <ImportButton kind="lessons" label="Importar aulas" fixed={{ teacherId: teacher.id, label: teacher.name }} />
            {teacher.active && (
              <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => actions.createLesson({ teacherId: teacher.id })}>
                Nova aula
              </Button>
            )}
            <Menu
              size="md"
              label="Mais ações"
              items={[
                { label: teacher.active ? 'Inativar' : 'Reativar', icon: <Power />, onSelect: () => toggleStatus({ kind: 'teacher', entity: teacher, lessonCount: lessons.length }) },
                { label: 'Excluir', icon: <Trash2 />, tone: 'danger', onSelect: () => requestDelete({ kind: 'teacher', entity: teacher, lessonCount: lessons.length }) },
              ]}
            />
          </>
        )
      }
    >
      <DataGate data={schedule.data} isLoading={schedule.isLoading} error={schedule.error} onRetry={schedule.refetch}>
        {(data) =>
          teacher && (
            <div className="flex flex-col gap-6">
              <Card className="grid items-center gap-x-8 gap-y-5 p-5 md:grid-cols-[auto_1fr_auto]">
                <TeacherPhotoField teacher={teacher} />
                <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <Info label="Matrícula">{teacher.code}</Info>
                  <Info label="Disciplinas">{teacher.subjectIds.length > 0 && <SubjectChips ids={teacher.subjectIds} max={6} />}</Info>
                  <Info label="Área de atuação">{teacher.area}</Info>
                  <Info label="Telefone">
                    {teacher.phone && (
                      <a href={`tel:${teacher.phone.replace(/\D/g, '')}`} className="tabular hover:underline underline-offset-2">
                        {teacher.phone}
                      </a>
                    )}
                  </Info>
                  <Info label="Turmas" empty="Nenhuma aula atribuída">
                    {classIds.length > 0 && (
                      <span className="flex flex-wrap gap-1.5">
                        {classIds.map((cid) => {
                          const c = index.classById.get(cid);
                          return (
                            c && (
                              <Link
                                key={cid}
                                to={`/turmas/${cid}`}
                                className="rounded bg-subtle px-1.5 py-0.5 text-xs font-semibold ring-1 ring-line hover:bg-brand-soft"
                                title={`${c.grade} · ${SHIFT_LABEL[c.shift]}`}
                              >
                                {c.name}
                              </Link>
                            )
                          );
                        })}
                      </span>
                    )}
                  </Info>
                  {teacher.notes && (
                    <div className="sm:col-span-2 lg:col-span-4">
                      <dt className="text-xs font-semibold text-muted">Observações</dt>
                      <dd className="mt-0.5 whitespace-pre-line text-ink-2">{teacher.notes}</dd>
                    </div>
                  )}
                </dl>
                <div className="flex gap-6 border-line md:border-l md:pl-8">
                  <Stat value={lessons.length} label={lessons.length === 1 ? 'aula na semana' : 'aulas na semana'} />
                  <Stat value={formatHours(minutes)} label="carga semanal" />
                </div>
              </Card>

              <section aria-labelledby="horario-prof">
                <h2 id="horario-prof" className="mb-3 text-base font-bold">
                  Quadro semanal
                </h2>
                <EntitySchedule kind="teacher" id={teacher.id} data={data} index={index} />
              </section>
            </div>
          )
        }
      </DataGate>
      <TeacherFormModal open={editing} teacher={teacher} onClose={() => setEditing(false)} />
      {dialogs}
    </Page>
  );
}

export function Info({ label, children, empty = 'Não informado' }: { label: string; children: React.ReactNode; empty?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold text-muted">{label}</dt>
      <dd className="mt-0.5 truncate font-medium text-ink">{children || <span className="font-normal text-soft">{empty}</span>}</dd>
    </div>
  );
}

export function Stat({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div>
      <p className="tabular text-2xl leading-none font-extrabold tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-muted">{label}</p>
    </div>
  );
}
