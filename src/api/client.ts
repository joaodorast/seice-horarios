import type { ApiErrorBody, LessonIssue } from '@shared/types';

export class ApiError extends Error {
  status: number;
  code: string;
  fields?: Record<string, string>;
  issues?: LessonIssue[];
  details?: Record<string, unknown>;

  constructor(status: number, body: ApiErrorBody['error']) {
    super(body.message);
    this.status = status;
    this.code = body.code;
    this.fields = body.fields;
    this.issues = body.issues;
    this.details = body.details;
  }
}

const NETWORK_MESSAGE = 'A conexão com o SEICE foi interrompida. Confira sua internet e verifique se a alteração já aparece no sistema antes de tentar novamente.';
export const REQUEST_TIMEOUT_MS = 45_000;

export async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    let res: Response;
    try {
      res = await fetch(`/api${path}`, {
        method,
        signal: controller.signal,
        headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new ApiError(0, { code: controller.signal.aborted ? 'request_timeout' : 'network', message: controller.signal.aborted ? 'O SEICE demorou para responder. Não foi possível confirmar o resultado. Confira se a operação já foi concluída antes de tentar novamente.' : NETWORK_MESSAGE });
    }
    if (res.status === 204) return undefined as T;
    let data: unknown = null;
    try { data = await res.json(); } catch {
      if (controller.signal.aborted) throw new ApiError(0, {code:'request_timeout',message:'A resposta do SEICE não foi concluída. Confira se a operação já aparece no sistema antes de tentar novamente.'});
    }
    if (!res.ok) {
      const err = (data as ApiErrorBody | null)?.error;
      if (err) throw new ApiError(res.status, err);
      throw new ApiError(res.status, {code:res.status>=500?'network':'unknown',message:res.status>=500?NETWORK_MESSAGE:'Não foi possível concluir a operação.'});
    }
    if (data === null) throw new ApiError(0, {code:'invalid_response',message:'O SEICE enviou uma resposta incompleta. Confira se a operação já aparece no sistema antes de tentar novamente.'});
    return data as T;
  } finally {
    clearTimeout(timeout);
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return 'Algo deu errado. Tente novamente em instantes.';
}
