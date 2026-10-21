import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { AlertTriangle, ArrowRight, CalendarCheck2, Check, Clock3, Eye, EyeOff, FileSpreadsheet, LockKeyhole, Mail, Printer, ShieldCheck, ShieldX } from 'lucide-react';
import { Modal, Spinner } from '@/components/ui';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useLogin } from '@/api/auth';
import { ApiError, errorMessage } from '@/api/client';
import { cn } from '@/lib/cn';

/** Tela de acesso em duas metades: apresentação do sistema à esquerda, formulário à direita. */
export function LoginPage({ expired }: { expired?: boolean }) {
  useEffect(() => {
    document.title = 'Entrar · SEICE';
  }, []);

  return (
    <div className="flex min-h-dvh bg-surface lg:h-dvh lg:overflow-hidden">
      <Showcase />
      <main className="relative flex flex-1 flex-col px-6 pb-8 sm:px-10 lg:overflow-y-auto lg:px-14 lg:pt-8">
        <MobileHero />
        <div className="hidden items-center justify-end lg:flex">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-muted">
            <ShieldCheck className="size-4 text-success" />
            Conexão protegida
          </span>
        </div>
        <div className="flex flex-1 items-center justify-center py-10">
          <LoginForm expired={expired} />
        </div>
        <p className="text-center text-xs text-soft lg:text-right">© {new Date().getFullYear()} Colégio SEICE · Sistema de Ensino Integrado de Campos Elíseos</p>
      </main>
    </div>
  );
}

// ------------------------------------------------------------------ Formulário

function LoginForm({ expired }: { expired?: boolean }) {
  const login = useLogin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [error, setError] = useState<{ text: string; locked: boolean } | null>(null);
  const [shake, setShake] = useState(0);
  const passwordRef = useRef<HTMLInputElement>(null);
  // Preferências deste computador: última escolha de "manter conectado" e se a pergunta deve ser feita.
  const [remember, setRemember] = useLocalStorage('seice:manter-conectado', false);
  const [skipAsk, setSkipAsk] = useLocalStorage('seice:nao-perguntar-conexao', false);
  const [asking, setAsking] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError({ text: 'Informe o e-mail e a senha para continuar.', locked: false });
      setShake((n) => n + 1);
      return;
    }
    // Sem "manter conectado", pergunta uma vez de forma amigável (a menos que a pessoa tenha pedido para não perguntar).
    if (!remember && !skipAsk) return setAsking(true);
    void enter(remember);
  }

  async function enter(keep: boolean) {
    setAsking(false);
    try {
      await login.mutateAsync({ email, password, remember: keep });
    } catch (err) {
      const known = err instanceof ApiError && err.status > 0 && err.status < 500;
      setError({ text: known ? (err as ApiError).message : errorMessage(err), locked: err instanceof ApiError && err.status === 429 });
      setShake((n) => n + 1);
      setPassword('');
      passwordRef.current?.focus();
    }
  }

  const detectCaps = (e: React.KeyboardEvent) => setCapsLock(e.getModifierState?.('CapsLock') ?? false);

  return (
    <div className="w-full max-w-[400px]">
      <p className="mb-3 inline-flex items-center gap-2 rounded-pill bg-brand-soft px-3 py-1 text-xs font-bold text-brand-ink">
        <span className="size-1.5 rounded-full bg-brand" aria-hidden="true" />
        Área da coordenação
      </p>
      <h1 className="text-[2rem] leading-tight font-extrabold tracking-[-0.035em] text-ink">Bem-vindo de volta</h1>
      <p className="mt-2 text-[15px] text-muted">Entre com seu e-mail institucional para acessar os quadros de horários.</p>

      {expired && !error && (
        <div role="status" className="mt-6 flex items-start gap-2.5 rounded-lg bg-info-soft px-3.5 py-3 text-sm text-[#2f3778]">
          <LockKeyhole className="mt-0.5 size-4 shrink-0" />
          Sua sessão expirou por segurança. Entre novamente para continuar.
        </div>
      )}

      {error && (
        <div
          key={shake}
          role="alert"
          className="mt-6 flex animate-shake items-start gap-2.5 rounded-lg border border-danger/20 bg-danger-soft px-3.5 py-3 text-sm font-medium text-[#7d1d1d]"
        >
          {error.locked ? <ShieldX className="mt-0.5 size-4 shrink-0 text-danger" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />}
          {error.text}
        </div>
      )}

      <form onSubmit={submit} noValidate className="mt-7 flex flex-col gap-5">
        <InputField id="login-email" label="E-mail" icon={<Mail />}>
          <input
            id="login-email"
            type="email"
            autoComplete="username"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nome@seice.com"
            autoFocus
            className={inputClass}
          />
        </InputField>

        <InputField
          id="login-password"
          label="Senha"
          icon={<LockKeyhole />}
          trailing={
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
              aria-pressed={show}
              title={show ? 'Ocultar senha' : 'Mostrar senha'}
              className="grid size-9 place-items-center rounded-md text-muted transition-colors hover:bg-ink/6 hover:text-ink"
            >
              {show ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
            </button>
          }
          hint={
            capsLock && (
              <span className="flex items-center gap-1.5 text-warning">
                <AlertTriangle className="size-3.5" /> Caps Lock está ativado
              </span>
            )
          }
        >
          <input
            ref={passwordRef}
            id="login-password"
            type={show ? 'text' : 'password'}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={detectCaps}
            onKeyUp={detectCaps}
            placeholder="••••••••"
            className={cn(inputClass, 'pr-12')}
          />
        </InputField>

        <RememberToggle checked={remember} onChange={setRemember} />

        <button
          type="submit"
          disabled={login.isPending}
          className="group inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-ink text-[15px] font-bold text-white shadow-[0_8px_24px_-8px_rgb(29_32_37/0.55)] transition-all duration-200 hover:bg-ink-2 hover:shadow-[0_12px_28px_-8px_rgb(29_32_37/0.6)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand active:translate-y-px disabled:opacity-80"
        >
          {login.isPending ? (
            <>
              <Spinner size={18} /> Entrando…
            </>
          ) : (
            <>
              Entrar
              <ArrowRight className="size-[18px] transition-transform duration-200 group-hover:translate-x-1" />
            </>
          )}
        </button>
      </form>

      <RememberPrompt
        open={asking}
        onCancel={() => setAsking(false)}
        onChoose={(keep, dontAskAgain) => {
          if (dontAskAgain) setSkipAsk(true);
          if (keep) setRemember(true);
          void enter(keep);
        }}
      />

      <p className="mt-8 flex items-start gap-2 border-t border-line pt-5 text-xs leading-relaxed text-muted">
        <ShieldCheck className="mt-px size-4 shrink-0 text-soft" />
        Acesso restrito à coordenação. Após 5 tentativas incorretas, o acesso é bloqueado por 15 minutos.
      </p>
    </div>
  );
}

/** Opção "Manter conectado", em formato de caixa de seleção grande e fácil de tocar. */
function RememberToggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="group -mt-1 flex cursor-pointer items-center gap-3 rounded-lg px-1 py-1 select-none">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span
        aria-hidden="true"
        className={cn(
          'grid size-5 shrink-0 place-items-center rounded-md border-2 transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink',
          checked ? 'border-ink bg-ink text-brand' : 'border-line-strong bg-surface group-hover:border-soft',
        )}
      >
        {checked && <Check className="size-3.5" strokeWidth={3.5} />}
      </span>
      <span className="text-sm">
        <span className="font-semibold text-ink">Manter conectado neste computador</span>
        <span className="block text-xs text-muted">Você não precisará entrar de novo por 30 dias.</span>
      </span>
    </label>
  );
}

/** Pergunta amigável exibida ao entrar sem "manter conectado". */
function RememberPrompt({
  open,
  onCancel,
  onChoose,
}: {
  open: boolean;
  onCancel: () => void;
  onChoose: (keep: boolean, dontAskAgain: boolean) => void;
}) {
  const [dontAsk, setDontAsk] = useState(false);
  return (
    <Modal open={open} onClose={onCancel} size="sm" title="Manter você conectado?">
      <div className="flex flex-col items-center text-center">
        <span className="relative grid size-16 place-items-center rounded-2xl bg-brand-soft text-brand-ink">
          <Clock3 className="size-8" />
          <span className="absolute -right-1.5 -bottom-1.5 grid size-7 place-items-center rounded-full bg-ink text-brand ring-4 ring-surface">
            <ShieldCheck className="size-4" />
          </span>
        </span>
        <p className="mt-5 text-[15px] leading-relaxed text-ink-2">
          Assim você <strong className="text-ink">não precisa digitar e-mail e senha</strong> toda vez que abrir o sistema neste computador. O acesso fica ativo
          por 30 dias e se renova enquanto você usa.
        </p>
        <p className="mt-3 rounded-lg bg-subtle px-3 py-2 text-xs leading-relaxed text-muted">
          Recomendado no computador da coordenação. Em computadores compartilhados, prefira entrar só desta vez.
        </p>
        <label className="mt-4 flex cursor-pointer items-center gap-2 text-[13px] text-muted select-none">
          <input type="checkbox" checked={dontAsk} onChange={(e) => setDontAsk(e.target.checked)} className="size-4 accent-[var(--color-ink)]" />
          Não perguntar de novo neste computador
        </label>
      </div>
      <div className="-mx-5 mt-5 -mb-5 flex flex-col-reverse gap-2 border-t border-line bg-subtle px-5 py-3.5 sm:-mx-6 sm:flex-row sm:px-6">
        <button
          type="button"
          onClick={() => onChoose(false, dontAsk)}
          className="h-11 flex-1 rounded-lg border border-line-strong bg-surface text-sm font-semibold text-ink-2 transition-colors hover:bg-subtle"
        >
          Não, só desta vez
        </button>
        <button
          type="button"
          data-autofocus
          onClick={() => onChoose(true, dontAsk)}
          className="h-11 flex-1 rounded-lg bg-brand text-sm font-bold text-ink shadow-[inset_0_-1px_0_rgb(0_0_0/0.12)] transition-colors hover:bg-brand-hover"
        >
          Sim, manter conectado
        </button>
      </div>
    </Modal>
  );
}

const inputClass =
  'h-12 w-full rounded-lg border border-line-strong bg-surface pr-3 pl-11 text-[15px] text-ink placeholder:text-soft outline-none transition-[border-color,box-shadow] duration-150 hover:border-soft focus:border-ink focus:ring-4 focus:ring-brand/35';

function InputField({
  id,
  label,
  icon,
  trailing,
  hint,
  children,
}: {
  id: string;
  label: string;
  icon: ReactNode;
  trailing?: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-bold text-ink-2">
        {label}
      </label>
      <div className="group relative">
        <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-soft transition-colors group-focus-within:text-ink [&>svg]:size-[18px]">
          {icon}
        </span>
        {children}
        {trailing && <span className="absolute top-1/2 right-1.5 -translate-y-1/2">{trailing}</span>}
      </div>
      {hint && <p className="text-xs font-semibold">{hint}</p>}
    </div>
  );
}

// ------------------------------------------------------------------ Vitrine (metade esquerda)

/** Unidades do Colégio SEICE exibidas no login (fotos otimizadas em public/unidades). */
const UNITS = [
  { name: 'SEICE Jardim Primavera', photo: '/unidades/jardim-primavera.webp', backdrop: '/unidades/jardim-primavera-fundo.webp' },
  { name: 'SEICE Campos Elíseos', photo: '/unidades/campos-eliseos.webp', backdrop: '/unidades/campos-eliseos-fundo.webp' },
];
const UNIT_INTERVAL = 5000;

/** Alterna a unidade em destaque; pausa quando a aba não está visível. */
function useUnitCycle() {
  const [active, setActive] = useState(0);
  const [swaps, setSwaps] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      setActive((a) => (a + 1) % UNITS.length);
      setSwaps((n) => n + 1);
    }, UNIT_INTERVAL);
    return () => window.clearInterval(id);
  }, []);
  return { active, swaps };
}

/** Fachadas das unidades se alternando em esmaecimento (fundo da vitrine e faixa do celular). */
function UnitBackdrop({ active, className }: { active: number; className: string }) {
  return (
    <>
      {UNITS.map((u, i) => (
        <img
          key={u.name}
          src={u.backdrop}
          alt=""
          className={cn(className, 'transition-opacity duration-[1400ms] ease-in-out', i === active ? 'opacity-100' : 'opacity-0')}
        />
      ))}
    </>
  );
}

/** Faixa com as fachadas das unidades no topo da tela, em celulares e tablets. */
function MobileHero() {
  const { active } = useUnitCycle();
  return (
    <div className="relative -mx-6 mb-2 h-44 overflow-hidden bg-nav sm:-mx-10 lg:hidden">
      <UnitBackdrop active={active} className="absolute inset-0 size-full scale-105 object-cover blur-[1.5px]" />
      <div className="absolute inset-0 bg-gradient-to-b from-nav/40 via-nav/55 to-surface" />
      <img src="/logo-seice.webp" alt="Colégio SEICE" className="absolute top-5 left-6 h-auto w-[150px] drop-shadow-lg sm:left-10" />
      <span key={active} className="absolute top-7 right-6 rounded-pill bg-nav/70 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-sm sm:right-10" style={{ animation: 'seice-fade-up 0.6s ease-out both' }}>
        {UNITS[active].name}
      </span>
    </div>
  );
}

/**
 * Pilha de cartões-postais das unidades: a cada intervalo, o cartão da frente gira para o lado,
 * passa para trás da pilha e o outro assume a frente.
 */
function UnitCards({ active, swaps }: { active: number; swaps: number }) {
  return (
    <div className="absolute top-9 right-12 hidden w-[214px] xl:right-16 [@media(min-height:860px)]:xl:block">
      <div className="relative h-[262px]">
        {UNITS.map((u, i) => {
          const front = i === active;
          return (
            <figure
              key={u.name}
              className="absolute inset-x-0 top-0 rounded-lg bg-white p-2 pb-3 shadow-[0_24px_48px_-16px_rgb(0_0_0/0.7)] transition-[transform,filter] duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
              style={{
                zIndex: front ? 2 : 1,
                transform: front ? 'rotate(3deg)' : 'translate(-30px, 12px) rotate(-7deg) scale(0.93)',
                filter: front ? 'none' : 'brightness(0.72)',
                // O cartão que acabou de sair da frente faz o arco para o lado antes de ir para trás.
                animation: !front && swaps > 0 ? 'seice-card-out 0.95s cubic-bezier(0.45, 0, 0.2, 1) both' : undefined,
              }}
            >
              <img src={u.photo} alt="" className="aspect-square w-full rounded object-cover" />
              <figcaption className="mt-2 text-center text-[11.5px] font-bold text-ink-2">{u.name}</figcaption>
            </figure>
          );
        })}
      </div>
      <div className="mt-4 flex items-center justify-center gap-1.5">
        {UNITS.map((u, i) => (
          <span key={u.name} className={cn('h-1.5 rounded-full transition-all duration-500', i === active ? 'w-5 bg-brand' : 'w-1.5 bg-white/30')} />
        ))}
      </div>
    </div>
  );
}

function Showcase() {
  const { active, swaps } = useUnitCycle();
  return (
    <aside className="relative hidden w-[54%] max-w-[880px] flex-col overflow-hidden bg-nav px-12 py-9 text-white lg:flex xl:px-16" aria-hidden="true">
      {/* Fachadas das unidades ao fundo, desfocadas e escurecidas. */}
      <UnitBackdrop active={active} className="absolute inset-0 size-full scale-110 object-cover opacity-55 blur-[6px]" />
      <div className="absolute inset-0 bg-gradient-to-br from-nav/95 via-nav/85 to-nav/70" />
      <div className="bg-grid absolute inset-0 [mask-image:radial-gradient(ellipse_at_30%_40%,black_20%,transparent_75%)]" />
      <div className="absolute -top-40 -right-32 size-[520px] rounded-full bg-brand/20 blur-[110px] [animation:seice-drift_16s_ease-in-out_infinite]" />
      <div className="absolute -bottom-48 -left-24 size-[460px] rounded-full bg-accent/15 blur-[120px] [animation:seice-drift_20s_ease-in-out_infinite_reverse]" />

      <img src="/logo-seice.webp" alt="" className="relative h-auto w-[190px] drop-shadow-[0_8px_20px_rgb(0_0_0/0.45)]" />
      <UnitCards active={active} swaps={swaps} />

      <div className="relative mt-auto mb-8 max-w-[560px]">
        <p className="text-sm font-bold tracking-[0.18em] text-brand uppercase">Gestão de horários</p>
        <h2 className="mt-3 text-[2.5rem] leading-[1.05] font-extrabold tracking-[-0.04em] xl:text-[3rem]">
          O quadro da escola,{' '}
          <span className="relative whitespace-nowrap text-brand">
            sem conflitos
            <svg viewBox="0 0 220 12" className="absolute -bottom-2 left-0 w-full" preserveAspectRatio="none">
              <path d="M2 9 C 60 2, 150 2, 218 7" stroke="currentColor" strokeWidth="3.5" fill="none" strokeLinecap="round" opacity="0.7" />
            </svg>
          </span>
          .
        </h2>
        <p className="mt-5 max-w-[460px] text-[15px] leading-relaxed text-nav-text">
          Professores, turmas e disciplinas organizados em um só lugar, com verificação automática de choques de horário.
        </p>
      </div>

      <SchedulePreview />

      <ul className="relative mt-8 grid grid-cols-3 gap-3">
        <Feature icon={<FileSpreadsheet />} title="Importa planilhas" text="Excel e CSV" />
        <Feature icon={<CalendarCheck2 />} title="Sem choques" text="3 camadas de verificação" />
        <Feature icon={<Printer />} title="Pronto para imprimir" text="Grades em PDF" />
      </ul>
    </aside>
  );
}

function Feature({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <li className="rounded-xl border border-white/8 bg-white/[0.035] px-4 py-3.5 backdrop-blur-sm">
      <span className="grid size-8 place-items-center rounded-lg bg-brand/15 text-brand [&>svg]:size-[17px]">{icon}</span>
      <p className="mt-2.5 text-sm font-bold">{title}</p>
      <p className="text-xs text-nav-text">{text}</p>
    </li>
  );
}

const PREVIEW_DAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'];
const PREVIEW_ROWS = ['07:00', '07:50', '08:40'];
/** Aulas da prévia: [linha, coluna, disciplina, cor]. */
const PREVIEW_LESSONS: Array<[number, number, string, string]> = [
  [0, 0, 'Matemática', 'bg-sub-sky'],
  [0, 2, 'Português', 'bg-sub-rose'],
  [0, 4, 'Ciências', 'bg-sub-green'],
  [1, 1, 'História', 'bg-sub-amber'],
  [1, 3, 'Inglês', 'bg-sub-violet'],
  [2, 0, 'Geografia', 'bg-sub-teal'],
  [2, 2, 'Artes', 'bg-sub-orange'],
  [2, 4, 'Ed. Física', 'bg-sub-lime'],
];

/** Mini quadro animado: aulas surgem uma a uma e um conflito é barrado. */
function SchedulePreview() {
  return (
    <div className="relative rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-[0_30px_60px_-30px_rgb(0_0_0/0.6)] backdrop-blur-md">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-bold text-white/90">6º A · Manhã</span>
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-nav-text">
          <span className="size-1.5 rounded-full bg-[#7ddc94]" /> sem conflitos
        </span>
      </div>
      <div className="grid grid-cols-[44px_repeat(5,1fr)] gap-1.5 text-[11px]">
        <span />
        {PREVIEW_DAYS.map((d) => (
          <span key={d} className="pb-1 text-center font-bold text-nav-text">
            {d}
          </span>
        ))}
        {PREVIEW_ROWS.map((time, row) => (
          <Row key={time} time={time} row={row} />
        ))}
      </div>
      <div
        className="absolute right-6 -bottom-4 flex items-center gap-2 rounded-lg bg-surface px-3 py-2 text-xs font-bold text-ink shadow-pop"
        style={{ animation: 'seice-conflict 9s ease-in-out infinite' }}
      >
        <ShieldX className="size-4 text-danger" />
        Conflito evitado: professor já ocupado
      </div>
    </div>
  );
}

function Row({ time, row }: { time: string; row: number }) {
  return (
    <>
      <span className="tabular flex items-center font-semibold text-nav-text/80">{time}</span>
      {PREVIEW_DAYS.map((_, col) => {
        const lesson = PREVIEW_LESSONS.find(([r, c]) => r === row && c === col);
        const order = lesson ? PREVIEW_LESSONS.indexOf(lesson) : 0;
        return (
          <span key={col} className="relative h-9 rounded-md bg-white/[0.04] ring-1 ring-white/[0.05] ring-inset">
            {lesson && (
              <span
                className="absolute inset-0 flex items-center gap-1.5 overflow-hidden rounded-md bg-white/[0.09] px-1.5 font-semibold text-white"
                style={{ animation: `seice-cell 9s ease-in-out ${order * 0.35}s infinite both` } as CSSProperties}
              >
                <span className={cn('h-5 w-[3px] shrink-0 rounded-full', lesson[3])} />
                <span className="truncate">{lesson[2]}</span>
              </span>
            )}
          </span>
        );
      })}
    </>
  );
}
