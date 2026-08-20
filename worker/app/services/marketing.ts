import type { Env } from '../env';
import { COMPANY_ID } from '../env';
import { audit } from '../audit';
import { marketingLayout } from '../domain';
import { ok, requestBody } from '../http';
import { requireUser } from '../auth/session';
import { table } from '../supabase';
import { handlePublicCatalogRoute } from './catalog';

export async function handleMarketingRoute(req: Request, env: Env, path: string): Promise<Response | null> {
  if (path === '/api/admin/marketing' && req.method === 'GET') {
    const auth = await requireUser(req, env);
    if (auth.error) return auth.error;
    return handlePublicCatalogRoute(new Request(req, { method: 'GET' }), env, '/api/public/marketing');
  }

  if (path === '/api/admin/marketing' && req.method === 'PUT') {
    const auth = await requireUser(req, env, ['EDITOR', 'ADMIN']);
    if (auth.error || !auth.user) return auth.error;
    const input = await requestBody(req);
    const marketing = input.marketing || input;
    const current = await table(
      env,
      'marketing_settings',
      `company_id=eq.${COMPANY_ID}&select=settings&limit=1`,
    ) as any[];
    const layout = marketingLayout(marketing.layout);
    await table(env, 'marketing_settings', `company_id=eq.${COMPANY_ID}`, {
      method: 'PATCH',
      headers: { prefer: 'return=minimal' },
      body: JSON.stringify({
        theme: marketing.theme || {},
        banner: marketing.banner || {},
        video_banner: marketing.videoBanner || {},
        carousel: marketing.carousel || {},
        settings: { ...(current?.[0]?.settings || {}), layout },
      }),
    });
    await audit(env, auth.user, 'marketing.update', 'marketing', COMPANY_ID, {
      layout,
      slides: Array.isArray(marketing.carousel?.items) ? marketing.carousel.items.length : 0,
    });
    return ok({ marketing: { ...marketing, layout } });
  }

  return null;
}
