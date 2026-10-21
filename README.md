# SEICE — Gestão de Professores, Turmas e Quadros de Horários

Sistema administrativo do **Colégio SEICE — Sistema de Ensino Integrado de Campos Elíseos** para cadastrar professores e turmas, montar o quadro de horários com prevenção de conflitos e imprimir/exportar as grades em PDF.

## Requisitos

- **Node.js 22.13 ou superior** (o banco de dados usa o SQLite embutido no próprio Node; não é preciso instalar nenhum banco à parte). Baixe em <https://nodejs.org> a versão LTS.

## Como executar (Windows — Prompt de Comando)

Abra o Prompt de Comando (cmd) na pasta do projeto e rode:

```cmd
npm install
npm run dev
```

Acesse **http://localhost:5173** no navegador. Para encerrar, pressione `Ctrl + C` no Prompt de Comando.

### Uso no dia a dia (versão otimizada)

```cmd
npm run build
npm start
```

Acesse **http://localhost:3333**. Nesse modo, um único processo serve a interface e a API. Para que outros computadores da rede acessem, use o endereço IP da máquina (ex.: `http://192.168.0.10:3333`) e libere a porta 3333 no Firewall do Windows.

Para usar outra porta ou outro arquivo de banco:

```cmd
set PORT=8080
set SEICE_DB=D:\SEICE\dados\seice.db
npm start
```

## Onde ficam os dados

Tudo é gravado em `data\seice.db` (SQLite). **Para fazer backup, copie esse arquivo** (com o sistema fechado, ou copie também `seice.db-wal` e `seice.db-shm`). Na primeira execução o banco é criado com dias letivos de segunda a sexta e uma grade inicial de períodos para manhã, tarde e noite — são apenas valores de partida, editáveis em **Configurações**. Nenhum professor, turma ou aula fictícia é criado.

## Funcionalidades

- **Dashboard** com indicadores calculados dos dados reais (professores, turmas, aulas, horários vagos, conflitos), distribuição semanal, pendências priorizadas, "agora na escola" e guia de primeiros passos.
- **Professores**: cadastro, edição, pesquisa (ignora acentos), filtros por situação e área, inativação e exclusão protegida (se houver aulas, o sistema explica as consequências e oferece inativar). Página de detalhes com dados, turmas e quadro semanal.
- **Turmas**: cadastro com turno (manhã, tarde, noite ou integral), bloqueio de nomes duplicados, preenchimento da grade, professores e disciplinas da turma.
- **Quadro de horários**:
  - *Visão geral*: turmas × períodos por dia e turno, filtros por professor, turma e disciplina (guardados na URL), limpar filtros com um clique.
  - *Por professor* e *por turma*: grade semanal com navegação anterior/próximo e seleção pesquisável.
  - Clique em um horário vazio abre o formulário já com turma/professor, dia e período preenchidos. Mostra, em cada período, se a turma ou o professor estão ocupados.
  - Detalhes da aula com editar, **duplicar** (os conflitos são verificados de novo) e excluir com confirmação.
  - "Salvar e adicionar outra" mantém turma, professor e disciplina para lançamentos em sequência.
  - Em celulares, a grade vira uma visão por dia.
  - Atalho **N** abre uma nova aula/cadastro nas telas de lista e no quadro.
- **Prevenção de conflitos** em três camadas: verificação ao vivo no formulário, validação no servidor e gatilhos no banco de dados. Detecta professor em duas turmas ao mesmo tempo, turma com aulas simultâneas, sobreposição parcial (08h–09h30 × 09h–10h), término antes do início, professor/turma inativos e dia não habilitado.
- **Configurações**: dias letivos, turnos, duração padrão, horários de cada turno (aulas e intervalos, com gerador automático) e disciplinas com cores. Mudanças **nunca alteram nem apagam aulas**: antes de salvar, o sistema mostra quais aulas ficariam fora da grade e pede confirmação; essas aulas aparecem na lista "Fora da grade".
- **Impressão e PDF** por professor, por turma, de todas as turmas ou de todos os professores, em A4 paisagem, com identificação do colégio. Use "Imprimir ou salvar PDF" e escolha *Salvar como PDF* no destino.

## Tecnologias

React 19 · TypeScript · Vite · Tailwind CSS 4 · React Router 7 · TanStack Query · React Hook Form + Zod · Lucide React · Express 5 · SQLite (`node:sqlite`) · Vitest.

## Estrutura

```
shared/      regras compartilhadas entre interface e servidor
             (tipos, validações Zod, cálculo de conflitos e da grade)
server/      API Express, banco SQLite, migração e gatilhos anti-sobreposição
src/
  api/         cliente HTTP e hooks de dados
  components/  ui/ (design system), layout/, schedule/ (grades e editor de aulas)
  features/    formulários e fluxos (professor, turma, configurações)
  pages/       telas do sistema
  styles/      tokens visuais (cores da marca, tipografia, animações)
tests/       testes das regras de conflito e da API
```

## Comandos úteis

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Interface (5173) e API (3333) com recarga automática |
| `npm run build` | Verifica os tipos e gera a versão otimizada em `dist\` |
| `npm start` | Executa a versão otimizada em http://localhost:3333 |
| `npm test` | Roda os testes automatizados |
| `npm run typecheck` | Verifica os tipos TypeScript |

## Observações

- O sistema não possui login: destina-se ao uso interno da coordenação em computador ou rede da escola. Se for publicado na internet, será necessário adicionar autenticação.
- A logo usada é a fornecida pela escola (`public\logo-seice.png`); o emblema e o ícone do navegador foram recortados dela.
