import type { Env } from '../env';
import { ACCESS_COOKIE, COMPANY_ID, REFRESH_COOKIE } from '../env';
import { audit } from '../audit';
import { clean, cookie, fail, ok, requestBody } from '../http';
import { adminKey, supabase, table } from '../supabase';

export type Role = 'SDM' | 'ADMIN' | 'EDITOR' | 'VIEWER';

export type CurrentUser = {
  id: string;
  company_id: string;
  email: string | null;
  name: string | null;
  role: Role;
};

export type RefreshedSession = {
  request: Request;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};

function sessionHeaders(access: string, refresh: string, expiresIn = 3600) {
  const headers = new Headers({
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  headers.append(
    'set-cookie',
    `${ACCESS_COOKIE}=${encodeURIComponent(access)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${Math.max(60, expiresIn)}`,
  );
  headers.append(
    'set-cookie',
    `${REFRESH_COOKIE}=${encodeURIComponent(refresh)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000`,
  );
  return headers;
}

export function clearSessionHeaders() {
  const headers = new Headers({
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  headers.append('set-cookie', `${ACCESS_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);
  headers.append('set-cookie', `${REFRESH_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);
  return headers;
}

export function requestWithSession(req: Request, accessToken: string, refreshToken: string) {
  const headers = new Headers(req.headers);
  const existing = (headers.get('cookie') || '')
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => {
      const key = item.split('=', 1)[0];
      return key !== ACCESS_COOKIE && key !== REFRESH_COOKIE;
    });
  existing.push(`${ACCESS_COOKIE}=${encodeURIComponent(accessToken)}`);
  existing.push(`${REFRESH_COOKIE}=${encodeURIComponent(refreshToken)}`);
  headers.set('cookie', existing.join('; '));
  return new Request(req, { headers });
}

export function attachRefreshedSession(response: Response, session: RefreshedSession | null) {
  if (!session) return response;
  const headers = new Headers(response.headers);
  headers.append(
    'set-cookie',
    `${ACCESS_COOKIE}=${encodeURIComponent(session.accessToken)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${session.expiresIn}`,
  );
  headers.append(
    'set-cookie',
    `${REFRESH_COOKIE}=${encodeURIComponent(session.refreshToken)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000`,
  );
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export async function refreshSession(req: Request, env: Env): Promise<RefreshedSession | null> {
  const refreshToken = cookie(req, REFRESH_COOKIE);
  if (!refreshToken) return null;

  const response = await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_PUBLISHABLE_KEY,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!response.ok) return null;

  const session = await response.json() as any;
  const accessToken = clean(session?.access_token);
  const nextRefreshToken = clean(session?.refresh_token);
  const expiresIn = Math.max(60, Number(session?.expires_in) || 3600);
  if (!accessToken || !nextRefreshToken) return null;

  return {
    request: requestWithSession(req, accessToken, nextRefreshToken),
    accessToken,
    refreshToken: nextRefreshToken,
    expiresIn,
  };
}

export async function currentUserFromAccess(access: string, env: Env): Promise<CurrentUser | null> {
  try {
    const authUser = await supabase(env, '/auth/v1/user', {}, access) as any;
    const memberships = await table(
      env,
      'company_memberships',
      `user_id=eq.${encodeURIComponent(authUser.id)}&active=eq.true&select=company_id,role&limit=1`,
      {},
      access,
    ) as any[];
    const membership = memberships?.[0];
    if (!membership) return null;
    const profiles = await table(
      env,
      'profiles',
      `user_id=eq.${encodeURIComponent(authUser.id)}&select=display_name,email&limit=1`,
      {},
      access,
    ) as any[];
    return {
      id: authUser.id,
      company_id: membership.company_id,
      email: profiles?.[0]?.email || authUser.email || null,
      name: profiles?.[0]?.display_name || authUser.user_metadata?.display_name || authUser.email || null,
      role: membership.role === 'owner' ? 'SDM' : String(membership.role).toUpperCase() as Role,
    };
  } catch {
    return null;
  }
}

export async function currentUser(req: Request, env: Env) {
  const access = cookie(req, ACCESS_COOKIE);
  return access ? currentUserFromAccess(access, env) : null;
}

export async function requireUser(
  req: Request,
  env: Env,
  roles: Role[] = ['VIEWER', 'EDITOR', 'ADMIN'],
) {
  const user = await currentUser(req, env);
  if (!user) return { user: null, error: fail('Sessão expirada ou inexistente', 401, 'UNAUTHENTICATED') };
  if (user.role !== 'SDM' && !roles.includes(user.role)) {
    return { user: null, error: fail('Permissão insuficiente', 403, 'FORBIDDEN') };
  }
  return { user, error: null };
}

export async function companyMembership(req: Request, env: Env) {
  const access = cookie(req, ACCESS_COOKIE);
  if (!access) return null;
  const authHeaders = new Headers({
    apikey: env.SUPABASE_PUBLISHABLE_KEY,
    authorization: `Bearer ${access}`,
  });
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

export async function handleCoreAuth(req: Request, env: Env, path: string): Promise<Response | null> {
  if (path === '/api/auth/status' && req.method === 'GET') {
    const user = await currentUser(req, env);
    const owners = adminKey(env)
      ? await table(env, 'company_memberships', 'role=eq.owner&active=eq.true&select=user_id&limit=1') as any[]
      : [{ user_id: 'configured' }];
    return ok({
      needsBootstrap: !owners?.length,
      user: user ? {
        id: user.id,
        companyId: user.company_id,
        email: user.email,
        name: user.name,
        role: user.role,
      } : null,
    });
  }

  if (path === '/api/auth/bootstrap' && req.method === 'POST') {
    const owners = await table(
      env,
      'company_memberships',
      'role=eq.owner&active=eq.true&select=user_id&limit=1',
    ) as any[];
    if (owners?.length) return fail('O primeiro SDM já foi criado', 409, 'BOOTSTRAP_CLOSED');

    const input = await requestBody(req);
    if (!env.SDM_BOOTSTRAP_TOKEN || clean(input.token) !== env.SDM_BOOTSTRAP_TOKEN) {
      return fail('Token de ativação inválido', 403, 'BAD_BOOTSTRAP_TOKEN');
    }
    const email = clean(input.email).toLowerCase();
    const name = clean(input.name);
    const password = clean(input.password);
    if (!email.includes('@') || name.length < 2 || password.length < 10) {
      return fail('Informe nome, e-mail e senha com pelo menos 10 caracteres');
    }

    const created = await supabase(env, '/auth/v1/admin/users', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name: name },
      }),
    }) as any;

    await table(env, 'profiles', 'on_conflict=user_id', {
      method: 'POST',
      headers: { prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ user_id: created.id, email, display_name: name }),
    });
    await table(env, 'company_memberships', 'on_conflict=company_id,user_id', {
      method: 'POST',
      headers: { prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ company_id: COMPANY_ID, user_id: created.id, role: 'owner', active: true }),
    });
    await audit(env, { id: created.id, company_id: COMPANY_ID }, 'bootstrap', 'user', created.id);

    const sessionResponse = await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        apikey: env.SUPABASE_PUBLISHABLE_KEY,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });
    if (!sessionResponse.ok) return fail('Usuário criado, mas a sessão inicial falhou', 502, 'BOOTSTRAP_SESSION_FAILED');
    const session = await sessionResponse.json() as any;
    return new Response(JSON.stringify({
      ok: true,
      user: { id: created.id, companyId: COMPANY_ID, email, name, role: 'SDM' },
    }), { headers: sessionHeaders(session.access_token, session.refresh_token, session.expires_in) });
  }

  if (path === '/api/auth/login' && req.method === 'POST') {
    const input = await requestBody(req);
    const response = await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        apikey: env.SUPABASE_PUBLISHABLE_KEY,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        email: clean(input.email).toLowerCase(),
        password: clean(input.password),
      }),
    });
    if (!response.ok) return fail('E-mail ou senha inválidos', 401, 'BAD_CREDENTIALS');
    const session = await response.json() as any;
    if (!clean(session.access_token) || !clean(session.refresh_token)) {
      return fail('Resposta de autenticação inválida', 502, 'INVALID_AUTH_SESSION');
    }
    const user = await currentUserFromAccess(session.access_token, env);
    if (!user) return fail('Usuário sem acesso ativo à empresa', 403, 'NO_MEMBERSHIP');
    try {
      await audit(env, user, 'login', 'user', user.id, {}, session.access_token);
    } catch (error) {
      console.error('Falha ao registrar auditoria de login', error);
    }
    return new Response(JSON.stringify({
      ok: true,
      user: {
        id: user.id,
        companyId: user.company_id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    }), { headers: sessionHeaders(session.access_token, session.refresh_token, session.expires_in) });
  }

  if (path === '/api/auth/logout' && req.method === 'POST') {
    return new Response(JSON.stringify({ ok: true }), { headers: clearSessionHeaders() });
  }

  return null;
}
