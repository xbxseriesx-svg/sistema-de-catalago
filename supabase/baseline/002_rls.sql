-- ASTERYON Catálogo V89 — baseline RLS/policies
-- Uso: somente após 001_core.sql em projeto Supabase vazio.

alter table public.app_config enable row level security;
alter table public.audit_logs enable row level security;
alter table public.brands enable row level security;
alter table public.catalog_settings enable row level security;
alter table public.companies enable row level security;
alter table public.company_memberships enable row level security;
alter table public.editor_settings enable row level security;
alter table public.hierarchy_nodes enable row level security;
alter table public.marketing_settings enable row level security;
alter table public.media_assets enable row level security;
alter table public.offer_products enable row level security;
alter table public.offers enable row level security;
alter table public.page_publications enable row level security;
alter table public.page_snapshots enable row level security;
alter table public.pages enable row level security;
alter table public.product_media enable row level security;
alter table public.products enable row level security;
alter table public.profiles enable row level security;
alter table public.templates enable row level security;

-- Permissões base: authenticated usa RLS; anon só recebe as leituras públicas explícitas.
grant all on all tables in schema public to authenticated;
grant usage, select on sequence public.audit_logs_id_seq to authenticated;
grant select on public.brands, public.catalog_settings, public.hierarchy_nodes, public.marketing_settings, public.offer_products, public.offers, public.products to anon;
revoke all on public.pages from anon;

create policy app_config_admin_select on public.app_config for select to authenticated using (
  exists(select 1 from public.company_memberships m where m.user_id=auth.uid() and m.active=true and m.role in ('owner','admin'))
);
create policy app_config_admin_insert on public.app_config for insert to authenticated with check (
  exists(select 1 from public.company_memberships m where m.user_id=auth.uid() and m.active=true and m.role in ('owner','admin'))
);
create policy app_config_admin_update on public.app_config for update to authenticated using (
  exists(select 1 from public.company_memberships m where m.user_id=auth.uid() and m.active=true and m.role in ('owner','admin'))
) with check (
  exists(select 1 from public.company_memberships m where m.user_id=auth.uid() and m.active=true and m.role in ('owner','admin'))
);
create policy app_config_admin_delete on public.app_config for delete to authenticated using (
  exists(select 1 from public.company_memberships m where m.user_id=auth.uid() and m.active=true and m.role in ('owner','admin'))
);

create policy audit_member_select on public.audit_logs for select to authenticated using (company_id is null or private.is_company_member(company_id));
create policy audit_insert on public.audit_logs for insert to authenticated with check (company_id is null or private.is_company_member(company_id));

create policy companies_member_select on public.companies for select to authenticated using (private.is_company_member(id));
create policy companies_admin_update on public.companies for update to authenticated using (private.can_admin_company(id)) with check (private.can_admin_company(id));

create policy membership_self_select on public.company_memberships for select to authenticated using (user_id=auth.uid() or private.can_admin_company(company_id));
create policy membership_admin_insert on public.company_memberships for insert to authenticated with check (private.can_admin_company(company_id));
create policy membership_admin_update on public.company_memberships for update to authenticated using (private.can_admin_company(company_id)) with check (private.can_admin_company(company_id));
create policy membership_owner_delete on public.company_memberships for delete to authenticated using (
  exists(select 1 from public.company_memberships me where me.company_id=company_memberships.company_id and me.user_id=auth.uid() and me.active=true and me.role='owner')
  and user_id<>auth.uid()
);

create policy profiles_company_select on public.profiles for select to authenticated using (
  user_id=auth.uid() or exists(
    select 1 from public.company_memberships mine
    join public.company_memberships theirs on theirs.company_id=mine.company_id
    where mine.user_id=auth.uid() and mine.active=true and mine.role in ('owner','admin') and theirs.user_id=profiles.user_id
  )
);
create policy profiles_self_update on public.profiles for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());

create policy editor_settings_member_select on public.editor_settings for select to authenticated using (private.is_company_member(company_id));
create policy editor_settings_editor_insert on public.editor_settings for insert to authenticated with check (private.can_edit_company(company_id));
create policy editor_settings_editor_update on public.editor_settings for update to authenticated using (private.can_edit_company(company_id)) with check (private.can_edit_company(company_id));
create policy editor_settings_editor_delete on public.editor_settings for delete to authenticated using (private.can_edit_company(company_id));

create policy brands_public_select on public.brands for select to anon using (active=true);
create policy brands_member_select on public.brands for select to authenticated using (private.is_company_member(company_id));
create policy brands_editor_insert on public.brands for insert to authenticated with check (private.can_edit_company(company_id));
create policy brands_editor_update on public.brands for update to authenticated using (private.can_edit_company(company_id)) with check (private.can_edit_company(company_id));
create policy brands_editor_delete on public.brands for delete to authenticated using (private.can_edit_company(company_id));

create policy hierarchy_public_select on public.hierarchy_nodes for select to anon using (active=true);
create policy hierarchy_member_select on public.hierarchy_nodes for select to authenticated using (private.is_company_member(company_id));
create policy hierarchy_editor_insert on public.hierarchy_nodes for insert to authenticated with check (private.can_edit_company(company_id));
create policy hierarchy_editor_update on public.hierarchy_nodes for update to authenticated using (private.can_edit_company(company_id)) with check (private.can_edit_company(company_id));
create policy hierarchy_editor_delete on public.hierarchy_nodes for delete to authenticated using (private.can_edit_company(company_id));

create policy products_public_select on public.products for select to anon using (status='active');
create policy products_member_select on public.products for select to authenticated using (private.is_company_member(company_id));
create policy products_editor_insert on public.products for insert to authenticated with check (private.can_edit_company(company_id));
create policy products_editor_update on public.products for update to authenticated using (private.can_edit_company(company_id)) with check (private.can_edit_company(company_id));
create policy products_editor_delete on public.products for delete to authenticated using (private.can_edit_company(company_id));

create policy media_member_select on public.media_assets for select to authenticated using (private.is_company_member(company_id));
create policy media_editor_insert on public.media_assets for insert to authenticated with check (private.can_edit_company(company_id));
create policy media_editor_update on public.media_assets for update to authenticated using (private.can_edit_company(company_id)) with check (private.can_edit_company(company_id));
create policy media_editor_delete on public.media_assets for delete to authenticated using (private.can_edit_company(company_id));

-- V89: SELECT e writes separados para evitar policy permissiva duplicada.
create policy product_media_select on public.product_media for select to authenticated using (
  exists(select 1 from public.products p where p.id=product_media.product_id and private.is_company_member(p.company_id))
);
create policy product_media_insert on public.product_media for insert to authenticated with check (
  exists(select 1 from public.products p where p.id=product_media.product_id and private.can_edit_company(p.company_id))
);
create policy product_media_update on public.product_media for update to authenticated using (
  exists(select 1 from public.products p where p.id=product_media.product_id and private.can_edit_company(p.company_id))
) with check (
  exists(select 1 from public.products p where p.id=product_media.product_id and private.can_edit_company(p.company_id))
);
create policy product_media_delete on public.product_media for delete to authenticated using (
  exists(select 1 from public.products p where p.id=product_media.product_id and private.can_edit_company(p.company_id))
);

create policy catalog_public_select on public.catalog_settings for select to anon using (true);
create policy catalog_member_select on public.catalog_settings for select to authenticated using (private.is_company_member(company_id));
create policy catalog_editor_insert on public.catalog_settings for insert to authenticated with check (private.can_edit_company(company_id));
create policy catalog_editor_update on public.catalog_settings for update to authenticated using (private.can_edit_company(company_id)) with check (private.can_edit_company(company_id));
create policy catalog_editor_delete on public.catalog_settings for delete to authenticated using (private.can_edit_company(company_id));

create policy marketing_public_select on public.marketing_settings for select to anon using (true);
create policy marketing_member_select on public.marketing_settings for select to authenticated using (private.is_company_member(company_id));
create policy marketing_editor_insert on public.marketing_settings for insert to authenticated with check (private.can_edit_company(company_id));
create policy marketing_editor_update on public.marketing_settings for update to authenticated using (private.can_edit_company(company_id)) with check (private.can_edit_company(company_id));
create policy marketing_editor_delete on public.marketing_settings for delete to authenticated using (private.can_edit_company(company_id));

create policy offers_public_select on public.offers for select to anon using (
  status='published' and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>=now())
);
create policy offers_member_select on public.offers for select to authenticated using (private.is_company_member(company_id));
create policy offers_editor_insert on public.offers for insert to authenticated with check (private.can_edit_company(company_id));
create policy offers_editor_update on public.offers for update to authenticated using (private.can_edit_company(company_id)) with check (private.can_edit_company(company_id));
create policy offers_editor_delete on public.offers for delete to authenticated using (private.can_edit_company(company_id));

create policy offer_products_public_select on public.offer_products for select to anon using (
  exists(select 1 from public.offers o where o.id=offer_products.offer_id and o.status='published')
);
create policy offer_products_member_select on public.offer_products for select to authenticated using (
  exists(select 1 from public.offers o where o.id=offer_products.offer_id and private.is_company_member(o.company_id))
);
create policy offer_products_editor_insert on public.offer_products for insert to authenticated with check (
  exists(select 1 from public.offers o where o.id=offer_products.offer_id and private.can_edit_company(o.company_id))
);
create policy offer_products_editor_update on public.offer_products for update to authenticated using (
  exists(select 1 from public.offers o where o.id=offer_products.offer_id and private.can_edit_company(o.company_id))
) with check (
  exists(select 1 from public.offers o where o.id=offer_products.offer_id and private.can_edit_company(o.company_id))
);
create policy offer_products_editor_delete on public.offer_products for delete to authenticated using (
  exists(select 1 from public.offers o where o.id=offer_products.offer_id and private.can_edit_company(o.company_id))
);

-- V89: pages não possui policy anon; público lê published_nodes via Worker/RPC pública.
create policy pages_member_select on public.pages for select to authenticated using (private.is_company_member(company_id));
create policy pages_editor_insert on public.pages for insert to authenticated with check (private.can_edit_company(company_id));
create policy pages_editor_update on public.pages for update to authenticated using (private.can_edit_company(company_id)) with check (private.can_edit_company(company_id));
create policy pages_editor_delete on public.pages for delete to authenticated using (private.can_edit_company(company_id));

create policy snapshots_member_select on public.page_snapshots for select to authenticated using (
  exists(select 1 from public.pages p where p.id=page_snapshots.page_id and private.is_company_member(p.company_id))
);
create policy snapshots_editor_insert on public.page_snapshots for insert to authenticated with check (
  exists(select 1 from public.pages p where p.id=page_snapshots.page_id and private.can_edit_company(p.company_id))
);
create policy snapshots_editor_update on public.page_snapshots for update to authenticated using (
  exists(select 1 from public.pages p where p.id=page_snapshots.page_id and private.can_edit_company(p.company_id))
) with check (
  exists(select 1 from public.pages p where p.id=page_snapshots.page_id and private.can_edit_company(p.company_id))
);
create policy snapshots_editor_delete on public.page_snapshots for delete to authenticated using (
  exists(select 1 from public.pages p where p.id=page_snapshots.page_id and private.can_edit_company(p.company_id))
);

create policy publications_member_select on public.page_publications for select to authenticated using (
  exists(select 1 from public.pages p where p.id=page_publications.page_id and private.is_company_member(p.company_id))
);
create policy publications_editor_insert on public.page_publications for insert to authenticated with check (
  exists(select 1 from public.pages p where p.id=page_publications.page_id and private.can_edit_company(p.company_id))
);
create policy publications_editor_update on public.page_publications for update to authenticated using (
  exists(select 1 from public.pages p where p.id=page_publications.page_id and private.can_edit_company(p.company_id))
) with check (
  exists(select 1 from public.pages p where p.id=page_publications.page_id and private.can_edit_company(p.company_id))
);
create policy publications_editor_delete on public.page_publications for delete to authenticated using (
  exists(select 1 from public.pages p where p.id=page_publications.page_id and private.can_edit_company(p.company_id))
);

create policy templates_member_select on public.templates for select to authenticated using (company_id is null or private.is_company_member(company_id));
create policy templates_editor_insert on public.templates for insert to authenticated with check (company_id is not null and private.can_edit_company(company_id));
create policy templates_editor_update on public.templates for update to authenticated using (company_id is not null and private.can_edit_company(company_id)) with check (company_id is not null and private.can_edit_company(company_id));
create policy templates_editor_delete on public.templates for delete to authenticated using (company_id is not null and private.can_edit_company(company_id));

-- Storage: pasta raiz = company_id; leitura pública é intencional para mídias do catálogo.
create policy asteryon_storage_select on storage.objects for select to authenticated using (
  bucket_id=any(array['product-images','brand-media','marketing-media','catalog-files']::text[])
  and private.is_company_member((storage.foldername(name))[1])
);
create policy asteryon_storage_insert on storage.objects for insert to authenticated with check (
  bucket_id=any(array['product-images','brand-media','marketing-media','catalog-files']::text[])
  and private.can_edit_company((storage.foldername(name))[1])
);
create policy asteryon_storage_update on storage.objects for update to authenticated using (
  bucket_id=any(array['product-images','brand-media','marketing-media','catalog-files']::text[])
  and private.can_edit_company((storage.foldername(name))[1])
) with check (
  bucket_id=any(array['product-images','brand-media','marketing-media','catalog-files']::text[])
  and private.can_edit_company((storage.foldername(name))[1])
);
create policy asteryon_storage_delete on storage.objects for delete to authenticated using (
  bucket_id=any(array['product-images','brand-media','marketing-media','catalog-files']::text[])
  and private.can_edit_company((storage.foldername(name))[1])
);
create policy public_read_catalog_storage on storage.objects for select to public using (
  bucket_id=any(array['product-images','brand-media','marketing-media','catalog-files']::text[])
);

-- RPCs públicas somente de leitura.
grant execute on function public.bootstrap_status() to anon,authenticated,service_role;
grant execute on function public.get_public_catalog() to anon,authenticated,service_role;
grant execute on function public.get_public_site(text) to anon,authenticated,service_role;
revoke execute on function public.get_public_product_media(text) from public,anon,authenticated;
grant execute on function public.get_public_product_media(text) to service_role;

-- RPCs mutáveis: V89 remove anon/PUBLIC.
revoke execute on function public.create_page_snapshot(text,text) from public,anon;
revoke execute on function public.publish_page(text) from public,anon;
revoke execute on function public.restore_page_snapshot(text) from public,anon;
grant execute on function public.create_page_snapshot(text,text) to authenticated,service_role;
grant execute on function public.publish_page(text) to authenticated,service_role;
grant execute on function public.restore_page_snapshot(text) to authenticated,service_role;
