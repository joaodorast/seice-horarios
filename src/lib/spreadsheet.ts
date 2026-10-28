import type { ImportSpec } from '@shared/import';

/** Uma aba da planilha como matriz de textos (linhas × colunas). */
export interface Sheet {
  name: string;
  rows: string[][];
}

export class SpreadsheetError extends Error {}

const MAX_FILE_BYTES = 15 * 1024 * 1024;

/** Lê um arquivo .xlsx ou .csv/.txt e devolve suas abas como texto, prontas para associar às colunas. */
export async function readSpreadsheet(file: File): Promise<Sheet[]> {
  if (file.size > MAX_FILE_BYTES) throw new SpreadsheetError('O arquivo tem mais de 15 MB. Divida a planilha em partes menores.');
  const ext = file.name.toLowerCase().split('.').pop() ?? '';
  if (ext === 'xls') {
    throw new SpreadsheetError('Arquivos .xls (Excel 97–2003) não são suportados. No Excel, use "Salvar como" → "Pasta de Trabalho do Excel (.xlsx)" ou CSV.');
  }
  if (ext === 'ods') {
    throw new SpreadsheetError('Arquivos .ods não são suportados. Salve a planilha como .xlsx ou CSV.');
  }
  const buffer = await file.arrayBuffer();
  const head = new Uint8Array(buffer, 0, Math.min(2, buffer.byteLength));
  const isZip = head[0] === 0x50 && head[1] === 0x4b; // assinatura "PK" de arquivos .xlsx
  const sheets = ext === 'xlsx' || ext === 'xlsm' || isZip ? await readXlsx(buffer) : [{ name: file.name, rows: parseCsv(decodeText(buffer)) }];
  const useful = sheets.map((s) => ({ ...s, rows: trimRows(s.rows) })).filter((s) => s.rows.length > 0);
  if (useful.length === 0) throw new SpreadsheetError('A planilha está vazia.');
  return useful;
}

// ------------------------------------------------------------------ Excel

async function readXlsx(buffer: ArrayBuffer): Promise<Sheet[]> {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
  } catch {
    throw new SpreadsheetError('Não foi possível abrir o arquivo do Excel. Verifique se ele não está corrompido ou protegido por senha.');
  }
  const sheets: Sheet[] = [];
  workbook.eachSheet((ws) => {
    if (ws.state !== 'visible') return;
    const rows: string[][] = [];
    ws.eachRow({ includeEmpty: true }, (row, rowNumber) => {
      const cells: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell, col) => {
        cells[col - 1] = cellText(cell.value);
      });
      rows[rowNumber - 1] = Array.from(cells, (c) => c ?? '');
    });
    sheets.push({ name: ws.name, rows: Array.from(rows, (r) => r ?? []) });
  });
  return sheets;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Converte o valor de uma célula do Excel para o texto que o usuário vê. */
function cellText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) {
    // O Excel guarda horas puras como datas de 30/12/1899; datas reais viram dd/mm/aaaa.
    const h = value.getUTCHours();
    const m = value.getUTCMinutes() + (value.getUTCSeconds() >= 30 ? 1 : 0);
    if (value.getUTCFullYear() <= 1900) return `${pad(h + Math.floor(m / 60))}:${pad(m % 60)}`;
    const time = h || m ? ` ${pad(h)}:${pad(m)}` : '';
    return `${pad(value.getUTCDate())}/${pad(value.getUTCMonth() + 1)}/${value.getUTCFullYear()}${time}`;
  }
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : String(Math.round(value * 1e6) / 1e6).replace('.', ',');
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    const v = value as { richText?: { text: string }[]; text?: unknown; result?: unknown; error?: string };
    if (v.richText) return v.richText.map((r) => r.text).join('');
    if ('result' in v) return cellText(v.result);
    if (v.text !== undefined) return cellText(v.text);
    if (v.error) return '';
  }
  return String(value);
}

// ------------------------------------------------------------------ CSV

/** O Excel brasileiro salva CSV em Windows-1252; arquivos modernos usam UTF-8. */
function decodeText(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer).replace(/^﻿/, '');
  } catch {
    return new TextDecoder('windows-1252').decode(buffer);
  }
}

function detectDelimiter(text: string): string {
  const sample = text.split(/\r?\n/).slice(0, 10).join('\n');
  const counts = [';', ',', '\t', '|'].map((d) => ({ d, n: sample.split(d).length - 1 }));
  return counts.sort((a, b) => b.n - a.n)[0].n > 0 ? counts[0].d : ';';
}

/** Leitor de CSV com aspas, aspas escapadas ("") e quebras de linha dentro de células. */
export function parseCsv(text: string, delimiter = detectDelimiter(text)): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"' && cell === '') quoted = true;
    else if (ch === delimiter) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function trimRows(rows: string[][]): string[][] {
  const cleaned = rows.map((r) => r.map((c) => (c ?? '').trim()));
  while (cleaned.length && cleaned[cleaned.length - 1].every((c) => c === '')) cleaned.pop();
  return cleaned;
}

/** Primeira linha com pelo menos duas células preenchidas (ou uma, em planilhas de uma coluna): o cabeçalho. */
export function detectHeaderRow(rows: string[][]): number {
  const filled = (r: string[]) => r.filter((c) => c !== '').length;
  const max = Math.max(...rows.slice(0, 20).map(filled));
  const idx = rows.findIndex((r) => filled(r) >= Math.min(2, max));
  return idx < 0 ? 0 : idx;
}

// ------------------------------------------------------------------ Modelos e relatórios

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const csvCell = (v: string) => (/[";\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** CSV com ponto e vírgula e BOM: abre corretamente com acentos no Excel em português. */
export function downloadCsv(name: string, header: string[], rows: string[][]) {
  const text = [header, ...rows].map((r) => r.map(csvCell).join(';')).join('\r\n');
  save(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' }), name);
}

const BRAND = 'FFF5C400';
const INK = 'FF202328';

/** Planilha modelo: cabeçalho destacado, exemplos, listas suspensas e uma aba de instruções. */
export async function downloadTemplate(spec: ImportSpec) {
  const data = await buildTemplate(spec);
  save(new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${spec.fileName}.xlsx`);
}

export async function buildTemplate(spec: ImportSpec): Promise<ArrayBuffer> {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SEICE · Gestão de horários';
  wb.created = new Date();

  const ws = wb.addWorksheet(spec.noun.charAt(0).toUpperCase() + spec.noun.slice(1), { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = spec.columns.map((c) => ({
    header: c.label + (c.required ? ' *' : ''),
    key: c.key,
    width: Math.max(14, c.label.length + 6, ...spec.examples.map((e) => (e[c.key] ?? '').length + 4)),
  }));
  const header = ws.getRow(1);
  header.height = 22;
  header.eachCell((cell, col) => {
    const required = spec.columns[col - 1]?.required;
    cell.font = { bold: true, color: { argb: required ? INK : 'FF4A4F57' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: required ? BRAND : 'FFEDEEF0' } };
    cell.alignment = { vertical: 'middle' };
    cell.note = spec.columns[col - 1]?.hint;
  });
  for (const example of spec.examples) ws.addRow(example);
  // Células como texto: impede o Excel de transformar "07:00" em fração de dia ou "6º A" em outra coisa.
  spec.columns.forEach((_, i) => (ws.getColumn(i + 1).numFmt = '@'));

  spec.columns.forEach((c, i) => {
    if (!c.options) return;
    const letter = ws.getColumn(i + 1).letter;
    for (let r = 2; r <= 1000; r++) {
      ws.getCell(`${letter}${r}`).dataValidation = {
        type: 'list',
        allowBlank: !c.required,
        formulae: [`"${c.options.join(',')}"`],
        showErrorMessage: false,
      };
    }
  });

  const help = wb.addWorksheet('Instruções');
  help.columns = [{ width: 24 }, { width: 14 }, { width: 80 }];
  help.addRow([spec.title]).font = { bold: true, size: 14 };
  help.addRow(['Preencha a primeira aba a partir da linha 2 e importe o arquivo no SEICE. As linhas de exemplo podem ser apagadas.']);
  help.addRow([]);
  const h = help.addRow(['Coluna', 'Obrigatória', 'Como preencher']);
  h.font = { bold: true };
  h.eachCell((cell) => (cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND } }));
  for (const c of spec.columns) {
    help.addRow([c.label, c.required ? 'Sim' : 'Não', c.hint + (c.options ? ` Valores: ${c.options.join(', ')}.` : '')]);
  }
  help.addRow([]);
  for (const note of spec.notes) help.addRow(['•', '', note]);
  help.getColumn(3).alignment = { wrapText: true, vertical: 'top' };

  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

export function downloadTemplateCsv(spec: ImportSpec) {
  downloadCsv(
    `${spec.fileName}.csv`,
    spec.columns.map((c) => c.label),
    spec.examples.map((e) => spec.columns.map((c) => e[c.key] ?? '')),
  );
}

/** Tabela simples em .xlsx: cabeçalho destacado, primeira coluna e linha de totais em negrito. */
export async function downloadTable(fileName: string, sheetName: string, header: string[], rows: (string | number)[][], totals?: (string | number)[]) {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SEICE · Gestão de horários';
  wb.created = new Date();
  const ws = wb.addWorksheet(sheetName, { views: [{ state: 'frozen', xSplit: 1, ySplit: 1 }] });
  ws.columns = header.map((h, i) => ({ header: h, width: i === 0 ? Math.max(24, ...rows.map((r) => String(r[0]).length + 4)) : Math.max(10, h.length + 4) }));
  const head = ws.getRow(1);
  head.height = 22;
  head.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: INK } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });
  for (const r of rows) ws.addRow(r).getCell(1).font = { bold: true };
  if (totals) {
    const t = ws.addRow(totals);
    t.font = { bold: true };
    t.eachCell((cell) => (cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDEEF0' } }));
  }
  ws.getColumn(header.length).font = { bold: true };
  const data = (await wb.xlsx.writeBuffer()) as ArrayBuffer;
  save(new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${fileName}.xlsx`);
}
