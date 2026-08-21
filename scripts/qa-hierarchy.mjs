import assert from 'node:assert/strict';
import worker from '../.wrangler-dry-run/index.js';

const nodes = [{ id: 'dep_base', company_id: 'cmp_asteryon', type: 'departamento', name: 'Base', slug: 'base', parent_id: null, sort_order: 10, active: true, data: {} }];
const productRefs = new Set();
const audits = [];
const respond = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
const noContent = () => new Response(null, { status: 204 });
const body = (init) => init.body ? JSON.parse(String(init.body)) : null;
const cleanEq = (value) => String(value || '').replace(/^eq\./, '');
function selectedNodes(url) { const id = cleanEq(url.searchParams.get('id')); return id ? nodes.filter((node) => node.id === id) : [...nodes]; }

globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url);
  const method = String(init.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
  if (url.pathname === '/auth/v1/user') return respond({ id: 'qa-hierarchy-user', email: 'qa@example.invalid' });
  if (url.pathname === '/rest/v1/company_memberships') return respond([{ company_id: 'cmp_asteryon', role: 'editor' }]);
  if (url.pathname === '/rest/v1/hierarchy_nodes') {
    if (method === 'GET') return respond(selectedNodes(url));
    if (method === 'POST') { nodes.push(structuredClone(body(init))); return noContent(); }
    if (method === 'PATCH') { const row = nodes.find((node) => node.id === cleanEq(url.searchParams.get('id'))); assert.ok(row); Object.assign(row, body(init)); return noContent(); }
    if (method === 'DELETE') { const index = nodes.findIndex((node) => node.id === cleanEq(url.searchParams.get('id'))); if (index >= 0) nodes.splice(index, 1); return noContent(); }
  }
  if (url.pathname === '/rest/v1/products' && method === 'GET') {
    for (const column of ['departamento_id', 'secao_id', 'categoria_id']) { const id = cleanEq(url.searchParams.get(column)); if (id && productRefs.has(`${column}:${id}`)) return respond([{ id: 'product_in_use' }]); }
    return respond([]);
  }
  if (url.pathname === '/rest/v1/audit_logs' && method === 'POST') { audits.push(body(init)); return noContent(); }
  throw new Error(`Fetch não simulado no QA de hierarquia: ${method} ${url.pathname}${url.search}`);
};

const env = { ASSETS: { fetch: () => new Response('asset') }, SUPABASE_URL: 'https://supabase.example.test', SUPABASE_PUBLISHABLE_KEY: 'publishable', SUPABASE_SECRET_KEY: 'sb_secret_hierarchy' };
const headers = { cookie: '__Host-asteryon_access=qa-access', 'content-type': 'application/json' };
const call = (path, method, payload) => worker.fetch(new Request(`https://catalog.example${path}`, { method, headers, body: payload === undefined ? undefined : JSON.stringify(payload) }), env);

let response = await call('/api/admin/hierarchy', 'POST', { level: 'departamento', name: 'Food Service', sortOrder: 20 });
assert.equal(response.status, 200); let data = await response.json(); const departmentId = data.id; assert.ok(departmentId);
let department = nodes.find((node) => node.id === departmentId); assert.equal(department?.parent_id, null); assert.equal(department?.slug, 'food-service');
response = await call('/api/admin/hierarchy', 'POST', { level: 'secao', name: 'Cozinha', parentId: departmentId });
assert.equal(response.status, 200); data = await response.json(); const sectionId = data.id; let section = nodes.find((node) => node.id === sectionId); assert.equal(section?.slug, 'food-service--cozinha');
response = await call('/api/admin/hierarchy', 'POST', { level: 'categoria', name: 'Inválida', parentId: departmentId }); assert.equal(response.status, 400); assert.equal((await response.json()).error.code, 'INVALID_PARENT');
response = await call('/api/admin/hierarchy', 'POST', { level: 'categoria', name: 'Molhos', parentId: sectionId }); assert.equal(response.status, 200); data = await response.json(); const categoryId = data.id; let category = nodes.find((node) => node.id === categoryId); assert.equal(category?.slug, 'food-service--cozinha--molhos');
response = await call(`/api/admin/hierarchy/${departmentId}`, 'PUT', { name: 'Food Profissional', sortOrder: 25 }); assert.equal(response.status, 200);
department = nodes.find((node) => node.id === departmentId); section = nodes.find((node) => node.id === sectionId); category = nodes.find((node) => node.id === categoryId);
assert.equal(department?.slug, 'food-profissional'); assert.equal(section?.slug, 'food-profissional--cozinha'); assert.equal(category?.slug, 'food-profissional--cozinha--molhos');
assert.equal(audits.find((item) => item.action === 'hierarchy.update' && item.entity_id === departmentId)?.details?.previousName, 'Food Service');
response = await call(`/api/admin/hierarchy/${departmentId}`, 'DELETE'); assert.equal(response.status, 409);
productRefs.add(`categoria_id:${categoryId}`); response = await call(`/api/admin/hierarchy/${categoryId}`, 'DELETE'); assert.equal(response.status, 409); productRefs.delete(`categoria_id:${categoryId}`);
response = await call(`/api/admin/hierarchy/${categoryId}`, 'DELETE'); assert.equal(response.status, 200); assert.equal(nodes.some((node) => node.id === categoryId), false);
console.log('QA hierarquia Enterprise: níveis, pais, slugs, auditoria e exclusão segura validados.');
