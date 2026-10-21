import type { ReactNode } from 'react';
import { ErrorState, Spinner } from '@/components/ui';
import { sessionNotice, useSession } from '@/api/auth';
import { errorMessage } from '@/api/client';
import { LoginPage } from './LoginPage';

/** Só mostra o sistema com sessão válida; sem ela, mostra a tela de login (inclusive na impressão). */
export function AuthGate({ children }: { children: ReactNode }) {
  const session = useSession();

  if (session.isPending) {
    return (
      <div className="grid min-h-dvh place-items-center bg-canvas" role="status">
        <Spinner size={28} className="text-muted" />
        <span className="sr-only">Verificando acesso…</span>
      </div>
    );
  }
  if (session.error && session.data === undefined) {
    return (
      <div className="grid min-h-dvh place-items-center bg-canvas px-4">
        <div className="rounded-xl bg-surface shadow-raise">
          <ErrorState message={errorMessage(session.error)} onRetry={() => session.refetch()} />
        </div>
      </div>
    );
  }
  if (!session.data) return <LoginPage expired={sessionNotice.expired} />;
  return <>{children}</>;
}
