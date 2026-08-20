import assert from 'node:assert/strict';
import fs from 'node:fs';
import worker from '../.wrangler-dry-run/index.js';

const calls = [];
const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: { 'content-type': 'application/json' },
});

function requestHeaders(input, init = {}) {
  if (init.headers) return new Headers(init.headers);
  if (input instanceof Request) return new Headers(input.headers);
  return new Headers();
}

globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url);
  const headers = requestHeaders(input, init);
  const method = init.method || (input instanceof Request ? input.method : 'GET');
  const authorization = headers.get('authorization') || '';
  calls.push({ pathname: url.pathname, search: url.search, method, authorization, body: String(init.body || '') });

  if (url.pathname === '/auth/v1/user' && method === 'GET') {
    if (authorization === 'Bearer valid-account-access') {
      return json({ id: 'qa-auth-user', email: 'qa@example.invalid' });
    }
    return json({ message: 'invalid token' }, 401);
  }

  if (url.pathname === '/auth/v1/recover' && method === 'POST') {
    const payload = JSON.parse(String(init.body || '{}'));
    assert.equal(payload.email, 'qa@example.invalid');
    assert.equal(url.searchParams.get('redirect_to'), 'https://catalog.example.test/auth/redefinir-senha.html');
    return json({});
  }

  if (url.pathname === '/auth/v1/user' && method === 'PUT') {
    assert.equal(authorization, 'Bearer valid-account-access');
    const payload = JSON.parse(String(init.body || '{}'));
    assert.equal(payload.password, 'NovaSenhaQA123!');
    return json({ id: 'qa-auth-user', email: 'qa@example.invalid' });
  }

  throw new Error(`Requisição não simulada no QA de conta: ${method} ${url.pathname}${url.search}`);
};

const env = {
  ASSETS: { fetch: () => new Response('asset') },
  SUPABASE_URL: 'https://supabase.example.test',
  SUPABASE_PUBLISHABLE_KEY: 'publishable',
  SUPABASE_SECRET_KEY: 'sb_secret_qa',
  REMOTE_IMAGE_HMAC_SECRET: 'remote-image-hmac-qa',
};

const accept = await worker.fetch(new Request('https://catalog.example.test/api/auth/account/session', {
  method: 'POST',
  headers: { origin: 'https://catalog.example.test', 'content-type': 'application/json' },
  body: JSON.stringify({
    accessToken: 'valid-account-access',
    refreshToken: 'valid-account-refresh',
    expiresIn: 3600,
    type: 'invite',
  }),
}), env);
assert.equal(accept.status, 200, 'sessão válida do convite deve ser aceita');
const accepted = await accept.json();
assert.equal(accepted.ok, true);
assert.equal(accepted.user?.email, 'qa@example.invalid');
const acceptedCookies = accept.headers.get('set-cookie') || '';
assert.match(acceptedCookies, /__Host-asteryon_access=valid-account-access/);
assert.match(acceptedCookies, /__Host-asteryon_refresh=valid-account-refresh/);
assert.match(acceptedCookies, /HttpOnly/i);
assert.match(acceptedCookies, /Secure/i);
assert.match(acceptedCookies, /SameSite=Strict/i);

const invalidAccept = await worker.fetch(new Request('https://catalog.example.test/api/auth/account/session', {
  method: 'POST',
  headers: { origin: 'https://catalog.example.test', 'content-type': 'application/json' },
  body: JSON.stringify({ accessToken: 'expired-access' }),
}), env);
assert.equal(invalidAccept.status, 401, 'token expirado não pode virar sessão local');

const status = await worker.fetch(new Request('https://catalog.example.test/api/auth/account/session', {
  headers: { cookie: '__Host-asteryon_access=valid-account-access' },
}), env);
assert.equal(status.status, 200);
const statusBody = await status.json();
assert.equal(statusBody.authenticated, true);
assert.equal(statusBody.user?.id, 'qa-auth-user');

const recovery = await worker.fetch(new Request('https://catalog.example.test/api/auth/account/recovery', {
  method: 'POST',
  headers: { origin: 'https://catalog.example.test', 'content-type': 'application/json' },
  body: JSON.stringify({ email: 'qa@example.invalid' }),
}), env);
assert.equal(recovery.status, 200, 'pedido de recuperação deve ser aceito');
const recoveryBody = await recovery.json();
assert.equal(recoveryBody.ok, true);
assert.match(recoveryBody.message, /Se existir uma conta/i, 'resposta não deve enumerar usuários');

const crossOrigin = await worker.fetch(new Request('https://catalog.example.test/api/auth/account/recovery', {
  method: 'POST',
  headers: { origin: 'https://evil.example.test', 'content-type': 'application/json' },
  body: JSON.stringify({ email: 'qa@example.invalid' }),
}), env);
assert.equal(crossOrigin.status, 403, 'origem externa não pode disparar recuperação');

const missingSession = await worker.fetch(new Request('https://catalog.example.test/api/auth/account/password', {
  method: 'PUT',
  headers: { origin: 'https://catalog.example.test', 'content-type': 'application/json' },
  body: JSON.stringify({ password: 'NovaSenhaQA123!' }),
}), env);
assert.equal(missingSession.status, 401, 'troca de senha exige sessão do link de e-mail');

const weakPassword = await worker.fetch(new Request('https://catalog.example.test/api/auth/account/password', {
  method: 'PUT',
  headers: {
    origin: 'https://catalog.example.test',
    cookie: '__Host-asteryon_access=valid-account-access',
    'content-type': 'application/json',
  },
  body: JSON.stringify({ password: '123' }),
}), env);
assert.equal(weakPassword.status, 400, 'senha curta deve ser rejeitada');

const updated = await worker.fetch(new Request('https://catalog.example.test/api/auth/account/password', {
  method: 'PUT',
  headers: {
    origin: 'https://catalog.example.test',
    cookie: '__Host-asteryon_access=valid-account-access',
    'content-type': 'application/json',
  },
  body: JSON.stringify({ password: 'NovaSenhaQA123!' }),
}), env);
assert.equal(updated.status, 200, 'sessão válida deve conseguir alterar senha');
assert.equal((await updated.json()).ok, true);

const confirmHtml = fs.readFileSync('public/auth/confirmar.html', 'utf8');
const resetHtml = fs.readFileSync('public/auth/redefinir-senha.html', 'utf8');
const browserJs = fs.readFileSync('public/auth/auth-flow-v89.js', 'utf8');
assert.match(confirmHtml, /Confirmar acesso/);
assert.match(confirmHtml, /auth-flow-v89\.js\?v=89/);
assert.match(resetHtml, /Redefinir senha/);
assert.match(resetHtml, /recovery-form/);
assert.match(resetHtml, /password-form/);
assert.match(browserJs, /\/api\/auth\/account\/session/);
assert.match(browserJs, /\/api\/auth\/account\/recovery/);
assert.match(browserJs, /\/api\/auth\/account\/password/);
assert.match(browserJs, /history\.replaceState/, 'fragmento com tokens deve ser removido da barra de endereço');
assert.doesNotMatch(confirmHtml + resetHtml + browserJs, /SUPABASE_SECRET|SERVICE_ROLE|sb_secret_/i, 'frontend não pode conter segredo administrativo');

assert.ok(calls.some(call => call.pathname === '/auth/v1/recover' && call.search.includes('redefinir-senha.html')), 'recuperação deve redirecionar para a tela dedicada');
assert.ok(calls.some(call => call.pathname === '/auth/v1/user' && call.method === 'PUT'), 'troca de senha deve usar sessão autenticada no Supabase Auth');

console.log('QA V89 conta: confirmação, recuperação, redirect dedicado e troca autenticada de senha validados.');
