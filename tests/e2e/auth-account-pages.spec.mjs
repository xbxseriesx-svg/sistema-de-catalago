import { test, expect } from '@playwright/test';

function watchErrors(page) {
  const errors = [];
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  return errors;
}

async function installAccountMocks(page) {
  await page.route('**/api/auth/account/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const json = (body, status = 200) => route.fulfill({
      status,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify(body),
    });

    if (path === '/api/auth/account/session' && request.method() === 'GET') {
      return json({ ok: true, authenticated: false, user: null });
    }
    if (path === '/api/auth/account/session' && request.method() === 'POST') {
      return json({ ok: false, error: { code: 'INVALID_AUTH_LINK', message: 'O link expirou ou a sessão não é mais válida' } }, 401);
    }
    if (path === '/api/auth/account/recovery' && request.method() === 'POST') {
      return json({ ok: true, message: 'Se existir uma conta para este e-mail, enviaremos um link para redefinir a senha.' });
    }
    if (path === '/api/auth/account/password' && request.method() === 'PUT') {
      return json({ ok: false, error: { code: 'RECOVERY_SESSION_REQUIRED', message: 'Sessão de recuperação necessária' } }, 401);
    }
    return json({ ok: false, error: { code: 'NOT_FOUND', message: 'Rota QA não simulada' } }, 404);
  });
}

async function expectNoHorizontalOverflow(page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
  expect(overflow).toBe(false);
}

test('tela dedicada de confirmação abre sem cair no catálogo público', async ({ page }) => {
  await installAccountMocks(page);
  const errors = watchErrors(page);
  await page.goto('/auth/confirmar.html');
  await expect(page.getByRole('heading', { name: 'Confirmar acesso' })).toBeVisible();
  await expect(page.getByText(/Não há uma sessão de confirmação ativa/i)).toBeVisible();
  await expect(page.locator('#root')).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
  expect(errors).toEqual([]);
});

test('tela dedicada de redefinição exibe solicitação de recuperação sem sessão', async ({ page }) => {
  await installAccountMocks(page);
  const errors = watchErrors(page);
  await page.goto('/auth/redefinir-senha.html');
  await expect(page.getByRole('heading', { name: 'Redefinir senha' })).toBeVisible();
  await expect(page.locator('#recovery-form')).toBeVisible();
  await expect(page.locator('#password-form')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Enviar link de recuperação' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  expect(errors).toEqual([]);
});

test('link expirado é tratado na tela de confirmação e o fragmento sensível é removido', async ({ page }) => {
  await installAccountMocks(page);
  const errors = watchErrors(page);
  await page.goto('/auth/confirmar.html#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired');
  await expect(page.getByText(/link expirou ou já foi utilizado/i)).toBeVisible();
  await expect.poll(() => page.url()).not.toContain('#');
  await expect(page.getByRole('link', { name: /Definir ou redefinir senha/i })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  expect(errors).toEqual([]);
});
