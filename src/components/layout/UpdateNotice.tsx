import { useEffect, useRef, useSyncExternalStore } from 'react';
import { useLocation } from 'react-router';
import { RefreshCw, Sparkles } from 'lucide-react';
import { updateStore } from '@/lib/resilience';

/**
 * Quando uma nova versão é publicada: mostra um aviso discreto e, na próxima troca de página,
 * carrega a versão nova automaticamente (o endereço é mantido, nada se perde).
 */
export function UpdateNotice() {
  const available = useSyncExternalStore(updateStore.subscribe, updateStore.get);
  const location = useLocation();
  // Página em que o aviso apareceu: a versão nova é carregada só quando a pessoa sair dela.
  const shownAt = useRef<string | null>(null);

  useEffect(() => {
    if (!available) return;
    if (shownAt.current === null) shownAt.current = location.key;
    else if (location.key !== shownAt.current) window.location.reload();
  }, [available, location.key]);

  if (!available) return null;
  return (
    <div role="status" className="no-print fixed bottom-5 left-1/2 z-[95] flex -translate-x-1/2 animate-toast-in items-center gap-3 rounded-full bg-nav py-2 pr-2 pl-4 text-sm text-white shadow-pop">
      <Sparkles className="size-4 text-brand" />
      <span className="font-semibold">Nova versão do SEICE disponível</span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="inline-flex h-8 items-center gap-1.5 rounded-full bg-brand px-3 text-[13px] font-bold text-ink hover:bg-brand-hover"
      >
        <RefreshCw className="size-3.5" /> Atualizar agora
      </button>
    </div>
  );
}
