import { useSyncExternalStore } from 'react';
import { AlertTriangle } from 'lucide-react';
import { failureNotices } from '@/lib/failureNotice';
import { Modal } from './Modal';
import { Button } from './Button';

/** O aviso fica na camada dos diálogos, inclusive quando o erro vem de outro modal. */
export function FailureDialog() {
  const notices = useSyncExternalStore(failureNotices.subscribe, failureNotices.get);
  const notice = notices[0];
  return <Modal open={!!notice} onClose={failureNotices.dismiss} dismissible={false} size="md"
    title={<span className="flex items-center gap-3 text-xl"><AlertTriangle className="size-6 shrink-0 text-warning" />{notice?.title}</span>}
    footer={<Button variant="primary" size="lg" onClick={failureNotices.dismiss}>Entendi, voltar à tela</Button>}>
    {notice && <div className="space-y-5 text-base leading-relaxed">
      <p>{notice.message}</p>
      {!!notice.details?.length && <ul className="list-disc space-y-2 pl-5">{notice.details.filter(text => text !== notice.message).map(text => <li key={text}>{text}</li>)}</ul>}
      <div className="rounded-xl border border-line bg-subtle p-4"><h3 className="font-bold">O que fazer agora</h3><p className="mt-2 text-ink-2">{notice.nextStep}</p></div>
    </div>}
  </Modal>;
}
