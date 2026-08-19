import assert from 'node:assert/strict';
import worker from '../.wrangler-dry-run/index.js';

const calls = [];
const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: { 'content-type': 'application/json' },
});

function headersFor(input, init = {}) {
  if (init.headers) return new Headers(init.headers);
  if (input instanceof Request) return new Headers(input.headers);
  return new Headers();
}

globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url);
  const headers = headersFor(input, init);
  const authorization = headers.get('authorization') || '';
  calls.push({ pathname: url.pathname, search: url.search, authorization, method: init.method || 'GET' });

  if (url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'refresh_token') {
    const payload = JSON.parse(String(init.body || '{}'));
    assert.equal(payload.refresh_token, 'refresh-old', 'refresh token recebido pelo Supabase deve ser o cookie atual');
    return json({ access_token: 'access-new', refresh_token: 'refresh-new', expires_in: 3600 });
  }

  if (url.pathname === '/auth/v1/user') {
    if (authorization === 'Bearer expired-access') return json({ message: 'expired' }, 401);
    if (authorization === 'Bearer access-new') return json({ id: 'user-refresh', email: 'refresh@example.invalid' });
    return json({ message: 'unauthorized' }, 401);
  }

  if (url.pathname.endsWith('/company_memberships')) {
    if (url.searchParams.get('role') === 'eq.owner') return json([{ user_id: 'user-refresh' }]);
    if (authorization === 'Bearer access-new') return json([{ company_id: 'cmp_asteryon', role: 'owner', active: true }]);
    return json([]);
  }

  if (url.pathname.endsWith('/profiles')) {
    return json([{ display_name: 'QA Refresh', email: 'refresh@example.invalid' }]);
  }

  throw new Error(`Requisição não simulada no QA de refresh: ${init.method || 'GET'} ${url.pathname}${url.search}`);
};

const response = await worker.fetch(new Request('https://example.test/api/auth/status', {
  headers: {
    cookie: '__Host-asteryon_access=expired-access; __Host-asteryon_refresh=refresh-old',
  },
}), {
  ASSETS: { fetch: () => new Response('asset') },
  SUPABASE_URL: 'https://supabase.example.test',
  SUPABASE_PUBLISHABLE_KEY: 'publishable',
  SUPABASE_SECRET_KEY: 'sb_secret_qa',
  REMOTE_IMAGE_HMAC_SECRET: 'remote-image-hmac-qa',
});

assert.equal(response.status, 200);
const payload = await response.json();
assert.equal(payload.ok, true);
assert.equal(payload.user?.id, 'user-refresh');
assert.equal(payload.user?.role, 'SDM');
assert.equal(calls.filter(call => call.pathname === '/auth/v1/token').length, 1, 'refresh deve ocorrer uma única vez');
assert.ok(calls.some(call => call.pathname === '/auth/v1/user' && call.authorization === 'Bearer expired-access'), 'access expirado deve ser detectado');
assert.ok(calls.some(call => call.pathname === '/auth/v1/user' && call.authorization === 'Bearer access-new'), 'nova sessão deve ser validada');

const setCookie = response.headers.get('set-cookie') || '';
assert.match(setCookie, /__Host-asteryon_access=access-new/);
assert.match(setCookie, /__Host-asteryon_refresh=refresh-new/);
assert.match(setCookie, /HttpOnly/i);
assert.match(setCookie, /Secure/i);
assert.match(setCookie, /SameSite=Strict/i);

console.log('QA V89 auth refresh: access expirado foi renovado funcionalmente e a sessão permaneceu ativa.');
