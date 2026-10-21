// O módulo nativo node:sqlite ainda emite um aviso "experimental" a cada inicialização.
// Filtramos apenas esse aviso para manter o terminal limpo; os demais avisos continuam visíveis.
const originalEmitWarning = process.emitWarning.bind(process);
process.emitWarning = ((warning: string | Error, ...args: unknown[]) => {
  const text = typeof warning === 'string' ? warning : warning?.message;
  const type = typeof args[0] === 'string' ? args[0] : (args[0] as { type?: string } | undefined)?.type;
  if (type === 'ExperimentalWarning' && text?.includes('SQLite')) return;
  return (originalEmitWarning as (...a: unknown[]) => void)(warning, ...args);
}) as typeof process.emitWarning;

export {};
