import assert from 'node:assert/strict';
import worker from '../.wrangler-dry-run/index.js';

const HMAC_SECRET = 'qa-remote-image-hmac-secret-v89';
const encoder = new TextEncoder();
const outboundHosts = [];

async function signature(url) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(HMAC_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(url)));
  return [...bytes].map(value => value.toString(16).padStart(2, '0')).join('');
}

const json = value => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });
const publicDns = name => ({ Status: 0, Answer: [{ name: `${name}.`, type: 1, TTL: 60, data: '93.184.216.34' }] });
const emptyDns = () => ({ Status: 0, Answer: [] });

globalThis.fetch = async (input, init = {}) => {
  const request = input instanceof Request ? input : new Request(String(input), init);
  const url = new URL(request.url);
  const method = request.method;

  if (url.pathname === '/auth/v1/user') return json({ id: 'user_qa', email: 'qa@example.invalid' });
  if (url.pathname.endsWith('/company_memberships')) return json([{ company_id: 'cmp_asteryon', role: 'owner', active: true }]);
  if (url.pathname.endsWith('/profiles')) return json([{ display_name: 'QA', email: 'qa@example.invalid' }]);

  if (url.hostname === 'cloudflare-dns.com' && url.pathname === '/dns-query') {
    const name = url.searchParams.get('name');
    const type = url.searchParams.get('type');
    if (type === 'AAAA') return json(emptyDns());
    if (name === 'private.example') return json({ Status: 0, Answer: [{ name: 'private.example.', type: 1, TTL: 60, data: '127.0.0.1' }] });
    if (name === 'mixed.example') return json({ Status: 0, Answer: [
      { name: 'mixed.example.', type: 1, TTL: 60, data: '93.184.216.34' },
      { name: 'mixed.example.', type: 1, TTL: 60, data: '10.0.0.8' },
    ] });
    if (name === 'safe.example' || name === 'redirect.example') return json(publicDns(name));
    return json({ Status: 3, Answer: [] });
  }

  outboundHosts.push(url.hostname);
  if (url.hostname === 'safe.example') {
    const png = new Uint8Array([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);
    return new Response(png, { status: 200, headers: { 'content-type': 'image/png', 'content-length': String(png.length) } });
  }
  if (url.hostname === 'redirect.example') {
    return new Response(null, { status: 302, headers: { location: 'https://private.example/logo.png' } });
  }
  if (url.hostname === 'private.example' || url.hostname === 'mixed.example') {
    throw new Error(`SSRF: fetch proibido alcançou ${url.hostname}`);
  }

  throw new Error(`Requisição não simulada: ${method} ${url}`);
};

const env = {
  ASSETS: { fetch: () => new Response('asset') },
  SUPABASE_URL: 'https://supabase.example.test',
  SUPABASE_PUBLISHABLE_KEY: 'publishable',
  SUPABASE_SECRET_KEY: 'sb_secret_qa',
  REMOTE_IMAGE_HMAC_SECRET: HMAC_SECRET,
};

async function remoteFetch(target) {
  const sig = await signature(target);
  return worker.fetch(new Request(`https://example.test/api/admin/brand-images/fetch?url=${encodeURIComponent(target)}&sig=${sig}`, {
    headers: { cookie: '__Host-asteryon_access=qa-token' },
  }), env);
}

const safe = await remoteFetch('https://safe.example/logo.png');
assert.equal(safe.status, 200, 'host público com DNS público deve continuar permitido');
assert.equal(safe.headers.get('content-type'), 'image/png');
assert.ok(outboundHosts.includes('safe.example'));

const beforePrivate = outboundHosts.length;
const privateResponse = await remoteFetch('https://private.example/logo.png');
assert.equal(privateResponse.status, 403, 'DNS privado deve ser bloqueado');
assert.equal((await privateResponse.json()).error.code, 'REMOTE_IMAGE_HOST_BLOCKED');
assert.equal(outboundHosts.length, beforePrivate, 'nenhum fetch deve alcançar host que resolveu para loopback');

const beforeMixed = outboundHosts.length;
const mixedResponse = await remoteFetch('https://mixed.example/logo.png');
assert.equal(mixedResponse.status, 403, 'host com resposta DNS mista público+privado deve falhar fechado');
assert.equal(outboundHosts.length, beforeMixed, 'nenhum fetch deve alcançar host com qualquer endereço privado');

const redirectResponse = await remoteFetch('https://redirect.example/logo.png');
assert.equal(redirectResponse.status, 403, 'redirect para DNS privado deve ser revalidado e bloqueado');
assert.equal(outboundHosts.filter(host => host === 'redirect.example').length, 1);
assert.equal(outboundHosts.filter(host => host === 'private.example').length, 0, 'redirect privado não pode receber subrequest');

console.log('QA SSRF V89: DNS A/AAAA público obrigatório e redirects revalidados antes do fetch.');
