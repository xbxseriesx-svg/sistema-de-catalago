import assert from 'node:assert/strict';
import worker from '../.wrangler-dry-run/index.js';

const calls = [];
const totals = new Map([
  ['products', 2513],
  ['brands', 252],
  ['media_assets', 2465],
  ['hierarchy_nodes:departamento', 2],
  ['hierarchy_nodes:secao', 13],
  ['hierarchy_nodes:categoria', 43],
]);

const json = (value, status = 200, headers = {}) => new Response(JSON.stringify(value), {
  status,
  headers: { 'content-type': 'application/json', ...headers },
});

globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url);
  const method = init.method || 'GET';
  calls.push({ method, pathname: url.pathname, search: url.search });

  if (url.pathname === '/auth/v1/user') return json({ id: 'user_qa', email: 'qa@example.invalid' });
  if (url.pathname.endsWith('/company_memberships')) return json([{ company_id: 'cmp_asteryon', role: 'owner' }]);
  if (url.pathname.endsWith('/profiles')) return json([{ display_name: 'QA', email: 'qa@example.invalid' }]);
  if (/\/storage\/v1\/bucket\/(product-images|brand-media)\/empty$/.test(url.pathname)) return json({ message: 'Successfully emptied' });

  const table = url.pathname.split('/').at(-1);
  if (method === 'GET' && totals.has(table)) {
    return json([], 200, { 'content-range': `0-0/${totals.get(table)}` });
  }
  if (method === 'GET' && table === 'hierarchy_nodes') {
    const type = url.searchParams.get('type')?.replace(/^eq\./, '');
    return json([], 200, { 'content-range': `0-0/${totals.get(`${table}:${type}`) || 0}` });
  }
  if (method === 'DELETE') return new Response(null, { status: 204 });
  if (url.pathname.endsWith('/audit_logs') && method === 'POST') return new Response(null, { status: 204 });
  throw new Error(`Requisição não simulada: ${method} ${url.pathname}${url.search}`);
};

const env = {
  ASSETS: { fetch: () => new Response('asset') },
  SUPABASE_URL: 'https://supabase.example.test',
  SUPABASE_PUBLISHABLE_KEY: 'publishable',
  SUPABASE_SECRET_KEY: 'sb_secret_qa',
};

const request = (confirm) => worker.fetch(new Request('https://example.test/api/admin/catalog/reset', {
  method: 'DELETE',
  headers: {
    cookie: '__Host-asteryon_access=qa-token',
    origin: 'https://example.test',
    'content-type': 'application/json',
  },
  body: JSON.stringify({ confirm }),
}), env);

const rejected = await request('apagar');
assert.equal(rejected.status, 400);
assert.equal(calls.some((call) => call.pathname.includes('/storage/v1/bucket/')), false);

calls.length = 0;
const response = await request('APAGAR CATÁLOGO');
assert.equal(response.status, 200);
const body = await response.json();
assert.deepEqual(body.deleted, {
  products: 2513,
  brands: 252,
  media: 2465,
  departments: 2,
  sections: 13,
  categories: 43,
});
assert.deepEqual(body.storageBucketsEmptied, ['product-images', 'brand-media']);

const storageCalls = calls.filter((call) => call.pathname.includes('/storage/v1/bucket/'));
assert.equal(storageCalls.length, 2);
const firstDatabaseDelete = calls.findIndex((call) => call.method === 'DELETE' && call.pathname.startsWith('/rest/v1/'));
const lastStorageDelete = Math.max(...calls.map((call, index) => call.pathname.includes('/storage/v1/bucket/') ? index : -1));
assert.ok(firstDatabaseDelete > lastStorageDelete, 'Storage deve ser esvaziado antes da exclusão dos metadados');

const hierarchyDeletes = calls
  .filter((call) => call.method === 'DELETE' && call.pathname.endsWith('/hierarchy_nodes'))
  .map((call) => new URLSearchParams(call.search).get('type'));
assert.deepEqual(hierarchyDeletes, ['eq.categoria', 'eq.secao', 'eq.departamento']);

console.log('QA de limpeza integral do catálogo: OK');
