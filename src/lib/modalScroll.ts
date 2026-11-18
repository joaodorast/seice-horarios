interface ScrollRoot { style: { overflow: string } }
/** Cada janela devolve somente o bloqueio que adquiriu. A ordem de fechamento não importa. */
export function createModalScrollLock(root: () => ScrollRoot) {
  const locks = new Set<symbol>();
  let previous = '';
  let element: ScrollRoot | undefined;
  return {
    acquire() {
      if (!locks.size) { element = root(); previous = element.style.overflow; }
      const token = Symbol();
      locks.add(token);
      element!.style.overflow = 'hidden';
      return () => {
        if (!locks.delete(token)) return;
        if (!locks.size && element) { element.style.overflow = previous; element = undefined; }
      };
    },
  };
}
export const modalScroll = createModalScrollLock(() => document.documentElement);
