import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { SessionUser } from '@/api/auth';

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Duração total e momento em que a cortina começa a abrir (ms). */
const TIMING = { total: 3000, exitAt: 2350 };
const TIMING_REDUCED = { total: 1300, exitAt: 950 };

function greeting(date: Date) {
  const h = date.getHours();
  return h < 5 ? 'Boa noite' : h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}

/**
 * Animação de boas-vindas exibida logo após o login: emblema com anel de luz, "Olá, seja bem-vindo"
 * letra a letra, saudação do momento e uma cortina que se abre revelando o sistema já carregado.
 */
export function WelcomeSplash({ user, onDone }: { user: SessionUser; onDone: () => void }) {
  const timing = useMemo(() => (reducedMotion() ? TIMING_REDUCED : TIMING), []);
  const [leaving, setLeaving] = useState(false);
  const now = useMemo(() => new Date(), []);
  const today = now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

  useEffect(() => {
    const exit = window.setTimeout(() => setLeaving(true), timing.exitAt);
    const done = window.setTimeout(onDone, timing.total);
    return () => {
      window.clearTimeout(exit);
      window.clearTimeout(done);
    };
  }, [timing, onDone]);

  const headline = ['Olá,', 'seja', 'bem-vindo'];
  let letterIndex = 0;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`Olá, seja bem-vindo, ${user.name}`}
      className="fixed inset-0 z-[300] flex flex-col items-center justify-center overflow-hidden bg-nav px-6 text-white"
      style={leaving ? { animation: `seice-splash-exit ${timing.total - timing.exitAt}ms cubic-bezier(0.76, 0, 0.24, 1) forwards` } : undefined}
    >
      <div className="bg-grid absolute inset-0 [mask-image:radial-gradient(circle_at_center,black_10%,transparent_65%)]" aria-hidden="true" />
      <div className="absolute top-1/2 left-1/2 size-[640px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/15 blur-[120px]" aria-hidden="true" />

      <div className="relative grid place-items-center" aria-hidden="true">
        <span className="absolute size-28 rounded-full border-2 border-brand/70" style={{ animation: 'seice-ring 1.6s cubic-bezier(0.2, 0.7, 0.3, 1) 0.15s both' }} />
        <span className="absolute size-28 rounded-full border border-brand/40" style={{ animation: 'seice-ring 1.9s cubic-bezier(0.2, 0.7, 0.3, 1) 0.45s both' }} />
        <span className="grid size-24 place-items-center rounded-full bg-white shadow-[0_0_0_6px_rgb(255_199_0/0.18),0_20px_50px_-12px_rgb(0_0_0/0.6)]" style={{ animation: 'seice-emblem 0.8s cubic-bezier(0.2, 0.9, 0.3, 1.2) both' }}>
          <img src="/emblema-seice.webp" alt="" className="size-[72px] object-contain" />
        </span>
      </div>

      <h1 className="relative mt-10 flex flex-wrap justify-center gap-x-[0.28em] text-center text-[2.6rem] leading-[1.1] font-extrabold tracking-[-0.04em] sm:text-[4rem]" aria-hidden="true">
        {headline.map((word, w) => (
          <span key={word} className={`inline-flex overflow-hidden pb-[0.08em] ${w === 2 ? 'text-brand' : ''}`}>
            {[...word].map((ch) => {
              const delay = 0.35 + letterIndex++ * 0.035;
              return (
                <span key={`${ch}-${letterIndex}`} className="inline-block" style={{ animation: `seice-rise 0.7s cubic-bezier(0.2, 0.8, 0.2, 1) ${delay}s both` } as CSSProperties}>
                  {ch}
                </span>
              );
            })}
          </span>
        ))}
      </h1>

      <p className="relative mt-4 text-lg font-bold text-white/95 sm:text-xl" style={{ animation: 'seice-fade-up 0.7s ease-out 1s both' }}>
        {user.name}
      </p>
      <p className="relative mt-1.5 text-sm text-nav-text first-letter:uppercase" style={{ animation: 'seice-fade-up 0.7s ease-out 1.2s both' }}>
        {greeting(now)} · {today}
      </p>

      <div className="absolute bottom-14 w-[min(280px,70vw)]" aria-hidden="true">
        <div className="h-[3px] overflow-hidden rounded-full bg-white/10">
          <div className="h-full origin-left rounded-full bg-brand" style={{ animation: `seice-progress ${timing.exitAt - 200}ms cubic-bezier(0.4, 0, 0.2, 1) 0.2s both` }} />
        </div>
        <p className="mt-3 text-center text-xs font-semibold text-nav-text/80" style={{ animation: 'seice-fade-up 0.6s ease-out 0.6s both' }}>
          Preparando seus quadros de horários…
        </p>
      </div>
    </div>
  );
}
