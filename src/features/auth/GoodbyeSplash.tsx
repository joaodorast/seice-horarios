import { useEffect } from 'react';
import type { GoodbyePhase } from '@/api/auth';

/** Duração do esmaecimento final, quando a tela de login já está por baixo (ms). */
const CLOSE_MS = 650;

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? '';
}

/**
 * Despedida exibida ao sair: aparece na hora do clique, cobre o encerramento da sessão no servidor
 * e some revelando a tela de login.
 */
export function GoodbyeSplash({ state, onDone }: { state: NonNullable<GoodbyePhase>; onDone: () => void }) {
  const closing = state.phase === 'closing';

  useEffect(() => {
    if (!closing) return;
    const id = window.setTimeout(onDone, CLOSE_MS);
    return () => window.clearTimeout(id);
  }, [closing, onDone]);

  const name = firstName(state.name);

  return (
    <div
      role="status"
      aria-live="assertive"
      aria-label={closing ? 'Sessão encerrada' : 'Saindo do sistema'}
      className="fixed inset-0 z-[300] flex flex-col items-center justify-center overflow-hidden bg-nav px-6 text-white"
      style={{
        animation: closing
          ? `seice-goodbye-out ${CLOSE_MS}ms cubic-bezier(0.4, 0, 0.2, 1) forwards`
          : 'seice-goodbye-in 380ms cubic-bezier(0.2, 0.8, 0.2, 1) both',
      }}
    >
      <div className="bg-grid absolute inset-0 [mask-image:radial-gradient(circle_at_center,black_10%,transparent_65%)]" aria-hidden="true" />
      <div className="absolute top-1/2 left-1/2 size-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/10 blur-[120px]" aria-hidden="true" />

      <div className="relative grid place-items-center" aria-hidden="true">
        <span className="absolute size-24 rounded-full border-2 border-brand/50" style={{ animation: 'seice-ring-in 1.1s cubic-bezier(0.2, 0.7, 0.3, 1) both' }} />
        <span className="grid size-20 place-items-center rounded-full bg-white shadow-[0_0_0_6px_rgb(255_199_0/0.14),0_20px_50px_-12px_rgb(0_0_0/0.6)]">
          <img src="/emblema-seice.webp" alt="" className="size-[60px] object-contain" />
        </span>
      </div>

      <h1 className="relative mt-8 text-center text-[2.25rem] leading-tight font-extrabold tracking-[-0.035em] sm:text-[3rem]" style={{ animation: 'seice-fade-up 0.55s ease-out 0.1s both' }}>
        Até logo{name ? <>, <span className="text-brand">{name}</span></> : null}
      </h1>
      <p className="relative mt-3 text-sm text-nav-text" style={{ animation: 'seice-fade-up 0.55s ease-out 0.25s both' }}>
        {closing ? 'Sessão encerrada com segurança.' : 'Encerrando sua sessão com segurança…'}
      </p>

      <div className="absolute bottom-14 w-[min(240px,64vw)]" aria-hidden="true">
        <div className="h-[3px] overflow-hidden rounded-full bg-white/10">
          <div className="h-full origin-left rounded-full bg-brand" style={{ animation: 'seice-progress 1.1s cubic-bezier(0.4, 0, 0.2, 1) both' }} />
        </div>
      </div>
    </div>
  );
}
