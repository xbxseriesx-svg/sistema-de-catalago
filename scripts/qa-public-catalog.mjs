import assert from 'node:assert/strict';
import worker from '../.wrangler-dry-run/index.js';

const json = (value) => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });
globalThis.fetch = async (input) => {
  const url = new URL(typeof input === 'string' ? input : input.url);
  const q = url.searchParams;
  if (url.pathname === '/rest/v1/products') {
    return json([{ id: 'prd_1', code: '100', name: 'Produto 100', image_url: '/p.webp', gallery: [], status: 'active', data: { brandId: 'brd_active', departamentoId: 'dep_active', secaoId: 'sec_active', categoriaId: 'cat_active' } }]);
  }
  if (url.pathname === '/rest/v1/brands') {
    const activeOnly = q.get('active') === 'eq.true';
    const active = { id: 'brd_active', name: 'Marca Ativa', slug: 'marca-ativa', description: 'Canônica', website: null, logo_url: '/logo.webp', banner_url: null, sort_order: 1, active: true, featured: true, data: { logoUrl: '/legado.webp' } };
    const inactive = { id: 'brd_inactive', name: 'Marca Inativa', slug: 'marca-inativa', description: null, website: null, logo_url: null, banner_url: null, sort_order: 2, active: false, featured: false, data: {} };
    return json(activeOnly ? [active] : [active, inactive]);
  }
  if (url.pathname === '/rest/v1/hierarchy_nodes') {
    return json([
      { id: 'dep_active', name: 'Atacado', slug: 'atacado', type: 'departamento', parent_id: null, sort_order: 1, active: true },
      { id: 'sec_active', name: 'Higiene', slug: 'higiene', type: 'secao', parent_id: 'dep_active', sort_order: 1, active: true },
      { id: 'cat_active', name: 'Pessoal', slug: 'pessoal', type: 'categoria', parent_id: 'sec_active', sort_order: 1, active: true },
      { id: 'dep_inactive', name: 'Oculto', slug: 'oculto', type: 'departamento', parent_id: null, sort_order: 99, active: false },
    ]);
  }
  if (url.pathname === '/rest/v1/catalog_settings') return json([{ display_fields: ['image', 'name', 'code'] }]);
  if (url.pathname === '/rest/v1/offers') {
    return json([
      { id: 'off_live', title: 'Oferta Atual', description: null, status: 'published', featured: true, starts_at: '2020-01-01T00:00:00Z', ends_at: '2999-01-01T00:00:00Z', data: {} },
      { id: 'off_expired', title: 'Oferta Expirada', description: null, status: 'published', featured: false, starts_at: '2000-01-01T00:00:00Z', ends_at: '2001-01-01T00:00:00Z', data: {} },
    ]);
  }
  if (url.pathname === '/rest/v1/offer_products') return json([{ offer_id: 'off_live', product_id: 'prd_1', sort_order: 0 }, { offer_id: 'off_expired', product_id: 'prd_1', sort_order: 0 }]);
  throw new Error(`Fetch público não simulado: ${url.pathname}${url.search}`);
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
assert.deepEqual(payload.catalog.brands.map((x) => x.id), ['brd_active'], 'Marca inativa não pode aparecer no catálogo público');
assert.equal(payload.catalog.brands[0].logoUrl, '/logo.webp', 'Logo canônica deve prevalecer no catálogo');
assert.equal(payload.catalog.brands[0].featured, true);
assert.ok(payload.catalog.hierarchy.every((x) => x.status !== 'inactive'), 'Hierarquia inativa não pode aparecer no público');
assert.deepEqual(payload.catalog.promotions.map((x) => x.id), ['off_live'], 'Oferta expirada não pode aparecer no público');
assert.deepEqual(payload.catalog.settings.displayFields, ['image', 'name', 'code']);

console.log('QA Catálogo Público V81: OK — produtos, marcas canônicas, hierarquia ativa e validade temporal de ofertas executados.');
