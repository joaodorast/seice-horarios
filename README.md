# SEICE — Gestão de Professores, Turmas e Quadros de Horários

Sistema administrativo do **Colégio SEICE — Sistema de Ensino Integrado de Campos Elíseos** para cadastrar professores, turmas e disciplinas, importar tudo de planilhas Excel ou CSV, montar o quadro de horários com prevenção de conflitos e imprimir/exportar as grades em PDF.

| | |
| --- | --- |
| **Produção** | <https://seice-horarios.vercel.app> |
| **Hospedagem** | Vercel (site estático + API serverless em São Paulo, `gru1`) |
| **Banco de dados** | PostgreSQL no Supabase (`sa-east-1`), schema `seice` |
| **Acesso** | Login com e-mail e senha (somente a coordenação) |

> 📘 **Guias para quem usa o sistema:**
> - [Começar do zero](docs/COMECAR-DO-ZERO.md) — do primeiro acesso ao quadro impresso, e a instalação passo a passo.
> - [Guia das telas](docs/GUIA-DAS-TELAS.md) — o que cada tela faz e como as telas se comunicam.
> - [Relatório do sistema](docs/RELATORIO.md) — o que o sistema faz hoje, o que mudou, as regras que ele garante e os próximos passos.

---

## Sumário

1. [Funcionalidades](#funcionalidades)
2. [Arquitetura](#arquitetura)
3. [Acesso e segurança](#acesso-e-segurança)
4. [Importação de planilhas](#importação-de-planilhas)
5. [Banco de dados](#banco-de-dados)
6. [Rodando no computador](#rodando-no-computador)
7. [Publicação na Vercel](#publicação-na-vercel)
8. [Comandos](#comandos)
9. [Testes](#testes)
10. [Estrutura do projeto](#estrutura-do-projeto)
11. [Solução de problemas](#solução-de-problemas)

---

## Funcionalidades

- **Dashboard** com indicadores calculados dos dados reais (professores, turmas, aulas, horários vagos, conflitos), distribuição semanal, pendências priorizadas, "agora na escola" e guia de primeiros passos.
- **Professores**: cadastro, edição, pesquisa (ignora acentos), filtros por situação e área, inativação e exclusão protegida (se houver aulas, o sistema explica as consequências e oferece inativar). Página de detalhes com dados, turmas e quadro semanal.
- **Turmas**: cadastro com turno (manhã, tarde, noite ou integral), bloqueio de nomes duplicados, preenchimento da grade, professores e disciplinas da turma.
- **Professores com várias disciplinas** e **foto**. As disciplinas do professor aparecem primeiro em todas as escolhas.
- **Dias e horários do professor na escola** (página do professor): por dia, de que horas a que horas, com atalhos por turno. Aulas fora desses horários são **recusadas** em todas as telas, na API e na importação; quem ainda não informou pode receber aulas em qualquer horário. No Montar quadro, os horários fora aparecem listrados e o professor fica bloqueado na lista, com o motivo.
- **Disciplinas**: página própria com a cor de cada disciplina, aulas semanais, carga horária, professores e turmas em que aparece, pesquisa, filtro por uso e atalho para o quadro filtrado.
- **Quadro de horários**:
  - *Visão geral*: turmas × períodos por dia e turno, filtros por professor, turma e disciplina (guardados na URL).
  - *Por professor* e *por turma*: grade semanal com navegação anterior/próximo e seleção pesquisável.
  - Clique em um horário vazio abre o formulário já preenchido com turma/professor, dia e período.
  - Detalhes da aula com editar, **duplicar** (os conflitos são verificados de novo) e excluir com confirmação.
  - "Salvar e adicionar outra" mantém turma, professor e disciplina para lançamentos em sequência.
  - Em celulares, a grade vira uma visão por dia. Atalho **N** abre um novo cadastro ou aula.
- **Atribuição de aulas**: quem dá cada disciplina em cada turma e quantas aulas por semana. Por professor (atribui **várias turmas de uma vez**) ou por turma (um professor por disciplina). Salva sozinho e mostra quantas aulas já estão no quadro (*faltam 2*, *completo*, *1 a mais*).
- **Montar quadro**: a semana de uma turma ou de um professor como uma grade editável.
  - Por turma: disciplina + professor em cada horário; o professor **atribuído já vem preenchido**.
  - Por professor: cada horário vago mostra as turmas do turno — **verdes (livres, um clique)** e **cinzas (ocupadas, com quem)**.
  - Faixa "Atribuição desta turma" com o progresso de cada disciplina (**2 de 3**), legenda das cores, alterações destacadas e salvas de uma vez, aula dupla automática e aviso ao sair sem salvar.
- **Quadro geral — Semana inteira**: a semana do turno em uma tela (horários × dias, uma linha por turma), com os mesmos filtros e legenda das cores.
- **Carga horária**: professor × turma com aulas e horas por semana e totais **por semana e por mês** (4, 4,5 ou 5 semanas), detalhe por disciplina e exportação para Excel.
- **Resolução de horário ocupado**: ao lançar uma aula num horário com aula, o sistema oferece **substituir**, **trocar** os horários ou **passar** a aula para outro professor, tudo numa única gravação.
- **Ambiente de teste** (`npm run demo`) com dados fictícios em memória, separado do banco real.
- **Leitura confortável**: contraste reforçado, texto ampliável (botão **T** no menu) e layout que aproveita telas baixas, sem precisar de tela cheia.
- **Prevenção de conflitos** em três camadas: verificação ao vivo no formulário, validação no servidor e gatilho no banco de dados, com gravações de aulas serializadas para que dois usuários salvando ao mesmo tempo não criem sobreposição. Detecta professor em duas turmas ao mesmo tempo, turma com aulas simultâneas, sobreposição parcial (08h–09h30 × 09h–10h), término antes do início, professor/turma inativos e dia não habilitado.
- **Importação de planilhas** (Excel `.xlsx` ou CSV) em todas as telas de trabalho, exceto o Dashboard. Veja [Importação de planilhas](#importação-de-planilhas).
- **Configurações**: dias letivos, turnos, duração padrão e horários de cada turno (aulas e intervalos, com gerador automático). Mudanças **nunca alteram nem apagam aulas**: antes de salvar, o sistema mostra quais aulas ficariam fora da grade e pede confirmação.
- **Impressão e PDF** por professor, por turma, de todas as turmas ou de todos os professores, em A4 paisagem, com identificação do colégio. Use "Imprimir ou salvar PDF" e escolha *Salvar como PDF*.

---

## Arquitetura

```
 Navegador ──HTTPS──▶ Vercel
                        ├── Site estático (React, gerado pelo Vite em dist/)
                        └── /api/*  →  função serverless api/index.ts (gru1, São Paulo)
                                         │   mesma aplicação Express do servidor local
                                         ▼
                              Supabase — pooler em modo transação (porta 6543)
                                         ▼
                              PostgreSQL · schema "seice" · usuário "seice_app"
```

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS 4, React Router 7, TanStack Query, React Hook Form + Zod, Lucide, ExcelJS (carregado só ao abrir uma importação).
- **API**: Express 5. Roda igual no computador (`server/index.ts`) e na Vercel (`api/index.ts`).
- **Regras compartilhadas** (`shared/`): tipos, validações, detecção de conflitos, cálculo da grade e interpretação de planilhas — as mesmas regras na interface e no servidor.
- **Banco**: PostgreSQL do Supabase via `pg`. A função serverless e o banco ficam na mesma região (São Paulo), e o pooler do Supabase multiplexa as instâncias da Vercel em poucas conexões reais.

---

## Acesso e segurança

- **Login obrigatório**: todas as telas, inclusive a de impressão, e toda a API (exceto `/api/health` e o próprio login) exigem sessão.
- **Senhas** são guardadas apenas como hash **scrypt** com sal aleatório; nenhuma senha fica em arquivo ou no repositório.
- **Sessão** em cookie `HttpOnly`, `Secure` (em HTTPS) e `SameSite=Lax`, assinado com HMAC-SHA256, válido por 12 horas — ou 30 dias com **Manter conectado**, renovado enquanto o sistema é usado. O segredo de assinatura é gerado automaticamente e guardado no banco (ou definido pela variável `SESSION_SECRET`).
- **Bloqueio de força bruta**: após 5 senhas erradas, o usuário fica bloqueado por 15 minutos. A mensagem de erro é a mesma para e-mail inexistente e senha errada.
- **Trocar a senha encerra as sessões abertas** daquele usuário.
- **Proteção contra outros sites**: alterações vindas de outra origem são recusadas.
- Cabeçalhos de segurança (`HSTS`, `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`) e respostas da API sem cache.

### Usuários

O usuário administrador da coordenação é **seiceadmin@seice.com**. Para criar outro usuário ou redefinir uma senha (o que também encerra as sessões abertas):

```cmd
set SEICE_PASSWORD=NovaSenhaForte123
npm run user:create -- seiceadmin@seice.com "Administração SEICE"
set SEICE_PASSWORD=
```

Sem `SEICE_PASSWORD`, uma senha forte é gerada e exibida uma única vez.

---

## Importação de planilhas

Disponível em:

| Tela | O que importa |
| --- | --- |
| Professores | Professores |
| Turmas | Turmas |
| Disciplinas | Disciplinas |
| Quadro de horários | Aulas de qualquer turma e professor |
| Horários por professor / por turma | Aulas daquele professor ou turma (a coluna correspondente é dispensada) |
| Detalhes do professor / da turma | Aulas daquele professor ou turma |
| Atribuição de aulas | Atribuições (professor, turmas, disciplina, aulas por semana; várias turmas na mesma linha) |
| Configurações | Horários dos turnos (períodos) |

### Como funciona

1. **Arquivo** — arraste ou escolha um `.xlsx` ou `.csv` (até 15 MB e 3.000 linhas por vez). Cada tela oferece **modelos prontos** em Excel (com exemplos, listas de opções e uma aba de instruções) e em CSV.
2. **Colunas** — os cabeçalhos são reconhecidos automaticamente, em qualquer ordem e com ou sem acentos (ex.: "Professor(a)", "Matrícula", "Dia da semana"). Dá para ajustar a associação, escolher a aba e a linha do cabeçalho, e ver a prévia das primeiras linhas.
3. **Revisão** — o servidor valida **cada linha** com as mesmas regras do cadastro manual, inclusive conflitos de horário, e mostra o que será **criado, atualizado, ignorado ou recusado**, com o motivo. Nada é gravado nesta etapa.
4. **Gravação** — só as linhas válidas são gravadas, numa única transação. As linhas com erro podem ser **baixadas em CSV** para correção e reimportação.

Reimportar a mesma planilha **não duplica nada**: registros iguais são ignorados e, nos cadastros, os existentes podem ser atualizados ou mantidos (células em branco mantêm o valor atual).

### Colunas aceitas

**Professores** — `Nome`\*, `Matrícula`, `Área de atuação`, `Telefone`, `Observações`, `Situação` (Ativo/Inativo). Professores existentes são reconhecidos pela matrícula ou, sem ela, pelo nome.

**Turmas** — `Turma`\*, `Ano/Série`\*, `Turno`\* (Manhã, Tarde, Noite, Integral; aceita também matutino, vespertino, noturno), `Observações`, `Situação`.

**Disciplinas** — `Disciplina`\*, `Cor` (Amarelo, Laranja, Verde, Azul-arroxeado, Rosa, Azul, Verde-água, Violeta, Cinza, Verde-limão; em branco, o sistema escolhe a cor menos usada).

**Horários dos turnos** — `Turno`\*, `Período`\*, `Início`\*, `Término`\*, `Tipo` (Aula/Intervalo; em branco, deduz pelo nome — "Intervalo", "Recreio", "Almoço"). Cada turno presente na planilha tem seus horários **substituídos**; os demais ficam como estão. Aulas já lançadas nunca são alteradas.

**Atribuições** — `Professor`\* (nome ou matrícula), `Turmas`\* (uma ou várias, separadas por vírgula: "6º A, 7º A"), `Disciplina`\*, `Aulas por semana`\* (1 a 40). Cada turma tem um professor por disciplina: importar de novo a mesma turma e disciplina troca o professor ou a quantidade.

**Aulas** — `Turma`\*, `Professor`\* (nome ou matrícula), `Disciplina`, `Dia`\*, e o horário por **uma** destas formas:
- `Horário` com o período da grade: "1º horário", "2ª aula", "Aula 3", "4";
- `Horário` com uma faixa: "07:00 às 07:50", "7h–7h50", "07:00-07:50";
- `Início` e `Término` em colunas separadas.

Dias aceitos: "Segunda", "Segunda-feira", "Seg", "2ª", "Terça", … "Sábado". Horários aceitos: "7:00", "07:00", "7h", "7h30", "07:00:00" e horas digitadas no Excel.

Opções da importação de aulas:
- **Criar disciplinas que ainda não existem** (com cor automática);
- **Substituir as aulas atuais** das turmas presentes na planilha (ou do professor/turma da página) — útil para recarregar um quadro inteiro. A revisão informa quantas aulas serão removidas antes de confirmar.

### Desempenho

As gravações seguem um caminho rápido (uma ida ao banco por linha); se o banco recusar algo inesperado, a importação é refeita automaticamente linha a linha, isolando só a linha recusada. Em produção, a revisão de 3.000 linhas leva cerca de 15 segundos.

---

## Banco de dados

- **Supabase**, projeto *Provas Seice App* (conta joaodorast), região São Paulo.
- O SEICE usa **exclusivamente o schema `seice`**: tabelas `teachers`, `teacher_photos`, `teacher_subjects`, `teacher_availability`, `classes`, `subjects`, `periods`, `settings`, `lessons`, `assignments`, `users`, `app_config` e `schema_migrations`. Consulte-as no painel do Supabase em *Table Editor*, escolhendo o schema `seice`.
- **Convivência com outro sistema no mesmo projeto**: o SEICE não cria nem altera nada fora do schema `seice`, não tem chaves estrangeiras para outros schemas e acessa o banco com um usuário próprio (`seice_app`) que **não tem permissão sobre as tabelas de outros sistemas**, limitado a **5 conexões** e a consultas de no máximo 30 segundos. O schema `seice` não é exposto pela API pública do Supabase.
- **Migrações** versionadas em `server/migrations.ts`, registradas em `seice.schema_migrations`. Nunca altere uma migração publicada; crie uma nova versão e rode `npm run db:migrate`.
- **Backups**: feitos diariamente pelo Supabase, conforme o plano do projeto.

### Configurar o banco do zero

```cmd
copy .env.example .env
```

1. Gere um token em <https://supabase.com/dashboard/account/tokens> e preencha `SUPABASE_ACCESS_TOKEN` no `.env`.
2. Em `SUPABASE_PROJECT_REF`, informe o projeto (Project Settings → General → Reference ID) ou deixe em branco para criar um projeto novo chamado `seice-horarios`.
3. Rode:

```cmd
npm install
npm run db:setup
npm run user:create -- seu-email@seice.com "Seu Nome"
```

O `db:setup` cria o schema e o usuário `seice_app` com senha aleatória, grava a `DATABASE_URL` no `.env`, aplica as migrações e confere o isolamento. Pode ser executado de novo com segurança (gera uma senha nova para o `seice_app`; atualize a `DATABASE_URL` na Vercel em seguida).

### Variáveis de ambiente

| Variável | Onde | Para quê |
| --- | --- | --- |
| `DATABASE_URL` | `.env` e Vercel | Conexão do usuário `seice_app` pelo pooler do Supabase (porta 6543). **Única variável obrigatória na Vercel.** |
| `SUPABASE_ACCESS_TOKEN` | só `.env` | Usado por `db:setup` para administrar o projeto. Pode ser revogado depois. |
| `SUPABASE_PROJECT_REF` | só `.env` | Projeto onde o SEICE está instalado. |
| `SESSION_SECRET` | opcional | Segredo de assinatura das sessões; sem ela, é gerado e guardado no banco. |
| `PORT` | opcional | Porta do servidor local (padrão 3333). |

O `.env` contém senhas e **nunca** vai para o Git nem para a Vercel (`.gitignore` e `.vercelignore`).

---

## Rodando no computador

Requisitos: **Node.js 22.13 ou superior** (<https://nodejs.org>, versão LTS), internet e o `.env` configurado.

```cmd
npm install
npm run dev
```

Acesse **http://localhost:5173** e entre com seu e-mail e senha. O computador usa o **mesmo banco na nuvem** que a produção.

**Ambiente de teste** (não usa o banco real nem precisa do `.env`):

```cmd
npm run demo
```

Acesse **http://localhost:5180** com `teste@seice.com` / `teste1234`. Os dados são fictícios, ficam em memória e voltam ao original a cada início.

Versão otimizada em um único processo (interface + API) em **http://localhost:3333**:

```cmd
npm run build
npm start
```

---

## Publicação na Vercel

O projeto `seice-horarios` (conta joaodorast) está ligado ao repositório do GitHub: **cada `git push` na branch `main` publica automaticamente** em <https://seice-horarios.vercel.app>.

Configuração (já feita, em `vercel.json`):
- build `npm run build`, saída `dist/`;
- função `api/index.ts` na região `gru1` (São Paulo, ao lado do banco), com até 300 s por requisição;
- `/api/*` vai para a função; as demais rotas caem no `index.html` (navegação do React);
- cabeçalhos de segurança e cache longo para `/assets/*`.

Variável na Vercel: apenas `DATABASE_URL` (Production e Preview), cadastrada como *Sensitive*.

Publicar manualmente pelo terminal:

```cmd
npx vercel deploy --prod
```

**Ao publicar uma versão com migração nova**, rode `npm run db:migrate` antes (a função serverless não aplica migrações, para iniciar mais rápido).

---

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Interface (5173) e API (3333) com recarga automática |
| `npm run demo` | Ambiente de teste com dados fictícios em http://localhost:5180 |
| `npm run build` | Verifica os tipos e gera a versão otimizada em `dist\` |
| `npm start` | Executa a versão otimizada em http://localhost:3333 |
| `npm run db:setup` | Prepara o banco no Supabase e grava a conexão no `.env` |
| `npm run db:migrate` | Aplica as migrações pendentes e lista as aplicadas |
| `npm run user:create -- <email> "<Nome>"` | Cria usuário ou redefine a senha |
| `npm test` | Roda os testes automatizados |
| `npm run typecheck` | Verifica os tipos TypeScript |

---

## Testes

```cmd
npm test
```

119 testes rodam num **PostgreSQL em memória** (PGlite), com o mesmo esquema e migrações da nuvem — nunca tocam no banco real:

- `conflicts.test.ts` — regras de conflito e cálculo da grade;
- `api.test.ts` — fluxos da API, gatilho anti-sobreposição e formato dos horários no banco;
- `auth.test.ts` — hash de senha, sessão obrigatória, cookie adulterado, bloqueio por tentativas, troca de senha e proteção de origem;
- `import.test.ts` — interpretação de valores, prévia sem gravação, atualização, conflitos, disciplinas automáticas, substituição de aulas, recuperação de recusas do banco;
- `spreadsheet.test.ts` — leitura de Excel e CSV (Windows-1252, aspas, quebras de linha) e reimportação de todos os modelos;
- `lesson-batch.test.ts` — substituição, troca de horários e repasse de aulas numa única gravação;
- `teacher-subjects.test.ts`, `suggest.test.ts` e `photos.test.ts` — disciplinas e fotos dos professores e sugestão de disciplina;
- `builder.test.ts` — Montar quadro: células, aulas duplas e planejamento do salvamento;
- `assignments.test.ts` e `assignment-progress.test.ts` — atribuição de aulas (API, importação, progresso no quadro);
- `workload.test.ts` — carga horária por professor, turma e disciplina;
- `availability.test.ts` — dias e horários do professor na escola (bloqueio no lançamento e no lote);
- `session-cookie.test.ts` — cookie de sessão separado para o ambiente de teste.

---

## Estrutura do projeto

```
api/           função serverless da Vercel (usa a mesma aplicação Express)
server/        API Express, autenticação, conexão com o Supabase, migrações,
               repositório SQL e motor de importação
shared/        regras compartilhadas entre interface e servidor
               (tipos, validações Zod, conflitos, grade e importação de planilhas)
scripts/       configuração do banco, migrações, criação de usuários e ambiente de teste
src/
  api/         cliente HTTP, sessão e hooks de dados
  components/  ui/ (design system), layout/, schedule/ (grades e editor de aulas)
  features/    login, formulários, assistente de importação e configurações
  lib/         utilitários, leitura de planilhas e geração de modelos
  pages/       telas do sistema
  styles/      tokens visuais (cores da marca, tipografia, animações)
tests/         testes automatizados e utilitário de servidor de teste
docs/          guias para quem usa o sistema (começar do zero, guia das telas)
vercel.json    configuração de build, função, rotas e cabeçalhos da Vercel
```

---

## Solução de problemas

| Sintoma | Causa provável e solução |
| --- | --- |
| "Não foi possível acessar o banco de dados na nuvem" | Sem internet ou projeto do Supabase pausado. Verifique a conexão e o status do projeto no painel do Supabase. |
| Servidor local não inicia: "DATABASE_URL não configurada" | Falta o `.env`. Copie de `.env.example` e rode `npm run db:setup`. |
| "Acesso bloqueado por excesso de tentativas" | Aguarde 15 minutos ou redefina a senha com `npm run user:create`. |
| "Sua sessão expirou" | A sessão dura 12 horas; entre novamente. |
| Planilha `.xls` recusada | Formato antigo do Excel. Use *Salvar como* → `.xlsx` ou CSV. |
| Colunas não reconhecidas na importação | Associe manualmente na etapa *Colunas* ou baixe o modelo da tela. |
| Erro 500 na Vercel após publicar | Veja os logs com `npx vercel logs --deployment <url>`; confirme a `DATABASE_URL` em *Settings → Environment Variables* e rode `npm run db:migrate` se houver migração nova. |

---

A logo usada é a fornecida pela escola (`public\logo-seice.png`); o emblema e o ícone do navegador foram recortados dela.
