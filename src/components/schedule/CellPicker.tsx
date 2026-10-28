import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Eraser, Plus, Search } from 'lucide-react';
import { cn } from '@/lib/cn';
import { matches } from '@/lib/text';

export interface PickerOption {
  value: number;
  label: string;
  /** Texto curto ao lado do nome (ex.: "ocupado na 7º A"). */
  hint?: string;
  disabled?: boolean;
  /** Classe de cor da bolinha (ex.: cor da disciplina). */
  dot?: string;
}

export interface PickerGroup {
  label: string;
  options: PickerOption[];
}

/**
 * Lista de escolha das células do "Montar quadro": um botão compacto que abre um painel com busca,
 * grupos e motivos de bloqueio. O painel fica num portal para não ser cortado pela rolagem da grade.
 */
export function CellPicker({
  label,
  placeholder,
  value,
  onChange,
  groups,
  strong,
  invalid,
}: {
  label: string;
  placeholder: string;
  value: number | null;
  onChange: (v: number | null) => void;
  groups: PickerGroup[];
  strong?: boolean;
  invalid?: boolean;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; maxHeight: number; up: boolean } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const all = groups.flatMap((g) => g.options);
  const selected = all.find((o) => o.value === value);
  const visible = useMemo(
    () => groups.map((g) => ({ ...g, options: g.options.filter((o) => matches([o.label], query)) })).filter((g) => g.options.length > 0),
    [groups, query],
  );
  const flat = visible.flatMap((g) => g.options);

  // Posição do painel: abaixo do botão ou acima, se faltar espaço. Compensa o zoom do texto (CSS zoom no <html>).
  const place = () => {
    const el = triggerRef.current;
    if (!el) return;
    const zoom = parseFloat(getComputedStyle(document.documentElement).zoom) || 1;
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight;
    const below = vh - r.bottom;
    const up = below < 300 && r.top > below;
    const width = Math.max(r.width, 260);
    const left = Math.min(r.left, window.innerWidth - width * zoom - 8);
    setPos({
      top: (up ? r.top - 6 : r.bottom + 6) / zoom,
      left: Math.max(8, left) / zoom,
      width,
      maxHeight: Math.min(360, (up ? r.top : below) / zoom - 16),
      up,
    });
  };

  useLayoutEffect(() => {
    if (open) place();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!panelRef.current?.contains(t) && !triggerRef.current?.contains(t)) close(false);
    };
    const onMove = () => place();
    document.addEventListener('mousedown', onDown);
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
    };
  }, [open]);

  useEffect(() => {
    if (open) listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  function openPanel() {
    setQuery('');
    const idx = flatOf(groups).findIndex((o) => o.value === value);
    setActive(idx >= 0 ? idx : nextEnabled(flatOf(groups), 0, 1));
    setOpen(true);
  }

  function close(refocus = true) {
    setOpen(false);
    setQuery('');
    if (refocus) triggerRef.current?.focus();
  }

  function choose(o: PickerOption | null) {
    if (o?.disabled) return;
    onChange(o ? o.value : null);
    close();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => nextEnabled(flat, Math.min(a + 1, flat.length - 1), 1, a));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => nextEnabled(flat, Math.max(a - 1, 0), -1, a));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (flat[active]) choose(flat[active]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === 'Tab') {
      close(false);
    }
  }

  let index = -1;
  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={selected ? `${label}: ${selected.label}` : label}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? close() : openPanel())}
        onKeyDown={(e) => {
          if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            e.preventDefault();
            openPanel();
          }
        }}
        className={cn(
          'flex h-8 w-full min-w-0 items-center gap-1.5 rounded-md border px-2 text-left text-[13px] transition-[border-color,box-shadow,background-color] outline-none focus-visible:ring-2 focus-visible:ring-brand/60',
          selected
            ? 'border-line-strong bg-surface text-ink shadow-[0_1px_0_rgb(29_32_37/0.06)] hover:border-ink/50'
            : 'border-dashed border-line-strong bg-surface/60 text-ink-2 hover:border-ink/50 hover:bg-surface hover:text-ink',
          open && 'border-ink ring-2 ring-brand/50',
          invalid && 'border-danger bg-danger-soft/40',
        )}
      >
        {selected ? (
          <>
            {selected.dot && <span className={cn('size-2 shrink-0 rounded-full', selected.dot)} />}
            <span className={cn('min-w-0 flex-1 truncate', strong ? 'font-bold' : 'font-medium')}>{selected.label}</span>
          </>
        ) : (
          <>
            <Plus className="size-3.5 shrink-0" />
            <span className="min-w-0 flex-1 truncate font-medium">{placeholder}</span>
          </>
        )}
        <ChevronDown className={cn('size-3.5 shrink-0 text-ink-2 transition-transform', open && 'rotate-180')} />
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label={label}
            onKeyDown={onKeyDown}
            style={{ top: pos.top, left: pos.left, width: pos.width, maxHeight: pos.maxHeight, transform: pos.up ? 'translateY(-100%)' : undefined }}
            className="fixed z-[80] flex animate-pop-in flex-col overflow-hidden rounded-xl bg-surface shadow-pop ring-1 ring-line-strong"
          >
            <div className="border-b border-line bg-subtle px-3 pt-2.5 pb-2">
              <p className="mb-1.5 truncate text-[11px] font-bold tracking-wide text-ink-2 uppercase">{label}</p>
              <label className="flex h-9 items-center gap-2 rounded-lg bg-surface px-2.5 ring-1 ring-line-strong focus-within:ring-2 focus-within:ring-ink">
                <Search className="size-4 shrink-0 text-ink-2" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setActive(0);
                  }}
                  placeholder="Pesquisar…"
                  aria-controls={`${id}-list`}
                  aria-activedescendant={flat[active] ? `${id}-${flat[active].value}` : undefined}
                  className="min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-muted"
                />
              </label>
            </div>
            <div ref={listRef} id={`${id}-list`} role="listbox" className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-1.5">
              {visible.length === 0 && <p className="px-3 py-6 text-center text-[13px] text-muted">Nada encontrado</p>}
              {visible.map((g) => (
                <div key={g.label} role="group" aria-label={g.label} className="mb-1 last:mb-0">
                  <p className="px-2.5 pt-2 pb-1 text-[11px] font-bold tracking-wide text-ink-2 uppercase">{g.label}</p>
                  {g.options.map((o) => {
                    index++;
                    const i = index;
                    const isSelected = o.value === value;
                    return (
                      <div
                        key={o.value}
                        id={`${id}-${o.value}`}
                        role="option"
                        data-index={i}
                        aria-selected={isSelected}
                        aria-disabled={o.disabled || undefined}
                        onMouseDown={(e) => e.preventDefault()}
                        onMouseEnter={() => !o.disabled && setActive(i)}
                        onClick={() => choose(o)}
                        className={cn(
                          'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[14px]',
                          o.disabled ? 'cursor-not-allowed text-muted' : 'cursor-pointer text-ink',
                          i === active && !o.disabled && 'bg-brand-soft ring-1 ring-brand/50',
                        )}
                      >
                        {o.dot ? <span className={cn('size-2.5 shrink-0 rounded-full', o.dot)} /> : null}
                        <span className={cn('min-w-0 flex-1 truncate', isSelected ? 'font-bold' : 'font-medium')}>{o.label}</span>
                        {o.hint && <span className={cn('shrink-0 text-xs font-semibold', o.disabled ? 'text-danger/80' : 'text-ink-2')}>{o.hint}</span>}
                        {isSelected && <Check className="size-4 shrink-0" aria-hidden="true" />}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            {selected && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(null)}
                className="flex items-center gap-2 border-t border-line px-4 py-2.5 text-left text-[13px] font-semibold text-ink-2 hover:bg-subtle hover:text-danger"
              >
                <Eraser className="size-4" /> Deixar em branco
              </button>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}

const flatOf = (groups: PickerGroup[]) => groups.flatMap((g) => g.options);

function nextEnabled(list: PickerOption[], start: number, step: 1 | -1, fallback = 0): number {
  for (let i = start; i >= 0 && i < list.length; i += step) if (!list[i].disabled) return i;
  return fallback;
}
