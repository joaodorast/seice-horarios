import { createBrowserRouter } from 'react-router';
import { AppLayout } from '@/components/layout/AppLayout';
import { RouteErrorPage } from '@/pages/NotFoundPage';

// Cada página é carregada sob demanda, reduzindo o tempo da primeira abertura do sistema.
export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    errorElement: <RouteErrorPage />,
    hydrateFallbackElement: null,
    children: [
      { index: true, lazy: () => import('@/pages/DashboardPage').then((m) => ({ Component: m.DashboardPage })) },
      { path: 'professores', lazy: () => import('@/pages/TeachersPage').then((m) => ({ Component: m.TeachersPage })) },
      { path: 'professores/:id', lazy: () => import('@/pages/TeacherDetailPage').then((m) => ({ Component: m.TeacherDetailPage })) },
      { path: 'turmas', lazy: () => import('@/pages/ClassesPage').then((m) => ({ Component: m.ClassesPage })) },
      { path: 'turmas/:id', lazy: () => import('@/pages/ClassDetailPage').then((m) => ({ Component: m.ClassDetailPage })) },
      { path: 'disciplinas', lazy: () => import('@/pages/SubjectsPage').then((m) => ({ Component: m.SubjectsPage })) },
      { path: 'horarios', lazy: () => import('@/pages/ScheduleOverviewPage').then((m) => ({ Component: m.ScheduleOverviewPage })) },
      { path: 'horarios/professor/:id?', lazy: () => import('@/pages/EntitySchedulePage').then((m) => ({ Component: m.TeacherSchedulePage })) },
      { path: 'horarios/turma/:id?', lazy: () => import('@/pages/EntitySchedulePage').then((m) => ({ Component: m.ClassSchedulePage })) },
      { path: 'atribuicoes', lazy: () => import('@/pages/AssignmentsPage').then((m) => ({ Component: m.TeacherAssignmentsPage })) },
      { path: 'atribuicoes/professor/:id?', lazy: () => import('@/pages/AssignmentsPage').then((m) => ({ Component: m.TeacherAssignmentsPage })) },
      { path: 'atribuicoes/turma/:id?', lazy: () => import('@/pages/AssignmentsPage').then((m) => ({ Component: m.ClassAssignmentsPage })) },
      { path: 'horarios/montar', lazy: () => import('@/pages/BuilderPage').then((m) => ({ Component: m.ClassBuilderPage })) },
      { path: 'horarios/montar/turma/:id?', lazy: () => import('@/pages/BuilderPage').then((m) => ({ Component: m.ClassBuilderPage })) },
      { path: 'horarios/montar/professor/:id?', lazy: () => import('@/pages/BuilderPage').then((m) => ({ Component: m.TeacherBuilderPage })) },
      { path: 'horarios/carga', lazy: () => import('@/pages/WorkloadPage').then((m) => ({ Component: m.WorkloadPage })) },
      { path: 'configuracoes', lazy: () => import('@/pages/SettingsPage').then((m) => ({ Component: m.SettingsPage })) },
      { path: '*', lazy: () => import('@/pages/NotFoundPage').then((m) => ({ Component: m.NotFoundPage })) },
    ],
  },
  {
    path: '/imprimir/:kind/:id',
    errorElement: <RouteErrorPage />,
    hydrateFallbackElement: null,
    lazy: () => import('@/pages/PrintPage').then((m) => ({ Component: m.PrintPage })),
  },
]);
