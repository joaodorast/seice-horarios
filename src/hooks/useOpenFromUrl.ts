import { useEffect } from 'react';
import { useSearchParams } from 'react-router';

/** Parâmetro de endereço que pede para abrir o formulário de novo cadastro ao chegar na página. */
export const NEW_PARAM = 'novo';

/**
 * Abre o formulário de novo cadastro quando a página é aberta com `?novo=1` (ex.: atalhos do Dashboard)
 * e remove o parâmetro, para que voltar ou recarregar a página não abra o formulário de novo.
 */
export function useOpenFromUrl(open: () => void) {
  const [params, setParams] = useSearchParams();
  const requested = params.get(NEW_PARAM) === '1';

  useEffect(() => {
    if (!requested) return;
    open();
    setParams(
      (p) => {
        p.delete(NEW_PARAM);
        return p;
      },
      { replace: true },
    );
  }, [requested, open, setParams]);
}
