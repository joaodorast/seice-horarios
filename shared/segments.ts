/**
 * Segmentos de ensino do SEICE e o catálogo de disciplinas de cada um.
 *
 * Usado em três lugares:
 *  - no cadastro do professor, para marcar em quais segmentos ele leciona;
 *  - na lista de professores, para o coordenador ver apenas os professores do segmento dele;
 *  - no cadastro de disciplinas, para mostrar só as disciplinas do segmento escolhido.
 *
 * A ordem é a ordem em que os segmentos aparecem na tela.
 */

export const SEGMENT_KEYS = ['infantil', 'fund1', 'fund2', 'medio', 'tecnico', 'multidisciplinar'] as const;
export type SegmentKey = (typeof SEGMENT_KEYS)[number];

export const SEGMENT_LABEL: Record<SegmentKey, string> = {
  infantil: 'Educação Infantil',
  fund1: 'Fundamental I',
  fund2: 'Fundamental II',
  medio: 'Médio',
  tecnico: 'Médio / Técnico',
  multidisciplinar: 'Multidisciplinar',
};

/** Rótulo curto, para os botões de seleção. */
export const SEGMENT_SHORT: Record<SegmentKey, string> = {
  infantil: 'Infantil',
  fund1: 'Fund. I',
  fund2: 'Fund. II',
  medio: 'Médio',
  tecnico: 'Técnico',
  multidisciplinar: 'Multidisciplinar',
};

/**
 * Disciplinas de cada segmento, na ordem em que devem aparecer.
 * O que estiver aqui e não existir no banco ainda é oferecido como sugestão para cadastrar.
 */
export const SEGMENT_SUBJECTS: Record<SegmentKey, string[]> = {
  infantil: ['Português', 'Matemática', 'Ciências', 'Leitura', 'Artes', 'Inglês', 'Dança', 'Futebol', 'Música', 'Educação Física', 'Sociedade', 'Recreação Aquática'],
  fund1: ['Português', 'Matemática', 'Ciências', 'História', 'Geografia', 'Inglês', 'Artes', 'Produção Textual', 'Música', 'Dança', 'Futebol', 'Educação Física', 'Recreação Aquática'],
  fund2: [
    'Português',
    'Matemática',
    'Ciências',
    'História',
    'Geografia',
    'Inglês',
    'Artes',
    'Produção Textual',
    'Música',
    'Informática',
    'Educação Física',
    'Recreação',
    'Socioemocional',
    'Of. das Finanças',
    'Dança',
  ],
  medio: ['Português', 'Gramática', 'Redação', 'Literatura', 'Matemática', 'Física', 'Química', 'Biologia', 'História', 'Geografia', 'Filosofia', 'Sociologia', 'Inglês', 'Artes', 'Educação Física', 'Projeto de Vida'],
  tecnico: [
    // Informática
    'Introdução à Informática',
    'Lógica da Programação',
    'Programas e Aplicativos I',
    'Programas e Aplicativos II',
    'Sistemas Operacionais',
    'Redes de Computadores I',
    'Redes de Computadores II',
    'Mídias Digitais I',
    'Mídias Digitais II',
    'Práticas de Laboratório I',
    'Práticas de Laboratório II',
    'Programação Web I',
    'Programação Web II',
    'Banco de Dados I',
    'Banco de Dados II',
    'Banco de Dados III',
    'POO I',
    'POO II',
    'POO III',
    'Empreendedorismo I',
    'Empreendedorismo II',
    'Segurança da Informação I',
    'Segurança da Informação II',
    'Inglês Técnico II',
    'Projeto Integrador',
    'Orientação TCC I',
    'Orientação TCC II',
    // Enfermagem
    'Fundamentos I',
    'Fundamentos II',
    'Anatomia I',
    'Anatomia II',
    'Apoio Diagnóstico I',
    'Apoio Diagnóstico II',
    'Microbiologia',
    'Farmacologia',
    'Epidemiologia',
    'Saúde Coletiva',
    'Saúde da Mulher',
    'Saúde do Idoso',
    'Saúde do Adulto I',
    'Políticas Públicas de Saúde',
    'Noções de Administração nos Serviços de Saúde',
    'Assistência de Urgência e Emergência I',
    'Centro Cirúrgico e Recuperação Perioperatória I',
    'Centro Cirúrgico e Recuperação Perioperatória II',
    'Fundamentos do Direito',
  ],
  multidisciplinar: ['Projeto de Vida', 'Socioemocional', 'Projeto Integrador', 'Orientação TCC I', 'Orientação TCC II', 'Recreação', 'Recreação Aquática', 'Dança', 'Futebol', 'Música', 'Informática'],
};

/** Disciplinas que não pertencem a um segmento específico (aparecem em todos). */
export const COMMON_SUBJECTS = ['Projeto de Vida'];

export const isSegment = (v: unknown): v is SegmentKey => typeof v === 'string' && (SEGMENT_KEYS as readonly string[]).includes(v);

/** Segmentos na ordem canônica. */
export const sortSegments = (list: SegmentKey[]): SegmentKey[] => SEGMENT_KEYS.filter((s) => list.includes(s));
