# Tutorial visual do SEICE para computador

Guia de uso com **71 slides**, capturas reais da interface desktop e instruções de clique passo a passo. Revisão de **18/11/2026**.

[Baixar o PowerPoint completo](tutorial/SEICE-Tutorial-Completo-2026-11-18.pptx)

O treinamento começa com o ambiente vazio. As etapas que precisam de cadastros usam exemplos fictícios identificados no material. A preparação deste tutorial não alterou nem apagou dados do sistema real. As permissões de cada conta podem limitar as unidades e opções disponíveis.

## Ordem recomendada

1. Confira calendário, turnos e períodos em Configurações.
2. Cadastre disciplinas, professores e turmas.
3. Informe disponibilidade e atribuições.
4. Lance as aulas ou use Montar quadro.
5. Confira a carga do RH e as regras pedagógicas do PPP.
6. Revise os filtros e exporte o PDF ou Excel.

## Onde encontrar cada assunto

| Assunto | Slides |
| --- | --- |
| Começo | 4–6 |
| Configurações | 7–11 |
| Disciplinas | 12–15 |
| Professores | 16–23 |
| Turmas | 24–26 |
| Importação | 27–29 |
| Atribuições | 30–33 |
| Grade | 34–43 |
| Montagem | 44–45 |
| RH | 46–59 |
| Impressão | 60–61 |
| PPP | 62–68 |
| Ajuda | 69–70 |

## Atalhos para as telas

| Tela | Endereço |
| --- | --- |
| Dashboard | [Abrir tela](https://seice-horarios.vercel.app/) |
| Professores | [Abrir tela](https://seice-horarios.vercel.app/professores) |
| Turmas | [Abrir tela](https://seice-horarios.vercel.app/turmas) |
| Disciplinas | [Abrir tela](https://seice-horarios.vercel.app/disciplinas) |
| Quadro geral | [Abrir tela](https://seice-horarios.vercel.app/horarios) |
| Por professor | [Abrir tela](https://seice-horarios.vercel.app/horarios/professor) |
| Por turma | [Abrir tela](https://seice-horarios.vercel.app/horarios/turma) |
| Atribuição de aulas | [Abrir tela](https://seice-horarios.vercel.app/atribuicoes) |
| Montar quadro | [Abrir tela](https://seice-horarios.vercel.app/horarios/montar) |
| Carga horária · RH | [Abrir tela](https://seice-horarios.vercel.app/horarios/carga) |
| Carga pedagógica · PPP | [Abrir tela](https://seice-horarios.vercel.app/horarios/carga-pedagogica) |
| Configurações | [Abrir tela](https://seice-horarios.vercel.app/configuracoes) |
| Atualizações | [Abrir tela](https://seice-horarios.vercel.app/atualizacoes) |

Os links exigem uma sessão autenticada. O tutorial não inclui credenciais de acesso.

## Dúvidas frequentes

### Onde altero Técnico ou Regular?

Em **Disciplinas**, clique no nome da matéria ou em **Editar**. O campo **Tipo de tempo para o RH** fica logo abaixo do nome. Ele define o padrão da disciplina. Para uma exceção, abra uma aula na grade, clique em **Editar** e use **Tipo da carga no relatório**. A classificação segue a disciplina quando a aula está em Automático.

### Como separo os tipos para o RH?

Em **Carga horária · RH**, expanda o professor. O resumo mostra os tempos e minutos regulares e técnicos por turma. A impressão do professor e as exportações também apresentam essa separação. Uma turma de curso técnico pode conter matérias regulares. O sistema não calcula valores em reais.

### Regência e aulas se somam?

A regência usa carga fixa por turma e pelos dias informados. Infantil usa 4h por dia, equivalentes a 20h e 1.200 minutos em cinco dias. Fundamental I usa 4h30 por dia, equivalentes a 22h30 e 1.350 minutos em cinco dias. As disciplinas dessa regência não multiplicam a carga. Configure em **Carga horária · RH → Configurar cargas e professores → Configurar regências**.

### Personalizar PPP muda o pagamento?

Não. Em **Carga pedagógica · PPP → Personalizar cálculo**, as regras pedagógicas seguem ano e unidade. O padrão da unidade é herdado pelo segmento e pela turma. Personalize apenas os campos diferentes. Essas regras não alteram o pagamento do RH.

### Por que 1h40 pode produzir totais anuais diferentes?

Dois tempos de 50 minutos equivalem a 1h40 por semana. A projeção depende da base escolhida. Em 24 semanas, são 40 horas. Com 201 dias e cinco dias por semana, são 40,2 semanas equivalentes e 67 horas projetadas. Revise a base no PPP antes de exportar. O cálculo usa a grade atual e não comprova presença.

### Como exporto só alguns professores?

Em **Carga horária · RH → Baixar PDF ou Excel**, use **Escolher** em Professores, pesquise e marque os nomes desejados. Use **Todos os professores** para voltar ao conjunto completo, respeitando os outros filtros. A seleção funciona também para turmas, disciplinas e unidades.

## Instruções por tela

### Começo

#### Slide 4 — Acesso ao sistema

**Caminho:** Login.

1. **Preencher os campos:** Digite seu e-mail e sua senha nos campos da tela.
2. **Manter conectado:** Marque a opção somente em um computador de confiança.
3. **Entrar:** Clique em Entrar. Se não conseguir acessar, procure a administração responsável.

#### Slide 5 — Menu e navegação

**Caminho:** Menu lateral.

1. **Abrir uma tela:** Clique no nome da página no menu lateral.
2. **Encontrar a função:** Use Cadastros para os registros e Horários para a grade e os relatórios.
3. **Abrir a ajuda:** No topo da página, clique em Como usar para ler as orientações daquela tela.

#### Slide 6 — Dashboard com o sistema vazio

**Caminho:** Dashboard.

1. **Ver os primeiros passos:** Na página inicial, localize a seção Primeiros passos.
2. **Seguir a ordem:** Comece revisando os turnos e depois cadastre professores e turmas.
3. **Voltar para acompanhar:** Depois dos lançamentos, volte ao Dashboard para conferir os indicadores e as pendências.

### Configurações

#### Slide 7 — Calendário e turnos

**Caminho:** Configurações / Calendário e turnos.

1. **Abrir as configurações:** No menu, clique em Configurações. Abra Calendário e turnos.
2. **Marcar as opções:** Escolha os dias letivos, os turnos e a duração padrão da aula.
3. **Salvar:** Clique em Salvar configurações. Leia a confirmação se o sistema mostrar algum aviso.

#### Slide 8 — Datas sem aula

**Caminho:** Configurações / Calendário e turnos.

1. **Adicionar data:** Informe feriados, recessos e outras datas sem aula.
2. **Efeito no mensal:** A carga mensal desconta essas datas. A grade semanal continua cadastrada.
3. **Abrangência:** As datas desta configuração valem para as duas unidades.

#### Slide 9 — Horários de cada turno

**Caminho:** Configurações / Horários dos turnos.

1. **Escolher o turno:** Em Configurações, abra Horários dos turnos e clique em Manhã, Tarde ou Noite.
2. **Conferir as linhas:** Em cada período, confira tipo, nome, início e término. Aula e intervalo têm tipos diferentes.
3. **Salvar a sequência:** Clique em Salvar horários. Leia os avisos antes de confirmar uma mudança.

#### Slide 10 — Gerador de períodos

**Caminho:** Horários dos turnos / Gerar automaticamente.

1. **Preencher a sequência:** Informe início, quantidade de aulas e duração de cada aula.
2. **Intervalo:** Indique depois de qual aula haverá intervalo e sua duração.
3. **Conferir antes de salvar:** Gere a sequência, revise as linhas e salve os horários do turno.

#### Slide 11 — Unidades

**Caminho:** Configurações / Unidades.

1. **Identificação:** Consulte as unidades e os dados disponíveis nesta aba.
2. **Vínculo dos cadastros:** Cada turma pertence a uma unidade. Professores podem atuar em mais de uma.
3. **Acesso:** As opções disponíveis dependem das unidades permitidas para o seu usuário.

### Disciplinas

#### Slide 12 — Lista de disciplinas vazia

**Caminho:** Cadastros / Disciplinas.

1. **Nova disciplina:** Cadastre as matérias antes de organizar as aulas.
2. **Modelo e importação:** Use a planilha modelo para cadastrar várias de uma vez.
3. **Depois de cadastrar:** A lista permite pesquisar, editar e consultar onde cada matéria aparece.

#### Slide 13 — Cadastro de disciplina

**Caminho:** Disciplinas / Nova disciplina.

1. **Abrir o cadastro:** Em Disciplinas, clique em Nova disciplina e informe o nome.
2. **Definir as opções:** Escolha o tipo para o RH, os segmentos e a cor usada na grade.
3. **Cadastrar:** Revise os campos e clique em Cadastrar disciplina.

#### Slide 14 — Técnico ou Regular no RH

**Caminho:** Disciplinas / nome da matéria / Editar disciplina.

1. **Abrir a matéria:** Em Disciplinas, clique no nome da matéria ou em Editar.
2. **Escolher o tipo:** Abaixo do nome, em Tipo de tempo para o RH, selecione Regular, Técnico ou Automático.
3. **Salvar a alteração:** Clique em Salvar alterações. As aulas em Automático seguem esse padrão.

Matemática e outras matérias gerais continuam regulares mesmo em um curso técnico.

#### Slide 15 — Consulta e edição das matérias

**Caminho:** Cadastros / Disciplinas.

1. **Pesquisa:** Localize a matéria pelo nome e confira seu uso.
2. **Editar:** Clique no nome ou em Editar para corrigir o cadastro.
3. **Classificação visível:** A lista identifica se a disciplina usa tempo Técnico ou Regular.

Nesta etapa, os nomes e dados são exemplos fictícios de treinamento.

### Professores

#### Slide 16 — Lista de professores vazia

**Caminho:** Cadastros / Professores.

1. **Novo professor:** Abre o cadastro individual.
2. **Importar:** Permite trazer uma lista por Excel ou CSV.
3. **Evitar duplicidade:** Antes de criar outro cadastro, pesquise se a pessoa já existe.

#### Slide 17 — Novo professor

**Caminho:** Professores / Novo professor.

1. **Abrir e identificar:** Em Professores, clique em Novo professor e preencha o nome completo.
2. **Escolher onde atua:** Marque a unidade e os segmentos. Marque CE e JP se ele atuar nas duas unidades.
3. **Completar os dados:** Selecione as disciplinas e preencha os outros campos, quando necessário.

#### Slide 18 — Finalização do cadastro

**Caminho:** Professores / Novo professor.

1. **Informações complementares:** Revise observações, segmentos e disciplinas selecionadas.
2. **Cadastro ativo:** Um professor inativo continua no histórico e não recebe novas aulas.
3. **Confirmar:** Use Cadastrar professor. Na edição, salve as alterações do cadastro.

#### Slide 19 — Pesquisa e ações da lista

**Caminho:** Cadastros / Professores.

1. **Localizar o professor:** Digite o nome na pesquisa. Se precisar, ajuste os filtros de situação, segmento e unidade.
2. **Consultar o cadastro:** Clique no nome do professor para abrir os detalhes e a grade.
3. **Corrigir informações:** Para mudar os dados, clique em Editar e depois salve as alterações.

#### Slide 20 — Detalhes do professor

**Caminho:** Professores / nome do professor.

1. **Dados e foto:** Confira matrícula, disciplinas e demais dados do cadastro.
2. **Atalhos:** Editar, Imprimir e Nova aula ficam no topo.
3. **Seções da página:** Role para configurar carga de relatórios, disponibilidade e quadro semanal.

#### Slide 21 — Dias e horários na escola

**Caminho:** Professor / Dias e horários na escola.

1. **Informar disponibilidade:** Indique os dias e as faixas de horário em que o professor está na escola.
2. **Atalhos de turno:** Use as opções de turno para preencher e depois ajuste os horários.
3. **Salvar:** O sistema bloqueia novas aulas fora das faixas informadas.

Sem disponibilidade informada, o professor pode receber aulas em qualquer horário.

#### Slide 22 — Carga semanal de referência

**Caminho:** Professor / Carga horária para relatórios.

1. **Adicionar referência:** Informe disciplina ou curso, tipo Regular/Técnico e tempos por semana.
2. **Salvar carga:** Use Salvar carga para relatórios após a revisão.
3. **Uso da referência:** Serve para comparar com a grade. Não cria aulas nem dias e horários.

#### Slide 23 — Inativar, reativar e excluir

**Caminho:** Professor / Mais ações.

1. **Inativar:** Use quando o professor deixar de receber novas aulas, mantendo o histórico.
2. **Reativar:** Permite voltar a utilizar um cadastro inativo.
3. **Excluir:** Leia a confirmação e os impactos apresentados antes de continuar.

### Turmas

#### Slide 24 — Lista de turmas vazia

**Caminho:** Cadastros / Turmas.

1. **Nova turma:** Cadastre as turmas que terão grade de horários.
2. **Importar:** Use uma planilha para cadastrar várias turmas.
3. **Organização:** A unidade e o turno ajudam o sistema a mostrar a grade correta.

#### Slide 25 — Cadastro de turma

**Caminho:** Turmas / Nova turma.

1. **Abrir o cadastro:** Em Turmas, clique em Nova turma. Informe a identificação e o ano, série ou etapa.
2. **Selecionar unidade e turno:** Escolha onde a turma funciona e se é manhã, tarde, noite ou integral.
3. **Confirmar:** Confira os dados e clique em Cadastrar turma.

#### Slide 26 — Detalhes e grade da turma

**Caminho:** Turmas / nome da turma.

1. **Consulta:** Veja dados da turma, professores e disciplinas utilizados.
2. **Grade:** O quadro semanal mostra as aulas já lançadas.
3. **Manutenção:** Use os atalhos de edição, impressão e nova aula conforme a necessidade.

### Importação

#### Slide 27 — Arquivo e modelo de planilha

**Caminho:** Cadastros / Importar.

1. **Baixar modelo:** Use o modelo da própria tela para conferir as colunas esperadas.
2. **Escolher arquivo:** Selecione Excel (.xlsx) ou CSV.
3. **Revisão:** A importação tem etapas de conferência antes da gravação.

#### Slide 28 — Associação das colunas

**Caminho:** Importar / Colunas.

1. **Cabeçalho:** Confira a aba da planilha e a linha que contém os títulos.
2. **Associar:** Relacione cada campo à coluna correta e revise a prévia.
3. **Verificar linhas:** Continue para a validação dos registros.

O exemplo usa dados fictícios. Cada tipo de importação possui seus próprios campos.

#### Slide 29 — Conferência antes da gravação

**Caminho:** Importar / Revisão.

1. **Ler o resultado:** Confira quais linhas serão criadas, atualizadas ou apresentam erro.
2. **Corrigir erros:** Volte à etapa anterior ou ajuste a planilha. Use o arquivo de erros quando disponível.
3. **Gravar registros:** Confirme somente depois de revisar o resultado.

### Atribuições

#### Slide 30 — Atribuição de aulas

**Caminho:** Horários / Atribuição de aulas.

1. **Finalidade:** Define quem assume cada disciplina em cada turma e quantas aulas por semana.
2. **Pré-requisitos:** Cadastre professores, turmas e disciplinas antes de começar.
3. **Grade e atribuição:** Atribuir uma carga não ocupa automaticamente os horários da semana.

#### Slide 31 — Atribuição por professor

**Caminho:** Atribuição de aulas / Por professor.

1. **Escolher professor:** Selecione a pessoa na lista da esquerda.
2. **Atribuir turmas:** Abra a seleção de disciplina e turmas.
3. **Acompanhamento:** Confira o total atribuído e quantas aulas já foram colocadas na grade.

#### Slide 32 — Uma disciplina em várias turmas

**Caminho:** Por professor / Atribuir turmas.

1. **Disciplina:** Escolha qual matéria o professor vai assumir.
2. **Turmas e quantidade:** Marque as turmas e informe as aulas por semana.
3. **Confirmar:** Revise as escolhas e salve a atribuição.

#### Slide 33 — Atribuição por turma

**Caminho:** Atribuição de aulas / Por turma.

1. **Escolher turma:** Use o seletor ou as setas de navegação.
2. **Professor e aulas:** Defina o professor de cada disciplina e a quantidade semanal.
3. **Gravação:** As alterações da atribuição por turma são salvas automaticamente.

### Grade

#### Slide 34 — Quadro geral no primeiro uso

**Caminho:** Horários / Quadro geral.

1. **Tela de consulta:** Reúne as aulas da escola por dia e turno.
2. **Sistema vazio:** Sem professores e turmas, o sistema oferece atalhos para cadastrá-los.
3. **Depois dos cadastros:** Os filtros e a grade passam a mostrar as turmas e aulas disponíveis.

#### Slide 35 — Quadro geral por dia

**Caminho:** Horários / Quadro geral.

1. **Escolher dia e turno:** Em Quadro geral, clique no dia da semana e no turno desejados.
2. **Filtrar a consulta:** Selecione a unidade e, se necessário, professor, turma ou disciplina.
3. **Abrir o horário:** Clique em um espaço vazio para lançar aula. Clique em uma aula para ver seus detalhes.

#### Slide 36 — Semana inteira

**Caminho:** Quadro geral / Semana inteira.

1. **Abrir a semana:** Em Quadro geral, clique em Semana inteira.
2. **Escolher o recorte:** Selecione o turno e ajuste os filtros. Use o seletor da agenda para escolher uma turma.
3. **Conferir as aulas:** Leia as aulas de cada dia. Se nada aparecer, revise os filtros e o turno.

#### Slide 37 — Horários por professor

**Caminho:** Horários / Por professor.

1. **Abrir a consulta:** No menu, clique em Por professor.
2. **Escolher a pessoa:** Pesquise o professor no seletor do topo ou use as setas.
3. **Consultar ou imprimir:** Clique em uma aula para ver os detalhes. Para o relatório, clique em Imprimir ou PDF.

#### Slide 38 — Horários por turma

**Caminho:** Horários / Por turma.

1. **Abrir a consulta:** No menu, clique em Por turma.
2. **Escolher a turma:** Pesquise no seletor do topo ou use as setas para navegar.
3. **Ler a grade:** Confira disciplina e professor. Use Mostrar horários e Mostrar intervalos para ajustar a exibição.

#### Slide 39 — Nova aula

**Caminho:** Quadro geral / Nova aula.

1. **Preencher turma e professor:** Clique em Nova aula e escolha a turma, o professor e a disciplina.
2. **Escolher dia e horário:** Clique no dia e no tempo da grade. Use Personalizado se precisar informar início e término.
3. **Salvar a aula:** Confira os avisos e clique em Salvar aula. Salvar e adicionar outra abre o próximo lançamento.

#### Slide 40 — Detalhes de uma aula

**Caminho:** Grade / clique em uma aula.

1. **Consultar:** Confira turma, professor, dia e horário no painel aberto.
2. **Editar e duplicar:** Editar altera a aula. Duplicar abre uma nova aula baseada nela.
3. **Excluir:** A exclusão exige confirmação. Confira qual aula está selecionada.

#### Slide 41 — Exceção de classificação na aula

**Caminho:** Aula / Editar / Tipo da carga no relatório.

1. **Abrir a edição:** Na grade, clique na aula e depois em Editar.
2. **Escolher a classificação:** Em Tipo da carga no relatório, escolha Automático, Tempo regular ou Tempo técnico.
3. **Salvar:** Clique em Salvar alterações. Não contabilizar exclui a aula do cálculo de pagamento.

O campo da aula se chama “Tipo da carga no relatório”. Na disciplina, o nome é “Tipo de tempo para o RH”.

#### Slide 42 — Avisos de horário ocupado

**Caminho:** Nova aula ou Editar aula / horário ocupado.

1. **Ler o aviso:** Confira quem ocupa o horário e os dados da aula existente.
2. **Outra unidade:** O aviso identifica a unidade e o horário do professor quando houver conflito entre unidades.
3. **Ajustar:** Escolha outro tempo ou utilize as opções de resolução apresentadas.

#### Slide 43 — Resolução de conflito

**Caminho:** Aula / Este horário já está ocupado.

1. **Revisar o impacto:** O sistema mostra a aula que ocupa o horário.
2. **Escolher solução:** Use as opções disponíveis, como substituir, trocar horários ou mudar o professor.
3. **Confirmar:** A gravação só acontece depois da confirmação e da validação dos conflitos.

### Montagem

#### Slide 44 — Montar quadro por turma

**Caminho:** Horários / Montar quadro / Por turma.

1. **Abrir a turma:** Em Montar quadro, selecione Por turma e escolha a turma no topo.
2. **Preencher os horários:** Em cada célula, escolha a disciplina e o professor. Repita nos horários que deseja montar.
3. **Salvar o conjunto:** Confira as células alteradas e clique em Salvar quadro. Sair sem salvar descarta as mudanças pendentes.

#### Slide 45 — Montar quadro por professor

**Caminho:** Horários / Montar quadro / Por professor.

1. **Abrir o professor:** Em Montar quadro, selecione Por professor e escolha o nome no topo.
2. **Escolher turma e disciplina:** Use as turmas livres no horário desejado e confira a disciplina. As ocupadas exibem o motivo.
3. **Conferir e salvar:** Revise os horários preenchidos e clique em Salvar quadro para gravar o conjunto.

### RH

#### Slide 46 — Carga horária no primeiro uso

**Caminho:** Horários / Carga horária · RH.

1. **Finalidade:** Confere tempos e minutos para pagamento por professor, turma e disciplina.
2. **Base:** Os totais usam as aulas cadastradas e as regências salvas.
3. **Sistema vazio:** Sem aulas ou regências, os totais começam em zero.

#### Slide 47 — Filtros e totais do RH

**Caminho:** Horários / Carga horária · RH.

1. **Escolher o período:** Em Carga horária · RH, clique em Diário, Semanal ou Mensal.
2. **Escolher quem entra:** Use Todos ou Escolher para professores, turmas, disciplinas e unidades. Ajuste o turno.
3. **Conferir os totais:** Leia os tempos, minutos e horas do recorte. Expanda um professor para ver os detalhes.

O sistema não calcula o valor em reais. O RH usa os tempos e minutos no sistema de pagamento.

#### Slide 48 — Cálculo mensal pelo calendário

**Caminho:** Carga horária · RH / Mensal.

1. **Escolher mês:** Selecione o mês e o ano que deseja conferir.
2. **Ocorrências dos dias:** O cálculo considera quantas vezes cada dia da grade ocorre no mês.
3. **Datas excluídas:** As datas sem aula configuradas são descontadas da carga mensal.

O relatório aplica a grade atual ao mês escolhido. Ele não comprova presença.

#### Slide 49 — Regulares e técnicos por turma

**Caminho:** Carga horária · RH / expandir professor.

1. **Expandir o professor:** Na carga horária do RH, clique no nome do professor.
2. **Localizar o resumo:** Role até Resumo por turma · regulares e técnicos.
3. **Conferir os valores:** Leia os tempos, minutos e disciplinas de cada tipo em cada turma.

#### Slide 50 — Configurar cargas e professores

**Caminho:** Carga horária · RH / Configurar cargas e professores.

1. **Conferir professores:** Vincula uma referência recebida ao cadastro correto.
2. **Configurar regências:** Indica quem é regente e em quais turmas e dias.
3. **Sem lista recebida:** A conferência fica vazia. As regências podem ser configuradas na outra aba.

#### Slide 51 — Conferência de uma referência

**Caminho:** Configurar cargas / Conferir cadastro.

1. **Nome recebido:** Confira o nome e a carga informados na referência.
2. **Buscar a pessoa:** Pesquise no cadastro existente antes de criar outro professor.
3. **Comparar:** Nome parecido não garante que seja a mesma pessoa. Confira matrícula e unidade.

A referência deste exemplo é fictícia e serve apenas para explicar o procedimento.

#### Slide 52 — Pesquisa do cadastro existente

**Caminho:** Conferir cadastro / pesquisa de professor.

1. **Pesquisar:** Digite o nome no campo de busca.
2. **Lista ampla:** Leia nome, matrícula e unidade. Use a rolagem para ver as opções.
3. **Escolher:** Selecione a mesma pessoa indicada na referência.

#### Slide 53 — Confirmação do vínculo

**Caminho:** Conferir cadastro / Confirmar vínculo da referência.

1. **Conferir os dados:** Leia a identificação escolhida e o aviso de atualização da referência.
2. **Marcar confirmação:** Confirme que a referência pertence à pessoa selecionada.
3. **Salvar vínculo:** A referência vai para esse cadastro. O sistema preserva nome e horários.

#### Slide 54 — Professor ainda não cadastrado

**Caminho:** Conferir cadastro / Cadastrar e vincular.

1. **Pesquisa antes:** Use esta opção somente depois de conferir os cadastros existentes.
2. **Uma confirmação:** Revise nome, unidade e carga no modal.
3. **Resultado:** Ao confirmar, o sistema cria o professor e vincula a referência. Não cria aulas na grade.

#### Slide 55 — Regência com carga fixa

**Caminho:** Configurar cargas / 2. Configurar regências.

1. **Abrir as regências:** Em Carga horária · RH, clique em Configurar cargas e professores e na aba 2. Configurar regências.
2. **Escolher o professor:** Pesquise o nome no campo de seleção e clique no cadastro correto.
3. **Adicionar a turma:** Confira a unidade e clique em Adicionar turma de regência.

#### Slide 56 — Turma e dias de regência

**Caminho:** Configurar regências / Adicionar turma de regência.

1. **Turma e regra:** Escolha a turma e Infantil ou Fundamental I.
2. **Dias e total:** Marque os dias. Infantil usa 4h/dia e Fundamental I usa 4h30/dia.
3. **Salvar regências:** Confira o total exibido e salve antes de concluir.

Em cinco dias: Infantil = 20h = 1.200 min. Fundamental I = 22h30 = 1.350 min. As disciplinas não multiplicam essa carga.

#### Slide 57 — Escolha do PDF ou Excel

**Caminho:** Carga horária · RH / Baixar PDF ou Excel.

1. **Modal de exportação:** Os filtros da página já entram no recorte da exportação.
2. **Ajustar escolhas:** Você pode mudar período, professor, turma, matéria ou unidade no modal.
3. **Formato:** Escolha Relatório PDF ou Planilha Excel antes de baixar.

#### Slide 58 — Um professor ou vários

**Caminho:** Exportação / Professores / Escolher.

1. **Todos os professores:** Inclui todos os disponíveis, respeitando os outros filtros.
2. **Escolher:** Pesquise e marque apenas os nomes desejados.
3. **Finalizar seleção:** Use Concluir seleção e confira os totais antes de baixar.

A mesma lógica vale para turmas, disciplinas e unidades. Selecionar professor restringe as disciplinas às aulas dele.

#### Slide 59 — Download da planilha

**Caminho:** Exportação / Planilha Excel.

1. **Selecionar Excel:** Marque Planilha Excel no formato da exportação.
2. **Revisar recorte:** Confira período, filtros e o resumo apresentado.
3. **Baixar:** Clique em Baixar planilha Excel. O arquivo contém o detalhamento do recorte.

### Impressão

#### Slide 60 — Relatório semanal do professor

**Caminho:** Por professor / Imprimir ou PDF.

1. **Resumo:** Confira tempos regulares, técnicos, regência e total semanal.
2. **Por turma:** Veja a classificação, as disciplinas e os minutos de cada turma.
3. **Dias no colégio:** Os dias distintos ajudam na conferência de vale-transporte. Não são registro de presença.

#### Slide 61 — Grade da turma em PDF

**Caminho:** Por turma / Imprimir ou PDF.

1. **Visualização:** A página reúne identificação da turma e quadro semanal.
2. **Horários e intervalos:** Ajuste a exibição pelas opções no topo.
3. **Salvar PDF:** Clique em Imprimir ou salvar PDF e escolha Salvar como PDF na janela do navegador.

### PPP

#### Slide 62 — Carga pedagógica da grade

**Caminho:** Horários / Carga pedagógica · PPP.

1. **Finalidade:** Avalia carga semanal e total projetada por turma e disciplina.
2. **Base:** Usa as aulas da grade e as regras pedagógicas salvas.
3. **Separação do RH:** Personalizar esta tela não altera as regras de pagamento do RH.

#### Slide 63 — Padrão por ano e unidade

**Caminho:** Carga pedagógica · PPP / Personalizar cálculo.

1. **Abrir o cálculo:** No PPP, confira o ano e clique em Personalizar cálculo. Selecione a unidade.
2. **Preencher o padrão:** Na aba 1. Padrão da unidade, defina a base, os dias de aula e os minutos por tempo.
3. **Salvar a regra:** Clique em Salvar regra. Esse padrão vale para as turmas que não têm exceções.

201 dias e 50 minutos são sugestões editáveis. Revise os valores antes de salvar.

#### Slide 64 — Minutos por segmento

**Caminho:** Personalizar cálculo / 2. Segmento.

1. **Selecionar o segmento:** Abra Personalizar cálculo, clique em 2. Segmento e escolha o segmento desejado.
2. **Alterar os minutos:** Marque Personalizar em Minutos pedagógicos por tempo e digite a duração.
3. **Salvar:** Clique em Salvar regra. Os campos não personalizados continuam seguindo o padrão da unidade.

#### Slide 65 — Exceção para uma turma

**Caminho:** Personalizar cálculo / 3. Turma.

1. **Selecionar a turma:** Abra Personalizar cálculo, clique em 3. Turma e pesquise a turma.
2. **Definir o que muda:** Marque Personalizar somente nos campos que precisam ser diferentes. Preencha os valores.
3. **Salvar:** Clique em Salvar regra. A exceção da turma tem prioridade sobre as regras herdadas.

#### Slide 66 — Ano inteiro ou módulo

**Caminho:** Personalizar cálculo / Base do cálculo.

1. **Dias letivos:** Para o ano, o sistema divide os dias letivos pelos dias de aula por semana.
2. **Módulo ou semestre:** Escolha Semanas e informe quantas semanas o período possui.
3. **Revisar a base:** A duração do tempo e as semanas escolhidas determinam a projeção total.

Exemplo: 2 tempos de 50 min = 1h40 por semana. Em 24 semanas = 40h. Com 201 dias / 5 dias por semana = 67h projetadas.

#### Slide 67 — Filtros e resultado pedagógico

**Caminho:** Carga pedagógica · PPP / Por turma ou Por disciplina.

1. **Filtros:** Escolha ano, unidade, segmento, turma e disciplina.
2. **Agrupamento:** Alterne entre Por turma e Por disciplina.
3. **Leitura:** Confira tempos por semana, minutos por tempo, carga semanal e total projetada.

Uma grade incompleta gera resultados parciais. A projeção não representa aulas realizadas.

#### Slide 68 — Exportação da carga pedagógica

**Caminho:** Carga pedagógica · PPP / Baixar PDF pedagógico ou Baixar Excel.

1. **Mesmo recorte:** Os arquivos usam os filtros e as regras salvas da página.
2. **Pendências:** Salve o padrão das unidades pendentes para liberar a exportação das turmas com aulas.
3. **Formatos:** Use Baixar PDF pedagógico ou Baixar Excel conforme a necessidade.

### Ajuda

#### Slide 69 — Histórico de atualizações

**Caminho:** Menu / Atualizações.

1. **Abrir o histórico:** No menu lateral, clique em Atualizações.
2. **Pesquisar uma mudança:** Digite o assunto no campo de pesquisa da página.
3. **Abrir a tela relacionada:** Leia a novidade e clique no link da função que deseja acessar.

#### Slide 70 — Tamanho do texto no computador

**Caminho:** Rodapé do menu / Tamanho do texto.

1. **Abrir o botão T:** No rodapé do menu lateral, clique no botão T.
2. **Escolher o tamanho:** Clique em Normal, Grande ou Maior. Automático ajusta o texto à tela.
3. **Conferir a leitura:** Continue usando o sistema com o tamanho escolhido. Para mudar, abra o botão T novamente.

## Versão do material

As telas e os procedimentos correspondem à interface conferida em 18/11/2026, versão `815a0a1587e8`. Mudanças posteriores no sistema podem exigir novas capturas. O PowerPoint mantém os textos editáveis e as capturas incorporadas.
