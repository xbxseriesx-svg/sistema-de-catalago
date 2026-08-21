import type { Env } from '../env';
import { COMPANY_ID } from '../env';
import { marketingLayout, postgrestLiteral } from '../domain';
import { clean, fail, ok } from '../http';
import { publicSupabase, publicTableAll, table, tableAll } from '../supabase';

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

function publicBrandDto(row: any) {
  return {
    id: row?.id,
    name: row?.name,
    slug: row?.slug,
    description: row?.description ?? null,
    website: row?.website ?? null,
    logoUrl: row?.logo_url ?? null,
    bannerUrl: row?.banner_url ?? null,
    sortOrder: Number(row?.sort_order ?? 0),
    featured: !!row?.featured,
    status: 'active',
  };
}

async function publicCatalogRpc(env: Env) {
  const payload = await publicSupabase(env, '/rest/v1/rpc/get_public_catalog', {
    method: 'POST',
    body: JSON.stringify({}),
  });
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Resposta pública inválida do RPC get_public_catalog');
  }
  return payload as Record<string, any>;
}

async function publicSiteRpc(env: Env, pageSlug: string) {
  const payload = await publicSupabase(env, '/rest/v1/rpc/get_public_site', {
    method: 'POST',
    body: JSON.stringify({ page_slug: pageSlug }),
  });
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Resposta pública inválida do RPC get_public_site');
  }
  return payload as Record<string, any>;
}

function publicHierarchyDto(row: any) {
  return {
    id: row?.id,
    name: row?.name,
    slug: row?.slug,
    level: row?.type,
    parent_id: row?.parent_id ?? null,
    parentId: row?.parent_id ?? null,
    sort_order: row?.sort_order ?? 0,
    sortOrder: row?.sort_order ?? 0,
    status: 'active',
  };
}

function publicProductsDto(products: any[], brands: any[], hierarchy: any[]) {
  const brandNames = new Map(brands.map((brand: any) => [brand?.id, brand?.name]));
  const hierarchyNames = new Map(hierarchy.map((node: any) => [node?.id, node?.name]));

  return products.map((product: any) => ({
    id: product?.id,
    code: product?.code,
    ean: product?.ean ?? null,
    name: product?.name,
    shortDescription: product?.short_description ?? product?.name ?? '',
    longDescription: product?.long_description ?? product?.short_description ?? product?.name ?? '',
    brandId: product?.brand_id ?? null,
    brandName: brandNames.get(product?.brand_id) ?? null,
    departamentoId: product?.departamento_id ?? null,
    departamentoName: hierarchyNames.get(product?.departamento_id) ?? null,
    secaoId: product?.secao_id ?? null,
    secaoName: hierarchyNames.get(product?.secao_id) ?? null,
    categoriaId: product?.categoria_id ?? null,
    categoriaName: hierarchyNames.get(product?.categoria_id) ?? null,
    unit: product?.unit ?? null,
    packaging: product?.packaging ?? null,
    ncm: product?.ncm ?? null,
    price: product?.price ?? null,
    promoPrice: product?.promo_price ?? null,
    stock: product?.stock ?? null,
    image: product?.image_url ?? null,
    imageUrl: product?.image_url ?? null,
    videoUrl: product?.video_url ?? null,
    gallery: Array.isArray(product?.gallery) ? product.gallery : [],
    technical: product?.technical && typeof product.technical === 'object' ? product.technical : {},
    attributes: product?.attributes && typeof product.attributes === 'object' ? product.attributes : {},
    tags: Array.isArray(product?.tags) ? product.tags : [],
    status: 'ativo',
  }));
}

async function publicOffersFromRpc(env: Env, offers: any[]) {
  if (!offers.length) return [];
  const linksQuery = `offer_id=in.(${offers.map((item: any) => postgrestLiteral(item.id)).join(',')})&select=offer_id,product_id,sort_order&order=sort_order.asc`;
  const links = await publicTableAll(env, 'offer_products', linksQuery);
  return offers.map((offer: any) => ({
    ...(offer?.data && typeof offer.data === 'object' ? offer.data : {}),
    id: offer?.id,
    title: offer?.title,
    description: offer?.description ?? null,
    status: 'published',
    featured: !!offer?.featured,
    startsAt: offer?.starts_at ?? null,
    endsAt: offer?.ends_at ?? null,
    displayConfig: offer?.display_config ?? {},
    productIds: links
      .filter((link: any) => link?.offer_id === offer?.id)
      .map((link: any) => link?.product_id),
  }));
}

export async function brandsPayload(env: Env, publicOnly = false) {
  if (publicOnly) {
    const payload = await publicCatalogRpc(env);
    return (Array.isArray(payload.brands) ? payload.brands : []).map(publicBrandDto);
  }
  const query = `company_id=eq.${COMPANY_ID}&select=id,name,slug,description,website,logo_url,banner_url,sort_order,active,featured,data&order=sort_order.asc,name.asc`;
  const rows = await tableAll(env, 'brands', query);
  return rows.map(brandDto);
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
  if (publicOnly) {
    const payload = await publicCatalogRpc(env);
    return publicOffersFromRpc(env, Array.isArray(payload.offers) ? payload.offers : []);
  }

  const offerQuery = `company_id=eq.${COMPANY_ID}&select=*&order=featured.desc,updated_at.desc`;
  const offers = await table(env, 'offers', offerQuery) as any[];
  const linksQuery = offers?.length
    ? `offer_id=in.(${offers.map((item: any) => postgrestLiteral(item.id)).join(',')})&select=offer_id,product_id,sort_order&order=sort_order.asc`
    : '';
  const links = offers?.length ? await tableAll(env, 'offer_products', linksQuery) : [];

  return (offers || []).map((offer: any) => ({
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
}

export async function catalogPayload(env: Env, publicOnly: boolean) {
  if (publicOnly) {
    const payload = await publicCatalogRpc(env);
    const rawProducts = Array.isArray(payload.products) ? payload.products : [];
    const rawBrands = Array.isArray(payload.brands) ? payload.brands : [];
    const rawHierarchy = Array.isArray(payload.hierarchy) ? payload.hierarchy : [];
    const rawOffers = Array.isArray(payload.offers) ? payload.offers : [];
    const settings = payload.settings && typeof payload.settings === 'object' ? payload.settings : {};

    return {
      products: publicProductsDto(rawProducts, rawBrands, rawHierarchy),
      brands: rawBrands.map(publicBrandDto),
      distributions: [],
      hierarchy: rawHierarchy.map(publicHierarchyDto),
      promotions: await publicOffersFromRpc(env, rawOffers),
      settings: { displayFields: Array.isArray(settings.display_fields) ? settings.display_fields : [] },
    };
  }

  const productQuery = `company_id=eq.${COMPANY_ID}&select=*&order=name.asc`;
  const hierarchyQuery = `company_id=eq.${COMPANY_ID}&select=id,name,slug,type,parent_id,sort_order,active&order=sort_order.asc,name.asc`;
  const settingsQuery = `company_id=eq.${COMPANY_ID}&select=display_fields&limit=1`;
  const [products, brands, hierarchy, settings, promotions] = await Promise.all([
    tableAll(env, 'products', productQuery),
    brandsPayload(env, false),
    tableAll(env, 'hierarchy_nodes', hierarchyQuery),
    table(env, 'catalog_settings', settingsQuery) as Promise<any[]>,
    offersPayload(env, false),
  ]);

  return {
    products: products.map((product: any) => ({
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
    hierarchy: hierarchy.map((node: any) => ({
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
    promotions: promotions.filter((item: any) => liveOffer(item)),
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
    // Um slug inexistente evita transportar os nós da página apenas para ler Marketing.
    const site = await publicSiteRpc(env, '__marketing_only__');
    const marketing = site.marketing && typeof site.marketing === 'object' ? site.marketing : {};
    return ok({
      marketing: {
        theme: marketing.theme || {},
        banner: marketing.banner || {},
        videoBanner: marketing.videoBanner || marketing.video_banner || {},
        carousel: marketing.carousel || {},
        layout: marketingLayout(marketing.settings?.layout),
      },
    });
  }
  const pageMatch = path.match(/^\/api\/public\/pages\/([^/]+)$/);
  if (pageMatch && req.method === 'GET') {
    // A página publicada continua server-side: a tabela pages não é exposta ao papel anon.
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
