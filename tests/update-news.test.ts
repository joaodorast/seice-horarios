import {describe,expect,it} from 'vitest';
import {dismissUpdateNews,hasUpdateNews,rememberUpdate} from '../src/lib/updateNews';
function storage():Storage {
  const values=new Map<string,string>();
  return {getItem:(key)=>values.get(key)??null,setItem:(key,value)=>{values.set(key,value);},removeItem:(key)=>{values.delete(key);},clear:()=>values.clear(),key:(index)=>[...values.keys()][index]??null,get length(){return values.size;}};
}
describe('novidades depois da atualização',()=>{
  it('recupera a atualização pelo botão antigo sem marcador e não repete depois de fechar',()=>{
    const s=storage();
    expect(hasUpdateNews(s,'nova-versao',true)).toBe(true);
    // O segundo efeito do StrictMode não pode esconder o modal.
    expect(hasUpdateNews(s,'nova-versao',true)).toBe(true);
    dismissUpdateNews(s);
    expect(hasUpdateNews(s,'nova-versao',true)).toBe(false);
  });
  it('não confunde voltar pelo histórico com atualização nem confirma uma recarga com versão antiga',()=>{
    const s=storage();expect(hasUpdateNews(s,'v1',false)).toBe(false);
    rememberUpdate(s,'v1');expect(hasUpdateNews(s,'v1',true)).toBe(false);
    expect(hasUpdateNews(s,'v2',true)).toBe(true);
  });
  it('não anuncia atualização na primeira visita ou recarga da mesma versão',()=>{const s=storage();expect(hasUpdateNews(s,'v1')).toBe(false);expect(hasUpdateNews(s,'v1')).toBe(false);});
  it('aguarda carregar a nova versão e deixa de mostrar depois de fechar',()=>{const s=storage();hasUpdateNews(s,'v1');rememberUpdate(s,'v1');expect(hasUpdateNews(s,'v1')).toBe(false);expect(hasUpdateNews(s,'v2')).toBe(true);expect(hasUpdateNews(s,'v2')).toBe(true);dismissUpdateNews(s);expect(hasUpdateNews(s,'v2')).toBe(false);});
  it('também identifica atualização em recarga comum e navegação automática',()=>{const s=storage();hasUpdateNews(s,'v1');expect(hasUpdateNews(s,'v2')).toBe(true);dismissUpdateNews(s);expect(hasUpdateNews(s,'v3')).toBe(true);});
});
