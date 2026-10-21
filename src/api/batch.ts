import { request } from './client';

/** Conjuntos de dados que podem ser lidos juntos em GET /api/data. */
export type Resource = 'teachers' | 'classes' | 'subjects' | 'periods' | 'settings' | 'lessons';

interface Pending {
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
}

let queue = new Map<Resource, Pending[]>();
let scheduled = false;

async function flush() {
  const batch = queue;
  queue = new Map();
  scheduled = false;
  try {
    const data = await request<Record<Resource, unknown>>('GET', `/data?include=${[...batch.keys()].join(',')}`);
    for (const [name, waiters] of batch) waiters.forEach((w) => w.resolve(data[name]));
  } catch (error) {
    for (const waiters of batch.values()) waiters.forEach((w) => w.reject(error));
  }
}

/**
 * Lê um conjunto de dados. Leituras pedidas no mesmo instante (ex.: as seis consultas de uma tela)
 * viram uma única requisição ao servidor.
 */
export function load<T>(name: Resource): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const waiters = queue.get(name) ?? [];
    waiters.push({ resolve: resolve as (v: unknown) => void, reject });
    queue.set(name, waiters);
    if (!scheduled) {
      scheduled = true;
      setTimeout(flush, 0);
    }
  });
}
