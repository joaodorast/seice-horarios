import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useLocation } from 'react-router';
import { Check, RefreshCw, Sparkles } from 'lucide-react';
import { APP_VERSION, updateStore } from '@/lib/resilience';
import { dismissUpdateNews, hasUpdateNews, rememberUpdate, updateNews } from '@/lib/updateNews';
import { Button, Modal } from '@/components/ui';

/** Mantém a página atual e apresenta as novidades depois de carregar a versão nova. */
export function UpdateNotice() {
  const available = useSyncExternalStore(updateStore.subscribe, updateStore.get);
  const location = useLocation();
  const shownAt = useRef<string | null>(null);
  const [newsOpen, setNewsOpen] = useState(false);
  useEffect(() => {
    try {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
      setNewsOpen(hasUpdateNews(sessionStorage, APP_VERSION, navigation?.type === 'reload'));
    } catch { /* A atualização funciona mesmo sem armazenamento. */ }
  }, []);
  function update() {
    try { rememberUpdate(sessionStorage, APP_VERSION); } catch { /* Armazenamento indisponível. */ }
    window.location.reload();
  }
  function closeNews() {
    try { dismissUpdateNews(sessionStorage); } catch { /* Armazenamento indisponível. */ }
    setNewsOpen(false);
  }
  useEffect(() => {
    if (!available) return;
    if (shownAt.current === null) shownAt.current = location.key;
    else if (location.key !== shownAt.current) update();
  }, [available, location.key]);
  return <>
    {available && <div role="status" className="no-print fixed bottom-5 left-1/2 z-[95] flex w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 animate-toast-in flex-wrap items-center justify-center gap-3 rounded-2xl bg-nav p-3 text-base text-white shadow-pop">
      <Sparkles className="size-5 shrink-0 text-brand" />
      <span className="font-semibold">Tem novidade no SEICE!</span>
      <button type="button" onClick={update} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand px-4 text-base font-bold text-ink hover:bg-brand-hover"><RefreshCw className="size-4" />Atualizar agora</button>
    </div>}
    <Modal open={newsOpen} onClose={closeNews} size="lg"
      title={<span className="text-2xl">Pronto, seu SEICE está atualizado!</span>}
      description={<span className="text-base leading-relaxed">Fizemos algumas melhorias para facilitar o seu dia. Veja o que mudou:</span>}
      footer={<Button variant="primary" size="lg" onClick={closeNews} data-autofocus>Entendi, continuar</Button>}>
      <div className="mb-5 flex items-center gap-3 rounded-2xl bg-brand-soft p-5"><span className="grid size-12 shrink-0 place-items-center rounded-xl bg-brand"><Sparkles className="size-6" /></span><p className="text-lg font-bold">Mais clareza para cuidar dos horários da escola.</p></div>
      <ul className="space-y-4">{updateNews.map((item)=><li key={item.title} className="flex gap-3 rounded-xl border border-line p-4 sm:p-5"><Check className="mt-1 size-5 shrink-0 text-success" /><div><h3 className="text-lg font-bold">{item.title}</h3><p className="mt-1 text-base leading-relaxed text-ink-2">{item.description}</p></div></li>)}</ul>
    </Modal>
  </>;
}
