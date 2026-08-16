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
  provider: 'google' | 'duckduckgo';
};

const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const textEncoder = new TextEncoder();
const USER_AGENT = 'ASTERYON-Catalog/2.1.72 (Cloudflare Worker; brand web image search)';

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
  return brand ? {
    id: clean(brand.id),
    name: clean(brand.name),
    slug: clean(brand.slug),
    logoUrl: clean(brand.logoUrl || brand.logo || brand.image) || null,
  } : null;
}

async function googleImageSearch(env: Env, query: string): Promise<SearchImage[]> {
  const key = clean(env.GOOGLE_CSE_API_KEY);
  const cx = clean(env.GOOGLE_CSE_CX);
  if (!key || !cx) throw new Error('Google Imagens não configurado: defina GOOGLE_CSE_API_KEY e GOOGLE_CSE_CX na Cloudflare.');

  const results: SearchImage[] = [];
  for (const start of [1, 11, 21]) {
    const params = new URLSearchParams({
      key,
      cx,
      q: query,
      searchType: 'image',
      safe: 'active',
      num: '10',
      start: String(start),
    });
    const response = await fetch(`https://customsearch.googleapis.com/customsearch/v1?${params.toString()}`, {
      headers: { accept: 'application/json', 'user-agent': USER_AGENT },
    });
    if (!response.ok) {
      let detail = '';
      try {
        const payload = await response.json() as any;
        detail = clean(payload?.error?.message);
      } catch { /* noop */ }
      throw new Error(`Google Imagens indisponível (${response.status})${detail ? `: ${detail}` : ''}`);
    }
    const payload = await response.json() as any;
    const items = Array.isArray(payload?.items) ? payload.items : [];
    for (const item of items) {
      const imageUrl = clean(item.link);
      const mime = allowedSearchMime(item.mime || item.fileFormat, imageUrl);
      if (!imageUrl || !mime || !ALLOWED_MIMES.has(mime)) continue;
      results.push({
        url: imageUrl,
        thumbnailUrl: clean(item.image?.thumbnailLink || item.link),
        title: clean(item.title || query),
        sourceUrl: clean(item.image?.contextLink),
        mime,
        width: Number(item.image?.width) || undefined,
        height: Number(item.image?.height) || undefined,
        provider: 'google',
      });
    }
    if (items.length < 10 || results.length >= 24) break;
  }
  return results.slice(0, 24);
}

function extractVqd(html: string) {
  const patterns = [
    /vqd=["']?([0-9-]+)["'&]/i,
    /["']vqd["']\s*:\s*["']([0-9-]+)["']/i,
    /vqd%3D([0-9-]+)/i,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1];
  }
  return '';
}

async function duckduckgoImageSearch(query: string): Promise<SearchImage[]> {
  const landingParams = new URLSearchParams({ q: query, iax: 'images', ia: 'images' });
  const landingUrl = `https://duckduckgo.com/?${landingParams.toString()}`;
  const landing = await fetch(landingUrl, {
    headers: {
      accept: 'text/html,application/xhtml+xml',
      'accept-language': 'pt-BR,pt;q=0.9,en;q=0.7',
      'user-agent': USER_AGENT,
    },
  });
  if (!landing.ok) throw new Error(`Pesquisa web de imagens indisponível (${landing.status})`);
  const html = await landing.text();
  const vqd = extractVqd(html);
  if (!vqd) throw new Error('Pesquisa web de imagens não forneceu token de consulta');

  const params = new URLSearchParams({
    l: 'br-pt',
    o: 'json',
    q: query,
    vqd,
    f: ',,,',
    p: '1',
  });
  const response = await fetch(`https://duckduckgo.com/i.js?${params.toString()}`, {
    headers: {
      accept: 'application/json',
      'accept-language': 'pt-BR,pt;q=0.9,en;q=0.7',
      referer: landingUrl,
      'user-agent': USER_AGENT,
    },
  });
  if (!response.ok) throw new Error(`Pesquisa web de imagens indisponível (${response.status})`);
  const payload = await response.json() as any;
  const results = Array.isArray(payload?.results) ? payload.results : [];
  return results.map((item: any) => {
    const imageUrl = clean(item.image);
    return {
      url: imageUrl,
      thumbnailUrl: clean(item.thumbnail || item.image),
      title: clean(item.title || query),
      sourceUrl: clean(item.url),
      mime: allowedSearchMime(item.type || item.mime, imageUrl),
      width: Number(item.width) || undefined,
      height: Number(item.height) || undefined,
      provider: 'duckduckgo' as const,
    };
  }).filter((item: SearchImage) => item.url && item.mime && ALLOWED_MIMES.has(item.mime));
}

function dedupe(items: SearchImage[]) {
  const seen = new Set<string>();
  const output: SearchImage[] = [];
  for (const item of items) {
    let key = item.url;
    try {
      const parsed = new URL(item.url);
      parsed.hash = '';
      key = parsed.toString();
    } catch { /* mantém URL original */ }
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }
  return output;
}

async function signedResults(items: SearchImage[], env: Env) {
  const images: Array<SearchImage & { signature: string }> = [];
  for (const item of items.slice(0, 24)) {
    try {
      const normalized = validateRemoteUrl(item.url).toString();
      const signature = await signRemoteUrl(normalized, env);
      images.push({ ...item, url: normalized, signature });
    } catch { /* resultado inseguro ignorado */ }
  }
  return images;
}

async function broadWebSearch(brand: Brand, env: Env) {
  const queries = [`${brand.name} logo`, `logo ${brand.name}`, brand.name];
  const collected: SearchImage[] = [];
  const notes: string[] = [];
  for (const query of queries) {
    if (collected.length >= 20) break;
    try {
      collected.push(...await duckduckgoImageSearch(query));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Pesquisa web de imagens indisponível.';
      if (!notes.includes(message)) notes.push(message);
      if (!collected.length) continue;
      break;
    }
  }
  const images = await signedResults(dedupe(collected), env);
  return { images, notes };
}

async function handleGoogleOnlySearch(req: Request, env: Env, brand: Brand) {
  if (!clean(env.GOOGLE_CSE_API_KEY) || !clean(env.GOOGLE_CSE_CX)) {
    return fail(
      'Google Imagens não está configurado neste Worker. Configure GOOGLE_CSE_API_KEY e GOOGLE_CSE_CX na Cloudflare para usar a busca oficial do Google.',
      503,
      'GOOGLE_IMAGES_NOT_CONFIGURED',
    );
  }

  try {
    const raw = await googleImageSearch(env, `logo ${brand.name}`);
    const images = await signedResults(dedupe(raw), env);
    return ok({
      brand: { id: brand.id, name: brand.name, logoUrl: brand.logoUrl || null },
      query: `logo ${brand.name}`,
      provider: 'google',
      providerMessage: `${images.length} resultado(s) encontrados no Google Imagens. Selecione a imagem correta da marca.`,
      images,
    });
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : 'Falha ao consultar Google Imagens.',
      502,
      'GOOGLE_IMAGES_UPSTREAM_ERROR',
    );
  }
}

async function handleSearch(req: Request, env: Env) {
  const auth = await requireEditor(req, env);
  if (auth.error || !auth.user) return auth.error!;

  const url = new URL(req.url);
  const brandId = clean(url.searchParams.get('brandId'));
  if (!brandId) return fail('Marca não informada');
  const brand = await getBrand(req, env, brandId);
  if (!brand) return fail('Marca não encontrada', 404, 'BRAND_NOT_FOUND');

  if (clean(url.searchParams.get('provider')).toLowerCase() === 'google') {
    return await handleGoogleOnlySearch(req, env, brand);
  }

  const hasGoogleApi = Boolean(clean(env.GOOGLE_CSE_API_KEY) && clean(env.GOOGLE_CSE_CX));
  if (hasGoogleApi) {
    try {
      const rawGoogle = await googleImageSearch(env, `${brand.name} logo`);
      const googleImages = await signedResults(dedupe(rawGoogle), env);
      if (googleImages.length) {
        return ok({
          brand: { id: brand.id, name: brand.name, logoUrl: brand.logoUrl || null },
          query: `${brand.name} logo`,
          provider: 'google',
          providerMessage: `${googleImages.length} resultado(s) encontrados no Google Imagens.`,
          images: googleImages,
        });
      }
    } catch { /* continua para pesquisa ampla */ }
  }

  const web = await broadWebSearch(brand, env);
  if (web.images.length) {
    return ok({
      brand: { id: brand.id, name: brand.name, logoUrl: brand.logoUrl || null },
      query: `${brand.name} logo`,
      provider: 'duckduckgo',
      providerMessage: `${web.images.length} resultado(s) encontrados na pesquisa ampla da web. Selecione a imagem correta da marca.`,
      images: web.images,
    });
  }

  const fallback = await baseWorker.fetch(req, env as never);
  try {
    const payload = await fallback.clone().json() as any;
    if (fallback.ok && payload?.ok) {
      const previous = clean(payload.providerMessage);
      payload.providerMessage = [...web.notes, previous].filter(Boolean).join(' ');
      return json(payload, fallback.status);
    }
  } catch { /* devolve fallback original */ }
  return fallback;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(req.url);
      if (url.pathname === '/api/admin/brand-images/search' && req.method === 'GET') return await handleSearch(req, env);
      return await baseWorker.fetch(req, env as never);
    } catch (error) {
      console.error('Falha no fluxo V72 de pesquisa web de marcas', error);
      return fail(error instanceof Error ? error.message : 'Falha interna ao pesquisar imagem da marca', 500, 'BRAND_WEB_SEARCH_INTERNAL_ERROR');
    }
  },
};