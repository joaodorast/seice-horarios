import {afterEach,describe,expect,it,vi} from 'vitest';
import {ApiError,request,REQUEST_TIMEOUT_MS} from '../src/api/client';
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers()});
describe('respostas e espera da API',()=>{
 it('interrompe espera infinita e não repete uma gravação automaticamente',async()=>{vi.useFakeTimers();const fetch=vi.fn((_url,options)=>new Promise((_resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new Error('aborted')))));vi.stubGlobal('fetch',fetch);const result=request('POST','/teachers',{name:'Teste'}).catch(error=>error);await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);const error=await result as ApiError;expect(error).toBeInstanceOf(ApiError);expect(error.code).toBe('request_timeout');expect(error.message).toContain('Confira');expect(fetch).toHaveBeenCalledTimes(1);});
 it('conserva o motivo de um bloqueio e os campos de validação',async()=>{vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({error:{code:'wrong_unit',message:'Sua unidade não permite esta ação',fields:{unitId:'Confira a unidade'}}}),{status:403})));const error=await request('PUT','/teachers/1',{}).catch(error=>error) as ApiError;expect(error.status).toBe(403);expect(error.fields?.unitId).toBe('Confira a unidade');});
 it('não trata resposta HTML de sucesso como gravação confirmada',async()=>{vi.stubGlobal('fetch',vi.fn(async()=>new Response('<html>Indisponível</html>',{status:200})));await expect(request('POST','/teachers',{})).rejects.toMatchObject({code:'invalid_response'});});
 it('permite resposta sem conteúdo em exclusão concluída',async()=>{vi.stubGlobal('fetch',vi.fn(async()=>new Response(null,{status:204})));expect(await request('DELETE','/teachers/1')).toBeUndefined();});
});

