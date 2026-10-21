import { useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileUp,
  RefreshCw,
  SkipForward,
  Sparkles,
  Upload,
  XCircle,
} from 'lucide-react';
import { Alert, Badge, Button, Modal, Segmented, Select, Switch, useToast } from '@/components/ui';
import { useImport } from '@/api/hooks';
import { errorMessage } from '@/api/client';
import { cn } from '@/lib/cn';
import { plural } from '@/lib/text';
import {
  detectHeaderRow,
  downloadCsv,
  downloadTemplate,
  downloadTemplateCsv,
  readSpreadsheet,
  SpreadsheetError,
  type Sheet,
} from '@/lib/spreadsheet';
import {
  IMPORT_SPECS,
  MAX_IMPORT_ROWS,
  guessMapping,
  type ImportKind,
  type ImportOptions,
  type ImportReport,
  type ImportRowInput,
  type ImportRowStatus,
} from '@shared/import';

export interface ImportFixed {
  teacherId?: number;
  classId?: number;
  /** Ex.: "Ana Souza" — aparece no título e nas explicações. */
  label: string;
}

type Step = 'pick' | 'map' | 'review' | 'done';

const STATUS: Record<ImportRowStatus, { label: string; tone: 'success' | 'info' | 'neutral' | 'danger'; icon: ReactNode }> = {
  create: { label: 'Nova', tone: 'success', icon: <Sparkles className="size-3.5" /> },
  update: { label: 'Atualizada', tone: 'info', icon: <RefreshCw className="size-3.5" /> },
  skip: { label: 'Ignorada', tone: 'neutral', icon: <SkipForward className="size-3.5" /> },
  error: { label: 'Com erro', tone: 'danger', icon: <XCircle className="size-3.5" /> },
};

const MAX_RENDERED_ROWS = 400;

/**
 * Assistente de importação de planilhas: arquivo → colunas → revisão (validada pelo servidor) → resultado.
 * Nada é gravado antes da confirmação na etapa de revisão.
 */
export function ImportDialog({ kind, open, onClose, fixed }: { kind: ImportKind; open: boolean; onClose: () => void; fixed?: ImportFixed }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      dismissible={false}
      title={IMPORT_SPECS[kind].title + (fixed ? ` · ${fixed.label}` : '')}
      description="Excel (.xlsx) ou CSV. Você revisa tudo antes de gravar."
    >
      {open && <ImportWizard kind={kind} fixed={fixed} onClose={onClose} />}
    </Modal>
  );
}

function ImportWizard({ kind, fixed, onClose }: { kind: ImportKind; fixed?: ImportFixed; onClose: () => void }) {
  const spec = IMPORT_SPECS[kind];
  const hidden = new Set([fixed?.teacherId ? 'teacher' : '', fixed?.classId ? 'class' : ''].filter(Boolean));
  const columns = spec.columns.filter((c) => !hidden.has(c.key));
  const toast = useToast();
  const mutation = useImport(kind);

  const [step, setStep] = useState<Step>('pick');
  const [fileName, setFileName] = useState('');
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [sheetIdx, setSheetIdx] = useState(0);
  const [headerRow, setHeaderRow] = useState(0);
  const [mapping, setMapping] = useState<Record<string, number | null>>({});
  const [readError, setReadError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [options, setOptions] = useState<ImportOptions>({ existing: 'update', createMissingSubjects: true, replaceExisting: false });
  const [preview, setPreview] = useState<ImportReport | null>(null);
  const [result, setResult] = useState<ImportReport | null>(null);

  const sheet = sheets[sheetIdx];
  const headers = sheet?.rows[headerRow] ?? [];

  function selectSheet(idx: number, list = sheets) {
    const rows = list[idx].rows;
    const h = detectHeaderRow(rows);
    setSheetIdx(idx);
    setHeaderRow(h);
    setMapping(guessMapping(spec, rows[h] ?? []));
  }

  async function onFile(file: File) {
    setReading(true);
    setReadError(null);
    try {
      const list = await readSpreadsheet(file);
      setSheets(list);
      setFileName(file.name);
      // Prefere a aba cujo cabeçalho reconhece mais colunas.
      const scores = list.map((s) => Object.values(guessMapping(spec, s.rows[detectHeaderRow(s.rows)] ?? [])).filter((v) => v !== null).length);
      selectSheet(scores.indexOf(Math.max(...scores)), list);
      setStep('map');
    } catch (error) {
      setReadError(error instanceof SpreadsheetError ? error.message : 'Não foi possível ler o arquivo. Use uma planilha .xlsx ou .csv.');
    } finally {
      setReading(false);
    }
  }

  const rows: ImportRowInput[] = useMemo(() => {
    if (!sheet) return [];
    const out: ImportRowInput[] = [];
    sheet.rows.forEach((cells, i) => {
      if (i <= headerRow) return;
      const values: Record<string, string> = {};
      for (const c of columns) {
        const idx = mapping[c.key];
        values[c.key] = idx === null || idx === undefined ? '' : (cells[idx] ?? '').trim();
      }
      if (Object.values(values).some((v) => v !== '')) out.push({ line: i + 1, values });
    });
    return out;
  }, [sheet, headerRow, mapping, columns.length]);

  const missingRequired = columns.filter((c) => c.required && (mapping[c.key] === null || mapping[c.key] === undefined));
  const lessonTimeMissing =
    kind === 'lessons' && mapping.slot == null && (mapping.start == null || mapping.end == null) ? ['Horário (ou Início e Término)'] : [];
  const blockers = [...missingRequired.map((c) => c.label), ...lessonTimeMissing];

  const requestOptions: ImportOptions = { ...options, fixedTeacherId: fixed?.teacherId, fixedClassId: fixed?.classId };

  async function validate() {
    try {
      const report = await mutation.mutateAsync({ rows, options: requestOptions, dryRun: true });
      setPreview(report);
      setStep('review');
    } catch (error) {
      toast.error('Não foi possível verificar a planilha', errorMessage(error));
    }
  }

  async function commit() {
    try {
      const report = await mutation.mutateAsync({ rows, options: requestOptions, dryRun: false });
      setResult(report);
      setStep('done');
      const saved = report.summary.create + report.summary.update;
      if (saved) toast.success('Importação concluída', `${plural(saved, 'registro gravado', 'registros gravados')}.`);
    } catch (error) {
      toast.error('Não foi possível importar', errorMessage(error));
    }
  }

  function downloadErrors(report: ImportReport) {
    const byLine = new Map(rows.map((r) => [r.line, r.values]));
    const failed = report.rows.filter((r) => r.status === 'error');
    downloadCsv(
      `${spec.fileName.replace('modelo-', '')}-linhas-com-erro.csv`,
      ['Linha', ...columns.map((c) => c.label), 'Problemas'],
      failed.map((r) => [String(r.line), ...columns.map((c) => byLine.get(r.line)?.[c.key] ?? ''), r.messages.join(' | ')]),
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <Stepper step={step} />

      {step === 'pick' && (
        <>
          <DropZone onFile={onFile} reading={reading} />
          {readError && <Alert tone="danger" title="Arquivo não lido">{readError}</Alert>}
          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-start">
            <div>
              <h3 className="text-sm font-bold text-ink">Colunas esperadas</h3>
              <p className="mt-0.5 text-[13px] text-muted">A ordem não importa e os nomes são reconhecidos com ou sem acentos.</p>
              <ul className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
                {columns.map((c) => (
                  <li key={c.key} className="text-[13px]">
                    <span className="font-semibold text-ink">{c.label}</span>
                    {c.required ? <span className="ml-1 text-danger">*</span> : <span className="ml-1.5 text-xs text-soft">opcional</span>}
                    <span className="block text-muted">{c.hint}</span>
                  </li>
                ))}
              </ul>
              {fixed && (
                <p className="mt-3 text-[13px] text-muted">
                  Todas as linhas serão lançadas para <strong className="text-ink">{fixed.label}</strong>, então essa coluna não é necessária.
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2 rounded-lg bg-subtle p-4 md:w-60">
              <p className="text-[13px] font-semibold text-ink">Comece pelo modelo</p>
              <p className="text-xs text-muted">Já vem com exemplos, listas de opções e instruções.</p>
              <Button size="sm" variant="dark" icon={<FileSpreadsheet className="size-4" />} onClick={() => void downloadTemplate(spec)}>
                Modelo Excel
              </Button>
              <Button size="sm" icon={<Download className="size-4" />} onClick={() => downloadTemplateCsv(spec)}>
                Modelo CSV
              </Button>
            </div>
          </div>
          {spec.notes.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-[13px] text-muted">
              {spec.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          )}
        </>
      )}

      {step === 'map' && sheet && (
        <>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg bg-subtle px-4 py-3 text-sm">
            <FileSpreadsheet className="size-5 text-muted" />
            <span className="min-w-0 flex-1 truncate font-semibold text-ink">{fileName}</span>
            {sheets.length > 1 && (
              <div className="w-56">
                <Select aria-label="Aba da planilha" value={sheetIdx} onChange={(e) => selectSheet(Number(e.target.value))}>
                  {sheets.map((s, i) => (
                    <option key={s.name + i} value={i}>
                      Aba: {s.name}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            <div className="w-48">
              <Select
                aria-label="Linha do cabeçalho"
                value={headerRow}
                onChange={(e) => {
                  const h = Number(e.target.value);
                  setHeaderRow(h);
                  setMapping(guessMapping(spec, sheet.rows[h] ?? []));
                }}
              >
                {sheet.rows.slice(0, 15).map((_, i) => (
                  <option key={i} value={i}>
                    Cabeçalho na linha {i + 1}
                  </option>
                ))}
              </Select>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setStep('pick')}>
              Trocar arquivo
            </Button>
          </div>

          <section>
            <h3 className="text-sm font-bold text-ink">Associe as colunas</h3>
            <p className="mt-0.5 text-[13px] text-muted">Reconhecemos automaticamente o que foi possível. Ajuste o que estiver diferente.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {columns.map((c) => {
                const value = mapping[c.key];
                const missing = c.required && (value === null || value === undefined);
                return (
                  <label key={c.key} className="flex flex-col gap-1.5">
                    <span className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-2">
                      {c.label}
                      {c.required && <span className="text-danger">*</span>}
                      {value !== null && value !== undefined && <CheckCircle2 className="size-3.5 text-success" aria-label="associada" />}
                    </span>
                    <Select
                      aria-invalid={missing || undefined}
                      value={value ?? ''}
                      onChange={(e) => setMapping((m) => ({ ...m, [c.key]: e.target.value === '' ? null : Number(e.target.value) }))}
                    >
                      <option value="">{c.required ? 'Selecione a coluna' : 'Não importar'}</option>
                      {headers.map((h, i) => (
                        <option key={i} value={i}>
                          {h || `Coluna ${i + 1} (sem título)`}
                        </option>
                      ))}
                    </Select>
                  </label>
                );
              })}
            </div>
          </section>

          <PreviewTable columns={columns} rows={rows.slice(0, 5)} />

          <ImportSettings kind={kind} fixed={fixed} options={options} onChange={setOptions} />

          {rows.length > MAX_IMPORT_ROWS && (
            <Alert tone="warning" title="Planilha grande demais">
              Há {rows.length.toLocaleString('pt-BR')} linhas. Importe no máximo {MAX_IMPORT_ROWS.toLocaleString('pt-BR')} por vez.
            </Alert>
          )}
          {blockers.length > 0 && <Alert tone="warning">Associe as colunas obrigatórias: {blockers.join(', ')}.</Alert>}

          <Footer>
            <Button onClick={onClose}>Cancelar</Button>
            <Button
              variant="primary"
              loading={mutation.isPending}
              disabled={blockers.length > 0 || rows.length === 0 || rows.length > MAX_IMPORT_ROWS}
              onClick={() => void validate()}
            >
              Verificar {plural(rows.length, 'linha', 'linhas')}
            </Button>
          </Footer>
        </>
      )}

      {step === 'review' && preview && (
        <>
          <Summary report={preview} future />
          {preview.removed > 0 && (
            <Alert tone="danger" title={`${plural(preview.removed, 'aula atual será removida', 'aulas atuais serão removidas')} antes da importação`}>
              Você ativou "substituir aulas existentes". Desative essa opção para apenas acrescentar.
            </Alert>
          )}
          {preview.createdSubjects.length > 0 && (
            <Alert tone="info">Disciplinas que serão criadas: {preview.createdSubjects.join(', ')}.</Alert>
          )}
          <ReportTable report={preview} />
          <Footer>
            <Button icon={<ArrowLeft className="size-4" />} onClick={() => setStep('map')}>
              Voltar
            </Button>
            {preview.summary.error > 0 && (
              <Button icon={<Download className="size-4" />} onClick={() => downloadErrors(preview)}>
                Baixar linhas com erro
              </Button>
            )}
            <Button
              variant={preview.removed > 0 ? 'danger' : 'primary'}
              icon={<Upload className="size-4" />}
              loading={mutation.isPending}
              disabled={preview.summary.create + preview.summary.update === 0 && preview.removed === 0}
              onClick={() => void commit()}
            >
              {preview.summary.create + preview.summary.update === 0
                ? 'Nada a gravar'
                : `Gravar ${plural(preview.summary.create + preview.summary.update, 'registro', 'registros')}`}
            </Button>
          </Footer>
        </>
      )}

      {step === 'done' && result && (
        <>
          <div className="flex flex-col items-center gap-2 py-2 text-center">
            <div className="grid size-12 place-items-center rounded-full bg-success-soft text-success">
              <CheckCircle2 className="size-6" />
            </div>
            <h3 className="text-lg font-bold text-ink">Importação concluída</h3>
            <p className="max-w-md text-sm text-muted">
              {result.summary.error > 0
                ? 'As linhas com erro não foram gravadas. Baixe-as, corrija na planilha e importe só elas de novo.'
                : 'Todas as linhas válidas foram gravadas no banco de dados.'}
            </p>
          </div>
          <Summary report={result} />
          {result.summary.error > 0 && <ReportTable report={result} initialFilter="error" />}
          <Footer>
            {result.summary.error > 0 && (
              <Button icon={<Download className="size-4" />} onClick={() => downloadErrors(result)}>
                Baixar linhas com erro
              </Button>
            )}
            <Button
              icon={<FileUp className="size-4" />}
              onClick={() => {
                setPreview(null);
                setResult(null);
                setSheets([]);
                setStep('pick');
              }}
            >
              Importar outro arquivo
            </Button>
            <Button variant="primary" onClick={onClose}>
              Concluir
            </Button>
          </Footer>
        </>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ Partes

function Stepper({ step }: { step: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: 'pick', label: 'Arquivo' },
    { key: 'map', label: 'Colunas' },
    { key: 'review', label: 'Revisão' },
    { key: 'done', label: 'Concluído' },
  ];
  const current = steps.findIndex((s) => s.key === step);
  return (
    <ol className="flex items-center gap-2 text-[13px]" aria-label="Etapas da importação">
      {steps.map((s, i) => (
        <li key={s.key} className="flex items-center gap-2" aria-current={i === current ? 'step' : undefined}>
          {i > 0 && <span className={cn('h-px w-5 sm:w-10', i <= current ? 'bg-ink' : 'bg-line-strong')} aria-hidden="true" />}
          <span
            className={cn(
              'grid size-6 place-items-center rounded-full text-xs font-bold',
              i < current ? 'bg-ink text-white' : i === current ? 'bg-brand text-ink' : 'bg-subtle text-soft ring-1 ring-line',
            )}
          >
            {i < current ? '✓' : i + 1}
          </span>
          <span className={cn('hidden font-semibold sm:inline', i === current ? 'text-ink' : 'text-muted')}>{s.label}</span>
        </li>
      ))}
    </ol>
  );
}

function DropZone({ onFile, reading }: { onFile: (file: File) => void; reading: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const file = e.dataTransfer.files[0];
        if (file) onFile(file);
      }}
      className={cn(
        'flex flex-col items-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors',
        over ? 'border-ink bg-brand-soft' : 'border-line-strong bg-subtle/60',
      )}
    >
      <div className="grid size-12 place-items-center rounded-xl bg-surface text-ink shadow-raise">
        <FileUp className="size-6" />
      </div>
      <div>
        <p className="text-[15px] font-bold text-ink">Arraste a planilha para cá</p>
        <p className="mt-0.5 text-sm text-muted">Excel (.xlsx) ou CSV, com uma linha de cabeçalho</p>
      </div>
      <Button variant="primary" loading={reading} onClick={() => input.current?.click()}>
        Escolher arquivo
      </Button>
      <input
        ref={input}
        type="file"
        accept=".xlsx,.xlsm,.csv,.txt,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) onFile(file);
        }}
      />
    </div>
  );
}

function PreviewTable({ columns, rows }: { columns: { key: string; label: string }[]; rows: ImportRowInput[] }) {
  if (rows.length === 0) return <Alert tone="warning">Nenhuma linha com dados abaixo do cabeçalho.</Alert>;
  return (
    <section>
      <h3 className="mb-2 text-sm font-bold text-ink">Prévia das primeiras linhas</h3>
      <div className="scrollbar-thin overflow-x-auto rounded-lg ring-1 ring-line">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-subtle text-left text-xs text-muted">
              <th className="px-3 py-2 font-semibold">Linha</th>
              {columns.map((c) => (
                <th key={c.key} className="px-3 py-2 font-semibold whitespace-nowrap">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.line} className="border-t border-line">
                <td className="tabular px-3 py-2 text-muted">{r.line}</td>
                {columns.map((c) => (
                  <td key={c.key} className="max-w-48 truncate px-3 py-2 text-ink-2">
                    {r.values[c.key] || <span className="text-soft">—</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ImportSettings({
  kind,
  fixed,
  options,
  onChange,
}: {
  kind: ImportKind;
  fixed?: ImportFixed;
  options: ImportOptions;
  onChange: (o: ImportOptions) => void;
}) {
  if (kind === 'periods') {
    return (
      <Alert tone="info">
        Os horários de cada turno presente na planilha serão substituídos. Aulas já lançadas não são alteradas.
      </Alert>
    );
  }
  if (kind === 'lessons') {
    const scope = fixed ? `de ${fixed.label}` : 'das turmas presentes na planilha';
    return (
      <section className="flex flex-col gap-4 rounded-lg ring-1 ring-line p-4">
        <Switch
          checked={Boolean(options.createMissingSubjects)}
          onChange={(v) => onChange({ ...options, createMissingSubjects: v })}
          label="Criar disciplinas que ainda não existem"
          description="Disciplinas citadas na planilha e não cadastradas são criadas com uma cor automática."
        />
        <Switch
          checked={Boolean(options.replaceExisting)}
          onChange={(v) => onChange({ ...options, replaceExisting: v })}
          label={`Substituir as aulas atuais ${scope}`}
          description="Remove as aulas já lançadas antes de importar. Use para recarregar um quadro inteiro. Desativado, as aulas são apenas acrescentadas."
        />
      </section>
    );
  }
  return (
    <section className="flex flex-col gap-2 rounded-lg ring-1 ring-line p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-semibold text-ink">Registros que já existem</p>
        <p className="text-[13px] text-muted">Reconhecidos pelo nome{kind === 'teachers' ? ' ou matrícula' : ''}.</p>
      </div>
      <Segmented
        label="Registros que já existem"
        value={options.existing ?? 'update'}
        onChange={(v) => onChange({ ...options, existing: v })}
        options={[
          { value: 'update', label: 'Atualizar dados' },
          { value: 'skip', label: 'Manter como estão' },
        ]}
      />
    </section>
  );
}

function Summary({ report, future }: { report: ImportReport; future?: boolean }) {
  const items: { status: ImportRowStatus; label: string }[] = [
    { status: 'create', label: future ? 'serão criados' : 'criados' },
    { status: 'update', label: future ? 'serão atualizados' : 'atualizados' },
    { status: 'skip', label: future ? 'serão ignorados' : 'ignorados' },
    { status: 'error', label: 'com erro' },
  ];
  const tone: Record<ImportRowStatus, string> = {
    create: 'text-success',
    update: 'text-info',
    skip: 'text-muted',
    error: 'text-danger',
  };
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((i) => (
        <div key={i.status} className="rounded-lg bg-subtle px-4 py-3">
          <dt className="text-xs font-semibold text-muted">{i.label}</dt>
          <dd className={cn('tabular text-2xl font-extrabold tracking-tight', report.summary[i.status] ? tone[i.status] : 'text-soft')}>
            {report.summary[i.status].toLocaleString('pt-BR')}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function ReportTable({ report, initialFilter }: { report: ImportReport; initialFilter?: ImportRowStatus }) {
  const [filter, setFilter] = useState<ImportRowStatus | 'all'>(initialFilter ?? (report.summary.error ? 'error' : 'all'));
  const list = report.rows.filter((r) => filter === 'all' || r.status === filter);
  const shown = list.slice(0, MAX_RENDERED_ROWS);
  return (
    <section className="flex flex-col gap-3">
      <Segmented
        label="Filtrar linhas"
        size="sm"
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: 'Todas', count: report.rows.length },
          { value: 'error', label: 'Com erro', count: report.summary.error },
          { value: 'create', label: 'Novas', count: report.summary.create },
          { value: 'update', label: 'Atualizadas', count: report.summary.update },
          { value: 'skip', label: 'Ignoradas', count: report.summary.skip },
        ]}
      />
      {list.length === 0 ? (
        <p className="rounded-lg bg-subtle px-4 py-6 text-center text-sm text-muted">Nenhuma linha nesta situação.</p>
      ) : (
        <div className="scrollbar-thin max-h-[42dvh] overflow-auto rounded-lg ring-1 ring-line">
          <table className="w-full text-[13px]">
            <thead className="sticky top-0 bg-subtle">
              <tr className="text-left text-xs text-muted">
                <th className="px-3 py-2 font-semibold">Linha</th>
                <th className="px-3 py-2 font-semibold">Situação</th>
                <th className="px-3 py-2 font-semibold">Registro</th>
                <th className="px-3 py-2 font-semibold">Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.line} className={cn('border-t border-line align-top', r.status === 'error' && 'bg-danger-soft/40')}>
                  <td className="tabular px-3 py-2 text-muted">{r.line}</td>
                  <td className="px-3 py-2">
                    <Badge tone={STATUS[r.status].tone}>
                      {STATUS[r.status].icon}
                      {STATUS[r.status].label}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 font-semibold text-ink">{r.label}</td>
                  <td className="px-3 py-2">
                    {r.messages.map((m) => (
                      <p key={m} className={r.status === 'error' ? 'text-danger' : 'text-muted'}>
                        {m}
                      </p>
                    ))}
                    {r.warnings.map((w) => (
                      <p key={w} className="text-warning">
                        {w}
                      </p>
                    ))}
                    {!r.messages.length && !r.warnings.length && <span className="text-soft">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {list.length > shown.length && (
            <p className="border-t border-line px-3 py-2 text-xs text-muted">
              Exibindo {shown.length} de {list.length}. Baixe as linhas com erro para ver a lista completa.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function Footer({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-5 -mb-5 flex flex-col-reverse gap-2 border-t border-line bg-subtle px-5 py-3.5 sm:-mx-6 sm:flex-row sm:justify-end sm:px-6">
      {children}
    </div>
  );
}

/** Botão "Importar" que abre o assistente. */
export function ImportButton({
  kind,
  fixed,
  label = 'Importar',
  variant = 'secondary',
  size,
}: {
  kind: ImportKind;
  fixed?: ImportFixed;
  label?: string;
  variant?: 'secondary' | 'primary' | 'ghost';
  size?: 'sm' | 'md';
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} size={size} icon={<FileUp className="size-4" />} onClick={() => setOpen(true)} title="Importar planilha Excel ou CSV">
        {label}
      </Button>
      <ImportDialog kind={kind} fixed={fixed} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
