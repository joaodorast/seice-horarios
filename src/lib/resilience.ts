/**
 * Proteções para o sistema publicado nunca ficar travado numa tela de erro:
 * - após uma nova publicação, os arquivos da versão anterior deixam de existir; se uma tela tentar
 *   carregá-los, a página é recarregada (uma vez) para buscar a versão nova;
 * - uma verificação periódica avisa quando há versão nova e atualiza na próxima troca de página.
 */

declare const __APP_VERSION__: string;

/** Versão desta cópia do sistema (definida no build). */
export const APP_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev';

const RELOAD_KEY = 'seice:recarregado-em';
const RELOAD_GUARD_MS = 30_000;

/** Erro de carregamento de um pedaço do sistema (arquivo de versão antiga ou falha de rede). */
export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /dynamically imported module|Importing a module script failed|error loading dynamically imported module|Failed to fetch dynamically|Unable to preload CSS|ChunkLoadError/i.test(
    message,
  );
}

/** Recarrega a página, no máximo uma vez a cada 30 s (evita ciclos de recarga). Retorna se recarregou. */
export function reloadOnce(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
    if (Date.now() - last < RELOAD_GUARD_MS) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    // sem sessionStorage: recarrega mesmo assim (o navegador não entra em ciclo por isso)
  }
  window.location.reload();
  return true;
}

// ------------------------------------------------------------------ Versão nova disponível

let updateAvailable = false;
const listeners = new Set<() => void>();

export const updateStore = {
  get: () => updateAvailable,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => void listeners.delete(listener);
  },
};

async function checkVersion() {
  if (APP_VERSION === 'dev' || updateAvailable) return;
  try {
    const res = await fetch('/version.json', { cache: 'no-store' });
    if (!res.ok) return;
    const { version } = (await res.json()) as { version?: string };
    if (version && version !== APP_VERSION) {
      updateAvailable = true;
      listeners.forEach((l) => l());
    }
  } catch {
    // sem conexão: tenta de novo na próxima verificação
  }
}

/** Instala as proteções globais. Chamar uma vez, antes de renderizar o sistema. */
export function installResilience() {
  // O Vite dispara este evento quando não consegue carregar um pedaço do sistema.
  window.addEventListener('vite:preloadError', (event) => {
    if (reloadOnce()) event.preventDefault();
  });
  window.addEventListener('unhandledrejection', (event) => {
    if (isChunkLoadError(event.reason) && reloadOnce()) event.preventDefault();
  });

  window.setInterval(checkVersion, 5 * 60_000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void checkVersion();
  });
  window.setTimeout(checkVersion, 30_000);
}
