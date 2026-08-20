import { test, expect } from '@playwright/test';

const email = String(process.env.QA_E2E_EMAIL || '').trim();
const password = String(process.env.QA_E2E_PASSWORD || '');
const expectedCompany = 'qa_e2e_asteryon';

if (!email) throw new Error('QA_E2E_EMAIL ausente');
if (!password) throw new Error('QA_E2E_PASSWORD ausente');

async function api(page, path, init = {}) {
  return page.evaluate(async ({ path, init }) => {
    const response = await fetch(path, init);
    let payload = null;
    try { payload = await response.json(); } catch { payload = null; }
    return { status: response.status, payload };
  }, { path, init });
}

test('preview QA: login real e leituras administrativas reais', async ({ page }) => {
  await page.goto('/auth/redefinir-senha.html');
  await expect(page.getByRole('heading', { name: 'Redefinir senha' })).toBeVisible();

  const login = await api(page, '/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  expect(login.status).toBe(200);
  expect(login.payload?.ok).toBe(true);
  expect(login.payload?.user?.companyId).toBe(expectedCompany);
  expect(login.payload?.user?.email).toBe(email);
  expect(['ADMIN', 'SDM']).toContain(login.payload?.user?.role);

  const catalog = await api(page, '/api/admin/catalog');
  expect(catalog.status).toBe(200);
  expect(catalog.payload?.ok).toBe(true);
  expect(Array.isArray(catalog.payload?.catalog?.products)).toBe(true);
  expect(Array.isArray(catalog.payload?.catalog?.brands)).toBe(true);
  expect(Array.isArray(catalog.payload?.catalog?.hierarchy)).toBe(true);

  const marketing = await api(page, '/api/admin/marketing');
  expect(marketing.status).toBe(200);
  expect(marketing.payload?.ok).toBe(true);

  const offers = await api(page, '/api/admin/catalog/offers');
  expect(offers.status).toBe(200);
  expect(offers.payload?.ok).toBe(true);
  expect(Array.isArray(offers.payload?.offers)).toBe(true);

  const templates = await api(page, '/api/admin/templates');
  expect(templates.status).toBe(200);
  expect(templates.payload?.ok).toBe(true);
  expect(Array.isArray(templates.payload?.templates)).toBe(true);

  const logout = await api(page, '/api/auth/logout', { method: 'POST' });
  expect(logout.status).toBe(200);
  expect(logout.payload?.ok).toBe(true);
});
