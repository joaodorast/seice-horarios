import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router';
import { ChevronRight, Menu as MenuIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { IconButton } from '@/components/ui';
import { useLayout } from './AppLayout';

export interface Crumb {
  label: string;
  to?: string;
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
}

export function Page({ title, description, breadcrumbs, actions, children, width = 'default', titleAddon }: PageProps) {
  const { openNav } = useLayout();

  useEffect(() => {
    document.title = `${title} · SEICE`;
  }, [title]);

  return (
    <>
      <header className="no-print sticky top-0 z-30 border-b border-line bg-surface/92 backdrop-blur-md">
        <div className={cn('mx-auto flex flex-col gap-3 px-4 py-4 sm:px-6 lg:px-8', width === 'default' ? 'max-w-[1240px]' : 'max-w-[1600px]')}>
          <div className="flex items-center gap-2">
            <IconButton label="Abrir menu" className="-ml-2 lg:hidden" onClick={openNav}>
              <MenuIcon className="size-5" />
            </IconButton>
            <img src="/emblema-seice.png" alt="" className="size-7 object-contain lg:hidden" />
            {breadcrumbs && breadcrumbs.length > 0 && (
              <nav aria-label="Você está em" className="min-w-0">
                <ol className="flex min-w-0 items-center gap-1 text-[13px] text-muted">
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
          </div>
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-[1.625rem] leading-tight font-extrabold tracking-[-0.025em] text-ink">{title}</h1>
                {titleAddon}
              </div>
              {description && <p className="mt-1 max-w-3xl text-sm text-muted text-pretty">{description}</p>}
            </div>
            {actions && <div className="flex flex-wrap items-center gap-2 md:shrink-0 md:flex-nowrap md:justify-end">{actions}</div>}
          </div>
        </div>
      </header>
      <main
        id="conteudo"
        tabIndex={-1}
        className={cn(
          'mx-auto w-full flex-1 px-4 py-6 outline-none sm:px-6 lg:px-8 lg:py-8',
          width === 'default' ? 'max-w-[1240px]' : 'max-w-[1600px]',
        )}
      >
        {children}
      </main>
    </>
  );
}
