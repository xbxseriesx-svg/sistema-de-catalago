import type { Env } from '../env';
import { COMPANY_ID } from '../env';
import { audit } from '../audit';
import { clean, fail, ok, requestBody } from '../http';
import { requireUser } from '../auth/session';
import { adminHeaders, table } from '../supabase';
import { catalogPayload } from './catalog';

async function emptyStorageBucket(env: Env, bucket: string) {
  const response = await fetch(
    `${env.SUPABASE_URL}/storage/v1/bucket/${encodeURIComponent(bucket)}/empty`,
    { method: 'POST', headers: adminHeaders(env, { 'content-type': 'application/json' }) },
  );
  if (response.ok) return;
  const detail = await response.text();
  throw new Error(`Falha ao limpar o bucket ${bucket} (${response.status}): ${detail.slice(0, 300)}`);
}

async function countRows(env: Env, tableName: string, filters: string) {
  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/${tableName}?${filters}&select=id&limit=1`,
    { headers: adminHeaders(env, { prefer: 'count=exact', range: '0-0' }) },
  );
  if (!response.ok) throw new Error(`Falha ao contar ${tableName} (${response.status})`);
  const total = response.headers.get('content-range')?.split('/').at(-1);
  return total && total !== '*' ? Number(total) || 0 : 0;
}

async function catalogResetCounts(env: Env) {
  const companyFilter = `company_id=eq.${encodeURIComponent(COMPANY_ID)}`;
  const [products, brands, media, departments, sections, categories] = await Promise.all([
    countRows(env, 'products', companyFilter),
    countRows(env, 'brands', companyFilter),
    countRows(env, 'media_assets', companyFilter),
    countRows(env, 'hierarchy_nodes', `${companyFilter}&type=eq.departamento`),
    countRows(env, 'hierarchy_nodes', `${companyFilter}&type=eq.secao`),
    countRows(env, 'hierarchy_nodes', `${companyFilter}&type=eq.categoria`),
  ]);
  return {
    products,
    brands,
    media,
    departments,
    sections,
    categories,
  };
}

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

  if (path === '/api/admin/catalog/reset' && req.method === 'DELETE') {
    const auth = await requireUser(req, env, ['ADMIN']);
    if (auth.error || !auth.user) return auth.error;
    const input = await requestBody(req);
    if (clean(input.confirm) !== 'APAGAR CATÁLOGO') {
      return fail('Confirmação inválida', 400, 'CATALOG_RESET_CONFIRMATION');
    }

    const deleted = await catalogResetCounts(env);
    // O Storage precisa ser limpo pela API antes dos metadados para não criar arquivos órfãos.
    await emptyStorageBucket(env, 'product-images');
    await emptyStorageBucket(env, 'brand-media');

    await table(env, 'products', `company_id=eq.${COMPANY_ID}`, {
      method: 'DELETE', headers: { prefer: 'return=minimal' },
    });
    await table(env, 'media_assets', `company_id=eq.${COMPANY_ID}`, {
      method: 'DELETE', headers: { prefer: 'return=minimal' },
    });
    await table(env, 'brands', `company_id=eq.${COMPANY_ID}`, {
      method: 'DELETE', headers: { prefer: 'return=minimal' },
    });
    await table(env, 'commercial_segment_profiles', `company_id=eq.${COMPANY_ID}`, {
      method: 'DELETE', headers: { prefer: 'return=minimal' },
    });
    for (const type of ['categoria', 'secao', 'departamento']) {
      await table(env, 'hierarchy_nodes', `company_id=eq.${COMPANY_ID}&type=eq.${type}`, {
        method: 'DELETE', headers: { prefer: 'return=minimal' },
      });
    }

    await audit(env, auth.user, 'catalog.reset', 'catalog', COMPANY_ID, deleted);
    return ok({ deleted, storageBucketsEmptied: ['product-images', 'brand-media'] });
  }

  return null;
}
