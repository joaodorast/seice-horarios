# Tutorial visual do SEICE

Guia de uso com **72 slides**, capturas reais da interface e instruções curtas. Revisão de **18/11/2026**.

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
| Ajuda | 69–71 |

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

1. **Entrar:** Use o e-mail e a senha recebidos da administração.
2. **Manter conectado:** Marque somente quando estiver usando um computador de confiança.
3. **Conta individual:** Se não conseguir entrar, procure a administração responsável.

#### Slide 5 — Menu e navegação

**Caminho:** Menu lateral.

1. **Cadastros:** Professores, Turmas e Disciplinas guardam as informações usadas na grade.
2. **Horários:** As telas de consulta, montagem e relatórios trabalham com esses mesmos cadastros.
3. **Ajuda e leitura:** “Como usar” explica a página. O botão T, no rodapé do menu, ajusta o tamanho do texto.

#### Slide 6 — Dashboard com o sistema vazio

**Caminho:** Dashboard.

1. **Primeiros passos:** Siga as etapas exibidas para preparar o sistema.
2. **Indicadores:** Professores, turmas e aulas começam em zero. Os números mudam com os cadastros.
3. **Pendências:** Use os avisos para abrir o ponto da grade que precisa de revisão.

### Configurações

#### Slide 7 — Calendário e turnos

**Caminho:** Configurações / Calendário e turnos.

1. **Dias letivos:** Marque os dias da semana que aparecem nas grades.
2. **Turnos:** Habilite os turnos utilizados pela escola e revise a duração padrão.
3. **Salvar:** Confira as alterações antes de salvar. O sistema não apaga as aulas existentes.

#### Slide 8 — Datas sem aula

**Caminho:** Configurações / Calendário e turnos.

1. **Adicionar data:** Informe feriados, recessos e outras datas sem aula.
2. **Efeito no mensal:** A carga mensal desconta essas datas. A grade semanal continua cadastrada.
3. **Abrangência:** As datas desta configuração valem para as duas unidades.

#### Slide 9 — Horários de cada turno

**Caminho:** Configurações / Horários dos turnos.

1. **Escolher turno:** Abra Manhã, Tarde ou Noite para conferir os períodos.
2. **Aula ou intervalo:** Em cada linha, confira tipo, nome, início e término.
3. **Salvar horários:** Revise a sequência. O sistema avisa se uma alteração deixar aulas fora da grade.

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

1. **Nome e segmentos:** Informe o nome e marque os segmentos em que a matéria aparece.
2. **Cor da grade:** Escolha a cor usada para reconhecer a disciplina nos horários.
3. **Cadastrar disciplina:** Confira os campos e confirme o cadastro.

#### Slide 14 — Técnico ou Regular no RH

**Caminho:** Disciplinas / nome da matéria / Editar disciplina.

1. **Onde fica:** Logo abaixo do nome está “Tipo de tempo para o RH”.
2. **Classificação:** Escolha Regular (normal), Técnico ou Automático.
3. **Efeito:** As aulas que seguem o padrão da disciplina usam essa classificação nos relatórios.

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

1. **Identificação:** Preencha nome completo e, se necessário, matrícula, telefone e área.
2. **Unidades:** Marque onde o professor atua. Pode selecionar CE e JP quando for o caso.
3. **Segmentos e disciplinas:** Marque os segmentos e as matérias que ele leciona.

#### Slide 18 — Finalização do cadastro

**Caminho:** Professores / Novo professor.

1. **Informações complementares:** Revise observações, segmentos e disciplinas selecionadas.
2. **Cadastro ativo:** Um professor inativo continua no histórico e não recebe novas aulas.
3. **Confirmar:** Use Cadastrar professor. Na edição, salve as alterações do cadastro.

#### Slide 19 — Pesquisa e ações da lista

**Caminho:** Cadastros / Professores.

1. **Filtros:** Use pesquisa e os filtros disponíveis para localizar a pessoa.
2. **Abrir detalhes:** Clique no nome para consultar os dados e a grade.
3. **Editar:** O botão Editar abre o mesmo cadastro para correções.

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

1. **Identificação:** Informe o nome ou código da turma e o ano, série ou etapa.
2. **Unidade e turno:** Escolha a unidade e o turno da turma.
3. **Confirmar:** Revise as informações e use Cadastrar turma.

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

1. **Dia e turno:** Selecione os dias e o turno no topo.
2. **Filtros:** Combine unidade, professor, turma e disciplina.
3. **Abrir horário:** Clique em um espaço vazio para lançar aula ou em uma aula para consultar.

#### Slide 36 — Semana inteira

**Caminho:** Quadro geral / Semana inteira.

1. **Visão semanal:** Compare os dias da semana para o turno selecionado.
2. **Recorte:** Os filtros também valem para a semana inteira.
3. **Sem resultado:** Confira dia, turno, unidade e filtros antes de concluir que a aula não existe.

#### Slide 37 — Horários por professor

**Caminho:** Horários / Por professor.

1. **Seletor:** Pesquise o professor no topo ou use as setas.
2. **Quadro semanal:** Veja em quais turmas e dias ele tem aula.
3. **Imprimir ou PDF:** Abra a visualização de impressão para entregar o horário.

#### Slide 38 — Horários por turma

**Caminho:** Horários / Por turma.

1. **Selecionar turma:** Pesquise a turma no topo ou navegue pelas setas.
2. **Consulta semanal:** Cada aula mostra a disciplina e o professor.
3. **Opções de visualização:** Mostrar horários vem marcado. Intervalos e outras opções ajustam a leitura da grade.

#### Slide 39 — Nova aula

**Caminho:** Quadro geral / Nova aula.

1. **Quem e onde:** Escolha turma, professor e disciplina.
2. **Quando:** Escolha o dia e o tempo da grade ou informe um horário personalizado.
3. **Salvar:** Revise os avisos e confirme. Salvar e adicionar outra agiliza lançamentos em sequência.

#### Slide 40 — Detalhes de uma aula

**Caminho:** Grade / clique em uma aula.

1. **Consultar:** Confira turma, professor, dia e horário no painel aberto.
2. **Editar e duplicar:** Editar altera a aula. Duplicar abre uma nova aula baseada nela.
3. **Excluir:** A exclusão exige confirmação. Confira qual aula está selecionada.

#### Slide 41 — Exceção de classificação na aula

**Caminho:** Aula / Editar / Tipo da carga no relatório.

1. **Automático:** Segue a classificação definida na disciplina.
2. **Regular ou Técnico:** Escolha um tipo específico quando esta aula for uma exceção.
3. **Sem pagamento:** Não contabilizar exclui a aula do cálculo. Sem professor não gera carga para ninguém.

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

1. **Escolher turma:** Abra a turma e confira o turno da grade.
2. **Preencher células:** Escolha disciplina e professor nos horários desejados. A atribuição ajuda a sugerir o professor.
3. **Salvar alterações:** Confira as marcações e salve o conjunto de mudanças.

#### Slide 45 — Montar quadro por professor

**Caminho:** Horários / Montar quadro / Por professor.

1. **Escolher professor:** Veja a semana do professor selecionado.
2. **Horários disponíveis:** Escolha entre as turmas livres. As ocupadas exibem o motivo.
3. **Conferir e salvar:** Revise a carga atribuída, os avisos e as alterações antes de salvar.

### RH

#### Slide 46 — Carga horária no primeiro uso

**Caminho:** Horários / Carga horária · RH.

1. **Finalidade:** Confere tempos e minutos para pagamento por professor, turma e disciplina.
2. **Base:** Os totais usam as aulas cadastradas e as regências salvas.
3. **Sistema vazio:** Sem aulas ou regências, os totais começam em zero.

#### Slide 47 — Filtros e totais do RH

**Caminho:** Horários / Carga horária · RH.

1. **Período:** Escolha Diário, Semanal ou Mensal.
2. **Recorte:** Combine professores, turmas, disciplinas, unidades e turno.
3. **Leitura:** Tempos são a quantidade de aulas. Minutos e horas mostram a carga convertida.

O sistema não calcula o valor em reais. O RH usa os tempos e minutos no sistema de pagamento.

#### Slide 48 — Cálculo mensal pelo calendário

**Caminho:** Carga horária · RH / Mensal.

1. **Escolher mês:** Selecione o mês e o ano que deseja conferir.
2. **Ocorrências dos dias:** O cálculo considera quantas vezes cada dia da grade ocorre no mês.
3. **Datas excluídas:** As datas sem aula configuradas são descontadas da carga mensal.

O relatório aplica a grade atual ao mês escolhido. Ele não comprova presença.

#### Slide 49 — Regulares e técnicos por turma

**Caminho:** Carga horária · RH / expandir professor.

1. **Abrir professor:** Expanda o nome para ver o detalhamento.
2. **Separação por turma:** O resumo mostra tempos regulares, técnicos e seus minutos em cada turma.
3. **Conferência:** As disciplinas de cada tipo aparecem junto aos valores.

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

1. **Professor regente:** É o responsável por uma turma de Infantil ou Fundamental I.
2. **Escolher pessoa:** Pesquise o professor e confira a unidade.
3. **Adicionar turma:** Use Adicionar turma de regência para informar turma, segmento e dias.

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

1. **Ano e unidade:** Confira o ano da página e a unidade do modal.
2. **Padrão da unidade:** Defina base do cálculo, dias letivos, dias por semana e minutos por tempo.
3. **Salvar regra:** O padrão salvo vale para as turmas que não possuem exceções.

201 dias e 50 minutos são sugestões editáveis. Revise os valores antes de salvar.

#### Slide 64 — Minutos por segmento

**Caminho:** Personalizar cálculo / 2. Segmento.

1. **Selecionar segmento:** Escolha Infantil, Fundamental I, Fundamental II, Médio ou outro segmento disponível.
2. **Personalizar:** Marque Personalizar em Minutos pedagógicos por tempo e informe a duração desejada.
3. **Herança:** Os campos não personalizados continuam seguindo o padrão da unidade.

#### Slide 65 — Exceção para uma turma

**Caminho:** Personalizar cálculo / 3. Turma.

1. **Escolher turma:** Pesquise a turma da unidade selecionada.
2. **Definir exceção:** Personalize apenas os campos que precisam ser diferentes.
3. **Salvar:** A regra da turma tem prioridade sobre o segmento e o padrão da unidade.

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

1. **Consultar novidades:** Veja as mudanças publicadas e suas datas.
2. **Pesquisa:** Localize atualizações pelo texto disponível na página.
3. **Abrir a função:** Os links de cada novidade levam à tela relacionada.

#### Slide 70 — Texto maior e uso no celular

**Caminho:** Rodapé do menu / Tamanho do texto.

1. **Botão T:** Abra o controle de tamanho do texto no menu.
2. **Ajustar leitura:** Selecione o tamanho que fica confortável no seu dispositivo.
3. **Celular:** Abra o menu pelo botão próprio. As grades oferecem uma leitura adaptada à tela.

#### Slide 71 — Grade no celular

**Caminho:** Horários / Por turma no celular.

1. **Navegação:** Escolha a turma e o dia pelos controles disponíveis.
2. **Consultar e editar:** Toque nas aulas para abrir os detalhes.
3. **Leitura:** Use as opções de horários e intervalos para ajustar o que aparece na grade.

## Versão do material

As telas e os procedimentos correspondem à interface conferida em 18/11/2026, versão `815a0a1587e8`. Mudanças posteriores no sistema podem exigir novas capturas. O PowerPoint mantém os textos editáveis e as capturas incorporadas.
