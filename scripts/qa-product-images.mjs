import assert from 'node:assert/strict';
import worker from '../.wrangler-dry-run/index.js';

const calls = [];
const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: { 'content-type': 'application/json' },
});

function methodOf(input, init = {}) {
  return String(init.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
}

globalThis.fetch = async (input, init = {}) => {
  const request = input instanceof Request ? input : new Request(String(input), init);
  const url = new URL(request.url);
  const method = methodOf(input, init);
  calls.push({ method, pathname: url.pathname, search: url.search });

  if (url.pathname === '/auth/v1/user') return json({ id: 'user_image', email: 'image@example.invalid' });
  if (url.pathname === '/rest/v1/company_memberships') return json([{ company_id: 'cmp_asteryon', role: 'owner', active: true }]);
  if (url.pathname === '/rest/v1/profiles') return json([{ display_name: 'QA Imagem', email: 'image@example.invalid' }]);

  if (url.pathname === '/rest/v1/products' && method === 'GET') {
    return json([{ id: 'prd_100', code: '100', image_url: null, gallery: [], data: { code: '100', name: 'Produto QA' } }]);
  }
  if (url.pathname === '/rest/v1/media_assets' && method === 'GET') return json([]);
  if (url.pathname === '/rest/v1/media_assets' && method === 'POST') return new Response(null, { status: 204 });
  if (url.pathname === '/rest/v1/products' && method === 'PATCH') return new Response(null, { status: 204 });
  if (url.pathname === '/rest/v1/product_media' && ['POST', 'DELETE'].includes(method)) return new Response(null, { status: 204 });
  if (url.pathname === '/rest/v1/audit_logs' && method === 'POST') return new Response(null, { status: 204 });
  if (url.pathname.startsWith('/storage/v1/object/product-images/') && method === 'POST') return json({ Key: url.pathname.slice('/storage/v1/object/'.length) });

  throw new Error(`Requisição não simulada no QA de imagem: ${method} ${url.pathname}${url.search}`);
};

const env = {
  ASSETS: { fetch: () => new Response('asset') },
  SUPABASE_URL: 'https://supabase.example.test',
  SUPABASE_PUBLISHABLE_KEY: 'publishable',
  SUPABASE_SECRET_KEY: 'sb_secret_product_image',
};

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const response = await worker.fetch(new Request('https://catalog.example.test/api/admin/product-images/import?code=100&filename=foto.png&originalFilename=foto.png&sourceSize=8', {
  method: 'POST',
  headers: {
    origin: 'https://catalog.example.test',
    cookie: '__Host-asteryon_access=image-token',
    'content-type': 'image/png',
  },
  body: png,
}), env);

assert.equal(response.status, 200, 'upload binário de imagem deve funcionar no Worker Enterprise');
const payload = await response.json();
assert.equal(payload.ok, true);
assert.equal(payload.code, '100');
assert.equal(payload.productId, 'prd_100');
assert.match(payload.url, /\/storage\/v1\/object\/public\/product-images\/100\/main\.png\?v=/);
assert.match(payload.sha256, /^[0-9a-f]{64}$/);
assert.ok(calls.some((call) => call.pathname.startsWith('/storage/v1/object/product-images/100/main.png') && call.method === 'POST'), 'arquivo deve ser enviado ao bucket product-images');
assert.ok(calls.some((call) => call.pathname === '/rest/v1/products' && call.method === 'PATCH'), 'produto deve receber URL e galeria atualizadas');
assert.ok(calls.some((call) => call.pathname === '/rest/v1/product_media' && call.method === 'POST'), 'vínculo principal de product_media deve ser recriado');
assert.ok(calls.some((call) => call.pathname === '/rest/v1/audit_logs' && call.method === 'POST'), 'importação deve gerar auditoria');

console.log('QA imagens de produto: upload Supabase Storage, metadados, produto, vínculo principal e auditoria validados.');
