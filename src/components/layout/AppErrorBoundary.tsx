import { Component, type ReactNode } from 'react';
import { RotateCw } from 'lucide-react';
import { isChunkLoadError, reloadOnce } from '@/lib/resilience';

/**
 * Última barreira contra a tela em branco: se qualquer parte do sistema falhar ao ser exibida,
 * mostra uma mensagem amigável com a opção de recarregar (ou recarrega sozinho após uma atualização).
 */
export class AppErrorBoundary extends Component<{ children: ReactNode }, { error: unknown }> {
  state = { error: null as unknown };

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  componentDidCatch(error: unknown) {
    if (isChunkLoadError(error)) reloadOnce();
    else console.error('[SEICE] Erro inesperado na interface:', error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return <ErrorScreen updating={isChunkLoadError(this.state.error)} />;
  }
}

export function ErrorScreen({ updating }: { updating?: boolean }) {
  return (
    <div className="grid min-h-app place-items-center bg-nav px-6 text-center text-white">
      <div className="max-w-sm">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-white">
          <img src="/emblema-seice.webp" alt="" className="size-12 object-contain" />
        </span>
        <h1 className="mt-6 text-2xl font-extrabold tracking-[-0.02em]">{updating ? 'Atualizando o sistema…' : 'Algo não saiu como esperado'}</h1>
        <p className="mt-2 text-sm text-nav-text">
          {updating
            ? 'Uma nova versão do SEICE foi publicada. A página será recarregada para usá-la.'
            : 'Recarregue a página para continuar. Seus dados salvos não foram afetados.'}
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-6 inline-flex h-11 items-center gap-2 rounded-lg bg-brand px-5 text-sm font-bold text-ink hover:bg-brand-hover"
        >
          <RotateCw className="size-4" /> Recarregar
        </button>
      </div>
    </div>
  );
}
