import baseWorker from './index';

type Env = {
  ASSETS: Fetcher;
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  SUPABASE_SECRET_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SDM_BOOTSTRAP_TOKEN?: string;
};

type ProductRow = {
  id: string;
  code: string;
  image_url?: string | null;
  gallery?: unknown;
  data?: Record<string, unknown> | null;
};

type AuthUser = {
  id: string;
  role: string;
};

const COMPANY_ID = 'cmp_asteryon';
const PRODUCT_BUCKET = 'product-images';
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/bmp',
  'image/svg+xml',
]);

const clean = (value: unknown) => String(value ?? '').trim();
const uid = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;

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

function fail(message: string, status = 400, code = 'BAD_REQUEST') {
  return json({ ok: false, error: { message, code } }, status);
}

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

function encodedObjectPath(path: string) {
  return path.split('/').filter(Boolean).map(segment => encodeURIComponent(segment)).join('/');
}

function safeSegment(value: string) {
  const result = value.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 120);
  return result || 'produto';
}

function extensionForMime(mime: string) {
  switch (mime) {
    case 'image/jpeg': return 'jpg';
    case 'image/png': return 'png';
    case 'image/webp': return 'webp';
    case 'image/gif': return 'gif';
    case 'image/avif': return 'avif';
    case 'image/bmp': return 'bmp';
    case 'image/svg+xml': return 'svg';
    default: return 'bin';
  }
}

function bytesFromBase64(value: string) {
  const encoded = value.includes(',') ? value.slice(value.lastIndexOf(',') + 1) : value;
  const binary = atob(encoded.replace(/\s+/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function sha256(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
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
  return { user: { id: user.id, role }, error: null };
}

async function findProduct(env: Env, codeOrId: string): Promise<ProductRow | null> {
  const code = encodeURIComponent(codeOrId);
  let rows = await adminFetch(env, `/rest/v1/products?company_id=eq.${encodeURIComponent(COMPANY_ID)}&code=eq.${code}&select=id,code,image_url,gallery,data&limit=1`);
  if (Array.isArray(rows) && rows[0]) return rows[0] as ProductRow;
  rows = await adminFetch(env, `/rest/v1/products?company_id=eq.${encodeURIComponent(COMPANY_ID)}&id=eq.${code}&select=id,code,image_url,gallery,data&limit=1`);
  return Array.isArray(rows) && rows[0] ? rows[0] as ProductRow : null;
}

async function uploadStorageObject(env: Env, objectPath: string, mime: string, bytes: Uint8Array) {
  const headers = adminHeaders(env, {
    'content-type': mime,
    'cache-control': 'max-age=31536000',
    'x-upsert': 'true',
  });
  const response = await fetch(
    `${env.SUPABASE_URL}/storage/v1/object/${encodeURIComponent(PRODUCT_BUCKET)}/${encodedObjectPath(objectPath)}`,
    { method: 'POST', headers, body: bytes },
  );
  const text = await response.text();
  if (!response.ok) throw new Error(`Supabase Storage ${response.status}: ${text.slice(0, 500)}`);
}

async function storeProductImage(
  env: Env,
  user: AuthUser,
  codeOrId: string,
  bytes: Uint8Array,
  mime: string,
  filename: string,
  sourceSize?: number,
  originalFilename?: string,
) {
  if (!codeOrId) return fail('Código do produto não informado');
  if (!ALLOWED_MIMES.has(mime)) return fail('Formato ainda não convertido para um tipo compatível. Use o Importador de Imagens V61.', 415, 'IMAGE_FORMAT_UNSUPPORTED');
  if (!bytes.byteLength) return fail('Arquivo vazio');
  if (bytes.byteLength > MAX_IMAGE_BYTES) return fail('Imagem acima de 5 MB após conversão', 413, 'IMAGE_TOO_LARGE');

  const product = await findProduct(env, codeOrId);
  if (!product) return fail(`Produto ${codeOrId} não encontrado`, 404, 'PRODUCT_NOT_FOUND');

  const productCode = clean(product.code);
  const ext = extensionForMime(mime);
  const objectPath = `${safeSegment(productCode)}/main.${ext}`;
  await uploadStorageObject(env, objectPath, mime, bytes);

  const version = Date.now();
  const publicBase = `${env.SUPABASE_URL}/storage/v1/object/public/${encodeURIComponent(PRODUCT_BUCKET)}/${encodedObjectPath(objectPath)}`;
  const publicUrl = `${publicBase}?v=${version}`;
  const digest = await sha256(bytes);

  const existing = await adminFetch(env, `/rest/v1/media_assets?company_id=eq.${encodeURIComponent(COMPANY_ID)}&owner_type=eq.product&owner_id=eq.${encodeURIComponent(productCode)}&kind=eq.product-image&select=id&order=created_at.desc&limit=1`);
  const mediaId = Array.isArray(existing) && existing[0]?.id ? clean(existing[0].id) : uid('media');
  const mediaPayload = {
    company_id: COMPANY_ID,
    owner_type: 'product',
    owner_id: productCode,
    kind: 'product-image',
    bucket: PRODUCT_BUCKET,
    path: objectPath,
    public_url: publicUrl,
    mime_type: mime,
    size_bytes: bytes.byteLength,
    sha256: digest,
    metadata: {
      filename: filename || `${productCode}.${ext}`,
      originalFilename: originalFilename || filename || `${productCode}.${ext}`,
      sourceSize: Number.isFinite(sourceSize) ? sourceSize : undefined,
      storageProvider: 'supabase-storage',
      importedBy: 'image-importer-v61',
      importedAt: new Date().toISOString(),
    },
  };

  if (Array.isArray(existing) && existing[0]?.id) {
    await adminFetch(env, `/rest/v1/media_assets?id=eq.${encodeURIComponent(mediaId)}`, {
      method: 'PATCH',
      headers: { prefer: 'return=minimal' },
      body: JSON.stringify(mediaPayload),
    });
  } else {
    await adminFetch(env, '/rest/v1/media_assets', {
      method: 'POST',
      headers: { prefer: 'return=minimal' },
      body: JSON.stringify({ id: mediaId, ...mediaPayload }),
    });
  }

  const nextGallery = [publicUrl];
  const nextData = {
    ...(product.data && typeof product.data === 'object' ? product.data : {}),
    image: publicUrl,
    gallery: nextGallery,
  };
  await adminFetch(env, `/rest/v1/products?id=eq.${encodeURIComponent(product.id)}&company_id=eq.${encodeURIComponent(COMPANY_ID)}`, {
    method: 'PATCH',
    headers: { prefer: 'return=minimal' },
    body: JSON.stringify({ image_url: publicUrl, gallery: nextGallery, data: nextData }),
  });

  await adminFetch(env, `/rest/v1/product_media?product_id=eq.${encodeURIComponent(product.id)}&role=eq.main`, {
    method: 'DELETE',
    headers: { prefer: 'return=minimal' },
  });
  await adminFetch(env, '/rest/v1/product_media', {
    method: 'POST',
    headers: { prefer: 'return=minimal' },
    body: JSON.stringify({ id: uid('pm'), product_id: product.id, media_asset_id: mediaId, role: 'main', sort_order: 0 }),
  });

  try {
    await adminFetch(env, '/rest/v1/audit_logs', {
      method: 'POST',
      headers: { prefer: 'return=minimal' },
      body: JSON.stringify({
        company_id: COMPANY_ID,
        user_id: user.id,
        action: 'product.image.import',
        entity_type: 'product',
        entity_id: product.id,
        details: { code: productCode, mediaId, objectPath, byteSize: bytes.byteLength, sourceSize: sourceSize || null },
      }),
    });
  } catch (error) {
    console.error('Falha ao auditar importação da imagem', error);
  }

  return json({
    ok: true,
    code: productCode,
    productId: product.id,
    mediaKey: mediaId,
    url: publicUrl,
    storagePath: objectPath,
    byteSize: bytes.byteLength,
    sha256: digest,
    deduplicated: false,
  });
}

async function handleBinaryImport(req: Request, env: Env) {
  const auth = await requireEditor(req, env);
  if (auth.error || !auth.user) return auth.error!;
  const url = new URL(req.url);
  const code = clean(url.searchParams.get('code'));
  const filename = clean(url.searchParams.get('filename')) || `${code}.webp`;
  const originalFilename = clean(url.searchParams.get('originalFilename')) || filename;
  const sourceSize = Number(url.searchParams.get('sourceSize') || 0);
  const mime = clean(req.headers.get('content-type')).split(';')[0].toLowerCase();
  const bytes = new Uint8Array(await req.arrayBuffer());
  return storeProductImage(env, auth.user, code, bytes, mime, filename, sourceSize, originalFilename);
}

async function handleLegacyMedia(req: Request, env: Env) {
  const clone = req.clone();
  let input: any = null;
  try { input = await clone.json(); } catch { return baseWorker.fetch(req, env as never); }
  if (clean(input?.kind) !== 'product-image') return baseWorker.fetch(req, env as never);

  const auth = await requireEditor(req, env);
  if (auth.error || !auth.user) return auth.error!;
  const encoded = clean(input.dataBase64);
  if (!encoded) return fail('Arquivo vazio');
  let bytes: Uint8Array;
  try { bytes = bytesFromBase64(encoded); } catch { return fail('Imagem inválida', 400, 'INVALID_BASE64'); }
  const mime = clean(input.contentType || input.mimeType || 'application/octet-stream').toLowerCase();
  return storeProductImage(
    env,
    auth.user,
    clean(input.entityKey),
    bytes,
    mime,
    clean(input.filename),
    Number(input.sizeBytes || 0),
    clean(input.filename),
  );
}

async function handleStorageBackedPublicMedia(req: Request, env: Env, id: string) {
  const rows = await adminFetch(env, `/rest/v1/media_assets?id=eq.${encodeURIComponent(id)}&select=public_url,bucket,path&limit=1`);
  const item = Array.isArray(rows) ? rows[0] : null;
  const target = clean(item?.public_url);
  if (target.startsWith('https://') || target.startsWith('http://')) {
    return secure(new Response(null, {
      status: 302,
      headers: { location: target, 'cache-control': 'public, max-age=300' },
    }));
  }
  return null;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(req.url);
      const path = url.pathname;

      if (path === '/api/admin/product-images/import' && req.method === 'POST') {
        return await handleBinaryImport(req, env);
      }

      if (path === '/api/admin/media' && req.method === 'POST') {
        return await handleLegacyMedia(req, env);
      }

      const mediaMatch = path.match(/^\/api\/public\/media\/([^/]+)$/);
      if (mediaMatch && req.method === 'GET') {
        const response = await handleStorageBackedPublicMedia(req, env, decodeURIComponent(mediaMatch[1]));
        if (response) return response;
      }

      return await baseWorker.fetch(req, env as never);
    } catch (error) {
      console.error('Falha no fluxo V61 de imagens', error);
      return fail('Falha ao armazenar ou vincular a imagem', 500, 'IMAGE_STORAGE_ERROR');
    }
  },
};
