export interface FailureNotice { key: string; title: string; message: string; nextStep: string; details?: string[] }
type Failure = { status?: number; code?: string; message?: string; fields?: Record<string,string>; issues?: {message:string}[] };
let notices: FailureNotice[] = [];
const listeners = new Set<() => void>();
export const failureNotices = {
  get: () => notices,
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  show(notice: FailureNotice) {
    if (notices.some(item => item.key === notice.key)) return;
    notices = [...notices, notice];
    listeners.forEach(listener => listener());
  },
  dismiss() { notices = notices.slice(1); listeners.forEach(listener => listener()); },
};
/** Sem repetir a ação automaticamente: uma falha de conexão pode acontecer depois da gravação. */
export function explainFailure(error: unknown): FailureNotice {
  const failure = (error && typeof error === 'object' ? error : {}) as Failure;
  const message = typeof failure.status === 'number' && failure.message ? failure.message : 'Algo deu errado. Tente novamente em instantes.';
  const details = [...new Set([...Object.values(failure.fields ?? {}), ...(failure.issues ?? []).map(issue => issue.message)])];
  const notice = { key: message, message, details, title: 'Não foi possível concluir esta ação', nextStep: 'Feche este aviso para revisar a tela. Se o problema continuar, informe à administração o que você estava tentando fazer.' };
  if (failure.status === 403) return {...notice, title: 'Seu acesso não permite esta ação', nextStep: 'Consulte os dados disponíveis para sua coordenação. Se precisar dessa alteração, peça à administração para conferir seu acesso ou o cadastro.'};
  if (failure.status === 404) return {...notice, title: 'Esta informação não está mais disponível', nextStep: 'Feche este aviso e confira se o cadastro ainda aparece na lista antes de continuar.'};
  if (failure.status === 409) return {...notice, title: 'Há uma informação para conferir', nextStep: 'Revise o conflito ou o vínculo informado antes de tentar novamente. O sistema não fará essa alteração automaticamente.'};
  if (failure.status === 422) return {...notice, title: 'Confira os dados antes de continuar', nextStep: 'Feche este aviso, corrija os campos indicados e salve novamente.'};
  if (failure.status === 429) return {...notice, title: 'Vamos aguardar um momento', nextStep: 'Aguarde um pouco antes de tentar novamente. Evite clicar várias vezes no mesmo botão.'};
  if (failure.status === 0 || (failure.status ?? 0) >= 500) return {...notice, title: 'Não conseguimos confirmar a operação', nextStep: 'Confira sua conexão. Antes de repetir um cadastro ou uma alteração, verifique se ela já aparece no sistema, para evitar duplicação.'};
  return notice;
}
export function reportFailure(error: unknown) { failureNotices.show(explainFailure(error)); }
