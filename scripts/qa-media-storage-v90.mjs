import assert from 'node:assert/strict';
import worker from '../.wrangler-dry-run/index.js';

const state = { created: null, storagePosts: 0, storageDeletes: 0, dbDeletes: 0, audits: 0 };
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });

function methodOf(input, init = {}) {
  return String(init.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
}
function bodyOf(init = {}) { return init.body == null ? null : init.body; }

globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url);
  const method = methodOf(input, init);
  const body = bodyOf(init);

  if (url.pathname === '/auth/v1/user') return json({ id: 'user-media-v90', email: 'qa@example.invalid' });
  if (url.pathname === '/rest/v1/company_memberships') return json([{ company_id: 'cmp_asteryon', role: 'editor' }]);

  if (url.pathname === '/rest/v1/media_assets' && method === 'GET') {
    const id = String(url.searchParams.get('id') || '').replace(/^eq\./, '');
    if (id === 'media_v90_created') {
      if (url.searchParams.get('select') === 'id') return json([{ id }]);
      return json([state.created]);
    }
    if (url.searchParams.has('sha256') && state.created) return json([state.created]);
    return json([]);
  }

  if (url.pathname === '/rest/v1/media_assets' && method === 'POST') {
    const payload = JSON.parse(String(body || '{}'));
    assert.equal(payload.bucket, 'marketing-media');
    assert.equal(payload.owner_type, 'marketing');
    assert.equal(payload.kind, 'carousel-image');
    assert.equal(payload.mime_type, 'image/png');
    assert.equal(payload.metadata?.storageProvider, 'supabase-storage');
    assert.equal('dataBase64' in (payload.metadata || {}), false, 'Base64 nunca pode ser persistido no metadata');
    state.created = { ...payload, id: 'media_v90_created' };
    return new Response('', { status: 201 });
  }

  if (url.pathname === '/rest/v1/media_assets' && method === 'DELETE') {
    state.dbDeletes++;
    return new Response(null, { status: 204 });
  }

  if (url.pathname === '/rest/v1/audit_logs' && method === 'POST') {
    state.audits++;
    return new Response('', { status: 201 });
  }

  if (url.pathname.startsWith('/storage/v1/object/marketing-media/')) {
    if (method === 'POST') {
      state.storagePosts++;
      assert.equal(new Headers(init.headers).get('content-type'), 'image/png');
      assert.ok(body instanceof ArrayBuffer, 'Storage deve receber bytes, não texto Base64');
      return json({ Key: url.pathname });
    }
    if (method === 'DELETE') {
      state.storageDeletes++;
      return json({});
    }
  }

  throw new Error(`Fetch não simulado no QA de mídia V90: ${method} ${url.pathname}${url.search}`);
};

const env = {
  ASSETS: { fetch: () => new Response('asset') },
  SUPABASE_URL: 'https://supabase.example.test',
  SUPABASE_PUBLISHABLE_KEY: 'publishable',
  SUPABASE_SECRET_KEY: 'sb_secret_media_v90',
};
const authHeaders = { cookie: '__Host-asteryon_access=media-access', 'content-type': 'application/json' };
const png = 'iVBORw0KGgo=';

let response = await worker.fetch(new Request('https://catalog.example/api/admin/media', {
  method: 'POST',
  headers: authHeaders,
  body: JSON.stringify({ dataBase64: png, contentType: 'image/png', filename: 'slide.png', kind: 'carousel-image', entityKey: 'home-carousel' }),
}), env);
assert.equal(response.status, 200);
let payload = await response.json();
assert.equal(payload.ok, true);
assert.equal(payload.deduplicated, false);
assert.match(payload.url, /\/storage\/v1\/object\/public\/marketing-media\//);
assert.equal(state.storagePosts, 1);
assert.equal(state.audits, 1);

// Mesmo conteúdo deve reutilizar a mídia canônica e não enviar bytes novamente.
response = await worker.fetch(new Request('https://catalog.example/api/admin/media', {
  method: 'POST',
  headers: authHeaders,
  body: JSON.stringify({ dataBase64: png, contentType: 'image/png', filename: 'slide-copia.png', kind: 'carousel-image', entityKey: 'home-carousel' }),
}), env);
assert.equal(response.status, 200);
payload = await response.json();
assert.equal(payload.deduplicated, true);
assert.equal(state.storagePosts, 1, 'deduplicação não pode gravar segundo objeto no Storage');

// Conteúdo que mente sobre MIME deve ser bloqueado antes do Storage.
response = await worker.fetch(new Request('https://catalog.example/api/admin/media', {
  method: 'POST',
  headers: authHeaders,
  body: JSON.stringify({ dataBase64: 'QUJDREVGRw==', contentType: 'image/png', filename: 'fake.png', kind: 'carousel-image' }),
}), env);
assert.equal(response.status, 415);
assert.equal((await response.json()).error.code, 'INVALID_MEDIA_CONTENT');
assert.equal(state.storagePosts, 1);

response = await worker.fetch(new Request('https://catalog.example/api/admin/media/media_v90_created', {
  method: 'DELETE', headers: { cookie: '__Host-asteryon_access=media-access' },
}), env);
assert.equal(response.status, 200);
assert.equal((await response.json()).ok, true);
assert.equal(state.storageDeletes, 1, 'exclusão deve remover o objeto físico do Storage');
assert.equal(state.dbDeletes, 1, 'exclusão deve remover o registro media_assets');
assert.equal(state.audits, 2, 'upload e delete devem ficar auditados');

console.log('QA V90 mídia: Storage real, SHA dedupe, MIME e exclusão física validados; nenhum Base64 persistido.');
