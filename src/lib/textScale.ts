/**
 * Tamanho do texto da interface. Aplica um zoom proporcional em toda a tela (inclusive tamanhos em px),
 * e publica o fator em --ui-zoom para que as alturas de tela inteira (h-app, min-h-app) o compensem.
 * "Automático" cresce em monitores grandes, onde o texto padrão fica pequeno à distância.
 */
export type TextScale = 'auto' | 'normal' | 'grande' | 'maior';

export const TEXT_SCALE_LABEL: Record<TextScale, string> = {
  auto: 'Automático',
  normal: 'Normal',
  grande: 'Grande',
  maior: 'Maior',
};

const KEY = 'seice:tamanho-texto';
const FIXED: Record<Exclude<TextScale, 'auto'>, number> = { normal: 1, grande: 1.12, maior: 1.25 };

function autoZoom(width: number): number {
  if (width >= 2300) return 1.25;
  if (width >= 1800) return 1.15;
  if (width >= 1500) return 1.07;
  return 1;
}

let current: TextScale = 'auto';
const listeners = new Set<() => void>();

function apply() {
  const zoom = current === 'auto' ? autoZoom(window.innerWidth) : FIXED[current];
  const root = document.documentElement;
  root.style.setProperty('zoom', String(zoom));
  root.style.setProperty('--ui-zoom', String(zoom));
}

export const textScaleStore = {
  get: () => current,
  set(scale: TextScale) {
    current = scale;
    try {
      localStorage.setItem(KEY, scale);
    } catch {
      // armazenamento indisponível: vale só nesta sessão
    }
    apply();
    listeners.forEach((l) => l());
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => void listeners.delete(listener);
  },
};

/** Aplica a preferência salva antes da primeira renderização e acompanha o tamanho da janela. */
export function installTextScale() {
  try {
    const saved = localStorage.getItem(KEY) as TextScale | null;
    if (saved && saved in TEXT_SCALE_LABEL) current = saved;
  } catch {
    // sem armazenamento: usa o automático
  }
  apply();
  window.addEventListener('resize', () => current === 'auto' && apply());
}
