export type ClassValue = string | number | bigint | boolean | null | undefined;

/** Junta classes condicionais. Mantém o código legível sem depender de bibliotecas extras. */
export function cn(...values: ClassValue[]): string {
  return values.filter((v): v is string => typeof v === 'string' && v.length > 0).join(' ');
}
