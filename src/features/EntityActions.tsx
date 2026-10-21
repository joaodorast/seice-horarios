import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { Alert, Button, ConfirmDialog, useToast } from '@/components/ui';
import { useDeleteClass, useDeleteTeacher, useSetClassStatus, useSetTeacherStatus } from '@/api/hooks';
import { errorMessage } from '@/api/client';
import { plural } from '@/lib/text';
import type { SchoolClass, Teacher } from '@shared/types';

type Target = { kind: 'teacher'; entity: Teacher; lessonCount: number } | { kind: 'class'; entity: SchoolClass; lessonCount: number };

/**
 * Inativação e exclusão com proteção: se houver aulas vinculadas, explica as consequências
 * e oferece a inativação como alternativa segura.
 */
export function useEntityActions(options: { afterDeleteTo?: string } = {}) {
  const [removing, setRemoving] = useState<Target | null>(null);
  const [deactivating, setDeactivating] = useState<Target | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();
  const delTeacher = useDeleteTeacher();
  const delClass = useDeleteClass();
  const statusTeacher = useSetTeacherStatus();
  const statusClass = useSetClassStatus();

  const name = (t: Target) => (t.kind === 'teacher' ? t.entity.name : `turma ${t.entity.name}`);
  const Name = (t: Target) => (t.kind === 'teacher' ? t.entity.name : `Turma ${t.entity.name}`);

  async function setStatus(t: Target, active: boolean) {
    try {
      if (t.kind === 'teacher') await statusTeacher.mutateAsync({ id: t.entity.id, active });
      else await statusClass.mutateAsync({ id: t.entity.id, active });
      toast.success(active ? 'Cadastro reativado' : 'Cadastro inativado', Name(t));
      setDeactivating(null);
      setRemoving(null);
    } catch (error) {
      toast.error('Não foi possível alterar a situação', errorMessage(error));
    }
  }

  async function remove(t: Target, withLessons: boolean) {
    try {
      if (t.kind === 'teacher') await delTeacher.mutateAsync({ id: t.entity.id, withLessons });
      else await delClass.mutateAsync({ id: t.entity.id, withLessons });
      toast.success(t.kind === 'teacher' ? 'Professor excluído' : 'Turma excluída', withLessons ? `${Name(t)} e ${plural(t.lessonCount, 'aula', 'aulas')}` : Name(t));
      setRemoving(null);
      if (options.afterDeleteTo) navigate(options.afterDeleteTo);
    } catch (error) {
      toast.error('Não foi possível excluir', errorMessage(error));
    }
  }

  const busy = delTeacher.isPending || delClass.isPending || statusTeacher.isPending || statusClass.isPending;

  function toggleStatus(t: Target) {
    if (t.entity.active && t.lessonCount > 0) setDeactivating(t);
    else void setStatus(t, !t.entity.active);
  }

  function requestDelete(t: Target) {
    setAcknowledged(false);
    setRemoving(t);
  }

  let dialogs: ReactNode = null;
  if (deactivating) {
    dialogs = (
      <ConfirmDialog
        open
        tone="primary"
        title={`Inativar ${name(deactivating)}?`}
        confirmLabel="Inativar"
        loading={busy}
        onClose={() => setDeactivating(null)}
        onConfirm={() => void setStatus(deactivating, false)}
      >
        <p>
          {Name(deactivating)} tem {plural(deactivating.lessonCount, 'aula', 'aulas')} no quadro. Elas serão mantidas e aparecerão sinalizadas como
          pendência até que sejam reatribuídas ou removidas.
        </p>
        <p>Nenhuma nova aula poderá ser criada enquanto o cadastro estiver inativo.</p>
      </ConfirmDialog>
    );
  } else if (removing) {
    const hasLessons = removing.lessonCount > 0;
    dialogs = (
      <ConfirmDialog
        open
        title={`Excluir ${name(removing)}?`}
        confirmLabel={hasLessons ? `Excluir com ${plural(removing.lessonCount, 'aula', 'aulas')}` : 'Excluir definitivamente'}
        loading={busy}
        onClose={() => setRemoving(null)}
        confirmDisabled={hasLessons && !acknowledged}
        onConfirm={() => void remove(removing, hasLessons)}
        extraAction={
          hasLessons && removing.entity.active ? (
            <Button variant="dark" disabled={busy} onClick={() => void setStatus(removing, false)}>
              Inativar em vez disso
            </Button>
          ) : undefined
        }
      >
        {hasLessons ? (
          <>
            <Alert tone="warning" title={`${Name(removing)} possui ${plural(removing.lessonCount, 'aula', 'aulas')} no quadro`}>
              Ao excluir, todas essas aulas também serão removidas das grades de professores e turmas.
            </Alert>
            {removing.entity.active && <p>Se a intenção é apenas deixar de usar este cadastro, prefira inativá-lo: o histórico e as aulas são preservados.</p>}
            <label className="flex items-start gap-2.5 rounded-md border border-line p-3">
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-[var(--color-danger)]"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
              />
              <span>Entendo que {plural(removing.lessonCount, 'aula será excluída', 'aulas serão excluídas')} e que esta ação não pode ser desfeita.</span>
            </label>
          </>
        ) : (
          <p>O cadastro será removido permanentemente. Esta ação não pode ser desfeita.</p>
        )}
      </ConfirmDialog>
    );
  }

  return { toggleStatus, requestDelete, dialogs };
}
