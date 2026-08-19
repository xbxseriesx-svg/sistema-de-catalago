-- ASTERYON Catálogo V89 — baseline estrutural
-- Uso: somente em projeto Supabase vazio. Não aplicar sobre produção existente.

create extension if not exists pgcrypto;
create schema if not exists private;
create sequence if not exists public.audit_logs_id_seq;

create table public.companies (
  id text primary key,
  name text not null,
  slug text unique,
  status text not null default 'active',
  settings jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.app_config (
  key text primary key,
  value jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  email text
);

create table public.company_memberships (
  company_id text not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'viewer' check (role = any(array['owner','admin','editor','viewer']::text[])),
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (company_id,user_id)
);

create table public.editor_settings (
  company_id text primary key references public.companies(id) on delete cascade,
  active_mode text not null default 'desktop' check (active_mode = any(array['desktop','tablet','mobile']::text[])),
  resolution_preset text not null default '1080p' check (resolution_preset = any(array['1366x768','1440x900','1080p','2k','4k']::text[])),
  resolution_presets jsonb not null default '{"2k":{"width":2560,"height":1440},"4k":{"width":3840,"height":2160},"1080p":{"width":1920,"height":1080},"1366x768":{"width":1366,"height":768},"1440x900":{"width":1440,"height":900}}',
  breakpoints jsonb not null default '{"mobile":{"max":640},"tablet":{"max":1024,"min":641},"desktop":{"min":1025}}',
  save_all_modes_default boolean not null default false,
  canvas_settings jsonb not null default '{"fit":"contain","imageObjectFit":"contain","preserveAspectRatio":true}',
  updated_at timestamptz not null default now()
);

create table public.hierarchy_nodes (
  id text primary key,
  company_id text not null references public.companies(id) on delete cascade,
  type text not null check (type = any(array['departamento','secao','categoria']::text[])),
  name text not null,
  slug text not null,
  parent_id text references public.hierarchy_nodes(id) on delete restrict,
  sort_order integer not null default 0,
  active boolean not null default true,
  data jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id,type,slug,parent_id)
);

create table public.brands (
  id text primary key,
  company_id text not null references public.companies(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  website text,
  logo_url text,
  banner_url text,
  sort_order integer not null default 0,
  active boolean not null default true,
  featured boolean not null default false,
  data jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id,slug)
);

create table public.products (
  id text primary key,
  company_id text not null references public.companies(id) on delete cascade,
  code text not null,
  ean text,
  name text not null,
  short_description text,
  long_description text,
  brand_id text references public.brands(id) on delete set null,
  departamento_id text not null references public.hierarchy_nodes(id) on delete restrict,
  secao_id text not null references public.hierarchy_nodes(id) on delete restrict,
  categoria_id text not null references public.hierarchy_nodes(id) on delete restrict,
  unit text,
  packaging text,
  ncm text,
  price numeric(14,2),
  promo_price numeric(14,2),
  stock numeric(14,3),
  image_url text,
  video_url text,
  gallery jsonb not null default '[]',
  technical jsonb not null default '{}',
  attributes jsonb not null default '{}',
  tags jsonb not null default '[]',
  status text not null default 'active',
  data jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id,code)
);

create table public.media_assets (
  id text primary key,
  company_id text not null references public.companies(id) on delete cascade,
  owner_type text not null,
  owner_id text,
  kind text not null,
  bucket text not null,
  path text not null,
  public_url text,
  mime_type text,
  size_bytes bigint,
  sha256 text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bucket,path),
  unique (company_id,sha256,owner_type,kind)
);

create table public.product_media (
  id text primary key default gen_random_uuid()::text,
  product_id text not null references public.products(id) on delete cascade,
  media_asset_id text not null references public.media_assets(id) on delete cascade,
  role text not null default 'gallery' check (role = any(array['main','gallery','video','pdf']::text[])),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (product_id,media_asset_id)
);

create table public.catalog_settings (
  company_id text primary key references public.companies(id) on delete cascade,
  display_fields jsonb not null default '[]',
  filters jsonb not null default '{}',
  settings jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

create table public.marketing_settings (
  company_id text primary key references public.companies(id) on delete cascade,
  theme jsonb not null default '{}',
  banner jsonb not null default '{}',
  video_banner jsonb not null default '{}',
  carousel jsonb not null default '{}',
  promotions jsonb not null default '{}',
  settings jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

create table public.offers (
  id text primary key,
  company_id text not null references public.companies(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'draft',
  featured boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  display_config jsonb not null default '{}',
  data jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.offer_products (
  offer_id text not null references public.offers(id) on delete cascade,
  product_id text not null references public.products(id) on delete cascade,
  sort_order integer not null default 0,
  override_price numeric(14,2),
  data jsonb not null default '{}',
  primary key (offer_id,product_id)
);

create table public.pages (
  id text primary key,
  company_id text not null references public.companies(id) on delete cascade,
  slug text not null,
  title text,
  draft_nodes jsonb not null default '[]',
  published_nodes jsonb not null default '[]',
  revision integer not null default 0,
  published_revision integer not null default 0,
  settings jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id,slug)
);

create table public.page_snapshots (
  id text primary key,
  page_id text not null references public.pages(id) on delete cascade,
  label text,
  nodes jsonb not null,
  revision integer not null,
  created_by text,
  created_at timestamptz not null default now()
);

create table public.page_publications (
  id text primary key,
  page_id text not null references public.pages(id) on delete cascade,
  revision integer not null,
  nodes jsonb not null,
  created_by text,
  created_at timestamptz not null default now()
);

create table public.templates (
  id text primary key,
  company_id text references public.companies(id) on delete cascade,
  system_key text,
  name text not null,
  description text,
  category text,
  tags jsonb not null default '[]',
  accent text,
  nodes jsonb not null default '[]',
  version integer not null default 1,
  active boolean not null default true,
  data jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id,system_key)
);

create table public.audit_logs (
  id bigint primary key default nextval('public.audit_logs_id_seq'::regclass),
  company_id text,
  user_id text,
  action text not null,
  entity_type text,
  entity_id text,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index idx_memberships_company on public.company_memberships(company_id,active,role);
create index idx_memberships_user on public.company_memberships(user_id,active);
create index idx_hierarchy_parent on public.hierarchy_nodes(parent_id);
create index idx_media_owner on public.media_assets(company_id,owner_type,owner_id);
create index idx_offer_products_product on public.offer_products(product_id);
create index idx_offers_company on public.offers(company_id);
create index idx_page_publications_page on public.page_publications(page_id);
create index idx_page_snapshots_page on public.page_snapshots(page_id);
create index idx_product_media_asset on public.product_media(media_asset_id);
create index idx_product_media_product on public.product_media(product_id,role,sort_order);
create index idx_products_brand on public.products(company_id,brand_id);
create index idx_products_brand_fk on public.products(brand_id);
create index idx_products_categoria_fk on public.products(categoria_id);
create index idx_products_code on public.products(company_id,code);
create index idx_products_company on public.products(company_id);
create index idx_products_departamento_fk on public.products(departamento_id);
create index idx_products_ean on public.products(company_id,ean);
create index idx_products_hierarchy on public.products(company_id,departamento_id,secao_id,categoria_id);
create index idx_products_secao_fk on public.products(secao_id);
create index idx_products_name_search on public.products using gin (to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(short_description,'')));

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path to 'public' as $$
begin new.updated_at = now(); return new; end;
$$;

create or replace function private.is_company_member(target_company_id text)
returns boolean language sql stable security definer set search_path to 'public','private' as $$
  select exists(select 1 from public.company_memberships m where m.company_id=target_company_id and m.user_id=auth.uid() and m.active=true);
$$;

create or replace function private.can_edit_company(target_company_id text)
returns boolean language sql stable security definer set search_path to 'public','private' as $$
  select exists(select 1 from public.company_memberships m where m.company_id=target_company_id and m.user_id=auth.uid() and m.active=true and m.role in ('owner','admin','editor'));
$$;

create or replace function private.can_admin_company(target_company_id text)
returns boolean language sql stable security definer set search_path to 'public','private' as $$
  select exists(select 1 from public.company_memberships m where m.company_id=target_company_id and m.user_id=auth.uid() and m.active=true and m.role in ('owner','admin'));
$$;

create or replace function private.bootstrap_status_data()
returns jsonb language sql stable security definer set search_path to 'public','private' as $$
  select jsonb_build_object(
    'bootstrapOpen', not exists(select 1 from public.company_memberships where active=true),
    'hasActiveAdmin', exists(select 1 from public.company_memberships where active=true and role in ('owner','admin'))
  );
$$;

create or replace function private.get_public_catalog_data()
returns jsonb language sql stable security definer set search_path to 'public','private' as $$
  with c as (select id from public.companies where status='active' order by created_at asc limit 1)
  select jsonb_build_object(
    'hierarchy',coalesce((select jsonb_agg(jsonb_build_object('id',h.id,'type',h.type,'name',h.name,'slug',h.slug,'parent_id',h.parent_id,'sort_order',h.sort_order,'active',h.active,'data',h.data) order by h.sort_order,h.name) from public.hierarchy_nodes h,c where h.company_id=c.id and h.active=true),'[]'::jsonb),
    'brands',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'name',b.name,'slug',b.slug,'description',b.description,'website',b.website,'logo_url',b.logo_url,'banner_url',b.banner_url,'sort_order',b.sort_order,'featured',b.featured) order by b.sort_order,b.name) from public.brands b,c where b.company_id=c.id and b.active=true),'[]'::jsonb),
    'products',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'code',p.code,'ean',p.ean,'name',p.name,'short_description',p.short_description,'long_description',p.long_description,'brand_id',p.brand_id,'departamento_id',p.departamento_id,'secao_id',p.secao_id,'categoria_id',p.categoria_id,'unit',p.unit,'packaging',p.packaging,'ncm',p.ncm,'price',p.price,'promo_price',p.promo_price,'stock',p.stock,'image_url',p.image_url,'video_url',p.video_url,'gallery',p.gallery,'technical',p.technical,'attributes',p.attributes,'tags',p.tags,'status',p.status) order by p.name) from public.products p,c where p.company_id=c.id and p.status='active'),'[]'::jsonb),
    'offers',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'title',o.title,'description',o.description,'featured',o.featured,'starts_at',o.starts_at,'ends_at',o.ends_at,'display_config',o.display_config,'data',o.data) order by o.featured desc,o.updated_at desc) from public.offers o,c where o.company_id=c.id and o.status='published' and (o.starts_at is null or o.starts_at<=now()) and (o.ends_at is null or o.ends_at>=now())),'[]'::jsonb),
    'settings',coalesce((select jsonb_build_object('display_fields',s.display_fields,'filters',s.filters,'settings',s.settings) from public.catalog_settings s,c where s.company_id=c.id),'{}'::jsonb)
  );
$$;

create or replace function private.get_public_site_data(page_slug text)
returns jsonb language sql stable security definer set search_path to 'public','private' as $$
  with c as (select id from public.companies where status='active' order by created_at asc limit 1)
  select jsonb_build_object(
    'page',coalesce((select jsonb_build_object('id',p.id,'slug',p.slug,'title',p.title,'nodes',p.published_nodes,'revision',p.published_revision,'settings',p.settings) from public.pages p,c where p.company_id=c.id and p.slug=page_slug limit 1),'{}'::jsonb),
    'marketing',coalesce((select jsonb_build_object('theme',m.theme,'banner',m.banner,'videoBanner',m.video_banner,'carousel',m.carousel,'promotions',m.promotions,'settings',m.settings) from public.marketing_settings m,c where m.company_id=c.id),'{}'::jsonb)
  );
$$;

create or replace function public.bootstrap_status()
returns jsonb language sql stable set search_path to 'public','private' as $$ select private.bootstrap_status_data(); $$;

create or replace function public.get_public_catalog()
returns jsonb language sql stable set search_path to 'public','private' as $$ select private.get_public_catalog_data(); $$;

create or replace function public.get_public_site(page_slug text default 'home')
returns jsonb language sql stable set search_path to 'public','private' as $$ select private.get_public_site_data(page_slug); $$;

create or replace function public.get_public_product_media(target_product_id text)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',pm.id,'role',pm.role,'sortOrder',pm.sort_order,'media',jsonb_build_object('id',m.id,'kind',m.kind,'url',m.public_url,'mimeType',m.mime_type,'sizeBytes',m.size_bytes)) order by pm.sort_order,pm.created_at),'[]'::jsonb)
  from public.product_media pm join public.media_assets m on m.id=pm.media_asset_id join public.products p on p.id=pm.product_id
  where pm.product_id=target_product_id and p.status='active';
$$;

create or replace function public.create_page_snapshot(target_page_id text, snapshot_label text default 'Ponto manual')
returns jsonb language plpgsql set search_path to 'public' as $$
declare p public.pages%rowtype; sid text;
begin
  select * into p from public.pages where id=target_page_id;
  if not found then raise exception 'Página não encontrada ou sem permissão'; end if;
  sid := gen_random_uuid()::text;
  insert into public.page_snapshots(id,page_id,label,nodes,revision,created_by) values(sid,p.id,snapshot_label,p.draft_nodes,p.revision,auth.uid()::text);
  return jsonb_build_object('id',sid,'revision',p.revision);
end;
$$;

create or replace function public.publish_page(target_page_id text)
returns jsonb language plpgsql set search_path to 'public' as $$
declare p public.pages%rowtype; pub_id text; next_rev int;
begin
  select * into p from public.pages where id=target_page_id for update;
  if not found then raise exception 'Página não encontrada ou sem permissão'; end if;
  next_rev := greatest(p.revision,0)+1; pub_id := gen_random_uuid()::text;
  update public.pages set published_nodes=draft_nodes,revision=next_rev,published_revision=next_rev,updated_at=now() where id=p.id;
  insert into public.page_publications(id,page_id,revision,nodes,created_by) values(pub_id,p.id,next_rev,p.draft_nodes,auth.uid()::text);
  insert into public.audit_logs(company_id,user_id,action,entity_type,entity_id,details) values(p.company_id,auth.uid()::text,'publish','page',p.id,jsonb_build_object('revision',next_rev));
  return jsonb_build_object('publicationId',pub_id,'revision',next_rev);
end;
$$;

create or replace function public.restore_page_snapshot(target_snapshot_id text)
returns jsonb language plpgsql set search_path to 'public' as $$
declare s public.page_snapshots%rowtype; p public.pages%rowtype; safety_id text; next_rev int;
begin
  select * into s from public.page_snapshots where id=target_snapshot_id;
  if not found then raise exception 'Snapshot não encontrado ou sem permissão'; end if;
  select * into p from public.pages where id=s.page_id for update;
  if not found then raise exception 'Página não encontrada ou sem permissão'; end if;
  safety_id := gen_random_uuid()::text;
  insert into public.page_snapshots(id,page_id,label,nodes,revision,created_by) values(safety_id,p.id,'Backup antes da restauração',p.draft_nodes,p.revision,auth.uid()::text);
  next_rev := greatest(p.revision,0)+1;
  update public.pages set draft_nodes=s.nodes,revision=next_rev,updated_at=now() where id=p.id;
  insert into public.audit_logs(company_id,user_id,action,entity_type,entity_id,details) values(p.company_id,auth.uid()::text,'restore_snapshot','page',p.id,jsonb_build_object('snapshotId',s.id,'safetySnapshotId',safety_id,'revision',next_rev));
  return jsonb_build_object('revision',next_rev,'safetySnapshotId',safety_id);
end;
$$;

create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare target_company text; first_user boolean;
begin
  select id into target_company from public.companies where status='active' order by created_at asc limit 1;
  if target_company is null then raise exception 'Nenhuma empresa ativa configurada'; end if;
  select not exists(select 1 from public.company_memberships where active=true) into first_user;
  insert into public.profiles(user_id,display_name,email) values(new.id,coalesce(new.raw_user_meta_data->>'name',split_part(new.email,'@',1)),new.email)
  on conflict (user_id) do update set email=excluded.email,updated_at=now();
  insert into public.company_memberships(company_id,user_id,role,active) values(target_company,new.id,case when first_user then 'owner' else 'viewer' end,first_user)
  on conflict (company_id,user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_auth_user();
create trigger trg_app_config_updated_at before update on public.app_config for each row execute function public.set_updated_at();
create trigger trg_brands_updated_at before update on public.brands for each row execute function public.set_updated_at();
create trigger trg_companies_updated_at before update on public.companies for each row execute function public.set_updated_at();
create trigger trg_hierarchy_nodes_updated_at before update on public.hierarchy_nodes for each row execute function public.set_updated_at();
create trigger trg_marketing_settings_updated_at before update on public.marketing_settings for each row execute function public.set_updated_at();
create trigger trg_media_assets_updated_at before update on public.media_assets for each row execute function public.set_updated_at();
create trigger trg_offers_updated_at before update on public.offers for each row execute function public.set_updated_at();
create trigger trg_pages_updated_at before update on public.pages for each row execute function public.set_updated_at();
create trigger trg_products_updated_at before update on public.products for each row execute function public.set_updated_at();
create trigger trg_templates_updated_at before update on public.templates for each row execute function public.set_updated_at();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
('brand-media','brand-media',true,15728640,array['image/jpeg','image/png','image/webp','image/gif']),
('catalog-files','catalog-files',true,52428800,array['application/pdf']),
('marketing-media','marketing-media',true,52428800,array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm']),
('product-images','product-images',true,10485760,array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set name=excluded.name,public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
