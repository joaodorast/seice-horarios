import {afterAll,beforeAll,describe,expect,it} from 'vitest';
import {startTestServer,type TestServer} from './helpers.js';
import {upsertUser} from '../server/auth.js';
let server:TestServer,ce:number,jp:number,teacher:number,other:number,ceClass:number,jpClass:number,subject:number;
const call=(method:string,path:string,body?:unknown)=>server.call(method,path,body);
beforeAll(async()=>{
 server=await startTestServer();const units=(await call('GET','/units')).body;ce=units.find((u:any)=>u.code==='CE').id;jp=units.find((u:any)=>u.code==='JP').id;
 teacher=(await call('POST','/teachers',{name:'Professor Compartilhado',unitId:ce,unitIds:[ce,jp]})).body.id;
 other=(await call('POST','/teachers',{name:'Outro Professor',unitId:ce,unitIds:[ce]})).body.id;
 ceClass=(await call('POST','/classes',{name:'CE Fund I',grade:'Fund I',shift:'manha',unitId:ce})).body.id;
 jpClass=(await call('POST','/classes',{name:'JP Fund I',grade:'Fund I',shift:'manha',unitId:jp})).body.id;
 subject=(await call('POST','/subjects',{name:'Disciplina de teste',workloadKind:'technical'})).body.id;
});
afterAll(()=>server.close());
describe('API de carga por regência e classificação',()=>{
 it('persiste classificação da disciplina na criação e edição',async()=>{
   expect((await call('GET','/subjects')).body.find((s:any)=>s.id===subject).workloadKind).toBe('technical');
   await call('PUT',`/subjects/${subject}`,{name:'Disciplina de teste',workloadKind:'regular'});
   expect((await call('GET','/subjects')).body.find((s:any)=>s.id===subject).workloadKind).toBe('regular');
 });
 it('aceita aula sem professor e mantém conflito da turma',async()=>{
   const input={teacherId:null,classId:ceClass,subjectId:subject,weekday:1,start:'07:00',end:'07:50'};
   const created=await call('POST','/lessons',input);expect(created.status).toBe(201);expect(created.body.lesson.teacherId).toBeNull();
   expect((await call('POST','/lessons',{...input,classId:jpClass})).status).toBe(201);
   expect((await call('POST','/lessons',input)).status).toBe(409);
   expect((await call('POST','/lessons',{...input,teacherId:0,weekday:3})).status).toBe(422);
 });
 it('persiste classificação por aula e não aceita enum inválido',async()=>{
   const input={teacherId:teacher,classId:ceClass,subjectId:subject,weekday:2,start:'07:00',end:'07:50',workloadKind:'technical'};
   const created=await call('POST','/lessons',input);expect(created.status).toBe(201);expect(created.body.lesson.workloadKind).toBe('technical');
   const {workloadKind,...legacy}=input;void workloadKind;const preserved=await call('PUT',`/lessons/${created.body.lesson.id}`,legacy);expect(preserved.body.lesson.workloadKind).toBe('technical');
   const edited=await call('PUT',`/lessons/${created.body.lesson.id}`,{...input,workloadKind:'regular'});expect(edited.body.lesson.workloadKind).toBe('regular');
   expect((await call('POST','/lessons',{...input,weekday:3,workloadKind:'invalid'})).status).toBe(422);
 });
 it('salva regência e referências sem duplicar a turma e sem misturar unidades',async()=>{
   const input={unitId:ce,references:[{label:'Geografia',kind:'regular',weeklyLessons:6}],regencies:[{classId:ceClass,segment:'fund1',weekdays:[1,2,3,4,5]}]};
   expect((await call('PUT',`/teachers/${teacher}/payroll`,input)).status).toBe(200);
   expect((await call('PUT',`/teachers/${other}/payroll`,input)).status).toBe(409);
   expect((await call('PUT',`/teachers/${teacher}/payroll`,{...input,regencies:[...input.regencies,...input.regencies]})).status).toBe(422);
   expect((await call('PUT',`/teachers/${teacher}/payroll`,{...input,regencies:[{...input.regencies[0],classId:jpClass}]})).status).toBe(422);
   expect((await call('PUT',`/teachers/${teacher}/payroll`,{unitId:jp,references:[],regencies:[{classId:jpClass,segment:'infantil',weekdays:[1,2,3,4,5]}]})).status).toBe(200);
 });
 it('corrige nome preservando id aulas e disciplinas; protege unidade com horários',async()=>{
   const current=(await call('GET',`/teachers/${teacher}`)).body;
   const saved=await call('PUT',`/teachers/${teacher}`,{...current,name:'Nome corrigido'});expect(saved.status).toBe(200);expect(saved.body.id).toBe(teacher);expect(saved.body.subjectIds).toEqual(current.subjectIds);
   expect((await call('GET','/lessons')).body.some((l:any)=>l.teacherId===teacher)).toBe(true);
   expect((await call('PUT',`/teachers/${teacher}`,{...saved.body,unitIds:[jp],unitId:jp})).status).toBe(422);
 });
 it('confere referência sem trocar nome nem regência e exige confirmação de cadastro',async()=>{
   const ref=(await server.db.query<{id:number}>(`INSERT INTO payroll_references(unit_id,supplied_name,reference_items) VALUES($1,$2,$3::jsonb) RETURNING id`,[ce,'Nome da lista',JSON.stringify([{label:'Informática',kind:'technical',weeklyLessons:10}])]))[0];
   expect((await call('PUT',`/payroll-references/${ref.id}/resolve`,{teacherId:teacher})).status).toBe(200);
   const current=(await call('GET',`/teachers/${teacher}`)).body;expect(current.name).toBe('Nome corrigido');expect(current.payrollProfiles.find((p:any)=>p.unitId===ce).regencies).toHaveLength(1);expect(current.payrollProfiles.find((p:any)=>p.unitId===ce).references[0].weeklyLessons).toBe(10);
   expect((await call('PUT',`/payroll-references/${ref.id}/resolve`,{teacherId:teacher})).status).toBe(409);
 });
 it('cadastra e vincula referência em uma confirmação, sem duplicar em nova tentativa',async()=>{
   const ref=(await server.db.query<{id:number}>(`INSERT INTO payroll_references(unit_id,supplied_name,reference_items) VALUES($1,$2,$3::jsonb) RETURNING id`,[ce,'Professora Nova da Lista',JSON.stringify([{label:'História',kind:'regular',weeklyLessons:6}])]))[0];
   const path=`/payroll-references/${ref.id}/create-teacher`;
   expect((await call('POST',path,{})).status).toBe(422);
   const result=await call('POST',path,{confirmed:true});expect(result.status).toBe(201);
   expect(result.body.name).toBe('Professora Nova da Lista');expect(result.body.unitIds).toEqual([ce]);
   expect(result.body.payrollProfiles[0].references[0].weeklyLessons).toBe(6);
   expect((await call('GET','/payroll-references')).body.find((r:any)=>r.id===ref.id).teacherId).toBe(result.body.id);
   expect((await call('POST',path,{confirmed:true})).status).toBe(409);
 });
 it('bloqueia criar referência com nome existente inclusive de outra unidade',async()=>{
   const otherTeacher=await call('POST','/teachers',{name:'Professora Já Existente JP',unitId:jp,unitIds:[jp]});expect(otherTeacher.status).toBe(201);
   const ref=(await server.db.query<{id:number}>(`INSERT INTO payroll_references(unit_id,supplied_name,reference_items) VALUES($1,$2,$3::jsonb) RETURNING id`,[ce,'Professora Já Existente JP',JSON.stringify([{label:'História',kind:'regular',weeklyLessons:6}])]))[0];
   const before=(await call('GET','/teachers')).body.length;
   const result=await call('POST',`/payroll-references/${ref.id}/create-teacher`,{confirmed:true});expect(result.status).toBe(409);expect(result.body.error.code).toBe('duplicate_name');
   expect((await call('GET','/teachers')).body.length).toBe(before);
   expect((await call('GET','/payroll-references')).body.find((r:any)=>r.id===ref.id).teacherId).toBeNull();
 });
 it('impede homônimo não confirmado e preserva o cadastro existente',async()=>{
   const count=(await call('GET','/teachers')).body.length;
   const res=await call('POST','/teachers',{name:'Nome corrigido',unitId:ce,unitIds:[ce]});expect(res.status).toBe(409);expect(res.body.error.code).toBe('duplicate_name');
   expect((await call('GET','/teachers')).body.length).toBe(count);
   expect((await call('POST','/teachers',{name:'Nome corrigido',unitId:ce,unitIds:[ce],allowDuplicateName:true})).status).toBe(201);
   const current=(await call('GET',`/teachers/${teacher}`)).body;expect((await call('PUT',`/teachers/${teacher}`,{...current,notes:'Atualização sem criar outra pessoa'})).status).toBe(200);
 });
 it('coordenador só lê e edita o perfil da sua unidade, mesmo em professor compartilhado',async()=>{
   await upsertUser(server.db,'coord@teste.com','Coordenação','senha-teste-segura');await server.db.query("UPDATE users SET role='coordenador',unit_id=$1 WHERE email='coord@teste.com'",[ce]);
   const login=await server.anonymous('POST','/auth/login',{email:'coord@teste.com',password:'senha-teste-segura'});const cookie=login.headers.get('set-cookie')!.split(';')[0];
   const coord=(method:string,path:string,body?:unknown)=>server.anonymous(method,path,body,{Cookie:cookie});
   const forbiddenRef=(await server.db.query<{id:number}>(`INSERT INTO payroll_references(unit_id,supplied_name,reference_items) VALUES($1,$2,$3::jsonb) RETURNING id`,[jp,'Referência exclusiva JP',JSON.stringify([{label:'Inglês',kind:'regular',weeklyLessons:2}])]))[0];
   expect((await coord('POST',`/payroll-references/${forbiddenRef.id}/create-teacher`,{confirmed:true})).status).toBe(403);
   const read=await coord('GET',`/teachers/${teacher}`);expect(read.body.payrollProfiles.map((p:any)=>p.unitId)).toEqual([ce]);
   expect((await coord('PUT',`/teachers/${teacher}/payroll`,{unitId:jp,references:[],regencies:[]})).status).toBe(403);
   expect((await coord('PUT',`/teachers/${teacher}/payroll`,{unitId:ce,references:[],regencies:[]})).status).toBe(200);
   const all=(await call('GET',`/teachers/${teacher}`)).body;expect(all.payrollProfiles.find((p:any)=>p.unitId===jp).regencies).toHaveLength(1);
 });
});
