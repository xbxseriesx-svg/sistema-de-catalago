import assert from 'node:assert/strict';
import worker from '../.wrangler-dry-run/index.js';

const json = (value) => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });
const requests = [];
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url);
  const method = init.method || 'GET';
  requests.push({ method, pathname: url.pathname, search: url.search, body: init.body || null });

  if (url.pathname === '/rest/v1/rpc/get_public_catalog' && method === 'POST') {
    return json({
      products: [{
        id: 'prd_1', code: '100', ean: '7890000000100', name: 'Produto 100',
        short_description: 'Produto 100', long_description: 'Produto 100 completo',
        brand_id: 'brd_active', departamento_id: 'dep_active', secao_id: 'sec_active', categoria_id: 'cat_active',
        unit: 'UN', packaging: 'CX 1', ncm: '12345678', price: 10, promo_price: 9, stock: 3,
        image_url: '/p.webp', video_url: null, gallery: ['/p.webp'], technical: { NCM: '12345678' }, attributes: { Marca: 'Marca Ativa' }, tags: ['qa'], status: 'active',
      }],
      brands: [{ id: 'brd_active', name: 'Marca Ativa', slug: 'marca-ativa', description: 'Canônica', website: null, logo_url: '/logo.webp', banner_url: null, sort_order: 1, featured: true }],
      hierarchy: [
        { id: 'dep_active', name: 'Atacado', slug: 'atacado', type: 'departamento', parent_id: null, sort_order: 1, active: true },
        { id: 'sec_active', name: 'Higiene', slug: 'higiene', type: 'secao', parent_id: 'dep_active', sort_order: 1, active: true },
        { id: 'cat_active', name: 'Pessoal', slug: 'pessoal', type: 'categoria', parent_id: 'sec_active', sort_order: 1, active: true },
      ],
      offers: [{ id: 'off_live', title: 'Oferta Atual', description: null, featured: true, starts_at: '2020-01-01T00:00:00Z', ends_at: '2999-01-01T00:00:00Z', display_config: {}, data: {} }],
      settings: { display_fields: ['image', 'name', 'code'] },
    });
  }
  if (url.pathname === '/rest/v1/offer_products') {
    return json([{ offer_id: 'off_live', product_id: 'prd_1', sort_order: 0 }]);
  }
  throw new Error(`Fetch público não simulado: ${method} ${url.pathname}${url.search}`);
};

const env = {
  ASSETS: { fetch: () => new Response('asset') },
  SUPABASE_URL: 'https://supabase.example.test',
  SUPABASE_PUBLISHABLE_KEY: 'publishable',
  SUPABASE_SECRET_KEY: 'sb_secret_public',
};

const response = await worker.fetch(new Request('https://example.test/api/public/catalog'), env);
assert.equal(response.status, 200);
const payload = await response.json();
assert.equal(payload.ok, true);
assert.equal(payload.catalog.products.length, 1);
assert.deepEqual(payload.catalog.brands.map((x) => x.id), ['brd_active']);
assert.equal(payload.catalog.brands[0].logoUrl, '/logo.webp', 'Logo canônica deve prevalecer no catálogo');
assert.equal(payload.catalog.brands[0].featured, true);
assert.equal(payload.catalog.brands[0].status, 'active');
assert.ok(payload.catalog.hierarchy.every((x) => x.status === 'active'), 'RPC público só pode devolver hierarquia ativa');
assert.deepEqual(payload.catalog.promotions.map((x) => x.id), ['off_live']);
assert.deepEqual(payload.catalog.promotions[0].productIds, ['prd_1']);
assert.deepEqual(payload.catalog.settings.displayFields, ['image', 'name', 'code']);
assert.equal(payload.catalog.products[0].brandId, 'brd_active');
assert.equal(payload.catalog.products[0].brandName, 'Marca Ativa');
assert.equal(payload.catalog.products[0].departamentoName, 'Atacado');
assert.equal(payload.catalog.products[0].image, '/p.webp');
assert.equal(payload.catalog.products[0].status, 'ativo');

assert.equal(requests.filter((item) => item.pathname === '/rest/v1/rpc/get_public_catalog').length, 1, 'Catálogo público deve usar um único RPC filtrado');
for (const forbidden of ['/rest/v1/products', '/rest/v1/brands', '/rest/v1/hierarchy_nodes', '/rest/v1/offers', '/rest/v1/catalog_settings']) {
  assert.equal(requests.some((item) => item.pathname === forbidden), false, `Catálogo público não pode depender de SELECT anon direto em ${forbidden}`);
}

console.log('QA Catálogo Público: OK — RPC filtrado, DTO público, hierarquia, marcas e ofertas validados sem SELECT anon direto.');
