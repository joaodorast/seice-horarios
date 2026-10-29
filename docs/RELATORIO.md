# Relatório do sistema — SEICE Horários

**Atualizado em 29/10/2026** · Site: <https://seice-horarios.vercel.app>

Este relatório resume, em linguagem simples, **o que o sistema faz hoje**, **o que mudou nas últimas entregas**, **as regras que ele garante** e **o que ainda falta**. Para aprender a usar, veja o [Guia das telas](GUIA-DAS-TELAS.md) e o [Começar do zero](COMECAR-DO-ZERO.md).

---

## 1. Em uma frase

O SEICE organiza **quem dá aula, de quê, em qual turma, em que dia e horário** — e impede erros como professor em dois lugares ao mesmo tempo ou aula num dia em que o professor não está na escola.

---

## 2. O que o sistema faz hoje

| Tela | Para que serve |
| --- | --- |
| **Dashboard** | Resumo da escola: números, grade preenchida, conflitos e **pendências com atalho** para resolver |
| **Professores** | Cadastro, foto, **disciplinas que leciona** e **dias e horários na escola** |
| **Turmas** | Cadastro com o turno (manhã, tarde, noite ou integral) |
| **Disciplinas** | Cadastro com a cor que aparece nas grades |
| **Quadro geral** | A escola inteira por dia ou **semana inteira**, com filtros por professor, turma e disciplina |
| **Por professor / Por turma** | A semana de um professor ou turma, pronta para **imprimir ou salvar em PDF** |
| **Atribuição de aulas** | Quem dá cada disciplina em cada turma e **quantas aulas por semana** (várias turmas de uma vez) |
| **Montar quadro** | Preencher a semana direto na grade, com sugestões em verde |
| **Carga horária** | Aulas de cada professor **por semana e por mês**, comparadas com o que foi atribuído; exporta para Excel |
| **Configurações** | Dias letivos, turnos e horários das aulas |

Quase todas as telas têm **Importar planilha** (Excel ou CSV) e o botão **Como usar**.

---

## 3. O que mudou nas últimas entregas

### Atribuição de aulas *(nova tela)*
- Por professor: **"Atribuir turmas"** — escolha a disciplina e marque várias turmas de uma vez, com as aulas por semana.
- Por turma: o professor de cada disciplina e quantas aulas, com a situação no quadro (*faltam 2*, *completo*, *1 a mais*).
- Salva sozinho. Também importa de planilha (várias turmas na mesma linha: "6º A, 7º A").

### Montar quadro *(nova tela)*
- **Por turma:** em cada horário vazio aparecem **em verde as aulas atribuídas que faltam**, com o professor livre — um clique preenche tudo.
- **Por professor:** cada horário vago mostra as turmas do turno — **verdes (livres)** e **cinzas com cadeado (ocupadas, com quem)**.
- Faixa **"Atribuição desta turma"** com o progresso de cada disciplina (**2 de 3**, verde quando completa).
- Alterações destacadas e salvas de uma vez; aviso ao sair sem salvar.

### Dias e horários do professor na escola *(novo)*
- Na página do professor: por dia, **Não vem / Manhã / Tarde / Dia todo** ou horário exato.
- **Bloqueia** aulas fora desses horários em todo o sistema (detalhes na seção 4).

### Quadro geral, Carga horária e Dashboard
- **Semana inteira** em uma tela no Quadro geral.
- **Carga horária** com totais por semana e por mês (4, 4,5 ou 5 semanas), coluna **Atribuídas** e aviso "2 de 3" quando o quadro não bate.
- **Dashboard** avisa: aulas atribuídas que faltam no quadro e aulas fora do horário do professor.

### Mais fácil de ler e de entender
- Mais contraste e letras maiores; o sistema cabe na tela **sem precisar de F11**.
- Legenda **"Como ler a grade"** no Quadro geral, Por professor, Por turma e Montar quadro.
- Listas de escolha novas, com pesquisa e o motivo de cada opção bloqueada.

### Correções
- **"Manter conectado"** deixou de cair no computador quando o ambiente de teste está aberto ao mesmo tempo.
- **Tela branca no localhost** com o sistema e o ambiente de teste abertos juntos: corrigida.

### Documentação
- [Guia das telas](GUIA-DAS-TELAS.md), [Começar do zero](COMECAR-DO-ZERO.md) e este relatório.

**Entregas no GitHub:** pull requests [#2](https://github.com/joaodorast/seice-horarios/pull/2), [#3](https://github.com/joaodorast/seice-horarios/pull/3), [#4](https://github.com/joaodorast/seice-horarios/pull/4), [#5](https://github.com/joaodorast/seice-horarios/pull/5) e [#7](https://github.com/joaodorast/seice-horarios/pull/7).

---

## 4. Regras que o sistema garante

Valem em **todas as telas**, na importação de planilhas e também no servidor (ninguém consegue gravar por fora):

1. **Professor não fica em duas turmas ao mesmo tempo.**
2. **Turma não tem duas aulas ao mesmo tempo.**
3. **Professor só recebe aula quando está na escola** — depois que os dias e horários dele forem preenchidos. Ex.: se ele vem de segunda a quinta, não dá para pôr aula na sexta. A mensagem explica o motivo.
4. **Cada turma tem um professor por disciplina** na atribuição.
5. **Mudar horários ou dias nunca apaga aulas.** O que ficar fora é avisado antes de salvar e aparece como pendência no Dashboard.

---

## 5. Segurança e dados

- Acesso com e-mail e senha; senhas guardadas de forma protegida; bloqueio após 5 tentativas erradas.
- O banco fica no Supabase, numa área separada (**esquema `seice`**). O acesso do sistema **não consegue ler nem alterar** as tabelas do sistema de Provas que está no mesmo projeto — conferido antes e depois de cada mudança no banco.
- Mudanças no banco nesta fase: **atribuição de aulas** e **dias e horários dos professores** (só acrescentaram tabelas; nada foi apagado).
- O token de administração do Supabase foi revogado — o sistema não precisa dele para funcionar.

---

## 6. Qualidade

- **119 testes automáticos** em 15 arquivos, rodando num banco de teste em memória (nunca no banco real).
- Cada mudança foi testada no **ambiente de teste** (`npm run demo`, <http://localhost:5180>) antes de ir para o site.
- Cada versão publicada foi conferida no site depois de entrar no ar.

---

## 7. O que você precisa fazer

1. **Preencher os dias e horários de cada professor** (Professores → abrir o professor → *Dias e horários na escola*). Enquanto não preencher, o professor pode receber aula em qualquer horário.
2. **Conferir as atribuições** (Atribuição de aulas → Por turma). Elas foram criadas automaticamente a partir do quadro que já existia — confira professor e quantidade de aulas.
3. Ver o **Dashboard** e resolver as pendências que aparecerem.

---

## 8. Antes de vender o sistema

| Item | Por quê |
| --- | --- |
| **Vercel no plano Pro** (~US$ 20/mês) | O plano gratuito não permite uso comercial |
| **Banco Supabase próprio** para o cliente (plano pago, ~US$ 25/mês) | Backups melhores, banco não "dorme" e fica separado do sistema de Provas |
| **Repositório privado** no GitHub | Hoje o código está público |
| **Contrato** | O que a mensalidade cobre, prazo de suporte, dono do código e LGPD |

---

## 9. Próximos passos sugeridos

- Coluna **"Dias na escola"** na planilha de importação de professores (preencher todos de uma vez).
- Testar as telas novas no **celular**.
- Fazer o sistema local (`npm run dev`) aceitar acesso **só do próprio computador**, e não de outros aparelhos do mesmo Wi-Fi.
- Repetir o **teste completo de ponta a ponta no site** depois de cada entrega grande.
