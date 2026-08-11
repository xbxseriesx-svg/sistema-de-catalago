-- Base de produção do ASTERYON Catálogo Digital
create extension if not exists pgcrypto;

create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  created_at timestamptz default now()
);

-- Árvores de navegação totalmente livres por empresa: Departamentos, Distribuições,
-- Linhas, Famílias ou qualquer outra estrutura criada pelo administrador.
create table if not exists catalog_trees (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  slug text,
  sort_order int default 0,
  active boolean default true,
  unique(company_id,name)
);

create table if not exists catalog_nodes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  tree_id uuid not null references catalog_trees(id) on delete cascade,
  parent_id uuid references catalog_nodes(id) on delete cascade,
  name text not null,
  node_type text,
  sort_order int default 0,
  active boolean default true,
  metadata jsonb default '{}'::jsonb
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  code text not null,
  name text not null,
  brand text,
  price numeric,
  show_price boolean default false,
  public_fields jsonb default '{}'::jsonb,
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(company_id,code)
);

-- Um produto pode participar de diferentes árvores auxiliares, sem duplicação.
-- A árvore principal continua definindo seu caminho normal de catálogo.
create table if not exists product_catalog_nodes (
  product_id uuid references products(id) on delete cascade,
  node_id uuid references catalog_nodes(id) on delete cascade,
  is_primary_path boolean default false,
  primary key(product_id,node_id)
);

create table if not exists product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade,
  path text not null,
  sort_order int default 0,
  is_primary boolean default false,
  created_at timestamptz default now()
);

create table if not exists promotions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  banner_path text,
  start_at timestamptz,
  end_at timestamptz,
  active boolean default true,
  created_at timestamptz default now()
);

create table if not exists promotion_products (
  promotion_id uuid references promotions(id) on delete cascade,
  product_id uuid references products(id) on delete cascade,
  sort_order int default 0,
  primary key(promotion_id,product_id)
);

-- Cada versão guarda o editor visual inteiro: layout, banners, cards, textos,
-- logo, favicon, cores, fontes, tema e overrides individuais.
create table if not exists site_versions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  version_number bigint,
  status text not null check(status in ('draft','published','archived')),
  config jsonb not null default '{}'::jsonb,
  content_snapshot jsonb default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz default now(),
  published_at timestamptz
);

create unique index if not exists one_published_version_per_company
  on site_versions(company_id) where status='published';

create table if not exists analytics_events (
  id bigint generated always as identity primary key,
  company_id uuid references companies(id) on delete cascade,
  event_type text not null,
  entity_type text,
  entity_id text,
  search_term text,
  session_hash text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists catalog_nodes_tree_parent_idx on catalog_nodes(tree_id,parent_id,sort_order);
create index if not exists products_company_code_idx on products(company_id,code);
create index if not exists analytics_events_created_idx on analytics_events(created_at);
create index if not exists analytics_events_entity_idx on analytics_events(entity_type,entity_id);

-- Produção: habilitar RLS em todas as tabelas e policies por company_id / usuário autenticado.
