/** Novidades da versão atual. Atualize este resumo junto das próximas entregas. */
const assistantNews = [
  { title: 'Professores mais fáceis de conferir', description: 'Pesquise pelo nome e veja os cadastros em uma lista maior, com matrícula, unidade e barra de rolagem.', links: [{ label: 'Conferir professores', to: '/horarios/carga?configurar=professores' }] },
  { title: 'Cadastro novo em uma confirmação', description: 'Se o professor ainda não estiver no sistema, confirme para cadastrar e vincular a carga da lista. Nomes já existentes são bloqueados para conferência.', links: [{ label: 'Cadastrar ou conferir professor', to: '/horarios/carga?configurar=professores' }] },
  { title: 'Regências explicadas passo a passo', description: 'Escolha o professor, indique a turma e os dias da semana e confira o total antes de salvar.', links: [{ label: 'Configurar regências', to: '/horarios/carga?configurar=regencias' }] },
  { title: 'Letras maiores e informações mais claras', description: 'Ampliamos os textos da configuração de cargas e os cartões de próximas aulas no Dashboard.', links: [{ label: 'Ver Dashboard', to: '/' }, { label: 'Ver carga horária', to: '/horarios/carga' }] },
];
const navigationNews = [
  { title: 'Uma página para acompanhar as atualizações', description: 'Consulte as novidades e correções quando quiser, mesmo depois de fechar este aviso. A tela fica no menu lateral, em Atualizações.', links: [{ label: 'Ver histórico de atualizações', to: '/atualizacoes' }] },
  { title: 'Vá direto à tela que mudou', description: 'Cada novidade tem um atalho. Abra a conferência de professores ou a configuração de regências na aba certa.', links: [{ label: 'Conferir professores', to: '/horarios/carga?configurar=professores' }, { label: 'Configurar regências', to: '/horarios/carga?configurar=regencias' }] },
  { title: 'Aviso de novidades depois de atualizar', description: 'Corrigimos o caso em que o botão da versão anterior atualizava o sistema sem abrir o resumo das mudanças.', links: [{ label: 'Consultar as novidades', to: '/atualizacoes' }] },
];

export const updateNews = [
  { title: 'Carga fixa destacada para o RH', description: 'A regência aparece em verde, com identificação de carga fixa por turma. O total para pagamento fica destacado em azul.', links: [{ label: 'Conferir carga horária', to: '/horarios/carga' }] },
  { title: 'Horas e minutos prontos para pagamento', description: 'O relatório mostra a conversão: Fundamental I, 22h30 = 1.350 minutos por turma em cinco dias; Infantil, 20h = 1.200 minutos. Duas regências de Fundamental I somam 45h = 2.700 minutos.', links: [{ label: 'Ver relatórios', to: '/horarios/carga' }] },
  { title: 'Impressão mais clara', description: 'Retiramos as informações de minutos por tempo que estavam confundindo a leitura. Horas e minutos passam a aparecer juntos no resumo, com uma legenda curta.', links: [{ label: 'Horários por professor', to: '/horarios/professor' }] },
];

/** Mantenha as publicações anteriores e acrescente as novas no início deste histórico. */
export const updateHistory = [
  { id: '2026-11-17-rh', date: '2026-11-17', title: 'Carga fixa e minutos para pagamento mais claros', description: 'Destaques de cor nos relatórios e conversão de horas para facilitar a conferência do RH.', items: updateNews },
  { id: '2026-11-17-historico', date: '2026-11-17', title: 'Atualizações sempre à mão', description: 'Histórico permanente, atalhos para as telas e correção do aviso após atualizar.', items: navigationNews },
  { id: '2026-11-17-assistente', date: '2026-11-17', title: 'Mais clareza para configurar professores e regências', description: 'Textos maiores, seleção com pesquisa e cadastro pela lista em uma confirmação.', items: assistantNews },
];

const VERSION_KEY = 'seice:versao-aberta';
const PENDING_KEY = 'seice:novidades-pendentes';

/** Uma recarga que ainda trouxer a versão antiga não deve anunciar uma atualização concluída. */
export function rememberUpdate(storage: Storage, version: string) {
  storage.setItem(PENDING_KEY, version);
}

export function hasUpdateNews(storage: Storage, version: string, reloaded = false): boolean {
  const previous = storage.getItem(VERSION_KEY);
  // O botão das versões anteriores a este recurso só recarregava a página.
  // Na primeira recarga sem histórico, recuperamos esse caso sem abrir na primeira visita.
  if (!previous && !storage.getItem(PENDING_KEY) && reloaded) rememberUpdate(storage, 'legacy-before-update-news');
  if (previous && previous !== version && !storage.getItem(PENDING_KEY)) rememberUpdate(storage, previous);
  storage.setItem(VERSION_KEY, version);
  const pending = storage.getItem(PENDING_KEY);
  return pending !== null && pending !== version;
}

export function dismissUpdateNews(storage: Storage) {
  storage.removeItem(PENDING_KEY);
}
