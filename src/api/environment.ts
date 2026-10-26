import { useQuery } from '@tanstack/react-query';
import { request } from './client';

/** Credenciais do ambiente de teste (scripts/demo-server.ts). Só existem no banco em memória. */
export const DEMO_LOGIN = { email: 'teste@seice.com', password: 'teste1234' };

/**
 * Indica se o sistema está rodando no ambiente de teste (`npm run demo`), cujo banco é em memória
 * e com dados fictícios. Usado para exibir o aviso "Ambiente de teste" em todas as telas.
 */
export function useIsDemo(): boolean {
  const { data } = useQuery({
    queryKey: ['environment'],
    queryFn: () => request<{ database: 'cloud' | 'embedded' }>('GET', '/health'),
    staleTime: Infinity,
    retry: false,
  });
  return data?.database === 'embedded';
}
