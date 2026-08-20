import { test, expect } from '@playwright/test';

async function installMocks(page) {
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    const fulfill = body => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    if (path === '/api/auth/status') return fulfill({ ok: true, needsBootstrap: false, user: { id: 'qa', companyId: 'cmp_asteryon', role: 'SDM', email: 'qa@example.invalid' } });
    if (path === '/api/admin/catalog' || path === '/api/public/catalog') {
      return fulfill({ ok: true, catalog: {
        products: [{ id: 'p1', code: '1001', name: 'Produto QA', status: 'active', departamentoId: 'd1', secaoId: 's1', categoriaId: 'c1' }],
        brands: [{ id: 'b1', name: 'Marca QA', status: 'active' }],
        hierarchy: [
          { id: 'd1', type: 'departamento', name: 'Atacado', parentId: null, status: 'active' },
          { id: 's1', type: 'secao', name: 'Bebidas', parentId: 'd1', status: 'active' },
          { id: 'c1', type: 'categoria', name: 'Águas', parentId: 's1', status: 'active' },
        ],
        promotions: [], settings: {},
      } });
    }
    if (path === '/api/admin/marketing' || path === '/api/public/marketing') return fulfill({ ok: true, marketing: { theme: {}, banner: {}, videoBanner: {}, carousel: { items: [] }, layout: {} } });
    if (path === '/api/admin/pages/home') return fulfill({ ok: true, page: { id: 'home', slug: 'home', nodes: [], revision: 1 } });
    if (path.includes('/templates')) return fulfill({ ok: true, templates: [] });
    if (path.includes('/snapshots')) return fulfill({ ok: true, snapshots: [] });
    if (path.includes('/publications')) return fulfill({ ok: true, publications: [] });
    return fulfill({ ok: true });
  });
}

async function openPanel(page, projectName) {
  const heading = page.getByText(/Gest[aã]o do Cat[aá]logo/i).first();
  if (projectName.includes('mobile')) {
    await page.getByRole('button', { name: /Painel/i }).first().click();
  }
  await expect(heading).toBeVisible({ timeout: 15_000 });
}

test('painéis laterais aceitam rolagem manual e não auto-rolam com movimento do mouse', async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await installMocks(page);
  await page.goto('/admin', { waitUntil: 'networkidle' });
  await openPanel(page, testInfo.project.name);

  const result = await page.evaluate(async () => {
    const shell = document.querySelector('#root > div.h-screen.w-screen.overflow-hidden > div.flex.flex-1.overflow-hidden');
    if (!shell) return { ok: false, reason: 'shell' };
    const sidebars = [...shell.querySelectorAll(':scope > div.flex.shrink-0.flex-col')];
    if (!sidebars.length) return { ok: false, reason: 'sidebars' };

    const checked = [];
    for (const sidebar of sidebars) {
      const candidates = [sidebar, ...sidebar.querySelectorAll('*')].filter(node => {
        const style = getComputedStyle(node);
        return style.overflowY === 'auto' || style.overflowY === 'scroll';
      });
      const target = candidates.find(node => node.clientHeight > 0) || null;
      if (!target) continue;

      const sentinel = document.createElement('div');
      sentinel.dataset.qaScrollSentinel = 'true';
      sentinel.style.height = '2200px';
      sentinel.style.width = '1px';
      sentinel.style.pointerEvents = 'none';
      target.append(sentinel);
      target.scrollTop = 180;
      const before = target.scrollTop;
      document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: innerWidth / 2, clientY: innerHeight - 2 }));
      target.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 8, clientY: target.getBoundingClientRect().bottom - 2 }));
      await new Promise(resolve => setTimeout(resolve, 120));
      const after = target.scrollTop;
      checked.push({ before, after, overflowY: getComputedStyle(target).overflowY, scrollHeight: target.scrollHeight, clientHeight: target.clientHeight });
      sentinel.remove();
    }
    return { ok: checked.length > 0, checked };
  });

  expect(result.ok, JSON.stringify(result)).toBe(true);
  for (const item of result.checked) {
    expect(['auto', 'scroll']).toContain(item.overflowY);
    expect(item.scrollHeight).toBeGreaterThan(item.clientHeight);
    expect(item.before).toBeGreaterThan(0);
    expect(Math.abs(item.after - item.before)).toBeLessThanOrEqual(1);
  }
  expect(errors).toEqual([]);
});
