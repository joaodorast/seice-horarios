import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import {
  BookOpen,
  CalendarDays,
  Check,
  Type,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  PencilRuler,
  Sigma,
  Settings2,
  Table2,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { IconButton, Menu, useToast } from '@/components/ui';
import { TEXT_SCALE_LABEL, textScaleStore, type TextScale } from '@/lib/textScale';
import { ScheduleActionsProvider } from '@/components/schedule/ScheduleActions';
import { UpdateNotice } from './UpdateNotice';
import { useIsDemo } from '@/api/environment';
import { FlaskConical } from 'lucide-react';
import { useLogout, useSession } from '@/api/auth';
import { initials } from '@/lib/text';

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  end?: boolean;
}

const NAV: { group: string; items: NavItem[] }[] = [
  { group: 'Visão geral', items: [{ to: '/', label: 'Dashboard', icon: <LayoutDashboard />, end: true }] },
  {
    group: 'Cadastros',
    items: [
      { to: '/professores', label: 'Professores', icon: <Users /> },
      { to: '/turmas', label: 'Turmas', icon: <GraduationCap /> },
      { to: '/disciplinas', label: 'Disciplinas', icon: <BookOpen /> },
    ],
  },
  {
    group: 'Horários',
    items: [
      { to: '/horarios', label: 'Quadro geral', icon: <Table2 />, end: true },
      { to: '/horarios/professor', label: 'Por professor', icon: <UserRound /> },
      { to: '/horarios/turma', label: 'Por turma', icon: <CalendarDays /> },
      { to: '/horarios/montar', label: 'Montar quadro', icon: <PencilRuler /> },
      { to: '/horarios/carga', label: 'Carga horária', icon: <Sigma /> },
    ],
  },
];

const SETTINGS_ITEM: NavItem = { to: '/configuracoes', label: 'Configurações', icon: <Settings2 /> };

interface LayoutCtx {
  openNav: () => void;
}
const LayoutContext = createContext<LayoutCtx>({ openNav: () => undefined });
export const useLayout = () => useContext(LayoutContext);

export function AppLayout() {
  const [collapsed, setCollapsed] = useLocalStorage('seice:sidebar-collapsed', false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => setMobileOpen(false), [location.pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMobileOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  return (
    <LayoutContext.Provider value={{ openNav: () => setMobileOpen(true) }}>
      <ScheduleActionsProvider>
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[200] focus:rounded-md focus:bg-brand focus:px-4 focus:py-2 focus:font-semibold"
        >
          Ir para o conteúdo
        </a>
        <div className="flex min-h-app">
          {/* Sidebar fixa (desktop) */}
          <aside
            className={cn(
              'no-print sticky top-0 z-40 hidden h-app shrink-0 flex-col bg-nav transition-[width] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] lg:flex',
              collapsed ? 'w-[84px]' : 'w-[272px]',
            )}
            aria-label="Menu principal"
          >
            <SidebarContent collapsed={collapsed} />
            <button
              type="button"
              onClick={() => setCollapsed(!collapsed)}
              aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
              title={collapsed ? 'Expandir menu' : 'Recolher menu'}
              className="absolute top-[36px] -right-3.5 short:top-[23px] tiny:top-[17px] z-10 grid size-7 place-items-center rounded-full border border-nav-line bg-nav-2 text-nav-text shadow-[0_2px_8px_rgb(0_0_0/0.35)] transition-colors hover:bg-brand hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
            </button>
          </aside>

          {/* Gaveta (tablet e celular) */}
          {mobileOpen && (
            <div className="no-print fixed inset-0 z-[90] lg:hidden" role="dialog" aria-modal="true" aria-label="Menu principal">
              <div className="absolute inset-0 animate-fade-in bg-ink/55 backdrop-blur-[2px]" onClick={() => setMobileOpen(false)} />
              <aside className="relative flex h-full w-[86%] max-w-[300px] animate-slide-in flex-col bg-nav shadow-pop">
                <div className="absolute top-4 right-3 z-10">
                  <IconButton label="Fechar menu" tone="onDark" size="sm" onClick={() => setMobileOpen(false)}>
                    <X className="size-[18px]" />
                  </IconButton>
                </div>
                <SidebarContent collapsed={false} />
              </aside>
            </div>
          )}

          <div className="flex min-w-0 flex-1 flex-col">
            <DemoBanner />
            <Outlet />
          </div>
        </div>
        <UpdateNotice />
      </ScheduleActionsProvider>
    </LayoutContext.Provider>
  );
}

/** Faixa fixa no ambiente de teste (npm run demo), para nunca ser confundido com o sistema real. */
function DemoBanner() {
  if (!useIsDemo()) return null;
  return (
    <div role="note" className="no-print flex items-center justify-center gap-2 bg-brand px-4 py-1.5 text-center text-[13px] font-semibold text-ink">
      <FlaskConical className="size-4 shrink-0" />
      <span>
        Ambiente de teste · dados fictícios em memória. <span className="font-normal">Nada feito aqui chega ao sistema real.</span>
      </span>
    </div>
  );
}

function SidebarContent({ collapsed }: { collapsed: boolean }) {
  return (
    <>
      <div className={cn('flex h-[100px] shrink-0 items-center border-b border-nav-line short:h-[74px] tiny:h-[62px]', collapsed ? 'justify-center px-2' : 'px-5')}>
        <NavLink to="/" aria-label="SEICE — página inicial" className="rounded-md focus-visible:outline-brand">
          {collapsed ? (
            <img src="/emblema-seice.webp" alt="Colégio SEICE" className="size-12 object-contain short:size-10" />
          ) : (
            <span className="flex flex-col gap-1.5 short:gap-1">
              <img src="/logo-seice.webp" alt="Colégio SEICE — Sistema de Ensino Integrado de Campos Elíseos" className="h-auto w-[148px] short:w-[120px] tiny:w-[104px]" />
              <span className="pl-1 text-[10.5px] leading-none font-bold tracking-[0.18em] text-brand/85 uppercase">Gestão de horários</span>
            </span>
          )}
        </NavLink>
      </div>

      <nav className={cn('scrollbar-thin flex-1 overflow-y-auto py-3.5 short:py-2.5 tiny:py-2', collapsed ? 'px-3' : 'px-4')}>
        {NAV.map((section, i) => (
          <div key={section.group} className={cn(i > 0 && 'mt-4 short:mt-3 tiny:mt-2.5')}>
            {collapsed ? (
              i > 0 && <div className="mx-auto mb-3 h-px w-8 bg-nav-line" aria-hidden="true" />
            ) : (
              <p className="mb-1.5 px-3 text-[11px] font-bold tracking-[0.12em] text-nav-text/55 uppercase short:mb-1">{section.group}</p>
            )}
            <ul className="space-y-1 short:space-y-0.5">
              {section.items.map((item) => (
                <li key={item.to}>
                  <SidebarLink item={item} collapsed={collapsed} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className={cn('shrink-0 border-t border-nav-line py-3 short:py-2', collapsed ? 'px-3' : 'px-4')}>
        <SidebarLink item={SETTINGS_ITEM} collapsed={collapsed} />
        <UserCard collapsed={collapsed} />
      </div>
    </>
  );
}

function SidebarLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      title={collapsed ? item.label : undefined}
      aria-label={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        cn(
          'group flex h-10 items-center gap-3 rounded-xl px-3 short:h-9 tiny:h-[34px] text-[14px] font-semibold transition-[background-color,color,box-shadow] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand [&_svg]:size-[19px] [&_svg]:shrink-0',
          collapsed && 'justify-center px-0',
          isActive
            ? 'bg-brand text-ink shadow-[0_6px_18px_-8px_rgb(255_199_0/0.7)]'
            : 'text-nav-text hover:bg-white/[0.07] hover:text-white',
        )
      }
    >
      {({ isActive }) => (
        <>
          <span className={cn('transition-colors', isActive ? 'text-ink' : 'text-nav-text/80 group-hover:text-brand')}>{item.icon}</span>
          {!collapsed && <span className="truncate">{item.label}</span>}
        </>
      )}
    </NavLink>
  );
}

function UserCard({ collapsed }: { collapsed: boolean }) {
  const { data: user } = useSession();
  const logout = useLogout();
  const toast = useToast();
  if (!user) return null;
  const exit = () => logout.mutate(undefined, { onError: () => toast.error('Não foi possível sair', 'Verifique a conexão e tente novamente.') });
  const avatar = (
    <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-brand text-xs font-extrabold text-ink ring-2 ring-nav">
      {initials(user.name) || 'A'}
    </span>
  );

  if (collapsed) {
    return (
      <div className="mt-3 flex flex-col items-center gap-2" title={`${user.name} · ${user.email}`}>
        {avatar}
        <TextScaleMenu align="left" />
        <IconButton label="Sair do sistema" size="sm" tone="onDark" onClick={exit} disabled={logout.isPending}>
          <LogOut className="size-[18px]" />
        </IconButton>
      </div>
    );
  }

  return (
    <div className="mt-3 flex items-center gap-3 rounded-xl bg-white/[0.05] p-2.5 ring-1 ring-white/[0.06] short:mt-2 short:p-2">
      {avatar}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-bold text-white">{user.name}</span>
        <span className="block truncate text-xs text-nav-text/75">{user.email}</span>
      </span>
      <TextScaleMenu />
      <IconButton label="Sair do sistema" size="sm" tone="onDark" onClick={exit} disabled={logout.isPending}>
        <LogOut className="size-[18px]" />
      </IconButton>
    </div>
  );
}

/** Escolha do tamanho do texto (Automático cresce sozinho em monitores grandes). */
function TextScaleMenu({ align = 'right' }: { align?: 'left' | 'right' }) {
  const scale = useSyncExternalStore(textScaleStore.subscribe, textScaleStore.get);
  return (
    <Menu
      label="Tamanho do texto"
      tone="onDark"
      direction="up"
      align={align}
      triggerIcon={<Type className="size-[18px]" />}
      items={(Object.keys(TEXT_SCALE_LABEL) as TextScale[]).map((key) => ({
        label: key === 'auto' ? 'Automático (ajusta à tela)' : TEXT_SCALE_LABEL[key],
        icon: key === scale ? <Check /> : <span className="size-4" />,
        onSelect: () => textScaleStore.set(key),
      }))}
    />
  );
}
