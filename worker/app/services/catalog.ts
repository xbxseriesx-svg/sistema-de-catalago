import type { Env } from '../env';
import { COMPANY_ID } from '../env';
import { marketingLayout, postgrestLiteral } from '../domain';
import { clean, fail, ok } from '../http';
import { publicTable, publicTableAll, table, tableAll } from '../supabase';

function brandDto(row: any) {
  const data = row?.data && typeof row.data === 'object' ? row.data : {};
  return {
    ...data,
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description ?? data.description ?? null,
    website: row.website ?? data.website ?? null,
    logoUrl: row.logo_url ?? data.logoUrl ?? data.logo_url ?? null,
    bannerUrl: row.banner_url ?? data.bannerUrl ?? data.banner_url ?? null,
    sortOrder: Number(row.sort_order ?? data.sortOrder ?? 0),
    featured: !!(row.featured ?? data.featured),
    status: row.active ? 'active' : 'inactive',
  };
}

export async function brandsPayload(env: Env, publicOnly = false) {
  const query = `company_id=eq.${COMPANY_ID}${publicOnly ? '&active=eq.true' : ''}&select=id,name,slug,description,website,logo_url,banner_url,sort_order,active,featured,data&order=sort_order.asc,name.asc`;
  const rows = publicOnly
    ? await publicTableAll(env, 'brands', query)
    : await tableAll(env, 'brands', query);
  const visible = publicOnly ? rows.filter((row: any) => row?.active === true) : rows;
  return visible.map(brandDto);
}

function liveOffer(item: any, now = Date.now()) {
  if (String(item?.status || '').toLowerCase() !== 'published') return false;
  const starts = item?.startsAt ?? item?.starts_at;
  const ends = item?.endsAt ?? item?.ends_at;
  if (starts && Number.isFinite(Date.parse(starts)) && Date.parse(starts) > now) return false;
  if (ends && Number.isFinite(Date.parse(ends)) && Date.parse(ends) < now) return false;
  return true;
}

export async function offersPayload(env: Env, publicOnly: boolean) {
  const offerQuery = `company_id=eq.${COMPANY_ID}${publicOnly ? '&status=eq.published' : ''}&select=*&order=featured.desc,updated_at.desc`;
  const offers = (publicOnly
    ? await publicTable(env, 'offers', offerQuery)
    : await table(env, 'offers', offerQuery)) as any[];
  const linksQuery = offers?.length
    ? `offer_id=in.(${offers.map((item: any) => postgrestLiteral(item.id)).join(',')})&select=offer_id,product_id,sort_order&order=sort_order.asc`
    : '';
  const links = offers?.length
    ? (publicOnly
      ? await publicTableAll(env, 'offer_products', linksQuery)
      : await tableAll(env, 'offer_products', linksQuery))
    : [];

  const result = (offers || []).map((offer: any) => ({
    ...offer.data,
    id: offer.id,
    title: offer.title,
    description: offer.description,
    status: offer.status,
    featured: offer.featured,
    startsAt: offer.starts_at,
    endsAt: offer.ends_at,
    productIds: links
      .filter((link: any) => link.offer_id === offer.id)
      .map((link: any) => link.product_id),
  }));
  return publicOnly ? result.filter((item: any) => liveOffer(item)) : result;
}

export async function catalogPayload(env: Env, publicOnly: boolean) {
  const status = publicOnly ? '&status=eq.active' : '';
  const productQuery = `company_id=eq.${COMPANY_ID}${status}&select=*&order=name.asc`;
  const hierarchyQuery = `company_id=eq.${COMPANY_ID}${publicOnly ? '&active=eq.true' : ''}&select=id,name,slug,type,parent_id,sort_order,active&order=sort_order.asc,name.asc`;
  const settingsQuery = `company_id=eq.${COMPANY_ID}&select=display_fields&limit=1`;
  const [products, brands, hierarchy, settings, promotions] = await Promise.all([
    publicOnly ? publicTableAll(env, 'products', productQuery) : tableAll(env, 'products', productQuery),
    brandsPayload(env, publicOnly),
    publicOnly ? publicTableAll(env, 'hierarchy_nodes', hierarchyQuery) : tableAll(env, 'hierarchy_nodes', hierarchyQuery),
    (publicOnly ? publicTable(env, 'catalog_settings', settingsQuery) : table(env, 'catalog_settings', settingsQuery)) as Promise<any[]>,
    offersPayload(env, publicOnly),
  ]);

  const visibleProducts = publicOnly ? products.filter((product: any) => product?.status === 'active') : products;
  const visibleHierarchy = publicOnly ? hierarchy.filter((node: any) => node?.active === true) : hierarchy;

  return {
    products: visibleProducts.map((product: any) => ({
      ...product.data,
      id: product.id,
      code: product.code,
      name: product.name,
      image: product.image_url || product.data?.image,
      gallery: product.gallery,
      status: product.status === 'active' ? 'ativo' : 'rascunho',
    })),
    brands,
    distributions: [],
    hierarchy: visibleHierarchy.map((node: any) => ({
      id: node.id,
      name: node.name,
      slug: node.slug,
      level: node.type,
      parent_id: node.parent_id,
      parentId: node.parent_id,
      sort_order: node.sort_order,
      sortOrder: node.sort_order,
      status: node.active ? 'active' : 'inactive',
    })),
    promotions,
    settings: { displayFields: settings?.[0]?.display_fields || [] },
  };
}

export async function handlePublicCatalogRoute(req: Request, env: Env, path: string): Promise<Response | null> {
  if (path === '/api/public/catalog' && req.method === 'GET') {
    return ok({ catalog: await catalogPayload(env, true) });
  }
  if (path === '/api/public/brands' && req.method === 'GET') {
    return ok({ brands: await brandsPayload(env, true) });
  }
  if (path === '/api/public/marketing' && req.method === 'GET') {
    const rows = await publicTable(
      env,
      'marketing_settings',
      `company_id=eq.${COMPANY_ID}&select=theme,banner,video_banner,carousel,settings&limit=1`,
    ) as any[];
    const marketing = rows?.[0] || {};
    return ok({
      marketing: {
        theme: marketing.theme || {},
        banner: marketing.banner || {},
        videoBanner: marketing.video_banner || {},
        carousel: marketing.carousel || {},
        layout: marketingLayout(marketing.settings?.layout),
      },
    });
  }
  const pageMatch = path.match(/^\/api\/public\/pages\/([^/]+)$/);
  if (pageMatch && req.method === 'GET') {
    // pages ainda não possui SELECT anon no baseline; mantenha a leitura server-side protegida
    // até existir uma migration revisada e aprovada para publicação de páginas.
    const rows = await table(
      env,
      'pages',
      `company_id=eq.${COMPANY_ID}&slug=eq.${encodeURIComponent(decodeURIComponent(pageMatch[1]))}&select=slug,title,published_nodes,published_revision,updated_at&limit=1`,
    ) as any[];
    const page = rows?.[0];
    if (!page) return fail('Página não encontrada', 404, 'NOT_FOUND');
    return ok({
      page: {
        slug: page.slug,
        title: page.title,
        versionId: `supabase-v${page.published_revision}`,
        versionNumber: page.published_revision,
        publishedAt: page.updated_at,
        nodes: page.published_nodes,
      },
    });
  }
  return null;
}

export function normalizedCode(value: unknown) {
  return clean(value);
}
