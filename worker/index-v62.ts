import imageWorker from './index-v61';

type Env = {
  ASSETS: Fetcher;
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  SUPABASE_SECRET_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SDM_BOOTSTRAP_TOKEN?: string;
};

function secure(response: Response) {
  const headers = new Headers(response.headers);
  headers.set('x-content-type-options', 'nosniff');
  headers.set('referrer-policy', 'strict-origin-when-cross-origin');
  headers.set('x-frame-options', 'DENY');
  headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=()');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === '/api/health' && ['GET', 'HEAD'].includes(req.method)) {
      const body = req.method === 'HEAD' ? null : JSON.stringify({
        ok: true,
        service: 'sistema-de-catalago',
        database: 'Supabase Postgres',
        storage: 'Supabase Storage',
        d1: false,
        r2: false,
        release: 'v62',
        editor: '2.1.62',
        architecture: 'GitHub → Supabase → Cloudflare',
      });
      return secure(new Response(body, {
        status: 200,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-store',
        },
      }));
    }
    return imageWorker.fetch(req, env);
  },
};
