type Role = 'SDM' | 'ADMIN' | 'EDITOR' | 'VIEWER';
type Env = {
  ASSETS: Fetcher;
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  SUPABASE_SECRET_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SDM_BOOTSTRAP_TOKEN?: string;
};

const COMPANY_ID = 'qa_e2e_asteryon';
const ACCESS_COOKIE = '__Host-asteryon_access';
const REFRESH_COOKIE = '__Host-asteryon_refresh';

const json = (data: unknown, status = 200, extra: HeadersInit = {}) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra },
});
const ok = (data: Record<string, unknown> = {}) => json({ ok: true, ...data });
const fail = (message: string, status = 400, code = 'BAD_REQUEST') => json({ ok: false, error: { message, code } }, status);
const body = async (req: Request) => { try { return await req.json() as any; } catch { return {}; } };
const uid = (prefix = 'id') => `${prefix}_${crypto.randomUUID()}`;
const clean = (value: unknown) => String(value ?? '').trim();
const slug = (value: unknown) => clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function normalizeDepartment(value: unknown) {
  const key = slug(value);
  if (['atacado', 'atacadista', 'wholesale'].includes(key)) return 'Atacado';
  if (['distribuicao', 'distribuidor', 'distribution'].includes(key)) return 'Distribuição';
  return clean(value);
}

function activeStatus(value: unknown, fallback = 'active') {
  const key = slug(value);
  if (['active', 'ativo', 'published', 'publicado'].includes(key)) return 'active';
  if (['inactive', 'inativo', 'archived', 'arquivado', 'draft', 'rascunho'].includes(key)) return 'inactive';
  return fallback;
}

function postgrestLiteral(value: unknown) {
  const escaped = clean(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return encodeURIComponent(`"${escaped}"`);
}

function hasValue(value: unknown) {
  return value !== undefined && value !== null && clean(value) !== '';
}

function keepOr<T>(incoming: T | null | undefined, previous: T | null | undefined): T | null {
  return hasValue(incoming) ? incoming as T : previous ?? null;
}

function marketingLayout(value: any) {
  const source = value && typeof value === 'object' ? value : {};
  const finite = (input: unknown, fallback: number) => Number.isFinite(Number(input)) ? Number(input) : fallback;
  return {
    x: Math.max(0, finite(source.x, 0)),
    y: Math.max(0, finite(source.y, 0)),
    width: Math.max(240, finite(source.width, 1440)),
    height: Math.max(140, finite(source.height, 560)),
    zIndex: Math.max(1, Math.round(finite(source.zIndex, 700))),
    visible: source.visible !== false,
  };
}

function cookie(req: Request, name: string) {
  for (const item of (req.headers.get('cookie') || '').split(';')) {
    const [key, ...value] = item.trim().split('=');
    if (key === name) return decodeURIComponent(value.join('='));
  }
  return null;
}

function sessionHeaders(access: string, refresh: string, expiresIn = 3600) {
  const headers = new Headers({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  headers.append('set-cookie', `${ACCESS_COOKIE}=${encodeURIComponent(access)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${expiresIn}`);
  headers.append('set-cookie', `${REFRESH_COOKIE}=${encodeURIComponent(refresh)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000`);
  return headers;
}

function clearHeaders() {
  const headers = new Headers({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  headers.append('set-cookie', `${ACCESS_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);
  headers.append('set-cookie', `${REFRESH_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);
  return headers;
}

async function supabase(env: Env, path: string, init: RequestInit = {}, userToken?: string) {
  const headers = new Headers(init.headers);
  const adminKey = clean(env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY);
  if (!userToken && !adminKey) throw new Error('SUPABASE_SECRET_KEY não configurada');
  headers.set('apikey', userToken ? env.SUPABASE_PUBLISHABLE_KEY : adminKey);
  if (userToken) {
    headers.set('authorization', `Bearer ${userToken}`);
  } else if (!adminKey.startsWith('sb_secret_')) {
    // Chaves service_role legadas são JWTs. As chaves modernas sb_secret_
    // devem ser enviadas somente em apikey; como Bearer geram "Invalid JWT".
    headers.set('authorization', `Bearer ${adminKey}`);
  }
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  const response = await fetch(`${env.SUPABASE_URL}${path}`, { ...init, headers });
  if (!response.ok) {
    const payload = await response.text();
    throw new Error(`Supabase ${response.status}: ${payload.slice(0, 400)}`);
  }
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function table(env: Env, name: string, query = '', init: RequestInit = {}, userToken?: string) {
  return supabase(env, `/rest/v1/${name}${query ? `?${query}` : ''}`, init, userToken);
}

async function tableAll(env: Env, name: string, query = '', pageSize = 500, maxRows = 10000) {
  const rows: any[] = [];
  for (let offset = 0; offset < maxRows; offset += pageSize) {
    const page = await table(env, name, `${query}${query ? '&' : ''}limit=${pageSize}&offset=${offset}`);
    if (!Array.isArray(page)) throw new Error(`Resposta inválida ao consultar ${name}`);
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
  throw new Error(`A consulta de ${name} excedeu o limite seguro de ${maxRows} registros`);
}

async function tableByValues(env: Env, name: string, baseQuery: string, column: string, values: string[]) {
  const rows: any[] = [];
  for (let index = 0; index < values.length; index += 150) {
    const list = values.slice(index, index + 150).map(postgrestLiteral).join(',');
    const page = await table(env, name, `${baseQuery}${baseQuery ? '&' : ''}${column}=in.(${list})`);
    if (!Array.isArray(page)) throw new Error(`Resposta inválida ao consultar ${name}`);
    rows.push(...page);
  }
  return rows;
}

async function currentUserFromAccess(access: string, env: Env) {
  try {
    const authUser = await supabase(env, '/auth/v1/user', {}, access);
    const memberships = await table(env, 'company_memberships', `user_id=eq.${encodeURIComponent(authUser.id)}&active=eq.true&select=company_id,role&limit=1`, {}, access);
    const membership = memberships?.[0];
    if (!membership) return null;
    const profiles = await table(env, 'profiles', `user_id=eq.${encodeURIComponent(authUser.id)}&select=display_name,email&limit=1`, {}, access);
    return {
      id: authUser.id,
      company_id: membership.company_id,
      email: profiles?.[0]?.email || authUser.email,
      name: profiles?.[0]?.display_name || authUser.user_metadata?.display_name || authUser.email,
      role: membership.role === 'owner' ? 'SDM' : String(membership.role).toUpperCase() as Role,
    };
  } catch {
    return null;
  }
}

async function currentUser(req: Request, env: Env) {
  const access = cookie(req, ACCESS_COOKIE);
  return access ? currentUserFromAccess(access, env) : null;
}

async function requireUser(req: Request, env: Env, roles: Role[] = ['VIEWER', 'EDITOR', 'ADMIN']) {
  const user = await currentUser(req, env);
  if (!user) return { user: null, error: fail('Sessão expirada ou inexistente', 401, 'UNAUTHENTICATED') };
  if (user.role !== 'SDM' && !roles.includes(user.role)) return { user: null, error: fail('Permissão insuficiente', 403, 'FORBIDDEN') };
  return { user, error: null };
}

async function audit(env: Env, user: any, action: string, entityType: string, entityId: string | null, details: unknown = {}, userToken?: string) {
  await table(env, 'audit_logs', '', {
    method: 'POST',
    headers: { prefer: 'return=minimal' },
    body: JSON.stringify({ company_id: user?.company_id || COMPANY_ID, user_id: user?.id || null, action, entity_type: entityType, entity_id: entityId, details }),
  }, userToken);
}

async function authRoute(req: Request, env: Env, path: string) {
  if (path === '/api/auth/status' && req.method === 'GET') {
    const user = await currentUser(req, env);
    const adminKey = clean(env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY);
    const owners = adminKey ? await table(env, 'company_memberships', 'role=eq.owner&active=eq.true&select=user_id&limit=1') : [{ user_id: 'configured' }];
    return ok({ needsBootstrap: !owners?.length, user: user ? { id: user.id, companyId: user.company_id, email: user.email, name: user.name, role: user.role } : null });
  }
  if (path === '/api/auth/bootstrap' && req.method === 'POST') {
    const owners = await table(env, 'company_memberships', 'role=eq.owner&active=eq.true&select=user_id&limit=1');
    if (owners?.length) return fail('O primeiro SDM já foi criado', 409, 'BOOTSTRAP_CLOSED');
    const input = await body(req);
    if (!env.SDM_BOOTSTRAP_TOKEN || clean(input.token) !== env.SDM_BOOTSTRAP_TOKEN) return fail('Token de ativação inválido', 403, 'BAD_BOOTSTRAP_TOKEN');
    const email = clean(input.email).toLowerCase(), name = clean(input.name), password = clean(input.password);
    if (!email.includes('@') || name.length < 2 || password.length < 10) return fail('Informe nome, e-mail e senha com pelo menos 10 caracteres');
    const created = await supabase(env, '/auth/v1/admin/users', { method: 'POST', body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { display_name: name } }) });
    await table(env, 'profiles', 'on_conflict=user_id', { method: 'POST', headers: { prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ user_id: created.id, email, display_name: name }) });
    await table(env, 'company_memberships', 'on_conflict=company_id,user_id', { method: 'POST', headers: { prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ company_id: COMPANY_ID, user_id: created.id, role: 'owner', active: true }) });
    await audit(env, { id: created.id, company_id: COMPANY_ID }, 'bootstrap', 'user', created.id);
    const session = await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) }).then(r => r.json()) as any;
    return new Response(JSON.stringify({ ok: true, user: { id: created.id, companyId: COMPANY_ID, email, name, role: 'SDM' } }), { headers: sessionHeaders(session.access_token, session.refresh_token, session.expires_in) });
  }
  if (path === '/api/auth/login' && req.method === 'POST') {
    const input = await body(req);
    const response = await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, 'content-type': 'application/json' }, body: JSON.stringify({ email: clean(input.email).toLowerCase(), password: clean(input.password) }) });
    if (!response.ok) return fail('E-mail ou senha inválidos', 401, 'BAD_CREDENTIALS');
    const session = await response.json() as any;
    if (!clean(session.access_token) || !clean(session.refresh_token)) return fail('Resposta de autenticação inválida', 502, 'INVALID_AUTH_SESSION');
    const user = await currentUserFromAccess(session.access_token, env);
    if (!user) return fail('Usuário sem acesso ativo à empresa', 403, 'NO_MEMBERSHIP');
    try {
      await audit(env, user, 'login', 'user', user.id, {}, session.access_token);
    } catch (error) {
      // O registro de auditoria é importante, mas uma indisponibilidade pontual
      // dessa tabela não pode invalidar uma sessão que o Auth já confirmou.
      console.error('Falha ao registrar auditoria de login', error);
    }
    return new Response(JSON.stringify({ ok: true, user: { id: user.id, companyId: user.company_id, email: user.email, name: user.name, role: user.role } }), { headers: sessionHeaders(session.access_token, session.refresh_token, session.expires_in) });
  }
  if (path === '/api/auth/logout' && req.method === 'POST') return new Response(JSON.stringify({ ok: true }), { headers: clearHeaders() });
  return null;
}

async function brandsPayload(env: Env) {
  const brands = await tableAll(env, 'brands', `company_id=eq.${COMPANY_ID}&select=id,name,slug,active,data&order=name.asc`);
  return brands.map((brand: any) => ({ ...brand.data, id: brand.id, name: brand.name, slug: brand.slug, status: brand.active ? 'active' : 'inactive' }));
}

async function offersPayload(env: Env, publicOnly: boolean) {
  const offers = await table(env, 'offers', `company_id=eq.${COMPANY_ID}${publicOnly ? '&status=eq.published' : ''}&select=*&order=featured.desc,updated_at.desc`);
  const links = offers?.length ? await tableAll(env, 'offer_products', `offer_id=in.(${offers.map((x: any) => postgrestLiteral(x.id)).join(',')})&select=offer_id,product_id,sort_order&order=sort_order.asc`) : [];
  return (offers || []).map((offer: any) => ({ ...offer.data, id: offer.id, title: offer.title, description: offer.description, status: offer.status, featured: offer.featured, startsAt: offer.starts_at, endsAt: offer.ends_at, productIds: (links || []).filter((link: any) => link.offer_id === offer.id).map((link: any) => link.product_id) }));
}

async function catalogPayload(env: Env, publicOnly: boolean) {
  const status = publicOnly ? '&status=eq.active' : '';
  const [products, brands, hierarchy, settings, promotions] = await Promise.all([
    tableAll(env, 'products', `company_id=eq.${COMPANY_ID}${status}&select=*&order=name.asc`),
    brandsPayload(env),
    tableAll(env, 'hierarchy_nodes', `company_id=eq.${COMPANY_ID}&select=id,name,slug,type,parent_id,sort_order,active&order=sort_order.asc,name.asc`),
    table(env, 'catalog_settings', `company_id=eq.${COMPANY_ID}&select=display_fields&limit=1`),
    offersPayload(env, publicOnly),
  ]);
  return {
    products: (products || []).map((p: any) => ({ ...p.data, id: p.id, code: p.code, name: p.name, image: p.image_url || p.data?.image, gallery: p.gallery, status: p.status === 'active' ? 'ativo' : 'rascunho' })),
    brands,
    distributions: [],
    hierarchy: (hierarchy || []).map((h: any) => ({ id: h.id, name: h.name, slug: h.slug, level: h.type, parent_id: h.parent_id, parentId: h.parent_id, sort_order: h.sort_order, sortOrder: h.sort_order, status: h.active ? 'active' : 'inactive' })),
    promotions,
    settings: { displayFields: settings?.[0]?.display_fields || [] },
  };
}

async function publicRoute(req: Request, env: Env, path: string) {
  if (path === '/api/health') return ok({ service: 'sistema-de-catalago', database: 'Supabase Postgres', d1: false, r2: false, release: 'v59', editor: '2.1.59' });
  if (path === '/api/public/catalog' && req.method === 'GET') return ok({ catalog: await catalogPayload(env, true) });
  if (path === '/api/public/brands' && req.method === 'GET') return ok({ brands: await brandsPayload(env) });
  if (path === '/api/public/marketing' && req.method === 'GET') {
    const rows = await table(env, 'marketing_settings', `company_id=eq.${COMPANY_ID}&select=theme,banner,video_banner,carousel,settings&limit=1`);
    const m = rows?.[0] || {};
    return ok({ marketing: { theme: m.theme || {}, banner: m.banner || {}, videoBanner: m.video_banner || {}, carousel: m.carousel || {}, layout: marketingLayout(m.settings?.layout) } });
  }
  const mediaMatch = path.match(/^\/api\/public\/media\/([^/]+)$/);
  if (mediaMatch && req.method === 'GET') {
    const rows = await table(env, 'media_assets', `id=eq.${encodeURIComponent(decodeURIComponent(mediaMatch[1]))}&select=mime_type,metadata&limit=1`);
    const item = rows?.[0], encoded = item?.metadata?.dataBase64;
    if (!item || !encoded) return fail('Mídia não encontrada', 404, 'NOT_FOUND');
    const bytes = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
    return new Response(bytes, { headers: { 'content-type': item.mime_type || 'application/octet-stream', 'cache-control': 'public, max-age=31536000, immutable' } });
  }
  const pageMatch = path.match(/^\/api\/public\/pages\/([^/]+)$/);
  if (pageMatch && req.method === 'GET') {
    const rows = await table(env, 'pages', `company_id=eq.${COMPANY_ID}&slug=eq.${encodeURIComponent(decodeURIComponent(pageMatch[1]))}&select=slug,title,published_nodes,published_revision,updated_at&limit=1`);
    const page = rows?.[0];
    if (!page) return fail('Página não encontrada', 404, 'NOT_FOUND');
    return ok({ page: { slug: page.slug, title: page.title, versionId: `supabase-v${page.published_revision}`, versionNumber: page.published_revision, publishedAt: page.updated_at, nodes: page.published_nodes } });
  }
  return null;
}

async function adminRoute(req: Request, env: Env, path: string) {
  if (path === '/api/admin/catalog' && req.method === 'GET') {
    const auth = await requireUser(req, env); if (auth.error) return auth.error;
    return ok({ catalog: await catalogPayload(env, false) });
  }
  if (path === '/api/admin/catalog/settings' && req.method === 'PUT') {
    const auth = await requireUser(req, env, ['EDITOR', 'ADMIN']); if (auth.error) return auth.error;
    const input = await body(req), displayFields = Array.isArray(input.displayFields) ? [...new Set(input.displayFields.map(clean).filter(Boolean))] : [];
    await table(env, 'catalog_settings', `company_id=eq.${COMPANY_ID}`, { method: 'PATCH', headers: { prefer: 'return=minimal' }, body: JSON.stringify({ display_fields: displayFields }) });
    await audit(env, auth.user, 'catalog.settings', 'catalog', COMPANY_ID, { displayFields });
    return ok({ settings: { displayFields } });
  }
  if (path === '/api/admin/brands' && req.method === 'GET') {
    const auth = await requireUser(req, env); if (auth.error) return auth.error;
    return ok({ brands: await brandsPayload(env) });
  }
  if (path === '/api/admin/brands' && req.method === 'POST') {
    const auth = await requireUser(req, env, ['EDITOR', 'ADMIN']); if (auth.error) return auth.error;
    const input = await body(req), name = clean(input.name); if (!name) return fail('Informe o nome da marca');
    const id = uid('brd'), item = { id, company_id: COMPANY_ID, name, slug: slug(name), description: clean(input.description) || null, website: clean(input.website) || null, logo_url: clean(input.logoUrl) || null, banner_url: clean(input.bannerUrl) || null, sort_order: Number(input.sortOrder || 0), active: input.status !== 'inactive', featured: !!input.featured, data: input.data || {} };
    await table(env, 'brands', '', { method: 'POST', headers: { prefer: 'return=minimal' }, body: JSON.stringify(item) });
    await audit(env, auth.user, 'brand.create', 'brand', id); return ok({ brand: { ...item, status: item.active ? 'active' : 'inactive' } });
  }
  if (path === '/api/admin/brands/bulk' && req.method === 'POST') {
    const auth = await requireUser(req, env, ['EDITOR', 'ADMIN']); if (auth.error) return auth.error;
    const input = await body(req), incoming = Array.isArray(input.brands) ? input.brands.slice(0, 1000) : [];
    const existing = await table(env, 'brands', `company_id=eq.${COMPANY_ID}&select=id,slug`), bySlug = new Map((existing || []).map((x: any) => [x.slug, x]));
    let inserted = 0, updated = 0, ignored = 0; const errors: string[] = [], rows: any[] = [], seen = new Set<string>();
    incoming.forEach((raw: any, index: number) => {
      const name = clean(raw.name || raw.marca), key = slug(name);
      if (!name || !key) { ignored++; if (errors.length < 30) errors.push(`Linha ${index + 2}: marca sem nome`); return; }
      if (seen.has(key)) { ignored++; if (errors.length < 30) errors.push(`Linha ${index + 2}: marca repetida no arquivo`); return; }
      seen.add(key);
      const old: any = bySlug.get(key);
      if (old) updated++; else inserted++;
      const row = { id: old?.id || uid('brd'), company_id: COMPANY_ID, name, slug: key, description: clean(raw.description) || null, website: clean(raw.website) || null, active: activeStatus(raw.status, 'active') === 'active', data: raw };
      rows.push(row);
      bySlug.set(key, row);
    });
    if (rows.length) await table(env, 'brands', 'on_conflict=company_id,slug', { method: 'POST', headers: { prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(rows) });
    return ok({ inserted, updated, ignored, errors, brands: await brandsPayload(env) });
  }
  const brandItem = path.match(/^\/api\/admin\/brands\/([^/]+)$/);
  if (brandItem && ['PUT', 'DELETE'].includes(req.method)) {
    const auth = await requireUser(req, env, ['EDITOR', 'ADMIN']); if (auth.error) return auth.error;
    const id = decodeURIComponent(brandItem[1]);
    if (req.method === 'DELETE') { await table(env, 'brands', `id=eq.${encodeURIComponent(id)}`, { method: 'DELETE', headers: { prefer: 'return=minimal' } }); await audit(env, auth.user, 'brand.delete', 'brand', id); return ok({ id }); }
    const input = await body(req), name = clean(input.name); if (!name) return fail('Informe o nome da marca');
    const patch: any = { name, slug: slug(name), description: clean(input.description) || null, website: clean(input.website) || null, logo_url: clean(input.logoUrl) || null, banner_url: clean(input.bannerUrl) || null, sort_order: Number(input.sortOrder || 0), active: input.status !== 'inactive', featured: !!input.featured };
    await table(env, 'brands', `id=eq.${encodeURIComponent(id)}&company_id=eq.${COMPANY_ID}`, { method: 'PATCH', headers: { prefer: 'return=minimal' }, body: JSON.stringify(patch) });
    await audit(env, auth.user, 'brand.update', 'brand', id); return ok({ brand: { id, ...patch, status: patch.active ? 'active' : 'inactive' } });
  }
  if (path === '/api/admin/hierarchy' && req.method === 'POST') {
    const auth = await requireUser(req, env, ['EDITOR', 'ADMIN']); if (auth.error) return auth.error;
    const input = await body(req), type = clean(input.level || input.type); if (!['secao', 'categoria'].includes(type)) return fail('Nível inválido');
    const name = clean(input.name), parentId = clean(input.parentId) || null; if (!name || !parentId) return fail('Informe nome e item pai');
    const id = uid('hier'); await table(env, 'hierarchy_nodes', '', { method: 'POST', headers: { prefer: 'return=minimal' }, body: JSON.stringify({ id, company_id: COMPANY_ID, type, name, slug: `${slug(parentId)}--${slug(name)}`, parent_id: parentId, sort_order: Number(input.sortOrder || 0), active: true, data: {} }) });
    await audit(env, auth.user, 'hierarchy.create', type, id); return ok({ id });
  }
  const hierarchyItem = path.match(/^\/api\/admin\/hierarchy\/([^/]+)$/);
  if (hierarchyItem && ['PUT', 'DELETE'].includes(req.method)) {
    const auth = await requireUser(req, env, ['EDITOR', 'ADMIN']); if (auth.error) return auth.error;
    const id = decodeURIComponent(hierarchyItem[1]);
    if (req.method === 'DELETE') { try { await table(env, 'hierarchy_nodes', `id=eq.${encodeURIComponent(id)}`, { method: 'DELETE', headers: { prefer: 'return=minimal' } }); } catch { return fail('Não é possível excluir uma categoria em uso', 409, 'IN_USE'); } return ok({ id }); }
    const input = await body(req), patch = { name: clean(input.name), active: input.status !== 'inactive', sort_order: Number(input.sortOrder || 0) }; if (!patch.name) return fail('Informe o nome');
    await table(env, 'hierarchy_nodes', `id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', headers: { prefer: 'return=minimal' }, body: JSON.stringify(patch) }); return ok({ id });
  }
  if (path === '/api/admin/marketing' && req.method === 'GET') {
    const auth = await requireUser(req, env); if (auth.error) return auth.error;
    return publicRoute(new Request(req, { method: 'GET' }), env, '/api/public/marketing');
  }
  if (path === '/api/admin/marketing' && req.method === 'PUT') {
    const auth = await requireUser(req, env, ['EDITOR', 'ADMIN']); if (auth.error) return auth.error;
    const input = await body(req), m = input.marketing || input;
    const current = (await table(env, 'marketing_settings', `company_id=eq.${COMPANY_ID}&select=settings&limit=1`))?.[0];
    const layout = marketingLayout(m.layout);
    await table(env, 'marketing_settings', `company_id=eq.${COMPANY_ID}`, { method: 'PATCH', headers: { prefer: 'return=minimal' }, body: JSON.stringify({ theme: m.theme || {}, banner: m.banner || {}, video_banner: m.videoBanner || {}, carousel: m.carousel || {}, settings: { ...(current?.settings || {}), layout } }) });
    await audit(env, auth.user, 'marketing.update', 'marketing', COMPANY_ID, { layout, slides: Array.isArray(m.carousel?.items) ? m.carousel.items.length : 0 });
    return ok({ marketing: { ...m, layout } });
  }
  if (path === '/api/admin/catalog/offers' && req.method === 'GET') {
    const auth = await requireUser(req, env); if (auth.error) return auth.error;
    return ok({ offers: await offersPayload(env, false) });
  }
  if (path === '/api/admin/catalog/offers' && req.method === 'POST') {
    const auth = await requireUser(req, env, ['EDITOR', 'ADMIN']); if (auth.error) return auth.error;
    return saveOffer(env, auth.user, await body(req), null);
  }
  const offerItem = path.match(/^\/api\/admin\/catalog\/offers\/([^/]+)$/);
  if (offerItem && ['PUT', 'DELETE'].includes(req.method)) {
    const auth = await requireUser(req, env, ['EDITOR', 'ADMIN']); if (auth.error) return auth.error;
    const id = decodeURIComponent(offerItem[1]);
    if (req.method === 'DELETE') { await table(env, 'offers', `id=eq.${encodeURIComponent(id)}&company_id=eq.${COMPANY_ID}`, { method: 'DELETE', headers: { prefer: 'return=minimal' } }); await audit(env, auth.user, 'offer.delete', 'offer', id); return ok({ id }); }
    return saveOffer(env, auth.user, await body(req), id);
  }
  if (path === '/api/admin/catalog/products/bulk' && req.method === 'POST') {
    const auth = await requireUser(req, env, ['EDITOR', 'ADMIN']); if (auth.error) return auth.error;
    const input = await body(req), incoming = Array.isArray(input.products) ? input.products.slice(0, 5000) : [];
    if (!incoming.length) return fail('Nenhum produto recebido');

    const requestedCodes: string[] = [...new Set<string>(incoming.map((p: any) => clean(p?.code ?? p?.codigo)).filter(Boolean))];
    const existing = requestedCodes.length
      ? await tableByValues(env, 'products', `company_id=eq.${COMPANY_ID}&select=*`, 'code', requestedCodes)
      : [];
    const byCode = new Map<string, any>((existing || []).map((x: any) => [clean(x.code), x]));
    let hierarchy = await table(env, 'hierarchy_nodes', `company_id=eq.${COMPANY_ID}&select=id,type,name,slug,parent_id,sort_order,active`);
    let brands = await table(env, 'brands', `company_id=eq.${COMPANY_ID}&select=id,name,slug,active`);
    const seenCodes = new Set<string>(), errors: string[] = [];
    let ignored = 0;

    const nodeKey = (type: string, parentId: string | null, name: string) => `${type}:${parentId || ''}:${slug(name)}`;
    const rebuildNodes = () => new Map<string, any>((hierarchy || []).map((node: any) => [nodeKey(node.type, node.parent_id, node.name), node]));
    let nodes = rebuildNodes();
    const departments = new Map<string, any>();
    for (const node of hierarchy || []) if (node.type === 'departamento') departments.set(normalizeDepartment(node.name), node);

    const missingDepartments = new Map<string, any>();
    for (const p of incoming) {
      const department = normalizeDepartment(p?.departamentoName ?? p?.department ?? p?.departamento);
      const key = slug(department);
      if (department && !departments.has(department) && !missingDepartments.has(key)) {
        missingDepartments.set(key, { id: uid('hier'), company_id: COMPANY_ID, type: 'departamento', name: department, slug: key, parent_id: null, sort_order: 100, active: true, data: {} });
      }
    }
    if (missingDepartments.size) {
      await table(env, 'hierarchy_nodes', 'on_conflict=company_id,type,slug,parent_id', { method: 'POST', headers: { prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify([...missingDepartments.values()]) });
      hierarchy = await table(env, 'hierarchy_nodes', `company_id=eq.${COMPANY_ID}&select=id,type,name,slug,parent_id,sort_order,active`);
      for (const node of hierarchy || []) if (node.type === 'departamento') departments.set(normalizeDepartment(node.name), node);
    }

    const valid: Array<{ index: number; p: any; code: string; name: string; previous: any; previousData: any; department: string; section: string; category: string }> = [];
    for (let index = 0; index < incoming.length; index++) {
      const p = incoming[index] || {}, code = clean(p.code ?? p.codigo), previous: any = byCode.get(code), previousData = previous?.data || {};
      const name = clean(p.name ?? p.shortDescription ?? p.description ?? p.descricao) || clean(previous?.name ?? previousData.name);
      const department = normalizeDepartment(p.departamentoName ?? p.department ?? p.departamento ?? previousData.departamentoName);
      const section = clean(p.secaoName ?? p.section ?? p.secao ?? previousData.secaoName);
      const category = clean(p.categoriaName ?? p.category ?? p.categoria ?? previousData.categoriaName) || 'Sem categoria';
      if (seenCodes.has(code)) { ignored++; if (errors.length < 30) errors.push(`Linha ${index + 2}: código ${code || 'vazio'} repetido no arquivo`); continue; }
      if (code) seenCodes.add(code);
      if (!code || !name || !department || !section || !category) {
        ignored++;
        if (errors.length < 30) errors.push(`Linha ${index + 2}: ${!code ? 'Código; ' : ''}${!name ? 'Descrição; ' : ''}${!department ? 'Departamento; ' : ''}${!section ? 'Seção; ' : ''}`.replace(/; $/, ''));
        continue;
      }
      if (!departments.get(department)) { ignored++; if (errors.length < 30) errors.push(`Linha ${index + 2}: departamento ${department} não configurado`); continue; }
      valid.push({ index, p, code, name, previous, previousData, department, section, category });
    }

    const missingSections = new Map<string, any>();
    for (const item of valid) {
      const department = departments.get(item.department), key = nodeKey('secao', department.id, item.section);
      if (!nodes.has(key) && !missingSections.has(key)) missingSections.set(key, { id: uid('hier'), company_id: COMPANY_ID, type: 'secao', name: item.section, slug: `${slug(item.department)}--${slug(item.section)}`, parent_id: department.id, sort_order: 100, active: true, data: {} });
    }
    if (missingSections.size) await table(env, 'hierarchy_nodes', 'on_conflict=company_id,type,slug,parent_id', { method: 'POST', headers: { prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify([...missingSections.values()]) });
    if (missingSections.size) hierarchy = await table(env, 'hierarchy_nodes', `company_id=eq.${COMPANY_ID}&select=id,type,name,slug,parent_id,sort_order,active`);
    nodes = rebuildNodes();

    const missingCategories = new Map<string, any>();
    for (const item of valid) {
      const department = departments.get(item.department), section = nodes.get(nodeKey('secao', department.id, item.section));
      if (!section) continue;
      const key = nodeKey('categoria', section.id, item.category);
      if (!nodes.has(key) && !missingCategories.has(key)) missingCategories.set(key, { id: uid('hier'), company_id: COMPANY_ID, type: 'categoria', name: item.category, slug: `${slug(item.section)}--${slug(item.category)}`, parent_id: section.id, sort_order: 100, active: true, data: {} });
    }
    if (missingCategories.size) await table(env, 'hierarchy_nodes', 'on_conflict=company_id,type,slug,parent_id', { method: 'POST', headers: { prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify([...missingCategories.values()]) });
    if (missingCategories.size) hierarchy = await table(env, 'hierarchy_nodes', `company_id=eq.${COMPANY_ID}&select=id,type,name,slug,parent_id,sort_order,active`);
    nodes = rebuildNodes();

    const brandMap = new Map<string, any>((brands || []).map((brand: any) => [slug(brand.name), brand]));
    const missingBrands = new Map<string, any>();
    for (const item of valid) {
      const brandName = clean(item.p.brandName ?? item.p.brand ?? item.p.marca ?? item.previousData.brandName), key = slug(brandName);
      if (key && !brandMap.has(key) && !missingBrands.has(key)) missingBrands.set(key, { id: uid('brd'), company_id: COMPANY_ID, name: brandName, slug: key, active: true, data: {} });
    }
    if (missingBrands.size) await table(env, 'brands', 'on_conflict=company_id,slug', { method: 'POST', headers: { prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify([...missingBrands.values()]) });
    if (missingBrands.size) brands = await table(env, 'brands', `company_id=eq.${COMPANY_ID}&select=id,name,slug,active`);
    for (const brand of brands || []) brandMap.set(slug(brand.name), brand);

    let inserted = 0, updated = 0; const rows: any[] = [];
    for (const item of valid) {
      const { p, code, name, previous, previousData, department, section, category } = item;
      const departmentNode = departments.get(department), sectionNode = nodes.get(nodeKey('secao', departmentNode.id, section));
      const categoryNode = sectionNode && nodes.get(nodeKey('categoria', sectionNode.id, category));
      if (!sectionNode || !categoryNode) { ignored++; if (errors.length < 30) errors.push(`Linha ${item.index + 2}: falha ao resolver seção ou categoria`); continue; }
      const brandName = clean(p.brandName ?? p.brand ?? p.marca ?? previousData.brandName), brandId = brandName ? brandMap.get(slug(brandName))?.id || previous?.brand_id || null : previous?.brand_id || null;
      const image = clean(p.image) || clean(previous?.image_url) || clean(previousData.image) || null;
      const gallery = Array.isArray(p.gallery) && p.gallery.length ? p.gallery : Array.isArray(previous?.gallery) ? previous.gallery : Array.isArray(previousData.gallery) ? previousData.gallery : [];
      const shortDescription = clean(p.shortDescription) || clean(previous?.short_description) || name;
      const longDescription = clean(p.longDescription) || clean(previous?.long_description) || clean(previousData.longDescription) || name;
      const data = { ...previousData, ...p, code, name, shortDescription, longDescription, departamentoId: departmentNode.id, secaoId: sectionNode.id, categoriaId: categoryNode.id, departamentoName: department, secaoName: section, categoriaName: category, brandId, brandName: brandName || previousData.brandName || '', image, gallery };
      rows.push({
        id: previous?.id || uid('prd'), company_id: COMPANY_ID, code, name,
        ean: keepOr(clean(p.ean) || null, previous?.ean), short_description: shortDescription, long_description: longDescription,
        brand_id: brandId, departamento_id: departmentNode.id, secao_id: sectionNode.id, categoria_id: categoryNode.id,
        unit: keepOr(clean(p.unit) || null, previous?.unit), packaging: keepOr(clean(p.packaging) || null, previous?.packaging), ncm: keepOr(clean(p.ncm) || null, previous?.ncm),
        price: keepOr(p.price, previous?.price), promo_price: keepOr(p.promoPrice, previous?.promo_price), stock: keepOr(p.stock, previous?.stock),
        image_url: image, video_url: clean(p.video ?? p.videoUrl) || clean(previous?.video_url) || null, gallery,
        technical: p.technical && typeof p.technical === 'object' ? { ...(previous?.technical || {}), ...p.technical } : previous?.technical || {},
        attributes: p.attributes && typeof p.attributes === 'object' ? { ...(previous?.attributes || {}), ...p.attributes } : previous?.attributes || {},
        tags: Array.isArray(p.tags) ? p.tags : Array.isArray(previous?.tags) ? previous.tags : [],
        status: activeStatus(p.status, previous?.status || 'active'), data,
      });
      if (previous) updated++; else inserted++;
    }
    for (let i = 0; i < rows.length; i += 200) await table(env, 'products', 'on_conflict=company_id,code', { method: 'POST', headers: { prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(rows.slice(i, i + 200)) });
    const importId = uid('imp'); await audit(env, auth.user, 'products.bulk', 'import', importId, { total: incoming.length, inserted, updated, ignored, filename: clean(input.filename), errors });
    return ok({ importId, total: incoming.length, inserted, updated, ignored, errors });
  }
  const productMatch = path.match(/^\/api\/admin\/products\/([^/]+)$/);
  if (productMatch && ['PUT', 'DELETE'].includes(req.method)) {
    const auth = await requireUser(req, env, ['EDITOR', 'ADMIN']); if (auth.error) return auth.error;
    const id = decodeURIComponent(productMatch[1]);
    if (req.method === 'DELETE') {
      const rows = await table(env, 'products', `id=eq.${encodeURIComponent(id)}&select=code&limit=1`);
      await table(env, 'products', `id=eq.${encodeURIComponent(id)}`, { method: 'DELETE', headers: { prefer: 'return=minimal' } });
      await audit(env, auth.user, 'product.delete', 'product', id); return ok({ id, code: rows?.[0]?.code });
    }
    const input = await body(req), status = ['active', 'ativo'].includes(clean(input.status).toLowerCase()) ? 'active' : 'inactive';
    await table(env, 'products', `id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', headers: { prefer: 'return=minimal' }, body: JSON.stringify({ status }) });
    return ok({ id, status });
  }
  const pageDraft = path.match(/^\/api\/admin\/pages\/([^/]+)\/draft$/);
  if (pageDraft) {
    const auth = await requireUser(req, env, req.method === 'GET' ? ['VIEWER', 'EDITOR', 'ADMIN'] : ['EDITOR', 'ADMIN']); if (auth.error) return auth.error;
    const slugValue = decodeURIComponent(pageDraft[1]);
    const rows = await table(env, 'pages', `company_id=eq.${COMPANY_ID}&slug=eq.${encodeURIComponent(slugValue)}&select=*&limit=1`), page = rows?.[0];
    if (!page) return fail('Página não encontrada', 404, 'NOT_FOUND');
    if (req.method === 'GET') return ok({ page: { id: page.id, slug: page.slug, title: page.title, nodes: page.draft_nodes, revision: page.revision, updatedAt: page.updated_at, publishedVersionId: `supabase-v${page.published_revision}` } });
    const input = await body(req);
    if (!Array.isArray(input.nodes)) return fail('Conteúdo inválido');
    if (input.expectedRevision != null && Number(input.expectedRevision) !== Number(page.revision)) return fail('O rascunho foi alterado em outra sessão. Recarregue antes de salvar.', 409, 'REVISION_CONFLICT');
    const revision = Number(page.revision) + 1;
    await table(env, 'pages', `id=eq.${encodeURIComponent(page.id)}`, { method: 'PATCH', headers: { prefer: 'return=minimal' }, body: JSON.stringify({ draft_nodes: input.nodes, revision }) });
    await audit(env, auth.user, 'draft.save', 'page', page.id, { revision }); return ok({ revision, savedAt: new Date().toISOString() });
  }
  const publish = path.match(/^\/api\/admin\/pages\/([^/]+)\/publish$/);
  if (publish && req.method === 'POST') {
    const auth = await requireUser(req, env, ['ADMIN']); if (auth.error) return auth.error;
    const rows = await table(env, 'pages', `company_id=eq.${COMPANY_ID}&slug=eq.${encodeURIComponent(decodeURIComponent(publish[1]))}&select=*&limit=1`), page = rows?.[0];
    if (!page) return fail('Página não encontrada', 404);
    const versionNumber = Number(page.published_revision) + 1, versionId = uid('ver');
    await table(env, 'page_publications', '', { method: 'POST', headers: { prefer: 'return=minimal' }, body: JSON.stringify({ id: versionId, page_id: page.id, revision: versionNumber, nodes: page.draft_nodes, created_by: auth.user!.id }) });
    await table(env, 'pages', `id=eq.${encodeURIComponent(page.id)}`, { method: 'PATCH', headers: { prefer: 'return=minimal' }, body: JSON.stringify({ published_nodes: page.draft_nodes, published_revision: versionNumber }) });
    await audit(env, auth.user, 'page.publish', 'page', page.id, { versionId, versionNumber });
    return ok({ publication: { versionId, versionNumber, publishedAt: new Date().toISOString() } });
  }
  const snapshots = path.match(/^\/api\/admin\/pages\/([^/]+)\/snapshots$/);
  if (snapshots) {
    const auth = await requireUser(req, env, ['EDITOR', 'ADMIN']); if (auth.error) return auth.error;
    const pages = await table(env, 'pages', `company_id=eq.${COMPANY_ID}&slug=eq.${encodeURIComponent(decodeURIComponent(snapshots[1]))}&select=id,revision&limit=1`), page = pages?.[0];
    if (!page) return fail('Página não encontrada', 404);
    if (req.method === 'GET') {
      const rows = await table(env, 'page_snapshots', `page_id=eq.${encodeURIComponent(page.id)}&select=id,label,nodes,created_at&order=created_at.desc&limit=30`);
      return ok({ snapshots: (rows || []).map((x: any) => ({ id: x.id, label: x.label, nodes: x.nodes, createdAt: x.created_at })) });
    }
    const input = await body(req); if (!Array.isArray(input.nodes)) return fail('Snapshot inválido');
    const id = uid('snap'), label = clean(input.label).slice(0, 120) || 'Ponto manual';
    await table(env, 'page_snapshots', '', { method: 'POST', headers: { prefer: 'return=minimal' }, body: JSON.stringify({ id, page_id: page.id, label, nodes: input.nodes, revision: page.revision, created_by: auth.user!.id }) });
    return ok({ snapshot: { id, label, createdAt: new Date().toISOString() } });
  }
  const versions = path.match(/^\/api\/admin\/pages\/([^/]+)\/versions$/);
  if (versions && req.method === 'GET') {
    const auth = await requireUser(req, env); if (auth.error) return auth.error;
    const pages = await table(env, 'pages', `company_id=eq.${COMPANY_ID}&slug=eq.${encodeURIComponent(decodeURIComponent(versions[1]))}&select=id,published_revision&limit=1`), page = pages?.[0];
    if (!page) return fail('Página não encontrada', 404);
    const rows = await table(env, 'page_publications', `page_id=eq.${encodeURIComponent(page.id)}&select=id,revision,created_at&order=revision.desc&limit=50`);
    return ok({ publishedVersionId: `supabase-v${page.published_revision}`, versions: (rows || []).map((x: any) => ({ id: x.id, version_number: x.revision, label: `Publicação ${x.revision}`, source: 'supabase', created_at: x.created_at })) });
  }
  const rollback = path.match(/^\/api\/admin\/pages\/([^/]+)\/rollback\/([^/]+)$/);
  if (rollback && req.method === 'POST') {
    const auth = await requireUser(req, env, ['ADMIN']); if (auth.error) return auth.error;
    const pages = await table(env, 'pages', `company_id=eq.${COMPANY_ID}&slug=eq.${encodeURIComponent(decodeURIComponent(rollback[1]))}&select=*&limit=1`), page = pages?.[0];
    const publications = page ? await table(env, 'page_publications', `id=eq.${encodeURIComponent(decodeURIComponent(rollback[2]))}&page_id=eq.${encodeURIComponent(page.id)}&select=*&limit=1`) : [];
    const version = publications?.[0]; if (!page || !version) return fail('Versão não encontrada', 404, 'VERSION_NOT_FOUND');
    const revision = Number(page.revision) + 1;
    await table(env, 'page_snapshots', '', { method: 'POST', headers: { prefer: 'return=minimal' }, body: JSON.stringify({ id: uid('snap'), page_id: page.id, label: `Antes de restaurar v${version.revision}`, nodes: page.draft_nodes, revision: page.revision, created_by: auth.user!.id }) });
    await table(env, 'pages', `id=eq.${encodeURIComponent(page.id)}`, { method: 'PATCH', headers: { prefer: 'return=minimal' }, body: JSON.stringify({ draft_nodes: version.nodes, revision }) });
    return ok({ versionId: version.id, versionNumber: version.revision, revision, restoredAt: new Date().toISOString() });
  }
  if (path === '/api/admin/templates' && req.method === 'GET') {
    const auth = await requireUser(req, env); if (auth.error) return auth.error;
    const rows = await table(env, 'templates', `company_id=eq.${COMPANY_ID}&active=eq.true&select=*&order=updated_at.desc`);
    return ok({ templates: (rows || []).map((x: any) => ({ id: x.id, systemKey: x.system_key, name: x.name, description: x.description, category: x.category, tags: x.tags, accent: x.accent, nodes: x.nodes, isSystem: !!x.data?.isSystem, version: x.version, updatedAt: x.updated_at })) });
  }
  if (path === '/api/admin/templates/seed' && req.method === 'POST') {
    const auth = await requireUser(req, env, ['ADMIN']); if (auth.error) return auth.error;
    if (auth.user!.role !== 'SDM') return fail('Somente o SDM pode administrar os modelos globais', 403, 'SDM_ONLY');
    const input = await body(req), templates = Array.isArray(input.templates) ? input.templates.slice(0, 30) : [];
    const rows = templates.filter((t: any) => clean(t.systemKey) && Array.isArray(t.nodes)).map((t: any) => ({ id: uid('tpl'), company_id: COMPANY_ID, system_key: clean(t.systemKey), name: clean(t.name) || 'Modelo', description: clean(t.description), category: clean(t.category) || 'geral', tags: t.tags || [], accent: clean(t.accent), nodes: t.nodes, active: true, data: { isSystem: true } }));
    if (rows.length) await table(env, 'templates', 'on_conflict=company_id,system_key', { method: 'POST', headers: { prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(rows) });
    return ok({ requested: templates.length });
  }
  const templateItem = path.match(/^\/api\/admin\/templates\/([^/]+)$/);
  if (templateItem && ['PUT', 'DELETE'].includes(req.method)) {
    const auth = await requireUser(req, env, ['ADMIN']); if (auth.error) return auth.error;
    if (auth.user!.role !== 'SDM') return fail('Somente o SDM pode alterar ou excluir modelos', 403, 'SDM_ONLY');
    const id = decodeURIComponent(templateItem[1]);
    if (req.method === 'DELETE') { await table(env, 'templates', `id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', headers: { prefer: 'return=minimal' }, body: JSON.stringify({ active: false }) }); return ok(); }
    const input = await body(req), current = (await table(env, 'templates', `id=eq.${encodeURIComponent(id)}&select=*&limit=1`))?.[0];
    if (!current) return fail('Modelo não encontrado', 404);
    const version = Number(current.version) + 1;
    await table(env, 'templates', `id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', headers: { prefer: 'return=minimal' }, body: JSON.stringify({ name: input.name ?? current.name, description: input.description ?? current.description, category: input.category ?? current.category, tags: input.tags ?? current.tags, accent: input.accent ?? current.accent, nodes: input.nodes ?? current.nodes, version }) });
    return ok({ id, version });
  }
  if (path === '/api/admin/media' && req.method === 'POST') {
    const auth = await requireUser(req, env, ['EDITOR', 'ADMIN']); if (auth.error) return auth.error;
    const input = await body(req), encoded = clean(input.dataBase64);
    if (!encoded) return fail('Arquivo vazio');
    const id = uid('media'), size = Math.floor(encoded.length * 0.75);
    await table(env, 'media_assets', '', { method: 'POST', headers: { prefer: 'return=minimal' }, body: JSON.stringify({ id, company_id: COMPANY_ID, owner_type: input.kind === 'product-image' ? 'product' : 'marketing', owner_id: clean(input.entityKey) || null, kind: clean(input.kind) || 'image', bucket: 'legacy-d1-inline', path: id, public_url: `/api/public/media/${id}`, mime_type: clean(input.contentType) || 'application/octet-stream', size_bytes: size, metadata: { filename: clean(input.filename), dataBase64: encoded, source: 'supabase-worker' } }) });
    return ok({ mediaKey: id, url: `/api/public/media/${id}`, deduplicated: false, byteSize: size });
  }
  const mediaItem = path.match(/^\/api\/admin\/media\/([^/]+)$/);
  if (mediaItem && req.method === 'DELETE') {
    const auth = await requireUser(req, env, ['EDITOR', 'ADMIN']); if (auth.error) return auth.error;
    const id = decodeURIComponent(mediaItem[1]); await table(env, 'media_assets', `id=eq.${encodeURIComponent(id)}`, { method: 'DELETE', headers: { prefer: 'return=minimal' } }); return ok({ mediaKey: id });
  }
  return null;
}

async function saveOffer(env: Env, user: any, input: any, id: string | null) {
  const offerId = id || uid('offer'), title = clean(input.title) || 'Vitrine de Ofertas';
  const productIds = Array.isArray(input.productIds) ? [...new Set(input.productIds.map(clean).filter(Boolean))].slice(0, 1500) : [];
  const item = {
    id: offerId,
    company_id: COMPANY_ID,
    title,
    description: clean(input.description) || null,
    status: ['published', 'draft', 'archived'].includes(clean(input.status)) ? clean(input.status) : 'draft',
    featured: !!input.featured,
    starts_at: clean(input.startsAt) || null,
    ends_at: clean(input.endsAt) || null,
    display_config: { displayFields: Array.isArray(input.displayFields) ? input.displayFields : [] },
    data: {},
  };
  await table(env, 'offers', 'on_conflict=id', { method: 'POST', headers: { prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(item) });
  await table(env, 'offer_products', `offer_id=eq.${encodeURIComponent(offerId)}`, { method: 'DELETE', headers: { prefer: 'return=minimal' } });
  if (productIds.length) await table(env, 'offer_products', '', { method: 'POST', headers: { prefer: 'return=minimal' }, body: JSON.stringify(productIds.map((productId, sortOrder) => ({ offer_id: offerId, product_id: productId, sort_order: sortOrder }))) });
  await audit(env, user, id ? 'offer.update' : 'offer.create', 'offer', offerId, { products: productIds.length });
  return ok({ offer: { id: offerId, title, description: item.description, status: item.status, featured: item.featured, startsAt: item.starts_at, endsAt: item.ends_at, productIds } });
}

function securityHeaders(response: Response) {
  const headers = new Headers(response.headers);
  headers.set('x-content-type-options', 'nosniff');
  headers.set('referrer-policy', 'strict-origin-when-cross-origin');
  headers.set('x-frame-options', 'DENY');
  headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=()');
  headers.set('content-security-policy', "default-src 'self'; img-src 'self' data: https:; media-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; font-src 'self' data: https:");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(req.url), path = url.pathname;
      if (path.startsWith('/api/')) {
        if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
          const origin = req.headers.get('origin');
          if (origin && origin !== url.origin) return securityHeaders(fail('Origem não autorizada', 403, 'ORIGIN'));
        }
        const response = await authRoute(req, env, path) || await publicRoute(req, env, path) || await adminRoute(req, env, path) || fail('Rota não encontrada', 404, 'NOT_FOUND');
        return securityHeaders(response);
      }
      return securityHeaders(await env.ASSETS.fetch(req));
    } catch (error) {
      console.error(error);
      return securityHeaders(fail('Falha interna ao acessar o Supabase', 500, 'INTERNAL'));
    }
  },
};
