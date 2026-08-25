import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const portalHtml = read('public/portal/index.html');
const portalCss = read('public/portal/styles.css');
const portalJs = read('public/portal/app.js');
const legacyIndex = read('public/index.html');
const worker = read('worker/app/index.ts');
const wrangler = JSON.parse(read('wrangler.jsonc'));

assert.ok(portalHtml.includes('/portal/styles.css?v=97'), 'Portal V97 sem stylesheet próprio.');
assert.ok(portalHtml.includes('/portal/app.js?v=97'), 'Portal V97 sem runtime próprio.');
assert.ok(portalHtml.includes('width=device-width, initial-scale=1.0'), 'Viewport V97 precisa iniciar em 100%.');
assert.ok(portalHtml.includes('user-scalable=yes'), 'Zoom nativo precisa permanecer habilitado.');
assert.ok(portalHtml.includes('maximum-scale=5.0'), 'Zoom nativo precisa permitir ampliação real.');

for (const forbidden of [
  'responsive-v67',
  'responsive-auto-v95',
  'preview-editor',
  'editor-runtime',
  'runtime-loader',
  'system-runtime',
  'commercial-segments-destination',
  '/assets/index-',
]) {
  assert.equal(portalHtml.includes(forbidden), false, `Portal V97 não pode carregar runtime legado/editor: ${forbidden}`);
}

const executable = `${portalCss}\n${portalJs}`;
for (const forbidden of [
  /\bzoom\s*:/i,
  /transform\s*:\s*scale\s*\(/i,
  /\bscale\s*\(/i,
  /devicePixelRatio/i,
  /visualViewport/i,
  /outerWidth/i,
  /innerWidth/i,
  /pageScaleFactor/i,
  /fitScale/i,
  /horizontalScale/i,
  /font-size\s*:[^;]*\b(?:vw|dvw|svw|lvw)\b/i,
  /\bclamp\s*\(/i,
]) {
  assert.equal(forbidden.test(executable), false, `Portal V97 contém lógica que pode compensar zoom: ${forbidden}`);
}

assert.ok(/html\s*\{[\s\S]*?font-size:\s*16px;/m.test(portalCss), 'Portal V97 precisa usar base tipográfica fixa de 16px.');
assert.ok(portalCss.includes('--container: 85rem'), 'Portal V97 precisa de container central máximo de 1360px.');
assert.ok(portalCss.includes('@media (max-width: 74.9375rem)'), 'Breakpoint tablet/desktop V97 ausente.');
assert.ok(portalCss.includes('@media (max-width: 47.9375rem)'), 'Breakpoint mobile V97 ausente.');
assert.ok(portalCss.includes('repeat(auto-fill, minmax(14.5rem, 1fr))'), 'Grade pública precisa ser responsiva sem miniaturização.');

assert.equal(/supabase\.co/i.test(portalJs), false, 'Portal V97 não pode acessar Supabase diretamente.');
assert.equal(/SUPABASE/i.test(portalJs), false, 'Portal V97 não pode depender de configuração Supabase.');
assert.equal(portalJs.includes('/api/admin/'), false, 'Portal V97 não pode chamar API administrativa.');
assert.ok(portalJs.includes('/api/public/catalog'), 'Portal V97 precisa consumir a API pública oficial do catálogo.');
assert.ok(portalJs.includes('/api/public/commercial-segments'), 'Portal V97 precisa consumir segmentos pela API pública.');

assert.ok(worker.includes("const PUBLIC_PORTAL_ENTRY = '/portal/index.html'"), 'Worker sem entrypoint público V97.');
assert.ok(worker.includes("path === '/'"), 'Worker precisa rotear a raiz pública.');
assert.ok(worker.includes("path === '/catalogo'"), 'Worker precisa rotear /catalogo.');
assert.ok(worker.includes("if (['GET', 'HEAD'].includes(req.method) && isPublicPortalPath(path))"), 'Roteamento V97 deve ser somente leitura.');

const runWorkerFirst = wrangler?.assets?.run_worker_first || [];
for (const route of ['/api/*', '/', '/catalogo', '/catalogo/*']) {
  assert.ok(runWorkerFirst.includes(route), `Wrangler sem rota Worker-first obrigatória: ${route}`);
}
assert.equal(runWorkerFirst.some((route) => String(route).startsWith('/admin')), false, '/admin não pode ser interceptado pelo roteamento V97.');

// O entrypoint histórico continua sendo a aplicação administrativa/editor.
assert.ok(legacyIndex.includes('<title>ASTERYON Editor V95</title>'), 'Entrypoint administrativo original não pode ser substituído.');
assert.ok(legacyIndex.includes('/editor-runtime-v87.js?v=95'), 'Runtime do editor precisa permanecer no entrypoint administrativo existente.');
assert.ok(legacyIndex.includes('/assets/index-V60Excel.js?v=95&perf=88'), 'Bundle administrativo existente precisa permanecer intacto.');
assert.equal(legacyIndex.includes('/portal/app.js?v=97'), false, 'Entrypoint administrativo não pode carregar o portal V97.');

console.log('QA Portal Público V97: OK — frontend público isolado, zoom nativo convencional, APIs públicas somente e editor preservado.');
