import { useCallback, useSyncExternalStore, type ReactNode } from 'react';
import { ErrorState } from '@/components/ui';
import { sessionNotice, useSession, welcomeStore } from '@/api/auth';
import { errorMessage } from '@/api/client';
import { LoginPage } from './LoginPage';
import { WelcomeSplash } from './WelcomeSplash';

/** Só mostra o sistema com sessão válida; sem ela, mostra a tela de login (inclusive na impressão). */
export function AuthGate({ children }: { children: ReactNode }) {
  const session = useSession();
  const welcome = useSyncExternalStore(welcomeStore.subscribe, welcomeStore.get);
  const finishWelcome = useCallback(() => welcomeStore.set(false), []);

  if (session.isPending) {
    return (
      <div className="grid min-h-dvh place-items-center bg-nav" role="status">
        <img src="/emblema-seice.png" alt="" className="size-14 animate-pulse object-contain opacity-90" />
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
  return (
    <>
      {/* O sistema já carrega por trás da animação, para aparecer pronto quando ela terminar. */}
      {children}
      {welcome && <WelcomeSplash user={session.data} onDone={finishWelcome} />}
    </>
  );
}
