import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface SegmentOption<T extends string | number> {
  value: T;
  label: ReactNode;
  count?: number;
}

/** Controle segmentado para alternar visões ou filtros curtos (dias, turnos, situação). */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
  className,
  size = 'md',
  fill,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
  size?: 'sm' | 'md';
  /** Distribui as opções pela largura total (útil em telas estreitas). */
  fill?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('inline-flex max-w-full overflow-x-auto rounded-lg bg-ink/[0.06] p-1 scrollbar-thin', className)}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => {
              const idx = options.findIndex((x) => x.value === value);
              if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                e.preventDefault();
                onChange(options[(idx + 1) % options.length].value);
              } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                e.preventDefault();
                onChange(options[(idx - 1 + options.length) % options.length].value);
              }
            }}
            tabIndex={selected ? 0 : -1}
            className={cn(
              fill && 'flex-1 justify-center',
              'inline-flex items-center gap-1.5 rounded-md font-semibold whitespace-nowrap transition-[background-color,color,box-shadow] duration-150',
              size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-8 px-3 text-[13px]',
              selected ? 'bg-surface text-ink shadow-raise' : 'text-muted hover:text-ink',
            )}
          >
            {o.label}
            {o.count !== undefined && (
              <span className={cn('tabular rounded px-1 text-[11px]', selected ? 'bg-brand-soft text-brand-ink' : 'bg-ink/[0.06]')}>
                {o.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
