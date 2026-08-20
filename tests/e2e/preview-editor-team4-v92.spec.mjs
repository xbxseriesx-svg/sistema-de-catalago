import { test, expect } from '@playwright/test';

const seedPage = {
  id: 'page-modelo-oficial-qa', type: 'page', name: 'Modelo Oficial QA', x: 0, y: 0, width: 1440, height: 1800,
  rotation: 0, zIndex: 0, visible: true, locked: false, opacity: 1,
  styles: { backgroundColor: '#ffffff' }, props: {},
  children: [{
    id: 'seed-text-qa', type: 'text', name: 'Texto seed', x: 100, y: 100, width: 500, height: 60,
    rotation: 0, zIndex: 1, visible: true, locked: false, opacity: 1,
    styles: { color: '#123F7D', fontSize: 28 }, props: { text: 'MODELO OFICIAL QA' }, children: [],
  }],
};

async function installPreviewMocks(page) {
  let currentNodes = [structuredClone(seedPage)];
  const templateNodes = [structuredClone(seedPage)];

  await page.route('**/api/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json; charset=utf-8', body: JSON.stringify(body) });

    if (path === '/api/auth/status') return json({ ok: true, needsBootstrap: false, user: { id: 'qa-user', companyId: 'cmp_asteryon', email: 'qa@example.invalid', name: 'QA', role: 'SDM' } });
    if (path === '/api/admin/catalog' || path === '/api/public/catalog') {
      return json({ ok: true, catalog: {
        products: [{
          id: 'p1', code: '000123', name: 'Produto QA', shortDescription: 'Produto QA', status: 'ativo',
          departamentoId: 'dep-qa', secaoId: 'sec-qa', categoriaId: 'cat-qa', brandId: 'brand-qa',
          brandName: 'Marca QA', packaging: 'CX 12', image: '',
        }],
        // Sem logo de propósito: reproduz exatamente o caso em que o Preview mostra
        // <strong>Marca QA</strong><small>Marca do catálogo</small>.
        brands: [{ id: 'brand-qa', name: 'Marca QA', slug: 'marca-qa', status: 'active', logoUrl: null }],
        hierarchy: [
          { id: 'dep-qa', level: 'departamento', name: 'QA Departamento', slug: 'qa-departamento', parentId: null, status: 'active' },
          { id: 'sec-qa', level: 'secao', name: 'QA Seção', slug: 'qa-secao', parentId: 'dep-qa', status: 'active' },
          { id: 'cat-qa', level: 'categoria', name: 'QA Categoria', slug: 'qa-categoria', parentId: 'sec-qa', status: 'active' },
        ],
        promotions: [], settings: { displayFields: ['image', 'code', 'shortDescription', 'brand', 'category'] },
      } });
    }
    if (path === '/api/admin/brands' || path === '/api/public/brands') {
      return json({ ok: true, brands: [{ id: 'brand-qa', name: 'Marca QA', slug: 'marca-qa', status: 'active', logoUrl: null }] });
    }
    if (path === '/api/admin/templates') {
      return json({ ok: true, templates: [{
        id: 'tpl-modelo-oficial-qa', systemKey: 'modelo-oficial', name: 'Modelo Oficial',
        description: 'QA Modelo Oficial', category: 'institucional', tags: ['qa'], accent: '#214C8F',
        nodes: templateNodes, isSystem: true, version: 1,
      }] });
    }
    if (path === '/api/admin/templates/seed') return json({ ok: true, requested: 0 });
    if (path === '/api/admin/marketing' || path === '/api/public/marketing') {
      return json({ ok: true, marketing: {
        banner: { active: false }, videoBanner: { active: false }, carousel: { active: false, items: [] },
        theme: { mode: 'light', primary: '#214C8F', secondary: '#D13130', background: '#ffffff', surface: '#f4f8fc', text: '#18181b' },
      } });
    }
    if (path === '/api/admin/pages/home/draft') {
      if (request.method() === 'PUT') currentNodes = structuredClone(request.postDataJSON().nodes || currentNodes);
      return json({ ok: true, page: { id: 'page-home', slug: 'home', title: 'Home QA', nodes: currentNodes, revision: 1, updatedAt: new Date().toISOString() } });
    }
    if (path === '/api/admin/pages/home/snapshots') return json({ ok: true, snapshots: [] });
    if (path === '/api/public/pages/home') return json({ ok: true, page: { slug: 'home', title: 'Home QA', versionId: 'qa-v1', versionNumber: 1, nodes: currentNodes } });
    return json({ ok: true });
  });
}

async function openLeftPanel(page, testInfo) {
  if (!testInfo.project.name.includes('mobile')) return;
  const button = page.locator('[data-asteryon-mobile-toolbar] button[data-side="left"]');
  await expect(button).toBeVisible();
  await button.click();
  await expect(page.locator('[data-asteryon-editor-sidebar="left"]')).toHaveAttribute('data-open', 'true');
}

test('Equipe 4: Modelo Oficial aplica pelo Preview Final mesmo com marca sem logo', async ({ page }, testInfo) => {
  await installPreviewMocks(page);
  const dialogs = [];
  page.on('dialog', async dialog => {
    dialogs.push(dialog.message());
    await dialog.accept();
  });

  await page.goto('/admin', { waitUntil: 'networkidle' });
  await openLeftPanel(page, testInfo);
  await page.getByRole('button', { name: /^Modelos$/i }).first().click();
  await expect(page.getByRole('heading', { name: 'Modelos prontos' })).toBeVisible();

  const article = page.locator('article').filter({ has: page.getByRole('heading', { name: 'Modelo Oficial', exact: true }) }).first();
  await expect(article).toBeVisible();
  const previewButton = article.getByRole('button', { name: 'Pré-visualizar modelo completo' });
  await expect(previewButton).toBeVisible({ timeout: 10_000 });
  await previewButton.click();

  const preview = page.locator('#laurencini-template-preview-v69');
  await expect(preview).toBeVisible();
  await expect(preview.locator('.ltp-shell')).toBeVisible({ timeout: 10_000 });
  await expect(preview.getByText('Marca QA', { exact: true }).first()).toBeVisible();
  await expect(preview.getByText('Marca do catálogo', { exact: true }).first()).toBeVisible();

  await preview.getByRole('button', { name: 'Aplicar este modelo' }).click();
  await expect(page.getByRole('heading', { name: /Editar catálogo/i })).toBeVisible({ timeout: 12_000 });

  expect(dialogs.filter(message => message.includes('Modelo não aplicado')), `Alerta de produção reapareceu: ${dialogs.join(' | ')}`).toEqual([]);

  await expect.poll(async () => page.evaluate(() => document.documentElement.dataset.asteryonPreviewEditorParity || '')).toBe('ok');
  await expect.poll(async () => page.evaluate(() => document.documentElement.dataset.asteryonTeam4Parity || '')).toBe('approved');

  const audit = await page.evaluate(() => {
    const group3 = window.__ASTERYON_PREVIEW_EDITOR_PARITY_V91__ || null;
    const team4 = window.__ASTERYON_PREVIEW_EDITOR_TEAM4_V92__ || null;
    const nodes = window.__ASTERYON_PREVIEW_EDITOR_NODES_V91__ || [];
    const texts = [];
    const walk = item => {
      if (!item) return;
      if ((item.type === 'text' || item.type === 'button') && item.props?.text) texts.push(item.props.text);
      (item.children || []).forEach(walk);
    };
    nodes.forEach(walk);
    return { group3, team4, texts };
  });

  expect(audit.group3?.ok).toBe(true);
  expect(audit.group3?.editorInitialParityOk).toBe(true);
  expect(audit.team4?.preflight?.ok).toBe(true);
  expect(audit.team4?.editor?.ok).toBe(true);
  expect(audit.team4?.approved).toBe(true);
  expect(audit.texts).toContain('Marca QA');
  expect(audit.texts).toContain('Marca do catálogo');
});
