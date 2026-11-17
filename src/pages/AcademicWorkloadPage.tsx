import { useSearchParams } from 'react-router';
import { Page } from '@/components/layout/Page';
import { DataGate } from '@/components/layout/DataGate';
import { useScheduleData } from '@/api/hooks';
import { AcademicWorkload } from '@/features/reports/AcademicWorkload';
export function AcademicWorkloadPage(){
 const schedule=useScheduleData(),[params]=useSearchParams();const id=Number(params.get('turma'));
 return <Page title="Carga pedagógica (PPP)" width="wide" breadcrumbs={[{label:'Quadro de horários',to:'/horarios'},{label:'Carga pedagógica (PPP)'}]} description="Consulte a carga semanal e total da grade por unidade, segmento, turma e disciplina. Personalize as regras uma vez e use nos próximos relatórios."><DataGate data={schedule.data} isLoading={schedule.isLoading} error={schedule.error} onRetry={schedule.refetch}>{data=><AcademicWorkload data={data} initialClassId={Number.isInteger(id)&&id>0?id:undefined}/>}</DataGate></Page>;
}
