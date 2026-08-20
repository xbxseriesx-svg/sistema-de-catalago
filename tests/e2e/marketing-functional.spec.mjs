import { test, expect } from '@playwright/test';

const pixel = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="20" height="20"%3E%3Crect width="20" height="20" fill="%23ec4899"/%3E%3C/svg%3E';

function initialMarketing() {
  return {
    theme: {}, banner: { active: false, mediaUrl: '' }, videoBanner: { active: false, mediaUrl: '' },
    carousel: { active: true, autoplay: false, speed: 1, items: [{ id: 'qa-slide', url: pixel, alt: 'QA Marketing' }] },
    layout: { x: 24, y: 36, width: 520, height: 240, zIndex: 700, visible: true },
  };
}

async function installMocks(page, state) {
  await page.route('**/api/**', async route => {
    const request = route.request(); const path = new URL(request.url()).pathname; const method = request.method();
    const fulfill = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (path === '/api/auth/status') return fulfill({ ok: true, needsBootstrap: false, user: { id: 'qa-user', companyId: 'cmp_asteryon', email: 'qa@example.invalid', name: 'QA', role: 'SDM' } });
    if (path === '/api/admin/catalog' || path === '/api/public/catalog') return fulfill({ ok: true, catalog: { products: [], brands: [], hierarchy: [], promotions: [], settings: {} } });
    if (path === '/api/public/marketing' || (path === '/api/admin/marketing' && method === 'GET')) return fulfill({ ok: true, marketing: state.marketing });
    if (path === '/api/admin/marketing' && method === 'PUT') {
      const payload = request.postDataJSON(); state.marketing = payload.marketing; state.saves.push(structuredClone(payload.marketing)); return fulfill({ ok: true, marketing: state.marketing });
    }
    if (path.startsWith('/api/admin/media/') && method === 'DELETE') { state.mediaDeletes.push(path); return fulfill({ ok: true }); }
    if (path === '/api/admin/pages/home') return fulfill({ ok: true, page: { id: 'page_home', slug: 'home', title: 'Home', nodes: [], revision: 1, updatedAt: new Date().toISOString() } });
    if (path.includes('/templates')) return fulfill({ ok: true, templates: [] });
    if (path.includes('/snapshots')) return fulfill({ ok: true, snapshots: [] });
    if (path.includes('/publications')) return fulfill({ ok: true, publications: [] });
    return fulfill({ ok: true });
  });
}

async function openPanel(page, projectName) {
  const heading = page.getByText(/Gest[aã]o do Cat[aá]logo/i).first();
  if (projectName.includes('mobile')) { const panel = page.getByRole('button', { name: /Painel/i }).first(); await expect(panel).toBeVisible(); await panel.click(); }
  await expect(heading).toBeVisible({ timeout: 15_000 });
}

async function pointerGesture(page, selector, dx, dy, pointerType) {
  await page.evaluate(async ({ selector, dx, dy, pointerType }) => {
    const target = document.querySelector(selector);
    if (!(target instanceof HTMLElement)) throw new Error(`Handle não encontrado: ${selector}`);
    const box = target.getBoundingClientRect();
    const startX = box.left + Math.min(30, Math.max(3, box.width / 3));
    const startY = box.top + Math.min(16, Math.max(3, box.height / 2));
    const init = { bubbles: true, cancelable: true, pointerId: 17, pointerType, isPrimary: true, width: 2, height: 2, pressure: .5 };
    target.dispatchEvent(new PointerEvent('pointerdown', { ...init, clientX: startX, clientY: startY, buttons: 1, button: 0 }));
    for (let step = 1; step <= 6; step += 1) {
      window.dispatchEvent(new PointerEvent('pointermove', {
        ...init,
        clientX: startX + (dx * step / 6),
        clientY: startY + (dy * step / 6),
        buttons: 1,
        button: -1,
      }));
      await new Promise(resolve => requestAnimationFrame(resolve));
    }
    window.dispatchEvent(new PointerEvent('pointerup', { ...init, clientX: startX + dx, clientY: startY + dy, buttons: 0, button: 0 }));
  }, { selector, dx, dy, pointerType });
}

test('Marketing move, redimensiona, persiste e exclui no canvas', async ({ page }, testInfo) => {
  const mobile = testInfo.project.name.includes('mobile');
  const state = { marketing: initialMarketing(), saves: [], mediaDeletes: [] }; const runtimeErrors = [];
  page.on('pageerror', error => runtimeErrors.push(error.message)); page.on('console', message => { if (message.type() === 'error') runtimeErrors.push(message.text()); }); page.on('dialog', dialog => dialog.accept());
  await installMocks(page, state); await page.goto('/admin', { waitUntil: 'networkidle' }); await openPanel(page, testInfo.project.name); await page.getByRole('button', { name: /^Marketing$/i }).first().click();

  const object = page.locator('[data-marketing-hotfix="true"]'); await expect(object).toBeVisible({ timeout: 15_000 }); await expect(object).toHaveCSS('left', '24px'); await expect(object).toHaveCSS('top', '36px');
  const toolbar = object.locator('[data-marketing-drag-handle="true"]'); await expect(toolbar).toHaveCSS('touch-action', 'none');
  await pointerGesture(page, '[data-marketing-drag-handle="true"]', 65, 40, mobile ? 'touch' : 'mouse');
  await expect.poll(() => state.saves.length).toBeGreaterThan(0);
  const moved = state.saves.at(-1).layout; expect(moved.x).toBeGreaterThan(24); expect(moved.y).toBeGreaterThan(36);

  const resize = object.locator('[data-marketing-resize="se"]'); await expect(resize).toHaveCSS('touch-action', 'none');
  const savesBeforeResize = state.saves.length;
  await pointerGesture(page, '[data-marketing-resize="se"]', 80, 50, mobile ? 'touch' : 'mouse');
  await expect.poll(() => state.saves.length).toBeGreaterThan(savesBeforeResize);
  const resized = state.saves.at(-1).layout; expect(resized.width).toBeGreaterThan(moved.width); expect(resized.height).toBeGreaterThan(moved.height);

  const savesBeforeDelete = state.saves.length; await object.getByRole('button', { name: 'Excluir' }).click(); await expect.poll(() => state.saves.length).toBeGreaterThan(savesBeforeDelete);
  const deleted = state.saves.at(-1); expect(deleted.layout.visible).toBe(false); expect(deleted.carousel.active).toBe(false); expect(deleted.carousel.items).toEqual([]); await expect(object).toHaveCount(0); expect(runtimeErrors).toEqual([]);
});
