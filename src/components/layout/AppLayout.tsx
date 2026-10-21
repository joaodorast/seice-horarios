import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import {
  CalendarDays,
  ChevronsLeft,
  ChevronsRight,
  GraduationCap,
  LayoutDashboard,
  Settings2,
  Table2,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { IconButton } from '@/components/ui';
import { ScheduleActionsProvider } from '@/components/schedule/ScheduleActions';

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
    ],
  },
  {
    group: 'Horários',
    items: [
      { to: '/horarios', label: 'Quadro de horários', icon: <Table2 />, end: true },
      { to: '/horarios/professor', label: 'Horários por professor', icon: <UserRound /> },
      { to: '/horarios/turma', label: 'Horários por turma', icon: <CalendarDays /> },
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
        <div className="flex min-h-dvh">
          {/* Sidebar fixa (desktop) */}
          <aside
            className={cn(
              'no-print sticky top-0 hidden h-dvh shrink-0 flex-col bg-nav transition-[width] duration-200 lg:flex',
              collapsed ? 'w-[76px]' : 'w-[256px]',
            )}
            aria-label="Menu principal"
          >
            <SidebarContent collapsed={collapsed} />
            <div className="border-t border-nav-line p-3">
              <button
                type="button"
                onClick={() => setCollapsed(!collapsed)}
                aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
                title={collapsed ? 'Expandir menu' : 'Recolher menu'}
                className={cn(
                  'flex h-9 w-full items-center gap-3 rounded-md px-3 text-[13px] font-medium text-nav-text transition-colors hover:bg-white/6 hover:text-white focus-visible:outline-brand',
                  collapsed && 'justify-center px-0',
                )}
              >
                {collapsed ? <ChevronsRight className="size-[18px]" /> : <ChevronsLeft className="size-[18px]" />}
                {!collapsed && 'Recolher menu'}
              </button>
            </div>
          </aside>

          {/* Gaveta (tablet e celular) */}
          {mobileOpen && (
            <div className="no-print fixed inset-0 z-[90] lg:hidden" role="dialog" aria-modal="true" aria-label="Menu principal">
              <div className="absolute inset-0 animate-fade-in bg-ink/50" onClick={() => setMobileOpen(false)} />
              <aside className="relative flex h-full w-[84%] max-w-[300px] animate-slide-in flex-col bg-nav shadow-pop">
                <div className="absolute top-3 right-3 z-10">
                  <IconButton label="Fechar menu" tone="onDark" size="sm" onClick={() => setMobileOpen(false)}>
                    <X className="size-[18px]" />
                  </IconButton>
                </div>
                <SidebarContent collapsed={false} />
              </aside>
            </div>
          )}

          <div className="flex min-w-0 flex-1 flex-col">
            <Outlet />
          </div>
        </div>
      </ScheduleActionsProvider>
    </LayoutContext.Provider>
  );
}

function SidebarContent({ collapsed }: { collapsed: boolean }) {
  return (
    <>
      <div className={cn('flex items-center px-4 pt-5 pb-4', collapsed ? 'justify-center px-2' : '')}>
        <NavLink to="/" aria-label="SEICE — página inicial" className="rounded-md focus-visible:outline-brand">
          {collapsed ? (
            <img src="/emblema-seice.png" alt="Colégio SEICE" className="size-11 object-contain" />
          ) : (
            <img src="/logo-seice.png" alt="Colégio SEICE — Sistema de Ensino Integrado de Campos Elíseos" className="h-auto w-[208px]" />
          )}
        </NavLink>
      </div>
      {!collapsed && (
        <p className="mx-4 mb-2 border-b border-nav-line pb-4 text-xs font-medium text-nav-text/80">Gestão de horários</p>
      )}
      <nav className="scrollbar-thin flex-1 overflow-y-auto px-3 pb-3">
        {NAV.map((section) => (
          <div key={section.group} className="mt-4 first:mt-2">
            {!collapsed ? (
              <p className="mb-1.5 px-3 text-xs font-semibold text-nav-text/60">{section.group}</p>
            ) : (
              <div className="mx-auto mb-2 h-px w-6 bg-nav-line" aria-hidden="true" />
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.to}>
                  <SidebarLink item={item} collapsed={collapsed} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className="px-3 pb-2">
        <SidebarLink item={SETTINGS_ITEM} collapsed={collapsed} />
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
          'group relative flex h-10 items-center gap-3 rounded-md px-3 text-sm font-semibold transition-colors duration-150 focus-visible:outline-brand [&_svg]:size-[18px] [&_svg]:shrink-0',
          collapsed && 'justify-center px-0',
          isActive ? 'bg-nav-2 text-white' : 'text-nav-text hover:bg-white/5 hover:text-white',
        )
      }
    >
      {({ isActive }) => (
        <>
          <span
            aria-hidden="true"
            className={cn(
              'absolute top-2 bottom-2 left-0 w-[3px] rounded-r-full bg-brand transition-opacity',
              isActive ? 'opacity-100' : 'opacity-0',
            )}
          />
          <span className={cn(isActive ? 'text-brand' : 'text-nav-text group-hover:text-white')}>{item.icon}</span>
          {!collapsed && <span className="truncate">{item.label}</span>}
        </>
      )}
    </NavLink>
  );
}
