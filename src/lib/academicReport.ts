import type { AcademicWorkload } from '@shared/academicWorkload';
import { formatHours } from './format';
export interface AcademicReportInput {
  workload: AcademicWorkload;
  filters: [string,string][];
  className: (id:number)=>string;
  subjectName: (id:number|null)=>string;
  groupBy: 'class'|'subject';
}
export const academicPeriodLabel=(w:AcademicWorkload)=>w.classProjections?`PPP ${w.projection.year} - regras por turma`:w.projection.basis==='days'?`Ano letivo ${w.projection.year}`:`Módulo/semestre ${w.projection.year} - ${w.equivalentWeeks.toLocaleString('pt-BR')} semanas`;
export function academicFileName(w:AcademicWorkload) {return `SEICE-PPP-${w.projection.year}-${w.classProjections?'regras-por-turma':w.projection.basis==='days'?'anual':'modulo'}-${new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}`;}
export async function downloadAcademicReport(input:AcademicReportInput) {
  const [{jsPDF},{autoTable}]=await Promise.all([import('jspdf'),import('jspdf-autotable')]);
  const doc=new jsPDF({unit:'mm',format:'a4'}),w=input.workload,p=w.projection;
  const logoResponse=await fetch('/logo-seice.png');if(!logoResponse.ok)throw Error('Não foi possível carregar o logotipo.');
  const logo=new Uint8Array(await logoResponse.arrayBuffer()),logoSize=doc.getImageProperties(logo),logoHeight=Math.min(16,36*logoSize.height/logoSize.width);
  const n=(value:number)=>value.toLocaleString('pt-BR',{maximumFractionDigits:2});
  let y=40;
  doc.setProperties({title:'SEICE - Carga horária pedagógica (PPP)',subject:academicPeriodLabel(w),author:'Colégio SEICE'});
  function heading(text:string){doc.setFont('helvetica','bold').setFontSize(13).setTextColor(31,35,40);const lines=doc.splitTextToSize(text,182);if(y+lines.length*5+30>275){doc.addPage();y=40;}doc.text(lines,14,y);y+=lines.length*5+3;}
  function table(head:string[],body:string[][],foot?:string[],caption?:string){autoTable(doc,{startY:y,margin:{left:14,right:14,top:40,bottom:22},head:[head],body,foot:foot?[foot]:undefined,showFoot:'lastPage',theme:'grid',rowPageBreak:'avoid',didDrawPage:(page)=>{if(page.pageNumber>1&&caption){const lines=doc.splitTextToSize(caption,180);doc.setFont('helvetica','bold').setFontSize(9).setTextColor(31,35,40).text(String(lines[0])+(lines.length>1?'...':''),14,36);}},styles:{fontSize:10,cellPadding:2.6,overflow:'linebreak',lineColor:[220,224,230],lineWidth:0.1,textColor:[31,35,40]},headStyles:{fillColor:[242,244,247],textColor:[31,35,40],fontStyle:'bold'},footStyles:{fillColor:[22,61,104],textColor:[255,255,255],fontStyle:'bold'},columnStyles:{0:{cellWidth:76}}});y=(doc as typeof doc&{lastAutoTable:{finalY:number}}).lastAutoTable.finalY+8;}
  heading('Base do cálculo');
  table(['Informação','Valor'],[
    ['Período',academicPeriodLabel(w)],
    ...(w.classProjections?[['Origem das configurações','Regras salvas no sistema: padrão da unidade, depois segmento e turma. Cada turma usa sua duração e seu período.']]:[
      ['Base de projeção',p.basis==='days'?`${p.schoolDays} dias letivos / ${p.daysPerWeek} dias por semana = ${n(w.equivalentWeeks)} semanas equivalentes`:`${n(w.equivalentWeeks)} semanas informadas para o módulo/semestre`],
      ['Duração pedagógica',`${p.minutesPerPeriod} minutos por tempo`],
    ]),
    ...input.filters,
  ]);
  if(w.classProjections){heading('Regras usadas neste recorte');table(['Unidade / Turma','Regra aplicada'],w.classProjections.filter(rule=>w.rows.some(row=>row.classId===rule.classId)).map(rule=>[input.className(rule.classId),`${rule.source}. ${rule.projection.minutesPerPeriod} min/tempo. ${rule.projection.basis==='days'?`${rule.projection.schoolDays} dias / ${rule.projection.daysPerWeek} dias por semana`:`${n(rule.projection.weeks)} semanas no período`}.`]));}
  heading('Resumo do recorte');table(['Informação','Carga horária'],[['Tempos por semana',n(w.total.weeklyPeriods)],['Carga semanal',`${formatHours(w.total.weeklyMinutes)} (${n(w.total.weeklyMinutes)} min)`],['Carga total projetada',`${formatHours(w.total.projectedMinutes)} (${n(w.total.projectedMinutes)} min)`]]);
  const keys=[...new Set(w.rows.map(row=>input.groupBy==='class'?row.classId:row.subjectId))];
  for(const key of keys){const rows=w.rows.filter(row=>(input.groupBy==='class'?row.classId:row.subjectId)===key);heading(input.groupBy==='class'?input.className(key!):input.subjectName(key));const weekly=rows.reduce((sum,row)=>sum+row.weeklyMinutes,0),total=rows.reduce((sum,row)=>sum+row.projectedMinutes,0),periods=rows.reduce((sum,row)=>sum+row.weeklyPeriods,0);table([input.groupBy==='class'?'Disciplina':'Turma','Tempos / semana','Min. / tempo','Carga semanal','Carga total projetada'],rows.map(row=>[input.groupBy==='class'?input.subjectName(row.subjectId):input.className(row.classId),n(row.weeklyPeriods),String(row.minutesPerPeriod??p.minutesPerPeriod),formatHours(row.weeklyMinutes),formatHours(row.projectedMinutes)]),['Total',n(periods),'',formatHours(weekly),formatHours(total)],input.groupBy==='class'?input.className(key!):input.subjectName(key));}
  const notes=['Cálculo pedagógico da grade atual. Não representa pagamento, carga fixa de regência ou registro de aulas realizadas.','Carga semanal = tempos semanais x minutos por tempo. Carga total = carga semanal x semanas equivalentes. Os minutos projetados são arredondados uma vez em cada disciplina/turma.',...(w.classProjections?['O total usa a regra salva de cada turma. Nas regras por dias, os dias letivos são convertidos em semanas equivalentes para a projeção.']:p.basis==='days'?['A projeção distribui os dias letivos pela semana de referência. Sem as datas detalhadas do calendário, o total anual é uma estimativa para análise do PPP.']:['O total do módulo/semestre considera a quantidade de semanas informada acima.']),...(w.rows.some(row=>row.subjectId===null)?['Há aulas sem disciplina: confira esses registros antes de usar o total no PPP.']:[])];
  doc.setFont('helvetica','normal').setFontSize(9).setTextColor(75);for(const note of notes){const lines=doc.splitTextToSize(note,182);if(y+lines.length*4>274){doc.addPage();y=40;}doc.text(lines,14,y);y+=lines.length*4+3;}
  const pages=doc.getNumberOfPages();for(let page=1;page<=pages;page++){doc.setPage(page);doc.addImage(logo,'PNG',14,8,logoHeight*logoSize.width/logoSize.height,logoHeight);doc.setFont('helvetica','bold').setFontSize(13).setTextColor(31,35,40).text('Carga horária pedagógica (PPP)',196,18,{align:'right'});doc.setFont('helvetica','normal').setFontSize(9).text(academicPeriodLabel(w),196,25,{align:'right'});doc.setDrawColor(50).line(14,31,196,31);doc.setDrawColor(220).line(14,281,196,281);doc.setFontSize(8).text(`Emitido em ${new Date().toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})}`,14,287);doc.text(`Página ${page} de ${pages}`,196,287,{align:'right'});}
  doc.save(`${academicFileName(w)}.pdf`);
}
