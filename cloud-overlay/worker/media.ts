import { audit, body, fail, ok, requireUser, uid, type Env } from './util';

const MAX_IMAGE_BYTES=8*1024*1024;
const MAX_VIDEO_BYTES=24*1024*1024;
const CHUNK_SIZE=440_000;
const IMAGE_KINDS=new Set(['product-image','brand-logo','brand-banner','marketing-banner','carousel-image','promotion-banner']);
const VIDEO_KINDS=new Set(['marketing-video','product-video','campaign-video']);
const REPLACE_KINDS=new Set(['product-image','brand-logo','brand-banner','marketing-banner','marketing-video','product-video','promotion-banner']);

function clean(value:unknown){return String(value??'').trim()}
function validKey(value:string){return /^[a-zA-Z0-9._:-]{1,180}$/.test(value)}
function bytesFromBase64(input:string){
  const normalized=input.includes(',')?input.slice(input.indexOf(',')+1):input;
  const binary=atob(normalized.replace(/\s/g,''));
  const out=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++)out[i]=binary.charCodeAt(i);
  return out;
}
async function sha256(bytes:Uint8Array){
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  return [...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join('');
}
async function deleteMedia(env:Env,key:string){
  await env.DB.prepare('DELETE FROM media_chunks WHERE media_key=?').bind(key).run();
  await env.DB.prepare('DELETE FROM media_objects WHERE media_key=?').bind(key).run();
}

export async function mediaRoute(req:Request,env:Env,path:string){
  const publicMatch=path.match(/^\/api\/public\/media\/([^/]+)$/);
  if(publicMatch&&req.method==='GET')return readMedia(env,decodeURIComponent(publicMatch[1]));

  if(path==='/api/admin/media'&&req.method==='POST'){
    const auth=await requireUser(req,env,['EDITOR','ADMIN']);if(auth.error)return auth.error;
    const input=await body(req);const kind=clean(input.kind);const entityKey=clean(input.entityKey)||null;const filename=clean(input.filename)||'arquivo';const contentType=clean(input.contentType).toLowerCase();const encoded=clean(input.dataBase64);
    if(!IMAGE_KINDS.has(kind)&&!VIDEO_KINDS.has(kind))return fail('Tipo de mídia não permitido',400,'MEDIA_KIND');
    if(entityKey&&!validKey(entityKey))return fail('Identificador da mídia inválido',400,'MEDIA_ENTITY');
    if(!encoded)return fail('Arquivo vazio',400,'MEDIA_EMPTY');
    if(IMAGE_KINDS.has(kind)&&!contentType.startsWith('image/'))return fail('Este campo aceita apenas imagem',400,'MEDIA_TYPE');
    if(VIDEO_KINDS.has(kind)&&!contentType.startsWith('video/'))return fail('Este campo aceita apenas vídeo',400,'MEDIA_TYPE');
    let bytes:Uint8Array;try{bytes=bytesFromBase64(encoded)}catch{return fail('Arquivo codificado inválido',400,'MEDIA_BASE64')}
    const max=VIDEO_KINDS.has(kind)?MAX_VIDEO_BYTES:MAX_IMAGE_BYTES;if(bytes.byteLength>max)return fail(`Arquivo excede ${Math.round(max/1024/1024)} MB`,413,'MEDIA_TOO_LARGE');
    const hash=await sha256(bytes);const companyId=auth.user!.company_id;
    const existing=await env.DB.prepare("SELECT media_key FROM media_objects WHERE company_id=? AND kind=? AND COALESCE(entity_key,'')=COALESCE(?,'') AND sha256=? LIMIT 1").bind(companyId,kind,entityKey,hash).first<any>();
    if(existing?.media_key)return ok({mediaKey:String(existing.media_key),url:`/api/public/media/${encodeURIComponent(String(existing.media_key))}`,deduplicated:true,byteSize:bytes.byteLength});
    const key=uid('med');
    for(let offset=0,chunkNo=0;offset<bytes.length;offset+=CHUNK_SIZE,chunkNo++){
      const chunk=bytes.slice(offset,Math.min(bytes.length,offset+CHUNK_SIZE));
      await env.DB.prepare('INSERT INTO media_chunks (media_key,chunk_no,bytes) VALUES (?,?,?)').bind(key,chunkNo,chunk.buffer).run();
    }
    await env.DB.prepare("INSERT INTO media_objects (media_key,company_id,kind,entity_key,filename,content_type,byte_size,sha256) VALUES (?,?,?,?,?,?,?,?)").bind(key,companyId,kind,entityKey,filename,contentType,bytes.byteLength,hash).run();
    if(REPLACE_KINDS.has(kind)&&entityKey){
      const old=await env.DB.prepare('SELECT media_key FROM media_objects WHERE company_id=? AND kind=? AND entity_key=? AND media_key<>?').bind(companyId,kind,entityKey,key).all();
      for(const row of old.results||[])await deleteMedia(env,String((row as any).media_key));
    }
    await audit(env,auth.user,'media.upload','media',key,{kind,entityKey,filename,contentType,byteSize:bytes.byteLength,sha256:hash});
    return ok({mediaKey:key,url:`/api/public/media/${encodeURIComponent(key)}`,deduplicated:false,byteSize:bytes.byteLength});
  }

  const deleteMatch=path.match(/^\/api\/admin\/media\/([^/]+)$/);
  if(deleteMatch&&req.method==='DELETE'){
    const auth=await requireUser(req,env,['EDITOR','ADMIN']);if(auth.error)return auth.error;const key=decodeURIComponent(deleteMatch[1]);
    const row=await env.DB.prepare('SELECT media_key,company_id,kind,entity_key FROM media_objects WHERE media_key=?').bind(key).first<any>();if(!row||row.company_id!==auth.user!.company_id)return fail('Mídia não encontrada',404,'NOT_FOUND');
    await deleteMedia(env,key);await audit(env,auth.user,'media.delete','media',key,{kind:row.kind,entityKey:row.entity_key});return ok({mediaKey:key});
  }
  return null;
}

async function readMedia(env:Env,key:string){
  const meta=await env.DB.prepare('SELECT filename,content_type,byte_size,sha256 FROM media_objects WHERE media_key=?').bind(key).first<any>();if(!meta)return fail('Mídia não encontrada',404,'NOT_FOUND');
  const rows=await env.DB.prepare('SELECT bytes FROM media_chunks WHERE media_key=? ORDER BY chunk_no').bind(key).all();const parts=(rows.results||[]).map((r:any)=>new Uint8Array(r.bytes as ArrayBuffer));const total=parts.reduce((sum,p)=>sum+p.byteLength,0);if(total!==Number(meta.byte_size))return fail('Mídia incompleta',500,'MEDIA_CORRUPT');
  const output=new Uint8Array(total);let offset=0;for(const part of parts){output.set(part,offset);offset+=part.byteLength}
  return new Response(output,{status:200,headers:{'content-type':String(meta.content_type||'application/octet-stream'),'content-length':String(total),'cache-control':'public, max-age=31536000, immutable','etag':`"${meta.sha256}"`,'content-disposition':`inline; filename*=UTF-8''${encodeURIComponent(String(meta.filename||'arquivo'))}`}});
}
