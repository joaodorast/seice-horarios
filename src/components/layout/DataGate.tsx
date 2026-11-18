import type { ReactNode } from 'react';
import { Alert, Button, Card, ErrorState, LoadingBlock } from '@/components/ui';
import { errorMessage } from '@/api/client';

/** Padroniza os estados de carregamento e erro de comunicação de cada página. */
export function DataGate<T>({
  data,
  isLoading,
  error,
  onRetry,
  children,
  loadingLabel,
}: {
  data: T | undefined;
  isLoading: boolean;
  error: unknown;
  onRetry?: () => void;
  children: (data: T) => ReactNode;
  loadingLabel?: string;
}) {
  if (error && !data) {
    return (
      <Card>
        <ErrorState message={errorMessage(error)} onRetry={onRetry} />
      </Card>
    );
  }
  if (isLoading || !data) {
    return (
      <Card>
        <LoadingBlock label={loadingLabel} />
      </Card>
    );
  }
  return <>{error && <Alert tone="warning" title="Não foi possível atualizar estes dados" action={onRetry && <Button onClick={onRetry}>Tentar novamente</Button>}>{errorMessage(error)} Os dados abaixo são da última consulta concluída.</Alert>}{children(data)}</>;
}
