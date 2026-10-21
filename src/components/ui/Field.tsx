import {
  cloneElement,
  forwardRef,
  isValidElement,
  useId,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import { cn } from '@/lib/cn';

export const controlBase =
  'w-full rounded-md border bg-surface text-sm text-ink placeholder:text-soft transition-[border-color,box-shadow] duration-150 outline-none disabled:cursor-not-allowed disabled:bg-subtle disabled:text-muted';
export const controlState = (invalid?: boolean) =>
  invalid
    ? 'border-danger focus:border-danger focus:ring-3 focus:ring-danger/15'
    : 'border-line-strong hover:border-soft focus:border-ink focus:ring-3 focus:ring-brand/45';

interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  optional?: boolean;
  className?: string;
  children: ReactElement<{ id?: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string }>;
}

/** Rótulo, ajuda e mensagem de erro ligados ao controle por id e aria-describedby. */
export function Field({ label, hint, error, required, optional, className, children }: FieldProps) {
  const autoId = useId();
  const id = children.props.id ?? autoId;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="flex items-baseline gap-1.5 text-[13px] font-semibold text-ink-2">
        {label}
        {required && (
          <span className="text-danger" aria-hidden="true">
            *
          </span>
        )}
        {optional && <span className="text-xs font-medium text-soft">opcional</span>}
      </label>
      {isValidElement(children) &&
        cloneElement(children, { id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy })}
      {error ? (
        <p id={errorId} className="text-[13px] font-medium text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...rest },
  ref,
) {
  const invalid = rest['aria-invalid'] === true || rest['aria-invalid'] === 'true';
  return <input ref={ref} className={cn(controlBase, controlState(invalid), 'h-10 px-3', className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, rows = 3, ...rest },
  ref,
) {
  const invalid = rest['aria-invalid'] === true || rest['aria-invalid'] === 'true';
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(controlBase, controlState(invalid), 'resize-y px-3 py-2.5 leading-relaxed', className)}
      {...rest}
    />
  );
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...rest },
  ref,
) {
  const invalid = rest['aria-invalid'] === true || rest['aria-invalid'] === 'true';
  return (
    <div className="relative">
      <select
        ref={ref}
        className={cn(controlBase, controlState(invalid), 'h-10 appearance-none pr-9 pl-3', className)}
        {...rest}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
    </div>
  );
});

export function SearchInput({
  value,
  onChange,
  placeholder = 'Pesquisar',
  label = 'Pesquisar',
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
}) {
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
      <input
        type="search"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(controlBase, controlState(false), 'h-10 pr-9 pl-9 [&::-webkit-search-cancel-button]:hidden')}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Limpar pesquisa"
          className="absolute top-1/2 right-2 grid size-6 -translate-y-1/2 place-items-center rounded text-muted hover:bg-ink/6 hover:text-ink"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
  id,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  id?: string;
}) {
  const autoId = useId();
  const switchId = id ?? autoId;
  return (
    <div className="flex items-start gap-3">
      <button
        id={switchId}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 inline-flex h-6 w-10 shrink-0 items-center rounded-pill transition-colors duration-150 disabled:opacity-50',
          checked ? 'bg-ink' : 'bg-line-strong',
        )}
      >
        <span
          className={cn(
            'inline-block size-[18px] rounded-full bg-white shadow-sm transition-transform duration-150',
            checked ? 'translate-x-[19px] bg-brand' : 'translate-x-[3px]',
          )}
        />
      </button>
      <label htmlFor={switchId} className="cursor-pointer select-none">
        <span className="block text-sm font-semibold text-ink">{label}</span>
        {description && <span className="block text-[13px] text-muted">{description}</span>}
      </label>
    </div>
  );
}
