import assert from 'node:assert/strict';
import fs from 'node:fs';

const worker = fs.readFileSync('worker/app/services/ai.ts', 'utf8');
const entry = fs.readFileSync('worker/app/index.ts', 'utf8');
const client = fs.readFileSync('frontend/src/lib/ai.functions.ts', 'utf8');

for (const needle of [
  "'/api/admin/ai/test'",
  "'/api/admin/ai/chat'",
  "'/api/admin/ai/search'",
  "requireUser(req, env, ['EDITOR', 'ADMIN'])",
  "url.protocol !== 'https:'",
  "hostname === 'localhost'",
  "isNonPublicIpv4",
  "isNonPublicIpv6",
  'dnsAddresses',
  "redirect: 'manual'",
  'MAX_RESPONSE_BYTES',
]) {
  assert.ok(worker.includes(needle), `Gateway de IA sem proteção/contrato obrigatório: ${needle}`);
}
assert.ok(entry.includes("handleAiRoute"), 'Worker Enterprise precisa registrar gateway de IA');
assert.ok(entry.indexOf('handleAiRoute') > -1 && entry.includes("path.startsWith('/api/admin/')"), 'Gateway de IA precisa ficar atrás do gate admin');
for (const route of ['/api/admin/ai/test', '/api/admin/ai/chat', '/api/admin/ai/search']) {
  assert.ok(client.includes(route), `Cliente ASTERYON AI precisa usar ${route}`);
}
for (const forbidden of ['createServerFn', '@tanstack/react-start', '/rest/v1/', '/auth/v1/']) {
  assert.equal(client.includes(forbidden), false, `Cliente ASTERYON AI contém runtime/acesso proibido: ${forbidden}`);
}

const auditLines = worker.split('\n').filter((line) => line.includes('await audit(') || line.includes('apiKey'));
const auditCalls = auditLines.filter((line) => line.includes('await audit(')).join('\n');
assert.equal(auditCalls.includes('apiKey'), false, 'API keys não podem entrar nos detalhes de auditoria');

console.log('QA ASTERYON AI Enterprise: OK — same-origin, autenticação, SSRF/DNS e auditoria sem segredos.');
