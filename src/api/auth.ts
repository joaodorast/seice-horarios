import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, request } from './client';

export interface SessionUser {
  id: number;
  email: string;
  name: string;
}

export const ME_KEY = ['auth', 'me'] as const;

/** Distingue sessão expirada (mostra aviso no login) de saída voluntária. */
export const sessionNotice = { expired: false };

/** Sinaliza que a animação de boas-vindas deve ser exibida (somente logo após entrar). */
let welcomePending = false;
const welcomeListeners = new Set<() => void>();
export const welcomeStore = {
  get: () => welcomePending,
  set(value: boolean) {
    welcomePending = value;
    welcomeListeners.forEach((l) => l());
  },
  subscribe(listener: () => void) {
    welcomeListeners.add(listener);
    return () => welcomeListeners.delete(listener);
  },
};

/** Usuário da sessão atual, ou null quando é preciso entrar. */
export function useSession() {
  return useQuery({
    queryKey: ME_KEY,
    queryFn: async () => {
      try {
        return (await request<{ user: SessionUser }>('GET', '/auth/me')).user;
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
    staleTime: 5 * 60_000,
    retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { email: string; password: string }) => request<{ user: SessionUser }>('POST', '/auth/login', input),
    onSuccess: ({ user }) => {
      sessionNotice.expired = false;
      welcomeStore.set(true);
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== ME_KEY[0] });
      qc.setQueryData(ME_KEY, user);
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => request<void>('POST', '/auth/logout'),
    onSettled: () => {
      sessionNotice.expired = false;
      // Apaga da memória do navegador tudo que foi carregado na sessão.
      qc.clear();
      qc.setQueryData(ME_KEY, null);
    },
  });
}
