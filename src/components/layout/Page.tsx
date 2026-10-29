import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router';
import { ChevronRight, CircleHelp, Menu as MenuIcon, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { IconButton } from '@/components/ui';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useLayout } from './AppLayout';

export interface Crumb {
  label: string;
  to?: string;
}

/** Passo do guia "Como usar esta tela": um título curto e uma explicação em linguagem simples. */
export interface GuideStep {
  title: string;
  text: ReactNode;
}

interface PageProps {
  title: string;
  description?: ReactNode;
  breadcrumbs?: Crumb[];
  actions?: ReactNode;
  children: ReactNode;
  /** Largura do conteúdo: "default" para listas/formulários, "wide" para grades. */
  width?: 'default' | 'wide';
  titleAddon?: ReactNode;
  /** Guia da tela: aparece aberto na primeira visita e pode ser reaberto pelo botão "Como usar". */
  guide?: GuideStep[];
}

export function Page({ title, description, breadcrumbs, actions, children, width = 'default', titleAddon, guide }: PageProps) {
  const { openNav } = useLayout();
  const [guideHidden, setGuideHidden] = useLocalStorage(`seice:guia-oculto:${title}`, false);
  const showGuide = Boolean(guide?.length) && !guideHidden;

  useEffect(() => {
    document.title = `${title} · SEICE`;
  }, [title]);

  return (
    <>
      <header className="no-print sticky top-0 z-30 border-b border-line bg-surface/92 backdrop-blur-md short:static short:bg-surface short:backdrop-blur-none">
        <div className={cn('mx-auto flex flex-col gap-3 px-4 py-4 short:gap-2 short:py-3 sm:px-6 lg:px-8', width === 'default' ? 'max-w-[1240px]' : 'max-w-[1600px]')}>
          <div className="flex items-center gap-2">
            <IconButton label="Abrir menu" className="-ml-2 lg:hidden" onClick={openNav}>
              <MenuIcon className="size-5" />
            </IconButton>
            <img src="/emblema-seice.webp" alt="" className="size-7 object-contain lg:hidden" />
            {breadcrumbs && breadcrumbs.length > 0 && (
              <nav aria-label="Você está em" className="min-w-0">
                <ol className="flex min-w-0 items-center gap-1 text-[13.5px] text-muted">
                  {breadcrumbs.map((c, i) => (
                    <li key={`${c.label}-${i}`} className="flex min-w-0 items-center gap-1">
                      {i > 0 && <ChevronRight className="size-3.5 shrink-0 text-soft" aria-hidden="true" />}
                      {c.to ? (
                        <Link to={c.to} className="truncate rounded font-medium hover:text-ink hover:underline underline-offset-2">
                          {c.label}
                        </Link>
                      ) : (
                        <span className="truncate font-medium text-ink-2" aria-current="page">
                          {c.label}
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              </nav>
            )}
            {guide && guide.length > 0 && (
              <button
                type="button"
                onClick={() => setGuideHidden(!guideHidden)}
                aria-expanded={showGuide}
                aria-controls="guia-da-tela"
                className={cn(
                  'ml-auto inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink',
                  showGuide ? 'bg-ink text-white hover:bg-ink-2' : 'bg-brand-soft text-brand-ink hover:bg-brand/30',
                )}
              >
                <CircleHelp className="size-4" />
                {showGuide ? 'Ocultar ajuda' : 'Como usar'}
              </button>
            )}
          </div>
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="font-display text-[1.75rem] leading-tight font-semibold tracking-[-0.02em] text-ink sm:text-[2rem] short:sm:text-[1.75rem]">{title}</h1>
                {titleAddon}
              </div>
              {description && <p className="mt-1.5 max-w-3xl text-[15.5px] leading-relaxed text-muted text-pretty short:mt-1 short:leading-snug tiny:line-clamp-2 xl:max-w-4xl">{description}</p>}
            </div>
            {actions && <div className="flex flex-wrap items-center gap-2 md:shrink-0 md:flex-nowrap md:justify-end">{actions}</div>}
          </div>
        </div>
      </header>
      <main
        id="conteudo"
        tabIndex={-1}
        className={cn(
          'mx-auto w-full flex-1 px-4 py-6 outline-none sm:px-6 lg:px-8 lg:py-8 short:py-4 short:lg:py-5',
          width === 'default' ? 'max-w-[1240px]' : 'max-w-[1600px]',
        )}
      >
        {showGuide && guide && <Guide steps={guide} onClose={() => setGuideHidden(true)} />}
        {children}
      </main>
    </>
  );
}

/** Guia "Como usar esta tela": passos numerados em linguagem simples. */
function Guide({ steps, onClose }: { steps: GuideStep[]; onClose: () => void }) {
  return (
    <section id="guia-da-tela" aria-label="Como usar esta tela" className="no-print relative mb-6 animate-pop-in rounded-2xl border border-brand/45 bg-brand-soft/60 p-5 sm:p-6 short:mb-4 short:p-4 short:sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 font-display text-[1.1875rem] font-semibold text-ink">
          <CircleHelp className="size-5 text-brand-ink" /> Como usar esta tela
        </p>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13.5px] font-semibold text-ink-2 transition-colors hover:bg-ink/6 hover:text-ink"
        >
          <X className="size-4" /> Entendi
        </button>
      </div>
      <ol className="grid gap-3 md:grid-cols-3">
        {steps.map((step, i) => (
          <li key={step.title} className="flex gap-3 rounded-xl bg-surface p-4 shadow-raise">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-ink text-sm font-extrabold text-brand" aria-hidden="true">
              {i + 1}
            </span>
            <span>
              <span className="block text-[15px] font-bold text-ink">{step.title}</span>
              <span className="mt-1 block text-[14.5px] leading-relaxed text-ink-2">{step.text}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
