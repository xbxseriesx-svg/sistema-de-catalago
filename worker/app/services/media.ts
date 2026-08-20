import type { Env } from '../env';
import { COMPANY_ID } from '../env';
import { uid } from '../domain';
import { clean, fail, ok } from '../http';
import { requireUser } from '../auth/session';
import { adminFetch, adminHeaders } from '../supabase';
import { storageBackedPublicMedia } from './product-images';

const MAX_MEDIA_BYTES = 25 * 1024 * 1024;

const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'application/pdf': 'pdf',
};

function bytesFromBase64(value: string) {
  const encoded = value.includes(',') ? value.slice(value.lastIndexOf(',') + 1) : value;
  const binary = atob(encoded.replace(/\s+/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function buffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function safeSegment(value: string) {
  return clean(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 100) || 'media';
}

function encodedObjectPath(path: string) {
  return path.split('/').filter(Boolean).map((segment) => encodeURIComponent(segment)).join('/');
}

function storageTarget(kind: string, mime: string) {
  if (kind === 'product-image') return null;
  if (kind.includes('brand')) return { bucket: 'brand-media', ownerType: 'brand' };
  if (mime === 'application/pdf' || kind.includes('catalog') || kind.includes('file')) {
    return { bucket: 'catalog-files', ownerType: 'catalog' };
  }
  return { bucket: 'marketing-media', ownerType: 'marketing' };
}

async function uploadObject(env: Env, bucket: string, path: string, mime: string, bytes: Uint8Array) {
  const headers = adminHeaders(env, {
    'content-type': mime,
    'cache-control': '31536000',
    'x-upsert': 'true',
  });
  const response = await fetch(
    `${env.SUPABASE_URL}/storage/v1/object/${encodeURIComponent(bucket)}/${encodedObjectPath(path)}`,
    { method: 'POST', headers, body: buffer(bytes) },
  );
  const text = await response.text();
  if (!response.ok) throw new Error(`Supabase Storage ${response.status}: ${text.slice(0, 400)}`);
}

async function deleteObject(env: Env, bucket: string, path: string) {
  if (!bucket || !path || bucket === 'legacy-d1-inline' || bucket === 'inline-db') return;
  const headers = adminHeaders(env);
  const response = await fetch(
    `${env.SUPABASE_URL}/storage/v1/object/${encodeURIComponent(bucket)}/${encodedObjectPath(path)}`,
    { method: 'DELETE', headers },
  );
  if (response.ok || response.status === 404) return;
  throw new Error(`Falha ao excluir objeto do Storage (${response.status})`);
}

async function createMedia(req: Request, env: Env) {
  const auth = await requireUser(req, env, ['EDITOR', 'ADMIN']);
  if (auth.error || !auth.user) return auth.error;

  const input = await req.json().catch(() => null) as any;
  if (!input) return fail('Payload de mídia inválido');
  const kind = clean(input.kind) || 'media';
  if (kind === 'product-image') return null;
  const encoded = clean(input.dataBase64);
  if (!encoded) return fail('Arquivo vazio');

  let bytes: Uint8Array;
  try {
    bytes = bytesFromBase64(encoded);
  } catch {
    return fail('Arquivo base64 inválido', 400, 'INVALID_BASE64');
  }
  if (!bytes.length) return fail('Arquivo vazio');
  if (bytes.length > MAX_MEDIA_BYTES) return fail('Arquivo acima de 25 MB', 413, 'MEDIA_TOO_LARGE');

  const mime = clean(input.contentType || input.mimeType || 'application/octet-stream').toLowerCase().split(';')[0];
  const ext = MIME_EXTENSIONS[mime];
  if (!ext) return fail('Formato de mídia não permitido', 415, 'MEDIA_FORMAT_UNSUPPORTED');
  const target = storageTarget(kind, mime);
  if (!target) return null;

  const id = uid('media');
  const entityKey = clean(input.entityKey) || 'geral';
  const objectPath = `${COMPANY_ID}/${safeSegment(entityKey)}/${id}.${ext}`;
  await uploadObject(env, target.bucket, objectPath, mime, bytes);
  const publicUrl = `${env.SUPABASE_URL}/storage/v1/object/public/${encodeURIComponent(target.bucket)}/${encodedObjectPath(objectPath)}?v=${Date.now()}`;

  await adminFetch(env, '/rest/v1/media_assets', {
    method: 'POST',
    headers: { prefer: 'return=minimal' },
    body: JSON.stringify({
      id,
      company_id: COMPANY_ID,
      owner_type: target.ownerType,
      owner_id: entityKey || null,
      kind,
      bucket: target.bucket,
      path: objectPath,
      public_url: publicUrl,
      mime_type: mime,
      size_bytes: bytes.length,
      metadata: {
        filename: clean(input.filename) || `${id}.${ext}`,
        storageProvider: 'supabase-storage',
        migratedContract: '/api/admin/media',
      },
    }),
  });

  return ok({
    mediaKey: id,
    url: publicUrl,
    deduplicated: false,
    byteSize: bytes.length,
  });
}

async function deleteMedia(req: Request, env: Env, id: string) {
  const auth = await requireUser(req, env, ['EDITOR', 'ADMIN']);
  if (auth.error || !auth.user) return auth.error;
  const rows = await adminFetch(
    env,
    `/rest/v1/media_assets?id=eq.${encodeURIComponent(id)}&company_id=eq.${encodeURIComponent(COMPANY_ID)}&select=id,bucket,path&limit=1`,
  );
  const item = Array.isArray(rows) ? rows[0] : null;
  if (!item) return fail('Mídia não encontrada', 404, 'NOT_FOUND');

  await deleteObject(env, clean(item.bucket), clean(item.path));
  await adminFetch(
    env,
    `/rest/v1/media_assets?id=eq.${encodeURIComponent(id)}&company_id=eq.${encodeURIComponent(COMPANY_ID)}`,
    { method: 'DELETE', headers: { prefer: 'return=minimal' } },
  );
  return ok({ id });
}

export async function publicMedia(env: Env, id: string) {
  const storage = await storageBackedPublicMedia(env, id);
  if (storage) return storage;

  // Compatibilidade somente de leitura para registros históricos inline.
  // A arquitetura nova nunca cria metadata.dataBase64.
  const rows = await adminFetch(
    env,
    `/rest/v1/media_assets?id=eq.${encodeURIComponent(id)}&company_id=eq.${encodeURIComponent(COMPANY_ID)}&select=mime_type,metadata&limit=1`,
  );
  const item = Array.isArray(rows) ? rows[0] : null;
  const encoded = clean(item?.metadata?.dataBase64);
  if (!item || !encoded) return fail('Mídia não encontrada', 404, 'NOT_FOUND');
  let bytes: Uint8Array;
  try {
    bytes = bytesFromBase64(encoded);
  } catch {
    return fail('Mídia histórica inválida', 500, 'INVALID_LEGACY_MEDIA');
  }
  return new Response(buffer(bytes), {
    headers: {
      'content-type': clean(item.mime_type) || 'application/octet-stream',
      'cache-control': 'public, max-age=31536000, immutable',
    },
  });
}

export async function handleMediaRoute(req: Request, env: Env, path: string): Promise<Response | null> {
  if (path === '/api/admin/media' && req.method === 'POST') {
    return createMedia(req, env);
  }
  const adminItem = path.match(/^\/api\/admin\/media\/([^/]+)$/);
  if (adminItem && req.method === 'DELETE') {
    return deleteMedia(req, env, decodeURIComponent(adminItem[1]));
  }
  const publicItem = path.match(/^\/api\/public\/media\/([^/]+)$/);
  if (publicItem && req.method === 'GET') {
    return publicMedia(env, decodeURIComponent(publicItem[1]));
  }
  return null;
}
