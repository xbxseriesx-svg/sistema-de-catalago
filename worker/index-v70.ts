import baseWorker from './index-v62';

type Env = {
  ASSETS: Fetcher;
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  SUPABASE_SECRET_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  REMOTE_IMAGE_HMAC_SECRET?: string;
  SDM_BOOTSTRAP_TOKEN?: string;
  GOOGLE_CSE_API_KEY?: string;
  GOOGLE_CSE_CX?: string;
};

type AuthUser = { id: string; role: string; companyId?: string };
type BrandRow = {
  id: string;
  name: string;
  slug?: string | null;
  logo_url?: string | null;
  data?: Record<string, unknown> | null;
};

type SearchImage = {
  url: string;
  thumbnailUrl: string;
  title: string;
  sourceUrl: string;
  mime: string;
  width?: number;
  height?: number;
  provider: 'google' | 'wikimedia';
};

const COMPANY_ID = 'qa_e2e_asteryon';
const BRAND_BUCKET = 'brand-media';
const MAX_REMOTE_BYTES = 8 * 1024 * 1024;
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const DNS_ENDPOINT = 'https://cloudflare-dns.com/dns-query';
const textEncoder = new TextEncoder();

const clean = (value: unknown) => String(value ?? '').trim();
const uid = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;

function secure(response: Response) {
  const headers = new Headers(response.headers);
  headers.set('x-content-type-options', 'nosniff');
  headers.set('referrer-policy', 'strict-origin-when-cross-origin');
  headers.set('x-frame-options', 'DENY');
  headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=()');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function json(data: unknown, status = 200, extra: HeadersInit = {}) {
  return secure(new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...extra,
    },
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

function adminHeaders(env: Env, initial: HeadersInit = {}) {
  const key = adminKey(env);
  if (!key) throw new Error('SUPABASE_SECRET_KEY não configurada');
  const headers = new Headers(initial);
  headers.set('apikey', key);
  if (!key.startsWith('sb_secret_')) headers.set('authorization', `Bearer ${key}`);
  return headers;
}

async function adminFetch(env: Env, path: string, init: RequestInit = {}) {
  const headers = adminHeaders(env, init.headers);
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  const response = await fetch(`${env.SUPABASE_URL}${path}`, { ...init, headers });
  const text = await response.text();
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${text.slice(0, 500)}`);
  if (!text) return null;
  try { return JSON.parse(text); } catch { return text; }
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
  if (!response.ok || !payload?.ok || !user?.id) {
    return { user: null, error: fail('Sessão expirada ou inexistente', 401, 'UNAUTHENTICATED') };
  }
  const role = clean(user.role).toUpperCase();
  if (!['SDM', 'ADMIN', 'EDITOR'].includes(role)) {
    return { user: null, error: fail('Permissão insuficiente', 403, 'FORBIDDEN') };
  }
  return { user: { ...user, role }, error: null };
}

function safeSegment(value: string) {
  const result = clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 120);
  return result || 'marca';
}

function encodedObjectPath(path: string) {
  return path.split('/').filter(Boolean).map(segment => encodeURIComponent(segment)).join('/');
}

function normalizeMime(value: unknown) {
  const mime = clean(value).toLowerCase().split(';')[0];
  if (mime === 'image/jpg') return 'image/jpeg';
  return mime;
}

function hex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)].map(value => value.toString(16).padStart(2, '0')).join('');
}

async function sha256(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return hex(await crypto.subtle.digest('SHA-256', copy.buffer));
}

function isAllowedImage(bytes: Uint8Array, mime: string) {
  if (!ALLOWED_MIMES.has(mime)) return false;
  if (mime === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === 'image/png') return bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
  if (mime === 'image/webp') {
    return bytes.length >= 12
      && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF'
      && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  }
  return false;
}

function ipv4Parts(value: string) {
  const parts = value.split('.').map(Number);
  return parts.length === 4 && parts.every(part => Number.isInteger(part) && part >= 0 && part <= 255) ? parts : null;
}

function isNonPublicIpv4(value: string) {
  const parts = ipv4Parts(value);
  if (!parts) return false;
  const [a, b, c] = parts;
  return a === 0
    || a === 10
    || (a === 100 && b >= 64 && b <= 127)
    || a === 127
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 0 && c === 0)
    || (a === 192 && b === 0 && c === 2)
    || (a === 192 && b === 168)
    || (a === 198 && (b === 18 || b === 19))
    || (a === 198 && b === 51 && c === 100)
    || (a === 203 && b === 0 && c === 113)
    || a >= 224;
}

function expandIpv6(value: string) {
  const raw = value.toLowerCase().split('%')[0];
  if (!raw.includes(':')) return null;
  let input = raw;
  const last = input.slice(input.lastIndexOf(':') + 1);
  if (last.includes('.')) {
    const v4 = ipv4Parts(last);
    if (!v4) return null;
    const hi = ((v4[0] << 8) | v4[1]).toString(16);
    const lo = ((v4[2] << 8) | v4[3]).toString(16);
    input = `${input.slice(0, input.lastIndexOf(':'))}:${hi}:${lo}`;
  }
  const halves = input.split('::');
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(':').filter(Boolean) : [];
  const right = halves[1] ? halves[1].split(':').filter(Boolean) : [];
  if (halves.length === 1 && left.length !== 8) return null;
  const missing = 8 - left.length - right.length;
  if (missing < 0 || (halves.length === 2 && missing < 1)) return null;
  const groups = halves.length === 2 ? [...left, ...Array(missing).fill('0'), ...right] : left;
  if (groups.length !== 8 || groups.some(group => !/^[0-9a-f]{1,4}$/.test(group))) return null;
  return groups.map(group => parseInt(group, 16));
}

function isNonPublicIpv6(value: string) {
  const groups = expandIpv6(value);
  if (!groups) return false;
  const [g0, g1, g2, g3, g4, g5] = groups;
  if (groups.every(group => group === 0)) return true;
  if (groups.slice(0, 7).every(group => group === 0) && groups[7] === 1) return true;
  if ((g0 & 0xfe00) === 0xfc00) return true; // fc00::/7
  if ((g0 & 0xffc0) === 0xfe80) return true; // fe80::/10
  if ((g0 & 0xff00) === 0xff00) return true; // multicast
  if (g0 === 0x2001 && g1 === 0x0db8) return true; // documentação
  if (g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0xffff) {
    const mapped = `${groups[6] >> 8}.${groups[6] & 255}.${groups[7] >> 8}.${groups[7] & 255}`;
    return isNonPublicIpv4(mapped);
  }
  return false;
}

function validateRemoteUrl(value: string) {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('URL de imagem inválida'); }
  if (url.protocol !== 'https:') throw new Error('A imagem precisa usar HTTPS');
  if (url.username || url.password) throw new Error('URL com credenciais não é permitida');
  if (url.port && url.port !== '443') throw new Error('Porta remota não permitida');
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local') || hostname.endsWith('.internal') || hostname === 'metadata.google.internal') {
    throw new Error('Host de imagem não permitido');
  }
  if (isNonPublicIpv4(hostname) || isNonPublicIpv6(hostname)) {
    throw new Error('Endereço de rede não público não permitido');
  }
  return url;
}

async function dnsAddresses(hostname: string, type: 'A' | 'AAAA') {
  const url = `${DNS_ENDPOINT}?name=${encodeURIComponent(hostname)}&type=${type}`;
  const response = await fetch(url, {
    headers: { accept: 'application/dns-json' },
    signal: AbortSignal.timeout(3500),
  });
  if (!response.ok) throw new Error(`Falha ao validar DNS remoto (${response.status})`);
  const payload = await response.json() as any;
  if (Number(payload?.Status) !== 0) return [] as string[];
  const expectedType = type === 'A' ? 1 : 28;
  return (Array.isArray(payload?.Answer) ? payload.Answer : [])
    .filter((answer: any) => Number(answer?.type) === expectedType)
    .map((answer: any) => clean(answer?.data))
    .filter(Boolean);
}

async function validateRemoteTarget(value: string) {
  const url = validateRemoteUrl(value);
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (ipv4Parts(hostname) || hostname.includes(':')) return url;

  const [ipv4, ipv6] = await Promise.all([
    dnsAddresses(hostname, 'A'),
    dnsAddresses(hostname, 'AAAA'),
  ]);
  const addresses = [...ipv4, ...ipv6];
  if (!addresses.length) throw new Error('Host remoto sem endereço DNS público válido');
  if (addresses.some(address => isNonPublicIpv4(address) || isNonPublicIpv6(address))) {
    throw new Error('DNS remoto resolveu para endereço não público');
  }
  return url;
}

async function hmacKey(env: Env) {
  const secret = clean(env.REMOTE_IMAGE_HMAC_SECRET);
  if (!secret) throw new Error('REMOTE_IMAGE_HMAC_SECRET não configurado');
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

async function getBrand(env: Env, brandId: string): Promise<BrandRow | null> {
  const rows = await adminFetch(env, `/rest/v1/brands?company_id=eq.${encodeURIComponent(COMPANY_ID)}&id=eq.${encodeURIComponent(brandId)}&select=id,name,slug,logo_url,data&limit=1`);
  return Array.isArray(rows) && rows[0] ? rows[0] as BrandRow : null;
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

async function googleImageSearch(env: Env, query: string): Promise<SearchImage[]> {
  const key = clean(env.GOOGLE_CSE_API_KEY);
  const cx = clean(env.GOOGLE_CSE_CX);
  if (!key || !cx) return [];
  const params = new URLSearchParams({
    key,
    cx,
    q: query,
    searchType: 'image',
    safe: 'active',
    num: '10',
  });
  const response = await fetch(`https://customsearch.googleapis.com/customsearch/v1?${params.toString()}`, {
    headers: { accept: 'application/json' },
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
    origin: '*',
  });
  const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params.toString()}`, {
    headers: { accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`Pesquisa de imagens indisponível (${response.status})`);
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

async function handleSearch(req: Request, env: Env) {
  const auth = await requireEditor(req, env);
  if (auth.error || !auth.user) return auth.error!;
  const url = new URL(req.url);
  const brandId = clean(url.searchParams.get('brandId'));
  if (!brandId) return fail('Marca não informada');
  const brand = await getBrand(env, brandId);
  if (!brand) return fail('Marca não encontrada', 404, 'BRAND_NOT_FOUND');
  const query = `${brand.name} logo`;

  let provider: 'google' | 'wikimedia' = 'wikimedia';
  let raw: SearchImage[] = [];
  let providerMessage = '';
  if (clean(env.GOOGLE_CSE_API_KEY) && clean(env.GOOGLE_CSE_CX)) {
    try {
      raw = await googleImageSearch(env, query);
      provider = 'google';
    } catch (error) {
      providerMessage = error instanceof Error ? `${error.message}. Usando Wikimedia Commons como alternativa.` : 'Google Images indisponível. Usando alternativa.';
    }
  }
  if (!raw.length) {
    raw = await wikimediaImageSearch(query);
    provider = 'wikimedia';
  }

  const images = [];
  for (const item of raw.slice(0, 24)) {
    try {
      const normalized = validateRemoteUrl(item.url).toString();
      const signature = await signRemoteUrl(normalized, env);
      images.push({ ...item, url: normalized, signature });
    } catch { /* resultado inseguro ignorado */ }
  }

  return ok({
    brand: { id: brand.id, name: brand.name, logoUrl: brand.logo_url || (brand.data as any)?.logoUrl || null },
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
    let target: URL;
    try {
      target = await validateRemoteTarget(current);
    } catch (error) {
      return fail(error instanceof Error ? error.message : 'Destino remoto bloqueado', 403, 'REMOTE_IMAGE_HOST_BLOCKED');
    }
    response = await fetch(target.toString(), {
      redirect: 'manual',
      headers: {
        accept: 'image/webp,image/png,image/jpeg;q=0.9,*/*;q=0.1',
        'user-agent': 'ASTERYON-Catalog-BrandImage/1.0',
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
  if (!isAllowedImage(bytes, mime)) return fail('O conteúdo baixado não corresponde a uma imagem válida', 415, 'INVALID_IMAGE_CONTENT');

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

async function uploadBrandLogo(req: Request, env: Env) {
  const auth = await requireEditor(req, env);
  if (auth.error || !auth.user) return auth.error!;
  const url = new URL(req.url);
  const brandId = clean(url.searchParams.get('brandId'));
  if (!brandId) return fail('Marca não informada');
  const brand = await getBrand(env, brandId);
  if (!brand) return fail('Marca não encontrada', 404, 'BRAND_NOT_FOUND');

  const mime = normalizeMime(req.headers.get('content-type'));
  if (mime !== 'image/webp') return fail('A imagem final da marca precisa estar convertida para WEBP', 415, 'BRAND_IMAGE_NOT_WEBP');
  const bytes = new Uint8Array(await req.arrayBuffer());
  if (!bytes.length) return fail('Arquivo vazio');
  if (bytes.length > MAX_UPLOAD_BYTES) return fail('Imagem acima de 5 MB após conversão', 413, 'IMAGE_TOO_LARGE');
  if (!isAllowedImage(bytes, mime)) return fail('Arquivo WEBP inválido', 415, 'INVALID_WEBP');

  const objectPath = `logos/${safeSegment(brand.slug || brand.name || brand.id)}/logo.webp`;
  const storageHeaders = adminHeaders(env, {
    'content-type': 'image/webp',
    'cache-control': '31536000',
    'x-upsert': 'true',
  });
  const storageResponse = await fetch(`${env.SUPABASE_URL}/storage/v1/object/${encodeURIComponent(BRAND_BUCKET)}/${encodedObjectPath(objectPath)}`, {
    method: 'POST',
    headers: storageHeaders,
    body: bytes,
  });
  const storageText = await storageResponse.text();
  if (!storageResponse.ok) throw new Error(`Supabase Storage ${storageResponse.status}: ${storageText.slice(0, 400)}`);

  const publicBase = `${env.SUPABASE_URL}/storage/v1/object/public/${encodeURIComponent(BRAND_BUCKET)}/${encodedObjectPath(objectPath)}`;
  const publicUrl = `${publicBase}?v=${Date.now()}`;
  const digest = await sha256(bytes);
  const sourceUrl = clean(url.searchParams.get('source'));
  const provider = clean(url.searchParams.get('provider')) || 'internet';
  const nextData = {
    ...(brand.data && typeof brand.data === 'object' ? brand.data : {}),
    logoUrl: publicUrl,
    logo: publicUrl,
    image: publicUrl,
  };

  await adminFetch(env, `/rest/v1/brands?id=eq.${encodeURIComponent(brand.id)}&company_id=eq.${encodeURIComponent(COMPANY_ID)}`, {
    method: 'PATCH',
    headers: { prefer: 'return=minimal' },
    body: JSON.stringify({ logo_url: publicUrl, data: nextData }),
  });

  const existing = await adminFetch(env, `/rest/v1/media_assets?company_id=eq.${encodeURIComponent(COMPANY_ID)}&owner_type=eq.brand&owner_id=eq.${encodeURIComponent(brand.id)}&kind=eq.brand-logo&select=id&order=created_at.desc&limit=1`);
  const mediaId = Array.isArray(existing) && existing[0]?.id ? clean(existing[0].id) : uid('media');
  const media = {
    company_id: COMPANY_ID,
    owner_type: 'brand',
    owner_id: brand.id,
    kind: 'brand-logo',
    bucket: BRAND_BUCKET,
    path: objectPath,
    public_url: publicUrl,
    mime_type: 'image/webp',
    size_bytes: bytes.length,
    sha256: digest,
    metadata: {
      source: 'internet-brand-search-v70',
      sourceUrl: sourceUrl || null,
      provider,
      processedAt: new Date().toISOString(),
      maxDimension: 1400,
      targetBytes: 307200,
    },
  };
  if (Array.isArray(existing) && existing[0]?.id) {
    await adminFetch(env, `/rest/v1/media_assets?id=eq.${encodeURIComponent(mediaId)}`, {
      method: 'PATCH',
      headers: { prefer: 'return=minimal' },
      body: JSON.stringify(media),
    });
  } else {
    await adminFetch(env, '/rest/v1/media_assets', {
      method: 'POST',
      headers: { prefer: 'return=minimal' },
      body: JSON.stringify({ id: mediaId, ...media }),
    });
  }

  try {
    await adminFetch(env, '/rest/v1/audit_logs', {
      method: 'POST',
      headers: { prefer: 'return=minimal' },
      body: JSON.stringify({
        company_id: COMPANY_ID,
        user_id: auth.user.id,
        action: 'brand.logo.internet-search',
        entity_type: 'brand',
        entity_id: brand.id,
        details: { brandName: brand.name, mediaId, objectPath, byteSize: bytes.length, provider, sourceUrl: sourceUrl || null },
      }),
    });
  } catch (error) {
    console.error('Falha ao registrar auditoria da logo da marca', error);
  }

  return ok({
    brand: { id: brand.id, name: brand.name, logoUrl: publicUrl },
    mediaKey: mediaId,
    url: publicUrl,
    storagePath: objectPath,
    byteSize: bytes.length,
    sha256: digest,
  });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(req.url);
      if (url.pathname === '/api/admin/brand-images/search' && req.method === 'GET') return await handleSearch(req, env);
      if (url.pathname === '/api/admin/brand-images/fetch' && req.method === 'GET') return await fetchRemoteImage(req, env);
      if (url.pathname === '/api/admin/brand-images/upload' && req.method === 'POST') return await uploadBrandLogo(req, env);
      return await baseWorker.fetch(req, env as never);
    } catch (error) {
      console.error('Falha no fluxo V70 de imagens de marcas', error);
      return fail(error instanceof Error ? error.message : 'Falha interna ao processar imagem da marca', 500, 'BRAND_IMAGE_INTERNAL_ERROR');
    }
  },
};
