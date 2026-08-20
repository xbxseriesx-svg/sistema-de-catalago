import { test, expect } from '@playwright/test';

const email = String(process.env.QA_E2E_EMAIL || '').trim();
const password = String(process.env.QA_E2E_PASSWORD || '');
const expectedCompany = 'qa_e2e_asteryon';
const pageSlug = 'qa-e2e-page-lifecycle';

if (!email) throw new Error('QA_E2E_EMAIL ausente');
if (!password) throw new Error('QA_E2E_PASSWORD ausente');

async function api(page, path, init = {}) {
  return page.evaluate(async ({ path, init }) => {
    const response = await fetch(path, init);
    let payload = null;
    try { payload = await response.json(); } catch { payload = null; }
    return { status: response.status, payload };
  }, { path, init });
}

async function jsonApi(page, path, method, body) {
  return api(page, path, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function expectOk(result, status = 200) {
  expect(result.status).toBe(status);
  expect(result.payload?.ok).toBe(true);
}

async function bestEffort(page, path, method = 'DELETE', body) {
  try { await jsonApi(page, path, method, body); } catch { /* limpeza final independente no Supabase */ }
}

test('CRUD real QA: produto + estrutura + oferta + Marketing + página + limpeza', async ({ page }) => {
  const stamp = Date.now();
  const code = `0000${stamp}`;
  const departmentName = `QA_E2E Departamento ${stamp}`;
  const sectionName = `QA_E2E Secao ${stamp}`;
  const categoryName = `QA_E2E Categoria ${stamp}`;
  const brandName = `QA_E2E Marca ${stamp}`;
  const productNameA = `QA_E2E Produto A ${stamp}`;
  const productNameB = `QA_E2E Produto B ${stamp}`;
  const offerTitleA = `QA_E2E Oferta A ${stamp}`;
  const offerTitleB = `QA_E2E Oferta B ${stamp}`;
  const marketingMarker = `QA_E2E Marketing ${stamp}`;

  let productId = null;
  let brandId = null;
  let departmentId = null;
  let sectionId = null;
  let categoryId = null;
  let offerId = null;
  let originalMarketing = null;

  await page.goto('/auth/redefinir-senha.html');

  const login = await jsonApi(page, '/api/auth/login', 'POST', { email, password });
  expectOk(login);
  expect(login.payload?.user?.companyId).toBe(expectedCompany);
  expect(login.payload?.user?.email).toBe(email);
  expect(['ADMIN', 'SDM']).toContain(login.payload?.user?.role);

  try {
    // 1) Produto via fluxo real de importação em massa: cria também departamento/seção/categoria/marca.
    const imported = await jsonApi(page, '/api/admin/catalog/products/bulk', 'POST', {
      filename: `QA_E2E_${stamp}.xlsx`,
      products: [{
        code,
        name: productNameA,
        departamentoName: departmentName,
        secaoName: sectionName,
        categoriaName: categoryName,
        brandName,
        status: 'active',
        price: 10.5,
        unit: 'UN',
      }],
    });
    expectOk(imported);
    expect(imported.payload?.inserted).toBe(1);
    expect(imported.payload?.updated).toBe(0);
    expect(imported.payload?.ignored).toBe(0);

    let catalog = await api(page, '/api/admin/catalog');
    expectOk(catalog);
    let product = catalog.payload.catalog.products.find(item => item.code === code);
    expect(product).toBeTruthy();
    expect(product.code).toBe(code);
    expect(product.name).toBe(productNameA);
    productId = product.id;

    const brand = catalog.payload.catalog.brands.find(item => item.name === brandName);
    const department = catalog.payload.catalog.hierarchy.find(item => item.name === departmentName && item.level === 'departamento');
    const section = catalog.payload.catalog.hierarchy.find(item => item.name === sectionName && item.level === 'secao');
    const category = catalog.payload.catalog.hierarchy.find(item => item.name === categoryName && item.level === 'categoria');
    expect(brand).toBeTruthy();
    expect(department).toBeTruthy();
    expect(section).toBeTruthy();
    expect(category).toBeTruthy();
    brandId = brand.id;
    departmentId = department.id;
    sectionId = section.id;
    categoryId = category.id;
    expect(section.parentId).toBe(departmentId);
    expect(category.parentId).toBe(sectionId);

    // 2) Reimportação do mesmo código precisa atualizar, não duplicar, preservando zero à esquerda.
    const updatedImport = await jsonApi(page, '/api/admin/catalog/products/bulk', 'POST', {
      filename: `QA_E2E_UPDATE_${stamp}.xlsx`,
      products: [{
        code,
        name: productNameB,
        departamentoName: departmentName,
        secaoName: sectionName,
        categoriaName: categoryName,
        brandName,
        status: 'active',
        price: 11.75,
        unit: 'UN',
      }],
    });
    expectOk(updatedImport);
    expect(updatedImport.payload?.inserted).toBe(0);
    expect(updatedImport.payload?.updated).toBe(1);

    catalog = await api(page, '/api/admin/catalog');
    expectOk(catalog);
    const matchingProducts = catalog.payload.catalog.products.filter(item => item.code === code);
    expect(matchingProducts).toHaveLength(1);
    product = matchingProducts[0];
    expect(product.code).toBe(code);
    expect(product.name).toBe(productNameB);

    // 3) Oferta: criar -> ler -> editar -> reler.
    const createdOffer = await jsonApi(page, '/api/admin/catalog/offers', 'POST', {
      title: offerTitleA,
      description: 'QA E2E lifecycle',
      status: 'draft',
      featured: true,
      productIds: [productId],
    });
    expectOk(createdOffer);
    offerId = createdOffer.payload.offer.id;
    expect(createdOffer.payload.offer.productIds).toEqual([productId]);

    let offers = await api(page, '/api/admin/catalog/offers');
    expectOk(offers);
    let offer = offers.payload.offers.find(item => item.id === offerId);
    expect(offer).toBeTruthy();
    expect(offer.title).toBe(offerTitleA);
    expect(offer.productIds).toEqual([productId]);

    const updatedOffer = await jsonApi(page, `/api/admin/catalog/offers/${encodeURIComponent(offerId)}`, 'PUT', {
      title: offerTitleB,
      description: 'QA E2E lifecycle atualizado',
      status: 'published',
      featured: false,
      productIds: [productId],
    });
    expectOk(updatedOffer);

    offers = await api(page, '/api/admin/catalog/offers');
    expectOk(offers);
    offer = offers.payload.offers.find(item => item.id === offerId);
    expect(offer.title).toBe(offerTitleB);
    expect(offer.status).toBe('published');
    expect(offer.productIds).toEqual([productId]);

    // 4) Marketing: preservar baseline, alterar geometria/conteúdo, reler e restaurar.
    const marketingBefore = await api(page, '/api/admin/marketing');
    expectOk(marketingBefore);
    originalMarketing = structuredClone(marketingBefore.payload.marketing);
    const changedMarketing = {
      ...originalMarketing,
      banner: { ...(originalMarketing.banner || {}), title: marketingMarker },
      layout: { ...(originalMarketing.layout || {}), x: 37, y: 41, width: 1200, height: 420, zIndex: 711, visible: true },
    };
    const marketingWrite = await jsonApi(page, '/api/admin/marketing', 'PUT', { marketing: changedMarketing });
    expectOk(marketingWrite);

    const marketingAfter = await api(page, '/api/admin/marketing');
    expectOk(marketingAfter);
    expect(marketingAfter.payload.marketing.banner?.title).toBe(marketingMarker);
    expect(marketingAfter.payload.marketing.layout).toMatchObject({ x: 37, y: 41, width: 1200, height: 420, zIndex: 711, visible: true });

    const marketingRestore = await jsonApi(page, '/api/admin/marketing', 'PUT', { marketing: originalMarketing });
    expectOk(marketingRestore);
    const marketingRestored = await api(page, '/api/admin/marketing');
    expectOk(marketingRestored);
    expect(marketingRestored.payload.marketing.banner).toEqual(originalMarketing.banner);
    expect(marketingRestored.payload.marketing.layout).toEqual(originalMarketing.layout);
    originalMarketing = null;

    // 5) Página: draft persistido + conflito 409 + snapshot + publicação + rollback sem republicação automática.
    const draftBefore = await api(page, `/api/admin/pages/${pageSlug}/draft`);
    expectOk(draftBefore);
    const initialRevision = draftBefore.payload.page.revision;
    const nodesA = [{ id: `qa-a-${stamp}`, type: 'text', content: `QA_E2E_A_${stamp}` }];
    const nodesB = [{ id: `qa-b-${stamp}`, type: 'text', content: `QA_E2E_B_${stamp}` }];

    const saveA = await jsonApi(page, `/api/admin/pages/${pageSlug}/draft`, 'PUT', { nodes: nodesA, expectedRevision: initialRevision });
    expectOk(saveA);
    const revisionA = saveA.payload.revision;
    expect(revisionA).toBe(initialRevision + 1);

    const draftA = await api(page, `/api/admin/pages/${pageSlug}/draft`);
    expectOk(draftA);
    expect(draftA.payload.page.nodes).toEqual(nodesA);
    expect(draftA.payload.page.revision).toBe(revisionA);

    const conflict = await jsonApi(page, `/api/admin/pages/${pageSlug}/draft`, 'PUT', { nodes: nodesB, expectedRevision: initialRevision });
    expect(conflict.status).toBe(409);
    expect(conflict.payload?.ok).toBe(false);
    expect(conflict.payload?.error?.code).toBe('REVISION_CONFLICT');

    const snapshot = await jsonApi(page, `/api/admin/pages/${pageSlug}/snapshots`, 'POST', { label: `QA_E2E_${stamp}`, nodes: nodesA });
    expectOk(snapshot);
    expect(snapshot.payload.snapshot?.id).toBeTruthy();

    const published = await jsonApi(page, `/api/admin/pages/${pageSlug}/publish`, 'POST', {});
    expectOk(published);
    const publicationId = published.payload.publication?.versionId;
    expect(publicationId).toBeTruthy();

    const publicA = await api(page, `/api/public/pages/${pageSlug}`);
    expectOk(publicA);
    expect(publicA.payload.page.nodes).toEqual(nodesA);

    const saveB = await jsonApi(page, `/api/admin/pages/${pageSlug}/draft`, 'PUT', { nodes: nodesB, expectedRevision: revisionA });
    expectOk(saveB);
    const draftB = await api(page, `/api/admin/pages/${pageSlug}/draft`);
    expectOk(draftB);
    expect(draftB.payload.page.nodes).toEqual(nodesB);

    const publicStillA = await api(page, `/api/public/pages/${pageSlug}`);
    expectOk(publicStillA);
    expect(publicStillA.payload.page.nodes).toEqual(nodesA);

    const rollback = await jsonApi(page, `/api/admin/pages/${pageSlug}/rollback/${encodeURIComponent(publicationId)}`, 'POST', {});
    expectOk(rollback);
    const restoredDraft = await api(page, `/api/admin/pages/${pageSlug}/draft`);
    expectOk(restoredDraft);
    expect(restoredDraft.payload.page.nodes).toEqual(nodesA);

    const publicAfterRollback = await api(page, `/api/public/pages/${pageSlug}`);
    expectOk(publicAfterRollback);
    expect(publicAfterRollback.payload.page.nodes).toEqual(nodesA);

    // 6) Permissão real: ADMIN não pode administrar templates globais reservados ao SDM.
    const templateSeedForbidden = await jsonApi(page, '/api/admin/templates/seed', 'POST', { templates: [] });
    expect(templateSeedForbidden.status).toBe(403);
    expect(templateSeedForbidden.payload?.error?.code).toBe('SDM_ONLY');
  } finally {
    if (originalMarketing) await bestEffort(page, '/api/admin/marketing', 'PUT', { marketing: originalMarketing });
    if (offerId) await bestEffort(page, `/api/admin/catalog/offers/${encodeURIComponent(offerId)}`);
    if (productId) await bestEffort(page, `/api/admin/products/${encodeURIComponent(productId)}`);

    // Reconsultar para recuperar IDs caso a falha tenha ocorrido antes da captura local.
    try {
      const catalog = await api(page, '/api/admin/catalog');
      const products = catalog.payload?.catalog?.products || [];
      const brands = catalog.payload?.catalog?.brands || [];
      const hierarchy = catalog.payload?.catalog?.hierarchy || [];
      const product = products.find(item => item.code === code);
      if (product) await bestEffort(page, `/api/admin/products/${encodeURIComponent(product.id)}`);
      brandId ||= brands.find(item => item.name === brandName)?.id || null;
      departmentId ||= hierarchy.find(item => item.name === departmentName && item.level === 'departamento')?.id || null;
      sectionId ||= hierarchy.find(item => item.name === sectionName && item.level === 'secao')?.id || null;
      categoryId ||= hierarchy.find(item => item.name === categoryName && item.level === 'categoria')?.id || null;
    } catch { /* limpeza independente no Supabase */ }

    if (categoryId) await bestEffort(page, `/api/admin/hierarchy/${encodeURIComponent(categoryId)}`);
    if (sectionId) await bestEffort(page, `/api/admin/hierarchy/${encodeURIComponent(sectionId)}`);
    if (departmentId) await bestEffort(page, `/api/admin/hierarchy/${encodeURIComponent(departmentId)}`);
    if (brandId) await bestEffort(page, `/api/admin/brands/${encodeURIComponent(brandId)}`);

    await bestEffort(page, '/api/auth/logout', 'POST', {});
  }
});
