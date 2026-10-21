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

const NETWORK_MESSAGE = 'Não foi possível conectar ao servidor do SEICE. Verifique se ele está em execução e tente novamente.';

export async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, { code: 'network', message: NETWORK_MESSAGE });
  }
  if (res.status === 204) return undefined as T;
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // corpo vazio ou não-JSON (ex.: servidor fora do ar atrás do proxy)
  }
  if (!res.ok) {
    const err = (data as ApiErrorBody | null)?.error;
    if (err) throw new ApiError(res.status, err);
    throw new ApiError(res.status, {
      code: res.status >= 500 ? 'network' : 'unknown',
      message: res.status >= 500 ? NETWORK_MESSAGE : 'Não foi possível concluir a operação.',
    });
  }
  return data as T;
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return 'Algo deu errado. Tente novamente em instantes.';
}
