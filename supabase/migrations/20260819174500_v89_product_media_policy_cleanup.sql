-- V89 P1: product_media_write usava FOR ALL e se sobrepunha à policy
-- product_media_select em SELECT. Mantemos a mesma autorização de escrita,
-- mas separamos INSERT/UPDATE/DELETE para não duplicar avaliação em SELECT.

begin;

drop policy if exists product_media_write on public.product_media;

drop policy if exists product_media_insert on public.product_media;
create policy product_media_insert
on public.product_media
as permissive
for insert
to authenticated
with check (
  exists (
    select 1
    from public.products p
    where p.id = product_media.product_id
      and private.can_edit_company(p.company_id)
  )
);

drop policy if exists product_media_update on public.product_media;
create policy product_media_update
on public.product_media
as permissive
for update
to authenticated
using (
  exists (
    select 1
    from public.products p
    where p.id = product_media.product_id
      and private.can_edit_company(p.company_id)
  )
)
with check (
  exists (
    select 1
    from public.products p
    where p.id = product_media.product_id
      and private.can_edit_company(p.company_id)
  )
);

drop policy if exists product_media_delete on public.product_media;
create policy product_media_delete
on public.product_media
as permissive
for delete
to authenticated
using (
  exists (
    select 1
    from public.products p
    where p.id = product_media.product_id
      and private.can_edit_company(p.company_id)
  )
);

commit;
