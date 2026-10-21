import { useRouteError } from 'react-router';
import { Compass, RotateCw } from 'lucide-react';
import { Page } from '@/components/layout/Page';
import { Button, ButtonLink, Card, EmptyState } from '@/components/ui';

export function NotFoundPage() {
  return (
    <Page title="Página não encontrada" breadcrumbs={[{ label: 'Início', to: '/' }, { label: 'Página não encontrada' }]}>
      <Card>
        <EmptyState
          icon={<Compass />}
          title="Este endereço não existe"
          description="Verifique o endereço digitado ou use o menu para navegar."
          action={<ButtonLink variant="primary" to="/">Ir para o dashboard</ButtonLink>}
        />
      </Card>
    </Page>
  );
}

/** Exibida se uma tela falhar inesperadamente; evita mostrar detalhes técnicos ao usuário. */
export function RouteErrorPage() {
  const error = useRouteError();
  if (import.meta.env.DEV) console.error(error);
  return (
    <div className="grid min-h-dvh place-items-center bg-canvas p-6">
      <Card className="w-full max-w-md">
        <EmptyState
          icon={<RotateCw />}
          title="Algo não saiu como esperado"
          description="A tela não pôde ser exibida. Recarregue a página; seus dados salvos não foram afetados."
          action={
            <>
              <Button variant="primary" onClick={() => window.location.reload()}>
                Recarregar
              </Button>
              <Button onClick={() => (window.location.href = '/')}>Ir para o início</Button>
            </>
          }
        />
      </Card>
    </div>
  );
}
