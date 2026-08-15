-- V58: align PostgREST upserts with the database constraints and remove an
-- obsolete public entry point that bypassed RLS for product media.

revoke execute on function public.get_public_product_media(text) from public;
revoke execute on function public.get_public_product_media(text) from anon;
revoke execute on function public.get_public_product_media(text) from authenticated;
grant execute on function public.get_public_product_media(text) to service_role;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.templates'::regclass
      and conname = 'templates_company_id_system_key_key'
  ) then
    alter table public.templates
      add constraint templates_company_id_system_key_key
      unique (company_id, system_key);
  end if;
end $$;

drop index if exists public.uq_templates_company_system_key;
