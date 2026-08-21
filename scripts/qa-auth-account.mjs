import assert from 'node:assert/strict';
import fs from 'node:fs';
import worker from '../.wrangler-dry-run/index.js';

const calls = [];
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
function headersOf(input, init = {}) { return new Headers(init.headers || (input instanceof Request ? input.headers : undefined)); }

globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url);
  const headers = headersOf(input, init);
  const method = String(init.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
  const authorization = headers.get('authorization') || '';
  calls.push({ pathname: url.pathname, search: url.search, method, authorization });
  if (url.pathname === '/auth/v1/user' && method === 'GET') {
    if (authorization === 'Bearer valid-account-access') return json({ id: 'qa-auth-user', email: 'qa@example.invalid' });
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
    assert.equal(JSON.parse(String(init.body || '{}')).password, 'NovaSenhaQA123!');
    return json({ id: 'qa-auth-user', email: 'qa@example.invalid' });
  }
  throw new Error(`Requisição não simulada no QA de conta: ${method} ${url.pathname}${url.search}`);
};

const env = { ASSETS: { fetch: () => new Response('asset') }, SUPABASE_URL: 'https://supabase.example.test', SUPABASE_PUBLISHABLE_KEY: 'publishable', SUPABASE_SECRET_KEY: 'sb_secret_qa', REMOTE_IMAGE_HMAC_SECRET: 'remote-image-hmac-qa' };
const sameOrigin = { origin: 'https://catalog.example.test', 'content-type': 'application/json' };

const accept = await worker.fetch(new Request('https://catalog.example.test/api/auth/account/session', { method: 'POST', headers: sameOrigin, body: JSON.stringify({ accessToken: 'valid-account-access', refreshToken: 'valid-account-refresh', expiresIn: 3600, type: 'invite' }) }), env);
assert.equal(accept.status, 200);
const acceptBody = await accept.clone().json();
assert.equal(acceptBody.ok, true);
const cookies = accept.headers.get('set-cookie') || '';
assert.match(cookies, /__Host-asteryon_access=valid-account-access/);
assert.match(cookies, /__Host-asteryon_refresh=valid-account-refresh/);
assert.match(cookies, /HttpOnly/i); assert.match(cookies, /Secure/i); assert.match(cookies, /SameSite=Strict/i);

const invalid = await worker.fetch(new Request('https://catalog.example.test/api/auth/account/session', { method: 'POST', headers: sameOrigin, body: JSON.stringify({ accessToken: 'expired-access' }) }), env);
assert.equal(invalid.status, 401);
const status = await worker.fetch(new Request('https://catalog.example.test/api/auth/account/session', { headers: { cookie: '__Host-asteryon_access=valid-account-access' } }), env);
assert.equal(status.status, 200); assert.equal((await status.json()).authenticated, true);
const recovery = await worker.fetch(new Request('https://catalog.example.test/api/auth/account/recovery', { method: 'POST', headers: sameOrigin, body: JSON.stringify({ email: 'qa@example.invalid' }) }), env);
assert.equal(recovery.status, 200); assert.match((await recovery.json()).message, /Se existir uma conta/i);
const crossOrigin = await worker.fetch(new Request('https://catalog.example.test/api/auth/account/recovery', { method: 'POST', headers: { origin: 'https://evil.example.test', 'content-type': 'application/json' }, body: JSON.stringify({ email: 'qa@example.invalid' }) }), env);
assert.equal(crossOrigin.status, 403);
const missing = await worker.fetch(new Request('https://catalog.example.test/api/auth/account/password', { method: 'PUT', headers: sameOrigin, body: JSON.stringify({ password: 'NovaSenhaQA123!' }) }), env);
assert.equal(missing.status, 401);
const weak = await worker.fetch(new Request('https://catalog.example.test/api/auth/account/password', { method: 'PUT', headers: { ...sameOrigin, cookie: '__Host-asteryon_access=valid-account-access' }, body: JSON.stringify({ password: '123' }) }), env);
assert.equal(weak.status, 400);
const updated = await worker.fetch(new Request('https://catalog.example.test/api/auth/account/password', { method: 'PUT', headers: { ...sameOrigin, cookie: '__Host-asteryon_access=valid-account-access' }, body: JSON.stringify({ password: 'NovaSenhaQA123!' }) }), env);
assert.equal(updated.status, 200); assert.equal((await updated.json()).ok, true);

const confirmHtml = fs.readFileSync('frontend/public/auth/confirmar.html', 'utf8');
const resetHtml = fs.readFileSync('frontend/public/auth/redefinir-senha.html', 'utf8');
const browserJs = fs.readFileSync('frontend/public/auth/auth-flow.js', 'utf8');
assert.match(confirmHtml, /Confirmar acesso/); assert.match(confirmHtml, /auth-flow\.js/);
assert.match(resetHtml, /Redefinir senha/); assert.match(resetHtml, /recovery-form/); assert.match(resetHtml, /password-form/);
assert.match(browserJs, /\/api\/auth\/account\/session/); assert.match(browserJs, /\/api\/auth\/account\/recovery/); assert.match(browserJs, /\/api\/auth\/account\/password/); assert.match(browserJs, /history\.replaceState/);
assert.doesNotMatch(confirmHtml + resetHtml + browserJs, /SUPABASE_SECRET|SERVICE_ROLE|sb_secret_/i);
assert.ok(calls.some((call) => call.pathname === '/auth/v1/recover'));
assert.ok(calls.some((call) => call.pathname === '/auth/v1/user' && call.method === 'PUT'));
console.log('QA conta Enterprise: confirmação, recuperação e troca autenticada de senha validadas contra a fonte oficial.');
