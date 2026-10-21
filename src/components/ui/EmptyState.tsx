import type { ReactNode } from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from './Button';

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  compact,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn('flex flex-col items-center text-center', compact ? 'px-4 py-8' : 'px-6 py-14', className)}>
      {icon && (
        <div className="mb-4 grid size-12 place-items-center rounded-xl bg-subtle text-muted ring-1 ring-line [&>svg]:size-6">
          {icon}
        </div>
      )}
      <h3 className="text-[15px] font-bold text-ink">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted text-pretty">{description}</p>}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry, className }: { message: string; onRetry?: () => void; className?: string }) {
  return (
    <div role="alert" className={cn('flex flex-col items-center px-6 py-14 text-center', className)}>
      <div className="mb-4 grid size-12 place-items-center rounded-xl bg-danger-soft text-danger">
        <AlertTriangle className="size-6" />
      </div>
      <h3 className="text-[15px] font-bold text-ink">Não foi possível carregar os dados</h3>
      <p className="mt-1 max-w-md text-sm text-muted text-pretty">{message}</p>
      {onRetry && (
        <Button className="mt-5" icon={<RotateCw className="size-4" />} onClick={onRetry}>
          Tentar novamente
        </Button>
      )}
    </div>
  );
}
