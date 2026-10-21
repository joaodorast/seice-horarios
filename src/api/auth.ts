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

/** Pequeno estado global observável (usado com useSyncExternalStore). */
function createStore<T>(initial: T) {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set(next: T) {
      value = next;
      listeners.forEach((l) => l());
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}

/** Animação de boas-vindas pendente (somente logo após entrar). */
export const welcomeStore = createStore(false);

/**
 * Animação de saída: "leaving" enquanto a sessão é encerrada no servidor,
 * "closing" quando a tela de login já está por baixo e a despedida está sumindo.
 */
export type GoodbyePhase = { phase: 'leaving' | 'closing'; name: string } | null;
export const goodbyeStore = createStore<GoodbyePhase>(null);

/** Tempo mínimo da despedida, para a animação não "piscar" quando o servidor responde rápido. */
const MIN_GOODBYE_MS = 1200;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
    mutationFn: (input: { email: string; password: string; remember: boolean }) => request<{ user: SessionUser }>('POST', '/auth/login', input),
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
    mutationFn: async () => {
      const user = qc.getQueryData<SessionUser | null>(ME_KEY);
      goodbyeStore.set({ phase: 'leaving', name: user?.name ?? '' });
      const started = Date.now();
      try {
        await request<void>('POST', '/auth/logout');
      } catch (error) {
        // Sem confirmação do servidor a sessão continua válida: desfaz a despedida e avisa.
        goodbyeStore.set(null);
        throw error;
      }
      await sleep(MIN_GOODBYE_MS - (Date.now() - started));
    },
    onSuccess: async () => {
      sessionNotice.expired = false;
      await qc.cancelQueries();
      // Primeiro a sessão (a tela troca para o login), depois os dados carregados nesta sessão.
      // O registro da sessão não é removido: a tela o observa para saber quando mostrar o login.
      qc.setQueryData(ME_KEY, null);
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== ME_KEY[0] });
      goodbyeStore.set({ phase: 'closing', name: goodbyeStore.get()?.name ?? '' });
    },
  });
}
