import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const portalHtml = read('public/portal/index.html');
const portalCss = read('public/portal/styles.css');
const bridgeCss = read('public/portal/editor-publication-bridge.css');
const popupCss = read('public/portal/popup-controller.css');
const functionalCss = read('public/portal/editor-functional-publication.css');
const portalJs = read('public/portal/app.js');
const bridgeJs = read('public/portal/editor-publication-bridge.js');
const popupJs = read('public/portal/popup-controller.js');
const functionalJs = read('public/portal/editor-functional-publication.js');
const legacyIndex = read('public/index.html');
const worker = read('worker/app/index.ts');
const wrangler = JSON.parse(read('wrangler.jsonc'));

for (const asset of [
  '/portal/styles.css?v=97',
  '/portal/editor-publication-bridge.css?v=97',
  '/portal/popup-controller.css?v=97',
  '/portal/editor-functional-publication.css?v=97',
  '/portal/app.js?v=97',
  '/portal/editor-publication-bridge.js?v=97',
  '/portal/popup-controller.js?v=97',
  '/portal/editor-functional-publication.js?v=97',
]) {
  assert.ok(portalHtml.includes(asset), `Portal V97 sem asset obrigatório: ${asset}`);
}

assert.ok(portalHtml.indexOf('/portal/editor-publication-bridge.js?v=97') > portalHtml.indexOf('/portal/app.js?v=97'), 'Ponte do editor deve carregar depois do runtime público V97.');
assert.ok(portalHtml.indexOf('/portal/popup-controller.js?v=97') > portalHtml.indexOf('/portal/editor-publication-bridge.js?v=97'), 'Controlador de popup deve carregar após a ponte básica.');
assert.ok(portalHtml.indexOf('/portal/editor-functional-publication.js?v=97') > portalHtml.indexOf('/portal/popup-controller.js?v=97'), 'Publicação funcional deve carregar após o controlador de popup.');
assert.ok(portalHtml.includes('width=device-width, initial-scale=1.0'), 'Viewport V97 precisa iniciar em 100%.');
assert.ok(portalHtml.includes('user-scalable=yes'), 'Zoom nativo precisa permanecer habilitado.');
assert.ok(portalHtml.includes('maximum-scale=5.0'), 'Zoom nativo precisa permitir ampliação real.');

for (const forbidden of [
  'responsive-v67', 'responsive-auto-v95', 'preview-editor', 'editor-runtime',
  'runtime-loader', 'system-runtime', 'commercial-segments-destination', '/assets/index-',
]) {
  assert.equal(portalHtml.includes(forbidden), false, `Portal V97 não pode carregar runtime legado/editor: ${forbidden}`);
}

const executable = `${portalCss}\n${bridgeCss}\n${popupCss}\n${functionalCss}\n${portalJs}\n${bridgeJs}\n${popupJs}\n${functionalJs}`;
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
assert.ok(bridgeCss.includes('@media (max-width: 74.9375rem)'), 'Ponte precisa limitar tipografia publicada no tablet.');
assert.ok(bridgeCss.includes('@media (max-width: 47.9375rem)'), 'Ponte precisa limitar tipografia publicada no celular.');
assert.ok(popupCss.includes('.portal-popup-panel'), 'Popup público sem painel responsivo.');
assert.ok(popupCss.includes('body.portal-popup-open #product-modal:not([hidden])'), 'Modal de produto precisa ficar acima do popup de seção.');
assert.ok(functionalCss.includes('.editor-functional-carousel'), 'CSS da publicação funcional sem carrossel.');
assert.ok(functionalCss.includes('.editor-functional-gallery'), 'CSS da publicação funcional sem galeria.');

for (const source of [portalJs, bridgeJs, popupJs, functionalJs]) {
  assert.equal(/supabase\.co/i.test(source), false, 'Portal V97 não pode acessar Supabase diretamente.');
  assert.equal(/SUPABASE/i.test(source), false, 'Portal V97 não pode depender de configuração Supabase.');
  assert.equal(source.includes('/api/admin/'), false, 'Portal V97 não pode chamar API administrativa.');
}
assert.ok(portalJs.includes('/api/public/catalog'), 'Portal V97 precisa consumir a API pública oficial do catálogo.');
assert.ok(portalJs.includes('/api/public/commercial-segments'), 'Portal V97 precisa consumir segmentos pela API pública.');
assert.ok(bridgeJs.includes("const PAGE_SLUG = 'home'"), 'Ponte pública precisa acompanhar a página home usada pelo editor.');
assert.ok(bridgeJs.includes('/api/public/pages/${PAGE_SLUG}'), 'Ponte pública precisa ler apenas a publicação pública da página home.');
assert.ok(bridgeJs.includes("cache: 'no-store'"), 'Publicação deve ser consultada sem cache para refletir a última versão publicada.');
assert.ok(bridgeJs.includes("dataset.editorPublication = 'applied'"), 'Ponte pública precisa expor diagnóstico de publicação aplicada.');
assert.ok(bridgeJs.includes('editorPublicationRevision'), 'Ponte pública precisa expor a revisão publicada aplicada.');

assert.ok(popupJs.includes("const SECTION_IDS = new Set(['segmentos', 'departamentos', 'marcas', 'produtos', 'contato'])"), 'Popup precisa cobrir todas as áreas públicas navegáveis.');
assert.ok(popupJs.includes('Element.prototype.scrollIntoView'), 'Chamadas internas de rolagem precisam ser convertidas em popup.');
assert.ok(popupJs.includes("document.documentElement.dataset.portalPopupController = 'ready'"), 'Popup precisa expor diagnóstico de prontidão.');
assert.ok(popupJs.includes('state.body.replaceChildren(target)'), 'Popup deve mover o bloco real para preservar os eventos funcionais.');
assert.equal(/window\.scrollTo\s*\(/.test(popupJs), false, 'Popup não pode rolar programaticamente para o final da página.');
assert.equal(/location\.(?:assign|replace)\s*\(/.test(popupJs), false, 'Navegação pública interna não pode trocar de página em vez de abrir popup.');

assert.ok(functionalJs.includes("const ENDPOINT = '/api/public/pages/home'"), 'Componentes funcionais devem vir da publicação home.');
assert.ok(functionalJs.includes("cache: 'no-store'"), 'Componentes funcionais precisam acompanhar a revisão publicada sem cache.');
for (const type of ['gallery', 'video', 'banner', 'carousel', 'promotion', 'html', 'embed']) {
  assert.ok(functionalJs.includes(`'${type}'`), `Publicação funcional sem suporte ao tipo ${type}.`);
}
assert.ok(functionalJs.includes("dataset.editorFunctionalPublication = 'applied'"), 'Publicação funcional precisa expor diagnóstico.');
assert.ok(functionalJs.includes("querySelectorAll('script,style,iframe,object,embed,form,meta,link,base')"), 'HTML publicado precisa remover conteúdo ativo perigoso.');
assert.ok(functionalJs.includes("name.startsWith('on')"), 'HTML publicado precisa remover handlers inline.');
assert.ok(functionalJs.includes("window.dispatchEvent(new CustomEvent('asteryon:open-public-popup'"), 'Ações funcionais publicadas precisam usar o popup público.');

assert.ok(worker.includes("const PUBLIC_PORTAL_ENTRY = '/portal/index.html'"), 'Worker sem entrypoint público V97.');
assert.ok(worker.includes("path === '/'"), 'Worker precisa rotear a raiz pública.');
assert.ok(worker.includes("path === '/catalogo'"), 'Worker precisa rotear /catalogo.');
assert.ok(worker.includes("if (['GET', 'HEAD'].includes(req.method) && isPublicPortalPath(path))"), 'Roteamento V97 deve ser somente leitura.');

const runWorkerFirst = wrangler?.assets?.run_worker_first || [];
for (const route of ['/api/*', '/', '/catalogo', '/catalogo/*']) {
  assert.ok(runWorkerFirst.includes(route), `Wrangler sem rota Worker-first obrigatória: ${route}`);
}
assert.equal(runWorkerFirst.some((route) => String(route).startsWith('/admin')), false, '/admin não pode ser interceptado pelo roteamento V97.');

assert.ok(legacyIndex.includes('<title>ASTERYON Editor V95</title>'), 'Entrypoint administrativo original não pode ser substituído.');
assert.ok(legacyIndex.includes('/editor-runtime-v87.js?v=95'), 'Runtime do editor precisa permanecer no entrypoint administrativo existente.');
assert.ok(legacyIndex.includes('/assets/index-V60Excel.js?v=95&perf=88'), 'Bundle administrativo existente precisa permanecer intacto.');
for (const asset of [
  '/portal/app.js?v=97',
  '/portal/editor-publication-bridge.js?v=97',
  '/portal/popup-controller.js?v=97',
  '/portal/editor-functional-publication.js?v=97',
]) {
  assert.equal(legacyIndex.includes(asset), false, `Editor administrativo não pode carregar asset público: ${asset}`);
}

console.log('QA Portal Público: OK — V97 isolada, navegação em popup, publicação funcional home e zoom nativo preservados.');
