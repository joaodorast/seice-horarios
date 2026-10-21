import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { classSchema, type ClassFormValues, type ClassInput } from '@shared/schemas';
import { SHIFT_LABEL } from '@shared/labels';
import { CLASS_SHIFTS, type SchoolClass } from '@shared/types';
import { Alert, Button, Field, Input, Modal, Segmented, Switch, Textarea, useToast } from '@/components/ui';
import { useSaveClass } from '@/api/hooks';
import { ApiError, errorMessage } from '@/api/client';

export function ClassFormModal({
  open,
  schoolClass,
  onClose,
  onSaved,
}: {
  open: boolean;
  schoolClass?: SchoolClass | null;
  onClose: () => void;
  onSaved?: (c: SchoolClass) => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      dismissible={false}
      title={schoolClass ? 'Editar turma' : 'Nova turma'}
      description={schoolClass ? `Turma ${schoolClass.name}` : 'O turno define quais períodos da grade a turma utiliza.'}
    >
      {open && <ClassForm key={schoolClass?.id ?? 'new'} schoolClass={schoolClass ?? null} onClose={onClose} onSaved={onSaved} />}
    </Modal>
  );
}

function ClassForm({ schoolClass, onClose, onSaved }: { schoolClass: SchoolClass | null; onClose: () => void; onSaved?: (c: SchoolClass) => void }) {
  const save = useSaveClass();
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors },
  } = useForm<ClassFormValues, unknown, ClassInput>({
    resolver: zodResolver(classSchema),
    defaultValues: {
      name: schoolClass?.name ?? '',
      grade: schoolClass?.grade ?? '',
      shift: schoolClass?.shift ?? 'manha',
      notes: schoolClass?.notes ?? '',
      active: schoolClass?.active ?? true,
    },
  });

  const onSubmit = handleSubmit(async (input) => {
    setFormError(null);
    try {
      const saved = await save.mutateAsync({ id: schoolClass?.id, input });
      toast.success(schoolClass ? 'Alterações salvas' : 'Turma cadastrada', `Turma ${saved.name}`);
      onSaved?.(saved);
      onClose();
    } catch (error) {
      if (error instanceof ApiError && error.fields) {
        for (const [field, message] of Object.entries(error.fields)) setError(field as keyof ClassFormValues, { message });
      } else {
        setFormError(errorMessage(error));
      }
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {formError && <Alert tone="danger" title={formError} />}
      <div className="grid gap-4 sm:grid-cols-[1fr_1.3fr]">
        <Field label="Identificação da turma" required error={errors.name?.message} hint="Ex.: 6º A, 1001, 3ª série B">
          <Input {...register('name')} autoComplete="off" maxLength={40} />
        </Field>
        <Field label="Ano, série ou etapa" required error={errors.grade?.message} hint="Ex.: 6º ano — Ensino Fundamental II">
          <Input {...register('grade')} autoComplete="off" maxLength={60} />
        </Field>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold text-ink-2">
          Turno <span className="text-danger">*</span>
        </span>
        <Controller
          control={control}
          name="shift"
          render={({ field }) => (
            <Segmented
              label="Turno"
              value={field.value}
              onChange={field.onChange}
              options={CLASS_SHIFTS.map((s) => ({ value: s, label: SHIFT_LABEL[s] }))}
              className="w-full sm:w-auto"
            />
          )}
        />
        <p className="text-xs text-muted">Turmas em período integral usam os horários da manhã e da tarde.</p>
        {errors.shift && <p className="text-[13px] font-medium text-danger">{errors.shift.message}</p>}
      </div>
      <Field label="Observações" optional error={errors.notes?.message}>
        <Textarea {...register('notes')} rows={3} maxLength={1000} placeholder="Sala, quantidade de alunos, necessidades específicas" />
      </Field>
      <Controller
        control={control}
        name="active"
        render={({ field }) => (
          <Switch
            checked={field.value ?? true}
            onChange={field.onChange}
            label="Turma ativa"
            description="Turmas inativas não recebem novas aulas e deixam de contar nas pendências."
          />
        )}
      />
      <div className="-mx-5 mt-2 -mb-5 flex flex-col-reverse gap-2 border-t border-line bg-subtle px-5 py-3.5 sm:-mx-6 sm:flex-row sm:justify-end sm:px-6">
        <Button onClick={onClose} disabled={save.isPending}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" loading={save.isPending}>
          {schoolClass ? 'Salvar alterações' : 'Cadastrar turma'}
        </Button>
      </div>
    </form>
  );
}
