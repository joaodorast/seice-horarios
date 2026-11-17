import {describe,expect,it} from 'vitest';
import {dismissUpdateNews,hasUpdateNews,rememberUpdate} from '../src/lib/updateNews';
function storage():Storage {
  const values=new Map<string,string>();
  return {getItem:(key)=>values.get(key)??null,setItem:(key,value)=>{values.set(key,value);},removeItem:(key)=>{values.delete(key);},clear:()=>values.clear(),key:(index)=>[...values.keys()][index]??null,get length(){return values.size;}};
}
describe('novidades depois da atualização',()=>{
  it('não anuncia atualização na primeira visita ou recarga da mesma versão',()=>{const s=storage();expect(hasUpdateNews(s,'v1')).toBe(false);expect(hasUpdateNews(s,'v1')).toBe(false);});
  it('aguarda carregar a nova versão e deixa de mostrar depois de fechar',()=>{const s=storage();hasUpdateNews(s,'v1');rememberUpdate(s,'v1');expect(hasUpdateNews(s,'v1')).toBe(false);expect(hasUpdateNews(s,'v2')).toBe(true);expect(hasUpdateNews(s,'v2')).toBe(true);dismissUpdateNews(s);expect(hasUpdateNews(s,'v2')).toBe(false);});
  it('também identifica atualização em recarga comum e navegação automática',()=>{const s=storage();hasUpdateNews(s,'v1');expect(hasUpdateNews(s,'v2')).toBe(true);dismissUpdateNews(s);expect(hasUpdateNews(s,'v3')).toBe(true);});
});
