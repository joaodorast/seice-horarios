import { useState } from 'react';
import { BookOpen, Check, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button, Card, CardHeader, ConfirmDialog, EmptyState, Field, IconButton, Input, Modal, useToast } from '@/components/ui';
import { useDeleteSubject, useSaveSubject, type ScheduleData } from '@/api/hooks';
import { ApiError, errorMessage } from '@/api/client';
import { subjectSchema } from '@shared/schemas';
import { SUBJECT_COLORS, type Subject, type SubjectColor } from '@shared/types';
import { SUBJECT_STYLE } from '@/lib/subjectColors';
import { cn } from '@/lib/cn';
import { plural } from '@/lib/text';

export function SubjectSettings({ data }: { data: ScheduleData }) {
  const [editing, setEditing] = useState<Subject | 'new' | null>(null);
  const [removing, setRemoving] = useState<Subject | null>(null);
  const del = useDeleteSubject();
  const toast = useToast();
  const usage = (id: number) => data.lessons.filter((l) => l.subjectId === id).length;

  async function remove(s: Subject) {
    try {
      await del.mutateAsync({ id: s.id, detachLessons: usage(s.id) > 0 });
      toast.success('Disciplina excluída', s.name);
      setRemoving(null);
    } catch (error) {
      toast.error('Não foi possível excluir', errorMessage(error));
    }
  }

  return (
    <Card>
      <CardHeader
        title="Disciplinas"
        description="Usadas para identificar as aulas nas grades. Cada cor ajuda a reconhecer a disciplina rapidamente."
        actions={
          data.subjects.length > 0 && (
            <Button variant="primary" size="sm" icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>
              Nova disciplina
            </Button>
          )
        }
      />
      {data.subjects.length === 0 ? (
        <EmptyState
          icon={<BookOpen />}
          title="Nenhuma disciplina cadastrada"
          description="Cadastrar disciplinas é opcional, mas deixa as grades mais legíveis e permite filtrar o quadro."
          action={
            <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>
              Cadastrar disciplina
            </Button>
          }
        />
      ) : (
        <ul className="divide-y divide-line border-t border-line">
          {data.subjects.map((s) => {
            const n = usage(s.id);
            return (
              <li key={s.id} className="flex items-center gap-3 px-5 py-2.5">
                <span className={cn('size-3 shrink-0 rounded-full', SUBJECT_STYLE[s.color].dot)} aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{s.name}</span>
                <span className="tabular text-xs text-muted">{n ? plural(n, 'aula', 'aulas') : 'Sem aulas'}</span>
                <div className="flex gap-0.5">
                  <IconButton size="sm" label={`Editar ${s.name}`} onClick={() => setEditing(s)}>
                    <Pencil className="size-4" />
                  </IconButton>
                  <IconButton size="sm" tone="danger" label={`Excluir ${s.name}`} onClick={() => setRemoving(s)}>
                    <Trash2 className="size-4" />
                  </IconButton>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <SubjectModal subject={editing} onClose={() => setEditing(null)} />

      <ConfirmDialog
        open={removing !== null}
        title={`Excluir ${removing?.name ?? 'disciplina'}?`}
        confirmLabel="Excluir disciplina"
        loading={del.isPending}
        onClose={() => setRemoving(null)}
        onConfirm={() => removing && void remove(removing)}
      >
        {removing && usage(removing.id) > 0 ? (
          <p>
            Esta disciplina está em {plural(usage(removing.id), 'aula', 'aulas')}. As aulas <strong>serão mantidas</strong> no quadro, mas ficarão sem
            disciplina definida.
          </p>
        ) : (
          <p>A disciplina não está em nenhuma aula e será removida permanentemente.</p>
        )}
      </ConfirmDialog>
    </Card>
  );
}

function SubjectModal({ subject, onClose }: { subject: Subject | 'new' | null; onClose: () => void }) {
  const open = subject !== null;
  const current = subject === 'new' ? null : subject;
  return (
    <Modal open={open} onClose={onClose} size="sm" title={current ? 'Editar disciplina' : 'Nova disciplina'}>
      {open && <SubjectForm key={current?.id ?? 'new'} subject={current} onClose={onClose} />}
    </Modal>
  );
}

function SubjectForm({ subject, onClose }: { subject: Subject | null; onClose: () => void }) {
  const [name, setName] = useState(subject?.name ?? '');
  const [color, setColor] = useState<SubjectColor>(subject?.color ?? 'indigo');
  const [error, setError] = useState<string | undefined>();
  const save = useSaveSubject();
  const toast = useToast();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = subjectSchema.safeParse({ name, color });
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    try {
      const saved = await save.mutateAsync({ id: subject?.id, input: parsed.data });
      toast.success(subject ? 'Disciplina atualizada' : 'Disciplina cadastrada', saved.name);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError && err.fields?.name ? err.fields.name : errorMessage(err));
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <Field label="Nome da disciplina" required error={error}>
        <Input value={name} onChange={(e) => (setName(e.target.value), setError(undefined))} maxLength={60} placeholder="Ex.: Língua Portuguesa" autoComplete="off" />
      </Field>
      <fieldset>
        <legend className="mb-2 text-[13px] font-semibold text-ink-2">Cor nas grades</legend>
        <div className="flex flex-wrap gap-2" role="radiogroup">
          {SUBJECT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={color === c}
              aria-label={SUBJECT_STYLE[c].name}
              title={SUBJECT_STYLE[c].name}
              onClick={() => setColor(c)}
              className={cn(
                'grid size-9 place-items-center rounded-full ring-offset-2 transition-shadow',
                SUBJECT_STYLE[c].dot,
                color === c ? 'ring-2 ring-ink' : 'hover:ring-2 hover:ring-line-strong',
              )}
            >
              {color === c && <Check className="size-4 text-white" strokeWidth={3} />}
            </button>
          ))}
        </div>
      </fieldset>
      <div className={cn('flex items-center gap-3 rounded-md px-3 py-2', SUBJECT_STYLE[color].chip)}>
        <span className={cn('h-8 w-[3px] rounded-full', SUBJECT_STYLE[color].bar)} />
        <span>
          <span className="block text-[13px] font-bold">{name.trim() || 'Nome da disciplina'}</span>
          <span className="block text-xs opacity-80">Prévia na grade</span>
        </span>
      </div>
      <div className="-mx-5 mt-1 -mb-5 flex flex-col-reverse gap-2 border-t border-line bg-subtle px-5 py-3.5 sm:-mx-6 sm:flex-row sm:justify-end sm:px-6">
        <Button onClick={onClose}>Cancelar</Button>
        <Button type="submit" variant="primary" loading={save.isPending}>
          {subject ? 'Salvar alterações' : 'Cadastrar disciplina'}
        </Button>
      </div>
    </form>
  );
}
