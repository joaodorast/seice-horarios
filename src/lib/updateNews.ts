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

const rhNews = [
  { title: 'Carga fixa destacada para o RH', description: 'A regência aparece em verde, com identificação de carga fixa por turma. O total para pagamento fica destacado em azul.', links: [{ label: 'Conferir carga horária', to: '/horarios/carga' }] },
  { title: 'Horas e minutos prontos para pagamento', description: 'O relatório mostra a conversão: Fundamental I, 22h30 = 1.350 minutos por turma em cinco dias; Infantil, 20h = 1.200 minutos. Duas regências de Fundamental I somam 45h = 2.700 minutos.', links: [{ label: 'Ver relatórios', to: '/horarios/carga' }] },
  { title: 'Impressão mais clara', description: 'Retiramos as informações de minutos por tempo que estavam confundindo a leitura. Horas e minutos passam a aparecer juntos no resumo, com uma legenda curta.', links: [{ label: 'Horários por professor', to: '/horarios/professor' }] },
];

const pppInitialNews = [
  { title: 'Carga pedagógica por turma e disciplina', description: 'A nova aba PPP mostra tempos por semana, carga semanal e carga total projetada a partir das aulas cadastradas na grade.', links: [{ label: 'Abrir carga pedagógica (PPP)', to: '/horarios/carga?visao=pedagogica' }] },
  { title: 'Projeção para 2027 com base ajustável', description: 'Use 201 dias letivos para o ano ou informe as semanas de um módulo/semestre. O sistema mostra a duração por tempo e a conta utilizada.', links: [{ label: 'Consultar projeção do PPP', to: '/horarios/carga?visao=pedagogica' }] },
  { title: 'Relatório pedagógico em PDF e Excel', description: 'Filtre unidades, turmas e disciplinas e baixe exatamente o recorte escolhido. O relatório pedagógico fica separado do pagamento do RH.', links: [{ label: 'Gerar relatório pedagógico', to: '/horarios/carga?visao=pedagogica' }] },
];

const pedagogicalRulesNews = [
  { title: 'Página própria para a carga pedagógica', description: 'Acesse Carga pedagógica · PPP no menu lateral. Explore a grade por unidade, segmento, turma e disciplina, com carga semanal e total.', links: [{ label: 'Abrir carga pedagógica', to: '/horarios/carga-pedagogica' }] },
  { title: 'O cliente pode personalizar o cálculo', description: 'Em Personalizar cálculo, salve o padrão da unidade e ajuste os segmentos ou turmas diferentes. Por exemplo: Infantil com 50 minutos e outro segmento com 60 minutos por tempo.', links: [{ label: 'Ver e personalizar regras', to: '/horarios/carga-pedagogica' }] },
  { title: 'Regras salvas e relatórios alinhados', description: 'As configurações ficam no banco por ano e unidade. A página, o PDF e o Excel usam a mesma regra aplicada a cada turma. Não é preciso preencher tudo novamente. As regras de pagamento do RH não são alteradas.', links: [{ label: 'Consultar relatórios da grade', to: '/horarios/carga-pedagogica' }] },
];

const classKindsNews = [
  { title: 'Regulares e técnicos separados em cada turma', description: 'O resumo do professor agora identifica quantos tempos regulares e técnicos ele tem em cada turma, com minutos e disciplinas associadas. O total para pagamento continua consolidado.', links: [{ label: 'Conferir carga horária do RH', to: '/horarios/carga' }] },
  { title: 'Escolha o tipo de cada disciplina', description: 'Em Disciplinas, abra o cadastro e escolha Regular (normal) ou Técnico em Tipo de tempo para o RH. Uma aula também pode ter uma classificação própria.', links: [{ label: 'Classificar disciplinas', to: '/disciplinas' }] },
  { title: 'Impressão, PDF e Excel com a mesma separação', description: 'A turma técnica pode ter disciplinas regulares e técnicas. Os relatórios mostram cada tipo separadamente para o RH conferir o pagamento no sistema financeiro.', links: [{ label: 'Ver relatórios por professor', to: '/horarios/professor' }] },
];

const coordinationNews = [
  { title: 'Todos os professores disponíveis para consulta', description: 'Os coordenadores podem consultar os professores das duas unidades. As turmas e aulas exibidas respeitam a coordenação de cada login.', links: [{ label: 'Consultar professores', to: '/professores' }] },
  { title: 'As turmas certas para cada coordenação', description: 'Cada coordenador vê as turmas da sua unidade e dos segmentos sob sua responsabilidade. Esse limite também vale para relatórios, importação e links diretos.', links: [{ label: 'Ver minhas turmas', to: '/turmas' }] },
  { title: 'Uma navegação mais simples', description: 'Ocultamos Montar quadro e seus atalhos. Para incluir ou editar aulas, use os horários por turma ou professor e o botão Nova aula.', links: [{ label: 'Abrir horários por turma', to: '/horarios/turma' }] },
];

const savingScrollNews = [
  { title: 'Disciplinas salvas também para professores compartilhados', description: 'O coordenador pode associar disciplinas e segmentos aos professores que atuam na sua unidade, mesmo quando também trabalham na outra. Os demais dados do cadastro e os horários são preservados.', links: [{ label: 'Conferir professores', to: '/professores' }] },
  { title: 'Rolagem funcionando depois de exportar', description: 'Corrigimos o bloqueio da página ao fechar a janela de exportação. Depois de baixar o PDF, cancelar ou fechar a janela, você pode continuar descendo a página e navegar normalmente.', links: [{ label: 'Abrir carga horária do RH', to: '/horarios/carga' }] },
  { title: 'Formulário mais claro', description: 'O cadastro explica o que o coordenador pode ajustar em professores das duas unidades. O botão de salvar permanece acessível e os erros aparecem junto dele.', links: [{ label: 'Consultar professores', to: '/professores' }] },
];

const persistentNoticeNews = [
  { title: 'Avisos claros quando uma ação não pode continuar', description: 'Bloqueios de acesso, conflitos e falhas ao salvar agora abrem um aviso com o motivo e uma orientação. Ele permanece visível até você fechar, inclusive sobre outros formulários.', links: [{label:'Conferir professores',to:'/professores'}] },
  { title: 'Rolagem revisada nas janelas do sistema', description: 'O controle de rolagem foi centralizado e testado com janelas sobrepostas e abertura repetida. Fechar a última janela libera a página para continuar navegando.', links: [{label:'Abrir carga horária',to:'/horarios/carga'}] },
  { title: 'Sem espera indefinida ou repetição automática', description: 'Se o SEICE demorar para responder, a tela explica que o resultado precisa ser conferido antes de repetir a operação. Os campos inválidos também recebem uma orientação antes de salvar.', links: [{label:'Consultar atualizações',to:'/atualizacoes'}] },
];

const assignmentClarityNews = [
  { title: 'Atribuição mesmo sem disciplinas cadastradas', description: 'As disciplinas do professor continuam aparecendo como opções rápidas. Se ele ainda não tiver matérias cadastradas, a tela avisa e permite pesquisar e escolher uma para atribuir as turmas.', links: [{ label: 'Atribuir turmas', to: '/atribuicoes/professor' }] },
  { title: 'Disciplinas e aulas da grade sem confusão', description: 'A atribuição por professor agora mostra as disciplinas, os tempos lançados e o detalhe de cada turma. O planejamento cadastrado aparece separado, sem alterar os horários nem o pagamento do RH.', links: [{ label: 'Conferir atribuições', to: '/atribuicoes/professor' }] },
];

export const updateNews = [
  { title: 'Atribuições sugeridas a partir da grade', description: 'O sistema identifica aulas que já existem e sugere as atribuições que faltam. Filtre por unidade, professor ou turma, revise as quantidades e confirme somente o que estiver certo.', links: [{ label: 'Revisar atribuições automáticas', to: '/atribuicoes/professor' }] },
  { title: 'Conferência antes de salvar', description: 'Conflitos entre professores ficam destacados. Você pode desmarcar sugestões e ajustar o planejamento. Se os dados mudarem durante a revisão, o sistema pede uma nova conferência.', links: [{ label: 'Conferir por turma', to: '/atribuicoes/turma' }] },
  { title: 'Horários e cálculo de horas preservados', description: 'A confirmação atualiza as atribuições e os vínculos das disciplinas. Não cria aulas, não move horários e não altera regras de pagamento do RH.', links: [{ label: 'Consultar horários', to: '/horarios' }] },
];

/** Mantenha as publicações anteriores e acrescente as novas no início deste histórico. */
export const updateHistory = [
  { id: '2026-11-24-carga-fixa-livre', date: '2026-11-24', title: 'Carga fixa de regência editável', description: 'Administradores e coordenadores podem definir horas e minutos semanais por professor e turma.', items: [{ title: 'Defina a carga fixa da regência', description: 'Em Carga horária, abra Configurar cargas e professores, escolha Configurar regências e selecione o professor. Escolha a unidade, a turma e o segmento, preencha horas e minutos fixos semanais, marque os dias e salve. Para novos regentes, cadastre o professor e repita esses passos. Para encerrar o vínculo, remova a regência e salve.', links: [{ label: 'Configurar regências', to: '/horarios/carga?configurar=regencias' }] }] },
  { id: '2026-11-24-revisao-automatica', date: '2026-11-24', title: 'Atribuições automáticas com revisão', description: 'A grade e o planejamento se comunicam com conferência antes da confirmação.', items: updateNews },
  { id: '2026-11-24-atribuicoes-grade', date: '2026-11-24', title: 'Planejamento e grade explicados separadamente', description: 'Conferência das disciplinas e aulas realmente lançadas por professor e turma.', items: assignmentClarityNews },
  {id:'2026-11-18-avisos-rolagem',date:'2026-11-18',title:'Avisos persistentes e revisão da rolagem',description:'Falhas de ações explicadas e controle único para as janelas do sistema.',items:persistentNoticeNews},
  { id: '2026-11-18-salvamento-rolagem', date: '2026-11-18', title: 'Correções no salvamento de disciplinas e na rolagem', description: 'Professores compartilhados e exportação com continuidade de navegação.', items: savingScrollNews },
  { id: '2026-11-18-acessos-coordenacao', date: '2026-11-18', title: 'Turmas por coordenação e navegação mais simples', description: 'Consulta de professores ampliada e turmas organizadas para cada coordenador.', items: coordinationNews },
  { id: '2026-11-18-tempos-por-turma', date: '2026-11-18', title: 'Tempos regulares e técnicos identificados em cada turma', description: 'Resumo por turma mais claro e classificação de disciplinas visível e editável.', items: classKindsNews },
  { id: '2026-11-17-ppp-personalizavel', date: '2026-11-17', title: 'Carga pedagógica com regras salvas por unidade, segmento e turma', description: 'Página própria, personalização da duração dos tempos e relatórios com as mesmas regras.', items: pedagogicalRulesNews },
  { id: '2026-11-17-ppp', date: '2026-11-17', title: 'Projeção da carga horária pedagógica para o PPP', description: 'Carga semanal e total por turma e disciplina, com base ajustável e exportação.', items: pppInitialNews },
  { id: '2026-11-17-rh', date: '2026-11-17', title: 'Carga fixa e minutos para pagamento mais claros', description: 'Destaques de cor nos relatórios e conversão de horas para facilitar a conferência do RH.', items: rhNews },
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
