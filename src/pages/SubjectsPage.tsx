import { useCallback, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { BookOpen, FilterX, Pencil, Plus, Table2, Trash2 } from 'lucide-react';
import { Page } from '@/components/layout/Page';
import { DataGate } from '@/components/layout/DataGate';
import { Badge, Button, Card, ConfirmDialog, EmptyState, IconButton, Menu, SearchInput, Segmented, useToast } from '@/components/ui';
import { SubjectFormModal } from '@/features/SubjectForm';
import { ImportButton } from '@/features/import/ImportDialog';
import { useDeleteSubject, useScheduleData } from '@/api/hooks';
import { errorMessage } from '@/api/client';
import { useHotkey } from '@/hooks/useHotkey';
import { matches, plural } from '@/lib/text';
import { formatHours } from '@/lib/format';
import { SUBJECT_STYLE } from '@/lib/subjectColors';
import { cn } from '@/lib/cn';
import { durationMinutes } from '@shared/time';
import type { Subject } from '@shared/types';

type UsageFilter = 'todas' | 'em-uso' | 'sem-aulas';

interface Usage {
  lessons: number;
  minutes: number;
  teachers: number;
  classes: number;
}

export function SubjectsPage() {
  const schedule = useScheduleData();
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState<Subject | 'new' | null>(null);
  const [removing, setRemoving] = useState<Subject | null>(null);
  const del = useDeleteSubject();
  const toast = useToast();

  const query = params.get('q') ?? '';
  const usageFilter = (params.get('uso') as UsageFilter) || 'todas';
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

  const usage = useMemo(() => {
    const map = new Map<number, Usage>();
    for (const l of schedule.data?.lessons ?? []) {
      if (!l.subjectId) continue;
      const cur = map.get(l.subjectId) ?? { lessons: 0, minutes: 0, teachers: 0, classes: 0 };
      cur.lessons++;
      cur.minutes += durationMinutes(l.start, l.end);
      map.set(l.subjectId, cur);
    }
    for (const [id, u] of map) {
      const ls = (schedule.data?.lessons ?? []).filter((l) => l.subjectId === id);
      u.teachers = new Set(ls.map((l) => l.teacherId)).size;
      u.classes = new Set(ls.map((l) => l.classId)).size;
    }
    return map;
  }, [schedule.data]);

  const all = schedule.data?.subjects ?? [];
  const inUse = all.filter((s) => usage.has(s.id)).length;
  const counts = { todas: all.length, 'em-uso': inUse, 'sem-aulas': all.length - inUse };
  const filtered = all.filter(
    (s) =>
      (usageFilter === 'todas' || (usageFilter === 'em-uso' ? usage.has(s.id) : !usage.has(s.id))) &&
      matches([s.name, SUBJECT_STYLE[s.color].name], query),
  );
  const hasFilters = Boolean(query || usageFilter !== 'todas');
  const withoutSubject = (schedule.data?.lessons ?? []).filter((l) => !l.subjectId).length;

  async function remove(s: Subject) {
    try {
      await del.mutateAsync({ id: s.id, detachLessons: (usage.get(s.id)?.lessons ?? 0) > 0 });
      toast.success('Disciplina excluída', s.name);
      setRemoving(null);
    } catch (error) {
      toast.error('Não foi possível excluir', errorMessage(error));
    }
  }

  const removingCount = removing ? usage.get(removing.id)?.lessons ?? 0 : 0;

  return (
    <Page
      title="Disciplinas"
      breadcrumbs={[{ label: 'Início', to: '/' }, { label: 'Disciplinas' }]}
      description={
        schedule.data
          ? `${plural(all.length, 'disciplina cadastrada', 'disciplinas cadastradas')}${withoutSubject ? ` · ${plural(withoutSubject, 'aula sem disciplina', 'aulas sem disciplina')}` : ''}`
          : undefined
      }
      actions={
        <>
          <ImportButton kind="subjects" />
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={openNew} title="Atalho: N">
            Nova disciplina
          </Button>
        </>
      }
    >
      <DataGate data={schedule.data} isLoading={schedule.isLoading} error={schedule.error} onRetry={schedule.refetch}>
        {() =>
          all.length === 0 ? (
            <Card>
              <EmptyState
                icon={<BookOpen />}
                title="Nenhuma disciplina cadastrada"
                description="As disciplinas identificam as aulas nas grades com nome e cor, e permitem filtrar o quadro. Cadastre uma a uma ou importe a lista de uma planilha."
                action={
                  <>
                    <ImportButton kind="subjects" label="Importar planilha" />
                    <Button variant="primary" icon={<Plus className="size-4" />} onClick={openNew}>
                      Cadastrar disciplina
                    </Button>
                  </>
                }
              />
            </Card>
          ) : (
            <Card className="overflow-visible">
              <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center">
                <SearchInput value={query} onChange={(v) => setParam('q', v)} placeholder="Pesquisar disciplina" label="Pesquisar disciplinas" className="lg:w-72" />
                <Segmented
                  label="Uso no quadro"
                  value={usageFilter}
                  onChange={(v) => setParam('uso', v, 'todas')}
                  options={[
                    { value: 'todas', label: 'Todas', count: counts.todas },
                    { value: 'em-uso', label: 'Em uso', count: counts['em-uso'] },
                    { value: 'sem-aulas', label: 'Sem aulas', count: counts['sem-aulas'] },
                  ]}
                />
                {hasFilters && (
                  <Button variant="ghost" size="sm" icon={<FilterX className="size-4" />} onClick={clearFilters} className="lg:ml-auto">
                    Limpar filtros
                  </Button>
                )}
              </div>

              {filtered.length === 0 ? (
                <EmptyState
                  compact
                  title="Nenhuma disciplina encontrada"
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
                    <caption className="sr-only">Lista de disciplinas</caption>
                    <thead>
                      <tr className="border-b border-line text-left text-xs text-muted">
                        <th scope="col" className="px-4 py-2.5 font-semibold">Disciplina</th>
                        <th scope="col" className="px-4 py-2.5 font-semibold">Aulas semanais</th>
                        <th scope="col" className="px-4 py-2.5 font-semibold">Carga horária</th>
                        <th scope="col" className="px-4 py-2.5 font-semibold">Professores</th>
                        <th scope="col" className="px-4 py-2.5 font-semibold">Turmas</th>
                        <th scope="col" className="px-4 py-2.5"><span className="sr-only">Ações</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((s) => {
                        const u = usage.get(s.id);
                        return (
                          <tr key={s.id} className="border-b border-line transition-colors last:border-b-0 hover:bg-subtle">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <span className={cn('h-9 w-[4px] shrink-0 rounded-full', SUBJECT_STYLE[s.color].bar)} aria-hidden="true" />
                                <div className="min-w-0">
                                  <button type="button" onClick={() => setEditing(s)} className="block truncate text-left font-semibold text-ink hover:underline underline-offset-2">
                                    {s.name}
                                  </button>
                                  <span className="text-xs text-muted">{SUBJECT_STYLE[s.color].name}</span>
                                </div>
                              </div>
                            </td>
                            <td className="tabular px-4 py-3 text-ink-2">{u ? <strong className="font-semibold text-ink">{u.lessons}</strong> : <Badge>Sem aulas</Badge>}</td>
                            <td className="tabular px-4 py-3 text-ink-2">{u ? formatHours(u.minutes) : <span className="text-soft">—</span>}</td>
                            <td className="tabular px-4 py-3 text-ink-2">{u?.teachers ?? <span className="text-soft">—</span>}</td>
                            <td className="tabular px-4 py-3 text-ink-2">{u?.classes ?? <span className="text-soft">—</span>}</td>
                            <td className="px-2 py-3">
                              <RowActions subject={s} onEdit={() => setEditing(s)} onDelete={() => setRemoving(s)} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  <ul className="divide-y divide-line md:hidden">
                    {filtered.map((s) => {
                      const u = usage.get(s.id);
                      return (
                        <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                          <span className={cn('h-9 w-[4px] shrink-0 rounded-full', SUBJECT_STYLE[s.color].bar)} aria-hidden="true" />
                          <button type="button" onClick={() => setEditing(s)} className="min-w-0 flex-1 text-left">
                            <span className="block truncate font-semibold">{s.name}</span>
                            <span className="block truncate text-xs text-muted">
                              {u ? `${plural(u.lessons, 'aula', 'aulas')} · ${plural(u.classes, 'turma', 'turmas')}` : 'Sem aulas'}
                            </span>
                          </button>
                          <RowActions subject={s} compact onEdit={() => setEditing(s)} onDelete={() => setRemoving(s)} />
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

      <SubjectFormModal subject={editing} onClose={() => setEditing(null)} />

      <ConfirmDialog
        open={removing !== null}
        title={`Excluir ${removing?.name ?? 'disciplina'}?`}
        confirmLabel="Excluir disciplina"
        loading={del.isPending}
        onClose={() => setRemoving(null)}
        onConfirm={() => removing && void remove(removing)}
      >
        {removingCount > 0 ? (
          <p>
            Esta disciplina está em {plural(removingCount, 'aula', 'aulas')}. As aulas <strong>serão mantidas</strong> no quadro, mas ficarão sem disciplina
            definida.
          </p>
        ) : (
          <p>A disciplina não está em nenhuma aula e será removida permanentemente.</p>
        )}
      </ConfirmDialog>
    </Page>
  );
}

function RowActions({ subject, onEdit, onDelete, compact }: { subject: Subject; onEdit: () => void; onDelete: () => void; compact?: boolean }) {
  const navigate = useNavigate();
  return (
    <div className="flex items-center justify-end gap-0.5">
      {!compact && (
        <>
          <IconButton label={`Ver ${subject.name} no quadro`} size="sm" onClick={() => navigate(`/horarios?disciplina=${subject.id}`)}>
            <Table2 className="size-4" />
          </IconButton>
          <IconButton label={`Editar ${subject.name}`} size="sm" onClick={onEdit}>
            <Pencil className="size-4" />
          </IconButton>
        </>
      )}
      <Menu
        label={`Mais ações para ${subject.name}`}
        items={[
          ...(compact ? [{ label: 'Editar', icon: <Pencil />, onSelect: onEdit }] : []),
          { label: 'Excluir', icon: <Trash2 />, onSelect: onDelete, tone: 'danger' as const },
        ]}
      />
    </div>
  );
}
