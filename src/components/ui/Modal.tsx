import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { IconButton } from './Button';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Impede fechar ao clicar fora (ex.: formulário com alterações). */
  dismissible?: boolean;
  initialFocus?: string;
}

const widths = { sm: 'sm:max-w-md', md: 'sm:max-w-xl', lg: 'sm:max-w-3xl', xl: 'sm:max-w-5xl' };

/**
 * Janela modal baseada em <dialog>: o navegador cuida do foco preso, da tecla Esc e da camada superior.
 * Em telas pequenas, vira uma folha que sobe da parte inferior.
 */
export function Modal({ open, onClose, title, description, children, footer, size = 'md', dismissible = true, initialFocus }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      document.documentElement.style.overflow = 'hidden';
      requestAnimationFrame(() => {
        const target = initialFocus ? dialog.querySelector<HTMLElement>(initialFocus) : null;
        (target ??
          dialog.querySelector<HTMLElement>('[data-autofocus]') ??
          dialog.querySelector<HTMLElement>('input:not([type=hidden]), select, textarea'))?.focus();
      });
    } else if (!open && dialog.open) {
      dialog.close();
    }
    return () => {
      if (!open) document.documentElement.style.overflow = '';
    };
  }, [open, initialFocus]);

  useEffect(() => () => void (document.documentElement.style.overflow = ''), []);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onCloseRef.current();
      }}
      onMouseDown={(e) => {
        if (dismissible && e.target === ref.current) onCloseRef.current();
      }}
      aria-labelledby={titleId}
      className={cn(
        'm-0 mt-auto w-full max-w-none bg-transparent p-0 backdrop:bg-ink/45 backdrop:backdrop-blur-[2px] open:animate-pop-in',
        'sm:m-auto sm:w-[calc(100%-2rem)]',
        widths[size],
      )}
    >
      {open && (
        <div className="flex max-h-[calc(92dvh/var(--ui-zoom,1))] flex-col rounded-t-2xl bg-surface shadow-pop sm:max-h-[calc(88dvh/var(--ui-zoom,1))] sm:rounded-xl">
          <header className="flex items-start gap-4 border-b border-line px-5 pt-5 pb-4 sm:px-6">
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="text-lg font-bold tracking-[-0.015em] text-ink">
                {title}
              </h2>
              {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
            </div>
            <IconButton label="Fechar" size="sm" onClick={() => onCloseRef.current()} className="-mt-1 -mr-2">
              <X className="size-[18px]" />
            </IconButton>
          </header>
          <div className="scrollbar-thin flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
          {footer && (
            <footer className="flex flex-col-reverse gap-2 border-t border-line bg-subtle/60 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-end sm:rounded-b-xl sm:px-6">
              {footer}
            </footer>
          )}
        </div>
      )}
    </dialog>
  );
}
