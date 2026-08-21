import assert from 'node:assert/strict';
import worker from '../.wrangler-dry-run/index.js';

let page = {
  id: 'page_home', company_id: 'cmp_asteryon', slug: 'home', title: 'Home',
  draft_nodes: [{
    id: 'page_root', type: 'page', name: 'Home', x: 0, y: 0, width: 1920, height: 1080,
    responsive: { tablet: { x: 0, y: 0, width: 834, height: 1200 }, mobile: { x: 0, y: 0, width: 390, height: 1400 } },
    styles: {}, props: {}, children: [], visible: true, locked: false, opacity: 1, rotation: 0, zIndex: 0,
  }],
  published_nodes: [], revision: 1, published_revision: 0,
  settings: { resolutionPreset: '1080p' }, updated_at: '2026-08-16T00:00:00Z',
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
    if (method === 'GET') {
      const idFilter = url.searchParams.get('id');
      const pageFilter = url.searchParams.get('page_id');
      const rows = snapshots.filter((item) => {
        if (idFilter && `eq.${item.id}` !== idFilter) return false;
        if (pageFilter && `eq.${item.page_id}` !== pageFilter) return false;
        return true;
      });
      return json([...rows].reverse());
    }
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
const initialDraft = await draftGet.json();
assert.equal(initialDraft.page.revision, 1);
assert.equal(initialDraft.page.settings.resolutionPreset, '1080p');

const newNodes = [{
  id: 'node_new', type: 'page', name: 'Enterprise', x: 0, y: 0, width: 1440, height: 900,
  responsive: { tablet: { x: 0, y: 0, width: 834, height: 1000 }, mobile: { x: 0, y: 0, width: 390, height: 1200 } },
  styles: {}, props: {}, children: [], visible: true, locked: false, opacity: 1, rotation: 0, zIndex: 0,
}];
const nextSettings = { editorSchemaVersion: 5, resolutionPreset: '1440x900' };
const draftPut = await admin('https://example.test/api/admin/pages/home/draft', {
  method: 'PUT', body: JSON.stringify({ nodes: newNodes, settings: nextSettings, expectedRevision: 1 }),
});
assert.equal(draftPut.status, 200);
assert.equal((await draftPut.json()).revision, 2);
assert.deepEqual(page.draft_nodes, newNodes);
assert.deepEqual(page.settings, nextSettings, 'Configuração do editor deve acompanhar o draft');

const flatDocument = {
  rootId: 'flat_root',
  nodes: {
    flat_root: {
      id: 'flat_root', type: 'page', parentId: null, name: 'Flat', x: 0, y: 0, width: 1920, height: 1080,
      responsive: { desktop: { x: 0, y: 0, width: 1920, height: 1080 }, tablet: { x: 0, y: 0, width: 834, height: 1100 }, mobile: { x: 0, y: 0, width: 390, height: 1400 } },
      styles: {}, props: {}, children: [], visible: true, locked: false, opacity: 1, rotation: 0, zIndex: 0,
    },
  },
};
const flatPut = await admin('https://example.test/api/admin/pages/home/draft', {
  method: 'PUT', body: JSON.stringify({ nodes: flatDocument, expectedRevision: 2 }),
});
assert.equal(flatPut.status, 200, 'API deve aceitar temporariamente o documento normalizado sem quebrar o legado');
assert.equal((await flatPut.json()).revision, 3);
assert.deepEqual(page.draft_nodes, flatDocument);

const legacyPut = await admin('https://example.test/api/admin/pages/home/draft', {
  method: 'PUT', body: JSON.stringify({ nodes: newNodes, settings: nextSettings, expectedRevision: 3 }),
});
assert.equal(legacyPut.status, 200);
assert.equal((await legacyPut.json()).revision, 4);

const conflict = await admin('https://example.test/api/admin/pages/home/draft', {
  method: 'PUT', body: JSON.stringify({ nodes: [{ id: 'stale' }], expectedRevision: 1 }),
});
assert.equal(conflict.status, 409, 'Revisão obsoleta deve ser bloqueada');
assert.equal((await conflict.json()).error.code, 'REVISION_CONFLICT');

const snapshotResponse = await admin('https://example.test/api/admin/pages/home/snapshots', {
  method: 'POST', body: JSON.stringify({ label: 'Antes da publicação' }),
});
assert.equal(snapshotResponse.status, 200);
assert.equal(snapshots.length, 1);
assert.equal(snapshots[0].revision, 4);
assert.deepEqual(snapshots[0].nodes, newNodes, 'Snapshot sem nodes explícitos deve capturar o draft atual');
const snapshotId = snapshots[0].id;

const snapshotList = await admin('https://example.test/api/admin/pages/home/snapshots');
assert.equal(snapshotList.status, 200);
const snapshotListPayload = await snapshotList.json();
assert.equal(snapshotListPayload.snapshots[0].revision, 4);
assert.ok(snapshotListPayload.snapshots[0].createdAt);

page.draft_nodes = [{ ...newNodes[0], id: 'after_snapshot' }];
page.revision = 5;
const restoreSnapshot = await admin(`https://example.test/api/admin/pages/home/snapshots/${snapshotId}/restore`, { method: 'POST', body: '{}' });
assert.equal(restoreSnapshot.status, 200);
assert.deepEqual(page.draft_nodes, newNodes, 'Restauração do snapshot deve recuperar exatamente o conteúdo capturado');
assert.equal(page.revision, 6);
assert.equal(snapshots.length, 2, 'Restauração do snapshot deve criar ponto de segurança antes da troca');

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

page.draft_nodes = [{ ...newNodes[0], id: 'node_after_publish' }];
const rollback = await admin(`https://example.test/api/admin/pages/home/rollback/${publications[0].id}`, { method: 'POST', body: '{}' });
assert.equal(rollback.status, 200);
assert.deepEqual(page.draft_nodes, newNodes, 'Rollback deve restaurar nós da publicação escolhida');
assert.equal(page.revision, 7);
assert.equal(snapshots.length, 3, 'Rollback deve criar snapshot de segurança antes da restauração');
assert.ok(audits.some((item) => item.action === 'draft.save'));
assert.ok(audits.some((item) => item.action === 'snapshot.restore'));
assert.ok(audits.some((item) => item.action === 'page.publish'));
assert.ok(audits.some((item) => item.action === 'page.rollback'));

console.log('QA Páginas Enterprise: OK — draft legado/normalizado, settings, conflito, snapshots, restauração, publicação e rollback executados.');
