import { useState } from 'react';
import { Check } from 'lucide-react';
import { Button, Field, Input, Modal, useToast } from '@/components/ui';
import { useSaveSubject } from '@/api/hooks';
import { ApiError, errorMessage } from '@/api/client';
import { subjectSchema } from '@shared/schemas';
import { SUBJECT_COLORS, type Subject, type SubjectColor } from '@shared/types';
import { SUBJECT_STYLE } from '@/lib/subjectColors';
import { cn } from '@/lib/cn';

export function SubjectFormModal({ subject, onClose }: { subject: Subject | 'new' | null; onClose: () => void }) {
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
