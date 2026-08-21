import { test, expect } from '@playwright/test';

const brandFixtures = Array.from({ length: 12 }, (_, index) => ({
  id: `b${index + 1}`,
  name: `Marca QA ${String(index + 1).padStart(2, '0')}`,
  slug: `marca-qa-${index + 1}`,
  status: 'active',
  active: true,
  featured: true,
  logoUrl: '/asteryon.svg',
}));

function installApiMocks(page, { authenticated }) {
  return page.route('**/api/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const json = body => route.fulfill({ status: 200, contentType: 'application/json; charset=utf-8', body: JSON.stringify(body) });

    if (path === '/api/auth/status') {
      return json(authenticated
        ? { ok: true, needsBootstrap: false, user: { id: 'qa-user', companyId: 'cmp_asteryon', email: 'qa@example.invalid', name: 'QA', role: 'SDM' } }
        : { ok: true, needsBootstrap: false, user: null });
    }
    if (path === '/api/admin/catalog' || path === '/api/public/catalog') return json({ ok: true, catalog: {
      products: [{ id: 'p1', code: '1001', name: 'Produto QA', shortDescription: 'Produto QA', status: 'ativo', departamentoId: 'dep1', secaoId: 'sec1', categoriaId: 'cat1', imageUrl: null }],
      brands: brandFixtures,
      hierarchy: [
        { id: 'dep1', level: 'departamento', name: 'Atacado', slug: 'atacado', parentId: null, status: 'active' },
        { id: 'sec1', level: 'secao', name: 'Higiene', slug: 'higiene', parentId: 'dep1', status: 'active' },
        { id: 'cat1', level: 'categoria', name: 'Sabonetes', slug: 'sabonetes', parentId: 'sec1', status: 'active' },
      ], promotions: [], settings: { displayFields: ['image', 'code', 'shortDescription', 'brand', 'category', 'price', 'unit'] },
    } });
    if (path === '/api/admin/brands' || path === '/api/public/brands') return json({ ok: true, brands: brandFixtures });
    if (path === '/api/admin/marketing' || path === '/api/public/marketing') return json({ ok: true, marketing: { theme: {}, banner: {}, videoBanner: {}, carousel: { items: [] }, layout: { x: 0, y: 0, width: 1440, height: 560, zIndex: 700, visible: true } } });
    if (path === '/api/admin/pages/home' || path === '/api/admin/pages/home/draft') return json({ ok: true, page: { id: 'page_home', slug: 'home', title: 'Home', nodes: [], revision: 1, updatedAt: new Date().toISOString(), publishedVersionId: 'supabase-v1' } });
    if (path === '/api/public/pages/home' || path.startsWith('/api/public/pages/home/')) return json({ ok: true, page: { slug: 'home', title: 'Home', versionId: 'supabase-v1', versionNumber: 1, publishedAt: new Date().toISOString(), nodes: [] } });
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

test('raiz pública como visitante usa a experiência V94, zoom ajustável e carrossel de marcas sem buraco', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await installApiMocks(page, { authenticated: false });
  const errors = runtimeErrors(page);
  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.locator('#root')).toBeVisible();
  await expect.poll(() => page.locator('#root').evaluate(el => (el.textContent || '').trim().length)).toBeGreaterThan(0);
  await expect(page.getByText(/Gest[aã]o do Cat[aá]logo/i)).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Publicar$/i })).toHaveCount(0);

  const zoomControl = page.locator('[data-asteryon-public-zoom-control="true"]');
  await expect(zoomControl).toBeVisible();
  await expect(zoomControl.locator('[data-zoom-value]')).toHaveText('85%');
  expect(await page.locator('#root').evaluate(el => el.style.zoom)).toBe('0.85');
  await page.getByRole('button', { name: 'Aumentar zoom da página' }).click();
  await expect(zoomControl.locator('[data-zoom-value]')).toHaveText('90%');
  expect(await page.locator('#root').evaluate(el => el.style.zoom)).toBe('0.9');
  await page.getByRole('button', { name: 'Restaurar zoom padrão da página' }).click();
  await expect(zoomControl.locator('[data-zoom-value]')).toHaveText('85%');

  const portfolio = page.getByText(/Marcas do portf[oó]lio/i).first();
  await expect(portfolio).toBeVisible({ timeout: 15_000 });
  const brandTrack = page.locator('[data-asteryon-brand-track="true"]').first();
  await expect(brandTrack).toBeVisible({ timeout: 15_000 });
  const carouselState = await brandTrack.evaluate(el => ({
    originals: Number(el.dataset.asteryonBrandOriginalCount || 0),
    cloneRounds: Number(el.dataset.asteryonBrandCloneRounds || 0),
    clones: el.querySelectorAll(':scope > [data-asteryon-brand-clone="true"]').length,
    cycle: Number.parseFloat(el.style.getPropertyValue('--asteryon-brand-cycle')),
  }));
  expect(carouselState.originals).toBeGreaterThanOrEqual(2);
  expect(carouselState.cloneRounds).toBeGreaterThanOrEqual(1);
  expect(carouselState.clones).toBeGreaterThanOrEqual(carouselState.originals);
  expect(carouselState.cycle).toBeGreaterThan(0);

  if (!testInfo.project.name.includes('mobile')) {
    await page.setViewportSize({ width: 1024, height: 768 });
    await expect(zoomControl).toBeVisible();
    await expect(brandTrack).toBeVisible();
  }

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(2);
  expect(errors).toEqual([]);
});

test('/admin como SDM abre o editor/gestão V94 correto com as abas históricas', async ({ page }, testInfo) => {
  await installApiMocks(page, { authenticated: true });
  const errors = runtimeErrors(page);
  await page.goto('/admin', { waitUntil: 'networkidle' });
  await expect(page.locator('#root')).toBeVisible();
  await openManagementPanel(page, testInfo);
  for (const label of ['Produtos', 'Importar', 'Estrutura', 'Marcas', 'Ofertas', 'Marketing']) {
    await expect(page.getByRole('button', { name: new RegExp(`^${label}$`, 'i') }).first()).toBeVisible();
  }
  await expect(page.locator('[data-asteryon-public-zoom-control="true"]')).toHaveCount(0);
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
