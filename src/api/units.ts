import { useQuery } from '@tanstack/react-query';
import { request } from './client';
import { useSession } from './auth';
import type { Unit } from '@shared/types';

export const UNITS_KEY = ['units'] as const;

/** Unidades que a sessão atual pode enxergar (a API já filtra pelo perfil). */
export const useUnits = () => useQuery({ queryKey: UNITS_KEY, queryFn: () => request<Unit[]>('GET', '/units'), staleTime: 10 * 60_000 });

/** O usuário da sessão enxerga todas as unidades? (admin) */
export function useIsAdmin() {
  const { data: user } = useSession();
  return user?.role === 'admin';
}

/** Unidade fixa do coordenador — quando existe, o formulário não deixa escolher outra. */
export function useFixedUnitId(): number | null {
  const { data: user } = useSession();
  return user?.role === 'coordenador' || user?.role === 'demo' ? (user.unitId ?? null) : null;
}

/** Conta de demonstração: navega à vontade, mas não grava nada (o servidor recusa). */
export function useIsDemoAccount() {
  const { data: user } = useSession();
  return user?.role === 'demo';
}
