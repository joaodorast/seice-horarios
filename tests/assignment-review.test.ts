import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { startTestServer, type TestServer } from './helpers.js';
import { createRepository } from '../server/repository.js';
import { reviewAssignments } from '../shared/assignmentReview.js';
import { upsertUser } from '../server/auth.js';

describe('revisão das atribuições baseada na grade', () => {
  let s: TestServer, teacher: number, other: number, klass: number, subject: number, ce: number, jp: number;
  beforeEach(async () => {
    s = await startTestServer();
    await s.db.exec("DELETE FROM periods; INSERT INTO periods(shift,label,start_time,end_time,kind,sort_order) VALUES ('manha','1º tempo','07:30','08:20','aula',1),('manha','2º tempo','08:20','09:10','aula',2)");
    const units = (await s.call('GET','/units')).body;
    ce=units.find((u:any)=>u.code==='CE').id; jp=units.find((u:any)=>u.code==='JP').id;
    subject=(await s.call('POST','/subjects',{name:'Matemática',workloadKind:'technical'})).body.id;
    teacher=(await s.call('POST','/teachers',{name:'Professora da grade',unitId:ce,unitIds:[ce],subjectIds:[]})).body.id;
    other=(await s.call('POST','/teachers',{name:'Outro professor',unitId:ce,unitIds:[ce],subjectIds:[]})).body.id;
    klass=(await s.call('POST','/classes',{name:'1º Ano Fund I CE',grade:'Fundamental I',unitId:ce,shift:'manha'})).body.id;
    const lesson=await s.call('POST','/lessons',{teacherId:teacher,classId:klass,subjectId:subject,weekday:1,start:'07:30',end:'09:10',workloadKind:'technical'});
    expect(lesson.status).toBe(201);
  });
  afterEach(async () => s.close());
  async function data() {
    const repo=createRepository(s.db);
    return {teachers:await repo.listTeachers(),classes:await repo.listClasses(),subjects:await repo.listSubjects(),lessons:await repo.listLessons(),periods:await repo.listPeriods(),assignments:await repo.listAssignments()};
  }
  async function candidate() {return reviewAssignments(await data()).find(r=>r.classId===klass&&r.subjectId===subject)!;}
  function item(row:Awaited<ReturnType<typeof candidate>>,weeklyLessons=row.scheduled) {return {classId:row.classId,subjectId:row.subjectId,teacherId:row.teacherId,weeklyLessons,expected:row.expected};}
  async function protectedData() {return {lessons:await s.db.query('SELECT * FROM lessons ORDER BY id'),periods:await s.db.query('SELECT * FROM periods ORDER BY id'),settings:await s.db.query('SELECT * FROM settings ORDER BY key'),classes:await s.db.query('SELECT * FROM classes ORDER BY id'),subjects:await s.db.query('SELECT * FROM subjects ORDER BY id'),teachers:await s.db.query('SELECT * FROM teachers ORDER BY id')};}

  it('conta uma aula dupla como dois tempos e só confirma atribuições, preservando toda a base dos cálculos',async()=>{
    const before=await protectedData(),r=await candidate();
    expect(r).toMatchObject({status:'missing',scheduled:2,planned:null});
    expect((await s.call('GET','/assignments')).body).toHaveLength(0);
    const saved=await s.call('POST','/assignments/reconcile',{items:[item(r)]});
    expect(saved.status).toBe(200);expect(saved.body).toHaveLength(1);expect(saved.body[0]).toMatchObject({teacherId:teacher,classId:klass,subjectId:subject,weeklyLessons:2});
    expect(await protectedData()).toEqual(before);
    expect((await candidate()).status).toBe('complete');
    expect((await s.call('GET',`/teachers/${teacher}`)).body.subjectIds).toContain(subject);
  });
  it('permite corrigir a quantidade na revisão sem aumentar ou mudar as aulas existentes',async()=>{
    const before=await protectedData(),r=await candidate();
    expect((await s.call('POST','/assignments/reconcile',{items:[item(r,5)]})).status).toBe(200);
    expect(await protectedData()).toEqual(before);
    expect(await candidate()).toMatchObject({status:'different',scheduled:2,planned:5});
  });
  it('não troca a atribuição de outro professor',async()=>{
    await s.call('POST','/assignments/batch',{upserts:[{teacherId:other,classId:klass,subjectId:subject,weeklyLessons:4}]});
    const r=await candidate();expect(r.status).toBe('blocked');
    expect((await s.call('POST','/assignments/reconcile',{items:[item(r)]})).status).toBe(409);
    expect((await s.call('GET','/assignments')).body[0].teacherId).toBe(other);
  });
  it('bloqueia disciplinas com mais de um professor na grade',async()=>{
    expect((await s.call('POST','/lessons',{teacherId:other,classId:klass,subjectId:subject,weekday:2,start:'07:30',end:'08:20'})).status).toBe(201);
    expect(await candidate()).toMatchObject({status:'blocked',teacherId:null,scheduled:3});
  });
  it('recusa uma revisão antiga se as aulas ou as atribuições mudarem',async()=>{
    const r=await candidate();
    await s.call('POST','/assignments/batch',{upserts:[{teacherId:teacher,classId:klass,subjectId:subject,weeklyLessons:7}]});
    const response=await s.call('POST','/assignments/reconcile',{items:[item(r)]});
    expect(response.status).toBe(409);expect(response.body.error.code).toBe('stale');
    expect((await candidate()).planned).toBe(7);
    const r2=await candidate();
    await s.call('POST','/lessons',{teacherId:teacher,classId:klass,subjectId:subject,weekday:2,start:'07:30',end:'08:20'});
    expect((await s.call('POST','/assignments/reconcile',{items:[item(r2)]})).status).toBe(409);
  });
  it('desfaz o lote inteiro se uma das linhas mudou, sem duplicar ao confirmar novamente',async()=>{
    const r=await candidate();
    const subject2=(await s.call('POST','/subjects',{name:'Artes'})).body.id;
    await s.call('POST','/lessons',{teacherId:teacher,classId:klass,subjectId:subject2,weekday:2,start:'07:30',end:'08:20'});
    const second=reviewAssignments(await data()).find(x=>x.subjectId===subject2)!;
    const response=await s.call('POST','/assignments/reconcile',{items:[item(r),{...item(second),expected:'revisão antiga'}]});
    expect(response.status).toBe(409);expect((await s.call('GET','/assignments')).body).toHaveLength(0);
    const input={items:[item(r),item(second)]};expect((await s.call('POST','/assignments/reconcile',input)).status).toBe(200);
    expect((await s.call('POST','/assignments/reconcile',input)).status).toBe(409);expect((await s.call('GET','/assignments')).body).toHaveLength(2);
  });
  it('rejeita quantidades inválidas, professor inventado, linhas duplicadas e lote vazio',async()=>{
    const r=await candidate();
    for(const n of [0,41,1.5]) expect((await s.call('POST','/assignments/reconcile',{items:[item(r,n)]})).status).toBe(422);
    expect((await s.call('POST','/assignments/reconcile',{items:[]})).status).toBe(422);
    expect((await s.call('POST','/assignments/reconcile',{items:[item(r),item(r)]})).status).toBe(422);
    expect((await s.call('POST','/assignments/reconcile',{items:[{...item(r),teacherId:other}]})).status).toBe(409);
    expect((await s.call('GET','/assignments')).body).toHaveLength(0);
  });
  it('respeita a unidade e a coordenação mesmo com uma revisão copiada',async()=>{
    const user=await upsertUser(s.db,'coordenacao@example.invalid','Coordenação','senha-de-teste-123');
    await s.db.query("UPDATE users SET role='coordenador',unit_id=$1,class_scope=$2::jsonb WHERE id=$3",[jp,JSON.stringify([{segment:'fund1'}]),user.id]);
    const login=await s.anonymous('POST','/auth/login',{email:'coordenacao@example.invalid',password:'senha-de-teste-123'});
    const Cookie=login.headers.get('set-cookie')!.split(';')[0];
    expect((await s.anonymous('POST','/assignments/reconcile',{items:[item(await candidate())]},{Cookie})).status).toBe(403);
    await s.db.query('UPDATE users SET unit_id=$1,class_scope=$2::jsonb WHERE id=$3',[ce,JSON.stringify([{segment:'medio'}]),user.id]);
    expect((await s.anonymous('POST','/assignments/reconcile',{items:[item(await candidate())]},{Cookie})).status).toBe(403);
    expect((await s.call('GET','/assignments')).body).toHaveLength(0);
  });
});
