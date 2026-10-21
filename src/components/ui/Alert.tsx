import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { cn } from '@/lib/cn';

type Tone = 'info' | 'warning' | 'danger' | 'success';

const styles: Record<Tone, { box: string; icon: ReactNode }> = {
  info: { box: 'bg-info-soft text-[#2f3778] border-info/25', icon: <Info className="size-[18px] text-info" /> },
  warning: { box: 'bg-warning-soft text-[#6b3a05] border-warning/25', icon: <AlertTriangle className="size-[18px] text-warning" /> },
  danger: { box: 'bg-danger-soft text-[#7d1d1d] border-danger/25', icon: <XCircle className="size-[18px] text-danger" /> },
  success: { box: 'bg-success-soft text-[#14532d] border-success/25', icon: <CheckCircle2 className="size-[18px] text-success" /> },
};

export function Alert({
  tone = 'info',
  title,
  children,
  action,
  className,
}: {
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn('flex gap-3 rounded-lg border px-4 py-3 text-sm', styles[tone].box, className)}
    >
      <span className="mt-px shrink-0">{styles[tone].icon}</span>
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title && 'mt-0.5', 'opacity-90')}>{children}</div>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  );
}
