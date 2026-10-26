import { useCallback, useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { ErrorState } from '@/components/ui';
import { goodbyeStore, sessionNotice, useSession, welcomeStore } from '@/api/auth';
import { errorMessage } from '@/api/client';
import { LoginPage } from './LoginPage';
import { WelcomeSplash } from './WelcomeSplash';
import { GoodbyeSplash } from './GoodbyeSplash';

/** Só mostra o sistema com sessão válida; sem ela, mostra a tela de login (inclusive na impressão). */
export function AuthGate({ children }: { children: ReactNode }) {
  const session = useSession();
  const welcome = useSyncExternalStore(welcomeStore.subscribe, welcomeStore.get);
  const goodbye = useSyncExternalStore(goodbyeStore.subscribe, goodbyeStore.get);
  const finishWelcome = useCallback(() => welcomeStore.set(false), []);
  const finishGoodbye = useCallback(() => goodbyeStore.set(null), []);
  const unreachable = Boolean(session.error) && session.data === undefined;

  // Servidor fora do ar: tenta de novo sozinho a cada 5 s e entra assim que ele voltar.
  useEffect(() => {
    if (!unreachable) return;
    const id = window.setInterval(() => void session.refetch(), 5000);
    return () => window.clearInterval(id);
  }, [unreachable, session.refetch]);

  let content: ReactNode;
  if (session.isPending) {
    content = (
      <div className="grid min-h-app place-items-center bg-nav" role="status">
        <img src="/emblema-seice.webp" alt="" className="size-14 animate-pulse object-contain opacity-90" />
        <span className="sr-only">Verificando acesso…</span>
      </div>
    );
  } else if (unreachable) {
    content = (
      <div className="grid min-h-app place-items-center bg-canvas px-4">
        <div className="rounded-xl bg-surface shadow-raise">
          <ErrorState message={errorMessage(session.error)} onRetry={() => session.refetch()} />
          <p className="flex items-center justify-center gap-2 border-t border-line px-6 py-3 text-xs text-muted" role="status">
            <span className="size-1.5 animate-pulse rounded-full bg-warning" aria-hidden="true" />
            Tentando reconectar automaticamente…
          </p>
        </div>
      </div>
    );
  } else if (!session.data) {
    content = <LoginPage expired={sessionNotice.expired} />;
  } else {
    // O sistema já carrega por trás da animação de boas-vindas, para aparecer pronto quando ela terminar.
    content = (
      <>
        {children}
        {welcome && !goodbye && <WelcomeSplash user={session.data} onDone={finishWelcome} />}
      </>
    );
  }

  return (
    <>
      {content}
      {goodbye && <GoodbyeSplash state={goodbye} onDone={finishGoodbye} />}
    </>
  );
}
