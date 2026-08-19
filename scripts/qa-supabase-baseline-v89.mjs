import { readFile } from 'node:fs/promises';

const [core, rls] = await Promise.all([
  readFile('supabase/baseline/001_core.sql', 'utf8'),
  readFile('supabase/baseline/002_rls.sql', 'utf8'),
]);

const assert = (condition, message) => {
  if (!condition) throw new Error(`QA baseline Supabase V89: ${message}`);
};

const tables = [
  'app_config','audit_logs','brands','catalog_settings','companies','company_memberships',
  'editor_settings','hierarchy_nodes','marketing_settings','media_assets','offer_products',
  'offers','page_publications','page_snapshots','pages','product_media','products','profiles','templates',
];

for (const table of tables) {
  assert(new RegExp(`create table public\\.${table}\\b`, 'i').test(core), `tabela ${table} ausente do baseline`);
  assert(new RegExp(`alter table public\\.${table} enable row level security`, 'i').test(rls), `RLS de ${table} ausente do baseline`);
}

for (const fn of [
  'private.is_company_member','private.can_edit_company','private.can_admin_company',
  'private.get_public_catalog_data','private.get_public_site_data','public.bootstrap_status',
  'public.get_public_catalog','public.get_public_site','public.get_public_product_media',
  'public.create_page_snapshot','public.publish_page','public.restore_page_snapshot','public.handle_new_auth_user',
]) {
  assert(core.toLowerCase().includes(`function ${fn.toLowerCase()}`), `função ${fn} ausente`);
}

for (const bucket of ['product-images','brand-media','marketing-media','catalog-files']) {
  assert(core.includes(`'${bucket}'`), `bucket ${bucket} ausente`);
}

assert(!/create policy\s+pages_public_select/i.test(rls), 'baseline não pode recriar pages_public_select');
assert(/revoke all on public\.pages from anon/i.test(rls), 'baseline precisa revogar acesso anon direto a pages');
assert(/create policy product_media_select/i.test(rls), 'policy SELECT de product_media ausente');
assert(/create policy product_media_insert/i.test(rls), 'policy INSERT de product_media ausente');
assert(/create policy product_media_update/i.test(rls), 'policy UPDATE de product_media ausente');
assert(/create policy product_media_delete/i.test(rls), 'policy DELETE de product_media ausente');
assert(!/create policy\s+product_media_write[\s\S]*for all/i.test(rls), 'baseline não pode recriar product_media_write FOR ALL');
assert(/revoke execute on function public\.publish_page\(text\) from public,anon/i.test(rls), 'publish_page ainda não está restrita no baseline');
assert(/revoke execute on function public\.restore_page_snapshot\(text\) from public,anon/i.test(rls), 'restore_page_snapshot ainda não está restrita no baseline');

console.log(`QA baseline Supabase V89: ${tables.length} tabelas + RLS, funções, buckets e hardening validados.`);
