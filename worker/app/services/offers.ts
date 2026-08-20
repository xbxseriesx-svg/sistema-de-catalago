import type { Env } from '../env';
import { COMPANY_ID } from '../env';
import { audit } from '../audit';
import { uid } from '../domain';
import { clean, ok, requestBody } from '../http';
import { requireUser } from '../auth/session';
import { table } from '../supabase';
import { offersPayload } from './catalog';

async function saveOffer(env: Env, user: any, input: any, id: string | null) {
  const offerId = id || uid('offer');
  const title = clean(input.title) || 'Vitrine de Ofertas';
  const productIds = Array.isArray(input.productIds)
    ? [...new Set<string>(input.productIds.map(clean).filter(Boolean))].slice(0, 1500)
    : [];
  const item = {
    id: offerId,
    company_id: COMPANY_ID,
    title,
    description: clean(input.description) || null,
    status: ['published', 'draft', 'archived'].includes(clean(input.status)) ? clean(input.status) : 'draft',
    featured: !!input.featured,
    starts_at: clean(input.startsAt) || null,
    ends_at: clean(input.endsAt) || null,
    display_config: {
      displayFields: Array.isArray(input.displayFields) ? input.displayFields : [],
    },
    data: {},
  };

  await table(env, 'offers', 'on_conflict=id', {
    method: 'POST',
    headers: { prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(item),
  });
  await table(env, 'offer_products', `offer_id=eq.${encodeURIComponent(offerId)}`, {
    method: 'DELETE',
    headers: { prefer: 'return=minimal' },
  });
  if (productIds.length) {
    await table(env, 'offer_products', '', {
      method: 'POST',
      headers: { prefer: 'return=minimal' },
      body: JSON.stringify(productIds.map((productId, sortOrder) => ({
        offer_id: offerId,
        product_id: productId,
        sort_order: sortOrder,
      }))),
    });
  }
  await audit(env, user, id ? 'offer.update' : 'offer.create', 'offer', offerId, {
    products: productIds.length,
  });
  return ok({
    offer: {
      id: offerId,
      title,
      description: item.description,
      status: item.status,
      featured: item.featured,
      startsAt: item.starts_at,
      endsAt: item.ends_at,
      productIds,
    },
  });
}

export async function handleOffersRoute(req: Request, env: Env, path: string): Promise<Response | null> {
  if (path === '/api/admin/catalog/offers' && req.method === 'GET') {
    const auth = await requireUser(req, env);
    if (auth.error) return auth.error;
    return ok({ offers: await offersPayload(env, false) });
  }

  if (path === '/api/admin/catalog/offers' && req.method === 'POST') {
    const auth = await requireUser(req, env, ['EDITOR', 'ADMIN']);
    if (auth.error || !auth.user) return auth.error;
    return saveOffer(env, auth.user, await requestBody(req), null);
  }

  const offerItem = path.match(/^\/api\/admin\/catalog\/offers\/([^/]+)$/);
  if (offerItem && ['PUT', 'DELETE'].includes(req.method)) {
    const auth = await requireUser(req, env, ['EDITOR', 'ADMIN']);
    if (auth.error || !auth.user) return auth.error;
    const id = decodeURIComponent(offerItem[1]);
    if (req.method === 'DELETE') {
      await table(env, 'offers', `id=eq.${encodeURIComponent(id)}&company_id=eq.${COMPANY_ID}`, {
        method: 'DELETE',
        headers: { prefer: 'return=minimal' },
      });
      await audit(env, auth.user, 'offer.delete', 'offer', id);
      return ok({ id });
    }
    return saveOffer(env, auth.user, await requestBody(req), id);
  }

  return null;
}
