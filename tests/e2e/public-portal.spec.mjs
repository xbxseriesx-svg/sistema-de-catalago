import { test, expect } from '@playwright/test';

const catalog = {
  products: [
    { id: 'p1', code: '1001', ean: '789000000001', name: 'Produto Alpha', brandId: 'b1', departamentoId: 'd1', categoriaId: 'c1', packaging: 'CX', unit: 'UN', ncm: '10000000', tags: ['alpha'] },
    { id: 'p2', code: '1002', ean: '789000000002', name: 'Produto Beta', brandId: 'b2', departamentoId: 'd1', categoriaId: 'c2', packaging: 'FD', unit: 'UN', ncm: '20000000', tags: ['beta'] },
    { id: 'p3', code: '1003', ean: '789000000003', name: 'Produto Gama', brandId: 'b1', departamentoId: 'd2', categoriaId: 'c2', packaging: 'CX', unit: 'KG', ncm: '30000000', tags: ['gama'] },
    { id: 'p4', code: '1004', ean: '789000000004', name: 'Produto Delta', brandId: 'b2', departamentoId: 'd2', categoriaId: 'c1', packaging: 'PCT', unit: 'UN', ncm: '40000000', tags: ['delta'] },
  ],
  brands: [
    { id: 'b1', name: 'Marca Um', status: 'active', featured: true, sortOrder: 1 },
    { id: 'b2', name: 'Marca Dois', status: 'active', featured: false, sortOrder: 2 },
  ],
  hierarchy: [
    { id: 'd1', name: 'Departamento A', level: 'departamento', sortOrder: 1 },
    { id: 'd2', name: 'Departamento B', level: 'departamento', sortOrder: 2 },
    { id: 'c1', name: 'Categoria A', level: 'categoria', parentId: 'd1', sortOrder: 1 },
    { id: 'c2', name: 'Categoria B', level: 'categoria', parentId: 'd2', sortOrder: 2 },
  ],
  promotions: [],
};

const segments = [
  { id: 's1', name: 'Mercados & Supermercados', sortOrder: 1 },
  { id: 's2', name: 'Padarias & Confeitarias', sortOrder: 2 },
];

const textNode = (id, text, tag, styles = {}, extraProps = {}) => ({
  id, type: 'text', name: `${tag} • ${text}`, x: 0, y: 0, width: 400, height: 40,
  visible: true, opacity: 1, styles, props: { text, previewDomTag: tag, ...extraProps }, children: [],
});

const section = (id, name, y, eyebrow, heading, body, className = 'ltp-section') => ({
  id, type: 'group', name, x: 0, y, width: 1440, height: 700, visible: true, opacity: 1, styles: {},
  props: { previewClassName: className },
  children: [
    { ...textNode(`${id}-eye`, eyebrow, 'p', { fontSize: 12, color: '#d92d4b', fontWeight: 800 }), props: { text: eyebrow, previewDomTag: 'p', previewClassName: 'ltp-eyebrow' } },
    textNode(`${id}-title`, heading, 'h2', { fontSize: 30, color: '#102a59', fontWeight: 700 }),
    textNode(`${id}-body`, body, 'p', { fontSize: 16, color: '#62708a' }),
  ],
});

const productsSource = section('products-source', 'ltp-section • Portfólio real Produtos do catálogo', 1400, 'Portfólio publicado', 'Produtos publicados no catálogo', 'A grade continua dinâmica pela API pública.');
productsSource.children.push(
  { id: 'carousel-publicado', type: 'carousel', name: 'Carrossel publicado', x: 40, y: 250, width: 900, height: 320, visible: true, opacity: 1, styles: { backgroundColor: '#eef3fb', radius: 16 }, props: { images: ['/asteryon.svg', '/asteryon.svg'], interval: 2000, fit: 'contain' }, children: [] },
  { id: 'promocao-publicada', type: 'promotion', name: 'Promoção publicada', x: 40, y: 600, width: 500, height: 180, visible: true, opacity: 1, styles: { backgroundColor: '#ffffff', radius: 12 }, props: { title: 'Oferta publicada pelo editor', text: 'Componente funcional vindo de published_nodes.', label: 'Ver produtos', href: '#produtos' }, children: [] },
);

const nativeProduct = {
  id: 'n7qa07', type: 'product', name: 'Produto nativo', x: 50, y: 2050, width: 320, height: 420,
  visible: true, opacity: 1, styles: { background: '#ffffff', radius: 14, borderWidth: 1, borderColor: '#dce4f1' }, props: {},
  responsive: { desktop: { x: 50, y: 2050, width: 320, height: 420 }, tablet: { x: 20, y: 2050, width: 300, height: 420 }, mobile: { x: 8, y: 2050, width: 300, height: 420 } },
  children: [
    { id: 'n8qa08', type: 'productImage', name: 'Imagem nativa', x: 0, y: 0, width: 280, height: 170, visible: true, opacity: 1, styles: { radius: 10 }, props: { src: '/asteryon.svg', fit: 'contain' }, children: [] },
    { id: 'n9qa09', type: 'productBrand', name: 'Marca nativa', x: 0, y: 180, width: 280, height: 20, visible: true, opacity: 1, styles: { fontSize: 12, fontWeight: 600 }, props: { text: 'Marca criada no editor' }, children: [] },
    { id: 'n10qa10', type: 'productName', name: 'Nome nativo', x: 0, y: 205, width: 280, height: 44, visible: true, opacity: 1, styles: { fontSize: 18, fontWeight: 700 }, props: { text: 'Produto criado no editor' }, children: [] },
    { id: 'n11qa11', type: 'productPrice', name: 'Preço nativo', x: 0, y: 255, width: 280, height: 30, visible: true, opacity: 1, styles: { fontSize: 20, fontWeight: 800 }, props: { text: 'R$ 99,90' }, children: [] },
    { id: 'n12qa12', type: 'productButton', name: 'Botão nativo', x: 0, y: 300, width: 280, height: 42, visible: true, opacity: 1, styles: { background: '#173a78', color: '#ffffff', radius: 8 }, props: { label: 'Detalhes publicados' }, children: [] },
  ],
};

const publishedPage = {
  page: {
    slug: 'home', title: 'Página Inicial', versionId: 'ver-e2e-97', versionNumber: 97, publishedAt: '2026-08-25T15:00:00.000Z',
    nodes: [{
      id: 'root', type: 'page', name: 'Página publicada', x: 0, y: 0, width: 1440, height: 5000, visible: true, opacity: 1,
      styles: { backgroundColor: '#ffffff' }, props: {}, children: [
        { id: 'header', type: 'group', name: 'ltp-site-header • Publicado', x: 0, y: 0, width: 1440, height: 275, visible: true, opacity: 1, styles: {}, props: { previewClassName: 'ltp-site-header' }, children: [
          { id: 'nav', type: 'group', name: 'ltp-navlinks', x: 0, y: 40, width: 800, height: 40, visible: true, opacity: 1, styles: {}, props: { previewClassName: 'ltp-navlinks' }, children: [
            textNode('nav-1', 'Início', 'span', { fontSize: 12 }, { actionType: 'home' }),
            textNode('nav-2', 'Catálogo', 'span', { fontSize: 12 }, { actionType: 'catalog-modal' }),
            textNode('nav-3', 'Departamentos', 'span', { fontSize: 12 }, { actionType: 'department-page' }),
            textNode('nav-4', 'Marcas', 'span', { fontSize: 12 }, { actionType: 'brand-page' }),
            textNode('nav-5', 'Quem somos', 'span', { fontSize: 12 }, { actionType: 'about-page' }),
            textNode('nav-6', 'Contato', 'span', { fontSize: 12 }, { actionType: 'contact-page' }),
          ] },
        ] },
        { id: 'hero', type: 'group', name: 'ltp-hero • Publicado', x: 0, y: 275, width: 1440, height: 660, visible: true, opacity: 1, styles: { backgroundColor: '#eaf0ff' }, props: { previewClassName: 'ltp-hero' }, children: [
          { ...textNode('hero-eye', 'Catálogo publicado', 'p', { fontSize: 12, color: '#d92d4b', fontWeight: 800 }), props: { text: 'Catálogo publicado', previewDomTag: 'p', previewClassName: 'ltp-eyebrow' } },
          textNode('hero-title-source', 'Título publicado pelo editor', 'h1', { fontSize: 52, color: '#102a59', fontWeight: 700, lineHeight: 1.1 }),
          textNode('hero-body', 'Texto publicado no editor e aplicado sobre a estrutura responsiva V97.', 'p', { fontSize: 17, color: '#4d5c75' }),
        ] },
        section('segments-source', 'ltp-section • Segmentos', 935, 'Segmentos publicados', 'Segmentos definidos no editor', 'Escolha um perfil comercial.'),
        productsSource,
        section('departments-source', 'ltp-section • Organização do catálogo Departamentos', 2700, 'Organização publicada', 'Departamentos publicados', 'Navegue pelas famílias do catálogo.'),
        section('brands-source', 'ltp-section • Indústrias e parceiros Marcas do portfólio', 3400, 'Parceiros publicados', 'Marcas publicadas', 'Marcas alimentadas pela API pública.'),
        section('contact-source', 'ltp-section • Relacionamento Atendimento comercial', 4100, 'Relacionamento publicado', 'Atendimento publicado pelo editor', 'Informações institucionais publicadas.'),
        { id: 'footer', type: 'group', name: 'ltp-footer • Publicado', x: 0, y: 4800, width: 1440, height: 180, visible: true, opacity: 1, styles: { backgroundColor: '#102a59', color: '#ffffff' }, props: { previewClassName: 'ltp-footer' }, children: [textNode('footer-text', 'Rodapé publicado pelo editor', 'div', { fontSize: 14, color: '#ffffff' })] },
        { id: 'n1qa01', type: 'heading', name: 'Título nativo', x: 20, y: 1600, width: 600, height: 60, visible: true, opacity: 1, styles: { fontSize: 32, fontWeight: 800, color: '#173a78' }, props: { text: 'Título nativo publicado' }, responsive: { desktop: { x: 20, y: 1600, width: 600, height: 60 }, tablet: { x: 10, y: 1600, width: 560, height: 60 }, mobile: { x: 8, y: 1600, width: 340, height: 60 } }, children: [] },
        { id: 'n2qa02', type: 'image', name: 'Imagem nativa publicada', x: 20, y: 1680, width: 420, height: 220, visible: true, opacity: 1, styles: { radius: 12 }, props: { src: '/asteryon.svg', fit: 'contain' }, children: [] },
        { id: 'n3qa03', type: 'button', name: 'Botão nativo', x: 20, y: 1920, width: 220, height: 46, visible: true, opacity: 1, styles: { background: '#173a78', color: '#ffffff', radius: 10 }, props: { label: 'Abrir marcas', href: '#marcas' }, children: [] },
        { id: 'n4qa04', type: 'search', name: 'Busca nativa', x: 20, y: 1980, width: 520, height: 46, visible: true, opacity: 1, styles: {}, props: { placeholder: 'Busca publicada pelo editor' }, children: [] },
        { id: 'n5qa05', type: 'menu', name: 'Menu nativo', x: 20, y: 2040, width: 720, height: 48, visible: true, opacity: 1, styles: {}, props: {}, children: [] },
        { id: 'n6qa06', type: 'breadcrumb', name: 'Breadcrumb nativo', x: 20, y: 2100, width: 420, height: 30, visible: true, opacity: 1, styles: {}, props: {}, children: [] },
        nativeProduct,
        { id: 'n13qa13', type: 'hero', name: 'Hero nativo', x: 40, y: 500, width: 900, height: 300, visible: true, opacity: 1, styles: { background: '#f4f7ff', radius: 16 }, props: { title: 'Hero criado no editor', subtitle: 'Também publicado em fluxo responsivo.', src: '/asteryon.svg', fit: 'contain' }, children: [] },
      ],
    }],
  },
};

async function mockApis(page) {
  await page.route('**/api/public/**', async route => {
    const url = new URL(route.request().url());
    const json = body => route.fulfill({ status: 200, contentType: 'application/json; charset=utf-8', body: JSON.stringify(body) });
    if (url.pathname === '/api/public/catalog') return json({ ok: true, catalog });
    if (url.pathname === '/api/public/commercial-segments') return json({ ok: true, segments });
    if (/^\/api\/public\/commercial-segments\/[^/]+\/products$/.test(url.pathname)) return json({ ok: true, products: catalog.products.slice(0, 2), offset: 0, limit: 500, hasMore: false });
    if (url.pathname === '/api/public/pages/home') return json(publishedPage);
    return json({ ok: true });
  });
}

async function waitPortal(page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.portalReady)).toBe('true');
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.editorPublication)).toBe('applied');
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.editorFunctionalPublication)).toBe('applied');
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.editorNativePublication)).toBe('applied');
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.portalPopupController)).toBe('ready');
}

async function metrics(page) {
  return page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    titleFont: Number.parseFloat(getComputedStyle(document.querySelector('.hero h1')).fontSize),
    titleTransform: getComputedStyle(document.querySelector('.hero h1')).transform,
    containerWidth: document.querySelector('.hero .container')?.getBoundingClientRect().width || 0,
  }));
}

async function openMainNavIfNeeded(page) {
  const link = page.locator('#main-nav a[href="#departamentos"]');
  if (!(await link.isVisible())) {
    await page.locator('.nav-toggle').click();
    await expect(page.locator('#main-nav')).toHaveAttribute('data-open', 'true');
  }
  return link;
}

test.beforeEach(async ({ page }) => mockApis(page));

test('portal público V97 usa somente publicação pública e não carrega runtime administrativo', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await waitPortal(page);
  await expect(page.locator('#hero-title')).toHaveText('Título publicado pelo editor');
  await expect(page.locator('.segment-card')).toHaveCount(2);
  await expect(page.locator('.product-card')).toHaveCount(4);
  const result = await page.evaluate(() => ({
    scripts: [...document.scripts].map(script => script.getAttribute('src') || ''),
    styles: [...document.querySelectorAll('link[rel="stylesheet"]')].map(link => link.getAttribute('href') || ''),
    adminText: document.body.textContent?.includes('Gestão do Catálogo') || false,
  }));
  expect(result.adminText).toBe(false);
  expect(result.scripts).toEqual(['/portal/app.js?v=97','/portal/editor-publication-bridge.js?v=97','/portal/popup-controller.js?v=97','/portal/editor-functional-publication.js?v=97','/portal/editor-native-publication.js?v=97']);
  expect(result.styles).toEqual(['/portal/styles.css?v=97','/portal/editor-publication-bridge.css?v=97','/portal/popup-controller.css?v=97','/portal/editor-functional-publication.css?v=97','/portal/editor-native-publication.css?v=97']);
  expect(result.scripts.join(' ')).not.toMatch(/responsive-v67|responsive-auto-v95|preview-editor|editor-runtime|runtime-loader/i);
});

test('menu, busca e áreas públicas abrem popup sem alterar a posição da página', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await waitPortal(page);
  const before = await page.evaluate(() => window.scrollY);
  const departmentLink = await openMainNavIfNeeded(page);
  await departmentLink.click();
  await expect(page.locator('#portal-popup-body #departamentos')).toBeVisible();
  expect(await page.evaluate(() => window.scrollY)).toBe(before);
  await page.locator('.portal-popup-close').click();
  await page.locator('#catalog-search').fill('Beta');
  await page.locator('#search-button').click();
  await expect(page.locator('#portal-popup-body #produtos')).toBeVisible();
  await expect(page.locator('.product-card h3')).toHaveText('Produto Beta');
  expect(await page.evaluate(() => window.scrollY)).toBe(before);
});

test('segmento filtra no popup e detalhe do produto fica acima do popup principal', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await waitPortal(page);
  const segmentButton = page.locator('[data-segment-id="s1"]');
  await segmentButton.scrollIntoViewIfNeeded();
  const before = await page.evaluate(() => window.scrollY);
  await segmentButton.click();
  await expect(page.locator('#portal-popup-body #produtos')).toBeVisible();
  await expect(page.locator('.product-card')).toHaveCount(2);
  await expect(page.locator('#results-label')).toContainText('Mercados & Supermercados');
  expect(await page.evaluate(() => window.scrollY)).toBe(before);
  await page.locator('[data-product-id="p1"]').click();
  await expect(page.locator('#product-modal')).toBeVisible();
  await expect(page.locator('#product-modal-title')).toHaveText('Produto Alpha');
  await page.locator('.modal-close').click();
  await expect(page.locator('#portal-popup')).toBeVisible();
});

test('componentes funcionais publicados pelo editor aparecem e continuam interativos', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await waitPortal(page);
  await expect(page.locator('[data-editor-functional-node="carousel-publicado"] img')).toHaveCount(1);
  await expect(page.locator('[data-editor-functional-node="promocao-publicada"]')).toContainText('Oferta publicada pelo editor');
  await page.locator('[data-editor-functional-node="promocao-publicada"] button').click();
  await expect(page.locator('#portal-popup-body #produtos')).toBeVisible();
});

test('elementos nativos criados no editor são publicados com conteúdo, função e fluxo responsivo', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await waitPortal(page);
  await expect(page.locator('[data-editor-native-node="n1qa01"]')).toContainText('Título nativo publicado');
  await expect(page.locator('[data-editor-native-node="n2qa02"] img')).toHaveCount(1);
  await expect(page.locator('[data-editor-native-node="n7qa07"]')).toContainText('Produto criado no editor');
  await expect(page.locator('[data-editor-native-node="n7qa07"]')).toContainText('R$ 99,90');
  await expect(page.locator('[data-editor-native-node="n13qa13"]')).toContainText('Hero criado no editor');
  await expect(page.locator('[data-editor-native-node="n5qa05"] button')).toHaveCount(6);
  await expect(page.locator('[data-editor-native-node="n6qa06"]')).toContainText('Produtos');

  await page.locator('[data-editor-native-node="n3qa03"] button').click();
  await expect(page.locator('#portal-popup-body #marcas')).toBeVisible();
  await page.locator('.portal-popup-close').click();

  const nativeSearch = page.locator('[data-editor-native-node="n4qa04"]');
  await nativeSearch.locator('input').fill('Beta');
  await nativeSearch.locator('button').click();
  await expect(page.locator('#portal-popup-body #produtos')).toBeVisible();
  await expect(page.locator('.product-card h3')).toHaveText('Produto Beta');
});

test('tablet e celular fazem reflow sem miniaturizar desktop e menu mobile não bloqueia busca', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto('/catalogo', { waitUntil: 'domcontentloaded' });
  await waitPortal(page);
  let result = await metrics(page);
  expect(result.scrollWidth).toBeLessThanOrEqual(result.clientWidth + 1);
  expect(result.titleFont).toBeLessThanOrEqual(42.5);

  await page.setViewportSize({ width: 390, height: 844 });
  result = await metrics(page);
  expect(result.scrollWidth).toBeLessThanOrEqual(result.clientWidth + 1);
  expect(result.titleFont).toBeLessThanOrEqual(32.1);
  await expect(page.locator('.nav-toggle')).toBeVisible();
  await page.locator('.nav-toggle').click();
  await expect(page.locator('#main-nav')).toHaveAttribute('data-open', 'true');
  await page.locator('#catalog-search').fill('Beta');
  await expect(page.locator('#main-nav')).toHaveAttribute('data-open', 'false');
  await page.locator('#search-button').click();
  await expect(page.locator('#portal-popup-body #produtos')).toBeVisible();

  const geometry = await page.locator('[data-editor-native-node="n7qa07"] > *').evaluate(element => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return { position: style.position, width: rect.width, viewport: document.documentElement.clientWidth };
  });
  expect(geometry.position).not.toBe('absolute');
  expect(geometry.width).toBeLessThanOrEqual(geometry.viewport + 1);
});

test('zoom nativo mantém tipografia estável e sem overflow horizontal', async ({ page }) => {
  const samples = [];
  for (const width of [1498, 1872, 2340]) {
    await page.setViewportSize({ width, height: 1026 });
    if (!samples.length) {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await waitPortal(page);
    }
    samples.push(await metrics(page));
  }
  for (const sample of samples) {
    expect(sample.scrollWidth).toBeLessThanOrEqual(sample.clientWidth + 1);
    expect(sample.containerWidth).toBeLessThanOrEqual(1360.5);
    expect(sample.titleTransform).toBe('none');
  }
  expect(Math.abs(samples[0].titleFont - samples[1].titleFont)).toBeLessThan(0.1);
  expect(Math.abs(samples[1].titleFont - samples[2].titleFont)).toBeLessThan(0.1);
});
