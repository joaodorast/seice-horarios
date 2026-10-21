import { useEffect, useState } from 'react';
import { Eye, EyeOff, LockKeyhole } from 'lucide-react';
import { Alert, Button, Field, Input } from '@/components/ui';
import { useLogin } from '@/api/auth';
import { ApiError, errorMessage } from '@/api/client';

export function LoginPage({ expired }: { expired?: boolean }) {
  const login = useLogin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Entrar · SEICE';
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) return setError('Informe o e-mail e a senha.');
    try {
      await login.mutateAsync({ email, password });
    } catch (err) {
      setError(err instanceof ApiError && err.status !== 0 && err.status < 500 ? err.message : errorMessage(err));
      setPassword('');
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-nav px-4 py-10">
      <main className="w-full max-w-[400px]">
        <div className="mb-8 flex justify-center">
          <img src="/logo-seice.png" alt="Colégio SEICE — Sistema de Ensino Integrado de Campos Elíseos" className="h-auto w-[240px]" />
        </div>
        <div className="rounded-xl bg-surface p-6 shadow-pop sm:p-8">
          <div className="mb-6 flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-lg bg-brand-soft text-brand-ink">
              <LockKeyhole className="size-5" />
            </span>
            <div>
              <h1 className="text-lg font-extrabold tracking-[-0.015em] text-ink">Gestão de horários</h1>
              <p className="text-[13px] text-muted">Entre com seu e-mail e senha.</p>
            </div>
          </div>

          {expired && !error && (
            <Alert tone="info" className="mb-4">
              Sua sessão expirou. Entre novamente para continuar.
            </Alert>
          )}
          {error && (
            <Alert tone="danger" className="mb-4">
              {error}
            </Alert>
          )}

          <form onSubmit={submit} noValidate className="flex flex-col gap-4">
            <Field label="E-mail">
              <Input
                type="email"
                autoComplete="username"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@seice.com"
                autoFocus
              />
            </Field>
            <Field label="Senha">
              <div className="relative">
                <Input
                  type={show ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
                  title={show ? 'Ocultar senha' : 'Mostrar senha'}
                  className="absolute top-1/2 right-1.5 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted hover:bg-ink/6 hover:text-ink"
                >
                  {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </Field>
            <Button type="submit" variant="primary" size="lg" loading={login.isPending} className="mt-1 w-full">
              Entrar
            </Button>
          </form>
        </div>
        <p className="mt-6 text-center text-xs text-nav-text/70">Acesso restrito à coordenação do Colégio SEICE.</p>
      </main>
    </div>
  );
}
