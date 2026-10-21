import { useEffect, useMemo, useState } from 'react';
import { ArrowDownUp, Coffee, Plus, Trash2, Wand2 } from 'lucide-react';
import { Alert, Badge, Button, Card, ConfirmDialog, Field, IconButton, Input, Modal, Segmented, Select, useToast } from '@/components/ui';
import { useSavePeriods, type PeriodDraft, type ScheduleData } from '@/api/hooks';
import { ApiError, errorMessage } from '@/api/client';
import { periodsReplaceSchema } from '@shared/schemas';
import { SHIFT_LABEL, WEEKDAY_LABEL, shiftsOfClass } from '@shared/labels';
import { fromMinutes, overlaps, TIME_PATTERN, toMinutes } from '@shared/time';
import { SHIFT_KEYS, type Lesson, type Period, type ShiftKey } from '@shared/types';
import { cn } from '@/lib/cn';
import { plural } from '@/lib/text';

interface Row extends PeriodDraft {
  key: string;
}

let keySeq = 0;
const toRows = (periods: Period[], shift: ShiftKey): Row[] =>
  periods
    .filter((p) => p.shift === shift)
    .sort((a, b) => a.start.localeCompare(b.start))
    .map((p) => ({ key: `p${p.id}`, label: p.label, start: p.start, end: p.end, kind: p.kind }));

export function PeriodSettings({ data }: { data: ScheduleData }) {
  const [shift, setShift] = useState<ShiftKey>(data.settings.enabledShifts[0] ?? 'manha');
  const [rows, setRows] = useState<Row[]>(() => toRows(data.periods, shift));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [impact, setImpact] = useState<Lesson[] | null>(null);
  const [generator, setGenerator] = useState(false);
  const [pendingShift, setPendingShift] = useState<ShiftKey | null>(null);
  const save = useSavePeriods();
  const toast = useToast();

  const original = useMemo(() => toRows(data.periods, shift), [data.periods, shift]);
  const strip = (r: Row[]) => JSON.stringify(r.map(({ label, start, end, kind }) => ({ label, start, end, kind })));
  const dirty = strip(rows) !== strip(original);

  useEffect(() => {
    setRows(toRows(data.periods, shift));
    setErrors({});
  }, [shift]);

  const duration = data.settings.lessonDuration;

  function update(key: string, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
    setErrors({});
  }

  function add(kind: 'aula' | 'intervalo') {
    setRows((rs) => {
      const last = [...rs].sort((a, b) => a.end.localeCompare(b.end)).at(-1);
      const start = last && TIME_PATTERN.test(last.end) ? last.end : shift === 'manha' ? '07:00' : shift === 'tarde' ? '13:00' : '18:30';
      const len = kind === 'aula' ? duration : 20;
      const n = rs.filter((r) => r.kind === 'aula').length + 1;
      return [...rs, { key: `n${++keySeq}`, kind, label: kind === 'aula' ? `${n}º horário` : 'Intervalo', start, end: fromMinutes(toMinutes(start) + len) }];
    });
  }

  function sortRows() {
    setRows((rs) => [...rs].sort((a, b) => a.start.localeCompare(b.start)));
  }

  function validate(): PeriodDraft[] | null {
    const payload = rows.map(({ label, start, end, kind }) => ({ label, start, end, kind }));
    const parsed = periodsReplaceSchema.safeParse({ periods: payload });
    if (parsed.success) {
      setErrors({});
      return parsed.data.periods;
    }
    const e: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const [, idx, field] = issue.path;
      const key = typeof idx === 'number' ? `${rows[idx].key}.${String(field)}` : '_';
      e[key] ??= issue.message;
    }
    setErrors(e);
    return null;
  }

  /** Aulas que hoje aparecem na grade deste turno e passariam a ficar fora dela. */
  function computeImpact(next: PeriodDraft[]): Lesson[] {
    const classIds = new Set(data.classes.filter((c) => shiftsOfClass(c.shift).includes(shift)).map((c) => c.id));
    const otherPeriods = data.periods.filter((p) => p.shift !== shift && p.kind === 'aula');
    const fits = (l: Lesson, ps: { start: string; end: string; kind: string }[]) => ps.some((p) => p.kind === 'aula' && overlaps(p.start, p.end, l.start, l.end));
    return data.lessons.filter(
      (l) => classIds.has(l.classId) && fits(l, original) && !fits(l, next) && !fits(l, otherPeriods),
    );
  }

  function submit() {
    const next = validate();
    if (!next) return;
    const affected = computeImpact(next);
    if (affected.length) setImpact(affected);
    else void persist(next);
  }

  async function persist(next: PeriodDraft[]) {
    try {
      const saved = await save.mutateAsync({ shift, periods: next });
      setRows(toRows(saved, shift));
      setImpact(null);
      toast.success('Horários salvos', `Turno ${SHIFT_LABEL[shift].toLowerCase()}`);
    } catch (error) {
      if (error instanceof ApiError && error.fields) {
        toast.error('Revise os horários', Object.values(error.fields)[0]);
      } else toast.error('Não foi possível salvar', errorMessage(error));
    }
  }

  const lessonCount = rows.filter((r) => r.kind === 'aula').length;
  const first = rows.length ? [...rows].sort((a, b) => a.start.localeCompare(b.start))[0].start : null;
  const last = rows.length ? [...rows].sort((a, b) => a.end.localeCompare(b.end)).at(-1)!.end : null;
  const outOfOrder = rows.some((r, i) => i > 0 && r.start < rows[i - 1].start);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Segmented
          label="Turno"
          value={shift}
          onChange={(v) => (dirty ? setPendingShift(v) : setShift(v))}
          options={SHIFT_KEYS.map((k) => ({ value: k, label: SHIFT_LABEL[k] }))}
        />
        {!data.settings.enabledShifts.includes(shift) && <Badge tone="warning">Turno desativado no calendário</Badge>}
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h2 className="text-[15px] font-bold">Horários do turno {SHIFT_LABEL[shift].toLowerCase()}</h2>
            <p className="tabular text-[13px] text-muted">
              {rows.length ? `${plural(lessonCount, 'período de aula', 'períodos de aula')} · das ${first} às ${last}` : 'Nenhum período cadastrado'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {outOfOrder && (
              <Button size="sm" variant="ghost" icon={<ArrowDownUp className="size-4" />} onClick={sortRows}>
                Ordenar por horário
              </Button>
            )}
            <Button size="sm" icon={<Wand2 className="size-4" />} onClick={() => setGenerator(true)}>
              Gerar automaticamente
            </Button>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="font-bold">Este turno ainda não tem horários</p>
            <p className="mt-1 text-sm text-muted">Adicione os períodos um a um ou gere a sequência completa automaticamente.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-muted">
                  <th scope="col" className="px-5 py-2.5 font-semibold">Tipo</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">Nome</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">Início</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">Término</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">Duração</th>
                  <th scope="col" className="px-5 py-2.5"><span className="sr-only">Remover</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const mins = TIME_PATTERN.test(r.start) && TIME_PATTERN.test(r.end) ? toMinutes(r.end) - toMinutes(r.start) : null;
                  const err = errors[`${r.key}.start`] ?? errors[`${r.key}.end`] ?? errors[`${r.key}.label`];
                  return (
                    <tr key={r.key} className={cn('border-b border-line align-top last:border-b-0', r.kind === 'intervalo' && 'bg-subtle/70')}>
                      <td className="px-5 py-2.5">
                        <Select
                          aria-label="Tipo do período"
                          value={r.kind}
                          onChange={(e) => update(r.key, { kind: e.target.value as Row['kind'] })}
                          className="w-[132px]"
                        >
                          <option value="aula">Aula</option>
                          <option value="intervalo">Intervalo</option>
                        </Select>
                      </td>
                      <td className="px-3 py-2.5">
                        <Input
                          aria-label="Nome do período"
                          value={r.label}
                          maxLength={30}
                          aria-invalid={Boolean(errors[`${r.key}.label`]) || undefined}
                          onChange={(e) => update(r.key, { label: e.target.value })}
                        />
                        {err && <p className="mt-1 text-xs font-medium text-danger">{err}</p>}
                      </td>
                      <td className="px-3 py-2.5">
                        <Input
                          type="time"
                          aria-label="Início"
                          value={r.start}
                          className="tabular w-[118px]"
                          aria-invalid={Boolean(errors[`${r.key}.start`]) || undefined}
                          onChange={(e) => update(r.key, { start: e.target.value })}
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <Input
                          type="time"
                          aria-label="Término"
                          value={r.end}
                          className="tabular w-[118px]"
                          aria-invalid={Boolean(errors[`${r.key}.end`]) || undefined}
                          onChange={(e) => update(r.key, { end: e.target.value })}
                        />
                      </td>
                      <td className="tabular px-3 py-2.5 pt-5 text-muted">{mins !== null && mins > 0 ? `${mins} min` : '—'}</td>
                      <td className="px-5 py-2.5 text-right">
                        <IconButton label={`Remover ${r.label || 'período'}`} tone="danger" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}>
                          <Trash2 className="size-4" />
                        </IconButton>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap gap-2 border-t border-line px-5 py-3">
          <Button size="sm" icon={<Plus className="size-4" />} onClick={() => add('aula')} disabled={rows.length >= 20}>
            Adicionar aula
          </Button>
          <Button size="sm" variant="ghost" icon={<Coffee className="size-4" />} onClick={() => add('intervalo')} disabled={rows.length >= 20}>
            Adicionar intervalo
          </Button>
        </div>
      </Card>

      {errors._ && <Alert tone="danger" title={errors._} />}

      <div className="sticky bottom-0 z-10 -mx-4 flex items-center justify-end gap-3 border-t border-line bg-canvas/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border sm:bg-surface">
        {dirty && <span className="mr-auto text-[13px] font-medium text-warning">Há alterações não salvas neste turno</span>}
        <Button disabled={!dirty || save.isPending} onClick={() => (setRows(original), setErrors({}))}>
          Descartar
        </Button>
        <Button variant="primary" disabled={!dirty} loading={save.isPending} onClick={submit}>
          Salvar horários
        </Button>
      </div>

      <ConfirmDialog
        open={impact !== null}
        tone="primary"
        title="Algumas aulas ficarão fora da grade"
        confirmLabel="Salvar horários"
        loading={save.isPending}
        onClose={() => setImpact(null)}
        onConfirm={() => {
          const next = validate();
          if (next) void persist(next);
        }}
      >
        <p>
          Com os novos horários, {plural(impact?.length ?? 0, 'aula deixará', 'aulas deixarão')} de coincidir com os períodos do turno. Elas{' '}
          <strong>não serão alteradas nem excluídas</strong> e passarão a aparecer na lista &ldquo;Fora da grade&rdquo;, onde podem ser ajustadas.
        </p>
        <ul className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-line p-3 text-[13px]">
          {impact?.slice(0, 12).map((l) => (
            <li key={l.id} className="tabular">
              {WEEKDAY_LABEL[l.weekday]}, {l.start}–{l.end} · Turma {data.classes.find((c) => c.id === l.classId)?.name}
            </li>
          ))}
          {impact && impact.length > 12 && <li className="text-muted">e mais {impact.length - 12}…</li>}
        </ul>
      </ConfirmDialog>

      <ConfirmDialog
        open={pendingShift !== null}
        tone="primary"
        title="Descartar alterações não salvas?"
        confirmLabel="Descartar e trocar de turno"
        onClose={() => setPendingShift(null)}
        onConfirm={() => {
          if (pendingShift) setShift(pendingShift);
          setPendingShift(null);
        }}
      >
        <p>As mudanças feitas nos horários do turno {SHIFT_LABEL[shift].toLowerCase()} ainda não foram salvas.</p>
      </ConfirmDialog>

      <GeneratorModal
        open={generator}
        shift={shift}
        defaultDuration={duration}
        onClose={() => setGenerator(false)}
        onApply={(generated) => {
          setRows(generated.map((g) => ({ ...g, key: `n${++keySeq}` })));
          setGenerator(false);
          toast.info('Sequência gerada', 'Revise os horários e clique em Salvar horários para aplicar.');
        }}
      />
    </div>
  );
}

function GeneratorModal({
  open,
  shift,
  defaultDuration,
  onClose,
  onApply,
}: {
  open: boolean;
  shift: ShiftKey;
  defaultDuration: number;
  onClose: () => void;
  onApply: (rows: PeriodDraft[]) => void;
}) {
  const defaults = { manha: '07:00', tarde: '13:00', noite: '18:30' } as const;
  const [start, setStart] = useState<string>(defaults[shift]);
  const [count, setCount] = useState('6');
  const [length, setLength] = useState(String(defaultDuration));
  const [breakAfter, setBreakAfter] = useState('3');
  const [breakLength, setBreakLength] = useState('20');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setStart(defaults[shift]);
      setLength(String(defaultDuration));
      setError(null);
    }
  }, [open, shift, defaultDuration]);

  function build(): PeriodDraft[] | null {
    const n = Number(count);
    const len = Number(length);
    const after = Number(breakAfter);
    const bl = Number(breakLength);
    if (!TIME_PATTERN.test(start)) return setError('Informe o horário de início.'), null;
    if (!Number.isInteger(n) || n < 1 || n > 12) return setError('A quantidade de aulas deve estar entre 1 e 12.'), null;
    if (!Number.isInteger(len) || len < 20 || len > 180) return setError('A duração da aula deve estar entre 20 e 180 minutos.'), null;
    if (after > 0 && (!Number.isInteger(bl) || bl < 5 || bl > 90)) return setError('O intervalo deve ter entre 5 e 90 minutos.'), null;
    const out: PeriodDraft[] = [];
    let t = toMinutes(start);
    for (let i = 1; i <= n; i++) {
      out.push({ kind: 'aula', label: `${i}º horário`, start: fromMinutes(t), end: fromMinutes(t + len) });
      t += len;
      if (after > 0 && i === after && i < n) {
        out.push({ kind: 'intervalo', label: 'Intervalo', start: fromMinutes(t), end: fromMinutes(t + bl) });
        t += bl;
      }
    }
    if (t > 23 * 60 + 59) return setError('A sequência ultrapassa o fim do dia. Reduza a quantidade ou a duração.'), null;
    setError(null);
    return out;
  }

  const preview = (() => {
    const n = Number(count);
    const len = Number(length);
    const after = Number(breakAfter);
    if (!TIME_PATTERN.test(start) || !n || !len) return null;
    const total = n * len + (after > 0 && after < n ? Number(breakLength) || 0 : 0);
    return `${start} às ${fromMinutes(toMinutes(start) + total)}`;
  })();

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title="Gerar horários automaticamente"
      description={`Monta a sequência do turno ${SHIFT_LABEL[shift].toLowerCase()}. Os períodos atuais deste turno serão substituídos na tela antes de salvar.`}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button
            variant="primary"
            onClick={() => {
              const r = build();
              if (r) onApply(r);
            }}
          >
            Gerar sequência
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label="Início da primeira aula">
          <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="tabular" />
        </Field>
        <Field label="Quantidade de aulas">
          <Input type="number" min={1} max={12} value={count} onChange={(e) => setCount(e.target.value)} className="tabular" />
        </Field>
        <Field label="Duração de cada aula" hint="Em minutos">
          <Input type="number" min={20} max={180} step={5} value={length} onChange={(e) => setLength(e.target.value)} className="tabular" />
        </Field>
        <Field label="Intervalo após a aula nº" hint="Use 0 para não incluir">
          <Input type="number" min={0} max={12} value={breakAfter} onChange={(e) => setBreakAfter(e.target.value)} className="tabular" />
        </Field>
        <Field label="Duração do intervalo" hint="Em minutos" className="col-span-2 sm:col-span-1">
          <Input type="number" min={5} max={90} step={5} value={breakLength} onChange={(e) => setBreakLength(e.target.value)} className="tabular" disabled={Number(breakAfter) === 0} />
        </Field>
      </div>
      {preview && !error && <p className="tabular mt-4 text-[13px] text-muted">O turno ficará das {preview}.</p>}
      {error && <Alert tone="danger" title={error} className="mt-4" />}
    </Modal>
  );
}
