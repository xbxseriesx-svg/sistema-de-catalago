import { test, expect } from '@playwright/test';

const TEMPLATE_NAMES = [
  'Varejo Contínuo', 'Atacado B2B', 'Distribuidora Institucional', 'Catálogo de Marcas B2B',
  'Distribuidora União • Figma B2B', 'Catálogo Hierárquico B2B', 'Vitrine Atacado Pro', 'Modelo Oficial',
];

const seedPage = {
  id: 'seed-page', type: 'page', name: 'TEMPLATE ANTIGA NÃO PODE APARECER', x: 0, y: 0, width: 1440, height: 1600,
  rotation: 0, zIndex: 0, visible: true, locked: false, opacity: 1, styles: { backgroundColor: '#fff' }, props: {},
  children: [{
    id: 'seed-text', type: 'text', name: 'Seed', x: 40, y: 40, width: 700, height: 50,
    rotation: 0, zIndex: 1, visible: true, locked: false, opacity: 1,
    styles: { color: '#ff0000', fontSize: 28 }, props: { text: 'TEMPLATE ANTIGA NÃO PODE APARECER' }, children: [],
  }],
};

const image = label => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="240" height="260"><rect width="240" height="260" fill="#eef4fb"/><text x="120" y="135" text-anchor="middle" font-family="Arial" font-size="24" fill="#214C8F">${label}</text></svg>`)}`;

async function installMocks(page) {
  let currentNodes = [structuredClone(seedPage)];
  const products = Array.from({ length: 8 }, (_, index) => ({
    id: `p${index + 1}`, code: `000${index + 1}`, name: `Produto QA ${index + 1}`, shortDescription: `Produto QA ${index + 1}`,
    status: 'ativo', departamentoId: 'dep-qa', secaoId: 'sec-qa', categoriaId: 'cat-qa', brandId: index % 2 ? 'brand-b' : 'brand-a',
    brandName: index % 2 ? 'Marca Beta' : 'Marca Alfa', packaging: 'CX 12', image: image(`P${index + 1}`),
  }));
  const brands = [
    { id: 'brand-a', name: 'Marca Alfa', slug: 'marca-alfa', status: 'active', logoUrl: null },
    { id: 'brand-b', name: 'Marca Beta', slug: 'marca-beta', status: 'active', logoUrl: image('BETA') },
  ];
  const hierarchy = [
    { id: 'dep-qa', level: 'departamento', name: 'QA Departamento', slug: 'qa-departamento', parentId: null, status: 'active' },
    { id: 'sec-qa', level: 'secao', name: 'QA Seção', slug: 'qa-secao', parentId: 'dep-qa', status: 'active' },
    { id: 'cat-qa', level: 'categoria', name: 'QA Categoria', slug: 'qa-categoria', parentId: 'sec-qa', status: 'active' },
  ];

  await page.route('**/api/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json; charset=utf-8', body: JSON.stringify(body) });
    if (path === '/api/auth/status') return json({ ok: true, needsBootstrap: false, user: { id: 'qa-user', companyId: 'cmp_asteryon', email: 'qa@example.invalid', name: 'QA', role: 'SDM' } });
    if (path === '/api/admin/catalog' || path === '/api/public/catalog') return json({ ok: true, catalog: { products, brands, hierarchy, promotions: [], settings: { displayFields: ['image','code','shortDescription','brand','category'] } } });
    if (path === '/api/admin/brands' || path === '/api/public/brands') return json({ ok: true, brands });
    if (path === '/api/admin/templates') return json({ ok: true, templates: TEMPLATE_NAMES.map((name, index) => ({
      id: `tpl-${index}`, systemKey: `template-${index}`, name, description: `Template QA ${index}`,
      category: 'pre-pronto', tags: ['qa'], accent: '#214C8F', nodes: [structuredClone(seedPage)], isSystem: true, version: 1,
    })) });
    if (path === '/api/admin/templates/seed') return json({ ok: true, requested: 0 });
    if (path === '/api/admin/marketing' || path === '/api/public/marketing') return json({ ok: true, marketing: {
      banner: { active: false }, videoBanner: { active: false }, carousel: { active: false, items: [] },
      theme: { mode: 'light', primary: '#214C8F', secondary: '#D13130', background: '#fff', surface: '#f4f8fc', text: '#18181b' },
    } });
    if (path === '/api/admin/pages/home/draft') {
      if (request.method() === 'PUT') currentNodes = structuredClone(request.postDataJSON().nodes || currentNodes);
      return json({ ok: true, page: { id: 'page-home', slug: 'home', title: 'Home QA', nodes: currentNodes, revision: 1, updatedAt: new Date().toISOString() } });
    }
    if (path === '/api/admin/pages/home/snapshots') return json({ ok: true, snapshots: [] });
    if (path === '/api/public/pages/home') return json({ ok: true, page: { slug: 'home', title: 'Home QA', versionId: 'qa-publication', versionNumber: 1, nodes: currentNodes } });
    return json({ ok: true });
  });
}

async function openLeft(page, testInfo) {
  if (!testInfo.project.name.includes('mobile')) return;
  const sidebar = page.locator('[data-asteryon-editor-sidebar="left"]');
  await expect(sidebar).toBeAttached();
  if (await sidebar.getAttribute('data-open') !== 'true') {
    const button = page.locator('[data-asteryon-mobile-toolbar] button[data-side="left"]');
    await expect(button).toBeVisible();
    await button.click();
    await expect(sidebar).toHaveAttribute('data-open', 'true');
  }
}

async function openModels(page, testInfo) {
  await openLeft(page, testInfo);
  await page.getByRole('button', { name: /^Modelos$/i }).first().click();
  await expect(page.getByRole('heading', { name: 'Modelos prontos' })).toBeVisible();
}

async function auditRenderedModel(page) {
  return page.locator('[data-node-id]').evaluateAll(elements => {
    const products = elements.filter(element => element.getAttribute('data-node-id')?.startsWith('product-model-'));
    const invalidGeometry = elements.filter(element => {
      const rect = element.getBoundingClientRect();
      return !Number.isFinite(rect.width) || !Number.isFinite(rect.height) || rect.width <= 0 || rect.height <= 0;
    }).map(element => element.getAttribute('data-node-id'));
    return {
      count: elements.length,
      productCount: products.length,
      invalidGeometry,
      text: elements.map(element => element.textContent || '').join('\n'),
    };
  });
}

test('todas as templates aplicam a prévia preenchida corrente no editor real', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await installMocks(page);
  const dialogs = [];
  const pageErrors = [];
  page.on('dialog', async dialog => { dialogs.push(dialog.message()); await dialog.accept(); });
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/admin', { waitUntil: 'networkidle' });

  for (const [templateIndex, templateName] of TEMPLATE_NAMES.entries()) {
    await openModels(page, testInfo);
    const article = page.locator('article').filter({ has: page.getByRole('heading', { name: templateName, exact: true }) }).first();
    await expect(article).toBeVisible();
    const applyButton = article.getByRole('button', { name: 'Aplicar modelo preenchido', exact: true });
    await expect(applyButton).toBeVisible();

    await applyButton.click();
    const preview = page.locator('#asteryon-template-preview');
    await expect(preview).toBeVisible({ timeout: 12_000 });
    await expect(preview.locator('.asteryon-template-preview-shell')).toBeVisible({ timeout: 12_000 });
    await expect(preview.getByText('Um catálogo completo para apresentar a força da Laurencini.', { exact: true })).toBeVisible();
    await expect(preview.getByText('Produto QA 1', { exact: true }).first()).toBeVisible();
    await expect(preview.getByText('Marca do catálogo', { exact: true }).first()).toBeVisible();

    await preview.getByRole('button', { name: 'Aplicar este modelo' }).click();
    await expect(preview).toBeHidden({ timeout: 12_000 });
    await expect(page.getByRole('heading', { name: 'Editor Visual ASTERYON', exact: true })).toBeAttached();
    await expect(page.locator('[data-node-id="hero-model"]').filter({ hasText: 'Um catálogo completo para apresentar a força da Laurencini.' })).toBeVisible({ timeout: 12_000 });
    await expect(page.locator('[data-node-id="product-model-0"]').filter({ hasText: 'Produto QA 1' })).toBeVisible({ timeout: 12_000 });
    await expect(page.locator('[data-node-id]').filter({ hasText: 'TEMPLATE ANTIGA NÃO PODE APARECER' })).toHaveCount(0);

    const audit = await auditRenderedModel(page);
    expect(audit.count, `${templateName}: editor precisa renderizar nós reais`).toBeGreaterThanOrEqual(3);
    expect(audit.productCount, `${templateName}: ao menos um produto precisa estar no documento`).toBeGreaterThanOrEqual(1);
    expect(audit.invalidGeometry, `${templateName}: nenhum nó pode ter geometria inválida`).toEqual([]);
    expect(audit.text).toContain('Marca do catálogo');
    expect(audit.text).toContain('Produto QA 1');

    if (templateIndex === 0) {
      const product = page.locator('[data-node-id="product-model-0"]');
      const before = await product.boundingBox();
      expect(before).not.toBeNull();
      await product.evaluate(async element => {
        const original = element.getAttribute('style');
        for (let index = 0; index < 200; index += 1) element.style.setProperty('--asteryon-stress', String(index));
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        if (original == null) element.removeAttribute('style'); else element.setAttribute('style', original);
      });
      const after = await product.boundingBox();
      expect(after).not.toBeNull();
      expect(after.width).toBeGreaterThan(0);
      expect(after.height).toBeGreaterThan(0);
      expect(pageErrors, 'stress visual não pode gerar erro JavaScript').toEqual([]);
    }
  }

  expect(dialogs.filter(message => message.includes('Modelo não aplicado')), `Bloqueios encontrados: ${dialogs.join(' | ')}`).toEqual([]);
  expect(pageErrors).toEqual([]);
});
