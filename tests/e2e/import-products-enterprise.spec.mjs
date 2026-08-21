import { test, expect } from '@playwright/test';

const XLSX_FIXTURE = 'UEsDBBQAAAAAAAAAAAAAAAAAMwcAADMHAAAYAAAAeGwvd29ya3NoZWV0cy9zaGVldDEueG1sPD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9InllcyI/Pjx3b3Jrc2hlZXQgeG1sbnM9Imh0dHA6Ly9zY2hlbWFzLm9wZW54bWxmb3JtYXRzLm9yZy9zcHJlYWRzaGVldG1sLzIwMDYvbWFpbiI+PHNoZWV0RGF0YT48cm93IHI9IjEiPjxjIHI9IkExIiB0PSJpbmxpbmVTdHIiPjxpcz48dD5Dw7NkaWdvPC90PjwvaXM+PC9jPjxjIHI9IkIxIiB0PSJpbmxpbmVTdHIiPjxpcz48dD5EZXNjcmnDp8OjbzwvdD48L2lzPjwvYz48YyByPSJDMSIgdD0iaW5saW5lU3RyIj48aXM+PHQ+RGVzY3Jpw6fDo28gZG8gZGVwYXJ0YW1lbnRvPC90PjwvaXM+PC9jPjxjIHI9IkQxIiB0PSJpbmxpbmVTdHIiPjxpcz48dD5EZXNjcmnDp8OjbyBkYSBzZcOnw6NvPC90PjwvaXM+PC9jPjxjIHI9IkUxIiB0PSJpbmxpbmVTdHIiPjxpcz48dD5NYXJjYTwvdD48L2lzPjwvYz48YyByPSJGMSIgdD0iaW5saW5lU3RyIj48aXM+PHQ+Tm9tZSBkYSBjYXRlZ29yaWE8L3Q+PC9pcz48L2M+PGMgcj0iRzEiIHQ9ImlubGluZVN0ciI+PGlzPjx0PkVtYmFsYWdlbTwvdD48L2lzPjwvYz48YyByPSJIMSIgdD0iaW5saW5lU3RyIj48aXM+PHQ+RGVzY3Jpw6fDo28gZGEgdW5pZGFkZTwvdD48L2lzPjwvYz48YyByPSJJMSIgdD0iaW5saW5lU3RyIj48aXM+PHQ+RW1iYWxhZ2VtIE1hc3RlcjwvdD48L2lzPjwvYz48YyByPSJKMSIgdD0iaW5saW5lU3RyIj48aXM+PHQ+RGVzY3Jpw6fDo28gZGEgdW5pZGFkZV8xPC90PjwvaXM+PC9jPjxjIHI9IksxIiB0PSJpbmxpbmVTdHIiPjxpcz48dD5OQ00gKyBFeGNlw6fDo288L3Q+PC9pcz48L2M+PGMgcj0iTDEiIHQ9ImlubGluZVN0ciI+PGlzPjx0Pk5DTTwvdD48L2lzPjwvYz48YyByPSJNMSIgdD0iaW5saW5lU3RyIj48aXM+PHQ+VW5pZGFkZSBWZW5kYSBbRUFOOCwgVVBDMTIsIEVBTjEzLCBlIERVTjE0XTwvdD48L2lzPjwvYz48YyByPSJOMSIgdD0iaW5saW5lU3RyIj48aXM+PHQ+VW5pZGFkZSBNYXN0ZXIgW0VBTjgsIFVQQzEyLCBFQU4xMywgZSBEVU4xNF08L3Q+PC9pcz48L2M+PC9yb3c+PHJvdyByPSIyIj48YyByPSJBMiIgdD0iaW5saW5lU3RyIj48aXM+PHQ+MzI8L3Q+PC9pcz48L2M+PGMgcj0iQjIiIHQ9ImlubGluZVN0ciI+PGlzPjx0PkJBTEEgRkxPUEkgRElFVCA0MEcgRkxPUkVTVEFMPC90PjwvaXM+PC9jPjxjIHI9IkMyIiB0PSJpbmxpbmVTdHIiPjxpcz48dD5BVEFDQURPPC90PjwvaXM+PC9jPjxjIHI9IkQyIiB0PSJpbmxpbmVTdHIiPjxpcz48dD5CT01CT05JRVJJPC90PjwvaXM+PC9jPjxjIHI9IkUyIiB0PSJpbmxpbmVTdHIiPjxpcz48dD5GTE9SRVNUQUw8L3Q+PC9pcz48L2M+PGMgcj0iRjIiIHQ9ImlubGluZVN0ciI+PGlzPjx0PkJBTEFTICZhbXA7IERST1BTPC90PjwvaXM+PC9jPjxjIHI9IkcyIiB0PSJpbmxpbmVTdHIiPjxpcz48dD4xMlg0MEc8L3Q+PC9pcz48L2M+PGMgcj0iSDIiIHQ9ImlubGluZVN0ciI+PGlzPjx0PkRJU1BMQVk8L3Q+PC9pcz48L2M+PGMgcj0iSTIiIHQ9ImlubGluZVN0ciI+PGlzPjx0PjA0WDEyWDQwRzwvdD48L2lzPjwvYz48YyByPSJKMiIgdD0iaW5saW5lU3RyIj48aXM+PHQ+Q0FJWEE8L3Q+PC9pcz48L2M+PGMgcj0iSzIiIHQ9ImlubGluZVN0ciI+PGlzPjx0PjIxMDY5MDkwLjwvdD48L2lzPjwvYz48YyByPSJMMiIgdD0iaW5saW5lU3RyIj48aXM+PHQ+MjEwNjkwOTA8L3Q+PC9pcz48L2M+PGMgcj0iTTIiIHQ9ImlubGluZVN0ciI+PGlzPjx0Pjc4OTYzMjEwMDU2MDE8L3Q+PC9pcz48L2M+PGMgcj0iTjIiIHQ9ImlubGluZVN0ciI+PGlzPjx0PjE3ODk2MzIxMDA1NjA4PC90PjwvaXM+PC9jPjwvcm93Pjwvc2hlZXREYXRhPjwvd29ya3NoZWV0PlBLAQIUABQAAAAAAAAAAAAAAAAAMwcAADMHAAAYAAAAAAAAAAAAAAAAAAAAAAB4bC93b3Jrc2hlZXRzL3NoZWV0MS54bWxQSwUGAAAAAAEAAQBGAAAAaQcAAAAA';

async function installMocks(page) {
  const imports = [];
  await page.route('**/api/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json; charset=utf-8', body: JSON.stringify(body) });
    if (path === '/api/auth/status') return json({ ok: true, needsBootstrap: false, user: { id: 'qa-user', companyId: 'cmp_asteryon', email: 'qa@example.invalid', name: 'QA', role: 'SDM' } });
    if (path === '/api/admin/catalog/products/bulk' && request.method() === 'POST') {
      const body = request.postDataJSON();
      imports.push(body);
      return json({ ok: true, total: body.products.length, inserted: body.products.length, updated: 0, ignored: 0, errors: [] });
    }
    if (path === '/api/admin/catalog') return json({ ok: true, catalog: { products: [], brands: [], hierarchy: [], promotions: [], settings: {} } });
    if (path === '/api/admin/templates') return json({ ok: true, templates: [] });
    return json({ ok: true });
  });
  return imports;
}

async function openPanel(page, testInfo) {
  if (!testInfo.project.name.includes('mobile')) return;
  const button = page.locator('[data-asteryon-mobile-toolbar] button[data-side="left"]');
  await expect(button).toBeVisible();
  await button.click();
  await expect(page.locator('[data-asteryon-editor-sidebar="left"]')).toHaveAttribute('data-open', 'true');
}

test('Importar processa XLSX e envia os 14 campos oficiais ao Worker Enterprise', async ({ page }, testInfo) => {
  const imports = await installMocks(page);
  await page.goto('/admin', { waitUntil: 'networkidle' });
  await openPanel(page, testInfo);
  await page.getByRole('button', { name: /^Importar$/i }).first().click();
  const input = page.getByLabel('Arquivo para importar');
  await input.setInputFiles({ name: 'produtos-qa.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from(XLSX_FIXTURE, 'base64') });
  await page.getByRole('button', { name: /^Importar produtos$/i }).click();
  await expect.poll(() => imports.length).toBe(1);
  const product = imports[0].products[0];
  expect(product).toEqual(expect.objectContaining({ code: '32', name: 'BALA FLOPI DIET 40G FLORESTAL', departamentoName: 'ATACADO', secaoName: 'BOMBONIERI', categoriaName: 'BALAS & DROPS', brandName: 'FLORESTAL', packaging: '12X40G', unit: 'DISPLAY', ncm: '21069090', ean: '7896321005601' }));
  expect(product.technical['Embalagem Master']).toBe('04X12X40G');
  expect(product.technical['Descrição da unidade Master']).toBe('CAIXA');
  expect(product.technical['NCM + Exceção']).toBe('21069090.');
  expect(product.technical['Unidade Master EAN']).toBe('17896321005608');
  expect(Object.keys(product.sourceColumns)).toHaveLength(14);
  await expect(page.locator('[data-asteryon-import-summary]')).toContainText('Novos: 1');
  await expect(page.getByText('Importação de produtos concluída com sucesso.')).toBeVisible();
});
