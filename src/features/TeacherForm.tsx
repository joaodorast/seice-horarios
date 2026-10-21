import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { teacherSchema, type TeacherFormValues, type TeacherInput } from '@shared/schemas';
import type { Teacher } from '@shared/types';
import { Alert, Button, Field, Input, Modal, Switch, Textarea, useToast } from '@/components/ui';
import { useSaveTeacher } from '@/api/hooks';
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
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    control,
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
      <Field label="Disciplina ou área de atuação" optional error={errors.area?.message}>
        <Input {...register('area')} placeholder="Ex.: Matemática, Ciências da Natureza" maxLength={80} />
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
