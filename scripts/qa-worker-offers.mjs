import assert from 'node:assert/strict';
import worker from '../.wrangler-dry-run/index.js';

const requests = [];
let savedOffer = null;
let savedLinks = null;
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });

globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url);
  const method = init.method || 'GET';
  requests.push({ method, pathname: url.pathname, search: url.search, body: init.body ? String(init.body) : '' });

  if (url.pathname === '/auth/v1/user') return json({ id: 'user_offer', email: 'offer@example.invalid' });
  if (url.pathname === '/rest/v1/company_memberships') return json([{ company_id: 'cmp_asteryon', role: 'owner' }]);
  if (url.pathname === '/rest/v1/profiles') return json([{ display_name: 'QA Oferta', email: 'offer@example.invalid' }]);
  if (url.pathname === '/rest/v1/offers' && method === 'POST') {
    savedOffer = JSON.parse(init.body);
    return new Response(null, { status: 204 });
  }
  if (url.pathname === '/rest/v1/offer_products' && method === 'DELETE') return new Response(null, { status: 204 });
  if (url.pathname === '/rest/v1/offer_products' && method === 'POST') {
    savedLinks = JSON.parse(init.body);
    return new Response(null, { status: 204 });
  }
  if (url.pathname === '/rest/v1/audit_logs' && method === 'POST') return new Response(null, { status: 204 });
  throw new Error(`Requisição não simulada: ${method} ${url.pathname}${url.search}`);
};

const env = {
  ASSETS: { fetch: () => new Response('asset') },
  SUPABASE_URL: 'https://supabase.example.test',
  SUPABASE_PUBLISHABLE_KEY: 'publishable',
  SUPABASE_SECRET_KEY: 'sb_secret_offer',
};

const response = await worker.fetch(new Request('https://example.test/api/admin/catalog/offers', {
  method: 'POST',
  headers: { cookie: '__Host-asteryon_access=offer-token', 'content-type': 'application/json' },
  body: JSON.stringify({
    title: 'Oferta QA',
    description: 'Teste integral',
    status: 'published',
    featured: true,
    displayFields: ['image', 'name', 'price'],
    productIds: ['prd_1', 'prd_2', 'prd_1', '', null],
  }),
}), env);

assert.equal(response.status, 200);
const payload = await response.json();
assert.equal(payload.ok, true);
assert.equal(payload.offer.title, 'Oferta QA');
assert.deepEqual(payload.offer.productIds, ['prd_1', 'prd_2'], 'IDs de produtos devem ser únicos e vazios removidos');
assert.equal(savedOffer.company_id, 'cmp_asteryon');
assert.equal(savedOffer.status, 'published');
assert.deepEqual(savedOffer.display_config.displayFields, ['image', 'name', 'price']);
assert.equal(savedLinks.length, 2);
assert.equal(savedLinks[0].product_id, 'prd_1');
assert.equal(savedLinks[0].sort_order, 0);
assert.equal(savedLinks[1].product_id, 'prd_2');
assert.equal(savedLinks[1].sort_order, 1);
assert.ok(requests.some((item) => item.pathname === '/rest/v1/offer_products' && item.method === 'DELETE'), 'Atualização deve limpar vínculos anteriores antes de recriar');
assert.ok(requests.some((item) => item.pathname === '/rest/v1/audit_logs' && item.method === 'POST'), 'Oferta deve gerar auditoria');

console.log('QA Ofertas V81: OK — autenticação, criação, deduplicação, vínculos produto-oferta e auditoria executados.');
