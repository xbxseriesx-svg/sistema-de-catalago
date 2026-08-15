import { COMPANY_ID, SESSION_COOKIE, audit, body, clearSessionCookie, currentUser, ensureBase, fail, hashToken, ok, passwordRecord, randomToken, sessionCookie, uid, verifyPassword, type Env } from './util';

export async function authRoute(req:Request,env:Env,path:string){
  await ensureBase(env);
  if(path==='/api/auth/status'&&req.method==='GET'){
    const count=await env.DB.prepare("SELECT count(*) c FROM users WHERE role='SDM' AND status='active'").first();
    const user=await currentUser(req,env);
    return ok({needsBootstrap:Number(count?.c||0)===0,user:user?{id:user.id,companyId:user.company_id,email:user.email,name:user.name,role:user.role}:null});
  }
  if(path==='/api/auth/bootstrap'&&req.method==='POST'){
    const count=await env.DB.prepare("SELECT count(*) c FROM users WHERE role='SDM' AND status='active'").first();
    if(Number(count?.c||0)>0)return fail('O primeiro SDM já foi criado',409,'BOOTSTRAP_CLOSED');
    const input=await body(req);const token=String(input.token||'');const email=String(input.email||'').trim().toLowerCase();const name=String(input.name||'').trim();const password=String(input.password||'');
    if(!env.SDM_BOOTSTRAP_TOKEN||token!==env.SDM_BOOTSTRAP_TOKEN)return fail('Token de ativação inválido',403,'BAD_BOOTSTRAP_TOKEN');
    if(!email.includes('@')||name.length<2||password.length<10)return fail('Informe nome, e-mail e senha com pelo menos 10 caracteres');
    const pass=await passwordRecord(password);const id=uid('usr');
    await env.DB.prepare("INSERT INTO users (id,company_id,email,name,role,password_hash,password_salt,password_iterations,status) VALUES (?,?,?,?,?,?,?,?, 'active')").bind(id,COMPANY_ID,email,name,'SDM',pass.hash,pass.salt,pass.iterations).run();
    const session=await issueSession(req,env,id);const user={id,companyId:COMPANY_ID,email,name,role:'SDM'};await audit(env,{id,company_id:COMPANY_ID,email,name,role:'SDM',status:'active'},'bootstrap','user',id,{});
    return new Response(JSON.stringify({ok:true,user}),{headers:{'content-type':'application/json','set-cookie':sessionCookie(session)}});
  }
  if(path==='/api/auth/login'&&req.method==='POST'){
    const input=await body(req);const email=String(input.email||'').trim().toLowerCase();const password=String(input.password||'');const since="-15 minutes";
    const failures=await env.DB.prepare("SELECT count(*) c FROM auth_attempts WHERE email=? AND succeeded=0 AND created_at>datetime('now',?)").bind(email,since).first();
    if(Number(failures?.c||0)>=8)return fail('Muitas tentativas. Aguarde alguns minutos.',429,'RATE_LIMIT');
    const row=await env.DB.prepare("SELECT * FROM users WHERE company_id=? AND email=? AND status='active'").bind(COMPANY_ID,email).first() as any;
    const good=row?await verifyPassword(password,row.password_hash,row.password_salt,row.password_iterations):false;
    await env.DB.prepare("INSERT INTO auth_attempts (email,succeeded) VALUES (?,?)").bind(email,good?1:0).run();
    if(!good)return fail('E-mail ou senha inválidos',401,'BAD_CREDENTIALS');
    const session=await issueSession(req,env,row.id);await env.DB.prepare("UPDATE users SET last_login_at=datetime('now') WHERE id=?").bind(row.id).run();
    const user={id:row.id,companyId:row.company_id,email:row.email,name:row.name,role:row.role};await audit(env,row,'login','user',row.id,{});
    return new Response(JSON.stringify({ok:true,user}),{headers:{'content-type':'application/json','set-cookie':sessionCookie(session)}});
  }
  if(path==='/api/auth/logout'&&req.method==='POST'){
    const raw=req.headers.get('cookie')||'';const match=raw.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));if(match){await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await hashToken(decodeURIComponent(match[1]))).run();}
    return new Response(JSON.stringify({ok:true}),{headers:{'content-type':'application/json','set-cookie':clearSessionCookie()}});
  }
  return null;
}

async function issueSession(req:Request,env:Env,userId:string){const token=randomToken(32);const tokenHash=await hashToken(token);await env.DB.prepare("INSERT INTO sessions (token_hash,user_id,expires_at,user_agent) VALUES (?,?,datetime('now','+12 hours'),?)").bind(tokenHash,userId,req.headers.get('user-agent')||'').run();return token;}
