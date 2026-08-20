import type { Env } from '../env';
import { COMPANY_ID } from '../env';
import { audit } from '../audit';
import { clean, ok, requestBody } from '../http';
import { requireUser } from '../auth/session';
import { table } from '../supabase';
import { catalogPayload } from './catalog';

export async function handleCatalogAdminRoute(req: Request, env: Env, path: string): Promise<Response | null> {
  if (path === '/api/admin/catalog' && req.method === 'GET') {
    const auth = await requireUser(req, env);
    if (auth.error) return auth.error;
    return ok({ catalog: await catalogPayload(env, false) });
  }

  if (path === '/api/admin/catalog/settings' && req.method === 'PUT') {
    const auth = await requireUser(req, env, ['EDITOR', 'ADMIN']);
    if (auth.error || !auth.user) return auth.error;
    const input = await requestBody(req);
    const displayFields = Array.isArray(input.displayFields)
      ? [...new Set<string>(input.displayFields.map(clean).filter(Boolean))]
      : [];
    await table(env, 'catalog_settings', `company_id=eq.${COMPANY_ID}`, {
      method: 'PATCH',
      headers: { prefer: 'return=minimal' },
      body: JSON.stringify({ display_fields: displayFields }),
    });
    await audit(env, auth.user, 'catalog.settings', 'catalog', COMPANY_ID, { displayFields });
    return ok({ settings: { displayFields } });
  }

  return null;
}
