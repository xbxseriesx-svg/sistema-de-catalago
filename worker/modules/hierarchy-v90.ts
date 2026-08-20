type Env = {
  SUPABASE_URL: string;
  SUPABASE_SECRET_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

type UserContext = {
  id: string;
  role: string;
};

const clean = (value: unknown) => String(value ?? '').trim();
const slug = (value: unknown) => clean(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');
const uid = () => `hier_${crypto.randomUUID()}`;
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});
const ok = (data: Record<string, unknown> = {}) => json({ ok: true, ...data });
const fail = (message: string, status = 400, code = 'BAD_REQUEST') => json({ ok: false, error: { message, code } }, status);

function adminHeaders(env: Env, extra: HeadersInit = {}) {
  const key = clean(env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY);
  if (!key) throw new Error('SUPABASE_SECRET_KEY não configurada');
  const headers = new Headers(extra);
  headers.set('apikey', key);
  if (!key.startsWith('sb_secret_')) headers.set('authorization', `Bearer ${key}`);
  return headers;
}

async function request(env: Env, table: string, query = '', init: RequestInit = {}) {
  const headers = adminHeaders(env, init.headers);
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}${query ? `?${query}` : ''}`, { ...init, headers });
  const text = await response.text();
  return { response, text, data: text ? (() => { try { return JSON.parse(text); } catch { return null; } })() : null };
}

async function select(env: Env, table: string, query: string) {
  const result = await request(env, table, query);
  if (!result.response.ok) throw new Error(`Supabase ${result.response.status}: ${result.text.slice(0, 300)}`);
  return Array.isArray(result.data) ? result.data : [];
}

async function audit(env: Env, companyId: string, userId: string, action: string, entityType: string, entityId: string, details: unknown = {}) {
  const result = await request(env, 'audit_logs', '', {
    method: 'POST',
    headers: { prefer: 'return=minimal' },
    body: JSON.stringify({ company_id: companyId, user_id: userId, action, entity_type: entityType, entity_id: entityId, details }),
  });
  if (!result.response.ok) throw new Error(`Falha de auditoria ${result.response.status}: ${result.text.slice(0, 200)}`);
}

function canEdit(role: string) {
  return ['owner', 'admin', 'editor', 'SDM', 'ADMIN', 'EDITOR'].includes(clean(role));
}

export async function handleHierarchyRoute(
  req: Request,
  env: Env,
  path: string,
  companyId: string,
  user: UserContext,
): Promise<Response | null> {
  const collection = path === '/api/admin/hierarchy';
  const item = path.match(/^\/api\/admin\/hierarchy\/([^/]+)$/);
  if (!collection && !item) return null;
  if (!canEdit(user.role)) return fail('Permissão insuficiente', 403, 'FORBIDDEN');

  if (collection && req.method === 'POST') {
    const input = await req.json().catch(() => ({})) as any;
    const type = clean(input.level || input.type);
    if (!['departamento', 'secao', 'categoria'].includes(type)) return fail('Nível inválido');

    const name = clean(input.name);
    if (!name) return fail('Informe o nome');

    let parentId = clean(input.parentId) || null;
    if (type === 'departamento') parentId = null;
    if (type !== 'departamento' && !parentId) return fail('Informe o item pai');

    if (parentId) {
      const expectedParent = type === 'secao' ? 'departamento' : 'secao';
      const parent = await select(
        env,
        'hierarchy_nodes',
        `id=eq.${encodeURIComponent(parentId)}&company_id=eq.${encodeURIComponent(companyId)}&type=eq.${expectedParent}&select=id,type&limit=1`,
      );
      if (!parent.length) return fail(`Item pai inválido para ${type}`, 400, 'INVALID_PARENT');
    }

    const id = uid();
    const nodeSlug = type === 'departamento' ? slug(name) : `${slug(parentId)}--${slug(name)}`;
    const result = await request(env, 'hierarchy_nodes', '', {
      method: 'POST',
      headers: { prefer: 'return=minimal' },
      body: JSON.stringify({
        id,
        company_id: companyId,
        type,
        name,
        slug: nodeSlug,
        parent_id: parentId,
        sort_order: Number(input.sortOrder || 0),
        active: input.status !== 'inactive',
        data: {},
      }),
    });
    if (!result.response.ok) {
      if (result.response.status === 409) return fail('Já existe um item com este nome nessa posição', 409, 'DUPLICATE');
      throw new Error(`Supabase ${result.response.status}: ${result.text.slice(0, 300)}`);
    }
    await audit(env, companyId, user.id, 'hierarchy.create', type, id, { parentId, name });
    return ok({ id, type, name, parentId });
  }

  if (!item || !['PUT', 'DELETE'].includes(req.method)) return null;
  const id = decodeURIComponent(item[1]);
  const existing = await select(
    env,
    'hierarchy_nodes',
    `id=eq.${encodeURIComponent(id)}&company_id=eq.${encodeURIComponent(companyId)}&select=id,type,name,parent_id,sort_order,active&limit=1`,
  );
  const node = existing[0];
  if (!node) return fail('Item da hierarquia não encontrado', 404, 'NOT_FOUND');

  if (req.method === 'DELETE') {
    const result = await request(
      env,
      'hierarchy_nodes',
      `id=eq.${encodeURIComponent(id)}&company_id=eq.${encodeURIComponent(companyId)}`,
      { method: 'DELETE', headers: { prefer: 'return=minimal' } },
    );
    if (!result.response.ok) {
      if ([400, 409].includes(result.response.status)) return fail('Não é possível excluir um item da hierarquia que ainda está em uso', 409, 'IN_USE');
      throw new Error(`Supabase ${result.response.status}: ${result.text.slice(0, 300)}`);
    }
    await audit(env, companyId, user.id, 'hierarchy.delete', node.type, id, { name: node.name });
    return ok({ id });
  }

  const input = await req.json().catch(() => ({})) as any;
  const name = clean(input.name);
  if (!name) return fail('Informe o nome');
  const nodeSlug = node.type === 'departamento' ? slug(name) : `${slug(node.parent_id)}--${slug(name)}`;
  const result = await request(
    env,
    'hierarchy_nodes',
    `id=eq.${encodeURIComponent(id)}&company_id=eq.${encodeURIComponent(companyId)}`,
    {
      method: 'PATCH',
      headers: { prefer: 'return=minimal' },
      body: JSON.stringify({
        name,
        slug: nodeSlug,
        active: input.status !== 'inactive',
        sort_order: Number(input.sortOrder ?? node.sort_order ?? 0),
      }),
    },
  );
  if (!result.response.ok) {
    if (result.response.status === 409) return fail('Já existe um item com este nome nessa posição', 409, 'DUPLICATE');
    throw new Error(`Supabase ${result.response.status}: ${result.text.slice(0, 300)}`);
  }
  await audit(env, companyId, user.id, 'hierarchy.update', node.type, id, { previousName: node.name, name });
  return ok({ id, name, slug: nodeSlug });
}
