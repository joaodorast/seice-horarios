import type { Workload } from '@shared/workload';
import { formatHours } from './format';

export interface WorkloadReportInput {
  workload: Workload;
  period: string;
  filters: [string, string][];
  paidMinutes: number;
  className: (id: number) => string;
  subjectName: (id: number | null) => string;
  calendarNote?: string;
}

/** Relatório vetorial: os dados continuam selecionáveis e as tabelas paginam sem recortes. */
export async function createWorkloadReport(input: WorkloadReportInput) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const { workload, paidMinutes, className, subjectName } = input;
  const n = (value: number) => value.toLocaleString('pt-BR');
  const numbers = (count: number) => [n(count), n(count * paidMinutes), formatHours(count * paidMinutes)];
  const teachers = workload.rows.filter((row) => row.total.lessons > 0);
  const classes = workload.classes.filter((c) => (workload.classTotals.get(c.id)?.lessons ?? 0) > 0);
  const issued = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const ink: [number, number, number] = [31, 35, 40];
  const response = await fetch('/logo-seice.png');
  if (!response.ok) throw new Error('Não foi possível carregar o logotipo do relatório. Tente novamente.');
  const logo = new Uint8Array(await response.arrayBuffer());
  const logoSize = doc.getImageProperties(logo);
  const logoHeight = Math.min(17, 38 * logoSize.height / logoSize.width);
  const logoWidth = logoHeight * logoSize.width / logoSize.height;
  let y = 38;
  doc.setProperties({ title: 'SEICE - Relatório de carga horária', subject: input.period, author: 'Colégio SEICE' });
  function title(text: string) {
    doc.setFont('helvetica', 'bold').setFontSize(12).setTextColor(...ink);
    const lines = doc.splitTextToSize(text, 182) as string[];
    if (y + lines.length * 5 + 25 > 277) { doc.addPage(); y = 42; }
    doc.text(lines, 14, y); y += lines.length * 5 + 2;
  }
  function table(head: string[], body: string[][], widths?: Record<number, {cellWidth: number}>, footer?: string[]) {
    autoTable(doc, {
      startY: y, margin: { left: 14, right: 14, top: 40, bottom: 20 },
      head: [head], body, foot: footer ? [footer] : undefined, showFoot: 'lastPage',
      theme: 'grid', rowPageBreak: 'avoid',
      styles: { font: 'helvetica', fontSize: 9, cellPadding: 3, overflow: 'linebreak', textColor: ink, lineColor: [220, 224, 230], lineWidth: 0.1 },
      headStyles: { fillColor: [243,244,246], textColor: ink, fontStyle: 'bold' },
      footStyles: { fillColor: [243,244,246], textColor: ink, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [255,255,255] },
      columnStyles: widths,
    });
    y = (doc as typeof doc & {lastAutoTable: {finalY: number}}).lastAutoTable.finalY + 10;
  }
  title('Resumo do período');
  doc.setFont('helvetica','normal').setFontSize(10).setTextColor(80);
  doc.text(input.period, 14, y); y += 9;
  const totals = numbers(workload.grand.lessons);
  ['Tempos', 'Minutos pagos', 'Horas pagas'].forEach((label, index) => {
    const x = 14 + index * 62;
    doc.setFillColor(246,247,249);
    doc.roundedRect(x, y, 58, 23, 2, 2, 'F');
    doc.setFontSize(9).setFont('helvetica','normal').setTextColor(80).text(label, x + 4, y + 7);
    doc.setFontSize(17).setFont('helvetica','bold').setTextColor(...ink).text(totals[index], x + 4, y + 17);
  });
  y += 32;
  title('Critérios utilizados');
  table(['Filtro', 'Seleção'], [...input.filters, ['Pagamento', `${paidMinutes} minutos por tempo`]], {0:{cellWidth:35}});
  title('Resumo por professor');
  table(['Professor', 'Tempos', 'Minutos pagos', 'Horas pagas'], teachers.map((row) => [row.teacher.name, ...numbers(row.total.lessons)]),
    {0:{cellWidth:86},1:{cellWidth:25},2:{cellWidth:38},3:{cellWidth:33}}, ['Total do recorte', ...totals]);
  title('Resumo por turma');
  table(['Unidade / Turma', 'Tempos', 'Minutos pagos', 'Horas pagas'], classes.map((c) => [className(c.id), ...numbers(workload.classTotals.get(c.id)!.lessons)]),
    {0:{cellWidth:86},1:{cellWidth:25},2:{cellWidth:38},3:{cellWidth:33}}, ['Total do recorte', ...totals]);
  if (teachers.length) { doc.addPage(); y = 42; title('Detalhamento por professor e disciplina'); }
  for (const row of teachers) {
    title(row.teacher.name);
    table(['Unidade / Turma', 'Disciplina', 'Tempos', 'Min. pagos', 'Horas'], row.bySubject.flatMap((subject) =>
      [...subject.byClass].map(([id, load]) => [className(id), subjectName(subject.subjectId), ...numbers(load.lessons)])),
      {0:{cellWidth:65},1:{cellWidth:47},2:{cellWidth:20},3:{cellWidth:27},4:{cellWidth:23}},
      [`Total de ${row.teacher.name}`, '', ...numbers(row.total.lessons)]);
  }
  title('Como os totais foram calculados');
  table(['Critério', 'Descrição'], [
    ['Tempos e pagamento', 'Minutos pagos = tempos da grade multiplicados pelos minutos por tempo informados. Os totais dos professores e das turmas representam o mesmo recorte; não devem ser somados entre si.'],
    ['Período', input.calendarNote ?? 'A grade semanal atual foi considerada para o período e os filtros selecionados.'],
    ['Conferência', `${teachers.length} professores e ${classes.length} turmas com aulas neste recorte. Relatório da grade cadastrada, sem registro de presença ou substituições.`],
  ], {0:{cellWidth:35}});
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.addImage(logo, 'PNG', 14, 8, logoWidth, logoHeight, 'seice-logo');
    doc.setFont('helvetica','normal').setFontSize(8).setTextColor(70);
    doc.text('Colégio SEICE - Sistema de Ensino Integrado de Campos Elíseos', 196, 12, {align:'right'});
    doc.setFont('helvetica','bold').setFontSize(12).setTextColor(...ink);
    doc.text('Relatório de carga horária', 196, 20, {align:'right'});
    doc.setFont('helvetica','normal').setFontSize(9).text(input.period, 196, 26, {align:'right'});
    doc.setDrawColor(...ink).setLineWidth(0.35).line(14, 31, 196, 31);
    doc.setDrawColor(220).line(14, 282, 196, 282);
    doc.setFont('helvetica','normal').setFontSize(8).setTextColor(90);
    doc.text(`Emitido em ${issued}`, 14, 288);
    doc.text(`Página ${page} de ${pages}`, 196, 288, {align:'right'});
  }
  return doc;
}

export async function downloadWorkloadReport(input: WorkloadReportInput) {
  const doc = await createWorkloadReport(input);
  doc.save(`SEICE-carga-horaria-${new Date().toISOString().slice(0,10)}.pdf`);
}
