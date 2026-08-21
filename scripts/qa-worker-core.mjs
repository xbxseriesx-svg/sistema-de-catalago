import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import worker from '../.wrangler-dry-run/index.js';

const expectedRelease = `V${(await readFile('VERSION', 'utf8')).trim()}`;
const calls = [];
const respond = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });

globalThis.fetch = async (input, init = {}) => {
  const requestHeaders = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
  const url = new URL(typeof input === 'string' ? input : input.url);
  calls.push({
    pathname: url.pathname,
    search: url.search,
    method: init.method || (input instanceof Request ? input.method : 'GET'),
    apikey: requestHeaders.get('apikey'),
    authorization: requestHeaders.get('authorization'),
    body: init.body || null,
  });

  if (url.pathname === '/rest/v1/rpc/bootstrap_status') {
    return respond({ bootstrapOpen: false, hasActiveAdmin: true });
  }
  if (url.pathname === '/rest/v1/rpc/get_public_catalog_meta') {
    return respond({
      hierarchy: [],
      offers: [],
      settings: { display_fields: [] },
      product_count: 0,
      brands: [{
        id: 'brd_1',
        name: 'Marca Um',
        slug: 'marca-um',
        description: 'Descrição',
        website: 'https://example.invalid',
        logo_url: 'https://cdn.example.invalid/logo.webp',
        banner_url: null,
        sort_order: 3,
        featured: true,
      }],
    });
  }
  if (url.pathname === '/auth/v1/user') return respond({ id: 'user_v81', email: 'qa@example.invalid' });
  if (url.pathname === '/rest/v1/company_memberships') {
    assert.match(url.search, /company_id=eq\.cmp_asteryon/);
    assert.match(url.search, /user_id=eq\.user_v81/);
    return respond([{ company_id: 'cmp_asteryon', role: 'editor' }]);
  }
  if (url.pathname === '/rest/v1/brands') {
    if (url.searchParams.has('id')) return respond([]);
    return respond([
      {
        id: 'brd_1', name: 'Marca Um', slug: 'marca-um', description: 'Descrição', website: 'https://example.invalid',
        logo_url: 'https://cdn.example.invalid/logo.webp', banner_url: null, sort_order: 3, active: true, featured: true,
        data: { logoUrl: 'https://old.example.invalid/old.webp', custom: 'preservado' },
      },
      { id: 'brd_2', name: 'Inativa', slug: 'inativa', description: null, website: null, logo_url: null, banner_url: null, sort_order: 9, active: false, featured: false, data: {} },
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
const publicEnv = { ...env };
delete publicEnv.SUPABASE_SECRET_KEY;

const health = await worker.fetch(new Request('https://catalog.example/api/health'), publicEnv);
assert.equal(health.status, 200, 'health público não pode depender de secret administrativo');
const healthPayload = await health.json();
assert.equal(healthPayload.version, expectedRelease, 'health deve acompanhar VERSION, sem hardcode da versão física do arquivo');
assert.equal(healthPayload.supabase?.connected, true, 'health deve provar conexão real com Supabase');
assert.equal(healthPayload.supabase?.publicAccess, true, 'health deve provar acesso público via RPC permitido ao anon');
assert.equal(healthPayload.supabase?.adminConfigured, false, 'ausência do secret deve ser reportada sem transformar o health em 503');
const healthCall = calls.find((call) => call.pathname === '/rest/v1/rpc/bootstrap_status');
assert.ok(healthCall, 'health deve executar o RPC público leve bootstrap_status');
assert.equal(healthCall.method, 'POST');
assert.equal(healthCall.apikey, 'publishable', 'health deve usar somente a publishable key');
assert.equal(healthCall.authorization, null, 'health público não deve enviar bearer administrativo');
assert.equal(calls.some((call) => call.pathname === '/rest/v1/catalog_settings'), false, 'health não pode voltar a depender de SELECT anon em catalog_settings');
assert.match(health.headers.get('content-security-policy') || '', /fonts\.googleapis\.com/);
assert.match(health.headers.get('strict-transport-security') || '', /max-age=31536000/);

const brands = await worker.fetch(new Request('https://catalog.example/api/public/brands'), publicEnv);
assert.equal(brands.status, 200, 'marcas públicas devem funcionar sem secret administrativo');
const brandsPayload = await brands.json();
assert.equal(brandsPayload.brands.length, 1, 'API pública deve expor somente as marcas filtradas pelo RPC');
assert.equal(brandsPayload.brands[0].logoUrl, 'https://cdn.example.invalid/logo.webp', 'Campo canônico logo_url deve ser convertido para logoUrl');
assert.equal(brandsPayload.brands[0].featured, true);
assert.equal(brandsPayload.brands[0].status, 'active');
assert.equal(brandsPayload.brands[0].custom, undefined, 'RPC público não deve vazar o objeto data privado da marca');
const publicBrandCall = calls.find((call) => call.pathname === '/rest/v1/rpc/get_public_catalog_meta');
assert.ok(publicBrandCall, 'API pública de marcas deve usar o RPC leve de metadados');
assert.equal(publicBrandCall.method, 'POST');
assert.equal(publicBrandCall.apikey, 'publishable', 'API pública deve usar publishable key');
assert.equal(publicBrandCall.authorization, null, 'API pública não deve usar bearer administrativo');
assert.equal(calls.some((call) => call.pathname === '/rest/v1/rpc/get_public_catalog'), false, 'RPC público monolítico não pode regressar');
assert.equal(calls.some((call) => call.pathname === '/rest/v1/brands' && call.authorization === null), false, 'API pública não pode depender de SELECT anon direto em brands');

const noSession = await worker.fetch(new Request('https://catalog.example/api/admin/catalog'), env);
assert.equal(noSession.status, 403, 'Admin sem sessão deve ser bloqueado antes de qualquer mutação');
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

console.log(`QA Worker / release ${expectedRelease}: OK — health por RPC público leve, catálogo público paginado sem SELECT anon direto, CSP, empresa obrigatória e proteção contra escrita fora do escopo.`);
