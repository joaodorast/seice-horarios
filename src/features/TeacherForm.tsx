import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { teacherSchema, type TeacherFormValues, type TeacherInput } from '@shared/schemas';
import type { Teacher } from '@shared/types';
import { Alert, Button, Field, Input, Modal, Switch, Textarea, useToast } from '@/components/ui';
import { useSaveTeacher, useTeachers } from '@/api/hooks';
import { useFixedUnitId, useUnits } from '@/api/units';
import { TeacherPhotoField } from '@/features/TeacherPhoto';
import { SubjectPicker } from '@/features/SubjectPicker';
import { Check, ImagePlus } from 'lucide-react';
import { cn } from '@/lib/cn';
import { ApiError, errorMessage } from '@/api/client';
import { formatPhone } from '@/lib/text';
import { useState } from 'react';

export function TeacherFormModal({
  open,
  teacher,
  onClose,
  onSaved,
}: {
  open: boolean;
  teacher?: Teacher | null;
  onClose: () => void;
  onSaved?: (t: Teacher) => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      dismissible={false}
      title={teacher ? 'Editar professor' : 'Novo professor'}
      description={teacher ? teacher.name : 'Apenas o nome é obrigatório. Os demais dados podem ser completados depois.'}
    >
      {open && <TeacherForm key={teacher?.id ?? 'new'} teacher={teacher ?? null} onClose={onClose} onSaved={onSaved} />}
    </Modal>
  );
}

function TeacherForm({ teacher, onClose, onSaved }: { teacher: Teacher | null; onClose: () => void; onSaved?: (t: Teacher) => void }) {
  const save = useSaveTeacher();
  const toast = useToast();
  const units = useUnits();
  const fixedUnitId = useFixedUnitId();
  const isAdmin = fixedUnitId === null;
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    control,
    setValue,
    setError,
    formState: { errors },
  } = useForm<TeacherFormValues, unknown, TeacherInput>({
    resolver: zodResolver(teacherSchema),
    defaultValues: {
      name: teacher?.name ?? '',
      code: teacher?.code ?? '',
      area: teacher?.area ?? '',
      phone: teacher?.phone ?? '',
      notes: teacher?.notes ?? '',
      active: teacher?.active ?? true,
      unitId: teacher?.unitId ?? fixedUnitId ?? units.data?.[0]?.id,
      unitIds: teacher?.unitIds?.length ? teacher.unitIds : fixedUnitId ? [fixedUnitId] : units.data?.[0] ? [units.data[0].id] : [],
      subjectIds: teacher?.subjectIds ?? [],
    },
  });

  const onSubmit = handleSubmit(async (input) => {
    setFormError(null);
    try {
      const saved = await save.mutateAsync({ id: teacher?.id, input });
      toast.success(teacher ? 'Alterações salvas' : 'Professor cadastrado', saved.name);
      onSaved?.(saved);
      onClose();
    } catch (error) {
      if (error instanceof ApiError && error.fields) {
        for (const [field, message] of Object.entries(error.fields)) {
          setError(field as keyof TeacherFormValues, { message });
        }
      } else {
        setFormError(errorMessage(error));
      }
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {formError && <Alert tone="danger" title={formError} />}
      <PhotoSection teacher={teacher} />
      <Field label="Nome completo" required error={errors.name?.message}>
        <Input {...register('name')} autoComplete="off" placeholder="Ex.: Maria Aparecida dos Santos" maxLength={120} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Matrícula ou código" optional error={errors.code?.message} hint="Deve ser único na escola.">
          <Input {...register('code')} autoComplete="off" maxLength={30} />
        </Field>
        <Field label="Telefone" optional error={errors.phone?.message}>
          <Controller
            control={control}
            name="phone"
            render={({ field }) => (
              <Input
                type="tel"
                inputMode="tel"
                placeholder="(21) 99999-0000"
                value={field.value ?? ''}
                onChange={(e) => field.onChange(formatPhone(e.target.value))}
                onBlur={field.onBlur}
                ref={field.ref}
              />
            )}
          />
        </Field>
      </div>
      <Controller
        control={control}
        name="unitIds"
        render={({ field }) => (
          <UnitPicker
            units={units.data ?? []}
            value={(field.value as number[] | undefined) ?? []}
            onChange={(ids) => {
              field.onChange(ids);
              // A unidade principal acompanha a primeira marcada, para o cadastro nunca ficar sem unidade.
              if (ids.length) setValue('unitId', ids[0]);
            }}
            locked={!isAdmin}
          />
        )}
      />
      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold text-ink-2">
          Disciplinas que leciona <span className="text-xs font-medium text-soft">opcional</span>
        </span>
        <Controller control={control} name="subjectIds" render={({ field }) => <SubjectPicker value={field.value ?? []} onChange={field.onChange} onNavigate={onClose} />} />
        <p className="text-xs text-muted">
          Marque todas. Ao lançar uma aula, o sistema sugere a disciplina certa para cada horário, e aprende sozinho com as aulas salvas.
        </p>
      </div>
      <Field label="Área de atuação" optional error={errors.area?.message} hint="Informação livre, só para consulta. Ex.: Ciências Humanas.">
        <Input {...register('area')} placeholder="Ex.: Ciências Humanas" maxLength={80} />
      </Field>
      <Field label="Observações" optional error={errors.notes?.message}>
        <Textarea {...register('notes')} rows={3} maxLength={1000} placeholder="Disponibilidade, preferências de horário, informações úteis à coordenação" />
      </Field>
      <Controller
        control={control}
        name="active"
        render={({ field }) => (
          <Switch
            checked={field.value ?? true}
            onChange={field.onChange}
            label="Cadastro ativo"
            description="Professores inativos continuam no histórico, mas não podem receber novas aulas."
          />
        )}
      />
      <div className="-mx-5 mt-2 -mb-5 flex flex-col-reverse gap-2 border-t border-line bg-subtle px-5 py-3.5 sm:-mx-6 sm:flex-row sm:justify-end sm:px-6">
        <Button onClick={onClose} disabled={save.isPending}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" loading={save.isPending}>
          {teacher ? 'Salvar alterações' : 'Cadastrar professor'}
        </Button>
      </div>
    </form>
  );
}

/** Foto no formulário: disponível ao editar; no cadastro novo, explica que vem logo depois. */
function PhotoSection({ teacher }: { teacher: Teacher | null }) {
  // A lista é a fonte mais recente: a foto atualiza aqui assim que é salva, sem fechar o formulário.
  const fresh = useTeachers().data?.find((t) => t.id === teacher?.id) ?? teacher;
  if (!fresh) {
    return (
      <p className="flex items-center gap-2.5 rounded-lg bg-subtle px-3.5 py-2.5 text-[13.5px] text-muted">
        <ImagePlus className="size-4 shrink-0 text-soft" />
        Depois de cadastrar, você poderá adicionar a foto do professor.
      </p>
    );
  }
  return (
    <div className="rounded-xl bg-subtle px-4 py-3.5">
      <p className="mb-3 text-[13px] font-semibold text-ink-2">Foto do professor</p>
      <TeacherPhotoField teacher={fresh} layout="inline" />
    </div>
  );
}

/**
 * Unidades em que o professor atua. O coordenador vê apenas a unidade dele (travada);
 * a administração pode marcar as duas — é assim que o professor compartilhado é cadastrado.
 */
export function UnitPicker({
  units,
  value,
  onChange,
  locked = false,
}: {
  units: Array<{ id: number; code: string; name: string }>;
  value: number[];
  onChange: (ids: number[]) => void;
  locked?: boolean;
}) {
  const toggle = (id: number) => {
    if (locked) return;
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  };
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[13px] font-semibold text-ink-2">
        Unidade <span className="text-danger">*</span>
      </span>
      <div className="flex flex-wrap gap-2">
        {units.map((u) => {
          const checked = value.includes(u.id);
          return (
            <button
              key={u.id}
              type="button"
              aria-pressed={checked}
              disabled={locked}
              onClick={() => toggle(u.id)}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-[13.5px] font-semibold transition',
                checked ? 'border-brand bg-brand/10 text-ink' : 'border-line bg-white text-muted hover:border-soft',
                locked && 'cursor-default opacity-100',
              )}
            >
              <span
                className={cn(
                  'grid size-4 place-items-center rounded-[5px] border',
                  checked ? 'border-brand bg-brand text-ink' : 'border-soft bg-white',
                )}
              >
                {checked && <Check className="size-3" strokeWidth={3.5} />}
              </span>
              <span className="font-extrabold">{u.code}</span>
              <span className="font-medium">{u.name}</span>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted">
        {locked
          ? 'Seu acesso é desta unidade. Para um professor que também atua na outra unidade, fale com a administração.'
          : 'Marque as duas quando o professor der aula nas duas unidades. O sistema impede o mesmo horário nas duas.'}
      </p>
    </div>
  );
}
