import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router';
import { ToastProvider } from '@/components/ui';
import { ApiError } from '@/api/client';
import { ME_KEY, sessionNotice } from '@/api/auth';
import { AuthGate } from '@/features/auth/AuthGate';
import { AppErrorBoundary } from '@/components/layout/AppErrorBoundary';
import { installResilience } from '@/lib/resilience';
import { installTextScale } from '@/lib/textScale';
import { router } from './router';
import './styles/index.css';

/** Sessão expirada em qualquer chamada: volta para a tela de login. */
const onError = (error: unknown) => {
  if (error instanceof ApiError && error.status === 401 && error.code === 'unauthorized' && queryClient.getQueryData(ME_KEY)) {
    sessionNotice.expired = true;
    queryClient.setQueryData(ME_KEY, null);
  }
};

const queryClient: QueryClient = new QueryClient({
  queryCache: new QueryCache({ onError }),
  mutationCache: new MutationCache({ onError }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: true,
      retry: (count, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 2,
    },
  },
});

installResilience();
installTextScale();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <AuthGate>
            <RouterProvider router={router} />
          </AuthGate>
        </ToastProvider>
      </QueryClientProvider>
    </AppErrorBoundary>
  </StrictMode>,
);
