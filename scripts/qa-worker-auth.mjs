import assert from 'node:assert/strict';
import worker from '../.wrangler-dry-run/index.js';

const requests = [];
const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: { 'content-type': 'application/json' },
});

globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url);
  const method = init.method || 'GET';
  requests.push({ method, pathname: url.pathname });

  if (url.pathname === '/auth/v1/token' && method === 'POST') {
    return json({ access_token: 'access-qa', refresh_token: 'refresh-qa', expires_in: 3600 });
  }
  if (url.pathname === '/auth/v1/user') return json({ id: 'user_qa', email: 'qa@example.invalid' });
  if (url.pathname.endsWith('/company_memberships')) return json([{ company_id: 'cmp_asteryon', role: 'owner' }]);
  if (url.pathname.endsWith('/profiles')) return json([{ display_name: 'QA', email: 'qa@example.invalid' }]);
  if (url.pathname.endsWith('/audit_logs') && method === 'POST') return json({ message: 'falha simulada' }, 503);
  throw new Error(`Requisição não simulada: ${method} ${url.pathname}`);
};

const response = await worker.fetch(new Request('https://example.test/api/auth/login', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: 'qa@example.invalid', password: 'senha-segura-qa' }),
}), {
  ASSETS: { fetch: () => new Response('asset') },
  SUPABASE_URL: 'https://supabase.example.test',
  SUPABASE_PUBLISHABLE_KEY: 'publishable',
  SUPABASE_SECRET_KEY: 'sb_secret_qa',
});

assert.equal(response.status, 200, 'o login válido não pode falhar após consumir o corpo da requisição');
const payload = await response.json();
assert.equal(payload.ok, true);
assert.equal(payload.user.role, 'SDM');
assert.equal(requests.filter(item => item.pathname === '/auth/v1/user').length, 1);
assert.equal(requests.filter(item => item.pathname.endsWith('/audit_logs')).length, 1);
assert.match(response.headers.get('set-cookie') || '', /__Host-asteryon_access=access-qa/);

console.log('QA de autenticação Supabase: OK');
