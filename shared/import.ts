import { SHIFT_LABEL, WEEKDAY_LABEL } from './labels.js';
import { CLASS_SHIFTS, SUBJECT_COLORS, type ClassShift, type PeriodKind, type ShiftKey, type SubjectColor, type Weekday } from './types.js';

/**
 * Importação de planilhas (Excel ou CSV). A interface lê o arquivo e associa as colunas aos campos;
 * o servidor interpreta e valida cada linha com as mesmas regras do cadastro manual.
 */

export const IMPORT_KINDS = ['teachers', 'classes', 'subjects', 'periods', 'lessons'] as const;
export type ImportKind = (typeof IMPORT_KINDS)[number];

export const MAX_IMPORT_ROWS = 3000;

export interface ImportColumn {
  key: string;
  label: string;
  required?: boolean;
  /** Cabeçalhos aceitos (comparados sem acentos, maiúsculas, espaços ou pontuação). */
  aliases: string[];
  hint: string;
  /** Valores aceitos, usados como lista suspensa na planilha modelo. */
  options?: string[];
}

export interface ImportSpec {
  kind: ImportKind;
  title: string;
  /** Substantivo no plural, minúsculo: "professores". */
  noun: string;
  fileName: string;
  columns: ImportColumn[];
  examples: Record<string, string>[];
  notes: string[];
}

const WEEKDAY_OPTIONS = Object.values(WEEKDAY_LABEL);
const SHIFT_OPTIONS = ['Manhã', 'Tarde', 'Noite'];
const CLASS_SHIFT_OPTIONS = CLASS_SHIFTS.map((s) => SHIFT_LABEL[s]);
const YES_NO = ['Ativo', 'Inativo'];

/** Nomes das cores em português, na mesma ordem de SUBJECT_COLORS. */
export const COLOR_NAMES: Record<SubjectColor, string> = {
  amber: 'Amarelo',
  orange: 'Laranja',
  green: 'Verde',
  indigo: 'Azul-arroxeado',
  rose: 'Rosa',
  sky: 'Azul',
  teal: 'Verde-água',
  violet: 'Violeta',
  slate: 'Cinza',
  lime: 'Verde-limão',
};

export const IMPORT_SPECS: Record<ImportKind, ImportSpec> = {
  teachers: {
    kind: 'teachers',
    title: 'Importar professores',
    noun: 'professores',
    fileName: 'modelo-professores',
    columns: [
      { key: 'name', label: 'Nome', required: true, aliases: ['nome', 'nome completo', 'professor', 'professora', 'docente', 'nome do professor'], hint: 'Nome completo (mínimo 3 letras).' },
      { key: 'code', label: 'Matrícula', aliases: ['matricula', 'codigo', 'cod', 'registro', 'id', 'mat'], hint: 'Identifica o professor nas próximas importações.' },
      { key: 'area', label: 'Área de atuação', aliases: ['area', 'area de atuacao', 'disciplina', 'especialidade', 'formacao', 'materia'], hint: 'Ex.: Matemática.' },
      { key: 'phone', label: 'Telefone', aliases: ['telefone', 'celular', 'fone', 'whatsapp', 'contato', 'tel'], hint: 'Com DDD. Ex.: (21) 99999-0000.' },
      { key: 'notes', label: 'Observações', aliases: ['observacoes', 'observacao', 'obs', 'notas', 'comentarios'], hint: 'Texto livre.' },
      { key: 'active', label: 'Situação', aliases: ['situacao', 'status', 'ativo', 'ativa'], hint: 'Ativo ou Inativo. Em branco: Ativo.', options: YES_NO },
    ],
    examples: [
      { name: 'Ana Paula Souza', code: 'P-001', area: 'Matemática', phone: '(21) 99999-0001', notes: '', active: 'Ativo' },
      { name: 'Bruno Lima', code: 'P-002', area: 'Língua Portuguesa', phone: '', notes: 'Disponível só pela manhã', active: 'Ativo' },
    ],
    notes: [
      'Professores já cadastrados são reconhecidos pela matrícula ou, sem ela, pelo nome.',
      'Ao atualizar, células em branco mantêm o valor atual do cadastro.',
    ],
  },
  classes: {
    kind: 'classes',
    title: 'Importar turmas',
    noun: 'turmas',
    fileName: 'modelo-turmas',
    columns: [
      { key: 'name', label: 'Turma', required: true, aliases: ['turma', 'nome', 'identificacao', 'nome da turma', 'classe', 'sala'], hint: 'Identificação única. Ex.: 6º A.' },
      { key: 'grade', label: 'Ano/Série', required: true, aliases: ['ano', 'serie', 'ano serie', 'ano/serie', 'etapa', 'nivel', 'segmento', 'ano escolar'], hint: 'Ex.: 6º ano.' },
      { key: 'shift', label: 'Turno', required: true, aliases: ['turno', 'periodo'], hint: 'Manhã, Tarde, Noite ou Integral.', options: CLASS_SHIFT_OPTIONS },
      { key: 'notes', label: 'Observações', aliases: ['observacoes', 'observacao', 'obs', 'notas'], hint: 'Texto livre.' },
      { key: 'active', label: 'Situação', aliases: ['situacao', 'status', 'ativa', 'ativo'], hint: 'Ativa ou Inativa. Em branco: Ativa.', options: ['Ativa', 'Inativa'] },
    ],
    examples: [
      { name: '6º A', grade: '6º ano', shift: 'Manhã', notes: '', active: 'Ativa' },
      { name: '9º B', grade: '9º ano', shift: 'Tarde', notes: 'Sala 12', active: 'Ativa' },
    ],
    notes: ['Turmas já cadastradas são reconhecidas pelo nome.', 'Ao atualizar, células em branco mantêm o valor atual do cadastro.'],
  },
  subjects: {
    kind: 'subjects',
    title: 'Importar disciplinas',
    noun: 'disciplinas',
    fileName: 'modelo-disciplinas',
    columns: [
      { key: 'name', label: 'Disciplina', required: true, aliases: ['disciplina', 'nome', 'materia', 'componente', 'componente curricular'], hint: 'Ex.: Língua Portuguesa.' },
      { key: 'color', label: 'Cor', aliases: ['cor', 'cor na grade'], hint: 'Em branco: o sistema escolhe uma cor.', options: Object.values(COLOR_NAMES) },
    ],
    examples: [
      { name: 'Matemática', color: 'Azul' },
      { name: 'Língua Portuguesa', color: 'Rosa' },
      { name: 'Ciências', color: '' },
    ],
    notes: ['Disciplinas já cadastradas são reconhecidas pelo nome.'],
  },
  periods: {
    kind: 'periods',
    title: 'Importar horários dos turnos',
    noun: 'períodos',
    fileName: 'modelo-horarios-dos-turnos',
    columns: [
      { key: 'shift', label: 'Turno', required: true, aliases: ['turno'], hint: 'Manhã, Tarde ou Noite.', options: SHIFT_OPTIONS },
      { key: 'label', label: 'Período', required: true, aliases: ['periodo', 'nome', 'horario', 'aula', 'tempo', 'descricao'], hint: 'Ex.: 1º horário, Intervalo.' },
      { key: 'start', label: 'Início', required: true, aliases: ['inicio', 'hora inicio', 'hora de inicio', 'de', 'entrada', 'comeca'], hint: 'HH:MM. Ex.: 07:00.' },
      { key: 'end', label: 'Término', required: true, aliases: ['termino', 'fim', 'hora fim', 'hora de termino', 'ate', 'saida', 'final'], hint: 'HH:MM. Ex.: 07:50.' },
      { key: 'kind', label: 'Tipo', aliases: ['tipo'], hint: 'Aula ou Intervalo. Em branco: Aula (ou Intervalo se o nome indicar).', options: ['Aula', 'Intervalo'] },
    ],
    examples: [
      { shift: 'Manhã', label: '1º horário', start: '07:00', end: '07:50', kind: 'Aula' },
      { shift: 'Manhã', label: '2º horário', start: '07:50', end: '08:40', kind: 'Aula' },
      { shift: 'Manhã', label: 'Intervalo', start: '08:40', end: '09:00', kind: 'Intervalo' },
      { shift: 'Manhã', label: '3º horário', start: '09:00', end: '09:50', kind: 'Aula' },
    ],
    notes: [
      'Cada turno presente na planilha tem seus horários substituídos pelos da planilha; os demais turnos ficam como estão.',
      'As aulas já lançadas nunca são alteradas: as que deixarem de coincidir com a grade aparecem em "Fora da grade".',
    ],
  },
  lessons: {
    kind: 'lessons',
    title: 'Importar aulas',
    noun: 'aulas',
    fileName: 'modelo-aulas',
    columns: [
      { key: 'class', label: 'Turma', required: true, aliases: ['turma', 'classe', 'sala', 'nome da turma'], hint: 'Nome da turma já cadastrada.' },
      { key: 'teacher', label: 'Professor', required: true, aliases: ['professor', 'professora', 'docente', 'matricula', 'nome do professor'], hint: 'Nome ou matrícula do professor cadastrado.' },
      { key: 'subject', label: 'Disciplina', aliases: ['disciplina', 'materia', 'componente', 'componente curricular'], hint: 'Opcional. Pode ser criada automaticamente.' },
      { key: 'weekday', label: 'Dia', required: true, aliases: ['dia', 'dia da semana', 'dias', 'semana'], hint: 'Ex.: Segunda, Terça-feira, Qua, 2ª.', options: WEEKDAY_OPTIONS },
      { key: 'slot', label: 'Horário', aliases: ['horario', 'periodo', 'aula', 'tempo', 'faixa'], hint: 'Período da grade (ex.: 1º horário) ou faixa (07:00–07:50). Dispensa Início e Término.' },
      { key: 'start', label: 'Início', aliases: ['inicio', 'hora inicio', 'hora de inicio', 'de', 'entrada'], hint: 'HH:MM. Use com Término.' },
      { key: 'end', label: 'Término', aliases: ['termino', 'fim', 'hora fim', 'hora de termino', 'ate', 'saida'], hint: 'HH:MM. Use com Início.' },
      { key: 'notes', label: 'Observações', aliases: ['observacoes', 'observacao', 'obs', 'notas'], hint: 'Ex.: Sala 3.' },
    ],
    examples: [
      { class: '6º A', teacher: 'Ana Paula Souza', subject: 'Matemática', weekday: 'Segunda-feira', slot: '1º horário', start: '', end: '', notes: '' },
      { class: '6º A', teacher: 'P-002', subject: 'Língua Portuguesa', weekday: 'Segunda-feira', slot: '', start: '07:50', end: '08:40', notes: 'Sala 3' },
      { class: '6º A', teacher: 'Ana Paula Souza', subject: 'Matemática', weekday: 'Terça-feira', slot: '07:00 às 07:50', start: '', end: '', notes: '' },
    ],
    notes: [
      'Informe o horário pela coluna Horário (período da grade ou faixa) ou pelas colunas Início e Término.',
      'Conflitos (professor ou turma ocupados) são apontados linha a linha e essas linhas não são importadas.',
      'Aulas idênticas às já cadastradas são ignoradas, então reimportar a mesma planilha não duplica nada.',
    ],
  },
};

// ------------------------------------------------------------------ Contrato da API

export interface ImportRowInput {
  /** Número da linha na planilha, para o relatório. */
  line: number;
  values: Record<string, string>;
}

export interface ImportOptions {
  /** O que fazer com registros que já existem (cadastros). */
  existing?: 'update' | 'skip';
  /** Aulas: cria disciplinas que ainda não existem. */
  createMissingSubjects?: boolean;
  /** Aulas: apaga as aulas atuais das turmas (ou do professor/turma fixos) antes de importar. */
  replaceExisting?: boolean;
  /** Aulas: importação a partir da página de um professor ou turma. */
  fixedTeacherId?: number;
  fixedClassId?: number;
}

export interface ImportRequest {
  rows: ImportRowInput[];
  options?: ImportOptions;
  dryRun?: boolean;
}

export type ImportRowStatus = 'create' | 'update' | 'skip' | 'error';

export interface ImportRowResult {
  line: number;
  status: ImportRowStatus;
  label: string;
  messages: string[];
  warnings: string[];
}

export interface ImportReport {
  kind: ImportKind;
  dryRun: boolean;
  summary: Record<ImportRowStatus, number>;
  /** Aulas removidas antes da importação (modo substituir). */
  removed: number;
  /** Disciplinas criadas automaticamente (importação de aulas). */
  createdSubjects: string[];
  rows: ImportRowResult[];
}

// ------------------------------------------------------------------ Interpretação de valores

/** Compara textos ignorando acentos, maiúsculas e espaços extras. */
export function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Forma usada para reconhecer cabeçalhos: só letras e números. */
export function headerKey(value: string): string {
  return fold(value).replace(/[^a-z0-9]/g, '');
}

/** Associa cada campo à coluna da planilha cujo cabeçalho combina com um dos apelidos. */
export function guessMapping(spec: ImportSpec, headers: string[]): Record<string, number | null> {
  const keys = headers.map(headerKey);
  const used = new Set<number>();
  const mapping: Record<string, number | null> = {};
  // Primeiro casamentos exatos com o rótulo, depois com os apelidos, para não "roubar" colunas.
  for (const pass of ['label', 'alias'] as const) {
    for (const col of spec.columns) {
      if (mapping[col.key] !== undefined && mapping[col.key] !== null) continue;
      const candidates = pass === 'label' ? [col.label] : col.aliases;
      const idx = keys.findIndex((k, i) => !used.has(i) && k !== '' && candidates.some((c) => headerKey(c) === k));
      if (idx >= 0) {
        mapping[col.key] = idx;
        used.add(idx);
      } else mapping[col.key] ??= null;
    }
  }
  return mapping;
}

export const clean = (v: string | undefined | null) => (v ?? '').replace(/\s+/g, ' ').trim();

/** Ativo/inativo: retorna undefined para vazio e null para valor não reconhecido. */
export function parseActive(value: string): boolean | undefined | null {
  const v = fold(value);
  if (!v) return undefined;
  if (['ativo', 'ativa', 'sim', 's', 'yes', 'y', 'true', 'verdadeiro', '1', 'x'].includes(v)) return true;
  if (['inativo', 'inativa', 'nao', 'n', 'no', 'false', 'falso', '0'].includes(v)) return false;
  return null;
}

const SHIFT_WORDS: Record<string, ClassShift> = {
  manha: 'manha', m: 'manha', matutino: 'manha', matutina: 'manha',
  tarde: 'tarde', t: 'tarde', vespertino: 'tarde', vespertina: 'tarde',
  noite: 'noite', n: 'noite', noturno: 'noite', noturna: 'noite',
  integral: 'integral', i: 'integral', 'tempo integral': 'integral',
};

export function parseClassShift(value: string): ClassShift | null {
  return SHIFT_WORDS[fold(value)] ?? null;
}

export function parseShift(value: string): ShiftKey | null {
  const s = parseClassShift(value);
  return s && s !== 'integral' ? s : null;
}

const WEEKDAY_WORDS: Array<[Weekday, string[]]> = [
  [1, ['segunda', 'segunda-feira', 'segunda feira', 'seg', '2a', '2ª', '2a feira', '2ª feira', '2a-feira', '2ª-feira', 'monday', 'mon']],
  [2, ['terca', 'terca-feira', 'terca feira', 'ter', '3a', '3ª', '3a feira', '3ª feira', '3a-feira', '3ª-feira', 'tuesday', 'tue']],
  [3, ['quarta', 'quarta-feira', 'quarta feira', 'qua', '4a', '4ª', '4a feira', '4ª feira', '4a-feira', '4ª-feira', 'wednesday', 'wed']],
  [4, ['quinta', 'quinta-feira', 'quinta feira', 'qui', '5a', '5ª', '5a feira', '5ª feira', '5a-feira', '5ª-feira', 'thursday', 'thu']],
  [5, ['sexta', 'sexta-feira', 'sexta feira', 'sex', '6a', '6ª', '6a feira', '6ª feira', '6a-feira', '6ª-feira', 'friday', 'fri']],
  [6, ['sabado', 'sab', 'saturday', 'sat']],
];

export function parseWeekday(value: string): Weekday | null {
  const v = fold(value).replace(/\.$/, '').replace(/º/g, 'ª');
  for (const [day, words] of WEEKDAY_WORDS) if (words.includes(v)) return day;
  return null;
}

/** Aceita 7:00, 07:00, 7h, 7h30, 07:00:00, 0700 e 7.30. Retorna HH:MM ou null. */
export function parseTime(value: string): string | null {
  const v = fold(value).replace(/\s/g, '');
  if (!v) return null;
  const m = /^(\d{1,2})(?:[:h.](\d{2})?(?::\d{2})?)?(?:min)?$/.exec(v) ?? /^(\d{2})(\d{2})$/.exec(v);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/** Faixa em uma célula: "07:00-07:50", "7h às 7h50", "07:00 a 07:50". */
export function parseTimeRange(value: string): { start: string; end: string } | null {
  const parts = fold(value).split(/\s*(?:-|–|—|\bas\b|\bàs\b|\ba\b|\bate\b|\/)\s*/).filter(Boolean);
  if (parts.length !== 2) return null;
  const start = parseTime(parts[0]);
  const end = parseTime(parts[1]);
  return start && end ? { start, end } : null;
}

export function parseColor(value: string): SubjectColor | null {
  const v = fold(value);
  if (!v) return null;
  const byKey = SUBJECT_COLORS.find((c) => c === v);
  if (byKey) return byKey;
  const byName = SUBJECT_COLORS.find((c) => fold(COLOR_NAMES[c]) === v);
  if (byName) return byName;
  const aliases: Record<string, SubjectColor> = {
    amarela: 'amber', laranjado: 'orange', 'azul claro': 'sky', 'azul escuro': 'indigo', roxo: 'violet', lilas: 'violet',
    cinzento: 'slate', 'verde claro': 'lime', 'verde agua': 'teal', turquesa: 'teal', vermelho: 'rose', pink: 'rose',
  };
  return aliases[v] ?? null;
}

export function parsePeriodKind(value: string, label: string): PeriodKind | null {
  const v = fold(value);
  if (!v) return /intervalo|recreio|lanche|almoco|pausa/.test(fold(label)) ? 'intervalo' : 'aula';
  if (['aula', 'a', 'tempo', 'horario'].includes(v)) return 'aula';
  if (['intervalo', 'i', 'recreio', 'lanche', 'almoco', 'pausa'].includes(v)) return 'intervalo';
  return null;
}

/** Número de ordem em "1º horário", "2ª aula", "3", "Aula 4". Horários como "07:00" não são ordens. */
export function parseOrdinal(value: string): number | null {
  const v = fold(value);
  const m = /^(\d{1,2})\s*(?:º|ª|o|a)?(?=\s|$)/.exec(v) ?? /^(?:aula|horario|tempo|periodo)\s*(\d{1,2})$/.exec(v);
  return m ? Number(m[1]) : null;
}
