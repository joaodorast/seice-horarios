# Começar do zero

Este guia tem duas partes:

- **Parte A — Usar o sistema** (coordenação): do primeiro acesso até o quadro impresso.
- **Parte B — Instalar o sistema** (técnico): de um computador vazio até o site no ar.

Para entender como as telas se ligam, veja também o [Guia das telas](GUIA-DAS-TELAS.md).

---

## Parte A — Usar o sistema

### Antes de começar: treine no ambiente de teste

Existe um **ambiente de teste** com dados fictícios, separado do sistema real. Tudo o que você fizer nele é descartado ao fechar — pode errar à vontade.

- Peça para quem cuida do sistema rodar `npm run demo` (ver Parte B, passo 4) e acesse **http://localhost:5180**.
- Login de teste: **teste@seice.com** / **teste1234**.
- Uma faixa amarela no topo lembra que você está no ambiente de teste.

### Passo 1 — Entrar

Acesse **https://seice-horarios.vercel.app** e entre com o seu e-mail e senha. Marque **Manter conectado** se o computador for só seu (a sessão dura 30 dias; sem marcar, 12 horas).

### Passo 2 — Configurar os horários da escola

**Configurações** (menu, embaixo):

1. Marque os **dias letivos** e os **turnos** em uso.
2. Na segunda aba, ajuste os horários de cada turno (1º horário, 2º horário, intervalo…). O **gerador automático** monta tudo a partir do horário de início, da duração da aula e do intervalo.
3. **Salvar**.

### Passo 3 — Cadastrar disciplinas, professores e turmas

Faça nesta ordem (as disciplinas primeiro, porque os professores as usam):

| Tela | O que fazer | Dica |
| --- | --- | --- |
| **Disciplinas** | Cadastre cada disciplina e escolha a cor | A cor pinta as aulas nas grades |
| **Professores** | Cadastre e marque **as disciplinas que cada um leciona** | Pode pôr foto; um professor pode ter várias disciplinas |
| **Turmas** | Cadastre com o **turno** certo | Turma integral usa manhã e tarde |

**Tem tudo numa planilha?** Em cada uma dessas telas, clique em **Importar**, baixe o **modelo** em Excel, preencha e envie. O sistema mostra o que vai criar antes de gravar.

### Passo 4 — Atribuir as aulas

**Atribuição de aulas** → **Por professor**:

1. Escolha o professor na lista.
2. **Atribuir turmas** → escolha a disciplina → marque **todas as turmas** dele → ajuste as **aulas por semana** → **Salvar atribuição**.
3. Repita para cada professor.

Prefere pensar por turma? Use **Por turma** e escolha o professor de cada disciplina. Tudo é salvo automaticamente.

### Passo 5 — Montar o quadro

**Montar quadro** → **Por turma**:

1. Escolha a turma.
2. Em cada horário, escolha a **disciplina** — o professor atribuído já vem preenchido.
3. Acompanhe a faixa **Atribuição desta turma**: cada etiqueta fica **verde** quando todas as aulas daquela disciplina estão na grade.
4. Clique em **Salvar quadro** no rodapé.

Também dá para montar **Por professor**: em cada horário vago aparecem as turmas **livres em verde** — um clique e a aula entra.

### Passo 6 — Conferir

- **Quadro geral → Semana inteira**: a escola toda em uma tela. Use os filtros de professor, turma ou disciplina.
- **Dashboard**: horários vagos e conflitos pendentes.
- **Carga horária**: aulas de cada professor por semana e por mês.

### Passo 7 — Imprimir e entregar

**Por professor** ou **Por turma** → **Imprimir ou PDF** → escolha *Salvar como PDF*. No **Quadro geral**, o botão **Imprimir** gera todas as turmas ou todos os professores de uma vez.

### Ficou alguma dúvida?

Clique em **Como usar** no canto de qualquer tela.

---

## Parte B — Instalar o sistema

### 1. Instalar os programas

1. **Node.js 22.13 ou mais novo** — <https://nodejs.org> (versão LTS). Confira no terminal: `node -v`.
2. **Git** — <https://git-scm.com>.
3. Um editor, por exemplo **VS Code** — <https://code.visualstudio.com>.

### 2. Baixar o projeto

```cmd
git clone https://github.com/joaodorast/seice-horarios.git
cd seice-horarios
npm install
```

### 3. Conferir que está tudo certo

```cmd
npm test
```

Os testes rodam num banco de dados em memória — não precisam de internet nem de Supabase.

### 4. Experimentar sem banco: ambiente de teste

```cmd
npm run demo
```

Acesse **http://localhost:5180** com **teste@seice.com** / **teste1234**. Os dados são fictícios e somem ao fechar o terminal (`Ctrl + C`).

### 5. Criar o banco de dados (Supabase)

1. Crie uma conta em <https://supabase.com> (o plano gratuito serve).
2. Gere um token em <https://supabase.com/dashboard/account/tokens>.
3. Copie o arquivo de exemplo e preencha o token:

   ```cmd
   copy .env.example .env
   ```

   - `SUPABASE_ACCESS_TOKEN` = o token gerado.
   - `SUPABASE_PROJECT_REF` = o projeto onde instalar (Project Settings → General → Reference ID), ou em branco para criar um projeto novo.

4. Prepare o banco e crie o seu usuário:

   ```cmd
   npm run db:setup
   npm run user:create -- seu-email@seice.com "Seu Nome"
   ```

   O `db:setup` cria o esquema `seice` e um usuário de banco próprio, grava a `DATABASE_URL` no `.env` e aplica as migrações. O SEICE **só mexe no esquema `seice`**, então pode dividir o projeto com outro sistema.

5. Depois disso, o token do Supabase pode ser **revogado** — o sistema não precisa dele para funcionar.

### 6. Rodar no computador com o banco real

```cmd
npm run dev
```

Acesse **http://localhost:5173**. Atenção: o computador usa o **mesmo banco** que o site no ar.

### 7. Publicar na internet (Vercel)

1. Crie uma conta em <https://vercel.com> e importe o repositório do GitHub.
2. Em *Settings → Environment Variables*, cadastre **`DATABASE_URL`** (copie do `.env`) como *Sensitive*.
3. Pronto: **cada `git push` na branch `main` publica sozinho**.

### 8. Quando houver mudança no banco

Se uma atualização trouxer **migração nova** (arquivo `server/migrations.ts`), rode antes de publicar:

```cmd
npm run db:migrate
```

### Problemas comuns

| Sintoma | Solução |
| --- | --- |
| `DATABASE_URL não configurada` | Falta o `.env`. Faça o passo 5. |
| Tela branca no `npm run dev` | Feche o terminal, rode `npm install` e `npm run dev` de novo. |
| "Acesso bloqueado por excesso de tentativas" | Espere 15 minutos ou redefina a senha com `npm run user:create`. |
| Site no ar com erro depois de publicar | Rode `npm run db:migrate` e confira a `DATABASE_URL` na Vercel. |

Mais detalhes técnicos no [README](../README.md).
