import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [migration, publicSearch, publicPopups, worker] = await Promise.all([
  readFile('supabase/migrations/20260819193000_v89_revoke_anon_cross_tenant_reads.sql', 'utf8'),
  readFile('public/public-global-search-v78.js', 'utf8'),
  readFile('public/public-entity-popups-v81.js', 'utf8'),
  readFile('worker/index-v81.ts', 'utf8'),
]);

for (const table of ['products', 'brands', 'hierarchy_nodes', 'offers', 'marketing_settings', 'catalog_settings']) {
  assert.match(migration, new RegExp(`public\\.${table}`), `migration precisa cobrir ${table}`);
}
assert.match(migration, /revoke\s+select[\s\S]+from\s+anon/i, 'migration precisa remover SELECT do papel anon');
assert.doesNotMatch(migration, /from\s+authenticated/i, 'migration não pode revogar acesso authenticated');
assert.doesNotMatch(migration, /from\s+service_role/i, 'migration não pode revogar acesso service_role');

assert.match(publicSearch, /API_URL\s*=\s*['"]\/api\/public\/catalog['"]/, 'busca pública deve passar pelo Worker');
assert.match(publicPopups, /API_URL\s*=\s*['"]\/api\/public\/catalog['"]/, 'popups públicos devem passar pelo Worker');
assert.match(worker, /const COMPANY_ID = ['"]cmp_asteryon['"]/, 'Worker precisa manter escopo explícito de empresa');
assert.match(worker, /company_id=eq\.\$\{COMPANY_ID\}/, 'Worker público/admin deve consultar dados com company_id');

console.log('QA V89 tenant isolation: acesso público conhecido passa pelo Worker e migration remove SELECT direto de anon.');
