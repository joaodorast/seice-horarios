import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { buildTemplate, detectHeaderRow, parseCsv, readSpreadsheet, SpreadsheetError } from '../src/lib/spreadsheet';
import { IMPORT_KINDS, IMPORT_SPECS, guessMapping } from '../shared/import';

describe('leitura de planilhas', () => {
  it('lê .xlsx convertendo horas, números, texto formatado e fórmulas', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Aulas');
    ws.addRow(['Turma', 'Início', 'Matrícula', 'Professor', 'Total']);
    ws.addRow(['6º A', new Date(Date.UTC(1899, 11, 30, 7, 30)), 123, { richText: [{ text: 'Ana ' }, { text: 'Souza', font: { bold: true } }] }, { formula: '1+1', result: 2 }]);
    wb.addWorksheet('Oculta', { state: 'hidden' }).addRow(['x']);
    const buffer = await wb.xlsx.writeBuffer();

    const sheets = await readSpreadsheet(new File([buffer], 'aulas.xlsx'));
    expect(sheets.map((s) => s.name)).toEqual(['Aulas']);
    expect(sheets[0].rows[1]).toEqual(['6º A', '07:30', '123', 'Ana Souza', '2']);
  });

  it('lê CSV do Excel brasileiro (ponto e vírgula, Windows-1252, aspas)', async () => {
    const text = 'Nome;Área;Observações\r\n"Souza; Ana";Matemática;"Disse ""olá""\nduas linhas"\r\n\r\n';
    const bytes = Uint8Array.from([...text].map((c) => c.charCodeAt(0)));
    const [sheet] = await readSpreadsheet(new File([bytes], 'professores.csv'));
    expect(sheet.rows).toEqual([
      ['Nome', 'Área', 'Observações'],
      ['Souza; Ana', 'Matemática', 'Disse "olá"\nduas linhas'],
    ]);
  });

  it('detecta o separador vírgula', () => {
    expect(parseCsv('a,b\n1,2')).toEqual([['a', 'b'], ['1', '2']]);
  });

  it('encontra o cabeçalho abaixo de títulos', () => {
    expect(detectHeaderRow([['Colégio SEICE'], [], ['Nome', 'Turma'], ['Ana', '6A']])).toBe(2);
  });

  it.each(IMPORT_KINDS)('o modelo Excel de %s é reconhecido integralmente ao ser reimportado', async (kind) => {
    const spec = IMPORT_SPECS[kind];
    const sheets = await readSpreadsheet(new File([await buildTemplate(spec)], 'modelo.xlsx'));
    expect(sheets.map((s) => s.name)).toContain('Instruções');
    const [data] = sheets;
    const mapping = guessMapping(spec, data.rows[detectHeaderRow(data.rows)]);
    expect(Object.values(mapping).every((v) => v !== null)).toBe(true);
    expect(data.rows.length).toBe(spec.examples.length + 1);
  });

  it('recusa formatos antigos com orientação', async () => {
    await expect(readSpreadsheet(new File([new Uint8Array([1, 2, 3])], 'antigo.xls'))).rejects.toThrow(SpreadsheetError);
  });
});
