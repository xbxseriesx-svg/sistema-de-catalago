import { test, expect } from '@playwright/test';

const templateNames = [
  'Varejo Contínuo',
  'Atacado B2B',
  'Distribuidora Institucional',
  'Catálogo de Marcas B2B',
  'Distribuidora União • Figma B2B',
  'Catálogo Hierárquico B2B',
  'Vitrine Atacado Pro',
  'Modelo Oficial',
];

const heroText = 'Um catálogo completo para apresentar a força da Laurencini.';

const basePage = {
  id: 'qa-preview-base-page', type: 'page', name: 'Página base QA',
  x: 0, y: 0, width: 1440, height: 1800, rotation: 0, zIndex: 0,
  visible: true, locked: false, opacity: 1,
  styles: { backgroundColor: '#ffffff' }, props: {}, children: [],
};

function templatesFixture() {
  return templateNames.map((name, index) => ({
    id: `qa-template-${index + 1}`,
    name,
    title: name,
    systemKey: `qa-v91-${index + 1}`,
    system_key: `qa-v91-${index + 1}`,
    nodes: [structuredClone(basePage)],
  }));
}

function nodeTexts(nodes) {
  const values = [];
  const walk = (item) => {
    if (!item) return;
    if (item.props?.text) values.push(String(item.props.text));
    for (const child of item.children || []) walk(child);
  };
  for (const node of nodes || []) walk(node);
  return values;
}

async function installPreviewMocks(page) {
  let currentNodes = [structuredClone(basePage)];
  const templates = templatesFixture();
  const draftWrites = [];

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const json = (body, status = 200) => route.fulfill({
      status,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify(body),
    });

    if (path === '/api/auth/status') {
      return json({
        ok: true,
        needsBootstrap: false,
        user: { id: 'qa-v91-user', companyId: 'cmp_asteryon', email: 'qa-v91@example.invalid', name: 'QA V91', role: 'SDM' },
      });
    }

    if (path === '/api/admin/catalog' || path === '/api/public/catalog') {
      return json({
        ok: true,
        catalog: {
          products: [
            {
              id: 'qa-product-1', code: '000123', name: 'Produto QA V91', shortDescription: 'Produto QA V91',
              status: 'ativo', brandId: 'qa-brand-logo', departamentoId: 'qa-dep', secaoId: 'qa-sec', categoriaId: 'qa-cat',
              image: '/laurencini-logo-v69.svg', packaging: 'CX 12',
              departamentoName: 'Departamento QA', secaoName: 'Seção QA', categoriaName: 'Categoria QA',
            },
          ],
          brands: [
            { id: 'qa-brand-logo', name: 'Marca QA com Logo', slug: 'marca-qa-logo', status: 'active', logoUrl: '/laurencini-logo-v69.svg' },
            { id: 'qa-brand-text', name: 'Marca QA sem Logo', slug: 'marca-qa-texto', status: 'active' },
          ],
          hierarchy: [
            { id: 'qa-dep', level: 'departamento', name: 'Departamento QA', slug: 'departamento-qa', parentId: null, status: 'active' },
            { id: 'qa-sec', level: 'secao', name: 'Seção QA', slug: 'secao-qa', parentId: 'qa-dep', status: 'active' },
            { id: 'qa-cat', level: 'categoria', name: 'Categoria QA', slug: 'categoria-qa', parentId: 'qa-sec', status: 'active' },
          ],
          promotions: [],
          settings: { displayFields: ['image', 'code', 'shortDescription', 'brand', 'category', 'unit'] },
        },
      });
    }

    if (path === '/api/admin/templates') return json({ ok: true, templates });
    if (path === '/api/admin/templates/seed') return json({ ok: true, templates });
    if (path === '/api/admin/brands' || path === '/api/public/brands') {
      return json({ ok: true, brands: [
        { id: 'qa-brand-logo', name: 'Marca QA com Logo', slug: 'marca-qa-logo', status: 'active', logoUrl: '/laurencini-logo-v69.svg' },
        { id: 'qa-brand-text', name: 'Marca QA sem Logo', slug: 'marca-qa-texto', status: 'active' },
      ] });
    }
    if (path === '/api/admin/marketing' || path === '/api/public/marketing') {
      return json({ ok: true, marketing: {
        banner: { active: false }, videoBanner: { active: false },
        carousel: { active: false, items: [] },
        theme: { mode: 'light', primary: '#214C8F', secondary: '#D13130', background: '#ffffff', surface: '#f4f8fc', text: '#18181b' },
      } });
    }
    if (path === '/api/admin/pages/home/draft') {
      if (request.method() === 'PUT') {
        const payload = request.postDataJSON();
        draftWrites.push(structuredClone(payload));
        currentNodes = structuredClone(payload.nodes || currentNodes);
      }
      return json({ ok: true, page: {
        id: 'qa-page-home', slug: 'home', title: 'Home QA V91', nodes: currentNodes,
        revision: 1, updatedAt: new Date().toISOString(),
      } });
    }
    if (path === '/api/admin/pages/home/snapshots') return json({ ok: true, snapshots: [] });
    if (path === '/api/public/pages/home') return json({ ok: true, page: {
      slug: 'home', title: 'Home QA V91', versionId: 'qa-v91', versionNumber: 1,
      publishedAt: new Date().toISOString(), nodes: currentNodes,
    } });

    return json({ ok: true });
  });

  return {
    getDraftWrites: () => structuredClone(draftWrites),
    getCurrentNodes: () => structuredClone(currentNodes),
  };
}

async function openModels(page, testInfo) {
  await page.goto('/admin', { waitUntil: 'networkidle' });
  if (testInfo.project.name.includes('mobile')) {
    const panel = page.locator('[data-asteryon-mobile-toolbar] button[data-side="left"]');
    await expect(panel).toBeVisible();
    await panel.click();
  }
  const models = page.getByRole('button', { name: /^Modelos$/i }).first();
  await expect(models).toBeVisible();
  await models.click();
  await expect(page.getByRole('heading', { name: 'Modelos prontos' })).toBeVisible();
}

test('Preview Final preenchido aplica e persiste no editor sem falso missingTexts', async ({ page }, testInfo) => {
  const mock = await installPreviewMocks(page);
  const dialogMessages = [];
  page.on('dialog', async (dialog) => {
    dialogMessages.push(dialog.message());
    await dialog.accept();
  });

  await openModels(page, testInfo);

  const preview = page.getByRole('button', { name: /Pré-visualizar modelo completo/i }).first();
  await expect(preview).toBeVisible({ timeout: 10_000 });
  await preview.click();

  const overlay = page.locator('#laurencini-template-preview-v69');
  await expect(overlay).toBeVisible();
  await expect(overlay.locator('.ltp-shell')).toBeVisible();

  // Reproduz a estrutura que causava o falso negativo: blocos com texto pai/filhos
  // e marcas convertidas semanticamente em carrossel editável.
  await expect(overlay.locator('.ltp-hero-stat strong').first()).toBeVisible();
  await expect(overlay.locator('.ltp-hero-stat span').first()).toBeVisible();
  await expect(overlay.locator('.ltp-brand-grid')).toBeVisible();

  await overlay.getByRole('button', { name: /^Aplicar este modelo$/i }).click();

  await expect(overlay).toHaveCount(0);
  expect(
    dialogMessages.filter((message) => message.includes('Modelo não aplicado')),
    `A aplicação repetiu o erro do vídeo: ${dialogMessages.join(' | ')}`,
  ).toEqual([]);

  await expect.poll(() => mock.getDraftWrites().length, { timeout: 10_000 }).toBeGreaterThan(0);
  const write = mock.getDraftWrites().at(-1);
  expect(write.expectedRevision, 'O handler original precisa manter a proteção de revisão.').toBe(1);
  expect(nodeTexts(write.nodes)).toContain(heroText);
  expect(nodeTexts(mock.getCurrentNodes())).toContain(heroText);

  // A V91 recarrega o editor após a resposta 2xx para consumir o draft realmente
  // persistido, pois o React mantém uma cópia própria do template aplicado.
  await expect(page.getByText(heroText, { exact: true }).first()).toBeVisible({ timeout: 15_000 });

  const stored = await page.evaluate(() => JSON.parse(sessionStorage.getItem('asteryon_preview_editor_parity_v91') || 'null'));
  expect(stored, 'A aplicação não persistiu o relatório funcional da V91.').not.toBeNull();
  expect(stored.missingTexts).toEqual([]);
  expect(stored.missingImages).toEqual([]);
  expect(stored.missingBrandLogos).toEqual([]);
  expect(stored.missingBrandNames).toEqual([]);
  expect(stored.templateReferencesUpdated).toBeGreaterThan(0);
});
