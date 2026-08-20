import assert from 'node:assert/strict';
import worker from '../.wrangler-dry-run/index.js';

const writes = [];
const queries = [];
const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: { 'content-type': 'application/json' },
});

function methodOf(input, init = {}) {
  if (init.method) return init.method.toUpperCase();
  if (input instanceof Request) return input.method.toUpperCase();
  return 'GET';
}

function bodyOf(input, init = {}) {
  if (init.body != null) return String(init.body);
  return null;
}

globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url);
  const method = methodOf(input, init);
  const body = bodyOf(input, init);
  queries.push({ pathname: url.pathname, search: url.search, method });

  if (url.pathname === '/auth/v1/user') {
    return json({ id: 'user_v90', email: 'v90@example.invalid' });
  }

  if (url.pathname === '/rest/v1/company_memberships') {
    return json([{ company_id: 'cmp_asteryon', role: 'editor' }]);
  }

  if (url.pathname === '/rest/v1/audit_logs' && method === 'POST') {
    writes.push({ table: 'audit_logs', method, body: JSON.parse(body || '{}') });
    return new Response('', { status: 201 });
  }

  if (url.pathname === '/rest/v1/hierarchy_nodes') {
    if (method === 'POST') {
      const payload = JSON.parse(body || '{}');
      writes.push({ table: 'hierarchy_nodes', method, body: payload });
      return new Response('', { status: 201 });
    }
    if (method === 'PATCH') {
      const payload = JSON.parse(body || '{}');
      writes.push({ table: 'hierarchy_nodes', method, search: url.search, body: payload });
      return new Response('', { status: 204 });
    }
    if (method === 'DELETE') {
      const id = url.searchParams.get('id');
      if (id === 'eq.dep_in_use') return json({ message: 'foreign key violation' }, 409);
      writes.push({ table: 'hierarchy_nodes', method, search: url.search });
      return new Response('', { status: 204 });
    }

    const id = String(url.searchParams.get('id') || '').replace(/^eq\./, '');
    const type = String(url.searchParams.get('type') || '').replace(/^eq\./, '');

    // scopedWriteExists precisa apenas confirmar que o registro pertence ao tenant.
    if (url.searchParams.get('select') === 'id' && ['dep1', 'sec1', 'dep_in_use'].includes(id)) {
      return json([{ id }]);
    }

    if (id === 'dep1') {
      if (type && type !== 'departamento') return json([]);
      return json([{ id: 'dep1', type: 'departamento', name: 'Atacado', parent_id: null, sort_order: 10, active: true }]);
    }
    if (id === 'sec1') {
      if (type && type !== 'secao') return json([]);
      return json([{ id: 'sec1', type: 'secao', name: 'Bebidas', parent_id: 'dep1', sort_order: 20, active: true }]);
    }
    if (id === 'dep_in_use') {
      return json([{ id: 'dep_in_use', type: 'departamento', name: 'Em uso', parent_id: null, sort_order: 30, active: true }]);
    }
    return json([]);
  }

  throw new Error(`Fetch não simulado no QA V90: ${method} ${url.pathname}${url.search}`);
};

const env = {
  ASSETS: { fetch: () => new Response('asset') },
  SUPABASE_URL: 'https://supabase.example.test',
  SUPABASE_PUBLISHABLE_KEY: 'publishable',
  SUPABASE_SECRET_KEY: 'sb_secret_v90',
  REMOTE_IMAGE_HMAC_SECRET: 'remote-hmac-v90',
};

const request = (path, method, payload) => new Request(`https://catalog.example${path}`, {
  method,
  headers: {
    cookie: '__Host-asteryon_access=access-v90',
    ...(payload ? { 'content-type': 'application/json' } : {}),
  },
  body: payload ? JSON.stringify(payload) : undefined,
});

writes.length = 0;
let response = await worker.fetch(request('/api/admin/hierarchy', 'POST', {
  level: 'departamento',
  name: 'Food Service QA',
  sortOrder: 40,
}), env);
assert.equal(response.status, 200, 'Departamento deve ser criado manualmente');
let created = writes.find(item => item.table === 'hierarchy_nodes' && item.method === 'POST');
assert.equal(created?.body?.type, 'departamento');
assert.equal(created?.body?.parent_id, null, 'Departamento não possui pai');
assert.equal(created?.body?.slug, 'food-service-qa');

writes.length = 0;
response = await worker.fetch(request('/api/admin/hierarchy', 'POST', {
  level: 'secao',
  name: 'Cozinha QA',
  parentId: 'dep1',
}), env);
assert.equal(response.status, 200, 'Seção sob Departamento válido deve ser criada');
created = writes.find(item => item.table === 'hierarchy_nodes' && item.method === 'POST');
assert.equal(created?.body?.type, 'secao');
assert.equal(created?.body?.parent_id, 'dep1');

writes.length = 0;
response = await worker.fetch(request('/api/admin/hierarchy', 'POST', {
  level: 'categoria',
  name: 'Molhos QA',
  parentId: 'sec1',
}), env);
assert.equal(response.status, 200, 'Categoria sob Seção válida deve ser criada');
created = writes.find(item => item.table === 'hierarchy_nodes' && item.method === 'POST');
assert.equal(created?.body?.type, 'categoria');
assert.equal(created?.body?.parent_id, 'sec1');

response = await worker.fetch(request('/api/admin/hierarchy', 'POST', {
  level: 'categoria',
  name: 'Categoria inválida',
  parentId: 'dep1',
}), env);
assert.equal(response.status, 400, 'Categoria não pode ser ligada diretamente a Departamento');
assert.equal((await response.json()).error.code, 'INVALID_PARENT');

writes.length = 0;
response = await worker.fetch(request('/api/admin/hierarchy/dep1', 'PUT', {
  name: 'Atacado Premium',
  status: 'active',
  sortOrder: 11,
}), env);
assert.equal(response.status, 200, 'Renomear Departamento deve funcionar');
const patched = writes.find(item => item.table === 'hierarchy_nodes' && item.method === 'PATCH');
assert.equal(patched?.body?.name, 'Atacado Premium');
assert.equal(patched?.body?.slug, 'atacado-premium', 'Renomear deve manter slug coerente');
assert.match(patched?.search || '', /company_id=eq\.cmp_asteryon/, 'update deve permanecer no tenant');

response = await worker.fetch(request('/api/admin/hierarchy/dep_in_use', 'DELETE'), env);
assert.equal(response.status, 409, 'Item da hierarquia em uso não pode ser apagado');
assert.equal((await response.json()).error.code, 'IN_USE');

assert.ok(
  queries.some(item => item.pathname === '/rest/v1/hierarchy_nodes' && item.search.includes('type=eq.departamento')),
  'criação de Seção deve validar o tipo do pai',
);
assert.ok(
  queries.some(item => item.pathname === '/rest/v1/hierarchy_nodes' && item.search.includes('type=eq.secao')),
  'criação de Categoria deve validar o tipo do pai',
);

console.log('QA V90 hierarquia: Departamento/Seção/Categoria, pai válido, slug, tenant e IN_USE validados.');
