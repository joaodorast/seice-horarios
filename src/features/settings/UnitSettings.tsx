import { useQueryClient } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import { Building2 } from 'lucide-react';
import { Badge, Card, CardHeader } from '@/components/ui';
import { request } from '@/api/client';
import { UNITS_KEY, useIsAdmin, useUnits } from '@/api/units';
import type { Unit } from '@shared/types';

/**
 * Unidades da instituição. A lista já vem filtrada pelo perfil: o coordenador vê apenas a dele,
 * e só a administração enxerga as duas. A criação de unidade nova é exclusiva da administração.
 */
export function UnitSettings() {
  const units = useUnits();
  const isAdmin = useIsAdmin();
  const qc = useQueryClient();
  const toggle = useMutation({
    mutationFn: ({ unit }: { unit: Unit }) =>
      request<Unit>('PUT', `/units/${unit.id}`, { code: unit.code, name: unit.name, city: unit.city, active: !unit.active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: UNITS_KEY }),
  });

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader
          title="Unidades"
          description={
            isAdmin
              ? 'Cada professor e cada turma pertencem a uma unidade. Professores que dão aula nas duas aparecem marcados com as duas siglas.'
              : 'Seu acesso é desta unidade. Professores e turmas das outras unidades não aparecem para você.'
          }
        />
        <ul className="divide-y divide-line border-t border-line">
          {(units.data ?? []).map((u) => (
            <li key={u.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand-ink">
                <Building2 className="size-[18px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="font-extrabold text-ink">{u.code}</span>
                  <span className="truncate text-[14px] font-semibold text-ink-2">{u.name}</span>
                </span>
                <span className="block text-xs text-muted">{u.city ?? 'Sem cidade informada'}</span>
              </span>
              <Badge tone={u.active ? 'success' : 'neutral'} dot>
                {u.active ? 'Ativa' : 'Inativa'}
              </Badge>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => toggle.mutate({ unit: u })}
                  disabled={toggle.isPending}
                  className="rounded-md px-2.5 py-1.5 text-[13px] font-semibold text-ink-2 transition hover:bg-subtle disabled:opacity-50"
                >
                  {u.active ? 'Desativar' : 'Reativar'}
                </button>
              )}
            </li>
          ))}
        </ul>
        <p className="border-t border-line px-5 py-3 text-xs text-muted">
          {isAdmin
            ? 'Para criar uma unidade nova, fale com o suporte técnico: unidades são criadas junto com os acessos da coordenação.'
            : 'A administração enxerga as duas unidades e é quem cadastra o professor compartilhado.'}
        </p>
      </Card>
    </div>
  );
}
