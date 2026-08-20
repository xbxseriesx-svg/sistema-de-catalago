import { readFile } from 'node:fs/promises';

const [env, brandImages, session, v70, v72, migration, wrangler, rollbackWrangler] = await Promise.all([
  readFile('worker/app/env.ts', 'utf8'),
  readFile('worker/app/services/brand-images.ts', 'utf8'),
  readFile('worker/app/auth/session.ts', 'utf8'),
  readFile('worker/index-v70.ts', 'utf8'),
  readFile('worker/index-v72.ts', 'utf8'),
  readFile('supabase/migrations/20260819170000_v89_protect_page_drafts.sql', 'utf8'),
  readFile('wrangler.jsonc', 'utf8'),
  readFile('wrangler.legacy-rollback.jsonc', 'utf8'),
]);

function assert(condition, message) {
  if (!condition) throw new Error(`QA Enterprise security: ${message}`);
}

assert(env.includes('REMOTE_IMAGE_HMAC_SECRET?: string'), 'Env Enterprise não declara o segredo HMAC dedicado');
const enterpriseHmac = brandImages.match(/async function hmacKey\(env: Env\) \{([\s\S]*?)\n\}/)?.[1] || '';
assert(enterpriseHmac.includes('env.REMOTE_IMAGE_HMAC_SECRET'), 'serviço Enterprise de logos não usa REMOTE_IMAGE_HMAC_SECRET');
assert(!enterpriseHmac.includes('adminKey(env)'), 'serviço Enterprise ainda reutiliza chave administrativa no HMAC');
assert(!enterpriseHmac.includes('SUPABASE_SECRET_KEY'), 'serviço Enterprise referencia SUPABASE_SECRET_KEY dentro do HMAC');
assert(!enterpriseHmac.includes('SUPABASE_SERVICE_ROLE_KEY'), 'serviço Enterprise referencia service role dentro do HMAC');
assert(brandImages.includes('validateRemoteTarget'), 'serviço Enterprise não valida destino remoto por DNS/IP');
assert(brandImages.includes('isNonPublicIpv4') && brandImages.includes('isNonPublicIpv6'), 'serviço Enterprise não bloqueia redes privadas IPv4/IPv6');

// Mantém verificação do rollback enquanto ele existir.
for (const [name, source] of [['index-v70.ts', v70], ['index-v72.ts', v72]]) {
  assert(source.includes('REMOTE_IMAGE_HMAC_SECRET?: string'), `${name} de rollback não declara o segredo HMAC dedicado`);
  const hmac = source.match(/async function hmacKey\(env: Env\) \{([\s\S]*?)\n\}/)?.[1] || '';
  assert(hmac.includes('env.REMOTE_IMAGE_HMAC_SECRET'), `${name} de rollback não usa REMOTE_IMAGE_HMAC_SECRET no HMAC`);
  assert(!hmac.includes('adminKey(env)'), `${name} de rollback ainda reutiliza a chave administrativa do Supabase no HMAC`);
}

assert(env.includes("export const REFRESH_COOKIE = '__Host-asteryon_refresh'"), 'Worker Enterprise não reconhece o refresh cookie');
assert(session.includes('grant_type=refresh_token'), 'Worker Enterprise não renova access token via refresh token');
assert(session.includes('requestWithSession(req, accessToken, nextRefreshToken)'), 'sessão renovada não é encaminhada ao request interno');
assert(session.includes('attachRefreshedSession(response, session'), 'função de anexar tokens renovados não está preservada');
assert(session.includes("path === '/api/auth/status'"), 'status de autenticação não está coberto pela sessão Enterprise');

assert(/drop policy if exists pages_public_select on public\.pages/i.test(migration), 'migration não remove a policy pública insegura de pages');
assert(/revoke select on table public\.pages from anon/i.test(migration), 'migration não revoga SELECT anon em pages');
assert(/"main"\s*:\s*"worker\/app\/index\.ts"/.test(wrangler), 'entrypoint oficial não é o Worker Enterprise modular');
assert(/"main"\s*:\s*"worker\/index-v81\.ts"/.test(rollbackWrangler), 'rollback explícito V81 não está preservado');

console.log('QA Enterprise security/auth: HMAC dedicado, SSRF, refresh automático, proteção de drafts e rollback explícito validados.');
