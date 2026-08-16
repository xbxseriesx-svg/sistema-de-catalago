import baseWorker from './index-v70';

type Env = {
  ASSETS: Fetcher;
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  SUPABASE_SECRET_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SDM_BOOTSTRAP_TOKEN?: string;
  GOOGLE_CSE_API_KEY?: string;
  GOOGLE_CSE_CX?: string;
};

type AuthUser = { id: string; role: string; companyId?: string };
type Brand = { id: string; name: string; slug?: string; logoUrl?: string | null };
type SearchImage = {
  url: string;
  thumbnailUrl: string;
  title: string;
  sourceUrl: string;
  mime: string;
  width?: number;
  height?: number;
  provider: 'google' | 'wikimedia' | 'openverse';
};

const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_REMOTE_BYTES = 8 * 1024 * 1024;
const textEncoder = new TextEncoder();
const USER_AGENT = 'ASTERYON-Catalog/2.1.71 (Cloudflare Worker; brand image search)';

const clean = (value: unknown) => String(value ?? '').trim();

function secure(response: Response) {
  const headers = new Headers(response.headers);
  headers.set('x-content-type-options', 'nosniff');
  headers.set('referrer-policy', 'strict-origin-when-cross-origin');
  headers.set('x-frame-options', 'DENY');
  headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=()');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function json(data: unknown, status = 200) {
  return secure(new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  }));
}

function ok(data: Record<string, unknown> = {}) {
  return json({ ok: true, ...data });
}

function fail(message: string, status = 400, code = 'BAD_REQUEST') {
  return json({ ok: false, error: { message, code } }, status);
}

function adminKey(env: Env) {
  return clean(env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY);
}

function normalizeMime(value: unknown) {
  const mime = clean(value).toLowerCase().split(';')[0];
  if (mime === 'image/jpg') return 'image/jpeg';
  return mime;
}

function allowedSearchMime(value: unknown, url = '') {
  const mime = normalizeMime(value);
  if (ALLOWED_MIMES.has(mime)) return mime;
  const pathname = (() => { try { return new URL(url).pathname.toLowerCase(); } catch { return ''; } })();
  if (/\.jpe?g$/.test(pathname)) return 'image/jpeg';
  if (/\.png$/.test(pathname)) return 'image/png';
  if (/\.webp$/.test(pathname)) return 'image/webp';
  return '';
}

function hex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)].map(value => value.toString(16).padStart(2, '0')).join('');
}

async function hmacKey(env: Env) {
  const secret = adminKey(env);
  if (!secret) throw new Error('Chave administrativa não configurada');
  return crypto.subtle.importKey('raw', textEncoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}

async function signRemoteUrl(url: string, env: Env) {
  const key = await hmacKey(env);
  return hex(await crypto.subtle.sign('HMAC', key, textEncoder.encode(url)));
}

function sameSignature(left: string, right: string) {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index++) diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return diff === 0;
}

function isPrivateIpv4(hostname: string) {
  const parts = hostname.split('.').map(Number);
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  return parts[0] === 0
    || parts[0] === 10
    || parts[0] === 127
    || (parts[0] === 169 && parts[1] === 254)
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
    || (parts[0] === 192 && parts[1] === 168)
    || parts[0] >= 224;
}

function validateRemoteUrl(value: string) {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('URL de imagem inválida'); }
  if (url.protocol !== 'https:') throw new Error('A imagem precisa usar HTTPS');
  if (url.username || url.password) throw new Error('URL com credenciais não é permitida');
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local') || hostname.endsWith('.internal') || hostname === 'metadata.google.internal') {
    throw new Error('Host de imagem não permitido');
  }
  if (isPrivateIpv4(hostname) || hostname === '::1' || hostname.startsWith('fc') || hostname.startsWith('fd') || hostname.startsWith('fe80:')) {
    throw new Error('Endereço de rede privado não permitido');
  }
  return url;
}

async function requireEditor(req: Request, env: Env): Promise<{ user: AuthUser | null; error: Response | null }> {
  const probeUrl = new URL(req.url);
  probeUrl.pathname = '/api/auth/status';
  probeUrl.search = '';
  const probe = new Request(probeUrl.toString(), { method: 'GET', headers: req.headers });
  const response = await baseWorker.fetch(probe, env as never);
  let payload: any = null;
  try { payload = await response.clone().json(); } catch { /* resposta inválida */ }
  const user = payload?.user as AuthUser | undefined;
  if (!response.ok || !payload?.ok || !user?.id) return { user: null, error: fail('Sessão expirada ou inexistente', 401, 'UNAUTHENTICATED') };
  const role = clean(user.role).toUpperCase();
  if (!['SDM', 'ADMIN', 'EDITOR'].includes(role)) return { user: null, error: fail('Permissão insuficiente', 403, 'FORBIDDEN') };
  return { user: { ...user, role }, error: null };
}

async function getBrand(req: Request, env: Env, brandId: string): Promise<Brand | null> {
  const url = new URL(req.url);
  url.pathname = '/api/admin/brands';
  url.search = '';
  const response = await baseWorker.fetch(new Request(url.toString(), { method: 'GET', headers: req.headers }), env as never);
  if (!response.ok) return null;
  const payload = await response.json() as any;
  const brands = Array.isArray(payload?.brands) ? payload.brands : [];
  const brand = brands.find((item: any) => clean(item?.id) === brandId);
  return brand ? { id: clean(brand.id), name: clean(brand.name), slug: clean(brand.slug), logoUrl: clean(brand.logoUrl || brand.logo || brand.image) || null } : null;
}

async function googleImageSearch(env: Env, query: string): Promise<SearchImage[]> {
  const key = clean(env.GOOGLE_CSE_API_KEY);
  const cx = clean(env.GOOGLE_CSE_CX);
  if (!key || !cx) return [];
  const params = new URLSearchParams({ key, cx, q: query, searchType: 'image', safe: 'active', num: '10' });
  const response = await fetch(`https://customsearch.googleapis.com/customsearch/v1?${params.toString()}`, {
    headers: { accept: 'application/json', 'user-agent': USER_AGENT },
  });
  if (!response.ok) throw new Error(`Google Images indisponível (${response.status})`);
  const payload = await response.json() as any;
  return (Array.isArray(payload?.items) ? payload.items : []).map((item: any) => ({
    url: clean(item.link),
    thumbnailUrl: clean(item.image?.thumbnailLink || item.link),
    title: clean(item.title || query),
    sourceUrl: clean(item.image?.contextLink),
    mime: allowedSearchMime(item.mime || item.fileFormat, item.link),
    width: Number(item.image?.width) || undefined,
    height: Number(item.image?.height) || undefined,
    provider: 'google' as const,
  })).filter((item: SearchImage) => item.url && item.mime && ALLOWED_MIMES.has(item.mime));
}

async function wikimediaImageSearch(query: string): Promise<SearchImage[]> {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    generator: 'search',
    gsrsearch: query,
    gsrnamespace: '6',
    gsrlimit: '24',
    prop: 'imageinfo',
    iiprop: 'url|mime|size',
    iiurlwidth: '360',
    maxlag: '5',
  });
  const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params.toString()}`, {
    headers: {
      accept: 'application/json',
      'user-agent': USER_AGENT,
      'api-user-agent': USER_AGENT,
    },
  });
  if (!response.ok) throw new Error(`Wikimedia Commons indisponível (${response.status})`);
  const payload = await response.json() as any;
  return (Array.isArray(payload?.query?.pages) ? payload.query.pages : []).map((page: any) => {
    const info = page?.imageinfo?.[0] || {};
    return {
      url: clean(info.url),
      thumbnailUrl: clean(info.thumburl || info.url),
      title: clean(page?.title || query).replace(/^File:/i, ''),
      sourceUrl: clean(info.descriptionurl),
      mime: allowedSearchMime(info.mime, info.url),
      width: Number(info.width) || undefined,
      height: Number(info.height) || undefined,
      provider: 'wikimedia' as const,
    };
  }).filter((item: SearchImage) => item.url && item.mime && ALLOWED_MIMES.has(item.mime));
}

async function openverseImageSearch(query: string): Promise<SearchImage[]> {
  const params = new URLSearchParams({ q: query, page_size: '20', mature: 'false' });
  const response = await fetch(`https://api.openverse.org/v1/images/?${params.toString()}`, {
    headers: { accept: 'application/json', 'user-agent': USER_AGENT },
  });
  if (!response.ok) throw new Error(`Openverse indisponível (${response.status})`);
  const payload = await response.json() as any;
  return (Array.isArray(payload?.results) ? payload.results : []).map((item: any) => ({
    url: clean(item.url),
    thumbnailUrl: clean(item.thumbnail || item.url),
    title: clean(item.title || query),
    sourceUrl: clean(item.foreign_landing_url || item.detail_url),
    mime: allowedSearchMime(item.filetype ? `image/${clean(item.filetype).replace(/^jpg$/i, 'jpeg')}` : '', item.url),
    width: Number(item.width) || undefined,
    height: Number(item.height) || undefined,
    provider: 'openverse' as const,
  })).filter((item: SearchImage) => item.url && item.mime && ALLOWED_MIMES.has(item.mime));
}

async function handleSearch(req: Request, env: Env) {
  const auth = await requireEditor(req, env);
  if (auth.error || !auth.user) return auth.error!;
  const url = new URL(req.url);
  const brandId = clean(url.searchParams.get('brandId'));
  if (!brandId) return fail('Marca não informada');
  const brand = await getBrand(req, env, brandId);
  if (!brand) return fail('Marca não encontrada', 404, 'BRAND_NOT_FOUND');
  const query = `${brand.name} logo`;

  let provider: SearchImage['provider'] = 'wikimedia';
  let raw: SearchImage[] = [];
  const notes: string[] = [];

  if (clean(env.GOOGLE_CSE_API_KEY) && clean(env.GOOGLE_CSE_CX)) {
    try {
      raw = await googleImageSearch(env, query);
      provider = 'google';
      if (!raw.length) notes.push('Google Images não retornou imagens compatíveis.');
    } catch (error) {
      notes.push(error instanceof Error ? error.message : 'Google Images indisponível.');
    }
  }

  if (!raw.length) {
    try {
      raw = await wikimediaImageSearch(query);
      provider = 'wikimedia';
      if (!raw.length) notes.push('Wikimedia Commons não retornou imagens compatíveis.');
    } catch (error) {
      notes.push(error instanceof Error ? error.message : 'Wikimedia Commons indisponível.');
    }
  }

  if (!raw.length) {
    try {
      raw = await openverseImageSearch(query);
      provider = 'openverse';
      if (!raw.length) notes.push('Openverse não retornou imagens compatíveis.');
    } catch (error) {
      notes.push(error instanceof Error ? error.message : 'Openverse indisponível.');
    }
  }

  const images: Array<SearchImage & { signature: string }> = [];
  for (const item of raw.slice(0, 24)) {
    try {
      const normalized = validateRemoteUrl(item.url).toString();
      const signature = await signRemoteUrl(normalized, env);
      images.push({ ...item, url: normalized, signature });
    } catch { /* resultado inseguro ignorado */ }
  }

  let providerMessage = '';
  if (provider === 'openverse') providerMessage = `Resultados via Openverse. ${notes.join(' ')}`.trim();
  else if (notes.length) providerMessage = notes.join(' ');
  if (!images.length && notes.length) providerMessage = notes.join(' ');

  return ok({
    brand: { id: brand.id, name: brand.name, logoUrl: brand.logoUrl || null },
    query,
    provider,
    providerMessage,
    images,
  });
}

async function fetchRemoteImage(req: Request, env: Env) {
  const auth = await requireEditor(req, env);
  if (auth.error || !auth.user) return auth.error!;
  const requestUrl = new URL(req.url);
  const value = clean(requestUrl.searchParams.get('url'));
  const signature = clean(requestUrl.searchParams.get('sig'));
  if (!value || !signature) return fail('Imagem ou assinatura não informada');
  const initial = validateRemoteUrl(value).toString();
  const expected = await signRemoteUrl(initial, env);
  if (!sameSignature(signature, expected)) return fail('Assinatura da imagem inválida', 403, 'INVALID_IMAGE_SIGNATURE');

  let current = initial;
  let response: Response | null = null;
  for (let redirect = 0; redirect < 4; redirect++) {
    const target = validateRemoteUrl(current);
    response = await fetch(target.toString(), {
      redirect: 'manual',
      headers: {
        accept: 'image/webp,image/png,image/jpeg;q=0.9,*/*;q=0.1',
        'user-agent': USER_AGENT,
      },
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) return fail('Redirecionamento de imagem inválido', 502, 'BAD_IMAGE_REDIRECT');
      current = validateRemoteUrl(new URL(location, target).toString()).toString();
      continue;
    }
    break;
  }
  if (!response || !response.ok) return fail(`Falha ao baixar imagem${response ? ` (${response.status})` : ''}`, 502, 'IMAGE_DOWNLOAD_FAILED');

  const mime = normalizeMime(response.headers.get('content-type'));
  if (!ALLOWED_MIMES.has(mime)) return fail('Formato remoto não permitido. Use JPG, JPEG, PNG ou WEBP.', 415, 'IMAGE_FORMAT_UNSUPPORTED');
  const announced = Number(response.headers.get('content-length') || 0);
  if (announced > MAX_REMOTE_BYTES) return fail('Imagem remota acima de 8 MB', 413, 'REMOTE_IMAGE_TOO_LARGE');
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!bytes.length || bytes.length > MAX_REMOTE_BYTES) return fail('Imagem remota vazia ou acima de 8 MB', 413, 'REMOTE_IMAGE_TOO_LARGE');

  return secure(new Response(bytes, {
    status: 200,
    headers: {
      'content-type': mime,
      'content-length': String(bytes.length),
      'cache-control': 'no-store',
      'content-disposition': 'inline; filename="brand-source"',
    },
  }));
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(req.url);
      if (url.pathname === '/api/admin/brand-images/search' && req.method === 'GET') return await handleSearch(req, env);
      if (url.pathname === '/api/admin/brand-images/fetch' && req.method === 'GET') return await fetchRemoteImage(req, env);
      return await baseWorker.fetch(req, env as never);
    } catch (error) {
      console.error('Falha no fluxo V71 de imagens de marcas', error);
      return fail(error instanceof Error ? error.message : 'Falha interna ao pesquisar imagem da marca', 500, 'BRAND_IMAGE_INTERNAL_ERROR');
    }
  },
};
