import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { matches } from '@/lib/text';

export interface ReportOption { value: number; label: string; description?: string }
/** null inclui todos; [] é uma seleção vazia explícita. */
export function ReportSelection({ label, allLabel, options, value, onChange, disabled }: {
  label: string; allLabel: string; options: ReportOption[]; value: number[] | null;
  onChange: (value: number[] | null) => void; disabled?: boolean;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  const filtered = options.filter((option) => matches([option.label, option.description], query));
  const selected = options.filter((option) => value?.includes(option.value));
  return <div ref={root} className="relative min-w-0" onKeyDown={(event) => { if (open && event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setOpen(false); } }}>
    <p id={`${id}-label`} className="mb-2 text-sm font-bold">{label}</p>
    <div className="mb-2 flex rounded-lg border border-line p-1" role="group" aria-labelledby={`${id}-label`}>
      <button type="button" className={`min-h-9 min-w-0 flex-1 rounded-md px-2 py-1 text-sm font-semibold ${value === null ? 'bg-ink text-white' : 'text-muted hover:bg-subtle'}`} aria-pressed={value === null}
        disabled={disabled} onClick={() => {onChange(null);setOpen(false);setQuery('');}}>{allLabel}</button>
      <button type="button" className={`min-h-9 shrink-0 rounded-md px-2 py-1 text-sm font-semibold ${value !== null ? 'bg-ink text-white' : 'text-muted hover:bg-subtle'}`} aria-pressed={value !== null} disabled={disabled}
        onClick={() => {if(value === null) onChange([]);setOpen(true);}}>Escolher</button>
    </div>
    {value === null ? <p className="text-xs text-muted">Todos incluídos, respeitando os outros filtros.</p> : <>
      <button type="button" disabled={disabled} aria-expanded={open} aria-controls={`${id}-options`} onClick={() => setOpen(!open)}
        className="flex min-h-10 w-full items-center gap-2 rounded-md border border-line-strong bg-surface px-3 py-2 text-left text-sm">
        <span className="min-w-0 flex-1 break-words">{selected.length ? `${selected.length} selecionado(s): ${selected.slice(0,2).map((option) => option.label).join(', ')}${selected.length > 2 ? '…' : ''}` : 'Nenhum selecionado — escolha na lista'}</span><ChevronDown className="size-4 shrink-0" />
      </button>
      {open && <div id={`${id}-options`} className="absolute z-50 mt-1 w-full rounded-xl border border-line bg-surface p-3 shadow-pop">
        <Input autoFocus aria-label={`Pesquisar ${label.toLowerCase()}`} placeholder="Pesquisar na lista" value={query} onChange={(event) => setQuery(event.target.value)} />
        <div className="my-2 flex flex-wrap gap-1">
          <Button size="sm" variant="ghost" onClick={() => onChange([...new Set([...(value ?? []), ...filtered.map((option) => option.value)])])}>Marcar lista</Button>
          <Button size="sm" variant="ghost" onClick={() => onChange([])}>Desmarcar todos</Button>
        </div>
        <div className="max-h-52 overflow-auto overscroll-contain">
          {filtered.map((option) => <label key={option.value} className="flex cursor-pointer items-start gap-2 rounded-lg p-2 hover:bg-subtle">
            <input type="checkbox" className="mt-1 size-4 shrink-0 accent-ink" checked={value.includes(option.value)} onChange={() => onChange(value.includes(option.value) ? value.filter((id) => id !== option.value) : [...value,option.value])} />
            <span className="min-w-0 text-sm"><span className="block break-words">{option.label}</span>{option.description && <span className="block text-xs text-muted">{option.description}</span>}</span>
          </label>)}
          {!filtered.length && <p className="p-3 text-sm text-muted">Nenhum resultado nesta lista.</p>}
        </div>
        <Button className="mt-2 w-full" variant="primary" size="sm" onClick={() => setOpen(false)}><Check className="size-4" />Concluir seleção</Button>
      </div>}
    </>}
  </div>;
}
