import { authRoute } from './auth';
import { pageRoute } from './pages';
import { templateRoute } from './templates';
import { catalogRoute } from './catalog';
import { managementRoute } from './management';
import { mediaRoute } from './media';
import { ensureBase, fail, ok, requireSameOrigin, securityHeaders, type Env } from './util';

export default {
  async fetch(req:Request,env:Env):Promise<Response>{
    try{
      const url=new URL(req.url);const path=url.pathname;
      if(path==='/api/health')return securityHeaders(ok({service:'sistema-de-catalago',database:'D1',r2:false,editor:'2.1',catalogFinalization:'v3'}));
      if(path.startsWith('/api/')){
        const originError=requireSameOrigin(req);if(originError)return securityHeaders(originError);
        await ensureBase(env);
        const handlers=[authRoute,pageRoute,templateRoute,mediaRoute,managementRoute,catalogRoute];
        for(const handler of handlers){const result=await handler(req,env,path);if(result)return securityHeaders(result);}
        return securityHeaders(fail('Rota não encontrada',404,'NOT_FOUND'));
      }
      return securityHeaders(await env.ASSETS.fetch(req));
    }catch(err){console.error(err);return securityHeaders(fail(err instanceof Error?err.message:'Erro interno',500,'INTERNAL_ERROR'));}
  }
};
