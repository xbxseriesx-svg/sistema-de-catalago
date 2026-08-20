import { test, expect } from '@playwright/test';

const marketing = {
  banner: { active: false, mediaType: 'image', mediaUrl: '', title: '', subtitle: '', link: '', autoplay: true, loop: true, muted: true },
  videoBanner: { active: false, mediaUrl: '', title: '', subtitle: '', autoplay: true, loop: true, muted: true, controls: false },
  carousel: { active: false, speed: 1, loop: true, autoplay: true, manual: false, mode: 'images', selectionMode: 'multiple', selectedBrandIds: [], selectedProductIds: [], items: [] },
  theme: { mode: 'light', primary: '#2563eb', secondary: '#f59e0b', background: '#ffffff', surface: '#f4f4f5', text: '#18181b' },
};

const pageNode = {
  id: 'page-qa', type: 'page', name: 'Página QA', x: 0, y: 0, width: 1440, height: 1800,
  rotation: 0, zIndex: 0, visible: true, locked: false, opacity: 1,
  styles: { backgroundColor: '#ffffff' }, props: {},
  children: [{
    id: 'qa-shape', type: 'shape', name: 'Forma QA', x: 120, y: 140, width: 220, height: 120,
    rotation: 0, zIndex: 1, visible: true, locked: false, opacity: 1,
    styles: { backgroundColor: '#214C8F', borderRadius: 12 }, props: {}, children: [],
  }],
};

async function installMocks(page) {
  let currentMarketing = structuredClone(marketing);
  let currentNodes = [structuredClone(pageNode)];
  const hierarchyCreates = [];

  await page.route('**/api/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json; charset=utf-8', body: JSON.stringify(body) });

    if (path === '/api/auth/status') return json({ ok: true, needsBootstrap: false, user: { id: 'qa-user', companyId: 'cmp_asteryon', email: 'qa@example.invalid', name: 'QA', role: 'SDM' } });
    if (path === '/api/admin/catalog' || path === '/api/public/catalog') {
      return json({ ok: true, catalog: {
        products: [{ id: 'p1', code: '000123', name: 'Produto QA', shortDescription: 'Produto QA', status: 'ativo', departamentoId: 'dep-qa', secaoId: 'sec-qa', categoriaId: 'cat-qa', brandId: 'brand-qa' }],
        brands: [{ id: 'brand-qa', name: 'Marca QA', slug: 'marca-qa', status: 'active' }],
        hierarchy: [
          { id: 'dep-qa', level: 'departamento', name: 'QA Departamento Dinâmico', slug: 'qa-departamento', parentId: null, status: 'active' },
          { id: 'sec-qa', level: 'secao', name: 'QA Seção Dinâmica', slug: 'qa-secao', parentId: 'dep-qa', status: 'active' },
          { id: 'cat-qa', level: 'categoria', name: 'QA Categoria Dinâmica', slug: 'qa-categoria', parentId: 'sec-qa', status: 'active' },
        ],
        promotions: [], settings: { displayFields: ['image', 'code', 'shortDescription', 'brand', 'category', 'price', 'unit'] },
      } });
    }
    if (path === '/api/admin/brands' || path === '/api/public/brands') return json({ ok: true, brands: [{ id: 'brand-qa', name: 'Marca QA', slug: 'marca-qa', status: 'active' }] });
    if (path === '/api/admin/hierarchy' && request.method() === 'POST') {
      const payload = request.postDataJSON();
      hierarchyCreates.push(structuredClone(payload));
      return json({ ok: true, node: { id: 'hier-created-qa', ...payload, status: 'active' } });
    }
    if (path === '/api/admin/marketing' || path === '/api/public/marketing') {
      if (request.method() === 'PUT') currentMarketing = structuredClone(request.postDataJSON().marketing);
      return json({ ok: true, marketing: currentMarketing });
    }
    if (path === '/api/admin/pages/home/draft') {
      if (request.method() === 'PUT') currentNodes = structuredClone(request.postDataJSON().nodes || currentNodes);
      return json({ ok: true, page: { id: 'page-home', slug: 'home', title: 'Home QA', nodes: currentNodes, revision: 1, updatedAt: new Date().toISOString() } });
    }
    if (path === '/api/admin/pages/home/snapshots') return json({ ok: true, snapshots: [] });
    if (path === '/api/admin/templates') return json({ ok: true, templates: [] });
    if (path === '/api/admin/templates/seed') return json({ ok: true, templates: [] });
    if (path === '/api/public/pages/home') return json({ ok: true, page: { slug: 'home', title: 'Home QA', versionId: 'qa-v1', versionNumber: 1, publishedAt: new Date().toISOString(), nodes: currentNodes } });
    return json({ ok: true });
  });

  return { hierarchyCreates };
}

async function openSidebar(page, testInfo, side) {
  if (!testInfo.project.name.includes('mobile')) return;
  const button = page.locator(`[data-asteryon-mobile-toolbar] button[data-side="${side}"]`);
  await expect(button).toBeVisible();
  await button.click();
  await expect(page.locator(`[data-asteryon-editor-sidebar="${side}"]`)).toHaveAttribute('data-open', 'true');
}

async function openLeftPanel(page, testInfo) {
  return openSidebar(page, testInfo, 'left');
}

async function closeOpenSidebarWithBackdrop(page, testInfo) {
  if (!testInfo.project.name.includes('mobile')) return;
  const backdrop = page.locator('[data-asteryon-sidebar-backdrop]');
  const openSidebar = page.locator('[data-asteryon-editor-sidebar][data-open="true"]').first();
  await expect(backdrop).toBeVisible();
  await expect(openSidebar).toBeVisible();
  const viewport = page.viewportSize();
  const sidebarBox = await openSidebar.boundingBox();
  expect(viewport).not.toBeNull();
  expect(sidebarBox).not.toBeNull();
  const sidebarOnLeft = sidebarBox.x < viewport.width / 2;
  const x = sidebarOnLeft ? Math.min(viewport.width - 8, sidebarBox.x + sidebarBox.width + 8) : Math.max(8, sidebarBox.x - 8);
  const y = Math.min(viewport.height - 16, Math.max(16, sidebarBox.y + 80));
  const hitBackdrop = await page.evaluate(({ x, y }) => {
    const hit = document.elementFromPoint(x, y);
    const backdrop = document.querySelector('[data-asteryon-sidebar-backdrop]');
    return !!backdrop && (hit === backdrop || backdrop.contains(hit));
  }, { x, y });
  expect(hitBackdrop, `Backdrop não possui área clicável fora do drawer em (${x}, ${y}).`).toBe(true);
  await page.mouse.click(x, y);
  await expect(page.locator('[data-asteryon-editor-sidebar][data-open="true"]')).toHaveCount(0);
  await expect(backdrop).toBeHidden();
}

test('cadastro de Produto usa Departamento dinâmico da hierarquia e filtra Seção', async ({ page }, testInfo) => {
  await installMocks(page);
  await page.goto('/admin', { waitUntil: 'networkidle' });
  await openLeftPanel(page, testInfo);
  await expect(page.getByText('Gestão do Catálogo').first()).toBeVisible();
  await page.getByRole('button', { name: /^Produtos$/i }).first().click();
  const department = page.locator('label').filter({ hasText: 'Departamento *' }).locator('select');
  await expect(department).toBeVisible();
  await expect(department.locator('option')).toContainText(['Selecione', 'QA Departamento Dinâmico']);
  await department.selectOption({ label: 'QA Departamento Dinâmico' });
  const section = page.locator('label').filter({ hasText: 'Seção *' }).locator('select');
  await expect(section.locator('option')).toContainText(['Selecione', 'QA Seção Dinâmica']);
  expect(await department.inputValue()).toBe('QA Departamento Dinâmico');
});

test('Estrutura cria Departamento manual sem exigir item pai', async ({ page }, testInfo) => {
  const mock = await installMocks(page);
  await page.goto('/admin', { waitUntil: 'networkidle' });
  await openLeftPanel(page, testInfo);
  await page.getByRole('button', { name: /^Estrutura$/i }).first().click();
  const newDepartment = page.getByRole('button', { name: /^Novo departamento$/i }).first();
  await expect(newDepartment).toBeVisible();
  await newDepartment.click();
  await expect(page.getByText('Departamento superior', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Seção superior', { exact: true })).toHaveCount(0);
  const name = page.getByPlaceholder('Ex.: Food Service').first();
  await expect(name).toBeVisible();
  await name.fill('QA Novo Departamento');
  const structureForm = name.locator('xpath=ancestor::div[.//button[normalize-space()="Salvar"]][1]');
  const structureSave = structureForm.getByRole('button', { name: /^Salvar$/i });
  await expect(structureSave).toBeVisible();
  await structureSave.click();
  await expect.poll(() => mock.hierarchyCreates.length).toBe(1);
  expect(mock.hierarchyCreates[0]).toEqual(expect.objectContaining({ level: 'departamento', name: 'QA Novo Departamento', parentId: null }));
  await expect(page.getByText('Configurações salvas com sucesso.')).toBeVisible();
});

test('Marketing mobile fecha drawer/backdrop e devolve interação ao canvas', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes('mobile'), 'Regressão específica do drawer mobile.');
  await installMocks(page);
  await page.goto('/admin', { waitUntil: 'networkidle' });
  await openLeftPanel(page, testInfo);
  await page.getByRole('button', { name: /^Marketing$/i }).first().click();
  await expect(page.getByRole('heading', { name: 'Marketing' })).toBeVisible();
  await expect(page.getByText('SUPABASE OK')).toBeVisible();
  const bannerTab = page.getByRole('button', { name: /Banner/i }).first();
  await expect(bannerTab).toBeVisible();
  await bannerTab.click();
  await expect(page.getByText('Banner principal')).toBeVisible();
  await closeOpenSidebarWithBackdrop(page, testInfo);
  const backdropDisplay = await page.locator('[data-asteryon-sidebar-backdrop]').evaluate(el => getComputedStyle(el).display);
  expect(backdropDisplay).toBe('none');
});

test('Modelos no mobile permanecem roláveis, aplicáveis, editáveis e fecháveis sem overflow', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes('mobile'), 'Validação específica de Modelos no mobile.');
  await installMocks(page);
  await page.goto('/admin', { waitUntil: 'networkidle' });
  await openLeftPanel(page, testInfo);
  await page.getByRole('button', { name: /^Modelos$/i }).first().click();
  await expect(page.getByRole('heading', { name: 'Modelos prontos' })).toBeVisible();
  const apply = page.getByRole('button', { name: 'Aplicar modelo' }).first();
  await expect(apply).toBeVisible();
  page.once('dialog', dialog => dialog.accept());
  await apply.click();
  await expect(page.getByText(/Modelo aplicado/i)).toBeVisible();
  const blank = page.getByRole('button', { name: /Começar com página em branco/i });
  await blank.scrollIntoViewIfNeeded();
  await expect(blank).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(2);

  await closeOpenSidebarWithBackdrop(page, testInfo);
  const original = 'OFERTAS QUE MOVEM O SEU NEGÓCIO';
  const heroText = page.getByText(original, { exact: true }).first();
  await expect(heroText).toBeVisible({ timeout: 10_000 });
  await heroText.click({ force: true });
  await openSidebar(page, testInfo, 'right');
  const right = page.locator('[data-asteryon-editor-sidebar="right"]');
  await expect(right).toHaveAttribute('data-open', 'true');

  const textboxes = right.getByRole('textbox');
  await expect.poll(async () => textboxes.count()).toBeGreaterThan(0);
  let contentIndex = -1;
  for (let index = 0; index < await textboxes.count(); index += 1) {
    const candidate = textboxes.nth(index);
    if (await candidate.inputValue().catch(() => '') === original) {
      contentIndex = index;
      break;
    }
  }
  expect(contentIndex, 'O inspetor abriu, mas nenhum textbox contém o texto do nó selecionado.').toBeGreaterThanOrEqual(0);
  const contentField = textboxes.nth(contentIndex);
  await expect(contentField).toBeVisible();
  await expect(contentField).toHaveValue(original);

  const edited = 'QA TEMPLATE TOTALMENTE EDITÁVEL';
  await contentField.fill(edited);
  await expect(page.getByText(edited, { exact: true }).first()).toBeVisible();
  await expect(page.getByText(original, { exact: true })).toHaveCount(0);
  await closeOpenSidebarWithBackdrop(page, testInfo);
});
