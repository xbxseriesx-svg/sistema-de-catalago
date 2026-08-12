-- ASTERYON Editor Visual Pro
-- Modelo voltado a rascunho, sandbox, versionamento imutável e publicação controlada.

create extension if not exists pgcrypto;

create table if not exists public.site_pages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  slug text not null,
  name text not null,
  published_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, slug)
);

create table if not exists public.site_sandboxes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  page_id uuid not null references public.site_pages(id) on delete cascade,
  name text not null,
  kind text not null default 'sandbox' check (kind in ('production','sandbox')),
  created_by uuid,
  created_at timestamptz not null default now(),
  unique(page_id, name)
);

create table if not exists public.site_drafts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  page_id uuid not null references public.site_pages(id) on delete cascade,
  sandbox_id uuid not null references public.site_sandboxes(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft','preview','scheduled')),
  document jsonb not null default '{}'::jsonb,
  revision bigint not null default 1,
  updated_by uuid,
  updated_at timestamptz not null default now(),
  scheduled_at timestamptz,
  unique(page_id, sandbox_id)
);

create table if not exists public.site_versions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  page_id uuid not null references public.site_pages(id) on delete cascade,
  version_number bigint not null,
  status text not null default 'archived' check (status in ('published','archived')),
  document jsonb not null,
  change_summary jsonb not null default '{}'::jsonb,
  published_by uuid,
  published_at timestamptz not null default now(),
  unique(page_id, version_number)
);

alter table public.site_pages
  drop constraint if exists site_pages_published_version_id_fkey;
alter table public.site_pages
  add constraint site_pages_published_version_id_fkey
  foreign key (published_version_id) references public.site_versions(id) on delete set null;

create table if not exists public.editor_snapshots (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  page_id uuid not null references public.site_pages(id) on delete cascade,
  sandbox_id uuid not null references public.site_sandboxes(id) on delete cascade,
  label text not null,
  trigger_type text not null check (trigger_type in ('manual','actions_25','timer_5m','restore')),
  document jsonb not null,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.editor_activity (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  page_id uuid references public.site_pages(id) on delete cascade,
  sandbox_id uuid references public.site_sandboxes(id) on delete cascade,
  user_id uuid,
  action text not null,
  block_id text,
  label text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.component_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  block_type text not null,
  block jsonb not null,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.design_systems (
  company_id uuid primary key references public.companies(id) on delete cascade,
  tokens jsonb not null default '{}'::jsonb,
  updated_by uuid,
  updated_at timestamptz not null default now()
);

create table if not exists public.visual_identity (
  company_id uuid primary key references public.companies(id) on delete cascade,
  company_name text not null,
  logo_path text,
  mobile_logo_path text,
  favicon_path text,
  pwa_icon_path text,
  watermark_path text,
  updated_by uuid,
  updated_at timestamptz not null default now()
);

create index if not exists site_drafts_schedule_idx on public.site_drafts(status, scheduled_at) where status = 'scheduled';
create index if not exists site_versions_page_idx on public.site_versions(page_id, version_number desc);
create index if not exists editor_activity_page_idx on public.editor_activity(page_id, created_at desc);
create index if not exists editor_snapshots_page_idx on public.editor_snapshots(page_id, created_at desc);

-- Bucket privado para assets do editor. O portal deve usar URLs assinadas ou assets publicados
-- em uma camada pública controlada pela pipeline de publicação.
insert into storage.buckets (id, name, public)
values ('catalog-editor-assets', 'catalog-editor-assets', false)
on conflict (id) do nothing;

-- Função transacional de publicação. O portal público consulta apenas site_pages.published_version_id.
create or replace function public.publish_site_draft(p_draft_id uuid, p_user_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_draft public.site_drafts%rowtype;
  v_version_number bigint;
  v_version_id uuid;
begin
  select * into v_draft
  from public.site_drafts
  where id = p_draft_id
  for update;

  if not found then
    raise exception 'Draft not found';
  end if;

  select coalesce(max(version_number), 0) + 1
    into v_version_number
  from public.site_versions
  where page_id = v_draft.page_id;

  update public.site_versions
  set status = 'archived'
  where page_id = v_draft.page_id and status = 'published';

  insert into public.site_versions (
    company_id, page_id, version_number, status, document, published_by
  ) values (
    v_draft.company_id, v_draft.page_id, v_version_number, 'published', v_draft.document, p_user_id
  ) returning id into v_version_id;

  update public.site_pages
  set published_version_id = v_version_id, updated_at = now()
  where id = v_draft.page_id;

  update public.site_drafts
  set status = 'draft', scheduled_at = null, revision = revision + 1, updated_at = now()
  where id = p_draft_id;

  insert into public.editor_activity(company_id, page_id, sandbox_id, user_id, action, label, metadata)
  values(v_draft.company_id, v_draft.page_id, v_draft.sandbox_id, p_user_id, 'PUBLISH', 'Nova versão publicada', jsonb_build_object('version_number', v_version_number, 'version_id', v_version_id));

  return v_version_id;
end;
$$;

-- RLS: políticas de produção devem validar membership da empresa e função administrativa.
alter table public.site_pages enable row level security;
alter table public.site_sandboxes enable row level security;
alter table public.site_drafts enable row level security;
alter table public.site_versions enable row level security;
alter table public.editor_snapshots enable row level security;
alter table public.editor_activity enable row level security;
alter table public.component_templates enable row level security;
alter table public.design_systems enable row level security;
alter table public.visual_identity enable row level security;

-- Leitura pública deliberadamente limitada às versões apontadas por site_pages.published_version_id.
-- Policies administrativas por company_id devem ser aplicadas junto ao modelo de usuários/roles do projeto.
