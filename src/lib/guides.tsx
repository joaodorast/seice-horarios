import type { GuideStep } from '@/components/layout/Page';

/**
 * Textos do guia "Como usar esta tela" de cada página, em linguagem simples.
 * Ficam reunidos aqui para facilitar a revisão pela coordenação.
 */
export const GUIDES = {
  dashboard: [
    { title: 'Veja a situação da escola', text: 'O quadro escuro no topo resume quanto da grade já está preenchida e se há algum conflito de horário.' },
    { title: 'Use os atalhos', text: 'Lance uma aula, abra o quadro do dia ou importe uma planilha direto pelos botões amarelos.' },
    { title: 'Resolva as pendências', text: 'A lista "Pendências" mostra o que falta, do mais urgente ao informativo. Clique em um item para ir direto até ele.' },
  ],
  teachers: [
    { title: 'Cadastre os professores', text: 'Use "Novo professor" para um de cada vez, ou "Importar" para trazer a lista inteira de uma planilha Excel ou CSV.' },
    { title: 'Altere quando precisar', text: 'Clique em "Editar" na linha do professor. Para inativar ou excluir, use o botão "…" no fim da linha.' },
    { title: 'Consulte o horário', text: 'Clique no nome do professor para ver os dados, as turmas e o quadro semanal dele.' },
  ],
  teacherDetail: [
    { title: 'Confira os dados', text: 'No topo ficam a área, o contato e a carga de aulas da semana deste professor.' },
    { title: 'Lance ou importe aulas', text: 'Use "Nova aula" ou "Importar aulas". As aulas já ficam ligadas a este professor.' },
    { title: 'Altere uma aula', text: 'Clique em uma aula do quadro para editar, duplicar ou excluir. Clique em um espaço vazio para lançar uma aula nele.' },
  ],
  classes: [
    { title: 'Cadastre as turmas', text: 'Use "Nova turma" informando o turno (manhã, tarde, noite ou integral), ou "Importar" a partir de uma planilha.' },
    { title: 'Altere quando precisar', text: 'Clique em "Editar" na linha da turma. Para inativar ou excluir, use o botão "…" no fim da linha.' },
    { title: 'Acompanhe a grade', text: 'A barra de preenchimento mostra quantos horários da turma já têm aula. Clique no nome para ver o quadro dela.' },
  ],
  classDetail: [
    { title: 'Veja o quadro da turma', text: 'A grade mostra as aulas de cada dia e horário. Os espaços vazios ainda não têm aula.' },
    { title: 'Lance ou importe aulas', text: 'Clique em um espaço vazio, use "Nova aula" ou "Importar aulas". As aulas já ficam ligadas a esta turma.' },
    { title: 'Altere uma aula', text: 'Clique em uma aula para editar, duplicar ou excluir. Conflitos de horário são avisados antes de salvar.' },
  ],
  subjects: [
    { title: 'Cadastre as disciplinas', text: 'Use "Nova disciplina" ou "Importar". Cada disciplina tem uma cor, que facilita encontrá-la nas grades.' },
    { title: 'Altere nome ou cor', text: 'Clique em "Editar" na linha da disciplina. As aulas acompanham a mudança automaticamente.' },
    { title: 'Veja onde ela aparece', text: 'A tabela mostra quantas aulas, professores e turmas usam cada disciplina.' },
  ],
  schedule: [
    { title: 'Escolha o dia e o turno', text: 'Use as abas de dias e de turnos. Os filtros de professor, turma e disciplina ajudam a encontrar aulas.' },
    { title: 'Lance uma aula', text: 'Clique em um espaço vazio da grade: o formulário já abre com a turma, o dia e o horário preenchidos.' },
    { title: 'Altere uma aula', text: 'Clique em uma aula para editar, duplicar ou excluir. O sistema impede que um professor ou turma fique em dois lugares ao mesmo tempo.' },
  ],
  teacherSchedule: [
    { title: 'Escolha o professor', text: 'Use a lista no topo ou as setas para passar de um professor para o outro.' },
    { title: 'Lance uma aula', text: 'Clique em um espaço vazio da grade para lançar uma aula para este professor naquele horário.' },
    { title: 'Imprima ou salve em PDF', text: 'Use "Imprimir ou PDF" para entregar o horário ao professor.' },
  ],
  classSchedule: [
    { title: 'Escolha a turma', text: 'Use a lista no topo ou as setas para passar de uma turma para a outra.' },
    { title: 'Lance uma aula', text: 'Clique em um espaço vazio da grade para lançar uma aula para esta turma naquele horário.' },
    { title: 'Imprima ou salve em PDF', text: 'Use "Imprimir ou PDF" para afixar o horário na sala.' },
  ],
  builderClass: [
    { title: 'Escolha a turma', text: 'Use a lista no topo ou as setas. A grade mostra a semana inteira da turma, com os horários do turno dela.' },
    { title: 'Preencha cada horário', text: 'Em cada quadradinho, escolha a disciplina e depois o professor. Os professores que lecionam a disciplina aparecem primeiro; os ocupados em outra turma ficam bloqueados.' },
    { title: 'Salve de uma vez', text: 'Os horários alterados ficam destacados. Clique em "Salvar quadro" no rodapé para gravar tudo, ou em "Descartar" para voltar como estava.' },
  ],
  builderTeacher: [
    { title: 'Escolha o professor', text: 'Use a lista no topo ou as setas. As disciplinas dele aparecem logo abaixo e podem ser configuradas ali mesmo.' },
    { title: 'Preencha cada horário', text: 'Em cada quadradinho, escolha a turma e a disciplina. As disciplinas do professor aparecem primeiro; turmas já ocupadas ficam bloqueadas.' },
    { title: 'Salve de uma vez', text: 'Os horários alterados ficam destacados. Clique em "Salvar quadro" no rodapé para gravar tudo, ou em "Descartar" para voltar como estava.' },
  ],
  workload: [
    { title: 'Leia a tabela', text: 'Cada linha é um professor e cada coluna uma turma. O número mostra quantas aulas (ou horas) ele dá naquela turma por semana.' },
    { title: 'Totais', text: 'A última coluna soma a carga de cada professor; a última linha soma cada turma. O canto inferior traz o total da escola.' },
    { title: 'Detalhe e exporte', text: 'Clique no nome do professor para ver a carga por disciplina. Use "Exportar Excel" para levar a tabela para a planilha.' },
  ],
  settings: [
    { title: 'Calendário e turnos', text: 'Marque os dias letivos e os turnos em que a escola funciona.' },
    { title: 'Horários dos turnos', text: 'Na segunda aba, ajuste o início e o fim de cada aula e intervalo, ou use o gerador automático.' },
    { title: 'Salve com segurança', text: 'Clique em salvar ao terminar. Mudanças aqui nunca apagam aulas: o sistema avisa antes se alguma ficar fora da grade.' },
  ],
} satisfies Record<string, GuideStep[]>;
