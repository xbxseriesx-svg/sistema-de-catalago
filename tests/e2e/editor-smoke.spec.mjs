import { test, expect } from '@playwright/test';

function installApiMocks(page) {
  return page.route('**/api/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;

    const json = body => route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify(body),
    });

    if (path === '/api/auth/status') {
      return json({
        ok: true,
        needsBootstrap: false,
        user: { id: 'qa-user', companyId: 'cmp_asteryon', email: 'qa@example.invalid', name: 'QA', role: 'SDM' },
      });
    }

    if (path === '/api/admin/catalog' || path === '/api/public/catalog') {
      return json({
        ok: true,
        catalog: {
          products: [{ id: 'p1', code: '1001', name: 'Produto QA', status: 'active', departamentoId: 'dep1', secaoId: 'sec1', categoriaId: 'cat1', imageUrl: null }],
          brands: [{ id: 'b1', name: 'Marca QA', slug: 'marca-qa', status: 'active' }],
          hierarchy: [
            { id: 'dep1', type: 'departamento', name: 'Atacado', slug: 'atacado', parentId: null, status: 'active' },
            { id: 'sec1', type: 'secao', name: 'Higiene', slug: 'higiene', parentId: 'dep1', status: 'active' },
            { id: 'cat1', type: 'categoria', name: 'Sabonetes', slug: 'sabonetes', parentId: 'sec1', status: 'active' },
            { id: 'dep2', type: 'departamento', name: 'Food Service QA', slug: 'food-service-qa', parentId: null, status: 'active' },
            { id: 'sec2', type: 'secao', name: 'Cozinha QA', slug: 'cozinha-qa', parentId: 'dep2', status: 'active' },
            { id: 'cat2', type: 'categoria', name: 'Molhos QA', slug: 'molhos-qa', parentId: 'sec2', status: 'active' },
          ],
          promotions: [],
          settings: {},
        },
      });
    }

    if (path === '/api/admin/marketing' || path === '/api/public/marketing') {
      return json({ ok: true, marketing: { theme: {}, banner: {}, videoBanner: {}, carousel: { items: [] }, layout: { x: 0, y: 0, width: 1440, height: 560, zIndex: 700, visible: true } } });
    }

    if (/^\/api\/admin\/pages\/home$/.test(path)) {
      return json({ ok: true, page: { id: 'page_home', slug: 'home', title: 'Home', nodes: [], revision: 1, updatedAt: new Date().toISOString(), publishedVersionId: 'supabase-v1' } });
    }

    if (/^\/api\/public\/pages\/home$/.test(path)) {
      return json({ ok: true, page: { slug: 'home', title: 'Home', versionId: 'supabase-v1', versionNumber: 1, publishedAt: new Date().toISOString(), nodes: [] } });
    }

    if (path.includes('/templates')) return json({ ok: true, templates: [] });
    if (path.includes('/snapshots')) return json({ ok: true, snapshots: [] });
    if (path.includes('/publications')) return json({ ok: true, publications: [] });

    return json({ ok: true });
  });
}

function collectRuntimeErrors(page) {
  const errors = [];
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`));
  });
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

test('página pública abre sem tela branca e sem overflow horizontal', async ({ page }) => {
  await installApiMocks(page);
  const errors = collectRuntimeErrors(page);

  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.locator('#root')).toBeVisible();
  await expect.poll(() => page.locator('#root').evaluate(el => (el.textContent || '').trim().length)).toBeGreaterThan(0);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(2);
  expect(errors).toEqual([]);
});

test('editor autenticado renderiza Gestão do Catálogo e abas principais sem erro JS', async ({ page }, testInfo) => {
  await installApiMocks(page);
  const errors = collectRuntimeErrors(page);

  await page.goto('/admin', { waitUntil: 'networkidle' });
  await expect(page.locator('#root')).toBeVisible();
  await openManagementPanel(page, testInfo);

  for (const label of ['Produtos', 'Importar', 'Estrutura', 'Marcas', 'Ofertas', 'Marketing']) {
    await expect(page.getByRole('button', { name: new RegExp(`^${label}$`, 'i') }).first()).toBeVisible();
  }

  const marketing = page.getByRole('button', { name: /^Marketing$/i }).first();
  await marketing.click();
  await page.waitForTimeout(500);

  if (testInfo.project.name.includes('mobile')) {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(2);
  }

  expect(errors).toEqual([]);
});

test('produto permite selecionar departamento criado dinamicamente', async ({ page }, testInfo) => {
  await installApiMocks(page);
  const errors = collectRuntimeErrors(page);

  await page.goto('/admin', { waitUntil: 'networkidle' });
  await openManagementPanel(page, testInfo);

  const productTab = page.getByRole('button', { name: /^Produtos$/i }).first();
  await expect(productTab).toBeVisible();
  await productTab.click();

  const departmentField = page.locator('label').filter({ hasText: 'Departamento *' }).first();
  await expect(departmentField).toBeVisible();
  const departmentSelect = departmentField.locator('select');
  await expect(departmentSelect.locator('option', { hasText: 'Food Service QA' })).toHaveCount(1);
  await departmentSelect.selectOption({ label: 'Food Service QA' });
  await expect(departmentSelect).toHaveValue('Food Service QA');

  const sectionField = page.locator('label').filter({ hasText: 'Seção *' }).first().locator('select');
  await expect(sectionField.locator('option', { hasText: 'Cozinha QA' })).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('editor mantém controles alcançáveis por teclado', async ({ page }, testInfo) => {
  await installApiMocks(page);
  const errors = collectRuntimeErrors(page);

  await page.goto('/admin', { waitUntil: 'networkidle' });
  await openManagementPanel(page, testInfo);

  for (let i = 0; i < 12; i += 1) await page.keyboard.press('Tab');
  const focused = await page.evaluate(() => {
    const el = document.activeElement;
    return !!el && el !== document.body && el !== document.documentElement;
  });
  expect(focused).toBe(true);
  expect(errors).toEqual([]);
});
