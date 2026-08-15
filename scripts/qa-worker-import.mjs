import assert from 'node:assert/strict';
import worker from '../.wrangler-dry-run/index.js';

const hierarchy = [
  { id: 'dep_atacado', type: 'departamento', name: 'Atacado', slug: 'atacado', parent_id: null, sort_order: 10, active: true },
  { id: 'dep_distribuicao', type: 'departamento', name: 'Distribuição', slug: 'distribuicao', parent_id: null, sort_order: 20, active: true },
];
const brands = [];
const requests = [];
let savedProducts = [];

const json = value => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url);
  const method = init.method || 'GET';
  requests.push({ method, pathname: url.pathname });

  if (url.pathname === '/auth/v1/user') return json({ id: 'user_qa', email: 'qa@example.invalid' });
  if (url.pathname.endsWith('/company_memberships')) return json([{ company_id: 'cmp_asteryon', role: 'owner' }]);
  if (url.pathname.endsWith('/profiles')) return json([{ display_name: 'QA', email: 'qa@example.invalid' }]);
  if (url.pathname.endsWith('/products') && method === 'GET') return json([{
    id: 'prd_fixed', company_id: 'cmp_asteryon', code: '10001', name: 'Produto antigo', status: 'active',
    departamento_id: 'dep_atacado', secao_id: 'secao_antiga', categoria_id: 'categoria_antiga',
    image_url: '/api/public/media/existing', gallery: ['/api/public/media/existing'], price: 19.9,
    technical: {}, attributes: {}, tags: [], data: { departamentoName: 'Atacado', secaoName: 'Antiga', categoriaName: 'Antiga' },
  }]);
  if (url.pathname.endsWith('/hierarchy_nodes') && method === 'GET') return json(hierarchy);
  if (url.pathname.endsWith('/hierarchy_nodes') && method === 'POST') {
    hierarchy.push(...JSON.parse(init.body));
    return new Response(null, { status: 204 });
  }
  if (url.pathname.endsWith('/brands') && method === 'GET') return json(brands);
  if (url.pathname.endsWith('/brands') && method === 'POST') {
    brands.push(...JSON.parse(init.body));
    return new Response(null, { status: 204 });
  }
  if (url.pathname.endsWith('/products') && method === 'POST') {
    savedProducts = JSON.parse(init.body);
    return new Response(null, { status: 204 });
  }
  if (url.pathname.endsWith('/audit_logs') && method === 'POST') return new Response(null, { status: 204 });
  throw new Error(`Requisição não simulada: ${method} ${url.pathname}`);
};

const response = await worker.fetch(new Request('https://example.test/api/admin/catalog/products/bulk', {
  method: 'POST',
  headers: { cookie: '__Host-asteryon_access=qa-token', 'content-type': 'application/json' },
  body: JSON.stringify({
    filename: 'qa.xlsx',
    kind: 'spreadsheet',
    products: [
      { code: '10001', name: 'Produto atualizado', departamentoName: 'Distribuição', secaoName: 'Higiene', categoriaName: 'Sabonetes', brandName: 'Marca QA', status: 'ativo' },
      { code: '10001', name: 'Linha repetida', departamentoName: 'Atacado', secaoName: 'Outra', categoriaName: 'Outra' },
    ],
  }),
}), {
  ASSETS: { fetch: () => new Response('asset') },
  SUPABASE_URL: 'https://supabase.example.test',
  SUPABASE_PUBLISHABLE_KEY: 'publishable',
  SUPABASE_SECRET_KEY: 'sb_secret_qa',
});

assert.equal(response.status, 200);
const result = await response.json();
assert.equal(result.inserted, 0);
assert.equal(result.updated, 1);
assert.equal(result.ignored, 1);
assert.equal(savedProducts.length, 1, 'códigos repetidos não podem gerar dois upserts conflitantes');

const saved = savedProducts[0];
assert.equal(saved.id, 'prd_fixed', 'atualizações devem preservar o ID primário');
assert.equal(saved.departamento_id, 'dep_distribuicao');
assert.equal(saved.image_url, '/api/public/media/existing', 'campos opcionais ausentes devem ser preservados');
assert.equal(saved.price, 19.9);
assert.equal(saved.data.departamentoName, 'Distribuição');
assert.equal(hierarchy.find(node => node.id === saved.secao_id)?.parent_id, 'dep_distribuicao');
assert.equal(hierarchy.find(node => node.id === saved.categoria_id)?.parent_id, saved.secao_id);
assert.equal(requests.filter(item => item.pathname.endsWith('/products') && item.method === 'GET').length, 1);
assert.equal(requests.filter(item => item.pathname.endsWith('/products') && item.method === 'POST').length, 1);

console.log('QA de importação Supabase: OK');
