import {describe,expect,it} from 'vitest';
import {createModalScrollLock} from '../src/lib/modalScroll';
describe('rolagem compartilhada pelos modais',()=>{
 it('restaura o valor anterior ao fechar a última janela',()=>{const root={style:{overflow:'auto'}};const manager=createModalScrollLock(()=>root);const release=manager.acquire();expect(root.style.overflow).toBe('hidden');release();expect(root.style.overflow).toBe('auto');});
 it.each([true,false])('preserva a janela restante quando a ordem de fechamento é %s',first=>{const root={style:{overflow:''}};const manager=createModalScrollLock(()=>root);const a=manager.acquire(),b=manager.acquire();(first?a:b)();expect(root.style.overflow).toBe('hidden');(first?b:a)();expect(root.style.overflow).toBe('');});
 it('suporta limpeza repetida e remontagem do StrictMode sem liberar outro modal',()=>{const root={style:{overflow:''}};const manager=createModalScrollLock(()=>root);const first=manager.acquire();first();const second=manager.acquire();first();expect(root.style.overflow).toBe('hidden');second();expect(root.style.overflow).toBe('');});
 it('abrir e fechar repetidamente não acumula bloqueios',()=>{const root={style:{overflow:'scroll'}};const manager=createModalScrollLock(()=>root);for(let i=0;i<100;i++){const release=manager.acquire();release();expect(root.style.overflow).toBe('scroll');}});
});
