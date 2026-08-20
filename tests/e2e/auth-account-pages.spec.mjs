import { test, expect } from '@playwright/test';

function watchErrors(page) {
  const errors = [];
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  return errors;
}

async function expectNoHorizontalOverflow(page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
  expect(overflow).toBe(false);
}

test('tela dedicada de confirmação abre sem cair no catálogo público', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/auth/confirmar.html');
  await expect(page.getByRole('heading', { name: 'Confirmar acesso' })).toBeVisible();
  await expect(page.getByText(/Não há uma sessão de confirmação ativa/i)).toBeVisible();
  await expect(page.locator('#root')).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
  expect(errors).toEqual([]);
});

test('tela dedicada de redefinição exibe solicitação de recuperação sem sessão', async ({ page }) => {
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
  const errors = watchErrors(page);
  await page.goto('/auth/confirmar.html#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired');
  await expect(page.getByText(/link expirou ou já foi utilizado/i)).toBeVisible();
  await expect.poll(() => page.url()).not.toContain('#');
  await expect(page.getByRole('link', { name: /Definir ou redefinir senha/i })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  expect(errors).toEqual([]);
});
