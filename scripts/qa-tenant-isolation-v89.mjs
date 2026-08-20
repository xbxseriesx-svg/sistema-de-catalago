import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [migration, publicSearch, publicPopups, env, entry, session, catalog, brands, products, media] = await Promise.all([
  readFile('supabase/migrations/20260819193000_v89_revoke_anon_cross_tenant_reads.sql', 'utf8'),
  readFile('public/public-global-search-v78.js', 'utf8'),
  readFile('public/public-entity-popups-v81.js', 'utf8'),
  readFile('worker/app/env.ts', 'utf8'),
  readFile('worker/app/index.ts', 'utf8'),
  readFile('worker/app/auth/session.ts', 'utf8'),
  readFile('worker/app/services/catalog.ts', 'utf8'),
  readFile('worker/app/services/brands.ts', 'utf8'),
  readFile('worker/app/services/products.ts', 'utf8'),
  readFile('worker/app/services/media.ts', 'utf8'),
]);

for (const table of ['products', 'brands', 'hierarchy_nodes', 'offers', 'marketing_settings', 'catalog_settings']) {
  assert.match(migration, new RegExp(`public\\.${table}`), `migration precisa cobrir ${table}`);
}
assert.match(migration, /revoke\s+select[\s\S]+from\s+anon/i, 'migration precisa remover SELECT do papel anon');
assert.doesNotMatch(migration, /from\s+authenticated/i, 'migration não pode revogar acesso authenticated');
assert.doesNotMatch(migration, /from\s+service_role/i, 'migration não pode revogar acesso service_role');

assert.match(publicSearch, /API_URL\s*=\s*['"]\/api\/public\/catalog['"]/, 'busca pública deve passar pelo Worker');
assert.match(publicPopups, /API_URL\s*=\s*['"]\/api\/public\/catalog['"]/, 'popups públicos devem passar pelo Worker');
assert.match(env, /COMPANY_ID\s*=\s*['"]cmp_asteryon['"]/, 'Worker Enterprise precisa manter escopo explícito de empresa');
assert.match(entry, /path\.startsWith\('\/api\/admin\/'\)/, 'entrypoint Enterprise precisa aplicar gate global às rotas admin');
assert.match(entry, /companyMembership\(effectiveReq, env\)/, 'entrypoint Enterprise precisa validar membership da empresa');
assert.match(session, /company_id=eq\.\$\{COMPANY_ID\}/, 'sessão Enterprise precisa resolver membership pelo company_id');

for (const [name, source] of [
  ['catalog.ts', catalog],
  ['brands.ts', brands],
  ['products.ts', products],
  ['media.ts', media],
]) {
  assert.match(source, /company_id=eq\.\$\{(?:encodeURIComponent\()?COMPANY_ID/, `${name} precisa consultar/mutar dados com company_id`);
}

assert.match(catalog, /publicOnly \? hierarchy\.filter/, 'catálogo público precisa filtrar hierarquia ativa defensivamente');
assert.match(brands, /scopedRows/, 'mutações de marca precisam confirmar existência dentro do tenant');

console.log('QA Enterprise tenant isolation: público passa pelo Worker, admin exige membership e serviços críticos mantêm company_id explícito.');
