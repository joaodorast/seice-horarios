import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { matches } from '@/lib/text';
import { controlBase, controlState } from './Field';

export interface ComboOption {
  value: number;
  label: string;
  description?: string;
  disabled?: boolean;
  disabledReason?: string;
  leading?: ReactNode;
}

interface ComboboxProps {
  id?: string;
  options: ComboOption[];
  value: number | null;
  onChange: (value: number | null) => void;
  placeholder?: string;
  emptyText?: string;
  clearable?: boolean;
  disabled?: boolean;
  autoFocusTarget?: boolean;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
}

/**
 * Seleção pesquisável e acessível por teclado (setas, Enter, Esc, Home/End).
 * Ignora acentos na pesquisa para facilitar encontrar nomes como "Inês" digitando "ines".
 */
export function Combobox({
  id,
  options,
  value,
  onChange,
  placeholder = 'Selecione',
  emptyText = 'Nenhum resultado encontrado',
  clearable,
  disabled,
  autoFocusTarget,
  ...aria
}: ComboboxProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const listId = `${inputId}-list`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = options.find((o) => o.value === value) ?? null;
  const filtered = useMemo(
    () => options.filter((o) => matches([o.label, o.description], query)),
    [options, query],
  );

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  function openList() {
    if (disabled) return;
    setOpen(true);
    const idx = filtered.findIndex((o) => o.value === value);
    setActive(idx >= 0 ? idx : firstEnabled(filtered, 0, 1));
  }

  function close() {
    setOpen(false);
    setQuery('');
  }

  function choose(option: ComboOption) {
    if (option.disabled) return;
    onChange(option.value);
    close();
    inputRef.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) return openList();
      setActive((a) => firstEnabled(filtered, Math.min(a + 1, filtered.length - 1), 1, a));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) return openList();
      setActive((a) => firstEnabled(filtered, Math.max(a - 1, 0), -1, a));
    } else if (e.key === 'Home' && open) {
      e.preventDefault();
      setActive(firstEnabled(filtered, 0, 1));
    } else if (e.key === 'End' && open) {
      e.preventDefault();
      setActive(firstEnabled(filtered, filtered.length - 1, -1));
    } else if (e.key === 'Enter') {
      if (open && filtered[active]) {
        e.preventDefault();
        choose(filtered[active]);
      } else if (!open) {
        e.preventDefault();
        openList();
      }
    } else if (e.key === 'Escape') {
      if (open) {
        e.preventDefault();
        e.stopPropagation();
        close();
      }
    } else if (e.key === 'Tab') {
      close();
    }
  }

  const invalid = aria['aria-invalid'] === true;

  return (
    <div ref={rootRef} className="relative">
      <div className="relative">
        {selected?.leading && !open && (
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2">{selected.leading}</span>
        )}
        <input
          ref={inputRef}
          id={inputId}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && filtered[active] ? `${inputId}-opt-${filtered[active].value}` : undefined}
          aria-invalid={aria['aria-invalid']}
          aria-describedby={aria['aria-describedby']}
          autoComplete="off"
          data-autofocus={autoFocusTarget || undefined}
          disabled={disabled}
          value={open ? query : selected?.label ?? ''}
          placeholder={open ? 'Digite para pesquisar…' : placeholder}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            if (!open) setOpen(true);
          }}
          onClick={() => (open ? undefined : openList())}
          onFocus={(e) => e.target.select()}
          onKeyDown={onKeyDown}
          className={cn(
            controlBase,
            controlState(invalid),
            'h-10 pr-16 text-ellipsis',
            selected?.leading && !open ? 'pl-9' : 'pl-3',
          )}
        />
        <div className="absolute top-1/2 right-1.5 flex -translate-y-1/2 items-center">
          {clearable && selected && !disabled && (
            <button
              type="button"
              aria-label="Limpar seleção"
              onClick={() => {
                onChange(null);
                inputRef.current?.focus();
              }}
              className="grid size-7 place-items-center rounded text-muted hover:bg-ink/6 hover:text-ink"
            >
              <X className="size-3.5" />
            </button>
          )}
          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            disabled={disabled}
            onClick={() => (open ? close() : (openList(), inputRef.current?.focus()))}
            className="grid size-7 place-items-center rounded text-muted"
          >
            <ChevronDown className={cn('size-4 transition-transform', open && 'rotate-180')} />
          </button>
        </div>
      </div>

      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          className="scrollbar-thin absolute z-50 mt-1.5 max-h-64 w-full animate-pop-in overflow-auto rounded-lg bg-surface p-1 shadow-pop"
        >
          {filtered.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted">{emptyText}</li>}
          {filtered.map((option, index) => {
            const isSelected = option.value === value;
            return (
              <li
                key={option.value}
                id={`${inputId}-opt-${option.value}`}
                role="option"
                data-index={index}
                aria-selected={isSelected}
                aria-disabled={option.disabled || undefined}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => !option.disabled && setActive(index)}
                onClick={() => choose(option)}
                className={cn(
                  'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm',
                  option.disabled ? 'cursor-not-allowed opacity-55' : 'cursor-pointer',
                  index === active && !option.disabled && 'bg-subtle ring-1 ring-line',
                )}
              >
                {option.leading}
                <span className="min-w-0 flex-1">
                  <span className={cn('block truncate', isSelected ? 'font-semibold' : 'font-medium')}>{option.label}</span>
                  {(option.description || option.disabledReason) && (
                    <span className="block truncate text-xs text-muted">
                      {option.disabled ? option.disabledReason : option.description}
                    </span>
                  )}
                </span>
                {isSelected && <Check className="size-4 shrink-0 text-ink" aria-hidden="true" />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function firstEnabled(list: ComboOption[], start: number, step: 1 | -1, fallback = 0): number {
  for (let i = start; i >= 0 && i < list.length; i += step) {
    if (!list[i].disabled) return i;
  }
  return fallback;
}
