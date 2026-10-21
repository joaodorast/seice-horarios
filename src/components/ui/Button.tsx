import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router';
import { cn } from '@/lib/cn';
import { Spinner } from './Spinner';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dark';
type Size = 'sm' | 'md' | 'lg';

const base =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold select-none transition-[background-color,border-color,color,box-shadow,transform] duration-150 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2';

const variants: Record<Variant, string> = {
  primary: 'bg-brand text-ink hover:bg-brand-hover shadow-[inset_0_-1px_0_rgb(0_0_0/0.12)] focus-visible:outline-ink',
  secondary: 'bg-surface text-ink border border-line-strong hover:bg-subtle hover:border-soft focus-visible:outline-ink',
  ghost: 'text-ink-2 hover:bg-ink/5 hover:text-ink focus-visible:outline-ink',
  danger: 'bg-danger text-white hover:bg-[#ab2828] focus-visible:outline-danger',
  dark: 'bg-ink text-white hover:bg-ink-2 focus-visible:outline-ink',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] rounded-md',
  md: 'h-10 px-4 text-sm rounded-md',
  lg: 'h-12 px-5 text-[15px] rounded-lg',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading, icon, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(base, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner size={16} /> : icon}
      {children}
    </button>
  );
});

export function ButtonLink({
  variant = 'secondary',
  size = 'md',
  icon,
  className,
  children,
  ...rest
}: LinkProps & { variant?: Variant; size?: Size; icon?: ReactNode }) {
  return (
    <Link className={cn(base, variants[variant], sizes[size], className)} {...rest}>
      {icon}
      {children}
    </Link>
  );
}

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  size?: 'sm' | 'md';
  tone?: 'default' | 'danger' | 'onDark';
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, size = 'md', tone = 'default', className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-md transition-colors duration-150 disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-1',
        size === 'sm' ? 'size-8' : 'size-10',
        tone === 'default' && 'text-muted hover:bg-ink/6 hover:text-ink focus-visible:outline-ink',
        tone === 'danger' && 'text-muted hover:bg-danger-soft hover:text-danger focus-visible:outline-danger',
        tone === 'onDark' && 'text-nav-text hover:bg-white/8 hover:text-white focus-visible:outline-brand',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
});
