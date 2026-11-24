import {describe, it, expect} from 'vitest';
import {matchesName} from '../src/lib/text';

describe('pesquisa de professores', () => {
  it('aceita partes, acentos, caixa, espaços e ordem diferente', () => {
    expect(matchesName('Jéssica Hemelen', '  HEMELEN jess  ')).toBe(true);
    expect(matchesName('Raissa dos Santos', 'santos rai')).toBe(true);
    expect(matchesName('Maíra da Silva', 'maira')).toBe(true);
    expect(matchesName('Raissa dos Santos', '')).toBe(true);
  });
  it('tolera letra faltante, trocada, repetida e duas letras invertidas', () => {
    expect(matchesName('Raissa dos Santos', 'raisa')).toBe(true);
    expect(matchesName('Beatriz Lima', 'beatrz')).toBe(true);
    expect(matchesName('Daniele Bezerra', 'daneile')).toBe(true);
    expect(matchesName('Marina Magalhães', 'marinna')).toBe(true);
    expect(matchesName('Larissa Paes', 'larisa')).toBe(true);
  });
  it('exige todos os termos e evita aproximação para consultas muito curtas', () => {
    expect(matchesName('Raissa dos Santos', 'raisa oliveira')).toBe(false);
    expect(matchesName('Ana Carolina', 'xyz')).toBe(false);
    expect(matchesName('Raissa dos Santos', 'zzzxxx')).toBe(false);
  });
});
