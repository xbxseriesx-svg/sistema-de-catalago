import type { Env } from '../env';
import { COMPANY_ID } from '../env';
import { audit } from '../audit';
import { requireUser } from '../auth/session';
import { clean, fail, ok, requestBody } from '../http';
import { adminFetch, publicSupabase, table } from '../supabase';

const MAX_PRODUCT_SEGMENTS = 5;

function segmentDto(row: any) {
  return {
    id: String(row?.id || ''),
    name: String(row?.name || ''),
    active: row?.active !== false,
    sortOrder: Number(row?.sort_order || 0),
  };
}

function productDto(row: any) {
  return {
    id: row?.id,
    code: row?.code,
    ean: row?.ean ?? null,
    name: row?.name,
    shortDescription: row?.short_description ?? row?.name ?? '',
    longDescription: row?.long_description ?? row?.short_description ?? row?.name ?? '',
    brandId: row?.brand_id ?? null,
    departamentoId: row?.departamento_id ?? null,
    secaoId: row?.secao_id ?? null,
    categoriaId: row?.categoria_id ?? null,
    unit: row?.unit ?? null,
    packaging: row?.packaging ?? null,
    ncm: row?.ncm ?? null,
    price: row?.price ?? null,
    promoPrice: row?.promo_price ?? null,
    stock: row?.stock ?? null,
    image: row?.image_url ?? null,
    imageUrl: row?.image_url ?? null,
    videoUrl: row?.video_url ?? null,
    gallery: Array.isArray(row?.gallery) ? row.gallery : [],
    technical: row?.technical && typeof row.technical === 'object' ? row.technical : {},
    attributes: row?.attributes && typeof row.attributes === 'object' ? row.attributes : {},
    tags: Array.isArray(row?.tags) ? row.tags : [],
    status: 'ativo',
  };
}

async function segments(env: Env, publicOnly = false) {
  const query = `company_id=eq.${COMPANY_ID}&active=eq.true&select=id,name,active,sort_order&order=sort_order.asc,name.asc`;
  if (publicOnly) {
    const rows = await publicSupabase(env, `/rest/v1/commercial_segments?${query}`);
    if (!Array.isArray(rows)) throw new Error('Resposta pública inválida de segmentos comerciais');
    return rows.map(segmentDto);
  }
  const rows = await table(env, 'commercial_segments', query) as any[];
  return (rows || []).map(segmentDto);
}

function safeScore(value: unknown) {
  const score = Math.round(Number(value));
  return Number.isFinite(score) ? Math.max(30, Math.min(100, score)) : 70;
}

export async function handleCommercialSegmentsRoute(
  req: Request,
  env: Env,
  path: string,
): Promise<Response | null> {
  if (path === '/api/public/commercial-segments' && req.method === 'GET') {
    return ok({ segments: await segments(env, true) });
  }

  const publicProducts = path.match(/^\/api\/public\/commercial-segments\/([^/]+)\/products$/);
  if (publicProducts && req.method === 'GET') {
    const segmentId = decodeURIComponent(publicProducts[1]);
    const url = new URL(req.url);
    const offset = Math.max(0, Number.parseInt(url.searchParams.get('offset') || '0', 10) || 0);
    const limit = Math.min(500, Math.max(1, Number.parseInt(url.searchParams.get('limit') || '100', 10) || 100));
    const rows = await publicSupabase(env, '/rest/v1/rpc/get_public_segment_products', {
      method: 'POST',
      body: JSON.stringify({ p_segment_id: segmentId, p_offset: offset, p_limit: limit }),
    });
    if (!Array.isArray(rows)) return fail('Segmento indisponível', 404, 'SEGMENT_NOT_FOUND');
    return ok({ products: rows.map(productDto), offset, limit, hasMore: rows.length === limit });
  }

  if (path === '/api/admin/commercial-segments' && req.method === 'GET') {
    const auth = await requireUser(req, env, ['VIEWER', 'EDITOR', 'ADMIN']);
    if (auth.error || !auth.user) return auth.error;
    return ok({ segments: await segments(env, false) });
  }

  const productSegments = path.match(/^\/api\/admin\/products\/([^/]+)\/commercial-segments$/);
  if (productSegments && ['GET', 'PUT'].includes(req.method)) {
    const auth = await requireUser(
      req,
      env,
      req.method === 'GET' ? ['VIEWER', 'EDITOR', 'ADMIN'] : ['EDITOR', 'ADMIN'],
    );
    if (auth.error || !auth.user) return auth.error;
    const productId = decodeURIComponent(productSegments[1]);
    const productRows = await table(
      env,
      'products',
      `id=eq.${encodeURIComponent(productId)}&company_id=eq.${COMPANY_ID}&select=id,code,name&limit=1`,
    ) as any[];
    const product = productRows?.[0];
    if (!product) return fail('Produto não encontrado', 404, 'NOT_FOUND');

    if (req.method === 'GET') {
      const [available, links] = await Promise.all([
        segments(env, false),
        table(
          env,
          'product_segments',
          `product_id=eq.${encodeURIComponent(productId)}&company_id=eq.${COMPANY_ID}&select=segment_id,score,reason,classification_source,manually_reviewed,manual_excluded,updated_at`,
        ) as Promise<any[]>,
      ]);
      const current = new Map((links || []).map((item: any) => [String(item.segment_id), item]));
      return ok({
        product: { id: product.id, code: product.code, name: product.name },
        maxSegments: MAX_PRODUCT_SEGMENTS,
        segments: available.map((item: any) => {
          const link: any = current.get(item.id);
          return {
            ...item,
            selected: !!link && !link.manual_excluded,
            score: link ? Number(link.score) : null,
            reason: link?.reason || '',
            source: link?.classification_source || null,
            manuallyReviewed: !!link?.manually_reviewed,
            manuallyExcluded: !!link?.manual_excluded,
            updatedAt: link?.updated_at || null,
          };
        }),
      });
    }

    const input = await requestBody(req);
    const requested = Array.isArray(input.segments) ? input.segments : [];
    if (requested.length > MAX_PRODUCT_SEGMENTS) {
      return fail(`Selecione no máximo ${MAX_PRODUCT_SEGMENTS} segmentos comerciais`, 400, 'SEGMENT_LIMIT');
    }
    const available = await segments(env, false);
    const allowed = new Map(available.map((item: any) => [item.id, item]));
    const selected = new Map<string, { score: number; reason: string }>();
    for (const item of requested) {
      const segmentId = clean(item?.segmentId ?? item?.segment_id ?? item?.id);
      if (!allowed.has(segmentId)) return fail('Segmento comercial inválido', 400, 'INVALID_SEGMENT');
      if (selected.has(segmentId)) continue;
      selected.set(segmentId, {
        score: safeScore(item?.score),
        reason: clean(item?.reason ?? item?.motivo).slice(0, 500) || 'Associação comercial ajustada manualmente.',
      });
    }

    const rows = available.map((segment: any) => {
      const choice = selected.get(segment.id);
      return {
        product_id: productId,
        segment_id: segment.id,
        company_id: COMPANY_ID,
        score: choice?.score ?? 30,
        reason: choice?.reason || 'Excluído manualmente da segmentação comercial.',
        classification_source: 'manual',
        manually_reviewed: true,
        manual_excluded: !choice,
        updated_at: new Date().toISOString(),
      };
    });

    await table(env, 'product_segments', 'on_conflict=product_id,segment_id', {
      method: 'POST',
      headers: { prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(rows),
    });
    await audit(env, auth.user, 'commercial_segments.manual_update', 'product', productId, {
      selected: [...selected.entries()].map(([segmentId, value]) => ({ segmentId, ...value })),
      excludedCount: available.length - selected.size,
    });
    return ok({ productId, selected: selected.size, maxSegments: MAX_PRODUCT_SEGMENTS });
  }

  const recalculate = path.match(/^\/api\/admin\/products\/([^/]+)\/commercial-segments\/recalculate$/);
  if (recalculate && req.method === 'POST') {
    const auth = await requireUser(req, env, ['EDITOR', 'ADMIN']);
    if (auth.error || !auth.user) return auth.error;
    const productId = decodeURIComponent(recalculate[1]);
    const productRows = await table(
      env,
      'products',
      `id=eq.${encodeURIComponent(productId)}&company_id=eq.${COMPANY_ID}&select=id,code,name&limit=1`,
    ) as any[];
    if (!productRows?.length) return fail('Produto não encontrado', 404, 'NOT_FOUND');

    await table(env, 'product_segments', `product_id=eq.${encodeURIComponent(productId)}&company_id=eq.${COMPANY_ID}`, {
      method: 'DELETE',
      headers: { prefer: 'return=minimal' },
    });
    const result = await adminFetch(env, '/rest/v1/rpc/reclassify_commercial_products', {
      method: 'POST',
      body: JSON.stringify({ p_product_ids: [productId] }),
    });
    await audit(env, auth.user, 'commercial_segments.recalculate', 'product', productId, result || {});
    return ok({ productId, result });
  }

  return null;
}
