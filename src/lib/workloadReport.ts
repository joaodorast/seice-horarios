import type { Workload } from '@shared/workload';
import { WEEKDAY_LABEL } from '@shared/labels';
import { formatHours } from './format';

export interface WorkloadReportInput {
  workload: Workload;
  period: string;
  filters: [string, string][];
  className: (id: number) => string;
  subjectName: (id: number | null) => string;
  calendarNote?: string;
}

/** Relatório vetorial: os dados continuam selecionáveis e as tabelas paginam sem recortes. */
export async function createWorkloadReport(input: WorkloadReportInput) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const { workload, className, subjectName } = input;
  const n = (value: number) => value.toLocaleString('pt-BR');
  const numbers = (count: number, minutes:number) => [count ? n(count) : '—', n(minutes), formatHours(minutes)];
  const teachers = workload.rows.filter((row) => (row.total.minutes > 0 || Boolean(row.payroll?.hasReference) || Boolean(row.payroll?.attendanceDays)));
  const classes = workload.classes.filter((c) => (workload.classTotals.get(c.id)?.minutes ?? 0) > 0);
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
    doc.setFont('helvetica', 'bold').setFontSize(13).setTextColor(...ink);
    const lines = doc.splitTextToSize(text, 182) as string[];
    if (y + lines.length * 5 + 25 > 277) { doc.addPage(); y = 42; }
    doc.text(lines, 14, y); y += lines.length * 5 + 2;
  }
  function table(head: string[], body: string[][], widths?: Record<number, {cellWidth: number}>, footer?: string[]) {
    autoTable(doc, {
      startY: y, margin: { left: 14, right: 14, top: 40, bottom: 20 },
      head: [head], body, foot: footer ? [footer] : undefined, showFoot: 'lastPage',
      theme: 'grid', rowPageBreak: 'avoid',
      styles: { font: 'helvetica', fontSize: 10.5, cellPadding: 3.2, overflow: 'linebreak', textColor: ink, lineColor: [220, 224, 230], lineWidth: 0.1 },
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
  const totals = numbers(workload.grand.lessons,workload.grand.minutes);
  const metrics = [
    {label:'Tempos (aulas)',note:'Quantidade de aulas na grade',color:[235,244,253]},
    {label:'Minutos pagos',note:'Regras por segmento e regência',color:[255,247,219]},
    {label:'Total em horas',note:'Ex.: 250 min = 4h10',color:[234,247,239]},
  ];
  metrics.forEach(({label,note,color}, index) => {
    const x = 14 + index * 62;
    doc.setFillColor(color[0],color[1],color[2]).roundedRect(x,y,58,32,2,2,'F');
    doc.setFontSize(10).setFont('helvetica','normal').setTextColor(60).text(label,x+4,y+7);
    doc.setFontSize(19).setFont('helvetica','bold').setTextColor(...ink).text(totals[index],x+4,y+18);
    doc.setFontSize(9.5).setFont('helvetica','normal').setTextColor(70).text(note,x+4,y+26);
  });
  y += 39;
  doc.setFont('helvetica','normal').setFontSize(10.5).setTextColor(60);
  const explanation = doc.splitTextToSize('Tempos = aulas regulares e técnicas. Infantil/Fund. I: 60 min por tempo; demais segmentos: 50 min. Regentes: Infantil 20h/semana; Fund. I 22h30/semana em 5 dias, sem multiplicar pelas disciplinas.',182) as string[];
  doc.text(explanation,14,y);y += explanation.length * 5 + 7;
  title('Critérios utilizados');
  table(['Filtro', 'Seleção'], [...input.filters, ['Regra', 'Carga por tempo + regências fixas cadastradas. Não calcula valores em dinheiro.']], {0:{cellWidth:35}});
  title('1. Carga de cada professor');
  table(['Professor','Regulares','Técnicos','Regência','Total'],teachers.map((row)=>[
    row.teacher.name,`${row.payroll?.regularLessons ?? row.total.lessons} tempos`,`${row.payroll?.technicalLessons ?? 0} tempos`,formatHours(row.payroll?.regencyMinutes ?? 0),formatHours(row.total.minutes)
  ]),{0:{cellWidth:65},1:{cellWidth:29},2:{cellWidth:29},3:{cellWidth:29},4:{cellWidth:30}},['Total do recorte','','','',formatHours(workload.grand.minutes)]);
  title('2. Total de cada turma');
  table(['Unidade / Turma', 'Tempos', 'Minutos pagos', 'Horas pagas'], classes.map((c) => [className(c.id), ...numbers(workload.classTotals.get(c.id)!.lessons,workload.classTotals.get(c.id)!.minutes)]),
    {0:{cellWidth:86},1:{cellWidth:25},2:{cellWidth:38},3:{cellWidth:33}}, ['Total do recorte', ...totals]);
  if (teachers.length) { if(y > 200) {doc.addPage(); y = 42;} title('3. Disciplinas e turmas de cada professor'); }
  for (const row of teachers) {
    title(row.teacher.name);
    if(row.payroll) {
      const p=row.payroll;
      table(['Informação','Neste recorte'],[
        ['Regulares',`${p.regularLessons} tempos / ${formatHours(p.regularMinutes)}`],
        ['Técnicos',`${p.technicalLessons} tempos / ${formatHours(p.technicalMinutes)}`],
        ['Regência fixa',formatHours(p.regencyMinutes)],
        ['Dias no colégio',p.days.length ? p.days.map((d)=>WEEKDAY_LABEL[d]).join(', ') : 'Sem dias cadastrados'],
        ['Vale-transporte',`${p.attendanceDays} dias no recorte. Cada dia conta uma vez, mesmo com várias aulas. Sem quantidade de passagens ou valores.`],
        ...(p.hasReference ? [['Referência semanal da escola',`${p.referenceRegular} tempos regulares + ${p.referenceTechnical} técnicos = ${p.referenceRegular+p.referenceTechnical} tempos. Conferir com a grade acima.`]] : []),
      ],{0:{cellWidth:48}});
    }
    table(['Unidade / Turma', 'Disciplina', 'Aulas', 'Min. pagos', 'Horas'], row.bySubject.flatMap((subject) =>
      [...subject.byClass].map(([id, load]) => [className(id), (subject.label ?? subjectName(subject.subjectId)), ...numbers(load.lessons,load.minutes)])),
      {0:{cellWidth:65},1:{cellWidth:47},2:{cellWidth:20},3:{cellWidth:27},4:{cellWidth:23}},
      [`Total de ${row.teacher.name}`, '', ...numbers(row.total.lessons,row.total.minutes)]);
  }
  const notes = [
    'Os resumos por professor e por turma mostram as mesmas aulas de duas formas. Não some um resumo ao outro.',
    input.calendarNote ?? 'Base: grade semanal cadastrada, sem registro de presença ou substituições.',
  ];
  doc.setFont('helvetica','normal').setFontSize(9.5).setTextColor(70);
  for (const note of notes) {
    const lines = doc.splitTextToSize(note,182) as string[];
    if(y + lines.length * 4 > 277) {doc.addPage();y=42;}
    doc.text(lines,14,y);y += lines.length * 4 + 3;
  }
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.addImage(logo, 'PNG', 14, 8, logoWidth, logoHeight, 'seice-logo');
    doc.setFont('helvetica','normal').setFontSize(8).setTextColor(70);
    doc.text('Colégio SEICE - Sistema de Ensino Integrado de Campos Elíseos', 196, 12, {align:'right'});
    doc.setFont('helvetica','bold').setFontSize(13).setTextColor(...ink);
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

/** Nome comum para PDF e Excel; sem caracteres inválidos em nomes de arquivos. */
export function workloadReportFileName(workload: Workload, period: string, date = new Date()) {
  const teachers = workload.rows.filter((row) => (row.total.minutes > 0 || Boolean(row.payroll?.hasReference) || Boolean(row.payroll?.attendanceDays)));
  const owner = teachers.length === 1 ? teachers[0].teacher.name : `${teachers.length}-professores`;
  const clean = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').trim().replace(/\s+/g, '-').replace(/-+/g, '-').replace(/[. -]+$/, '').slice(0, 90);
  const issued = new Intl.DateTimeFormat('en-CA', {timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
  return `SEICE-Carga-horaria-${clean(owner)}-${clean(period)}-${issued}`;
}

export async function downloadWorkloadReport(input: WorkloadReportInput) {
  const doc = await createWorkloadReport(input);
  doc.save(`${workloadReportFileName(input.workload, input.period)}.pdf`);
}
