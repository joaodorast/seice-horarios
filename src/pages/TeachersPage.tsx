import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { CalendarDays, FilterX, Pencil, Plus, Power, Trash2, Users } from 'lucide-react';
import { Page } from '@/components/layout/Page';
import { DataGate } from '@/components/layout/DataGate';
import { Badge, Button, Card, EmptyState, IconButton, Menu, SearchInput, Segmented, Select, StatusBadge } from '@/components/ui';
import { TeacherFormModal } from '@/features/TeacherForm';
import { useEntityActions } from '@/features/EntityActions';
import { ImportButton } from '@/features/import/ImportDialog';
import { useLessons, useTeachers } from '@/api/hooks';
import { useHotkey } from '@/hooks/useHotkey';
import { useOpenFromUrl } from '@/hooks/useOpenFromUrl';
import { initials, matches, normalize, plural } from '@/lib/text';
import { durationMinutes } from '@shared/time';
import type { Lesson, Teacher } from '@shared/types';

type StatusFilter = 'ativos' | 'inativos' | 'todos';

export function TeachersPage() {
  const teachers = useTeachers();
  const lessons = useLessons();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [editing, setEditing] = useState<Teacher | null | 'new'>(null);
  const { toggleStatus, requestDelete, dialogs } = useEntityActions();

  const query = params.get('q') ?? '';
  const status = (params.get('situacao') as StatusFilter) || 'ativos';
  const area = params.get('area') ?? '';

  const setParam = (key: string, value: string, fallback = '') => {
    setParams(
      (p) => {
        if (value === fallback) p.delete(key);
        else p.set(key, value);
        return p;
      },
      { replace: true },
    );
  };

  const openNew = useCallback(() => setEditing('new'), []);
  useHotkey('n', openNew);
  useOpenFromUrl(openNew);

  const load = (lessons.data ?? []).reduce((map, l: Lesson) => {
    const cur = map.get(l.teacherId) ?? { count: 0, minutes: 0, classes: new Set<number>() };
    cur.count++;
    cur.minutes += durationMinutes(l.start, l.end);
    cur.classes.add(l.classId);
    map.set(l.teacherId, cur);
    return map;
  }, new Map<number, { count: number; minutes: number; classes: Set<number> }>());

  const areas = useMemo(() => {
    const set = new Map<string, string>();
    for (const t of teachers.data ?? []) if (t.area) set.set(normalize(t.area), t.area);
    return [...set.values()].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [teachers.data]);

  const all = teachers.data ?? [];
  const counts = { ativos: all.filter((t) => t.active).length, inativos: all.filter((t) => !t.active).length, todos: all.length };
  const filtered = all.filter(
    (t) =>
      (status === 'todos' || (status === 'ativos' ? t.active : !t.active)) &&
      (!area || (t.area && normalize(t.area) === normalize(area))) &&
      matches([t.name, t.code, t.area, t.phone], query),
  );
  const hasFilters = Boolean(query || area || status !== 'ativos');

  const clearFilters = () => setParams(new URLSearchParams(), { replace: true });

  return (
    <Page
      title="Professores"
      breadcrumbs={[{ label: 'Início', to: '/' }, { label: 'Professores' }]}
      description={teachers.data ? `${plural(counts.ativos, 'professor ativo', 'professores ativos')}${counts.inativos ? ` · ${counts.inativos} inativo(s)` : ''}` : undefined}
      actions={
        <>
          <ImportButton kind="teachers" />
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={openNew} title="Atalho: N">
            Novo professor
          </Button>
        </>
      }
    >
      <DataGate data={teachers.data} isLoading={teachers.isPending} error={teachers.error} onRetry={() => teachers.refetch()}>
        {(list) =>
          list.length === 0 ? (
            <Card>
              <EmptyState
                icon={<Users />}
                title="Nenhum professor cadastrado"
                description="Cadastre os professores para começar a montar os quadros de horários, ou importe a lista completa de uma planilha Excel ou CSV."
                action={
                  <>
                    <ImportButton kind="teachers" label="Importar planilha" />
                    <Button variant="primary" icon={<Plus className="size-4" />} onClick={openNew}>
                      Cadastrar primeiro professor
                    </Button>
                  </>
                }
              />
            </Card>
          ) : (
            <Card className="overflow-visible">
              <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center">
                <SearchInput
                  value={query}
                  onChange={(v) => setParam('q', v)}
                  placeholder="Pesquisar por nome, matrícula ou área"
                  label="Pesquisar professores"
                  className="lg:w-80"
                />
                <Segmented
                  label="Situação"
                  value={status}
                  onChange={(v) => setParam('situacao', v, 'ativos')}
                  options={[
                    { value: 'ativos', label: 'Ativos', count: counts.ativos },
                    { value: 'inativos', label: 'Inativos', count: counts.inativos },
                    { value: 'todos', label: 'Todos', count: counts.todos },
                  ]}
                />
                {areas.length > 0 && (
                  <div className="lg:w-56">
                    <Select aria-label="Filtrar por área" value={area} onChange={(e) => setParam('area', e.target.value)}>
                      <option value="">Todas as áreas</option>
                      {areas.map((a) => (
                        <option key={a} value={a}>
                          {a}
                        </option>
                      ))}
                    </Select>
                  </div>
                )}
                {hasFilters && (
                  <Button variant="ghost" size="sm" icon={<FilterX className="size-4" />} onClick={clearFilters} className="lg:ml-auto">
                    Limpar filtros
                  </Button>
                )}
              </div>

              {filtered.length === 0 ? (
                <EmptyState
                  compact
                  title="Nenhum professor encontrado"
                  description="Revise a pesquisa ou os filtros aplicados."
                  action={
                    <Button icon={<FilterX className="size-4" />} onClick={clearFilters}>
                      Limpar filtros
                    </Button>
                  }
                />
              ) : (
                <>
                  <table className="hidden w-full text-sm md:table">
                    <caption className="sr-only">Lista de professores</caption>
                    <thead>
                      <tr className="border-b border-line text-left text-xs text-muted">
                        <th scope="col" className="px-4 py-2.5 font-semibold">Professor</th>
                        <th scope="col" className="px-4 py-2.5 font-semibold">Área de atuação</th>
                        <th scope="col" className="hidden px-4 py-2.5 font-semibold lg:table-cell">Telefone</th>
                        <th scope="col" className="px-4 py-2.5 font-semibold">Carga semanal</th>
                        <th scope="col" className="px-4 py-2.5 font-semibold">Situação</th>
                        <th scope="col" className="px-4 py-2.5"><span className="sr-only">Ações</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((t) => {
                        const l = load.get(t.id);
                        return (
                          <tr
                            key={t.id}
                            onClick={() => navigate(`/professores/${t.id}`)}
                            className="cursor-pointer border-b border-line transition-colors last:border-b-0 hover:bg-subtle"
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <Avatar name={t.name} muted={!t.active} />
                                <div className="min-w-0">
                                  <Link
                                    to={`/professores/${t.id}`}
                                    onClick={(e) => e.stopPropagation()}
                                    className="block truncate font-semibold text-ink hover:underline underline-offset-2"
                                  >
                                    {t.name}
                                  </Link>
                                  {t.code && <span className="text-xs text-muted">Matrícula {t.code}</span>}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-ink-2">{t.area ?? <span className="text-soft">—</span>}</td>
                            <td className="tabular hidden px-4 py-3 text-ink-2 lg:table-cell">{t.phone ?? <span className="text-soft">—</span>}</td>
                            <td className="px-4 py-3">
                              {l ? (
                                <span className="tabular text-ink-2">
                                  <strong className="font-semibold text-ink">{l.count}</strong> {l.count === 1 ? 'aula' : 'aulas'}
                                  <span className="text-muted"> · {plural(l.classes.size, 'turma', 'turmas')}</span>
                                </span>
                              ) : (
                                <Badge>Sem aulas</Badge>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <StatusBadge active={t.active} />
                            </td>
                            <td className="px-2 py-3">
                              <RowActions
                                teacher={t}
                                onEdit={() => setEditing(t)}
                                onToggle={() => toggleStatus({ kind: 'teacher', entity: t, lessonCount: l?.count ?? 0 })}
                                onDelete={() => requestDelete({ kind: 'teacher', entity: t, lessonCount: l?.count ?? 0 })}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  <ul className="divide-y divide-line md:hidden">
                    {filtered.map((t) => {
                      const l = load.get(t.id);
                      return (
                        <li key={t.id} className="flex items-center gap-3 px-4 py-3">
                          <Avatar name={t.name} muted={!t.active} />
                          <Link to={`/professores/${t.id}`} className="min-w-0 flex-1">
                            <span className="block truncate font-semibold">{t.name}</span>
                            <span className="block truncate text-xs text-muted">
                              {[t.area, l ? plural(l.count, 'aula', 'aulas') : 'Sem aulas', !t.active && 'Inativo'].filter(Boolean).join(' · ')}
                            </span>
                          </Link>
                          <RowActions
                            teacher={t}
                            compact
                            onEdit={() => setEditing(t)}
                            onToggle={() => toggleStatus({ kind: 'teacher', entity: t, lessonCount: l?.count ?? 0 })}
                            onDelete={() => requestDelete({ kind: 'teacher', entity: t, lessonCount: l?.count ?? 0 })}
                          />
                        </li>
                      );
                    })}
                  </ul>
                  <p className="border-t border-line px-4 py-2.5 text-xs text-muted">
                    Exibindo {filtered.length} de {all.length}
                  </p>
                </>
              )}
            </Card>
          )
        }
      </DataGate>
      <TeacherFormModal open={editing !== null} teacher={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
      {dialogs}
    </Page>
  );
}

function RowActions({
  teacher,
  onEdit,
  onToggle,
  onDelete,
  compact,
}: {
  teacher: Teacher;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
  compact?: boolean;
}) {
  const navigate = useNavigate();
  return (
    <div className="flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
      {!compact && (
        <>
          <IconButton label={`Ver horário de ${teacher.name}`} size="sm" onClick={() => navigate(`/horarios/professor/${teacher.id}`)}>
            <CalendarDays className="size-4" />
          </IconButton>
          <IconButton label={`Editar ${teacher.name}`} size="sm" onClick={onEdit}>
            <Pencil className="size-4" />
          </IconButton>
        </>
      )}
      <Menu
        label={`Mais ações para ${teacher.name}`}
        items={[
          ...(compact
            ? [
                { label: 'Ver horário', icon: <CalendarDays />, onSelect: () => navigate(`/horarios/professor/${teacher.id}`) },
                { label: 'Editar', icon: <Pencil />, onSelect: onEdit },
              ]
            : []),
          { label: teacher.active ? 'Inativar' : 'Reativar', icon: <Power />, onSelect: onToggle },
          { label: 'Excluir', icon: <Trash2 />, onSelect: onDelete, tone: 'danger' as const },
        ]}
      />
    </div>
  );
}

export function Avatar({ name, muted, size = 'md' }: { name: string; muted?: boolean; size?: 'md' | 'lg' }) {
  return (
    <span
      aria-hidden="true"
      className={
        (size === 'lg' ? 'size-14 text-lg ' : 'size-9 text-xs ') +
        'grid shrink-0 place-items-center rounded-full font-bold ' +
        (muted ? 'bg-ink/[0.06] text-muted' : 'bg-nav text-brand')
      }
    >
      {initials(name)}
    </span>
  );
}
