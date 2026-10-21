import { Navigate, useSearchParams } from 'react-router';
import { Page } from '@/components/layout/Page';
import { DataGate } from '@/components/layout/DataGate';
import { Segmented } from '@/components/ui';
import { useScheduleData } from '@/api/hooks';
import { CalendarSettings } from '@/features/settings/CalendarSettings';
import { PeriodSettings } from '@/features/settings/PeriodSettings';
import { ImportButton } from '@/features/import/ImportDialog';

type Tab = 'calendario' | 'periodos';

export function SettingsPage() {
  const schedule = useScheduleData();
  const [params, setParams] = useSearchParams();
  const aba = params.get('aba');
  const tab = (aba === 'periodos' ? 'periodos' : 'calendario') as Tab;

  // As disciplinas ganharam página própria; links antigos continuam funcionando.
  if (aba === 'disciplinas') return <Navigate to="/disciplinas" replace />;

  return (
    <Page
      title="Configurações"
      breadcrumbs={[{ label: 'Início', to: '/' }, { label: 'Configurações' }]}
      description="Defina o calendário escolar e os horários de cada turno. Alterações aqui nunca apagam aulas já cadastradas."
      actions={<ImportButton kind="periods" label="Importar horários dos turnos" />}
    >
      <Segmented
        label="Seção das configurações"
        className="mb-6"
        value={tab}
        onChange={(v) => setParams({ aba: v }, { replace: true })}
        options={[
          { value: 'calendario', label: 'Calendário e turnos' },
          { value: 'periodos', label: 'Horários dos turnos' },
        ]}
      />
      <DataGate data={schedule.data} isLoading={schedule.isLoading} error={schedule.error} onRetry={schedule.refetch}>
        {(data) => (
          <>
            {tab === 'calendario' && <CalendarSettings data={data} />}
            {tab === 'periodos' && <PeriodSettings data={data} />}
          </>
        )}
      </DataGate>
    </Page>
  );
}
