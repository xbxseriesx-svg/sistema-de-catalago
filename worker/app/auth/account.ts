import type { Env } from '../env';
import { ACCESS_COOKIE, REFRESH_COOKIE } from '../env';
import { clean, cookie, fail, ok, requestBody, sameOrigin } from '../http';

function sessionResponse(
  data: Record<string, unknown>,
  accessToken: string,
  refreshToken: string,
  expiresIn: number,
) {
  const headers = new Headers({
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  headers.append(
    'set-cookie',
    `${ACCESS_COOKIE}=${encodeURIComponent(accessToken)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${Math.max(60, expiresIn || 3600)}`,
  );
  if (refreshToken) {
    headers.append(
      'set-cookie',
      `${REFRESH_COOKIE}=${encodeURIComponent(refreshToken)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000`,
    );
  }
  return new Response(JSON.stringify({ ok: true, ...data }), { status: 200, headers });
}

async function authUser(env: Env, accessToken: string) {
  const response = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: env.SUPABASE_PUBLISHABLE_KEY,
      authorization: `Bearer ${accessToken}`,
    },
  });
  if (!response.ok) return null;
  const user = await response.json() as any;
  return clean(user?.id) ? user : null;
}

async function acceptSession(req: Request, env: Env) {
  if (!sameOrigin(req)) return fail('Origem não autorizada', 403, 'ORIGIN');
  const input = await requestBody(req);
  const accessToken = clean(input.accessToken);
  const refreshToken = clean(input.refreshToken);
  const expiresIn = Math.max(60, Number(input.expiresIn) || 3600);
  if (!accessToken) return fail('Link de autenticação sem sessão válida', 400, 'MISSING_ACCESS_TOKEN');

  const user = await authUser(env, accessToken);
  if (!user) return fail('O link expirou ou a sessão não é mais válida', 401, 'INVALID_AUTH_LINK');

  return sessionResponse({
    user: { id: user.id, email: clean(user.email) || null },
    type: clean(input.type) || null,
  }, accessToken, refreshToken, expiresIn);
}

async function accountStatus(req: Request, env: Env) {
  const accessToken = cookie(req, ACCESS_COOKIE);
  if (!accessToken) return ok({ authenticated: false, user: null });
  const user = await authUser(env, accessToken);
  if (!user) return ok({ authenticated: false, user: null });
  return ok({ authenticated: true, user: { id: user.id, email: clean(user.email) || null } });
}

async function requestRecovery(req: Request, env: Env) {
  if (!sameOrigin(req)) return fail('Origem não autorizada', 403, 'ORIGIN');
  const input = await requestBody(req);
  const email = clean(input.email).toLowerCase();
  if (!email || !email.includes('@')) return fail('Informe um e-mail válido', 400, 'INVALID_EMAIL');

  const redirectTo = `${new URL(req.url).origin}/auth/redefinir-senha.html`;
  const response = await fetch(
    `${env.SUPABASE_URL}/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`,
    {
      method: 'POST',
      headers: {
        apikey: env.SUPABASE_PUBLISHABLE_KEY,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ email }),
    },
  );

  if (response.status === 429) {
    return fail('Aguarde um pouco antes de solicitar outro e-mail de recuperação', 429, 'RECOVERY_RATE_LIMIT');
  }
  if (!response.ok) {
    console.error('Falha ao solicitar recuperação no Supabase', response.status, (await response.text()).slice(0, 300));
    return fail('Não foi possível enviar o e-mail de recuperação agora', 502, 'RECOVERY_SEND_FAILED');
  }

  return ok({ message: 'Se existir uma conta para este e-mail, enviaremos um link para redefinir a senha.' });
}

async function updatePassword(req: Request, env: Env) {
  if (!sameOrigin(req)) return fail('Origem não autorizada', 403, 'ORIGIN');
  const accessToken = cookie(req, ACCESS_COOKIE);
  if (!accessToken) {
    return fail(
      'Abra primeiro o link de confirmação ou recuperação enviado por e-mail',
      401,
      'RECOVERY_SESSION_REQUIRED',
    );
  }

  const input = await requestBody(req);
  const password = clean(input.password);
  if (password.length < 10) {
    return fail('A nova senha precisa ter pelo menos 10 caracteres', 400, 'WEAK_PASSWORD');
  }

  const current = await authUser(env, accessToken);
  if (!current) {
    return fail('Sua sessão de recuperação expirou. Solicite um novo link.', 401, 'RECOVERY_SESSION_EXPIRED');
  }

  const response = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    method: 'PUT',
    headers: {
      apikey: env.SUPABASE_PUBLISHABLE_KEY,
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ password }),
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    console.error('Falha ao atualizar senha no Supabase', response.status, detail);
    return fail(
      'Não foi possível atualizar a senha. Solicite um novo link se o problema persistir.',
      response.status === 401 ? 401 : 400,
      'PASSWORD_UPDATE_FAILED',
    );
  }

  return ok({ message: 'Senha definida com sucesso.' });
}

export async function handleAccountAuth(req: Request, env: Env): Promise<Response | null> {
  const path = new URL(req.url).pathname;

  if (path === '/api/auth/account/session' && req.method === 'POST') return acceptSession(req, env);
  if (path === '/api/auth/account/session' && req.method === 'GET') return accountStatus(req, env);
  if (path === '/api/auth/account/recovery' && req.method === 'POST') return requestRecovery(req, env);
  if (path === '/api/auth/account/password' && req.method === 'PUT') return updatePassword(req, env);

  return null;
}
