import { useSearchParams } from 'react-router';
import { Page } from '@/components/layout/Page';
import { DataGate } from '@/components/layout/DataGate';
import { Segmented } from '@/components/ui';
import { useScheduleData } from '@/api/hooks';
import { CalendarSettings } from '@/features/settings/CalendarSettings';
import { PeriodSettings } from '@/features/settings/PeriodSettings';
import { SubjectSettings } from '@/features/settings/SubjectSettings';

type Tab = 'calendario' | 'periodos' | 'disciplinas';

export function SettingsPage() {
  const schedule = useScheduleData();
  const [params, setParams] = useSearchParams();
  const tab = (['calendario', 'periodos', 'disciplinas'].includes(params.get('aba') ?? '') ? params.get('aba') : 'calendario') as Tab;

  return (
    <Page
      title="Configurações"
      breadcrumbs={[{ label: 'Início', to: '/' }, { label: 'Configurações' }]}
      description="Defina o calendário escolar, os horários de cada turno e as disciplinas. Alterações aqui nunca apagam aulas já cadastradas."
    >
      <Segmented
        label="Seção das configurações"
        className="mb-6"
        value={tab}
        onChange={(v) => setParams({ aba: v }, { replace: true })}
        options={[
          { value: 'calendario', label: 'Calendário e turnos' },
          { value: 'periodos', label: 'Horários dos turnos' },
          { value: 'disciplinas', label: 'Disciplinas' },
        ]}
      />
      <DataGate data={schedule.data} isLoading={schedule.isLoading} error={schedule.error} onRetry={schedule.refetch}>
        {(data) => (
          <>
            {tab === 'calendario' && <CalendarSettings data={data} />}
            {tab === 'periodos' && <PeriodSettings data={data} />}
            {tab === 'disciplinas' && <SubjectSettings data={data} />}
          </>
        )}
      </DataGate>
    </Page>
  );
}
