import type { ReactNode } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';

export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = 'Cancelar',
  tone = 'danger',
  loading,
  onConfirm,
  onClose,
  extraAction,
  confirmDisabled,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  extraAction?: ReactNode;
  confirmDisabled?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size={extraAction ? 'md' : 'sm'}
      footer={
        <>
          <Button onClick={onClose} disabled={loading} data-autofocus>
            {cancelLabel}
          </Button>
          {extraAction}
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} loading={loading} disabled={confirmDisabled} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm leading-relaxed text-ink-2">{children}</div>
    </Modal>
  );
}
