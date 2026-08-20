type Env = {
  SUPABASE_URL: string;
  SUPABASE_SECRET_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

type UserContext = { id: string; role: string };
type Level = 'departamento' | 'secao' | 'categoria';

type NodeRow = {
  id: string;
  company_id: string;
  type: Level;
  name: string;
  slug: string;
  parent_id: string | null;
  sort_order: number;
  active: boolean;
  data?: Record<string, unknown> | null;
};

const clean = (value: unknown) => String(value ?? '').trim();
const slugify = (value: unknown) => clean(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});
const ok = (data: Record<string, unknown> = {}) => json({ ok: true, ...data });
const fail = (message: string, status = 400, code = 'BAD_REQUEST') => json({ ok: false, error: { message, code } }, status);
const uid = () => `hier_${crypto.randomUUID()}`;

function canEdit(role: string) {
  return ['owner', 'admin', 'editor', 'SDM', 'ADMIN', 'EDITOR'].includes(clean(role));
}

function adminHeaders(env: Env, extra: HeadersInit = {}) {
  const key = clean(env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY);
  if (!key) throw new Error('SUPABASE_SECRET_KEY não configurada');
  const headers = new Headers(extra);
  headers.set('apikey', key);
  if (!key.startsWith('sb_secret_')) headers.set('authorization', `Bearer ${key}`);
  return headers;
}

async function api(env: Env, path: string, init: RequestInit = {}) {
  const headers = adminHeaders(env, init.headers);
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  const response = await fetch(`${env.SUPABASE_URL}${path}`, { ...init, headers });
  const text = await response.text();
  let data: any = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }
  return { response, data, text };
}

async function select(env: Env, table: string, query: string) {
  const result = await api(env, `/rest/v1/${table}?${query}`);
  if (!result.response.ok) throw new Error(`Supabase ${result.response.status}: ${result.text.slice(0, 300)}`);
  return Array.isArray(result.data) ? result.data : [];
}

async function mutate(env: Env, table: string, query: string, method: 'POST' | 'PATCH' | 'DELETE', body?: unknown) {
  const path = `/rest/v1/${table}${query ? `?${query}` : ''}`;
  const result = await api(env, path, {
    method,
    headers: { prefer: 'return=minimal' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!result.response.ok) throw new Error(`Supabase ${result.response.status}: ${result.text.slice(0, 300)}`);
}

async function audit(env: Env, companyId: string, userId: string, action: string, entityId: string, details: unknown) {
  await mutate(env, 'audit_logs', '', 'POST', {
    company_id: companyId,
    user_id: userId || null,
    action,
    entity_type: 'hierarchy',
    entity_id: entityId,
    details,
  });
}

async function allNodes(env: Env, companyId: string): Promise<NodeRow[]> {
  return await select(
    env,
    'hierarchy_nodes',
    `company_id=eq.${encodeURIComponent(companyId)}&select=id,company_id,type,name,slug,parent_id,sort_order,active,data&order=sort_order.asc,name.asc`,
  ) as NodeRow[];
}

function expectedParent(level: Level): Level | null {
  if (level === 'departamento') return null;
  if (level === 'secao') return 'departamento';
  return 'secao';
}

function nodeSlug(level: Level, name: string, parent: NodeRow | null) {
  const own = slugify(name);
  return level === 'departamento' || !parent ? own : `${parent.slug}--${own}`;
}

function duplicateNode(nodes: NodeRow[], level: Level, parentId: string | null, name: string, ignoreId?: string) {
  const wanted = slugify(name);
  return nodes.find(node =>
    node.id !== ignoreId &&
    node.type === level &&
    (node.parent_id || null) === parentId &&
    slugify(node.name) === wanted
  );
}

async function createNode(req: Request, env: Env, companyId: string, user: UserContext) {
  const input = await req.json().catch(() => ({})) as any;
  const level = clean(input.level || input.type) as Level;
  if (!['departamento', 'secao', 'categoria'].includes(level)) return fail('Nível inválido', 400, 'INVALID_LEVEL');
  const name = clean(input.name);
  if (!name) return fail('Informe o nome', 400, 'NAME_REQUIRED');

  const nodes = await allNodes(env, companyId);
  const parentLevel = expectedParent(level);
  const parentId = level === 'departamento' ? null : clean(input.parentId) || null;
  let parent: NodeRow | null = null;

  if (parentLevel) {
    if (!parentId) return fail(level === 'secao' ? 'Selecione o departamento superior' : 'Selecione a seção superior', 400, 'PARENT_REQUIRED');
    parent = nodes.find(node => node.id === parentId) || null;
    if (!parent || parent.type !== parentLevel) {
      return fail(`O item pai precisa ser ${parentLevel === 'departamento' ? 'um Departamento' : 'uma Seção'}`, 400, 'INVALID_PARENT');
    }
  } else if (clean(input.parentId)) {
    return fail('Departamento não pode possuir item pai', 400, 'INVALID_PARENT');
  }

  if (duplicateNode(nodes, level, parentId, name)) return fail('Já existe um item com este nome neste nível', 409, 'DUPLICATE');

  const id = uid();
  const row = {
    id,
    company_id: companyId,
    type: level,
    name,
    slug: nodeSlug(level, name, parent),
    parent_id: parentId,
    sort_order: Number.isFinite(Number(input.sortOrder)) ? Number(input.sortOrder) : 100,
    active: input.status !== 'inactive',
    data: {},
  };
  await mutate(env, 'hierarchy_nodes', '', 'POST', row);
  await audit(env, companyId, user.id, 'hierarchy.create', id, { level, name, parentId });
  return ok({ id, node: { ...row, level, parentId, sortOrder: row.sort_order, status: row.active ? 'active' : 'inactive' } });
}

async function updateDescendantSlugs(env: Env, companyId: string, nodes: NodeRow[], rootId: string, rootSlug: string) {
  const visit = async (parentId: string, parentSlug: string) => {
    const children = nodes.filter(node => node.parent_id === parentId);
    for (const child of children) {
      const nextSlug = `${parentSlug}--${slugify(child.name)}`;
      if (nextSlug !== child.slug) {
        await mutate(
          env,
          'hierarchy_nodes',
          `id=eq.${encodeURIComponent(child.id)}&company_id=eq.${encodeURIComponent(companyId)}`,
          'PATCH',
          { slug: nextSlug },
        );
        child.slug = nextSlug;
      }
      await visit(child.id, nextSlug);
    }
  };
  await visit(rootId, rootSlug);
}

async function updateNode(req: Request, env: Env, companyId: string, user: UserContext, id: string) {
  const input = await req.json().catch(() => ({})) as any;
  const nodes = await allNodes(env, companyId);
  const current = nodes.find(node => node.id === id);
  if (!current) return fail('Item da hierarquia não encontrado', 404, 'NOT_FOUND');

  const previousName = current.name;
  const name = clean(input.name);
  if (!name) return fail('Informe o nome', 400, 'NAME_REQUIRED');
  const parent = current.parent_id ? nodes.find(node => node.id === current.parent_id) || null : null;
  if (duplicateNode(nodes, current.type, current.parent_id, name, id)) return fail('Já existe um item com este nome neste nível', 409, 'DUPLICATE');

  const nextSlug = nodeSlug(current.type, name, parent);
  const patch = {
    name,
    slug: nextSlug,
    active: input.status === undefined ? current.active : input.status !== 'inactive',
    sort_order: Number.isFinite(Number(input.sortOrder)) ? Number(input.sortOrder) : current.sort_order,
  };
  await mutate(
    env,
    'hierarchy_nodes',
    `id=eq.${encodeURIComponent(id)}&company_id=eq.${encodeURIComponent(companyId)}`,
    'PATCH',
    patch,
  );
  current.name = name;
  current.slug = nextSlug;
  current.active = patch.active;
  await updateDescendantSlugs(env, companyId, nodes, id, nextSlug);
  await audit(env, companyId, user.id, 'hierarchy.update', id, { level: current.type, name, previousName, slug: nextSlug });
  return ok({ id });
}

async function countProductsUsing(env: Env, companyId: string, node: NodeRow) {
  const column = node.type === 'departamento' ? 'departamento_id' : node.type === 'secao' ? 'secao_id' : 'categoria_id';
  const rows = await select(
    env,
    'products',
    `company_id=eq.${encodeURIComponent(companyId)}&${column}=eq.${encodeURIComponent(node.id)}&select=id&limit=1`,
  );
  return rows.length;
}

async function deleteNode(env: Env, companyId: string, user: UserContext, id: string) {
  const nodes = await allNodes(env, companyId);
  const current = nodes.find(node => node.id === id);
  if (!current) return fail('Item da hierarquia não encontrado', 404, 'NOT_FOUND');
  if (nodes.some(node => node.parent_id === id)) return fail('Não é possível excluir: existem itens abaixo deste nível', 409, 'IN_USE');
  if (await countProductsUsing(env, companyId, current)) return fail('Não é possível excluir: existem produtos vinculados', 409, 'IN_USE');

  await mutate(
    env,
    'hierarchy_nodes',
    `id=eq.${encodeURIComponent(id)}&company_id=eq.${encodeURIComponent(companyId)}`,
    'DELETE',
  );
  await audit(env, companyId, user.id, 'hierarchy.delete', id, { level: current.type, name: current.name });
  return ok({ id });
}

export async function handleHierarchyRoute(
  req: Request,
  env: Env,
  path: string,
  companyId: string,
  user: UserContext,
): Promise<Response | null> {
  if (!path.startsWith('/api/admin/hierarchy')) return null;
  if (!canEdit(user.role)) return fail('Permissão insuficiente', 403, 'FORBIDDEN');

  if (path === '/api/admin/hierarchy' && req.method === 'POST') return createNode(req, env, companyId, user);
  const match = path.match(/^\/api\/admin\/hierarchy\/([^/]+)$/);
  if (!match) return null;
  const id = decodeURIComponent(match[1]);
  if (req.method === 'PUT') return updateNode(req, env, companyId, user, id);
  if (req.method === 'DELETE') return deleteNode(env, companyId, user, id);
  return null;
}
