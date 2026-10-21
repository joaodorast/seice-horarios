import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { CalendarDays, Clock, Copy, GraduationCap, Pencil, StickyNote, Trash2, UserRound } from 'lucide-react';
import { useDeleteLesson, useScheduleData } from '@/api/hooks';
import { errorMessage } from '@/api/client';
import { Alert, Badge, Button, Modal, useToast } from '@/components/ui';
import { useScheduleIndex } from '@/hooks/useScheduleIndex';
import { SUBJECT_STYLE, NO_SUBJECT_STYLE } from '@/lib/subjectColors';
import { cn } from '@/lib/cn';
import { WEEKDAY_LABEL, SHIFT_LABEL } from '@shared/labels';
import { findScheduleConflicts } from '@shared/conflicts';
import { durationMinutes } from '@shared/time';
import type { Lesson, Weekday } from '@shared/types';
import { LessonEditor, type EditorRequest, type LessonPrefill } from './LessonEditor';

interface ScheduleActionsApi {
  createLesson: (prefill?: LessonPrefill) => void;
  openLesson: (lesson: Lesson) => void;
  editLesson: (lesson: Lesson) => void;
  ready: boolean;
}

const Ctx = createContext<ScheduleActionsApi | null>(null);

export function useScheduleActions() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useScheduleActions fora do provedor');
  return ctx;
}

/** Centraliza criação, visualização, duplicação e exclusão de aulas para todas as telas. */
export function ScheduleActionsProvider({ children }: { children: ReactNode }) {
  const { data } = useScheduleData();
  const [editor, setEditor] = useState<EditorRequest | null>(null);
  const [detailsId, setDetailsId] = useState<number | null>(null);

  const createLesson = useCallback((prefill?: LessonPrefill) => setEditor({ mode: 'create', prefill }), []);
  const openLesson = useCallback((lesson: Lesson) => setDetailsId(lesson.id), []);
  const editLesson = useCallback((lesson: Lesson) => setEditor({ mode: 'edit', lesson }), []);

  const api = useMemo(() => ({ createLesson, openLesson, editLesson, ready: Boolean(data) }), [createLesson, openLesson, editLesson, data]);
  const detailsLesson = detailsId ? data?.lessons.find((l) => l.id === detailsId) ?? null : null;

  return (
    <Ctx.Provider value={api}>
      {children}
      {data && (
        <>
          <LessonEditor request={editor} data={data} onClose={() => setEditor(null)} />
          <LessonDetails
            lesson={detailsLesson}
            onClose={() => setDetailsId(null)}
            onEdit={(l) => {
              setDetailsId(null);
              setEditor({ mode: 'edit', lesson: l });
            }}
            onDuplicate={(l) => {
              setDetailsId(null);
              const days = data.settings.enabledDays;
              const nextDay = (days.find((d) => d > l.weekday) ?? days[0] ?? l.weekday) as Weekday;
              setEditor({
                mode: 'create',
                duplicateOf: l,
                prefill: { classId: l.classId, teacherId: l.teacherId, subjectId: l.subjectId, weekday: nextDay, start: l.start, end: l.end, notes: l.notes },
              });
            }}
          />
        </>
      )}
    </Ctx.Provider>
  );
}

function LessonDetails({
  lesson,
  onClose,
  onEdit,
  onDuplicate,
}: {
  lesson: Lesson | null;
  onClose: () => void;
  onEdit: (l: Lesson) => void;
  onDuplicate: (l: Lesson) => void;
}) {
  const { data } = useScheduleData();
  const index = useScheduleIndex(data);
  const [confirming, setConfirming] = useState(false);
  const del = useDeleteLesson();
  const toast = useToast();

  const close = () => {
    setConfirming(false);
    onClose();
  };

  const subject = lesson?.subjectId ? index.subjectById.get(lesson.subjectId) : undefined;
  const teacher = lesson ? index.teacherById.get(lesson.teacherId) : undefined;
  const schoolClass = lesson ? index.classById.get(lesson.classId) : undefined;
  const style = subject ? SUBJECT_STYLE[subject.color] : NO_SUBJECT_STYLE;
  const conflicts = lesson && data ? findScheduleConflicts(data.lessons).filter((c) => c.a.id === lesson.id || c.b.id === lesson.id) : [];

  async function remove() {
    if (!lesson) return;
    try {
      await del.mutateAsync(lesson.id);
      toast.success('Aula excluída', `${subject?.name ?? 'Aula'} · turma ${schoolClass?.name}, ${WEEKDAY_LABEL[lesson.weekday].toLowerCase()} ${lesson.start}`);
      close();
    } catch (error) {
      toast.error('Não foi possível excluir a aula', errorMessage(error));
    }
  }

  return (
    <Modal
      open={lesson !== null}
      onClose={close}
      size="sm"
      title={
        <span className="flex items-center gap-2.5">
          <span className={cn('size-3 shrink-0 rounded-full', style.dot)} aria-hidden="true" />
          {subject?.name ?? 'Aula sem disciplina'}
        </span>
      }
      description={lesson ? `${WEEKDAY_LABEL[lesson.weekday]}, ${lesson.start} às ${lesson.end}` : undefined}
      footer={
        lesson &&
        (confirming ? (
          <>
            <Button onClick={() => setConfirming(false)} disabled={del.isPending} data-autofocus>
              Manter aula
            </Button>
            <Button variant="danger" loading={del.isPending} onClick={() => void remove()}>
              Excluir aula
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" className="text-danger hover:bg-danger-soft hover:text-danger sm:mr-auto" icon={<Trash2 className="size-4" />} onClick={() => setConfirming(true)}>
              Excluir
            </Button>
            <Button icon={<Copy className="size-4" />} onClick={() => onDuplicate(lesson)}>
              Duplicar
            </Button>
            <Button variant="primary" icon={<Pencil className="size-4" />} onClick={() => onEdit(lesson)} data-autofocus>
              Editar
            </Button>
          </>
        ))
      }
    >
      {lesson && (
        <div className="flex flex-col gap-4">
          {confirming && (
            <Alert tone="danger" title="Excluir esta aula do quadro?">
              Ela deixará de aparecer nas grades do professor e da turma. Esta ação não pode ser desfeita.
            </Alert>
          )}
          {conflicts.length > 0 && (
            <Alert tone="danger" title="Esta aula está em conflito">
              Há outra aula no mesmo horário para {conflicts[0].type === 'teacher' ? 'o mesmo professor' : 'a mesma turma'}. Edite uma delas para resolver.
            </Alert>
          )}
          {teacher && !teacher.active && (
            <Alert tone="warning" title="Professor inativo">
              Reative o cadastro ou troque o professor desta aula.
            </Alert>
          )}
          {schoolClass && !schoolClass.active && (
            <Alert tone="warning" title="Turma inativa">
              Reative a turma ou remova esta aula do quadro.
            </Alert>
          )}
          <dl className="divide-y divide-line rounded-lg border border-line">
            <DetailRow icon={<GraduationCap />} label="Turma">
              {schoolClass ? (
                <Link to={`/horarios/turma/${schoolClass.id}`} onClick={close} className="font-semibold hover:underline underline-offset-2">
                  {schoolClass.name}
                </Link>
              ) : (
                '—'
              )}
              {schoolClass && (
                <span className="ml-2 text-muted">
                  {schoolClass.grade} · {SHIFT_LABEL[schoolClass.shift]}
                </span>
              )}
            </DetailRow>
            <DetailRow icon={<UserRound />} label="Professor">
              {teacher ? (
                <Link to={`/horarios/professor/${teacher.id}`} onClick={close} className="font-semibold hover:underline underline-offset-2">
                  {teacher.name}
                </Link>
              ) : (
                '—'
              )}
              {teacher?.area && <span className="ml-2 text-muted">{teacher.area}</span>}
            </DetailRow>
            <DetailRow icon={<CalendarDays />} label="Dia">
              {WEEKDAY_LABEL[lesson.weekday]}
            </DetailRow>
            <DetailRow icon={<Clock />} label="Horário">
              <span className="tabular">
                {lesson.start} às {lesson.end}
              </span>
              <Badge className="ml-2">{durationMinutes(lesson.start, lesson.end)} min</Badge>
            </DetailRow>
            {lesson.notes && (
              <DetailRow icon={<StickyNote />} label="Observações">
                <span className="whitespace-pre-line">{lesson.notes}</span>
              </DetailRow>
            )}
          </dl>
        </div>
      )}
    </Modal>
  );
}

function DetailRow({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 px-3.5 py-2.5 text-sm">
      <span className="mt-0.5 text-muted [&>svg]:size-4" aria-hidden="true">
        {icon}
      </span>
      <dt className="w-24 shrink-0 text-muted">{label}</dt>
      <dd className="min-w-0 flex-1 text-ink">{children}</dd>
    </div>
  );
}
