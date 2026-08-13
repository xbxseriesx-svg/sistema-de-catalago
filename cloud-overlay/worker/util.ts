export type Role = 'SDM'|'ADMIN'|'EDITOR'|'VIEWER';
export type Env = { DB:any; ASSETS:any; SDM_BOOTSTRAP_TOKEN?:string };
export type User = { id:string; company_id:string; email:string; name:string; role:Role; status:string };

export const COMPANY_ID='cmp_asteryon';
export const PAGE_ID='page_home';
export const SESSION_COOKIE='__Host-asteryon_session';

export function response(data:unknown,status=200,extra:Record<string,string>={}){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...extra}})}
export function ok(data:Record<string,unknown>={}){return response({ok:true,...data})}
export function fail(message:string,status=400,code='BAD_REQUEST'){return response({ok:false,error:{message,code}},status)}
export async function body(req:Request){try{return await req.json() as any}catch{return {}}}
export function uid(prefix='id'){return `${prefix}_${crypto.randomUUID()}`}
export function cookie(req:Request,name:string){const raw=req.headers.get('cookie')||'';for(const item of raw.split(';')){const [k,...v]=item.trim().split('=');if(k===name)return decodeURIComponent(v.join('='));}return null}
export function sessionCookie(token:string,maxAge=60*60*12){return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`}
export function clearSessionCookie(){return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`}

async function digestHex(input:string){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(input));return [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('')}
export async function hashToken(token:string){return digestHex(token)}
export function randomToken(bytes=32){const a=new Uint8Array(bytes);crypto.getRandomValues(a);return [...a].map(b=>b.toString(16).padStart(2,'0')).join('')}

export async function passwordRecord(password:string,saltHex?:string,iterations=100000){const salt=saltHex?Uint8Array.from(saltHex.match(/.{1,2}/g)!.map(x=>parseInt(x,16))):crypto.getRandomValues(new Uint8Array(16));const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);const bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt,iterations},key,256);const hash=[...new Uint8Array(bits)].map(b=>b.toString(16).padStart(2,'0')).join('');const saltOut=[...salt].map(b=>b.toString(16).padStart(2,'0')).join('');return {hash,salt:saltOut,iterations}}
export async function verifyPassword(password:string,hash:string,salt:string,iterations:number){const r=await passwordRecord(password,salt,iterations);if(r.hash.length!==hash.length)return false;let diff=0;for(let i=0;i<hash.length;i++)diff|=r.hash.charCodeAt(i)^hash.charCodeAt(i);return diff===0}

export async function ensureBase(env:Env){await env.DB.batch([
  env.DB.prepare("INSERT OR IGNORE INTO companies (id,name,slug,status) VALUES (?,?,?,'active')").bind(COMPANY_ID,'ASTERYON','asteryon'),
  env.DB.prepare("INSERT OR IGNORE INTO pages (id,company_id,slug,title,status) VALUES (?,?,?,?, 'draft')").bind(PAGE_ID,COMPANY_ID,'home','Página Inicial'),
  env.DB.prepare("INSERT OR IGNORE INTO page_drafts (page_id,payload_json,revision) VALUES (?,?,1)").bind(PAGE_ID,JSON.stringify([{id:'page-canvas-home',type:'page',name:'Página Inicial',x:0,y:0,width:1440,height:5200,rotation:0,zIndex:0,visible:true,locked:false,opacity:1,styles:{backgroundColor:'#ffffff'},props:{},children:[]}]))
]);}

export async function currentUser(req:Request,env:Env):Promise<User|null>{const token=cookie(req,SESSION_COOKIE);if(!token)return null;const tokenHash=await hashToken(token);const row=await env.DB.prepare("SELECT u.id,u.company_id,u.email,u.name,u.role,u.status FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>datetime('now') AND u.status='active'").bind(tokenHash).first();return row as User|null}
export function roleAllowed(role:Role,allowed:Role[]){return role==='SDM'||allowed.includes(role)}
export async function requireUser(req:Request,env:Env,roles:Role[]=['VIEWER','EDITOR','ADMIN']){const user=await currentUser(req,env);if(!user)return {error:fail('Sessão expirada ou inexistente',401,'UNAUTHENTICATED'),user:null};if(!roleAllowed(user.role,roles))return {error:fail('Permissão insuficiente',403,'FORBIDDEN'),user:null};return {error:null,user}}
export function requireSameOrigin(req:Request){if(['GET','HEAD','OPTIONS'].includes(req.method))return null;const origin=req.headers.get('origin');if(!origin)return null;return origin===new URL(req.url).origin?null:fail('Origem não autorizada',403,'ORIGIN');}
export async function audit(env:Env,user:User|null,action:string,entityType:string,entityId:string|null,details:unknown={}){await env.DB.prepare("INSERT INTO audit_logs (company_id,user_id,action,entity_type,entity_id,details_json) VALUES (?,?,?,?,?,?)").bind(user?.company_id||COMPANY_ID,user?.id||null,action,entityType,entityId,JSON.stringify(details)).run();}
export function securityHeaders(res:Response){const h=new Headers(res.headers);h.set('x-content-type-options','nosniff');h.set('referrer-policy','strict-origin-when-cross-origin');h.set('x-frame-options','DENY');h.set('permissions-policy','camera=(), microphone=(), geolocation=()');h.set('content-security-policy',"default-src 'self'; img-src 'self' data: https:; media-src 'self' https:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; font-src 'self' data: https:");return new Response(res.body,{status:res.status,statusText:res.statusText,headers:h})}
