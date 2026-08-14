import { audit, body, fail, ok, requireUser, uid, type Env } from './util';

const COMPANY_ID='cmp_asteryon';
const DEFAULT_FIELDS=['image','code','shortDescription','brand','category','price','unit'];
const ALLOWED_FIELDS=new Set(['image','code','shortDescription','longDescription','department','section','category','brand','price','unit','stock','ean','ncm','packaging','attributes']);

function parseJson(v:any,fallback:any){try{return JSON.parse(v||'')}catch{return fallback}}
function clean(v:any){return String(v??'').trim()}
function slug(v:any){return clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}
function normalizeDepartment(v:any){const key=slug(v);if(['atacado','atacadista','wholesale'].includes(key))return 'Atacado';if(['distribuicao','distribuidor','distribution'].includes(key))return 'Distribuição';return ''}
function activeStatus(v:any,fallback='draft'){const s=slug(v);if(['active','ativo','published','publicado'].includes(s))return 'active';if(['inactive','inativo','archived','arquivado'].includes(s))return 'inactive';if(['draft','rascunho'].includes(s))return 'draft';return fallback}

async function ensureCatalogSchema(env:Env){
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS catalog_settings (company_id TEXT PRIMARY KEY, display_fields_json TEXT NOT NULL DEFAULT '[\"image\",\"code\",\"shortDescription\",\"brand\",\"category\",\"price\",\"unit\"]', updated_at TEXT NOT NULL DEFAULT (datetime('now')))").run();
  await env.DB.prepare("INSERT OR IGNORE INTO catalog_settings (company_id) VALUES (?)").bind(COMPANY_ID).run();
  await env.DB.prepare("INSERT OR IGNORE INTO hierarchy_nodes (id,company_id,name,slug,level,parent_id,sort_order,status) VALUES ('dep_atacado',?,'Atacado','atacado','departamento',NULL,10,'active')").bind(COMPANY_ID).run();
  await env.DB.prepare("INSERT OR IGNORE INTO hierarchy_nodes (id,company_id,name,slug,level,parent_id,sort_order,status) VALUES ('dep_distribuicao',?,'Distribuição','distribuicao','departamento',NULL,20,'active')").bind(COMPANY_ID).run();
}

export async function catalogRoute(req:Request,env:Env,path:string){
  await ensureCatalogSchema(env);
  if(path==='/api/public/catalog'&&req.method==='GET')return catalog(env,true);
  if(path==='/api/admin/catalog'&&req.method==='GET'){const auth=await requireUser(req,env,['VIEWER','EDITOR','ADMIN']);if(auth.error)return auth.error;return catalog(env,false);}

  if(path==='/api/admin/catalog/settings'&&req.method==='PUT'){
    const auth=await requireUser(req,env,['ADMIN','EDITOR']);if(auth.error)return auth.error;const input=await body(req);const fields=Array.isArray(input.displayFields)?input.displayFields.map(clean).filter((v:string)=>ALLOWED_FIELDS.has(v)):[];const displayFields=fields.length?Array.from(new Set(fields)):DEFAULT_FIELDS;
    await env.DB.prepare("INSERT INTO catalog_settings (company_id,display_fields_json,updated_at) VALUES (?,?,datetime('now')) ON CONFLICT(company_id) DO UPDATE SET display_fields_json=excluded.display_fields_json,updated_at=datetime('now')").bind(auth.user!.company_id,JSON.stringify(displayFields)).run();
    await audit(env,auth.user,'catalog.settings','catalog',auth.user!.company_id,{displayFields});return ok({settings:{displayFields}});
  }

  if(path==='/api/admin/catalog/offers'&&req.method==='POST'){
    const auth=await requireUser(req,env,['ADMIN','EDITOR']);if(auth.error)return auth.error;return saveOffer(req,env,auth.user!,null);
  }
  if(path==='/api/admin/catalog/offers'&&req.method==='GET'){
    const auth=await requireUser(req,env,['VIEWER','EDITOR','ADMIN']);if(auth.error)return auth.error;return ok({offers:await readPromotions(env,false,auth.user!.company_id)});
  }
  const offerMatch=path.match(/^\/api\/admin\/catalog\/offers\/([^/]+)$/);
  if(offerMatch&&req.method==='PUT'){
    const auth=await requireUser(req,env,['ADMIN','EDITOR']);if(auth.error)return auth.error;return saveOffer(req,env,auth.user!,offerMatch[1]);
  }
  if(offerMatch&&req.method==='DELETE'){
    const auth=await requireUser(req,env,['ADMIN','EDITOR']);if(auth.error)return auth.error;const id=offerMatch[1];await env.DB.prepare("DELETE FROM promotion_products WHERE promotion_id=?").bind(id).run();await env.DB.prepare("DELETE FROM promotions WHERE id=? AND company_id=?").bind(id,auth.user!.company_id).run();await audit(env,auth.user,'offer.delete','promotion',id,{});return ok({id});
  }

  if(path==='/api/admin/catalog/products/bulk'&&req.method==='POST'){
    const auth=await requireUser(req,env,['EDITOR','ADMIN']);if(auth.error)return auth.error;const input=await body(req);const products=Array.isArray(input.products)?input.products.slice(0,5000):[];if(!products.length)return fail('Nenhum produto recebido');
    const companyId=auth.user!.company_id;const importId=uid('imp');let inserted=0,updated=0,ignored=0;const errors:string[]=[];
    const existingRows=await env.DB.prepare("SELECT id,code,status,data_json FROM products WHERE company_id=?").bind(companyId).all();const existing=new Map((existingRows.results||[]).map((r:any)=>[String(r.code),r]));
    const hierarchyRows=await env.DB.prepare("SELECT id,name,slug,level,parent_id FROM hierarchy_nodes WHERE company_id=?").bind(companyId).all();const nodeCache=new Map<string,any>();const nodeNameById=new Map<string,string>();for(const r of hierarchyRows.results||[]){nodeCache.set(`${r.level}:${r.parent_id||''}:${slug(r.name)}`,r);nodeNameById.set(String(r.id),String(r.name));}
    const brandRows=await env.DB.prepare("SELECT id,name,slug FROM brands WHERE company_id=?").bind(companyId).all();const brandCache=new Map((brandRows.results||[]).map((r:any)=>[slug(r.name),r]));

    const ensureNode=async(level:string,name:string,parentId:string|null,sortOrder=0)=>{const key=`${level}:${parentId||''}:${slug(name)}`;const found=nodeCache.get(key);if(found)return String(found.id);const id=uid('hier');const parentToken=parentId?slug(nodeNameById.get(parentId)||parentId):'';const storageSlug=level==='departamento'?slug(name):`${parentToken||'root'}--${slug(name)}`;try{await env.DB.prepare("INSERT INTO hierarchy_nodes (id,company_id,name,slug,level,parent_id,sort_order,status) VALUES (?,?,?,?,?,?,?,'active')").bind(id,companyId,name,storageSlug,level,parentId,sortOrder).run();}catch{const retry=await env.DB.prepare("SELECT id,name,slug,level,parent_id FROM hierarchy_nodes WHERE company_id=? AND level=? AND name=? AND COALESCE(parent_id,'')=COALESCE(?,'') LIMIT 1").bind(companyId,level,name,parentId).first<any>();if(retry){nodeCache.set(key,retry);nodeNameById.set(String(retry.id),String(retry.name));return String(retry.id)}throw new Error(`Não foi possível criar ${level}: ${name}`)}const row={id,name,slug:storageSlug,level,parent_id:parentId};nodeCache.set(key,row);nodeNameById.set(id,name);return id};
    const ensureBrand=async(name:string)=>{if(!name)return null;const key=slug(name);const found=brandCache.get(key);if(found)return String(found.id);const id=uid('brd');await env.DB.prepare("INSERT OR IGNORE INTO brands (id,company_id,name,slug,status) VALUES (?,?,?,?,'active')").bind(id,companyId,name,key).run();const row=await env.DB.prepare("SELECT id,name,slug FROM brands WHERE company_id=? AND slug=? LIMIT 1").bind(companyId,key).first<any>();if(row)brandCache.set(key,row);return String(row?.id||id)};

    for(let index=0;index<products.length;index++){
      const raw=products[index]||{};const p:any=raw;const code=clean(p.code??p.codigo);const name=clean(p.name??p.shortDescription??p.description??p.descricao);const department=normalizeDepartment(p.departamentoName??p.department??p.departamento);const section=clean(p.secaoName??p.section??p.secao);const category=clean(p.categoriaName??p.category??p.categoria);
      if(!code||!name||!department||!section||!category){ignored++;if(errors.length<30)errors.push(`Linha ${index+2}: ${!code?'Código; ':''}${!name?'Descrição; ':''}${!department?'Departamento deve ser Atacado ou Distribuição; ':''}${!section?'Seção; ':''}${!category?'Categoria; ':''}`.replace(/; $/,''));continue;}
      const depId=await ensureNode('departamento',department,null,department==='Atacado'?10:20);const secId=await ensureNode('secao',section,depId,100);const catId=await ensureNode('categoria',category,secId,100);const brandName=clean(p.brandName??p.brand??p.marca);const brandId=await ensureBrand(brandName);
      const previous=existing.get(code);const previousData=parseJson(previous?.data_json,{});const incoming={...p};const data:any={...previousData,...incoming,code,name,shortDescription:clean(p.shortDescription)||name,longDescription:clean(p.longDescription)||clean(previousData.longDescription)||name,departamentoId:depId,secaoId:secId,categoriaId:catId,departamentoName:department,secaoName:section,categoriaName:category,brandId,brandName:brandName||previousData.brandName||''};
      if(!clean(incoming.image)&&previousData.image)data.image=previousData.image;if((!Array.isArray(incoming.gallery)||!incoming.gallery.length)&&Array.isArray(previousData.gallery))data.gallery=previousData.gallery;
      const status=activeStatus(p.status,previous?.status||'active')==='active'?'active':'draft';const id=previous?.id||uid('prd');if(previous)updated++;else inserted++;
      await env.DB.prepare("INSERT INTO products (id,company_id,code,name,brand_id,category_id,status,data_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?, ?,datetime('now'),datetime('now')) ON CONFLICT(company_id,code) DO UPDATE SET name=excluded.name,brand_id=excluded.brand_id,category_id=excluded.category_id,status=excluded.status,data_json=excluded.data_json,updated_at=datetime('now')").bind(id,companyId,code,name,brandId,catId,status,JSON.stringify(data)).run();existing.set(code,{id,code,status,data_json:JSON.stringify(data)});
    }
    await env.DB.prepare("INSERT INTO imports (id,company_id,kind,filename,status,total_rows,inserted_rows,updated_rows,ignored_rows,error_rows,summary_json,finished_at) VALUES (?,?,?,?, 'completed',?,?,?,?,?,?,datetime('now'))").bind(importId,companyId,String(input.kind||'json'),String(input.filename||'importacao.json'),products.length,inserted,updated,ignored,ignored,JSON.stringify({source:'editor-v2.1',errors})).run();await audit(env,auth.user,'products.bulk','import',importId,{total:products.length,inserted,updated,ignored,errors});return ok({importId,total:products.length,inserted,updated,ignored,errors});
  }
  return null;
}

async function saveOffer(req:Request,env:Env,user:any,id:string|null){
  const input=await body(req);const title=clean(input.title)||'Vitrine de Ofertas';const description=clean(input.description);const requested=Array.isArray(input.productIds)?Array.from(new Set(input.productIds.map(clean).filter(Boolean))).slice(0,1500):[];const allProducts=await env.DB.prepare("SELECT id FROM products WHERE company_id=?").bind(user.company_id).all();const allowed=new Set((allProducts.results||[]).map((r:any)=>String(r.id)));const productIds=requested.filter((value:string)=>allowed.has(value));const status=['published','draft','archived'].includes(clean(input.status))?clean(input.status):'draft';const offerId=id||uid('promo');const data={displayFields:Array.isArray(input.displayFields)?input.displayFields:undefined};
  if(id){const exists=await env.DB.prepare("SELECT id FROM promotions WHERE id=? AND company_id=?").bind(id,user.company_id).first<any>();if(!exists)return fail('Oferta não encontrada',404,'NOT_FOUND');await env.DB.prepare("UPDATE promotions SET title=?,description=?,starts_at=?,ends_at=?,status=?,featured=?,data_json=?,updated_at=datetime('now') WHERE id=? AND company_id=?").bind(title,description,clean(input.startsAt)||null,clean(input.endsAt)||null,status,input.featured?1:0,JSON.stringify(data),id,user.company_id).run();}
  else await env.DB.prepare("INSERT INTO promotions (id,company_id,title,description,starts_at,ends_at,status,featured,data_json) VALUES (?,?,?,?,?,?,?,?,?)").bind(offerId,user.company_id,title,description,clean(input.startsAt)||null,clean(input.endsAt)||null,status,input.featured?1:0,JSON.stringify(data)).run();
  await env.DB.prepare("DELETE FROM promotion_products WHERE promotion_id=?").bind(offerId).run();for(let i=0;i<productIds.length;i+=100){const batch=productIds.slice(i,i+100).map((productId:string,offset:number)=>env.DB.prepare("INSERT OR IGNORE INTO promotion_products (promotion_id,product_id,sort_order) VALUES (?,?,?)").bind(offerId,productId,i+offset));if(batch.length)await env.DB.batch(batch)}await audit(env,user,id?'offer.update':'offer.create','promotion',offerId,{title,status,products:productIds.length});return ok({offer:{id:offerId,title,description,status,productIds}});
}

async function readPromotions(env:Env,publicOnly:boolean,companyId=COMPANY_ID){const promotions=await env.DB.prepare(publicOnly?"SELECT * FROM promotions WHERE company_id=? AND status='published' AND (starts_at IS NULL OR starts_at<=datetime('now')) AND (ends_at IS NULL OR ends_at>=datetime('now')) ORDER BY featured DESC,updated_at DESC":"SELECT * FROM promotions WHERE company_id=? ORDER BY updated_at DESC").bind(companyId).all();const ids=(promotions.results||[]).map((r:any)=>String(r.id));if(!ids.length)return [];const links=await env.DB.prepare("SELECT promotion_id,product_id,sort_order FROM promotion_products ORDER BY sort_order").all();const byPromotion=new Map<string,string[]>();for(const link of links.results||[]){if(!ids.includes(String(link.promotion_id)))continue;const list=byPromotion.get(String(link.promotion_id))||[];list.push(String(link.product_id));byPromotion.set(String(link.promotion_id),list)}return (promotions.results||[]).map((r:any)=>({...parseJson(r.data_json,{}),id:r.id,title:r.title,description:r.description,status:r.status,featured:Boolean(r.featured),startsAt:r.starts_at,endsAt:r.ends_at,productIds:byPromotion.get(String(r.id))||[]}))}

async function catalog(env:Env,publicOnly:boolean){
  const products=await env.DB.prepare(publicOnly?"SELECT * FROM products WHERE company_id=? AND status='active' ORDER BY name LIMIT 5000":"SELECT * FROM products WHERE company_id=? ORDER BY name LIMIT 5000").bind(COMPANY_ID).all();const brands=await env.DB.prepare("SELECT id,name,slug,status FROM brands WHERE company_id=? ORDER BY name").bind(COMPANY_ID).all();const distributions=await env.DB.prepare("SELECT id,name,slug,description,status FROM distributions WHERE company_id=? ORDER BY name").bind(COMPANY_ID).all();const hierarchy=await env.DB.prepare("SELECT id,name,slug,level,parent_id,sort_order,status FROM hierarchy_nodes WHERE company_id=? ORDER BY sort_order,name").bind(COMPANY_ID).all();const settingsRow=await env.DB.prepare("SELECT display_fields_json FROM catalog_settings WHERE company_id=?").bind(COMPANY_ID).first<any>();const settings={displayFields:parseJson(settingsRow?.display_fields_json,DEFAULT_FIELDS)};const promotions=await readPromotions(env,publicOnly,COMPANY_ID);
  return ok({catalog:{products:(products.results||[]).map((r:any)=>({...parseJson(r.data_json,{}),id:r.id,code:r.code,name:r.name,status:r.status==='active'?'ativo':'rascunho'})),brands:brands.results||[],distributions:distributions.results||[],hierarchy:(hierarchy.results||[]).map((r:any)=>({...r,parentId:r.parent_id,sortOrder:r.sort_order})),promotions,settings}})
}
