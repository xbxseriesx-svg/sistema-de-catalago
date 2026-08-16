import worker from './index-v71';

type Env = {
  ASSETS: Fetcher;
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  SUPABASE_SECRET_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SDM_BOOTSTRAP_TOKEN?: string;
  GOOGLE_CSE_API_KEY?: string;
  GOOGLE_CSE_CX?: string;
};

const COMPANY_ID = 'cmp_asteryon';
const ACCESS_COOKIE = '__Host-asteryon_access';

const clean = (value: unknown) => String(value ?? '').trim();
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});
const ok = (data: Record<string, unknown> = {}) => json({ ok: true, ...data });
const fail = (message: string, status = 400, code = 'BAD_REQUEST') => json({ ok: false, error: { message, code } }, status);

function secure(response: Response) {
  const headers = new Headers(response.headers);
  headers.set('x-content-type-options', 'nosniff');
  headers.set('referrer-policy', 'strict-origin-when-cross-origin');
  headers.set('x-frame-options', 'DENY');
  headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=()');
  headers.set('strict-transport-security', 'max-age=31536000; includeSubDomains');
  headers.set(
    'content-security-policy',
    "default-src 'self'; img-src 'self' data: blob: https:; media-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; script-src 'self'; connect-src 'self'; font-src 'self' data: https://fonts.gstatic.com; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'",
  );
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function cookie(req: Request, name: string) {
  try {
    for (const item of (req.headers.get('cookie') || '').split(';')) {
      const [key, ...parts] = item.trim().split('=');
      if (key === name) return decodeURIComponent(parts.join('='));
    }
  } catch {
    return null;
  }
  return null;
}

function secret(env: Env) {
  return clean(env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY);
}

function adminHeaders(env: Env) {
  const key = secret(env);
  if (!key) throw new Error('SUPABASE_SECRET_KEY não configurada');
  const headers = new Headers({ apikey: key });
  if (!key.startsWith('sb_secret_')) headers.set('authorization', `Bearer ${key}`);
  return headers;
}

async function rest(env: Env, table: string, query: string) {
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}?${query}`, { headers: adminHeaders(env) });
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${(await response.text()).slice(0, 300)}`);
  return response.json() as Promise<any[]>;
}

function brandDto(row: any) {
  const data = row?.data && typeof row.data === 'object' ? row.data : {};
  return {
    ...data,
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description ?? data.description ?? null,
    website: row.website ?? data.website ?? null,
    logoUrl: row.logo_url ?? data.logoUrl ?? data.logo_url ?? null,
    bannerUrl: row.banner_url ?? data.bannerUrl ?? data.banner_url ?? null,
    sortOrder: Number(row.sort_order ?? data.sortOrder ?? 0),
    featured: !!(row.featured ?? data.featured),
    status: row.active ? 'active' : 'inactive',
  };
}

async function canonicalBrands(env: Env, publicOnly: boolean) {
  const rows = await rest(
    env,
    'brands',
    `company_id=eq.${COMPANY_ID}${publicOnly ? '&active=eq.true' : ''}&select=id,name,slug,description,website,logo_url,banner_url,sort_order,active,featured,data&order=sort_order.asc,name.asc`,
  );
  return rows.map(brandDto);
}

function liveOffer(item: any, now = Date.now()) {
  if (String(item?.status || '').toLowerCase() !== 'published') return false;
  const starts = item?.startsAt ?? item?.starts_at;
  const ends = item?.endsAt ?? item?.ends_at;
  if (starts && Number.isFinite(Date.parse(starts)) && Date.parse(starts) > now) return false;
  if (ends && Number.isFinite(Date.parse(ends)) && Date.parse(ends) < now) return false;
  return true;
}

async function companyMembership(req: Request, env: Env) {
  const access = cookie(req, ACCESS_COOKIE);
  if (!access) return null;
  const authHeaders = new Headers({ apikey: env.SUPABASE_PUBLISHABLE_KEY, authorization: `Bearer ${access}` });
  const userResponse = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, { headers: authHeaders });
  if (!userResponse.ok) return null;
  const user = await userResponse.json() as any;
  if (!clean(user?.id)) return null;
  const membershipResponse = await fetch(
    `${env.SUPABASE_URL}/rest/v1/company_memberships?company_id=eq.${COMPANY_ID}&user_id=eq.${encodeURIComponent(user.id)}&active=eq.true&select=company_id,role&limit=1`,
    { headers: authHeaders },
  );
  if (!membershipResponse.ok) return null;
  const memberships = await membershipResponse.json() as any[];
  return memberships?.[0] ? { user, membership: memberships[0] } : null;
}

async function scopedWriteExists(path: string, method: string, env: Env) {
  if (!['PUT', 'DELETE', 'PATCH'].includes(method)) return true;
  const routes: Array<[RegExp, string]> = [
    [/^\/api\/admin\/brands\/([^/]+)$/, 'brands'],
    [/^\/api\/admin\/hierarchy\/([^/]+)$/, 'hierarchy_nodes'],
    [/^\/api\/admin\/products\/([^/]+)$/, 'products'],
    [/^\/api\/admin\/media\/([^/]+)$/, 'media_assets'],
    [/^\/api\/admin\/templates\/([^/]+)$/, 'templates'],
    [/^\/api\/admin\/catalog\/offers\/([^/]+)$/, 'offers'],
  ];
  for (const [pattern, table] of routes) {
    const match = path.match(pattern);
    if (!match) continue;
    const id = encodeURIComponent(decodeURIComponent(match[1]));
    const rows = await rest(env, table, `id=eq.${id}&company_id=eq.${COMPANY_ID}&select=id&limit=1`);
    return !!rows.length;
  }
  return true;
}

async function enrichCatalogResponse(response: Response, env: Env, publicOnly: boolean) {
  if (!response.ok) return response;
  const payload = await response.json().catch(() => null) as any;
  if (!payload?.ok || !payload?.catalog) return json(payload ?? { ok: false }, response.status);
  const catalog = payload.catalog;
  catalog.brands = await canonicalBrands(env, publicOnly);
  if (publicOnly) {
    if (Array.isArray(catalog.hierarchy)) catalog.hierarchy = catalog.hierarchy.filter((item: any) => item?.status !== 'inactive');
    if (Array.isArray(catalog.promotions)) catalog.promotions = catalog.promotions.filter((item: any) => liveOffer(item));
  }
  return ok({ catalog });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(req.url);
      const path = url.pathname;

      if (path === '/api/health') {
        return secure(ok({ service: 'sistema-de-catalago', version: 'V81', database: 'Supabase Postgres', storage: 'Supabase Storage', d1: false }));
      }

      if (path.startsWith('/api/admin/')) {
        const membership = await companyMembership(req, env);
        if (!membership) return secure(fail('Sessão sem acesso ativo a esta empresa', 403, 'COMPANY_FORBIDDEN'));
        if (!(await scopedWriteExists(path, req.method, env))) return secure(fail('Registro não encontrado nesta empresa', 404, 'NOT_FOUND'));
      }

      if (path === '/api/public/brands' && req.method === 'GET') {
        return secure(ok({ brands: await canonicalBrands(env, true) }));
      }

      if (path === '/api/admin/brands' && req.method === 'GET') {
        return secure(ok({ brands: await canonicalBrands(env, false) }));
      }

      if (path === '/api/public/catalog' && req.method === 'GET') {
        const base = await worker.fetch(req, env as any);
        return secure(await enrichCatalogResponse(base, env, true));
      }

      if (path === '/api/admin/catalog' && req.method === 'GET') {
        const base = await worker.fetch(req, env as any);
        return secure(await enrichCatalogResponse(base, env, false));
      }

      return secure(await worker.fetch(req, env as any));
    } catch (error) {
      console.error('V81 Worker error', error);
      return secure(fail('Falha interna ao executar a operação', 500, 'INTERNAL'));
    }
  },
};
