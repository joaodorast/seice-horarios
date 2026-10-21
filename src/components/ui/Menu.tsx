import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button, IconButton } from './Button';

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  tone?: 'default' | 'danger';
  disabled?: boolean;
}

/** Menu de ações secundárias, navegável por teclado. */
export function Menu({
  items,
  label = 'Mais ações',
  align = 'right',
  trigger,
  size = 'sm',
}: {
  items: MenuItem[];
  label?: string;
  align?: 'left' | 'right';
  /** Conteúdo de um botão com texto; sem ele, o gatilho é um ícone de reticências. */
  trigger?: ReactNode;
  size?: 'sm' | 'md';
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    rootRef.current?.querySelector<HTMLElement>('[role=menuitem]:not([disabled])')?.focus();
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  function onKeyDown(e: React.KeyboardEvent) {
    const nodes = Array.from(rootRef.current?.querySelectorAll<HTMLElement>('[role=menuitem]:not([disabled])') ?? []);
    const idx = nodes.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      nodes[(idx + 1) % nodes.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      nodes[(idx - 1 + nodes.length) % nodes.length]?.focus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      buttonRef.current?.focus();
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className="relative" onKeyDown={open ? onKeyDown : undefined} onClick={(e) => e.stopPropagation()}>
      {trigger ? (
        <Button
          ref={buttonRef}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={open ? menuId : undefined}
          onClick={() => setOpen((o) => !o)}
        >
          {trigger}
        </Button>
      ) : (
        <IconButton
          ref={buttonRef}
          label={label}
          size={size}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={open ? menuId : undefined}
          onClick={() => setOpen((o) => !o)}
        >
          <MoreHorizontal className="size-[18px]" />
        </IconButton>
      )}
      {open && (
        <div
          id={menuId}
          role="menu"
          className={cn(
            'absolute z-40 mt-1 min-w-48 animate-pop-in rounded-lg bg-surface p-1 shadow-pop',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm font-medium outline-none disabled:opacity-40 [&>svg]:size-4',
                item.tone === 'danger'
                  ? 'text-danger hover:bg-danger-soft focus:bg-danger-soft'
                  : 'text-ink-2 hover:bg-subtle focus:bg-subtle',
              )}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
