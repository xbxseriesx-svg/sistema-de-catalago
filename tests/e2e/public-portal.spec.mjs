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

const textNode = (id, text, tag, styles = {}, extraProps = {}) => ({
  id,
  type: 'text',
  name: `${tag} • ${text}`,
  x: 0,
  y: 0,
  width: 400,
  height: 40,
  visible: true,
  opacity: 1,
  styles,
  props: { text, previewDomTag: tag, ...extraProps },
  children: [],
});

const section = (id, name, y, eyebrow, heading, body, { className = 'ltp-section', visible = true, styles = {} } = {}) => ({
  id,
  type: 'group',
  name,
  x: 0,
  y,
  width: 1440,
  height: 500,
  visible,
  opacity: 1,
  styles,
  props: { previewClassName: className },
  children: [
    { ...textNode(`${id}-eyebrow`, eyebrow, 'p', { fontSize: 12, color: '#d92d4b', fontWeight: 800 }), props: { text: eyebrow, previewDomTag: 'p', previewClassName: 'ltp-eyebrow' } },
    textNode(`${id}-heading`, heading, 'h2', { fontSize: 30, color: '#102a59', fontWeight: 700 }),
    textNode(`${id}-body`, body, 'p', { fontSize: 16, color: '#62708a' }),
  ],
});

const publishedPageFixture = {
  page: {
    slug: 'home',
    title: 'Página Inicial',
    versionId: 'ver-e2e-91',
    versionNumber: 91,
    publishedAt: '2026-08-25T12:30:00.000Z',
    nodes: [{
      id: 'root',
      type: 'page',
      name: 'Página publicada',
      x: 0,
      y: 0,
      width: 1440,
      height: 4800,
      visible: true,
      opacity: 1,
      styles: { backgroundColor: '#ffffff' },
      props: {},
      children: [
        {
          id: 'header', type: 'group', name: 'ltp-site-header • Publicado', x: 0, y: 0, width: 1440, height: 275,
          visible: true, opacity: 1, styles: { backgroundColor: '#ffffff' }, props: { previewClassName: 'ltp-site-header' },
          children: [
            { ...textNode('topline', 'Catálogo institucional publicado', 'div', { backgroundColor: '#173a78', color: '#ffffff' }), props: { text: 'Catálogo institucional publicado', previewDomTag: 'div', previewClassName: 'ltp-topline' } },
            {
              id: 'nav', type: 'group', name: 'ltp-navlinks', x: 0, y: 40, width: 800, height: 40, visible: true, opacity: 1,
              styles: {}, props: { previewClassName: 'ltp-navlinks' }, children: [
                textNode('nav-1', 'Início', 'span', { fontSize: 12 }, { actionType: 'home' }),
                textNode('nav-2', 'Catálogo', 'span', { fontSize: 12 }, { actionType: 'catalog-modal' }),
                textNode('nav-3', 'Departamentos', 'span', { fontSize: 12 }, { actionType: 'department-page' }),
                textNode('nav-4', 'Marcas', 'span', { fontSize: 12 }, { actionType: 'brand-page' }),
                textNode('nav-5', 'Quem somos', 'span', { fontSize: 12 }, { actionType: 'about-page' }),
                textNode('nav-6', 'Contato', 'span', { fontSize: 12 }, { actionType: 'contact-page' }),
              ],
            },
          ],
        },
        {
          id: 'hero', type: 'group', name: 'ltp-hero • Publicado', x: 0, y: 275, width: 1440, height: 660,
          visible: true, opacity: 1, styles: { backgroundColor: '#eaf0ff' }, props: { previewClassName: 'ltp-hero' },
          children: [
            { ...textNode('hero-eye', 'Catálogo publicado', 'p', { fontSize: 12, color: '#d92d4b', fontWeight: 800 }), props: { text: 'Catálogo publicado', previewDomTag: 'p', previewClassName: 'ltp-eyebrow' } },
            textNode('hero-title-source', 'Título publicado pelo editor', 'h1', { fontSize: 52, color: '#102a59', fontWeight: 700, lineHeight: 1.1 }),
            textNode('hero-body', 'Este texto foi publicado no editor e aplicado sobre a estrutura responsiva do portal público V97.', 'p', { fontSize: 17, color: '#4d5c75' }),
            {
              id: 'hero-actions', type: 'group', name: 'ltp-hero-actions', x: 0, y: 300, width: 500, height: 80,
              visible: true, opacity: 1, styles: {}, props: { previewClassName: 'ltp-hero-actions' }, children: [
                { ...textNode('hero-button-1', 'Ver produtos publicados', 'a', { fontSize: 14, backgroundColor: '#d92d4b', color: '#ffffff' }, { href: '#produtos' }), type: 'button' },
                { ...textNode('hero-button-2', 'Falar com a empresa', 'a', { fontSize: 14, color: '#173a78' }, { href: '#contato' }), type: 'button' },
              ],
            },
          ],
        },
        section('segments-source', 'ltp-section • Segmentos', 935, 'Segmentos publicados', 'Segmentos definidos no editor', 'Escolha um perfil comercial para navegar pelos produtos relevantes.', { styles: { backgroundColor: '#fffafa' } }),
        section('products-source', 'ltp-section alt • Portfólio real Produtos do catálogo', 1400, 'Portfólio publicado', 'Produtos publicados no catálogo', 'A grade continua dinâmica, utilizando os dados públicos oficiais.'),
        section('departments-source', 'ltp-section • Organização do catálogo Departamentos', 2700, 'Organização publicada', 'Departamentos publicados', 'Navegue pelas principais famílias do catálogo.'),
        section('brands-source', 'ltp-section alt • Indústrias e parceiros Marcas do portfólio', 3200, 'Parceiros publicados', 'Marcas publicadas', 'As marcas continuam alimentadas pela API pública.', { visible: false }),
        section('contact-source', 'ltp-section dark • Relacionamento Atendimento comercial', 3900, 'Relacionamento publicado', 'Atendimento publicado pelo editor', 'Informações institucionais e comerciais definidas na versão publicada.', { styles: { backgroundColor: '#173a78', color: '#ffffff' } }),
        {
          id: 'footer', type: 'group', name: 'ltp-footer • Publicado', x: 0, y: 4500, width: 1440, height: 250,
          visible: true, opacity: 1, styles: { backgroundColor: '#102a59', color: '#ffffff' }, props: { previewClassName: 'ltp-footer' },
          children: [textNode('footer-text', 'Rodapé publicado pelo editor', 'div', { fontSize: 14, color: '#ffffff' })],
        },
      ],
    }],
  },
};

async function mockPublicApis(page) {
  await page.route('**/api/public/catalog', (route) => route.fulfill({ status: 200, contentType: 'application/json; charset=utf-8', body: JSON.stringify(catalogFixture) }));
  await page.route('**/api/public/commercial-segments', (route) => route.fulfill({ status: 200, contentType: 'application/json; charset=utf-8', body: JSON.stringify(segmentsFixture) }));
  await page.route('**/api/public/commercial-segments/*/products?*', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json; charset=utf-8',
    body: JSON.stringify({ products: catalogFixture.catalog.products.slice(0, 2), offset: 0, limit: 500, hasMore: false }),
  }));
  await page.route('**/api/public/pages/home', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json; charset=utf-8',
    body: JSON.stringify(publishedPageFixture),
  }));
}

async function waitPortal(page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.portalReady)).toBe('true');
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.editorPublication)).toBe('applied');
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
      publication: document.documentElement.dataset.editorPublication || '',
      publicationRevision: document.documentElement.dataset.editorPublicationRevision || '',
    };
  });
}

test.beforeEach(async ({ page }) => {
  await mockPublicApis(page);
});

test('portal público é independente e aplica somente a publicação pública do editor', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await waitPortal(page);
  await expect(page.locator('#hero-title')).toHaveText('Título publicado pelo editor');
  await expect(page.locator('#hero-title')).toHaveCSS('color', 'rgb(16, 42, 89)');
  await expect(page.locator('#marcas')).toBeHidden();
  await expect(page.locator('.segment-card')).toHaveCount(2);
  await expect(page.locator('.product-card')).toHaveCount(4);

  const metrics = await portalMetrics(page);
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
  expect(metrics.containerWidth).toBeLessThanOrEqual(1360.5);
  expect(metrics.titleTransform).toBe('none');
  expect(metrics.publication).toBe('applied');
  expect(metrics.publicationRevision).toBe('91');
  expect(metrics.scripts).toEqual(['/portal/app.js?v=97', '/portal/editor-publication-bridge.js?v=97']);
  expect(metrics.styles).toEqual(['/portal/styles.css?v=97', '/portal/editor-publication-bridge.css?v=97']);
  expect(metrics.scripts.join(' ')).not.toMatch(/preview-editor|responsive-v67|runtime-loader|editor-runtime/i);
});

test('tipografia publicada permanece estável em larguras equivalentes a zoom do navegador', async ({ page }) => {
  const widths = [1498, 1872, 2340];
  const samples = [];
  for (const width of widths) {
    await page.setViewportSize({ width, height: 1026 });
    if (!samples.length) {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await waitPortal(page);
    }
    samples.push(await portalMetrics(page));
  }
  for (const sample of samples) {
    expect(sample.scrollWidth).toBeLessThanOrEqual(sample.clientWidth + 1);
    expect(sample.containerWidth).toBeLessThanOrEqual(1360.5);
    expect(sample.titleTransform).toBe('none');
  }
  expect(samples[0].titleFont).toBeGreaterThanOrEqual(51.9);
  expect(Math.abs(samples[0].titleFont - samples[1].titleFont)).toBeLessThan(0.1);
  expect(Math.abs(samples[1].titleFont - samples[2].titleFont)).toBeLessThan(0.1);
});

test('portal reflowa tablet e celular mesmo com tipografia publicada pelo editor', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto('/catalogo', { waitUntil: 'domcontentloaded' });
  await waitPortal(page);
  let metrics = await portalMetrics(page);
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
  expect(metrics.titleFont).toBeLessThanOrEqual(42.5);

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

test('filtro de segmento e modal de produto permanecem funcionais após aplicar publicação', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await waitPortal(page);

  await page.locator('[data-segment-id="s1"]').click();
  await expect(page.locator('.product-card')).toHaveCount(2);
  await expect(page.locator('#results-label')).toContainText('Mercados & Supermercados');

  await page.locator('[data-product-id="p1"]').click();
  await expect(page.locator('#product-modal')).toBeVisible();
  await expect(page.locator('#product-modal-title')).toHaveText('Produto Alpha');
  await page.locator('.modal-close').click();
  await expect(page.locator('#product-modal')).toBeHidden();
});
