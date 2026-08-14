import assert from 'node:assert/strict';

const base = process.env.QA_BASE_URL || 'http://127.0.0.1:8787';
const bootstrapToken = process.env.QA_BOOTSTRAP_TOKEN || 'qa-bootstrap-token-v5';
let cookie = '';
let checks = 0;

function log(name) {
  checks++;
  console.log(`✅ ${String(checks).padStart(2, '0')} ${name}`);
}

async function request(path, init = {}, expectedStatus = 200) {
  const method = init.method || 'GET';
  const headers = new Headers(init.headers || {});
  if (cookie) headers.set('cookie', cookie);
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) headers.set('origin', base);
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  const response = await fetch(`${base}${path}`, { ...init, headers, redirect: 'manual' });
  const setCookie = response.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  const text = await response.text();
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = text; }
  assert.equal(response.status, expectedStatus, `${method} ${path}: HTTP ${response.status} != ${expectedStatus}; ${text.slice(0, 500)}`);
  if (expectedStatus >= 200 && expectedStatus < 300 && payload && typeof payload === 'object' && 'ok' in payload) {
    assert.equal(payload.ok, true, `${method} ${path}: resposta ok=false`);
  }
  return { response, payload, text };
}

async function json(path, method = 'GET', body, expectedStatus = 200) {
  return (await request(path, { method, body: body === undefined ? undefined : JSON.stringify(body) }, expectedStatus)).payload;
}

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function findPage(nodes) { return nodes.find(node => node.type === 'page') || nodes[0]; }

console.log(`QA runtime em ${base}`);

const health = await json('/api/health');
assert.equal(health.database, 'D1');
assert.equal(health.r2, false);
log('Health do Worker + D1');

let auth = await json('/api/auth/status');
assert.equal(auth.needsBootstrap, true);
assert.equal(auth.user, null);
log('Status inicial exige primeiro SDM');

const boot = await json('/api/auth/bootstrap', 'POST', {
  token: bootstrapToken,
  email: 'qa.runtime@asteryon.local',
  password: 'QaRuntime#2026!',
  name: 'SDM QA Runtime',
});
assert.equal(boot.user.role, 'SDM');
assert.ok(cookie.includes('asteryon_session'));
log('Bootstrap do SDM e cookie de sessão');

auth = await json('/api/auth/status');
assert.equal(auth.needsBootstrap, false);
assert.equal(auth.user.role, 'SDM');
log('Sessão autenticada do SDM');

const draft0 = await json('/api/admin/pages/home/draft');
assert.ok(Array.isArray(draft0.page.nodes));
assert.ok(draft0.page.revision >= 1);
log('Leitura do rascunho do editor');

const brandCreate = await json('/api/admin/brands', 'POST', {
  name: 'Marca QA Runtime', status: 'active', description: 'Marca criada pelo QA', website: 'https://example.com', sortOrder: 999, featured: true,
});
const brandId = brandCreate.brand.id;
assert.ok(brandId);
log('Criação de marca');

const brandUpdate = await json(`/api/admin/brands/${encodeURIComponent(brandId)}`, 'PUT', {
  name: 'Marca QA Runtime Atualizada', status: 'active', description: 'Marca atualizada pelo QA', website: 'https://example.com/qa', sortOrder: 998, featured: true,
});
assert.equal(brandUpdate.brand.name, 'Marca QA Runtime Atualizada');
log('Edição de marca');

const publicBrands = await json('/api/public/brands');
assert.ok(publicBrands.brands.some(b => b.id === brandId && b.name === 'Marca QA Runtime Atualizada'));
log('Marca refletida no portal público');

const sec = await json('/api/admin/hierarchy', 'POST', { level: 'secao', name: 'Seção QA Runtime', parentId: 'dep_atacado', sortOrder: 990 });
const sectionId = sec.id;
const cat = await json('/api/admin/hierarchy', 'POST', { level: 'categoria', name: 'Categoria QA Runtime', parentId: sectionId, sortOrder: 991 });
const categoryId = cat.id;
assert.ok(sectionId && categoryId);
log('Criação Seção → Categoria');

await json(`/api/admin/hierarchy/${encodeURIComponent(categoryId)}`, 'PUT', { name: 'Categoria QA Runtime Atualizada', status: 'active', sortOrder: 992 });
log('Edição de categoria');

const productCode = `QA-${Date.now()}`;
const imported = await json('/api/admin/catalog/products/bulk', 'POST', {
  products: [{
    code: productCode,
    name: 'Produto QA Runtime',
    shortDescription: 'Produto QA Runtime',
    longDescription: 'Produto criado pelo teste funcional completo',
    departamentoName: 'Atacado',
    secaoName: 'Seção QA Runtime',
    categoriaName: 'Categoria QA Runtime Atualizada',
    brandName: 'Marca QA Runtime Atualizada',
    price: 19.9,
    promoPrice: 14.9,
    stock: 25,
    unit: 'UN',
    ean: '7890000000001',
    ncm: '22021000',
    packaging: 'CX',
    status: 'ativo',
    priceMode: 'valor',
  }],
  filename: 'qa-runtime.json',
  kind: 'qa-runtime',
});
assert.equal(imported.ignored, 0);
assert.equal(imported.inserted + imported.updated, 1);
log('Importação/cadastro de produto');

let adminCatalog = await json('/api/admin/catalog');
let product = adminCatalog.catalog.products.find(p => p.code === productCode);
assert.ok(product?.id);
assert.equal(product.shortDescription || product.name, 'Produto QA Runtime');
const productId = product.id;
log('Produto persistido e recarregado do D1');

await json(`/api/admin/products/${encodeURIComponent(productId)}`, 'PUT', { status: 'inactive' });
adminCatalog = await json('/api/admin/catalog');
product = adminCatalog.catalog.products.find(p => p.id === productId);
assert.notEqual(product.status, 'ativo');
await json(`/api/admin/products/${encodeURIComponent(productId)}`, 'PUT', { status: 'active' });
adminCatalog = await json('/api/admin/catalog');
product = adminCatalog.catalog.products.find(p => p.id === productId);
assert.equal(product.status, 'ativo');
log('Inativação e reativação de produto');

const mediaBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZkXcAAAAASUVORK5CYII=';
const media = await json('/api/admin/media', 'POST', {
  filename: 'qa-runtime.png', contentType: 'image/png', dataBase64: mediaBase64, kind: 'marketing-banner', entityKey: 'qa-runtime-banner',
});
assert.ok(media.mediaKey && media.url);
const mediaResponse = await fetch(`${base}${media.url}`);
assert.equal(mediaResponse.status, 200);
assert.equal(mediaResponse.headers.get('content-type'), 'image/png');
assert.ok((await mediaResponse.arrayBuffer()).byteLength > 0);
log('Upload, armazenamento em D1 e leitura pública de mídia');

const marketing0 = await json('/api/admin/marketing');
const marketing = clone(marketing0.marketing);
marketing.theme = { ...marketing.theme, mode: 'custom', primary: '#123456', secondary: '#654321', background: '#fefefe', surface: '#f4f4f5', text: '#111111' };
marketing.banner = { ...marketing.banner, active: true, mediaType: 'image', mediaUrl: media.url, title: 'Banner QA', subtitle: 'Persistência do Marketing', link: '#catalogo' };
marketing.carousel = { ...marketing.carousel, active: true, autoplay: true, loop: true, manual: true, speed: 1.5, items: [{ id: 'qa-slide-1', url: media.url, link: '#catalogo', alt: 'Slide QA' }] };
await json('/api/admin/marketing', 'PUT', { marketing });
const marketingRead = await json('/api/admin/marketing');
assert.equal(marketingRead.marketing.theme.primary, '#123456');
assert.equal(marketingRead.marketing.carousel.items.length, 1);
assert.equal(marketingRead.marketing.carousel.items[0].url, media.url);
const publicMarketing = await json('/api/public/marketing');
assert.equal(publicMarketing.marketing.theme.primary, '#123456');
assert.equal(publicMarketing.marketing.banner.title, 'Banner QA');
assert.equal(publicMarketing.marketing.carousel.active, true);
log('Cor/tema, banner e carrossel persistidos e públicos');

await json('/api/admin/catalog/settings', 'PUT', { displayFields: ['image', 'code', 'shortDescription', 'brand', 'category', 'price', 'stock', 'ncm'] });
const publicCatalog0 = await json('/api/public/catalog');
assert.ok(publicCatalog0.catalog.settings.displayFields.includes('stock'));
assert.ok(publicCatalog0.catalog.products.some(p => p.id === productId));
log('Campos públicos do catálogo');

const offerCreate = await json('/api/admin/catalog/offers', 'POST', {
  title: 'Oferta QA Runtime', description: 'Oferta publicada pelo QA', status: 'published', productIds: [productId], featured: true,
});
const offerId = offerCreate.offer.id;
assert.ok(offerId);
await json(`/api/admin/catalog/offers/${encodeURIComponent(offerId)}`, 'PUT', {
  title: 'Oferta QA Runtime Atualizada', description: 'Oferta editada pelo QA', status: 'published', productIds: [productId], featured: true,
});
const offers = await json('/api/admin/catalog/offers');
assert.ok(offers.offers.some(o => o.id === offerId && o.title === 'Oferta QA Runtime Atualizada'));
const publicCatalog1 = await json('/api/public/catalog');
assert.ok(publicCatalog1.catalog.promotions.some(o => o.id === offerId && o.productIds.includes(productId)));
log('Criação, edição e publicação de oferta');

const templateKey = `qa-runtime-${Date.now()}`;
await json('/api/admin/templates/seed', 'POST', { templates: [{
  systemKey: templateKey,
  name: 'Modelo QA Runtime',
  description: 'Modelo de integração',
  category: 'qa',
  tags: ['qa', 'runtime'],
  accent: '#123456',
  nodes: draft0.page.nodes,
}] });
let templates = await json('/api/admin/templates');
let template = templates.templates.find(t => t.systemKey === templateKey);
assert.ok(template?.id);
await json(`/api/admin/templates/${encodeURIComponent(template.id)}`, 'PUT', { name: 'Modelo QA Runtime Atualizado', description: 'Atualizado', nodes: draft0.page.nodes });
templates = await json('/api/admin/templates');
template = templates.templates.find(t => t.id === template.id);
assert.equal(template.name, 'Modelo QA Runtime Atualizado');
assert.ok(template.version >= 2);
log('Seed, leitura e edição de modelo');

const nodesA = clone(draft0.page.nodes);
const pageA = findPage(nodesA);
pageA.props = { ...(pageA.props || {}), qaRuntimeMarker: 'versao-A' };
pageA.styles = { ...(pageA.styles || {}), backgroundColor: '#abcdef' };
const savedA = await json('/api/admin/pages/home/draft', 'PUT', { nodes: nodesA, expectedRevision: draft0.page.revision });
assert.ok(savedA.revision > draft0.page.revision);
log('Salvar rascunho com revisão otimista');

await json('/api/admin/pages/home/draft', 'PUT', { nodes: nodesA, expectedRevision: draft0.page.revision }, 409);
log('Conflito de revisão protegido pelo Worker');

const snapshot = await json('/api/admin/pages/home/snapshots', 'POST', { nodes: nodesA, label: 'Snapshot QA Runtime' });
assert.ok(snapshot.snapshot.id);
const snapshots = await json('/api/admin/pages/home/snapshots');
assert.ok(snapshots.snapshots.some(s => s.id === snapshot.snapshot.id));
log('Criação e leitura de snapshot');

const publication = await json('/api/admin/pages/home/publish', 'POST', {});
assert.ok(publication.publication.versionId);
const publicPage = await json('/api/public/pages/home');
assert.equal(findPage(publicPage.page.nodes).props.qaRuntimeMarker, 'versao-A');
log('Publicação do rascunho e leitura pública');

const versions = await json('/api/admin/pages/home/versions');
assert.ok(versions.versions.some(v => v.id === publication.publication.versionId));
log('Histórico de versões publicadas');

const draftAfterPublish = await json('/api/admin/pages/home/draft');
const nodesB = clone(draftAfterPublish.page.nodes);
findPage(nodesB).props = { ...(findPage(nodesB).props || {}), qaRuntimeMarker: 'versao-B' };
await json('/api/admin/pages/home/draft', 'PUT', { nodes: nodesB, expectedRevision: draftAfterPublish.page.revision });
await json(`/api/admin/pages/home/rollback/${encodeURIComponent(publication.publication.versionId)}`, 'POST', {});
const restoredDraft = await json('/api/admin/pages/home/draft');
assert.equal(findPage(restoredDraft.page.nodes).props.qaRuntimeMarker, 'versao-A');
log('Restauração/rollback de versão para o rascunho');

await json(`/api/admin/templates/${encodeURIComponent(template.id)}`, 'DELETE');
templates = await json('/api/admin/templates');
assert.ok(!templates.templates.some(t => t.id === template.id));
log('Exclusão lógica de modelo');

await json(`/api/admin/catalog/offers/${encodeURIComponent(offerId)}`, 'DELETE');
const offersAfterDelete = await json('/api/admin/catalog/offers');
assert.ok(!offersAfterDelete.offers.some(o => o.id === offerId));
log('Exclusão de oferta');

const resetMarketing = clone(marketing0.marketing);
await json('/api/admin/marketing', 'PUT', { marketing: resetMarketing });
await json(`/api/admin/media/${encodeURIComponent(media.mediaKey)}`, 'DELETE');
await request(media.url, {}, 404);
log('Exclusão de mídia após desvincular do Marketing');

await json(`/api/admin/products/${encodeURIComponent(productId)}`, 'DELETE');
adminCatalog = await json('/api/admin/catalog');
assert.ok(!adminCatalog.catalog.products.some(p => p.id === productId));
log('Exclusão de produto');

await json(`/api/admin/hierarchy/${encodeURIComponent(categoryId)}`, 'DELETE');
await json(`/api/admin/hierarchy/${encodeURIComponent(sectionId)}`, 'DELETE');
log('Exclusão de categoria e seção vazias');

await json(`/api/admin/brands/${encodeURIComponent(brandId)}`, 'DELETE');
const brandsAfterDelete = await json('/api/admin/brands');
assert.ok(!brandsAfterDelete.brands.some(b => b.id === brandId));
log('Exclusão de marca');

await json('/api/auth/logout', 'POST', {});
cookie = '';
auth = await json('/api/auth/status');
assert.equal(auth.user, null);
await request('/api/admin/catalog', {}, 401);
log('Logout e bloqueio de rota administrativa sem sessão');

console.log(`\n🎯 QA runtime concluído: ${checks} verificações de integração passaram.`);
