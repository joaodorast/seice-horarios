/** Novidades da versão atual. Atualize este resumo junto das próximas entregas. */
export const updateNews = [
  { title: 'Professores mais fáceis de conferir', description: 'Pesquise pelo nome e veja os cadastros em uma lista maior, com matrícula, unidade e barra de rolagem.' },
  { title: 'Cadastro novo em uma confirmação', description: 'Se o professor ainda não estiver no sistema, confirme para cadastrar e vincular a carga da lista. Nomes já existentes são bloqueados para conferência.' },
  { title: 'Regências explicadas passo a passo', description: 'Escolha o professor, indique a turma e os dias da semana e confira o total antes de salvar.' },
  { title: 'Letras maiores e informações mais claras', description: 'Ampliamos os textos da configuração de cargas e os cartões de próximas aulas no Dashboard.' },
];
const VERSION_KEY = 'seice:versao-aberta';
const PENDING_KEY = 'seice:novidades-pendentes';

/** Uma recarga que ainda trouxer a versão antiga não deve anunciar uma atualização concluída. */
export function rememberUpdate(storage: Storage, version: string) {
  storage.setItem(PENDING_KEY, version);
}

export function hasUpdateNews(storage: Storage, version: string): boolean {
  const previous = storage.getItem(VERSION_KEY);
  if (previous && previous !== version && !storage.getItem(PENDING_KEY)) rememberUpdate(storage, previous);
  storage.setItem(VERSION_KEY, version);
  const pending = storage.getItem(PENDING_KEY);
  return pending !== null && pending !== version;
}

export function dismissUpdateNews(storage: Storage) {
  storage.removeItem(PENDING_KEY);
}
