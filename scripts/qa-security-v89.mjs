import { readFile } from 'node:fs/promises';

const [v70, v72, migration, wrangler] = await Promise.all([
  readFile('worker/index-v70.ts', 'utf8'),
  readFile('worker/index-v72.ts', 'utf8'),
  readFile('supabase/migrations/20260819170000_v89_protect_page_drafts.sql', 'utf8'),
  readFile('wrangler.jsonc', 'utf8'),
]);

function assert(condition, message) {
  if (!condition) throw new Error(`QA V89 security: ${message}`);
}

for (const [name, source] of [['index-v70.ts', v70], ['index-v72.ts', v72]]) {
  assert(source.includes('REMOTE_IMAGE_HMAC_SECRET?: string'), `${name} não declara o segredo HMAC dedicado`);
  const hmac = source.match(/async function hmacKey\(env: Env\) \{([\s\S]*?)\n\}/)?.[1] || '';
  assert(hmac.includes('env.REMOTE_IMAGE_HMAC_SECRET'), `${name} não usa REMOTE_IMAGE_HMAC_SECRET no HMAC`);
  assert(!hmac.includes('adminKey(env)'), `${name} ainda reutiliza a chave administrativa do Supabase no HMAC`);
  assert(!hmac.includes('SUPABASE_SECRET_KEY'), `${name} ainda referencia SUPABASE_SECRET_KEY dentro do HMAC`);
  assert(!hmac.includes('SUPABASE_SERVICE_ROLE_KEY'), `${name} ainda referencia SUPABASE_SERVICE_ROLE_KEY dentro do HMAC`);
}

assert(/drop policy if exists pages_public_select on public\.pages/i.test(migration), 'migration não remove a policy pública insegura de pages');
assert(/revoke select on table public\.pages from anon/i.test(migration), 'migration não revoga SELECT anon em pages');
assert(/"main"\s*:\s*"worker\/index-v81\.ts"/.test(wrangler), 'entrypoint inesperado: revisar cadeia ativa antes do merge');

console.log('QA V89 security: segredo HMAC dedicado e proteção de drafts validados estaticamente.');
