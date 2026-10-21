import { cn } from '@/lib/cn';

export function Spinner({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={cn('animate-spin', className)}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-ink/[0.06]', className)} aria-hidden="true" />;
}

export function LoadingBlock({ label = 'Carregando…', className }: { label?: string; className?: string }) {
  return (
    <div role="status" className={cn('flex items-center justify-center gap-3 py-16 text-sm text-muted', className)}>
      <Spinner />
      <span>{label}</span>
    </div>
  );
}
