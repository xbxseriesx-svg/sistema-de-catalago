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

function cookieByName(cookies, name) {
  return cookies.find(cookie => cookie.name === name);
}

function portableCookie(cookie) {
  return {
    name: cookie.name,
    value: cookie.value,
    domain: cookie.domain,
    path: cookie.path,
    expires: cookie.expires,
    httpOnly: cookie.httpOnly,
    secure: cookie.secure,
    sameSite: cookie.sameSite,
  };
}

test('login real → sessão → refresh real → logout', async ({ page, context }) => {
  await page.goto('/auth/redefinir-senha.html');
  await expect(page.getByRole('heading', { name: 'Redefinir senha' })).toBeVisible();

  const login = await api(page, '/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  expect(login.status).toBe(200);
  expect(login.payload?.ok).toBe(true);
  expect(login.payload?.user?.email).toBe(email);
  expect(login.payload?.user?.companyId).toBe(expectedCompany);
  expect(['ADMIN', 'SDM']).toContain(login.payload?.user?.role);

  let cookies = await context.cookies();
  const access = cookieByName(cookies, '__Host-asteryon_access');
  const refresh = cookieByName(cookies, '__Host-asteryon_refresh');
  expect(access).toBeTruthy();
  expect(refresh).toBeTruthy();
  expect(access.httpOnly).toBe(true);
  expect(refresh.httpOnly).toBe(true);
  expect(access.secure).toBe(true);
  expect(refresh.secure).toBe(true);
  expect(access.sameSite).toBe('Strict');
  expect(refresh.sameSite).toBe('Strict');

  const statusBefore = await api(page, '/api/auth/status');
  expect(statusBefore.status).toBe(200);
  expect(statusBefore.payload?.ok).toBe(true);
  expect(statusBefore.payload?.user?.companyId).toBe(expectedCompany);
  expect(statusBefore.payload?.user?.email).toBe(email);

  // Simula somente a expiração/perda do access token no navegador. O refresh token
  // continua sendo o token real emitido pelo Supabase durante o login acima.
  await context.clearCookies();
  await context.addCookies([portableCookie(refresh)]);

  const statusAfterRefresh = await api(page, '/api/auth/status');
  expect(statusAfterRefresh.status).toBe(200);
  expect(statusAfterRefresh.payload?.ok).toBe(true);
  expect(statusAfterRefresh.payload?.user?.companyId).toBe(expectedCompany);
  expect(statusAfterRefresh.payload?.user?.email).toBe(email);

  cookies = await context.cookies();
  expect(cookieByName(cookies, '__Host-asteryon_access')).toBeTruthy();
  expect(cookieByName(cookies, '__Host-asteryon_refresh')).toBeTruthy();

  const logout = await api(page, '/api/auth/logout', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
  });
  expect(logout.status).toBe(200);
  expect(logout.payload?.ok).toBe(true);

  const statusAfterLogout = await api(page, '/api/auth/status');
  expect(statusAfterLogout.status).toBe(200);
  expect(statusAfterLogout.payload?.ok).toBe(true);
  expect(statusAfterLogout.payload?.user).toBeNull();

  cookies = await context.cookies();
  expect(cookieByName(cookies, '__Host-asteryon_access')).toBeFalsy();
  expect(cookieByName(cookies, '__Host-asteryon_refresh')).toBeFalsy();
});
