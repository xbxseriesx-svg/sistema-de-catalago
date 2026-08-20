import { readFile } from 'node:fs/promises';
import process from 'node:process';

let failed = false;
const fail = (message) => { failed = true; console.error(`ENTERPRISE SECURITY: ${message}`); };
const ok = (message) => console.log(`ENTERPRISE SECURITY OK: ${message}`);

const entry = await readFile('worker/app/index.ts', 'utf8');
const session = await readFile('worker/app/auth/session.ts', 'utf8');
const pages = await readFile('worker/app/services/pages.ts', 'utf8');
const products = await readFile('worker/app/services/products.ts', 'utf8');
const media = await readFile('worker/app/services/media.ts', 'utf8');
const brandImages = await readFile('worker/app/services/brand-images.ts', 'utf8');

if (!entry.includes("path.startsWith('/api/public/')")) fail('router não separa explicitamente rotas públicas.');
if (!entry.includes("path.startsWith('/api/admin/')")) fail('router não separa explicitamente rotas administrativas.');
if (!entry.includes('companyMembership(effectiveReq, env)')) fail('router admin sem gate global de membership.');
if (!entry.includes("!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !sameOrigin(req)")) {
  fail('proteção global de origem para métodos mutáveis ausente.');
}

if (!session.includes('company_id=eq.${encodeURIComponent(COMPANY_ID)}&user_id=eq.')) {
  fail('sessão não resolve membership pela empresa corrente.');
}
if (!session.includes('company_id=eq.${encodeURIComponent(COMPANY_ID)}&role=eq.owner')) {
  fail('bootstrap/status não restringem owner à empresa corrente.');
}

if (!pages.includes("['GET', 'PUT'].includes(req.method)")) fail('draft aceita método fora de GET|PUT.');
if (!pages.includes("['GET', 'POST'].includes(req.method)")) fail('snapshot aceita método fora de GET|POST.');
if (!pages.includes('REVISION_CONFLICT')) fail('draft sem proteção de revisão concorrente.');

if (!products.includes('&company_id=eq.${COMPANY_ID}')) fail('CRUD de produtos sem escopo explícito de empresa.');
if (!media.includes('&company_id=eq.${encodeURIComponent(COMPANY_ID)}&select=public_url')) {
  fail('mídia pública não está isolada por empresa.');
}
if (/bucket:\s*['"]legacy-d1-inline['"]/.test(media)) {
  fail('mídia Enterprise voltou a criar bucket inline legado.');
}
if (/metadata:\s*\{[^}]*dataBase64/s.test(media)) {
  fail('mídia Enterprise voltou a persistir base64 no banco.');
}

for (const token of [
  "url.protocol !== 'https:'",
  "url.port !== '443'",
  'isNonPublicIpv4',
  'isNonPublicIpv6',
  "dnsAddresses(hostname, 'A')",
  "dnsAddresses(hostname, 'AAAA')",
  'REMOTE_IMAGE_HMAC_SECRET',
  'sameSignature',
  "redirect: 'manual'",
  'MAX_REMOTE_BYTES',
  'isAllowedImage',
]) {
  if (!brandImages.includes(token)) fail(`proteção de imagem remota ausente: ${token}`);
}

if (failed) {
  console.error('ENTERPRISE SECURITY REPROVADO.');
  process.exit(1);
}

ok('tenant, métodos HTTP, origem, mídia e SSRF possuem contratos estáticos obrigatórios.');
