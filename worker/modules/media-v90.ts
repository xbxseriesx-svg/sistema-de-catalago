type Env = {
  SUPABASE_URL: string;
  SUPABASE_SECRET_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

type UserContext = { id: string; role: string };

type MediaRow = {
  id: string;
  company_id: string;
  owner_type: string;
  owner_id?: string | null;
  kind: string;
  bucket: string;
  path: string;
  public_url?: string | null;
  mime_type?: string | null;
  size_bytes?: number | null;
  sha256?: string | null;
  metadata?: Record<string, unknown> | null;
};

const clean = (value: unknown) => String(value ?? '').trim();
const uid = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});
const ok = (data: Record<string, unknown> = {}) => json({ ok: true, ...data });
const fail = (message: string, status = 400, code = 'BAD_REQUEST') => json({ ok: false, error: { message, code } }, status);

const bucketRules = {
  'product-images': { max: 10 * 1024 * 1024, mimes: new Set(['image/jpeg','image/png','image/webp','image/gif']) },
  'brand-media': { max: 15 * 1024 * 1024, mimes: new Set(['image/jpeg','image/png','image/webp','image/gif']) },
  'marketing-media': { max: 50 * 1024 * 1024, mimes: new Set(['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm']) },
  'catalog-files': { max: 50 * 1024 * 1024, mimes: new Set(['application/pdf']) },
} as const;

type Bucket = keyof typeof bucketRules;

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
  if (text) { try { data = JSON.parse(text); } catch { data = text; } }
  return { response, text, data };
}

async function select(env: Env, table: string, query: string) {
  const result = await api(env, `/rest/v1/${table}?${query}`);
  if (!result.response.ok) throw new Error(`Supabase ${result.response.status}: ${result.text.slice(0, 300)}`);
  return Array.isArray(result.data) ? result.data : [];
}

function canEdit(role: string) {
  return ['owner','admin','editor','SDM','ADMIN','EDITOR'].includes(clean(role));
}

function safeSegment(value: string) {
  return clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120) || 'media';
}

function encodedObjectPath(path: string) {
  return path.split('/').filter(Boolean).map(segment => encodeURIComponent(segment)).join('/');
}

function normalizeMime(value: unknown) {
  const mime = clean(value).toLowerCase().split(';')[0];
  return mime === 'image/jpg' ? 'image/jpeg' : mime;
}

function mimeFromDataUrl(value: string) {
  const match = value.match(/^data:([^;,]+)[;,]/i);
  return match ? normalizeMime(match[1]) : '';
}

function bytesFromBase64(value: string) {
  const encoded = value.includes(',') ? value.slice(value.lastIndexOf(',') + 1) : value;
  const binary = atob(encoded.replace(/\s+/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function arrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function extensionForMime(mime: string) {
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/gif') return 'gif';
  if (mime === 'video/mp4') return 'mp4';
  if (mime === 'video/webm') return 'webm';
  if (mime === 'application/pdf') return 'pdf';
  return 'bin';
}

function validContent(bytes: Uint8Array, mime: string) {
  if (mime === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === 'image/png') return bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  if (mime === 'image/webp') return bytes.length >= 12 && String.fromCharCode(...bytes.slice(0,4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8,12)) === 'WEBP';
  if (mime === 'image/gif') return bytes.length >= 6 && ['GIF87a','GIF89a'].includes(String.fromCharCode(...bytes.slice(0,6)));
  if (mime === 'application/pdf') return bytes.length >= 5 && String.fromCharCode(...bytes.slice(0,5)) === '%PDF-';
  if (mime === 'video/mp4') return bytes.length >= 12 && String.fromCharCode(...bytes.slice(4,8)) === 'ftyp';
  if (mime === 'video/webm') return bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
  return false;
}

async function sha256(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest('SHA-256', arrayBuffer(bytes));
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
}

function targetFor(kind: string, mime: string): { bucket: Bucket; ownerType: string } {
  if (kind === 'product-image') return { bucket: 'product-images', ownerType: 'product' };
  if (kind === 'brand-logo' || kind === 'brand-image') return { bucket: 'brand-media', ownerType: 'brand' };
  if (mime === 'application/pdf' || kind === 'catalog-file') return { bucket: 'catalog-files', ownerType: 'catalog' };
  return { bucket: 'marketing-media', ownerType: 'marketing' };
}

async function audit(env: Env, companyId: string, userId: string, action: string, entityId: string, details: unknown) {
  const result = await api(env, '/rest/v1/audit_logs', {
    method: 'POST', headers: { prefer: 'return=minimal' },
    body: JSON.stringify({ company_id: companyId, user_id: userId, action, entity_type: 'media', entity_id: entityId, details }),
  });
  if (!result.response.ok) throw new Error(`Falha de auditoria ${result.response.status}`);
}

async function uploadMedia(req: Request, env: Env, companyId: string, user: UserContext) {
  const input = await req.json().catch(() => ({})) as any;
  const encoded = clean(input.dataBase64);
  if (!encoded) return fail('Arquivo vazio');

  let bytes: Uint8Array;
  try { bytes = bytesFromBase64(encoded); } catch { return fail('Conteúdo Base64 inválido', 400, 'INVALID_BASE64'); }
  if (!bytes.byteLength) return fail('Arquivo vazio');

  const mime = normalizeMime(input.contentType) || mimeFromDataUrl(encoded) || 'application/octet-stream';
  const kind = clean(input.kind) || 'image';
  const target = targetFor(kind, mime);
  const rules = bucketRules[target.bucket];
  if (!rules.mimes.has(mime as never)) return fail('Formato de mídia não permitido para este tipo de arquivo', 415, 'MEDIA_FORMAT_UNSUPPORTED');
  if (bytes.byteLength > rules.max) return fail('Arquivo acima do limite permitido', 413, 'MEDIA_TOO_LARGE');
  if (!validContent(bytes, mime)) return fail('O conteúdo do arquivo não corresponde ao formato informado', 415, 'INVALID_MEDIA_CONTENT');

  const digest = await sha256(bytes);
  const duplicate = await select(
    env,
    'media_assets',
    `company_id=eq.${encodeURIComponent(companyId)}&owner_type=eq.${encodeURIComponent(target.ownerType)}&kind=eq.${encodeURIComponent(kind)}&sha256=eq.${digest}&select=id,public_url,bucket,path,size_bytes&limit=1`,
  );
  if (duplicate[0]?.id) {
    return ok({ mediaKey: duplicate[0].id, url: duplicate[0].public_url, deduplicated: true, byteSize: duplicate[0].size_bytes || bytes.byteLength });
  }

  const id = uid('media');
  const ownerId = clean(input.entityKey) || null;
  const ext = extensionForMime(mime);
  const objectPath = `${safeSegment(companyId)}/${safeSegment(target.ownerType)}/${safeSegment(ownerId || kind)}/${id}.${ext}`;
  const storage = await api(env, `/storage/v1/object/${encodeURIComponent(target.bucket)}/${encodedObjectPath(objectPath)}`, {
    method: 'POST',
    headers: { 'content-type': mime, 'cache-control': '31536000', 'x-upsert': 'false' },
    body: arrayBuffer(bytes),
  });
  if (!storage.response.ok) throw new Error(`Supabase Storage ${storage.response.status}: ${storage.text.slice(0, 300)}`);

  const publicUrl = `${env.SUPABASE_URL}/storage/v1/object/public/${encodeURIComponent(target.bucket)}/${encodedObjectPath(objectPath)}`;
  const mediaPayload = {
    id,
    company_id: companyId,
    owner_type: target.ownerType,
    owner_id: ownerId,
    kind,
    bucket: target.bucket,
    path: objectPath,
    public_url: publicUrl,
    mime_type: mime,
    size_bytes: bytes.byteLength,
    sha256: digest,
    metadata: {
      filename: clean(input.filename) || `${id}.${ext}`,
      storageProvider: 'supabase-storage',
      uploadedAt: new Date().toISOString(),
    },
  };
  const insert = await api(env, '/rest/v1/media_assets', {
    method: 'POST', headers: { prefer: 'return=minimal' }, body: JSON.stringify(mediaPayload),
  });
  if (!insert.response.ok) {
    await api(env, `/storage/v1/object/${encodeURIComponent(target.bucket)}/${encodedObjectPath(objectPath)}`, { method: 'DELETE' }).catch(() => null);
    throw new Error(`Falha ao registrar mídia ${insert.response.status}: ${insert.text.slice(0, 300)}`);
  }

  await audit(env, companyId, user.id, 'media.upload', id, { kind, bucket: target.bucket, ownerId, size: bytes.byteLength });
  return ok({ mediaKey: id, url: publicUrl, deduplicated: false, byteSize: bytes.byteLength });
}

async function deleteMedia(env: Env, companyId: string, user: UserContext, id: string) {
  const rows = await select(
    env,
    'media_assets',
    `id=eq.${encodeURIComponent(id)}&company_id=eq.${encodeURIComponent(companyId)}&select=id,owner_type,owner_id,kind,bucket,path,public_url,mime_type,size_bytes,sha256,metadata&limit=1`,
  ) as MediaRow[];
  const media = rows[0];
  if (!media) return fail('Mídia não encontrada', 404, 'NOT_FOUND');

  if (media.owner_type === 'product' && media.public_url) {
    const productQuery = media.owner_id
      ? `company_id=eq.${encodeURIComponent(companyId)}&or=(id.eq.${encodeURIComponent(media.owner_id)},code.eq.${encodeURIComponent(media.owner_id)})&select=id,image_url,gallery,data`
      : '';
    if (productQuery) {
      const products = await select(env, 'products', productQuery);
      for (const product of products) {
        const gallery = Array.isArray(product.gallery) ? product.gallery.filter((item: unknown) => String(item) !== media.public_url) : [];
        const patch: Record<string, unknown> = { gallery, data: { ...(product.data || {}), gallery } };
        if (String(product.image_url || '') === media.public_url) {
          patch.image_url = gallery[0] || null;
          (patch.data as any).image = gallery[0] || null;
        }
        const update = await api(env, `/rest/v1/products?id=eq.${encodeURIComponent(product.id)}&company_id=eq.${encodeURIComponent(companyId)}`, {
          method: 'PATCH', headers: { prefer: 'return=minimal' }, body: JSON.stringify(patch),
        });
        if (!update.response.ok) throw new Error(`Falha ao desvincular produto ${update.response.status}`);
      }
    }
  }

  if (media.bucket && media.path && media.bucket !== 'legacy-d1-inline') {
    const storageDelete = await api(env, `/storage/v1/object/${encodeURIComponent(media.bucket)}/${encodedObjectPath(media.path)}`, { method: 'DELETE' });
    if (!storageDelete.response.ok && storageDelete.response.status !== 404) throw new Error(`Falha ao excluir objeto ${storageDelete.response.status}`);
  }
  const deletion = await api(env, `/rest/v1/media_assets?id=eq.${encodeURIComponent(id)}&company_id=eq.${encodeURIComponent(companyId)}`, {
    method: 'DELETE', headers: { prefer: 'return=minimal' },
  });
  if (!deletion.response.ok) throw new Error(`Falha ao excluir mídia ${deletion.response.status}`);
  await audit(env, companyId, user.id, 'media.delete', id, { bucket: media.bucket, path: media.path });
  return ok({ mediaKey: id });
}

export async function handleMediaRoute(req: Request, env: Env, path: string, companyId: string, user: UserContext): Promise<Response | null> {
  if (!canEdit(user.role)) return path.startsWith('/api/admin/media') ? fail('Permissão insuficiente', 403, 'FORBIDDEN') : null;
  if (path === '/api/admin/media' && req.method === 'POST') return uploadMedia(req, env, companyId, user);
  const item = path.match(/^\/api\/admin\/media\/([^/]+)$/);
  if (item && req.method === 'DELETE') return deleteMedia(env, companyId, user, decodeURIComponent(item[1]));
  return null;
}
