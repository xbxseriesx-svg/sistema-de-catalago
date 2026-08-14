import { audit, body, ensureBase, fail, ok, requireUser, uid, type Env } from './util';

export async function pageRoute(req:Request,env:Env,path:string){
  await ensureBase(env);
  const pub=path.match(/^\/api\/public\/pages\/([^/]+)$/);
  if(pub&&req.method==='GET'){
    const slug=decodeURIComponent(pub[1]);const row=await env.DB.prepare("SELECT p.slug,p.title,p.published_version_id,v.version_number,v.payload_json,v.created_at FROM pages p LEFT JOIN page_versions v ON v.id=p.published_version_id WHERE p.company_id='cmp_asteryon' AND p.slug=?").bind(slug).first() as any;
    if(!row||!row.published_version_id)return fail('O site ainda não possui uma versão publicada',404,'NOT_PUBLISHED');
    return ok({page:{slug:row.slug,title:row.title,versionId:row.published_version_id,versionNumber:row.version_number,publishedAt:row.created_at,nodes:JSON.parse(row.payload_json)}});
  }
  const draft=path.match(/^\/api\/admin\/pages\/([^/]+)\/draft$/);
  if(draft){const auth=await requireUser(req,env,['EDITOR','ADMIN']);if(auth.error)return auth.error;const slug=decodeURIComponent(draft[1]);
    if(req.method==='GET'){const row=await env.DB.prepare("SELECT p.id,p.slug,p.title,p.published_version_id,d.payload_json,d.revision,d.updated_at FROM pages p JOIN page_drafts d ON d.page_id=p.id WHERE p.company_id=? AND p.slug=?").bind(auth.user!.company_id,slug).first() as any;if(!row)return fail('Página não encontrada',404);return ok({page:{id:row.id,slug:row.slug,title:row.title,nodes:JSON.parse(row.payload_json),revision:row.revision,updatedAt:row.updated_at,publishedVersionId:row.published_version_id}});}
    if(req.method==='PUT'){const input=await body(req);if(!Array.isArray(input.nodes))return fail('Documento inválido');const current=await env.DB.prepare("SELECT d.revision,p.id FROM pages p JOIN page_drafts d ON d.page_id=p.id WHERE p.company_id=? AND p.slug=?").bind(auth.user!.company_id,slug).first() as any;if(!current)return fail('Página não encontrada',404);if(input.expectedRevision!=null&&Number(input.expectedRevision)!==Number(current.revision))return fail('O rascunho foi alterado em outra sessão. Recarregue antes de salvar.',409,'REVISION_CONFLICT');const revision=Number(current.revision)+1;await env.DB.batch([env.DB.prepare("UPDATE page_drafts SET payload_json=?,revision=?,updated_by=?,updated_at=datetime('now') WHERE page_id=?").bind(JSON.stringify(input.nodes),revision,auth.user!.id,current.id),env.DB.prepare("UPDATE pages SET updated_by=?,updated_at=datetime('now') WHERE id=?").bind(auth.user!.id,current.id)]);await audit(env,auth.user,'draft.save','page',current.id,{revision});return ok({revision,savedAt:new Date().toISOString()});}
  }
  const publish=path.match(/^\/api\/admin\/pages\/([^/]+)\/publish$/);
  if(publish&&req.method==='POST'){const auth=await requireUser(req,env,['ADMIN']);if(auth.error)return auth.error;const slug=decodeURIComponent(publish[1]);const row=await env.DB.prepare("SELECT p.id,d.payload_json FROM pages p JOIN page_drafts d ON d.page_id=p.id WHERE p.company_id=? AND p.slug=?").bind(auth.user!.company_id,slug).first() as any;if(!row)return fail('Página não encontrada',404);const max=await env.DB.prepare('SELECT coalesce(max(version_number),0) n FROM page_versions WHERE page_id=?').bind(row.id).first() as any;const number=Number(max?.n||0)+1;const id=uid('ver');await env.DB.batch([env.DB.prepare("INSERT INTO page_versions (id,page_id,version_number,payload_json,label,source,created_by) VALUES (?,?,?,?,?,'publish',?)").bind(id,row.id,number,row.payload_json,`Publicação ${number}`,auth.user!.id),env.DB.prepare("UPDATE pages SET status='published',published_version_id=?,updated_by=?,updated_at=datetime('now') WHERE id=?").bind(id,auth.user!.id,row.id),env.DB.prepare("INSERT INTO editor_snapshots (id,page_id,label,payload_json,created_by) VALUES (?,?,?,?,?)").bind(uid('snap'),row.id,`Publicado v${number}`,row.payload_json,auth.user!.id)]);await audit(env,auth.user,'page.publish','page',row.id,{versionId:id,versionNumber:number});return ok({publication:{versionId:id,versionNumber:number,publishedAt:new Date().toISOString()}});}
  const snaps=path.match(/^\/api\/admin\/pages\/([^/]+)\/snapshots$/);
  if(snaps){const auth=await requireUser(req,env,['EDITOR','ADMIN']);if(auth.error)return auth.error;const page=await pageBySlug(env,auth.user!.company_id,decodeURIComponent(snaps[1]));if(!page)return fail('Página não encontrada',404);if(req.method==='GET'){const r=await env.DB.prepare("SELECT id,label,payload_json,created_at FROM editor_snapshots WHERE page_id=? ORDER BY created_at DESC LIMIT 30").bind(page.id).all();return ok({snapshots:(r.results||[]).map((x:any)=>({id:x.id,label:x.label,createdAt:x.created_at,nodes:JSON.parse(x.payload_json)}))});}if(req.method==='POST'){const input=await body(req);if(!Array.isArray(input.nodes))return fail('Snapshot inválido');const id=uid('snap');const label=String(input.label||'Ponto manual').slice(0,120);await env.DB.prepare("INSERT INTO editor_snapshots (id,page_id,label,payload_json,created_by) VALUES (?,?,?,?,?)").bind(id,page.id,label,JSON.stringify(input.nodes),auth.user!.id).run();await audit(env,auth.user,'snapshot.create','page',page.id,{snapshotId:id,label});return ok({snapshot:{id,label,createdAt:new Date().toISOString()}});}}
  const versions=path.match(/^\/api\/admin\/pages\/([^/]+)\/versions$/);if(versions&&req.method==='GET'){const auth=await requireUser(req,env,['VIEWER','EDITOR','ADMIN']);if(auth.error)return auth.error;const page=await pageBySlug(env,auth.user!.company_id,decodeURIComponent(versions[1]));if(!page)return fail('Página não encontrada',404);const r=await env.DB.prepare("SELECT id,version_number,label,source,created_at FROM page_versions WHERE page_id=? ORDER BY version_number DESC LIMIT 50").bind(page.id).all();return ok({publishedVersionId:page.published_version_id,versions:r.results||[]});}
  const rollback=path.match(/^\/api\/admin\/pages\/([^/]+)\/rollback\/([^/]+)$/);
  if(rollback&&req.method==='POST'){
    const auth=await requireUser(req,env,['ADMIN']);if(auth.error)return auth.error;
    const slug=decodeURIComponent(rollback[1]),versionId=decodeURIComponent(rollback[2]);
    const page=await pageBySlug(env,auth.user!.company_id,slug);if(!page)return fail('Página não encontrada',404);
    const version=await env.DB.prepare('SELECT id,version_number,payload_json FROM page_versions WHERE id=? AND page_id=?').bind(versionId,page.id).first() as any;
    if(!version)return fail('Versão não encontrada',404,'VERSION_NOT_FOUND');
    const draftRow=await env.DB.prepare('SELECT payload_json,revision FROM page_drafts WHERE page_id=?').bind(page.id).first() as any;
    if(!draftRow)return fail('Rascunho não encontrado',404,'DRAFT_NOT_FOUND');
    const revision=Number(draftRow.revision||0)+1;
    await env.DB.batch([
      env.DB.prepare("INSERT INTO editor_snapshots (id,page_id,label,payload_json,created_by) VALUES (?,?,?,?,?)").bind(uid('snap'),page.id,`Antes de restaurar v${version.version_number}`,draftRow.payload_json,auth.user!.id),
      env.DB.prepare("UPDATE page_drafts SET payload_json=?,revision=?,updated_by=?,updated_at=datetime('now') WHERE page_id=?").bind(version.payload_json,revision,auth.user!.id,page.id),
      env.DB.prepare("UPDATE pages SET updated_by=?,updated_at=datetime('now') WHERE id=?").bind(auth.user!.id,page.id)
    ]);
    await audit(env,auth.user,'page.rollback','page',page.id,{versionId,versionNumber:Number(version.version_number),revision});
    return ok({versionId,versionNumber:Number(version.version_number),revision,restoredAt:new Date().toISOString()});
  }
  return null;
}
async function pageBySlug(env:Env,companyId:string,slug:string){return env.DB.prepare('SELECT * FROM pages WHERE company_id=? AND slug=?').bind(companyId,slug).first() as Promise<any>}
