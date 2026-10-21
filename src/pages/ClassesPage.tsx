import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { CalendarDays, FilterX, GraduationCap, Pencil, Plus, Power, Trash2 } from 'lucide-react';
import { Page } from '@/components/layout/Page';
import { DataGate } from '@/components/layout/DataGate';
import { Button, Card, EmptyState, IconButton, Menu, SearchInput, Segmented, Select, StatusBadge } from '@/components/ui';
import { ClassFormModal } from '@/features/ClassForm';
import { useEntityActions } from '@/features/EntityActions';
import { ImportButton } from '@/features/import/ImportDialog';
import { useScheduleData } from '@/api/hooks';
import { useHotkey } from '@/hooks/useHotkey';
import { matches, plural } from '@/lib/text';
import { cn } from '@/lib/cn';
import { computeSlotStats } from '@shared/grid';
import { SHIFT_LABEL } from '@shared/labels';
import { CLASS_SHIFTS, type ClassShift, type SchoolClass } from '@shared/types';

type StatusFilter = 'ativos' | 'inativos' | 'todos';

export function ClassesPage() {
  const schedule = useScheduleData();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [editing, setEditing] = useState<SchoolClass | null | 'new'>(null);
  const { toggleStatus, requestDelete, dialogs } = useEntityActions();

  const query = params.get('q') ?? '';
  const status = (params.get('situacao') as StatusFilter) || 'ativos';
  const shift = (params.get('turno') as ClassShift | null) ?? '';

  const setParam = (key: string, value: string, fallback = '') =>
    setParams(
      (p) => {
        if (value === fallback) p.delete(key);
        else p.set(key, value);
        return p;
      },
      { replace: true },
    );
  const clearFilters = () => setParams(new URLSearchParams(), { replace: true });

  const openNew = useCallback(() => setEditing('new'), []);
  useHotkey('n', openNew);

  const stats = useMemo(() => {
    const d = schedule.data;
    if (!d) return new Map<number, { lessons: number; teachers: number; total: number; empty: number }>();
    const slot = computeSlotStats(d.classes.map((c) => ({ ...c, active: true })), d.lessons, d.periods, d.settings);
    const map = new Map<number, { lessons: number; teachers: number; total: number; empty: number }>();
    for (const c of d.classes) {
      const ls = d.lessons.filter((l) => l.classId === c.id);
      const s = slot.emptyByClass.find((e) => e.classId === c.id);
      map.set(c.id, { lessons: ls.length, teachers: new Set(ls.map((l) => l.teacherId)).size, total: s?.total ?? 0, empty: s?.empty ?? 0 });
    }
    return map;
  }, [schedule.data]);

  const all = schedule.data?.classes ?? [];
  const counts = { ativos: all.filter((c) => c.active).length, inativos: all.filter((c) => !c.active).length, todos: all.length };
  const filtered = all.filter(
    (c) =>
      (status === 'todos' || (status === 'ativos' ? c.active : !c.active)) &&
      (!shift || c.shift === shift) &&
      matches([c.name, c.grade, SHIFT_LABEL[c.shift]], query),
  );
  const hasFilters = Boolean(query || shift || status !== 'ativos');

  return (
    <Page
      title="Turmas"
      breadcrumbs={[{ label: 'Início', to: '/' }, { label: 'Turmas' }]}
      description={schedule.data ? `${plural(counts.ativos, 'turma ativa', 'turmas ativas')}${counts.inativos ? ` · ${counts.inativos} inativa(s)` : ''}` : undefined}
      actions={
        <>
          <ImportButton kind="classes" />
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={openNew} title="Atalho: N">
            Nova turma
          </Button>
        </>
      }
    >
      <DataGate data={schedule.data} isLoading={schedule.isLoading} error={schedule.error} onRetry={schedule.refetch}>
        {(data) =>
          data.classes.length === 0 ? (
            <Card>
              <EmptyState
                icon={<GraduationCap />}
                title="Nenhuma turma cadastrada"
                description="Cadastre as turmas com seu turno para que a grade use os períodos corretos, ou importe todas de uma planilha Excel ou CSV."
                action={
                  <>
                    <ImportButton kind="classes" label="Importar planilha" />
                    <Button variant="primary" icon={<Plus className="size-4" />} onClick={openNew}>
                      Cadastrar primeira turma
                    </Button>
                  </>
                }
              />
            </Card>
          ) : (
            <Card>
              <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center">
                <SearchInput
                  value={query}
                  onChange={(v) => setParam('q', v)}
                  placeholder="Pesquisar por turma ou série"
                  label="Pesquisar turmas"
                  className="lg:w-72"
                />
                <Segmented
                  label="Situação"
                  value={status}
                  onChange={(v) => setParam('situacao', v, 'ativos')}
                  options={[
                    { value: 'ativos', label: 'Ativas', count: counts.ativos },
                    { value: 'inativos', label: 'Inativas', count: counts.inativos },
                    { value: 'todos', label: 'Todas', count: counts.todos },
                  ]}
                />
                <div className="lg:w-48">
                  <Select aria-label="Filtrar por turno" value={shift} onChange={(e) => setParam('turno', e.target.value)}>
                    <option value="">Todos os turnos</option>
                    {CLASS_SHIFTS.map((s) => (
                      <option key={s} value={s}>
                        {SHIFT_LABEL[s]}
                      </option>
                    ))}
                  </Select>
                </div>
                {hasFilters && (
                  <Button variant="ghost" size="sm" icon={<FilterX className="size-4" />} onClick={clearFilters} className="lg:ml-auto">
                    Limpar filtros
                  </Button>
                )}
              </div>

              {filtered.length === 0 ? (
                <EmptyState
                  compact
                  title="Nenhuma turma encontrada"
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
                    <caption className="sr-only">Lista de turmas</caption>
                    <thead>
                      <tr className="border-b border-line text-left text-xs text-muted">
                        <th scope="col" className="px-4 py-2.5 font-semibold">Turma</th>
                        <th scope="col" className="px-4 py-2.5 font-semibold">Turno</th>
                        <th scope="col" className="px-4 py-2.5 font-semibold">Professores</th>
                        <th scope="col" className="px-4 py-2.5 font-semibold">Preenchimento da grade</th>
                        <th scope="col" className="px-4 py-2.5 font-semibold">Situação</th>
                        <th scope="col" className="px-4 py-2.5"><span className="sr-only">Ações</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((c) => {
                        const s = stats.get(c.id);
                        return (
                          <tr
                            key={c.id}
                            onClick={() => navigate(`/turmas/${c.id}`)}
                            className="cursor-pointer border-b border-line transition-colors last:border-b-0 hover:bg-subtle"
                          >
                            <td className="px-4 py-3">
                              <Link
                                to={`/turmas/${c.id}`}
                                onClick={(e) => e.stopPropagation()}
                                className={cn('font-bold hover:underline underline-offset-2', !c.active && 'text-muted')}
                              >
                                {c.name}
                              </Link>
                              <span className="block text-xs text-muted">{c.grade}</span>
                            </td>
                            <td className="px-4 py-3 text-ink-2">{SHIFT_LABEL[c.shift]}</td>
                            <td className="tabular px-4 py-3 text-ink-2">{s?.teachers ?? 0}</td>
                            <td className="px-4 py-3">
                              <FillBar filled={(s?.total ?? 0) - (s?.empty ?? 0)} total={s?.total ?? 0} />
                            </td>
                            <td className="px-4 py-3">
                              <StatusBadge active={c.active} />
                            </td>
                            <td className="px-2 py-3">
                              <ClassRowActions
                                schoolClass={c}
                                onEdit={() => setEditing(c)}
                                onToggle={() => toggleStatus({ kind: 'class', entity: c, lessonCount: s?.lessons ?? 0 })}
                                onDelete={() => requestDelete({ kind: 'class', entity: c, lessonCount: s?.lessons ?? 0 })}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <ul className="divide-y divide-line md:hidden">
                    {filtered.map((c) => {
                      const s = stats.get(c.id);
                      return (
                        <li key={c.id} className="flex items-center gap-3 px-4 py-3">
                          <Link to={`/turmas/${c.id}`} className="min-w-0 flex-1">
                            <span className="block font-bold">{c.name}</span>
                            <span className="block truncate text-xs text-muted">
                              {[c.grade, SHIFT_LABEL[c.shift], plural(s?.lessons ?? 0, 'aula', 'aulas'), !c.active && 'Inativa'].filter(Boolean).join(' · ')}
                            </span>
                          </Link>
                          <ClassRowActions
                            compact
                            schoolClass={c}
                            onEdit={() => setEditing(c)}
                            onToggle={() => toggleStatus({ kind: 'class', entity: c, lessonCount: s?.lessons ?? 0 })}
                            onDelete={() => requestDelete({ kind: 'class', entity: c, lessonCount: s?.lessons ?? 0 })}
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
      <ClassFormModal open={editing !== null} schoolClass={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
      {dialogs}
    </Page>
  );
}

export function FillBar({ filled, total }: { filled: number; total: number }) {
  if (total === 0) return <span className="text-xs text-soft">Sem períodos no turno</span>;
  const pct = Math.round((filled / total) * 100);
  return (
    <div className="flex items-center gap-3">
      <div
        className="h-1.5 w-28 overflow-hidden rounded-full bg-ink/[0.07]"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={filled}
        aria-label={`${filled} de ${total} horários preenchidos`}
      >
        <div className={cn('h-full rounded-full', pct === 100 ? 'bg-success' : 'bg-brand')} style={{ width: `${pct}%` }} />
      </div>
      <span className="tabular text-xs text-muted">
        <strong className="font-semibold text-ink">{filled}</strong>/{total}
      </span>
    </div>
  );
}

function ClassRowActions({
  schoolClass,
  onEdit,
  onToggle,
  onDelete,
  compact,
}: {
  schoolClass: SchoolClass;
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
          <IconButton label={`Ver horário da turma ${schoolClass.name}`} size="sm" onClick={() => navigate(`/horarios/turma/${schoolClass.id}`)}>
            <CalendarDays className="size-4" />
          </IconButton>
          <IconButton label={`Editar turma ${schoolClass.name}`} size="sm" onClick={onEdit}>
            <Pencil className="size-4" />
          </IconButton>
        </>
      )}
      <Menu
        label={`Mais ações para a turma ${schoolClass.name}`}
        items={[
          ...(compact
            ? [
                { label: 'Ver horário', icon: <CalendarDays />, onSelect: () => navigate(`/horarios/turma/${schoolClass.id}`) },
                { label: 'Editar', icon: <Pencil />, onSelect: onEdit },
              ]
            : []),
          { label: schoolClass.active ? 'Inativar' : 'Reativar', icon: <Power />, onSelect: onToggle },
          { label: 'Excluir', icon: <Trash2 />, onSelect: onDelete, tone: 'danger' as const },
        ]}
      />
    </div>
  );
}
