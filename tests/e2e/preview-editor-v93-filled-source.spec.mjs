import { test, expect } from '@playwright/test';

const TEMPLATE_NAMES = [
  'Varejo Contínuo', 'Atacado B2B', 'Distribuidora Institucional', 'Catálogo de Marcas B2B',
  'Distribuidora União • Figma B2B', 'Catálogo Hierárquico B2B', 'Vitrine Atacado Pro', 'Modelo Oficial',
];

const seedPage = {
  id: 'legacy-page-v93', type: 'page', name: 'TEMPLATE LEGADA NÃO PODE APARECER', x: 0, y: 0, width: 1440, height: 1600,
  rotation: 0, zIndex: 0, visible: true, locked: false, opacity: 1, styles: { backgroundColor: '#fff' }, props: {},
  children: [{
    id: 'legacy-text-v93', type: 'text', name: 'Legado', x: 40, y: 40, width: 700, height: 50,
    rotation: 0, zIndex: 1, visible: true, locked: false, opacity: 1,
    styles: { color: '#ff0000', fontSize: 28 }, props: { text: 'TEMPLATE LEGADA NÃO PODE APARECER' }, children: [],
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
      id: `tpl-${index}`, systemKey: `template-${index}`, name, description: `Template legada ${index}`,
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
    if (path === '/api/public/pages/home') return json({ ok: true, page: { slug: 'home', title: 'Home QA', versionId: 'qa-v1', versionNumber: 1, nodes: currentNodes } });
    return json({ ok: true });
  });
}

async function openLeft(page, testInfo) {
  if (!testInfo.project.name.includes('mobile')) return;
  const button = page.locator('[data-asteryon-mobile-toolbar] button[data-side="left"]');
  await expect(button).toBeVisible();
  await button.click();
  await expect(page.locator('[data-asteryon-editor-sidebar="left"]')).toHaveAttribute('data-open', 'true');
}

async function openModels(page, testInfo) {
  await openLeft(page, testInfo);
  await page.getByRole('button', { name: /^Modelos$/i }).first().click();
  await expect(page.getByRole('heading', { name: 'Modelos prontos' })).toBeVisible();
}

test('Grupo 3/4 V93: todas as templates antigas são substituídas pela Prévia preenchida corrente', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await installMocks(page);
  const dialogs = [];
  page.on('dialog', async dialog => { dialogs.push(dialog.message()); await dialog.accept(); });

  await page.goto('/admin', { waitUntil: 'networkidle' });

  for (const templateName of TEMPLATE_NAMES) {
    await openModels(page, testInfo);
    const article = page.locator('article').filter({ has: page.getByRole('heading', { name: templateName, exact: true }) }).first();
    await expect(article).toBeVisible();
    await expect(article).toHaveAttribute('data-asteryon-template-version', '93');
    const legacyApply = article.getByRole('button', { name: /Aplicar modelo/i }).first();
    await expect(legacyApply).toContainText('preenchido V93');

    // Clique direto na template antiga deve abrir a Prévia, jamais aplicar o seed legado.
    await legacyApply.click();
    const preview = page.locator('#laurencini-template-preview-v69');
    await expect(preview).toBeVisible({ timeout: 12_000 });
    await expect(preview.locator('.ltp-shell')).toBeVisible({ timeout: 12_000 });
    await expect(preview.getByText('Um catálogo completo para apresentar a força da Laurencini.', { exact: true })).toBeVisible();
    await expect(preview.getByText('Produto QA 1', { exact: true }).first()).toBeVisible();
    await expect(preview.getByText('Marca do catálogo', { exact: true }).first()).toBeVisible();

    await preview.getByRole('button', { name: 'Aplicar este modelo' }).click();
    await expect(preview).toBeHidden({ timeout: 12_000 });

    await expect(page.locator('[data-node-id]').filter({ hasText: 'Um catálogo completo para apresentar a força da Laurencini.' }).first()).toBeVisible({ timeout: 12_000 });
    await expect(page.locator('[data-node-id]').filter({ hasText: 'Produto QA 1' }).first()).toBeVisible({ timeout: 12_000 });
    await expect(page.locator('[data-node-id]').filter({ hasText: 'Marca do catálogo' }).first()).toBeVisible({ timeout: 12_000 });
    await expect(page.locator('[data-node-id]').filter({ hasText: 'TEMPLATE LEGADA NÃO PODE APARECER' })).toHaveCount(0);

    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.asteryonV93VisualParity || ''), { timeout: 15_000 }).toBe('approved');
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.asteryonTeam4V93 || ''), { timeout: 15_000 }).toBe('approved');

    const audit = await page.evaluate(() => ({
      group3: window.__ASTERYON_PREVIEW_EDITOR_VISUAL_V93__ || null,
      group4: window.__ASTERYON_PREVIEW_EDITOR_TEAM4_V93__ || null,
      nodes: window.__ASTERYON_PREVIEW_EDITOR_NODES_V91__ || [],
    }));
    expect(audit.group3?.ok, `${templateName}: Grupo 3 visual`).toBe(true);
    expect(audit.group3?.missingTexts, `${templateName}: textos ausentes`).toEqual([]);
    expect(audit.group3?.productGeometryDriftCount, `${templateName}: produtos fora de proporção`).toBe(0);
    expect(audit.group4?.approved, `${templateName}: Equipe 4`).toBe(true);
    expect(audit.group4?.productGeometryDriftCount, `${templateName}: Equipe 4 produto`).toBe(0);
  }

  expect(dialogs.filter(message => message.includes('Modelo não aplicado')), `Bloqueios encontrados: ${dialogs.join(' | ')}`).toEqual([]);
});