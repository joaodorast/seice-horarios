import type { Router, Response } from 'express';
import type { Database, Row } from './db.js';
import { academicRuleSchema, type AcademicRule } from '../shared/academicRules.js';
export function installAcademicRules(api:Router,db:Database,access:{visible:(res:Response)=>number[]|null;assert:(res:Response,unitId:number)=>void;error:(status:number,code:string,message:string)=>Error}) {
 const map=(r:Row):AcademicRule=>({id:Number(r.id),unitId:Number(r.unit_id),year:Number(r.year),scope:r.scope as AcademicRule['scope'],segment:r.segment as AcademicRule['segment'],classId:r.class_id===null?null:Number(r.class_id),values:r.values as AcademicRule['values'],updatedAt:new Date(r.updated_at as string).toISOString()});
 const fail=(status:number,code:string,message:string)=>access.error(status,code,message);
 api.get('/academic-rules',async(_req,res)=>{const allowed=access.visible(res);const rows=await db.query('SELECT * FROM academic_rules WHERE ($1::int[] IS NULL OR unit_id=ANY($1::int[])) ORDER BY year DESC,unit_id,scope,id',[allowed]);res.json(rows.map(map));});
 api.put('/academic-rules',async(req,res)=>{
  const parsed=academicRuleSchema.safeParse(req.body);if(!parsed.success)throw fail(422,'validation',parsed.error.issues[0].message);
  const input=parsed.data;access.assert(res,input.unitId);
  const saved=await db.transaction(async tx=>{
   await tx.query('SELECT pg_advisory_xact_lock($1)',[1578950657]);
   if(!(await tx.query('SELECT id FROM units WHERE id=$1',[input.unitId])).length)throw fail(404,'not_found','Unidade não encontrada.');
   if(input.scope==='class'&&!(await tx.query('SELECT id FROM classes WHERE id=$1 AND unit_id=$2',[input.classId,input.unitId])).length)throw fail(422,'wrong_unit','A turma não pertence à unidade escolhida.');
   if(input.scope!=='unit'&&!(await tx.query("SELECT id FROM academic_rules WHERE unit_id=$1 AND year=$2 AND scope='unit'",[input.unitId,input.year])).length)throw fail(422,'base_required','Salve primeiro o padrão da unidade para este ano.');
   const [existing]=await tx.query("SELECT * FROM academic_rules WHERE unit_id=$1 AND year=$2 AND scope=$3 AND class_id IS NOT DISTINCT FROM $4::int AND ($3='class' OR segment IS NOT DISTINCT FROM $5::text)",[input.unitId,input.year,input.scope,input.classId,input.segment]);
   if(input.expectedUpdatedAt!==undefined&&(existing?new Date(existing.updated_at as string).toISOString():null)!==input.expectedUpdatedAt)throw fail(409,'stale_rule','Esta regra foi alterada em outra tela. Reabra a configuração para ver os dados atuais.');
   if(existing){const [row]=await tx.query("UPDATE academic_rules SET segment=$1,values=$2::jsonb,updated_at=GREATEST(clock_timestamp(),updated_at + interval '1 millisecond') WHERE id=$3 RETURNING *",[input.segment,JSON.stringify(input.values),existing.id]);return map(row);}
   const [row]=await tx.query('INSERT INTO academic_rules(unit_id,year,scope,segment,class_id,values) VALUES($1,$2,$3,$4,$5,$6::jsonb) RETURNING *',[input.unitId,input.year,input.scope,input.segment,input.classId,JSON.stringify(input.values)]);return map(row);
  });res.json(saved);
 });
 api.delete('/academic-rules/:id',async(req,res)=>{
  const id=Number(req.params.id);if(!Number.isInteger(id)||id<1)throw fail(422,'validation','Regra inválida.');
  await db.transaction(async tx=>{await tx.query('SELECT pg_advisory_xact_lock($1)',[1578950657]);const [row]=await tx.query('SELECT * FROM academic_rules WHERE id=$1',[id]);if(!row)throw fail(404,'not_found','Regra não encontrada.');access.assert(res,Number(row.unit_id));if(row.scope==='unit'&&(await tx.query("SELECT id FROM academic_rules WHERE unit_id=$1 AND year=$2 AND scope<>'unit'",[row.unit_id,row.year])).length)throw fail(409,'rule_in_use','Remova as personalizações antes de apagar o padrão da unidade.');await tx.query('DELETE FROM academic_rules WHERE id=$1',[id]);});res.json({saved:true});
 });
}
