import assert from 'node:assert/strict';
import worker from '../.wrangler-dry-run/index.js';

const requests = [];
let savedMarketing = null;
const json = value => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });

globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url);
  const method = init.method || 'GET';
  requests.push({ method, pathname: url.pathname, search: url.search });

  if (url.pathname === '/auth/v1/user') return json({ id: 'user_qa', email: 'qa@example.invalid' });
  if (url.pathname.endsWith('/company_memberships')) return json([{ company_id: 'cmp_asteryon', role: 'owner' }]);
  if (url.pathname.endsWith('/profiles')) return json([{ display_name: 'QA', email: 'qa@example.invalid' }]);
  if (url.pathname.endsWith('/marketing_settings') && method === 'GET') {
    return json([{
      theme: { primary: '#123456' }, banner: {}, video_banner: {}, carousel: { items: [] },
      settings: { source: 'qa', layout: { x: 30, y: 40, width: 900, height: 360, zIndex: 910, visible: true } },
    }]);
  }
  if (url.pathname.endsWith('/marketing_settings') && method === 'PATCH') {
    savedMarketing = JSON.parse(init.body);
    return new Response(null, { status: 204 });
  }
  if (url.pathname.endsWith('/audit_logs') && method === 'POST') return new Response(null, { status: 204 });
  throw new Error(`Requisição não simulada: ${method} ${url.pathname}${url.search}`);
};

const env = {
  ASSETS: { fetch: () => new Response('asset') },
  SUPABASE_URL: 'https://supabase.example.test',
  SUPABASE_PUBLISHABLE_KEY: 'publishable',
  SUPABASE_SECRET_KEY: 'sb_secret_qa',
};

const publicResponse = await worker.fetch(new Request('https://example.test/api/public/marketing'), env);
assert.equal(publicResponse.status, 200);
const publicPayload = await publicResponse.json();
assert.deepEqual(publicPayload.marketing.layout, { x: 30, y: 40, width: 900, height: 360, zIndex: 910, visible: true });

const updateResponse = await worker.fetch(new Request('https://example.test/api/admin/marketing', {
  method: 'PUT',
  headers: { cookie: '__Host-asteryon_access=qa-token', 'content-type': 'application/json' },
  body: JSON.stringify({ marketing: {
    theme: {}, banner: {}, videoBanner: {}, carousel: { items: [{ id: 'slide_1' }] },
    layout: { x: 75, y: 85, width: 700, height: 300, zIndex: 801, visible: false },
  } }),
}), env);

assert.equal(updateResponse.status, 200);
assert.deepEqual(savedMarketing.settings, {
  source: 'qa',
  layout: { x: 75, y: 85, width: 700, height: 300, zIndex: 801, visible: false },
});
assert.equal(savedMarketing.carousel.items.length, 1);
assert.equal(requests.filter(item => item.pathname.endsWith('/audit_logs')).length, 1);

console.log('QA de marketing móvel no Supabase: OK');
