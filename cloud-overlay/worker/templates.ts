import { audit, body, fail, ok, requireUser, uid, type Env } from './util';

export async function templateRoute(req:Request,env:Env,path:string){
  if(path==='/api/admin/templates'&&req.method==='GET'){
    const auth=await requireUser(req,env,['VIEWER','EDITOR','ADMIN']);if(auth.error)return auth.error;
    const r=await env.DB.prepare("SELECT * FROM templates WHERE company_id=? AND deleted_at IS NULL ORDER BY is_system DESC,updated_at DESC").bind(auth.user!.company_id).all();
    return ok({templates:(r.results||[]).map((x:any)=>({id:x.id,systemKey:x.system_key,name:x.name,description:x.description,category:x.category,tags:JSON.parse(x.tags_json||'[]'),accent:x.accent,nodes:JSON.parse(x.payload_json),isSystem:!!x.is_system,version:x.version,updatedAt:x.updated_at}))});
  }
  if(path==='/api/admin/templates/seed'&&req.method==='POST'){
    const auth=await requireUser(req,env,['ADMIN']);if(auth.error)return auth.error;if(auth.user!.role!=='SDM')return fail('Somente o SDM pode administrar os modelos globais',403,'SDM_ONLY');
    const input=await body(req);const templates=Array.isArray(input.templates)?input.templates.slice(0,30):[];const statements=[];
    for(const t of templates){const systemKey=String(t.systemKey||'').slice(0,80);if(!systemKey||!Array.isArray(t.nodes))continue;statements.push(env.DB.prepare("INSERT INTO templates (id,company_id,system_key,name,description,category,tags_json,accent,payload_json,is_system,created_by,updated_by) VALUES (?,?,?,?,?,?,?,?,?,1,?,?) ON CONFLICT(company_id,system_key) DO NOTHING").bind(uid('tpl'),auth.user!.company_id,systemKey,String(t.name||'Modelo'),String(t.description||''),String(t.category||'geral'),JSON.stringify(t.tags||[]),String(t.accent||''),JSON.stringify(t.nodes),auth.user!.id,auth.user!.id));}
    if(statements.length)await env.DB.batch(statements);await audit(env,auth.user,'template.seed','template',null,{requested:templates.length});return ok({requested:templates.length});
  }
  const item=path.match(/^\/api\/admin\/templates\/([^/]+)$/);if(!item)return null;const auth=await requireUser(req,env,['ADMIN']);if(auth.error)return auth.error;if(auth.user!.role!=='SDM')return fail('Somente o SDM pode alterar ou excluir modelos',403,'SDM_ONLY');const id=decodeURIComponent(item[1]);const current=await env.DB.prepare("SELECT * FROM templates WHERE id=? AND company_id=? AND deleted_at IS NULL").bind(id,auth.user!.company_id).first() as any;if(!current)return fail('Modelo não encontrado',404);
  if(req.method==='PUT'){const input=await body(req);const nextVersion=Number(current.version||1)+1;const nodes=Array.isArray(input.nodes)?input.nodes:JSON.parse(current.payload_json);await env.DB.batch([env.DB.prepare("INSERT INTO template_versions (id,template_id,version,payload_json,changed_by) VALUES (?,?,?,?,?)").bind(uid('tpv'),id,current.version,current.payload_json,auth.user!.id),env.DB.prepare("UPDATE templates SET name=?,description=?,category=?,tags_json=?,accent=?,payload_json=?,version=?,updated_by=?,updated_at=datetime('now') WHERE id=?").bind(String(input.name??current.name),String(input.description??current.description),String(input.category??current.category),JSON.stringify(input.tags??JSON.parse(current.tags_json||'[]')),String(input.accent??current.accent??''),JSON.stringify(nodes),nextVersion,auth.user!.id,id)]);await audit(env,auth.user,'template.update','template',id,{version:nextVersion});return ok({id,version:nextVersion});}
  if(req.method==='DELETE'){await env.DB.prepare("UPDATE templates SET deleted_at=datetime('now'),updated_by=? WHERE id=?").bind(auth.user!.id,id).run();await audit(env,auth.user,'template.delete','template',id,{});return ok();}
  return null;
}
