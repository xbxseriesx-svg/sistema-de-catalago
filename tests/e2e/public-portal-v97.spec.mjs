import { test, expect } from '@playwright/test';

const catalogFixture = {
  catalog: {
    products: [
      { id: 'p1', code: '1001', ean: '789000000001', name: 'Produto Alpha', brandId: 'b1', departamentoId: 'd1', categoriaId: 'c1', packaging: 'CX', unit: 'UN', ncm: '10000000', imageUrl: null, tags: ['alpha'] },
      { id: 'p2', code: '1002', ean: '789000000002', name: 'Produto Beta', brandId: 'b2', departamentoId: 'd1', categoriaId: 'c2', packaging: 'FD', unit: 'UN', ncm: '20000000', imageUrl: null, tags: ['beta'] },
      { id: 'p3', code: '1003', ean: '789000000003', name: 'Produto Gama', brandId: 'b1', departamentoId: 'd2', categoriaId: 'c2', packaging: 'CX', unit: 'KG', ncm: '30000000', imageUrl: null, tags: ['gama'] },
      { id: 'p4', code: '1004', ean: '789000000004', name: 'Produto Delta', brandId: 'b2', departamentoId: 'd2', categoriaId: 'c1', packaging: 'PCT', unit: 'UN', ncm: '40000000', imageUrl: null, tags: ['delta'] },
    ],
    brands: [
      { id: 'b1', name: 'Marca Um', status: 'active', featured: true, sortOrder: 1, logoUrl: null },
      { id: 'b2', name: 'Marca Dois', status: 'active', featured: false, sortOrder: 2, logoUrl: null },
    ],
    hierarchy: [
      { id: 'd1', name: 'Departamento A', level: 'departamento', sortOrder: 1 },
      { id: 'd2', name: 'Departamento B', level: 'departamento', sortOrder: 2 },
      { id: 'c1', name: 'Categoria A', level: 'categoria', parentId: 'd1', sortOrder: 1 },
      { id: 'c2', name: 'Categoria B', level: 'categoria', parentId: 'd2', sortOrder: 2 },
    ],
    promotions: [],
  },
};

const segmentsFixture = {
  segments: [
    { id: 's1', name: 'Mercados & Supermercados', sortOrder: 1 },
    { id: 's2', name: 'Padarias & Confeitarias', sortOrder: 2 },
  ],
};

async function mockPublicApis(page) {
  await page.route('**/api/public/catalog', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json; charset=utf-8',
    body: JSON.stringify(catalogFixture),
  }));
  await page.route('**/api/public/commercial-segments', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json; charset=utf-8',
    body: JSON.stringify(segmentsFixture),
  }));
  await page.route('**/api/public/commercial-segments/*/products?*', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json; charset=utf-8',
    body: JSON.stringify({ products: catalogFixture.catalog.products.slice(0, 2), offset: 0, limit: 500, hasMore: false }),
  }));
}

async function portalMetrics(page) {
  return page.evaluate(() => {
    const title = document.querySelector('.hero h1');
    const container = document.querySelector('.hero .container');
    return {
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      titleFont: title ? Number.parseFloat(getComputedStyle(title).fontSize) : 0,
      titleTransform: title ? getComputedStyle(title).transform : '',
      containerWidth: container?.getBoundingClientRect().width || 0,
      scripts: [...document.scripts].map((script) => script.getAttribute('src') || ''),
      styles: [...document.querySelectorAll('link[rel="stylesheet"]')].map((link) => link.getAttribute('href') || ''),
    };
  });
}

test.beforeEach(async ({ page }) => {
  await mockPublicApis(page);
});

test('V97 serve portal público independente sem carregar runtimes do editor', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.portalReady)).toBe('true');
  await expect(page.locator('#hero-title')).toContainText('Um catálogo completo');
  await expect(page.locator('.segment-card')).toHaveCount(2);
  await expect(page.locator('.product-card')).toHaveCount(4);

  const metrics = await portalMetrics(page);
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
  expect(metrics.containerWidth).toBeLessThanOrEqual(1360.5);
  expect(metrics.titleTransform).toBe('none');
  expect(metrics.scripts).toEqual(['/portal/app.js?v=97']);
  expect(metrics.styles).toEqual(['/portal/styles.css?v=97']);
  expect(metrics.scripts.join(' ')).not.toMatch(/editor|preview|responsive-v67|runtime-loader/i);
});

test('V97 mantém tipografia CSS estável em larguras equivalentes a zoom do navegador', async ({ page }) => {
  const widths = [1498, 1872, 2340];
  const samples = [];

  for (const width of widths) {
    await page.setViewportSize({ width, height: 1026 });
    if (!samples.length) {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await expect.poll(() => page.evaluate(() => document.documentElement.dataset.portalReady)).toBe('true');
    }
    samples.push(await portalMetrics(page));
  }

  for (const sample of samples) {
    expect(sample.scrollWidth).toBeLessThanOrEqual(sample.clientWidth + 1);
    expect(sample.containerWidth).toBeLessThanOrEqual(1360.5);
    expect(sample.titleTransform).toBe('none');
  }

  expect(samples[0].titleFont).toBeGreaterThan(50);
  expect(Math.abs(samples[0].titleFont - samples[1].titleFont)).toBeLessThan(0.1);
  expect(Math.abs(samples[1].titleFont - samples[2].titleFont)).toBeLessThan(0.1);
});

test('V97 reflowa tablet e celular sem miniaturizar desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto('/catalogo', { waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.portalReady)).toBe('true');
  let metrics = await portalMetrics(page);
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
  expect(metrics.titleFont).toBeLessThanOrEqual(43);

  await page.setViewportSize({ width: 390, height: 844 });
  metrics = await portalMetrics(page);
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
  expect(metrics.titleFont).toBeLessThanOrEqual(32.1);
  await expect(page.locator('.nav-toggle')).toBeVisible();
  await page.locator('.nav-toggle').click();
  await expect(page.locator('#main-nav')).toHaveAttribute('data-open', 'true');

  await page.locator('#catalog-search').fill('Beta');
  await page.locator('#search-button').click();
  await expect(page.locator('.product-card')).toHaveCount(1);
  await expect(page.locator('.product-card h3')).toHaveText('Produto Beta');
});

test('V97 mantém filtro de segmento e modal de produto funcionais', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.portalReady)).toBe('true');

  await page.locator('[data-segment-id="s1"]').click();
  await expect(page.locator('.product-card')).toHaveCount(2);
  await expect(page.locator('#results-label')).toContainText('Mercados & Supermercados');

  await page.locator('[data-product-id="p1"]').click();
  await expect(page.locator('#product-modal')).toBeVisible();
  await expect(page.locator('#product-modal-title')).toHaveText('Produto Alpha');
  await page.locator('.modal-close').click();
  await expect(page.locator('#product-modal')).toBeHidden();
});
