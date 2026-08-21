import { test, expect } from '@playwright/test';

function installApiMocks(page) {
  return page.route('**/api/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const json = body => route.fulfill({ status: 200, contentType: 'application/json; charset=utf-8', body: JSON.stringify(body) });

    if (path === '/api/auth/status') return json({ ok: true, needsBootstrap: false, user: { id: 'qa-user', companyId: 'cmp_asteryon', email: 'qa@example.invalid', name: 'QA', role: 'SDM' } });
    if (path === '/api/admin/catalog' || path === '/api/public/catalog') return json({ ok: true, catalog: {
      products: [{ id: 'p1', code: '1001', name: 'Produto QA', shortDescription: 'Produto QA', status: 'ativo', departamentoId: 'dep1', secaoId: 'sec1', categoriaId: 'cat1', imageUrl: null }],
      brands: [{ id: 'b1', name: 'Marca QA', slug: 'marca-qa', status: 'active' }],
      hierarchy: [
        { id: 'dep1', level: 'departamento', name: 'Atacado', slug: 'atacado', parentId: null, status: 'active' },
        { id: 'sec1', level: 'secao', name: 'Higiene', slug: 'higiene', parentId: 'dep1', status: 'active' },
        { id: 'cat1', level: 'categoria', name: 'Sabonetes', slug: 'sabonetes', parentId: 'sec1', status: 'active' },
      ], promotions: [], settings: { displayFields: ['image', 'code', 'shortDescription', 'brand', 'category', 'price', 'unit'] },
    } });
    if (path === '/api/admin/brands' || path === '/api/public/brands') return json({ ok: true, brands: [{ id: 'b1', name: 'Marca QA', slug: 'marca-qa', status: 'active' }] });
    if (path === '/api/admin/marketing' || path === '/api/public/marketing') return json({ ok: true, marketing: { theme: {}, banner: {}, videoBanner: {}, carousel: { items: [] }, layout: { x: 0, y: 0, width: 1440, height: 560, zIndex: 700, visible: true } } });
    if (path === '/api/admin/pages/home' || path === '/api/admin/pages/home/draft') return json({ ok: true, page: { id: 'page_home', slug: 'home', title: 'Home', nodes: [], revision: 1, updatedAt: new Date().toISOString(), publishedVersionId: 'supabase-v1' } });
    if (path === '/api/public/pages/home' || path.startsWith('/api/public/pages/home/')) return json({ ok: true, page: { slug: 'home', title: 'Home', versionId: 'supabase-v1', versionNumber: 1, publishedAt: new Date().toISOString(), nodes: [] } });
    if (path.includes('/templates')) return json({ ok: true, templates: [] });
    if (path.includes('/snapshots')) return json({ ok: true, snapshots: [] });
    if (path.includes('/publications')) return json({ ok: true, publications: [] });
    return json({ ok: true });
  });
}

function runtimeErrors(page) {
  const errors = [];
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  return errors;
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

test('raiz pública usa a experiência V94 e não abre o editor administrativo', async ({ page }) => {
  await installApiMocks(page);
  const errors = runtimeErrors(page);
  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.locator('#root')).toBeVisible();
  await expect.poll(() => page.locator('#root').evaluate(el => (el.textContent || '').trim().length)).toBeGreaterThan(0);
  await expect(page.getByText(/Gest[aã]o do Cat[aá]logo/i)).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Publicar$/i })).toHaveCount(0);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(2);
  expect(errors).toEqual([]);
});

test('/admin abre o editor/gestão V94 correto com as abas históricas', async ({ page }, testInfo) => {
  await installApiMocks(page);
  const errors = runtimeErrors(page);
  await page.goto('/admin', { waitUntil: 'networkidle' });
  await expect(page.locator('#root')).toBeVisible();
  await openManagementPanel(page, testInfo);
  for (const label of ['Produtos', 'Importar', 'Estrutura', 'Marcas', 'Ofertas', 'Marketing']) {
    await expect(page.getByRole('button', { name: new RegExp(`^${label}$`, 'i') }).first()).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test('/admin mantém controles alcançáveis e sem overflow no mobile', async ({ page }, testInfo) => {
  await installApiMocks(page);
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
