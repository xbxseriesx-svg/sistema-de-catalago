import assert from 'node:assert/strict';
import worker from '../.wrangler-dry-run/index.js';

let page = {
  id: 'page_home', company_id: 'cmp_asteryon', slug: 'home', title: 'Home',
  draft_nodes: [{ id: 'node_initial' }], published_nodes: [], revision: 1, published_revision: 0,
  settings: {}, updated_at: '2026-08-16T00:00:00Z',
};
const snapshots = [];
const publications = [];
const audits = [];
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });

globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url);
  const method = init.method || 'GET';
  if (url.pathname === '/auth/v1/user') return json({ id: 'user_page', email: 'page@example.invalid' });
  if (url.pathname === '/rest/v1/company_memberships') return json([{ company_id: 'cmp_asteryon', role: 'owner' }]);
  if (url.pathname === '/rest/v1/profiles') return json([{ display_name: 'QA Page', email: 'page@example.invalid' }]);

  if (url.pathname === '/rest/v1/pages') {
    if (method === 'GET') return json([page]);
    if (method === 'PATCH') {
      page = { ...page, ...JSON.parse(init.body), updated_at: '2026-08-16T01:00:00Z' };
      return new Response(null, { status: 204 });
    }
  }
  if (url.pathname === '/rest/v1/page_snapshots') {
    if (method === 'GET') return json([...snapshots].reverse());
    if (method === 'POST') {
      snapshots.push({ ...JSON.parse(init.body), created_at: '2026-08-16T01:01:00Z' });
      return new Response(null, { status: 204 });
    }
  }
  if (url.pathname === '/rest/v1/page_publications') {
    if (method === 'POST') {
      publications.push({ ...JSON.parse(init.body), created_at: '2026-08-16T01:02:00Z' });
      return new Response(null, { status: 204 });
    }
    if (method === 'GET') {
      const idFilter = url.searchParams.get('id');
      const rows = idFilter ? publications.filter((x) => `eq.${x.id}` === idFilter) : publications;
      return json([...rows].reverse());
    }
  }
  if (url.pathname === '/rest/v1/audit_logs' && method === 'POST') {
    audits.push(JSON.parse(init.body));
    return new Response(null, { status: 204 });
  }
  throw new Error(`Lifecycle fetch não simulado: ${method} ${url.pathname}${url.search}`);
};

const env = {
  ASSETS: { fetch: () => new Response('asset') },
  SUPABASE_URL: 'https://supabase.example.test',
  SUPABASE_PUBLISHABLE_KEY: 'publishable',
  SUPABASE_SECRET_KEY: 'sb_secret_pages',
};
const cookie = '__Host-asteryon_access=page-token';
const admin = (url, options = {}) => worker.fetch(new Request(url, { ...options, headers: { cookie, 'content-type': 'application/json', ...(options.headers || {}) } }), env);

const draftGet = await admin('https://example.test/api/admin/pages/home/draft');
assert.equal(draftGet.status, 200);
assert.equal((await draftGet.json()).page.revision, 1);

const newNodes = [{ id: 'node_new', type: 'text' }];
const draftPut = await admin('https://example.test/api/admin/pages/home/draft', {
  method: 'PUT', body: JSON.stringify({ nodes: newNodes, expectedRevision: 1 }),
});
assert.equal(draftPut.status, 200);
assert.equal((await draftPut.json()).revision, 2);
assert.deepEqual(page.draft_nodes, newNodes);

const conflict = await admin('https://example.test/api/admin/pages/home/draft', {
  method: 'PUT', body: JSON.stringify({ nodes: [{ id: 'stale' }], expectedRevision: 1 }),
});
assert.equal(conflict.status, 409, 'Revisão obsoleta deve ser bloqueada');
assert.equal((await conflict.json()).error.code, 'REVISION_CONFLICT');

const snapshotResponse = await admin('https://example.test/api/admin/pages/home/snapshots', {
  method: 'POST', body: JSON.stringify({ nodes: newNodes, label: 'Antes da publicação' }),
});
assert.equal(snapshotResponse.status, 200);
assert.equal(snapshots.length, 1);
assert.equal(snapshots[0].revision, 2);

const publish = await admin('https://example.test/api/admin/pages/home/publish', { method: 'POST', body: '{}' });
assert.equal(publish.status, 200);
const publicationPayload = await publish.json();
assert.equal(publicationPayload.publication.versionNumber, 1);
assert.equal(publications.length, 1);
assert.deepEqual(page.published_nodes, newNodes);
assert.equal(page.published_revision, 1);

const publicPage = await worker.fetch(new Request('https://example.test/api/public/pages/home'), env);
assert.equal(publicPage.status, 200);
const publicPayload = await publicPage.json();
assert.equal(publicPayload.page.versionNumber, 1);
assert.deepEqual(publicPayload.page.nodes, newNodes);

const versions = await admin('https://example.test/api/admin/pages/home/versions');
assert.equal(versions.status, 200);
const versionsPayload = await versions.json();
assert.equal(versionsPayload.versions.length, 1);
assert.equal(versionsPayload.versions[0].version_number, 1);

page.draft_nodes = [{ id: 'node_after_publish' }];
const rollback = await admin(`https://example.test/api/admin/pages/home/rollback/${publications[0].id}`, { method: 'POST', body: '{}' });
assert.equal(rollback.status, 200);
assert.deepEqual(page.draft_nodes, newNodes, 'Rollback deve restaurar nós da publicação escolhida');
assert.equal(page.revision, 3);
assert.equal(snapshots.length, 2, 'Rollback deve criar snapshot de segurança antes da restauração');
assert.ok(audits.some((item) => item.action === 'draft.save'));
assert.ok(audits.some((item) => item.action === 'page.publish'));

console.log('QA Páginas V81: OK — draft, conflito de revisão, snapshot, publicação pública, versões e rollback executados.');
