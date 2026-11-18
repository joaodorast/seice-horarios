import {afterAll,beforeAll,describe,expect,it} from 'vitest';
import {startTestServer,type TestServer} from './helpers.js';
import {upsertUser} from '../server/auth.js';

describe('disciplinas de professores compartilhados',()=>{
 let s:TestServer,ce:number,jp:number,subject:number,secondSubject:number,cookie:string;
 const call=async(method:string,path:string,body?:unknown)=>{
  const r=await fetch(s.base+path,{method,headers:{cookie,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  return {status:r.status,body:await r.json().catch(()=>null)};
 };
 const create=async(unitIds:number[]=[ce,jp])=>(await s.call('POST','/teachers',{name:'Professor de teste '+crypto.randomUUID(),unitId:unitIds[0],unitIds,subjectIds:[subject],segments:['medio'],notes:'Dados administrativos preservados',active:true})).body;
 beforeAll(async()=>{
  s=await startTestServer();const units=(await s.call('GET','/units')).body;ce=units.find((u:any)=>u.code==='CE').id;jp=units.find((u:any)=>u.code==='JP').id;
  subject=(await s.call('POST','/subjects',{name:'Filosofia',segments:['medio']})).body.id;
  secondSubject=(await s.call('POST','/subjects',{name:'Sociologia',segments:['medio']})).body.id;
  await upsertUser(s.db,'coord@example.invalid','Coordenação de teste','senha-exclusiva-de-teste');
  await s.db.query("UPDATE users SET role='coordenador',unit_id=$1 WHERE email='coord@example.invalid'",[ce]);
  const login=await fetch(s.base+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'coord@example.invalid',password:'senha-exclusiva-de-teste'})});cookie=login.headers.get('set-cookie')!.split(';')[0];
 });
 afterAll(async()=>{await s.close()});
 it('salva disciplinas e segmentos nas duas unidades sem alterar os demais dados',async()=>{
  const teacher=await create();const before=(await s.call('GET',`/teachers/${teacher.id}`)).body;
  const result=await call('PUT',`/teachers/${teacher.id}/teaching`,{subjectIds:[subject,secondSubject],segments:['fund2','medio']});expect(result.status).toBe(200);
  const after=(await s.call('GET',`/teachers/${teacher.id}`)).body;
  expect(after.subjectIds).toEqual([subject,secondSubject]);expect(after.segments).toEqual(['fund2','medio']);
  for(const key of ['name','unitId','unitIds','notes','active','availability','payrollProfiles'])expect(after[key]).toEqual(before[key]);
  expect((await call('GET',`/teachers/${teacher.id}`)).body.subjectIds).toEqual([subject,secondSubject]);
 });
 it('permite desmarcar disciplinas e segmentos sem deixar vínculos antigos',async()=>{
  const teacher=await create();expect((await call('PUT',`/teachers/${teacher.id}/teaching`,{subjectIds:[],segments:[]})).status).toBe(200);
  const saved=(await s.call('GET',`/teachers/${teacher.id}`)).body;expect(saved.subjectIds).toEqual([]);expect(saved.segments).toEqual([]);expect(saved.unitIds).toEqual([ce,jp]);
 });
 it('recusa alteração administrativa no endpoint e mantém a edição geral compartilhada protegida',async()=>{
  const teacher=await create();expect((await call('PUT',`/teachers/${teacher.id}/teaching`,{subjectIds:[secondSubject],segments:['medio'],name:'Nome indevido',unitIds:[ce],active:false})).status).toBe(422);
  expect((await call('PUT',`/teachers/${teacher.id}`,{...teacher,name:'Nome indevido'})).status).toBe(403);
  expect((await s.call('GET',`/teachers/${teacher.id}`)).body).toMatchObject({name:teacher.name,subjectIds:[subject],unitIds:[ce,jp],active:true});
 });
 it('não permite editar professor que não atua na unidade do coordenador',async()=>{
  const teacher=await create([jp]);expect((await call('PUT',`/teachers/${teacher.id}/teaching`,{subjectIds:[secondSubject],segments:['medio']})).status).toBe(403);
  expect((await s.call('GET',`/teachers/${teacher.id}`)).body.subjectIds).toEqual([subject]);
 });
 it('não apaga vínculos se uma disciplina não existir',async()=>{
  const teacher=await create();expect((await call('PUT',`/teachers/${teacher.id}/teaching`,{subjectIds:[999999],segments:[]})).status).toBe(422);
  expect((await s.call('GET',`/teachers/${teacher.id}`)).body).toMatchObject({subjectIds:[subject],segments:['medio']});
 });
 it('exige sessão autenticada',async()=>{
  const teacher=await create();expect((await s.anonymous('PUT',`/teachers/${teacher.id}/teaching`,{subjectIds:[],segments:[]})).status).toBe(401);
 });
});
