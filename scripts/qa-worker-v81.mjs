import assert from 'node:assert/strict';
import worker from '../.wrangler-dry-run/index.js';

const calls = [];
const respond = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });

globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url);
  calls.push({ pathname: url.pathname, search: url.search, method: init.method || 'GET' });

  if (url.pathname === '/auth/v1/user') return respond({ id: 'user_v81', email: 'qa@example.invalid' });
  if (url.pathname === '/rest/v1/company_memberships') {
    assert.match(url.search, /company_id=eq\.cmp_asteryon/);
    assert.match(url.search, /user_id=eq\.user_v81/);
    return respond([{ company_id: 'cmp_asteryon', role: 'editor' }]);
  }
  if (url.pathname === '/rest/v1/brands') {
    if (url.searchParams.has('id')) return respond([]);
    const publicOnly = url.searchParams.get('active') === 'eq.true';
    return respond([
      {
        id: 'brd_1', name: 'Marca Um', slug: 'marca-um', description: 'Descrição', website: 'https://example.invalid',
        logo_url: 'https://cdn.example.invalid/logo.webp', banner_url: null, sort_order: 3, active: true, featured: true,
        data: { logoUrl: 'https://old.example.invalid/old.webp', custom: 'preservado' },
      },
      ...(publicOnly ? [] : [{ id: 'brd_2', name: 'Inativa', slug: 'inativa', description: null, website: null, logo_url: null, banner_url: null, sort_order: 9, active: false, featured: false, data: {} }]),
    ]);
  }
  throw new Error(`Fetch não simulado: ${url.pathname}${url.search}`);
};

const env = {
  ASSETS: { fetch: () => new Response('asset') },
  SUPABASE_URL: 'https://supabase.example.test',
  SUPABASE_PUBLISHABLE_KEY: 'publishable',
  SUPABASE_SECRET_KEY: 'sb_secret_v81',
};

const health = await worker.fetch(new Request('https://catalog.example/api/health'), env);
assert.equal(health.status, 200);
assert.equal((await health.json()).version, 'V81');
assert.match(health.headers.get('content-security-policy') || '', /fonts\.googleapis\.com/);
assert.match(health.headers.get('strict-transport-security') || '', /max-age=31536000/);

const brands = await worker.fetch(new Request('https://catalog.example/api/public/brands'), env);
assert.equal(brands.status, 200);
const brandsPayload = await brands.json();
assert.equal(brandsPayload.brands.length, 1, 'API pública deve expor somente marcas ativas');
assert.equal(brandsPayload.brands[0].logoUrl, 'https://cdn.example.invalid/logo.webp', 'Campo canônico logo_url deve prevalecer sobre data legado');
assert.equal(brandsPayload.brands[0].featured, true);
assert.equal(brandsPayload.brands[0].custom, 'preservado');

const noSession = await worker.fetch(new Request('https://catalog.example/api/admin/catalog'), env);
assert.equal(noSession.status, 403, 'Admin sem sessão deve ser bloqueado antes do Worker legado');
assert.equal((await noSession.json()).error.code, 'COMPANY_FORBIDDEN');

const malformedCookie = await worker.fetch(new Request('https://catalog.example/api/admin/catalog', {
  headers: { cookie: '__Host-asteryon_access=%E0%A4%A' },
}), env);
assert.equal(malformedCookie.status, 403, 'Cookie inválido não pode gerar erro 500');

const missingForeignRecord = await worker.fetch(new Request('https://catalog.example/api/admin/brands/brd_foreign', {
  method: 'DELETE',
  headers: { cookie: '__Host-asteryon_access=qa-token' },
}), env);
assert.equal(missingForeignRecord.status, 404, 'Mutação fora do escopo da empresa deve ser bloqueada');
assert.equal((await missingForeignRecord.json()).error.code, 'NOT_FOUND');
assert.ok(calls.some((call) => call.pathname === '/rest/v1/company_memberships' && call.search.includes('company_id=eq.cmp_asteryon')));

console.log('QA Worker V81: OK — saúde, CSP, marcas canônicas, empresa obrigatória, cookie malformado e proteção contra escrita fora do escopo.');
