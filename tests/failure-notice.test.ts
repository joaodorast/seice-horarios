import {afterEach,describe,expect,it} from 'vitest';
import {explainFailure,failureNotices,reportFailure} from '../src/lib/failureNotice';
afterEach(()=>{while(failureNotices.get().length)failureNotices.dismiss()});
describe('avisos persistentes de falha',()=>{
 it.each([403,404,409,422,429,500,0])('explica a falha %s e orienta como continuar',status=>{const notice=explainFailure({status,message:'Motivo informado pelo sistema'});expect(notice.message).toBe('Motivo informado pelo sistema');expect(notice.nextStep.length).toBeGreaterThan(25);expect(notice.title.length).toBeGreaterThan(10);});
 it('mostra os campos e conflitos sem repetir mensagens',()=>{expect(explainFailure({status:422,message:'Revise os campos',fields:{name:'Informe o nome'},issues:[{message:'Informe o nome'},{message:'Horário ocupado'}]}).details).toEqual(['Informe o nome','Horário ocupado']);});
 it('não mostra detalhes técnicos de erros inesperados',()=>{const notice=explainFailure(new Error('SQL password=privado'));expect(JSON.stringify(notice)).not.toContain('password');});
 it('a mesma falha global e local gera um único aviso, sem substituir uma falha diferente',()=>{reportFailure({status:403,message:'Acesso restrito'});failureNotices.show({key:'Acesso restrito',title:'Não salvou',message:'Acesso restrito',nextStep:'Conferir'});reportFailure({status:409,message:'Horário ocupado'});expect(failureNotices.get()).toHaveLength(2);failureNotices.dismiss();expect(failureNotices.get()[0].message).toBe('Horário ocupado');failureNotices.dismiss();expect(failureNotices.get()).toEqual([]);});
 it('uma falha pode ser apresentada de novo se a pessoa tentar novamente depois de fechar',()=>{const error={status:403,message:'Acesso restrito'};reportFailure(error);failureNotices.dismiss();reportFailure(error);expect(failureNotices.get()).toHaveLength(1);});
 it('não afirma que nada foi salvo quando houve perda de conexão',()=>{expect(explainFailure({status:0,message:'Sem conexão'}).nextStep).toContain('verifique se ela já aparece');});
});
