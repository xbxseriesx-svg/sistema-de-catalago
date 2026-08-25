import { test, expect } from '@playwright/test';

function installApiMocks(page, { authenticated }) {
  const publicPage = {
    slug: 'home', title: 'Home', versionId: 'supabase-v97', versionNumber: 97,
    publishedAt: new Date().toISOString(),
    nodes: [{ id: 'root', type: 'page', name: 'Home', x: 0, y: 0, width: 1440, height: 4800, visible: true, opacity: 1, styles: {}, props: {}, children: [] }],
  };

  return page.route('**/api/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const json = body => route.fulfill({ status: 200, contentType: 'application/json; charset=utf-8', body: JSON.stringify(body) });

    if (path === '/api/auth/status') {
      return json(authenticated
        ? { ok: true, needsBootstrap: false, user: { id: 'qa-user', companyId: 'cmp_asteryon', email: 'qa@example.invalid', name: 'QA', role: 'SDM' } }
        : { ok: true, needsBootstrap: false, user: null });
    }
    if (path === '/api/public/commercial-segments') {
      return json({ ok: true, segments: [{ id: 'seg-padaria', name: 'Padarias & Confeitarias', active: true, sortOrder: 2 }] });
    }
    if (path === '/api/public/commercial-segments/seg-padaria/products') {
      return json({ ok: true, products: [{
        id: 'p1', code: '1001', name: 'Farinha Profissional QA 25KG', shortDescription: 'Farinha Profissional QA 25KG',
        image: null, packaging: '01X25KG', unit: 'SACARIA', attributes: { Marca: 'Marca QA', 'Nome da categoria': 'FOOD SERVICE' },
      }], offset: Number(url.searchParams.get('offset') || 0), limit: Number(url.searchParams.get('limit') || 120), hasMore: false });
    }
    if (path === '/api/admin/catalog' || path === '/api/public/catalog') return json({ ok: true, catalog: {
      products: [{ id: 'p1', code: '1001', name: 'Farinha Profissional QA 25KG', shortDescription: 'Farinha Profissional QA 25KG', status: 'ativo', departamentoId: 'dep1', secaoId: 'sec1', categoriaId: 'cat1', imageUrl: null }],
      brands: [{ id: 'b1', name: 'Marca QA', slug: 'marca-qa', status: 'active' }],
      hierarchy: [
        { id: 'dep1', level: 'departamento', name: 'Atacado', slug: 'atacado', parentId: null, status: 'active' },
        { id: 'sec1', level: 'secao', name: 'Alimentos', slug: 'alimentos', parentId: 'dep1', status: 'active' },
        { id: 'cat1', level: 'categoria', name: 'Food Service', slug: 'food-service', parentId: 'sec1', status: 'active' },
      ], promotions: [], settings: { displayFields: ['image', 'code', 'shortDescription', 'brand', 'category', 'price', 'unit'] },
    } });
    if (path === '/api/admin/brands' || path === '/api/public/brands') return json({ ok: true, brands: [{ id: 'b1', name: 'Marca QA', slug: 'marca-qa', status: 'active' }] });
    if (path === '/api/admin/marketing' || path === '/api/public/marketing') return json({ ok: true, marketing: { theme: {}, banner: {}, videoBanner: {}, carousel: { items: [] }, layout: { x: 0, y: 0, width: 1440, height: 560, zIndex: 700, visible: true } } });
    if (path === '/api/admin/pages/home' || path === '/api/admin/pages/home/draft') return json({ ok: true, page: { id: 'page_home', slug: 'home', title: 'Home', nodes: [], revision: 1, updatedAt: new Date().toISOString(), publishedVersionId: 'supabase-v97' } });
    if (path === '/api/public/pages/home' || path.startsWith('/api/public/pages/home/')) return json({ ok: true, page: publicPage });
    if (path.includes('/templates')) return json({ ok: true, templates: [] });
    if (path.includes('/snapshots')) return json({ ok: true, snapshots: [] });
    if (path.includes('/publications')) return json({ ok: true });
    return json({ ok: true });
  });
}

function runtimeErrors(page) {
  const errors = [];
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  return errors;
}

async function waitPublicPortal(page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.portalReady)).toBe('true');
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.portalPopupController)).toBe('ready');
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.editorPublication)).toBe('applied');
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.editorFunctionalPublication)).toBe('applied');
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.editorNativePublication)).toBe('applied');
}

async function openManagementPanel(page, testInfo) {
  const heading = page.getByText(/Gest[aã]o do Cat[aá]logo/i).first();
  if (testInfo.project.name.includes('mobile')) {
    await expect(heading).toBeHidden({ timeout: 10_000 });
    const panelButton = page.getByRole('button', { name: /Painel/i }).first();
    await expect(panelButton).toBeVisible();
    await panelButton.click();
  }
  await expect(heading).toBeVisible({ timeout: 15_000 });
}

test('raiz pública como visitante usa o portal V97 e não abre o editor administrativo', async ({ page }) => {
  await installApiMocks(page, { authenticated: false });
  const errors = runtimeErrors(page);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await waitPublicPortal(page);
  await expect(page.locator('#conteudo')).toBeVisible();
  await expect(page.locator('#hero-title')).toBeVisible();
  await expect(page.getByText(/Gest[aã]o do Cat[aá]logo/i)).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Publicar$/i })).toHaveCount(0);
  const scripts = await page.evaluate(() => [...document.scripts].map(script => script.getAttribute('src') || ''));
  expect(scripts).toContain('/portal/app.js?v=97');
  expect(scripts.join(' ')).not.toMatch(/responsive-auto-v95|runtime-loader-v87|editor-runtime-v87/i);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(2);
  expect(errors).toEqual([]);
});

test('segmento comercial usa o popup V97, filtra produtos e mantém o usuário na página', async ({ page }) => {
  await installApiMocks(page, { authenticated: false });
  const errors = runtimeErrors(page);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await waitPublicPortal(page);

  const segmentButton = page.locator('[data-segment-id="seg-padaria"]');
  await segmentButton.scrollIntoViewIfNeeded();
  const before = await page.evaluate(() => window.scrollY);
  await segmentButton.click();
  await expect(page.locator('#portal-popup')).toBeVisible();
  await expect(page.locator('#portal-popup-body #produtos')).toBeVisible();
  await expect(page.getByText('Farinha Profissional QA 25KG').first()).toBeVisible();
  await expect(page.getByText('Cód. 1001').first()).toBeVisible();
  expect(await page.evaluate(() => window.scrollY)).toBe(before);

  await page.locator('#portal-popup [data-product-id="p1"]').click();
  await expect(page.locator('#product-modal')).toBeVisible();
  await expect(page.locator('#product-modal-title')).toHaveText('Farinha Profissional QA 25KG');
  await page.locator('.modal-close').click();
  await expect(page.locator('#product-modal')).toBeHidden();
  await expect(page.locator('#portal-popup')).toBeVisible();
  expect(errors).toEqual([]);
});

test('/admin como SDM abre o editor/gestão V95 correto com as abas históricas', async ({ page }, testInfo) => {
  await installApiMocks(page, { authenticated: true });
  const errors = runtimeErrors(page);
  await page.goto('/admin', { waitUntil: 'networkidle' });
  await expect(page.locator('#root')).toBeVisible();
  await openManagementPanel(page, testInfo);
  for (const label of ['Produtos', 'Importar', 'Estrutura', 'Marcas', 'Ofertas', 'Marketing']) {
    await expect(page.getByRole('button', { name: new RegExp(`^${label}$`, 'i') }).first()).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test('/admin como SDM mantém controles alcançáveis e sem overflow no mobile', async ({ page }, testInfo) => {
  await installApiMocks(page, { authenticated: true });
  const errors = runtimeErrors(page);
  await page.goto('/admin', { waitUntil: 'networkidle' });
  await openManagementPanel(page, testInfo);
  for (let i = 0; i < 12; i += 1) await page.keyboard.press('Tab');
  const focused = await page.evaluate(() => !!document.activeElement && document.activeElement !== document.body && document.activeElement !== document.documentElement);
  expect(focused).toBe(true);
  if (testInfo.project.name.includes('mobile')) {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(2);
  }
  expect(errors).toEqual([]);
});
