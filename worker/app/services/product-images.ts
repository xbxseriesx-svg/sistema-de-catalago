import type { Env } from '../env';
import { COMPANY_ID } from '../env';
import { uid } from '../domain';
import { clean, fail, json } from '../http';
import { requireUser } from '../auth/session';
import { adminFetch, adminHeaders } from '../supabase';

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

type ProductRow = {
  id: string;
  code: string;
  image_url?: string | null;
  gallery?: unknown;
  data?: Record<string, unknown> | null;
};

type AuthUser = { id: string };

function encodedObjectPath(path: string) {
  return path.split('/').filter(Boolean).map((segment) => encodeURIComponent(segment)).join('/');
}

function safeSegment(value: string) {
  const result = value
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 120);
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
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function arrayBufferFromBytes(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function sha256(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest('SHA-256', arrayBufferFromBytes(bytes));
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

async function requireEditor(req: Request, env: Env) {
  return requireUser(req, env, ['EDITOR', 'ADMIN']);
}

async function findProduct(env: Env, codeOrId: string): Promise<ProductRow | null> {
  const encoded = encodeURIComponent(codeOrId);
  let rows = await adminFetch(
    env,
    `/rest/v1/products?company_id=eq.${encodeURIComponent(COMPANY_ID)}&code=eq.${encoded}&select=id,code,image_url,gallery,data&limit=1`,
  );
  if (Array.isArray(rows) && rows[0]) return rows[0] as ProductRow;
  rows = await adminFetch(
    env,
    `/rest/v1/products?company_id=eq.${encodeURIComponent(COMPANY_ID)}&id=eq.${encoded}&select=id,code,image_url,gallery,data&limit=1`,
  );
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
    { method: 'POST', headers, body: arrayBufferFromBytes(bytes) },
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
  if (!ALLOWED_MIMES.has(mime)) {
    return fail('Formato ainda não convertido para um tipo compatível. Use o Importador de Imagens.', 415, 'IMAGE_FORMAT_UNSUPPORTED');
  }
  if (!bytes.byteLength) return fail('Arquivo vazio');
  if (bytes.byteLength > MAX_IMAGE_BYTES) {
    return fail('Imagem acima de 5 MB após conversão', 413, 'IMAGE_TOO_LARGE');
  }

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

  const existing = await adminFetch(
    env,
    `/rest/v1/media_assets?company_id=eq.${encodeURIComponent(COMPANY_ID)}&owner_type=eq.product&owner_id=eq.${encodeURIComponent(productCode)}&kind=eq.product-image&select=id&order=created_at.desc&limit=1`,
  );
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
      importedBy: 'product-image-importer',
      importedAt: new Date().toISOString(),
    },
  };

  if (Array.isArray(existing) && existing[0]?.id) {
    await adminFetch(
      env,
      `/rest/v1/media_assets?id=eq.${encodeURIComponent(mediaId)}&company_id=eq.${encodeURIComponent(COMPANY_ID)}`,
      {
        method: 'PATCH',
        headers: { prefer: 'return=minimal' },
        body: JSON.stringify(mediaPayload),
      },
    );
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
  await adminFetch(
    env,
    `/rest/v1/products?id=eq.${encodeURIComponent(product.id)}&company_id=eq.${encodeURIComponent(COMPANY_ID)}`,
    {
      method: 'PATCH',
      headers: { prefer: 'return=minimal' },
      body: JSON.stringify({ image_url: publicUrl, gallery: nextGallery, data: nextData }),
    },
  );

  await adminFetch(env, `/rest/v1/product_media?product_id=eq.${encodeURIComponent(product.id)}&role=eq.main`, {
    method: 'DELETE',
    headers: { prefer: 'return=minimal' },
  });
  await adminFetch(env, '/rest/v1/product_media', {
    method: 'POST',
    headers: { prefer: 'return=minimal' },
    body: JSON.stringify({
      id: uid('pm'),
      product_id: product.id,
      media_asset_id: mediaId,
      role: 'main',
      sort_order: 0,
    }),
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
        details: {
          code: productCode,
          mediaId,
          objectPath,
          byteSize: bytes.byteLength,
          sourceSize: sourceSize || null,
        },
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
  if (auth.error || !auth.user) return auth.error;
  const url = new URL(req.url);
  const code = clean(url.searchParams.get('code'));
  const filename = clean(url.searchParams.get('filename')) || `${code}.webp`;
  const originalFilename = clean(url.searchParams.get('originalFilename')) || filename;
  const sourceSize = Number(url.searchParams.get('sourceSize') || 0);
  const mime = clean(req.headers.get('content-type')).split(';')[0].toLowerCase();
  const bytes = new Uint8Array(await req.arrayBuffer());
  return storeProductImage(env, auth.user, code, bytes, mime, filename, sourceSize, originalFilename);
}

async function handleProductImageMedia(req: Request, env: Env) {
  const clone = req.clone();
  let input: any = null;
  try {
    input = await clone.json();
  } catch {
    return null;
  }
  if (clean(input?.kind) !== 'product-image') return null;

  const auth = await requireEditor(req, env);
  if (auth.error || !auth.user) return auth.error;
  const encoded = clean(input.dataBase64);
  if (!encoded) return fail('Arquivo vazio');
  let bytes: Uint8Array;
  try {
    bytes = bytesFromBase64(encoded);
  } catch {
    return fail('Imagem inválida', 400, 'INVALID_BASE64');
  }
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

export async function storageBackedPublicMedia(env: Env, id: string) {
  const rows = await adminFetch(
    env,
    `/rest/v1/media_assets?id=eq.${encodeURIComponent(id)}&select=public_url,bucket,path&limit=1`,
  );
  const item = Array.isArray(rows) ? rows[0] : null;
  const target = clean(item?.public_url);
  if (target.startsWith('https://') || target.startsWith('http://')) {
    return new Response(null, {
      status: 302,
      headers: { location: target, 'cache-control': 'public, max-age=300' },
    });
  }
  return null;
}

export async function handleProductImagesRoute(req: Request, env: Env, path: string): Promise<Response | null> {
  if (path === '/api/admin/product-images/import' && req.method === 'POST') {
    return handleBinaryImport(req, env);
  }
  if (path === '/api/admin/media' && req.method === 'POST') {
    return handleProductImageMedia(req, env);
  }
  return null;
}
