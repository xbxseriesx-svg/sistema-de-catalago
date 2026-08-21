-- V94: evita statement timeout no catálogo público dividindo metadados e produtos em páginas.
-- Mantém o acesso anon somente por RPC SECURITY DEFINER e não abre SELECT direto nas tabelas principais.

create index if not exists idx_products_public_catalog
  on public.products(company_id, status, name, id);

create or replace function private.get_public_catalog_meta_data()
returns jsonb
language sql
stable
security definer
set search_path to 'public','private'
as $$
  with c as (
    select id
    from public.companies
    where status = 'active'
    order by created_at asc
    limit 1
  )
  select jsonb_build_object(
    'hierarchy', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', h.id,
          'type', h.type,
          'name', h.name,
          'slug', h.slug,
          'parent_id', h.parent_id,
          'sort_order', h.sort_order,
          'active', h.active,
          'data', h.data
        ) order by h.sort_order, h.name
      )
      from public.hierarchy_nodes h, c
      where h.company_id = c.id and h.active = true
    ), '[]'::jsonb),
    'brands', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', b.id,
          'name', b.name,
          'slug', b.slug,
          'description', b.description,
          'website', b.website,
          'logo_url', b.logo_url,
          'banner_url', b.banner_url,
          'sort_order', b.sort_order,
          'featured', b.featured
        ) order by b.sort_order, b.name
      )
      from public.brands b, c
      where b.company_id = c.id and b.active = true
    ), '[]'::jsonb),
    'offers', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', o.id,
          'title', o.title,
          'description', o.description,
          'featured', o.featured,
          'starts_at', o.starts_at,
          'ends_at', o.ends_at,
          'display_config', o.display_config,
          'data', o.data,
          'product_ids', coalesce((
            select jsonb_agg(op.product_id order by op.sort_order, op.product_id)
            from public.offer_products op
            where op.offer_id = o.id
          ), '[]'::jsonb)
        ) order by o.featured desc, o.updated_at desc
      )
      from public.offers o, c
      where o.company_id = c.id
        and o.status = 'published'
        and (o.starts_at is null or o.starts_at <= now())
        and (o.ends_at is null or o.ends_at >= now())
    ), '[]'::jsonb),
    'settings', coalesce((
      select jsonb_build_object(
        'display_fields', s.display_fields,
        'filters', s.filters,
        'settings', s.settings
      )
      from public.catalog_settings s, c
      where s.company_id = c.id
    ), '{}'::jsonb),
    'product_count', coalesce((
      select count(*)
      from public.products p, c
      where p.company_id = c.id and p.status = 'active'
    ), 0)
  );
$$;

create or replace function private.get_public_products_page_data(
  p_offset integer default 0,
  p_limit integer default 500
)
returns jsonb
language sql
stable
security definer
set search_path to 'public','private'
as $$
  with c as (
    select id
    from public.companies
    where status = 'active'
    order by created_at asc
    limit 1
  ),
  bounds as (
    select
      greatest(coalesce(p_offset, 0), 0) as safe_offset,
      least(greatest(coalesce(p_limit, 500), 1), 500) as safe_limit
  ),
  page as (
    select p.*
    from public.products p, c, bounds
    where p.company_id = c.id and p.status = 'active'
    order by p.name, p.id
    limit (select safe_limit from bounds)
    offset (select safe_offset from bounds)
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', p.id,
      'code', p.code,
      'ean', p.ean,
      'name', p.name,
      'short_description', p.short_description,
      'long_description', p.long_description,
      'brand_id', p.brand_id,
      'departamento_id', p.departamento_id,
      'secao_id', p.secao_id,
      'categoria_id', p.categoria_id,
      'unit', p.unit,
      'packaging', p.packaging,
      'ncm', p.ncm,
      'price', p.price,
      'promo_price', p.promo_price,
      'stock', p.stock,
      'image_url', p.image_url,
      'video_url', p.video_url,
      'gallery', p.gallery,
      'technical', p.technical,
      'attributes', p.attributes,
      'tags', p.tags,
      'status', p.status
    ) order by p.name, p.id
  ), '[]'::jsonb)
  from page p;
$$;

create or replace function public.get_public_catalog_meta()
returns jsonb
language sql
stable
set search_path to 'public','private'
as $$
  select private.get_public_catalog_meta_data();
$$;

create or replace function public.get_public_products_page(
  p_offset integer default 0,
  p_limit integer default 500
)
returns jsonb
language sql
stable
set search_path to 'public','private'
as $$
  select private.get_public_products_page_data(p_offset, p_limit);
$$;

revoke all on function public.get_public_catalog_meta() from public;
revoke all on function public.get_public_products_page(integer, integer) from public;
grant execute on function public.get_public_catalog_meta() to anon, authenticated, service_role;
grant execute on function public.get_public_products_page(integer, integer) to anon, authenticated, service_role;
