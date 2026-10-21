# SEICE — Gestão de Professores, Turmas e Quadros de Horários

Sistema administrativo do **Colégio SEICE — Sistema de Ensino Integrado de Campos Elíseos** para cadastrar professores, turmas e disciplinas, importar tudo de planilhas Excel ou CSV, montar o quadro de horários com prevenção de conflitos e imprimir/exportar as grades em PDF. Os dados ficam na nuvem, no **Supabase** (PostgreSQL).

## Requisitos

- **Node.js 22.13 ou superior.** Baixe em <https://nodejs.org> a versão LTS.
- **Conta no Supabase** e conexão com a internet: o banco de dados fica na nuvem.

## Configuração do banco (uma vez)

1. Copie `.env.example` para `.env`.
2. Gere um token em <https://supabase.com/dashboard/account/tokens> e cole em `SUPABASE_ACCESS_TOKEN`.
3. Em `SUPABASE_PROJECT_REF`, informe o projeto onde o SEICE será instalado, ou deixe em branco para criar um projeto novo.
4. Rode:

```cmd
npm install
npm run db:setup
```

O comando cria o schema `seice` e um usuário exclusivo da aplicação (`seice_app`), grava a `DATABASE_URL` no `.env` e aplica as migrações. O SEICE **não cria nem altera nada fora do schema `seice`**, então pode dividir o projeto com outro sistema. O usuário da aplicação não tem acesso a tabelas de outros schemas e fica limitado a 5 conexões, e o próprio script confere esse isolamento ao final. O arquivo `.env` contém senhas e não vai para o Git.

## Como executar (Windows — Prompt de Comando)

Abra o Prompt de Comando (cmd) na pasta do projeto e rode:

```cmd
npm run dev
```

Acesse **http://localhost:5173** no navegador. Para encerrar, pressione `Ctrl + C` no Prompt de Comando.

### Uso no dia a dia (versão otimizada)

```cmd
npm run build
npm start
```

Acesse **http://localhost:3333**. Nesse modo, um único processo serve a interface e a API. Para que outros computadores da rede acessem, use o endereço IP da máquina (ex.: `http://192.168.0.10:3333`) e libere a porta 3333 no Firewall do Windows. Para usar outra porta, defina `PORT` no `.env`.

## Onde ficam os dados

Tudo é gravado no PostgreSQL do Supabase, no schema `seice` (tabelas `teachers`, `classes`, `subjects`, `periods`, `settings`, `lessons` e `schema_migrations`). Elas podem ser consultadas no painel do Supabase em *Table Editor*, escolhendo o schema `seice`. Os backups diários são feitos pelo próprio Supabase, conforme o plano do projeto.

Na primeira execução, as migrações criam dias letivos de segunda a sexta e uma grade inicial de períodos para manhã, tarde e noite. São apenas valores de partida, editáveis em **Configurações**. Nenhum professor, turma ou aula fictícia é criado.

## Funcionalidades

- **Dashboard** com indicadores calculados dos dados reais (professores, turmas, aulas, horários vagos, conflitos), distribuição semanal, pendências priorizadas, "agora na escola" e guia de primeiros passos.
- **Professores**: cadastro, edição, pesquisa (ignora acentos), filtros por situação e área, inativação e exclusão protegida (se houver aulas, o sistema explica as consequências e oferece inativar). Página de detalhes com dados, turmas e quadro semanal.
- **Turmas**: cadastro com turno (manhã, tarde, noite ou integral), bloqueio de nomes duplicados, preenchimento da grade, professores e disciplinas da turma.
- **Disciplinas**: página própria com cor de cada disciplina, aulas semanais, carga horária, professores e turmas em que aparece, pesquisa, filtro por uso e atalho para o quadro filtrado.
- **Importação de planilhas (Excel .xlsx ou CSV)** em todas as telas de trabalho:
  - *Professores*, *Turmas* e *Disciplinas*: cria e atualiza cadastros. Registros existentes são reconhecidos pelo nome ou pela matrícula, e você escolhe entre atualizar ou manter.
  - *Quadro de horários*, *Horários por professor/turma* e *páginas de detalhes*: importa aulas. O horário pode ser o período da grade (ex.: "1º horário"), uma faixa ("07:00 às 07:50") ou as colunas Início e Término. Há opção de criar disciplinas que faltarem e de substituir as aulas atuais.
  - *Configurações*: importa os horários dos turnos.
  - Modelos prontos em Excel (com listas de opções e instruções) e CSV.
  - Reconhecimento automático das colunas, com ou sem acentos e em qualquer ordem, e ajuste manual quando preciso.
  - **Revisão antes de gravar**: o servidor valida cada linha com as mesmas regras do cadastro manual, inclusive conflitos de horário, e mostra o que será criado, atualizado, ignorado ou recusado. As linhas com erro podem ser baixadas para correção.
  - Reimportar a mesma planilha não duplica nada.
- **Quadro de horários**:
  - *Visão geral*: turmas × períodos por dia e turno, filtros por professor, turma e disciplina (guardados na URL), limpar filtros com um clique.
  - *Por professor* e *por turma*: grade semanal com navegação anterior/próximo e seleção pesquisável.
  - Clique em um horário vazio abre o formulário já com turma/professor, dia e período preenchidos. Mostra, em cada período, se a turma ou o professor estão ocupados.
  - Detalhes da aula com editar, **duplicar** (os conflitos são verificados de novo) e excluir com confirmação.
  - "Salvar e adicionar outra" mantém turma, professor e disciplina para lançamentos em sequência.
  - Em celulares, a grade vira uma visão por dia.
  - Atalho **N** abre uma nova aula/cadastro nas telas de lista e no quadro.
- **Prevenção de conflitos** em três camadas: verificação ao vivo no formulário, validação no servidor e gatilho no banco de dados, com gravações de aulas serializadas para que dois usuários salvando ao mesmo tempo não criem sobreposição. Detecta professor em duas turmas ao mesmo tempo, turma com aulas simultâneas, sobreposição parcial (08h–09h30 × 09h–10h), término antes do início, professor/turma inativos e dia não habilitado.
- **Configurações**: dias letivos, turnos, duração padrão e horários de cada turno (aulas e intervalos, com gerador automático). Mudanças **nunca alteram nem apagam aulas**: antes de salvar, o sistema mostra quais aulas ficariam fora da grade e pede confirmação; essas aulas aparecem na lista "Fora da grade".
- **Impressão e PDF** por professor, por turma, de todas as turmas ou de todos os professores, em A4 paisagem, com identificação do colégio. Use "Imprimir ou salvar PDF" e escolha *Salvar como PDF* no destino.

## Tecnologias

React 19 · TypeScript · Vite · Tailwind CSS 4 · React Router 7 · TanStack Query · React Hook Form + Zod · Lucide React · ExcelJS · Express 5 · PostgreSQL no Supabase (`pg`) · Vitest + PGlite.

## Estrutura

```
shared/      regras compartilhadas entre interface e servidor
             (tipos, validações Zod, conflitos, grade e importação de planilhas)
server/      API Express, conexão com o Supabase, migrações, gatilho anti-sobreposição
             e motor de importação
scripts/     configuração automática do banco no Supabase
src/
  api/         cliente HTTP e hooks de dados
  components/  ui/ (design system), layout/, schedule/ (grades e editor de aulas)
  features/    formulários e fluxos (professor, turma, disciplina, importação, configurações)
  lib/         utilitários, incluindo leitura de planilhas e geração de modelos
  pages/       telas do sistema
  styles/      tokens visuais (cores da marca, tipografia, animações)
tests/       testes de conflitos, API, importação e leitura de planilhas
             (rodam num PostgreSQL em memória, sem tocar no banco da nuvem)
```

## Comandos úteis

| Comando | O que faz |
| --- | --- |
| `npm run db:setup` | Prepara o banco no Supabase e grava a conexão no `.env` |
| `npm run dev` | Interface (5173) e API (3333) com recarga automática |
| `npm run build` | Verifica os tipos e gera a versão otimizada em `dist\` |
| `npm start` | Executa a versão otimizada em http://localhost:3333 |
| `npm test` | Roda os testes automatizados |
| `npm run typecheck` | Verifica os tipos TypeScript |

## Observações

- O sistema não possui login: destina-se ao uso interno da coordenação em computador ou rede da escola. Se for publicado na internet, será necessário adicionar autenticação. O banco na nuvem só é acessado pelo servidor do SEICE, com o usuário `seice_app`; o schema `seice` não é exposto pela API pública do Supabase.
- A logo usada é a fornecida pela escola (`public\logo-seice.png`); o emblema e o ícone do navegador foram recortados dela.
