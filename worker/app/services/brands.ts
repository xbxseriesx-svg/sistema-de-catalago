import type { Env } from '../env';
import { COMPANY_ID } from '../env';
import { audit } from '../audit';
import { activeStatus, slug, uid } from '../domain';
import { clean, fail, ok, requestBody } from '../http';
import { requireUser } from '../auth/session';
import { table } from '../supabase';
import { brandsPayload } from './catalog';

export async function handleBrandsRoute(req: Request, env: Env, path: string): Promise<Response | null> {
  if (path === '/api/admin/brands' && req.method === 'GET') {
    const auth = await requireUser(req, env);
    if (auth.error) return auth.error;
    return ok({ brands: await brandsPayload(env, false) });
  }

  if (path === '/api/admin/brands' && req.method === 'POST') {
    const auth = await requireUser(req, env, ['EDITOR', 'ADMIN']);
    if (auth.error || !auth.user) return auth.error;
    const input = await requestBody(req);
    const name = clean(input.name);
    if (!name) return fail('Informe o nome da marca');

    const id = uid('brd');
    const item = {
      id,
      company_id: COMPANY_ID,
      name,
      slug: slug(name),
      description: clean(input.description) || null,
      website: clean(input.website) || null,
      logo_url: clean(input.logoUrl) || null,
      banner_url: clean(input.bannerUrl) || null,
      sort_order: Number(input.sortOrder || 0),
      active: input.status !== 'inactive',
      featured: !!input.featured,
      data: input.data || {},
    };
    await table(env, 'brands', '', {
      method: 'POST',
      headers: { prefer: 'return=minimal' },
      body: JSON.stringify(item),
    });
    await audit(env, auth.user, 'brand.create', 'brand', id);
    return ok({ brand: { ...item, status: item.active ? 'active' : 'inactive' } });
  }

  if (path === '/api/admin/brands/bulk' && req.method === 'POST') {
    const auth = await requireUser(req, env, ['EDITOR', 'ADMIN']);
    if (auth.error || !auth.user) return auth.error;
    const input = await requestBody(req);
    const incoming = Array.isArray(input.brands) ? input.brands.slice(0, 1000) : [];
    const existing = await table(
      env,
      'brands',
      `company_id=eq.${COMPANY_ID}&select=id,slug`,
    ) as any[];
    const bySlug = new Map((existing || []).map((item: any) => [item.slug, item]));

    let inserted = 0;
    let updated = 0;
    let ignored = 0;
    const errors: string[] = [];
    const rows: any[] = [];
    const seen = new Set<string>();

    incoming.forEach((raw: any, index: number) => {
      const name = clean(raw.name || raw.marca);
      const key = slug(name);
      if (!name || !key) {
        ignored++;
        if (errors.length < 30) errors.push(`Linha ${index + 2}: marca sem nome`);
        return;
      }
      if (seen.has(key)) {
        ignored++;
        if (errors.length < 30) errors.push(`Linha ${index + 2}: marca repetida no arquivo`);
        return;
      }
      seen.add(key);
      const old: any = bySlug.get(key);
      if (old) updated++;
      else inserted++;
      const row = {
        id: old?.id || uid('brd'),
        company_id: COMPANY_ID,
        name,
        slug: key,
        description: clean(raw.description) || null,
        website: clean(raw.website) || null,
        active: activeStatus(raw.status, 'active') === 'active',
        data: raw,
      };
      rows.push(row);
      bySlug.set(key, row);
    });

    if (rows.length) {
      await table(env, 'brands', 'on_conflict=company_id,slug', {
        method: 'POST',
        headers: { prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(rows),
      });
    }
    await audit(env, auth.user, 'brands.bulk', 'brand-import', null, {
      requested: incoming.length,
      inserted,
      updated,
      ignored,
    });
    return ok({ inserted, updated, ignored, errors, brands: await brandsPayload(env, false) });
  }

  const brandItem = path.match(/^\/api\/admin\/brands\/([^/]+)$/);
  if (brandItem && ['PUT', 'DELETE'].includes(req.method)) {
    const auth = await requireUser(req, env, ['EDITOR', 'ADMIN']);
    if (auth.error || !auth.user) return auth.error;
    const id = decodeURIComponent(brandItem[1]);
    const scopedRows = await table(
      env,
      'brands',
      `id=eq.${encodeURIComponent(id)}&company_id=eq.${encodeURIComponent(COMPANY_ID)}&select=id,name&limit=1`,
    ) as any[];
    if (!scopedRows?.[0]) return fail('Marca não encontrada', 404, 'NOT_FOUND');

    if (req.method === 'DELETE') {
      await table(env, 'brands', `id=eq.${encodeURIComponent(id)}&company_id=eq.${encodeURIComponent(COMPANY_ID)}`, {
        method: 'DELETE',
        headers: { prefer: 'return=minimal' },
      });
      await audit(env, auth.user, 'brand.delete', 'brand', id);
      return ok({ id });
    }

    const input = await requestBody(req);
    const name = clean(input.name);
    if (!name) return fail('Informe o nome da marca');
    const patch = {
      name,
      slug: slug(name),
      description: clean(input.description) || null,
      website: clean(input.website) || null,
      logo_url: clean(input.logoUrl) || null,
      banner_url: clean(input.bannerUrl) || null,
      sort_order: Number(input.sortOrder || 0),
      active: input.status !== 'inactive',
      featured: !!input.featured,
    };
    await table(env, 'brands', `id=eq.${encodeURIComponent(id)}&company_id=eq.${encodeURIComponent(COMPANY_ID)}`, {
      method: 'PATCH',
      headers: { prefer: 'return=minimal' },
      body: JSON.stringify(patch),
    });
    await audit(env, auth.user, 'brand.update', 'brand', id);
    return ok({ brand: { id, ...patch, status: patch.active ? 'active' : 'inactive' } });
  }

  return null;
}
